import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";
import { shareApi } from "./projects-test-helpers";

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

  it("lets share guests read imported-assets and imported-blob for the bound project", async () => {
    const created = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "访客导入素材" }),
    }).then((response) => response.json<{ project: { id: string; version: number } }>());

    const imported = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/imported-assets`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.project.version,
          idempotencyKey: "guest-import-tree",
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
    const importedBody = await imported.json<{
      project: { version: number };
      importedAssets: Array<{ id: string }>;
    }>();
    const assetId = importedBody.importedAssets[0]!.id;

    const configured = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/changes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: importedBody.project.version,
          idempotencyKey: "guest-import-configure",
          operations: [{
            op: "configure_score_race",
            config: {
              victoryTarget: 5,
              maxTurns: 6,
              actions: [{ id: "advance", label: "前进", points: 1 }],
            },
          }, {
            op: "update_rule_system",
            fields: {
              presentation: {
                theme: "harbor-kit",
                visuals: [{ provenance: "kit", label: "Harbor ink presentation kit" }],
              },
            },
          }],
        }),
      },
    ).then((response) => response.json<{ project: { version: number } }>());

    const compiledResponse = await SELF.fetch(
      `https://godesk.test/api/projects/${created.project.id}/builds`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: configured.project.version,
          idempotencyKey: "guest-import-build",
        }),
      },
    );
    const compiled = await compiledResponse.json<{
      build: { id: string; playableUrl: string };
      error?: string;
    }>();
    expect(compiledResponse.status, JSON.stringify(compiled)).toBe(201);

    const roomResponse = await SELF.fetch(
      `https://godesk.test/api/builds/${compiled.build.id}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: 42, idempotencyKey: "guest-import-room" }),
      },
    );
    const room = await roomResponse.json<{ id: string; sessionUrl: string; error?: string }>();
    expect(roomResponse.status, JSON.stringify(room)).toBe(201);

    const guestShare = new URL(room.sessionUrl, "https://godesk.test");
    guestShare.hostname = "friend.godesk.example";
    const share = guestShare.toString();

    const guestListUrl = new URL(shareApi(share, `/api/projects/${created.project.id}`));
    guestListUrl.searchParams.set("view", "imported-assets");
    const guestList = await SELF.fetch(guestListUrl);
    expect(guestList.status, await guestList.clone().text()).toBe(200);
    const listBody = await guestList.json<{ assets: Array<{ id: string }> }>();
    expect(listBody.assets.some((asset) => asset.id === assetId)).toBe(true);

    const guestBlobUrl = new URL(shareApi(share, `/api/projects/${created.project.id}`));
    guestBlobUrl.searchParams.set("view", "imported-blob");
    guestBlobUrl.searchParams.set("assetId", assetId);
    const guestBlob = await SELF.fetch(guestBlobUrl);
    expect(guestBlob.status, String(guestBlob.status)).toBe(200);
    expect(new TextDecoder().decode(new Uint8Array(await guestBlob.arrayBuffer()))).toBe("glTF");

    const guestPlayShare = new URL(compiled.build.playableUrl, "https://godesk.test");
    guestPlayShare.hostname = "friend.godesk.example";
    const playListUrl = new URL(
      shareApi(guestPlayShare.toString(), `/api/projects/${created.project.id}`),
    );
    playListUrl.searchParams.set("view", "imported-assets");
    const playList = await SELF.fetch(playListUrl);
    expect(playList.status, await playList.clone().text()).toBe(200);

    const denied = await SELF.fetch(
      `https://friend.godesk.example/api/projects/${created.project.id}?view=imported-assets`,
    );
    expect(denied.status).toBe(401);

    const otherProject = await SELF.fetch("https://godesk.test/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "另一项目" }),
    }).then((response) => response.json<{ project: { id: string } }>());
    const wrongProjectUrl = new URL(
      shareApi(share, `/api/projects/${otherProject.project.id}`),
    );
    wrongProjectUrl.searchParams.set("view", "imported-assets");
    const wrongProject = await SELF.fetch(wrongProjectUrl);
    expect(wrongProject.status).toBe(401);
  });
});
