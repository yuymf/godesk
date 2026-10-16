import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CARD_FACE_ZONES, CARD_SCHEMA_FLOORS } from "./tabletop-card-face-t048";

describe("UI-card-schema · seat-close cost dots / typography", () => {
  it("raises cost + title zone floors without center-number-only layout", () => {
    expect(CARD_SCHEMA_FLOORS.costDotRadius).toBeGreaterThanOrEqual(24);
    expect(CARD_SCHEMA_FLOORS.costDigitPx).toBeGreaterThanOrEqual(32);
    expect(CARD_SCHEMA_FLOORS.titlePx).toBeGreaterThanOrEqual(42);
    const cost = CARD_FACE_ZONES.find((z) => z.id === "cost")!;
    const title = CARD_FACE_ZONES.find((z) => z.id === "title")!;
    const ill = CARD_FACE_ZONES.find((z) => z.id === "illustration")!;
    expect(cost.h).toBeGreaterThanOrEqual(0.18);
    expect(title.h).toBeGreaterThanOrEqual(0.12);
    expect(ill.h).toBeGreaterThan(0.45);
  });

  it("paintCardFace draws underlay + dark-stroked cost dots", () => {
    const src = readFileSync("src/render3d/mappers/tabletop-card-face-t048.ts", "utf8");
    expect(src).toContain("UI-card-schema");
    expect(src).toContain("CARD_SCHEMA_FLOORS");
    expect(src).toMatch(/costDotRadius/);
    expect(src).toMatch(/underlayPad/);
    expect(src).toMatch(/strokeStyle = "#0f172a"/);
  });

  it("plaque schema shares larger requirement dots (generic, no suite fork)", () => {
    const obj = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(obj).toContain("UI-card-schema");
    expect(obj).toMatch(/g\.arc\(cx,\s*cy,\s*22/);
    expect(obj).toMatch(/700 28px \/\* UI-card-schema \*\//);
    expect(obj).not.toMatch(/suite === ["']H0/);
  });
});
