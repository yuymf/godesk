/**
 * G3D-ISLAND / G3D-PROPS 胶水：汐屿棋盘输入 → 地形道具 + 岛屿海岸两个图层（SceneHost 只调这一个对象）。
 * 被取代的 #138 节点（灰石板 cliff / 灰盒港口 port / 船 ship / 地块中心装饰 decor）由
 * `withoutReplacedNodes` 从 SceneModel 中滤掉，不改 mapper（mapper 归属 Track C）。
 */
import { Group, type Camera } from "three";
import type { HexSettlementSceneInput } from "./mappers/hex-settlement";
import { REPLACED_NODE_KINDS } from "./dressing-kinds";
import { createIslandLayer, type IslandPort, type IslandTile } from "./island";
import type { SceneModel, SceneNode, SceneVec3 } from "./scene-model";
import { createTerrainPropLayer } from "./terrain-props";
import type { RenderTierId } from "./tiers";

/** 与 mapper 的 hexCenter × WORLD_SCALE 一致（平顶，外接半径 1.0）。 */
export function tileCenter(q: number, r: number): SceneVec3 {
  return [1.5 * q, 0, (Math.sqrt(3) / 2) * q + Math.sqrt(3) * r];
}

/** 顶点 id `x:y`（像素）→ 世界坐标。 */
export function vertexWorld(id: string): SceneVec3 | null {
  const [xs, ys] = id.split(":");
  const x = Number(xs);
  const y = Number(ys);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x * 0.01, 0, y * 0.01];
}

export function dressingInputs(hex: HexSettlementSceneInput): { tiles: IslandTile[]; ports: IslandPort[] } {
  return {
    tiles: hex.tiles.map((t) => ({ q: t.q, r: t.r, terrain: t.terrain, center: tileCenter(t.q, t.r) })),
    ports: hex.ports.map((p) => ({
      kind: p.kind,
      vertices: p.vertices.map(vertexWorld).filter((v): v is SceneVec3 => v !== null),
    })),
  };
}

export function withoutReplacedNodes(model: SceneModel): SceneModel {
  return { ...model, nodes: model.nodes.filter((n) => !REPLACED_NODE_KINDS.has(n.kind)) };
}

export type HexDressing = {
  group: Group;
  sync(hex: HexSettlementSceneInput, tier: RenderTierId, castShadow: boolean): void;
  update(nowMs: number, camera: Camera, frozen: boolean): void;
  /** 港口锚点（评审机位 c-coast 用；kind = "port"）。 */
  portNodes(): SceneNode[];
  stats(): { props: ReturnType<ReturnType<typeof createTerrainPropLayer>["stats"]>; island: ReturnType<ReturnType<typeof createIslandLayer>["stats"]> };
  dispose(): void;
};

export function createHexDressing(): HexDressing {
  const group = new Group();
  group.name = "hex-dressing";
  const props = createTerrainPropLayer();
  const island = createIslandLayer();
  group.add(props.group, island.group);
  return {
    group,
    sync(hex, tier, castShadow) {
      const { tiles, ports } = dressingInputs(hex);
      props.sync(tiles, tier, castShadow);
      island.sync(tiles, ports, tier, castShadow);
    },
    update: (now, camera, frozen) => island.update(now, camera, frozen),
    portNodes: () =>
      island.docks().map((d, i) => ({ id: `dock:${i}`, kind: "port" as const, position: d.tip, tag: d.kind })),
    stats: () => ({ props: props.stats(), island: island.stats() }),
    dispose() {
      props.dispose();
      island.dispose();
    },
  };
}
