"""Xiyue Router：闭集规则短路，不进 LLM。"""
from __future__ import annotations

from typing import Any, Callable

from agent.router.log import write_route_log
from agent.router.rules import ALLOWED_TOOLS, load_rules, match_text
from agent.router.types import (
    REASON_TOOL_FAILED,
    REASON_TOOL_NOT_ALLOWED,
    TIER_DENIED,
    TIER_RULE,
    RouteResult,
)

__all__ = ["route", "execute_rule_path", "RouteResult", "load_rules", "ALLOWED_TOOLS"]

ToolWait = Callable[[str], dict | None]
ToolEmit = Callable[[str, dict], None]
DecideFn = Callable[[str], tuple[bool, bool]]


def route(text: str) -> RouteResult:
    return match_text(text)


def execute_rule_path(
    text: str,
    *,
    emit: ToolEmit,
    wait_result: ToolWait,
    make_request_id: Callable[[], str],
    decide: DecideFn | None = None,
) -> RouteResult | None:
    """命中规则则执行并返回最终 RouteResult；未命中返回 None（调用方走 Hermes）。

    未命中时也会写一条 tier=local_llm 日志（reason=no_rule），保证每句有终态。
    """
    result = route(text)
    if result.tier != TIER_RULE:
        write_route_log(result, ok=True)
        return result

    if not result.tool or result.tool not in ALLOWED_TOOLS:
        result.tier = TIER_DENIED
        result.reason = REASON_TOOL_NOT_ALLOWED
        result.reply = None
        write_route_log(result, ok=False)
        return result

    request_id = make_request_id()
    result.request_id = request_id

    if decide is not None:
        auth_required, denied = decide(result.tool)
    else:
        auth_required, denied = True, False

    if denied:
        result.tier = TIER_DENIED
        result.reason = "denied"
        result.reply = "这个操作权限不够，没有执行。"
        write_route_log(result, ok=False)
        return result

    emit(
        "tool_call_request",
        {
            "requestId": request_id,
            "tool": result.tool,
            "purpose": f"调用 {result.tool}",
            "arguments": result.args,
            "authorizationRequired": auth_required,
        },
    )
    exec_result = wait_result(request_id)

    if exec_result is None:
        result.reply = "刚才没能在规定时间完成，可以再试一次。"
        write_route_log(result, ok=False)
        return result
    if not exec_result.get("success", False):
        result.reason = REASON_TOOL_FAILED
        result.reply = "没有调好，你可以再试一次。"
        write_route_log(result, ok=False)
        return result

    write_route_log(result, ok=True)
    return result
