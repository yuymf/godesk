import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T233→T237 number/harbor product lineage", () => {
  it("retains beveled wood-chip + dock plaque product markers", () => {
    const host = readFileSync("src/render3d/SceneHost.tsx", "utf8");
    expect(host).toMatch(/bevelEnabled:\s*true/);
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toMatch(/SIGN_RADIUS = 0\.368/);
  });
});
