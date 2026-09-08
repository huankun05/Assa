"""汐月身份层（自己接入自己）。

职责：
- 提供程序化身份读取接口，供侧车/前端/托盘/语音统一引用
- xiyue.json 为事实源，xiyue.md 为完整人设文本
- 情绪不影响权限（铁律），此处只读身份信息
"""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
PERSONA_JSON = ROOT / "agent" / "persona" / "xiyue.json"
PERSONA_MD = ROOT / "agent" / "persona" / "xiyue.md"

# 默认配置（若 xiyue.json 缺失时回退）
_DEFAULT: dict[str, Any] = {
    "name": "汐月",
    "visible_name": "汐月",
    "english_name": "Xiyue",
    "role": "本地常驻 AI 管家",
    "model_default": "qwen3-4b-32k",
    "system_identifier": "xiyue-local-agent",
    "persona_file": "agent/persona/xiyue.md",
    "greeting": "我在，怎么了？",
    "language_default": "zh-CN",
    "privacy": {
        "local_first": True,
        "cloud_fallback_default": False,
        "data_never_leave_machine": True,
    },
    "emotion": {
        "enabled": True,
        "default_state": "calm",
    },
    "memory": {
        "enabled": True,
        "max_history_turns": 10,
    },
    "tools": {
        "enabled": True,
        "max_rounds_per_turn": 8,
    },
}

_cached: dict[str, Any] | None = None


def _load_json() -> dict[str, Any]:
    """加载 xiyue.json，缺失时返回默认配置。"""
    global _cached
    if _cached is not None:
        return _cached
    if PERSONA_JSON.exists():
        try:
            with open(PERSONA_JSON, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError("xiyue.json 根必须是对象")
            _cached = {**_DEFAULT, **data}
            return _cached
        except Exception:
            pass
    _cached = dict(_DEFAULT)
    return _cached


def get_name() -> str:
    """内部标识名。"""
    return str(_load_json().get("name", "汐月"))


def get_visible_name() -> str:
    """对外显示名（UI / 语音 / 日志）。"""
    return str(_load_json().get("visible_name", get_name()))


def get_english_name() -> str:
    """英文名（用于日志/文件/协议标识）。"""
    return str(_load_json().get("english_name", "Xiyue"))


def get_role() -> str:
    """角色描述。"""
    return str(_load_json().get("role", "本地常驻 AI 管家"))


def get_model_default() -> str:
    """默认 LLM 模型名。"""
    return str(_load_json().get("model_default", "qwen3-4b-32k"))


def get_system_identifier() -> str:
    """系统级标识（用于日志、审计、协议头）。"""
    return str(_load_json().get("system_identifier", "xiyue-local-agent"))


def get_persona_file() -> Path:
    """完整人设文件路径（相对项目根）。"""
    rel = str(_load_json().get("persona_file", "agent/persona/xiyue.md"))
    p = ROOT / rel
    return p if p.exists() else PERSONA_MD


def get_persona_text() -> str:
    """读取完整人设文本（供 prompt_builder 注入）。"""
    p = get_persona_file()
    if p.exists():
        return p.read_text(encoding="utf-8")
    return ""


def get_greeting() -> str:
    """默认问候语。"""
    return str(_load_json().get("greeting", "我在，怎么了？"))


def get_language_default() -> str:
    """默认语言。"""
    return str(_load_json().get("language_default", "zh-CN"))


def is_local_first() -> bool:
    """是否本地优先。"""
    return bool(_load_json().get("privacy", {}).get("local_first", True))


def is_cloud_fallback_default_off() -> bool:
    """云端兜底是否默认关闭。"""
    return not bool(_load_json().get("privacy", {}).get("cloud_fallback_default", False))


def is_data_never_leave_machine() -> bool:
    """数据是否不出本机。"""
    return bool(_load_json().get("privacy", {}).get("data_never_leave_machine", True))


def is_emotion_enabled() -> bool:
    """是否启用情绪系统。"""
    return bool(_load_json().get("emotion", {}).get("enabled", True))


def get_emotion_default_state() -> str:
    """默认情绪状态。"""
    return str(_load_json().get("emotion", {}).get("default_state", "calm"))


def is_memory_enabled() -> bool:
    """是否启用长期记忆。"""
    return bool(_load_json().get("memory", {}).get("enabled", True))


def get_max_history_turns() -> int:
    """上下文保留的最大历史轮数。"""
    return int(_load_json().get("memory", {}).get("max_history_turns", 10))


def is_tools_enabled() -> bool:
    """是否启用工具调用。"""
    return bool(_load_json().get("tools", {}).get("enabled", True))


def get_max_tool_rounds() -> int:
    """每轮对话最大工具调用轮数。"""
    return int(_load_json().get("tools", {}).get("max_rounds_per_turn", 8))


# ---- 情绪状态（轻量全局状态，供 identity / server 共享）----
_emotion_lock = threading.Lock()
_current_emotion: str = ""


def _infer_emotion() -> str:
    """根据当前时间推断情绪（Phase 0 简化版）。"""
    try:
        default = get_emotion_default_state()
    except Exception:
        default = "calm"
    hour = time.localtime().tm_hour
    if hour >= 23 or hour < 6:
        return "tired"
    return default


def get_current_emotion() -> str:
    """获取当前情绪状态（线程安全）。"""
    global _current_emotion
    with _emotion_lock:
        if not _current_emotion:
            _current_emotion = _infer_emotion()
        return _current_emotion


def set_current_emotion(state: str) -> None:
    """设置当前情绪状态（线程安全）。"""
    global _current_emotion
    with _emotion_lock:
        _current_emotion = state


def build_system_prompt(extra_rules: str = "", emotion_state: str = "") -> str:
    """组装完整 system prompt（人设 + 运行时规则 + 可选补充）。"""
    parts: list[str] = []

    # 1) 完整人设
    persona = get_persona_text()
    if persona.strip():
        parts.append(persona.strip())

    # 2) 身份标识行（供模型确认身份）
    parts.append(f"[身份标识] 你是 {get_visible_name()}（{get_english_name()}），{get_role()}。")
    parts.append(f"[系统标识] {get_system_identifier()}")

    # 3) 情绪注入（铁律：只改表达，不影响权限）
    if is_emotion_enabled() and emotion_state:
        parts.append(f"[当前情绪：{emotion_state}]")

    # 4) 运行时规则
    rules = [
        f"回复用 {get_language_default()}，自然口语化。",
        "不用 markdown、不用列表、不堆 emoji（除非用户要）。",
        "情绪只改表达，不影响权限。",
    ]
    if extra_rules.strip():
        rules.append(extra_rules.strip())
    parts.append("[运行时规则] " + " ".join(rules))

    return "\n\n".join(parts)


class XiyueIdentityReader:
    """身份读取器，提供结构化身份信息。"""

    def __init__(self) -> None:
        self._data = _load_json()

    def as_dict(self) -> dict[str, object]:
        return {
            "name": get_name(),
            "visible_name": get_visible_name(),
            "english_name": get_english_name(),
            "role": get_role(),
            "model_default": get_model_default(),
            "system_identifier": get_system_identifier(),
            "greeting": get_greeting(),
            "language_default": get_language_default(),
            "local_first": is_local_first(),
            "cloud_fallback_default_off": is_cloud_fallback_default_off(),
            "data_never_leave_machine": is_data_never_leave_machine(),
            "emotion_enabled": is_emotion_enabled(),
            "emotion_default_state": get_emotion_default_state(),
            "memory_enabled": is_memory_enabled(),
            "max_history_turns": get_max_history_turns(),
            "tools_enabled": is_tools_enabled(),
            "max_tool_rounds": get_max_tool_rounds(),
            "current_emotion": get_current_emotion() if is_emotion_enabled() else "",
        }


if __name__ == "__main__":
    # 快速自检
    print("name:", get_name())
    print("visible:", get_visible_name())
    print("english:", get_english_name())
    print("role:", get_role())
    print("model:", get_model_default())
    print("greeting:", get_greeting())
    print("system_prompt:\n", build_system_prompt()[:200], "...")
