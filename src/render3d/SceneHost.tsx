import { useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  Scene,
  Shape,
  SphereGeometry,
  type Texture,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildLegalHitOverlays, disposeHitOverlay } from "./hit-targets";
import { mapHexSettlementToScene } from "./mappers/hex-settlement";
import {
  matchPickToLegalAction,
  pickFromPointerEvent,
  type PickableLegalAction,
} from "./pick";
import { reconcileScene } from "./reconcile";
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

function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
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

function createNodeObject(node: SceneNode, caps: TierCaps, library: MaterialLibrary): Object3D {
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

  if (node.kind === "tile") {
    const geom = new ExtrudeGeometry(hexShape(TILE_RADIUS), { depth: 0.28, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    return applyPose(new Mesh(geom, mat));
  }

  if (node.kind === "number-token") {
    return applyPose(new Mesh(new CylinderGeometry(0.22, 0.22, 0.06, 24), mat));
  }

  if (node.kind === "robber") {
    return applyPose(new Mesh(new CylinderGeometry(0.12, 0.18, 0.7, 12), mat));
  }

  if (node.kind === "settlement") {
    return applyPose(new Mesh(new BoxGeometry(0.28, 0.28, 0.28), mat));
  }

  if (node.kind === "city") {
    return applyPose(new Mesh(new BoxGeometry(0.36, 0.48, 0.36), mat));
  }

  if (node.kind === "road") {
    return applyPose(new Mesh(new BoxGeometry(1, 1, 1), mat));
  }

  if (node.kind === "port" || node.kind === "ship" || node.kind === "die" || node.kind === "dice-tray" || node.kind === "decor") {
    const finish = (mesh: Mesh) => {
      const posed = applyPose(mesh);
      if (node.kind === "die") posed.rotation.set(...dieFaceEuler(node.number));
      return posed;
    };
    const geom =
      node.kind === "ship"
        ? new BoxGeometry(0.5, 0.18, 0.22)
        : node.kind === "die"
          ? new BoxGeometry(0.22, 0.22, 0.22)
          : node.kind === "decor"
            ? new SphereGeometry(0.18, 10, 10)
            : new BoxGeometry(0.4, 0.12, 0.4);
    return finish(new Mesh(geom, mat));
  }

  // cliff default
  return applyPose(new Mesh(new CylinderGeometry(1, 1.05, 1, 6), mat));
}

function updateNodeObject(object: Object3D, node: SceneNode, library: MaterialLibrary): void {
  object.position.set(node.position[0], node.position[1], node.position[2]);
  if (node.rotationY !== undefined) object.rotation.y = node.rotationY;
  if (node.scale) object.scale.set(node.scale[0], node.scale[1], node.scale[2]);
  else if (node.kind === "settlement" || node.kind === "city" || node.kind === "robber") object.scale.set(1, 1, 1);
  if (node.kind === "die") object.rotation.set(...dieFaceEuler(node.number));
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
}: SceneHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [ready, setReady] = useState(false);
  const modelRef = useRef<SceneModel | null>(null);
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

  function reframe(focus: readonly [number, number, number], id: string) {
    const motion = motionRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (motion && camera && controls) motion.reframe(camera, controls, focus, id);
  }

  function buildHost(root: Object3D, getCaps: () => TierCaps, library: MaterialLibrary, motion: MotionController) {
    return {
      root,
      create: (node: SceneNode) => createNodeObject(node, getCaps(), library),
      update: (object: Object3D, node: SceneNode) => updateNodeObject(object, node, library),
      disposeObject,
      motion: {
        added: (object: Object3D, node: SceneNode) => {
          if (node.kind !== "settlement" && node.kind !== "city" && node.kind !== "road") return;
          motion.place(object, node.id);
          reframe(node.position, `build:${node.id}`);
        },
        removed: (object: Object3D, id: string, detach: () => void) => {
          motion.remove(object, id, detach);
        },
        updated: (object: Object3D, prev: SceneNode, node: SceneNode) => {
          if (node.kind === "robber" && prev.position.join() !== node.position.join()) {
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
    const hitRoot = new Scene();
    scene.add(hitRoot);
    hitRootRef.current = hitRoot;
    cameraRef.current = camera;
    canvasRef.current = renderer.domElement;
    setReady(true);

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
      const matched = matchPickToLegalAction(resolved, legalActionsRef.current);
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
    if (!hexSettlement) {
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
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const material = mesh.material;
          if (Array.isArray(material)) for (const entry of material) entry.dispose();
          else material?.dispose();
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
      setReady(false);
    };
    // hexSettlement applied in separate effect against stable host
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostEpoch]);

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
    // 阴影相机只在布局（地块集合）变化时按包围球重算一次（§4.3）。
    const tileKey = (model: SceneModel | null) =>
      model ? model.nodes.filter((node) => node.kind === "tile").map((node) => node.id).join("|") : "";
    const tilesChanged = tileKey(prev) !== tileKey(next);
    if (tilesChanged) {
      const bounds = islandBounds(next.nodes);
      rigRef.current?.fitToBounds(bounds.center, bounds.radius);
    }
    // G3D-08: first hex model mounts water; later tile-layout changes rebuild the coast field.
    if (!waterRef.current) {
      void import("./water").then(async ({ createWaterController }) => {
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
          });
          if (!waterAliveRef.current || !contentRootRef.current) {
            water.dispose();
            return;
          }
          waterRef.current = water;
          if (el) {
            el.dataset.water = "on";
            el.dataset.waterDistMs = String(Math.round(water.lastDistanceMs));
          }
        } catch (error) {
          console.warn("[godesk.water] mount failed", error);
        }
      });
    } else if (tilesChanged) {
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
    if (!interactive || legalActions.length === 0) return;
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
