"""hermes_core（汐月 vendor 精简版）。

仅保留 memory / emotion / soul / time 四模块（零第三方依赖）。
不包含 SessionDB、gateway、voice 等 desk-pet 专用层。
"""
from __future__ import annotations

import sys
from pathlib import Path

# 允许 `import hermes_core.*`（把 agent/ 注入 sys.path）
_agent_dir = Path(__file__).resolve().parent.parent
if str(_agent_dir) not in sys.path:
    sys.path.insert(0, str(_agent_dir))

# SQLite WAL-reset 防护（与上游一致，pysqlite3 未装则忽略）
try:
    import sqlite3 as _builtin_sqlite3

    _v = _builtin_sqlite3.sqlite_version_info
    _safe = (
        _v >= (3, 51, 3)
        or (_v >= (3, 50, 7) and _v < (3, 51, 0))
        or (_v >= (3, 44, 6) and _v < (3, 45, 0))
    )
    if not _safe:
        import pysqlite3 as _pysqlite3  # type: ignore[no-redef]

        sys.modules["sqlite3"] = _pysqlite3
except Exception:
    pass

from .emotion.emotion import EmotionState, PADValues  # noqa: F401
from .memory.memory_service import (  # noqa: F401
    MemoryService,
    get_memory_service,
    reset_memory_service_cache,
)

__all__ = [
    "EmotionState",
    "PADValues",
    "MemoryService",
    "get_memory_service",
    "reset_memory_service_cache",
]
