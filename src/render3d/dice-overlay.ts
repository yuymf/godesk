/**
 * G3D-JUDGE-PIECES · dice tray as a fixed screen-corner element.
 *
 * The tray and dice live in their own tiny scene, drawn after the main scene
 * into a scissored corner viewport with an orthographic camera: always the same
 * size and place (bottom-right; on portrait canvases bottom-right above the
 * HUD hand), independent of board zoom / rotation, and never part of the
 * world framing. No DOM: the HUD layout (Track B) is untouched.
 *
 * Reconcile still owns the dice nodes: SceneHost creates an invisible handle
 * per node in the world tree (motion tweens pose it) and this overlay mirrors
 * each handle's pose onto the real mesh every frame.
 */
import {
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  Vector4,
  type Object3D,
  type WebGLRenderer,
} from "three";
import { TRAY } from "./dice";

export type OverlayRect = { x: number; y: number; width: number; height: number };

/** Viewport aspect of the tray inset (width / height). */
export const DICE_OVERLAY_ASPECT = 1.5;

/**
 * Corner inset in CSS px, origin bottom-left (WebGL viewport convention).
 * Landscape: ~22% of the canvas width, bottom-right. Portrait (phones): ~36%,
 * bottom-right — the bottom edge of the canvas is right above the hand / HUD.
 */
export function diceOverlayRect(canvasWidth: number, canvasHeight: number): OverlayRect {
  const portrait = canvasWidth / Math.max(canvasHeight, 1) < 1.15;
  const share = portrait ? 0.36 : 0.22;
  const margin = portrait ? 8 : 12;
  let width = Math.round(Math.min(Math.max(canvasWidth * share, 120), 300));
  width = Math.min(width, Math.max(canvasWidth - margin * 2, 1));
  let height = Math.round(width / DICE_OVERLAY_ASPECT);
  if (height > canvasHeight * 0.45) {
    height = Math.max(1, Math.round(canvasHeight * 0.45));
    width = Math.round(height * DICE_OVERLAY_ASPECT);
  }
  return { x: Math.max(0, canvasWidth - width - margin), y: margin, width, height };
}

/** Soft elliptical drop shadow (vertex-alpha fan), 1 extra draw call. */
function shadowGeometry(rx: number, rz: number, segments = 28): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const ring = (k: number, alpha: number, i: number) => {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * rx * k, 0, Math.sin(a) * rz * k);
    colors.push(0, 0, 0, alpha);
  };
  for (let i = 0; i < segments; i += 1) {
    // inner fan (centre → inner ring) + outer feather (inner ring → outer ring)
    positions.push(0, 0, 0);
    colors.push(0, 0, 0, 0.42);
    ring(0.78, 0.36, i + 1);
    ring(0.78, 0.36, i);
    for (const [k1, a1, k2, a2] of [[0.78, 0.36, 1, 0]] as const) {
      ring(k1, a1, i);
      ring(k1, a1, i + 1);
      ring(k2, a2, i + 1);
      ring(k1, a1, i);
      ring(k2, a2, i + 1);
      ring(k2, a2, i);
    }
  }
  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new Float32BufferAttribute(colors, 4));
  return geom;
}

export class DiceOverlay {
  readonly scene = new Scene();
  readonly camera: OrthographicCamera;
  private readonly proxies = new Map<Object3D, Mesh>();
  private readonly shadow: Mesh;
  private rect: OverlayRect = { x: 0, y: 0, width: 1, height: 1 };
  private readonly prevViewport = new Vector4();
  private readonly prevScissor = new Vector4();

  constructor() {
    const halfW = TRAY.width / 2 + 0.22;
    const halfH = halfW / DICE_OVERLAY_ASPECT;
    this.camera = new OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 20);
    // Fixed three-quarter view from the front, slightly above: reads as a physical tray.
    const polar = (36 * Math.PI) / 180;
    this.camera.position.set(0, Math.cos(polar) * 6, Math.sin(polar) * 6);
    this.camera.lookAt(0, 0.12, 0);
    this.camera.updateProjectionMatrix();
    const hemi = new HemisphereLight(0xfff3dc, 0x3b2a1c, 1.35);
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(-2.5, 5, 3);
    this.scene.add(hemi, key);
    const material = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide });
    this.shadow = new Mesh(shadowGeometry(TRAY.width * 0.62, TRAY.depth * 0.7), material);
    this.shadow.position.set(0.06, -0.06, 0.05);
    this.shadow.renderOrder = -1;
    this.shadow.visible = false;
    this.scene.add(this.shadow);
  }

  /** Mirror `handle` (world-tree proxy owned by reconcile) onto `mesh` in the overlay. */
  attach(handle: Object3D, mesh: Mesh): void {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    this.proxies.set(handle, mesh);
    this.scene.add(mesh);
    this.shadow.visible = true;
    this.syncOne(handle, mesh);
  }

  detach(handle: Object3D): boolean {
    const mesh = this.proxies.get(handle);
    if (!mesh) return false;
    this.scene.remove(mesh);
    this.proxies.delete(handle);
    this.shadow.visible = this.proxies.size > 0;
    return true;
  }

  get size(): number {
    return this.proxies.size;
  }

  setCanvasSize(width: number, height: number): void {
    this.rect = diceOverlayRect(width, height);
  }

  /** Current inset in CSS px (origin bottom-left). */
  get viewport(): OverlayRect {
    return this.rect;
  }

  private syncOne(handle: Object3D, mesh: Mesh): void {
    mesh.position.copy(handle.position);
    mesh.quaternion.copy(handle.quaternion);
    mesh.scale.copy(handle.scale);
  }

  render(renderer: WebGLRenderer): void {
    if (this.proxies.size === 0) return;
    for (const [handle, mesh] of this.proxies) this.syncOne(handle, mesh);
    const { x, y, width, height } = this.rect;
    renderer.getViewport(this.prevViewport);
    renderer.getScissor(this.prevScissor);
    const scissorTest = renderer.getScissorTest();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setViewport(x, y, width, height);
    renderer.setScissor(x, y, width, height);
    renderer.setScissorTest(true);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.setViewport(this.prevViewport);
    renderer.setScissor(this.prevScissor);
    renderer.setScissorTest(scissorTest);
    renderer.autoClear = autoClear;
  }

  dispose(): void {
    for (const mesh of this.proxies.values()) this.scene.remove(mesh);
    this.proxies.clear();
    this.shadow.geometry.dispose();
    (this.shadow.material as MeshBasicMaterial).dispose();
  }
}
