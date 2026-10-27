import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { networkRouteLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("claimed edges → seat-colored rail cars (shared presentation)", () => {
  it("unclaimed routes stay weak rail-track without seat; claimed carry seat", () => {
    const layout = networkRouteLayout(
      {
        cities: [
          { id: "a", name: "A", x: 0, y: 0 },
          { id: "b", name: "B", x: 2, y: 0 },
          { id: "c", name: "C", x: 1, y: 2 },
        ],
        edges: [
          { id: "ab", from: "a", to: "b" },
          { id: "bc", from: "b", to: "c" },
        ],
        claims: { ab: 0, bc: null },
        terminalFrom: "a",
        terminalTo: "c",
        routeCounts: [1, 0],
      },
      new Set(),
    );
    const claimed = layout.links.find((l) => l.id === "ab")!;
    const open = layout.links.find((l) => l.id === "bc")!;
    expect(claimed.objectKind).toBe("claim");
    expect(claimed.seat).toBe(0);
    expect(claimed.width).toBeGreaterThan(open.width);
    expect(open.objectKind).toBe("route");
    expect(open.seat == null).toBe(true);

    const scene = mapTabletopToScene(layout, defaultRenderSpec("network-route-v1", "table") as TabletopRenderInput);
    const rails = scene.model.nodes.filter((n) => n.mesh === "rail-track");
    expect(rails.length).toBeGreaterThanOrEqual(2);
    const claimedNode = rails.find((n) => n.seat === 0);
    const openNode = rails.find((n) => n.seat == null || n.seat === undefined);
    expect(claimedNode).toBeTruthy();
    expect(openNode).toBeTruthy();
    expect(claimedNode!.material).not.toBe(openNode!.material);
  });
});
