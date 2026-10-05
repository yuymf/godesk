#!/usr/bin/env python3
"""G3D-ART / G3D-25: seat badges, flourish, loading — illustrated parchment + Cycles comps."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.parchment import (  # noqa: E402
    COPPER,
    FOAM,
    INK,
    PAPER,
    PAPER_DEEP,
    RENDERS,
    SEA,
    SEA_NEAR,
    WOOD,
    ZHU,
    hatch,
    parchment_base,
    paste_render,
    pine_tree,
    save_webp,
    seal_stamp,
    tone_render,
    wash_radial,
    wave_band,
)
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/illustrations/brand"
EV = Path("/workspace/g3d-evidence/G3D-ART/after")
OUT.mkdir(parents=True, exist_ok=True)
EV.mkdir(parents=True, exist_ok=True)

SEATS = [(196, 92, 74), (61, 126, 166), (210, 162, 58), (91, 143, 91)]


def seat_badge(i: int) -> Image.Image:
    w = h = 256
    img = parchment_base(w, h, 200 + i)
    c = SEATS[i]
    img = wash_radial(img, 128, 128, 110, c, strength=95)
    d = ImageDraw.Draw(img)
    # outer ring emboss
    d.ellipse((18, 18, 238, 238), outline=INK, width=4)
    d.ellipse((28, 28, 228, 228), outline=COPPER, width=2)
    d.ellipse((40, 40, 216, 216), fill=c, outline=INK, width=3)
    # inner parchment disk
    d.ellipse((70, 70, 186, 186), fill=PAPER, outline=PAPER_DEEP, width=2)
    hatch(d, (80, 80, 176, 176), spacing=5, angle=35 + i * 12, fill=tuple(max(0, x - 30) for x in c), width=1)
    # tide mark
    d.arc((85, 95, 171, 175), 200, 340, fill=SEA, width=3)
    d.arc((95, 105, 161, 165), 210, 330, fill=SEA_NEAR, width=2)
    d.ellipse((118, 112, 138, 132), fill=INK)
    # seat index ticks like compass
    for k in range(8):
        ang = math.radians(k * 45)
        x0, y0 = 128 + math.cos(ang) * 95, 128 + math.sin(ang) * 95
        x1, y1 = 128 + math.cos(ang) * 108, 128 + math.sin(ang) * 108
        d.line((x0, y0, x1, y1), fill=FOAM if k % 2 == 0 else INK, width=2)
    d.text((116, 148), f"S{i}", fill=INK)
    # tiny seal
    seal_stamp(d, 200, 200, 22, ZHU)
    return img


def flourish() -> Image.Image:
    w, h = 1024, 256
    img = parchment_base(w, h, 42)
    d = ImageDraw.Draw(img)
    wave_band(d, 175, w, amp=16, color=SEA, width=3, phases=3)
    # island silhouette mid
    cx = w // 2
    d.polygon([(cx - 160, 150), (cx - 80, 70), (cx - 20, 100), (cx + 40, 55), (cx + 120, 95), (cx + 170, 150)], fill=WOOD, outline=INK)
    hatch(d, (cx - 150, 70, cx + 160, 150), spacing=6, angle=28, fill=INK, width=1)
    pine_tree(d, cx - 30, 40, 90, WOOD)
    pine_tree(d, cx + 50, 55, 70, WOOD)
    # ornamental knots
    for x in (90, w // 2, w - 90):
        seal_stamp(d, x, 55, 28, ZHU if x == w // 2 else COPPER)
    # title banner
    d.rounded_rectangle((cx - 160, 185, cx + 160, 230), radius=4, outline=INK, fill=PAPER_DEEP, width=2)
    d.text((cx - 70, 200), "TIDEWELL ISLES", fill=INK)
    # corner flourishes
    for x0 in (40, w - 40):
        d.arc((x0 - 30, 20, x0 + 30, 80), 200, 340, fill=COPPER, width=2)
        d.arc((x0 - 20, 35, x0 + 20, 75), 200, 340, fill=ZHU, width=1)
    return img


def loading() -> Image.Image:
    w, h = 1600, 900
    img = parchment_base(w, h, 7)
    # sky wash
    sky = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sky)
    for i in range(12):
        y0 = int(h * 0.05 * i)
        sd.rectangle((0, y0, w, y0 + 80), fill=(62, 140, 154, 8 + i))
    img = Image.alpha_composite(img.convert("RGBA"), sky).convert("RGB")
    d = ImageDraw.Draw(img)
    # sea
    sea = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sed = ImageDraw.Draw(sea)
    sed.rectangle((0, int(h * 0.52), w, h), fill=(*SEA, 180))
    img = Image.alpha_composite(img.convert("RGBA"), sea.filter(ImageFilter.GaussianBlur(1))).convert("RGB")
    d = ImageDraw.Draw(img)
    wave_band(d, int(h * 0.52), w, amp=14, color=FOAM, width=3, phases=3)
    for yoff in (40, 80, 130, 200):
        wave_band(d, int(h * 0.52) + yoff, w, amp=10, color=SEA_NEAR, width=2, phases=1)

    cx, cy = w // 2, int(h * 0.40)
    # island hex mosaic suggestion (original composition)
    import math as _m
    for ring, col in ((0, WOOD), (1, (91, 143, 91)), (2, (143, 168, 106))):
        n = 1 if ring == 0 else ring * 6
        for k in range(n):
            ang = _m.radians(60 * k / max(ring, 1) - 30) if ring else 0
            r = ring * 95
            hx = cx + _m.cos(ang) * r
            hy = cy + _m.sin(ang) * r * 0.75
            hex_r = 48
            pts = [(hx + hex_r * _m.cos(_m.radians(60 * i - 30)), hy + hex_r * _m.sin(_m.radians(60 * i - 30))) for i in range(6)]
            shade = tuple(max(0, c - ring * 8) for c in col)
            d.polygon(pts, fill=shade, outline=INK)
            hatch(d, (hx - 40, hy - 35, hx + 40, hy + 35), spacing=5, angle=30 + k * 5, fill=INK, width=1)

    # composite mesh renders as harbor props
    dock = tone_render(RENDERS / "dock.png", 320, tint=COPPER)
    lamp = tone_render(RENDERS / "fog-lamp.png", 260, tint=SEA)
    sett = tone_render(RENDERS / "settlement.png", 220, tint=SEATS[0])
    city = tone_render(RENDERS / "city.png", 240, tint=SEATS[2])
    if dock:
        img = paste_render(img, dock, cx - 280, int(h * 0.58), 0.9)
    if lamp:
        img = paste_render(img, lamp, cx + 300, int(h * 0.48), 0.92)
    if sett:
        img = paste_render(img, sett, cx - 100, cy - 20, 0.9)
    if city:
        img = paste_render(img, city, cx + 90, cy - 40, 0.9)
    d = ImageDraw.Draw(img)
    pine_tree(d, cx - 200, cy - 80, 120, WOOD)
    pine_tree(d, cx + 200, cy - 60, 100, WOOD)
    seal_stamp(d, cx, int(h * 0.78), 48, ZHU)
    d.rounded_rectangle((cx - 200, int(h * 0.86), cx + 200, int(h * 0.93)), radius=6, outline=INK, fill=PAPER_DEEP, width=2)
    d.text((cx - 90, int(h * 0.88)), "LOADING TIDEWELL…", fill=INK)
    return img


results = []
for i in range(4):
    img = seat_badge(i)
    rel = f"assets/illustrations/brand/seat-{i}.webp"
    sz = save_webp(img, ROOT / rel, 20)
    img.save(EV / f"seat-{i}.png")
    print("seat", i, sz)
    results.append((f"illustration/seat-{i}", rel, sz))

img = flourish()
rel = "assets/illustrations/brand/island-flourish.webp"
sz = save_webp(img, ROOT / rel, 30)
img.save(EV / "island-flourish.png")
print("flourish", sz)
results.append(("illustration/island-flourish", rel, sz))

img = loading()
rel = "assets/illustrations/brand/loading-tidewell.webp"
sz = save_webp(img, ROOT / rel, 120)
img.save(EV / "loading-tidewell.png")
print("loading", sz)
results.append(("illustration/loading-tidewell", rel, sz))

Path(EV / "brand-sizes.txt").write_text("\n".join(f"{a} {c}" for a, _, c in results) + "\n")
print("done", len(results))
