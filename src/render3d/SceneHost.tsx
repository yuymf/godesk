import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Mesh,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Shape,
  SphereGeometry,
  type Texture,
  WebGLRenderer,
  type BufferGeometry,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createInstancePools, type InstancePools } from "./instance-pools";
import {
  disposeTidewellGeometryCache,
  ensureTidewellGeometries,
  geometryForNode,
  getTidewellGeometriesSync,
} from "./model-templates";
import {
  matchPickToLegalAction,
  pickFromPointerEvent,
  type PickableLegalAction,
  type PickTarget,
} from "./pick";
import { reconcileScene } from "./reconcile";
import type { NumberLabelLayer } from "./number-labels";
import type { JudgePreset } from "./judge-camera";
import { REPLACED_NODE_KINDS } from "./dressing-kinds";
import type { HexDressing } from "./hex-dressing";
import { framePose, type ViewportFrame } from "./viewport-frame";
import type { SceneModel, SceneNode } from "./scene-model";
import type { HexSettlementSceneInput } from "./mappers/hex-settlement";
import { markInteractive, perfModeEnabled, perfRecorder } from "./perf";
import { applyDieOrientation, idleBob, MotionController, prefersReducedMotion } from "./motion";
import type { CameraDirector, CameraRigApi, PlayCamera } from "./camera-rig";

function isOrthographicCamera(camera: PlayCamera): camera is OrthographicCamera {
  return (camera as OrthographicCamera).isOrthographicCamera === true;
}
import type { DiceOverlay } from "./dice-overlay";
/**
 * Hex-board-only code (camera director, dice overlay, mapper, number decals,
 * hit targets, procedural pieces) loads lazily before the first hex reconcile.
 */
type HexKit = typeof import("./hex-kit");
let hexKit: HexKit | null = null;
/** Toolbar is UI chrome, not render core: its own lazy chunk (keeps render3d core ≤ 210 KB). */
const CameraToolbar = lazy(async () => ({ default: (await import("./overlay/CameraToolbar")).CameraToolbar }));
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
  HEX_ISLAND_LIGHTING,
  SCENE_TOKENS,
  TERRAIN_MATERIALS,
  TILE_BASE_SCALE,
  TILE_FACE_RADIUS,
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
  TIER_CAPS,
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
  /**
   * Track B HUD framing (2h3/2h4). Island fill / polar for hex-settlement only.
   * Track C owns the full camera-rig; this is a minimal viewport param.
   */
  viewportFrame?: ViewportFrame | null;
  /**
   * G3D-JUDGE-PIECES: the viewer's seat. Local player's turn → tilted 3/4 "play" camera;
   * anyone else's turn → near top-down "overview". null (spectator / preview) → "play".
   */
  localSeat?: number | null;
  /** Show the on-canvas camera toolbar (hex scenes). Default true. */
  cameraToolbar?: boolean;
  /** Receives the camera API (zoom / rotate / reset / subscribe) for external HUD controls. */
  onCameraApi?: (api: CameraRigApi | null) => void;
};

/** Vertex-coloured procedural pieces share three white materials (seat colour is baked). */
const PIECE_VC_TOKEN: MaterialToken = {
  base: "#ffffff",
  roughness: 0.82,
  metalness: 0,
  // Round-6tex: drop glossy clearcoat (plastic-toy). Wood albedo × vertexColors.
  clearcoat: 0,
  pattern: "none",
  pbrSet: "t09-paintwood",
  pbrRepeat: 2.2,
  pbrBaseColor: true,
};
const FIGURE_VC_TOKEN: MaterialToken = { base: "#ffffff", roughness: 0.66, metalness: 0, pattern: "none" };
const DICE_VC_TOKEN: MaterialToken = { base: "#ffffff", roughness: 0.34, metalness: 0, clearcoat: 0.5, pattern: "none" };

function vcMaterial(library: MaterialLibrary, key: string, token: MaterialToken) {
  const material = library.get(key, token);
  if (!material.vertexColors) {
    material.vertexColors = true;
    material.needsUpdate = true;
  }
  return material;
}

/** Procedural (own-modelled) geometry + material for pieces / dice / tray; null for other kinds. */
function proceduralFor(
  node: SceneNode,
  library: MaterialLibrary,
): { geometry: BufferGeometry; material: ReturnType<MaterialLibrary["get"]>; poolKey: string } | null {
  const kit = hexKit;
  if (!kit) return null;
  const { pieceGeometry, dieGeometry, diceTrayGeometry } = kit;
  const seat = node.seat ?? 0;
  switch (node.kind) {
    case "settlement":
    case "city":
    case "road":
      return {
        geometry: pieceGeometry(node.kind, seat),
        material: vcMaterial(library, "piece-vc", PIECE_VC_TOKEN),
        poolKey: `${node.kind}:s${seat}`,
      };
    case "robber":
      return { geometry: pieceGeometry("robber"), material: vcMaterial(library, "figure-vc", FIGURE_VC_TOKEN), poolKey: "robber:vc" };
    case "die":
      return { geometry: dieGeometry(), material: vcMaterial(library, "dice-vc", DICE_VC_TOKEN), poolKey: "die:vc" };
    case "dice-tray":
      return { geometry: diceTrayGeometry(), material: vcMaterial(library, "piece-vc", PIECE_VC_TOKEN), poolKey: "dice-tray:vc" };
    default:
      return null;
  }
}

/** Dice are thrown in from the tray's back-left corner and slide to rest. */
const DICE_THROW_SLIDE: readonly [number, number] = [-0.32, -0.22];

/** 阴影贴图在场景变化后继续逐帧重绘的时长（覆盖 place/move/dice 动效）。 */
const SHADOW_REFRESH_MS = 1_500;
/** 可交互后延迟多久开始流式加载 PBR 贴图（避开首屏主线程窗口）。 */
const PBR_STREAM_DELAY_MS = 1_200;
/** R18/R19 boot reveal: canvas fade-in length, cap (ms after first content frame) and pre-sea clear colour. */
export const BOOT_FADE_MS = 1_000;
export const BOOT_REVEAL_CAP_MS = 6_000;
/** R19: min ms between renders while the boot veil is up. */
export const BOOT_VEILED_FRAME_MS = 500;
export const BOOT_SEA_COLOR = "#1f5f66";


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
let SHARED_DECOR_GEOM: BufferGeometry | null = null;

function sharedTileGeom(): BufferGeometry {
  if (!SHARED_TILE_GEOM) {
    // R21: face radius 0.99 (was TILE_RADIUS − 0.04 = 0.91) → hairline light seams instead of a dark grid.
    const geom = new ExtrudeGeometry(hexShape(TILE_FACE_RADIUS, 0), { depth: 0.28, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    // R22: faces touch (radius 1.0); the sides taper inward toward the base so neighbours leave no open slot
    // (no dark 1px side / shadow line) and outer sides stay tucked inside the coast wall top.
    const pos = geom.getAttribute("position");
    for (let i = 0; i < pos.count; i += 1) {
      const k = TILE_BASE_SCALE + (1 - TILE_BASE_SCALE) * Math.min(1, Math.max(0, pos.getY(i) / 0.28));
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    SHARED_TILE_GEOM = geom;
  }
  return SHARED_TILE_GEOM;
}
function sharedDecorGeom(): BufferGeometry {
  if (!SHARED_DECOR_GEOM) SHARED_DECOR_GEOM = new SphereGeometry(0.18, 10, 10);
  return SHARED_DECOR_GEOM;
}

function disposeObject(object: Object3D, pools?: InstancePools | null): void {
  const overlay = object.userData.gdOverlay as DiceOverlay | undefined;
  if (overlay) {
    overlay.detach(object);
    object.userData.gdOverlay = undefined;
    return;
  }
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
    if (!mesh.userData.gdSharedGeometry) mesh.geometry?.dispose();
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
      return { key: `decor-${tag}`, token: { ...terrain, pbrSet: undefined, roughness: 0.7, brush: undefined } };
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
    kind === "ship" ||
    kind === "die"
  );
}

let SHARED_NUMBER_GEOM: BufferGeometry | null = null;
function sharedNumberGeom(): BufferGeometry {
  if (!SHARED_NUMBER_GEOM) SHARED_NUMBER_GEOM = new CylinderGeometry(0.22, 0.22, 0.06, 24);
  return SHARED_NUMBER_GEOM;
}

function disposeSharedSceneGeometries(): void {
  SHARED_TILE_GEOM?.dispose();
  SHARED_DECOR_GEOM?.dispose();
  SHARED_NUMBER_GEOM?.dispose();
  SHARED_TILE_GEOM = null;
  SHARED_DECOR_GEOM = null;
  SHARED_NUMBER_GEOM = null;
}


function geomForBatch(node: SceneNode): BufferGeometry {
  const tide = getTidewellGeometriesSync();
  if (node.kind === "tile") return sharedTileGeom();
  if (node.kind === "decor") return geometryForNode(node, tide);
  if (node.kind === "number-token") return sharedNumberGeom();
  if (node.kind === "port" || node.kind === "ship") return geometryForNode(node, tide);
  return sharedDecorGeom();
}

function createNodeObject(
  node: SceneNode,
  caps: TierCaps,
  library: MaterialLibrary,
  pools?: InstancePools | null,
  overlay?: DiceOverlay | null,
): Object3D {
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

  const procedural = proceduralFor(node, library);
  // Dice + tray render in the screen-corner overlay; the world tree keeps an invisible handle.
  if (procedural && overlay && (node.kind === "die" || node.kind === "dice-tray")) {
    const handle = new Object3D();
    handle.position.set(node.position[0], node.position[1], node.position[2]);
    if (node.rotationY !== undefined) handle.rotation.y = node.rotationY;
    if (node.kind === "die") applyDieOrientation(handle, node.number, node.rotationY ?? 0);
    handle.userData.nodeId = node.id;
    handle.userData.kind = node.kind;
    handle.userData.baseY = node.position[1];
    handle.userData.gdOverlay = overlay;
    const mesh = new Mesh(procedural.geometry, procedural.material);
    mesh.userData.gdSharedGeometry = true;
    overlay.attach(handle, mesh);
    return handle;
  }
  if (procedural && pools && node.kind !== "dice-tray") {
    const { index } = pools.acquire(procedural.poolKey, procedural.geometry, procedural.material, true);
    const handle = new Object3D();
    handle.position.set(node.position[0], node.position[1], node.position[2]);
    if (node.rotationY !== undefined) handle.rotation.y = node.rotationY;
    if (node.kind === "die") applyDieOrientation(handle, node.number, node.rotationY ?? 0);
    handle.userData.nodeId = node.id;
    handle.userData.kind = node.kind;
    handle.userData.baseY = node.position[1];
    handle.userData.gdInstance = { poolKey: procedural.poolKey, index };
    pools.setMatrix(procedural.poolKey, index, handle);
    return handle;
  }
  if (procedural) {
    const mesh = applyPose(new Mesh(procedural.geometry, procedural.material));
    mesh.userData.gdSharedGeometry = true;
    if (node.kind === "die") applyDieOrientation(mesh, node.number, node.rotationY ?? 0);
    mesh.userData.baseY = node.position[1];
    return mesh;
  }

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
  if (node.kind === "port" || node.kind === "ship" || node.kind === "decor") {
    return applyPose(new Mesh(geometryForNode(node, tide).clone(), mat));
  }

  // cliff default
  return applyPose(new Mesh(new CylinderGeometry(1, 1.05, 1, 6), mat));
}

function updateNodeObject(object: Object3D, node: SceneNode, library: MaterialLibrary, pools?: InstancePools | null): void {
  object.position.set(node.position[0], node.position[1], node.position[2]);
  if (node.rotationY !== undefined) object.rotation.y = node.rotationY;
  if (node.scale) object.scale.set(node.scale[0], node.scale[1], node.scale[2]);
  else if (node.kind === "settlement" || node.kind === "city" || node.kind === "robber") object.scale.set(1, 1, 1);
  if (node.kind === "die") applyDieOrientation(object, node.number, node.rotationY ?? 0);
  object.userData.baseY = node.position[1];
  const inst = object.userData.gdInstance as { poolKey: string; index: number } | undefined;
  if (inst && pools) {
    // Material group changes are rare for tiles; pose sync is the hot path.
    pools.setMatrix(inst.poolKey, inst.index, object);
    return;
  }
  const mesh = object as Mesh;
  if (!mesh.isMesh || mesh.userData.gdSharedGeometry) return;
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
  viewportFrame = null,
  localSeat = null,
  cameraToolbar = true,
  onCameraApi,
}: SceneHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** R18 boot reveal：首挂载 canvas 先隐身，装扮好的 3D 场景再淡入（无平面 2D 盘闪现）；重挂载不再遮。 */
  const bootRevealedRef = useRef(false);
  const bootHexRef = useRef(false);
  bootHexRef.current = Boolean(hexSettlement);
  const [unsupported, setUnsupported] = useState(false);
  const [ready, setReady] = useState(false);
  const modelRef = useRef<SceneModel | null>(null);
  /** G3D-ART-2：点数筹码数字贴花（1 draw call，不进实例池）。 */
  const numberLabelsRef = useRef<NumberLabelLayer | null>(null);
  const registryRef = useRef(new Map<string, Object3D>());
  const contentRootRef = useRef<Object3D | null>(null);
  const reconcileHostRef = useRef<ReturnType<typeof buildHost> | null>(null);
  const cameraRef = useRef<PlayCamera | null>(null);
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
  const lastModeKeyRef = useRef<string | null>(null);
  /** G3D-JUDGE-PIECES: auto-framing + turn modes + toolbar API (hex scenes only). */
  const directorRef = useRef<CameraDirector | null>(null);
  const [cameraApi, setCameraApi] = useState<CameraDirector | null>(null);
  const overlayRef = useRef<DiceOverlay | null>(null);
  const [compactToolbar, setCompactToolbar] = useState(false);
  const framingKeyRef = useRef<string | null>(null);
  const diceSeedRef = useRef(1);
  const diceAnimatedRef = useRef(false);
  const lastActionRef = useRef<string | null | undefined>(undefined);
  const localSeatRef = useRef(localSeat);
  localSeatRef.current = localSeat;
  const viewportFrameRef = useRef(viewportFrame);
  viewportFrameRef.current = viewportFrame;
  /** G3D-ISLAND / PROPS：地形道具 + 岛屿海岸（汐屿专用图层）。 */
  const dressingRef = useRef<HexDressing | null>(null);
  const dressingModRef = useRef<typeof import("./hex-dressing") | null>(null);
  const dressingLoadingRef = useRef(false);
  /** 汐屿盘面的道具层在懒加载中：性能采样等它就位。 */
  const dressingPendingRef = useRef(false);
  const [dressingReady, setDressingReady] = useState(0);

  const activeSeatRef = useRef(activeSeat);
  activeSeatRef.current = activeSeat;
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
  // R19: hex island scenes default to the brighter picture-book rig.
  const lightingSpec: LightingSpec = lighting ?? (hexSettlement ? HEX_ISLAND_LIGHTING : SCENE_TOKENS.lighting);
  const lightingRef = useRef<LightingSpec>(lightingSpec);
  lightingRef.current = lightingSpec;
  const rigRef = useRef<ReturnType<typeof createLightingRig> | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  /** 场景内容变化 → 阴影贴图在接下来 SHADOW_REFRESH_MS 内逐帧重绘。 */
  const markShadowsDirtyRef = useRef<() => void>(() => {});
  const [pbrState, setPbrState] = useState<"off" | "pending" | "512" | "256" | "error">("pending");
  /** G3D-13: flip when pieces/decor/props GLBs replace procedural placeholders. */

  function rollDie(motion: MotionController, object: Object3D, node: SceneNode) {
    diceSeedRef.current += 1;
    const slide: [number, number] = node.id === "die:1"
      ? [DICE_THROW_SLIDE[0] * 0.8, DICE_THROW_SLIDE[1] * 1.2]
      : [DICE_THROW_SLIDE[0], DICE_THROW_SLIDE[1]];
    motion.dice(object, node.id, node.number ?? 1, diceSeedRef.current, node.rotationY ?? 0, slide);
  }

  function buildHost(root: Object3D, getCaps: () => TierCaps, library: MaterialLibrary, motion: MotionController) {
    const pools = createInstancePools(root);
    return {
      root,
      pools,
      create: (node: SceneNode) => adapterRef.current
        ? adapterRef.current.create(node, { library, caps: getCaps() })
        : createNodeObject(node, getCaps(), library, pools, overlayRef.current),
      update: (object: Object3D, node: SceneNode) => {
          if (motion.isAnimating(object)) return;
          if (object.userData.gdJudgeDemoLock) return;
          if (adapterRef.current) {
            adapterRef.current.update(object, node, { library, caps: getCaps() });
            return;
          }
          updateNodeObject(object, node, library, pools);
        },
      disposeObject: (object: Object3D) => disposeObject(object, pools),
      motion: {
        added: (object: Object3D, node: SceneNode) => {
          if (node.kind === "piece") {
            motion.place(object, node.id);
            return;
          }
          if (node.kind !== "settlement" && node.kind !== "city" && node.kind !== "road") return;
          motion.place(object, node.id);
        },
        removed: (object: Object3D, id: string, detach: () => void) => {
          motion.remove(object, id, detach);
        },
        updated: (object: Object3D, prev: SceneNode, node: SceneNode) => {
          if (node.kind === "piece" && prev.position.join() !== node.position.join()) {
            motion.moveArc(object, node.id, prev.position);
          } else if (node.kind === "robber" && prev.position.join() !== node.position.join()) {
            motion.hop(object, node.id, prev.position);
          } else if (node.kind === "die" && prev.number !== node.number) {
            diceAnimatedRef.current = true;
            rollDie(motion, object, node);
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
    sceneRef.current = scene;
    scene.background = new Color(SCENE_TOKENS.sky.horizon);

    // R25: Tidewell / hex harbor play uses OrthographicCamera (settlecoast-like).
    // Tabletop adapter path (othello etc.) keeps PerspectiveCamera + RenderSpec FOV.
    const camera: PlayCamera = bootHexRef.current
      ? new OrthographicCamera(-7, 7, 5.7, -5.7, 0.1, 120)
      : new PerspectiveCamera(40, 1, 0.1, 100);
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
    // Two passes per frame (board + dice overlay): count draw calls per frame, not per render().
    renderer.info.autoReset = false;
    renderer.setClearColor(new Color(SCENE_TOKENS.sky.horizon), 1);
    rendererRef.current = renderer;
    // setSize(..., false) leaves the canvas CSS size unset, so on DPR > 1 the
    // canvas laid out at its backing-store width (e.g. 824 px on a 412 px
    // phone) and widened the page. Pin the CSS box to the container (G3D-05).
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);
    // R18 boot reveal: no flat-board / cream-sky flash on session open. The canvas stays transparent
    // over the teal stage until the dressed scene (props + water) is up, then fades in once.
    // Hex (Tidewell) scenes only — othello / tabletop boards have no lazy dressing or sea to wait for.
    const bootVeil = !bootRevealedRef.current && bootHexRef.current;
    let bootFirstContentAt = 0;
    let bootLastRender = 0;
    const bootSea = new Color(BOOT_SEA_COLOR);
    const bootHorizon = new Color(SCENE_TOKENS.sky.horizon);
    if (bootVeil) {
      container.dataset.boot = "pending";
      renderer.domElement.style.opacity = "0";
      const reduceBoot = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.domElement.style.transition = reduceBoot ? "none" : `opacity ${BOOT_FADE_MS}ms ease-out`;
      // Until the sea mounts, clear to deep water instead of the cream horizon.
      scene.background = bootSea;
      renderer.setClearColor(bootSea, 1);
      // Start the lazy dressing + water chunks now (parallel with the kit / GLBs).
      void import("./hex-dressing");
      void import("./water").then((w) => w.prefetchSeaTextures());
    } else container.dataset.boot = "ready";
    const revealBoot = (reason: string) => {
      bootRevealedRef.current = true;
      container.dataset.boot = "ready";
      container.dataset.bootReason = reason;
      renderer.domElement.style.opacity = "1";
    };

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
    // G3D-JUDGE：仅 `?judge=1` 时暴露评审机位（dev-only；生产 URL 不带此参数时无任何行为变化）。
    const judgeEnabled = new URLSearchParams(window.location.search).get("judge") === "1";
    // Dev-only presets load lazily (own chunk; not part of the production render core).
    const freezeDressing = judgeEnabled || prefersReducedMotion();
    if (judgeEnabled) void Promise.all([import("./judge-camera"), import("../g3d-judge/motion-demo")]).then(([{ JUDGE_PRESETS, judgeCamera }, { createJudgeMotion }]) => {
      if (disposed) return;
      const judgeMotion = createJudgeMotion({
        registryRef, contentRootRef, cameraRef, rendererRef, sceneRef, controlsRef, directorRef, reconcileHostRef, markShadowsDirtyRef,
        motion, library, kit: () => hexKit, vcMaterial, figureToken: FIGURE_VC_TOKEN, pieceToken: PIECE_VC_TOKEN,
      });
      (globalThis as { __g3dJudge?: unknown }).__g3dJudge = {
        presets: JUDGE_PRESETS,
        /** R25: polar/base/fit + camera type / ortho frustum for judge φ acceptance. */
        framing(): {
          polarDeg: number;
          base: number;
          fit: number;
          fov: number | null;
          azimuthDeg: number;
          cameraType: "orthographic" | "perspective";
          left?: number;
          right?: number;
          top?: number;
          bottom?: number;
          zoom?: number;
          orthoHalfH?: number;
        } | null {
          const director = directorRef.current;
          const cam = cameraRef.current;
          if (!director || !cam) return null;
          const f = director.framing;
          const ortho = director.orthoFrustum;
          if (ortho) {
            return {
              ...f,
              fov: null,
              azimuthDeg: director.getState().azimuthDeg,
              cameraType: "orthographic",
              left: ortho.left,
              right: ortho.right,
              top: ortho.top,
              bottom: ortho.bottom,
              zoom: ortho.zoom,
              orthoHalfH: ortho.halfH,
            };
          }
          return {
            ...f,
            fov: (cam as PerspectiveCamera).fov,
            azimuthDeg: director.getState().azimuthDeg,
            cameraType: "perspective",
          };
        },
        set(preset: JudgePreset): boolean {
          const cam = cameraRef.current;
          const ctl = controlsRef.current;
          const model = modelRef.current;
          if (!cam || !ctl) return false;
          motion.finishAll();
          const director = directorRef.current;
          const el = containerRef.current;
          const aspect = isOrthographicCamera(cam)
            ? Math.max((el?.clientWidth ?? 1) / Math.max(el?.clientHeight ?? 1, 1), 1e-3)
            : cam.aspect;
          const pose = judgeCamera(preset, [...(model?.nodes ?? []), ...(dressingRef.current?.portNodes() ?? [])], aspect);
          // Perspective only: lock FOV before pin/refit. Ortho framing ignores FOV.
          if (!isOrthographicCamera(cam)) {
            if (pose?.fov) cam.fov = pose.fov;
            else {
              const fr = viewportFrameRef.current;
              cam.fov = fr?.fovDeg ?? 40;
            }
            cam.updateProjectionMatrix();
          }
          if (!pose && director) {
            director.pinToMode(preset === "a-topdown" ? "overview" : "play");
          } else if (pose) {
            director?.pinFree();
            cam.position.set(...pose.position);
            ctl.target.set(...pose.target);
          } else {
            cam.position.set(0, 9, 12);
            ctl.target.set(0, 0, 0);
            fitCameraRef.current();
          }
          ctl.update();
          // 抑制建造 / 换手 / 掷骰的自动 reframe，保证截图机位稳定。
          motion.noteUserDrag(Number.POSITIVE_INFINITY);
          markShadowsDirtyRef.current();
          return true;
        },
        ...judgeMotion,
      };
    });

    const rig = createLightingRig(scene, lightingRef.current, caps);
    rigRef.current = rig;
    const sky = createSkyDome();
    scene.add(sky);
    // R18 boot: the cream sky dome stays off until the sea is mounted (no cream flash behind the board).
    if (scene.background === bootSea) sky.visible = false;
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
    const reducedQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    // G3D-13: load Tidewell GLBs before hex reconcile (avoids remount that aborted water).
    const createOverlay = (kit: HexKit) => {
      if (disposed || overlayRef.current) return;
      const overlay = new kit.DiceOverlay();
      overlay.setCanvasSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
      overlayRef.current = overlay;
    };
    // Remount (perf remount / context-loss rebuild): the kit is already loaded and the hex effect of
    // this same commit still sees the previous `ready`, so the overlay must exist synchronously or
    // the dice would fall back into the world scene (and the first-frame memory would differ).
    if (!adapterRef.current && hexKit) createOverlay(hexKit);
    const kitReady = adapterRef.current
      ? Promise.resolve()
      : import("./hex-kit").then((kit) => {
          hexKit = kit;
          createOverlay(kit);
        });
    void Promise.allSettled([ensureTidewellGeometries(), kitReady]).then(() => {
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
      const aspect = width / height;
      if (isOrthographicCamera(camera)) {
        directorRef.current?.onResize(aspect);
        if (!directorRef.current) {
          // Before CameraDirector exists, keep settlecoast-ish CR frustum.
          const halfTop = Math.max(3.6, 5.65 / Math.max(aspect, 1e-3));
          const halfW = halfTop * aspect;
          camera.left = -halfW;
          camera.right = halfW;
          camera.top = halfTop;
          camera.bottom = -halfTop;
          camera.updateProjectionMatrix();
        }
      } else {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        directorRef.current?.onResize(aspect);
      }
      fitCameraRef.current();
      setCompactToolbar(width < 480);
      const overlay = overlayRef.current;
      if (overlay) {
        overlay.setCanvasSize(width, height);
        const r = overlay.viewport;
        container.dataset.diceOverlay = `${r.x},${r.y},${r.width},${r.height}`;
      }
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
      // R19: not under `?judge=1` (dev-only review captures) — SwiftShader's 10–45 fps band otherwise drops the
      // tier mid-capture and the coast / dice shots lose water + props. Production URLs are unaffected.
      if (!judgeEnabled && warmFrames > 180 && delta !== null) {
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
      dressingRef.current?.update(now, camera, freezeDressing);
      // Pooled pieces: tweens pose the handle; push the pose into the InstancedMesh.
      const livePools = (reconcileHostRef.current as { pools?: InstancePools } | null)?.pools;
      for (const object of motion.drainDirty()) {
        const inst = (object as Object3D).userData?.gdInstance as { poolKey: string; index: number } | undefined;
        if (inst && livePools) livePools.setMatrix(inst.poolKey, inst.index, object as Object3D);
      }
      // Robber idle bob (frozen in judge mode and under reduced motion).
      const robber = registryRef.current.get("robber");
      if (robber && !robber.userData.gdJudgeDemoLock && !motion.isAnimating(robber) && typeof robber.userData.baseY === "number") {
        const frozen = judgeEnabled || (reducedQuery?.matches ?? false);
        if (!frozen || robber.userData.bobbing) {
          const bob = idleBob(now, frozen);
          robber.position.y = robber.userData.baseY + bob.y;
          robber.rotation.z = bob.tilt;
          robber.userData.bobbing = !frozen;
          const inst = robber.userData.gdInstance as { poolKey: string; index: number } | undefined;
          if (inst && livePools) livePools.setMatrix(inst.poolKey, inst.index, robber);
        }
      }
      waterRef.current?.update(now);
      controls.update();
      directorRef.current?.update();
      // 阴影：内容 / 档位变化后 SHADOW_REFRESH_MS 内逐帧重绘，之后复用（方向光阴影与机位无关）。
      if (now < shadowDirtyUntil || shadowFrames < 2) {
        renderer.shadowMap.needsUpdate = true;
        shadowFrames += 1;
      }
      renderer.info.reset();
      // R19 boot: while veiled, render at ~4 fps so the hidden canvas can't queue seconds of GPU backlog.
      const veiled = container.dataset.boot === "pending";
      if (!veiled || now - bootLastRender >= BOOT_VEILED_FRAME_MS) {
        bootLastRender = now;
        renderer.render(scene, camera);
      }
      overlayRef.current?.render(renderer);
      const hasContent = contentRoot.children.length > 0;
      if (container.dataset.water === "on" && scene.background === bootSea) {
        scene.background = bootHorizon;
        renderer.setClearColor(bootHorizon, 1);
        sky.visible = true;
      }
      if (hasContent && renderer.info.render.calls > 0) {
        if (container.dataset.boot === "pending") {
          if (!bootFirstContentAt) bootFirstContentAt = now;
          const dressed = container.dataset.terrainProps !== undefined && container.dataset.water === "on";
          if (dressed) revealBoot("dressed");
          else if (now - bootFirstContentAt > BOOT_REVEAL_CAP_MS) revealBoot("cap");
        }
        markInteractive();
        if (shadowDirtyUntil === Number.POSITIVE_INFINITY) markShadowsDirty();
        // R19: PBR streams only after the boot reveal so it never competes with the sea KTX2.
        if (!pbrRequested && container.dataset.boot !== "pending") startPbrStreaming();
      }
      perf?.frame(renderer, now, hasContent && !dressingPendingRef.current);
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
      directorRef.current?.dispose();
      directorRef.current = null;
      setCameraApi(null);
      framingKeyRef.current = null;
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
        hexKit?.disposeHitOverlay(child);
      }
      overlayRef.current?.dispose();
      overlayRef.current = null;
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
      dressingRef.current?.dispose();
      dressingRef.current = null;
      numberLabelsRef.current = null;
      const hostPools = reconcileHostRef.current as { pools?: InstancePools } | null;
      hostPools?.pools?.dispose();
      disposeSharedSceneGeometries();
      hexKit?.disposeSharedHitResources();
      disposeTidewellGeometryCache();
      hexKit?.disposePieceGeometries();
      hexKit?.disposeDiceGeometries();
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
      sceneRef.current = null;
      markShadowsDirtyRef.current = () => {};
      motionRef.current = null;
      controlsRef.current = null;
      lastModeKeyRef.current = null;
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

  function syncNumberLabels(model: SceneModel, tiles: readonly { q: number; r: number; number: number | null }[]) {
    const root = contentRootRef.current;
    if (!root) return;
    const kit = hexKit;
    if (!kit) return;
    const layer = (numberLabelsRef.current ??= kit.createNumberLabelLayer());
    if (layer.mesh.parent !== root) root.add(layer.mesh);
    layer.sync(model.nodes);
    const container = containerRef.current;
    if (container) container.dataset.numberLabels = String(layer.labels().length);
    // e2e：贴花屏幕包围盒（像素探针用）。
    (globalThis as { __g3dNumberLabels?: () => unknown }).__g3dNumberLabels = () => {
      const camera = cameraRef.current;
      const canvas = canvasRef.current;
      if (!camera || !canvas) return [];
      return kit.projectLabels(numberLabelsRef.current?.labels() ?? [], camera, canvas.clientWidth, canvas.clientHeight);
    };
    // e2e：渲染输入的棋盘点数（与贴花逐格对照，独立于 mapper）。
    (globalThis as { __g3dBoardNumbers?: unknown }).__g3dBoardNumbers = tiles
      .filter((tile) => tile.number !== null)
      .map((tile) => ({ q: tile.q, r: tile.r, number: tile.number }));
  }

  function syncDressing() {
    const root = contentRootRef.current;
    if (!root || !hexSettlement) return;
    const mod = dressingModRef.current;
    if (!mod) {
      dressingPendingRef.current = true;
      if (!dressingLoadingRef.current) {
        dressingLoadingRef.current = true;
        void import("./hex-dressing").then((loaded) => {
          dressingModRef.current = loaded;
          dressingLoadingRef.current = false;
          setDressingReady((n) => n + 1);
        });
      }
      return;
    }
    const dressing = (dressingRef.current ??= mod.createHexDressing());
    if (dressing.group.parent !== root) root.add(dressing.group);
    const caps = TIER_CAPS[activeTier];
    dressing.sync(hexSettlement, activeTier, caps.tilesCastShadow);
    dressingPendingRef.current = false;
    const container = containerRef.current;
    const stats = dressing.stats();
    if (container) {
      container.dataset.terrainProps = String(stats.props.meshes);
      container.dataset.island = String(stats.island.meshes);
    }
    (globalThis as { __g3dDressing?: () => unknown }).__g3dDressing = () => dressingRef.current?.stats() ?? null;
    markShadowsDirtyRef.current();
  }

  // 档位变化（high ↔ medium 不重挂 host）时按新档位重建道具密度。
  useEffect(() => {
    if (ready) syncDressing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTier, ready, hostEpoch, dressingReady]);

  useEffect(() => {
    const host = reconcileHostRef.current;
    const kit = hexKit;
    if (!host || !hexSettlement || !kit) return;
    const prev = modelRef.current;
    const mapped = kit.mapHexSettlementToScene(hexSettlement);
    const next: SceneModel = { ...mapped, nodes: mapped.nodes.filter((n) => !REPLACED_NODE_KINDS.has(n.kind)) };
    const hadModel = prev !== null;
    const previousAction = lastActionRef.current;
    lastActionRef.current = hexSettlement.lastAction;
    diceAnimatedRef.current = false;
    modelRef.current = reconcileScene(host, prev, next, registryRef.current);
    syncNumberLabels(next, hexSettlement.tiles);
    // 阴影相机只在布局（地块集合）变化时按包围球重算一次（§4.3）。
    const tileKey = (model: SceneModel | null) =>
      model ? model.nodes.filter((node) => node.kind === "tile").map((node) => node.id).join("|") : "";
    const tilesChanged = tileKey(prev) !== tileKey(next);
    if (tilesChanged) {
      const bounds = islandBounds(next.nodes);
      rigRef.current?.fitToBounds(bounds.center, bounds.radius);
    }
    // G3D-JUDGE-PIECES: auto-framing (island + harbours; the dice tray is a screen overlay) for the hex scene.
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const motionForCamera = motionRef.current;
    if (camera && controls && motionForCamera) {
      let director = directorRef.current;
      if (!director) {
        if (!isOrthographicCamera(camera)) {
          // Perspective hex path (legacy): FOV lock 40° before first framing.
          const fr = viewportFrameRef.current;
          camera.fov = fr?.fovDeg ?? 40;
          camera.updateProjectionMatrix();
        }
        director = new kit.CameraDirector(camera, controls, motionForCamera);
        const el = containerRef.current;
        if (el) {
          const w = Math.max(el.clientWidth, 1);
          const h = Math.max(el.clientHeight, 1);
          director.onResize(w / h);
        }
        director.mode = kit.cameraModeFor(localSeatRef.current, activeSeatRef.current);
        directorRef.current = director;
        setCameraApi(director);
      }
      const framingKey = tileKey(next);
      if (framingKey !== framingKeyRef.current) {
        framingKeyRef.current = framingKey;
        const island = kit.islandCenter(next.nodes);
        const tiles = next.nodes.filter((node) => node.kind === "tile");
        director.setFraming(kit.framingPoints(next.nodes), island.center, island.radius, true, kit.framingPoints(tiles));
      }
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
              // Far-sea ring exposes `seaHalfExtent` so play framing can keep ≈54° tilt sky-free.
              // Use it when present.
              const seaHalf = (water as { seaHalfExtent?: number }).seaHalfExtent;
              if (typeof seaHalf === "number" && Number.isFinite(seaHalf) && seaHalf > 0) {
                directorRef.current?.setSeaExtent(seaHalf);
              }
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
        rollDie(motion, object, node);
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
        const fr = viewportFrameRef.current;
        if (fr) {
          const tiles = modelRef.current?.nodes.filter((n) => n.kind === "tile") ?? [];
          if (tiles.length > 0 && cameraRef.current && controlsRef.current) {
            const xs = tiles.map((t) => t.position[0]);
            const zs = tiles.map((t) => t.position[2]);
            const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
            const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 8);
            const cam = cameraRef.current;
            if (isOrthographicCamera(cam)) return;
            const pose = framePose([cx, 0, cz], span * 0.55, cam.aspect, fr);
            cam.position.set(...pose.position);
            cam.fov = pose.fov;
            cam.updateProjectionMatrix();
            controlsRef.current.target.set(...pose.target);
            controlsRef.current.update();
            return;
          }
        }

        // RenderSpec 距离按约 7.5 单位半径的场景标定；桌面更大 / 更小时等比缩放，
        // 窄屏（水平视角小于垂直视角）时再拉远到包围半径能水平放下。
        if (isOrthographicCamera(camera)) return;
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

  // G3D-09 / G3D-JUDGE-PIECES turn camera: local turn → tilted "play", others → top-down "overview".
  useEffect(() => {
    const director = directorRef.current;
    const kit = hexKit;
    if (!ready || !director || !kit) return;
    const mode = kit.cameraModeFor(localSeat, activeSeat);
    const key = `${activeSeat ?? "-"}|${localSeat ?? "-"}`;
    const previous = lastModeKeyRef.current;
    lastModeKeyRef.current = key;
    if (previous === null) {
      director.setMode(mode, `turn:${activeSeat ?? "-"}`, true);
      return;
    }
    if (previous === key) return;
    director.setMode(mode, `turn:${activeSeat ?? "-"}`);
  }, [activeSeat, localSeat, ready, hostEpoch, cameraApi]);

  useEffect(() => {
    onCameraApi?.(cameraApi);
  }, [cameraApi, onCameraApi]);

  const [cameraMode, setCameraMode] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!cameraApi) {
      setCameraMode(undefined);
      return;
    }
    return cameraApi.subscribe((state) => setCameraMode(state.mode));
  }, [cameraApi]);

  useEffect(() => {
    const rig = rigRef.current;
    const renderer = rendererRef.current;
    if (!rig || !renderer || !ready) return;
    const spec = lightingRef.current;
    rig.applyLighting(spec);
    configureRenderer(renderer, spec);
    markShadowsDirtyRef.current();
  }, [lightingSpec, ready, hostEpoch]);

  useEffect(() => {
    const hitRoot = hitRootRef.current;
    if (!hitRoot || !ready) return;
    const kit = hexKit;
    while (hitRoot.children.length > 0) {
      const child = hitRoot.children[0]!;
      hitRoot.remove(child);
      kit?.disposeHitOverlay(child);
    }
    if (!interactive || legalActions.length === 0 || adapterRef.current || !kit) return;
    for (const overlay of kit.buildLegalHitOverlays(legalActions)) {
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


  // Track B: re-fit when HUD passes a new viewportFrame (e.g. narrow ↔ desktop).
  useEffect(() => {
    if (!ready || !hexSettlement || !viewportFrame) return;
    fitCameraRef.current();
  }, [viewportFrame, ready, hostEpoch, hexSettlement]);

  return (
    <>
      <div
        aria-label={ariaLabel}
        className={className}
        data-testid="g3d-scene-host"
        data-tier={activeTier}
        data-pbr={pbrState}
        data-camera-mode={cameraMode}
        ref={containerRef}
        role="img"
        style={{ width: "100%", height: "100%", minHeight: 280, touchAction: "none", position: perfMode ? "relative" : undefined }}
      >
        {perfMode && <PerfOverlay />}
      </div>
      {/* Sibling of the role="img" host (children of an img are not exposed to assistive tech). */}
      {cameraToolbar && cameraApi && hexSettlement && (
        <Suspense fallback={null}>
          <CameraToolbar api={cameraApi} compact={compactToolbar} />
        </Suspense>
      )}
    </>
  );
}
