import { MAX_IMPORT_BYTES } from "../src/creator/asset-search/config";
import {
  importEligibility,
  importedAssetId,
  licenseRowFromAsset,
  todayUtcDate,
  upsertLicenseRow,
} from "../src/creator/asset-search/licenses";
import type {
  AssetServerAsset,
  ImportedAssetFile,
  ImportedProjectAsset,
} from "../src/creator/asset-search/types";
import type { SourceLibraryEntry } from "../src/creator/project-contract";
import type { ProjectRecord } from "./project-operations";

const LICENSES_SOURCE_NAME = "assets/LICENSES.md";

export interface DecodedImportFile {
  path: string;
  mimeType: string;
  bytes: Uint8Array;
}

export function decodeImportFiles(files: ImportedAssetFile[]): DecodedImportFile[] {
  if (!Array.isArray(files) || files.length < 1) {
    throw new Error("import_files_required");
  }
  const decoded: DecodedImportFile[] = [];
  let total = 0;
  for (const file of files) {
    if (!file || typeof file.relativePath !== "string" || typeof file.contentBase64 !== "string") {
      throw new Error("invalid_import_file");
    }
    const path = safeImportedPath(file.relativePath);
    const binary = Uint8Array.from(atob(file.contentBase64), (char) => char.charCodeAt(0));
    total += binary.byteLength;
    if (total > MAX_IMPORT_BYTES) throw new Error("import_too_large");
    decoded.push({
      path,
      mimeType: file.mimeType || "application/octet-stream",
      bytes: binary,
    });
  }
  return decoded;
}

export function safeImportedPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const path = normalized.startsWith("assets/imported/")
    ? normalized
    : `assets/imported/${normalized}`;
  if (
    path.includes("..") ||
    path.includes("\0") ||
    !path.startsWith("assets/imported/") ||
    path === "assets/imported/"
  ) {
    throw new Error("invalid_import_path");
  }
  return path;
}

export function applyImportedAsset(
  record: ProjectRecord,
  asset: AssetServerAsset,
  files: DecodedImportFile[],
  now = new Date(),
): ImportedProjectAsset {
  const eligibility = importEligibility(asset);
  if (!eligibility.ok) throw new Error(eligibility.reason);
  const primary = files[0];
  if (!primary) throw new Error("import_files_required");
  const obtainedAt = todayUtcDate(now);
  const row = licenseRowFromAsset(asset, primary.path, obtainedAt, eligibility.license);
  record.importedLicensesMarkdown = upsertLicenseRow(record.importedLicensesMarkdown ?? "", row);
  const entry: ImportedProjectAsset = {
    id: importedAssetId(asset),
    assetServerId: asset.id,
    title: asset.title,
    provider: asset.provider,
    path: primary.path,
    bytes: primary.bytes.byteLength,
    mimeType: primary.mimeType,
    licenseSpdx: eligibility.license.spdx,
    licenseName: asset.license?.name ?? eligibility.license.spdx,
    attributionRequired: eligibility.license.attributionRequired,
    sourceUrl: asset.url,
    author: asset.author || asset.provider,
    createdAt: now.toISOString(),
  };
  const existing = (record.importedAssets ?? []).filter((item) => item.id !== entry.id);
  record.importedAssets = [...existing, entry];
  upsertLicensesSource(record, now.toISOString());
  return entry;
}

function upsertLicensesSource(record: ProjectRecord, createdAt: string) {
  const content = (record.importedLicensesMarkdown ?? "").slice(0, 100_000);
  const next: SourceLibraryEntry = {
    id: `source_${crypto.randomUUID()}`,
    kind: "brief",
    name: LICENSES_SOURCE_NAME,
    content,
    readiness: "ready",
    provenance: {
      origin: "creator-upload",
      locator: "assets/LICENSES.md",
    },
    createdAt,
  };
  const index = record.sources.findIndex((source) => source.name === LICENSES_SOURCE_NAME);
  if (index >= 0) {
    const current = record.sources[index]!;
    record.sources[index] = { ...next, id: current.id, createdAt: current.createdAt };
  } else {
    record.sources.push(next);
  }
}

export function importedBlobKey(projectId: string, assetId: string): string {
  return `imported-blob:${projectId}:${assetId}`;
}
