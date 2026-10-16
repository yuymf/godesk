import { describe, expect, it } from "vitest";
import { UNIT_CATALOG } from "../../runtime/adapters/auto-battler";
import { unitGeometry } from "./tokens";

function fingerprint(unitId: string, cost: number): string {
  const g = unitGeometry(unitId, cost);
  const arr = g.getAttribute("position").array as Float32Array;
  let sum = 0;
  for (let i = 0; i < arr.length; i += 17) sum += arr[i]!;
  return `${arr.length}:${sum.toFixed(4)}`;
}

describe("tide arena tokens", () => {
  it("gives each catalog unit a distinct merged silhouette", () => {
    const prints = UNIT_CATALOG.map((u) => fingerprint(u.id, u.cost));
    expect(new Set(prints).size).toBe(UNIT_CATALOG.length);
  });

  it("keeps a full 33-token army well under the 300k triangle budget", () => {
    const worst = Math.max(...UNIT_CATALOG.map((u) => unitGeometry(u.id, u.cost).getAttribute("position").count / 3));
    expect(worst * 33).toBeLessThan(60_000);
  });
});
