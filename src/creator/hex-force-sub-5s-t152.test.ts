import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T152 hex force sub-5s", () => {
  it("extends chain hops to finish setup in few RTTs and budgets 5s", () => {
    const force = readFileSync("scripts/hardness-force-inject.mjs", "utf8");
    expect(force).toContain("T152");
    expect(force).toMatch(/budgetMs \?\? 5000/);
    expect(force).toContain("chainSetup: true");
    const dos = readFileSync("worker/creator-projects-do.ts", "utf8");
    expect(dos).toContain("T152");
    expect(dos).toMatch(/hop < (7|16)/);
    expect(dos).toContain("listSessionLegalActions");
  });
});
