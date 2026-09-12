"""Router 规则匹配单测。

运行：
  .venv/Scripts/python -m agent.tests.test_router_rules
或（若已配 pytest）pytest agent/tests/test_router_rules.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agent.router import route  # noqa: E402
from agent.router.rules import load_rules, match_text  # noqa: E402
from agent.router.types import TIER_LOCAL_LLM, TIER_RULE  # noqa: E402


def test_volume_set_patterns() -> None:
    cases = [
        ("音量50", 50),
        ("音量 50%", 50),
        ("把音量调到30", 30),
        ("声音调到80", 80),
        ("音量调成 20", 20),
        ("把音量调到百分之三十", None),  # 中文数字不解析 → fallback
    ]
    for text, level in cases:
        r = match_text(text)
        if level is None:
            assert r.tier == TIER_LOCAL_LLM, text
        else:
            assert r.tier == TIER_RULE, text
            assert r.tool == "volume.set"
            assert r.args.get("level") == level
            assert str(level) in (r.reply or ""), text


def test_brightness_set_patterns() -> None:
    r = match_text("亮度60")
    assert r.tier == TIER_RULE
    assert r.tool == "brightness.set"
    assert r.args["level"] == 60


def test_out_of_range_rejected() -> None:
    r = match_text("音量250")
    assert r.tier == TIER_LOCAL_LLM


def test_negative_fallback() -> None:
    for text in [
        "帮我把下载文件夹的 PDF 归档",
        "你好",
        "今天天气怎么样",
        "音量",  # 无数字
    ]:
        r = route(text)
        assert r.tier == TIER_LOCAL_LLM, text
        assert r.reason == "no_rule"


def test_media_rules() -> None:
    assert match_text("暂停").tool == "media.play_pause"
    assert match_text("下一首").tool == "media.next"
    assert match_text("上一首").tool == "media.prev"
    assert "切到下一首" in (match_text("下一首").reply or "")


def test_sys_launch_rules() -> None:
    r = match_text("打开微信")
    assert r.tier == TIER_RULE
    assert r.tool == "sys.launch"
    assert r.args.get("app") == "WeChat"
    assert "微信" in (r.reply or "")
    r2 = match_text("启动记事本")
    assert r2.tool == "sys.launch"
    assert r2.args.get("app") == "notepad"
    r3 = match_text("打开chrome")
    assert r3.args.get("app") == "chrome"


def test_mute_rules() -> None:
    assert match_text("静音").tool == "volume.mute"
    assert match_text("取消静音").tool == "volume.unmute"


def test_rule_count_and_allowed() -> None:
    rules = load_rules()
    assert len(rules) >= 7
    allowed = {
        "volume.set",
        "volume.mute",
        "volume.unmute",
        "brightness.set",
        "media.play_pause",
        "media.next",
        "media.prev",
        "sys.launch",
    }
    assert all(r.tool in allowed or r.source == "user" for r in rules)


def test_reply_template_renders() -> None:
    r = match_text("音量55")
    assert r.reply is not None
    assert "55" in r.reply


def main() -> None:
    tests = [
        test_volume_set_patterns,
        test_brightness_set_patterns,
        test_out_of_range_rejected,
        test_negative_fallback,
        test_media_rules,
        test_sys_launch_rules,
        test_mute_rules,
        test_rule_count_and_allowed,
        test_reply_template_renders,
    ]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"ok  {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {t.__name__}: {e}")
    if failed:
        raise SystemExit(1)
    print(f"all {len(tests)} passed")


if __name__ == "__main__":
    main()
