import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("T064 hardness stage evidence hygiene", () => {
  it("probe writes stage-sidecar with suite/kernelType/roomId and rejects 汐屿/潮阵", () => {
    const src = readFileSync("scripts/hardness-real-probe.mjs", "utf8");
    expect(src).toContain("stage-sidecar.json");
    expect(src).toContain("rejectedShell");
    expect(src).toContain("汐屿");
    expect(src).toContain("潮阵");
    expect(src).toContain("kernelType");
    expect(src).toContain("roomId");
  });
});
