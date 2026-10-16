import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T233 number chip bevel + harbor dock/plaque productization", () => {
  it("raises shared chip mesh bevel and dock/plaque thickness without suite fork", () => {
    const host = readFileSync("src/render3d/SceneHost.tsx", "utf8");
    expect(host).toContain("T233");
    expect(host).toMatch(/bevelEnabled:\s*true/);
    expect(host).toContain("wood-chip number token");
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toMatch(/number-token[\s\S]*pattern:\s*"grain"/);
    expect(tokens).toContain("T233");
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toContain("T233");
    expect(island).toMatch(/thicker product planks|plaque post \+ wood backboard/);
    expect(island).toMatch(/SIGN_RADIUS = 0\.355/);
    expect(island).not.toMatch(/suite === ["']H0/);
  });
});
