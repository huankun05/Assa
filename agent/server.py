"""汐月 Python sidecar 服务（Phase 0 语音回路核心）。

HTTP 127.0.0.1:8765（XIYUE_AGENT_PORT 可覆盖），由 Rust 外壳拉起与守护。

端点：
- GET  /health -> {"ok": true}
- POST /voice  -> 录音 → VAD/STT → Ollama → TTS，返回 {"user","reply","audio"}
- POST /chat   -> 文本对话 {"text": "..."}，返回 {"user","reply","audio"}

管线（Phase 0，无工具、权限闸不介入，设计 §13）：
- 采集：sounddevice 16k 单声道，能量端点检测（Rust 采集 Phase 1 移入）
- VAD/STT：faster-whisper（vad_filter 内置 Silero，省独立 VAD 依赖）
- LLM：Ollama qwen3-4b-32k + persona/xiyue.md 系统提示 + 内存历史（≤10 轮）
- TTS：kokoro（中文，24k wav）→ 失败回退 pyttsx3（Windows SAPI，离线）
"""
from __future__ import annotations

import json
import os
import queue
import sys
import threading
import time
import uuid
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))  # 让 agent.* 可导入
sys.path.insert(0, str(ROOT / "voice"))  # 让 voice.* 可导入

import numpy as np  # noqa: E402

from agent.memory.store import resolve_data_dir  # noqa: E402
from agent.memory.history import load_history as _load_history, save_history as _save_history  # noqa: E402
from agent.memory.working import add_fact, get_active_facts, clear_expired  # noqa: E402
from voice import tts as _tts_module  # noqa: E402 公共 TTS 模块（kokoro+pyttsx3）

# 情绪状态（统一从 identity 读取，避免重复定义）
from agent.identity import (  # noqa: E402
    get_current_emotion,
    set_current_emotion,
    get_emotion_default_state,
    is_emotion_enabled,
    get_max_history_turns,
)

PORT = int(os.environ.get("XIYUE_AGENT_PORT", "8765"))
DATA_DIR = resolve_data_dir()
TTS_DIR = DATA_DIR / "tts"
TMP_DIR = DATA_DIR / "tmp"
# None → 用 voice/stt.py 的 DEFAULT_MODEL（仓库内 data/models/faster-whisper-base，免联网）
WHISPER_MODEL = os.environ.get("XIYUE_WHISPER_MODEL") or None
LLM_MODEL = os.environ.get("XIYUE_LLM_MODEL") or ""

_tts_dir = TTS_DIR
_tmp_dir = TMP_DIR

# ---- 身份 / 配置读取（从 identity.py 引入，失败回退）----
def _load_model_default() -> str:
    try:
        from agent.identity import get_model_default
        return get_model_default()
    except Exception:
        return "qwen3-4b-32k"


# ---- 懒加载组件（首次请求时初始化，之后常驻）----
_lock = threading.Lock()
_stt = None
_tts_pipeline = None
_history: list[dict] = _load_history()
_PERSONA = ""

# ---- 工具调用（SSE /chat/stream）----
# 工具结果队列：requestId -> queue.Queue；渲染层经 POST /tool-result 投递
_tool_queues: dict[str, queue.Queue] = {}
_tool_queues_lock = threading.Lock()
_TOOL_RESULT_TIMEOUT_S = float(os.environ.get("XIYUE_TOOL_TIMEOUT", "60"))
_MAX_TOOL_ROUNDS = int(os.environ.get("XIYUE_TOOL_ROUNDS", "8"))


def _tool_def(name: str, desc: str, props: dict, required: list[str]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": desc,
            "parameters": {"type": "object", "properties": props, "required": required},
        },
    }


def _path_prop(desc: str) -> dict:
    return {"type": "string", "description": desc}


# 工具定义（命名对齐渲染层 CLIENT_LOCAL_TOOL_PREFIXES 名单，主进程 app.ts 可执行）
TOOL_DEFS = [
    _tool_def("file.read", "读取文本文件内容（UTF-8，支持中文）", {"path": _path_prop("文件绝对路径")}, ["path"]),
    _tool_def("file.list", "列出目录下的文件与子目录名", {"path": _path_prop("目录绝对路径")}, ["path"]),
    _tool_def("file.stat", "获取文件/目录元信息（大小、修改时间等）", {"path": _path_prop("绝对路径")}, ["path"]),
    _tool_def("file.search", "在目录中按名称搜索文件", {"path": _path_prop("目录绝对路径"), "keyword": {"type": "string", "description": "文件名关键字"}}, ["path", "keyword"]),
    _tool_def("file.grep", "在目录文件中按正则搜索文本内容", {"path": _path_prop("目录绝对路径"), "pattern": {"type": "string", "description": "正则表达式"}}, ["path", "pattern"]),
    _tool_def("file.write", "写入/覆盖文本文件（UTF-8）", {"path": _path_prop("文件绝对路径"), "content": {"type": "string", "description": "写入内容"}}, ["path", "content"]),
    _tool_def("file.delete", "把文件或目录放入回收站（危险，需确认）", {"path": _path_prop("绝对路径")}, ["path"]),
    _tool_def("cmd.exec", "在 cmd 中执行一条命令并返回输出（危险，需确认）", {"command": {"type": "string", "description": "命令行"}}, ["command"]),
    _tool_def("clipboard.read", "读取系统剪贴板文本", {}, []),
    _tool_def("sys.info", "获取系统信息（OS/CPU/内存等）", {}, []),
    _tool_def("monitor.cpu", "获取 CPU 使用率", {}, []),
    _tool_def("monitor.memory", "获取内存使用情况", {}, []),
    _tool_def("net.ping", "Ping 一个主机，返回延迟", {"host": {"type": "string", "description": "主机名或 IP"}}, ["host"]),
    _tool_def("browser.open", "打开一个网页并返回标题", {"url": {"type": "string", "description": "网页 URL"}}, ["url"]),
    _tool_def("browser.screenshot", "打开一个网页并返回截图 base64", {"url": {"type": "string", "description": "网页 URL"}}, ["url"]),
    _tool_def("browser.navigate", "在当前浏览器页面导航到新 URL", {"url": {"type": "string", "description": "目标 URL"}}, ["url"]),
    _tool_def("browser.click", "打开页面并点击一个元素", {"url": {"type": "string", "description": "网页 URL"}, "selector": {"type": "string", "description": "CSS 选择器"}}, ["url", "selector"]),
    _tool_def("browser.fill", "在输入框中填入文本", {"url": {"type": "string", "description": "网页 URL"}, "selector": {"type": "string", "description": "输入框选择器"}, "text": {"type": "string", "description": "要填入的文本"}}, ["url", "selector", "text"]),
    _tool_def("browser.scroll", "在当前页面滚动", {"url": {"type": "string", "description": "网页 URL"}, "direction": {"type": "string", "description": "up/down"}}, ["url"]),
]

# 工具 → 权限元数据（policy.py 裁决）
_TOOL_POLICY = {
    "file.read": ("read", ["read"], False),
    "file.list": ("read", ["read"], False),
    "file.stat": ("read", ["read"], False),
    "file.search": ("read", ["read"], False),
    "file.grep": ("read", ["read"], False),
    "file.write": ("write", ["write"], False),
    "file.delete": ("delete", ["destructive"], True),
    "cmd.exec": ("cmd", ["destructive", "network"], True),
    "clipboard.read": ("clipboard", ["read"], False),
    "sys.info": ("sys", ["read"], False),
    "monitor.cpu": ("monitor", ["read"], False),
    "monitor.memory": ("monitor", ["read"], False),
    "net.ping": ("net", ["network"], True),
    "browser.open": ("browser", ["network"], True),
    "browser.screenshot": ("browser", ["network"], True),
    "browser.navigate": ("browser", ["network"], True),
    "browser.click": ("browser", ["network"], True),
    "browser.fill": ("browser", ["network"], True),
    "browser.scroll": ("browser", ["network"], True),
}


def _decide_tool(tool_name: str):
    """policy.py 裁决：返回 (authorizationRequired, denied)"""
    from agent.gate.policy import Ctx, ToolMeta, decide

    meta, risks, confirm = _TOOL_POLICY.get(tool_name, ("unknown", ["read"], True))
    tm = ToolMeta(id=tool_name, level=2 if confirm else 1, risks=risks, confirm=confirm)
    decision = decide(tm, ctx=Ctx(current_level=1))
    if decision.value == "deny":
        return True, True
    return decision.value == "confirm", False


def _request_tool_result(request_id: str) -> dict | None:
    """等待渲染层投递工具执行结果；超时返回 None"""
    with _tool_queues_lock:
        q = _tool_queues.get(request_id)
    if q is None:
        return None
    try:
        item = q.get(timeout=_TOOL_RESULT_TIMEOUT_S)
        return item
    except queue.Empty:
        return None
    finally:
        with _tool_queues_lock:
            _tool_queues.pop(request_id, None)


def _put_tool_result(request_id: str, result: dict) -> bool:
    with _tool_queues_lock:
        q = _tool_queues.get(request_id)
    if q is None:
        return False
    q.put(result)
    return True


def _run_agent_loop(messages: list[dict], emit) -> str:
    """工具化 agent 循环：ollama + tools，最多 _MAX_TOOL_ROUNDS 轮。

    emit(event_type, payload) 由调用方（SSE 处理器）注入。
    返回最终回答文本。
    """
    model = LLM_MODEL or _load_model_default()
    for _round in range(_MAX_TOOL_ROUNDS):
        import ollama  # 局部导入（与 _llm_reply 一致，避免启动期依赖）

        resp = ollama.chat(model=model, messages=messages, tools=TOOL_DEFS, stream=False)
        msg = resp["message"]
        content = (msg.get("content") or "").strip()
        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:
            return content

        for tc in tool_calls:
            fn = tc.get("function", {})
            name = (fn.get("name") or "").strip()
            args = fn.get("arguments") or {}
            if not name:
                continue
            request_id = uuid.uuid4().hex[:16]
            auth_required, denied = _decide_tool(name)
            purpose = args.get("purpose") or f"调用 {name}"
            emit("tool_call_request", {
                "requestId": request_id,
                "tool": name,
                "purpose": purpose,
                "arguments": args,
                "authorizationRequired": auth_required,
            })
            if denied:
                result = {"success": False, "result": {}, "error": "权限不足：该工具被拒绝"}
            else:
                result = _request_tool_result(request_id)
                if result is None:
                    result = {"success": False, "result": {}, "error": "工具执行超时或未获授权"}
            messages.append({"role": "tool", "content": json.dumps(result, ensure_ascii=False)})

    # 超出轮数：兜底再问一次
    resp = ollama.chat(model=model, messages=messages, tools=TOOL_DEFS, stream=False)
    return (resp["message"].get("content") or "").strip()


def _load_persona() -> str:
    global _PERSONA
    if not _PERSONA:
        try:
            from agent.identity import get_persona_text
            _PERSONA = get_persona_text() or ""
        except Exception:
            p = ROOT / "agent" / "persona" / "xiyue.md"
            if p.exists():
                _PERSONA = p.read_text(encoding="utf-8")
    return _PERSONA


def _build_system(extra: str = "", emotion_state: str = "") -> str:
    try:
        from agent.identity import build_system_prompt
        return build_system_prompt(extra, emotion_state)
    except Exception:
        return (
            _load_persona()
            + "\n\n[运行时规则] 这是语音对话：回复保持简短口语化（一般不超过 3 句），"
            "不用 markdown、不用列表、不堆 emoji。"
        )


def _get_stt():
    global _stt
    with _lock:
        if _stt is None:
            import stt  # voice/stt.py（device 自动探测，CPU 回退）

            stt.load(WHISPER_MODEL)
            _stt = stt
    return _stt


def _get_tts():
    """已迁移至 voice.tts：此处保留仅为兼容旧调用链。"""
    return None


def _record_simple(max_sec: float = 12.0, thresh: float = 0.006) -> Path | None:
    """简化录音：录固定 max_sec，再按能量裁掉首尾静音（Phase 0 够用，延迟=固定）。

    Phase 1 换流式 VAD（Silero 流式端点）后延迟可再降。
    """
    import sounddevice as sd

    sr = 16000
    audio = sd.rec(int(max_sec * sr), samplerate=sr, channels=1, dtype="float32")
    sd.wait()
    audio = audio.reshape(-1)
    rms = np.sqrt(np.convolve(audio**2, np.ones(1600) / 1600, mode="same"))  # 100ms 窗
    voiced = np.where(rms > thresh)[0]
    if voiced.size == 0:
        return None
    start = max(0, voiced[0] - 1600)          # 前留 100ms
    end = min(len(audio), voiced[-1] + 2400)  # 后留 150ms
    segment = (audio[start:end] * 32767).astype(np.int16)
    _tmp_dir.mkdir(parents=True, exist_ok=True)
    path = _tmp_dir / f"in_{int(time.time()*1000)}.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(segment.tobytes())
    return path


def _transcribe(wav: Path) -> str:
    stt = _get_stt()
    return stt.transcribe(str(wav), language="zh").strip()


def _llm_reply(user_text: str) -> str:
    import ollama

    model = LLM_MODEL or _load_model_default()
    emotion = get_current_emotion()
    system = _build_system(emotion_state=emotion)
    
    # 注入工作记忆（L1）
    try:
        facts = get_active_facts(min_importance=1, max_items=10)
        if facts:
            system += "\n\n[相关记忆]\n" + "\n".join(f"- {f}" for f in facts)
    except Exception:
        pass
    
    messages = [{"role": "system", "content": system}] + _history[-get_max_history_turns():] + [
        {"role": "user", "content": user_text}
    ]
    resp = ollama.chat(model=model, messages=messages, stream=False)
    content = (resp["message"]["content"] or "").strip()
    # 剥离 qwen3 思考段（若存在）
    reply = content.split("</think>")[-1].strip() if "</think>" in content else content
    _history.append({"role": "user", "content": user_text})
    _history.append({"role": "assistant", "content": reply})
    _save_history(_history)
    
    # 从回复中提取事实，写入工作记忆
    try:
        _extract_and_store_facts(user_text, reply)
    except Exception:
        pass
    
    return reply


def _extract_and_store_facts(user_text: str, reply: str) -> None:
    """简单启发式：从对话中提取可记忆事实并写入工作记忆。"""
    candidates: list[str] = []
    
    # 1) 用户明确表达偏好/纠正
    if any(k in user_text for k in ["我喜欢", "我不喜欢", "别", "不要", "记住", "我通常", "我习惯"]):
        candidates.append(f"用户偏好：{user_text[:120]}")
    
    # 2) 用户提到名字/账号/项目名等
    import re
    names = re.findall(r'[\u4e00-\u9fff]{2,4}(?=是|叫|名为|项目名|名字)', user_text)
    for n in names[:3]:
        candidates.append(f"提及实体：{n}")
    
    # 3) 助手回复中包含"记住"、"我会记得"等承诺
    if any(k in reply for k in ["记住", "我会记得", "已记录", "已记住", "以后会"]):
        candidates.append(f"用户相关：{user_text[:100]}")
    
    # 4) 工具执行结果中的关键信息
    if "工具结果" in reply or "已执行" in reply or "已完成" in reply:
        candidates.append(f"执行结果：{reply[:120]}")
    
    for text in candidates[:3]:
        add_fact(text, source="conversation", importance=3)


def _tts(text: str) -> Path | None:
    """已迁移至 voice.tts.speak()。"""
    return _tts_module.speak(text)


def _audio_b64(path: Path | None) -> str:
    """读取 wav 转 base64，已迁移至 voice.tts.to_base64()。"""
    return _tts_module.to_base64(path)


class Handler(BaseHTTPRequestHandler):
    def _send(self, obj: dict, code: int = 200) -> None:
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send({"ok": True, "model": LLM_MODEL or _load_model_default()})
        elif self.path == "/identity":
            try:
                from agent.identity import XiyueIdentityReader
                self._send(XiyueIdentityReader().as_dict())
            except Exception as e:
                self._send({"error": str(e)}, 500)
        elif self.path == "/emotion":
            try:
                state = get_current_emotion()
                self._send({"state": state, "enabled": is_emotion_enabled()})
            except Exception as e:
                self._send({"error": str(e)}, 500)
        else:
            self._send({"error": "not found"}, 404)

    def do_POST(self) -> None:  # noqa: N802
        try:
            n = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            self._send({"error": "bad json"}, 400)
            return

        try:
            if self.path == "/voice":
                wav = _record_simple()
                if wav is None:
                    # 未检测到说话：直接回一句提示，不浪费一次 LLM 调用
                    user_text = ""
                    reply = "没听到你说话哦，再试一次？"
                    audio = _tts(reply)
                else:
                    user_text = _transcribe(wav)
                    reply = _llm_reply(user_text) if user_text else "没听清，再说一遍？"
                    audio = _tts(reply) if reply else None
                self._send({
                    "user": user_text,
                    "reply": reply,
                    "audio": str(audio) if audio else "",
                    "audio_b64": _audio_b64(audio),
                })
            elif self.path == "/chat":
                text = (body.get("text") or "").strip()
                if not text:
                    self._send({"error": "empty text"}, 400)
                    return
                reply = _llm_reply(text)
                audio = _tts(reply)
                self._send({
                    "user": text,
                    "reply": reply,
                    "audio": str(audio) if audio else "",
                    "audio_b64": _audio_b64(audio),
                })
            elif self.path == "/transcribe":
                # 渲染层录音结束后的本地转写（faster-whisper），替代云端 STT
                audio_b64 = body.get("audio_b64") or ""
                if not audio_b64:
                    self._send({"error": "empty audio"}, 400)
                    return
                try:
                    import base64

                    raw = base64.b64decode(audio_b64)
                    TMP_DIR.mkdir(parents=True, exist_ok=True)
                    path = TMP_DIR / f"in_{int(time.time()*1000)}.wav"
                    path.write_bytes(raw)
                    text = _transcribe(path)
                    self._send({"text": text})
                except Exception as e:
                    print(f"[server] /transcribe 处理异常: {e}", flush=True)
                    self._send({"error": str(e)}, 500)
            elif self.path == "/chat/stream":
                self._handle_chat_stream(body)
            elif self.path == "/tool-result":
                request_id = (body.get("requestId") or "").strip()
                if not request_id:
                    self._send({"error": "empty requestId"}, 400)
                    return
                ok = _put_tool_result(request_id, {
                    "success": bool(body.get("success", True)),
                    "result": body.get("result") or {},
                    "error": body.get("error") or "",
                })
                self._send({"ok": ok})
            elif self.path == "/browser":
                tool = (body.get("tool") or "").strip()
                args = body.get("arguments") or {}
                try:
                    result = _run_browser_tool(tool, args)
                    self._send(result)
                except Exception as e:
                    self._send({"ok": False, "error": str(e)}, 500)
            else:
                self._send({"error": "not found"}, 404)
        except Exception as e:
            print(f"[server] {self.path} 处理异常: {e}", flush=True)
            self._send({"error": str(e)}, 500)

    def _handle_chat_stream(self, body: dict) -> None:
        """SSE 工具化对话流：think → tool_call_request* → chunk* → final(audio_b64)"""
        text = (body.get("text") or "").strip()
        if not text:
            self._send({"error": "empty text"}, 400)
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        def emit(event_type: str, payload: dict) -> None:
            data = json.dumps({"type": event_type, "payload": payload}, ensure_ascii=False)
            try:
                self.wfile.write(f"data: {data}\n\n".encode("utf-8"))
                self.wfile.flush()
            except Exception:
                pass

        def wait_result(request_id: str) -> dict | None:
            with _tool_queues_lock:
                _tool_queues[request_id] = queue.Queue()
            return _request_tool_result(request_id)

        try:
            emotion = get_current_emotion()
            system = _build_system(
                "你是本地 AI 管家，可以调用提供的工具帮用户做事。"
                "需要文件/系统/网络信息时优先调用工具；工具结果拿到后再组织回答。"
                "回复用中文，口语化，必要时用简短 markdown。",
                emotion_state=emotion,
            )
            
            # 注入工作记忆（L1）
            try:
                facts = get_active_facts(min_importance=1, max_items=10)
                if facts:
                    system += "\n\n[相关记忆]\n" + "\n".join(f"- {f}" for f in facts)
            except Exception:
                pass
            
            messages = [{"role": "system", "content": system}] + _history[-get_max_history_turns():] + [
                {"role": "user", "content": text}
            ]
            emit("think", {"text": ""})
            reply = _run_agent_loop(messages, emit)

            # 流式输出回答
            step = 8
            for i in range(0, len(reply), step):
                emit("chunk", {"text": reply[i:i + step]})
                time.sleep(0.02)
            audio = _tts(reply) if reply else None
            emit("final", {
                "reply": reply,
                "audio_b64": _audio_b64(audio),
            })
            _history.append({"role": "user", "content": text})
            _history.append({"role": "assistant", "content": reply})
            _save_history(_history)
            
            # 从回复中提取事实，写入工作记忆
            try:
                _extract_and_store_facts(text, reply)
            except Exception:
                pass
        except Exception as e:
            print(f"[server] /chat/stream 处理异常: {e}", flush=True)
            emit("error", {"message": str(e)})

    def log_message(self, fmt: str, *args) -> None:  # 安静模式
        pass


def _run_browser_tool(tool: str, args: dict) -> dict:
    """浏览器工具路由。"""
    try:
        from agent.browser.playwright_client import (
            open_url,
            screenshot,
            navigate,
            click,
            fill,
            scroll,
        )
    except Exception as e:
        return {"ok": False, "error": f"browser module not available: {e}"}

    if tool == "browser.open":
        url = (args.get("url") or "").strip()
        if not url:
            return {"ok": False, "error": "browser.open 需要 url"}
        return open_url(url)
    elif tool == "browser.screenshot":
        url = (args.get("url") or "").strip()
        if not url:
            return {"ok": False, "error": "browser.screenshot 需要 url"}
        return screenshot(url)
    elif tool == "browser.navigate":
        url = (args.get("url") or "").strip()
        if not url:
            return {"ok": False, "error": "browser.navigate 需要 url"}
        return navigate(url)
    elif tool == "browser.click":
        url = (args.get("url") or "").strip()
        selector = (args.get("selector") or "").strip()
        if not url or not selector:
            return {"ok": False, "error": "browser.click 需要 url 和 selector"}
        return click(url, selector)
    elif tool == "browser.fill":
        url = (args.get("url") or "").strip()
        selector = (args.get("selector") or "").strip()
        text = (args.get("text") or "").strip()
        if not url or not selector or not text:
            return {"ok": False, "error": "browser.fill 需要 url、selector 和 text"}
        return fill(url, selector, text)
    elif tool == "browser.scroll":
        url = (args.get("url") or "").strip()
        direction = (args.get("direction") or "down").strip().lower()
        if not url:
            return {"ok": False, "error": "browser.scroll 需要 url"}
        return scroll(url, direction)
    else:
        return {"ok": False, "error": f"未知浏览器工具: {tool}"}


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    resolved_model = LLM_MODEL or _load_model_default()
    print(f"[xiyue-agent] listening on 127.0.0.1:{PORT} (llm={resolved_model}, "
          f"stt={WHISPER_MODEL}, data={DATA_DIR})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
