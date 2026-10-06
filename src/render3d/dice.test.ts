import { describe, expect, it } from "vitest";
import { Color, Matrix4, Object3D, Vector3 } from "three";
import { buildDiceTrayGeometry, buildDieGeometry } from "./assets/dice-geometry";
import { DICE_PALETTE, diceAnchorFor, diceLayout, DIE_SIZE, FACE_AXIS, PIP_LAYOUT, TRAY } from "./dice";
import { applyDieOrientation } from "./motion";

describe("dice", () => {
  it("pip layout: face n has n pips and opposite faces sum to 7", () => {
    for (let n = 1; n <= 6; n += 1) expect(PIP_LAYOUT[n]).toHaveLength(n);
    for (let n = 1; n <= 6; n += 1) {
      const a = FACE_AXIS[n]!;
      const b = FACE_AXIS[7 - n]!;
      expect(a[0] + b[0]).toBe(0);
      expect(a[1] + b[1]).toBe(0);
      expect(a[2] + b[2]).toBe(0);
    }
  });

  it("die geometry is a rounded cube with protruding pips", () => {
    const geom = buildDieGeometry();
    geom.computeBoundingBox();
    const box = geom.boundingBox!;
    expect(box.max.x - box.min.x).toBeGreaterThan(DIE_SIZE);
    expect(box.max.x - box.min.x).toBeLessThan(DIE_SIZE + 0.02);
    expect(geom.getAttribute("color")).toBeDefined();
  });

  it("applyDieOrientation puts the requested face's pips on top, for any yaw", () => {
    const geom = buildDieGeometry();
    const pos = geom.getAttribute("position");
    const col = geom.getAttribute("color");
    const pip = new Color(DICE_PALETTE.pip);
    const pipOne = new Color(DICE_PALETTE.pipOne);
    for (const yaw of [0, 0.7, -2.1]) {
      for (let face = 1; face <= 6; face += 1) {
        const holder = new Object3D();
        applyDieOrientation(holder, face, yaw);
        holder.updateMatrix();
        const m = new Matrix4().copy(holder.matrix);
        // Each pip is a 10-segment cylinder: 60 non-indexed vertices lie on its outer cap plane.
        let topVerts = 0;
        const v = new Vector3();
        for (let i = 0; i < pos.count; i += 1) {
          const isPip =
            (Math.abs(col.getX(i) - pip.r) < 1e-4 && Math.abs(col.getY(i) - pip.g) < 1e-4) ||
            (Math.abs(col.getX(i) - pipOne.r) < 1e-4 && Math.abs(col.getY(i) - pipOne.g) < 1e-4);
          if (!isPip) continue;
          v.fromBufferAttribute(pos, i).applyMatrix4(m);
          if (v.y > DIE_SIZE / 2 + 0.003) topVerts += 1;
        }
        expect(topVerts, `face ${face} yaw ${yaw}`).toBe(face * 60);
      }
    }
  });

  it("tray: wooden frame with felt bed; dice rest on the felt inside the rim", () => {
    const tray = buildDiceTrayGeometry();
    tray.computeBoundingBox();
    expect(tray.boundingBox!.max.x - tray.boundingBox!.min.x).toBeCloseTo(TRAY.width + 0.012, 3);
    const layout = diceLayout([6, 2.5]);
    for (const die of layout.dice) {
      const dx = die.position[0] - layout.tray.position[0];
      const dz = die.position[2] - layout.tray.position[2];
      expect(Math.hypot(dx, dz)).toBeLessThan(TRAY.width / 2 - DIE_SIZE / 2);
      expect(die.position[1]).toBeCloseTo(layout.tray.position[1] + TRAY.feltTop + DIE_SIZE / 2, 5);
    }
  });

  it("tray anchor: right of the island on landscape, below it on portrait", () => {
    const wide = diceAnchorFor(1.6, 5);
    const tall = diceAnchorFor(0.5, 5);
    expect(wide[0]).toBeGreaterThan(5);
    expect(wide[1]).toBeLessThan(5);
    expect(tall[1]).toBeGreaterThan(5);
    expect(tall[0]).toBeLessThan(5);
  });
});
