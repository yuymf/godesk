import { describe, expect, it } from "vitest";
import { queryFromPrompt } from "./asset-pull";

describe("asset-pull R3", () => {
  it("parses english and zh prompts for cabin / tree roles", () => {
    expect(queryFromPrompt("add a forest cabin")).toBe("forest cabin");
    expect(queryFromPrompt("add a wooden barrel")).toBe("wooden barrel");
    expect(queryFromPrompt("给铁脉加一座木屋")).toBe("cabin");
    expect(queryFromPrompt("给铁脉加一个树桩")).toBe("stump");
  });
});
