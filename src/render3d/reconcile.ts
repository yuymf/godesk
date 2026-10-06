import type { Object3D } from "three";
import { diffSceneModels, type SceneModel, type SceneNode } from "./scene-model";

export type SceneNodeFactory = (node: SceneNode) => Object3D;
export type SceneNodeUpdater = (object: Object3D, node: SceneNode) => void;

/** G3D-09: optional motion hooks; reconcile stays synchronous and state-authoritative. */
export type ReconcileMotionHooks = {
  /** Called after a node is created on a non-initial reconcile. */
  added?: (object: Object3D, node: SceneNode) => void;
  /** Called after `update` applied the final pose; `prev` is the prior node. */
  updated?: (object: Object3D, prev: SceneNode, node: SceneNode) => void;
  /**
   * Removal animation. Must eventually call `detach` (which removes + disposes).
   * When absent, the object is detached immediately.
   */
  removed?: (object: Object3D, id: string, detach: () => void) => void;
};

export type ReconcileHost = {
  root: Object3D;
  create: SceneNodeFactory;
  update: SceneNodeUpdater;
  disposeObject: (object: Object3D) => void;
  motion?: ReconcileMotionHooks;
};

/**
 * Apply SceneModel diffs onto a Three.js object tree keyed by node id.
 * The registry always reflects `next` immediately (removed ids leave it at once,
 * even while their fade-out is still playing), so picks and later diffs never
 * see stale objects.
 */
export function reconcileScene(
  host: ReconcileHost,
  prev: SceneModel | null,
  next: SceneModel,
  registry: Map<string, Object3D>,
): SceneModel {
  const { added, removed, updated } = diffSceneModels(prev, next);
  const animate = prev !== null && host.motion !== undefined;
  const prevById = animate ? new Map(prev.nodes.map((node) => [node.id, node])) : null;

  for (const id of removed) {
    const object = registry.get(id);
    if (!object) continue;
    registry.delete(id);
    let detached = false;
    const detach = () => {
      if (detached) return;
      detached = true;
      host.root.remove(object);
      host.disposeObject(object);
    };
    if (animate && host.motion?.removed) {
      object.userData.removing = true;
      host.motion.removed(object, id, detach);
    } else {
      detach();
    }
  }

  for (const node of added) {
    const object = host.create(node);
    object.name = node.id;
    host.root.add(object);
    registry.set(node.id, object);
    if (animate) host.motion?.added?.(object, node);
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
    const prior = prevById?.get(node.id);
    if (animate && prior) host.motion?.updated?.(object, prior, node);
  }

  return next;
}
