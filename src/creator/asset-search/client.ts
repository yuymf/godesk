import { DEFAULT_ASSET_SERVER_URL, MAX_IMPORT_BYTES, normalizeAssetServerUrl } from "./config";
import type {
  AssetSearchQuery,
  AssetSearchResponse,
  AssetServerAsset,
  AssetServerConfig,
} from "./types";

export function buildSearchParams(query: AssetSearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  const q = query.q.trim();
  if (q) params.set("q", q);
  if (query.type) params.set("type", query.type);
  if (query.providers && query.providers.length > 0) {
    params.set("providers", query.providers.join(","));
  }
  if (query.free) params.set("free", "true");
  if (query.downloadable) params.set("downloadable", "true");
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  return params;
}

export function assetSearchUrl(baseUrl: string, query: AssetSearchQuery): string {
  const base = normalizeAssetServerUrl(baseUrl);
  const params = buildSearchParams(query);
  return `${base}/v1/search?${params.toString()}`;
}

export function assetDownloadUrl(
  baseUrl: string,
  assetId: string,
  options: { format?: string; resolution?: string } = {},
): string {
  const base = normalizeAssetServerUrl(baseUrl);
  const params = new URLSearchParams();
  if (options.format) params.set("format", options.format);
  if (options.resolution) params.set("resolution", options.resolution);
  const suffix = params.toString();
  return `${base}/v1/assets/${encodeURIComponent(assetId)}/download${suffix ? `?${suffix}` : ""}`;
}

export function parseSearchResponse(value: unknown): AssetSearchResponse {
  if (!value || typeof value !== "object") {
    throw new Error("资产搜索响应无效。");
  }
  const body = value as Partial<AssetSearchResponse>;
  if (!Array.isArray(body.results) || !Array.isArray(body.providers)) {
    throw new Error("资产搜索响应缺少 results / providers。");
  }
  return {
    query: typeof body.query === "string" ? body.query : "",
    types: Array.isArray(body.types) ? body.types.map(String) : undefined,
    results: body.results.map(parseAsset),
    providers: body.providers.map(parseProvider),
  };
}

function parseAsset(value: unknown): AssetServerAsset {
  if (!value || typeof value !== "object") {
    throw new Error("资产条目无效。");
  }
  const asset = value as Partial<AssetServerAsset>;
  if (typeof asset.id !== "string" || !asset.id) {
    throw new Error("资产缺少 id。");
  }
  return {
    id: asset.id,
    provider: String(asset.provider ?? asset.id.split(":")[0] ?? "unknown"),
    nativeId: String(asset.nativeId ?? asset.id.split(":")[1] ?? asset.id),
    title: String(asset.title ?? asset.id),
    description: typeof asset.description === "string" ? asset.description : undefined,
    type: String(asset.type ?? "other"),
    tags: Array.isArray(asset.tags) ? asset.tags.map(String) : [],
    categories: Array.isArray(asset.categories) ? asset.categories.map(String) : undefined,
    url: String(asset.url ?? ""),
    thumbnailUrl: typeof asset.thumbnailUrl === "string" ? asset.thumbnailUrl : undefined,
    author: typeof asset.author === "string" ? asset.author : undefined,
    license: asset.license && typeof asset.license === "object"
      ? {
          name: String(asset.license.name ?? "未知"),
          url: typeof asset.license.url === "string" ? asset.license.url : undefined,
          commercialUse: asset.license.commercialUse,
          attributionRequired: asset.license.attributionRequired,
        }
      : undefined,
    price: asset.price && typeof asset.price === "object"
      ? {
          free: Boolean(asset.price.free),
          amount: asset.price.amount,
          currency: asset.price.currency,
        }
      : undefined,
    formats: Array.isArray(asset.formats) ? asset.formats.map(String) : undefined,
    resolutions: Array.isArray(asset.resolutions) ? asset.resolutions.map(String) : undefined,
    polyCount: typeof asset.polyCount === "number" ? asset.polyCount : undefined,
    downloadable: Boolean(asset.downloadable),
    score: typeof asset.score === "number" ? asset.score : undefined,
  };
}

function parseProvider(value: unknown): AssetSearchResponse["providers"][number] {
  if (!value || typeof value !== "object") {
    return { provider: "unknown", name: "unknown", status: "error", count: 0, tookMs: 0 };
  }
  const report = value as Partial<AssetSearchResponse["providers"][number]>;
  return {
    provider: String(report.provider ?? "unknown"),
    name: String(report.name ?? report.provider ?? "unknown"),
    status: String(report.status ?? "error"),
    count: Number(report.count ?? 0),
    tookMs: Number(report.tookMs ?? 0),
    searchUrl: typeof report.searchUrl === "string" ? report.searchUrl : undefined,
    error: typeof report.error === "string" ? report.error : undefined,
    total: typeof report.total === "number" ? report.total : undefined,
  };
}

export function parseAssetServerConfig(value: unknown): AssetServerConfig {
  if (!value || typeof value !== "object") {
    return { baseUrl: DEFAULT_ASSET_SERVER_URL };
  }
  const body = value as { baseUrl?: unknown };
  return { baseUrl: normalizeAssetServerUrl(typeof body.baseUrl === "string" ? body.baseUrl : "") };
}

export async function searchAssetServer(
  baseUrl: string,
  query: AssetSearchQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<AssetSearchResponse> {
  const response = await fetchImpl(assetSearchUrl(baseUrl, query));
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `资产搜索失败（${response.status}）。`);
  }
  return parseSearchResponse(await response.json());
}

export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]);
    } catch {
      return utf[1];
    }
  }
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const plain = header.match(/filename=([^;]+)/i);
  return plain?.[1]?.trim() || fallback;
}

export async function downloadAssetBytes(
  baseUrl: string,
  assetId: string,
  options: { format?: string; resolution?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<{ filename: string; mimeType: string; bytes: Uint8Array }> {
  const response = await fetchImpl(assetDownloadUrl(baseUrl, assetId, options));
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `资产下载失败（${response.status}）。`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new Error(`资产超过 ${MAX_IMPORT_BYTES} 字节上限，未写入项目。`);
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim()
    || "application/octet-stream";
  const filename = filenameFromDisposition(
    response.headers.get("content-disposition"),
    `${assetId.replace(/[^A-Za-z0-9._-]+/g, "-")}.bin`,
  );
  return { filename, mimeType, bytes: buffer };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
