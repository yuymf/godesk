import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T146 hex force sub-20s", () => {
  it("chains setup intents and budgets 20s", () => {
    const force = readFileSync("scripts/hardness-force-inject.mjs", "utf8");
    expect(force).toContain("T146");
    expect(force).toMatch(/budgetMs \?\? 10000/);
    expect(force).toContain("chainSetup: true");
    expect(force).toContain("listLegalActions");
    const dos = readFileSync("worker/creator-projects-do.ts", "utf8");
    expect(dos).toContain("T146");
    expect(dos).toContain("chainSetup");
    expect(dos).toContain("listSessionLegalActions");
  });
});
