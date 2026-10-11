import { describe, expect, it } from "vitest";
import { applyRenderPatch, defaultRenderSpec, renderPatchSchema, renderSpecSchema } from "../../creator/render-spec";
import { DEFAULT_NETWORK_CITIES, DEFAULT_NETWORK_EDGES } from "../../runtime/adapters/network-route";
import { mapTabletopToScene, scatterDecor, type TabletopRenderInput } from "./tabletop";
import { networkRouteLayout } from "./tabletop-kernels";

const PATCH = {
  camera: { projection: "orthographic", polarDeg: 54, azimuthDeg: 12, fill: 0.945 },
  chrome: "wood",
  decor: { trees: 40, rocks: 10, seed: 11 },
  bindings: [
    { objectKind: "station", mesh: "station", material: "ink", scale: 1.25 },
    { objectKind: "route", mesh: "rail-track", material: "ink", scale: 2.2 },
    { objectKind: "claim", mesh: "rail-track", material: "ink", scale: 1.1 },
  ],
} as const;

function render(): TabletopRenderInput {
  const patch = renderPatchSchema.parse(PATCH);
  const merged = applyRenderPatch(defaultRenderSpec("network-route-v1", "table")!, patch);
  return renderSpecSchema.parse(merged) as TabletopRenderInput;
}

function layout(claims: Record<string, number | null> = {}) {
  return networkRouteLayout(
    { cities: [...DEFAULT_NETWORK_CITIES], edges: [...DEFAULT_NETWORK_EDGES], claims, terminalFrom: "A", terminalTo: "F" },
    new Set(),
  );
}

describe("step3 · configure_render: ortho camera / wood chrome / decor / track kit", () => {
  it("accepts the new optional fields and keeps legacy specs valid", () => {
    const spec = render();
    expect(spec.camera.projection).toBe("orthographic");
    expect((spec as unknown as { chrome: string }).chrome).toBe("wood");
    expect(renderSpecSchema.safeParse(defaultRenderSpec("network-route-v1", "table")).success).toBe(true);
    expect(renderPatchSchema.safeParse({ camera: { fill: 1.4 } }).success).toBe(false);
    expect(renderPatchSchema.safeParse({ bindings: [{ objectKind: "route", mesh: "warp-gate", material: "ink", scale: 1 }] }).success).toBe(false);
  });

  it("binds routes to rail-track (length in tag, unit scale) and recreates the node when a route is claimed", () => {
    const open = mapTabletopToScene(layout(), render());
    const openLink = open.model.nodes.find((n) => n.id.endsWith(":A|B") && n.kind === "link")!;
    expect(openLink.mesh).toBe("rail-track");
    expect(openLink.scale).toEqual([1, 1, 1]);
    expect(openLink.tag).toMatch(/^\d+(\.\d+)?:\d+(\.\d+)?$/);
    const claimed = mapTabletopToScene(layout({ "A|B": 0 }), render());
    const claimedLink = claimed.model.nodes.find((n) => n.id.endsWith(":A|B") && n.kind === "link")!;
    expect(claimedLink.id).not.toBe(openLink.id);
    expect(claimedLink.seat).toBe(0);
  });

  it("adds a flat name label per city and tags terminals as major stations", () => {
    const scene = mapTabletopToScene(layout(), render());
    const labels = scene.model.nodes.filter((n) => n.kind === "label").map((n) => n.tag);
    expect(labels).toEqual(DEFAULT_NETWORK_CITIES.map((c) => c.name));
    const majors = scene.model.nodes.filter((n) => n.mesh === "station" && n.tag === "major").map((n) => n.id);
    expect(majors).toEqual(["piece:station:A", "piece:station:F"]);
  });

  it("scatters decor deterministically, inside the board, clear of routes, and stable across claims", () => {
    const a = scatterDecor(layout(), { trees: 40, rocks: 10, seed: 11 });
    const b = scatterDecor(layout({ "A|B": 0, "E|F": 1 }), { trees: 40, rocks: 10, seed: 11 });
    expect(a.length).toBeGreaterThan(30);
    expect(b).toEqual(a);
    const { board } = layout();
    for (const p of a) {
      expect(Math.abs(p.x)).toBeLessThan(board.width / 2);
      expect(Math.abs(p.z)).toBeLessThan(board.depth / 2);
    }
    const scene = mapTabletopToScene(layout(), render());
    expect(scene.model.nodes.filter((n) => n.mesh === "tree").length).toBe(a.filter((p) => p.objectKind === "decor-tree").length);
  });

  it("densifies PBR repeat on large boards (no smeared grass)", () => {
    const spec = render();
    spec.materials.map = { base: "#8fb865", roughness: 0.95, metalness: 0, pattern: "grass" };
    const scene = mapTabletopToScene(layout(), spec);
    const board = scene.model.nodes.find((n) => n.id === "board")!;
    expect(scene.materials[board.material!]!.pbrRepeat).toBeGreaterThan(2);
  });
});
