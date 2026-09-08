"""对话历史持久化（Phase 0 最小实现）。

设计约定：
- 仅存对话轮次，不存敏感凭据；
- 单文件 JSON，路径经 resolve_data_dir() 收口；
- 加载上限 200 条，避免进程内无限膨胀。
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

from agent.memory.store import resolve_data_dir

_HISTORY_PATH = resolve_data_dir() / "history.json"
_HISTORY_LOCK = threading.Lock()
_MAX_MESSAGES = 200


def _default() -> list[dict]:
    return []


def load_history() -> list[dict]:
    """从磁盘加载历史，失败返回空列表。"""
    path = Path(_HISTORY_PATH)
    if not path.exists():
        return _default()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data[-_MAX_MESSAGES:]
    except Exception:
        pass
    return _default()


def save_history(history: list[dict]) -> None:
    """追加写磁盘；目录不存在会自动创建。"""
    path = Path(_HISTORY_PATH)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        trimmed = history[-_MAX_MESSAGES:]
        path.write_text(json.dumps(trimmed, ensure_ascii=False, indent=None), encoding="utf-8")
    except Exception:
        # 历史写入失败不应阻断对话
        pass
