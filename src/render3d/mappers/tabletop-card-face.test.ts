import { describe, expect, it } from "vitest";
import {
  CARD_FACE_ZONES,
  CARD_SCHEMA_FLOORS,
  isCenterNumberOnlyFace,
  paintCardFace,
  paintIllustrationBand,
  type CardFaceZoneId,
} from "./tabletop-card-face";
import { parseFaceSchema } from "./tabletop-face-schema";
import { auctionBiddingLayout, gemEngineLayout } from "./tabletop-kernels";

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

describe("card face illustration zones", () => {
  it("declares illustration + rewardBar + cost + prestige zones (not center-number-only)", () => {
    const ids = CARD_FACE_ZONES.map((z) => z.id);
    expect(ids).toContain("illustration");
    expect(ids).toContain("rewardBar");
    expect(ids).toContain("cost");
    expect(ids).toContain("prestige");
    expect(isCenterNumberOnlyFace(["prestige"])).toBe(true);
    expect(isCenterNumberOnlyFace(["illustration", "rewardBar", "prestige", "cost"])).toBe(false);
    const ill = CARD_FACE_ZONES.find((z) => z.id === "illustration")!;
    const cost = CARD_FACE_ZONES.find((z) => z.id === "cost")!;
    expect(ill.h).toBeGreaterThanOrEqual(0.5);
    expect(ill.w * ill.h).toBeGreaterThanOrEqual(0.45);
    expect(ill.w * ill.h).toBeGreaterThan(cost.w * cost.h * 2);
    const bar = CARD_FACE_ZONES.find((z) => z.id === "rewardBar")!;
    expect(ill.y + ill.h).toBeLessThanOrEqual(bar.y + 0.02);
    expect(CARD_SCHEMA_FLOORS.costDotRadius).toBeGreaterThanOrEqual(26);
    expect(CARD_SCHEMA_FLOORS.costDigitPx).toBeGreaterThanOrEqual(34);
    expect(CARD_SCHEMA_FLOORS.titlePx).toBeGreaterThanOrEqual(44);
  });

  it("paintCardFace paints all required zones via mock 2d context", () => {
    const { g, calls } = mockCtx();
    const zones = paintCardFace(g, 280, 400, {
      tier: 2,
      prestige: 3,
      reward: "blue",
      cost: { white: 2, red: 1 },
      title: "雾号",
    });
    const used = Object.keys(zones) as CardFaceZoneId[];
    expect(used).toEqual(expect.arrayContaining(["illustration", "rewardBar", "prestige", "cost", "title"]));
    expect(isCenterNumberOnlyFace(used.filter((id) => id !== "title"))).toBe(false);
    expect(zones.illustration.h).toBeGreaterThan(100);
    expect(zones.illustration.h).toBeGreaterThan(zones.cost.h);
    expect(zones.illustration.y + zones.illustration.h).toBeLessThanOrEqual(zones.cost.y + 2);
    expect(calls.some((c) => c.op === "createLinearGradient")).toBe(true);
    expect(calls.some((c) => c.op === "quadraticCurveTo")).toBe(true);
    expect(calls.some((c) => c.op === "arc")).toBe(true);
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
    const fills = calls.filter((c) => c.op === "fill").length;
    const rects = calls.filter((c) => c.op === "fillRect").length;
    const ellipses = calls.filter((c) => c.op === "ellipse").length;
    const curves = calls.filter((c) => c.op === "quadraticCurveTo").length;
    const wedges = calls.filter((c) => c.op === "lineTo").length;
    expect(rects + ellipses).toBeGreaterThanOrEqual(3);
    expect(curves).toBeGreaterThanOrEqual(6);
    expect(wedges).toBeGreaterThanOrEqual(2);
    expect(fills).toBeGreaterThanOrEqual(2);
    expect(calls.length).toBeGreaterThan(20);
  });

  it("gem market + auction cards share face schema for painter", () => {
    const gem = gemEngineLayout({
      bank: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[{ id: "c1", discount: "green", prestige: 1, cost: { blue: 2 } }], [], []],
      nobles: [],
      seats: [{ gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0, cards: [], reserved: [] }],
    });
    const card = gem.pieces.find((p) => p.objectKind === "card");
    expect(card?.label).toMatch(/^face\|card\|/);
    const parsed = parseFaceSchema(card?.label);
    expect(parsed?.kind).toBe("card");
    const auction = auctionBiddingLayout({
      chips: [50],
      gallery: {
        artists: [{ id: "a1", name: "A" }],
        collection: [[{ id: "p1", name: "海港" }], []],
        auctionHand: [[], []],
      },
    });
    expect(
      auction.pieces.some((p) => p.objectKind === "card" || p.objectKind === "lot"),
    ).toBe(true);
  });
});
