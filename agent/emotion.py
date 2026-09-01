"""汐月情绪状态机（轻量、无脸也能有"人味"）。

铁律：情绪只影响表达（措辞 / 状态点颜色 / 面板微文案），绝不参与权限判定。
权限由 policy.py 决定，情绪无权改写。

信号 → 当前情绪（带短时衰减，衰减逻辑后续补全）。
实现位置：prompt_builder 注入一句 mood 提示；UI 经 IPC 读取 EMOTION_COLOR 渲染状态点。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class EmotionState(str, Enum):
    CALM = "calm"        # 平静（默认）
    HAPPY = "happy"      # 愉悦
    FOCUSED = "focused"  # 专注（执行中）
    TIRED = "tired"      # 疲惫（深夜 / 长会话）
    WORRIED = "worried"  # 担忧（拿不准 / 高风险）
    PLAYFUL = "playful"  # 俏皮（闲聊 / 问候）


# 状态点颜色（RGB hex），供 Rust / React 读取
EMOTION_COLOR: dict[EmotionState, str] = {
    EmotionState.CALM: "#378ADD",
    EmotionState.HAPPY: "#1D9E75",
    EmotionState.FOCUSED: "#BA7517",
    EmotionState.TIRED: "#534AB7",
    EmotionState.WORRIED: "#D85A30",
    EmotionState.PLAYFUL: "#D4537E",
}


@dataclass
class EmotionContext:
    """每轮计算情绪的输入信号。"""
    hour: int = 12                       # 当前小时 (0-23)
    user_tone: str = "neutral"          # neutral / friendly / anxious / angry
    task_success: Optional[bool] = None  # 最近任务成败
    is_executing: bool = False           # 是否正在执行工具
    idle_minutes: int = 0               # 距上次交互的空闲分钟数
    pending_risk: str = "none"          # none / read / write / destructive / network / credential


def compute_emotion(ctx: EmotionContext, prev: Optional[EmotionState] = None) -> EmotionState:
    """根据信号计算当前情绪。

    优先级（从高到低）：执行中 > 高风险/焦虑 > 疲惫 > 任务成败 > 用户友好/时段 >
    平静。短时衰减（让情绪在信号消失后缓慢回落）后续在此处补全。
    """
    if ctx.is_executing:
        return EmotionState.FOCUSED
    if ctx.pending_risk in ("destructive", "credential", "network") or ctx.user_tone == "anxious":
        return EmotionState.WORRIED
    if ctx.hour >= 23 or ctx.hour < 6 or ctx.idle_minutes > 30:
        return EmotionState.TIRED
    if ctx.task_success is True:
        return EmotionState.HAPPY
    if ctx.task_success is False:
        return EmotionState.WORRIED
    if ctx.user_tone == "friendly" or (7 <= ctx.hour < 23 and ctx.idle_minutes < 2):
        return EmotionState.PLAYFUL
    return EmotionState.CALM


def mood_line(state: EmotionState) -> str:
    """给 prompt_builder 注入的一句情绪提示（仅影响表达，不写指令）。"""
    return f"[当前情绪：{state.value}]"
