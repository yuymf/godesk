#!/usr/bin/env python3
"""R19 · bake 虹夏's 8 AI textures (Grok Bot GenerateImage, 2026-10-08) into runtime assets.

Sources (lossless WebP, already seamless/alpha-processed upstream; sidecar prompts live in
/workspace/g3d-evidence/ai-textures/<name>.json and are NOT committed):
  assets/ai-textures/r19/{grass,forest-floor,wheat-field,clay,scree,sand,cliff-rock,harbor-sign}.webp

Outputs:
  assets/textures/pbr/t0{1..6}-*/{512,256}/baseColor.ktx2  (ETC1S, same flags as R6; CC0 normal/ORM kept)
  assets/textures/ai-r19/cliff-rock-512x256.webp           (lossy q82, island cliff wall base)
  assets/textures/ai-r19/harbor-sign-256.webp              (lossy q85 RGBA, harbor sign plate)

Usage: TOKTX=/home/box/.local/ktx/usr/bin/toktx python3 scripts/bake-ai-r19.py [--src DIR]
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TOKTX = os.environ.get("TOKTX", "toktx")
SRC = Path(sys.argv[sys.argv.index("--src") + 1]) if "--src" in sys.argv else ROOT / "assets/ai-textures/r19"
TERRAIN = {
    "forest-floor": "t01-pine",
    "clay": "t02-clay",
    "grass": "t03-meadow",
    "wheat-field": "t04-wheat",
    "scree": "t05-reef",
    "sand": "t06-sand",
}


def toktx_etc1s(src: Path, dst: Path, qlevel: int = 128) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [TOKTX, "--t2", "--encode", "etc1s", "--clevel", "2", "--qlevel", str(qlevel), str(dst), str(src)],
        check=True,
    )


def wrap_resize(im: Image.Image, size: int) -> Image.Image:
    """Tile-safe downscale: pad with wrapped copies, Lanczos, crop the centre."""
    w, h = im.size
    pad = Image.new(im.mode, (w * 3, h * 3))
    for i in range(3):
        for j in range(3):
            pad.paste(im, (i * w, j * h))
    s = size / w
    big = pad.resize((round(w * 3 * s), round(h * 3 * s)), Image.LANCZOS)
    return big.crop((size, size, size * 2, size * 2))


def main() -> None:
    repo_src = ROOT / "assets/ai-textures/r19"
    repo_src.mkdir(parents=True, exist_ok=True)
    if SRC.resolve() != repo_src.resolve():
        for name in [*TERRAIN, "cliff-rock", "harbor-sign"]:
            shutil.copyfile(SRC / f"{name}.webp", repo_src / f"{name}.webp")
    with tempfile.TemporaryDirectory() as tmp:
        for name, set_id in TERRAIN.items():
            im = Image.open(repo_src / f"{name}.webp").convert("RGB")
            assert im.size == (512, 512), (name, im.size)
            for size in (512, 256):
                png = Path(tmp) / f"{name}-{size}.png"
                (im if size == 512 else wrap_resize(im, size)).save(png)
                toktx_etc1s(png, ROOT / f"assets/textures/pbr/{set_id}/{size}/baseColor.ktx2")
    out = ROOT / "assets/textures/ai-r19"
    out.mkdir(parents=True, exist_ok=True)
    cliff = Image.open(repo_src / "cliff-rock.webp").convert("RGB")
    cliff.resize((512, 256), Image.LANCZOS).save(out / "cliff-rock-512x256.webp", quality=82, method=6)
    sign = Image.open(repo_src / "harbor-sign.webp").convert("RGBA")
    sign.resize((256, 256), Image.LANCZOS).save(out / "harbor-sign-256.webp", quality=85, method=6)
    for p in sorted(out.iterdir()):
        print(p.relative_to(ROOT), p.stat().st_size)


if __name__ == "__main__":
    main()
