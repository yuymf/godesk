import { useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  Shape,
  SphereGeometry,
  type Texture,
  WebGLRenderer,
  type BufferGeometry,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildLegalHitOverlays, disposeHitOverlay, disposeSharedHitResources } from "./hit-targets";
import { createInstancePools, type InstancePools } from "./instance-pools";
import {
  disposeTidewellGeometryCache,
  ensureTidewellGeometries,
  geometryForNode,
  getTidewellGeometriesSync,
} from "./model-templates";
import { mapHexSettlementToScene } from "./mappers/hex-settlement";
import {
  matchPickToLegalAction,
  pickFromPointerEvent,
  type PickableLegalAction,
  type PickTarget,
} from "./pick";
import { reconcileScene } from "./reconcile";
import { createNumberLabelLayer, projectLabels, type NumberLabelLayer } from "./number-labels";
import type { SceneModel, SceneNode } from "./scene-model";
import type { HexSettlementSceneInput } from "./mappers/hex-settlement";
import { markInteractive, perfModeEnabled, perfRecorder } from "./perf";
import { dieFaceEuler, MotionController } from "./motion";
import { PerfOverlay } from "./PerfOverlay";
import {
  configureRenderer,
  createLightingRig,
  createRoomEnvironment,
  createSkyDome,
} from "./lighting";
import { MaterialLibrary } from "./materials";
import {
  PROP_MATERIALS,
  SCENE_TOKENS,
  TERRAIN_MATERIALS,
  TILE_RADIUS,
  islandBounds,
  pbrResolutionFor,
  seatMaterial,
  type LightingSpec,
  type MaterialToken,
} from "./tokens";
import {
  RuntimeDowngradeMonitor,
  detectEnvFromBrowser,
  downgradeTier,
  resolveTier,
  tierLogLine,
  type RenderTierId,
  type TierCaps,
} from "./tiers";

/**
 * G3D-14：通用场景适配器。提供时 SceneHost 不走 hex mapper，而是 reconcile `model`，
 * 用 `create` / `update` 构建对象（工厂在调用方的懒加载 chunk 里），拾取经 `resolvePick` 映射为动作。
 */
export type SceneAdapter = {
  model: SceneModel;
  create: (node: SceneNode, ctx: { library: MaterialLibrary; caps: TierCaps }) => Object3D;
  update: (object: Object3D, node: SceneNode, ctx: { library: MaterialLibrary; caps: TierCaps }) => void;
  resolvePick?: (target: PickTarget) => { type: string; payload?: Record<string, unknown> } | null;
  /** 包围球：阴影相机与机位按它适配。 */
  bounds?: { center: readonly [number, number, number]; radius: number };
  /** 布局摘要：变化时重算阴影相机与机位。 */
  layoutKey?: string;
  /** RenderSpec.camera。 */
  camera?: { fovDeg: number; distance: number; minPolarDeg: number; maxPolarDeg: number; pan: boolean };
};

export type SceneHostProps = {
  className?: string;
  ariaLabel?: string;
  /** Hex-settlement public state; when omitted, shows G3D-02 test cube. */
  hexSettlement?: HexSettlementSceneInput | null;
  /** When true, pointer picks map to legalActions via onPick. */
  interactive?: boolean;
  legalActions?: readonly PickableLegalAction[];
  onPick?: (action: { type: string; payload?: Record<string, unknown> }) => void;
  /** RenderSpec.lighting（G3D-14/15 传入）；缺省为 SCENE_TOKENS.lighting。 */
  lighting?: LightingSpec;
  /** G3D-09: active seat; a change triggers the turn camera reframe. */
  activeSeat?: number | null;
  /** G3D-14：通用桌面场景（见 SceneAdapter）。 */
  scene?: SceneAdapter | null;
};

/** 阴影贴图在场景变化后继续逐帧重绘的时长（覆盖 place/move/dice 动效）。 */
const SHADOW_REFRESH_MS = 1_500;
/** 可交互后延迟多久开始流式加载 PBR 贴图（避开首屏主线程窗口）。 */
const PBR_STREAM_DELAY_MS = 1_200;


function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

function hexShape(radius: number, bevel = 0.04): Shape {
  const shape = new Shape();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i);
    const x = (radius - bevel) * Math.cos(angle);
    const y = (radius - bevel) * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/** Shared template geometries for G3D-13 InstancedMesh pools (one draw call per group). */
let SHARED_TILE_GEOM: BufferGeometry | null = null;
let SHARED_ROAD_GEOM: BufferGeometry | null = null;
let SHARED_DECOR_GEOM: BufferGeometry | null = null;

function sharedTileGeom(): BufferGeometry {
  if (!SHARED_TILE_GEOM) {
    const geom = new ExtrudeGeometry(hexShape(TILE_RADIUS), { depth: 0.28, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    SHARED_TILE_GEOM = geom;
  }
  return SHARED_TILE_GEOM;
}
function sharedRoadGeom(): BufferGeometry {
  if (!SHARED_ROAD_GEOM) SHARED_ROAD_GEOM = new BoxGeometry(1, 1, 1);
  return SHARED_ROAD_GEOM;
}
function sharedDecorGeom(): BufferGeometry {
  if (!SHARED_DECOR_GEOM) SHARED_DECOR_GEOM = new SphereGeometry(0.18, 10, 10);
  return SHARED_DECOR_GEOM;
}

function disposeObject(object: Object3D, pools?: InstancePools | null): void {
  const inst = object.userData.gdInstance as { poolKey: string; index: number } | undefined;
  if (inst && pools) {
    pools.release(inst.poolKey, inst.index);
    object.userData.gdInstance = undefined;
    return;
  }
  object.traverse((child) => {
    const mesh = child as Mesh;
    // G3D-14：通用桌面的网格线是 LineSegments，同样要释放几何 / 材质。
    if (!mesh.isMesh && !(child as { isLine?: boolean }).isLine) return;
    mesh.geometry?.dispose();
    const material = mesh.material;
    // 共享材质由 MaterialLibrary 在卸载时统一释放（G3D-07）。
    if (Array.isArray(material)) {
      for (const entry of material) if (!entry.userData.gdShared) entry.dispose();
    } else if (material && !material.userData.gdShared) {
      material.dispose();
    }
  });
}

/** 节点 → 共享材质 key 与 token（§3.7 材质预设）。 */
export function materialFor(node: SceneNode): { key: string; token: MaterialToken } {
  switch (node.kind) {
    case "tile": {
      const tag = node.tag && TERRAIN_MATERIALS[node.tag] ? node.tag : "desert";
      return { key: `terrain-${tag}`, token: TERRAIN_MATERIALS[tag]! };
    }
    case "decor": {
      const tag = node.tag && TERRAIN_MATERIALS[node.tag] ? node.tag : "wood";
      const terrain = TERRAIN_MATERIALS[tag]!;
      // 装饰物不走地块贴图（尺寸太小），只保留地形色 + pattern。
      return { key: `decor-${tag}`, token: { ...terrain, pbrSet: undefined, roughness: 0.7 } };
    }
    case "number-token":
      return node.tag === "hot"
        ? { key: "number-token-hot", token: PROP_MATERIALS["number-token-hot"] }
        : { key: "number-token", token: PROP_MATERIALS["number-token"] };
    case "robber":
      return { key: "robber", token: PROP_MATERIALS.robber };
    case "settlement":
    case "city":
    case "road": {
      const seat = node.seat ?? 0;
      return { key: `seat-${seat}`, token: seatMaterial(seat) };
    }
    case "die":
      return { key: "die", token: PROP_MATERIALS.die };
    case "port":
    case "ship":
    case "dice-tray":
      return { key: "wood", token: PROP_MATERIALS.wood };
    default:
      return { key: "cliff", token: PROP_MATERIALS.cliff };
  }
}

function batchableKind(kind: SceneNode["kind"]): boolean {
  return (
    kind === "tile" ||
    kind === "road" ||
    kind === "decor" ||
    kind === "settlement" ||
    kind === "city" ||
    kind === "robber" ||
    kind === "number-token" ||
    kind === "port" ||
    kind === "ship"
  );
}

let SHARED_NUMBER_GEOM: BufferGeometry | null = null;
function sharedNumberGeom(): BufferGeometry {
  if (!SHARED_NUMBER_GEOM) SHARED_NUMBER_GEOM = new CylinderGeometry(0.22, 0.22, 0.06, 24);
  return SHARED_NUMBER_GEOM;
}

function disposeSharedSceneGeometries(): void {
  SHARED_TILE_GEOM?.dispose();
  SHARED_ROAD_GEOM?.dispose();
  SHARED_DECOR_GEOM?.dispose();
  SHARED_NUMBER_GEOM?.dispose();
  SHARED_TILE_GEOM = null;
  SHARED_ROAD_GEOM = null;
  SHARED_DECOR_GEOM = null;
  SHARED_NUMBER_GEOM = null;
}


function geomForBatch(node: SceneNode): BufferGeometry {
  const tide = getTidewellGeometriesSync();
  if (node.kind === "tile") return sharedTileGeom();
  if (node.kind === "road") return tide.ready ? tide.road : sharedRoadGeom();
  if (node.kind === "decor") return geometryForNode(node, tide);
  if (node.kind === "number-token") return sharedNumberGeom();
  if (
    node.kind === "settlement" ||
    node.kind === "city" ||
    node.kind === "robber" ||
    node.kind === "port" ||
    node.kind === "ship"
  ) {
    return geometryForNode(node, tide);
  }
  return sharedDecorGeom();
}

function createNodeObject(node: SceneNode, caps: TierCaps, library: MaterialLibrary, pools?: InstancePools | null): Object3D {
  const { key, token } = materialFor(node);
  const mat = library.get(key, token);
  const applyPose = (mesh: Mesh) => {
    mesh.position.set(node.position[0], node.position[1], node.position[2]);
    if (node.rotationY !== undefined) mesh.rotation.y = node.rotationY;
    if (node.scale) mesh.scale.set(node.scale[0], node.scale[1], node.scale[2]);
    // G3D-05 budget: number tokens never cast; G3D-06 low: tiles do not cast (§4.7).
    const tileNoCast = node.kind === "tile" && !caps.tilesCastShadow;
    mesh.castShadow = node.kind !== "number-token" && !tileNoCast;
    mesh.receiveShadow = true;
    mesh.userData.nodeId = node.id;
    mesh.userData.kind = node.kind;
    return mesh;
  };

  if (pools && batchableKind(node.kind)) {
    const geom = geomForBatch(node);
    const castShadow =
      node.kind === "number-token"
        ? false
        : node.kind === "tile"
          ? caps.tilesCastShadow
          : true;
    const poolKey = `${node.kind}:${key}`;
    const { index } = pools.acquire(poolKey, geom, mat, castShadow);
    const handle = new Object3D();
    handle.position.set(node.position[0], node.position[1], node.position[2]);
    if (node.rotationY !== undefined) handle.rotation.y = node.rotationY;
    if (node.scale) handle.scale.set(node.scale[0], node.scale[1], node.scale[2]);
    handle.userData.nodeId = node.id;
    handle.userData.kind = node.kind;
    handle.userData.gdInstance = { poolKey, index };
    pools.setMatrix(poolKey, index, handle);
    return handle;
  }

  if (node.kind === "tile") {
    return applyPose(new Mesh(sharedTileGeom().clone(), mat));
  }

  if (node.kind === "number-token") {
    return applyPose(new Mesh(new CylinderGeometry(0.22, 0.22, 0.06, 24), mat));
  }

  const tide = getTidewellGeometriesSync();
  if (
    node.kind === "robber" ||
    node.kind === "settlement" ||
    node.kind === "city" ||
    node.kind === "road" ||
    node.kind === "port" ||
    node.kind === "ship" ||
    node.kind === "die" ||
    node.kind === "dice-tray" ||
    node.kind === "decor"
  ) {
    const mesh = applyPose(new Mesh(geometryForNode(node, tide).clone(), mat));
    if (node.kind === "die") mesh.rotation.set(...dieFaceEuler(node.number));
    return mesh;
  }

  // cliff default
  return applyPose(new Mesh(new CylinderGeometry(1, 1.05, 1, 6), mat));
}

function updateNodeObject(object: Object3D, node: SceneNode, library: MaterialLibrary, pools?: InstancePools | null): void {
  object.position.set(node.position[0], node.position[1], node.position[2]);
  if (node.rotationY !== undefined) object.rotation.y = node.rotationY;
  if (node.scale) object.scale.set(node.scale[0], node.scale[1], node.scale[2]);
  else if (node.kind === "settlement" || node.kind === "city" || node.kind === "robber") object.scale.set(1, 1, 1);
  if (node.kind === "die") object.rotation.set(...dieFaceEuler(node.number));
  const inst = object.userData.gdInstance as { poolKey: string; index: number } | undefined;
  if (inst && pools) {
    // Material group changes are rare for tiles; pose sync is the hot path.
    pools.setMatrix(inst.poolKey, inst.index, object);
    return;
  }
  const mesh = object as Mesh;
  if (!mesh.isMesh) return;
  // 地形 / 座位变化：换成对应的共享材质（不改共享材质本身的颜色）。
  const { key, token } = materialFor(node);
  const next = library.get(key, token);
  if (mesh.material !== next) mesh.material = next;
}

/**
 * Three.js host: WebGL2 renderer + OrbitControls + SceneModel reconcile.
 */
export function SceneHost({
  className,
  ariaLabel = "g3d-scene-host",
  hexSettlement,
  interactive = false,
  legalActions = [],
  onPick,
  lighting,
  activeSeat = null,
  scene: adapter = null,
}: SceneHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [ready, setReady] = useState(false);
  const modelRef = useRef<SceneModel | null>(null);
  /** G3D-ART-2：点数筹码数字贴花（1 draw call，不进实例池）。 */
  const numberLabelsRef = useRef<NumberLabelLayer | null>(null);
  const registryRef = useRef(new Map<string, Object3D>());
  const contentRootRef = useRef<Object3D | null>(null);
  const reconcileHostRef = useRef<ReturnType<typeof buildHost> | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitRootRef = useRef<Object3D | null>(null);
  const motionRef = useRef<MotionController | null>(null);
  /** G3D-08 tide water (lazy chunk). */
  const waterRef = useRef<{
    update(now: number): void;
    setTier(tier: "high" | "medium" | "low"): void;
    rebuildDistance(model: SceneModel | null): void;
    dispose(): void;
    lastDistanceMs: number;
  } | null>(null);
  const waterAliveRef = useRef(false);
  const waterAbortRef = useRef<AbortController | null>(null);
  const waterMountPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const waterMountingRef = useRef(false);
  const controlsRef = useRef<OrbitControls | null>(null);
  const lastSeatRef = useRef<number | null>(null);
  const diceSeedRef = useRef(1);
  const diceAnimatedRef = useRef(false);
  const lastActionRef = useRef<string | null | undefined>(undefined);
  const interactiveRef = useRef(interactive);
  const legalActionsRef = useRef(legalActions);
  const onPickRef = useRef(onPick);
  interactiveRef.current = interactive;
  legalActionsRef.current = legalActions;
  onPickRef.current = onPick;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const layoutKeyRef = useRef<string | null>(null);
  const cameraKeyRef = useRef<string | null>(null);
  /** G3D-14：按 RenderSpec.camera 与当前宽高比放置机位（窄屏时拉远，保证桌面左右不出画）。 */
  const fitCameraRef = useRef<() => void>(() => {});
  // G3D-05: bumping the epoch tears the 3D host down and rebuilds it (perf leak check).
  const [hostEpoch, setHostEpoch] = useState(0);
  const [perfMode] = useState(() => perfModeEnabled());
  const [activeTier, setActiveTier] = useState<RenderTierId>("high");
  const runtimeFloorRef = useRef<RenderTierId | null>(null);
  const lightingRef = useRef<LightingSpec>(lighting ?? SCENE_TOKENS.lighting);
  lightingRef.current = lighting ?? SCENE_TOKENS.lighting;
  const rigRef = useRef<ReturnType<typeof createLightingRig> | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  /** 场景内容变化 → 阴影贴图在接下来 SHADOW_REFRESH_MS 内逐帧重绘。 */
  const markShadowsDirtyRef = useRef<() => void>(() => {});
  const [pbrState, setPbrState] = useState<"off" | "pending" | "512" | "256" | "error">("pending");
  /** G3D-13: flip when pieces/decor/props GLBs replace procedural placeholders. */

  function reframe(focus: readonly [number, number, number], id: string) {
    const motion = motionRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (motion && camera && controls) motion.reframe(camera, controls, focus, id);
  }

  function buildHost(root: Object3D, getCaps: () => TierCaps, library: MaterialLibrary, motion: MotionController) {
    const pools = createInstancePools(root);
    return {
      root,
      pools,
      create: (node: SceneNode) => adapterRef.current
        ? adapterRef.current.create(node, { library, caps: getCaps() })
        : createNodeObject(node, getCaps(), library, pools),
      update: (object: Object3D, node: SceneNode) => adapterRef.current
        ? adapterRef.current.update(object, node, { library, caps: getCaps() })
        : updateNodeObject(object, node, library, pools),
      disposeObject: (object: Object3D) => disposeObject(object, pools),
      motion: {
        added: (object: Object3D, node: SceneNode) => {
          if (node.kind === "piece") {
            motion.place(object, node.id);
            return;
          }
          if (node.kind !== "settlement" && node.kind !== "city" && node.kind !== "road") return;
          motion.place(object, node.id);
          reframe(node.position, `build:${node.id}`);
        },
        removed: (object: Object3D, id: string, detach: () => void) => {
          motion.remove(object, id, detach);
        },
        updated: (object: Object3D, prev: SceneNode, node: SceneNode) => {
          if (node.kind === "piece" && prev.position.join() !== node.position.join()) {
            motion.moveArc(object, node.id, prev.position);
          } else if (node.kind === "robber" && prev.position.join() !== node.position.join()) {
            motion.moveArc(object, node.id, prev.position);
            reframe(node.position, "robber");
          } else if (node.kind === "die" && prev.number !== node.number) {
            diceSeedRef.current += 1;
            diceAnimatedRef.current = true;
            motion.dice(object, node.id, node.number ?? 1, diceSeedRef.current);
            if (node.id === "die:0") reframe(node.position, "dice");
          }
        },
      },
    };
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!supportsWebGL2()) {
      setUnsupported(true);
      return;
    }

    const scene = new Scene();
    scene.background = new Color(SCENE_TOKENS.sky.horizon);

    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 9, 12);

    setPbrState("pending");
    const env = detectEnvFromBrowser();
    let resolution = resolveTier({ env, runtimeFloor: runtimeFloorRef.current });
    let caps = resolution.caps;
    setActiveTier(caps.id);
    console.info(tierLogLine(resolution, "mount"));

    const renderer = new WebGLRenderer({ antialias: caps.antialias, alpha: false });
    // G3D-07：AgX 色调映射 + sRGB 输出 + PCF 软阴影（§3.7 / §4.3）。
    configureRenderer(renderer, lightingRef.current);
    // 静止场景复用阴影贴图；内容变化后 SHADOW_REFRESH_MS 内逐帧重绘（见 tick）。
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(new Color(SCENE_TOKENS.sky.horizon), 1);
    rendererRef.current = renderer;
    // setSize(..., false) leaves the canvas CSS size unset, so on DPR > 1 the
    // canvas laid out at its backing-store width (e.g. 824 px on a 412 px
    // phone) and widened the page. Pin the CSS box to the container (G3D-05).
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const motion = new MotionController();
    // e2e observability (like __g3dMotionLog): is any tween still in flight?
    (globalThis as { __g3dMotionBusy?: () => boolean }).__g3dMotionBusy = () => motion.busy;
    motionRef.current = motion;
    controlsRef.current = controls;
    const onControlsStart = () => motion.noteUserDrag();
    controls.addEventListener("start", onControlsStart);
    controls.addEventListener("end", onControlsStart);
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI * 0.48;

    const rig = createLightingRig(scene, lightingRef.current, caps);
    rigRef.current = rig;
    const sky = createSkyDome();
    scene.add(sky);
    const library = new MaterialLibrary({ clearcoat: caps.id === "high" });
    // high 档：RoomEnvironment 环境反射（强度 0.35，只挂光泽材质）；medium / low 关闭（§4.7）。
    let environment: ReturnType<typeof createRoomEnvironment> | null = null;
    const applyEnvironment = (next: TierCaps) => {
      if (next.envReflection && !environment) environment = createRoomEnvironment(renderer);
      library.setEnvironment(next.envReflection && environment ? environment.texture : null, SCENE_TOKENS.environment.intensity);
    };
    applyEnvironment(caps);
    container.dataset.toneMapping = "agx";
    delete container.dataset.pbrReused;
    container.dataset.shadowMapSize = String(caps.shadowMapSize);

    let shadowDirtyUntil = Number.POSITIVE_INFINITY; // 首次挂载：直到第一次内容稳定
    let shadowFrames = 0;
    const markShadowsDirty = () => {
      shadowDirtyUntil = performance.now() + SHADOW_REFRESH_MS;
    };
    markShadowsDirtyRef.current = markShadowsDirty;

    const contentRoot = new Scene();
    scene.add(contentRoot);
    contentRootRef.current = contentRoot;
    reconcileHostRef.current = buildHost(contentRoot, () => caps, library, motion);

    // G3D-08: water mounts on first hex reconcile (lazy chunk); smoke path keeps BoxGeometry ground.
    waterAliveRef.current = true;
    waterAbortRef.current?.abort();
    waterAbortRef.current = new AbortController();
    const hitRoot = new Scene();
    scene.add(hitRoot);
    hitRootRef.current = hitRoot;
    cameraRef.current = camera;
    canvasRef.current = renderer.domElement;

    const onPointerUp = (event: PointerEvent) => {
      if (!interactiveRef.current || !onPickRef.current) return;
      if (event.button !== 0) return;
      const target = pickFromPointerEvent(
        event,
        renderer.domElement,
        camera,
        // Prefer hit overlays, then board content
        hitRoot.children.length > 0 ? hitRoot : contentRoot,
      );
      // If hit root miss, also try content root (tiles for robber)
      const resolved =
        target ??
        pickFromPointerEvent(event, renderer.domElement, camera, contentRoot);
      if (!resolved) return;
      const resolvePick = adapterRef.current?.resolvePick;
      const matched = resolvePick ? resolvePick(resolved) : matchPickToLegalAction(resolved, legalActionsRef.current);
      if (!matched) return;
      event.preventDefault();
      onPickRef.current(matched);
    };
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    const perf = perfRecorder();
    const detachPerf = perf?.attach({
      renderer,
      scene,
      remount: () => setHostEpoch((epoch) => epoch + 1),
      tier: () => caps.id,
    });

    // Fallback test cube when no hex state yet (G3D-02 smoke path).
    if (!hexSettlement && !adapterRef.current) {
      const geom = new BoxGeometry(1, 1, 1);
      const cube = new Mesh(geom, library.get("seat-0", seatMaterial(0)));
      cube.position.set(0, 0.5, 0);
      cube.castShadow = true;
      contentRoot.add(cube);
      const groundGeom = new BoxGeometry(12, 0.05, 12);
      const ground = new Mesh(groundGeom, library.get("ground", PROP_MATERIALS.ground));
      ground.position.y = -0.02;
      ground.receiveShadow = true;
      contentRoot.add(ground);
    }

    let frameId = 0;
    let disposed = false;
    // G3D-13: load Tidewell GLBs before hex reconcile (avoids remount that aborted water).
    void ensureTidewellGeometries().finally(() => {
      if (!disposed) setReady(true);
    });
    let lastFrameAt: number | null = null;
    let warmFrames = 0;
    const downgradeMonitor = new RuntimeDowngradeMonitor();
    let lastRenderedAt = 0;

    const applyCapsToRenderer = (next: TierCaps) => {
      rig.applyCaps(next);
      applyEnvironment(next);
      library.setClearcoat(next.id === "high");
      waterRef.current?.setTier(next.id);
      markShadowsDirty();
      container.dataset.shadowMapSize = String(next.shadowMapSize);
      // Tile castShadow: update existing meshes
      contentRoot.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        if (mesh.userData.kind === "tile") {
          mesh.castShadow = next.tilesCastShadow;
        }
      });
    };

    const resize = () => {
      if (disposed) return;
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      const dpr = Math.min(window.devicePixelRatio || 1, caps.dprCap);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      fitCameraRef.current();
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
    };
    const onWindowResize = () => resize();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    observer?.observe(container);
    window.addEventListener("resize", onWindowResize);
    resize();

    // G3D-07：可交互后按档位流式替换 G3D-22 KTX2 PBR 套件（high/medium 512，low 256）。
    let pbrRequested = false;
    let pbrTimer: number | null = null;
    let streamer: { dispose(): void } | null = null;
    const startPbrStreaming = () => {
      pbrRequested = true;
      const resolutionPx = pbrResolutionFor(caps.id);
      if (new URLSearchParams(window.location.search).get("pbr") === "0") {
        setPbrState("off");
        return;
      }
      pbrTimer = window.setTimeout(() => {
        pbrTimer = null;
        void import("./assets/pbr-textures")
          .then(async ({ createPbrStreamer }) => {
            if (disposed) return;
            const pbr = createPbrStreamer(renderer);
            streamer = pbr;
            const sets = library.pbrSetsInUse();
            let reused = 0;
            // 逐套加载：每套到达即替换，避免一次性大批量编译 / 上传。
            for (const set of sets) {
              if (disposed) return;
              const loaded = await pbr.load(set, resolutionPx);
              if (disposed) {
                if (loaded) for (const texture of [loaded.maps.map, loaded.maps.normalMap, loaded.maps.ormMap] as Texture[]) texture.dispose();
                return;
              }
              if (!loaded) continue;
              library.applyPbrSet(set, loaded.maps);
              if (loaded.resolution !== resolutionPx) reused += 1;
            }
            // 降档重建后复用了降档前已下载的 512 套件（不重复下载 256）。
            if (reused > 0) container.dataset.pbrReused = String(reused);
            pbr.dispose();
            streamer = null;
            if (!disposed) {
              setPbrState(resolutionPx === 512 ? "512" : "256");
              markShadowsDirty();
            }
          })
          .catch((error: unknown) => {
            if (disposed) return;
            console.warn("[godesk.pbr] texture streaming failed", error);
            setPbrState("error");
          });
      }, PBR_STREAM_DELAY_MS);
    };

    const tick = (now: number) => {
      if (disposed) return;
      frameId = window.requestAnimationFrame(tick);

      const minFrameMs = caps.maxFps ? 1000 / caps.maxFps : 0;
      if (minFrameMs > 0 && now - lastRenderedAt < minFrameMs - 0.5) {
        return;
      }
      lastRenderedAt = now;

      const delta = lastFrameAt === null ? null : now - lastFrameAt;
      lastFrameAt = now;
      warmFrames += 1;

      // Runtime downgrade after 180 warm-up frames (§4.7 / §4.6.3).
      if (warmFrames > 180 && delta !== null) {
        if (downgradeMonitor.shouldDowngrade(caps.id, now, delta)) {
          const nextId = downgradeTier(caps.id);
          if (nextId !== caps.id) {
            runtimeFloorRef.current = nextId;
            const prevAntialias = caps.antialias;
            resolution = resolveTier({ env, runtimeFloor: runtimeFloorRef.current });
            caps = resolution.caps;
            setActiveTier(caps.id);
            console.info(tierLogLine(resolution, "runtime-downgrade"));
            if (prevAntialias !== caps.antialias) {
              // MSAA is constructor-only — remount host.
              setHostEpoch((epoch) => epoch + 1);
              return;
            }
            applyCapsToRenderer(caps);
            resize();
            downgradeMonitor.reset();
          }
        }
      }

      motion.update(now);
      waterRef.current?.update(now);
      controls.update();
      // 阴影：内容 / 档位变化后 SHADOW_REFRESH_MS 内逐帧重绘，之后复用（方向光阴影与机位无关）。
      if (now < shadowDirtyUntil || shadowFrames < 2) {
        renderer.shadowMap.needsUpdate = true;
        shadowFrames += 1;
      }
      renderer.render(scene, camera);
      const hasContent = contentRoot.children.length > 0;
      if (hasContent && renderer.info.render.calls > 0) {
        markInteractive();
        if (shadowDirtyUntil === Number.POSITIVE_INFINITY) markShadowsDirty();
        if (!pbrRequested) startPbrStreaming();
      }
      perf?.frame(renderer, now, hasContent);
    };
    frameId = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      if (pbrTimer !== null) window.clearTimeout(pbrTimer);
      streamer?.dispose();
      window.removeEventListener("resize", onWindowResize);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      observer?.disconnect();
      // Fading objects detach + dispose via their completion callbacks.
      waterAliveRef.current = false;
      waterMountingRef.current = false;
      waterAbortRef.current?.abort();
      waterAbortRef.current = null;
      waterRef.current?.dispose();
      waterRef.current = null;
      motion.finishAll();
      controls.removeEventListener("start", onControlsStart);
      controls.removeEventListener("end", onControlsStart);
      controls.dispose();
      for (const object of registryRef.current.values()) {
        contentRoot.remove(object);
        disposeObject(object);
      }
      registryRef.current.clear();
      while (hitRoot.children.length > 0) {
        const child = hitRoot.children[0]!;
        hitRoot.remove(child);
        disposeHitOverlay(child);
      }
      contentRoot.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        // InstancedMesh pools own shared geom/mat; pools.dispose() handles them.
        if (mesh.userData.gdInstancePool || mesh.userData.gdShared) return;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          for (const entry of material) if (!entry.userData?.gdShared) entry.dispose();
        } else if (material && !material.userData?.gdShared) {
          material.dispose();
        }
      });
      scene.remove(sky);
      sky.geometry.dispose();
      (sky.material as { dispose(): void }).dispose();
      library.setEnvironment(null, 0);
      environment?.dispose();
      rig.dispose();
      rigRef.current = null;
      library.dispose();
      // 须在 perf 快照前释放贴花图集，否则计为残留纹理。
      numberLabelsRef.current?.dispose();
      numberLabelsRef.current = null;
      const hostPools = reconcileHostRef.current as { pools?: InstancePools } | null;
      hostPools?.pools?.dispose();
      disposeSharedSceneGeometries();
      disposeSharedHitResources();
      disposeTidewellGeometryCache();
      perf?.beforeDispose(renderer);
      detachPerf?.();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      contentRootRef.current = null;
      reconcileHostRef.current = null;
      hitRootRef.current = null;
      cameraRef.current = null;
      canvasRef.current = null;
      rendererRef.current = null;
      markShadowsDirtyRef.current = () => {};
      motionRef.current = null;
      controlsRef.current = null;
      lastSeatRef.current = null;
      lastActionRef.current = undefined;
      modelRef.current = null;
      layoutKeyRef.current = null;
      cameraKeyRef.current = null;
      fitCameraRef.current = () => {};
      setReady(false);
    };
    // hexSettlement applied in separate effect against stable host
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostEpoch]);

  function syncNumberLabels(model: SceneModel) {
    const root = contentRootRef.current;
    if (!root) return;
    const layer = (numberLabelsRef.current ??= createNumberLabelLayer());
    if (layer.mesh.parent !== root) root.add(layer.mesh);
    layer.sync(model.nodes);
    const container = containerRef.current;
    if (container) container.dataset.numberLabels = String(layer.labels().length);
    // e2e：贴花屏幕包围盒（像素探针用）。
    (globalThis as { __g3dNumberLabels?: () => unknown }).__g3dNumberLabels = () => {
      const camera = cameraRef.current;
      const canvas = canvasRef.current;
      if (!camera || !canvas) return [];
      return projectLabels(numberLabelsRef.current?.labels() ?? [], camera, canvas.clientWidth, canvas.clientHeight);
    };
  }

  useEffect(() => {
    void ensureTidewellGeometries().then((geoms) => {
      if (geoms.ready) setModelsReady(true);
    });
  }, []);

  useEffect(() => {
    const host = reconcileHostRef.current;
    if (!host || !hexSettlement) return;
    const prev = modelRef.current;
    const next = mapHexSettlementToScene(hexSettlement);
    const hadModel = prev !== null;
    const previousAction = lastActionRef.current;
    lastActionRef.current = hexSettlement.lastAction;
    diceAnimatedRef.current = false;
    modelRef.current = reconcileScene(host, prev, next, registryRef.current);
    syncNumberLabels(next);
    // 阴影相机只在布局（地块集合）变化时按包围球重算一次（§4.3）。
    const tileKey = (model: SceneModel | null) =>
      model ? model.nodes.filter((node) => node.kind === "tile").map((node) => node.id).join("|") : "";
    const tilesChanged = tileKey(prev) !== tileKey(next);
    if (tilesChanged) {
      const bounds = islandBounds(next.nodes);
      rigRef.current?.fitToBounds(bounds.center, bounds.radius);
    }
    // G3D-08: first hex model mounts water; later tile-layout changes rebuild the coast field.
    // Synchronous mount lock: hex reconcile can fire twice before the first async controller
    // commits; without the lock both create textures and the loser is overwritten (leak).
    if (!waterRef.current && !waterMountingRef.current) {
      waterMountingRef.current = true;
      const signal = waterAbortRef.current?.signal;
      waterMountPromiseRef.current = import("./water")
        .then(async ({ createWaterController }) => {
          try {
            const renderer = rendererRef.current;
            const root = contentRootRef.current;
            const el = containerRef.current;
            if (!renderer || !root || !waterAliveRef.current || waterRef.current) return;
            const tierAttr = el?.dataset.tier;
            const tier =
              tierAttr === "high" || tierAttr === "medium" || tierAttr === "low" ? tierAttr : "medium";
            try {
              const water = await createWaterController({
                renderer,
                parent: root,
                model: next,
                tier,
                signal,
              });
              if (!waterAliveRef.current || !contentRootRef.current || signal?.aborted || waterRef.current) {
                water.dispose();
                return;
              }
              waterRef.current = water;
              // Warm custom water program on SwiftShader before the first user click
              // (cold compile can block the main thread long enough to flake mid-tween clicks).
              const cam = cameraRef.current;
              if (cam) {
                try {
                  renderer.compile(root, cam);
                } catch {
                  /* compile best-effort */
                }
              }
              if (el) {
                el.dataset.water = "on";
                el.dataset.waterDistMs = String(Math.round(water.lastDistanceMs));
              }
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") return;
              console.warn("[godesk.water] mount failed", error);
            }
          } finally {
            waterMountingRef.current = false;
          }
        })
        .then(() => undefined);
    } else if (waterRef.current && tilesChanged) {
      waterRef.current.rebuildDistance(next);
      const el = containerRef.current;
      if (el) el.dataset.waterDistMs = String(Math.round(waterRef.current.lastDistanceMs));
    }
    // 覆盖 G3D-09 放置 / 强盗 / 骰子动效时长（SHADOW_REFRESH_MS ≥ 900 ms）。
    markShadowsDirtyRef.current();
    // Repeated faces (e.g. 1+1 after the [1,1] rest pose) produce no node diff;
    // a transition into roll_dice still tumbles both dice.
    const rolled =
      hadModel &&
      hexSettlement.lastAction === "roll_dice" &&
      previousAction !== undefined &&
      previousAction !== "roll_dice";
    const motion = motionRef.current;
    if (rolled && !diceAnimatedRef.current && motion) {
      for (const node of next.nodes) {
        if (node.kind !== "die") continue;
        const object = registryRef.current.get(node.id);
        if (!object) continue;
        diceSeedRef.current += 1;
        motion.dice(object, node.id, node.number ?? 1, diceSeedRef.current);
        if (node.id === "die:0") reframe(node.position, "dice");
      }
    }
  }, [hexSettlement, ready, hostEpoch]);

  // G3D-14：通用桌面场景 reconcile + 按包围球适配阴影相机 / 机位。
  useEffect(() => {
    const host = reconcileHostRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!host || !adapter || !ready) return;
    modelRef.current = reconcileScene(host, modelRef.current, adapter.model, registryRef.current);
    const container = containerRef.current;
    if (container) container.dataset.sceneNodes = String(adapter.model.nodes.length);
    const bounds = adapter.bounds;
    if (bounds && adapter.layoutKey !== layoutKeyRef.current) {
      layoutKeyRef.current = adapter.layoutKey ?? null;
      rigRef.current?.fitToBounds(bounds.center, bounds.radius);
    }
    const spec = adapter.camera;
    const cameraKey = spec ? `${JSON.stringify(spec)}|${adapter.layoutKey ?? ""}` : null;
    if (spec && camera && controls && cameraKey !== cameraKeyRef.current) {
      cameraKeyRef.current = cameraKey;
      const minPolar = (spec.minPolarDeg * Math.PI) / 180;
      const maxPolar = (spec.maxPolarDeg * Math.PI) / 180;
      const polar = (minPolar + maxPolar) / 2;
      const radius = bounds?.radius ?? 7.5;
      const center = bounds?.center ?? [0, 0, 0];
      fitCameraRef.current = () => {
        // RenderSpec 距离按约 7.5 单位半径的场景标定；桌面更大 / 更小时等比缩放，
        // 窄屏（水平视角小于垂直视角）时再拉远到包围半径能水平放下。
        const halfH = Math.atan(Math.tan((spec.fovDeg * Math.PI) / 360) * camera.aspect);
        const distance = Math.max(
          spec.distance * Math.min(Math.max(radius / 7.5, 0.5), 1.6),
          (radius * 0.92) / Math.tan(halfH),
        );
        camera.fov = spec.fovDeg;
        camera.position.set(center[0], center[1] + distance * Math.cos(polar), center[2] + distance * Math.sin(polar));
        camera.updateProjectionMatrix();
        controls.target.set(center[0], center[1], center[2]);
        controls.minDistance = distance * 0.5;
        controls.maxDistance = distance * 1.8;
        controls.update();
      };
      controls.minPolarAngle = minPolar;
      controls.maxPolarAngle = maxPolar;
      controls.enablePan = spec.pan;
      fitCameraRef.current();
    }
    markShadowsDirtyRef.current();
  }, [adapter, ready, hostEpoch]);

  // G3D-09 turn camera: reframe toward the island centre when the active seat changes.
  useEffect(() => {
    if (!ready || activeSeat === null || activeSeat === undefined) return;
    const previous = lastSeatRef.current;
    lastSeatRef.current = activeSeat;
    if (previous === null || previous === activeSeat) return;
    reframe([0, 0, 0], `turn:${activeSeat}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeat, ready, hostEpoch]);

  useEffect(() => {
    const rig = rigRef.current;
    const renderer = rendererRef.current;
    if (!rig || !renderer || !ready) return;
    const spec = lighting ?? SCENE_TOKENS.lighting;
    rig.applyLighting(spec);
    configureRenderer(renderer, spec);
    markShadowsDirtyRef.current();
  }, [lighting, ready, hostEpoch]);

  useEffect(() => {
    const hitRoot = hitRootRef.current;
    if (!hitRoot || !ready) return;
    while (hitRoot.children.length > 0) {
      const child = hitRoot.children[0]!;
      hitRoot.remove(child);
      disposeHitOverlay(child);
    }
    if (!interactive || legalActions.length === 0 || adapterRef.current) return;
    for (const overlay of buildLegalHitOverlays(legalActions)) {
      hitRoot.add(overlay);
    }
  }, [interactive, legalActions, ready, hostEpoch]);

  if (unsupported) {
    return (
      <div
        aria-label={ariaLabel}
        className={className}
        data-testid="g3d-scene-host"
        data-webgl2="unsupported"
        role="img"
      >
        <p>
          此设备不支持 WebGL2，无法显示 3D 桌面。请使用下方可访问动作列表继续对局（列表本身完整可玩）。
        </p>
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      className={className}
      data-testid="g3d-scene-host"
      data-tier={activeTier}
      data-pbr={pbrState}
      ref={containerRef}
      role="img"
      style={{ width: "100%", height: "100%", minHeight: 280, touchAction: "none", position: perfMode ? "relative" : undefined }}
    >
      {perfMode && <PerfOverlay />}
    </div>
  );
}
