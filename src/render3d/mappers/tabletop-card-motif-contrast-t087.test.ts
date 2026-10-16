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

describe("T087 card motif stage-wide contrast", () => {
  it("source declares T087 shared edge/contrast (no gem/auction fork)", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-card-face-t048.ts", "utf8");
    expect(src).toContain("T087");
    expect(src).toMatch(/dual-edge|stage-wide/);
    expect(src).not.toMatch(/if \(kernel === ["']gem/);
  });

  it("illustration band paints dual strokeRect edge ring", () => {
    const { g, calls } = mockCtx();
    paintIllustrationBand(g, { x: 0, y: 0, w: 200, h: 160 }, { reward: "blue", tier: 2, title: "Harbor" });
    const strokes = calls.filter((c) => c.op === "strokeRect");
    expect(strokes.length).toBeGreaterThanOrEqual(2);
  });

  it("paintCardFace keeps illustration zone large (motif-canvas floor)", () => {
    const ill = CARD_FACE_ZONES.find((z) => z.id === "illustration")!;
    expect(ill.h).toBeGreaterThanOrEqual(0.5);
    const { g, calls } = mockCtx();
    paintCardFace(g, 280, 400, { reward: "red", tier: 1, prestige: 1, title: "Lot" });
    expect(calls.filter((c) => c.op === "strokeRect").length).toBeGreaterThanOrEqual(2);
  });
});
