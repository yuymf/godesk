import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { DEFAULT_NETWORK_CITIES, DEFAULT_NETWORK_EDGES } from "../../runtime/adapters/network-route";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";
import { networkRouteLayout } from "./tabletop-kernels";

describe("network-route train car segments", () => {
  it("binds routes/claims to rail-track and stations to station mesh", () => {
    const spec = defaultRenderSpec("network-route-v1", "table")!;
    const byKind = Object.fromEntries(spec.bindings.map((b) => [b.objectKind, b.mesh]));
    expect(byKind.route).toBe("rail-track");
    expect(byKind.claim).toBe("rail-track");
    expect(byKind.station).toBe("station");
  });

  it("claimed edges map to rail-track link nodes (not road-bar)", () => {
    const layout = networkRouteLayout(
      {
        cities: DEFAULT_NETWORK_CITIES,
        edges: DEFAULT_NETWORK_EDGES,
        claims: { [DEFAULT_NETWORK_EDGES[0]!.id]: 0, [DEFAULT_NETWORK_EDGES[1]!.id]: 1 },
        terminalFrom: DEFAULT_NETWORK_CITIES[0]!.id,
        terminalTo: DEFAULT_NETWORK_CITIES.at(-1)!.id,
        routeCounts: [1, 1],
      },
      new Set(),
    );
    const scene = mapTabletopToScene(layout, defaultRenderSpec("network-route-v1", "table") as TabletopRenderInput);
    const links = scene.model.nodes.filter((n) => n.kind === "link" || n.id.startsWith("link:"));
    const rails = links.filter((n) => n.mesh === "rail-track");
    expect(rails.length).toBeGreaterThan(0);
    expect(links.some((n) => n.mesh === "road-bar")).toBe(false);
    const stations = scene.model.nodes.filter((n) => n.mesh === "station");
    expect(stations.length).toBe(DEFAULT_NETWORK_CITIES.length);
  });
});
