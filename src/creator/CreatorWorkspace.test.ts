import { describe, expect, it } from "vitest";
import {
  draftExpectedVersion,
  shouldStartDefinitionDraft,
} from "./CreatorWorkspace";
import { normalizeAppPathname } from "../App";

describe("Creator Editor optimistic draft baseline", () => {
  it("keeps the version where editing began after polling sees a newer project", () => {
    expect(draftExpectedVersion(3, 4)).toBe(3);
  });

  it("uses the visible version when no definition draft exists", () => {
    expect(draftExpectedVersion(null, 4)).toBe(4);
  });

  it("keeps the installation surface on a trailing-slash URL", () => {
    expect(normalizeAppPathname("/chatgpt-plugin/")).toBe("/chatgpt-plugin");
    expect(normalizeAppPathname("////")).toBe("/");
  });

  it("starts the optimistic baseline when Source Library editing begins", () => {
    expect(shouldStartDefinitionDraft("", "first source note")).toBe(true);
    expect(shouldStartDefinitionDraft("first source note", "edited note")).toBe(false);
    expect(shouldStartDefinitionDraft("", "   ")).toBe(false);
  });
});
