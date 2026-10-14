import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CARD_FACE_ZONES, paintIllustrationBand } from "./tabletop-card-face-t048";

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
      const grad = { stops: [] as unknown[], addColorStop: (...a: unknown[]) => { grad.stops.push(a); } };
      calls.push({ op: "createLinearGradient", args: [] });
      return grad;
    },
  } as unknown as CanvasRenderingContext2D;
  return { g, calls };
}

describe("T069 card face motif enrichment", () => {
  it("keeps T063/T066 illustration share", () => {
    const ill = CARD_FACE_ZONES.find((z) => z.id === "illustration")!;
    const cost = CARD_FACE_ZONES.find((z) => z.id === "cost")!;
    expect(ill.h).toBeGreaterThanOrEqual(0.5);
    expect(ill.w * ill.h).toBeGreaterThan(cost.w * cost.h * 2);
  });

  it("paintIllustrationBand draws motif paths beyond T066 fill (lineTo/closePath)", () => {
    // seed variety across rewards so at least one run hits gem or building
    let maxLineTo = 0;
    let maxClose = 0;
    for (const reward of ["blue", "red", "green", "white", "black", "gold"]) {
      for (const title of ["Harbor", "Market", "Manor", "Forge", "Vault", "Tower"]) {
        const { g, calls } = mockCtx();
        paintIllustrationBand(g, { x: 10, y: 10, w: 200, h: 160 }, {
          reward,
          tier: 2,
          title,
          base: "#3b82f6",
        });
        maxLineTo = Math.max(maxLineTo, calls.filter((c) => c.op === "lineTo").length);
        maxClose = Math.max(maxClose, calls.filter((c) => c.op === "closePath").length);
      }
    }
    // T069 motifs add diamond/building paths on top of wedge (already has lineTo)
    expect(maxLineTo).toBeGreaterThanOrEqual(5);
    expect(maxClose).toBeGreaterThanOrEqual(2);
  });

  it("source declares T069 motif kinds", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-card-face-t048.ts", "utf8");
    expect(src).toContain("T069");
    expect(src).toMatch(/gem|building silhouette|motifKind/);
  });
});
