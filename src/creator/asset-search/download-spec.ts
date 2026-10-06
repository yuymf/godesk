import type { AssetServerAsset } from "./types";

/** Runtime-friendly formats. Skip DCC sources (blend, usd) that balloon past the DO budget. */
const MODEL_FORMATS = ["glb", "gltf", "usdz", "fbx", "obj", "stl", "zip"] as const;
const MAP_FORMATS = ["jpg", "jpeg", "png", "webp", "exr", "tif", "tiff", "hdr"] as const;
const HDRI_FORMATS = ["hdr", "exr", "jpg", "jpeg"] as const;
const PACK_FORMATS = ["zip", "glb", "gltf"] as const;
const ANY_DOWNLOADABLE = [...MAP_FORMATS, ...MODEL_FORMATS, ...PACK_FORMATS, ...HDRI_FORMATS];
const SMALL_RESOLUTIONS = ["1k", "0.5k", "512", "2k"] as const;

export interface DownloadSpec {
  format?: string;
  resolution?: string;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/^\./, "");
}

function firstAvailable(preferred: readonly string[], listed: string[]): string | undefined {
  for (const item of preferred) {
    if (listed.includes(item)) return item;
  }
  return undefined;
}

function preferredFormats(type: string): readonly string[] {
  if (type === "material" || type === "texture") return MAP_FORMATS;
  if (type === "hdri") return HDRI_FORMATS;
  if (type === "pack") return PACK_FORMATS;
  return MODEL_FORMATS;
}

/**
 * Pick sidecar download query from search metadata. Never defaults to `glb`
 * when the listing has no glb (Poly Haven trees are `gltf`; bark maps are `jpg`).
 */
export function pickDownloadSpec(
  asset: Pick<AssetServerAsset, "type" | "formats" | "resolutions">,
): DownloadSpec {
  const type = String(asset.type ?? "").toLowerCase();
  const listed = (asset.formats ?? []).map(normalizeToken).filter(Boolean);
  const format = listed.length > 0
    ? firstAvailable(preferredFormats(type), listed) ?? firstAvailable(ANY_DOWNLOADABLE, listed)
    : undefined;
  const resolutions = (asset.resolutions ?? []).map(normalizeToken);
  let resolution: string | undefined;
  if (resolutions.length > 0) {
    resolution = firstAvailable(SMALL_RESOLUTIONS, resolutions);
  } else if (type === "material" || type === "texture" || type === "hdri") {
    resolution = "1k";
  }
  return { format, resolution };
}

export function describeDownloadSpec(spec: DownloadSpec): string {
  const parts = [spec.format, spec.resolution].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "来源默认格式";
}

export function downloadQuery(spec: DownloadSpec): { format?: string; resolution?: string } {
  return {
    ...(spec.format ? { format: spec.format } : {}),
    ...(spec.resolution ? { resolution: spec.resolution } : {}),
  };
}
