"""生成汐月托盘/窗口图标（纯 stdlib，无 pillow 依赖）。

产物（src-tauri/icons/）：32x32.png、128x128.png、icon.ico（ICO 内嵌 PNG，Vista+ 支持）。
图案：夜空蓝圆盘 + 弦月（透明镂空月牙）。
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
BLUE = (55, 138, 221)      # #378ADD 与情绪 calm 同源
EDGE = (232, 240, 250)     # 月缘亮色


def make_crescent(size: int) -> bytes:
    """RGBA PNG：蓝圆 + 右上弦月镂空。"""
    r = size / 2 - 1
    cx = cy = size / 2
    # 镂空圆：向右上偏移，半径略小 → 弦月
    mx, my, mr = cx + size * 0.16, cy - size * 0.16, r * 0.82
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0
        for x in range(size):
            d_main = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            d_cut = ((x - mx) ** 2 + (y - my) ** 2) ** 0.5
            if d_main <= r and d_cut > mr:
                # 月牙区域：接近镂空圆边缘处更亮
                rr, gg, bb = BLUE
                if d_cut - mr < size * 0.06:
                    rr, gg, bb = EDGE
                row += bytes((rr, gg, bb, 255))
            else:
                row += bytes((0, 0, 0, 0))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def make_ico(png32: bytes, png128: bytes) -> bytes:
    """ICO 容器：两枚 PNG 条目。"""
    hdr = struct.pack("<HHH", 0, 1, 2)  # reserved, type=ico, count=2
    offset = 6 + 2 * 16
    entries = b""
    for size, data in ((32, png32), (128, png128)):
        entries += struct.pack(
            "<BBBBHHII",
            size % 256, size % 256, 0, 0, 1, 32, len(data), offset,
        )
        offset += len(data)
    return hdr + entries + png32 + png128


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    p32, p128 = make_crescent(32), make_crescent(128)
    (OUT / "32x32.png").write_bytes(p32)
    (OUT / "128x128.png").write_bytes(p128)
    (OUT / "icon.ico").write_bytes(make_ico(p32, p128))
    print(f"icons written to {OUT}")


if __name__ == "__main__":
    main()
