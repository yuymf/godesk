import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T145 contact shadow mean floor", () => {
  it("adds soft halo and raises opacity without cutting T106 boost clamp", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T145");
    expect(src).toContain("T142");
    const start = src.indexOf("function softContactShadow");
    const end = src.indexOf("function porcelainPlate", start);
    const block = src.slice(start, end > 0 ? end : start + 3000);
    expect(block).toMatch(/Math\.min\(1\.02/);
    expect(block).toMatch(/Math\.max\(0\.68/);
    expect(block).toMatch(/Math\.min\(0\.(66|70|72|76)/);
    expect(block).toMatch(/Math\.max\(0\.(38|42|44|48)/);
    expect(block).toMatch(/soft halo/);
    expect(block).toMatch(/2\.(15|35|60)/);
    expect(block).toContain("contact-shadow");
  });
});
