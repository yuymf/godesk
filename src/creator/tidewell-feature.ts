/**
 * G3D-16: homepage-only Tidewell showcase flag.
 * Spec name: GODESK_FEATURE_TIDEWELL (default off). Controls CreatorHome gallery only.
 *
 * Resolution order (first wins):
 * 1. `?tidewell=1` / `?tidewell=0` query (e2e + local preview without rebuild)
 * 2. `GODESK_FEATURE_TIDEWELL` / `VITE_GODESK_FEATURE_TIDEWELL` env ("1"/"true")
 */

export function resolveTidewellHomepageFlag(input: {
  searchParams?: URLSearchParams | null;
  envValue?: string | boolean | undefined;
}): boolean {
  const raw = input.searchParams?.get("tidewell") ?? null;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  const value = input.envValue;
  return value === "1" || value === "true" || value === true;
}

export function isTidewellHomepageEnabled(): boolean {
  const env = (
    (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env ?? {}
  );
  return resolveTidewellHomepageFlag({
    searchParams:
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null,
    envValue: env.GODESK_FEATURE_TIDEWELL ?? env.VITE_GODESK_FEATURE_TIDEWELL,
  });
}
