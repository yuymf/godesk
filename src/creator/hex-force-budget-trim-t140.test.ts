import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T140 hex force budget trim", () => {
  it("prefetches seats, reuses intent state, and takes first legal action", () => {
    const src = readFileSync("scripts/hardness-force-inject.mjs", "utf8");
    expect(src).toContain("T140");
    expect(src).toContain("listLegalActions");
    expect(src).toMatch(/Promise\.all\(\[\.\.\.Array\(seatN\)/);
    expect(src).toMatch(/reuse intent response state|r\.state/);
    expect(src).toMatch(/budgetMs \?\? (5000|5000)/);
    expect(src).toMatch(/minSettlements: opts\.minSettlements \?\? 2/);
  });
});
