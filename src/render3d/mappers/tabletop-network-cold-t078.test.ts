import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { networkRouteLayout } from "./tabletop-kernels";
import { mapTabletopToScene } from "./tabletop";
import { defaultRenderSpec } from "../../creator/render-spec";
import type { TabletopRenderInput } from "./tabletop";

describe("T078 network cold board richness", () => {
  it("unclaimed routes emit ballast + signal posts; claim semantics unchanged", () => {
    const layout = networkRouteLayout({
      cities: [
        { id: "a", name: "A", x: 0, y: 0 },
        { id: "b", name: "B", x: 4, y: 0 },
        { id: "c", name: "C", x: 2, y: 3 },
      ],
      edges: [
        { id: "e1", from: "a", to: "b", length: 3, color: "red" },
        { id: "e2", from: "b", to: "c", length: 2, color: "blue" },
      ],
      claims: { e1: null, e2: 0 },
      routeCounts: [1, 0],
      terminalFrom: "a",
      terminalTo: "c",
    }, new Set(["e1"]));
    const signals = layout.pieces.filter((p) => p.objectKind === "signal");
    expect(signals.length).toBeGreaterThanOrEqual(1);
    const open = layout.links.find((l) => l.id === "e1")!;
    const claimed = layout.links.find((l) => l.id === "e2")!;
    expect(open.seat).toBeNull();
    expect(claimed.seat).toBe(0);
    expect(open.width!).toBeLessThan(claimed.width!);
  });

  it("rail-track source has ballast bed for unclaimed; signal-post mesh exists", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T078");
    expect(src).toContain("tt-ballast");
    expect(src).toContain("signal-post");
    expect(src).toContain("function signalPost");
  });

  it("scene maps signal → porcelain-free signal-post mesh", () => {
    const layout = networkRouteLayout({
      cities: [
        { id: "a", name: "A", x: 0, y: 0 },
        { id: "b", name: "B", x: 5, y: 1 },
      ],
      edges: [{ id: "e1", from: "a", to: "b", length: 4, color: "green" }],
      claims: { e1: null },
      routeCounts: [0, 0],
    }, new Set());
    const render = defaultRenderSpec("network-route-v1", "table") as TabletopRenderInput;
    const scene = mapTabletopToScene(layout, render);
    expect(scene.model.nodes.some((n) => n.mesh === "signal-post")).toBe(true);
  });
});
