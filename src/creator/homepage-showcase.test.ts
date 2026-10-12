import { describe, expect, it } from "vitest";
import {
  examplesForHomepage,
  HOMEPAGE_SHOWCASE,
} from "./default-examples";

describe("G3D-17 homepage Tidewell showcase (flag removed)", () => {
  it("homepage always shows only the 汐屿 showcase", () => {
    expect(examplesForHomepage().map((e) => e.id)).toEqual(HOMEPAGE_SHOWCASE);
    expect(examplesForHomepage()).toHaveLength(1);
    expect(examplesForHomepage()[0]?.title).toBe("汐屿");
  });
});
