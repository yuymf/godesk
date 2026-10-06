/**
 * G3D-08 · load G3D-19 sea-normal / foam-noise KTX2 via G3D-07 asset loaders.
 * Fetch + parse (PBR pattern): GPU upload on first draw, so abort-before-commit
 * leaves no residual textures. Fresh loaders per mount; disposed with the textures.
 */
import { RepeatWrapping, type Texture, type WebGLRenderer } from "three";

const SEA_URLS = import.meta.glob("../../../assets/textures/ktx2/{sea-normal,foam-noise}.ktx2", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function urlFor(name: "sea-normal" | "foam-noise"): string {
  const hit = Object.entries(SEA_URLS).find(([path]) => path.endsWith(`/${name}.ktx2`));
  if (!hit) throw new Error(`missing KTX2 ${name}`);
  return hit[1]!;
}

const bufferCache = new Map<string, ArrayBuffer>();

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const hit = bufferCache.get(url);
  if (hit) return hit.slice(0);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`sea KTX2 fetch ${response.status}`);
  const buffer = await response.arrayBuffer();
  bufferCache.set(url, buffer);
  return buffer.slice(0);
}

function parseKtx2(
  loader: { parse(buffer: ArrayBuffer, onLoad: (t: Texture) => void, onError?: (e: unknown) => void): void },
  bytes: ArrayBuffer,
): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.parse(bytes, resolve, reject);
  });
}

export type SeaTextures = { normal: Texture; foam: Texture; dispose(): void };

export async function loadSeaTextures(
  renderer: WebGLRenderer,
  signal?: AbortSignal,
): Promise<SeaTextures> {
  if (signal?.aborted) throw new DOMException("water mount aborted", "AbortError");
  const { createAssetLoaders, disposeAssetLoaders } = await import("../assets/loaders");
  const loaders = createAssetLoaders(renderer);
  try {
    const [normalBuf, foamBuf] = await Promise.all([
      fetchBuffer(urlFor("sea-normal")),
      fetchBuffer(urlFor("foam-noise")),
    ]);
    if (signal?.aborted) throw new DOMException("water mount aborted", "AbortError");
    const [normal, foam] = await Promise.all([
      parseKtx2(loaders.ktx2, normalBuf),
      parseKtx2(loaders.ktx2, foamBuf),
    ]);
    if (signal?.aborted) {
      normal.dispose();
      foam.dispose();
      throw new DOMException("water mount aborted", "AbortError");
    }
    for (const tex of [normal, foam]) {
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.needsUpdate = true;
    }
    return {
      normal,
      foam,
      dispose() {
        normal.dispose();
        foam.dispose();
        disposeAssetLoaders(loaders);
      },
    };
  } catch (error) {
    disposeAssetLoaders(loaders);
    throw error;
  }
}
