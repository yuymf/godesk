import { Group, type InstancedMesh, Matrix4, MeshStandardMaterial, type Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../creator/render-spec";
import type { MaterialLibrary } from "./materials";
import { mapTabletopToScene, type TabletopRenderInput, type TabletopScene } from "./mappers/tabletop";
import { discFlippingLayout } from "./mappers/tabletop-kernels";
import { reconcileScene, type ReconcileHost } from "./reconcile";
import type { SceneModel } from "./scene-model";
import { createTabletopObject, instanceBatchesOf, updateTabletopObject } from "./tabletop-objects";
import { TIER_CAPS, type RenderTierId } from "./tiers";

/**
 * G3D-14 follow-up：翻转棋满盘 draw call 预算（§4.6：low ≤ 60、medium ≤ 100）。
 * 无 WebGL 的单测里按渲染器的计数规则估算一帧：
 * 天空穹顶 1 次 + 主通道每个可见网格 / 线段 1 次（InstancedMesh 有实例时 1 次）+ 阴影通道每个投影体 1 次。
 * 浏览器内实测（`?perf=1` 的 renderer.calls）见 PR 证据，与本估算一致。
 */
const SKY_DOME_CALLS = 1;

function estimateDrawCalls(root: Object3D, tier: RenderTierId): number {
  root.updateMatrixWorld(true);
  let main = 0;
  let shadow = 0;
  root.traverse((object) => {
    if (!object.visible) return;
    const drawable = object as Object3D & { isMesh?: boolean; isLine?: boolean; isInstancedMesh?: boolean; count?: number };
    if (!drawable.isMesh && !drawable.isLine) return;
    if (drawable.isInstancedMesh && !drawable.count) return;
    main += 1;
    if (object.castShadow && TIER_CAPS[tier].shadowMapSize > 0) shadow += 1;
  });
  return SKY_DOME_CALLS + main + shadow;
}

const stubLibrary = () => {
  const cache = new Map<string, MeshStandardMaterial>();
  return {
    get: (key: string) => {
      let material = cache.get(key);
      if (!material) {
        material = new MeshStandardMaterial();
        material.userData.gdShared = true;
        cache.set(key, material);
      }
      return material;
    },
  } as unknown as MaterialLibrary;
};

function mount(scene: TabletopScene) {
  const root = new Group();
  const library = stubLibrary();
  const ctx = () => ({ library, caps: TIER_CAPS.low, materials: scene.materials });
  let current = scene;
  const host: ReconcileHost = {
    root,
    create: (node) => createTabletopObject(node, { ...ctx(), materials: current.materials }),
    update: (object, node) => updateTabletopObject(object, node, { ...ctx(), materials: current.materials }),
    disposeObject: () => {},
  };
  const registry = new Map<string, Object3D>();
  let model: SceneModel | null = reconcileScene(host, null, scene.model, registry);
  return {
    root,
    registry,
    apply(next: TabletopScene) {
      current = next;
      model = reconcileScene(host, model, next.model, registry);
    },
  };
}

const render = defaultRenderSpec("disc-flipping-v1", "table") as TabletopRenderInput;

function board(fill: (row: number, col: number) => number | null) {
  return { rows: 8, cols: 8, board: Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => fill(row, col))) };
}

describe("G3D-14 follow-up · 翻转棋实例化 draw call", () => {
  it("满盘 64 子：low ≤ 60、medium ≤ 100，棋子按座位材质合成 2 个 InstancedMesh", () => {
    const full = board((row, col) => ((row + col) % 3 === 0 ? 1 : 0));
    const scene = mapTabletopToScene(discFlippingLayout(full, []), render);
    expect(scene.model.nodes.filter((node) => node.kind === "piece")).toHaveLength(64);
    const { root } = mount(scene);
    const batches = instanceBatchesOf(root);
    expect(batches).toHaveLength(2);
    expect(batches.reduce((sum, batch) => sum + batch.count, 0)).toBe(64);
    const low = estimateDrawCalls(root, "low");
    const medium = estimateDrawCalls(root, "medium");
    expect(low).toBeLessThanOrEqual(60);
    expect(medium).toBeLessThanOrEqual(100);
    // 天空 + 桌面 + 盘面 + 网格线 + 2 个合批。
    expect(low).toBe(6);
  });

  it("中盘带合法提示环也在 low 预算内", () => {
    const mid = board((row, col) => (row < 4 ? ((row * 8 + col) % 2) : null));
    const legal = Array.from({ length: 8 }, (_, col) => ({ type: "place", payload: { row: 4, col } }));
    const { root } = mount(mapTabletopToScene(discFlippingLayout(mid, legal), render));
    expect(estimateDrawCalls(root, "low")).toBeLessThanOrEqual(60);
  });

  it("实例矩阵跟随代理位姿；翻面换合批；移除后空合批被释放", () => {
    const start = board((row, col) => (row === 3 && col === 3 ? 1 : row === 3 && col === 4 ? 0 : null));
    const mounted = mount(mapTabletopToScene(discFlippingLayout(start, []), render));
    mounted.root.updateMatrixWorld(true);
    const proxy = mounted.registry.get("piece:disc:3,3")!;
    const batchMesh = mounted.root.children.find(
      (child) => (child as InstancedMesh).isInstancedMesh && (child as InstancedMesh).material === proxy.userData.batchMaterial,
    ) as InstancedMesh;
    const matrix = new Matrix4();
    batchMesh.getMatrixAt(0, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix).distanceTo(proxy.position)).toBeLessThan(1e-6);

    // 3,3 由白翻黑：两个子都进座位 0 的合批，座位 1 合批清空并移出场景。
    const flipped = board((row, col) => (row === 3 && (col === 3 || col === 4) ? 0 : null));
    mounted.apply(mapTabletopToScene(discFlippingLayout(flipped, []), render));
    expect(instanceBatchesOf(mounted.root)).toEqual([expect.objectContaining({ count: 2 })]);
    expect(mounted.root.children.filter((child) => (child as InstancedMesh).isInstancedMesh)).toHaveLength(1);

    mounted.apply(mapTabletopToScene(discFlippingLayout(board(() => null), []), render));
    expect(instanceBatchesOf(mounted.root)).toEqual([]);
    expect(mounted.root.children.filter((child) => (child as InstancedMesh).isInstancedMesh)).toHaveLength(0);
  });
});
