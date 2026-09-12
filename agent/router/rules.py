"""内置规则包 + data/rules.json 用户规则加载与匹配。"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from agent.router.types import RouteResult, REASON_NO_RULE, REASON_PATTERN_MATCH, TIER_RULE

ROOT = Path(__file__).resolve().parents[2]

# 与 schemas/xiyue_tools.json + 主进程执行器一致；仅允许白名单
ALLOWED_TOOLS = frozenset(
    {
        "volume.set",
        "volume.mute",
        "volume.unmute",
        "brightness.set",
        "media.play_pause",
        "media.next",
        "media.prev",
        "sys.launch",
    }
)

_BUILTIN_RULES: list[dict[str, Any]] = [
    {
        "id": "volume.set",
        "patterns": [
            r"音量\s*(\d{1,3})\s*%?",
            r"声音(?:调)?到\s*(\d{1,3})\s*%?",
            r"把音量(?:调)?到\s*(\d{1,3})\s*%?",
            r"音量(?:调)?(?:成|为)?\s*(\d{1,3})\s*%?",
        ],
        "tool": "volume.set",
        "arg_map": {"level": "$1"},
        "reply_template": "好的，音量已经调到 {level}% 了。",
        "enabled": True,
        "priority": 100,
        "source": "builtin",
    },
    {
        "id": "volume.mute",
        "patterns": [
            r"^(?:帮我)?(?:静音|关掉声音|声音关掉)$",
            r"^(?:帮我)?(?:把)?(?:声音|音量)关了$",
        ],
        "tool": "volume.mute",
        "arg_map": {},
        "reply_template": "好，已经静音了。",
        "enabled": True,
        "priority": 95,
        "source": "builtin",
    },
    {
        "id": "volume.unmute",
        "patterns": [
            r"^(?:帮我)?取消静音$",
            r"^(?:帮我)?(?:打开|恢复|开启)(?:声音|音量)$",
        ],
        "tool": "volume.unmute",
        "arg_map": {},
        "reply_template": "声音已经恢复了。",
        "enabled": True,
        "priority": 95,
        "source": "builtin",
    },
    {
        "id": "brightness.set",
        "patterns": [
            r"亮度\s*(\d{1,3})\s*%?",
            r"屏幕(?:亮度)?(?:调)?到\s*(\d{1,3})\s*%?",
            r"把亮度(?:调)?到\s*(\d{1,3})\s*%?",
        ],
        "tool": "brightness.set",
        "arg_map": {"level": "$1"},
        "reply_template": "好的，亮度已经调到 {level}% 了。",
        "enabled": True,
        "priority": 90,
        "source": "builtin",
    },
    {
        "id": "media.play_pause",
        "patterns": [
            r"^(?:帮我)?(?:播放|暂停|停止播放)$",
            r"^(?:帮我)?(?:播放|暂停)一下$",
        ],
        "tool": "media.play_pause",
        "arg_map": {},
        "reply_template": "好了，播放状态已切换。",
        "enabled": True,
        "priority": 80,
        "source": "builtin",
    },
    {
        "id": "media.next",
        "patterns": [
            r"^(?:帮我)?(?:切到)?下一(?:首|曲)$",
            r"^(?:帮我)?换一首$",
        ],
        "tool": "media.next",
        "arg_map": {},
        "reply_template": "切到下一首了。",
        "enabled": True,
        "priority": 80,
        "source": "builtin",
    },
    {
        "id": "media.prev",
        "patterns": [
            r"^(?:帮我)?(?:切到)?上一(?:首|曲)$",
            r"^(?:帮我)?回上一首$",
        ],
        "tool": "media.prev",
        "arg_map": {},
        "reply_template": "回到上一首了。",
        "enabled": True,
        "priority": 80,
        "source": "builtin",
    },
    {
        "id": "sys.launch",
        "patterns": [
            r"^(?:帮我)?(?:打开|启动|运行)\s*([^\s，。！？]+)$",
        ],
        "tool": "sys.launch",
        "arg_map": {"app": "$1"},
        "reply_template": "正在打开 {app}。",
        "enabled": True,
        "priority": 70,
        "source": "builtin",
    },
]

# 常见中文名 → Windows 可执行/友好名（open 包 openApp 友好名可能仍失败，优先可执行名）
_APP_ALIASES: dict[str, str] = {
    "记事本": "notepad",
    "计算器": "calc",
    "画图": "mspaint",
    "画板": "mspaint",
    "命令提示符": "cmd",
    "终端": "wt",
    "资源管理器": "explorer",
    "文件资源管理器": "explorer",
    "任务管理器": "taskmgr",
    "控制面板": "control",
    "设置": "ms-settings:",
    "微信": "WeChat",
    "qq": "QQ",
    "chrome": "chrome",
    "谷歌浏览器": "chrome",
    "edge": "msedge",
    "浏览器": "msedge",
    "vscode": "code",
    "vs code": "code",
    "记事本++": "notepad++",
}


def _normalize_app_name(name: str) -> str:
    key = (name or "").strip().lower()
    for alias, real in _APP_ALIASES.items():
        if key == alias.lower() or (name or "").strip() == alias:
            return real
    return (name or "").strip()


@dataclass
class Rule:
    id: str
    patterns: list[str]
    tool: str
    arg_map: dict[str, str]
    reply_template: str
    enabled: bool = True
    priority: int = 100
    source: str = "builtin"
    _compiled: list[re.Pattern[str]] = field(default_factory=list, repr=False)

    def __post_init__(self) -> None:
        self._compiled = [re.compile(p, re.IGNORECASE) for p in self.patterns]


def load_rules(user_rules_path: Path | None = None) -> list[Rule]:
    rules: list[Rule] = [Rule(**{k: v for k, v in r.items() if k != "_compiled"}) for r in _BUILTIN_RULES]
    path = user_rules_path or (ROOT / "data" / "rules.json")
    if path.exists():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            items = raw.get("rules") if isinstance(raw, dict) else raw
            if isinstance(items, list):
                for item in items:
                    if not isinstance(item, dict) or not item.get("id"):
                        continue
                    try:
                        rules.append(
                            Rule(
                                id=str(item["id"]),
                                patterns=list(item.get("patterns") or []),
                                tool=str(item.get("tool") or ""),
                                arg_map=dict(item.get("arg_map") or {}),
                                reply_template=str(item.get("reply_template") or "好的，已经处理了。"),
                                enabled=bool(item.get("enabled", True)),
                                priority=int(item.get("priority", 50)),
                                source="user",
                            )
                        )
                    except Exception:
                        continue
        except Exception:
            pass
    rules.sort(key=lambda r: r.priority, reverse=True)
    return rules


def _apply_arg_map(arg_map: dict[str, str], groups: tuple[str, ...]) -> dict[str, Any]:
    args: dict[str, Any] = {}
    for key, mapping in arg_map.items():
        if isinstance(mapping, str) and mapping.startswith("$") and mapping[1:].isdigit():
            idx = int(mapping[1:])
            if 1 <= idx <= len(groups):
                val = groups[idx - 1]
                try:
                    args[key] = int(val)
                except ValueError:
                    args[key] = val
        else:
            args[key] = mapping
    return args


def _render_reply(template: str, args: dict[str, Any]) -> str:
    try:
        return template.format(**{k: args[k] for k in args})
    except Exception:
        return template


def match_text(text: str, rules: list[Rule] | None = None) -> RouteResult:
    """匹配闭集规则；未命中返回 tier=local_llm。"""
    text = (text or "").strip()
    if not text:
        return RouteResult(tier="local_llm", reason=REASON_NO_RULE)
    rules = rules if rules is not None else load_rules()
    for rule in rules:
        if not rule.enabled or not rule.tool or rule.tool not in ALLOWED_TOOLS:
            continue
        for pat in rule._compiled:
            m = pat.search(text)
            if not m:
                continue
            args = _apply_arg_map(rule.arg_map, m.groups())
            # volume/brightness level 0-100
            if "level" in args and isinstance(args["level"], int):
                if args["level"] < 0 or args["level"] > 100:
                    continue
            if rule.id == "sys.launch" and "app" in args and isinstance(args["app"], str):
                display = args["app"]
                args["app"] = _normalize_app_name(display)
                # 回执保留用户称呼
                reply_args = dict(args)
                reply_args["app"] = display
                reply = _render_reply(rule.reply_template, reply_args)
            else:
                reply = _render_reply(rule.reply_template, args)
            return RouteResult(
                tier=TIER_RULE,
                rule_id=rule.id,
                tool=rule.tool,
                args=args,
                reply=reply,
                reason=REASON_PATTERN_MATCH,
            )
    return RouteResult(tier="local_llm", reason=REASON_NO_RULE)
