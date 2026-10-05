#!/usr/bin/env node
/**
 * G3D-11 资产压缩管线（SPEC §5.2 / §4.2）
 *
 * - GLB：meshopt 压缩 + 量化（gltf-transform）
 * - 贴图：KTX2 ETC1S（baseColor / ORM）与 UASTC（法线），输出 512 与 256 两档
 *
 * 用法：
 *   node scripts/compress-assets.mjs --glb assets/raw/models/foo.glb --out assets/processed/models/foo.glb
 *   node scripts/compress-assets.mjs --texture assets/raw/textures/wood_color.png --slot color --out-dir assets/processed/textures/wood
 *   node scripts/compress-assets.mjs --texture assets/raw/textures/wood_normal.png --slot normal --out-dir assets/processed/textures/wood
 *
 * 依赖：@gltf-transform/cli（devDependency）。KTX2 需要系统或 npm 提供的 toktx（Basis）；
 * 若 toktx 不可用，脚本以明确错误退出并写入 STATUS 阻塞说明，不静默跳过。
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const out = { glb: null, texture: null, slot: "color", out: null, outDir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--glb") out.glb = resolve(argv[++i]);
    else if (a === "--texture") out.texture = resolve(argv[++i]);
    else if (a === "--slot") out.slot = argv[++i];
    else if (a === "--out") out.out = resolve(argv[++i]);
    else if (a === "--out-dir") out.outDir = resolve(argv[++i]);
    else if (a === "--help") {
      console.log(`See scripts/compress-assets.mjs header.`);
      process.exit(0);
    }
  }
  return out;
}

function run(cmd, args) {
  console.log("+", cmd, args.join(" "));
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function findGltfTransform() {
  const local = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "node_modules",
    ".bin",
    "gltf-transform",
  );
  if (existsSync(local)) return local;
  return "gltf-transform";
}

function compressGlb(input, output) {
  mkdirSync(dirname(output), { recursive: true });
  const bin = findGltfTransform();
  // meshopt + quantize；不使用 Draco
  run(bin, [
    "optimize",
    input,
    output,
    "--compress",
    "meshopt",
    "--texture-compress",
    "false",
  ]);
}

function whichToktx() {
  const r = spawnSync("toktx", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

function compressTexture(input, slot, outDir) {
  mkdirSync(outDir, { recursive: true });
  if (!whichToktx()) {
    console.error(
      "ERROR: toktx (Basis Universal) 未安装。KTX2 双分辨率烘焙需要 toktx。\n" +
        "安装参考：https://github.com/BinomialLLC/basis_universal\n" +
        "或在 CI 镜像预装。本脚本拒绝静默跳过。",
    );
    process.exit(2);
  }
  const stem = basename(input, extname(input));
  const sizes = [
    { size: 512, tag: "512" },
    { size: 256, tag: "256" },
  ];
  for (const { size, tag } of sizes) {
    const out = join(outDir, `${stem}-${tag}.ktx2`);
    const args = ["--t2"];
    if (slot === "normal") {
      // UASTC + zstd for normals
      args.push("--uastc", "2", "--zcmp", "18", "--assign_oetf", "linear", "--normalize");
    } else {
      // ETC1S for color / ORM
      args.push("--bcmp", "--clevel", "2", "--qlevel", "128");
      if (slot === "color") args.push("--assign_oetf", "srgb");
      else args.push("--assign_oetf", "linear");
    }
    args.push("--resize", `${size}x${size}`, out, input);
    run("toktx", args);
  }
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.glb) {
    if (!opts.out) {
      console.error("--glb 需要 --out");
      process.exit(1);
    }
    compressGlb(opts.glb, opts.out);
    console.log("GLB compressed:", opts.out);
    return;
  }
  if (opts.texture) {
    if (!opts.outDir) {
      console.error("--texture 需要 --out-dir");
      process.exit(1);
    }
    compressTexture(opts.texture, opts.slot, opts.outDir);
    console.log("Textures compressed into:", opts.outDir);
    return;
  }
  console.error("指定 --glb 或 --texture");
  process.exit(1);
}

main();
