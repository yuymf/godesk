import { describe, expect, it } from "vitest";
import { KERNEL_CAPABILITIES } from "./kernel-capabilities";
import { validateGameSpec } from "./game-spec";
import { structuredSpecFixture } from "./fixtures/game-spec";
import {
  RENDER_MISSING_MESSAGE,
  SPATIAL_PRESENTATION_KINDS,
  defaultRenderSpec,
  isUntouchedDefaultRender,
  renderAssetIds,
  renderSpecIssues,
  renderSpecSchema,
  type RenderSpec,
  applyRenderPatch,
  patchRenderSpec,
} from "./render-spec";

const KERNELS = [...Object.keys(KERNEL_CAPABILITIES), null];

function render(kernel: string | null = "hex-settlement-v1"): RenderSpec {
  return defaultRenderSpec(kernel, "table")!;
}

describe("defaultRenderSpec", () => {
  it.each(KERNELS)("is schema-valid and issue-free for %s on every spatial surface", (kernel) => {
    for (const kind of SPATIAL_PRESENTATION_KINDS) {
      const spec = defaultRenderSpec(kernel, kind)!;
      expect(renderSpecSchema.parse(spec)).toEqual(spec);
      expect(renderSpecIssues(spec)).toEqual([]);
      // Defaults reference built-in primitives only until G3D-11 clears assets.
      expect(renderAssetIds(spec)).toEqual([]);
      expect(new Set(spec.bindings.map((binding) => binding.objectKind)).size).toBe(spec.bindings.length);
      expect(Object.keys(spec.materials)).toEqual(expect.arrayContaining(["seat0", "seat1", "seat2", "seat3"]));
    }
  });

  it.each(["cards", "conversation", "screen"] as const)("is undefined for the non-spatial %s surface (§9 Q4)", (kind) => {
    expect(defaultRenderSpec("hex-settlement-v1", kind)).toBeUndefined();
  });

  it("uses the §3.7 tabletop-day tokens and Kernel-specific bindings", () => {
    const hex = render("hex-settlement-v1");
    expect(hex).toMatchObject({
      preset: "tabletop-day",
      camera: { mode: "orbit", fovDeg: 35, distance: 16, minPolarDeg: 25, maxPolarDeg: 70, pan: false },
      lighting: { sun: { azimuthDeg: 128, elevationDeg: 46, intensity: 3.05, color: "#ffc890" }, exposure: 1.12 },
      water: { enabled: true, shallow: "#2ab8af", deep: "#0a6c74", waveHeight: 0.065, waveSpeed: 0.55, foam: 1.0 },
      motion: { placeMs: 280, moveMs: 420, cameraMs: 600, diceMs: 900 },
    });
    expect(hex.materials.seat0.base).toBe("#c0392b");
    expect(hex.bindings.map((binding) => binding.objectKind)).toEqual(expect.arrayContaining([
      "tile-wood", "tile-desert", "number-token", "settlement", "city", "road", "robber",
    ]));
    expect(render("disc-flipping-v1").water.enabled).toBe(false);
    expect(render("disc-flipping-v1").bindings.map((binding) => binding.objectKind)).toEqual(["cell", "disc"]);
    expect(render("network-route-v1").preset).toBe("parchment-map");
    expect(render(null).bindings.map((binding) => binding.objectKind)).toEqual(expect.arrayContaining([
      "region", "resource", "card", "character", "token", "location", "concept", "object",
    ]));
  });

  it("returns a fresh object every call", () => {
    const first = render();
    first.water.shallow = "#000000";
    expect(render().water.shallow).toBe("#2ab8af");
  });

  it("recognises untouched defaults but not authored edits", () => {
    expect(isUntouchedDefaultRender(render("disc-flipping-v1"), "table")).toBe(true);
    const edited = render("disc-flipping-v1");
    edited.lighting.sun.elevationDeg = 64;
    expect(isUntouchedDefaultRender(edited, "table")).toBe(false);
  });
});

describe("renderSpecSchema", () => {
  it("rejects unknown keys (strict) and out-of-range values", () => {
    expect(renderSpecSchema.safeParse({ ...render(), shader: "void main(){}" }).success).toBe(false);
    const steep = render();
    steep.lighting.sun.elevationDeg = 90;
    expect(renderSpecSchema.safeParse(steep).success).toBe(false);
    const wrongColour = render();
    wrongColour.water.shallow = "teal";
    expect(renderSpecSchema.safeParse(wrongColour).success).toBe(false);
  });

  it("accepts a partial cue map (zod v4 partialRecord) and rejects unknown cues", () => {
    const withCue = render();
    withCue.audio.cues = { dice: { assets: ["sfx/dice-roll-1"], gainDb: -6 } };
    expect(renderSpecSchema.safeParse(withCue).success).toBe(true);
    expect(renderSpecSchema.safeParse({ ...withCue, audio: { ...withCue.audio, cues: { voice: { assets: ["sfx/x"], gainDb: 0 } } } }).success).toBe(false);
  });

  it("caps materials at 32 and bindings at 48", () => {
    const many = render();
    for (let index = 0; index < 40; index += 1) many.materials[`m${index}`] = many.materials.seat0;
    expect(renderSpecSchema.safeParse(many).success).toBe(false);
    const bound = render();
    bound.bindings = Array.from({ length: 49 }, (_, index) => ({ objectKind: `k${index}`, mesh: "pawn" as const, material: "seat0", scale: 1 }));
    expect(renderSpecSchema.safeParse(bound).success).toBe(false);
  });
});

describe("renderSpecIssues (validateGameSpec rules, SPEC §3.6)", () => {
  it("fails a binding to an unknown material", () => {
    const spec = render();
    spec.bindings.push({ objectKind: "meeple", mesh: "pawn", material: "gold-leaf", scale: 1 });
    expect(renderSpecIssues(spec)).toEqual([{ path: "render.bindings", message: "render.bindings: 未知材质 gold-leaf" }]);
  });

  it("fails an asset that is not in the licence-cleared manifest", () => {
    const spec = render();
    spec.materials.table = { ...spec.materials.table, texture: "textures/oak-planks" };
    spec.bindings.push({ objectKind: "ship", mesh: "props/ship-a", material: "table", scale: 1 });
    spec.audio.musicTracks = ["music/theme"];
    expect(renderSpecIssues(spec).map((issue) => issue.message)).toEqual([
      "render: 资产 textures/oak-planks 未登记许可证",
      "render: 资产 props/ship-a 未登记许可证",
      "render: 资产 music/theme 未登记许可证",
    ]);
    // Once G3D-11 registers the assets as cleared, the same render validates.
    expect(renderSpecIssues(spec, () => true)).toEqual([]);
    expect(renderSpecIssues(spec, (id) => id !== "music/theme")).toEqual([
      { path: "render", message: "render: 资产 music/theme 未登记许可证" },
    ]);
  });

  it("fails an inverted or empty camera polar range", () => {
    const inverted = render();
    inverted.camera.minPolarDeg = 70;
    inverted.camera.maxPolarDeg = 30;
    expect(renderSpecIssues(inverted)).toEqual([{ path: "render.camera", message: "render.camera: 俯仰角区间无效" }]);
    const empty = render();
    empty.camera.minPolarDeg = 45;
    empty.camera.maxPolarDeg = 45;
    expect(renderSpecIssues(empty).map((issue) => issue.path)).toEqual(["render.camera"]);
  });

  it("validateGameSpec requires render for table/scene/hybrid and surfaces render issues", () => {
    const spec = structuredSpecFixture("hex");
    expect(spec.schemaVersion).toBe(2);
    expect(validateGameSpec(spec)).toEqual({ valid: true, issues: [] });
    const { render: _render, ...missing } = spec;
    expect(validateGameSpec(missing).issues).toContainEqual({ path: "render", message: RENDER_MISSING_MESSAGE });
    for (const kind of ["scene", "hybrid"] as const) {
      expect(validateGameSpec({ ...missing, presentation: { kind, layout: "x" } }).valid).toBe(false);
    }
    expect(validateGameSpec({ ...missing, presentation: { kind: "cards", layout: "hand" } })).toEqual({ valid: true, issues: [] });
    const badMaterial = structuredClone(spec);
    badMaterial.render!.bindings[0]!.material = "nope";
    expect(validateGameSpec(badMaterial).issues).toContainEqual({ path: "render.bindings", message: "render.bindings: 未知材质 nope" });
    const v1 = { ...spec, schemaVersion: 1 };
    expect(validateGameSpec(v1).valid).toBe(false);
  });
});

describe("configure_render patch (G3D-15)", () => {
  const base = () => defaultRenderSpec("disc-flipping-v1", "table")!;

  it("merges sections one level deep and leaves the input untouched", () => {
    const render = base();
    const snapshot = structuredClone(render);
    const result = patchRenderSpec(render, {
      water: { shallow: "#3fa7c9" },
      lighting: { sun: { elevationDeg: 24 }, exposure: 1.2 },
      materials: { piece: { base: "#222831" } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.render.water).toEqual({ ...snapshot.water, shallow: "#3fa7c9" });
    expect(result.render.lighting.sun).toEqual({ ...snapshot.lighting.sun, elevationDeg: 24 });
    expect(result.render.lighting.exposure).toBe(1.2);
    expect(result.render.materials.piece).toEqual({ ...snapshot.materials.piece, base: "#222831" });
    expect(result.render.bindings).toEqual(snapshot.bindings);
    expect(render).toEqual(snapshot);
  });

  it("replaces bindings wholesale and accepts a complete new material", () => {
    const result = patchRenderSpec(base(), {
      materials: { brass: { base: "#b08d57", roughness: 0.35, metalness: 0.8, pattern: "none" } },
      bindings: [{ objectKind: "disc", mesh: "disc", material: "brass", scale: 0.9 }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.render.bindings).toEqual([{ objectKind: "disc", mesh: "disc", material: "brass", scale: 0.9 }]);
  });

  it.each([
    ["empty", {}],
    ["unknown top-level key", { fog: { density: 1 } }],
    ["unknown nested key", { water: { colour: "#000000" } }],
    ["out of range", { lighting: { sun: { elevationDeg: 5 } } }],
    ["bad colour", { water: { shallow: "blue" } }],
    ["unknown material in bindings", { bindings: [{ objectKind: "disc", mesh: "disc", material: "nope", scale: 1 }] }],
    ["incomplete new material", { materials: { brass: { base: "#b08d57" } } }],
    ["unlicensed texture", { materials: { piece: { texture: "textures/not-registered" } } }],
    ["inverted polar range", { camera: { minPolarDeg: 70, maxPolarDeg: 30 } }],
  ])("rejects %s", (_label, patch) => {
    const result = patchRenderSpec(base(), patch);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
  });

  it("applyRenderPatch alone does not validate (callers must)", () => {
    const merged = applyRenderPatch(base(), { camera: { minPolarDeg: 70, maxPolarDeg: 30 } });
    expect(merged.camera.minPolarDeg).toBe(70);
  });
});
