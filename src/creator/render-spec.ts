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
  "meeple",
  "disc",
  "gem-chip",
  "glazed-tile",
  "plaque",
  "framed-art",
  "line-trough",
  "card",
  "die",
  "ship",
  // step3 · generic track / map kit (any spatial kernel may bind these).
  "rail-track",
  "station",
  "tree",
  "rock",
  "shore-natural",
]);

export const materialSchema = z.strictObject({
  base: hex,
  roughness: unit,
  metalness: unit,
  clearcoat: unit.optional(),
  pattern: z.enum(["none", "grain", "cloth", "stone", "grass", "sand"]),
  texture: assetId.optional(),
  brush: unit.optional(),
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
    /**
     * step3 · Tidewell-quality framing for any tabletop surface: `orthographic` uses the same
     * ortho play camera as 汐屿 (polar 54° / azimuth 12° / fill 0.945 inside HUD insets).
     * Omitted = legacy perspective orbit (fovDeg / distance).
     */
    projection: z.enum(["perspective", "orthographic"]).optional(),
    polarDeg: z.number().min(10).max(80).optional(),
    azimuthDeg: z.number().min(-45).max(45).optional(),
    fill: z.number().min(0.5).max(1).optional(),
  }),
  /** step3 · Room chrome: `wood` = full-viewport carved-wood game screen (汐屿 shell, generic). */
  chrome: z.enum(["plain", "wood"]).optional(),
  /** step3 · deterministic scenery scattered on the board, clear of routes / pieces / cells. */
  decor: z.strictObject({
    trees: z.number().int().min(0).max(120),
    rocks: z.number().int().min(0).max(60),
    seed: z.number().int().min(0).max(1_000_000),
    /** step3 R5 · `varied` = dirt route beds + darker grass patches + gentle mounds instead of one flat grass. */
    ground: z.enum(["flat", "varied"]).optional(),
    /** step3 R5 · `clustered` = pine/broadleaf groves densified along routes and the shore rim. */
    forest: z.enum(["sparse", "clustered"]).optional(),
  }).optional(),
  /**
   * step3 R2 · what surrounds the board so the table reads as a place, not a slab on wood:
   * `sea` = Tidewell tide-water shader around a sandy shore rim; `meadow` = grass field with a
   * tree belt. `shore` = rim width in world units (0 = no rim). Generic for any tabletop kernel.
   */
  surround: z.strictObject({
    kind: z.enum(["none", "sea", "meadow"]),
    shore: z.number().min(0).max(3),
    /** step3 R3 · coast outline: `natural` = undulating island rim (breaks hard right angles); `rect` = sharp slab. */
    coast: z.enum(["rect", "natural"]).optional(),
    seed: z.number().int().min(0).max(1_000_000).optional(),
  }).optional(),
  /**
   * step3 R2 · HUD art for the generic wood shell: `portraits` = seat portrait pack,
   * `cardArt` = illustrated action cards (vignette per action key). Packs live in
   * assets/illustrations/tabletop/ and are registered in assets/LICENSES.md.
   */
  hud: z.strictObject({
    portraits: z.enum(["none", "travelers"]).optional(),
    cardArt: z.enum(["none", "landscape"]).optional(),
  }).optional(),
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
    fill: z.strictObject({
      azimuthDeg: z.number().min(0).max(360),
      elevationDeg: z.number().min(5).max(80),
      intensity: z.number().min(0).max(4),
      color: hex,
    }).optional(),
    rim: z.strictObject({
      azimuthDeg: z.number().min(0).max(360),
      elevationDeg: z.number().min(5).max(80),
      intensity: z.number().min(0).max(4),
      color: hex,
    }).optional(),
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
  brush?: number,
): RenderSpec["materials"][string] {
  return {
    base,
    roughness,
    metalness,
    ...(clearcoat === undefined ? {} : { clearcoat }),
    pattern,
    ...(brush === undefined ? {} : { brush }),
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
      // T061 · stronger sun / darker ground fill → readable specular + contact shadows
      // T181 · shared base light microcontrast (hex + fallbacks; keep T161 upper-ink lighter)
      sun: {
        azimuthDeg: 124,
        elevationDeg: 50,
        intensity: 3.7,
        color: "#ffbe78",
      },
      hemisphere: { sky: "#fff6ec", ground: "#5a4836", intensity: 0.96 },
      shadow: { enabled: true, softness: 0.62 },
      exposure: 1.26,
      // T086 · shared fill + rim layers
      fill: { azimuthDeg: 310, elevationDeg: 34, intensity: 0.62, color: "#b8cef0" },
      rim: { azimuthDeg: 40, elevationDeg: 18, intensity: 0.48, color: "#ffd4a0" },
    },
    water: {
      enabled: kernelType === "hex-settlement-v1" || kernelType === "harbor-voyage-v1",
      // R20：与 water/mesh DEFAULT_SPEC 同步 — 明亮青绿 + 浅滩环。
      // T183 · shared water chroma (hex/harbor kernel family)
      shallow: "#2ef4e0", // T183/T225 · shallow reef microcontrast
      deep: "#0e7284", // T225 corner-safe deep
      waveHeight: 0.092,
      waveSpeed: 0.70,
      foam: 1.0, // T183/T225 shore foam (unit clamp)
    },
    materials: {
      // T090 · sync with SEAT_COLORS (felt-legible chroma)
      seat0: material("#e74c3c", "none", 0.55, 0.08, 0.28),
      seat1: material("#2980b9", "none", 0.55, 0.08, 0.28),
      seat2: material("#8e44ad", "none", 0.55, 0.08, 0.28),
      seat3: material("#f1c40f", "none", 0.55, 0.08, 0.28),
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
  character: "meeple",
  token: "disc",
  location: "tile-square",
  concept: "disc",
  object: "disc",
};

function applyKernelDefaults(render: RenderSpec, kernelType: string | null | undefined) {
  if (kernelType === "hex-settlement-v1") {
    // T181/T183/T217 · shared hex terrain chroma/microcontrast (kernel family, not suite fork)
    Object.assign(render.materials, {
      "terrain-wood": material("#00c050", "grass", 0.38),
      "terrain-brick": material("#f07818", "stone", 0.50),
      "terrain-sheep": material("#4cff40", "grass", 0.34),
      "terrain-wheat": material("#ffe00c", "grass", 0.40),
      "terrain-ore": material("#3e5468", "stone", 0.68),
      "terrain-desert": material("#f8dca0", "sand", 0.62),
      cliff: material("#5a544c", "stone", 0.70),
      "number-token": material("#edd4a0", "none", 0.22, 0.10, 0.18), // T225 wood-chip
      piece: material("#fff8ec", "none", 0.14, 0.28, 0.88), // T061…T198/T217
      "fog-lantern": material("#ffec70", "none", 0.12, 0.12, 0.68),
    });
    // T183/T217 · shared hex lighting lift (kernel family)
    render.lighting = {
      ...render.lighting,
      sun: { ...render.lighting.sun, intensity: 5.70, color: "#ffc078", elevationDeg: 56 },
      exposure: 1.88,
      fill: {
        azimuthDeg: render.lighting.fill?.azimuthDeg ?? 312,
        elevationDeg: render.lighting.fill?.elevationDeg ?? 44,
        intensity: 1.28,
        color: render.lighting.fill?.color ?? "#c4daf8",
      },
      rim: {
        azimuthDeg: render.lighting.rim?.azimuthDeg ?? 38,
        elevationDeg: render.lighting.rim?.elevationDeg ?? 28,
        intensity: 1.12,
        color: render.lighting.rim?.color ?? "#ffdcb0",
      },
    };
    render.bindings = [
      binding("tile-wood", "hex-prism", "terrain-wood"),
      binding("tile-brick", "hex-prism", "terrain-brick"),
      binding("tile-sheep", "hex-prism", "terrain-sheep"),
      binding("tile-wheat", "hex-prism", "terrain-wheat"),
      binding("tile-ore", "hex-prism", "terrain-ore"),
      binding("tile-desert", "hex-prism", "terrain-desert"),
      binding("number-token", "disc", "number-token", 0.72),
      binding("settlement", "house", "piece", 1.18),
      binding("city", "tower", "piece", 1.28),
      binding("road", "road-bar", "piece", 1.02),
      binding("robber", "disc", "fog-lantern", 1.05),
      binding("port", "ship", "piece", 1.05),
      binding("die", "die", "piece", 0.98),
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
    // T046 · shared train-route presentation (not parchment sticky-pad graph).
    // T177/T192 · shared network material/light microcontrast — hard pixel residual (kernel family, not suite fork)
    render.preset = "tabletop-day";
    render.camera = { ...render.camera, fovDeg: 32, distance: 14, minPolarDeg: 28, maxPolarDeg: 58, polarDeg: 46 };
    // T086 · desk lighting layers on network
    render.lighting = {
      ...render.lighting,
      sun: { ...render.lighting.sun, azimuthDeg: 126, elevationDeg: 60, intensity: 5.98, color: "#ffce9a" },
      hemisphere: { sky: "#ffffff", ground: "#8a7860", intensity: 2.18 }, // T230 network product light
      fill: { azimuthDeg: 310, elevationDeg: 50, intensity: 1.82, color: "#d8ecfc" },
      rim: { azimuthDeg: 40, elevationDeg: 34, intensity: 1.55, color: "#ffecbe" },
      shadow: { enabled: true, softness: 0.55 },
      exposure: 2.08, // T192…T230 · H02 network readable stage-wide (product map cloth)

    };
    Object.assign(render.materials, {
      // T172/T177/T192/T201/T206 · denser/brighter network map cloth (shared MaterialLibrary)
      map: material("#5afff0", "cloth", 0.99, 0, undefined, 0.99), // T177…T230
      table: material("#f8d0a0", "grain", 0.30, 0.26), // T110…T218/T221 · warmer exterior/rim (corner-calm)
      ink: material("#081420", "none", 0.22, 0.28, 0.58), // T214/T213/T218 route ink
      piece: material("#fffaf0", "none", 0.08, 0.38, 0.96), // T201…T230 · plastic-wood piece
    });
    render.bindings = [
      binding("station", "station", "ink", 1.2),
      binding("route", "rail-track", "ink", 1.7),
      binding("claim", "rail-track", "ink", 1.2),
      binding("worker", "meeple", "piece", 1.08),
      binding("map", "tile-square", "map", 1),
    ];
    return;
  }
  if (kernelType === "gem-engine-v1" || kernelType === "pattern-draft-v1" || kernelType === "auction-bidding-v1") {
    // T030 · desk-kernel visual baseline; T038 · softer contact lighting + felt that eats light.
    // T175 · shared desk material/light microcontrast — hard pixel for H03/H04/H05 (no suite fork)
    render.camera = { ...render.camera, fovDeg: 30, distance: 12.5, minPolarDeg: 32, maxPolarDeg: 62, polarDeg: 48 };
    render.lighting = {
      ...render.lighting,
      // T061 · desk contrast; T086 · explicit fill + rim (no extra shadow maps)
      // T175/T187/T198 · brighter upper sky/fill/exposure (H01 hex path separate; no vignette bait)
      sun: { ...render.lighting.sun, azimuthDeg: 128, elevationDeg: 60, intensity: 5.85, color: "#ffe0c0" },
      hemisphere: { sky: "#ffffff", ground: "#b0a088", intensity: 2.38 }, // T230 desk product light
      fill: { azimuthDeg: 312, elevationDeg: 54, intensity: 1.95, color: "#f0f6fc" },
      rim: { azimuthDeg: 38, elevationDeg: 32, intensity: 1.22, color: "#ffeed0" },
      shadow: { enabled: true, softness: 0.58 },
      exposure: 2.08, // T187…T230 · desk product light (H03/H05 card table readable)

    };
    Object.assign(render.materials, {
      // T175/T206/T214 · richer felt chroma + weave (shared MaterialLibrary board cloth)
      board: material("#3aff98", "cloth", 0.99, 0, undefined, 0.99),  // T044…T230 product green felt
      table: material("#f6d8a8", "grain", 0.34, 0.20), // T092…T221 · brighter wood rim (corner-calm)
      piece: material("#fff8ec", "none", 0.12, 0.30, 0.88), // T198…T230 · plastic-wood piece
      card: material("#fffdf6", "none", 0.12, 0.22, 0.82), // T198…T230 · card stock
      resource: material("#ffe8b8", "none", 0.04, 0.58, 0.99), // T198…T230 · gem crystal
      token: material("#d8c4ff", "none", 0.14, 0.36, 0.82), // T198/T206/T213 · chip
      ink: material("#203440", "none", 0.36, 0.14, 0.26),
    });
    render.bindings = [
      binding("region", "tile-square", "board"),
      binding("cell", "tile-square", "board"),
      binding("map", "tile-square", "board"),
      binding("card", "card", "card", 1.12),
      binding("disc", "disc", "piece", 1.0),
      binding("tile", "glazed-tile", "piece", 1.12),
      binding("resource", "gem-chip", "resource", 1.08),
      binding("token", "disc", "token", 0.88),
      binding("plaque", "plaque", "piece", 1),
      binding("lot", "framed-art", "card", 1.28),
      binding("building", "house", "piece", 1.05),
      binding("worker", "meeple", "piece", 1.08),
      binding("station", "disc", "ink", 0.8),
      binding("die", "die", "piece", 0.8),
    ];
    if (kernelType === "auction-bidding-v1") {
      Object.assign(render.materials, {
        board: material("#18e868", "cloth", 0.99, 0, undefined, 0.99),  // T044…T230 auction felt
        card: material("#fffaf4", "none", 0.28, 0.10, 0.48), // T061/T175/T213
      });
    }
    if (kernelType === "pattern-draft-v1") {
      Object.assign(render.materials, {
        board: material("#10fc80", "cloth", 0.99, 0, undefined, 0.99),  // T044…T230 pattern felt
        piece: material("#f8fcff", "none", 0.12, 0.26, 0.86), // T061…T230
        slot: material("#3f3f46", "none", 0.82, 0.05, 0.12),  // legacy recessed slots
        // T054 · pale print plate under wall hue tints (square grid, not black pits)
        "wall-print": material("#e7e5e4", "none", 0.88, 0.02, 0.08),
        // T058 · elongated pattern-line / floor troughs
        "line-trough": material("#44403c", "none", 0.9, 0.04, 0.06),
      });
      // T050/T054/T058: wall empties → square print; lines → trough strips (not round pits)
      render.bindings = [
        ...render.bindings.filter((b) => b.objectKind !== "slot" && b.objectKind !== "wall-slot" && b.objectKind !== "line-trough"),
        binding("slot", "disc", "slot", 0.7),
        binding("wall-slot", "tile-square", "wall-print", 0.92),
        binding("line-trough", "line-trough", "line-trough", 1),
      ];
    }
    return;
  }

  Object.assign(render.materials, {
    board: material("#6f7f6b", "cloth", 0.84),
    table: material("#8b5a2b", "grain", 0.9),
    piece: material("#f4efe6", "none", 0.48, 0.05, 0.22),
    card: material("#f3e7d3", "none", 0.72, 0, 0.06),
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
  chrome: renderShape.chrome,
  decor: renderShape.decor,
  surround: renderShape.surround,
  hud: renderShape.hud,
  lighting: z.strictObject({
    sun: lightingShape.sun.partial().optional(),
    hemisphere: lightingShape.hemisphere.partial().optional(),
    shadow: lightingShape.shadow.partial().optional(),
    exposure: lightingShape.exposure.optional(),
    fill: z.strictObject({
      azimuthDeg: z.number().min(0).max(360),
      elevationDeg: z.number().min(5).max(80),
      intensity: z.number().min(0).max(4),
      color: hex,
    }).partial().optional(),
    rim: z.strictObject({
      azimuthDeg: z.number().min(0).max(360),
      elevationDeg: z.number().min(5).max(80),
      intensity: z.number().min(0).max(4),
      color: hex,
    }).partial().optional(),
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
  if (patch.chrome) next.chrome = patch.chrome;
  if (patch.decor) next.decor = { ...patch.decor };
  if (patch.surround) next.surround = { ...patch.surround };
  if (patch.hud) next.hud = { ...next.hud, ...definedEntries(patch.hud) };
  if (patch.lighting) {
    if (patch.lighting.sun) Object.assign(next.lighting.sun, definedEntries(patch.lighting.sun));
    if (patch.lighting.hemisphere) Object.assign(next.lighting.hemisphere, definedEntries(patch.lighting.hemisphere));
    if (patch.lighting.shadow) Object.assign(next.lighting.shadow, definedEntries(patch.lighting.shadow));
    if (patch.lighting.exposure !== undefined) next.lighting.exposure = patch.lighting.exposure;
    if (patch.lighting.fill) {
      next.lighting.fill = {
        azimuthDeg: 308, elevationDeg: 32, intensity: 0, color: "#c5d6ef",
        ...(next.lighting.fill ?? {}),
        ...definedEntries(patch.lighting.fill),
      };
    }
    if (patch.lighting.rim) {
      next.lighting.rim = {
        azimuthDeg: 42, elevationDeg: 16, intensity: 0, color: "#ffe2b8",
        ...(next.lighting.rim ?? {}),
        ...definedEntries(patch.lighting.rim),
      };
    }
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
