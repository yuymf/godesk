import { describe, expect, it } from "vitest";
import { gemEngineLayout } from "./tabletop-kernels";

describe("seat gem bank on desk", () => {
  it("seat-held gems>0 stack as seat-front resource nodes (not center-bank only)", () => {
    const layout = gemEngineLayout({
      bank: { white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 5 },
      market: [[], [], []],
      nobles: [],
      seats: [
        {
          gems: { white: 2, blue: 0, green: 1, red: 0, black: 0, gold: 0 },
          prestige: 0,
          cards: [],
          reserved: [],
        },
        {
          gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
          prestige: 0,
          cards: [],
          reserved: [],
        },
      ],
    });
    const seatGems = layout.pieces.filter((p) => p.id.startsWith("seat:0:gem:"));
    expect(seatGems.length).toBeGreaterThan(0);
    expect(seatGems.every((p) => p.objectKind === "resource")).toBe(true);
    const bankGems = layout.pieces.filter((p) => p.id.startsWith("bank:"));
    expect(bankGems.length).toBeGreaterThan(0);
    const marker = layout.pieces.find((p) => p.id === "seat:0:marker")!;
    expect(seatGems.every((p) => p.z < marker.z)).toBe(true);
  });
});
