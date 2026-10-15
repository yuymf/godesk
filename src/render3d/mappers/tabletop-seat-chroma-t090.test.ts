import { describe, expect, it } from "vitest";
import { SEAT_COLORS, seatMaterial } from "../tokens";
import { readFileSync } from "node:fs";

function lum(hex: string): number {
  const h = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}
function contrast(a: string, b: string): number {
  const L1 = Math.max(lum(a), lum(b));
  const L2 = Math.min(lum(a), lum(b));
  return (L1 + 0.05) / (L2 + 0.05);
}

describe("T090 seat chroma legibility", () => {
  it("SEAT_COLORS leave felt-green hue family (seat2 not green)", () => {
    expect(SEAT_COLORS).toEqual(["#e74c3c", "#2980b9", "#8e44ad", "#f1c40f"]);
    // seat2 must not be a green-channel-dominant felt twin
    const seat2 = SEAT_COLORS[2]!;
    const r = parseInt(seat2.slice(1, 3), 16);
    const g = parseInt(seat2.slice(3, 5), 16);
    const b = parseInt(seat2.slice(5, 7), 16);
    expect(g).toBeLessThan(r + 20); // purple: R and B dominate over G
    expect(b).toBeGreaterThan(g);
  });

  it("each seat keeps WCAG-ish contrast vs product-green felt", () => {
    const felt = "#1a8a45";
    for (const c of SEAT_COLORS) {
      expect(contrast(c, felt)).toBeGreaterThan(1.0);
    }
    // yellow seat should be clearly bright on felt
    expect(contrast(SEAT_COLORS[3]!, felt)).toBeGreaterThan(2.0);
  });

  it("seatMaterial uses glossier paint than matte felt pieces", () => {
    const m = seatMaterial(0);
    expect(m.clearcoat ?? 0).toBeGreaterThan(0.2);
    expect(m.roughness).toBeLessThan(0.8);
  });

  it("meeple figure declares T090 cream rim", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T090");
    expect(src).toMatch(/cream rim|f8f1e3/);
  });
});
