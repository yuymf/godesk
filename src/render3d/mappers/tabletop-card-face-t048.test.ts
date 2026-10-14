import { describe, expect, it } from "vitest";
import {
  CARD_FACE_ZONES,
  isCenterNumberOnlyFace,
  paintCardFace,
  type CardFaceZoneId,
} from "./tabletop-card-face-t048";
import { parseFaceSchema } from "./tabletop-face-schema";
import { auctionBiddingLayout, gemEngineLayout } from "./tabletop-kernels";

describe("T048 card face illustration zones", () => {
  it("declares illustration + rewardBar + cost + prestige zones (not center-number-only)", () => {
    const ids = CARD_FACE_ZONES.map((z) => z.id);
    expect(ids).toContain("illustration");
    expect(ids).toContain("rewardBar");
    expect(ids).toContain("cost");
    expect(ids).toContain("prestige");
    expect(isCenterNumberOnlyFace(["prestige"])).toBe(true);
    expect(isCenterNumberOnlyFace(["illustration", "rewardBar", "prestige", "cost"])).toBe(false);
    const ill = CARD_FACE_ZONES.find((z) => z.id === "illustration")!;
    expect(ill.h).toBeGreaterThanOrEqual(0.3);
    // illustration is the top band — above reward bar
    const bar = CARD_FACE_ZONES.find((z) => z.id === "rewardBar")!;
    expect(ill.y + ill.h).toBeLessThanOrEqual(bar.y + 0.02);
  });

  it("paintCardFace paints all required zones via mock 2d context", () => {
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
      quadraticCurveTo: (...args: unknown[]) => calls.push({ op: "quadraticCurveTo", args }),
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
    expect(calls.some((c) => c.op === "createLinearGradient")).toBe(true);
    expect(calls.some((c) => c.op === "quadraticCurveTo")).toBe(true); // brush strokes
    expect(calls.some((c) => c.op === "arc")).toBe(true); // prestige + cost dots
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
    // Auction gallery lots use framed-art ("lot"); face schema still applies when labeled.
    expect(
      auction.pieces.some((p) => p.objectKind === "card" || p.objectKind === "lot"),
    ).toBe(true);
  });
});
