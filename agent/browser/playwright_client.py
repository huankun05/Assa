"""浏览器自动化客户端（Playwright，Chromium）。

域名白名单：所有入口先经 `_check_url()`，规则读 xiyue.json `browser.allowed_domains`
（缺失 / 留空 / 含 "*" 表示不限制；匹配主机名本身或其子域）。
每次调用独立上下文，不保留登录态。
"""

from __future__ import annotations

import base64
from typing import Any
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

_VIEWPORT = {"width": 1280, "height": 800}
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _allowed_domains() -> list[str]:
    try:
        from agent.identity import get_browser_allowed_domains

        return get_browser_allowed_domains()
    except Exception:
        return []


def _check_url(url: str) -> str | None:
    """返回拒绝原因；None 表示放行。"""
    url = (url or "").strip()
    if not url.startswith(("http://", "https://")):
        return f"browser: url 必须以 http:// 或 https:// 开头 ({url})"

    domains = _allowed_domains()
    if not domains or "*" in domains:
        return None

    host = (urlparse(url).hostname or "").lower()
    if not host:
        return f"browser: 无法解析主机名 ({url})"
    for d in domains:
        d = d.lower().strip().lstrip(".")
        if not d:
            continue
        if host == d or host.endswith("." + d):
            return None
    return f"browser: 域名 {host} 不在白名单内（xiyue.json browser.allowed_domains）"


def _with_browser(fn, **launch_kwargs):
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kwargs)
        try:
            return fn(browser)
        finally:
            browser.close()


def _new_page(browser, url: str, timeout_ms: int, *, user_agent: str | None = None):
    kwargs: dict[str, Any] = {"viewport": _VIEWPORT}
    if user_agent:
        kwargs["user_agent"] = user_agent
        kwargs["java_script_enabled"] = True
    context = browser.new_context(**kwargs)
    context.set_default_timeout(timeout_ms)
    page = context.new_page()
    page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
    return page


def open_url(url: str, *, headless: bool = False, timeout_ms: int = 60000) -> dict[str, Any]:
    """打开 URL 并返回页面基本信息。"""
    if err := _check_url(url):
        return {"ok": False, "error": err}

    def _run(browser):
        page = _new_page(browser, url, timeout_ms, user_agent=_UA)
        return {"url": url, "title": page.title(), "ok": True}

    return _with_browser(_run, headless=headless)


def screenshot(url: str, *, full_page: bool = False, timeout_ms: int = 60000) -> dict[str, Any]:
    """打开 URL 并截图，返回 base64 PNG（内存直出，不落盘）。"""
    if err := _check_url(url):
        return {"ok": False, "error": err}

    def _run(browser):
        page = _new_page(browser, url, timeout_ms)
        data = base64.b64encode(page.screenshot(full_page=full_page)).decode("utf-8")
        return {"ok": True, "data_b64": data, "size": len(data)}

    return _with_browser(_run, headless=True)


def navigate(url: str, *, timeout_ms: int = 60000) -> dict[str, Any]:
    """在当前页面导航到新 URL（每次独立上下文，等价于 open_url）。"""
    return open_url(url, timeout_ms=timeout_ms)


def click(url: str, selector: str, *, timeout_ms: int = 60000) -> dict[str, Any]:
    """打开页面并点击元素。"""
    if err := _check_url(url):
        return {"ok": False, "error": err}
    if not selector:
        return {"ok": False, "error": "browser.click 需要 selector"}

    def _run(browser):
        page = _new_page(browser, url, timeout_ms)
        page.click(selector, timeout=timeout_ms)
        return {"ok": True, "clicked": selector}

    return _with_browser(_run, headless=False)


def fill(url: str, selector: str, text: str, *, timeout_ms: int = 60000) -> dict[str, Any]:
    """打开页面并在输入框中填入文本。"""
    if err := _check_url(url):
        return {"ok": False, "error": err}
    if not selector:
        return {"ok": False, "error": "browser.fill 需要 selector"}
    if text is None:
        return {"ok": False, "error": "browser.fill 需要 text"}

    def _run(browser):
        page = _new_page(browser, url, timeout_ms)
        page.fill(selector, str(text), timeout=timeout_ms)
        return {"ok": True, "filled": selector}

    return _with_browser(_run, headless=False)


def scroll(url: str, direction: str = "down", *, timeout_ms: int = 60000) -> dict[str, Any]:
    """打开页面并滚动。"""
    if err := _check_url(url):
        return {"ok": False, "error": err}

    def _run(browser):
        page = _new_page(browser, url, timeout_ms)
        delta = "-window.innerHeight" if direction == "up" else "window.innerHeight"
        page.evaluate(f"window.scrollBy(0, {delta})")
        return {"ok": True, "direction": direction}

    return _with_browser(_run, headless=False)
