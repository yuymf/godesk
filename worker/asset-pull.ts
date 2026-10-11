/**
 * GoDesk ② CC0 GLB chain: one natural-language sentence → sidecar search → CC0 model →
 * GLB → project assets/imported/ + assets/LICENSES.md (reuses #153 import path).
 */
import { assetDownloadUrl, assetSearchUrl } from "../src/creator/asset-search/client";
import { MAX_IMPORT_BYTES } from "../src/creator/asset-search/config";
import { importEligibility, importedAssetFolder } from "../src/creator/asset-search/licenses";
import type { AssetSearchResponse, AssetServerAsset } from "../src/creator/asset-search/types";
import { assetServerUrlFromEnv } from "./asset-server";
import { toGlb } from "./gltf-zip-to-glb";

const ZH_TERMS: Array<[RegExp, string]> = [
  [/木?桶/, "barrel"],
  [/箱/, "crate"],
  [/树桩|树墩/, "stump"],
  [/松树|冷杉|枞/, "pine"],
  [/树/, "tree"],
  [/石|岩/, "rock"],
  [/椅/, "chair"],
  [/桌/, "table"],
  [/灯/, "lantern"],
  [/船/, "boat"],
  [/花/, "flower"],
  [/草/, "grass"],
  [/锚/, "anchor"],
  [/车站|站台|站房|小屋|木屋|屋/, "cabin"],
  [/铁轨|轨道|铁路|枕木/, "rail"],
  [/火车/, "train"],
];

const STOP_WORDS = new Set([
  "a", "an", "the", "add", "pull", "put", "get", "find", "import", "into", "to", "in", "on", "my",
  "room", "game", "project", "please", "cc0", "glb", "model", "3d", "asset", "free", "from", "of", "some", "one",
]);

/** Extract a sidecar search query from one sentence (zh keywords or English nouns). */
export function queryFromPrompt(prompt: string): string {
  const text = prompt.trim();
  for (const [pattern, term] of ZH_TERMS) {
    if (pattern.test(text)) return term;
  }
  const words = text.toLowerCase().match(/[a-z][a-z-]+/g) ?? [];
  const kept = words.filter((word) => !STOP_WORDS.has(word));
  return kept.slice(0, 3).join(" ");
}

export function isCc0ModelCandidate(asset: AssetServerAsset): boolean {
  if (asset.type !== "model" || !asset.downloadable) return false;
  const eligibility = importEligibility(asset);
  if (!eligibility.ok || eligibility.license.spdx !== "CC0-1.0") return false;
  const formats = asset.formats ?? [];
  return formats.includes("glb") || formats.includes("gltf");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export type PullResult = {
  query: string;
  asset: AssetServerAsset;
  glbBytes: number;
  importBody: Record<string, unknown>;
};

type ProjectRequest = (path: string, init?: RequestInit) => Promise<Response>;

async function jsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `${fallback}（${response.status}）`);
  return body;
}

export async function pullCc0GlbFromPrompt(
  env: Env,
  projectRequest: ProjectRequest,
  projectId: string,
  prompt: string,
  idempotencyKey: string,
): Promise<PullResult> {
  const query = queryFromPrompt(prompt);
  if (!query) throw new Error("没能从这句话里识别出要找的模型，请写明物体，例如「加一个木桶」。");
  const baseUrl = assetServerUrlFromEnv(env);
  let search: AssetSearchResponse;
  try {
    search = await jsonOrThrow<AssetSearchResponse>(
      await fetch(assetSearchUrl(baseUrl, { q: query, type: "model", free: true, downloadable: true, limit: 24 })),
      "资产搜索失败",
    );
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "unknown";
    throw new Error(`3D 资产服务不可用（${baseUrl}），见 docs/asset-server.md（${detail}）。`);
  }
  const qTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const titleScore = (asset: AssetServerAsset) => {
    const title = `${asset.title} ${asset.nativeId}`.toLowerCase();
    return qTokens.reduce((n, t) => n + (title.includes(t) ? 1 : 0), 0);
  };
  const candidates = (search.results ?? []).filter(isCc0ModelCandidate)
    .slice()
    .sort((a, b) => {
      const ts = titleScore(b) - titleScore(a);
      if (ts) return ts;
      const ag = a.formats?.includes("glb") ? 0 : 1;
      const bg = b.formats?.includes("glb") ? 0 : 1;
      if (ag !== bg) return ag - bg;
      return (a.polyCount ?? 9e9) - (b.polyCount ?? 9e9);
    });
  if (candidates.length === 0) throw new Error(`没有找到「${query}」的 CC0 可直链 glTF/GLB 模型。`);
  let lastError = "";
  for (const asset of candidates.slice(0, 8)) {
    const format = asset.formats?.includes("glb") ? "glb" : "gltf";
    const resolution = asset.resolutions?.includes("1k") ? "1k" : undefined;
    try {
      const response = await fetch(assetDownloadUrl(baseUrl, asset.id, { format, resolution }));
      if (!response.ok) throw new Error(`下载失败（${response.status}）`);
      const raw = new Uint8Array(await response.arrayBuffer());
      const glb = await toGlb(raw);
      if (glb.byteLength > MAX_IMPORT_BYTES) throw new Error("GLB 超过 1.5 MB 写入上限");
      const project = await jsonOrThrow<{ version: number }>(
        await projectRequest(`/projects/${projectId}`),
        "读取项目失败",
      );
      const folder = importedAssetFolder(asset).replace(/^assets\/imported\//, "").replace(/\/$/, "");
      const importBody = {
        expectedVersion: project.version,
        idempotencyKey,
        asset,
        files: [{
          relativePath: `${folder}/${(asset.nativeId || "model").replace(/[^A-Za-z0-9._-]+/g, "-")}.glb`,
          mimeType: "model/gltf-binary",
          contentBase64: toBase64(glb),
        }],
      };
      return { query, asset, glbBytes: glb.byteLength, importBody };
    } catch (reason) {
      lastError = reason instanceof Error ? reason.message : String(reason);
    }
  }
  throw new Error(`CC0 模型拉取失败：${lastError}`);
}
