"""Shared Tidewell parchment illustration helpers (G3D-ART). Self-authored + CC0 Paper001."""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
PAPER_CC0 = Path(__file__).resolve().parents[1] / "data" / "paper001-color-512.jpg"
RENDERS = Path("/tmp/g3d-art-renders")

PAPER = (232, 214, 184)
PAPER_DEEP = (201, 176, 138)
INK = (42, 36, 28)
ZHU = (163, 59, 43)
COPPER = (138, 106, 61)
SEA = (27, 79, 107)
SEA_NEAR = (62, 140, 154)
FOAM = (232, 242, 240)
WOOD = (47, 93, 58)
BRICK = (179, 90, 60)
SHEEP = (143, 168, 106)
WHEAT = (212, 165, 74)
ORE = (107, 110, 120)


def clamp(v: int) -> int:
    return max(0, min(255, v))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def parchment_base(w: int, h: int, seed: int) -> Image.Image:
    """Layered paper: CC0 Paper001 tone-mapped + fiber noise + stains + vignette."""
    rng = random.Random(seed)
    base = Image.new("RGB", (w, h), PAPER)
    if PAPER_CC0.exists():
        tex = Image.open(PAPER_CC0).convert("RGB")
        # tile / crop with seed offset
        ox, oy = rng.randint(0, 200), rng.randint(0, 200)
        tiled = Image.new("RGB", (w + 512, h + 512))
        for ty in range(0, h + 512, 512):
            for tx in range(0, w + 512, 512):
                tiled.paste(tex, (tx, ty))
        crop = tiled.crop((ox, oy, ox + w, oy + h))
        # map photo paper toward Tidewell palette
        crop = ImageEnhance.Color(crop).enhance(0.35)
        crop = ImageEnhance.Contrast(crop).enhance(0.85)
        crop = ImageEnhance.Brightness(crop).enhance(1.08)
        base = Image.blend(base, crop, 0.55)

    px = base.load()
    for y in range(h):
        for x in range(w):
            n = rng.randint(-9, 9)
            # fine fiber streaks
            fiber = int(4 * math.sin((x + seed) * 0.37 + y * 0.02) + 3 * math.sin(y * 0.51))
            r, g, b = px[x, y]
            r = clamp(r + n + fiber)
            g = clamp(g + n + fiber // 2)
            b = clamp(b + n - 1)
            dx, dy = x / w - 0.5, y / h - 0.5
            v = min(1.0, (dx * dx + dy * dy) * 1.35)
            r = int(lerp(r, PAPER_DEEP[0] - 12, v * 0.7))
            g = int(lerp(g, PAPER_DEEP[1] - 10, v * 0.7))
            b = int(lerp(b, PAPER_DEEP[2] - 8, v * 0.7))
            px[x, y] = (r, g, b)

    # coffee / tide stains
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for _ in range(5 + seed % 4):
        cx, cy = rng.randint(0, w), rng.randint(0, h)
        rr = rng.randint(30, 90)
        col = (*PAPER_DEEP, rng.randint(18, 40))
        od.ellipse((cx - rr, cy - rr // 2, cx + rr, cy + rr // 2), fill=col)
    base = Image.alpha_composite(base.convert("RGBA"), overlay.filter(ImageFilter.GaussianBlur(8))).convert("RGB")
    return base.filter(ImageFilter.GaussianBlur(0.25))


def torn_edge_mask(w: int, h: int, margin: int, seed: int) -> Image.Image:
    """Alpha mask with irregular torn paper edge."""
    rng = random.Random(seed)
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    pts = []
    # walk perimeter with jitter
    def walk(xs, ys):
        for x, y in zip(xs, ys):
            pts.append((x + rng.randint(-2, 2), y + rng.randint(-2, 2)))

    top = [(x, margin + (1 if (x // 5 + seed) % 3 else -1)) for x in range(margin, w - margin, 5)]
    right = [(w - margin + (1 if (y // 6) % 2 else -1), y) for y in range(margin, h - margin, 5)]
    bot = [(x, h - margin + (1 if (x // 7) % 2 else -1)) for x in range(w - margin, margin, -5)]
    left = [(margin + (1 if (y // 8) % 2 else -1), y) for y in range(h - margin, margin, -5)]
    poly = top + right + bot + left
    d.polygon(poly, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(0.6))


def apply_torn_frame(img: Image.Image, margin: int, seed: int, ink_w: int = 3) -> Image.Image:
    w, h = img.size
    mask = torn_edge_mask(w, h, margin, seed)
    paper_out = Image.new("RGB", (w, h), PAPER)
    framed = Image.composite(img, paper_out, mask)
    # soft outer shadow inside frame
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.bitmap((0, 0), ImageOps.invert(mask).point(lambda p: 40 if p > 128 else 0), fill=(*INK, 50))
    # redraw edge line from mask contour approx via margin rect jitter
    d = ImageDraw.Draw(framed)
    # sample mask edge
    edge_pts = []
    for x in range(margin - 4, w - margin + 4, 4):
        for y in range(margin - 4, h - margin + 4):
            if mask.getpixel((x, y)) > 200 and (mask.getpixel((max(0, x - 1), y)) < 100 or mask.getpixel((x, max(0, y - 1))) < 100):
                edge_pts.append((x, y))
                break
    # simpler: redraw torn polygon stroke
    rng = random.Random(seed + 3)
    pts = []
    for x in range(margin, w - margin, 6):
        pts.append((x, margin + rng.choice([-1, 0, 1, 1])))
    for y in range(margin, h - margin, 6):
        pts.append((w - margin + rng.choice([-1, 0, 1]), y))
    for x in range(w - margin, margin, -6):
        pts.append((x, h - margin + rng.choice([-1, 0, 1])))
    for y in range(h - margin, margin, -6):
        pts.append((margin + rng.choice([-1, 0, 1]), y))
    d.line(pts + [pts[0]], fill=INK, width=ink_w)
    # double line inner
    d.rectangle((margin + 10, margin + 10, w - margin - 10, h - margin - 10), outline=COPPER, width=1)
    return framed


def hatch(draw: ImageDraw.ImageDraw, box, spacing=6, angle=35, fill=INK, width=1, alpha_layer=None):
    x0, y0, x1, y1 = box
    # draw on temp if needed — caller manages
    diag = int(math.hypot(x1 - x0, y1 - y0))
    rad = math.radians(angle)
    ca, sa = math.cos(rad), math.sin(rad)
    for i in range(-diag, diag, spacing):
        # line through center offset
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        ox, oy = -sa * i, ca * i
        x_a, y_a = cx + ox - ca * diag, cy + oy - sa * diag
        x_b, y_b = cx + ox + ca * diag, cy + oy + sa * diag
        # clip roughly by checking midpoint in box
        mx, my = (x_a + x_b) / 2, (y_a + y_b) / 2
        if x0 - 20 <= mx <= x1 + 20 and y0 - 20 <= my <= y1 + 20:
            draw.line([(x_a, y_a), (x_b, y_b)], fill=fill, width=width)


def wash_radial(img: Image.Image, cx: int, cy: int, radius: int, color: tuple, strength: int = 70) -> Image.Image:
    wash = Image.new("RGBA", img.size, (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    for r in range(radius, 8, -6):
        a = max(8, int(strength * (1 - r / radius)))
        wd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*color, a))
    return Image.alpha_composite(img.convert("RGBA"), wash.filter(ImageFilter.GaussianBlur(2))).convert("RGB")


def ink_contour(draw, pts, width=2):
    draw.line(pts + [pts[0]], fill=INK, width=width)


def tone_render(path: Path, max_side: int, tint: tuple | None = None) -> Image.Image | None:
    if not path.exists():
        return None
    im = Image.open(path).convert("RGBA")
    # desaturate slightly + parchment grade
    rgb = im.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(0.75)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.15)
    rgb = ImageOps.autocontrast(rgb, cutoff=2)
    if tint:
        overlay = Image.new("RGB", rgb.size, tint)
        rgb = Image.blend(rgb, overlay, 0.18)
    im = Image.merge("RGBA", (*rgb.split(), im.split()[-1]))
    im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    return im


def paste_render(base: Image.Image, render: Image.Image, cx: int, cy: int, opacity: float = 0.92) -> Image.Image:
    base = base.convert("RGBA")
    r = render.copy()
    if opacity < 1:
        a = r.split()[-1].point(lambda p: int(p * opacity))
        r.putalpha(a)
    x = cx - r.width // 2
    y = cy - r.height // 2
    # soft shadow under render
    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.ellipse((x + 8, y + r.height - 18, x + r.width - 8, y + r.height + 12), fill=(42, 36, 28, 55))
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    base = Image.alpha_composite(base, sh)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer.paste(r, (x, y), r)
    # subtle ink outline by stroking alpha edge
    edge = r.split()[-1].filter(ImageFilter.FIND_EDGES)
    edge = ImageOps.autocontrast(edge)
    ink_e = Image.new("RGBA", r.size, (*INK, 0))
    ink_e.putalpha(edge.point(lambda p: 160 if p > 20 else 0))
    layer.paste(ink_e, (x, y), ink_e)
    return Image.alpha_composite(base, layer).convert("RGB")


def caption_band(img: Image.Image, text: str, margin: int) -> Image.Image:
    w, h = img.size
    d = ImageDraw.Draw(img)
    y0, y1 = h - margin - 78, h - margin - 18
    d.rounded_rectangle((margin + 18, y0, w - margin - 18, y1), radius=6, outline=INK, width=2, fill=PAPER_DEEP)
    d.rectangle((margin + 24, y0 + 6, w - margin - 24, y1 - 6), outline=COPPER, width=1)
    # centered-ish Latin caption
    tw = len(text) * 6
    d.text(((w - tw) // 2, (y0 + y1) // 2 - 6), text, fill=INK)
    return img


def save_webp(img: Image.Image, path: Path, limit_kb: int) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    q = 84
    cur = img
    while q >= 38:
        cur.save(path, "WEBP", quality=q, method=6)
        if path.stat().st_size <= limit_kb * 1024:
            return path.stat().st_size
        q -= 6
    cur = cur.resize((int(cur.width * 0.9), int(cur.height * 0.9)), Image.Resampling.LANCZOS)
    cur.save(path, "WEBP", quality=50, method=6)
    return path.stat().st_size


def pine_tree(draw, x, y, h, fill=WOOD):
    """Detailed pine with layered canopy + trunk bark hatch."""
    trunk_w = max(3, h // 14)
    draw.rectangle((x - trunk_w // 2, y + h * 0.55, x + trunk_w // 2, y + h), fill=COPPER, outline=INK)
    for i, (frac, spread) in enumerate(((0.15, 0.55), (0.35, 0.72), (0.55, 0.9))):
        top = y + h * (frac - 0.12)
        bot = y + h * (frac + 0.38)
        half = h * spread * 0.28
        pts = [(x, top), (x - half, bot), (x + half, bot)]
        shade = tuple(clamp(c - 12 * i) for c in fill)
        draw.polygon(pts, fill=shade, outline=INK)
        # needle ticks
        for t in range(5):
            px = x - half + (2 * half) * t / 4
            draw.line((px, bot - 2, px + (1 if t % 2 == 0 else -1) * 4, bot - 10), fill=INK, width=1)


def brick_wall(draw, cx, cy, cols=5, rows=4, bw=28, bh=16, fill=BRICK):
    for row in range(rows):
        ox = (bw // 2) if row % 2 else 0
        for col in range(cols):
            x = cx - (cols * bw) // 2 + col * bw + ox
            y = cy - (rows * bh) // 2 + row * bh
            shade = tuple(clamp(c + (8 if (col + row) % 2 else -8)) for c in fill)
            draw.rounded_rectangle((x, y, x + bw - 3, y + bh - 3), radius=2, fill=shade, outline=INK)
            # mortar speck
            draw.point((x + 4, y + 4), fill=PAPER)


def wheat_stalk(draw, x, y, h, fill=WHEAT):
    draw.line((x, y + h, x, y), fill=fill, width=2)
    for i in range(6):
        yy = y + i * (h * 0.12)
        spread = 7 - i * 0.7
        draw.arc((x - spread, yy, x + 2, yy + 10), 200, 340, fill=fill, width=2)
        draw.arc((x - 2, yy, x + spread, yy + 10), 200, 340, fill=fill, width=2)
    draw.ellipse((x - 5, y - 8, x + 5, y + 4), outline=INK, fill=fill)


def ore_crystal(draw, cx, cy, s, fill=ORE):
    pts = [
        (cx, cy - s),
        (cx + s * 0.7, cy - s * 0.2),
        (cx + s * 0.45, cy + s * 0.85),
        (cx - s * 0.35, cy + s * 0.7),
        (cx - s * 0.75, cy - s * 0.15),
    ]
    draw.polygon(pts, fill=fill, outline=INK)
    draw.line((cx - s * 0.2, cy - s * 0.4, cx + s * 0.25, cy + s * 0.3), fill=FOAM, width=2)
    draw.line((cx, cy - s * 0.7, cx + s * 0.15, cy), fill=INK, width=1)
    # cross hatch facet
    hatch(draw, (cx - s * 0.5, cy - s * 0.3, cx + s * 0.5, cy + s * 0.5), spacing=5, angle=50, fill=INK, width=1)


def wave_band(draw, y, w, amp=14, color=SEA, width=3, phases=2):
    for p in range(phases):
        pts = []
        for x in range(0, w, 3):
            yy = y + int(amp * math.sin(x / (28 + p * 7) + p) + (amp * 0.4) * math.sin(x / 11 + p * 2))
            pts.append((x, yy + p * 10))
        draw.line(pts, fill=color if p == 0 else SEA_NEAR, width=width - p)


def seal_stamp(draw, cx, cy, r, fill=ZHU):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=fill, width=3)
    draw.ellipse((cx - r + 8, cy - r + 8, cx + r - 8, cy + r - 8), outline=COPPER, width=2)
    # tide glyph
    draw.arc((cx - r // 2, cy - 4, cx + r // 2, cy + r // 2), 200, 340, fill=fill, width=2)
    draw.ellipse((cx - 4, cy - 6, cx + 4, cy + 2), fill=INK)
