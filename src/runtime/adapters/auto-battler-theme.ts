/**
 * auto-battler-v1 theme (visual) data layer — renderer-agnostic, worker-safe.
 *
 * A theme is DATA: a preset id plus optional overrides for palette, table material,
 * lighting, background, camera and unit scale. The renderer only interprets these
 * fields. The shipped seaside look is simply the default preset.
 */
export const TABLE_MATERIALS = ["wood", "stone", "frost", "felt"] as const;
export type TableMaterial = (typeof TABLE_MATERIALS)[number];

export type ThemeSpec = {
  id: string;
  label: string;
  /** Scene background + fog colour. */
  background: string;
  fogNear: number;
  fogFar: number;
  table: { material: TableMaterial; base: string; rim: string; wells: string };
  tiles: { own: string; enemy: string; divider: string; dividerGlow: string };
  light: { sky: string; ground: string; hemi: number; sun: string; sunIntensity: number; exposure: number };
  /** Camera elevation in degrees (higher = more top-down) and distance multiplier (<1 = closer). */
  camera: { pitchDeg: number; distance: number };
  /** Token scale multiplier on the board. */
  unitScale: number;
  /** HUD accent tokens (CSS colours) — kept to two hues + neutrals. */
  ui: { accent: string; enemy: string; surface: string; ink: string };
};

const TIDE: ThemeSpec = {
  id: "tide", label: "海岸木桌",
  background: "#CDB898", fogNear: 26, fogFar: 48,
  table: { material: "wood", base: "#B98B5E", rim: "#6B4A2F", wells: "#4A3020" },
  tiles: { own: "#8FCFC6", enemy: "#F0A792", divider: "#7CC8C2", dividerGlow: "#BDEDE8" },
  light: { sky: "#FFF3DC", ground: "#3B2A1C", hemi: 1.2, sun: "#FFF1DA", sunIntensity: 2.4, exposure: 1 },
  camera: { pitchDeg: 44, distance: 0.86 },
  unitScale: 1.18,
  ui: { accent: "#1F8A8A", enemy: "#E2674F", surface: "#FBF6EE", ink: "#2A2420" },
};

const EMBER: ThemeSpec = {
  id: "ember", label: "熔岩石台",
  background: "#2A1D1A", fogNear: 22, fogFar: 44,
  table: { material: "stone", base: "#4A3A35", rim: "#2B211E", wells: "#1A1311" },
  tiles: { own: "#C9A27A", enemy: "#D9573B", divider: "#FF8A3D", dividerGlow: "#FFB36B" },
  light: { sky: "#FFD6A8", ground: "#3A1408", hemi: 0.85, sun: "#FFB070", sunIntensity: 2.8, exposure: 1.05 },
  camera: { pitchDeg: 48, distance: 0.84 },
  unitScale: 1.2,
  ui: { accent: "#E8893A", enemy: "#D9573B", surface: "#2E2420", ink: "#F6EDE4" },
};

const FROST: ThemeSpec = {
  id: "frost", label: "冰原雪台",
  background: "#DCE7EE", fogNear: 24, fogFar: 50,
  table: { material: "frost", base: "#E9F1F6", rim: "#8FA6B8", wells: "#6E8597" },
  tiles: { own: "#A8D8EA", enemy: "#C7B8E8", divider: "#6FC3E8", dividerGlow: "#D6F1FF" },
  light: { sky: "#F4FAFF", ground: "#6A7C8C", hemi: 1.35, sun: "#E8F4FF", sunIntensity: 2.1, exposure: 0.95 },
  camera: { pitchDeg: 40, distance: 0.88 },
  unitScale: 1.16,
  ui: { accent: "#2F7FB5", enemy: "#7B5CC4", surface: "#F6FAFC", ink: "#1E2A33" },
};

const NIGHT: ThemeSpec = {
  id: "night", label: "星夜绒桌",
  background: "#141A2E", fogNear: 24, fogFar: 46,
  table: { material: "felt", base: "#1E3A34", rim: "#2B2233", wells: "#120F18" },
  tiles: { own: "#4FC3B0", enemy: "#E46A8E", divider: "#B79CFF", dividerGlow: "#DCCBFF" },
  light: { sky: "#C9D4FF", ground: "#120E1C", hemi: 0.9, sun: "#D8DEFF", sunIntensity: 2.3, exposure: 1.1 },
  camera: { pitchDeg: 46, distance: 0.85 },
  unitScale: 1.2,
  ui: { accent: "#4FC3B0", enemy: "#E46A8E", surface: "#1C2238", ink: "#EEF0FA" },
};

export const THEME_PRESETS: Record<string, ThemeSpec> = { tide: TIDE, ember: EMBER, frost: FROST, night: NIGHT };
export const DEFAULT_THEME_ID = "tide";

export type ThemeOverrides = {
  background?: string;
  table?: Partial<ThemeSpec["table"]>;
  light?: Partial<ThemeSpec["light"]>;
  camera?: Partial<ThemeSpec["camera"]>;
  unitScale?: number;
};
/** What a configure op carries. */
export type AutoBattlerThemePatch = { preset?: string; overrides?: ThemeOverrides };

export const THEME_LIMITS = {
  pitchDeg: { min: 28, max: 70 },
  distance: { min: 0.6, max: 1.4 },
  unitScale: { min: 0.8, max: 1.6 },
  sunIntensity: { min: 0.5, max: 5 },
  exposure: { min: 0.6, max: 1.6 },
} as const;

const HEX = /^#[0-9a-fA-F]{6}$/;
const inRange = (v: unknown, r: { min: number; max: number }) => typeof v === "number" && Number.isFinite(v) && v >= r.min && v <= r.max;

/** Validate + merge over the preset. Returns null when invalid; undefined patch → default. */
export function resolveAutoBattlerTheme(raw: unknown): ThemeSpec | null {
  if (raw === undefined || raw === null) return THEME_PRESETS[DEFAULT_THEME_ID]!;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const patch = raw as AutoBattlerThemePatch;
  for (const key of Object.keys(patch)) if (key !== "preset" && key !== "overrides") return null;
  const base = THEME_PRESETS[patch.preset ?? DEFAULT_THEME_ID];
  if (!base) return null;
  const o = patch.overrides ?? {};
  if (typeof o !== "object") return null;
  for (const key of Object.keys(o)) if (!["background", "table", "light", "camera", "unitScale"].includes(key)) return null;
  if (o.background !== undefined && !HEX.test(o.background)) return null;
  if (o.unitScale !== undefined && !inRange(o.unitScale, THEME_LIMITS.unitScale)) return null;
  if (o.camera?.pitchDeg !== undefined && !inRange(o.camera.pitchDeg, THEME_LIMITS.pitchDeg)) return null;
  if (o.camera?.distance !== undefined && !inRange(o.camera.distance, THEME_LIMITS.distance)) return null;
  if (o.light?.sunIntensity !== undefined && !inRange(o.light.sunIntensity, THEME_LIMITS.sunIntensity)) return null;
  if (o.light?.exposure !== undefined && !inRange(o.light.exposure, THEME_LIMITS.exposure)) return null;
  for (const c of [o.light?.sun, o.light?.sky, o.table?.base, o.table?.rim]) if (c !== undefined && !HEX.test(c)) return null;
  if (o.table?.material !== undefined && !TABLE_MATERIALS.includes(o.table.material)) return null;
  return {
    ...base,
    ...(o.background ? { background: o.background } : {}),
    table: { ...base.table, ...(o.table ?? {}) },
    light: { ...base.light, ...(o.light ?? {}) },
    camera: { ...base.camera, ...(o.camera ?? {}) },
    unitScale: o.unitScale ?? base.unitScale,
  };
}

/** Generic presentation-floor thresholds for board readability (not genre-specific art). */
export const THEME_PRESENTATION_FLOOR = {
  pitchDeg: { min: 34, max: 62 },
  distance: { max: 1.15 },
  unitScale: { min: 1.05 },
  /** Relative luminance gap between UI accent and surface (WCAG-ish soft floor). */
  cardContrast: { min: 0.28 },
} as const;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

/**
 * Soft presentation-floor hints for a resolved theme.
 * Below-floor → keep draft / annotate (do not invent genre skins).
 */
export function themePresentationHints(spec: ThemeSpec): { ok: boolean; notes: string[] } {
  const F = THEME_PRESENTATION_FLOOR;
  const notes: string[] = [];
  if (spec.camera.pitchDeg < F.pitchDeg.min) {
    notes.push(`机位过平（俯角 ${spec.camera.pitchDeg}° < ${F.pitchDeg.min}°）：棋盘可读性不足，保持草稿并调高俯角。`);
  } else if (spec.camera.pitchDeg > F.pitchDeg.max) {
    notes.push(`机位过顶（俯角 ${spec.camera.pitchDeg}° > ${F.pitchDeg.max}°）：立体感不足，保持草稿并略降俯角。`);
  }
  if (spec.camera.distance > F.distance.max) {
    notes.push(`机位过远（距离 ×${spec.camera.distance} > ×${F.distance.max}）：单位偏小，保持草稿并拉近。`);
  }
  if (spec.unitScale < F.unitScale.min) {
    notes.push(`单位尺度过小（×${spec.unitScale} < ×${F.unitScale.min}）：棋子难辨，保持草稿并放大。`);
  }
  const gap = Math.abs(luminance(spec.ui.accent) - luminance(spec.ui.surface));
  if (gap < F.cardContrast.min) {
    notes.push(`卡面对比不足（强调色与表面亮度差 ${gap.toFixed(2)} < ${F.cardContrast.min}）：保持草稿并拉开配色对比。`);
  }
  return { ok: notes.length === 0, notes };
}
