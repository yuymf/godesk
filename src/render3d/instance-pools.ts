/**
 * G3D-13 · InstancedMesh pools for hex tiles / roads / decor (and similar).
 * One draw call per (kind, materialKey) group instead of per node.
 */
import {
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Object3D,
  type BufferGeometry,
  type Material,
} from "three";

const _matrix = new Matrix4();
const _dummy = new Object3D();

export type InstanceHandle = Object3D & {
  userData: Object3D["userData"] & {
    gdInstance?: { poolKey: string; index: number };
  };
};

type Pool = {
  mesh: InstancedMesh;
  /** free slot indices */
  free: number[];
  /** occupied count (high-water for capacity growth) */
  used: number;
  capacity: number;
};

function grow(pool: Pool, extra: number): void {
  const nextCap = Math.max(pool.capacity * 2, pool.capacity + extra, 8);
  const prev = pool.mesh;
  const geom = prev.geometry;
  const mat = prev.material as Material;
  const next = new InstancedMesh(geom, mat, nextCap);
  next.instanceMatrix.setUsage(DynamicDrawUsage);
  next.castShadow = prev.castShadow;
  next.receiveShadow = prev.receiveShadow;
  next.frustumCulled = false;
  next.userData.gdShared = true;
  for (let i = 0; i < pool.capacity; i += 1) {
    prev.getMatrixAt(i, _matrix);
    next.setMatrixAt(i, _matrix);
  }
  for (let i = pool.capacity; i < nextCap; i += 1) {
    _dummy.position.set(0, -9999, 0);
    _dummy.scale.set(0, 0, 0);
    _dummy.updateMatrix();
    next.setMatrixAt(i, _dummy.matrix);
    pool.free.push(i);
  }
  next.instanceMatrix.needsUpdate = true;
  next.count = nextCap;
  if (prev.parent) {
    prev.parent.add(next);
    prev.parent.remove(prev);
  }
  // Do not dispose prev: that would free the shared geometry/material.
  pool.mesh = next;
  pool.capacity = nextCap;
}

export type InstancePools = {
  root: Object3D;
  acquire(
    poolKey: string,
    geometry: BufferGeometry,
    material: Material,
    castShadow: boolean,
  ): { mesh: InstancedMesh; index: number };
  setMatrix(poolKey: string, index: number, object: Object3D): void;
  release(poolKey: string, index: number): void;
  dispose(): void;
};

export function createInstancePools(parent: Object3D): InstancePools {
  const pools = new Map<string, Pool>();

  const ensure = (
    poolKey: string,
    geometry: BufferGeometry,
    material: Material,
    castShadow: boolean,
  ): Pool => {
    let pool = pools.get(poolKey);
    if (pool) return pool;
    const capacity = 8;
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.userData.gdInstancePool = poolKey;
    mesh.count = capacity;
    for (let i = 0; i < capacity; i += 1) {
      _dummy.position.set(0, -9999, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
    pool = { mesh, free: [...Array(capacity).keys()], used: 0, capacity };
    pools.set(poolKey, pool);
    return pool;
  };

  return {
    root: parent,
    acquire(poolKey, geometry, material, castShadow) {
      const pool = ensure(poolKey, geometry, material, castShadow);
      if (pool.free.length === 0) grow(pool, 8);
      const index = pool.free.pop()!;
      pool.used += 1;
      return { mesh: pool.mesh, index };
    },
    setMatrix(poolKey, index, object) {
      const pool = pools.get(poolKey);
      if (!pool) return;
      object.updateMatrix();
      pool.mesh.setMatrixAt(index, object.matrix);
      pool.mesh.instanceMatrix.needsUpdate = true;
    },
    release(poolKey, index) {
      const pool = pools.get(poolKey);
      if (!pool) return;
      _dummy.position.set(0, -9999, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.rotation.set(0, 0, 0);
      _dummy.updateMatrix();
      pool.mesh.setMatrixAt(index, _dummy.matrix);
      pool.mesh.instanceMatrix.needsUpdate = true;
      pool.free.push(index);
      pool.used = Math.max(0, pool.used - 1);
    },
    dispose() {
      for (const pool of pools.values()) {
        parent.remove(pool.mesh);
        // Drop geom/mat refs so InstancedMesh.dispose does not free shared templates.
        pool.mesh.geometry = null as unknown as BufferGeometry;
        pool.mesh.material = null as unknown as Material;
        pool.mesh.dispose();
      }
      pools.clear();
    },
  };
}

export function isBatchableKind(kind: string): boolean {
  return kind === "tile" || kind === "road" || kind === "decor" || kind === "settlement" || kind === "city" || kind === "robber";
}
