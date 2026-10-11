import { describe, expect, it } from "vitest";
import { isCc0ModelCandidate, queryFromPrompt } from "./asset-pull";
import type { AssetServerAsset } from "../src/creator/asset-search/types";

describe("asset-pull R3", () => {
  it("parses english prompts", () => {
    expect(queryFromPrompt("add a forest cabin")).toBe("forest cabin");
    expect(queryFromPrompt("add a wooden barrel")).toBe("wooden barrel");
    expect(queryFromPrompt("给铁脉加一座木屋")).toBe("cabin");
  });
});
