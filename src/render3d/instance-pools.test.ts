import { describe, expect, it } from "vitest";
import { BoxGeometry, MeshStandardMaterial, Object3D, Scene } from "three";
import { createInstancePools } from "./instance-pools";

describe("instance pools (G3D-13)", () => {
  it("reuses slots and keeps a single InstancedMesh per key", () => {
    const root = new Scene();
    const pools = createInstancePools(root);
    const geom = new BoxGeometry(1, 1, 1);
    const mat = new MeshStandardMaterial();
    const a = pools.acquire("tile:wood", geom, mat, false);
    const b = pools.acquire("tile:wood", geom, mat, false);
    expect(a.mesh).toBe(b.mesh);
    expect(a.index).not.toBe(b.index);
    expect(root.children).toHaveLength(1);
    const handle = new Object3D();
    handle.position.set(1, 2, 3);
    pools.setMatrix("tile:wood", a.index, handle);
    pools.release("tile:wood", a.index);
    const c = pools.acquire("tile:wood", geom, mat, false);
    expect(c.index).toBe(a.index);
    pools.dispose();
    expect(root.children).toHaveLength(0);
    geom.dispose();
    mat.dispose();
  });
});
