#!/usr/bin/env python3
"""G3D-JUDGE round-6tex: rebake terrain/wood PBR from CC0 (ambientCG + Poly Haven).

Kills plastic-toy AI albedos by restoring real surface detail with mild board-game grading.
Outputs into assets/textures/pbr/<set>/{512,256}/{baseColor,normal,orm}.ktx2
"""
from __future__ import annotations
import json, os, subprocess, zipfile
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
VENDOR = Path("/workspace/g3d-evidence/G3D-22/vendor")
POLY = ROOT / "assets/imported/polyhaven"
OUT = ROOT / "assets/textures/pbr"
EV = Path("/workspace/g3d-evidence/judge/round-6tex")
TOKTX = os.environ.get("TOKTX", "toktx")
OUT.mkdir(parents=True, exist_ok=True)
EV.mkdir(parents=True, exist_ok=True)

# id → (kind, stem_or_dir, grade RGB, attribution url)
# kind: "acg" = vendor/{stem}_1K-JPG.zip ; "ph" = assets/imported/polyhaven/{stem}/...
SETS = [
    ("t01-pine", "ph", "forrest_ground_01", (55, 100, 62), "https://polyhaven.com/a/forrest_ground_01"),
    ("t02-clay", "acg", "Ground037", (175, 88, 58), "https://ambientcg.com/a/Ground037"),
    ("t03-meadow", "acg", "Ground024", (130, 155, 95), "https://ambientcg.com/a/Ground024"),
    ("t04-wheat", "acg", "Ground033", (205, 160, 70), "https://ambientcg.com/a/Ground033"),
    ("t05-reef", "acg", "Rock056", (100, 105, 115), "https://ambientcg.com/a/Rock056"),
    ("t06-sand", "acg", "Ground054", (198, 175, 135), "https://ambientcg.com/a/Ground054"),
    ("t07-cliff", "acg", "Rock023", (95, 92, 88), "https://ambientcg.com/a/Rock023"),
    ("t08-wood", "ph", "wood_planks", (115, 85, 52), "https://polyhaven.com/a/wood_planks"),
    ("t09-paintwood", "acg", "WoodFloor043", (155, 118, 85), "https://ambientcg.com/a/WoodFloor043"),
    ("t10-canvas", "acg", "Fabric045", (208, 198, 178), "https://ambientcg.com/a/Fabric045"),
    ("t11-parchment", "acg", "Paper001", (230, 212, 182), "https://ambientcg.com/a/Paper001"),
]


def find_maps(files: list[Path]) -> dict[str, Path | None]:
    def pick(*keys):
        for f in files:
            name = f.name.lower()
            if any(k.lower() in name for k in keys):
                return f
        return None
    return {
        "color": pick("diff", "color", "albedo", "_col"),
        "normal": pick("nor_gl", "normalgl", "normal_gl", "normal"),
        "rough": pick("rough"),
        "ao": pick("_ao", "ambientocclusion", "ao_"),
        "metal": pick("metalness", "metallic", "metal"),
        "arm": pick("_arm", "orm"),
    }


def unzip_acg(stem: str) -> dict[str, Path | None]:
    zpath = VENDOR / f"{stem}_1K-JPG.zip"
    dest = VENDOR / stem
    dest.mkdir(exist_ok=True)
    with zipfile.ZipFile(zpath) as z:
        z.extractall(dest)
    files = list(dest.rglob("*.jpg")) + list(dest.rglob("*.jpeg")) + list(dest.rglob("*.png"))
    return find_maps(files)


def load_ph(stem: str) -> dict[str, Path | None]:
    root = POLY / stem
    files = list(root.rglob("*.jpg")) + list(root.rglob("*.jpeg")) + list(root.rglob("*.png"))
    return find_maps(files)


def grade_color(img: Image.Image, target: tuple[int, int, int]) -> Image.Image:
    """Mild board-game grade — keep photo micro-detail (anti-plastic)."""
    img = ImageOps.autocontrast(img.convert("RGB"), cutoff=0.5)
    img = ImageEnhance.Color(img).enhance(0.72)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Sharpness(img).enhance(1.15)
    overlay = Image.new("RGB", img.size, target)
    # lighter tint than G3D-22 (was 0.45) so albedo reads as real material
    return Image.blend(img, overlay, 0.22)


def pack_orm(ao: Image.Image | None, rough: Image.Image | None, metal: Image.Image | None, arm: Image.Image | None, size: int) -> Image.Image:
    def gray(im, fill=180):
        if im is None:
            return Image.new("L", (size, size), fill)
        return im.convert("L").resize((size, size), Image.Resampling.LANCZOS)
    if arm is not None:
        arm_rgb = arm.convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
        # Poly Haven ARM: R=AO G=Rough B=Metal — already ORM-compatible
        return arm_rgb
    r = gray(ao, 220)
    g = gray(rough, 155)
    b = gray(metal, 0)
    return Image.merge("RGB", (r, g, b))


def toktx_etc1s(src: Path, dst: Path, qlevel=128):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([
        TOKTX, "--t2", "--encode", "etc1s", "--clevel", "2", "--qlevel", str(qlevel),
        str(dst), str(src),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)


def toktx_uastc(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([
        TOKTX, "--t2", "--encode", "uastc", "--uastc_quality", "0", "--uastc_rdo_l", "1.5", "--zcmp", "18",
        str(dst), str(src),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)


def bake_one(tid: str, kind: str, stem: str, target, url: str):
    maps = unzip_acg(stem) if kind == "acg" else load_ph(stem)
    assert maps["color"], (tid, stem, maps)
    summary = {"id": tid, "kind": kind, "source": stem, "url": url, "license": "CC0-1.0", "sizes": {}}
    for res in (512, 256):
        color = grade_color(Image.open(maps["color"]), target).resize((res, res), Image.Resampling.LANCZOS)
        if maps["normal"]:
            normal = Image.open(maps["normal"]).convert("RGB").resize((res, res), Image.Resampling.LANCZOS)
        else:
            normal = Image.new("RGB", (res, res), (128, 128, 255))
        orm = pack_orm(
            Image.open(maps["ao"]) if maps["ao"] else None,
            Image.open(maps["rough"]) if maps["rough"] else None,
            Image.open(maps["metal"]) if maps["metal"] else None,
            Image.open(maps["arm"]) if maps["arm"] else None,
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
        q = 100
        while total > limit and q >= 40:
            q -= 20
            toktx_etc1s(c_png, c_ktx, q)
            toktx_etc1s(o_png, o_ktx, q)
            subprocess.check_call([
                TOKTX, "--t2", "--encode", "uastc", "--uastc_quality", "0", "--uastc_rdo_l", "3.0", "--zcmp", "22",
                str(n_ktx), str(n_png),
            ], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
            total = c_ktx.stat().st_size + n_ktx.stat().st_size + o_ktx.stat().st_size
        # drop PNGs from repo tree (ktx2 only committed)
        c_png.unlink(missing_ok=True)
        n_png.unlink(missing_ok=True)
        o_png.unlink(missing_ok=True)
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
    for tid, kind, stem, target, url in SETS:
        results.append(bake_one(tid, kind, stem, target, url))
    (EV / "bake-summary.json").write_text(json.dumps(results, indent=2))
    bad = [r for r in results if not all(v["ok"] for v in r["sizes"].values())]
    print("FAIL" if bad else "ALL_OK", len(bad))


if __name__ == "__main__":
    main()
