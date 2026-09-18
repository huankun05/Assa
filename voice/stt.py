"""STT：faster-whisper 本地推理（GPU 加速，CPU 回退）。Phase0 stub。"""
from __future__ import annotations

import os
from pathlib import Path

from faster_whisper import WhisperModel

_model = None


# 默认使用仓库内已下载的模型（data/models/faster-whisper-base），避免联网拉取；
# 也可用 ASSA_WHISPER_MODEL 指向 HF 模型名（如 base/small）或任意本地目录。
DEFAULT_MODEL = os.environ.get(
    "ASSA_WHISPER_MODEL",
    str(Path(__file__).resolve().parent.parent / "data" / "models" / "faster-whisper-base"),
)

# 默认 CPU：GPU 需要本机装 CUDA12 的 cublas/cudnn DLL（ctranslate2 在首次推理时才加载，
# 缺失会抛 "cublas64_12.dll is not found"）。想用 GPU：设 ASSA_STT_DEVICE=cuda。
DEFAULT_DEVICE = os.environ.get("ASSA_STT_DEVICE", "cpu")


def current_device() -> str:
    return "cuda" if _model is not None and _device_used == "cuda" else _device_used


_device_used = "cpu"


def load(model_size: str | None = None, device: str | None = None) -> None:
    """加载模型。device 默认自动探测：CUDA 可用则 cuda(int8_float16 省显存)，否则 CPU。

    显存与其他应用共享（用户习惯"不用即卸载"），故卸载由外部控制：
    unload() 释放引用，模型生命周期归 sidecar 主循环管。
    """
    global _model, _device_used
    model = model_size or DEFAULT_MODEL
    device = device or DEFAULT_DEVICE
    compute = "int8_float16" if device == "cuda" else "int8"
    _model = WhisperModel(model, device=device, compute_type=compute)
    _device_used = device
    print(f"[stt] 模型已加载: {model} device={device} compute={compute}", flush=True)


def _cuda_available() -> bool:
    try:
        import ctranslate2  # faster-whisper 的推理后端

        return ctranslate2.get_cuda_device_count() > 0
    except Exception:
        return False


def unload() -> None:
    """显存紧张时卸载模型（配合"不用即卸载"习惯）。"""
    global _model
    _model = None


def transcribe(audio_path: str, language: str = "zh") -> str:
    if _model is None:
        load()
    try:
        segments, _ = _model.transcribe(audio_path, language=language)
        return "".join(s.text for s in segments)
    except Exception as e:
        # GPU 推理期才暴露的 CUDA DLL 缺失 → 降级 CPU 重试一次
        if _device_used == "cpu":
            raise
        print(f"[stt] GPU 推理失败，降级 CPU 重试: {e}", flush=True)
        load(device="cpu")
        segments, _ = _model.transcribe(audio_path, language=language)
        return "".join(s.text for s in segments)
