"""长期记忆存储（Phase0 stub）。

⚠️ Phase 2 计划：**整体替换**为 desk-pet 的 L0–L3 分层引擎
（F:/Work/Create/desk_pet/desk-pet/server/hermes_core/memory/ 的 MemoryFragment/MemoryStore/
 MemoryService，带 layer(L0-L3) + category 字段）。本 stub 仅满足 Phase 0/1 最小需要，
 不要在其上做复杂演进。

存储内容：用户偏好 / 环境事实 / 纠正反馈 / 对话摘要（凭据永不入库）。
可被设置面板查看 / 编辑 / 清空。

数据路径（设计 v1.2 §7.1）：统一经 resolve_data_dir() 收口——
- 正式： %APPDATA%/xiyue/（Tauri app_data_dir）
- 开发期：环境变量 XIYUE_DATA_DIR 覆盖（默认指向 repo 内 data/，已被 .gitignore 忽略）
"""
from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def resolve_data_dir() -> Path:
    """数据目录单一收口：XIYUE_DATA_DIR 环境变量 > repo 内 data/（开发期默认）。"""
    env = os.environ.get("XIYUE_DATA_DIR")
    if env:
        return Path(env)
    # Phase 3 打包后由 Rust 经 IPC 注入正式路径（%APPDATA%/xiyue）
    return _REPO_ROOT / "data"


DB_PATH = resolve_data_dir() / "memory.db"


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as con:
        con.execute(
            """CREATE TABLE IF NOT EXISTS memory (
                id INTEGER PRIMARY KEY,
                kind TEXT,          -- preference | env | feedback | summary | fact
                content TEXT,
                embedding BLOB,     -- Phase1: 向量（Phase2 换 desk-pet 引擎后含 layer/category）
                created_at TEXT
            )"""
        )
        con.execute(
            """CREATE TABLE IF NOT EXISTS memory_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            )"""
        )


def add(kind: str, content: str) -> int:
    kind = str(kind or "fact").strip()[:50]
    content = str(content or "").strip()
    if not content:
        return -1
    with sqlite3.connect(DB_PATH) as con:
        cur = con.execute(
            "INSERT INTO memory (kind, content, created_at) VALUES (?, ?, ?)",
            (kind, content, time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime())),
        )
        con.commit()
        return int(cur.lastrowid)


def search(query: str, k: int = 5) -> list[str]:
    query = str(query or "").strip()
    if not query:
        return []
    k = max(1, min(50, int(k)))
    keywords = [w for w in query.lower().split() if len(w) >= 2]
    if not keywords:
        return []
    with sqlite3.connect(DB_PATH) as con:
        rows = con.execute(
            "SELECT content FROM memory ORDER BY id DESC LIMIT 200"
        ).fetchall()
    scored: list[tuple[int, str]] = []
    for (content,) in rows:
        text = content.lower()
        score = sum(1 for w in keywords if w in text)
        if score:
            scored.append((score, content))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:k]]


def forget(keyword: str) -> int:
    keyword = str(keyword or "").strip()
    if not keyword:
        return 0
    with sqlite3.connect(DB_PATH) as con:
        cur = con.execute(
            "DELETE FROM memory WHERE content LIKE ?",
            (f"%{keyword}%",),
        )
        con.commit()
        return cur.rowcount


def count() -> int:
    with sqlite3.connect(DB_PATH) as con:
        row = con.execute("SELECT COUNT(*) FROM memory").fetchone()
        return int(row[0]) if row else 0
