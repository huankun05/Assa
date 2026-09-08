"""TTS：CosyVoice V3（设计目标）+ Kokoro（Phase 0 默认）+ pyttsx3（兜底）。

对外入口：
- speak(text, engine="kokoro") -> Path | None
- to_base64(path) -> str

Phase 0 优先走 Kokoro（中文强、RTF<1），失败自动回退 pyttsx3。
CosyVoice HTTP 模式后续接在 speak() 前面，生命周期与汐月解耦。
"""
from __future__ import annotations

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


def _synthesize_kokoro(text: str, out: Path) -> Path | None:
    pipe = _get_kokoro_pipeline()
    if pipe is None:
        return None
    try:
        chunks = [audio for _gs, _ps, audio in pipe(text, voice="zf_xiaobei", speed=1.0)]
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


def speak(text: str, engine: str = "kokoro") -> Path | None:
    """合成 wav 到 TTS_DIR，返回路径；全部失败返回 None。"""
    if not text or not str(text).strip():
        return None

    out = TTS_DIR / f"out_{int(time.time() * 1000)}.wav"

    if engine == "cosyvoice":
        # TODO: 纳西妲 CosyVoice HTTP 客户端（地址待配置）
        pass

    # Phase 0：kokoro -> pyttsx3
    result = _synthesize_kokoro(text, out)
    if result is not None:
        return result
    return _synthesize_pyttsx3(text, out)


def to_base64(path: Path | None) -> str:
    """读取 wav 转 base64（供 Electron 渲染层直接播放），失败返回空串。"""
    if path is None or not path.exists():
        return ""
    try:
        import base64

        return base64.b64encode(path.read_bytes()).decode("ascii")
    except Exception:
        return ""
