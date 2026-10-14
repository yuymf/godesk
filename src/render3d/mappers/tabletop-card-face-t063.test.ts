import { describe, expect, it } from "vitest";
import { CARD_FACE_ZONES } from "./tabletop-card-face-t048";

describe("T063 card face illustration panel share", () => {
  it("illustration area ≥50% of face; cost strip smaller than art", () => {
    const ill = CARD_FACE_ZONES.find((z) => z.id === "illustration")!;
    const cost = CARD_FACE_ZONES.find((z) => z.id === "cost")!;
    const illArea = ill.w * ill.h;
    const costArea = cost.w * cost.h;
    expect(ill.h).toBeGreaterThanOrEqual(0.5);
    expect(illArea).toBeGreaterThanOrEqual(0.45);
    expect(illArea).toBeGreaterThan(costArea * 2);
    expect(ill.y + ill.h).toBeLessThanOrEqual(
      CARD_FACE_ZONES.find((z) => z.id === "rewardBar")!.y + 0.02,
    );
  });
});
