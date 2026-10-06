import { isLinkOnlyProvider } from "./config";
import type { AssetServerAsset } from "./types";

/** Same SPDX whitelist as `scripts/verify-assets.mjs` (SPEC §5.4). */
export const LICENSE_WHITELIST = [
  "CC0-1.0",
  "OFL-1.1",
  "LicenseRef-GoDesk-Original",
  "LicenseRef-Purchased",
  "LicenseRef-AI-Generated",
] as const;

export type LicenseSpdx = (typeof LICENSE_WHITELIST)[number];

export const LICENSES_TABLE_HEADER =
  "| 资产 id | 文件路径 | 名称 | 来源类型 | 来源 URL | 许可证 SPDX | 作者 | 获取日期 | 是否修改 | 修改说明 | 使用任务 |";

export const LICENSES_TABLE_DIVIDER =
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |";

export const LICENSES_PREAMBLE = `# 资产许可证登记册（assets/LICENSES.md）

本表按 SPEC §5.4：每个资产文件 1 行。Game Project 导入的外部素材写在 \`assets/imported/\`。
提升进仓库 Tidewell 套件时，须同步登记 \`src/render3d/assets/manifest.ts\`，否则 \`pnpm verify:assets\` 会失败。

许可证白名单：\`CC0-1.0\`、\`OFL-1.1\`、\`LicenseRef-GoDesk-Original\`、\`LicenseRef-Purchased\`、\`LicenseRef-AI-Generated\`。

`;

const SOURCE_TYPE: Record<LicenseSpdx, string> = {
  "CC0-1.0": "CC0",
  "OFL-1.1": "OFL",
  "LicenseRef-GoDesk-Original": "自制",
  "LicenseRef-Purchased": "购买",
  "LicenseRef-AI-Generated": "AI生成",
};

export interface MappedLicense {
  spdx: LicenseSpdx;
  sourceType: string;
  attributionRequired: boolean;
}

export interface ImportRefusal {
  ok: false;
  reason: string;
}

export interface ImportReady {
  ok: true;
  license: MappedLicense;
}

export type ImportEligibility = ImportReady | ImportRefusal;

export function sanitizeCell(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").replace(/\|/g, "/").trim();
  return trimmed.length > 0 ? trimmed : "无";
}

export function mapLicenseNameToSpdx(name: string | undefined): LicenseSpdx | null {
  const key = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  if (
    key === "cc0" ||
    key === "cc0-1.0" ||
    key === "cc0 1.0" ||
    key === "public domain" ||
    key.includes("cc0")
  ) {
    return "CC0-1.0";
  }
  if (key === "ofl" || key === "ofl-1.1" || key.includes("open font")) {
    return "OFL-1.1";
  }
  return null;
}

export function isLinkOnlyAsset(asset: Pick<AssetServerAsset, "provider" | "downloadable">): boolean {
  return !asset.downloadable || isLinkOnlyProvider(asset.provider);
}

export function importEligibility(asset: AssetServerAsset): ImportEligibility {
  if (isLinkOnlyAsset(asset)) {
    return { ok: false, reason: "该来源仅外链，不能直接写入项目。" };
  }
  if (asset.price && asset.price.free === false) {
    return { ok: false, reason: "付费资产未接入（本面板不使用付费 API key）。" };
  }
  const spdx = mapLicenseNameToSpdx(asset.license?.name);
  if (!spdx) {
    return {
      ok: false,
      reason: `许可证「${asset.license?.name ?? "未知"}」不在 verify:assets 白名单，未写入项目。`,
    };
  }
  return {
    ok: true,
    license: {
      spdx,
      sourceType: SOURCE_TYPE[spdx],
      attributionRequired: Boolean(asset.license?.attributionRequired),
    },
  };
}

export function importedAssetId(asset: Pick<AssetServerAsset, "provider" | "nativeId" | "id">): string {
  const raw = `${asset.provider}-${asset.nativeId || asset.id}`.toLowerCase();
  const safe = raw.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `imported/${safe || "asset"}`;
}

export function importedAssetFolder(asset: Pick<AssetServerAsset, "provider" | "nativeId" | "id">): string {
  return `assets/imported/${importedAssetId(asset).slice("imported/".length)}`;
}

export function licenseRowCells(input: {
  id: string;
  filePath: string;
  title: string;
  sourceType: string;
  sourceUrl: string;
  spdx: string;
  author: string;
  obtainedAt: string;
  modified?: boolean;
  modificationNote?: string;
  orderRef?: string;
}): string[] {
  return [
    sanitizeCell(input.id),
    sanitizeCell(input.filePath),
    sanitizeCell(input.title),
    sanitizeCell(input.sourceType),
    sanitizeCell(input.sourceUrl),
    sanitizeCell(input.spdx),
    sanitizeCell(input.author),
    sanitizeCell(input.obtainedAt),
    input.modified ? "是" : "否",
    sanitizeCell(input.modificationNote ?? "无"),
    sanitizeCell(input.orderRef ?? "Tidewell-import"),
  ];
}

export function formatLicenseRow(cells: string[]): string {
  if (cells.length !== 11) {
    throw new Error(`LICENSES 行列数必须为 11，实际 ${cells.length}。`);
  }
  if (cells.some((cell) => cell.length === 0)) {
    throw new Error("LICENSES 行存在空列。");
  }
  return `| ${cells.join(" | ")} |`;
}

export function licenseRowFromAsset(
  asset: AssetServerAsset,
  filePath: string,
  obtainedAt: string,
  mapped: MappedLicense,
): string {
  return formatLicenseRow(
    licenseRowCells({
      id: importedAssetId(asset),
      filePath,
      title: asset.title,
      sourceType: mapped.sourceType,
      sourceUrl: asset.url || asset.license?.url || "https://polyhaven.com",
      spdx: mapped.spdx,
      author: asset.author || asset.provider,
      obtainedAt,
      modificationNote: mapped.attributionRequired ? "需署名；未改文件" : "无",
      orderRef: "Tidewell-import",
    }),
  );
}

export function upsertLicenseRow(markdown: string, row: string): string {
  const id = row.split("|").map((part) => part.trim()).filter(Boolean)[0];
  const body = markdown.trim().length > 0 ? markdown : `${LICENSES_PREAMBLE}${LICENSES_TABLE_HEADER}\n${LICENSES_TABLE_DIVIDER}\n`;
  const lines = body.replace(/\s+$/, "").split(/\r?\n/);
  const rowPattern = new RegExp(`^\\|\\s*${escapeRegExp(id)}\\s*\\|`);
  let replaced = false;
  const next = lines.map((line) => {
    if (rowPattern.test(line.trim())) {
      replaced = true;
      return row;
    }
    return line;
  });
  if (!replaced) {
    const hasHeader = next.some((line) => line.includes("资产 id"));
    if (!hasHeader) {
      next.push("", LICENSES_TABLE_HEADER, LICENSES_TABLE_DIVIDER);
    }
    next.push(row);
  }
  return `${next.join("\n")}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function todayUtcDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
