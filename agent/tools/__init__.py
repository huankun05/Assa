"""工具注册表：从 schemas/tool_schema.json 加载单一事实源。"""
from __future__ import annotations

import json
from pathlib import Path

SCHEMA_PATH = Path(__file__).resolve().parent.parent.parent / "schemas" / "tool_schema.json"


def load_registry() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def get_tool(tool_id: str) -> dict | None:
    for t in load_registry().get("tools", []):
        if t["id"] == tool_id:
            return t
    return None
