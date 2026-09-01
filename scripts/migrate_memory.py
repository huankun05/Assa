"""记忆迁移脚本：一键复制 data/ 到目标目录。

用法：
  python scripts/migrate_memory.py                  # 默认复制到 ./data_backup
  python scripts/migrate_memory.py D:\\backup\\xiyue # 指定目标目录
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path


def migrate(target_dir: str | None = None) -> None:
    root = Path(__file__).resolve().parent.parent
    data_src = root / "data"
    if not data_src.exists():
        print(f"源目录不存在: {data_src}")
        return

    target = Path(target_dir) if target_dir else root / "data_backup"
    target.mkdir(parents=True, exist_ok=True)

    copied = 0
    for item in data_src.iterdir():
        dst = target / item.name
        if item.is_file():
            shutil.copy2(item, dst)
            copied += 1
        elif item.is_dir():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(item, dst)
            copied += 1

    print(f"已复制 {copied} 项到 {target}")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    migrate(target)
