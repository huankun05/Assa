"""P0a-1 安全补洞回归测试（无 pytest 依赖，直接运行）：

    .venv/Scripts/python agent/tests/test_p0a_security.py

覆盖：域名白名单 _check_url / 信任等级可配 get_trust_level + _decide_tool / <think> 剥离统一。
"""
from __future__ import annotations

import sys
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "voice"))

from agent import identity  # noqa: E402
from agent.browser.playwright_client import _check_url  # noqa: E402
from agent import server  # noqa: E402


@contextmanager
def _config(**overrides):
    """临时覆盖 xiyue.json 加载结果（identity 有模块级缓存）。"""
    saved = identity._cached
    identity._cached = {**identity._DEFAULT, **overrides}
    try:
        yield
    finally:
        identity._cached = saved


def test_trust_level_default_and_parsing() -> None:
    with _config(security={}):
        assert identity.get_trust_level() == 1
    with _config(security={"trust_level": 0}):
        assert identity.get_trust_level() == 0
    with _config(security={"trust_level": "2"}):
        assert identity.get_trust_level() == 2
    with _config(security={"trust_level": "abc"}):
        assert identity.get_trust_level() == 1
    with _config(security={"trust_level": -5}):
        assert identity.get_trust_level() == 0


def test_allowed_domains_parsing() -> None:
    with _config(browser={"allowed_domains": ["github.com", " localhost ", ""]}):
        assert identity.get_browser_allowed_domains() == ["github.com", "localhost"]
    with _config(browser={"allowed_domains": "example.com"}):
        assert identity.get_browser_allowed_domains() == ["example.com"]
    with _config(browser={}):
        assert identity.get_browser_allowed_domains() == []


def test_check_url_allowlist() -> None:
    with _config(browser={"allowed_domains": ["github.com", "localhost", "127.0.0.1"]}):
        assert _check_url("https://github.com/JNTMTMTM/eIsland") is None
        assert _check_url("https://api.github.com/repos") is None, "子域应放行"
        assert _check_url("http://localhost:8765/health") is None
        assert _check_url("http://127.0.0.1:8765/health") is None
        assert _check_url("https://GitHub.com/") is None, "主机名大小写不敏感"

        assert _check_url("https://evil.com/") is not None
        assert _check_url("https://notgithub.com/") is not None, "后缀伪装不得放行"
        assert _check_url("https://github.com.evil.com/") is not None, "前缀伪装不得放行"
        assert _check_url("ftp://github.com/") is not None, "仅 http/https"
        assert _check_url("httpx://github.com/") is not None, "旧实现 startswith('http') 的漏洞"
        assert _check_url("") is not None
        assert _check_url("https://") is not None, "无主机名"


def test_check_url_unrestricted_modes() -> None:
    with _config(browser={"allowed_domains": []}):
        assert _check_url("https://anything.example/") is None, "留空 = 不限制"
    with _config(browser={"allowed_domains": ["*"]}):
        assert _check_url("https://anything.example/") is None, "* = 不限制"
    with _config(browser={"allowed_domains": ["*"]}):
        assert _check_url("ftp://anything.example/") is not None, "不限制域名仍限制协议"


def test_strip_think_unified() -> None:
    assert server._strip_think("<think>推理…</think>最终回答") == "最终回答"
    assert server._strip_think("  纯回答  ") == "纯回答"
    assert server._strip_think("") == ""
    assert server._strip_think(None) == ""  # type: ignore[arg-type]
    assert server._strip_think("a</think>b</think>c") == "c"


def test_decide_tool_honours_trust_level() -> None:
    with _config(security={"trust_level": 1}):
        assert server._decide_tool("file.read") == (False, False), "L1 只读自动放行"
        assert server._decide_tool("file.delete") == (True, False), "破坏性工具需确认"
        assert server._decide_tool("cmd.exec") == (True, False)
        assert server._decide_tool("unknown.tool") == (True, False), "未知工具默认需确认"
    with _config(security={"trust_level": 0}):
        assert server._decide_tool("file.read") == (True, False), "L0 一切需确认"
        assert server._decide_tool("file.delete") == (True, False)


def test_voice_endpoint_deprecated() -> None:
    import json
    from io import BytesIO

    class _Resp:
        def __init__(self) -> None:
            self.code = None
            self.body = b""

    captured = _Resp()

    class _Handler(server.Handler):  # type: ignore[misc]
        def __init__(self) -> None:  # noqa: D401 绕过 socket 初始化
            self.path = "/voice"
            self.headers = {"Content-Length": "2"}
            self.rfile = BytesIO(b"{}")

        def send_response(self, code, message=None):
            captured.code = code

        def send_header(self, k, v):
            pass

        def end_headers(self):
            pass

        @property
        def wfile(self):
            class _W:
                def write(_self, data):
                    captured.body += data

            return _W()

    _Handler().do_POST()
    assert captured.code == 410
    assert json.loads(captured.body.decode("utf-8")).get("deprecated") is True


def main() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL  {t.__name__}: {e}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  ERROR {t.__name__}: {type(e).__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
