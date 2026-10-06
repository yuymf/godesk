import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";

const TREE = {
  id: "polyhaven:tree_small_02",
  provider: "polyhaven",
  nativeId: "tree_small_02",
  title: "Tree Small 02",
  type: "model",
  tags: ["tree"],
  url: "https://polyhaven.com/a/tree_small_02",
  author: "Rico Cilliers",
  license: {
    name: "CC0",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    commercialUse: true,
    attributionRequired: false,
  },
  price: { free: true },
  downloadable: true,
};

describe("imported 3d assets", () => {
  it("exposes the sidecar URL", async () => {
    const response = await SELF.fetch("https://godesk.test/api/asset-server");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      baseUrl: "http://127.0.0.1:8787",
    });
  });

  it("writes a verify:assets-compatible LICENSES.md row into the Game Project", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "汐屿素材搜索" }),
    }).then((response) => response.json<{ project: { id: string; version: number } }>());

    const imported = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/imported-assets`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "import-tree-small-02",
          asset: TREE,
          files: [{
            relativePath: "assets/imported/polyhaven-tree_small_02/tree.glb",
            contentBase64: btoa("glTF"),
            mimeType: "model/gltf-binary",
            bytes: 4,
          }],
        }),
      },
    );
    expect(imported.status).toBe(200);
    const body = await imported.json<{
      licensesMarkdown: string;
      importedAssets: Array<{ id: string; path: string; licenseSpdx: string }>;
      sources: Array<{ name: string; content: string }>;
    }>();
    expect(body.importedAssets[0]).toMatchObject({
      id: "imported/polyhaven-tree_small_02",
      path: "assets/imported/polyhaven-tree_small_02/tree.glb",
      licenseSpdx: "CC0-1.0",
    });
    expect(body.licensesMarkdown).toContain("| imported/polyhaven-tree_small_02 |");
    expect(body.licensesMarkdown).toContain("CC0-1.0");
    expect(body.sources.some((source) => source.name === "assets/LICENSES.md")).toBe(true);

    const view = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}?view=imported-assets`,
    ).then((response) => response.json<{ licensesMarkdown: string }>());
    expect(view.licensesMarkdown).toContain("imported/polyhaven-tree_small_02");
  });

  it("refuses link-only assets", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "仅外链" }),
    }).then((response) => response.json<{ project: { id: string; version: number } }>());
    const refused = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/imported-assets`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "import-fab",
          asset: {
            ...TREE,
            id: "fab:paid-tree",
            provider: "fab",
            downloadable: false,
          },
          files: [{
            relativePath: "assets/imported/x/x.glb",
            contentBase64: btoa("glTF"),
            mimeType: "model/gltf-binary",
            bytes: 4,
          }],
        }),
      },
    );
    expect(refused.status).toBe(400);
  });

  it("refuses payloads over the SQLite DO import budget", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "超限" }),
    }).then((response) => response.json<{ project: { id: string; version: number } }>());
    const blob = "x".repeat(1536 * 1024 + 64);
    const refused = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/imported-assets`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "import-too-big",
          asset: TREE,
          files: [{
            relativePath: "assets/imported/polyhaven-tree_small_02/huge.bin",
            contentBase64: btoa(blob),
            mimeType: "application/octet-stream",
            bytes: blob.length,
          }],
        }),
      },
    );
    expect(refused.status).toBe(413);
    const body = await refused.json<{ error: string }>();
    expect(body.error).toContain("SQLite");
  });
});
