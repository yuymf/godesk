#!/usr/bin/env python3
"""R11: landscape parchment resource hand plaques (composite existing AI icons).

LicenseRef-GoDesk-Original composites — source icons already registered under
assets/ui/ai/icons/*-128.webp (AI-generated). No new AI generation.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path("assets/ui/ai/icons")
PARCH = Path("assets/ui/ai/parchment-grain.webp")
W, H = 168, 120
LABELS = {"wood": "木", "brick": "砖", "sheep": "羊", "wheat": "麦", "ore": "矿"}
GOLD = (201, 162, 39)
GOLD_BRIGHT = (232, 200, 90)
GOLD_DEEP = (138, 106, 20)
INK = (42, 28, 18)
CREAM = (243, 231, 201)


def font(size: int):
    for path in (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ):
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def parchment_base() -> Image.Image:
    if PARCH.exists():
        base = Image.open(PARCH).convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
        wash = Image.new("RGB", (W, H), CREAM)
        return Image.blend(base, wash, 0.55)
    return Image.new("RGB", (W, H), CREAM)


def make_card(key: str) -> Image.Image:
    im = parchment_base()
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle([1, 1, W - 2, H - 2], outline=GOLD + (230,), width=3)
    d.rectangle([4, 4, W - 5, H - 5], outline=GOLD_DEEP + (180,), width=1)
    d.rectangle([5, 5, W - 6, H - 6], outline=GOLD_BRIGHT + (120,), width=1)
    for x0, y0, dx, dy in [
        (7, 7, 1, 1),
        (W - 8, 7, -1, 1),
        (7, H - 8, 1, -1),
        (W - 8, H - 8, -1, -1),
    ]:
        d.line([(x0, y0), (x0 + dx * 14, y0)], fill=GOLD_BRIGHT + (220,), width=2)
        d.line([(x0, y0), (x0, y0 + dy * 14)], fill=GOLD_BRIGHT + (220,), width=2)
    f = font(18)
    label = LABELS[key]
    bbox = d.textbbox((0, 0), label, font=f)
    tw = bbox[2] - bbox[0]
    d.text(((W - tw) // 2, 8), label, font=f, fill=INK)
    icon = Image.open(OUT / f"{key}-128.webp").convert("RGBA")
    target = 78
    icon = icon.resize((target, target), Image.Resampling.LANCZOS)
    im.paste(icon, ((W - target) // 2, 26), icon)
    d.ellipse([W // 2 - 18, H - 28, W // 2 + 18, H - 4], fill=(243, 231, 201, 40))
    return im.filter(ImageFilter.SMOOTH)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key in LABELS:
        im = make_card(key)
        path = OUT / f"resource-{key}-hand.webp"
        im.save(path, "WEBP", quality=88, method=6)
        print("wrote", path, im.size)


if __name__ == "__main__":
    main()
