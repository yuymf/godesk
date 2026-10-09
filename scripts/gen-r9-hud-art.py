#!/usr/bin/env python3
"""R9: horizontal wood-brick build tiles (settlecoast-style bottom row)."""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path("assets/ui/ai/icons")
OUT.mkdir(parents=True, exist_ok=True)

# Horizontal plaque ~ settlecoast build row proportions
W, H = 320, 110

COSTS = {
    "road": [("wood", (62, 110, 58)), ("brick", (168, 78, 52))],
    "settlement": [
        ("wood", (62, 110, 58)),
        ("brick", (168, 78, 52)),
        ("sheep", (230, 230, 220)),
        ("wheat", (210, 170, 55)),
    ],
    "city": [
        ("wheat", (210, 170, 55)),
        ("wheat", (210, 170, 55)),
        ("ore", (110, 118, 130)),
        ("ore", (110, 118, 130)),
        ("ore", (110, 118, 130)),
    ],
    "card": [
        ("sheep", (230, 230, 220)),
        ("wheat", (210, 170, 55)),
        ("ore", (110, 118, 130)),
    ],
}
LABELS = {
    "road": "栈道",
    "settlement": "渔村",
    "city": "海镇",
    "card": "买卡",
}
# Simple relief glyphs (not settlecoast copies)
ICONS = {
    "road": "road",
    "settlement": "house",
    "city": "keep",
    "card": "card",
}


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


def wood_plank(w: int, h: int) -> Image.Image:
    im = Image.new("RGB", (w, h), (58, 36, 20))
    px = im.load()
    import random
    rng = random.Random(42 + w + h)
    for y in range(h):
        for x in range(w):
            # horizontal grain
            n = (rng.randint(-8, 8) + int(6 * ((x * 0.07 + y * 0.02) % 3))) 
            r = max(20, min(120, 62 + n + (8 if (y // 3) % 7 == 0 else 0)))
            g = max(12, min(90, 38 + n // 2))
            b = max(8, min(60, 22 + n // 3))
            px[x, y] = (r, g, b)
    # bevel overlay
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle([0, 0, w - 1, h - 1], outline=(201, 162, 39, 210), width=3)
    d.rectangle([3, 3, w - 4, h - 4], outline=(26, 14, 8, 160), width=2)
    # inner recess
    d.rectangle([8, 8, w - 9, h - 9], outline=(180, 140, 60, 80), width=1)
    # top highlight
    for i in range(6):
        d.line([(10, 10 + i), (w - 11, 10 + i)], fill=(255, 230, 170, 28 - i * 4))
    return im


def draw_icon(d: ImageDraw.ImageDraw, kind: str, cx: int, cy: int):
    gold = (243, 220, 150)
    dark = (30, 18, 10)
    if kind == "road":
        d.polygon([(cx - 28, cy + 8), (cx - 10, cy - 10), (cx + 28, cy - 4), (cx + 12, cy + 14)], fill=gold, outline=dark)
        d.line([(cx - 18, cy + 2), (cx + 16, cy + 6)], fill=dark, width=2)
    elif kind == "house":
        d.rectangle([cx - 16, cy - 2, cx + 16, cy + 16], fill=gold, outline=dark)
        d.polygon([(cx - 20, cy - 2), (cx, cy - 18), (cx + 20, cy - 2)], fill=(210, 160, 80), outline=dark)
        d.rectangle([cx - 4, cy + 4, cx + 4, cy + 16], fill=dark)
    elif kind == "keep":
        d.rectangle([cx - 18, cy - 4, cx + 18, cy + 18], fill=gold, outline=dark)
        for dx in (-12, 0, 12):
            d.rectangle([cx + dx - 4, cy - 14, cx + dx + 4, cy - 4], fill=gold, outline=dark)
        d.rectangle([cx - 5, cy + 4, cx + 5, cy + 18], fill=dark)
    else:  # card
        d.rounded_rectangle([cx - 14, cy - 18, cx + 14, cy + 18], radius=3, fill=gold, outline=dark, width=2)
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], outline=dark, width=2)


def make_tile(key: str) -> Image.Image:
    im = wood_plank(W, H)
    d = ImageDraw.Draw(im, "RGBA")
    # recessed well
    d.rounded_rectangle([12, 12, W - 13, H - 13], radius=8, fill=(32, 20, 12, 110))
    # label top-left
    f_label = font(26)
    label = LABELS[key]
    d.text((22, 14), label, font=f_label, fill=(243, 231, 201))
    # soft emboss shadow under text
    # icon right-center
    draw_icon(d, ICONS[key], W - 70, H // 2 - 4)
    # cost chips bottom-left row
    chips = COSTS[key]
    x0, y0 = 22, H - 34
    for i, (_, col) in enumerate(chips):
        x = x0 + i * 28
        d.ellipse([x, y0, x + 22, y0 + 22], fill=col, outline=(26, 14, 8), width=2)
        # tiny highlight
        d.ellipse([x + 4, y0 + 3, x + 10, y0 + 9], fill=(255, 255, 255, 70))
    # gold lip corners
    for (x, y) in [(6, 6), (W - 18, 6), (6, H - 18), (W - 18, H - 18)]:
        d.rectangle([x, y, x + 10, y + 10], outline=(232, 200, 90, 180), width=1)
    return im.filter(ImageFilter.SMOOTH_MORE)


def save_variants(key: str, im: Image.Image):
    # primary wide asset used by HUD
    wide = OUT / f"build-{key}-wide.webp"
    im.save(wide, "WEBP", quality=88, method=6)
    # also refresh 128 portrait slot with letterboxed wide (compat) — prefer overwriting
    # with a landscape that CSS will stretch horizontally
    for size_name, box in (("128", (160, 200)), ("96", (120, 150)), ("64", (80, 100))):
        # Keep legacy square-ish files as cropped center of wide for any old CSS
        canvas = Image.new("RGB", box, (42, 26, 14))
        # fit width
        scaled = im.resize((box[0], int(im.height * box[0] / im.width)), Image.Resampling.LANCZOS)
        if scaled.height > box[1]:
            top = (scaled.height - box[1]) // 2
            scaled = scaled.crop((0, top, scaled.width, top + box[1]))
        y = (box[1] - scaled.height) // 2
        canvas.paste(scaled, (0, max(0, y)))
        canvas.save(OUT / f"build-{key}-{size_name}.webp", "WEBP", quality=86, method=6)
    print("wrote", wide, im.size)


def main():
    for key in ("road", "settlement", "city", "card"):
        save_variants(key, make_tile(key))
    print("done")


if __name__ == "__main__":
    main()
