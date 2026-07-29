import { describe, expect, it } from "vitest";
import { draftExpectedVersion } from "./CreatorWorkspace";

describe("Creator Editor optimistic draft baseline", () => {
  it("keeps the version where editing began after polling sees a newer project", () => {
    expect(draftExpectedVersion(3, 4)).toBe(3);
  });

  it("uses the visible version when no definition draft exists", () => {
    expect(draftExpectedVersion(null, 4)).toBe(4);
  });
});
