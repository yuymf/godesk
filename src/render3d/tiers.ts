/**
 * G3D-06 quality tiers (SPEC §4.7).
 * Auto-detect + localStorage overrides + runtime downgrade + `?tier=` force.
 */

export type RenderTierId = "high" | "medium" | "low";
export type QualityPreference = "high" | "medium" | "auto";
export type SaverPreference = "auto" | "on" | "off";
export type TierSource = "query" | "settings" | "auto" | "runtime-downgrade";

export const TIER_STORAGE_KEY = "godesk.render.tier";
export const SAVER_STORAGE_KEY = "godesk.render.saver";

export type TierCaps = {
  id: RenderTierId;
  /** Settings label (zh). */
  labelZh: string;
  dprCap: number;
  maxFps: number | null; // null = uncapped (follow refresh)
  shadowMapSize: number;
  shadowRadius: number;
  antialias: boolean;
  /** Hex tiles cast shadows. */
  tilesCastShadow: boolean;
  decorPerTile: number;
  envReflection: boolean;
};

export const TIER_CAPS: Record<RenderTierId, TierCaps> = {
  high: {
    id: "high",
    labelZh: "清晰 1.5×",
    dprCap: 1.5,
    maxFps: null,
    shadowMapSize: 2048,
    shadowRadius: 2,
    antialias: true,
    tilesCastShadow: true,
    decorPerTile: 12,
    envReflection: true,
  },
  medium: {
    id: "medium",
    labelZh: "标准 1×",
    dprCap: 1.0,
    maxFps: null,
    shadowMapSize: 1024,
    shadowRadius: 1.5,
    antialias: true,
    tilesCastShadow: true,
    decorPerTile: 6,
    envReflection: false,
  },
  low: {
    id: "low",
    labelZh: "省电",
    dprCap: 1.0,
    maxFps: 30,
    shadowMapSize: 512,
    shadowRadius: 1,
    antialias: false,
    tilesCastShadow: false,
    decorPerTile: 4,
    envReflection: false,
  },
};

export type DetectEnv = {
  pointerCoarse: boolean;
  hardwareConcurrency: number;
  /** GB; undefined when unavailable (no CDP override). */
  deviceMemoryGb: number | undefined;
  maxTextureSize: number;
  /** Mobile UA / coarse pointer used for saver=auto default. */
  preferMobileSaver: boolean;
};

export type TierResolution = {
  tier: RenderTierId;
  source: TierSource;
  caps: TierCaps;
  saverEffective: boolean;
  qualityPreference: QualityPreference;
  saverPreference: SaverPreference;
};

export function readQualityPreference(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): QualityPreference {
  const raw = storage?.getItem(TIER_STORAGE_KEY);
  if (raw === "high" || raw === "medium") return raw;
  // legacy Chinese labels
  if (raw === "清晰" || raw === "清晰 1.5×") return "high";
  if (raw === "标准" || raw === "标准 1×") return "medium";
  return "auto";
}

export function readSaverPreference(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
): SaverPreference {
  const raw = storage?.getItem(SAVER_STORAGE_KEY);
  if (raw === "on" || raw === "off" || raw === "auto") return raw;
  if (raw === "开") return "on";
  if (raw === "关") return "off";
  if (raw === "自动") return "auto";
  return "auto";
}

export function writeQualityPreference(
  value: QualityPreference,
  storage: Pick<Storage, "setItem" | "removeItem"> = localStorage,
): void {
  if (value === "auto") storage.removeItem(TIER_STORAGE_KEY);
  else storage.setItem(TIER_STORAGE_KEY, value);
}

export function writeSaverPreference(value: SaverPreference, storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(SAVER_STORAGE_KEY, value);
}

export function parseTierQuery(search: string): RenderTierId | null {
  const value = new URLSearchParams(search).get("tier");
  if (value === "high" || value === "medium" || value === "low") return value;
  return null;
}

export function effectiveSaverOn(saver: SaverPreference, preferMobileSaver: boolean): boolean {
  if (saver === "on") return true;
  if (saver === "off") return false;
  return preferMobileSaver;
}

/**
 * Hardware auto-detect (§4.7 table), ignoring user settings / query.
 * Used when quality preference is auto and saver is not forcing low.
 */
export function autoDetectTier(env: DetectEnv): RenderTierId {
  if (env.deviceMemoryGb !== undefined && env.deviceMemoryGb <= 4) return "low";
  if (env.hardwareConcurrency > 0 && env.hardwareConcurrency <= 4) return "low";
  if (env.pointerCoarse) return "low";
  if (
    !env.pointerCoarse &&
    env.hardwareConcurrency >= 8 &&
    env.maxTextureSize >= 8192
  ) {
    return "high";
  }
  return "medium";
}

export function resolveTier(options: {
  search?: string;
  quality?: QualityPreference;
  saver?: SaverPreference;
  env: DetectEnv;
  /** Runtime floor after downgrade (never auto-upgrade in-session). */
  runtimeFloor?: RenderTierId | null;
}): TierResolution {
  const search = options.search ?? (typeof location === "undefined" ? "" : location.search);
  const quality = options.quality ?? readQualityPreference();
  const saver = options.saver ?? readSaverPreference();
  const saverEffective = effectiveSaverOn(saver, options.env.preferMobileSaver);

  const queryTier = parseTierQuery(search);
  if (queryTier) {
    const tier = applyFloor(queryTier, options.runtimeFloor);
    return {
      tier,
      source: options.runtimeFloor && tier !== queryTier ? "runtime-downgrade" : "query",
      caps: TIER_CAPS[tier],
      saverEffective,
      qualityPreference: quality,
      saverPreference: saver,
    };
  }

  let base: RenderTierId;
  let source: TierSource;
  if (saverEffective) {
    base = "low";
    source = "settings";
  } else if (quality === "high" || quality === "medium") {
    base = quality;
    source = "settings";
  } else {
    base = autoDetectTier(options.env);
    source = "auto";
  }

  const tier = applyFloor(base, options.runtimeFloor);
  if (options.runtimeFloor && rank(tier) < rank(base)) source = "runtime-downgrade";

  return {
    tier,
    source,
    caps: TIER_CAPS[tier],
    saverEffective,
    qualityPreference: quality,
    saverPreference: saver,
  };
}

function rank(tier: RenderTierId): number {
  return tier === "high" ? 2 : tier === "medium" ? 1 : 0;
}

function applyFloor(tier: RenderTierId, floor: RenderTierId | null | undefined): RenderTierId {
  if (!floor) return tier;
  return rank(tier) <= rank(floor) ? tier : floor;
}

/** Downgrade one step: high→medium, medium→low, low stays. */
export function downgradeTier(tier: RenderTierId): RenderTierId {
  if (tier === "high") return "medium";
  if (tier === "medium") return "low";
  return "low";
}

/**
 * Runtime downgrade probe (§4.7): after warm-up, if median frame time over a
 * rolling 3s window exceeds the threshold for the current tier, drop one tier.
 */
export class RuntimeDowngradeMonitor {
  private samples: number[] = [];
  private lastAt: number | null = null;
  private readonly windowMs = 3_000;
  /** high→medium if median > 22ms; medium→low if median > 30ms. */
  shouldDowngrade(tier: RenderTierId, now: number, frameDeltaMs: number | null): boolean {
    if (tier === "low") return false;
    if (frameDeltaMs !== null && frameDeltaMs > 0) {
      this.samples.push(frameDeltaMs);
    }
    // Drop samples older than window by count approx at 60fps (~180) / 30fps (~90)
    const maxSamples = tier === "high" ? 200 : 120;
    while (this.samples.length > maxSamples) this.samples.shift();
    if (this.lastAt === null) {
      this.lastAt = now;
      return false;
    }
    if (now - this.lastAt < this.windowMs) return false;
    if (this.samples.length < 30) {
      this.lastAt = now;
      return false;
    }
    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    this.lastAt = now;
    this.samples = [];
    if (tier === "high" && median > 22) return true;
    if (tier === "medium" && median > 30) return true;
    return false;
  }

  reset(): void {
    this.samples = [];
    this.lastAt = null;
  }
}

export function detectEnvFromBrowser(
  gl?: WebGLRenderingContext | WebGL2RenderingContext | null,
): DetectEnv {
  const nav = typeof navigator === "undefined" ? null : navigator;
  const pointerCoarse =
    typeof matchMedia === "function" ? matchMedia("(pointer: coarse)").matches : false;
  let maxTextureSize = 2048;
  if (gl) {
    try {
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || maxTextureSize;
    } catch {
      /* ignore */
    }
  } else if (typeof document !== "undefined") {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (ctx) maxTextureSize = ctx.getParameter(ctx.MAX_TEXTURE_SIZE) || maxTextureSize;
    } catch {
      /* ignore */
    }
  }
  const deviceMemoryGb =
    nav && "deviceMemory" in nav ? Number((nav as Navigator & { deviceMemory?: number }).deviceMemory) : undefined;
  return {
    pointerCoarse,
    hardwareConcurrency: nav?.hardwareConcurrency ?? 8,
    deviceMemoryGb: Number.isFinite(deviceMemoryGb) ? deviceMemoryGb : undefined,
    maxTextureSize,
    preferMobileSaver: pointerCoarse,
  };
}

export function tierLogLine(resolution: TierResolution, reason?: string): string {
  const extra = reason ? ` reason=${reason}` : "";
  return `[godesk.tier] tier=${resolution.tier} source=${resolution.source} saver=${resolution.saverPreference}(eff=${resolution.saverEffective}) quality=${resolution.qualityPreference}${extra}`;
}
