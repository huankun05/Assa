"""汐月 Agent 核心循环（Phase0 stub）。

职责：
1. 接收语音层/UI 传来的用户文本
2. 调用本地 Ollama（或云端兜底）做意图理解与任务规划
3. 产出"工具意图"（tool id + 参数），交由权限闸裁决
4. 执行被放行的工具，回收结果，生成回复

注意：本文件在 Phase0 仅打通「文本→LLM→TTS」回路；工具执行在 Phase1+ 接入。
"""
from __future__ import annotations

import ollama

DEFAULT_MODEL = "qwen3-4b-32k"  # 受 8GB 显存约束的本地小模型


def chat(user_text: str, history: list[dict] | None = None) -> str:
    """Phase0：直接把用户输入送本地 LLM，返回文本回复（无工具）。"""
    messages = (history or []) + [{"role": "user", "content": user_text}]
    resp = ollama.chat(model=DEFAULT_MODEL, messages=messages, stream=False)
    return resp["message"]["content"]


if __name__ == "__main__":
    print(chat("你好，介绍一下自己"))
