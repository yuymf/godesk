import { z } from "zod";
import { KERNEL_CAPABILITIES } from "./kernel-capabilities";
import { isClearedRenderAsset } from "./render-asset-registry";
import type { PlaySurfaceKind } from "./project-contract";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const unit = z.number().min(0).max(1);
const assetId = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/);
const materialKey = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
const builtInMesh = z.enum([
  "hex-prism",
  "tile-square",
  "house",
  "tower",
  "road-bar",
  "pawn",
  "disc",
  "card",
  "die",
  "ship",
]);

export const materialSchema = z.strictObject({
  base: hex,
  roughness: unit,
  metalness: unit,
  clearcoat: unit.optional(),
  pattern: z.enum(["none", "grain", "cloth", "stone", "grass", "sand"]),
  texture: assetId.optional(),
});

export const renderSpecSchema = z.strictObject({
  version: z.literal(1),
  engine: z.literal("three-webgl2"),
  preset: z.enum(["tabletop-day", "tabletop-dusk", "parchment-map"]),
  camera: z.strictObject({
    mode: z.enum(["orbit", "fixed"]),
    fovDeg: z.number().min(25).max(55),
    distance: z.number().min(6).max(40),
    minPolarDeg: z.number().min(10).max(80),
    maxPolarDeg: z.number().min(20).max(85),
    pan: z.boolean(),
  }),
  lighting: z.strictObject({
    sun: z.strictObject({
      azimuthDeg: z.number().min(0).max(360),
      elevationDeg: z.number().min(15).max(80),
      intensity: z.number().min(0).max(6),
      color: hex,
    }),
    hemisphere: z.strictObject({
      sky: hex,
      ground: hex,
      intensity: z.number().min(0).max(3),
    }),
    shadow: z.strictObject({ enabled: z.boolean(), softness: unit }),
    exposure: z.number().min(0.5).max(2),
  }),
  water: z.strictObject({
    enabled: z.boolean(),
    shallow: hex,
    deep: hex,
    waveHeight: z.number().min(0).max(0.2),
    waveSpeed: z.number().min(0).max(2),
    foam: unit,
  }),
  materials: z.record(materialKey, materialSchema).refine((materials) =>
    Object.keys(materials).length <= 32
  ),
  bindings: z.array(z.strictObject({
    objectKind: z.string().min(1).max(40),
    mesh: z.union([builtInMesh, assetId]),
    material: z.string(),
    scale: z.number().min(0.25).max(4),
  })).max(48),
  motion: z.strictObject({
    placeMs: z.number().int().min(120).max(600),
    moveMs: z.number().int().min(160).max(900),
    cameraMs: z.number().int().min(200).max(1200),
    diceMs: z.number().int().min(400).max(1400),
    easing: z.enum(["out-cubic", "out-back", "in-out-sine"]),
  }),
  audio: z.strictObject({
    master: unit,
    sfx: unit,
    music: unit,
    cues: z.partialRecord(
      z.enum([
        "hover",
        "select",
        "illegal",
        "panel",
        "toggle",
        "place",
        "upgrade",
        "road",
        "move",
        "steal",
        "dice",
        "gain",
        "trade",
        "turn",
        "win",
        "lose",
      ]),
      z.strictObject({
        assets: z.array(assetId).min(1).max(6),
        gainDb: z.number().min(-24).max(0),
      }),
    ),
    ambience: z.array(assetId).max(2),
    musicTracks: z.array(assetId).max(3),
  }),
});

export type RenderSpec = z.infer<typeof renderSpecSchema>;

/*
 * Binding contract (consumed by src/render3d mappers, G3D-03 / G3D-14):
 * `bindings[].objectKind` names either a GameSpec.objects[].kind
 * (GameEntity kinds: resource, card, character, token, location, concept,
 * object), the generic `region` cell used for GameSpec.regions, or a Kernel
 * scene-node type owned by a specific mapper (hex-settlement-v1: tile-<terrain>,
 * number-token, settlement, city, road, robber, port, die; disc-flipping-v1:
 * cell, disc; harbor-voyage-v1: berth, ship, cargo, worker;
 * worker-placement-v1: region, worker, building, resource; network-route-v1:
 * station, route, claim). Seat colours always come from materials seat0–seat3.
 * Mappers fall back to a built-in primitive when no binding matches.
 */

export const SPATIAL_PRESENTATION_KINDS = ["table", "scene", "hybrid"] as const;
export const RENDER_MISSING_MESSAGE = "render: 空间体裁缺少 3D 渲染声明";

type RenderIssue = { path: string; message: string };
type SpatialPresentationKind = typeof SPATIAL_PRESENTATION_KINDS[number];

export function isSpatialPresentationKind(kind: unknown): kind is SpatialPresentationKind {
  return typeof kind === "string" &&
    (SPATIAL_PRESENTATION_KINDS as readonly string[]).includes(kind);
}

function isAssetId(value: string): boolean {
  return /^[a-z0-9-]+\/[a-z0-9-]+$/.test(value);
}

export function renderAssetIds(render: RenderSpec): string[] {
  return [
    ...Object.values(render.materials).flatMap((material) =>
      material.texture ? [material.texture] : []
    ),
    ...render.bindings.flatMap((binding) =>
      isAssetId(binding.mesh) ? [binding.mesh] : []
    ),
    ...Object.values(render.audio.cues).flatMap((cue) => cue?.assets ?? []),
    ...render.audio.ambience,
    ...render.audio.musicTracks,
  ];
}

export function renderSpecIssues(
  render: RenderSpec,
  isClearedAsset = isClearedRenderAsset,
): RenderIssue[] {
  const issues: RenderIssue[] = [];
  const materialKeys = new Set(Object.keys(render.materials));
  for (const binding of render.bindings) {
    if (!materialKeys.has(binding.material)) {
      issues.push({
        path: "render.bindings",
        message: `render.bindings: 未知材质 ${binding.material}`,
      });
    }
  }
  for (const id of renderAssetIds(render)) {
    if (!isClearedAsset(id)) {
      issues.push({
        path: "render",
        message: `render: 资产 ${id} 未登记许可证`,
      });
    }
  }
  if (render.camera.minPolarDeg >= render.camera.maxPolarDeg) {
    issues.push({
      path: "render.camera",
      message: "render.camera: 俯仰角区间无效",
    });
  }
  return issues;
}

function material(
  base: string,
  pattern: RenderSpec["materials"][string]["pattern"],
  roughness = 0.6,
  metalness = 0,
  clearcoat?: number,
): RenderSpec["materials"][string] {
  return {
    base,
    roughness,
    metalness,
    ...(clearcoat === undefined ? {} : { clearcoat }),
    pattern,
  };
}

function binding(
  objectKind: string,
  mesh: RenderSpec["bindings"][number]["mesh"],
  materialKeyName: string,
  scale = 1,
): RenderSpec["bindings"][number] {
  return { objectKind, mesh, material: materialKeyName, scale };
}

function baseDefault(kernelType: string | null | undefined): RenderSpec {
  return {
    version: 1,
    engine: "three-webgl2",
    preset: kernelType === "network-route-v1" ? "parchment-map" : "tabletop-day",
    camera: {
      mode: "orbit",
      fovDeg: 35,
      distance: 16,
      minPolarDeg: 25,
      maxPolarDeg: 70,
      pan: false,
    },
    lighting: {
      sun: {
        azimuthDeg: 128,
        elevationDeg: 46,
        intensity: 3.05,
        color: "#ffc890",
      },
      hemisphere: { sky: "#f2e6d2", ground: "#c9a878", intensity: 1.05 },
      shadow: { enabled: true, softness: 0.92 },
      exposure: 1.12,
    },
    water: {
      enabled: kernelType === "hex-settlement-v1" || kernelType === "harbor-voyage-v1",
      // R20：与 water/mesh DEFAULT_SPEC 同步 — 明亮青绿 + 浅滩环。
      shallow: "#2ab8af",
      deep: "#1aa0a8",
      waveHeight: 0.065,
      waveSpeed: 0.55,
      foam: 1.0,
    },
    materials: {
      seat0: material("#c0392b", "none", 0.58, 0, 0.12),
      seat1: material("#2980b9", "none", 0.58, 0, 0.12),
      seat2: material("#27ae60", "none", 0.58, 0, 0.12),
      seat3: material("#f39c12", "none", 0.58, 0, 0.12),
      table: material("#8b5a2b", "grain", 0.9),
    },
    bindings: [],
    motion: {
      placeMs: 280,
      moveMs: 420,
      cameraMs: 600,
      diceMs: 900,
      easing: "out-back",
    },
    audio: {
      master: 1,
      sfx: 0.8,
      music: 0.6,
      cues: {},
      ambience: [],
      musicTracks: [],
    },
  };
}

const GAME_ENTITY_KINDS = [
  "resource",
  "card",
  "character",
  "token",
  "location",
  "concept",
  "object",
] as const;

const GENERIC_ENTITY_MESH: Record<typeof GAME_ENTITY_KINDS[number], RenderSpec["bindings"][number]["mesh"]> = {
  resource: "disc",
  card: "card",
  character: "pawn",
  token: "pawn",
  location: "tile-square",
  concept: "disc",
  object: "pawn",
};

function applyKernelDefaults(render: RenderSpec, kernelType: string | null | undefined) {
  if (kernelType === "hex-settlement-v1") {
    Object.assign(render.materials, {
      "terrain-wood": material("#2f7d4f", "grass", 0.7),
      "terrain-brick": material("#b86b38", "stone", 0.78),
      "terrain-sheep": material("#8fcf74", "grass", 0.68),
      "terrain-wheat": material("#d8b348", "grass", 0.72),
      "terrain-ore": material("#6f7680", "stone", 0.9),
      "terrain-desert": material("#d9bd7a", "sand", 0.86),
      cliff: material("#77716a", "stone", 0.9),
      "number-token": material("#efe3c8", "none", 0.58),
      piece: material("#f4efe6", "none", 0.58),
      "fog-lantern": material("#f6c85f", "none", 0.38, 0, 0.25),
    });
    render.bindings = [
      binding("tile-wood", "hex-prism", "terrain-wood"),
      binding("tile-brick", "hex-prism", "terrain-brick"),
      binding("tile-sheep", "hex-prism", "terrain-sheep"),
      binding("tile-wheat", "hex-prism", "terrain-wheat"),
      binding("tile-ore", "hex-prism", "terrain-ore"),
      binding("tile-desert", "hex-prism", "terrain-desert"),
      binding("number-token", "disc", "number-token", 0.55),
      binding("settlement", "house", "piece", 0.8),
      binding("city", "tower", "piece", 0.9),
      binding("road", "road-bar", "piece", 0.75),
      binding("robber", "disc", "fog-lantern", 0.8),
      binding("port", "ship", "piece", 0.8),
      binding("die", "die", "piece", 0.8),
    ];
    return;
  }
  if (kernelType === "disc-flipping-v1") {
    Object.assign(render.materials, {
      // 翻转棋的棋子必须黑白分明：座位 0 = 黑、座位 1 = 白（G3D-14）。
      seat0: material("#1d1d1f", "none", 0.42, 0, 0.3),
      seat1: material("#f4efe6", "none", 0.42, 0, 0.3),
      board: material("#1f6b4a", "cloth", 0.78),
      piece: material("#f4efe6", "none", 0.58),
    });
    render.bindings = [
      binding("cell", "tile-square", "board"),
      binding("disc", "disc", "piece", 0.82),
    ];
    return;
  }
  if (kernelType === "harbor-voyage-v1") {
    Object.assign(render.materials, {
      berth: material("#b9a77d", "grain", 0.8),
      piece: material("#f4efe6", "none", 0.58),
      cargo: material("#c08a3d", "none", 0.55),
    });
    render.bindings = [
      binding("berth", "tile-square", "berth"),
      binding("ship", "ship", "piece"),
      binding("cargo", "disc", "cargo", 0.75),
      binding("worker", "pawn", "piece", 0.75),
    ];
    return;
  }
  if (kernelType === "worker-placement-v1") {
    Object.assign(render.materials, {
      board: material("#766a5a", "grain", 0.82),
      piece: material("#f4efe6", "none", 0.58),
      resource: material("#d6a94b", "none", 0.55),
    });
    render.bindings = [
      binding("region", "tile-square", "board"),
      binding("worker", "pawn", "piece", 0.75),
      binding("building", "house", "piece", 0.85),
      binding("resource", "disc", "resource", 0.7),
    ];
    return;
  }
  if (kernelType === "network-route-v1") {
    Object.assign(render.materials, {
      map: material("#c9b68a", "none", 0.86),
      ink: material("#40505a", "none", 0.58),
    });
    render.bindings = [
      binding("station", "disc", "ink", 0.78),
      binding("route", "road-bar", "ink", 0.72),
      binding("claim", "road-bar", "ink", 0.72),
    ];
    return;
  }
  Object.assign(render.materials, {
    board: material("#6f7f6b", "cloth", 0.8),
    piece: material("#f4efe6", "none", 0.58),
  });
  // Generic tabletop (G3D-14 default base): every GameEntity kind that can
  // appear in GameSpec.objects[].kind gets a primitive, plus region cells and dice.
  render.bindings = [
    binding("region", "tile-square", "board"),
    binding("die", "die", "piece", 0.8),
    ...GAME_ENTITY_KINDS.map((kind) =>
      binding(kind, GENERIC_ENTITY_MESH[kind], "piece", kind === "location" ? 1 : 0.8)
    ),
  ];
}

export function defaultRenderSpec(
  kernelType: string | null | undefined,
  kind: PlaySurfaceKind,
): RenderSpec | undefined {
  if (!isSpatialPresentationKind(kind)) return undefined;
  const render = baseDefault(kernelType);
  applyKernelDefaults(render, kernelType);
  return structuredClone(render);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
    }
    return item;
  });
}

let untouchedDefaults: ReadonlySet<string> | undefined;

/**
 * True when `render` is exactly the platform default for some known Kernel (or
 * the generic tabletop). Such a render follows the Kernel when a configure_*
 * op changes it; any authored edit makes it sticky. Defaults are identical for
 * every spatial kind, so the canonical set is computed once per isolate.
 */
export function isUntouchedDefaultRender(render: RenderSpec, kind: PlaySurfaceKind): boolean {
  if (!isSpatialPresentationKind(kind)) return false;
  untouchedDefaults ??= new Set(
    [...Object.keys(KERNEL_CAPABILITIES), null].map((kernelType) =>
      canonical(defaultRenderSpec(kernelType, "table"))
    ),
  );
  return untouchedDefaults.has(canonical(render));
}

/*
 * G3D-15 — `configure_render`: a zod-validated partial patch over the current
 * render declaration. Sections merge one level deep (camera / lighting.* /
 * water / motion / audio scalars); `materials` merges per key (a new key must
 * end up a complete material); `bindings` and `audio.cues` replace wholesale.
 * The merged result must still pass `renderSpecSchema` + `renderSpecIssues`.
 */
const renderShape = renderSpecSchema.shape;
const lightingShape = renderShape.lighting.shape;

export const renderPatchSchema = z.strictObject({
  preset: renderShape.preset.optional(),
  camera: renderShape.camera.partial().optional(),
  lighting: z.strictObject({
    sun: lightingShape.sun.partial().optional(),
    hemisphere: lightingShape.hemisphere.partial().optional(),
    shadow: lightingShape.shadow.partial().optional(),
    exposure: lightingShape.exposure.optional(),
  }).optional(),
  water: renderShape.water.partial().optional(),
  materials: z.record(materialKey, materialSchema.partial()).optional(),
  bindings: renderShape.bindings.optional(),
  motion: renderShape.motion.partial().optional(),
  audio: z.strictObject({
    master: unit.optional(),
    sfx: unit.optional(),
    music: unit.optional(),
    cues: renderShape.audio.shape.cues.optional(),
    ambience: renderShape.audio.shape.ambience.optional(),
    musicTracks: renderShape.audio.shape.musicTracks.optional(),
  }).optional(),
}).refine((patch) => Object.keys(patch).length > 0, { message: "render patch is empty" });

export type RenderPatch = z.infer<typeof renderPatchSchema>;

function definedEntries<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

/** Pure merge; callers validate the result with `renderSpecSchema` + `renderSpecIssues`. */
export function applyRenderPatch(render: RenderSpec, patch: RenderPatch): RenderSpec {
  const next = structuredClone(render);
  if (patch.preset) next.preset = patch.preset;
  if (patch.camera) Object.assign(next.camera, definedEntries(patch.camera));
  if (patch.lighting) {
    if (patch.lighting.sun) Object.assign(next.lighting.sun, definedEntries(patch.lighting.sun));
    if (patch.lighting.hemisphere) Object.assign(next.lighting.hemisphere, definedEntries(patch.lighting.hemisphere));
    if (patch.lighting.shadow) Object.assign(next.lighting.shadow, definedEntries(patch.lighting.shadow));
    if (patch.lighting.exposure !== undefined) next.lighting.exposure = patch.lighting.exposure;
  }
  if (patch.water) Object.assign(next.water, definedEntries(patch.water));
  if (patch.materials) {
    for (const [key, material] of Object.entries(patch.materials)) {
      next.materials[key] = { ...(next.materials[key] ?? {}), ...definedEntries(material) } as RenderSpec["materials"][string];
    }
  }
  if (patch.bindings) next.bindings = structuredClone(patch.bindings);
  if (patch.motion) Object.assign(next.motion, definedEntries(patch.motion));
  if (patch.audio) {
    const { cues, ambience, musicTracks, ...levels } = patch.audio;
    Object.assign(next.audio, definedEntries(levels));
    if (cues) next.audio.cues = structuredClone(cues);
    if (ambience) next.audio.ambience = [...ambience];
    if (musicTracks) next.audio.musicTracks = [...musicTracks];
  }
  return next;
}

export type RenderPatchResult =
  | { ok: true; render: RenderSpec }
  | { ok: false; issues: string[] };

/** Patch + full validation (schema, unknown material, unlicensed asset, camera range). */
export function patchRenderSpec(
  render: RenderSpec,
  patch: unknown,
  isClearedAsset = isClearedRenderAsset,
): RenderPatchResult {
  const parsedPatch = renderPatchSchema.safeParse(patch);
  if (!parsedPatch.success) {
    return { ok: false, issues: parsedPatch.error.issues.map((issue) => `render.${issue.path.join(".")}: ${issue.message}`) };
  }
  const merged = applyRenderPatch(render, parsedPatch.data);
  const parsed = renderSpecSchema.safeParse(merged);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((issue) => `render.${issue.path.join(".")}: ${issue.message}`) };
  }
  const issues = renderSpecIssues(parsed.data, isClearedAsset).map((issue) => issue.message);
  return issues.length ? { ok: false, issues } : { ok: true, render: parsed.data };
}
