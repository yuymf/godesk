/**
 * G3D-JUDGE-PIECES · own-modelled dice + thin felt-pad tray geometry (no external assets).
 * Lives under `render3d/assets/` (procedural "model assets", render3d-assets chunk).
 */
import { BoxGeometry, BufferGeometry, CylinderGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DICE_PALETTE, DIE_RADIUS, DIE_SIZE, FACE_AXIS, PIP_LAYOUT, TRAY } from "../dice";
import { mergeParts, paintPart } from "./pieces";

export function buildDieGeometry(): BufferGeometry {
  const half = DIE_SIZE / 2;
  const parts: BufferGeometry[] = [paintPart(new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 2, DIE_RADIUS), DICE_PALETTE.body, { smooth: true })];
  const grid = DIE_SIZE * 0.27;
  const pipRadius = DIE_SIZE * 0.11;
  const pipDepth = 0.012;
  for (const [faceKey, cells] of Object.entries(PIP_LAYOUT)) {
    const face = Number(faceKey);
    const [ax, ay, az] = FACE_AXIS[face]!;
    const color = face === 1 ? DICE_PALETTE.pipOne : DICE_PALETTE.pip;
    const radius = face === 1 ? pipRadius * 1.45 : pipRadius;
    for (const [u, v] of cells) {
      // Cylinder axis is +Y; orient it along the face normal and place on the face plane.
      const offset = half + pipDepth / 2 - 0.003;
      let pos: [number, number, number];
      let rot: [number, number, number];
      if (ay !== 0) {
        pos = [u * grid, ay * offset, v * grid];
        rot = [ay > 0 ? 0 : Math.PI, 0, 0];
      } else if (az !== 0) {
        pos = [u * grid, v * grid, az * offset];
        rot = [az > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0];
      } else {
        pos = [ax * offset, u * grid, v * grid];
        rot = [0, 0, ax > 0 ? -Math.PI / 2 : Math.PI / 2];
      }
      parts.push(paintPart(new CylinderGeometry(radius, radius, pipDepth, 10), color, { pos, rot }));
    }
  }
  return mergeParts(parts);
}

export function buildDiceTrayGeometry(): BufferGeometry {
  // round-7 ③：木雕托盘 — 厚橡木墙 + 金唇线 + 凹进绒面，去掉黑矩形垫。
  const { width, depth, baseHeight, rimHeight, rimThickness, feltTop } = TRAY;
  const parts: BufferGeometry[] = [];
  // Oak floor plank.
  parts.push(paintPart(new BoxGeometry(width, baseHeight, depth), DICE_PALETTE.trayWood, { pos: [0, baseHeight / 2, 0] }));
  // Recessed felt bed.
  const bedW = width - rimThickness * 2;
  const bedD = depth - rimThickness * 2;
  parts.push(
    paintPart(new BoxGeometry(bedW, Math.max(feltTop - baseHeight * 0.4, 0.02), bedD), DICE_PALETTE.felt, {
      pos: [0, (baseHeight + feltTop) / 2, 0],
    }),
  );
  // Carved wood walls (taller).
  const rimY = baseHeight + rimHeight / 2;
  for (const side of [1, -1] as const) {
    parts.push(
      paintPart(new BoxGeometry(width, rimHeight, rimThickness), DICE_PALETTE.trayRim, {
        pos: [0, rimY, side * (depth / 2 - rimThickness / 2)],
      }),
    );
    parts.push(
      paintPart(new BoxGeometry(rimThickness, rimHeight, depth - rimThickness * 2), DICE_PALETTE.trayRim, {
        pos: [side * (width / 2 - rimThickness / 2), rimY, 0],
      }),
    );
  }
  // Gold lip cap on rim top.
  const lipH = 0.018;
  const lipY = baseHeight + rimHeight + lipH / 2;
  for (const side of [1, -1] as const) {
    parts.push(
      paintPart(new BoxGeometry(width + 0.02, lipH, rimThickness * 0.55), DICE_PALETTE.trayGold, {
        pos: [0, lipY, side * (depth / 2 - rimThickness / 2)],
      }),
    );
    parts.push(
      paintPart(new BoxGeometry(rimThickness * 0.55, lipH, depth - rimThickness), DICE_PALETTE.trayGold, {
        pos: [side * (width / 2 - rimThickness / 2), lipY, 0],
      }),
    );
  }
  // Outer bevel foot.
  parts.push(paintPart(new BoxGeometry(width + 0.06, 0.02, depth + 0.06), DICE_PALETTE.trayRim, { pos: [0, 0.01, 0] }));
  return mergeParts(parts);
}

let DIE_GEOM: BufferGeometry | null = null;
let TRAY_GEOM: BufferGeometry | null = null;

export function dieGeometry(): BufferGeometry {
  if (!DIE_GEOM) {
    DIE_GEOM = buildDieGeometry();
    DIE_GEOM.userData.gdShared = true;
  }
  return DIE_GEOM;
}

export function diceTrayGeometry(): BufferGeometry {
  if (!TRAY_GEOM) {
    TRAY_GEOM = buildDiceTrayGeometry();
    TRAY_GEOM.userData.gdShared = true;
  }
  return TRAY_GEOM;
}

export function disposeDiceGeometries(): void {
  DIE_GEOM?.dispose();
  TRAY_GEOM?.dispose();
  DIE_GEOM = null;
  TRAY_GEOM = null;
}
