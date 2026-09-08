"""唤醒词：自训中文 KWS（轻量模型）。Phase1 实现。

训练语料 = 唤醒词正样本 + 负样本；推理端侧、常驻监听（默认关，热键默认）。
"""
from __future__ import annotations


def listen_for_wakeword(model_path: str) -> bool: ...
