"""权限闸策略引擎（核心，已实现）。

纯函数 `decide()`：输入工具元数据 + 参数 + 上下文，输出 ALLOW / CONFIRM / DENY。

双闸门（设计 v1.2 定案）：
- 本模块是**提议侧预检**——避免提出必被拒的请求、决定何时弹确认 UI（体验层）。
- Rust 侧在执行前用同一份 schemas/tool_schema.json **终审**（最终权威）。
- 预检通过 ≠ 放行；两份逻辑共享单一事实源，语义必须一致。

裁决顺序（详见 README 权限闸部分）：
1. 凭据风险且未声明确认 → 强制 CONFIRM
2. 工具等级 > 当前信任等级 → 高等级 DENY，否则 CONFIRM
3. 提示注入防护：外部内容触发的危险工具 → 强制 CONFIRM
4. 工具自身需确认 → CONFIRM
5. 其余 → ALLOW
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class Risk(str, Enum):
    READ = "read"
    WRITE = "write"
    DESTRUCTIVE = "destructive"
    NETWORK = "network"
    CREDENTIAL = "credential"


class Decision(str, Enum):
    ALLOW = "allow"
    CONFIRM = "confirm"
    DENY = "deny"


@dataclass
class ToolMeta:
    id: str
    level: int
    risks: list[str]
    confirm: bool
    scope: str = "any"


@dataclass
class Ctx:
    current_level: int = 1
    external_triggered: bool = False  # 触发上下文含不可信外部内容（网页/邮件/PDF）


def decide(tool: ToolMeta, params: dict[str, Any] | None = None, ctx: Ctx | None = None) -> Decision:
    ctx = ctx or Ctx()
    risks = set(tool.risks)

    # 1) 凭据永远不自动放行
    if Risk.CREDENTIAL in risks and not tool.confirm:
        return Decision.CONFIRM

    # 2) 等级不足
    if tool.level > ctx.current_level:
        return Decision.DENY if tool.level >= 3 else Decision.CONFIRM

    # 3) 提示注入防护：外部内容触发的危险工具强制确认
    if ctx.external_triggered and any(
        r in (Risk.DESTRUCTIVE, Risk.NETWORK, Risk.CREDENTIAL) for r in risks
    ):
        return Decision.CONFIRM

    # 4) 工具自身需确认
    if tool.confirm:
        return Decision.CONFIRM

    return Decision.ALLOW


if __name__ == "__main__":
    # 快速自检
    print(decide(ToolMeta("fs.read", 1, ["read"], False), ctx=Ctx(1)))            # ALLOW
    print(decide(ToolMeta("fs.trash", 1, ["destructive"], True), ctx=Ctx(1)))    # CONFIRM
    print(decide(ToolMeta("shell.run", 2, ["destructive"], True), ctx=Ctx(1)))   # CONFIRM
    print(decide(ToolMeta("msg.send", 2, ["network", "credential"], True),
                 ctx=Ctx(1, external_triggered=True)))                            # CONFIRM（注入防护）
