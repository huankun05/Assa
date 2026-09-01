"""汐月工作记忆（L1）：当前任务/会话中的关键事实。

设计：
- 不存完整对话，只存 LLM 提取出的"事实句"
- 每条记忆带：id / text / source / created_at / importance(1-5)
- 自动过期：默认 24h 无引用则清除
- 线程安全，供 server.py 在对话前后读写
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime())


def _data_dir() -> Path:
    try:
        from agent.memory.store import resolve_data_dir
        return resolve_data_dir()
    except Exception:
        return Path(__file__).resolve().parent.parent / "data"


_MEMORY_PATH = _data_dir() / "working_memory.json"
_MEMORY_LOCK = threading.Lock()
_DEFAULT_TTL_S = 24 * 3600  # 24h


def _default() -> list[dict[str, Any]]:
    return []


def _load() -> list[dict[str, Any]]:
    path = Path(_MEMORY_PATH)
    if not path.exists():
        return _default()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return _default()


def _save(items: list[dict[str, Any]]) -> None:
    path = Path(_MEMORY_PATH)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(items, ensure_ascii=False, indent=None), encoding="utf-8")
    except Exception:
        pass


def add_fact(text: str, *, source: str = "conversation", importance: int = 3, ttl_s: int = _DEFAULT_TTL_S) -> dict[str, Any]:
    """添加一条工作记忆。"""
    if not text or not text.strip():
        return {}
    item = {
        "id": time.time_ns(),
        "text": text.strip(),
        "source": source,
        "importance": max(1, min(5, int(importance))),
        "created_at": _now_iso(),
        "expires_at": _now_iso() if ttl_s <= 0 else time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time() + ttl_s)),
    }
    with _MEMORY_LOCK:
        items = _load()
        items.append(item)
        _save(items)
    return item


def get_active_facts(*, min_importance: int = 1, max_items: int = 20) -> list[str]:
    """获取未过期且足够重要的工作记忆文本列表。"""
    now = time.time()
    cutoff = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(now))
    with _MEMORY_LOCK:
        items = _load()
    active = []
    for it in items:
        if it.get("expires_at", "") < cutoff:
            continue
        if int(it.get("importance", 1)) < int(min_importance):
            continue
        active.append(str(it.get("text", "")))
    return active[: max(1, max_items)]


def clear_expired() -> int:
    """清除过期记忆，返回清除数量。"""
    now = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime())
    with _MEMORY_LOCK:
        items = _load()
        kept = [it for it in items if it.get("expires_at", "") >= now]
        removed = len(items) - len(kept)
        if removed:
            _save(kept)
    return removed
