#!/usr/bin/env python3
"""G3D-22: grade ambientCG CC0 maps → 512/256 PNG → toktx KTX2 sets."""
from __future__ import annotations
import json, os, subprocess, zipfile
from pathlib import Path
from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
VENDOR = Path("/workspace/g3d-evidence/G3D-22/vendor")
OUT = ROOT / "assets/textures/pbr"
EV = Path("/workspace/g3d-evidence/G3D-22")
TOKTX = os.environ.get("TOKTX", "toktx")
OUT.mkdir(parents=True, exist_ok=True)
EV.mkdir(parents=True, exist_ok=True)

# id → (ambientCG stem, grade hexRGB or None, url)
SETS = [
    ("t01-pine", "Grass001", (47, 93, 58), "https://ambientcg.com/a/Grass001"),
    ("t02-clay", "Ground037", (179, 90, 60), "https://ambientcg.com/a/Ground037"),
    ("t03-meadow", "Grass001", (143, 168, 106), "https://ambientcg.com/a/Grass001"),
    ("t04-wheat", "Ground033", (212, 165, 74), "https://ambientcg.com/a/Ground033"),
    ("t05-reef", "Rock020", (107, 110, 120), "https://ambientcg.com/a/Rock020"),
    ("t06-sand", "Ground054", (201, 178, 138), "https://ambientcg.com/a/Ground054"),
    ("t07-cliff", "Rock023", (90, 92, 100), "https://ambientcg.com/a/Rock023"),
    ("t08-wood", "Wood049", (120, 90, 55), "https://ambientcg.com/a/Wood049"),
    ("t09-paintwood", "Wood049", (160, 120, 90), "https://ambientcg.com/a/Wood049"),
    ("t10-canvas", "Fabric045", (210, 200, 180), "https://ambientcg.com/a/Fabric045"),
    ("t11-parchment", "Paper001", (232, 214, 184), "https://ambientcg.com/a/Paper001"),
]


def unzip_maps(stem: str) -> dict[str, Path]:
    zpath = VENDOR / f"{stem}_1K-JPG.zip"
    dest = VENDOR / stem
    dest.mkdir(exist_ok=True)
    with zipfile.ZipFile(zpath) as z:
        z.extractall(dest)
    files = list(dest.rglob("*.jpg")) + list(dest.rglob("*.jpeg")) + list(dest.rglob("*.png"))
    def pick(*keys):
        for f in files:
            name = f.name.lower()
            if any(k.lower() in name for k in keys):
                return f
        return None
    return {
        "color": pick("color", "albedo", "diff"),
        "normal": pick("normalgl", "normal"),
        "rough": pick("roughness"),
        "ao": pick("ambientocclusion", "ao"),
        "metal": pick("metalness", "metallic"),
    }


def grade_color(img: Image.Image, target: tuple[int, int, int]) -> Image.Image:
    img = ImageOps.autocontrast(img.convert("RGB"), cutoff=1)
    img = ImageEnhance.Color(img).enhance(0.35)  # de-photo
    img = ImageEnhance.Contrast(img).enhance(0.9)
    # tint toward target
    arr = img.copy()
    overlay = Image.new("RGB", img.size, target)
    return Image.blend(arr, overlay, 0.45)


def pack_orm(ao: Image.Image | None, rough: Image.Image | None, metal: Image.Image | None, size: int) -> Image.Image:
    def gray(im, fill=180):
        if im is None:
            return Image.new("L", (size, size), fill)
        return im.convert("L").resize((size, size), Image.Resampling.LANCZOS)
    r = gray(ao, 220)
    g = gray(rough, 160)
    b = gray(metal, 0)
    return Image.merge("RGB", (r, g, b))


def toktx_etc1s(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([
        TOKTX, "--t2", "--encode", "etc1s", "--clevel", "2", "--qlevel", "128",
        str(dst), str(src),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)


def toktx_uastc(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([
        TOKTX, "--t2", "--encode", "uastc", "--uastc_quality", "0", "--uastc_rdo_l", "1.5", "--zcmp", "18",
        str(dst), str(src),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)


def bake_one(tid: str, stem: str, target, url: str):
    maps = unzip_maps(stem)
    assert maps["color"], stem
    summary = {"id": tid, "source": stem, "url": url, "sizes": {}}
    for res in (512, 256):
        color = grade_color(Image.open(maps["color"]), target).resize((res, res), Image.Resampling.LANCZOS)
        normal = Image.open(maps["normal"]).convert("RGB").resize((res, res), Image.Resampling.LANCZOS) if maps["normal"] else Image.new("RGB", (res, res), (128, 128, 255))
        orm = pack_orm(
            Image.open(maps["ao"]) if maps["ao"] else None,
            Image.open(maps["rough"]) if maps["rough"] else None,
            Image.open(maps["metal"]) if maps["metal"] else None,
            res,
        )
        work = OUT / tid / str(res)
        work.mkdir(parents=True, exist_ok=True)
        c_png, n_png, o_png = work / "baseColor.png", work / "normal.png", work / "orm.png"
        color.save(c_png)
        normal.save(n_png)
        orm.save(o_png)
        c_ktx, n_ktx, o_ktx = work / "baseColor.ktx2", work / "normal.ktx2", work / "orm.ktx2"
        toktx_etc1s(c_png, c_ktx)
        toktx_uastc(n_png, n_ktx)
        toktx_etc1s(o_png, o_ktx)
        total = c_ktx.stat().st_size + n_ktx.stat().st_size + o_ktx.stat().st_size
        limit = 220 * 1024 if res == 512 else 70 * 1024
        # escalate compression if over budget
        q = 100
        while total > limit and q >= 40:
            q -= 20
            subprocess.check_call([TOKTX, "--t2", "--encode", "etc1s", "--clevel", "4", "--qlevel", str(q), str(c_ktx), str(c_png)], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
            subprocess.check_call([TOKTX, "--t2", "--encode", "etc1s", "--clevel", "4", "--qlevel", str(q), str(o_ktx), str(o_png)], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
            subprocess.check_call([TOKTX, "--t2", "--encode", "uastc", "--uastc_quality", "0", "--uastc_rdo_l", "3.0", "--zcmp", "22", str(n_ktx), str(n_png)], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
            total = c_ktx.stat().st_size + n_ktx.stat().st_size + o_ktx.stat().st_size
        summary["sizes"][res] = {
            "baseColor": c_ktx.stat().st_size,
            "normal": n_ktx.stat().st_size,
            "orm": o_ktx.stat().st_size,
            "total": total,
            "ok": total <= limit,
        }
        print(f"{tid}@{res}: {total} ok={total<=limit}")
    return summary


def main():
    results = []
    for tid, stem, target, url in SETS:
        results.append(bake_one(tid, stem, target, url))
    (EV / "bake-summary.json").write_text(json.dumps(results, indent=2))
    bad = [r for r in results if not all(v["ok"] for v in r["sizes"].values())]
    print("FAIL" if bad else "ALL_OK", len(bad))


if __name__ == "__main__":
    main()
