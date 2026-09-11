"""汐月 Python sidecar 服务（Phase 0 精简实现）。

HTTP 127.0.0.1:8765（XIYUE_AGENT_PORT 可覆盖），由 Electron 主进程
（src/main/services/xiyueAgentService.ts）拉起、健康巡检并自动重启。

端点：
- GET  /health      -> {"ok": true, "model": ...}
- GET  /identity    -> 身份信息（XiyueIdentityReader）
- GET  /emotion     -> {"state", "enabled"}
- POST /chat        -> 文本对话 {"text"}，返回 {"user","reply","audio","audio_b64"}
- POST /chat/stream -> SSE：think → tool_call_request* → chunk* → final | error
- POST /transcribe  -> {"audio_b64"} → faster-whisper → {"text"}
- POST /tool-result -> 主进程回传工具执行结果 {"requestId","success","result","error"}
- POST /browser     -> Playwright 浏览器工具路由
- POST /voice       -> 已废弃（410），主路径是渲染层录音 → /transcribe

双闸门：本模块只做 gate/policy.py 预检并发出 tool_call_request；
执行与终审（xiyueFinalCheck）在 Electron 主进程，侧车不直接执行工具。

管线：
- STT：faster-whisper（voice/stt.py，默认 CPU int8）
- LLM：Ollama（默认 qwen3-4b-32k，think=False）+ identity.build_system_prompt + 历史≤10 轮 + 工作记忆
- TTS：kokoro（24k wav）→ 失败回退 pyttsx3
"""
from __future__ import annotations

import json
import os
import queue
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))  # 让 agent.* 可导入
sys.path.insert(0, str(ROOT / "voice"))  # 让 voice.* 可导入

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
    get_trust_level,
)

PORT = int(os.environ.get("XIYUE_AGENT_PORT", "8765"))
DATA_DIR = resolve_data_dir()
TTS_DIR = DATA_DIR / "tts"
TMP_DIR = DATA_DIR / "tmp"
# None → 用 voice/stt.py 的 DEFAULT_MODEL（仓库内 data/models/faster-whisper-base，免联网）
WHISPER_MODEL = os.environ.get("XIYUE_WHISPER_MODEL") or None
LLM_MODEL = os.environ.get("XIYUE_LLM_MODEL") or ""

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


# ---- hermes_core 换脑：记忆 / PAD 情绪（懒加载）----
_memory_svc = None
_memory_ready = False
_emotion_state = None
_emotion_lock = threading.Lock()


def _get_memory_service():
    """惰性初始化 hermes MemoryService（失败则返回 None，对话不阻塞）。"""
    global _memory_svc, _memory_ready
    if _memory_ready:
        return _memory_svc
    with _lock:
        if _memory_ready:
            return _memory_svc
        try:
            from agent.hermes_core import get_memory_service as _gm
            from agent.hermes_core.memory.store import init_tables as _init_tables

            _init_tables()
            _memory_svc = _gm()
            print("[xiyue-agent] hermes MemoryService 就绪", flush=True)
        except Exception as e:
            print(f"[xiyue-agent] hermes 记忆初始化失败，降级为空: {e}", flush=True)
            _memory_svc = None
        _memory_ready = True
    return _memory_svc


def _get_emotion_state():
    """惰性 PAD 情绪对象（进程内单例）。"""
    global _emotion_state
    if _emotion_state is not None:
        return _emotion_state
    with _emotion_lock:
        if _emotion_state is not None:
            return _emotion_state
        try:
            from agent.hermes_core import EmotionState

            _emotion_state = EmotionState()
        except Exception as e:
            print(f"[xiyue-agent] hermes 情绪初始化失败: {e}", flush=True)
            _emotion_state = None
    return _emotion_state


def _memory_injection_block(query: str = "") -> str:
    svc = _get_memory_service()
    if svc is None:
        return ""
    try:
        return (svc.build_injection_prompt(query) or "").strip()
    except Exception as e:
        print(f"[xiyue-agent] 记忆注入失败: {e}", flush=True)
        return ""


def _memory_store_turn(user_text: str, assistant_text: str) -> None:
    svc = _get_memory_service()
    if svc is None:
        return
    try:
        svc.extract_and_store(user_text, assistant_text, use_llm=False)
    except Exception as e:
        print(f"[xiyue-agent] 记忆写入失败: {e}", flush=True)


def _emotion_on_user(text: str) -> str:
    """按用户文本更新 PAD，并返回用于 system prompt 的中文描述。"""
    emo = get_current_emotion()
    state = _get_emotion_state()
    if state is None:
        return emo
    try:
        state.apply_event(text or "", intensity=0.35)
        state.drift()
        desc = state.describe()
        # 同步到 identity 层（仅表达，不影响权限）
        from agent.identity import set_current_emotion

        label = state.get_mood_label()
        try:
            set_current_emotion(label)
        except Exception:
            pass
        return desc or emo
    except Exception:
        return emo


def _emotion_tts_speed() -> float:
    """情绪 → TTS 语速（开心加速、低落减速）；失败返回 1.0。"""
    state = _get_emotion_state()
    if state is None:
        return 1.0
    try:
        p = float(state.pad.pleasure)
        if p > 0.25:
            return 1.1
        if p < -0.25:
            return 0.92
        return 1.0
    except Exception:
        return 1.0


# ---- 工具定义（同源 schemas/xiyue_tools.json，与主进程 xiyueToolSchema.ts 共用）----
def _load_tool_schema() -> dict:
    p = ROOT / "schemas" / "xiyue_tools.json"
    if not p.exists():
        raise FileNotFoundError(f"missing tool schema: {p}")
    return json.loads(p.read_text(encoding="utf-8"))


_SCHEMA = _load_tool_schema()


def _tool_def_from_schema(entry: dict) -> dict:
    return {
        "type": "function",
        "function": {
            "name": entry["name"],
            "description": entry.get("description") or entry.get("title") or entry["name"],
            "parameters": entry.get("inputSchema") or {"type": "object", "properties": {}, "required": []},
        },
    }


TOOL_DEFS = [_tool_def_from_schema(e) for e in _SCHEMA["tools"]]

# 工具 → 权限元数据（policy.py 裁决）；与主进程白名单同源
_TOOL_POLICY: dict[str, tuple[str, list[str], bool]] = {}
for _entry in _SCHEMA["tools"]:
    _xy = _entry.get("xiyue") or {}
    _name = _entry["name"]
    _risks = list(_xy.get("risks") or ["read"])
    _confirm = bool(_xy.get("confirm", False))
    # policy.Risk 枚举用 destructive，schema 用 delete/cmd —— 映射到 policy 可识别集合
    _policy_risks: list[str] = []
    for r in _risks:
        if r in ("delete", "cmd"):
            _policy_risks.append("destructive")
        elif r in ("read", "write", "clipboard", "sys", "monitor", "network"):
            _policy_risks.append(r)
        else:
            _policy_risks.append(r)
    if _xy.get("openWorldHint") or "network" in _risks:
        if "network" not in _policy_risks:
            _policy_risks.append("network")
    _TOOL_POLICY[_name] = (_name.split(".")[0], _policy_risks, _confirm)


def _decide_tool(tool_name: str):
    """policy.py 预检：返回 (authorizationRequired, denied)。信任等级读 xiyue.json security.trust_level。"""
    from agent.gate.policy import Ctx, ToolMeta, decide

    meta, risks, confirm = _TOOL_POLICY.get(tool_name, ("unknown", ["read"], True))
    tm = ToolMeta(id=tool_name, level=2 if confirm else 1, risks=risks, confirm=confirm)
    decision = decide(tm, ctx=Ctx(current_level=get_trust_level()))
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


def _strip_think(text: str) -> str:
    """安全网：模型无视 think=False 仍内联 <think> 时，只保留最终回答。两条回复路径共用。"""
    text = text or ""
    if "</think>" in text:
        text = text.split("</think>")[-1]
    return text.strip()


def _ollama_chat(model: str, messages: list[dict], tools: list[dict] | None = None):
    """统一 LLM 调用（非流式）。

    think=False：旧实现让 qwen3 先生成思考再剥离，纯浪费首字延迟；不支持该参数的模型自动回退。
    """
    import ollama  # 局部导入，避免启动期依赖

    kwargs: dict = {"model": model, "messages": messages, "stream": False}
    if tools is not None:
        kwargs["tools"] = tools
    try:
        return ollama.chat(**kwargs, think=False)
    except Exception as e:
        if "think" in str(e).lower():
            return ollama.chat(**kwargs)
        raise


def _ollama_chat_stream(
    model: str,
    messages: list[dict],
    tools: list[dict] | None = None,
    on_content=None,
):
    """流式 LLM 调用。on_content(text) 在收到内容增量时调用（可选）。

    返回与 _ollama_chat 相同结构的 message 汇总（content + tool_calls）。
    """
    import ollama  # 局部导入，避免启动期依赖

    kwargs: dict = {"model": model, "messages": messages, "stream": True}
    if tools is not None:
        kwargs["tools"] = tools
    try:
        stream = ollama.chat(**kwargs, think=False)
    except Exception as e:
        if "think" in str(e).lower():
            stream = ollama.chat(**kwargs)
        else:
            raise

    content_parts: list[str] = []
    tool_calls: list[dict] = []
    for part in stream or []:
        msg = part.get("message") or {}
        content = msg.get("content") or ""
        if content:
            content_parts.append(content)
            if on_content is not None:
                on_content(content)
        tcs = msg.get("tool_calls") or []
        if tcs:
            tool_calls.extend(tcs)

    return {
        "message": {
            "content": "".join(content_parts),
            "tool_calls": tool_calls,
        }
    }


def _run_agent_loop(messages: list[dict], emit) -> str:
    """工具化 agent 循环：ollama 真流式 + tools，最多 _MAX_TOOL_ROUNDS 轮。

    emit(event_type, payload) 由调用方（SSE 处理器）注入。
    内容增量实时经 chunk 下发；若随后出现 tool_calls，进入工具轮（UI 已在 toolCalling 态）。
    返回最终回答文本。
    """
    model = LLM_MODEL or _load_model_default()
    final_reply = ""

    for _round in range(_MAX_TOOL_ROUNDS):
        parts: list[str] = []

        def on_content(text: str, _sink=parts) -> None:
            _sink.append(text)
            # 真流式：逐增量推送。qwen 在请求工具时通常 content 为空，混发时也会进入 toolCalling UI。
            emit("chunk", {"text": text})

        resp = _ollama_chat_stream(model, messages, TOOL_DEFS, on_content=on_content)
        msg = resp["message"]
        content = _strip_think(msg.get("content") or "".join(parts))
        tool_calls = msg.get("tool_calls") or []
        final_reply = content
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

    # 超出轮数：兜底再问一次（真流式）
    def on_final(text: str) -> None:
        emit("chunk", {"text": text})

    resp = _ollama_chat_stream(model, messages, TOOL_DEFS, on_content=on_final)
    return _strip_think(resp["message"].get("content") or final_reply)


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


def _transcribe(wav: Path) -> str:
    stt = _get_stt()
    return stt.transcribe(str(wav), language="zh").strip()


def _llm_reply(user_text: str) -> str:
    model = LLM_MODEL or _load_model_default()
    emotion_desc = _emotion_on_user(user_text)
    system = _build_system(emotion_state=emotion_desc)

    # hermes 分层记忆注入（优先）；失败回退旧 working_memory
    mem_block = _memory_injection_block(user_text)
    if mem_block:
        system += "\n\n" + mem_block
    else:
        try:
            facts = get_active_facts(min_importance=1, max_items=10)
            if facts:
                system += "\n\n[相关记忆]\n" + "\n".join(f"- {f}" for f in facts)
        except Exception:
            pass

    messages = [{"role": "system", "content": system}] + _history[-get_max_history_turns():] + [
        {"role": "user", "content": user_text}
    ]
    resp = _ollama_chat(model, messages)
    reply = _strip_think(resp["message"]["content"] or "")
    _history.append({"role": "user", "content": user_text})
    _history.append({"role": "assistant", "content": reply})
    _save_history(_history)

    # hermes 记忆沉淀（优先）；失败回退旧启发式
    _memory_store_turn(user_text, reply)
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
    """已迁移至 voice.tts。默认内存合成不落盘；XIYUE_TTS_DISK=1 时写 TTS_DIR。"""
    if os.environ.get("XIYUE_TTS_DISK", "").strip() in ("", "0", "false", "False"):
        return _tts_module.speak(text, keep_file=False)
    return _tts_module.speak(text, keep_file=True)


def _audio_b64(path: Path | None) -> str:
    """读取 wav 转 base64；内存合成时 path 为 None，走 last_bytes 旁路。"""
    return _tts_module.to_base64(path)


class Handler(BaseHTTPRequestHandler):
    # HTTP/1.1：与 SSE/keep-alive 兼容更好（HTTP/1.0 无 Content-Length 时部分客户端会挂起读 body）
    protocol_version = "HTTP/1.1"

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
                # 服务端固定录 12 秒的旧路径已废弃：延迟不可接受，且渲染层已无调用方
                self._send({
                    "error": "/voice 已废弃：请使用渲染层录音 → POST /transcribe → POST /chat/stream",
                    "deprecated": True,
                }, 410)
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
        self.send_header("Connection", "close")
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
            emotion_desc = _emotion_on_user(text)
            system = _build_system(
                "你是本地 AI 管家，可以调用提供的工具帮用户做事。"
                "需要文件/系统/网络信息时优先调用工具；工具结果拿到后再组织回答。"
                "回复用中文，口语化，必要时用简短 markdown。",
                emotion_state=emotion_desc,
            )

            # hermes 分层记忆注入（优先）；失败回退旧 working_memory
            mem_block = _memory_injection_block(text)
            if mem_block:
                system += "\n\n" + mem_block
            else:
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

            # 回答已由 agent 循环真流式 chunk 下发；此处只做 TTS + final
            audio = _tts(reply) if reply else None
            emit("final", {
                "reply": reply,
                "audio_b64": _audio_b64(audio),
            })
            _history.append({"role": "user", "content": text})
            _history.append({"role": "assistant", "content": reply})
            _save_history(_history)

            _memory_store_turn(text, reply)
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
    try:
        removed = clear_expired()
        if removed:
            print(f"[xiyue-agent] 清理过期工作记忆 {removed} 条", flush=True)
    except Exception as e:
        print(f"[xiyue-agent] 清理过期工作记忆失败: {e}", flush=True)
    # 预热 hermes 记忆（避免首条对话卡在表初始化）
    try:
        _get_memory_service()
    except Exception as e:
        print(f"[xiyue-agent] hermes 记忆预热失败: {e}", flush=True)
    resolved_model = LLM_MODEL or _load_model_default()
    print(f"[xiyue-agent] listening on 127.0.0.1:{PORT} (llm={resolved_model}, "
          f"stt={WHISPER_MODEL}, trust_level={get_trust_level()}, data={DATA_DIR})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
