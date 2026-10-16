/**
 * Tide Arena / 潮阵 — dedicated three.js tabletop (lazy chunk).
 * Wooden table, 7×4 bevelled board split by a tide line (own teal / enemy coral),
 * recessed 5-well bench, instanced low-poly tokens, pointer drag with legal-cell
 * highlights. Renders on demand; draw calls stay ~20.
 */
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  IcosahedronGeometry,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  Raycaster,
  RepeatWrapping,
  Scene,
  Shape,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { BENCH_SLOTS, BOARD_SLOTS, UNIT_CATALOG, type Piece } from "../../runtime/adapters/auto-battler";

import { unitAppearance } from "./appearance";
import type { TierCaps } from "../tiers";
import {
  ARENA_COLS,
  ARENA_ROWS,
  BENCH_TOP,
  BENCH_Z,
  BOARD_Z,
  CELL,
  FRAME_D,
  FRAME_W,
  TILE_TOP,
  arenaWorld,
  benchWorld,
  boardWorld,
  dragAction,
  legalDrops,
  sameSlot,
  slotAt,
  type SlotRef,
} from "./layout";
import { ENEMY_RING, OWN_RING, TOKEN_HEIGHT, ringGeometry, unitGeometry } from "./tokens";
import { DEFAULT_THEME_ID, THEME_PRESETS, type ThemeSpec } from "../../runtime/adapters/auto-battler-theme";
import { UnitModelPool, type UnitModelSource } from "./unit-models";
import { DEATH_FADE_MS, HIT_DELAY_MS, type Timeline } from "./timeline";

export type ArenaView = {
  ownBoard: Array<Piece | null>;
  ownBench: Array<Piece | null>;
  enemyBoard: Array<Piece | null>;
  /** Combat still: uid → final hp (0 = down, hidden). */
  hp?: Map<string, number>;
  dragEnabled: boolean;
  /** When true, bench→board place highlights are suppressed (level cap). */
  boardFull?: boolean;
};

export type TokenAnchor = {
  uid: string;
  unitId: string;
  own: boolean;
  backRow: boolean;
  onBench: boolean;
  stars: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
};

export type SceneCallbacks = {
  onAction: (type: string, payload: Record<string, unknown>) => void;
  onDrag: (state: { dragging: boolean; overSell: boolean }) => void;
  onAnchors: (anchors: TokenAnchor[]) => void;
  /** Screen anchors for the 「潮线」/「备战席」 labels (on resize). */
  onLabels?: (labels: { tide: { x: number; y: number }; bench: { x: number; y: number } }) => void;
  /** Replay clock crossed an event boundary (ms on the presentational timeline). */
  onReplayTime?: (ms: number, done: boolean) => void;
};

type TokenSlot = {
  uid: string;
  mesh: InstancedMesh;
  index: number;
  ring: number;
  x: number;
  y: number;
  z: number;
  /** Live pose (includes lunge / death sink) for HUD anchors. */
  cx: number;
  cy: number;
  cz: number;
  rotY: number;
  dead: boolean;
  own: boolean;
  backRow: boolean;
  onBench: boolean;
  unitId: string;
  stars: number;
  hp: number;
  maxHp: number;
  /** When set, a GLB clone from UnitModelPool is shown instead of the procedural instance. */
  modelRef?: string;
  usesModel?: boolean;
};

const PROJECTILES = 12;
const FLASH_MS = 180;

const MAX_PER_TYPE = BOARD_SLOTS * 2 + BENCH_SLOTS;
const MAX_TOKENS = MAX_PER_TYPE;
const LIFT = 0.45;

/** Light tan planks with soft grain (reference tabletop); used untinted so it stays light. */
function woodTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  if (!g) return null;
  const planks = ["#D2AE80", "#CBA576", "#D6B488", "#C9A272"];
  for (let i = 0; i < 8; i += 1) {
    g.fillStyle = planks[i % planks.length]!;
    g.fillRect(i * 64, 0, 64, 512);
  }
  for (let i = 0; i < 120; i += 1) {
    const x = (i * 53) % 512;
    g.strokeStyle = `rgba(${i % 3 ? "120,82,48" : "236,206,160"},${0.06 + ((i * 7) % 8) / 100})`;
    g.lineWidth = 1 + (i % 2);
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) g.lineTo(x + Math.sin((y + i * 23) / 60) * 2.5, y);
    g.stroke();
  }
  g.fillStyle = "rgba(90,60,36,0.35)";
  for (let i = 0; i <= 8; i += 1) g.fillRect(i * 64 - 1, 0, 2, 512);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function tileGeometry(): ExtrudeGeometry {
  const s = CELL * 0.86;
  const r = 0.1;
  const h = s / 2;
  const shape = new Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  const geo = new ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 3,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, TILE_TOP - 0.12, 0);
  return geo;
}

export class TideArenaScene {
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(33, 1, 0.1, 80);
  private readonly sun: DirectionalLight;
  private readonly units = new Map<string, InstancedMesh>();
  private readonly rings: InstancedMesh;
  private readonly highlights: InstancedMesh;
  private readonly raycaster = new Raycaster();
  private readonly boardPlane = new Plane(new Vector3(0, 1, 0), -TILE_TOP);
  private readonly benchPlane = new Plane(new Vector3(0, 1, 0), -BENCH_TOP);
  private readonly tmp = new Object3D();
  private view: ArenaView = { ownBoard: [], ownBench: [], enemyBoard: [], dragEnabled: false, boardFull: false };
  private drag: { from: SlotRef; uid: string; point: Vector3 | null; over: SlotRef | null; sell: boolean; pointerId: number } | null = null;
  private frame = 0;
  private width = 1;
  private height = 1;
  private mobile = false;
  private disposed = false;
  private slots: TokenSlot[] = [];
  private slotByUid = new Map<string, TokenSlot>();
  private projectiles!: InstancedMesh;
  private fxAoe!: InstancedMesh;
  private fxHeal!: InstancedMesh;
  private fxShield!: InstancedMesh;
  private fxHit!: InstancedMesh;
  private shakeUntil = 0;
  private baseCamPos = new Vector3();
  private replay: { tl: Timeline; ms: number; speed: number; last: number; fired: number; raf: number } | null = null;
  private readonly v1 = new Vector3();
  private readonly v2 = new Vector3();
  private readonly cWhite = new Color("#ffffff");
  private readonly cOwn = new Color(OWN_RING);
  private readonly cEnemy = new Color(ENEMY_RING);
  frameSamples: number[] = [];
  peakCalls = 0;
  peakTriangles = 0;

  private modelPool: UnitModelPool | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly caps: TierCaps,
    private readonly cb: SceneCallbacks,
    private readonly theme: ThemeSpec = THEME_PRESETS[DEFAULT_THEME_ID]!,
    importedModels: readonly UnitModelSource[] = [],
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: caps.antialias, powerPreference: "high-performance" });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = caps.shadowMapSize > 0;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.info.autoReset = true;

    const t = this.theme;
    this.renderer.toneMappingExposure = t.light.exposure;
    this.scene.background = new Color(t.background);
    this.scene.fog = new Fog(t.background, t.fogNear, t.fogFar);
    this.scene.add(new HemisphereLight(t.light.sky, t.light.ground, t.light.hemi));
    this.sun = new DirectionalLight(t.light.sun, t.light.sunIntensity);
    this.sun.position.set(-6, 12, 7);
    this.sun.castShadow = this.renderer.shadowMap.enabled;
    this.sun.shadow.mapSize.set(caps.shadowMapSize, caps.shadowMapSize);
    this.sun.shadow.radius = caps.shadowRadius;
    this.sun.shadow.bias = -0.0008;
    const sc = this.sun.shadow.camera;
    sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 2; sc.far = 30;
    this.sun.target.position.set(0, 0, 0.6);
    this.scene.add(this.sun, this.sun.target);

    this.buildTable();
    const unitMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.05 });
    this.unitMat = unitMat;
    for (const def of UNIT_CATALOG) {
      const mesh = new InstancedMesh(unitGeometry(def.id, def.cost), unitMat, MAX_PER_TYPE);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.units.set(def.id, mesh);
      this.scene.add(mesh);
    }
    this.rings = new InstancedMesh(ringGeometry(), new MeshStandardMaterial({ roughness: 0.4 }), MAX_TOKENS);
    this.rings.count = 0;
    this.rings.frustumCulled = false;
    this.scene.add(this.rings);
    this.highlights = new InstancedMesh(
      new CylinderGeometry(CELL * 0.4, CELL * 0.4, 0.02, 24),
      new MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }),
      BOARD_SLOTS + BENCH_SLOTS,
    );
    this.highlights.count = 0;
    this.highlights.frustumCulled = false;
    this.highlights.renderOrder = 2;
    this.scene.add(this.highlights);
    this.projectiles = new InstancedMesh(
      new IcosahedronGeometry(0.11, 0),
      new MeshStandardMaterial({ color: "#FFE9A8", emissive: "#FFC94A", emissiveIntensity: 1.2 }),
      PROJECTILES,
    );
    this.projectiles.count = 0;
    this.projectiles.frustumCulled = false;
    this.scene.add(this.projectiles);
    const mkFx = (geo: ConstructorParameters<typeof InstancedMesh>[0], color: number, n: number) => {
      const mesh = new InstancedMesh(geo, new MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }), n);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return mesh;
    };
    this.fxAoe = mkFx(new CylinderGeometry(0.15, 1.1, 0.08, 24), 0xff8844, 8);
    this.fxHeal = mkFx(new IcosahedronGeometry(0.28, 0), 0x55ff99, 12);
    this.fxShield = mkFx(new IcosahedronGeometry(0.55, 1), 0x66ccff, 12);
    this.fxHit = mkFx(new IcosahedronGeometry(0.12, 0), 0xffee66, 24);
    if (importedModels.length) this.modelPool = new UnitModelPool(this.scene, importedModels);

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onCancel);
  }

  private buildTable() {
    const th = this.theme.table;
    // Table material preset: wood grain (tinted), matte stone, glossy frost or soft felt.
    const wood = th.material === "wood" ? woodTexture() : null;
    if (wood) wood.repeat.set(3, 2);
    const surface = { wood: { roughness: 0.85, metalness: 0 }, stone: { roughness: 0.95, metalness: 0 }, frost: { roughness: 0.28, metalness: 0.08 }, felt: { roughness: 1, metalness: 0 } }[th.material];
    const table = new Mesh(new BoxGeometry(40, 1, 30), new MeshStandardMaterial({ color: wood && th.base === "#B98B5E" ? "#ffffff" : th.base, map: wood, ...surface }));
    table.position.y = -0.5;
    table.receiveShadow = true;
    // Rim and bench tray share one dark-brown wood (SPEC wood-700).
    const frameMat = new MeshStandardMaterial({ color: th.rim, map: wood, roughness: th.material === "frost" ? 0.35 : 0.75, metalness: th.material === "frost" ? 0.1 : 0 });
    const frame = new Mesh(new BoxGeometry(FRAME_W, 0.4, FRAME_D), frameMat);
    frame.position.set(0, 0.2, BOARD_Z);
    frame.castShadow = frame.receiveShadow = true;
    const tray = new Mesh(new BoxGeometry(BENCH_SLOTS * CELL + 0.5, 0.26, CELL + 0.4), frameMat);
    tray.position.set(0, 0.13, BENCH_Z);
    tray.castShadow = tray.receiveShadow = true;
    this.scene.add(table, frame, tray);

    const geo = tileGeometry();
    const half = (ARENA_ROWS / 2) * ARENA_COLS;
    const own = new InstancedMesh(geo, new MeshStandardMaterial({ color: this.theme.tiles.own, roughness: 0.6 }), half);
    const enemy = new InstancedMesh(geo, new MeshStandardMaterial({ color: this.theme.tiles.enemy, roughness: 0.6 }), half);
    let o = 0;
    let e = 0;
    for (let row = 0; row < ARENA_ROWS; row += 1) {
      for (let col = 0; col < ARENA_COLS; col += 1) {
        const p = arenaWorld(col, row);
        this.tmp.position.set(p.x, 0, p.z);
        this.tmp.updateMatrix();
        if (row >= ARENA_ROWS / 2) own.setMatrixAt(o++, this.tmp.matrix);
        else enemy.setMatrixAt(e++, this.tmp.matrix);
      }
    }
    for (const m of [own, enemy]) {
      m.receiveShadow = true;
      m.castShadow = this.caps.tilesCastShadow;
      this.scene.add(m);
    }
    const tide = new Mesh(
      new BoxGeometry(ARENA_COLS * CELL + 0.2, 0.05, 0.06),
      new MeshStandardMaterial({ color: this.theme.tiles.divider, emissive: this.theme.tiles.dividerGlow, emissiveIntensity: 1.3 }),
    );
    tide.position.set(0, TILE_TOP - 0.01, BOARD_Z);
    const glow = new Mesh(
      new BoxGeometry(ARENA_COLS * CELL + 0.2, 0.01, 0.2),
      new MeshBasicMaterial({ color: this.theme.tiles.dividerGlow, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    glow.position.set(0, TILE_TOP - 0.03, BOARD_Z);
    this.scene.add(glow);
    const wells = new InstancedMesh(new CylinderGeometry(0.46, 0.46, 0.1, 24), new MeshStandardMaterial({ color: this.theme.table.wells, roughness: 0.9 }), BENCH_SLOTS);
    for (let i = 0; i < BENCH_SLOTS; i += 1) {
      const p = benchWorld(i);
      this.tmp.position.set(p.x, BENCH_TOP - 0.05, p.z);
      this.tmp.updateMatrix();
      wells.setMatrixAt(i, this.tmp.matrix);
    }
    wells.receiveShadow = true;
    this.scene.add(tide, wells);
  }

  setView(view: ArenaView) {
    this.view = view;
    if (!view.dragEnabled && this.drag) this.endDrag(false);
    this.syncTokens();
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  }

  resize(width: number, height: number, mobile: boolean, safe: { top: number; bottom: number; left: number; right: number }) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.mobile = mobile;
    this.renderer.setPixelRatio(Math.min(this.caps.dprCap, globalThis.devicePixelRatio || 1));
    this.renderer.setSize(this.width, this.height, false);
    this.fitCamera(safe);
    this.emitLabels();
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  }

  /** Fit board + bench into the HUD-free safe rect at the reference's ~45° three-quarter angle. */
  private fitCamera(safe: { top: number; bottom: number; left: number; right: number }) {
    const cam = this.camera;
    const sw = Math.max(1, this.width - safe.left - safe.right);
    const sh = Math.max(1, this.height - safe.top - safe.bottom);
    cam.fov = this.mobile ? 50 : 33;
    cam.aspect = sw / sh;
    const target = new Vector3(0, 0, this.mobile ? 1.2 : 0.9);
    // Elevation from the theme (mobile looks a bit more top-down so the board fills width).
    const pitch = ((this.theme.camera.pitchDeg + (this.mobile ? 9 : 0)) * Math.PI) / 180;
    const dir = new Vector3(0, Math.sin(pitch), Math.cos(pitch)).normalize();
    const zMin = BOARD_Z - FRAME_D / 2;
    const zMax = BENCH_Z + (CELL + 0.4) / 2;
    const corners: Vector3[] = [];
    for (const x of [-FRAME_W / 2, FRAME_W / 2]) for (const z of [zMin, zMax]) for (const y of [0, this.mobile ? 0.4 : TOKEN_HEIGHT]) corners.push(new Vector3(x, y, z));
    // Mobile: pull in so the board fills width (less empty side gutters).
    const mx = this.mobile ? 1.22 : 0.98;
    const my = this.mobile ? 1.1 : 0.97;
    const fits = (d: number) => {
      cam.position.copy(target).addScaledVector(dir, d);
      cam.lookAt(target);
      cam.clearViewOffset();
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      return corners.every((c) => {
        const p = c.clone().project(cam);
        return Math.abs(p.x) <= mx && Math.abs(p.y) <= my;
      });
    };
    let lo = 4;
    let hi = 60;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    // Theme distance (<1 pulls in: the bench/frame edge may crop slightly for a closer read).
    fits(hi * this.theme.camera.distance);
    this.baseCamPos.copy(cam.position);
    // Center vertically on the projected footprint inside the safe rect.
    let minY = Infinity;
    let maxY = -Infinity;
    for (const c of corners) {
      const p = c.clone().project(cam);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const shiftPx = ((minY + maxY) / 2) * (sh / 2);
    cam.setViewOffset(sw, sh, -safe.left, -safe.top - shiftPx, this.width, this.height);
    cam.updateProjectionMatrix();
  }

  private project(x: number, y: number, z: number) {
    this.v1.set(x, y, z).project(this.camera);
    return { x: ((this.v1.x + 1) / 2) * this.width, y: ((1 - this.v1.y) / 2) * this.height };
  }

  private emitLabels() {
    this.camera.updateMatrixWorld();
    this.cb.onLabels?.({
      tide: this.project(FRAME_W / 2 + 0.15, TILE_TOP, BOARD_Z),
      bench: this.project(-(BENCH_SLOTS * CELL + 0.5) / 2 - 0.1, BENCH_TOP, BENCH_Z),
    });
  }

  private occupied = (slot: SlotRef) =>
    slot.kind === "cell" ? Boolean(this.view.ownBoard[slot.boardIndex]) : Boolean(this.view.ownBench[slot.benchIndex]);

  private pieceAt(slot: SlotRef): Piece | null {
    return (slot.kind === "cell" ? this.view.ownBoard[slot.boardIndex] : this.view.ownBench[slot.benchIndex]) ?? null;
  }

  private unitMat: MeshStandardMaterial | null = null;

  /** Lazily build a mesh for a content-defined unit from its shape preset (data layer). */
  private ensureUnitMesh(unitId: string): InstancedMesh | undefined {
    const look = unitAppearance.get(unitId);
    if (!look || !this.unitMat) return undefined;
    const mesh = new InstancedMesh(unitGeometry(look.proceduralPreset, look.cost), this.unitMat, MAX_PER_TYPE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    mesh.frustumCulled = false;
    this.units.set(unitId, mesh);
    this.scene.add(mesh);
    return mesh;
  }

  private syncTokens() {
    const counts = new Map<string, number>();
    let ringCount = 0;
    const own = new Color(OWN_RING);
    const enemy = new Color(ENEMY_RING);
    const place = (piece: Piece, pos: { x: number; y: number; z: number }, isOwn: boolean, backRow: boolean, onBench: boolean) => {
      const hp = this.view.hp?.get(piece.uid) ?? piece.hp;
      if (hp <= 0 && !this.replay) return;
      const mesh = this.units.get(piece.unitId) ?? this.ensureUnitMesh(piece.unitId);
      if (!mesh) return;
      const look = unitAppearance.get(piece.unitId);
      const modelRef = look?.modelRef;
      let usesModel = false;
      if (modelRef && this.modelPool?.hasSource(modelRef)) {
        const obj = this.modelPool.ensure(piece.uid, modelRef);
        usesModel = Boolean(obj);
      }
      const dragging = this.drag?.uid === piece.uid && this.drag.point;
      const p = dragging ? { x: this.drag!.point!.x, y: TILE_TOP + LIFT, z: this.drag!.point!.z } : pos;
      const rotY = isOwn ? 0 : Math.PI;
      const scale = (dragging ? 1.08 : 1) * this.theme.unitScale;
      this.tmp.position.set(p.x, p.y, p.z);
      this.tmp.rotation.set(0, rotY, 0);
      // Hide procedural instance when a GLB clone is live (still keep a slot for replay/HUD).
      this.tmp.scale.setScalar(usesModel ? 0 : scale);
      this.tmp.updateMatrix();
      if (usesModel && modelRef) this.modelPool!.place(piece.uid, p.x, p.y, p.z, rotY, scale, hp > 0 || Boolean(this.replay));
      const n = counts.get(piece.unitId) ?? 0;
      const slot: TokenSlot = {
        uid: piece.uid,
        mesh,
        index: n,
        ring: ringCount,
        x: p.x,
        y: p.y,
        z: p.z,
        cx: p.x,
        cy: p.y,
        cz: p.z,
        rotY,
        dead: hp <= 0,
        own: isOwn,
        backRow,
        onBench,
        unitId: piece.unitId,
        stars: piece.stars ?? 1,
        hp,
        maxHp: piece.maxHp,
        ...(modelRef ? { modelRef, usesModel } : {}),
      };
      this.slots.push(slot);
      this.slotByUid.set(piece.uid, slot);
      mesh.setMatrixAt(n, this.tmp.matrix);
      counts.set(piece.unitId, n + 1);
      this.rings.setMatrixAt(ringCount, this.tmp.matrix);
      this.rings.setColorAt(ringCount, isOwn ? own : enemy);
      ringCount += 1;
    };
    // Anchors emitted after optional replay animate so HUD tracks lunge / sink.
    const pushAnchors = () => {
      const out: TokenAnchor[] = [];
      this.camera.updateMatrixWorld();
      for (const s of this.slots) {
        if (s.dead && !this.replay) continue;
        const p = new Vector3(s.cx, s.cy + TOKEN_HEIGHT * this.theme.unitScale + 0.12, s.cz).project(this.camera);
        out.push({
          uid: s.uid,
          unitId: s.unitId,
          own: s.own,
          backRow: s.backRow,
          onBench: s.onBench,
          stars: s.stars,
          x: ((p.x + 1) / 2) * this.width,
          y: ((1 - p.y) / 2) * this.height,
          hp: s.hp,
          maxHp: s.maxHp,
        });
      }
      this.cb.onAnchors(out);
    };
    this.camera.updateMatrixWorld();
    this.slots = [];
    this.slotByUid.clear();
    this.view.ownBoard.forEach((piece, i) => piece && place(piece, boardWorld(true, i), true, i >= 7, false));
    this.view.ownBench.forEach((piece, i) => piece && place(piece, benchWorld(i), true, false, true));
    this.view.enemyBoard.forEach((piece, i) => piece && place(piece, boardWorld(false, i), false, i >= 7, false));
    this.modelPool?.prune(new Set(this.slots.map((s) => s.uid)));
    for (const [id, mesh] of this.units) {
      mesh.count = counts.get(id) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.rings.count = ringCount;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    this.syncHighlights();
    if (this.replay) this.animate(this.replay.ms);
    else pushAnchors();
  }

  // ── Combat replay (presentational; the worker already resolved the fight) ──

  playReplay(tl: Timeline, speed = 1) {
    this.stopReplay();
    this.replay = { tl, ms: 0, speed, last: 0, fired: -1, raf: 0 };
    this.frameSamples.length = 0;
    this.syncTokens();
    const tick = (now: number) => {
      const r = this.replay;
      if (!r || this.disposed) return;
      const dt = r.last ? Math.min(100, now - r.last) : 16;
      if (r.last) this.frameSamples.length < 2000 && this.frameSamples.push(now - r.last);
      r.last = now;
      r.ms = Math.min(r.tl.durationMs, r.ms + dt * r.speed);
      this.animate(r.ms);
      this.render();
      this.emitTime(r.ms);
      if (r.ms >= r.tl.durationMs) {
        this.finishReplay();
        return;
      }
      r.raf = requestAnimationFrame(tick);
    };
    this.replay.raf = requestAnimationFrame(tick);
  }

  setReplaySpeed(speed: number) {
    if (this.replay) this.replay.speed = speed;
  }

  /** Jump to a replay clock (ms) and pause — for e2e mid-combat VFX frames. */
  getReplayMs(): number {
    return this.replay?.ms ?? -1;
  }

  seekReplay(ms: number) {
    const r = this.replay;
    if (!r) return false;
    r.ms = Math.max(0, Math.min(ms, r.tl.durationMs));
    r.speed = 0;
    this.animate(r.ms);
    this.emitTime(r.ms);
    this.syncTokens();
    this.invalidate();
    return true;
  }

  /** First timeline clock for a VFX preset (or -1). */
  firstVfxAt(preset: string): number {
    const r = this.replay;
    if (!r) return -1;
    for (const e of r.tl.events) {
      if (e.kind === "vfx" && e.preset === preset) return e.t;
    }
    return -1;
  }

  skipReplay() {
    if (!this.replay) return;
    this.replay.ms = this.replay.tl.durationMs;
    this.finishReplay();
  }

  private finishReplay() {
    const r = this.replay;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    this.replay = null;
    this.projectiles.count = 0;
    this.cb.onReplayTime?.(r.tl.durationMs, true);
    this.syncTokens();
    this.invalidate();
  }

  stopReplay() {
    if (!this.replay) return;
    cancelAnimationFrame(this.replay.raf);
    this.replay = null;
    this.projectiles.count = 0;
    if (this.fxAoe) this.fxAoe.count = 0;
    if (this.fxHeal) this.fxHeal.count = 0;
    if (this.fxShield) this.fxShield.count = 0;
    if (this.fxHit) this.fxHit.count = 0;
  }

  /** Notify React only when an event boundary is crossed (keeps per-frame work allocation-free). */
  private emitTime(ms: number) {
    const r = this.replay!;
    let fired = -1;
    const events = r.tl.events;
    for (let i = 0; i < events.length; i += 1) {
      const e = events[i]!;
      if ((e.kind === "strike" ? e.hitT : e.t) <= ms) fired = i;
    }
    if (fired !== r.fired) {
      r.fired = fired;
      this.cb.onReplayTime?.(ms, false);
    }
  }

  private animate(ms: number) {
    const r = this.replay;
    if (!r) return;
    // Base pose + death sink/fade (not shrink-in-place).
    for (const s of this.slots) {
      let y = s.y;
      let scale = 1;
      if (s.dead) {
        const down = this.downAt(r.tl, s.uid);
        if (ms >= down) {
          const t = Math.min(1, (ms - down) / DEATH_FADE_MS);
          y = s.y - t * 1.05;
          scale = Math.max(0.05, 1 - t * 0.35);
        }
      }
      this.pose(s, s.x, y, s.z, scale);
      this.rings.setColorAt(s.ring, s.rotY === 0 ? this.cOwn : this.cEnemy);
    }
    // Swings in flight: melee lunge, ranged projectile arc, hit flash.
    let proj = 0;
    for (const e of r.tl.events) {
      if (e.kind !== "strike") continue;
      if (ms < e.t || ms > e.hitT + FLASH_MS) continue;
      const a = this.slotByUid.get(e.attackerUid);
      const b = this.slotByUid.get(e.targetUid);
      if (!a || !b) continue;
      const k = Math.min(1, (ms - e.t) / HIT_DELAY_MS);
      if (!e.ranged && ms <= e.hitT) {
        const lunge = Math.sin(k * Math.PI) * 0.55;
        this.v2.set(b.x - a.x, 0, b.z - a.z).normalize();
        this.pose(a, a.x + this.v2.x * lunge, a.y + lunge * 0.25, a.z + this.v2.z * lunge, 1);
      } else if (e.ranged && ms <= e.hitT && proj < PROJECTILES) {
        const y = a.y + 0.7 + (b.y - a.y) * k + Math.sin(k * Math.PI) * 1.2;
        this.tmp.position.set(a.x + (b.x - a.x) * k, y, a.z + (b.z - a.z) * k);
        this.tmp.rotation.set(0, 0, 0);
        this.tmp.scale.setScalar(1);
        this.tmp.updateMatrix();
        this.projectiles.setMatrixAt(proj, this.tmp.matrix);
        proj += 1;
      }
      if (ms >= e.hitT && ms <= e.hitT + FLASH_MS && !(b.dead && ms > this.downAt(r.tl, b.uid))) {
        this.pose(b, b.x, b.y, b.z, 1.14);
        this.rings.setColorAt(b.ring, this.cWhite);
      }
    }
    this.projectiles.count = proj;
    this.projectiles.instanceMatrix.needsUpdate = true;

    // Generic VFX presets from combat log (aoe / heal / shield / hit / crit shake).
    let aoe = 0, heal = 0, shield = 0, hit = 0;
    for (const e of r.tl.events) {
      if (e.kind !== "vfx") continue;
      if (ms < e.t || ms > e.t + 420) continue;
      const k = Math.min(1, (ms - e.t) / 420);
      const uid = e.atUid ?? e.toUid;
      const slot = uid ? this.slotByUid.get(uid) : undefined;
      const x = slot?.cx ?? 0, y = (slot?.cy ?? 0) + 0.4, z = slot?.cz ?? 0;
      if (e.preset === "aoe" && aoe < 8) {
        const s = 0.6 + k * 1.8;
        this.tmp.position.set(x, y * 0.2, z);
        this.tmp.rotation.set(0, 0, 0);
        this.tmp.scale.set(s, 1, s);
        this.tmp.updateMatrix();
        this.fxAoe.setMatrixAt(aoe++, this.tmp.matrix);
      } else if (e.preset === "heal" && heal < 12) {
        this.tmp.position.set(x, y + k * 0.8, z);
        this.tmp.scale.setScalar(0.8 + (1 - k) * 0.6);
        this.tmp.updateMatrix();
        this.fxHeal.setMatrixAt(heal++, this.tmp.matrix);
      } else if (e.preset === "shield" && shield < 12) {
        this.tmp.position.set(x, y, z);
        this.tmp.scale.setScalar(0.9 + Math.sin(k * Math.PI) * 0.25);
        this.tmp.updateMatrix();
        this.fxShield.setMatrixAt(shield++, this.tmp.matrix);
      } else if ((e.preset === "hit_particles" || e.preset === "projectile") && hit < 24) {
        const ang = hit * 1.7;
        this.tmp.position.set(x + Math.cos(ang) * k * 0.5, y + 0.2 + k * 0.4, z + Math.sin(ang) * k * 0.5);
        this.tmp.scale.setScalar(0.7 * (1 - k));
        this.tmp.updateMatrix();
        this.fxHit.setMatrixAt(hit++, this.tmp.matrix);
      } else if (e.preset === "crit_shake") {
        this.shakeUntil = Math.max(this.shakeUntil, e.t + 280);
      }
    }
    this.fxAoe.count = aoe; this.fxAoe.instanceMatrix.needsUpdate = true;
    this.fxHeal.count = heal; this.fxHeal.instanceMatrix.needsUpdate = true;
    this.fxShield.count = shield; this.fxShield.instanceMatrix.needsUpdate = true;
    this.fxHit.count = hit; this.fxHit.instanceMatrix.needsUpdate = true;
    if (ms <= this.shakeUntil) {
      const j = (this.shakeUntil - ms) / 280;
      this.camera.position.x = this.baseCamPos.x + (Math.random() - 0.5) * 0.12 * j;
      this.camera.position.y = this.baseCamPos.y + (Math.random() - 0.5) * 0.08 * j;
      this.camera.position.z = this.baseCamPos.z + (Math.random() - 0.5) * 0.12 * j;
      this.camera.lookAt(0, 0.2, 0);
    } else if (this.baseCamPos.lengthSq() > 0) {
      this.camera.position.copy(this.baseCamPos);
    }

    for (const mesh of this.units.values()) mesh.instanceMatrix.needsUpdate = true;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    this.emitLiveAnchors();
  }

  /** Project live token poses so floaters / HP bars track lunge and death sink. */
  private emitLiveAnchors() {
    const out: TokenAnchor[] = [];
    this.camera.updateMatrixWorld();
    for (const s of this.slots) {
      const p = this.v1.set(s.cx, s.cy + TOKEN_HEIGHT * this.theme.unitScale + 0.12, s.cz).project(this.camera);
      out.push({
        uid: s.uid,
        unitId: s.unitId,
        own: s.own,
        backRow: s.backRow,
        onBench: s.onBench,
        stars: s.stars,
        x: ((p.x + 1) / 2) * this.width,
        y: ((1 - p.y) / 2) * this.height,
        hp: s.hp,
        maxHp: s.maxHp,
      });
    }
    this.cb.onAnchors(out);
  }

  private downAt(tl: Timeline, uid: string): number {
    for (const e of tl.events) if (e.kind === "down" && e.uid === uid) return e.t;
    return Infinity;
  }

  private pose(s: TokenSlot, x: number, y: number, z: number, scale: number) {
    s.cx = x;
    s.cy = y;
    s.cz = z;
    const sMul = scale * this.theme.unitScale;
    this.tmp.position.set(x, y, z);
    this.tmp.rotation.set(0, s.rotY, 0);
    this.tmp.scale.setScalar(s.usesModel ? 0 : sMul);
    this.tmp.updateMatrix();
    s.mesh.setMatrixAt(s.index, this.tmp.matrix);
    this.rings.setMatrixAt(s.ring, this.tmp.matrix);
    if (s.usesModel && s.modelRef) this.modelPool?.place(s.uid, x, y, z, s.rotY, sMul, !s.dead || Boolean(this.replay));
  }

  private syncHighlights() {
    if (!this.drag) {
      this.highlights.count = 0;
      return;
    }
    const drops = legalDrops(this.drag.from, this.occupied, { boardFull: Boolean(this.view.boardFull) });
    const legal = new Color("#E9FFF9");
    const hot = new Color("#FFE08A");
    drops.forEach((slot, i) => {
      const p = slot.kind === "cell" ? boardWorld(true, slot.boardIndex) : benchWorld(slot.benchIndex);
      this.tmp.position.set(p.x, p.y + 0.015, p.z);
      this.tmp.rotation.set(0, 0, 0);
      this.tmp.scale.setScalar(1);
      this.tmp.updateMatrix();
      this.highlights.setMatrixAt(i, this.tmp.matrix);
      this.highlights.setColorAt(i, sameSlot(slot, this.drag!.over) ? hot : legal);
    });
    this.highlights.count = drops.length;
    this.highlights.instanceMatrix.needsUpdate = true;
    if (this.highlights.instanceColor) this.highlights.instanceColor.needsUpdate = true;
  }

  private hit(event: PointerEvent): { slot: SlotRef | null; point: Vector3 | null } {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const pb = this.raycaster.ray.intersectPlane(this.benchPlane, new Vector3());
    const benchSlot = pb ? slotAt(pb.x, pb.z) : null;
    if (benchSlot?.kind === "bench") return { slot: benchSlot, point: pb };
    const pc = this.raycaster.ray.intersectPlane(this.boardPlane, new Vector3());
    const cellSlot = pc ? slotAt(pc.x, pc.z) : null;
    return { slot: cellSlot?.kind === "cell" ? cellSlot : null, point: pc };
  }

  private overSell(event: PointerEvent): boolean {
    if (typeof document === "undefined" || !document.elementsFromPoint) return false;
    return document.elementsFromPoint(event.clientX, event.clientY).some((el) => el.closest("[data-tide-sell]"));
  }

  private onDown = (event: PointerEvent) => {
    if (!this.view.dragEnabled || this.drag) return;
    const { slot, point } = this.hit(event);
    const piece = slot ? this.pieceAt(slot) : null;
    if (!slot || !piece) return;
    this.drag = { from: slot, uid: piece.uid, point, over: slot, sell: false, pointerId: event.pointerId };
    this.canvas.setPointerCapture?.(event.pointerId);
    this.cb.onDrag({ dragging: true, overSell: false });
    this.syncTokens();
    this.invalidate();
  };

  private onMove = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const { slot, point } = this.hit(event);
    const sell = this.overSell(event);
    this.drag.point = point ?? this.drag.point;
    this.drag.over = slot;
    if (sell !== this.drag.sell) {
      this.drag.sell = sell;
      this.cb.onDrag({ dragging: true, overSell: sell });
    }
    this.syncTokens();
    this.invalidate();
  };

  private onUp = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const { slot } = this.hit(event);
    this.drag.over = slot;
    this.drag.sell = this.overSell(event);
    this.endDrag(true);
  };

  private onCancel = () => this.endDrag(false);

  private endDrag(commit: boolean) {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    this.cb.onDrag({ dragging: false, overSell: false });
    if (commit) {
      const action = dragAction(drag.from, drag.sell ? "sell" : drag.over, this.occupied);
      if (action?.type === "place" && this.view.boardFull) {
        // Kernel would reject; do not highlight or submit over-cap places.
      } else if (action) {
        this.cb.onAction(action.type, action.payload);
      }
    }
    this.syncTokens();
    this.invalidate();
  }

  invalidate() {
    if (this.disposed || this.frame) return;
    const raf = globalThis.requestAnimationFrame ?? ((fn: FrameRequestCallback) => setTimeout(() => fn(0), 16) as unknown as number);
    this.frame = raf(() => {
      this.frame = 0;
      this.render();
    });
  }

  render() {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
    const info = this.renderer.info.render;
    this.peakCalls = Math.max(this.peakCalls, info.calls);
    this.peakTriangles = Math.max(this.peakTriangles, info.triangles);
  }

  /** Screen (client) coordinates of a slot centre — used by e2e drag and the overlay. */
  screenOf(slot: SlotRef | { kind: "enemy"; boardIndex: number }): { x: number; y: number } {
    const p =
      slot.kind === "bench" ? benchWorld(slot.benchIndex) : boardWorld(slot.kind === "cell", slot.boardIndex);
    this.camera.updateMatrixWorld();
    const s = new Vector3(p.x, p.y + 0.15, p.z).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((s.x + 1) / 2) * rect.width, y: rect.top + ((1 - s.y) / 2) * rect.height };
  }

  perf() {
    this.render();
    const info = this.renderer.info.render;
    return { calls: info.calls, triangles: info.triangles, peakCalls: this.peakCalls, peakTriangles: this.peakTriangles };
  }

  dispose() {
    this.stopReplay();
    this.modelPool?.dispose();
    this.modelPool = null;
    this.disposed = true;
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onCancel);
    this.renderer.dispose();
  }
}


