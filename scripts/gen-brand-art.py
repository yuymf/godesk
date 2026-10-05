#!/usr/bin/env python3
"""G3D-25 (bitmap captions Latin-only — CJK tofu fix; art pass = G3D-ART).

G3D-25: seat badges, island flourish, loading art — procedural parchment."""
from __future__ import annotations
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/illustrations/brand"
EV = Path("/workspace/g3d-evidence/G3D-25")
OUT.mkdir(parents=True, exist_ok=True)
EV.mkdir(parents=True, exist_ok=True)

PAPER = (232, 214, 184)
PAPER_DEEP = (201, 176, 138)
INK = (42, 36, 28)
ZHU = (163, 59, 43)
COPPER = (138, 106, 61)
SEA = (27, 79, 107)
FOAM = (232, 242, 240)
SEATS = [(196, 92, 74), (61, 126, 166), (210, 162, 58), (91, 143, 91)]


def paper(w, h, seed):
    rng = random.Random(seed)
    img = Image.new("RGB", (w, h), PAPER)
    px = img.load()
    for y in range(h):
        for x in range(w):
            n = rng.randint(-10, 10)
            dx, dy = x / w - 0.5, y / h - 0.5
            v = (dx * dx + dy * dy) * 0.5
            r = int(max(0, min(255, PAPER[0] + n)) * (1 - v) + PAPER_DEEP[0] * v)
            g = int(max(0, min(255, PAPER[1] + n)) * (1 - v) + PAPER_DEEP[1] * v)
            b = int(max(0, min(255, PAPER[2] + n)) * (1 - v) + PAPER_DEEP[2] * v)
            px[x, y] = (r, g, b)
    return img.filter(ImageFilter.GaussianBlur(0.35))


def save_webp(img, path, limit_kb):
    q = 80
    while q >= 35:
        img.save(path, "WEBP", quality=q, method=6)
        if path.stat().st_size <= limit_kb * 1024:
            return path.stat().st_size
        q -= 7
    img.save(path, "WEBP", quality=40, method=6)
    return path.stat().st_size


def seat_badge(i: int) -> Image.Image:
    w = h = 256
    img = paper(w, h, 100 + i)
    d = ImageDraw.Draw(img)
    c = SEATS[i]
    d.ellipse((28, 28, 228, 228), outline=INK, width=4, fill=PAPER_DEEP)
    d.ellipse((48, 48, 208, 208), outline=COPPER, width=3, fill=c)
    # tide mark
    d.arc((70, 70, 186, 186), 200, 340, fill=FOAM, width=5)
    d.ellipse((118, 110, 138, 130), fill=INK)
    d.text((110, 175), f"S{i}", fill=INK)
    return img


def flourish() -> Image.Image:
    w, h = 1024, 256
    img = paper(w, h, 42)
    d = ImageDraw.Draw(img)
    # wave underline
    pts = []
    for x in range(40, w - 40):
        y = 160 + int(18 * math.sin(x / 40)) + int(8 * math.sin(x / 17))
        pts.append((x, y))
    d.line(pts, fill=SEA, width=4)
    # decorative knots
    for x in (80, w // 2, w - 80):
        d.ellipse((x - 18, 70, x + 18, 106), outline=ZHU, width=3)
        d.ellipse((x - 8, 80, x + 8, 96), fill=COPPER)
    d.text((w // 2 - 70, 110), "TIDEWELL ISLES", fill=INK)
    return img


def loading() -> Image.Image:
    w, h = 1600, 900
    img = paper(w, h, 7)
    d = ImageDraw.Draw(img)
    # sea band
    d.rectangle((0, int(h * 0.55), w, h), fill=SEA)
    # foam line
    pts = [(x, int(h * 0.55) + int(12 * math.sin(x / 55))) for x in range(0, w, 4)]
    d.line(pts, fill=FOAM, width=3)
    # island hex suggestion
    cx, cy = w // 2, int(h * 0.42)
    hex_r = 160
    hex_pts = []
    for k in range(6):
        ang = math.radians(60 * k - 30)
        hex_pts.append((cx + hex_r * math.cos(ang), cy + hex_r * math.sin(ang)))
    d.polygon(hex_pts, outline=INK, fill=(47, 93, 58))
    # fog lamp buoy
    d.ellipse((cx + 180, cy + 40, cx + 240, cy + 90), outline=INK, fill=COPPER)
    d.rectangle((cx + 202, cy - 20, cx + 218, cy + 50), fill=PAPER_DEEP, outline=INK)
    d.ellipse((cx + 190, cy - 55, cx + 230, cy - 15), outline=INK, fill=FOAM)
    d.text((cx - 80, int(h * 0.78)), "LOADING TIDEWELL…", fill=FOAM)
    return img


results = []
for i in range(4):
    img = seat_badge(i)
    rel = f"assets/illustrations/brand/seat-{i}.webp"
    sz = save_webp(img, ROOT / rel, 20)
    img.save(EV / f"seat-{i}.png")
    print("seat", i, sz)
    results.append((f"illustration/seat-{i}", rel, sz, f"座位徽记 {i}"))

img = flourish()
rel = "assets/illustrations/brand/island-flourish.webp"
sz = save_webp(img, ROOT / rel, 30)
img.save(EV / "island-flourish.png")
print("flourish", sz)
results.append(("illustration/island-flourish", rel, sz, "岛名花饰"))

img = loading()
rel = "assets/illustrations/brand/loading-tidewell.webp"
sz = save_webp(img, ROOT / rel, 120)
img.save(EV / "loading-tidewell.png")
print("loading", sz)
results.append(("illustration/loading-tidewell", rel, sz, "加载画"))

Path(EV / "sizes.txt").write_text("\n".join(f"{a} {c}" for a,_,c,_ in results)+"\n")
print("done", len(results))
