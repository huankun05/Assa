"""VAD：Silero VAD 做端点检测 + 语音打断（barge-in）。Phase0 stub。"""
from __future__ import annotations

from silero_vad import get_speech_timestamps, load_silero_vad, read_audio

# 模块级单例缓存（常驻场景每次加载要数百 ms，不能重复加载）
_vad_model = None


def _get_model():
    global _vad_model
    if _vad_model is None:
        _vad_model = load_silero_vad()
    return _vad_model


def detect_speech(audio_path: str) -> list[dict]:
    wav = read_audio(audio_path)
    return get_speech_timestamps(wav, _get_model(), return_seconds=True)
