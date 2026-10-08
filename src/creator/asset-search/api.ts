/**
 * Studio-only HTTP for the 3d-asset-server sidecar.
 * Lives here (not in project-api.ts) so the homepage bundle does not keep
 * search/download helpers that only the lazy Studio panel calls.
 */
import { ProjectApiError } from "../project-api";
import { mountHref } from "../../public-mount";
import { buildSearchParams } from "./client";
import { filenameFromDisposition } from "./disposition";
import type {
  AssetSearchQuery,
  AssetSearchResponse,
  AssetServerConfig,
  ImportExternalAssetInput,
  ImportExternalAssetResult,
  ImportedAssetsView,
} from "./types";

function here() {
  try {
    return window.location.pathname;
  } catch {
    return "/";
  }
}

function apiPath(path: string) {
  return mountHref(path, here());
}

async function readJson<T>(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ProjectApiError(
      body.error ?? "GoDesk 服务暂时不可用。",
      response.status,
      body,
    );
  }
  return response.json() as Promise<T>;
}

export function getAssetServerConfig() {
  return fetch(apiPath("/api/asset-server")).then(readJson<AssetServerConfig>);
}

export function searchExternalAssets(query: AssetSearchQuery) {
  return fetch(apiPath(`/api/asset-search?${buildSearchParams(query).toString()}`)).then(
    readJson<AssetSearchResponse>,
  );
}

export async function downloadImportedAssetBytes(
  assetId: string,
  options: { format?: string; resolution?: string } = {},
) {
  const params = new URLSearchParams({ id: assetId });
  if (options.format) params.set("format", options.format);
  if (options.resolution) params.set("resolution", options.resolution);
  const response = await fetch(apiPath(`/api/asset-download?${params.toString()}`));
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ProjectApiError(body.error ?? "资产下载失败。", response.status, body);
  }
  const bytes = await response.arrayBuffer();
  return {
    filename: filenameFromDisposition(
      response.headers.get("content-disposition"),
      "asset.bin",
    ),
    mimeType: response.headers.get("content-type")?.split(";")[0]?.trim()
      || "application/octet-stream",
    bytes,
  };
}

export function getImportedAssets(projectId: string) {
  return fetch(
    apiPath(`/api/projects/${encodeURIComponent(projectId)}?view=imported-assets`),
  ).then(readJson<ImportedAssetsView>);
}

export function importExternalAsset(projectId: string, input: ImportExternalAssetInput) {
  return fetch(
    apiPath(`/api/projects/${encodeURIComponent(projectId)}/imported-assets`),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  ).then(readJson<ImportExternalAssetResult>);
}
