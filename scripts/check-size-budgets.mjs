#!/usr/bin/env node
/**
 * G3D size budgets with correct disambiguation:
 * - index-*.js ≤ 170 KB gzip (homepage)
 * - render3d-*.js excluding render3d-assets-* ≤ 210 KB gzip (sum)
 * - render3d-assets-*.js ≤ 60 KB gzip
 * - board-dressing-*.js ≤ 30 KB gzip（G3D-ISLAND / PROPS，懒加载）
 * - TabletopScene3D-*.js ≤ 12 KB gzip（G3D-14 通用桌面 mapper + 网格工厂，懒加载，不计入核心）
 * - g3d-overlay-*.js ≤ 6 KB gzip（G3D-JUDGE-PIECES 画布视角工具条，懒加载，不计入核心）
 * - g3d-hexkit-*.js ≤ 10 KB gzip（G3D-JUDGE-PIECES hex 盘专用：镜头导演 + 海面取景约束、骰盘角标、
 *   hex mapper、点数贴花、命中区；与 GLB 并行懒加载、通用桌面不加载，从核心挪出而非放宽核心预算）
 */
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "dist", "assets");
const files = readdirSync(dir);

function gzipSize(name) {
  return gzipSync(readFileSync(join(dir, name))).length;
}

function check(label, names, limitKb) {
  const limit = limitKb * 1024;
  const sizes = names.map((n) => ({ n, gz: gzipSize(n) }));
  const total = sizes.reduce((a, s) => a + s.gz, 0);
  const ok = names.length > 0 && total <= limit;
  console.log(
    `${label}: ${names.length ? sizes.map((s) => `${s.n}=${(s.gz / 1024).toFixed(2)}KB`).join(", ") : "(missing)"} total=${(total / 1024).toFixed(2)}KB limit=${limitKb}KB ${ok ? "OK" : "FAIL"}`,
  );
  return ok;
}

const index = files.filter((f) => /^index-.*\.js$/.test(f));
const assets = files.filter((f) => /^render3d-assets-.*\.js$/.test(f));
const render3d = files.filter(
  (f) => /^render3d-.*\.js$/.test(f) && !/^render3d-assets-/.test(f),
);

let ok = true;
ok = check("homepage index JS", index, 170) && ok;
ok = check("render3d core (excl. assets)", render3d, 210) && ok;
ok = check("render3d-assets", assets, 60) && ok;
const tideWater = files.filter((f) => /^tide-water-.*\.js$/.test(f));
if (tideWater.length) {
  // Lazy water chunk (G3D-08); soft budget — fail only if absurdly large.
  ok = check("tide-water (lazy)", tideWater, 40) && ok;
} else {
  console.log("tide-water: (not in this build — ok if SceneHost never imported water)");
}
// G3D-ISLAND / PROPS：岛屿海岸 + 地形道具懒加载 chunk。
ok = check("board-dressing (lazy)", files.filter((f) => /^board-dressing-.*\.js$/.test(f)), 30) && ok;
ok = check("tabletop mapper (lazy)", files.filter((f) => /^TabletopScene3D-.*\.js$/.test(f)), 12) && ok;
ok = check("g3d-overlay toolbar (lazy)", files.filter((f) => /^g3d-overlay-.*\.js$/.test(f)), 6) && ok;
ok = check("g3d-hexkit hex-board kit (lazy)", files.filter((f) => /^g3d-hexkit-.*\.js$/.test(f)), 10) && ok;
process.exit(ok ? 0 : 1);
