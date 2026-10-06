/**
 * G3D-JUDGE-PIECES · own-modelled dice + wooden dice tray geometry (no external assets).
 * Lives under `render3d/assets/` (procedural "model assets", render3d-assets chunk).
 */
import { BoxGeometry, BufferGeometry, CylinderGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DICE_PALETTE, DIE_RADIUS, DIE_SIZE, FACE_AXIS, PIP_LAYOUT, TRAY } from "../dice";
import { mergeParts, paintPart } from "./pieces";

export function buildDieGeometry(): BufferGeometry {
  const half = DIE_SIZE / 2;
  const parts: BufferGeometry[] = [paintPart(new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 2, DIE_RADIUS), DICE_PALETTE.body, { smooth: true })];
  const grid = DIE_SIZE * 0.26;
  const pipRadius = DIE_SIZE * 0.085;
  const pipDepth = 0.008;
  for (const [faceKey, cells] of Object.entries(PIP_LAYOUT)) {
    const face = Number(faceKey);
    const [ax, ay, az] = FACE_AXIS[face]!;
    const color = face === 1 ? DICE_PALETTE.pipOne : DICE_PALETTE.pip;
    const radius = face === 1 ? pipRadius * 1.35 : pipRadius;
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
  const { width, depth, baseHeight, rimHeight, rimThickness, feltTop } = TRAY;
  const parts: BufferGeometry[] = [];
  parts.push(paintPart(new BoxGeometry(width, baseHeight, depth), DICE_PALETTE.trayWood, { pos: [0, baseHeight / 2, 0] }));
  parts.push(
    paintPart(new BoxGeometry(width - rimThickness * 2, feltTop - baseHeight + 0.002, depth - rimThickness * 2), DICE_PALETTE.felt, {
      pos: [0, (baseHeight + feltTop) / 2, 0],
    }),
  );
  const rimY = baseHeight + rimHeight / 2 - 0.01;
  for (const side of [1, -1]) {
    parts.push(
      paintPart(new BoxGeometry(width, rimHeight, rimThickness), DICE_PALETTE.trayWood, {
        pos: [0, rimY, side * (depth / 2 - rimThickness / 2)],
      }),
    );
    parts.push(
      paintPart(new BoxGeometry(rimThickness, rimHeight, depth - rimThickness * 2), DICE_PALETTE.trayWood, {
        pos: [side * (width / 2 - rimThickness / 2), rimY, 0],
      }),
    );
    // Lighter bevelled caps on top of the rim.
    const capY = baseHeight + rimHeight - 0.01 + 0.007;
    parts.push(
      paintPart(new BoxGeometry(width + 0.012, 0.014, rimThickness + 0.012), DICE_PALETTE.trayRim, {
        pos: [0, capY, side * (depth / 2 - rimThickness / 2)],
      }),
    );
    parts.push(
      paintPart(new BoxGeometry(rimThickness + 0.012, 0.014, depth - rimThickness * 2), DICE_PALETTE.trayRim, {
        pos: [side * (width / 2 - rimThickness / 2), capY, 0],
      }),
    );
  }
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
