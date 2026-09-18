"""TTS：CosyVoice V3（设计目标）+ Kokoro（Phase 0 默认）+ pyttsx3（兜底）。

对外入口：
- speak(text, engine="kokoro") -> Path | None
- to_base64(path) -> str

Phase 0 优先走 Kokoro（中文强、RTF<1），失败自动回退 pyttsx3。
CosyVoice HTTP 模式后续接在 speak() 前面，生命周期与汐月解耦。
"""
from __future__ import annotations

import json
import time
import wave
from pathlib import Path

import numpy as np

from agent.memory.store import resolve_data_dir

TTS_DIR = resolve_data_dir() / "tts"
TTS_DIR.mkdir(parents=True, exist_ok=True)

_pipeline = None


def _get_kokoro_pipeline():
    """懒加载 Kokoro pipeline，失败则返回 None（调用方回退 pyttsx3）。"""
    global _pipeline
    if _pipeline is not None:
        return _pipeline or None
    try:
        from kokoro import KPipeline  # noqa: 首次运行自动下载模型

        _pipeline = KPipeline(lang_code="z")
        print("[tts] kokoro pipeline 已加载", flush=True)
        return _pipeline
    except Exception as e:  # noqa: BLE001
        print(f"[tts] kokoro 不可用，回退 pyttsx3: {e}", flush=True)
        _pipeline = False
        return None


def _synthesize_cosyvoice_http(text: str, out: Path, speed: float = 1.0) -> Path | None:
    """可选：外部 CosyVoice HTTP 服务（ASSA_COSYVOICE_URL）。失败返回 None。"""
    import os
    import urllib.request

    url = (os.environ.get("ASSA_COSYVOICE_URL") or "").strip()
    if not url:
        return None
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps({"text": text, "speed": speed}, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        wav_b64 = payload.get("audio_b64") or payload.get("audio") or ""
        if not wav_b64:
            return None
        import base64

        out.write_bytes(base64.b64decode(wav_b64))
        return out
    except Exception as e:  # noqa: BLE001
        print(f"[tts] cosyvoice http 失败: {e}", flush=True)
        return None


def _synthesize_kokoro(text: str, out: Path, speed: float = 1.0) -> Path | None:
    pipe = _get_kokoro_pipeline()
    if pipe is None:
        return None
    try:
        sp = max(0.7, min(1.4, float(speed or 1.0)))
        chunks = [audio for _gs, _ps, audio in pipe(text, voice="zf_xiaobei", speed=sp)]
        if not chunks:
            return None
        audio = np.concatenate(chunks)
        audio16 = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
        with wave.open(str(out), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(24000)
            w.writeframes(audio16.tobytes())
        return out
    except Exception as e:  # noqa: BLE001
        print(f"[tts] kokoro 失败，回退 pyttsx3: {e}", flush=True)
        return None


def _synthesize_pyttsx3(text: str, out: Path) -> Path | None:
    try:
        import pyttsx3  # noqa: Windows SAPI 离线兜底

        eng = pyttsx3.init()
        eng.save_to_file(text, str(out))
        eng.runAndWait()
        return out if out.exists() else None
    except Exception as e:  # noqa: BLE001
        print(f"[tts] pyttsx3 也失败: {e}", flush=True)
        return None


def speak(text: str, engine: str = "kokoro", keep_file: bool | None = None, speed: float = 1.0) -> Path | None:
    """合成语音。

    keep_file=True：写入 TTS_DIR 并返回路径。
    keep_file=False：默认（推荐）——临时目录合成后删除，业务目录不落盘；返回 None。
    keep_file=None：看环境变量 ASSA_TTS_DISK（非空且非 0 时落盘）。
    speed：语速倍率（Kokoro）；情绪可轻微调整。
    """
    if not text or not str(text).strip():
        return None

    import os
    import tempfile

    if keep_file is None:
        keep_file = os.environ.get("ASSA_TTS_DISK", "").strip() not in ("", "0", "false", "False")

    if keep_file:
        out = TTS_DIR / f"out_{int(time.time() * 1000)}.wav"
        result = _synthesize_cosyvoice_http(text, out, speed=speed)
        if result is None:
            result = _synthesize_kokoro(text, out, speed=speed)
        if result is None:
            result = _synthesize_pyttsx3(text, out)
        return result

    with tempfile.TemporaryDirectory(prefix="assa-tts-") as td:
        out = Path(td) / "out.wav"
        result = _synthesize_cosyvoice_http(text, out, speed=speed)
        if result is None:
            result = _synthesize_kokoro(text, out, speed=speed)
        if result is None:
            result = _synthesize_pyttsx3(text, out)
        if result is None or not result.exists():
            return None
        global last_bytes
        last_bytes = result.read_bytes()
    return None


# 最近一次内存合成的 wav 字节（keep_file=False 时使用）
last_bytes: bytes | None = None


def synthesize_bytes(text: str, engine: str = "kokoro") -> bytes | None:
    """在内存/临时目录中合成 wav 字节，不写业务目录。全部失败返回 None。"""
    speak(text, engine=engine, keep_file=False)
    return last_bytes


def to_base64(path: Path | None) -> str:
    """读取 wav 转 base64（供 Electron 渲染层直接播放），失败返回空串。"""
    import base64

    if path is not None and path.exists():
        try:
            return base64.b64encode(path.read_bytes()).decode("ascii")
        except Exception:
            return ""
    if last_bytes:
        try:
            return base64.b64encode(last_bytes).decode("ascii")
        except Exception:
            return ""
    return ""
