#!/usr/bin/env python3
"""G3D-23 U-01：程序化羊皮纸纹 WebP 1024² → assets/ui/paper-noise.webp"""
from PIL import Image, ImageFilter, ImageEnhance
import math
from pathlib import Path

W = H = 1024
base = (232, 214, 184)

def hash2(i, j, o):
    n = (i * 374761393 + j * 668265263 + o * 1274126177) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return (n & 0xFFFF) / 65535.0

def main():
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            n = 0.0
            amp = 1.0
            freq = 1.0 / 64.0
            for o in range(5):
                fx = (x * freq) % 64
                fy = (y * freq) % 64
                ix, iy = int(fx), int(fy)
                tx, ty = fx - ix, fy - iy
                v = (
                    hash2(ix, iy, o) * (1 - tx) * (1 - ty)
                    + hash2(ix + 1, iy, o) * tx * (1 - ty)
                    + hash2(ix, iy + 1, o) * (1 - tx) * ty
                    + hash2(ix + 1, iy + 1, o) * tx * ty
                )
                n += (v - 0.5) * amp
                amp *= 0.55
                freq *= 2
            fiber = math.sin((x * 0.07 + y * 0.02) + n * 3) * 4
            r = max(0, min(255, int(base[0] + n * 28 + fiber)))
            g = max(0, min(255, int(base[1] + n * 22 + fiber * 0.6)))
            b = max(0, min(255, int(base[2] + n * 16)))
            px[x, y] = (r, g, b)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    img = ImageEnhance.Contrast(img).enhance(1.05)
    out = Path(__file__).resolve().parents[1] / "assets/ui/paper-noise.webp"
    out.parent.mkdir(parents=True, exist_ok=True)
    for q in (82, 75, 68, 60):
        img.save(out, "WEBP", quality=q, method=6)
        if out.stat().st_size <= 120 * 1024:
            break
    print(out, out.stat().st_size)

if __name__ == "__main__":
    main()
