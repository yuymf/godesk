#!/usr/bin/env python3
"""G3D-ART / G3D-24: illustrated parchment card art (self-authored + CC0 Paper001 + Cycles mesh renders).

No AI images. No settlecoast copy. Latin-only bitmap captions (CJK in UI).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.parchment import (  # noqa: E402
    BRICK,
    COPPER,
    FOAM,
    INK,
    ORE,
    PAPER_DEEP,
    RENDERS,
    SEA,
    SEA_NEAR,
    SHEEP,
    WHEAT,
    WOOD,
    ZHU,
    apply_torn_frame,
    brick_wall,
    caption_band,
    hatch,
    hatch_in_mask,
    ore_crystal,
    parchment_base,
    paste_render,
    pine_tree,
    save_webp,
    seal_stamp,
    tone_render,
    wash_radial,
    wave_band,
    wheat_stalk,
)
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/illustrations/cards"
EV = Path("/workspace/g3d-evidence/G3D-ART/after")
OUT.mkdir(parents=True, exist_ok=True)
EV.mkdir(parents=True, exist_ok=True)

TERRAIN = {
    "wood": WOOD,
    "brick": BRICK,
    "sheep": SHEEP,
    "wheat": WHEAT,
    "ore": ORE,
}
DEV = {
    "fog-signal": (27, 79, 107),
    "tide-plenty": SEA_NEAR,
    "harbor-charter": COPPER,
}


def draw_resource(kind: str, w=384, h=512) -> Image.Image:
    seed = {"wood": 11, "brick": 22, "sheep": 33, "wheat": 44, "ore": 55}[kind]
    img = parchment_base(w, h, seed)
    color = TERRAIN[kind]
    cx, cy = w // 2, int(h * 0.40)
    img = wash_radial(img, cx, cy, 130, color, strength=85)
    # ground wash band
    ground = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(ground)
    gd.ellipse((40, cy + 40, w - 40, cy + 160), fill=(*PAPER_DEEP, 90))
    img = Image.alpha_composite(img.convert("RGBA"), ground.filter(ImageFilter.GaussianBlur(4))).convert("RGB")
    d = ImageDraw.Draw(img)

    if kind == "wood":
        # distant treeline silhouette
        for i, dx in enumerate(range(-120, 121, 28)):
            pine_tree(d, cx + dx, cy - 20 + (i % 3) * 6, 70 + (i % 4) * 8, fill=tuple(max(20, c - 25) for c in WOOD))
        # hero pines
        pine_tree(d, cx - 55, cy - 50, 150, WOOD)
        pine_tree(d, cx + 10, cy - 70, 175, WOOD)
        pine_tree(d, cx + 60, cy - 40, 140, WOOD)
        # soft ground shade only (no hatch overlay — prior hatch spilled past frame)
        shade = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(shade).ellipse((cx - 95, cy + 55, cx + 95, cy + 110), fill=(42, 36, 28, 35))
        img = Image.alpha_composite(img.convert("RGBA"), shade).convert("RGB")
        d = ImageDraw.Draw(img)
    elif kind == "brick":
        # kiln hinterland
        kiln = [(cx - 110, cy + 40), (cx - 40, cy - 80), (cx + 30, cy + 40)]
        d.polygon(kiln, fill=tuple(max(0, c - 40) for c in BRICK), outline=INK)
        brick_wall(d, cx + 20, cy + 10, cols=6, rows=5, bw=26, bh=15)
        # clay mound
        d.ellipse((cx - 120, cy + 70, cx - 40, cy + 120), fill=BRICK, outline=INK)
        d.ellipse((cx + 40, cy + 75, cx + 120, cy + 125), fill=tuple(min(255, c + 15) for c in BRICK), outline=INK)
    elif kind == "sheep":
        # salt-grass meadow
        for i in range(18):
            x = 50 + i * 16
            d.line((x, cy + 90, x + (i % 3) - 1, cy + 40 - (i % 5) * 3), fill=SHEEP, width=2)
        # bushes — solid fill + outline only (no hatch slabs)
        for bx, by, br in ((cx - 90, cy + 50, 35), (cx + 85, cy + 55, 30), (cx - 20, cy + 70, 25)):
            d.ellipse((bx - br, by - br // 2, bx + br, by + br // 2), fill=SHEEP, outline=INK)
        # composite Cycles sheep render
        sheep = tone_render(RENDERS / "sheep.png", 220, tint=SHEEP)
        if sheep:
            img = paste_render(img, sheep, cx + 10, cy - 10, opacity=0.95)
            d = ImageDraw.Draw(img)
        else:
            d.ellipse((cx - 55, cy - 35, cx + 55, cy + 45), outline=INK, fill=(230, 230, 220))
            d.ellipse((cx + 20, cy - 55, cx + 70, cy - 5), outline=INK, fill=(230, 230, 220))
    elif kind == "wheat":
        # field rows perspective
        for row in range(8):
            y = cy - 40 + row * 18
            spread = 40 + row * 12
            d.arc((cx - spread, y, cx + spread, y + 20), 200, 340, fill=WHEAT, width=2)
        for i, dx in enumerate((-70, -45, -20, 5, 30, 55, 80)):
            wheat_stalk(d, cx + dx, cy - 90 + (i % 3) * 8, 130 - (i % 4) * 8)
        # sickle
        d.arc((cx + 70, cy - 30, cx + 130, cy + 40), 200, 40, fill=COPPER, width=4)
        d.line((cx + 100, cy + 35, cx + 100, cy + 90), fill=COPPER, width=3)
        d.rectangle((cx + 92, cy + 88, cx + 108, cy + 100), outline=INK, fill=PAPER_DEEP)
    elif kind == "ore":
        # reef ridge
        ridge = [(40, cy + 80), (100, cy - 20), (160, cy + 30), (220, cy - 60), (300, cy + 10), (350, cy + 90), (40, cy + 100)]
        d.polygon(ridge, fill=tuple(max(0, c - 30) for c in ORE), outline=INK)
        ore_crystal(d, cx - 40, cy, 55)
        ore_crystal(d, cx + 50, cy - 20, 70)
        ore_crystal(d, cx + 10, cy + 40, 40)
        # foam tide line
        wave_band(d, cy + 95, w, amp=8, color=SEA, width=2, phases=2)

    img = apply_torn_frame(img, 26, seed, ink_w=3)
    img = caption_band(img, kind.upper(), 26)
    return img


def draw_dev(kind: str, w=512, h=768) -> Image.Image:
    seed = {"fog-signal": 101, "tide-plenty": 202, "harbor-charter": 303}[kind]
    img = parchment_base(w, h, seed)
    color = DEV[kind]
    cx, cy = w // 2, int(h * 0.38)
    img = wash_radial(img, cx, cy, 160, color, strength=75)
    d = ImageDraw.Draw(img)

    if kind == "fog-signal":
        # fog banks
        fog = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        fd = ImageDraw.Draw(fog)
        for i in range(6):
            fd.ellipse((30 + i * 20, cy - 40 + i * 25, w - 30 - i * 15, cy + 80 + i * 20), fill=(232, 242, 240, 35 + i * 5))
        img = Image.alpha_composite(img.convert("RGBA"), fog.filter(ImageFilter.GaussianBlur(6))).convert("RGB")
        d = ImageDraw.Draw(img)
        wave_band(d, cy + 120, w, amp=12, color=SEA, width=3, phases=3)
        lamp = tone_render(RENDERS / "fog-lamp.png", 280, tint=SEA)
        if lamp:
            img = paste_render(img, lamp, cx, cy - 20)
            d = ImageDraw.Draw(img)
        else:
            d.ellipse((cx - 50, cy + 40, cx + 50, cy + 100), outline=INK, fill=COPPER)
        # signal rays
        for ang in (-35, -10, 15, 40):
            import math
            rad = math.radians(ang)
            d.line((cx, cy - 80, cx + math.sin(rad) * 140, cy - 80 - math.cos(rad) * 100), fill=FOAM, width=2)
        # corner wax mark (copper, not floating Zhu seal)
        seal_stamp(d, w - 90, h - 200, 28, COPPER)
    elif kind == "tide-plenty":
        # stacked tide arcs + moon
        for i in range(7):
            yy = cy - 60 + i * 28
            d.arc((80, yy, w - 80, yy + 70), 200, 340, fill=SEA if i % 2 == 0 else SEA_NEAR, width=3)
        d.ellipse((cx - 28, cy - 140, cx + 28, cy - 84), outline=INK, fill=FOAM)
        d.ellipse((cx - 10, cy - 130, cx + 18, cy - 100), fill=PAPER_DEEP)  # crescent bite
        # fish silhouette school
        for i, dx in enumerate((-90, -40, 20, 70)):
            y = cy + 40 + (i % 2) * 20
            d.polygon([(cx + dx, y), (cx + dx + 28, y - 8), (cx + dx + 28, y + 8)], fill=SEA, outline=INK)
            d.line((cx + dx + 28, y, cx + dx + 40, y - 6), fill=INK, width=1)
        dock = tone_render(RENDERS / "dock.png", 160, tint=COPPER)
        if dock:
            img = paste_render(img, dock, cx, cy + 160, opacity=0.88)
            d = ImageDraw.Draw(img)
    elif kind == "harbor-charter":
        wave_band(d, cy + 130, w, amp=10, color=SEA, width=3, phases=2)
        # pier planks
        for i in range(5):
            y = cy + 90 + i * 14
            d.rectangle((cx - 100, y, cx + 100, y + 10), outline=INK, fill=COPPER if i % 2 == 0 else PAPER_DEEP)
        for x in range(cx - 80, cx + 81, 40):
            d.rectangle((x - 5, cy + 150, x + 5, cy + 210), outline=INK, fill=PAPER_DEEP)
        sett = tone_render(RENDERS / "settlement.png", 200, tint=(196, 92, 74))
        city = tone_render(RENDERS / "city.png", 180, tint=(210, 162, 58))
        if sett:
            img = paste_render(img, sett, cx - 70, cy - 30)
        if city:
            img = paste_render(img, city, cx + 60, cy - 50)
        d = ImageDraw.Draw(img)
        seal_stamp(d, cx, cy + 40, 55, ZHU)
        d.text((cx - 18, cy + 34), "HC", fill=ZHU)

    titles = {
        "fog-signal": "FOG SIGNAL",
        "tide-plenty": "TIDE PLENTY",
        "harbor-charter": "HARBOR CHARTER",
    }
    img = apply_torn_frame(img, 34, seed, ink_w=4)
    img = caption_band(img, titles[kind], 34)
    return img


manifest = []
for kind in TERRAIN:
    img = draw_resource(kind)
    rel = f"assets/illustrations/cards/resource-{kind}.webp"
    sz = save_webp(img, ROOT / rel, 40)
    img.save(EV / f"resource-{kind}.png")
    print(f"resource-{kind}: {sz} B")
    manifest.append(("illustration/resource-" + kind, rel, sz))

for kind in DEV:
    img = draw_dev(kind)
    rel = f"assets/illustrations/cards/dev-{kind}.webp"
    sz = save_webp(img, ROOT / rel, 60)
    img.save(EV / f"dev-{kind}.png")
    print(f"dev-{kind}: {sz} B")
    manifest.append(("illustration/dev-" + kind, rel, sz))

Path(EV / "card-sizes.txt").write_text("\n".join(f"{a} {c}" for a, _, c in manifest) + "\n")
print("done", len(manifest))
