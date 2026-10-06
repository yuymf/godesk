/** Default 3d-asset-server sidecar (engineering box binds HOST=localhost; live smoke 2026-10-07). */
export const DEFAULT_ASSET_SERVER_URL = "http://127.0.0.1:8787";

/** Free sources that support direct download without paid API keys. */
export const PREFERRED_PROVIDERS = [
  "polyhaven",
  "ambientcg",
  "kenney",
  "texturecan",
  "blenderkit",
  "hdrmaps",
] as const;

/** Sites that only return a search/asset page. Never fetch files. */
export const LINK_ONLY_PROVIDERS = ["fab", "poliigon", "turbosquid"] as const;

export const PROVIDER_LABELS: Record<string, string> = {
  polyhaven: "Poly Haven",
  ambientcg: "ambientCG",
  kenney: "Kenney",
  texturecan: "TextureCan",
  blenderkit: "BlenderKit",
  hdrmaps: "HDRMaps",
  fab: "Fab",
  poliigon: "Poliigon",
  turbosquid: "TurboSquid",
  cgbookcase: "CGBookcase",
  sharetextures: "ShareTextures",
  quaternius: "Quaternius",
  threedtextures: "3DTextures.me",
  texturescom: "Textures.com",
  hdrihub: "HDRI Hub",
  cgtrader: "CGTrader",
  itchio: "itch.io",
};

export const SEARCH_TYPES = [
  { id: "", label: "全部" },
  { id: "model", label: "模型" },
  { id: "material", label: "材质" },
  { id: "hdri", label: "HDRI" },
] as const;

export const MAX_IMPORT_BYTES = 12 * 1024 * 1024;

export function providerLabel(id: string): string {
  return PROVIDER_LABELS[id] ?? id;
}

export function isPreferredProvider(id: string): boolean {
  return (PREFERRED_PROVIDERS as readonly string[]).includes(id);
}

export function isLinkOnlyProvider(id: string): boolean {
  return (LINK_ONLY_PROVIDERS as readonly string[]).includes(id);
}

export function normalizeAssetServerUrl(raw: string | undefined | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_ASSET_SERVER_URL;
  return trimmed.replace(/\/+$/, "");
}
