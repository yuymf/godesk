#!/usr/bin/env python3
"""G3D-ART：AI 生图原始 JPEG（1280x720）→ 生产资产（LicenseRef-AI-Generated）。

原始图与提示词清单不入库：默认读 /workspace/g3d-evidence/G3D-ART/raw/（可用 AI_RAW 覆盖），
预览/平铺校验图写 /workspace/g3d-evidence/G3D-ART/work/（AI_WORK 覆盖）。

处理：
- 地形贴图：中心方块裁切 → 1024 → 逐轴 offset-by-half + 羽化混合做无缝 → 512/256 baseColor；
  法线 / ORM 由 albedo 亮度高度场推导（自有算法，非 AI 生成）→ toktx KTX2（同 G3D-22 管线与预算）。
- 卡面：中心裁切到原文件比例（资源卡 3:4，发展卡 2:3）→ 原尺寸 WebP 原位替换。
- 资源图标：S4 中按列切 5 个 → 羊皮纸底色键出 alpha → 128/64 WebP。
- HUD 面板框 / 卡框：S3 左右两块裁切 → 9-slice WebP（切片边距写入 assets/ui/ai/nine-slice.json）。
- 点数筹码面：N1 圆盘裁切（alpha）→ UI WebP；方块版 → t11-parchment 套件（筹码材质唯一使用者）。
"""
from __future__ import annotations
import json, os, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(os.environ.get("AI_RAW", "/workspace/g3d-evidence/G3D-ART/raw"))
WORK = Path(os.environ.get("AI_WORK", "/workspace/g3d-evidence/G3D-ART/work"))
TOKTX = os.environ.get("TOKTX", "toktx")
WORK.mkdir(parents=True, exist_ok=True)

# pbr 套件 id → (raw 文件, 粗糙度基值 0..1（乘材质 roughness）, 法线强度)
TEXTURES = {
    "t01-pine": ("T1-forest.jpg", 0.95, 2.2),
    "t02-clay": ("T4-hills-clay.jpg", 0.95, 1.6),
    "t03-meadow": ("T2-pasture.jpg", 0.97, 1.4),
    "t04-wheat": ("T3-fields.jpg", 0.95, 1.8),
    "t05-reef": ("T5-mountain-ore.jpg", 0.90, 2.4),
    "t06-sand": ("T6-desert.jpg", 0.98, 1.2),
    "t08-wood": ("T8-harbor-planks.jpg", 0.85, 1.8),
}
CARDS = {  # 文件名 → (raw, 目标尺寸)
    "resource-wood": ("C1-resource-wood.jpg", (384, 512)),
    "resource-brick": ("C2-resource-brick.jpg", (384, 512)),
    "resource-sheep": ("C3-resource-sheep.jpg", (384, 512)),
    "resource-wheat": ("C4-resource-wheat.jpg", (384, 512)),
    "resource-ore": ("C5-resource-ore.jpg", (384, 512)),
    "dev-fog-signal": ("C6-dev-fog-signal.jpg", (512, 768)),
}
# 调色（后处理）：码头木板原图偏青灰，会被 wood token 的暖棕底色乘成暗橄榄色 → 去饱和并提亮成浅漂流木灰，
# 让 token 底色决定木色。 (饱和度系数, 亮度增益)
GRADE = {"t08-wood": (0.25, 1.55)}
ICONS = ["wood", "brick", "sheep", "wheat", "ore"]


def center_square(im: Image.Image) -> Image.Image:
    w, h = im.size
    s = min(w, h)
    return im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))


def feather(n: int, band: float = 0.22) -> np.ndarray:
    """1 在中心、0 在两端的羽化权重（smoothstep），带宽 band*n。"""
    x = np.arange(n) + 0.5
    d = np.minimum(x, n - x) / (band * n)
    d = np.clip(d, 0, 1)
    return d * d * (3 - 2 * d)


def make_seamless(a: np.ndarray, seed: int) -> np.ndarray:
    n = a.shape[0]
    rng = np.random.default_rng(seed)
    # 低频噪声扰动羽化边界，避免直线鬼影
    noise = np.array(Image.fromarray((rng.random((16, 16)) * 255).astype(np.uint8)).resize((n, n), Image.Resampling.BICUBIC), dtype=np.float32) / 255.0
    wx = feather(n)[None, :]
    w = np.clip(wx + (noise - 0.5) * 0.35 * (wx > 0.02) * (wx < 0.98), 0, 1)[..., None]
    out = a * w + np.roll(a, n // 2, axis=1) * (1 - w)
    wy = feather(n)[:, None]
    w = np.clip(wy + (noise.T - 0.5) * 0.35 * (wy > 0.02) * (wy < 0.98), 0, 1)[..., None]
    out = out * w + np.roll(out, n // 2, axis=0) * (1 - w)
    return out


def wrap_blur(h: np.ndarray, r: float) -> np.ndarray:
    """可平铺（wrap）高斯模糊，可分离卷积。"""
    k = np.arange(-int(r * 3), int(r * 3) + 1)
    g = np.exp(-(k * k) / (2 * r * r)); g /= g.sum()
    out = sum(w * np.roll(h, int(o), 1) for o, w in zip(k, g))
    return sum(w * np.roll(out, int(o), 0) for o, w in zip(k, g))


def derive_maps(rgb: np.ndarray, rough: float, strength: float):
    lum = (rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11) / 255.0
    h = wrap_blur(lum, 2.0 * n0 / 512.0 if (n0 := lum.shape[0]) else 2.0)
    n = h.shape[0]
    scale = strength * n / 512.0
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * scale
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * scale
    nz = np.ones_like(h)
    l = np.sqrt(dx * dx + dy * dy + nz)
    # OpenGL 约定（+Y 向上）
    normal = np.stack([-dx / l, dy / l, nz / l], -1) * 0.5 + 0.5
    cavity = h - wrap_blur(h, 6)
    ao = np.clip(1.0 + cavity * 2.5, 0.55, 1.0)
    rgh = np.clip(rough + (0.5 - h) * 0.08, 0, 1)
    orm = np.stack([ao, rgh, np.zeros_like(h)], -1)
    to8 = lambda x: Image.fromarray(np.clip(x * 255 + 0.5, 0, 255).astype(np.uint8))
    return to8(normal), to8(orm)


def toktx(src: Path, dst: Path, uastc: bool, q: int = 128, clevel: int = 2, rdo: float = 1.5):
    args = [TOKTX, "--t2", "--genmipmap"]
    if uastc:
        args += ["--encode", "uastc", "--uastc_quality", "0", "--uastc_rdo_l", str(rdo), "--zcmp", "18"]
    else:
        args += ["--encode", "etc1s", "--clevel", str(clevel), "--qlevel", str(q)]
    if not uastc and "normal" not in dst.name and "orm" not in dst.name:
        args += ["--assign_oetf", "srgb"]
    else:
        args += ["--assign_oetf", "linear"]
    subprocess.check_call(args + [str(dst), str(src)], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)


def bake_texture(tid: str, raw: str, rough: float, strength: float, seed: int, summary: dict):
    im = center_square(Image.open(RAW / raw).convert("RGB")).resize((1024, 1024), Image.Resampling.LANCZOS)
    a = make_seamless(np.asarray(im, dtype=np.float32), seed)
    if tid in GRADE:
        sat, gain = GRADE[tid]
        lum = (a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11)[..., None]
        a = np.clip((lum + (a - lum) * sat) * gain, 0, 255)
    seam = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    # 2x2 平铺校验图
    tile = Image.new("RGB", (1024, 1024))
    small = seam.resize((512, 512), Image.Resampling.LANCZOS)
    for i in range(2):
        for j in range(2):
            tile.paste(small, (i * 512, j * 512))
    tile.save(WORK / f"tile2x2-{tid}.jpg", quality=88)
    seam.save(WORK / f"seamless-{tid}-1024.png")
    summary[tid] = {}
    for res, limit in ((512, 150 * 1024), (256, 50 * 1024)):
        color = seam.resize((res, res), Image.Resampling.LANCZOS)
        normal, orm = derive_maps(np.asarray(color, dtype=np.float32), rough, strength)
        out = ROOT / "assets/textures/pbr" / tid / str(res)
        out.mkdir(parents=True, exist_ok=True)
        tmp = WORK / "png" / tid / str(res)
        tmp.mkdir(parents=True, exist_ok=True)
        color.save(tmp / "baseColor.png"); normal.save(tmp / "normal.png"); orm.save(tmp / "orm.png")
        q = 128
        while True:
            toktx(tmp / "baseColor.png", out / "baseColor.ktx2", False, q)
            toktx(tmp / "normal.png", out / "normal.ktx2", True, rdo=4.0 if q == 128 else 6.0)
            toktx(tmp / "orm.png", out / "orm.ktx2", False, q)
            total = sum((out / f).stat().st_size for f in ("baseColor.ktx2", "normal.ktx2", "orm.ktx2"))
            if total <= limit or q <= 48:
                break
            q -= 32
        summary[tid][res] = {f: (out / f).stat().st_size for f in ("baseColor.ktx2", "normal.ktx2", "orm.ktx2")}
        summary[tid][res]["total"] = total
        summary[tid][res]["ok"] = total <= limit
        print(f"{tid}@{res}: {total} B ok={total <= limit}")


def crop_ratio(im: Image.Image, rw: int, rh: int) -> Image.Image:
    w, h = im.size
    if w / h > rw / rh:
        nw = round(h * rw / rh)
        return im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    nh = round(w * rh / rw)
    return im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))


def bake_cards(summary: dict):
    for name, (raw, size) in CARDS.items():
        im = crop_ratio(Image.open(RAW / raw).convert("RGB"), *size).resize(size, Image.Resampling.LANCZOS)
        dst = ROOT / "assets/illustrations/cards" / f"{name}.webp"
        im.save(dst, "WEBP", quality=82, method=6)
        summary[f"card/{name}"] = dst.stat().st_size


def key_parchment(im: Image.Image, soft: float = 34.0, hard: float = 18.0) -> Image.Image:
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    # 背景色：取四角中位数
    corners = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, 0)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    alpha = np.clip((d - hard) / (soft - hard), 0, 1)
    alpha_im = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3))
    # 只保留与中心连通的大块：用简单的形态学闭合去噪点
    alpha_im = alpha_im.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    rgba = im.convert("RGBA")
    rgba.putalpha(alpha_im)
    return rgba


def outline_object_mask(rgb: np.ndarray, dark: float = 115.0, grow: int = 2) -> np.ndarray:
    """深色描边 → 闭合 → 从外边界泛洪得“外部”，其余即物体（含白色羊毛等浅色内部）。"""
    from PIL import ImageDraw
    lum = rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11
    sat = rgb.max(-1) - rgb.min(-1)
    m = (lum < dark) | (sat > 95)
    im = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
    h, w = m.shape
    canvas = Image.new("L", (w + 2, h + 2), 0)
    canvas.paste(im, (1, 1))
    ImageDraw.floodfill(canvas, (0, 0), 128)
    ext = np.asarray(canvas)[1:-1, 1:-1] == 128
    obj = Image.fromarray((~ext * 255).astype(np.uint8))
    if grow:
        obj = obj.filter(ImageFilter.MinFilter(2 * grow - 1))
    return np.asarray(obj) > 127


def bake_icons(summary: dict):
    src = Image.open(RAW / "S4-style-resource-icons.jpg").convert("RGB")
    arr = np.asarray(src, dtype=np.float32)
    obj = outline_object_mask(arr)
    w = src.size[0]
    cols = obj.sum(0) > 6
    segs, start = [], None
    for x, v in enumerate(cols):
        if v and start is None:
            start = x
        if not v and start is not None:
            if x - start > 40:
                segs.append((start, x))
            start = None
    if start is not None and w - start > 40:
        segs.append((start, w))
    assert len(segs) == 5, segs
    out = ROOT / "assets/ui/ai/icons"
    out.mkdir(parents=True, exist_ok=True)
    preview = Image.new("RGBA", (5 * 140, 280), (40, 60, 70, 255))
    for i, (name, (x0, x1)) in enumerate(zip(ICONS, segs)):
        rows = np.where(obj[:, x0:x1].sum(1) > 2)[0]
        y0, y1 = rows.min(), rows.max() + 1
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        side = int(max(x1 - x0, y1 - y0) * 1.06)
        box = (int(cx - side / 2), int(cy - side / 2), int(cx - side / 2) + side, int(cy - side / 2) + side)
        crop = src.crop(box).convert("RGBA")
        sub = np.zeros((side, side), dtype=bool)
        bx0, by0 = box[0], box[1]
        ys, xs = slice(max(by0, 0), min(by0 + side, obj.shape[0])), slice(max(bx0, x0 - 2), min(bx0 + side, x1 + 2))
        sub[ys.start - by0:ys.stop - by0, xs.start - bx0:xs.stop - bx0] = obj[ys, xs]
        alpha = Image.fromarray((sub * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
        crop.putalpha(alpha)
        for px in (128, 64):
            ic = crop.resize((px, px), Image.Resampling.LANCZOS)
            dst = out / f"{name}-{px}.webp"
            ic.save(dst, "WEBP", quality=88, method=6)
            summary[f"icon/{name}-{px}"] = dst.stat().st_size
        preview.alpha_composite(crop.resize((128, 128), Image.Resampling.LANCZOS), (i * 140 + 6, 6))
        bgp = Image.new("RGBA", (128, 128), (243, 231, 201, 255))
        bgp.alpha_composite(crop.resize((128, 128), Image.Resampling.LANCZOS))
        preview.alpha_composite(bgp, (i * 140 + 6, 146))
    preview.save(WORK / "icons-preview.png")


def bake_frames(summary: dict):
    src = Image.open(RAW / "S3-style-hud-card.jpg").convert("RGB")
    arr = np.asarray(src, dtype=np.float32)
    bg = np.median(arr[:12, :12].reshape(-1, 3), 0)
    mask = np.sqrt(((arr - bg) ** 2).sum(-1)) > 22
    w = src.size[0]
    cols = mask.sum(0) > 6
    segs, start = [], None
    for x, v in enumerate(cols):
        if v and start is None:
            start = x
        if not v and start is not None:
            if x - start > 60:
                segs.append((start, x))
            start = None
    if start is not None:
        segs.append((start, w))
    segs = sorted(segs, key=lambda s: s[1] - s[0], reverse=True)[:2]
    segs.sort()
    assert len(segs) == 2, segs
    out = ROOT / "assets/ui/ai"
    out.mkdir(parents=True, exist_ok=True)
    meta = {}
    crops = {}
    for name, (x0, x1) in (("panel-frame", segs[0]), ("card-frame", segs[1])):
        rows = np.where(mask[:, x0:x1].sum(1) > 6)[0]
        y0, y1 = rows.min(), rows.max() + 1
        crops[name] = key_parchment(src.crop((x0, y0, x1, y1)), soft=26, hard=10)

    # 面板：重建成干净 9-slice —— 四角取原图角花，四边取角花与中饰之间的素边条，
    # 中心用内部纸色（原图内部有生成残影，弃用），中饰（会被拉伸）不保留。
    pan = np.asarray(crops["panel-frame"]).astype(np.float32)
    H, W = pan.shape[:2]
    m, e = 130, 120  # 角块边长、素边条长度
    interior = pan[H // 2 - 60:H // 2 + 60, m:m + 120, :3].reshape(-1, 3)
    paper = np.median(interior, 0)
    size = 2 * m + e
    outp = np.zeros((size, size, 4), np.float32)
    outp[..., :3] = paper
    outp[..., 3] = 255
    rng = np.random.default_rng(7)
    grain = np.asarray(Image.fromarray((rng.random((size // 4, size // 4)) * 255).astype(np.uint8)).resize((size, size), Image.Resampling.BICUBIC), np.float32)
    outp[..., :3] += ((grain - 127.5) / 127.5 * 4.0)[..., None]
    sx, sy = 150, 150  # 素边条起点（避开角花、中饰与残影）
    outp[:m, :m] = pan[:m, :m]; outp[:m, -m:] = pan[:m, -m:]
    outp[-m:, :m] = pan[-m:, :m]; outp[-m:, -m:] = pan[-m:, -m:]
    outp[:m, m:m + e] = pan[:m, sx:sx + e]
    outp[-m:, m:m + e] = pan[-m:, sx:sx + e]
    outp[m:m + e, :m] = pan[sy:sy + e, :m]
    outp[m:m + e, -m:] = pan[sy:sy + e, -m:]
    # 角块/边条朝内一侧可能带到残影：把距边 > 60px 的区域与纸色做羽化融合
    yy, xx = np.mgrid[0:size, 0:size]
    dist = np.minimum.reduce([xx, yy, size - 1 - xx, size - 1 - yy]).astype(np.float32)
    t = np.clip((dist - 48) / 24, 0, 1)[..., None]
    base = np.concatenate([np.broadcast_to(paper, (size, size, 3)) + ((grain - 127.5) / 127.5 * 4.0)[..., None], np.full((size, size, 1), 255.0)], -1)
    outp = outp * (1 - t) + base * t
    panel = Image.fromarray(np.clip(outp, 0, 255).astype(np.uint8), "RGBA")
    dst = out / "panel-frame.webp"
    panel.save(dst, "WEBP", quality=90, method=6)
    summary["frame/panel-frame"] = dst.stat().st_size
    meta["panel-frame"] = {"width": size, "height": size, "slice": {"top": m, "right": m, "bottom": m, "left": m},
                           "css": f"border-image: url(panel-frame.webp) {m} fill / {m // 2}px stretch;",
                           "note": "四边为素边条，可任意拉伸；中心为纸色 fill"}

    # 卡框：固定 3:4 卡片用；顶/底中饰较大，slice 取大值，侧边仅轻度拉伸（宽高比接近 3:4 时最佳）。
    card = crops["card-frame"]
    a = np.asarray(card).copy()
    hh, ww = a.shape[:2]
    a[90:hh - 110, 60:ww - 60, 3] = 255
    card = Image.fromarray(a)
    dst = out / "card-frame.webp"
    card.save(dst, "WEBP", quality=90, method=6)
    summary["frame/card-frame"] = dst.stat().st_size
    meta["card-frame"] = {"width": ww, "height": hh, "slice": {"top": 90, "right": 60, "bottom": 110, "left": 60},
                          "css": "border-image: url(card-frame.webp) 90 60 110 60 fill / 45px 30px 55px 30px stretch;",
                          "note": "适用宽高比接近 3:4 的卡片；中心为纸色插画窗"}
    (out / "nine-slice.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")


def bake_token(summary: dict):
    src = Image.open(RAW / "N1-number-token.jpg").convert("RGB")
    arr = np.asarray(src, dtype=np.float32)
    bg = np.median(arr[:12, :12].reshape(-1, 3), 0)
    mask = np.sqrt(((arr - bg) ** 2).sum(-1)) > 30
    ys, xs = np.where(mask)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 + 2
    box = (int(cx - r), int(cy - r), int(cx + r), int(cy + r))
    crop = src.crop(box).resize((512, 512), Image.Resampling.LANCZOS)
    yy, xx = np.mgrid[0:512, 0:512]
    d = np.sqrt((xx - 255.5) ** 2 + (yy - 255.5) ** 2)
    alpha = np.clip((255.5 - d) / 2.0, 0, 1)
    rgba = crop.convert("RGBA")
    rgba.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)))
    out = ROOT / "assets/ui/ai"
    out.mkdir(parents=True, exist_ok=True)
    for px in (256, 128):
        dst = out / f"number-token-face-{px}.webp"
        rgba.resize((px, px), Image.Resampling.LANCZOS).save(dst, "WEBP", quality=88, method=6)
        summary[f"token/{px}"] = dst.stat().st_size
    # 3D 筹码面：t11-parchment（只给 number-token 用）——圆外以边缘色填满，免 mip 渗色
    rim = np.asarray(crop, dtype=np.float32)[(d > 246) & (d < 252)].mean(0)
    sq = np.asarray(crop, dtype=np.float32).copy()
    sq[d > 252] = rim
    sq_im = Image.fromarray(sq.astype(np.uint8))
    for res, limit in ((512, 220 * 1024), (256, 70 * 1024)):
        color = sq_im.resize((res, res), Image.Resampling.LANCZOS)
        normal, orm = derive_maps(np.asarray(color, dtype=np.float32), 0.95, 1.0)
        o = ROOT / "assets/textures/pbr/t11-parchment" / str(res)
        tmp = WORK / "png/t11-parchment" / str(res)
        tmp.mkdir(parents=True, exist_ok=True)
        color.save(tmp / "baseColor.png"); normal.save(tmp / "normal.png"); orm.save(tmp / "orm.png")
        toktx(tmp / "baseColor.png", o / "baseColor.ktx2", False)
        toktx(tmp / "normal.png", o / "normal.ktx2", True)
        toktx(tmp / "orm.png", o / "orm.ktx2", False)
        total = sum((o / f).stat().st_size for f in ("baseColor.ktx2", "normal.ktx2", "orm.ktx2"))
        summary.setdefault("t11-parchment", {})[res] = {"total": total, "ok": total <= limit}
        print(f"t11-parchment@{res}: {total} B ok={total <= limit}")


def main():
    summary: dict = {}
    only = os.environ.get("AI_ONLY", "").split(",") if os.environ.get("AI_ONLY") else None
    if only:
        for k in only:
            if k.startswith("tex:"):
                tid = k[4:]
                raw, rough, strength = TEXTURES[tid]
                bake_texture(tid, raw, rough, strength, 17 + list(TEXTURES).index(tid), summary)
                continue
            {"token": bake_token, "cards": bake_cards, "icons": bake_icons, "frames": bake_frames}[k](summary)
        print("DONE", only)
        return
    for i, (tid, (raw, rough, strength)) in enumerate(TEXTURES.items()):
        bake_texture(tid, raw, rough, strength, 17 + i, summary)
    bake_token(summary)
    bake_cards(summary)
    bake_icons(summary)
    bake_frames(summary)
    (WORK / "process-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print("DONE")


if __name__ == "__main__":
    main()
