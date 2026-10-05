#!/usr/bin/env python3
"""G3D-24: procedural parchment card illustrations (spirit-only; no settlecoast trace)."""
from __future__ import annotations
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/illustrations/cards"
EV = Path("/workspace/g3d-evidence/G3D-24")
OUT.mkdir(parents=True, exist_ok=True)
EV.mkdir(parents=True, exist_ok=True)

PAPER = (232, 214, 184)
PAPER_DEEP = (201, 176, 138)
INK = (42, 36, 28)
ZHU = (163, 59, 43)
COPPER = (138, 106, 61)

TERRAIN = {
    "wood": (47, 93, 58),
    "brick": (179, 90, 60),
    "sheep": (143, 168, 106),
    "wheat": (212, 165, 74),
    "ore": (107, 110, 120),
}

DEV = {
    "fog-signal": (27, 79, 107),
    "tide-plenty": (62, 140, 154),
    "harbor-charter": (138, 106, 61),
}


def paper_noise(w: int, h: int, seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGB", (w, h), PAPER)
    px = img.load()
    for y in range(h):
        for x in range(w):
            n = rng.randint(-12, 12)
            r = max(0, min(255, PAPER[0] + n + ((x * 3 + y) % 7) - 3))
            g = max(0, min(255, PAPER[1] + n + ((x + y * 2) % 5) - 2))
            b = max(0, min(255, PAPER[2] + n))
            # vignette toward paper deep
            dx, dy = x / w - 0.5, y / h - 0.5
            v = (dx * dx + dy * dy) * 0.55
            r = int(r * (1 - v) + PAPER_DEEP[0] * v)
            g = int(g * (1 - v) + PAPER_DEEP[1] * v)
            b = int(b * (1 - v) + PAPER_DEEP[2] * v)
            px[x, y] = (r, g, b)
    return img.filter(ImageFilter.GaussianBlur(0.4))


def torn_rect(draw: ImageDraw.ImageDraw, box, fill=None, outline=INK, width=3):
    x0, y0, x1, y1 = box
    pts = []
    # top
    x = x0
    while x < x1:
        pts.append((x, y0 + (1 if (x // 7) % 2 == 0 else -1)))
        x += 6
    pts.append((x1, y0))
    y = y0
    while y < y1:
        pts.append((x1 + (1 if (y // 9) % 2 == 0 else -1), y))
        y += 6
    pts.append((x1, y1))
    x = x1
    while x > x0:
        pts.append((x, y1 + (1 if (x // 8) % 2 == 0 else -1)))
        x -= 6
    pts.append((x0, y1))
    y = y1
    while y > y0:
        pts.append((x0 + (1 if (y // 10) % 2 == 0 else -1), y))
        y -= 6
    if fill:
        draw.polygon(pts, fill=fill, outline=outline)
    else:
        draw.line(pts + [pts[0]], fill=outline, width=width)


def draw_resource(kind: str, w=384, h=512) -> Image.Image:
    img = paper_noise(w, h, seed=hash(kind) % 10_000)
    d = ImageDraw.Draw(img)
    margin = 28
    torn_rect(d, (margin, margin, w - margin, h - margin), outline=INK, width=3)
    # inner wash
    color = TERRAIN[kind]
    wash = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    cx, cy = w // 2, int(h * 0.42)
    for r in range(110, 20, -8):
        a = 40 + (110 - r)
        wd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*color, a))
    img = Image.alpha_composite(img.convert("RGBA"), wash).convert("RGB")
    d = ImageDraw.Draw(img)

    # motif
    if kind == "wood":
        for i, dx in enumerate((-40, 0, 40)):
            d.polygon(
                [(cx + dx, cy - 70), (cx + dx - 22, cy + 50), (cx + dx + 22, cy + 50)],
                outline=INK,
                fill=(*color, ),
            )
            d.rectangle((cx + dx - 6, cy + 50, cx + dx + 6, cy + 85), outline=INK, fill=COPPER)
    elif kind == "brick":
        for row, y in enumerate(range(cy - 50, cy + 70, 28)):
            ox = 14 if row % 2 else 0
            for x in range(cx - 70 + ox, cx + 70, 36):
                d.rectangle((x, y, x + 30, y + 22), outline=INK, fill=color)
    elif kind == "sheep":
        d.ellipse((cx - 55, cy - 35, cx + 55, cy + 45), outline=INK, fill=(230, 230, 220))
        d.ellipse((cx + 20, cy - 55, cx + 70, cy - 5), outline=INK, fill=(230, 230, 220))
        d.ellipse((cx - 25, cy + 35, cx - 5, cy + 55), fill=INK)
        d.ellipse((cx + 5, cy + 35, cx + 25, cy + 55), fill=INK)
        # bush
        d.ellipse((cx - 100, cy + 40, cx - 40, cy + 90), outline=INK, fill=color)
    elif kind == "wheat":
        for dx in (-50, -25, 0, 25, 50):
            d.line((cx + dx, cy + 80, cx + dx, cy - 60), fill=color, width=3)
            d.ellipse((cx + dx - 10, cy - 75, cx + dx + 10, cy - 45), outline=INK, fill=color)
        d.polygon([(cx + 70, cy - 20), (cx + 110, cy + 40), (cx + 85, cy + 40)], outline=INK, fill=COPPER)
    elif kind == "ore":
        pts = [(cx, cy - 70), (cx + 70, cy - 10), (cx + 40, cy + 70), (cx - 50, cy + 60), (cx - 75, cy - 20)]
        d.polygon(pts, outline=INK, fill=color)
        d.line((cx - 20, cy - 10, cx + 30, cy + 20), fill=INK, width=2)

    # caption band
    d.rectangle((margin + 16, h - 110, w - margin - 16, h - margin - 16), outline=INK, fill=PAPER_DEEP)
    label = {
        "wood": "松林",
        "brick": "赭土",
        "sheep": "盐草",
        "wheat": "麦垄",
        "ore": "礁岩",
    }[kind]
    # simple pixel-ish label via bars (avoid font dependency for CJK)
    d.text((margin + 28, h - 88), label, fill=INK)
    d.text((margin + 28, h - 64), kind.upper(), fill=ZHU)
    return img


def draw_dev(kind: str, w=512, h=768) -> Image.Image:
    img = paper_noise(w, h, seed=hash(kind) % 10_000 + 99)
    d = ImageDraw.Draw(img)
    margin = 36
    torn_rect(d, (margin, margin, w - margin, h - margin), outline=INK, width=4)
    color = DEV[kind]
    wash = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    cx, cy = w // 2, int(h * 0.4)
    for r in range(140, 30, -10):
        wd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*color, 35 + (140 - r) // 2))
    img = Image.alpha_composite(img.convert("RGBA"), wash).convert("RGB")
    d = ImageDraw.Draw(img)

    if kind == "fog-signal":
        # floating fog lamp buoy (not humanoid)
        d.ellipse((cx - 50, cy + 40, cx + 50, cy + 100), outline=INK, fill=COPPER)
        d.rectangle((cx - 12, cy - 40, cx + 12, cy + 50), outline=INK, fill=PAPER_DEEP)
        d.ellipse((cx - 28, cy - 90, cx + 28, cy - 30), outline=INK, fill=(232, 242, 240))
        d.ellipse((cx - 10, cy - 72, cx + 10, cy - 52), fill=ZHU)
        # fog wisps
        for i in range(5):
            d.arc((cx - 100 + i * 10, cy - 20 + i * 8, cx + 100 - i * 10, cy + 80 + i * 5), 200, 340, fill=INK, width=2)
    elif kind == "tide-plenty":
        for i, dy in enumerate((-40, 0, 40)):
            d.arc((cx - 120, cy + dy - 30, cx + 120, cy + dy + 30), 200, 340, fill=color, width=4)
        d.ellipse((cx - 20, cy - 100, cx + 20, cy - 60), outline=INK, fill=(232, 242, 240))
    elif kind == "harbor-charter":
        # seal + pier
        d.ellipse((cx - 70, cy - 70, cx + 70, cy + 70), outline=ZHU, width=4)
        d.ellipse((cx - 50, cy - 50, cx + 50, cy + 50), outline=COPPER, width=3)
        d.rectangle((cx - 90, cy + 90, cx + 90, cy + 115), outline=INK, fill=COPPER)
        for x in range(cx - 80, cx + 81, 40):
            d.rectangle((x - 6, cy + 115, x + 6, cy + 160), outline=INK, fill=PAPER_DEEP)

    d.rectangle((margin + 20, h - 140, w - margin - 20, h - margin - 20), outline=INK, fill=PAPER_DEEP)
    titles = {
        "fog-signal": ("雾灯令", "FOG SIGNAL"),
        "tide-plenty": ("潮运", "TIDE PLENTY"),
        "harbor-charter": ("商港特许", "HARBOR CHARTER"),
    }
    zh, en = titles[kind]
    d.text((margin + 36, h - 115), zh, fill=INK)
    d.text((margin + 36, h - 88), en, fill=ZHU)
    return img


def save_webp(img: Image.Image, path: Path, limit_kb: int) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    q = 82
    while q >= 40:
        img.save(path, "WEBP", quality=q, method=6)
        sz = path.stat().st_size
        if sz <= limit_kb * 1024:
            return sz
        q -= 6
    # last resort scale slightly
    img2 = img.resize((int(img.width * 0.92), int(img.height * 0.92)), Image.Resampling.LANCZOS)
    img2.save(path, "WEBP", quality=55, method=6)
    return path.stat().st_size


manifest = []
for kind in TERRAIN:
    img = draw_resource(kind)
    rel = f"assets/illustrations/cards/resource-{kind}.webp"
    sz = save_webp(img, ROOT / rel, 40)
    img.save(EV / f"resource-{kind}.png")
    print(f"resource-{kind}: {sz} B")
    manifest.append(("illustration/resource-" + kind, rel, sz, f"资源卡·{kind}"))

for kind in DEV:
    img = draw_dev(kind)
    rel = f"assets/illustrations/cards/dev-{kind}.webp"
    sz = save_webp(img, ROOT / rel, 60)
    img.save(EV / f"dev-{kind}.png")
    print(f"dev-{kind}: {sz} B")
    manifest.append(("illustration/dev-" + kind, rel, sz, f"发展卡·{kind}"))

Path(EV / "sizes.txt").write_text("\n".join(f"{a} {c}" for a, _, c, _ in manifest) + "\n")
print("done", len(manifest))
