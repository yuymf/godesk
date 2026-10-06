// Box live proxy smoke: ASSET_SERVER_URL → 127.0.0.1:8787 (2026-10-07).
import { MAX_IMPORT_BYTES, importTooLargeMessage, normalizeAssetServerUrl } from "../src/creator/asset-search/config";
import { assetDownloadUrl, filenameFromDisposition } from "../src/creator/asset-search/client";
import { error, json } from "./project-operations";

const ASSET_ID = /^[a-z0-9][a-z0-9._-]*:[A-Za-z0-9._~%-]+$/i;

export function assetServerUrlFromEnv(env: Env): string {
  return normalizeAssetServerUrl(env.ASSET_SERVER_URL);
}

export function isAssetServerApi(url: URL): boolean {
  return (
    url.pathname === "/api/asset-server" ||
    url.pathname === "/api/asset-search" ||
    url.pathname === "/api/asset-download"
  );
}

export async function assetServerApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const baseUrl = assetServerUrlFromEnv(env);
  if (request.method === "GET" && url.pathname === "/api/asset-server") {
    return json({ baseUrl });
  }
  if (request.method === "GET" && url.pathname === "/api/asset-search") {
    return proxyAssetSearch(baseUrl, url);
  }
  if (request.method === "GET" && url.pathname === "/api/asset-download") {
    return proxyAssetDownload(baseUrl, url);
  }
  return error("没有这个 API。", 404);
}

async function proxyAssetSearch(baseUrl: string, url: URL): Promise<Response> {
  const upstream = new URL("/v1/search", `${baseUrl}/`);
  upstream.search = url.search;
  try {
    const response = await fetch(upstream, { headers: { accept: "application/json" } });
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "unknown";
    return error(
      `3D 资产服务不可用（${baseUrl}）。请先在本机启动 3d-asset-server，见 docs/asset-server.md（${detail}）。`,
      502,
    );
  }
}

async function proxyAssetDownload(baseUrl: string, url: URL): Promise<Response> {
  const id = url.searchParams.get("id") ?? "";
  if (!ASSET_ID.test(id)) return error("资产 id 无效。", 400);
  const format = url.searchParams.get("format") ?? undefined;
  const resolution = url.searchParams.get("resolution") ?? undefined;
  const target = assetDownloadUrl(baseUrl, id, { format, resolution });
  try {
    const response = await fetch(target);
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      return error(body.error ?? `资产下载失败（${response.status}）。`, response.status === 409 ? 409 : 502);
    }
    const limited = await readBodyWithinBudget(response);
    if (limited instanceof Response) return limited;
    const copy = new Uint8Array(limited.byteLength);
    copy.set(limited);
    const filename = filenameFromDisposition(
      response.headers.get("content-disposition"),
      `${id.replace(/[^A-Za-z0-9._-]+/g, "-")}.bin`,
    );
    return new Response(copy, {
      status: 200,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/octet-stream",
        "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "cache-control": "no-store",
      },
    });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "unknown";
    return error(
      `3D 资产服务不可用（${baseUrl}）。请先在本机启动 3d-asset-server，见 docs/asset-server.md（${detail}）。`,
      502,
    );
  }
}

export function isValidAssetServerId(id: string): boolean {
  return ASSET_ID.test(id);
}

/** Stream sidecar bytes and abort before SQLite/DO can see a >2 MB blob. */
async function readBodyWithinBudget(response: Response): Promise<Uint8Array | Response> {
  const announced = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(announced) && announced > MAX_IMPORT_BYTES) {
    return error(importTooLargeMessage(announced), 413);
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMPORT_BYTES) return error(importTooLargeMessage(bytes.byteLength), 413);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMPORT_BYTES) {
      await reader.cancel();
      return error(importTooLargeMessage(total), 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
