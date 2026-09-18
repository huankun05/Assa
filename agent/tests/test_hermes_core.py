"""hermes_core 换脑回归（无 pytest，直接运行）：

    .venv/Scripts/python agent/tests/test_hermes_core.py

覆盖：路径收口、init/extract/injection、情绪 PAD 描述。
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from agent.hermes_core.memory.store import get_db_path, init_tables  # noqa: E402
from agent.hermes_core import EmotionState, get_memory_service, reset_memory_service_cache  # noqa: E402


def test_db_path_under_data_dir() -> None:
    p = get_db_path()
    assert p.name == "core.db"
    assert "agent" in p.parts and "memory" in p.parts
    assert str(p).startswith(str(ROOT / "data")) or "ASSA_DATA_DIR" in p.parts or p.exists()


def test_extract_and_injection() -> None:
    init_tables()
    reset_memory_service_cache()
    svc = get_memory_service()
    items = svc.extract_and_store("我喜欢在晚上听轻音乐写代码", "好的，记住这个习惯了")
    assert isinstance(items, list)
    inj = svc.build_injection_prompt("写代码")
    assert isinstance(inj, str)
    # 偏好关键词「我喜欢」应进入注入或至少 L0 原始片段
    assert "喜欢" in inj or "代码" in inj


def test_emotion_pad_describe() -> None:
    e = EmotionState()
    e.apply_event("太好了终于修完了这个bug", intensity=0.9)
    label = e.get_mood_label()
    desc = e.describe()
    assert isinstance(label, str) and label
    assert "情绪" in desc or "心情" in desc


if __name__ == "__main__":
    test_db_path_under_data_dir()
    test_extract_and_injection()
    test_emotion_pad_describe()
    print("3/3 passed")
