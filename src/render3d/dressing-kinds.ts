import type { SceneNode } from "./scene-model";

/**
 * G3D-ISLAND：由岛屿 / 地形道具图层取代的 #138 节点（灰石板 cliff、灰盒港口 port、船 ship、地块中心装饰 decor）。
 * 单独成模块，SceneHost 静态引用它而不把 island.ts 拉进 render3d 核心包（道具 / 岛屿层懒加载）。
 */
export const REPLACED_NODE_KINDS: ReadonlySet<SceneNode["kind"]> = new Set(["cliff", "port", "ship", "decor"]);
