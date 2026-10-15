import type { BufferAttribute, BufferGeometry, InstancedMesh } from "three";
import { describe, expect, it } from "vitest";
import { dressingInputs } from "./hex-dressing";
import { beginnerSceneInput } from "./terrain-dressing.fixture";
import { createTerrainPropLayer } from "./terrain-props";
import type { RenderTierId } from "./tiers";

// tsconfig has no @types/node (browser lib only); load node builtins untyped at runtime.
type NodeHash = { update(data: string | Uint8Array): NodeHash; digest(enc: "hex"): string };
declare const process: { env: Record<string, string | undefined> };
const nodeId = (name: string) => `node:${name}`;
const { createHash } = (await import(/* @vite-ignore */ nodeId("crypto"))) as { createHash(alg: string): NodeHash };
const { appendFileSync } = (await import(/* @vite-ignore */ nodeId("fs"))) as { appendFileSync(path: string, data: string): void };

/**
 * LOD-high: medium / low prop meshes must stay byte-identical to the pre-LOD build (0914ebf).
 * The digest covers every geometry attribute + index, draw range, instance matrices / colours,
 * shadow flags and whether a shadow hook is installed. Baselines were produced at 0914ebf with
 * this same file (see REPORT in g3d-evidence/…/lod-high).
 */
// T088 · medium baseline refreshed (shore dressing + denser sparse PROP_COUNTS); low unchanged.
const BASELINE: Record<"medium" | "low", Record<"shadow" | "noshadow", string>> = {
  medium: { shadow: "4eb756e17092602e8cc9d258acfba081f41825f353382cb65c8aa2c8603eb1e6", noshadow: "258bbca57e989e9de011ac54650ef5ead1a35cbb2308d0e534cd8da43c88295e" },
  low: { shadow: "8cd04aa93fad8514394b19aa9d70524a830d3a4cd9363664509b09ea246450c4", noshadow: "5cfc19a7f0486003fafc6ec978fba4fe70929566cf14869edb5e8280ce774b83" },
};

function digestLayer(tier: RenderTierId, castShadow: boolean): string {
  const { tiles } = dressingInputs(beginnerSceneInput());
  const layer = createTerrainPropLayer();
  layer.sync(tiles, tier, castShadow);
  const hash = createHash("sha256");
  for (const child of layer.group.children) {
    const mesh = child as InstancedMesh;
    const geometry = mesh.geometry as BufferGeometry;
    hash.update(`${mesh.name}|${mesh.count}|${mesh.castShadow}|${mesh.receiveShadow}|${geometry.drawRange.start}|${geometry.drawRange.count}|`);
    hash.update(`hook:${Object.prototype.hasOwnProperty.call(mesh, "onBeforeShadow")}|`);
    for (const name of Object.keys(geometry.attributes).sort()) {
      const attr = geometry.attributes[name] as BufferAttribute;
      hash.update(`${name}:${attr.itemSize}:`);
      hash.update(new Uint8Array((attr.array as Float32Array).buffer.slice(0)));
    }
    if (geometry.index) hash.update(new Uint8Array((geometry.index.array as Uint16Array).buffer.slice(0)));
    hash.update(new Uint8Array(mesh.instanceMatrix.array.buffer.slice(0)));
    if (mesh.instanceColor) hash.update(new Uint8Array(mesh.instanceColor.array.buffer.slice(0)));
  }
  layer.dispose();
  return hash.digest("hex");
}

function layerTriangles(tier: RenderTierId): { main: number; shadow: number } {
  const { tiles } = dressingInputs(beginnerSceneInput());
  const layer = createTerrainPropLayer();
  layer.sync(tiles, tier, true);
  let main = 0;
  let shadow = 0;
  for (const child of layer.group.children) {
    const mesh = child as InstancedMesh;
    const g = mesh.geometry;
    const raw = g.index ? g.index.count : g.getAttribute("position").count;
    const proxy = g.userData.gdShadowProxy as { fullCount: number; proxyCount: number } | undefined;
    main += (Math.min(raw, g.drawRange.count) / 3) * mesh.count;
    if (mesh.castShadow) shadow += ((proxy ? proxy.proxyCount : Math.min(raw, g.drawRange.count)) / 3) * mesh.count;
  }
  layer.dispose();
  return { main, shadow };
}

describe("LOD-high terrain props", () => {
  it.skipIf(!process.env.LOD_DIGEST_OUT)("writes digests (baseline helper, LOD_DIGEST_OUT=file)", () => {
    const out = process.env.LOD_DIGEST_OUT!;
    for (const tier of ["medium", "low", "high"] as const) {
      for (const shadow of [true, false]) appendFileSync(out, `${tier} ${shadow} ${digestLayer(tier, shadow)}\n`);
    }
    for (const tier of ["high", "medium", "low"] as const) appendFileSync(out, `tri ${tier} ${JSON.stringify(layerTriangles(tier))}\n`);
  });

  it.skipIf(BASELINE.medium.shadow.startsWith("__"))("medium / low meshes are byte-identical to 0914ebf", () => {
    for (const tier of ["medium", "low"] as const) {
      expect(digestLayer(tier, true)).toBe(BASELINE[tier].shadow);
      expect(digestLayer(tier, false)).toBe(BASELINE[tier].noshadow);
    }
  });
});
