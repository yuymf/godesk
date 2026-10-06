import { MAX_IMPORT_BYTES, normalizeAssetServerUrl } from "../src/creator/asset-search/config";
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
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMPORT_BYTES) {
      return error(`资产超过 ${MAX_IMPORT_BYTES} 字节上限，未写入项目。`, 413);
    }
    const filename = filenameFromDisposition(
      response.headers.get("content-disposition"),
      `${id.replace(/[^A-Za-z0-9._-]+/g, "-")}.bin`,
    );
    return new Response(bytes, {
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
