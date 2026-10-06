export type SceneVec3 = readonly [number, number, number];

export type SceneNodeKind =
  | "tile"
  | "number-token"
  | "robber"
  | "settlement"
  | "city"
  | "road"
  | "port"
  | "ship"
  | "die"
  | "dice-tray"
  | "cliff"
  | "decor"
  // G3D-14 通用桌面（mappers/tabletop.ts）：格位 / 棋子 / 连线 / 合法提示 / 桌面底板。
  | "cell"
  | "piece"
  | "link"
  | "hint"
  | "table";

export type SceneNode = {
  id: string;
  kind: SceneNodeKind;
  position: SceneVec3;
  rotationY?: number;
  scale?: SceneVec3;
  /** Terrain / seat / port kind for materials. */
  tag?: string;
  /** Number token face value (2–12), when kind is number-token. */
  number?: number | null;
  seat?: number;
  /** G3D-14：RenderSpec 内置网格（bindings[].mesh），通用桌面节点使用。 */
  mesh?: string;
  /** G3D-14：材质库 key（含材质值摘要，材质被 configure_render 改动时 key 随之变化）。 */
  material?: string;
};

export type SceneModel = {
  nodes: readonly SceneNode[];
};

export type SceneDiff = {
  added: readonly SceneNode[];
  removed: readonly string[];
  updated: readonly SceneNode[];
};

export function diffSceneModels(prev: SceneModel | null, next: SceneModel): SceneDiff {
  const prevById = new Map((prev?.nodes ?? []).map((node) => [node.id, node]));
  const nextById = new Map(next.nodes.map((node) => [node.id, node]));
  const added: SceneNode[] = [];
  const updated: SceneNode[] = [];
  const removed: string[] = [];

  for (const node of next.nodes) {
    const prior = prevById.get(node.id);
    if (!prior) {
      added.push(node);
      continue;
    }
    if (JSON.stringify(prior) !== JSON.stringify(node)) {
      updated.push(node);
    }
  }
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) {
      removed.push(id);
    }
  }
  return { added, removed, updated };
}
