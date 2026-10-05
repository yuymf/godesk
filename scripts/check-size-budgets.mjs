#!/usr/bin/env node
/**
 * G3D size budgets with correct disambiguation:
 * - index-*.js ≤ 170 KB gzip (homepage)
 * - render3d-*.js excluding render3d-assets-* ≤ 210 KB gzip (sum)
 * - render3d-assets-*.js ≤ 60 KB gzip
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
process.exit(ok ? 0 : 1);
