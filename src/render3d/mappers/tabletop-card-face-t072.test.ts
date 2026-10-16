import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CARD_FACE_ZONES, paintIllustrationBand } from "./tabletop-card-face-t048";

function mockCtx() {
  const calls: Array<{ op: string }> = [];
  const g = {
    fillStyle: "", strokeStyle: "", lineWidth: 0, lineCap: "butt", globalAlpha: 1,
    fillRect: () => calls.push({ op: "fillRect" }),
    strokeRect: () => calls.push({ op: "strokeRect" }),
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

describe("T072 card face stage-readable", () => {
  it("source declares T072 stage-readable motif slab", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-card-face-t048.ts", "utf8");
    // T077 superseded motif comment but T072 marker may remain in history; accept T077 stage-wide
    expect(src).toMatch(/T072|T077/);
    expect(src).toMatch(/stage-readable|stage-wide readable|solid theme slab/);
  });

  it("keeps illustration share; paints large fillRect slabs + motif paths", () => {
    const ill = CARD_FACE_ZONES.find((z) => z.id === "illustration")!;
    expect(ill.h).toBeGreaterThanOrEqual(0.5);
    const { g, calls } = mockCtx();
    paintIllustrationBand(g, { x: 0, y: 0, w: 200, h: 160 }, { reward: "blue", tier: 2, title: "Harbor" });
    expect(calls.filter((c) => c.op === "fillRect").length).toBeGreaterThanOrEqual(3);
    expect(calls.filter((c) => c.op === "lineTo").length).toBeGreaterThanOrEqual(4);
  });

  it("gem market cards scale ≥1.15 for stage-far readability", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-kernels.ts", "utf8");
    expect(src).toMatch(/T07[27][\s\S]{0,80}size: 1\.(2|3|4)/);
  });
});
