"""浏览器自动化客户端（Playwright，Chromium）。

不预设域名白名单；安全由上层确认框保证。
每次调用独立上下文，不保留登录态。
"""

from __future__ import annotations

import base64
from typing import Any

from playwright.sync_api import sync_playwright


def _with_browser(fn, **launch_kwargs):
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kwargs)
        try:
            return fn(browser)
        finally:
            browser.close()


def open_url(url: str, *, headless: bool = False, timeout_ms: int = 60000) -> dict[str, Any]:
    """打开 URL 并返回页面基本信息。"""
    if not url.startswith("http"):
        return {"ok": False, "error": f"browser: url 必须以 http:// 或 https:// 开头 ({url})"}

    def _run(browser):
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            java_script_enabled=True,
        )
        context.set_default_timeout(timeout_ms)
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        title = page.title()
        return {"url": url, "title": title, "ok": True}

    return _with_browser(_run, headless=headless)


def screenshot(url: str, *, full_page: bool = False, timeout_ms: int = 60000) -> dict[str, Any]:
    """打开 URL 并截图，返回 base64 PNG。"""
    if not url.startswith("http"):
        return {"ok": False, "error": f"browser: url 必须以 http:// 或 https:// 开头 ({url})"}

    def _run(browser):
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        context.set_default_timeout(timeout_ms)
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        path = "browser_screenshot.png"
        page.screenshot(path=path, full_page=full_page)
        data = base64.b64encode(open(path, "rb").read()).decode("utf-8")
        return {"ok": True, "data_b64": data, "size": len(data)}

    return _with_browser(_run, headless=True)


def navigate(url: str, *, timeout_ms: int = 60000) -> dict[str, Any]:
    """在当前页面导航到新 URL。"""
    if not url.startswith("http"):
        return {"ok": False, "error": f"browser: url 必须以 http:// 或 https:// 开头 ({url})"}
    return open_url(url, timeout_ms=timeout_ms)


def click(url: str, selector: str, *, timeout_ms: int = 60000) -> dict[str, Any]:
    """打开页面并点击元素。"""
    if not url.startswith("http"):
        return {"ok": False, "error": f"browser: url 必须以 http:// 或 https:// 开头 ({url})"}
    if not selector:
        return {"ok": False, "error": "browser.click 需要 selector"}

    def _run(browser):
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        context.set_default_timeout(timeout_ms)
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        page.click(selector, timeout=timeout_ms)
        return {"ok": True, "clicked": selector}

    return _with_browser(_run, headless=False)


def fill(url: str, selector: str, text: str, *, timeout_ms: int = 60000) -> dict[str, Any]:
    """打开页面并在输入框中填入文本。"""
    if not url.startswith("http"):
        return {"ok": False, "error": f"browser: url 必须以 http:// 或 https:// 开头 ({url})"}
    if not selector:
        return {"ok": False, "error": "browser.fill 需要 selector"}
    if text is None:
        return {"ok": False, "error": "browser.fill 需要 text"}

    def _run(browser):
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        context.set_default_timeout(timeout_ms)
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        page.fill(selector, str(text), timeout=timeout_ms)
        return {"ok": True, "filled": selector}

    return _with_browser(_run, headless=False)


def scroll(url: str, direction: str = "down", *, timeout_ms: int = 60000) -> dict[str, Any]:
    """打开页面并滚动。"""
    if not url.startswith("http"):
        return {"ok": False, "error": f"browser: url 必须以 http:// 或 https:// 开头 ({url})"}

    def _run(browser):
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        context.set_default_timeout(timeout_ms)
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        if direction == "up":
            page.evaluate("window.scrollBy(0, -window.innerHeight)")
        else:
            page.evaluate("window.scrollBy(0, window.innerHeight)")
        return {"ok": True, "direction": direction}

    return _with_browser(_run, headless=False)
