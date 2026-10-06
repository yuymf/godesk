import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { HARBOR_TARGET_GROUPS, createHarborVoyageState } from "../../runtime/harbor-voyage";
import { mapTabletopToScene, resolveTabletopPick, tokenForRenderMaterial, type TabletopRenderInput } from "./tabletop";
import {
  discFlippingLayout,
  harborVoyageLayout,
  networkRouteLayout,
  workerPlacementLayout,
} from "./tabletop-kernels";

const renderFor = (kernel: string) => defaultRenderSpec(kernel, "table") as TabletopRenderInput;

function othelloStart() {
  const board: Array<Array<number | null>> = Array.from({ length: 8 }, () => Array<number | null>(8).fill(null));
  board[3]![3] = 1;
  board[3]![4] = 0;
  board[4]![3] = 0;
  board[4]![4] = 1;
  return { rows: 8, cols: 8, board };
}

const OTHELLO_LEGAL = [
  { type: "place", payload: { row: 2, col: 3 } },
  { type: "place", payload: { row: 3, col: 2 } },
  { type: "place", payload: { row: 4, col: 5 } },
  { type: "place", payload: { row: 5, col: 4 } },
];

describe("G3D-14 tabletop mapper", () => {
  it("maps disc-flipping to board + grid + seat-coloured discs + legal hints", () => {
    const scene = mapTabletopToScene(discFlippingLayout(othelloStart(), OTHELLO_LEGAL), renderFor("disc-flipping-v1"));
    const kinds = scene.model.nodes.map((node) => node.kind);
    expect(kinds.filter((kind) => kind === "piece")).toHaveLength(4);
    expect(kinds.filter((kind) => kind === "hint")).toHaveLength(4);
    expect(scene.model.nodes.find((node) => node.id === "grid")?.tag).toBe("8x8");
    const black = scene.model.nodes.find((node) => node.id === "piece:disc:3,4")!;
    const white = scene.model.nodes.find((node) => node.id === "piece:disc:3,3")!;
    expect(scene.materials[black.material!]!.base).toBe("#1d1d1f");
    expect(scene.materials[white.material!]!.base).toBe("#f4efe6");
    // 座位材质只借彩漆木法线 / ORM，不用其底色。
    expect(scene.materials[black.material!]).toMatchObject({ pbrSet: "t09-paintwood", pbrBaseColor: false });
    // 翻转棋默认不开水面：桌面用木纹桌。
    expect(scene.model.nodes.find((node) => node.id === "table")?.tag).toBe("wood");
  });

  it("resolves picks from hints and from the board hit point", () => {
    const scene = mapTabletopToScene(discFlippingLayout(othelloStart(), OTHELLO_LEGAL), renderFor("disc-flipping-v1"));
    expect(resolveTabletopPick(scene, { nodeId: "hint:2,3" })).toEqual({ type: "place", payload: { row: 2, col: 3 } });
    const grid = scene.grid!;
    const x = grid.x0 + (4 + 0.5) * grid.cell;
    const z = grid.z0 + (5 + 0.5) * grid.cell;
    expect(resolveTabletopPick(scene, { nodeId: "board", point: [x, 0.24, z] })).toEqual({
      type: "place",
      payload: { row: 5, col: 4 },
    });
    // 非法格子 / 网格外：不发动作。
    expect(resolveTabletopPick(scene, { nodeId: "board", point: [grid.x0 + 0.5 * grid.cell, 0.24, grid.z0 + 0.5 * grid.cell] })).toBeNull();
    expect(resolveTabletopPick(scene, { nodeId: "board", point: [99, 0, 99] })).toBeNull();
    expect(resolveTabletopPick(scene, { nodeId: "table" })).toBeNull();
  });

  it("changes material library keys when configure_render edits a material or water", () => {
    const base = renderFor("disc-flipping-v1");
    const first = mapTabletopToScene(discFlippingLayout(othelloStart(), []), base);
    const edited = structuredClone(base);
    edited.materials.seat0 = { ...edited.materials.seat0!, roughness: 0.15, metalness: 0.6 };
    edited.water.enabled = true;
    edited.water.shallow = "#3a7bd5";
    const second = mapTabletopToScene(discFlippingLayout(othelloStart(), []), edited);
    const keyOf = (scene: typeof first, id: string) => scene.model.nodes.find((node) => node.id === id)!.material;
    expect(keyOf(second, "piece:disc:3,4")).not.toBe(keyOf(first, "piece:disc:3,4"));
    expect(keyOf(second, "piece:disc:3,3")).toBe(keyOf(first, "piece:disc:3,3"));
    const table = second.model.nodes.find((node) => node.id === "table")!;
    expect(table.tag).toBe("water");
    expect(second.materials[table.material!]!.base).toBe("#3a7bd5");
    expect(second.layoutKey).toBe(first.layoutKey);
  });

  it("falls back to a built-in primitive when a binding is missing", () => {
    const render = renderFor("disc-flipping-v1");
    render.bindings = [];
    const scene = mapTabletopToScene(discFlippingLayout(othelloStart(), []), render);
    expect(scene.model.nodes.find((node) => node.kind === "piece")?.mesh).toBe("disc");
  });

  it("maps pattern materials to the G3D-22 PBR sets", () => {
    // 呢面盘面不借 t10-canvas（粗帆布纹 + 单级 mip 在盘面尺度上成块 / 走样），保留程序化 cloth pattern。
    expect(tokenForRenderMaterial("board", { base: "#1f6b4a", roughness: 0.8, metalness: 0, pattern: "cloth" })).toEqual({
      base: "#1f6b4a", roughness: 0.8, metalness: 0, pattern: "cloth",
    });
    expect(tokenForRenderMaterial("table", { base: "#8b5a2b", roughness: 0.8, metalness: 0, pattern: "grain" }).pbrSet).toBe("t08-wood");
    expect(tokenForRenderMaterial("map", { base: "#c9b68a", roughness: 0.8, metalness: 0, pattern: "none" }).pbrSet).toBeUndefined();
  });

  it("maps network-route stations, unclaimed routes, claims and legal edges", () => {
    const layout = networkRouteLayout({
      cities: [
        { id: "a", name: "A", x: 40, y: 40 },
        { id: "b", name: "B", x: 360, y: 40 },
        { id: "c", name: "C", x: 200, y: 260 },
      ],
      edges: [
        { id: "ab", from: "a", to: "b" },
        { id: "bc", from: "b", to: "c" },
        { id: "ca", from: "c", to: "a" },
      ],
      claims: { ab: 0, bc: null, ca: null },
      terminalFrom: "a",
      terminalTo: "c",
    }, new Set(["bc"]));
    const scene = mapTabletopToScene(layout, renderFor("network-route-v1"));
    const links = scene.model.nodes.filter((node) => node.kind === "link");
    expect(links).toHaveLength(3);
    const claimed = links.find((node) => node.id === "link:ab")!;
    expect(claimed.seat).toBe(0);
    expect(scene.materials[claimed.material!]!.base).toBe("#c0392b");
    expect(resolveTabletopPick(scene, { nodeId: "link:bc" })).toEqual({ type: "claim", payload: { edgeId: "bc" } });
    expect(resolveTabletopPick(scene, { nodeId: "link:ab" })).toBeNull();
    // 坐标归一到约 8 单位宽的桌面。
    const xs = scene.model.nodes.filter((node) => node.kind === "piece").map((node) => node.position[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(8, 1);
  });

  it("maps worker-placement regions to cells with worker pawns and buildings", () => {
    const layout = workerPlacementLayout({
      regions: [
        { id: "forest", name: "森林", capacity: 2 },
        { id: "market", name: "市集", capacity: 1 },
        { id: "mill", name: "磨坊", capacity: 1 },
      ],
      placements: [{ id: "p1", seat: 1, regionId: "forest" }],
      players: [{ seat: 0, buildings: 2 }, { seat: 1, buildings: 0 }],
    }, new Set(["forest", "market"]));
    const scene = mapTabletopToScene(layout, renderFor("worker-placement-v1"));
    expect(scene.model.nodes.filter((node) => node.kind === "cell" && node.id.startsWith("cell:"))).toHaveLength(3);
    expect(scene.model.nodes.filter((node) => node.mesh === "pawn")).toHaveLength(1);
    expect(scene.model.nodes.filter((node) => node.mesh === "house")).toHaveLength(2);
    expect(resolveTabletopPick(scene, { nodeId: "cell:tile-square:market" })).toEqual({ type: "place:market" });
    expect(resolveTabletopPick(scene, { nodeId: "hint:forest" })).toEqual({ type: "place:forest" });
    expect(resolveTabletopPick(scene, { nodeId: "cell:tile-square:mill" })).toBeNull();
  });

  it("maps harbor-voyage lanes, ships, cargo tints and shore targets (water table)", () => {
    const voyage = createHarborVoyageState(3);
    const targets = HARBOR_TARGET_GROUPS.flatMap((group) => group.targets);
    const layout = harborVoyageLayout({
      punts: voyage.punts.map((punt) => ({ cargoId: punt.cargoId, position: punt.position, color: punt.color })),
      placements: [{ id: "h1", seat: 2, targetId: "amber" }, { id: "h2", seat: 0, targetId: "port-a" }],
      targets,
    }, new Set(["amber", "yard-a"]));
    const scene = mapTabletopToScene(layout, renderFor("harbor-voyage-v1"));
    expect(scene.model.nodes.filter((node) => node.mesh === "ship")).toHaveLength(3);
    const amberCargo = scene.model.nodes.find((node) => node.id === "piece:disc:cargo:amber")!;
    expect(scene.materials[amberCargo.material!]!.base).toBe("#8c4d32");
    expect(scene.model.nodes.find((node) => node.id === "table")?.tag).toBe("water");
    expect(resolveTabletopPick(scene, { nodeId: "piece:ship:ship:amber" })).toEqual({ type: "place:amber" });
    expect(resolveTabletopPick(scene, { nodeId: "cell:tile-square:yard-a" })).toEqual({ type: "place:yard-a" });
    expect(scene.model.nodes.filter((node) => node.mesh === "pawn")).toHaveLength(2);
    // 所有对象都在底板范围内。
    const board = scene.model.nodes.find((node) => node.id === "board")!;
    for (const node of scene.model.nodes) {
      if (node.kind === "table" || node.id === "board") continue;
      expect(Math.abs(node.position[2])).toBeLessThanOrEqual(board.scale![2] / 2);
    }
  });
});
