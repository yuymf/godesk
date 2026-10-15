import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T136 hex legal-actions force", () => {
  it("force uses legal-actions endpoint and defaults to setup ≥2", () => {
    const src = readFileSync("scripts/hardness-force-inject.mjs", "utf8");
    expect(src).toContain("T136");
    expect(src).toContain("legal-actions");
    expect(src).toContain("listLegalActions");
    expect(src).toMatch(/minSettlements: opts\.minSettlements \?\? 2/);
    expect(src).toMatch(/minRoads: opts\.minRoads \?\? 2/);
  });

  it("worker exposes listSessionLegalActions + GET route", () => {
    const rt = readFileSync("worker/runtime.ts", "utf8");
    expect(rt).toContain("listSessionLegalActions");
    expect(rt).toContain("listLegalActions");
    const routes = readFileSync("worker/project-routes.ts", "utf8");
    expect(routes).toContain("legal-actions");
    const dob = readFileSync("worker/creator-projects-do.ts", "utf8");
    expect(dob).toContain("roomLegalMatch");
    expect(dob).toContain("listSessionLegalActions");
  });
});
