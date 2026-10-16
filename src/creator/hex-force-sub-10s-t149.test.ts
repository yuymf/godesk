import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T149 hex force sub-10s", () => {
  it("extends chain hops and budgets for sub-10s path", () => {
    const force = readFileSync("scripts/hardness-force-inject.mjs", "utf8");
    expect(force).toContain("T149");
    expect(force).toMatch(/budgetMs \?\? (10000|5000)/);
    expect(force).toContain("chainSetup: true");
    const dos = readFileSync("worker/creator-projects-do.ts", "utf8");
    expect(dos).toContain("T149");
    expect(dos).toMatch(/hop < (3|7|16)/);
    expect(dos).toContain("listSessionLegalActions");
  });
});
