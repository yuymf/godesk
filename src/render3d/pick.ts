import {
  type Camera,
  type Object3D,
  Raycaster,
  Vector2,
} from "three";

export type PickTarget = {
  nodeId: string;
  kind: string;
  /** World-space hit point (G3D-14: grid boards resolve the cell from it). */
  point?: readonly [number, number, number];
};

export type PickableLegalAction = {
  type: string;
  payload?: Record<string, unknown> | null;
};

const raycaster = new Raycaster();
const pointer = new Vector2();

/**
 * Raycast from a pointer event into the SceneHost content root.
 * Returns the nearest Object3D with userData.nodeId, if any.
 */
export function pickFromPointerEvent(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  camera: Camera,
  root: Object3D,
): PickTarget | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(root.children, true);
  for (const hit of hits) {
    let current: Object3D | null = hit.object;
    while (current) {
      // G3D-09: objects fading out (already gone from state) are never pickable.
      if (current.userData?.removing) break;
      const instanceIds = current.userData?.hitInstanceIds as string[] | undefined;
      if (instanceIds && typeof hit.instanceId === "number" && instanceIds[hit.instanceId]) {
        return {
          nodeId: instanceIds[hit.instanceId]!,
          kind: String(current.userData?.kind ?? "hit"),
          point: [hit.point.x, hit.point.y, hit.point.z],
        };
      }
      const nodeId = current.userData?.nodeId;
      if (typeof nodeId === "string" && nodeId.length > 0) {
        return {
          nodeId,
          kind: String(current.userData?.kind ?? ""),
          point: [hit.point.x, hit.point.y, hit.point.z],
        };
      }
      current = current.parent;
    }
  }
  return null;
}

/** Map a SceneNode id to a Kernel action type + payload when it matches a LegalAction. */
export function matchPickToLegalAction(
  target: PickTarget,
  legalActions: readonly PickableLegalAction[],
): { type: string; payload?: Record<string, unknown> } | null {
  for (const action of legalActions) {
    if (action.type === "place_settlement") {
      const vertexId = String(action.payload?.vertexId ?? "");
      if (
        target.nodeId === `hit:place_settlement:${vertexId}` ||
        target.nodeId === `settle:${vertexId}`
      ) {
        return { type: action.type, payload: { ...(action.payload ?? {}) } };
      }
    }
    if (action.type === "place_city") {
      const vertexId = String(action.payload?.vertexId ?? "");
      if (
        target.nodeId === `hit:place_city:${vertexId}` ||
        target.nodeId === `settle:${vertexId}` ||
        target.nodeId === `city:${vertexId}`
      ) {
        return { type: action.type, payload: { ...(action.payload ?? {}) } };
      }
    }
    if (action.type === "place_road") {
      const edgeId = String(action.payload?.edgeId ?? "");
      if (
        target.nodeId === `hit:place_road:${edgeId}` ||
        target.nodeId === `road:${edgeId}`
      ) {
        return { type: action.type, payload: { ...(action.payload ?? {}) } };
      }
    }
    if (action.type === "move_robber") {
      const hex = String(action.payload?.hex ?? "");
      if (
        target.nodeId === `hit:move_robber:${hex}` ||
        target.nodeId === `tile:${hex}`
      ) {
        return { type: action.type, payload: { ...(action.payload ?? {}) } };
      }
    }
  }
  if (target.nodeId.startsWith("tile:")) {
    const hex = target.nodeId.slice("tile:".length);
    const robber = legalActions.find(
      (action) =>
        action.type === "move_robber" && String(action.payload?.hex ?? "") === hex,
    );
    if (robber) {
      return { type: "move_robber", payload: { ...(robber.payload ?? {}) } };
    }
  }
  return null;
}
