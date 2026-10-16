import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CARD_FACE_ZONES, paintIllustrationBand, paintCardFace } from "./tabletop-card-face-t048";

function mockCtx() {
  const calls: Array<{ op: string; args?: unknown[] }> = [];
  const g = {
    fillStyle: "", strokeStyle: "", lineWidth: 0, lineCap: "butt", globalAlpha: 1,
    fillRect: (...args: unknown[]) => calls.push({ op: "fillRect", args }),
    strokeRect: (...args: unknown[]) => calls.push({ op: "strokeRect", args }),
    beginPath: () => calls.push({ op: "beginPath" }),
    moveTo: () => calls.push({ op: "moveTo" }),
    lineTo: () => calls.push({ op: "lineTo" }),
    closePath: () => calls.push({ op: "closePath" }),
    quadraticCurveTo: () => calls.push({ op: "quadraticCurveTo" }),
    ellipse: () => calls.push({ op: "ellipse" }),
    arc: () => {},
    fill: () => calls.push({ op: "fill" }),
    stroke: () => calls.push({ op: "stroke" }),
    fillText: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D;
  return { g, calls };
}

describe("T108 card face motif microcontrast", () => {
  it("source declares T108 shared microcontrast (no gem/auction fork)", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-card-face-t048.ts", "utf8");
    expect(src).toContain("T108");
    expect(src).toMatch(/microcontrast/);
    expect(src).not.toMatch(/if \(kernel === ["']gem/);
  });

  it("keeps illustration zone large (motif-canvas floor / T087)", () => {
    const ill = CARD_FACE_ZONES.find((z) => z.id === "illustration")!;
    expect(ill.h).toBeGreaterThanOrEqual(0.5);
  });

  it("paintIllustrationBand still dual-edge + motif strokes", () => {
    const { g, calls } = mockCtx();
    paintIllustrationBand(g, { x: 0, y: 0, w: 200, h: 160 }, { reward: "blue", tier: 2, title: "Harbor" });
    expect(calls.filter((c) => c.op === "strokeRect").length).toBeGreaterThanOrEqual(2);
    expect(calls.filter((c) => c.op === "stroke").length).toBeGreaterThanOrEqual(1);
  });

  it("paintCardFace keeps T087 edge readout", () => {
    const { g, calls } = mockCtx();
    paintCardFace(g, 280, 400, { reward: "red", tier: 1, prestige: 1, title: "Lot" });
    expect(calls.filter((c) => c.op === "strokeRect").length).toBeGreaterThanOrEqual(2);
  });
});
