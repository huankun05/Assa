"""路由日志：data/route_log.jsonl（append-only）。"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from agent.router.types import RouteResult

ROOT = Path(__file__).resolve().parents[2]
_LOG_PATH = ROOT / "data" / "route_log.jsonl"


def log_path() -> Path:
    return _LOG_PATH


def write_route_log(result: RouteResult, *, latency_ms: dict[str, int] | None = None, ok: bool = True) -> None:
    entry = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "request_id": result.request_id,
        "tier": result.tier,
        "rule_id": result.rule_id,
        "reason": result.reason,
        "tool": result.tool,
        "args": result.args,
        "privacy": {"max_data_class": "D0", "redacted": False},
        "cloud": {"used": False, "confirmed": False},
        "latency_ms": latency_ms or {},
        "ok": ok,
    }
    try:
        _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with _LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass


def write_dict(entry: dict[str, Any]) -> None:
    try:
        _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with _LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass
