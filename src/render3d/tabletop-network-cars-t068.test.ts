import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T068 network train-car bogie/wheels", () => {
  it("claimed cars include bogie frame + axle + wheel disks", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T068");
    expect(src).toMatch(/bogie|wheelR|wheel disks/i);
    expect(src).toContain("CylinderGeometry");
    expect(src).toMatch(/rotateX\(Math\.PI \/ 2\)/);
    // still keep T065 chassis/glass
    expect(src).toContain("tt-car-chassis");
    expect(src).toContain("tt-car-glass");
  });
});
