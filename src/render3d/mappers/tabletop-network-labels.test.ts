import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { networkRouteLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("network station plaques + unclaimed length marks", () => {
  it("stations carry readable hub:/name tags; no floating station labels", () => {
    const layout = networkRouteLayout(
      {
        cities: [
          { id: "a", name: "北港", x: 0, y: 0 },
          { id: "b", name: "西岭", x: 2, y: 0 },
          { id: "c", name: "南站", x: 1, y: 2 },
        ],
        edges: [
          { id: "ab", from: "a", to: "b" },
          { id: "bc", from: "b", to: "c" },
        ],
        claims: { ab: null, bc: 0 },
        terminalFrom: "a",
        terminalTo: "c",
        routeCounts: [1, 0],
      },
      new Set(),
    );
    const hub = layout.pieces.find((p) => p.id === "a")!;
    const mid = layout.pieces.find((p) => p.id === "b")!;
    expect(hub.label).toBe("hub:北港");
    expect(mid.label).toBe("西岭");
    expect(hub.objectKind).toBe("station");

    const scene = mapTabletopToScene(layout, defaultRenderSpec("network-route-v1", "table") as TabletopRenderInput);
    const stationNodes = scene.model.nodes.filter((n) => n.mesh === "station");
    expect(stationNodes.some((n) => String(n.tag).includes("北港"))).toBe(true);
    expect(stationNodes.some((n) => String(n.tag) === "西岭" || String(n.tag).includes("西岭"))).toBe(true);
    // no faint floating parchment for stations
    expect(scene.model.nodes.some((n) => n.kind === "label" && /北港|西岭|南站/.test(String(n.tag)))).toBe(false);
    // claimed + unclaimed both rail-track
    const rails = scene.model.nodes.filter((n) => n.mesh === "rail-track");
    expect(rails.length).toBeGreaterThanOrEqual(2);
    expect(rails.some((n) => n.seat === 0)).toBe(true);
    expect(rails.some((n) => n.seat == null || n.seat === undefined)).toBe(true);
  });
});
