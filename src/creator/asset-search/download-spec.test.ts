import { describe, expect, it } from "vitest";
import { MAX_IMPORT_BYTES, SQLITE_DO_VALUE_LIMIT_BYTES } from "./config";
import { describeDownloadSpec, pickDownloadSpec } from "./download-spec";

describe("pickDownloadSpec", () => {
  it("picks gltf (not glb) for Poly Haven tree models", () => {
    expect(pickDownloadSpec({
      type: "model",
      formats: ["gltf", "blend", "fbx", "usd"],
      resolutions: ["1k", "2k", "4k", "8k"],
    })).toEqual({ format: "gltf", resolution: "1k" });
  });

  it("prefers glb over blend for BlenderKit models", () => {
    expect(pickDownloadSpec({
      type: "model",
      formats: ["blend", "glb"],
      resolutions: ["0.5k", "1k", "2k"],
    })).toEqual({ format: "glb", resolution: "1k" });
  });

  it("prefers jpg 1k maps for Poly Haven / ambientCG materials", () => {
    expect(pickDownloadSpec({
      type: "material",
      formats: ["jpg", "png", "exr", "blend", "gltf"],
      resolutions: ["1k", "2k", "4k", "8k"],
    })).toEqual({ format: "jpg", resolution: "1k" });
    expect(pickDownloadSpec({
      type: "material",
      formats: ["jpg", "png"],
      resolutions: ["1k", "2k", "4k", "8k"],
    })).toEqual({ format: "jpg", resolution: "1k" });
  });

  it("picks zip for pack listings and hdr 1k for HDRIs", () => {
    expect(pickDownloadSpec({ type: "pack", formats: ["zip"] })).toEqual({ format: "zip" });
    expect(pickDownloadSpec({
      type: "hdri",
      formats: ["hdr", "exr"],
      resolutions: ["1k", "2k", "4k"],
    })).toEqual({ format: "hdr", resolution: "1k" });
  });

  it("does not invent glb when formats are missing", () => {
    expect(pickDownloadSpec({ type: "model" })).toEqual({});
    expect(describeDownloadSpec({})).toBe("来源默认格式");
  });

  it("keeps the import budget under the SQLite DO value cap", () => {
    expect(MAX_IMPORT_BYTES).toBeLessThan(SQLITE_DO_VALUE_LIMIT_BYTES);
  });
});
