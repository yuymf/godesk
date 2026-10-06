import { describe, expect, it } from "vitest";
import {
  assetDownloadUrl,
  assetSearchUrl,
  buildSearchParams,
  filenameFromDisposition,
  parseAssetServerConfig,
  parseSearchResponse,
} from "./client";
import { DEFAULT_ASSET_SERVER_URL, PREFERRED_PROVIDERS } from "./config";

describe("asset-search client", () => {
  it("builds sidecar search URLs with free/direct filters", () => {
    const url = assetSearchUrl(DEFAULT_ASSET_SERVER_URL, {
      q: "trees",
      type: "model",
      providers: [...PREFERRED_PROVIDERS],
      free: true,
      downloadable: true,
      limit: 24,
    });
    expect(url.startsWith("http://127.0.0.1:8787/v1/search?")).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("q")).toBe("trees");
    expect(params.get("type")).toBe("model");
    expect(params.get("free")).toBe("true");
    expect(params.get("downloadable")).toBe("true");
    expect(params.get("providers")).toContain("polyhaven");
    expect(params.get("providers")).toContain("kenney");
  });

  it("omits empty query keys", () => {
    const params = buildSearchParams({ q: "  moss  " });
    expect(params.get("q")).toBe("moss");
    expect(params.has("free")).toBe(false);
    expect(params.has("type")).toBe(false);
  });

  it("parses a live-shaped search payload", () => {
    const parsed = parseSearchResponse({
      query: "trees",
      types: ["model"],
      results: [
        {
          id: "polyhaven:tree_small_02",
          provider: "polyhaven",
          nativeId: "tree_small_02",
          title: "Tree Small 02",
          type: "model",
          tags: ["tree"],
          url: "https://polyhaven.com/a/tree_small_02",
          thumbnailUrl: "https://cdn.polyhaven.com/asset_img/thumbs/tree_small_02.png",
          author: "Rico Cilliers",
          license: {
            name: "CC0",
            url: "https://creativecommons.org/publicdomain/zero/1.0/",
            commercialUse: true,
            attributionRequired: false,
          },
          price: { free: true },
          downloadable: true,
          score: 1,
        },
      ],
      providers: [
        { provider: "polyhaven", name: "Poly Haven", status: "ok", count: 1, tookMs: 210 },
        { provider: "fab", name: "Fab", status: "link", count: 0, tookMs: 0, searchUrl: "https://www.fab.com/search?q=trees" },
      ],
    });
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0]?.license).toMatchObject({
      name: "CC0",
      attributionRequired: false,
    });
    expect(parsed.providers[1]?.status).toBe("link");
  });

  it("defaults empty sidecar URLs to the engineering-box localhost bind", () => {
    expect(parseAssetServerConfig(undefined).baseUrl).toBe("http://127.0.0.1:8787");
    expect(parseAssetServerConfig({ baseUrl: " http://127.0.0.1:8787/ " }).baseUrl).toBe(
      "http://127.0.0.1:8787",
    );
  });

  it("encodes download ids and reads Content-Disposition filenames", () => {
    expect(assetDownloadUrl("http://127.0.0.1:8787/", "polyhaven:tree_small_02", {
      format: "glb",
      resolution: "1k",
    })).toBe(
      "http://127.0.0.1:8787/v1/assets/polyhaven%3Atree_small_02/download?format=glb&resolution=1k",
    );
    expect(filenameFromDisposition('attachment; filename="tree.glb"', "x.bin")).toBe("tree.glb");
  });
});
