import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T143 hex force sub-40s", () => {
  it("pipes nextLegal from intent, parallel claims, budget 40s", () => {
    const force = readFileSync("scripts/hardness-force-inject.mjs", "utf8");
    expect(force).toContain("T143");
    expect(force).toContain("nextLegalActions");
    expect(force).toMatch(/budgetMs \?\? (5000|5000)/);
    expect(force).toMatch(/parallel seat claim/);
    expect(force).toContain("listLegalActions");
    const dos = readFileSync("worker/creator-projects-do.ts", "utf8");
    expect(dos).toContain("T143");
    expect(dos).toContain("nextLegalActions");
    expect(dos).toContain("listSessionLegalActions");
  });
});
