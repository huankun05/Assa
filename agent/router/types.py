"""Router 结果类型。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

TIER_RULE = "rule"
TIER_LOCAL_LLM = "local_llm"
TIER_CLOUD_CANDIDATE = "cloud_candidate"
TIER_DENIED = "denied"

REASON_PATTERN_MATCH = "pattern_match"
REASON_NO_RULE = "no_rule"
REASON_TOOL_NOT_ALLOWED = "tool_not_allowed"
REASON_TOOL_FAILED = "tool_failed"


@dataclass
class RouteResult:
    tier: str
    rule_id: str | None = None
    tool: str | None = None
    args: dict[str, Any] = field(default_factory=dict)
    reply: str | None = None
    reason: str = REASON_NO_RULE
    request_id: str | None = None
