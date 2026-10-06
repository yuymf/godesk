import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Scene,
  Shape,
  SphereGeometry,
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
  /** G3D-09: active seat; a change triggers the turn camera reframe. */
  activeSeat?: number | null;
};

const TERRAIN_HEX: Record<string, number> = {
  wood: 0x2f6b3a,
  brick: 0xb85a3a,
  sheep: 0x8fbf6a,
  wheat: 0xd4b84a,
  ore: 0x6a6f78,
  desert: 0xc9b896,
};

const SEAT_HEX = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12] as const;

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
    if (Array.isArray(material)) {
      for (const entry of material) entry.dispose();
    } else {
      material?.dispose();
    }
  });
}

function createNodeObject(node: SceneNode, caps: TierCaps): Object3D {
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
    const geom = new ExtrudeGeometry(hexShape(0.95), { depth: 0.28, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    const mat = new MeshStandardMaterial({
      color: TERRAIN_HEX[node.tag ?? "desert"] ?? 0x888888,
      roughness: 0.85,
      metalness: 0.05,
    });
    return applyPose(new Mesh(geom, mat));
  }

  if (node.kind === "number-token") {
    const geom = new CylinderGeometry(0.22, 0.22, 0.06, 24);
    const mat = new MeshStandardMaterial({
      color: node.tag === "hot" ? 0xc0392b : 0xf5f0e1,
      roughness: 0.7,
    });
    return applyPose(new Mesh(geom, mat));
  }

  if (node.kind === "robber") {
    const geom = new CylinderGeometry(0.12, 0.18, 0.7, 12);
    const mat = new MeshStandardMaterial({ color: 0x2c3e50, emissive: 0x1a4a6a, emissiveIntensity: 0.35 });
    return applyPose(new Mesh(geom, mat));
  }

  if (node.kind === "settlement") {
    const geom = new BoxGeometry(0.28, 0.28, 0.28);
    const mat = new MeshStandardMaterial({
      color: SEAT_HEX[node.seat ?? 0] ?? 0xffffff,
      roughness: 0.55,
    });
    return applyPose(new Mesh(geom, mat));
  }

  if (node.kind === "city") {
    const geom = new BoxGeometry(0.36, 0.48, 0.36);
    const mat = new MeshStandardMaterial({
      color: SEAT_HEX[node.seat ?? 0] ?? 0xffffff,
      roughness: 0.5,
    });
    return applyPose(new Mesh(geom, mat));
  }

  if (node.kind === "road") {
    const geom = new BoxGeometry(1, 1, 1);
    const mat = new MeshStandardMaterial({
      color: SEAT_HEX[node.seat ?? 0] ?? 0xffffff,
      roughness: 0.75,
    });
    return applyPose(new Mesh(geom, mat));
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
    const mat = new MeshStandardMaterial({
      color:
        node.kind === "decor"
          ? TERRAIN_HEX[node.tag ?? "wood"] ?? 0x666666
          : node.kind === "die"
            ? 0xf8f8f8
            : 0x8b6914,
      roughness: 0.7,
    });
    return finish(new Mesh(geom, mat));
  }

  // cliff default
  const geom = new CylinderGeometry(1, 1.05, 1, 6);
  const mat = new MeshStandardMaterial({ color: 0x7a7368, roughness: 0.95 });
  return applyPose(new Mesh(geom, mat));
}

function updateNodeObject(object: Object3D, node: SceneNode): void {
  object.position.set(node.position[0], node.position[1], node.position[2]);
  if (node.rotationY !== undefined) object.rotation.y = node.rotationY;
  if (node.scale) object.scale.set(node.scale[0], node.scale[1], node.scale[2]);
  else if (node.kind === "settlement" || node.kind === "city" || node.kind === "robber") object.scale.set(1, 1, 1);
  if (node.kind === "die") object.rotation.set(...dieFaceEuler(node.number));
  const mesh = object as Mesh;
  if (mesh.isMesh && mesh.material && "color" in mesh.material) {
    const material = mesh.material as MeshStandardMaterial;
    if (node.kind === "tile" && node.tag) {
      material.color.setHex(TERRAIN_HEX[node.tag] ?? 0x888888);
    }
    if ((node.kind === "settlement" || node.kind === "city" || node.kind === "road") && node.seat !== undefined) {
      material.color.setHex(SEAT_HEX[node.seat] ?? 0xffffff);
    }
  }
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

  function reframe(focus: readonly [number, number, number], id: string) {
    const motion = motionRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (motion && camera && controls) motion.reframe(camera, controls, focus, id);
  }

  function buildHost(root: Object3D, caps: TierCaps, motion: MotionController) {
    return {
      root,
      create: (node: SceneNode) => createNodeObject(node, caps),
      update: updateNodeObject,
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
    scene.background = new Color(0x87b5d4);

    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 9, 12);

    const env = detectEnvFromBrowser();
    let resolution = resolveTier({ env, runtimeFloor: runtimeFloorRef.current });
    let caps = resolution.caps;
    setActiveTier(caps.id);
    console.info(tierLogLine(resolution, "mount"));

    const renderer = new WebGLRenderer({ antialias: caps.antialias, alpha: false });
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0x87b5d4, 1);
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

    const ambient = new AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const sun = new DirectionalLight(0xfff2d6, 1.35);
    sun.position.set(6, 12, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(caps.shadowMapSize, caps.shadowMapSize);
    sun.shadow.radius = caps.shadowRadius;
    scene.add(sun);

    const contentRoot = new Scene();
    scene.add(contentRoot);
    contentRootRef.current = contentRoot;
    reconcileHostRef.current = buildHost(contentRoot, caps, motion);
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
    });

    // Fallback test cube when no hex state yet (G3D-02 smoke path).
    if (!hexSettlement) {
      const geom = new BoxGeometry(1, 1, 1);
      const mat = new MeshStandardMaterial({ color: 0xc56b3a });
      const cube = new Mesh(geom, mat);
      cube.position.set(0, 0.5, 0);
      cube.castShadow = true;
      contentRoot.add(cube);
      const groundGeom = new BoxGeometry(12, 0.05, 12);
      const groundMat = new MeshStandardMaterial({ color: 0xd7e6c8 });
      const ground = new Mesh(groundGeom, groundMat);
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
      sun.shadow.mapSize.set(next.shadowMapSize, next.shadowMapSize);
      sun.shadow.radius = next.shadowRadius;
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
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
      controls.update();
      renderer.render(scene, camera);
      const hasContent = contentRoot.children.length > 0;
      if (hasContent && renderer.info.render.calls > 0) markInteractive();
      perf?.frame(renderer, now, hasContent);
    };
    frameId = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onWindowResize);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      observer?.disconnect();
      // Fading objects detach + dispose via their completion callbacks.
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
      sun.shadow.dispose();
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
    const next = mapHexSettlementToScene(hexSettlement);
    const hadModel = modelRef.current !== null;
    const previousAction = lastActionRef.current;
    lastActionRef.current = hexSettlement.lastAction;
    diceAnimatedRef.current = false;
    modelRef.current = reconcileScene(host, modelRef.current, next, registryRef.current);
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
      ref={containerRef}
      role="img"
      style={{ width: "100%", height: "100%", minHeight: 280, touchAction: "none", position: perfMode ? "relative" : undefined }}
    >
      {perfMode && <PerfOverlay />}
    </div>
  );
}
