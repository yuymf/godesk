import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T237 number chip bevel/lathe + harbor dock/plaque productization", () => {
  it("raises shared chip mesh bevel/side turning and dock/plaque thickness without suite fork", () => {
    const host = readFileSync("src/render3d/SceneHost.tsx", "utf8");
    expect(host).toContain("T237");
    expect(host).toMatch(/bevelEnabled:\s*true/);
    expect(host).toContain("side turning");
    const tokens = readFileSync("src/render3d/tokens.ts", "utf8");
    expect(tokens).toMatch(/number-token[\s\S]*pattern:\s*"grain"/);
    expect(tokens).toContain("T237");
    const island = readFileSync("src/render3d/island.ts", "utf8");
    expect(island).toContain("T237");
    expect(island).toMatch(/thicker product planks|plaque post \+ thicker wood backboard/);
    expect(island).toMatch(/SIGN_RADIUS = 0\.368/);
    expect(island).not.toMatch(/suite === ["']H0/);
  });
});
