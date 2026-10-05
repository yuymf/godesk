#!/usr/bin/env node
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LIMIT = 60 * 1024;
const dir = join(process.cwd(), "dist", "assets");
const files = readdirSync(dir).filter((f) => /^render3d-assets-.*\.js$/.test(f));
if (files.length === 0) {
  console.error("No render3d-assets-*.js in dist/assets");
  process.exit(1);
}
let failed = false;
for (const f of files) {
  const buf = readFileSync(join(dir, f));
  const gz = gzipSync(buf).length;
  const ok = gz <= LIMIT;
  console.log(`${f}: raw=${buf.length} gzip=${gz} limit=${LIMIT} ${ok ? "OK" : "FAIL"}`);
  if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);
