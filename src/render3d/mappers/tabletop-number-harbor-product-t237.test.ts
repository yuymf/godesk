import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("T237→T241 number/harbor lineage", () => {
  it("retains beveled wood-chip + dock plaque", () => {
    expect(readFileSync("src/render3d/SceneHost.tsx","utf8")).toMatch(/bevelEnabled:\s*true/);
    expect(readFileSync("src/render3d/island.ts","utf8")).toMatch(/SIGN_RADIUS = 0\.382/);
  });
});
