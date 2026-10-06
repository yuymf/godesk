import { describe, expect, it } from "vitest";
import { Color, Matrix4, Object3D, Vector3 } from "three";
import { buildDiceTrayGeometry, buildDieGeometry } from "./assets/dice-geometry";
import { DICE_PALETTE, diceLayout, DIE_SIZE, FACE_AXIS, PIP_LAYOUT, TRAY } from "./dice";
import { DICE_OVERLAY_ASPECT, diceOverlayRect } from "./dice-overlay";
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

  it("tray: carved wooden box; dice rest on the felt inside the wood lip", () => {
    const tray = buildDiceTrayGeometry();
    tray.computeBoundingBox();
    const bb = tray.boundingBox!;
    // Foot bevel is width+0.06.
    expect(bb.max.x - bb.min.x).toBeCloseTo(TRAY.width + 0.06, 3);
    // Carved walls: taller than the old felt pad, still under a deep chest.
    expect(bb.max.y - bb.min.y).toBeGreaterThan(0.12);
    expect(bb.max.y - bb.min.y).toBeLessThan(0.28);
    const layout = diceLayout([6, 2.5]);
    for (const die of layout.dice) {
      const dx = die.position[0] - layout.tray.position[0];
      const dz = die.position[2] - layout.tray.position[2];
      expect(Math.hypot(dx, dz)).toBeLessThan(TRAY.width / 2 - DIE_SIZE / 2);
      expect(die.position[1]).toBeCloseTo(layout.tray.position[1] + TRAY.feltTop + DIE_SIZE / 2, 5);
    }
  });

  it("tray inset: bottom-right corner, ~22% wide on desktop, ~36% on phones, inside the canvas", () => {
    const desk = diceOverlayRect(910, 505);
    expect(desk.width).toBe(Math.round(910 * 0.22));
    expect(desk.x + desk.width).toBe(910 - 12);
    expect(desk.y).toBe(12); // WebGL viewport origin is bottom-left → bottom edge
    expect(desk.width / desk.height).toBeCloseTo(DICE_OVERLAY_ASPECT, 1);
    const phone = diceOverlayRect(390, 450);
    expect(phone.width).toBe(Math.round(390 * 0.36));
    expect(phone.x + phone.width).toBe(390 - 8);
    expect(phone.y).toBe(8);
    // Never wider than 300 px, never taller than 45% of the canvas.
    const huge = diceOverlayRect(2400, 1200);
    expect(huge.width).toBe(300);
    const flat = diceOverlayRect(1600, 200);
    expect(flat.height).toBeLessThanOrEqual(90);
    expect(flat.x + flat.width).toBeLessThanOrEqual(1600);
  });

  it("overlay-local layout: tray centred on the origin", () => {
    const layout = diceLayout();
    expect(layout.tray.position[0]).toBe(0);
    expect(layout.tray.position[2]).toBe(0);
  });

});
