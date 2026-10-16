import { describe, expect, it } from "vitest";
import { CARD_FACE_ZONES, paintIllustrationBand, paintCardFace } from "./tabletop-card-face-t048";

function mockCtx() {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const g = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "butt",
    globalAlpha: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillRect: (...args: unknown[]) => calls.push({ op: "fillRect", args }),
    strokeRect: (...args: unknown[]) => calls.push({ op: "strokeRect", args }),
    beginPath: () => calls.push({ op: "beginPath", args: [] }),
    moveTo: (...args: unknown[]) => calls.push({ op: "moveTo", args }),
    lineTo: (...args: unknown[]) => calls.push({ op: "lineTo", args }),
    closePath: () => calls.push({ op: "closePath", args: [] }),
    quadraticCurveTo: (...args: unknown[]) => calls.push({ op: "quadraticCurveTo", args }),
    ellipse: (...args: unknown[]) => calls.push({ op: "ellipse", args }),
    arc: (...args: unknown[]) => calls.push({ op: "arc", args }),
    fill: () => calls.push({ op: "fill", args: [] }),
    stroke: () => calls.push({ op: "stroke", args: [] }),
    fillText: (...args: unknown[]) => calls.push({ op: "fillText", args }),
    createLinearGradient: () => {
      const grad = {
        stops: [] as unknown[],
        addColorStop: (...a: unknown[]) => {
          grad.stops.push(a);
        },
      };
      calls.push({ op: "createLinearGradient", args: [] });
      return grad;
    },
  } as unknown as CanvasRenderingContext2D;
  return { g, calls };
}

describe("T066 card face art fill", () => {
  it("illustration zone retains T063 share; cost does not swallow art", () => {
    const ill = CARD_FACE_ZONES.find((z) => z.id === "illustration")!;
    const cost = CARD_FACE_ZONES.find((z) => z.id === "cost")!;
    expect(ill.h).toBeGreaterThanOrEqual(0.5);
    expect(ill.w * ill.h).toBeGreaterThan(cost.w * cost.h * 2);
  });

  it("paintIllustrationBand draws theme blocks + ridges (not empty flat wash)", () => {
    const { g, calls } = mockCtx();
    paintIllustrationBand(g, { x: 10, y: 10, w: 200, h: 160 }, {
      reward: "blue",
      tier: 2,
      title: "Harbor",
      base: "#3b82f6",
    });
    expect(calls.some((c) => c.op === "createLinearGradient")).toBe(true);
    // T066: color blocks (fillRect and/or ellipse) + brush ridges + highlight wedge
    const fills = calls.filter((c) => c.op === "fill").length;
    const rects = calls.filter((c) => c.op === "fillRect").length;
    const ellipses = calls.filter((c) => c.op === "ellipse").length;
    const curves = calls.filter((c) => c.op === "quadraticCurveTo").length;
    const wedges = calls.filter((c) => c.op === "lineTo").length;
    expect(rects + ellipses).toBeGreaterThanOrEqual(3);
    expect(curves).toBeGreaterThanOrEqual(6);
    expect(wedges).toBeGreaterThanOrEqual(2);
    expect(fills).toBeGreaterThanOrEqual(2);
    // not a single flat fillRect-only face
    expect(calls.length).toBeGreaterThan(20);
  });

  it("paintCardFace keeps illustration above cost strip", () => {
    const { g } = mockCtx();
    const zones = paintCardFace(g, 220, 320, {
      reward: "red",
      tier: 3,
      prestige: 5,
      cost: { red: 2, white: 1 },
      title: "Market",
    });
    expect(zones.illustration.h).toBeGreaterThan(zones.cost.h);
    expect(zones.illustration.y + zones.illustration.h).toBeLessThanOrEqual(zones.cost.y + 2);
  });
});
