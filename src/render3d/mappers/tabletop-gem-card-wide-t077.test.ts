import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CARD_FACE_ZONES, paintIllustrationBand } from "./tabletop-card-face-t048";
import { gemEngineLayout } from "./tabletop-kernels";

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

describe("T077 gem card stage-wide readable", () => {
  it("source declares T077 stage-wide motif", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-card-face-t048.ts", "utf8");
    expect(src).toContain("T077");
    expect(src).toMatch(/stage-wide readable/);
  });

  it("illustration zone stays large; paints full-bleed slabs", () => {
    const ill = CARD_FACE_ZONES.find((z) => z.id === "illustration")!;
    expect(ill.h).toBeGreaterThanOrEqual(0.5);
    const { g, calls } = mockCtx();
    paintIllustrationBand(g, { x: 0, y: 0, w: 200, h: 160 }, { reward: "blue", tier: 2, title: "Harbor" });
    expect(calls.filter((c) => c.op === "fillRect").length).toBeGreaterThanOrEqual(4);
    expect(calls.filter((c) => c.op === "lineTo").length).toBeGreaterThanOrEqual(4);
  });

  it("gem market cards scale ≥1.35 for stage-wide readability", () => {
    const layout = gemEngineLayout({
      bank: { white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 5 },
      market: [[{ discount: "blue", prestige: 1, cost: { white: 1 } }, { discount: "red", prestige: 0, cost: { blue: 2 } }]],
      nobles: [],
      seats: [{ gems: {}, prestige: 0, cards: [], reserved: [] }],
    });
    const cards = layout.pieces.filter((p) => p.id.startsWith("market:"));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((p) => (p.size ?? 0) >= 1.35)).toBe(true);
  });
});
