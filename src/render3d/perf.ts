/**
 * G3D-05 performance probe (SPEC §4.6). Always records the one-off
 * `render3d:interactive` mark; frame sampling, the `?perf=1` overlay and the
 * `window.__godeskPerf` harness API exist only when perf mode is on, so normal
 * players pay nothing per frame.
 *
 * The probe is renderer-agnostic data collection: it never changes what is
 * drawn, and it is the single read surface for scripts/perf-emulate.mjs.
 */
import type { Object3D, WebGLRenderer } from "three";

export const INTERACTIVE_MARK = "render3d:interactive";
export const INTERACTIVE_MEASURE = "render3d:tti";
/** SPEC §4.6.3: discard the first 180 frames (shader compile, layout, GC warm-up). */
export const WARMUP_FRAMES = 180;
/** 120 s at 60 fps; older samples fall off the ring buffer. */
const MAX_SAMPLES = 7_200;

export type PerfTier = "high" | "medium" | "low";

export type RendererInfoSnapshot = {
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  programs: number;
};

export type PerfSnapshot = {
  schema: "godesk-perf/v1";
  tier: PerfTier;
  tierSource: "query" | "default";
  frames: { total: number; sampled: number; warmupDiscarded: number };
  frameTimeMs: { p50: number | null; p95: number | null; max: number | null };
  fps: number | null;
  renderer: RendererInfoSnapshot;
  gpuMemoryEstimateBytes: number;
  jsHeap: { usedBytes: number; totalBytes: number; limitBytes: number } | null;
  interactiveMs: number | null;
  devicePixelRatio: number;
  canvas: { width: number; height: number };
  context: { lost: number; restored: number; lastRebuildMs: number | null; isLost: boolean };
  lifecycle: {
    mounts: number;
    activeHosts: number;
    /** `renderer.info.memory` right before each `renderer.dispose()` (must be 0 / 0). */
    residualOnDispose: Array<{ geometries: number; textures: number }>;
    /** `renderer.info.memory` after the first content frame of each mount. */
    memoryOnMount: Array<{ geometries: number; textures: number }>;
  };
  capturedAt: string;
};

type HostHandle = {
  renderer: WebGLRenderer;
  scene: Object3D;
  remount: () => void;
};

export type PerfHarnessApi = {
  version: 1;
  snapshot: () => PerfSnapshot | null;
  /** Start a fresh measurement window; warm-up discard applies again unless `warmup: false`. */
  resetSamples: (options?: { warmup?: boolean }) => void;
  /** Tear down and rebuild the 3D scene in place (leak check). */
  remount: () => boolean;
  /** Simulate GPU context loss / restore through `WEBGL_lose_context`. */
  loseContext: () => boolean;
  restoreContext: () => boolean;
};

declare global {
  interface Window {
    __godeskPerf?: PerfHarnessApi;
  }
}

export function perfModeEnabled(search: string = typeof location === "undefined" ? "" : location.search): boolean {
  const value = new URLSearchParams(search).get("perf");
  return value === "1" || value === "true";
}

export function requestedTier(search: string = typeof location === "undefined" ? "" : location.search): {
  tier: PerfTier;
  source: "query" | "default";
} {
  const value = new URLSearchParams(search).get("tier");
  if (value === "high" || value === "medium" || value === "low") return { tier: value, source: "query" };
  // Single quality level until G3D-06 adds automatic tiering.
  return { tier: "high", source: "default" };
}

/** Nearest-rank percentile over an unsorted sample; null for an empty sample. */
export function percentile(samples: readonly number[], p: number): number | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank]!;
}

/** Bytes of geometry attributes / indices and texture images reachable from `root`. */
export function estimateGpuMemoryBytes(root: Object3D, extraTextureBytes = 0): number {
  const seen = new Set<unknown>();
  let bytes = extraTextureBytes;
  root.traverse((object) => {
    const mesh = object as Object3D & {
      geometry?: { attributes?: Record<string, { array?: ArrayLike<number> & { byteLength?: number } }>; index?: { array?: { byteLength?: number } } | null };
      material?: unknown;
    };
    const geometry = mesh.geometry;
    if (geometry && !seen.has(geometry)) {
      seen.add(geometry);
      for (const attribute of Object.values(geometry.attributes ?? {})) bytes += attribute.array?.byteLength ?? 0;
      bytes += geometry.index?.array?.byteLength ?? 0;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials as Array<Record<string, unknown>>) {
      for (const value of Object.values(material)) {
        const texture = value as { isTexture?: boolean; image?: { width?: number; height?: number } } | null;
        if (!texture?.isTexture || seen.has(texture)) continue;
        seen.add(texture);
        const width = texture.image?.width ?? 0;
        const height = texture.image?.height ?? 0;
        bytes += Math.round(width * height * 4 * 1.33); // RGBA8 + mip chain
      }
    }
  });
  return bytes;
}

let interactiveMarked = false;

/** Records `render3d:interactive` once per page (first frame with content). */
export function markInteractive(): void {
  if (interactiveMarked || typeof performance === "undefined") return;
  interactiveMarked = true;
  try {
    performance.mark(INTERACTIVE_MARK);
    performance.measure(INTERACTIVE_MEASURE, { start: 0, end: INTERACTIVE_MARK });
  } catch {
    /* User Timing unavailable: harness falls back to null. */
  }
}

function interactiveMs(): number | null {
  if (typeof performance === "undefined") return null;
  const entry = performance.getEntriesByName(INTERACTIVE_MEASURE).at(0);
  return entry ? Math.round(entry.duration) : null;
}

function memoryOf(renderer: WebGLRenderer) {
  return { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
}

/** Page-wide perf state shared by every SceneHost mount. */
class PerfRecorder {
  private samples: number[] = [];
  private totalFrames = 0;
  private windowFrames = 0;
  private lastFrameAt: number | null = null;
  private host: HostHandle | null = null;
  private loseExtension: { loseContext(): void; restoreContext(): void } | null = null;
  private lostAt: number | null = null;
  private rebuildPending = false;
  readonly context = { lost: 0, restored: 0, lastRebuildMs: null as number | null, isLost: false };
  readonly lifecycle = {
    mounts: 0,
    activeHosts: 0,
    residualOnDispose: [] as Array<{ geometries: number; textures: number }>,
    memoryOnMount: [] as Array<{ geometries: number; textures: number }>,
  };
  private memoryPending = false;
  private lastRenderer: RendererInfoSnapshot = {
    calls: 0, triangles: 0, points: 0, lines: 0, geometries: 0, textures: 0, programs: 0,
  };

  attach(handle: HostHandle): () => void {
    this.host = handle;
    this.lifecycle.mounts += 1;
    this.lifecycle.activeHosts += 1;
    this.memoryPending = true;
    this.lastFrameAt = null;
    const canvas = handle.renderer.domElement;
    const gl = handle.renderer.getContext();
    this.loseExtension = gl.getExtension("WEBGL_lose_context");
    const onLost = () => {
      this.context.lost += 1;
      this.context.isLost = true;
      this.lostAt = performance.now();
    };
    const onRestored = () => {
      this.context.restored += 1;
      this.context.isLost = false;
      this.rebuildPending = true;
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      if (this.host === handle) {
        this.host = null;
        this.loseExtension = null;
      }
    };
  }

  /** Call right before `renderer.dispose()`; anything left over is a leak. */
  beforeDispose(renderer: WebGLRenderer): void {
    this.lifecycle.residualOnDispose.push(memoryOf(renderer));
    this.lifecycle.activeHosts = Math.max(0, this.lifecycle.activeHosts - 1);
  }

  frame(renderer: WebGLRenderer, now: number, hasContent: boolean): void {
    if (this.lastFrameAt !== null) {
      this.windowFrames += 1;
      if (this.windowFrames > WARMUP_FRAMES) {
        this.samples.push(now - this.lastFrameAt);
        if (this.samples.length > MAX_SAMPLES) this.samples.shift();
      }
    }
    this.lastFrameAt = now;
    this.totalFrames += 1;
    const info = renderer.info;
    this.lastRenderer = {
      calls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
    };
    if (hasContent && this.memoryPending && info.render.calls > 0) {
      this.memoryPending = false;
      this.lifecycle.memoryOnMount.push(memoryOf(renderer));
    }
    if (this.rebuildPending && info.render.calls > 0 && this.lostAt !== null) {
      this.rebuildPending = false;
      this.context.lastRebuildMs = Math.round(now - this.lostAt);
    }
  }

  resetSamples(options: { warmup?: boolean } = {}): void {
    this.samples = [];
    this.windowFrames = options.warmup === false ? WARMUP_FRAMES : 0;
    this.lastFrameAt = null;
  }

  remount(): boolean {
    if (!this.host) return false;
    this.host.remount();
    return true;
  }

  loseContext(): boolean {
    if (!this.loseExtension) return false;
    this.loseExtension.loseContext();
    return true;
  }

  restoreContext(): boolean {
    if (!this.loseExtension) return false;
    this.loseExtension.restoreContext();
    return true;
  }

  snapshot(): PerfSnapshot | null {
    const { tier, source } = requestedTier();
    const p50 = percentile(this.samples, 50);
    const memory = (performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
    }).memory;
    const renderer = this.host?.renderer;
    const shadowBytes = renderer && renderer.shadowMap.enabled ? 1024 * 1024 * 4 : 0;
    return {
      schema: "godesk-perf/v1",
      tier,
      tierSource: source,
      frames: {
        total: this.totalFrames,
        sampled: this.samples.length,
        warmupDiscarded: Math.min(this.windowFrames, WARMUP_FRAMES),
      },
      frameTimeMs: {
        p50: p50 === null ? null : round2(p50),
        p95: round2OrNull(percentile(this.samples, 95)),
        max: round2OrNull(this.samples.length ? Math.max(...this.samples) : null),
      },
      fps: p50 ? round2(1000 / p50) : null,
      renderer: { ...this.lastRenderer },
      gpuMemoryEstimateBytes: this.host ? estimateGpuMemoryBytes(this.host.scene, shadowBytes) : 0,
      jsHeap: memory
        ? { usedBytes: memory.usedJSHeapSize, totalBytes: memory.totalJSHeapSize, limitBytes: memory.jsHeapSizeLimit }
        : null,
      interactiveMs: interactiveMs(),
      devicePixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
      canvas: renderer
        ? { width: renderer.domElement.width, height: renderer.domElement.height }
        : { width: 0, height: 0 },
      context: { ...this.context, isLost: this.context.isLost },
      lifecycle: {
        mounts: this.lifecycle.mounts,
        activeHosts: this.lifecycle.activeHosts,
        residualOnDispose: [...this.lifecycle.residualOnDispose],
        memoryOnMount: [...this.lifecycle.memoryOnMount],
      },
      capturedAt: new Date().toISOString(),
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
function round2OrNull(value: number | null): number | null {
  return value === null ? null : round2(value);
}

let recorder: PerfRecorder | null = null;

/** The page-wide recorder in perf mode (installs `window.__godeskPerf`), else null. */
export function perfRecorder(): PerfRecorder | null {
  if (recorder) return recorder;
  if (typeof window === "undefined" || !perfModeEnabled()) return null;
  recorder = new PerfRecorder();
  const active = recorder;
  window.__godeskPerf = {
    version: 1,
    snapshot: () => active.snapshot(),
    resetSamples: (options) => active.resetSamples(options),
    remount: () => active.remount(),
    loseContext: () => active.loseContext(),
    restoreContext: () => active.restoreContext(),
  };
  return recorder;
}

export type { PerfRecorder };
