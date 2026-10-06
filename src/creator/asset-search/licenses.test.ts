import { describe, expect, it } from "vitest";
import type { AssetServerAsset } from "./types";
import {
  importEligibility,
  importedAssetId,
  importedAssetFolder,
  licenseRowFromAsset,
  mapLicenseNameToSpdx,
  upsertLicenseRow,
} from "./licenses";

/** Same 11-column parse as `scripts/verify-assets.mjs` (keep tests free of .mjs imports). */
function parseLicensesMarkdown(text: string) {
  const errors: string[] = [];
  const rows = new Map<string, string[]>();
  let headerSeen = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed.split("|").slice(1, -1).map((cell) => cell.trim());
    if (!headerSeen) {
      if (cells[0] === "资产 id" || cells[0] === "资产id") headerSeen = true;
      continue;
    }
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (cells.length !== 11) {
      errors.push(`LICENSES 行列数不是 11：${trimmed.slice(0, 80)}`);
      continue;
    }
    if (cells.some((cell) => cell.length === 0)) {
      errors.push(`LICENSES 行存在空列：id=${cells[0] ?? "(空)"}`);
      continue;
    }
    rows.set(cells[0]!, cells);
  }
  if (!headerSeen) errors.push("LICENSES.md 缺少表头「资产 id」");
  return { rows, errors };
}

const tree: AssetServerAsset = {
  id: "polyhaven:tree_small_02",
  provider: "polyhaven",
  nativeId: "tree_small_02",
  title: "Tree Small 02",
  type: "model",
  tags: ["tree"],
  url: "https://polyhaven.com/a/tree_small_02",
  author: "Rico Cilliers",
  license: { name: "CC0", attributionRequired: false },
  price: { free: true },
  downloadable: true,
};

describe("asset-search licenses", () => {
  it("maps CC0 names onto the verify:assets whitelist", () => {
    expect(mapLicenseNameToSpdx("CC0")).toBe("CC0-1.0");
    expect(mapLicenseNameToSpdx("cc0-1.0")).toBe("CC0-1.0");
    expect(mapLicenseNameToSpdx("CC-BY-4.0")).toBeNull();
  });

  it("allows free direct CC0 imports and refuses link-only / paid / unknown SPDX", () => {
    expect(importEligibility(tree)).toMatchObject({
      ok: true,
      license: { spdx: "CC0-1.0", sourceType: "CC0", attributionRequired: false },
    });
    expect(importEligibility({ ...tree, downloadable: false })).toMatchObject({ ok: false });
    expect(importEligibility({ ...tree, provider: "fab", downloadable: false })).toMatchObject({
      ok: false,
      reason: expect.stringContaining("仅外链"),
    });
    expect(importEligibility({ ...tree, price: { free: false } }).ok).toBe(false);
    expect(importEligibility({
      ...tree,
      license: { name: "TurboSquid Checkmate", attributionRequired: true },
    }).ok).toBe(false);
  });

  it("writes an 11-column LICENSES.md row that parseLicensesMarkdown accepts", () => {
    const mapped = importEligibility(tree);
    if (!mapped.ok) throw new Error(mapped.reason);
    const path = `${importedAssetFolder(tree)}/tree.glb`;
    const row = licenseRowFromAsset(tree, path, "2026-10-06", mapped.license);
    const markdown = upsertLicenseRow("", row);
    const parsed = parseLicensesMarkdown(markdown);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.get(importedAssetId(tree))).toEqual([
      "imported/polyhaven-tree_small_02",
      "assets/imported/polyhaven-tree_small_02/tree.glb",
      "Tree Small 02",
      "CC0",
      "https://polyhaven.com/a/tree_small_02",
      "CC0-1.0",
      "Rico Cilliers",
      "2026-10-06",
      "否",
      "无",
      "Tidewell-import",
    ]);
  });

  it("replaces an existing row with the same asset id", () => {
    const mapped = importEligibility(tree);
    if (!mapped.ok) throw new Error(mapped.reason);
    const first = licenseRowFromAsset(tree, "assets/imported/polyhaven-tree_small_02/a.glb", "2026-10-06", mapped.license);
    const second = licenseRowFromAsset(tree, "assets/imported/polyhaven-tree_small_02/b.glb", "2026-10-06", mapped.license);
    const markdown = upsertLicenseRow(upsertLicenseRow("", first), second);
    const parsed = parseLicensesMarkdown(markdown);
    expect(parsed.rows.size).toBe(1);
    expect(parsed.rows.get(importedAssetId(tree))?.[1]).toContain("b.glb");
  });
});
