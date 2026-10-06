import { describe, expect, it } from "vitest";
import { DataTexture, PerspectiveCamera, Vector3 } from "three";
import { mapHexSettlementToScene } from "./mappers/hex-settlement";
import {
  LABEL_HOT,
  LABEL_INK,
  LABEL_LIFT,
  NUMBER_TOKEN_HALF_HEIGHT,
  atlasCell,
  createNumberLabelLayer,
  labelsFromNodes,
  pipCount,
  projectLabels,
} from "./number-labels";
import { PROP_MATERIALS } from "./tokens";

/** 19 格标准岛（半径 2）+ 18 个数字（沙漠无数字），不依赖 runtime 适配器（#138 会改名）。 */
const NUMBERS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
const HEX_FIXTURE = (() => {
  const tiles: { q: number; r: number; terrain: string; number: number | null }[] = [];
  let k = 0;
  for (let q = -2; q <= 2; q += 1) {
    for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r += 1) {
      const desert = q === 0 && r === 0;
      tiles.push({ q, r, terrain: desert ? "desert" : "wheat", number: desert ? null : NUMBERS[k++]! });
    }
  }
  return { tiles, robberHex: "0,0", ports: [], players: [], lastDice: null };
})();

const stubAtlas = () => new DataTexture(new Uint8Array(4), 1, 1);

function defaultCamera(aspect: number): PerspectiveCamera {
  // 与 SceneHost 挂载时的默认机位一致（六角岛不走 RenderSpec fitCamera）。
  const camera = new PerspectiveCamera(45, aspect, 0.1, 100);
  camera.position.set(0, 9, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

describe("number token decals (G3D-ART-2)", () => {
  const scene = mapHexSettlementToScene(HEX_FIXTURE);
  const tokens = scene.nodes.filter((n) => n.kind === "number-token");

  it("creates one decal per numbered token, lifted above the token top", () => {
    const labels = labelsFromNodes(scene.nodes);
    expect(tokens.length).toBeGreaterThan(10);
    expect(labels).toHaveLength(tokens.length);
    for (const label of labels) {
      const token = tokens.find((t) => t.id === label.id)!;
      expect(label.number).toBe(token.number);
      expect(label.center.y).toBeCloseTo(token.position[1] + NUMBER_TOKEN_HALF_HEIGHT + LABEL_LIFT, 6);
      expect(label.hot).toBe(label.number === 6 || label.number === 8);
    }
  });

  it("merges all decals into one mesh (1 draw call) with an upward-facing quad per token", () => {
    const layer = createNumberLabelLayer({ atlas: stubAtlas });
    layer.sync(scene.nodes);
    const geom = layer.mesh.geometry;
    expect(geom.getAttribute("position").count).toBe(tokens.length * 4);
    expect(geom.getIndex()!.count).toBe(tokens.length * 6);
    const normals = geom.getAttribute("normal");
    for (let i = 0; i < normals.count; i += 1) expect(normals.getY(i)).toBe(1);
    // 三角形绕序朝上（正面可见，不靠 DoubleSide）
    const p = geom.getAttribute("position");
    const ix = geom.getIndex()!;
    const a = new Vector3().fromBufferAttribute(p, ix.getX(0));
    const b = new Vector3().fromBufferAttribute(p, ix.getX(1));
    const c = new Vector3().fromBufferAttribute(p, ix.getX(2));
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    expect(n.y).toBeCloseTo(1, 6);
    expect(layer.mesh.visible).toBe(true);
    expect(layer.mesh.castShadow).toBe(false);
    layer.dispose();
  });

  it("is in view and facing the default camera on desktop and iPhone aspect", () => {
    const layer = createNumberLabelLayer({ atlas: stubAtlas });
    layer.sync(scene.nodes);
    for (const aspect of [1440 / 900, 390 / 470]) {
      const camera = defaultCamera(aspect);
      const shown = projectLabels(layer.labels(), camera, 1000, 1000 / aspect);
      expect(shown.every((l) => l.inView && l.facing)).toBe(true);
      // 每个贴花至少约 14 px 宽（1000 px 视口），且离相机比自身筹码顶面更近（不被筹码盖住）。
      for (const l of shown) expect(l.box[2] - l.box[0]).toBeGreaterThan(14);
    }
    layer.dispose();
  });

  it("highlights 6 and 8 in terracotta, others in ink, with probability pips", () => {
    expect(LABEL_HOT).toBe("#a3442a");
    expect(LABEL_INK).not.toBe(LABEL_HOT);
    expect([2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map(pipCount)).toEqual([1, 2, 3, 4, 5, 5, 4, 3, 2, 1]);
    const cells = new Set([2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((n) => JSON.stringify(atlasCell(n))));
    expect(cells.size).toBe(10);
    // 6/8 的筹码底不再整块涂红（不盖数字、不与座位 0 红混淆）
    expect(PROP_MATERIALS["number-token-hot"].base).not.toBe("#c0392b");
    expect(PROP_MATERIALS["number-token-hot"].pbrSet).toBe("t11-parchment");
  });

  it("re-syncs only when tokens change", () => {
    const layer = createNumberLabelLayer({ atlas: stubAtlas });
    layer.sync(scene.nodes);
    const g1 = layer.mesh.geometry;
    layer.sync(scene.nodes);
    expect(layer.mesh.geometry).toBe(g1);
    layer.sync(scene.nodes.filter((n) => n.kind !== "number-token"));
    expect(layer.labels()).toHaveLength(0);
    expect(layer.mesh.visible).toBe(false);
    layer.dispose();
  });
});
