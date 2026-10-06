import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { demoteSingleRunTbt } from "./lhci-warn-errors.mjs";

describe("lhci-warn-errors", () => {
  it("demotes homepage TBT error to warn and leaves other levels alone", () => {
    const rc = JSON.parse(readFileSync("lighthouserc.json", "utf8"));
    expect(rc.ci.assert.assertMatrix[0].assertions["total-blocking-time"][0]).toBe("error");
    const next = demoteSingleRunTbt(rc);
    expect(next.ci.assert.assertMatrix[0].assertions["total-blocking-time"][0]).toBe("warn");
    expect(next.ci.assert.assertMatrix[0].assertions["categories:performance"][0]).toBe("error");
    expect(next.ci.assert.assertMatrix[0].assertions["cumulative-layout-shift"][0]).toBe("error");
    expect(next.ci.assert.assertMatrix[0].assertions["largest-contentful-paint"][0]).toBe("warn");
    expect(next.ci.assert.assertMatrix[1].assertions["total-blocking-time"][0]).toBe("warn");
    expect(rc.ci.assert.assertMatrix[0].assertions["total-blocking-time"][0]).toBe("error");
  });
});
