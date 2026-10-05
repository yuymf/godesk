import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verifyAssets, parseLicensesMarkdown } from "./verify-assets.mjs";

const FIX = () =>
  join(tmpdir(), `g3d-verify-${Date.now()}-${Math.random().toString(16).slice(2)}`);

function writeFixture(root, { manifest, licenses, distFiles = [] }) {
  mkdirSync(join(root, "assets"), { recursive: true });
  mkdirSync(join(root, "dist", "assets"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "src", "render3d", "assets"), { recursive: true });
  writeFileSync(join(root, "scripts", "gen-paper.mjs"), "// procedural source stub\n");
  writeFileSync(join(root, "assets", "LICENSES.md"), licenses, "utf8");
  writeFileSync(
    join(root, "src", "render3d", "assets", "manifest.data.mjs"),
    `export const ASSET_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`,
    "utf8",
  );
  writeFileSync(
    join(root, "src", "render3d", "assets", "manifest.ts"),
    "export const ASSET_MANIFEST = Object.freeze([]);\n",
    "utf8",
  );
  for (const f of distFiles) {
    const abs = join(root, "dist", f);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, "x");
  }
}

const HEADER = `| 资产 id | 文件路径 | 名称 | 来源类型 | 来源 URL | 许可证 SPDX | 作者 | 获取日期 | 是否修改 | 修改说明 | 使用任务 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
`;

const clearedEntry = (over = {}) => ({
  id: "ui/paper-noise",
  file: "assets/ui/paper-noise.webp",
  kind: "ui",
  bytes: 12,
  tier: "all",
  source: "procedural",
  license: {
    spdx: "LicenseRef-GoDesk-Original",
    sourceUrl: "scripts/gen-paper.mjs",
    author: "GoDesk",
    obtainedAt: "2026-10-06",
    modified: false,
    modificationNote: "无",
    orderRef: "n/a",
    status: "cleared",
  },
  ...over,
});

async function runVerify(root) {
  return verifyAssets({
    root,
    dist: join(root, "dist"),
    licenses: join(root, "assets", "LICENSES.md"),
    manifestModule: join(root, "src", "render3d", "assets", "manifest.ts"),
    skipNetwork: true,
  });
}

describe("parseLicensesMarkdown", () => {
  it("parses 11-column rows", () => {
    const md =
      HEADER +
      `| a | assets/a.webp | n | 程序化 | scripts/x.mjs | LicenseRef-GoDesk-Original | GoDesk | 2026-10-06 | 否 | 无 | G3D-11 |\n`;
    const { rows, errors } = parseLicensesMarkdown(md);
    expect(errors).toEqual([]);
    expect(rows.get("a")?.[0]).toBe("a");
  });

  it("flags empty columns", () => {
    const md =
      HEADER +
      `| a | assets/a.webp | n | 程序化 | scripts/x.mjs | LicenseRef-GoDesk-Original | GoDesk | 2026-10-06 | 否 |  | G3D-11 |\n`;
    const { errors } = parseLicensesMarkdown(md);
    expect(errors.some((e) => e.includes("空列"))).toBe(true);
  });
});

describe("verifyAssets intentional failures", () => {
  let root;
  beforeEach(() => {
    root = FIX();
    mkdirSync(root, { recursive: true });
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("passes empty registry", async () => {
    writeFixture(root, {
      manifest: [],
      licenses: `# t\n\n${HEADER}\n`,
    });
    const r = await runVerify(root);
    expect(r.ok).toBe(true);
  });

  it("fails unregistered dist asset file", async () => {
    writeFixture(root, {
      manifest: [clearedEntry()],
      licenses:
        `# t\n\n${HEADER}` +
        `| ui/paper-noise | assets/ui/paper-noise.webp | 纸纹 | 程序化 | scripts/gen-paper.mjs | LicenseRef-GoDesk-Original | GoDesk | 2026-10-06 | 否 | 无 | G3D-11 |\n`,
      distFiles: ["assets/ui/paper-noise.webp", "assets/ui/orphan.webp"],
    });
    const r = await runVerify(root);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("orphan.webp"))).toBe(true);
  });

  it('fails status = "pending"', async () => {
    const entry = clearedEntry({
      license: { ...clearedEntry().license, status: "pending" },
    });
    writeFixture(root, {
      manifest: [entry],
      licenses:
        `# t\n\n${HEADER}` +
        `| ui/paper-noise | assets/ui/paper-noise.webp | 纸纹 | 程序化 | scripts/gen-paper.mjs | LicenseRef-GoDesk-Original | GoDesk | 2026-10-06 | 否 | 无 | G3D-11 |\n`,
      distFiles: ["assets/ui/paper-noise.webp"],
    });
    const r = await runVerify(root);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("cleared"))).toBe(true);
  });

  it("fails missing LICENSES row", async () => {
    const entry = clearedEntry();
    writeFixture(root, {
      manifest: [entry],
      licenses: `# t\n\n${HEADER}\n`,
      distFiles: ["assets/ui/paper-noise.webp"],
    });
    const r = await runVerify(root);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("缺行"))).toBe(true);
  });

  it("fails non-whitelist license CC-BY-4.0", async () => {
    const entry = clearedEntry({
      license: { ...clearedEntry().license, spdx: "CC-BY-4.0" },
    });
    writeFixture(root, {
      manifest: [entry],
      licenses:
        `# t\n\n${HEADER}` +
        `| ui/paper-noise | assets/ui/paper-noise.webp | 纸纹 | 程序化 | scripts/gen-paper.mjs | CC-BY-4.0 | GoDesk | 2026-10-06 | 否 | 无 | G3D-11 |\n`,
      distFiles: ["assets/ui/paper-noise.webp"],
    });
    const r = await runVerify(root);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("白名单") && e.includes("CC-BY-4.0"))).toBe(
      true,
    );
  });
});
