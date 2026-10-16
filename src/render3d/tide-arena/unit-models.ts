/**
 * Load imported GLBs as auto-battler unit tokens (generic — not genre-specific art).
 * Reuses the same GLTFLoader path as SceneHost / imported-props; scales to token height.
 */
import { Box3, Group, Object3D, Vector3 } from "three";
import { TOKEN_HEIGHT } from "./tokens";

export type UnitModelSource = { id: string; url: string; title?: string };

const prototypeCache = new Map<string, Promise<Object3D>>();

/** Fit an imported GLB into the token envelope (height ≈ TOKEN_HEIGHT * 0.9). */
export function normalizeUnitModelScale(size: { x: number; y: number; z: number }): number {
  const h = Math.max(size.y, 1e-3);
  const w = Math.max(size.x, size.z, 1e-3);
  return Math.min((TOKEN_HEIGHT * 0.9) / h, 0.7 / w);
}

function loadPrototype(source: UnitModelSource): Promise<Object3D> {
  const hit = prototypeCache.get(source.id);
  if (hit) return hit;
  const pending = (async () => {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(source.url);
    const root = gltf.scene ?? new Group();
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    root.scale.multiplyScalar(normalizeUnitModelScale(size));
    root.updateMatrixWorld(true);
    const box2 = new Box3().setFromObject(root);
    root.position.y -= box2.min.y;
    root.traverse((obj) => {
      const mesh = obj as Object3D & { castShadow?: boolean; receiveShadow?: boolean; isMesh?: boolean };
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return root;
  })();
  prototypeCache.set(source.id, pending);
  return pending;
}

/** Pool of live clones keyed by piece uid. */
export class UnitModelPool {
  private readonly live = new Map<string, Object3D>();
  private readonly sources: Map<string, UnitModelSource>;
  private readonly root: Object3D;
  private readonly loading = new Set<string>();

  constructor(root: Object3D, models: readonly UnitModelSource[]) {
    this.root = root;
    this.sources = new Map(models.map((m) => [m.id, m]));
  }

  hasSource(modelRef: string): boolean {
    return this.sources.has(modelRef);
  }

  /** Ensure a clone exists for uid; returns null while loading / missing. */
  ensure(uid: string, modelRef: string): Object3D | null {
    const existing = this.live.get(uid);
    if (existing) return existing;
    const source = this.sources.get(modelRef);
    if (!source) return null;
    if (this.loading.has(uid)) return null;
    this.loading.add(uid);
    void loadPrototype(source).then((proto) => {
      this.loading.delete(uid);
      if (this.live.has(uid)) return;
      const clone = proto.clone(true);
      clone.name = `unit-model:${uid}`;
      this.root.add(clone);
      this.live.set(uid, clone);
    }).catch(() => {
      this.loading.delete(uid);
    });
    return null;
  }

  place(uid: string, x: number, y: number, z: number, rotY: number, scale: number, visible: boolean) {
    const obj = this.live.get(uid);
    if (!obj) return;
    obj.visible = visible;
    obj.position.set(x, y, z);
    obj.rotation.set(0, rotY, 0);
    obj.scale.setScalar(scale);
  }

  prune(alive: ReadonlySet<string>) {
    for (const [uid, obj] of this.live) {
      if (alive.has(uid)) continue;
      this.root.remove(obj);
      this.live.delete(uid);
    }
  }

  dispose() {
    for (const obj of this.live.values()) this.root.remove(obj);
    this.live.clear();
    this.loading.clear();
  }
}
