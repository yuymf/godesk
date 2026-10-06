/**
 * G3D-07 · G3D-22 PBR 套件（KTX2，双分辨率）的 URL 表与加载。
 *
 * 位于 render3d-assets chunk：只在可交互后由 SceneHost 动态 import，
 * 不进入首页包，也不计入 3D 核心 chunk（SPEC §5.5.3「可交互后」分组）。
 */
import { NoColorSpace, SRGBColorSpace, type Texture, type WebGLRenderer } from "three";
import type { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { createAssetLoaders, disposeAssetLoaders, type AssetLoaders } from "./loaders";
import type { PbrMaps } from "../materials";
import type { PbrSetId } from "../tokens";

const PBR_URLS = import.meta.glob("../../../assets/textures/pbr/*/*/*.ktx2", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export type PbrResolution = 512 | 256;
export type PbrSetUrls = { baseColor: string; normal: string; orm: string };

/** 纯函数：从 glob 结果里取一套贴图的 URL（三张缺一即返回 null）。 */
export function pbrSetUrls(
  set: PbrSetId,
  resolution: PbrResolution,
  urls: Record<string, string> = PBR_URLS,
): PbrSetUrls | null {
  const pick = (name: string) => {
    const suffix = `/textures/pbr/${set}/${resolution}/${name}.ktx2`;
    const key = Object.keys(urls).find((path) => path.endsWith(suffix));
    return key ? urls[key]! : null;
  };
  const baseColor = pick("baseColor");
  const normal = pick("normal");
  const orm = pick("orm");
  if (!baseColor || !normal || !orm) return null;
  return { baseColor, normal, orm };
}

/** 本构建打包了哪些套件（用于测试与证据）。 */
export function bundledPbrSets(urls: Record<string, string> = PBR_URLS): string[] {
  const sets = new Set<string>();
  for (const path of Object.keys(urls)) {
    const match = /\/textures\/pbr\/([^/]+)\/(512|256)\//.exec(path);
    if (match) sets.add(match[1]!);
  }
  return [...sets].sort();
}

/**
 * 跨挂载的字节缓存。运行时降档到 low 会重建 SceneHost（MSAA 只能在构造时设置），
 * 这里保留已下载的 KTX2 字节，重建后不再重复请求（每套 512 ≤ 220 KB，11 套上限约 2.4 MB）。
 */
const byteCache = new Map<string, Promise<ArrayBuffer>>();

function fetchBytes(url: string): Promise<ArrayBuffer> {
  let pending = byteCache.get(url);
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`KTX2 ${response.status}: ${url}`);
      return response.arrayBuffer();
    });
    byteCache.set(url, pending);
    pending.catch(() => byteCache.delete(url));
  }
  return pending;
}

/**
 * 纯函数：选择要加载的一套贴图。low 档要 256 时，若同一套 512 已在本页下载过（降档前），
 * 直接复用 512，不再下载 256。
 */
export function pickPbrUrls(
  set: PbrSetId,
  resolution: PbrResolution,
  isCached: (url: string) => boolean = (url) => byteCache.has(url),
  urls: Record<string, string> = PBR_URLS,
): { urls: PbrSetUrls; resolution: PbrResolution } | null {
  if (resolution === 256) {
    const high = pbrSetUrls(set, 512, urls);
    if (high && isCached(high.baseColor) && isCached(high.normal) && isCached(high.orm)) {
      return { urls: high, resolution: 512 };
    }
  }
  const own = pbrSetUrls(set, resolution, urls);
  return own ? { urls: own, resolution } : null;
}

async function loadTexture(loader: KTX2Loader, url: string, srgb: boolean): Promise<Texture> {
  const bytes = await fetchBytes(url);
  // KTX2Loader 会把 buffer 转移给 worker（转移后原 buffer 失效），所以每次传副本。
  const texture = await new Promise<Texture>((resolve, reject) => {
    loader.parse(bytes.slice(0), resolve, reject);
  });
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export type PbrLoaded = { maps: PbrMaps; resolution: PbrResolution };

export type PbrStreamer = {
  load(set: PbrSetId, resolution: PbrResolution): Promise<PbrLoaded | null>;
  dispose(): void;
};

/**
 * 创建流式加载器：KTX2 Basis 转码在 worker 中进行（转码器为 Vite 打包的带 hash 独立文件，首次加载贴图时拉取）。
 */
export function createPbrStreamer(renderer: WebGLRenderer): PbrStreamer {
  let loaders: AssetLoaders | null = createAssetLoaders(renderer);
  return {
    async load(set, resolution) {
      const picked = pickPbrUrls(set, resolution);
      if (!picked || !loaders) return null;
      const ktx2 = loaders.ktx2;
      const [map, normalMap, ormMap] = await Promise.all([
        loadTexture(ktx2, picked.urls.baseColor, true),
        loadTexture(ktx2, picked.urls.normal, false),
        loadTexture(ktx2, picked.urls.orm, false),
      ]);
      return { maps: { map, normalMap, ormMap }, resolution: picked.resolution };
    },
    dispose() {
      if (loaders) disposeAssetLoaders(loaders);
      loaders = null;
    },
  };
}
