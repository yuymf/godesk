import type { Object3D } from "three";
import { diffSceneModels, type SceneModel, type SceneNode } from "./scene-model";

export type SceneNodeFactory = (node: SceneNode) => Object3D;
export type SceneNodeUpdater = (object: Object3D, node: SceneNode) => void;

export type ReconcileHost = {
  root: Object3D;
  create: SceneNodeFactory;
  update: SceneNodeUpdater;
  disposeObject: (object: Object3D) => void;
};

/**
 * Apply SceneModel diffs onto a Three.js object tree keyed by node id.
 */
export function reconcileScene(
  host: ReconcileHost,
  prev: SceneModel | null,
  next: SceneModel,
  registry: Map<string, Object3D>,
): SceneModel {
  const { added, removed, updated } = diffSceneModels(prev, next);

  for (const id of removed) {
    const object = registry.get(id);
    if (!object) continue;
    host.root.remove(object);
    host.disposeObject(object);
    registry.delete(id);
  }

  for (const node of added) {
    const object = host.create(node);
    object.name = node.id;
    host.root.add(object);
    registry.set(node.id, object);
  }

  for (const node of updated) {
    const object = registry.get(node.id);
    if (!object) {
      const created = host.create(node);
      created.name = node.id;
      host.root.add(created);
      registry.set(node.id, created);
      continue;
    }
    host.update(object, node);
  }

  return next;
}
