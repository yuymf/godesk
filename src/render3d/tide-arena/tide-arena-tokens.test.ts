import { describe, expect, it } from "vitest";
import { UNIT_CATALOG } from "../../runtime/adapters/auto-battler";
import { unitGeometry } from "./tokens";

describe("tide arena tokens", () => {
  it("gives each of the 6 units a distinct merged silhouette", () => {
    const sizes = UNIT_CATALOG.map((u) => unitGeometry(u.id, u.cost).getAttribute("position").count);
    expect(new Set(sizes).size).toBe(UNIT_CATALOG.length);
  });

  it("keeps a full 33-token army well under the 300k triangle budget", () => {
    const worst = Math.max(...UNIT_CATALOG.map((u) => unitGeometry(u.id, u.cost).getAttribute("position").count / 3));
    expect(worst * 33).toBeLessThan(60_000);
  });
});
