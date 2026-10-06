/**
 * G3D-JUDGE-PIECES · dice + dice-tray constants and tray layout (pure).
 * Geometry builders live in `assets/dice-geometry.ts` (render3d-assets chunk).
 *
 * - Die: rounded cube (RoundedBoxGeometry from three/examples) with real
 *   geometric pips, merged with baked vertex colours → one InstancedMesh for
 *   both dice. Face layout matches `DIE_FACE_EULER` in motion.ts:
 *   1 = +Y, 6 = −Y, 2 = −Z, 5 = +Z, 3 = +X, 4 = −X.
 * - Tray: dark wooden frame with lighter rim caps and a felt bed.
 */

export const DIE_SIZE = 0.44;
export const DIE_RADIUS = 0.08;

export const TRAY = {
  width: 1.62,
  depth: 1.02,
  baseHeight: 0.05,
  rimHeight: 0.17,
  rimThickness: 0.085,
  /** Felt top, local y. */
  feltTop: 0.064,
} as const;

export const DICE_PALETTE = {
  body: "#f6f1e4",
  pip: "#1f232a",
  pipOne: "#b3261e",
  trayWood: "#3f2617",
  trayRim: "#74482a",
  felt: "#1d3a2e",
} as const;

/** Pip offsets (u, v) in units of the pip grid spacing, per face value. */
export const PIP_LAYOUT: Readonly<Record<number, ReadonlyArray<readonly [number, number]>>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

/** Outward axis for each face value. */
export const FACE_AXIS: Readonly<Record<number, readonly [number, number, number]>> = {
  1: [0, 1, 0],
  6: [0, -1, 0],
  2: [0, 0, -1],
  5: [0, 0, 1],
  3: [1, 0, 0],
  4: [-1, 0, 0],
};

/**
 * Tray + dice rest poses in the dice overlay's local frame (tray centred on the
 * origin). The tray is drawn as a fixed screen-corner inset (dice-overlay.ts),
 * so it no longer needs a world anchor beside the island.
 */
export type DiceLayout = {
  tray: { position: [number, number, number]; rotationY: number };
  dice: Array<{ position: [number, number, number]; rotationY: number }>;
};

export function diceLayout(anchor: readonly [number, number] = [0, 0], rotationY = -0.08): DiceLayout {
  const [ax, az] = anchor;
  const trayY = -0.05;
  const dieY = trayY + TRAY.feltTop + DIE_SIZE / 2;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const local = (x: number, z: number): [number, number] => [ax + x * cos + z * sin, az - x * sin + z * cos];
  const [d0x, d0z] = local(-0.32, -0.05);
  const [d1x, d1z] = local(0.32, 0.1);
  return {
    tray: { position: [ax, trayY, az], rotationY },
    dice: [
      { position: [d0x, dieY, d0z], rotationY: rotationY + 0.35 },
      { position: [d1x, dieY, d1z], rotationY: rotationY - 0.5 },
    ],
  };
}

