"""把旧 working_memory.json / history.json 迁入 hermes_core 记忆库。

    .venv/Scripts/python scripts/migrate_hermes_memory.py

- working_memory.json 的 fact 句 → L1（importance 1-5 映射 0.3-0.9）
- history.json 的 user/assistant 轮次 → L0 原始对话（截断 2000）
- 幂等：内容归一化去重，重复跑不会堆重复记忆
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from agent.memory.store import resolve_data_dir  # noqa: E402
from agent.hermes_core.memory.store import init_tables  # noqa: E402
from agent.hermes_core import get_memory_service, reset_memory_service_cache  # noqa: E402


def main() -> None:
    data = resolve_data_dir()
    wm_path = data / "working_memory.json"
    hist_path = data / "history.json"

    init_tables()
    reset_memory_service_cache()
    svc = get_memory_service()

    n_wm = 0
    if wm_path.exists():
        try:
            items = json.loads(wm_path.read_text(encoding="utf-8") or "[]")
        except Exception as e:
            print(f"[migrate] working_memory 读失败: {e}")
            items = []
        for it in items if isinstance(items, list) else []:
            text = str((it or {}).get("text") or "").strip()
            if not text:
                continue
            imp_raw = float((it or {}).get("importance") or 3)
            imp = max(0.3, min(0.9, imp_raw / 5.0))
            try:
                svc.add_memory(
                    text,
                    category="fact",
                    source="migration",
                    importance=imp,
                    meta={"from": "working_memory.json"},
                )
                n_wm += 1
            except Exception as e:
                print(f"[migrate] wm 写失败: {e}")

    n_hist = 0
    if hist_path.exists():
        try:
            msgs = json.loads(hist_path.read_text(encoding="utf-8") or "[]")
        except Exception as e:
            print(f"[migrate] history 读失败: {e}")
            msgs = []
        i = 0
        while i + 1 < len(msgs) if isinstance(msgs, list) else 0:
            a = msgs[i] if isinstance(msgs[i], dict) else {}
            b = msgs[i + 1] if isinstance(msgs[i + 1], dict) else {}
            if a.get("role") == "user" and b.get("role") == "assistant":
                user_text = str(a.get("content") or "").strip()
                asst_text = str(b.get("content") or "").strip()
                if user_text and asst_text:
                    try:
                        svc.extract_and_store(user_text, asst_text, use_llm=False)
                        n_hist += 1
                    except Exception as e:
                        print(f"[migrate] hist 写失败: {e}")
                i += 2
            else:
                i += 1

    print(f"[migrate] done working_memory={n_wm} history_pairs={n_hist}")
    print(f"[migrate] db={data / 'agent' / 'memory' / 'core.db'}")


if __name__ == "__main__":
    main()
