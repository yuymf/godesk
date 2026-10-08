#!/usr/bin/env python3
"""R20/R21 · painterly re-bake of 虹夏's 8 AI textures (sources unchanged: assets/ai-textures/r19/*.webp).

R19 baked the AI sources straight to KTX2, so close-ups read as photo-detailed ground under the
oil-dab shader. R20 first pushes every source into the same low-frequency painterly language as
the dabs, then bakes exactly like R19 (same toktx ETC1S flags, same output paths):

  0. moss recolour — forest-floor only: russet leaf litter → mossy needle-floor greens (HSV hue
                     remap into 0.20–0.34, sat ×0.55, value ×0.85) so sparse R20 forests never read as
                     brown ground (low tier included)
  0b. light rock   — R21, scree (ore hex) only: grey-brown → light grey rock (desaturate 80%, cool
                     tint, gamma 0.62 lift) before colour-blocking
  1. colour-block  — median-cut palette quantise (no dither) to K flat colours (posterise)
  2. kuwahara      — large-radius soft Kuwahara (r=9 @512, inverse-variance quadrant weights,
                     wrap-padded so tiles stay seamless), then a second r=5 pass
  3. palette pull  — 35% back toward the block palette so flat colour planes survive the filter

  terrain (6) → assets/textures/pbr/t0{1..6}-*/{512,256}/baseColor.ktx2
  cliff-rock  → assets/textures/ai-r19/cliff-rock-512x256.webp (horizontal wrap only)
  harbor-sign → assets/textures/ai-r19/harbor-sign-256.webp (RGB processed, alpha kept; R21: the
                outer ~34 px wooden rim is restored from the source at 0.8× value + a dark 5 px
                outline, so the sign keeps its dark frame after Kuwahara)

Usage: TOKTX=/home/box/.local/ktx/usr/bin/toktx python3 scripts/bake-ai-r20.py [--preview DIR]
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TOKTX = os.environ.get("TOKTX", "toktx")
SRC = ROOT / "assets/ai-textures/r19"
PREVIEW = Path(sys.argv[sys.argv.index("--preview") + 1]) if "--preview" in sys.argv else None
TERRAIN = {
    "forest-floor": "t01-pine",
    "clay": "t02-clay",
    "grass": "t03-meadow",
    "wheat-field": "t04-wheat",
    "scree": "t05-reef",
    "sand": "t06-sand",
}
# palette size per texture (fewer colours = bigger flat blocks)
LEVELS = {"forest-floor": 10, "clay": 9, "grass": 10, "wheat-field": 9, "scree": 9, "sand": 8, "cliff-rock": 10, "harbor-sign": 12}
RADII = (9, 5)
PALETTE_PULL = 0.35


def moss_recolour(rgb: np.ndarray) -> np.ndarray:
    im = Image.fromarray(rgb.astype(np.uint8), "RGB").convert("HSV")
    hsv = np.asarray(im, dtype=np.float64) / 255.0
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    # keep the litter's hue variation as a narrow green band (warm leaves → yellow-green, cool → blue-green)
    h2 = 0.2 + 0.1 * ((h + 0.08) % 1.0) / 0.25
    h2 = np.clip(h2, 0.2, 0.34)
    out = np.dstack([h2, np.clip(s * 0.55, 0, 1), np.clip(v * 0.85, 0, 1)]) * 255.0
    return np.asarray(Image.fromarray(out.astype(np.uint8), "HSV").convert("RGB"), dtype=np.float64)


def light_rock(rgb: np.ndarray) -> np.ndarray:
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    grey = rgb * 0.2 + lum[..., None] * 0.8
    grey = grey * np.array([0.97, 1.0, 1.04])
    return np.clip(255.0 * np.power(np.clip(grey, 0, 255) / 255.0, 0.62), 0, 255)


def edge_distance(alpha: np.ndarray, max_d: int) -> np.ndarray:
    """Chessboard-ish distance (px) from the transparent edge, capped at max_d (iterative erosion)."""
    mask = alpha > 127
    dist = np.where(mask, max_d, 0).astype(np.float64)
    cur = mask.copy()
    for d in range(max_d):
        er = cur.copy()
        er[1:, :] &= cur[:-1, :]
        er[:-1, :] &= cur[1:, :]
        er[:, 1:] &= cur[:, :-1]
        er[:, :-1] &= cur[:, 1:]
        dist[cur & ~er] = d
        cur = er
    return dist


def restore_rim(painted: np.ndarray, source_rgba: np.ndarray, rim: int = 34) -> np.ndarray:
    d = edge_distance(source_rgba[..., 3], rim + 2)
    src = source_rgba[..., :3]
    t = np.clip((d - (rim - 6)) / 6.0, 0, 1)[..., None]  # 0 = rim (source), 1 = painted interior
    out = (src * 0.8) * (1 - t) + painted * t
    outline = np.clip(1 - d / 5.0, 0, 1)[..., None] * (source_rgba[..., 3:4] > 127)
    out = out * (1 - 0.45 * outline)
    return np.clip(out, 0, 255).astype(np.uint8)


def colour_block(rgb: np.ndarray, k: int) -> np.ndarray:
    im = Image.fromarray(rgb.astype(np.uint8), "RGB")
    q = im.quantize(colors=k, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return np.asarray(q.convert("RGB"), dtype=np.float64)


def _box_sum(sat: np.ndarray, y0, y1, x0, x1):
    return sat[y1, x1] - sat[y0, x1] - sat[y1, x0] + sat[y0, x0]


def kuwahara(rgb: np.ndarray, r: int, wrap_y: bool = True) -> np.ndarray:
    """Classic 4-quadrant Kuwahara via summed-area tables; wrap padding keeps the tile seamless."""
    h, w, _ = rgb.shape
    mode_y = "wrap" if wrap_y else "reflect"
    pad = np.pad(rgb, ((r, r), (0, 0), (0, 0)), mode=mode_y)
    pad = np.pad(pad, ((0, 0), (r, r), (0, 0)), mode="wrap")
    lum = pad @ np.array([0.2126, 0.7152, 0.0722])
    def sat(a):
        s = np.zeros((a.shape[0] + 1, a.shape[1] + 1) + a.shape[2:], dtype=np.float64)
        s[1:, 1:] = a.cumsum(0).cumsum(1)
        return s
    s_rgb, s_l, s_l2 = sat(pad), sat(lum), sat(lum * lum)
    yy, xx = np.mgrid[0:h, 0:w]
    yy = yy + r
    xx = xx + r
    n = (r + 1) * (r + 1)
    acc = np.zeros((h, w, 3))
    wsum = np.zeros((h, w))
    for dy0, dx0 in ((-r, -r), (-r, 0), (0, -r), (0, 0)):
        y0, x0 = yy + dy0, xx + dx0
        y1, x1 = y0 + r + 1, x0 + r + 1
        m = _box_sum(s_l, y0, y1, x0, x1) / n
        var = _box_sum(s_l2, y0, y1, x0, x1) / n - m * m
        mean = np.stack([_box_sum(s_rgb[..., c], y0, y1, x0, x1) for c in range(3)], -1) / n
        # soft Kuwahara: inverse-variance weighting (q=3) instead of a hard min → rounder strokes,
        # no square block seams
        wgt = 1.0 / np.power(np.maximum(var, 0) + 16.0, 3)
        acc += mean * wgt[..., None]
        wsum += wgt
    return acc / wsum[..., None]


def painterly(rgb: np.ndarray, k: int, wrap_y: bool = True) -> np.ndarray:
    scale = rgb.shape[1] / 512
    blocks = colour_block(rgb, k)
    out = blocks
    for r in RADII:
        out = kuwahara(out, max(2, round(r * scale)), wrap_y)
    # keep flat colour planes: pull toward the nearest block colour of the filtered result
    snapped = colour_block(out, k + 4)
    out = out * (1 - PALETTE_PULL) + snapped * PALETTE_PULL
    return np.clip(out, 0, 255).astype(np.uint8)


def toktx_etc1s(src: Path, dst: Path, qlevel: int = 128) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [TOKTX, "--t2", "--encode", "etc1s", "--clevel", "2", "--qlevel", str(qlevel), str(dst), str(src)],
        check=True,
    )


def wrap_resize(im: Image.Image, size: int) -> Image.Image:
    w, h = im.size
    pad = Image.new(im.mode, (w * 3, h * 3))
    for i in range(3):
        for j in range(3):
            pad.paste(im, (i * w, j * h))
    s = size / w
    big = pad.resize((round(w * 3 * s), round(h * 3 * s)), Image.LANCZOS)
    return big.crop((size, size, size * 2, size * 2))


def main() -> None:
    if PREVIEW:
        PREVIEW.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name, set_id in TERRAIN.items():
            src = np.asarray(Image.open(SRC / f"{name}.webp").convert("RGB"), dtype=np.float64)
            assert src.shape[:2] == (512, 512), (name, src.shape)
            if name == "forest-floor":
                src = moss_recolour(src)
            if name == "scree":
                src = light_rock(src)
            im = Image.fromarray(painterly(src, LEVELS[name]), "RGB")
            if PREVIEW:
                im.save(PREVIEW / f"{name}.png")
                continue
            for size in (512, 256):
                png = Path(tmp) / f"{name}-{size}.png"
                (im if size == 512 else wrap_resize(im, size)).save(png)
                toktx_etc1s(png, ROOT / f"assets/textures/pbr/{set_id}/{size}/baseColor.ktx2")
    out = ROOT / "assets/textures/ai-r19"
    cliff = np.asarray(Image.open(SRC / "cliff-rock.webp").convert("RGB"), dtype=np.float64)
    cliff_im = Image.fromarray(painterly(cliff, LEVELS["cliff-rock"], wrap_y=False), "RGB")
    sign = Image.open(SRC / "harbor-sign.webp").convert("RGBA")
    sign_arr = np.asarray(sign, dtype=np.float64)
    sign_rgb = restore_rim(painterly(sign_arr[..., :3], LEVELS["harbor-sign"], wrap_y=False).astype(np.float64), sign_arr)
    sign_im = Image.fromarray(np.dstack([sign_rgb, sign_arr[..., 3].astype(np.uint8)]), "RGBA")
    if PREVIEW:
        cliff_im.save(PREVIEW / "cliff-rock.png")
        sign_im.save(PREVIEW / "harbor-sign.png")
        return
    cliff_im.resize((512, 256), Image.LANCZOS).save(out / "cliff-rock-512x256.webp", quality=82, method=6)
    sign_im.resize((256, 256), Image.LANCZOS).save(out / "harbor-sign-256.webp", quality=85, method=6)
    for p in sorted(out.iterdir()):
        print(p.relative_to(ROOT), p.stat().st_size)


if __name__ == "__main__":
    main()
