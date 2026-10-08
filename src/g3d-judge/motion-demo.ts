/** G3D-JUDGE motion demo (lazy, `?judge=1` only) — kept out of render3d core budget. */
import { Mesh, MeshStandardMaterial, Vector3, type Material, type Object3D, type Scene, type WebGLRenderer } from "three";
import type { PlayCamera } from "../render3d/camera-rig";
import { isOrthographicCamera } from "../render3d/camera-rig";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { InstancePools } from "../render3d/instance-pools";
import type { MaterialLibrary } from "../render3d/materials";
import { prefersReducedMotion, type MotionController } from "../render3d/motion";
import type { MaterialToken } from "../render3d/tokens";

type Ref<T> = { current: T };
type Kit = { pieceGeometry: (kind: "robber" | "settlement" | "city" | "road", seat?: number) => import("three").BufferGeometry };

export type JudgeMotionCtx = {
  registryRef: Ref<Map<string, Object3D>>;
  contentRootRef: Ref<Object3D | null>;
  cameraRef: Ref<PlayCamera | null>;
  rendererRef: Ref<WebGLRenderer | null>;
  sceneRef: Ref<Scene | null>;
  controlsRef: Ref<OrbitControls | null>;
  directorRef: Ref<{ pinFree(): void } | null>;
  reconcileHostRef: Ref<unknown>;
  markShadowsDirtyRef: Ref<() => void>;
  motion: MotionController;
  library: MaterialLibrary;
  kit: () => Kit | null;
  vcMaterial: (library: MaterialLibrary, key: string, token: MaterialToken) => Material;
  figureToken: MaterialToken;
  pieceToken: MaterialToken;
};

export function createJudgeMotion(c: JudgeMotionCtx) {
  const { registryRef, contentRootRef, cameraRef, rendererRef, sceneRef, controlsRef, directorRef, reconcileHostRef, markShadowsDirtyRef, motion, library, vcMaterial } = c;
  const FIGURE_VC_TOKEN = c.figureToken;
  const PIECE_VC_TOKEN = c.pieceToken;
  void FIGURE_VC_TOKEN;
  return {
        debugRobber(): { x: number; y: number; z: number; busy: boolean; scale: number; demo?: boolean } | null {
          const demo = (globalThis as { __g3dJudgeDemoMesh?: Mesh }).__g3dJudgeDemoMesh;
          const robber = demo ?? registryRef.current.get("robber");
          if (!robber) return null;
          return {
            x: robber.position.x,
            y: robber.position.y,
            z: robber.position.z,
            busy: motion.isAnimating(robber),
            scale: robber.scale.x,
            demo: Boolean(demo),
          };
        },
        /** Judge motion helper. */
        lockCamera(): boolean {
          const ctl = controlsRef.current;
          const cam = cameraRef.current;
          const robber = registryRef.current.get("robber");
          if (!ctl || !cam) return false;
          ctl.enabled = false;
          directorRef.current?.pinFree();
          motion.noteUserDrag(Number.POSITIVE_INFINITY);
          motion.stopCamera();
          const tx = robber?.position.x ?? 0;
          const tz = robber?.position.z ?? 0;
          const targetY = 2.2;
          ctl.target.set(tx, targetY, tz);
          const dist = 7.8;
          const polar = (58 * Math.PI) / 180;
          const az = 0;
          cam.position.set(
            tx + Math.sin(az) * Math.sin(polar) * dist,
            targetY + Math.cos(polar) * dist,
            tz + Math.cos(az) * Math.sin(polar) * dist,
          );
          cam.near = 0.05;
          cam.far = 200;
          if (isOrthographicCamera(cam)) {
            // Close-up hop framing without perspective FOV.
            cam.left = -3.2;
            cam.right = 3.2;
            cam.top = 2.4;
            cam.bottom = -2.4;
            cam.zoom = 1;
          } else {
            cam.fov = 52;
          }
          cam.updateProjectionMatrix();
          ctl.update();
          return true;
        },
        /** Force a present WebGL frame then read pixels (headless-safe). */
        captureFrame(): {
          pose: { x: number; y: number; z: number; busy: boolean; scale: number; demo?: boolean; worldY?: number; visible?: boolean; parent?: string } | null;
          dataUrl: string | null;
        } {
          const renderer = rendererRef.current;
          const scene = sceneRef.current;
          const cam = cameraRef.current;
          const demo = (globalThis as { __g3dJudgeDemoMesh?: Mesh }).__g3dJudgeDemoMesh;
          const poseObj = demo ?? registryRef.current.get("robber");
          if (demo) demo.updateMatrixWorld(true);
          const worldY = demo ? demo.getWorldPosition(new Vector3()).y : undefined;
          const pose = poseObj
            ? {
                x: poseObj.position.x,
                y: poseObj.position.y,
                z: poseObj.position.z,
                busy: motion.isAnimating(poseObj),
                scale: poseObj.scale.x,
                demo: Boolean(demo),
                worldY,
                visible: demo?.visible,
                parent: demo?.parent?.type,
              }
            : null;
          if (!renderer || !scene || !cam) return { pose, dataUrl: null };
          renderer.render(scene, cam);
          return { pose, dataUrl: renderer.domElement.toDataURL("image/png") };
        },
        /** Judge motion helper. */
        playMotionDemo(): { hopMs: number; reduced: boolean; apexHeight: number } | false {
          const robber = registryRef.current.get("robber");
          const root = contentRootRef.current;
          const kit = c.kit();
          const cam = cameraRef.current;
          const canvas = rendererRef.current?.domElement;
          if (!robber || !root || !kit || !cam || !canvas) return false;
          const reduced = prefersReducedMotion();
          const upMs = 2200;
          const holdMs = 2800;
          const downMs = 2200;
          const apexHeight = 2.6;
          // R9 FYI fix: one demo = one stable +N line from lift-off through landing (no swap / no
          // auto-hide inside the apex hold). Consecutive demos alternate lines; a newer demo
          // supersedes an older one's pending timers so it cannot hide/replace the live toast.
          const g = (globalThis as { __g3dJudgeDemoMesh?: Mesh; __g3dJudgeDemoSettle?: Mesh; __g3dJudgeDemoGen?: number; __g3dJudgeDemoRest?: [number, number, number] });
          const gen = (g.__g3dJudgeDemoGen ?? 0) + 1;
          g.__g3dJudgeDemoGen = gen;
          const isCurrent = () => g.__g3dJudgeDemoGen === gen;
          const gain = gen % 2 === 1
            ? { text: "+2 木  +1 麦  +1 羊", detail: { wood: 2, wheat: 1, sheep: 1 } }
            : { text: "+2 砖  +1 矿", detail: { brick: 2, ore: 1 } };
          // If a previous demo still holds the robber hidden, reuse its true rest pose.
          const from: [number, number, number] = robber.userData.gdJudgeDemoLock && g.__g3dJudgeDemoRest
            ? [...g.__g3dJudgeDemoRest]
            : [robber.position.x, robber.position.y, robber.position.z];
          g.__g3dJudgeDemoRest = [...from];
          const hover: [number, number, number] = [from[0] + 0.55, from[1] + apexHeight, from[2] - 0.35];

          robber.userData.gdJudgeDemoLock = true;
          robber.position.set(from[0], -9999, from[2]);
          robber.scale.setScalar(0);
          robber.updateMatrix();
          const inst = robber.userData.gdInstance as { poolKey: string; index: number } | undefined;
          const pools = (reconcileHostRef.current as { pools?: InstancePools } | null)?.pools;
          if (inst && pools) pools.setMatrix(inst.poolKey, inst.index, robber);

          g.__g3dJudgeDemoMesh?.removeFromParent();
          g.__g3dJudgeDemoSettle?.removeFromParent();
          document.querySelectorAll(".g3d-judge-hop-ghost").forEach((el) => el.remove());

          const outer = (root.parent as Object3D | null) ?? sceneRef.current ?? root;
          const robGeom = kit.pieceGeometry("robber").clone();
          const robMat = new MeshStandardMaterial({
            roughness: 0.72,
            metalness: 0,
            vertexColors: true,
          });
          const demo = new Mesh(robGeom, robMat);
          demo.position.set(...from);
          demo.scale.setScalar(2.2);
          demo.castShadow = true;
          demo.receiveShadow = true;
          demo.frustumCulled = false;
          demo.matrixAutoUpdate = true;
          demo.visible = true;
          demo.layers.enableAll();
          demo.name = "g3d-judge-demo-robber";
          demo.userData.gdSharedGeometry = false;
          demo.renderOrder = 999;
          outer.add(demo);
          demo.updateMatrix();
          demo.updateMatrixWorld(true);
          g.__g3dJudgeDemoMesh = demo;

          const settleGeom = kit.pieceGeometry("settlement", 0).clone();
          const settleMat = vcMaterial(library, "piece-vc", PIECE_VC_TOKEN).clone();
          const settle = new Mesh(settleGeom, settleMat);
          settle.position.set(from[0] - 1.15, from[1], from[2] + 0.9);
          settle.scale.setScalar(1.85);
          settle.castShadow = true;
          settle.frustumCulled = false;
          settle.name = "g3d-judge-demo-settle";
          settle.userData.gdSharedGeometry = false;
          settle.visible = false;
          ((root.parent as Object3D | null) ?? sceneRef.current ?? root).add(settle);
          g.__g3dJudgeDemoSettle = settle;

          const host = document.body;
          let toast = host.querySelector(".g3d-judge-plusn-toast") as HTMLDivElement | null;
          if (!toast) {
            toast = document.createElement("div");
            toast.className = "g3d-judge-plusn-toast";
            toast.setAttribute("data-testid", "g3d-judge-plusn-toast");
            host.appendChild(toast);
          }
          let trackRaf = 0;
          const projectToast = () => {
            if (!demo.parent || !toast) {
              trackRaf = requestAnimationFrame(projectToast);
              return;
            }
            demo.updateMatrixWorld(true);
            const v = demo.position.clone();
            v.y += 1.2;
            v.project(cam);
            const rect = canvas.getBoundingClientRect();
            const x = (v.x * 0.5 + 0.5) * rect.width + rect.left;
            const y = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
            toast.style.transform = `translate(${x}px, ${y}px) translate(-50%, -130%)`;
            trackRaf = requestAnimationFrame(projectToast);
          };
          const showToast = (text: string) => {
            toast!.textContent = text;
            toast!.setAttribute("data-visible", "1");
            toast!.setAttribute("data-demo-gen", String(gen));
          };
          const hideToast = () => {
            if (isCurrent()) toast?.setAttribute("data-visible", "0");
          };
          trackRaf = requestAnimationFrame(projectToast);

          const ctl = controlsRef.current;
          if (ctl) ctl.enabled = false;
          directorRef.current?.pinFree();
          motion.noteUserDrag(Number.POSITIVE_INFINITY);

          demo.position.set(...hover);
          const msUp = motion.hop(demo, "judge-demo-robber", from, {
            ms: upMs,
            ignoreReducedMotion: true,
            apexHeight: 0.9,
            hops: 1,
          });
          markShadowsDirtyRef.current();
          showToast(gain.text);
          // R18 ghost-toast fix: the floating pill above the robber is the ONLY +N for the demo.
          // (R7–R17 also dispatched `g3d-judge-resource-gain` → HUD resourceGain card pops, so the same
          // +N floated up a second time ~1–3 s later at the dock — audited in round-18 motion json.)

          const cleanupDemo = () => {
            cancelAnimationFrame(trackRaf);
            hideToast();
            demo.removeFromParent();
            settle.removeFromParent();
            if (!demo.userData.gdSharedGeometry) {
              demo.geometry.dispose();
              const m = demo.material;
              if (!Array.isArray(m)) m.dispose();
            }
            if (!settle.userData.gdSharedGeometry) {
              settle.geometry.dispose();
              const m = settle.material;
              if (!Array.isArray(m)) m.dispose();
            }
            if (g.__g3dJudgeDemoMesh === demo) delete g.__g3dJudgeDemoMesh;
            if (g.__g3dJudgeDemoSettle === settle) delete g.__g3dJudgeDemoSettle;
            if (!isCurrent()) {
              markShadowsDirtyRef.current();
              return; // a newer demo owns the robber + toast now
            }
            delete robber.userData.gdJudgeDemoLock;
            delete g.__g3dJudgeDemoRest;
            robber.position.set(...from);
            robber.scale.setScalar(1);
            robber.userData.baseY = from[1];
            robber.updateMatrix();
            if (inst && pools) pools.setMatrix(inst.poolKey, inst.index, robber);
            markShadowsDirtyRef.current();
          };

          window.setTimeout(() => {
            if (!isCurrent()) return;
            const cur: [number, number, number] = [demo.position.x, demo.position.y, demo.position.z];
            demo.position.set(...from);
            const msDown = motion.hop(demo, "judge-demo-robber", cur, {
              ms: downMs,
              ignoreReducedMotion: true,
              apexHeight: 0.85,
              hops: 1,
            });
            markShadowsDirtyRef.current();
            // Same +N line stays up through the descent; drop it once the robber has landed.
            window.setTimeout(hideToast, msDown + 250);
            // R14：取消落地红屋 place/hop scale 闪（demo settle 保持不可见，仅 robber +N）。
            settle.visible = false;
            window.setTimeout(cleanupDemo, msDown + 500);

            // Keep hopMs as full up+hold+down for capture waits.
          }, msUp + holdMs);

          return { hopMs: upMs + holdMs + downMs, reduced, apexHeight };
        }
  };
}
