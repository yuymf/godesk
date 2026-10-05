// SPEC §4.6.3 budget table as data. scripts/perf-emulate.mjs evaluates it;
// docs/perf/emulation-protocol.md documents it. Change both together.
export const MB = 1024 * 1024;

/** Per quality tier (§4.6.3 GPU 资源 / draw call / 三角形). */
export const TIER_BUDGETS = {
  high: { drawCalls: 150, triangles: 300_000, gpuMemoryBytes: 192 * MB, firstGameBytes: 7.6 * MB },
  medium: { drawCalls: 100, triangles: 150_000, gpuMemoryBytes: 128 * MB, firstGameBytes: 7.6 * MB },
  low: { drawCalls: 60, triangles: 60_000, gpuMemoryBytes: 64 * MB, firstGameBytes: 5.5 * MB },
};

/** Transfer budgets shared by every profile (§4.6.3). */
export const TRANSFER_BUDGETS = {
  interactiveBytes: 1.4 * MB,
  firstGameRequests: 80,
  /** Window after navigation in which "首局总传输" is counted. */
  firstGameWindowMs: 30_000,
};

/** Desktop emulation gate budgets per profile (§4.6.3; frame numbers are emulated proxies). */
export const PROFILE_BUDGETS = {
  "EP-D": { interactiveMs: 2_000, fpsMedian: 58, p95FrameMs: 16.7, jsHeapBytes: 150 * MB },
  "EP-D4": { interactiveMs: null, fpsMedian: 58, p95FrameMs: 20, jsHeapBytes: 150 * MB },
  "EP-A": { interactiveMs: 4_000, fpsMedian: 29, p95FrameMs: 40, jsHeapBytes: 100 * MB },
  "EP-A6": { interactiveMs: 12_000, fpsMedian: 29, p95FrameMs: 45, jsHeapBytes: 100 * MB },
  "EP-I": { interactiveMs: null, fpsMedian: 29, p95FrameMs: 40, jsHeapBytes: 100 * MB },
};

/** §4.6.3 长局趋势 (EP-A, 10 minutes). */
export const LONG_RUN_BUDGET = { medianFrameGrowthRatio: 0.15, heapGrowthBytes: 10 * MB };

/** §4.6.3 WebGL 上下文丢失 / 泄漏. */
export const RESILIENCE_BUDGETS = { contextRebuildMs: 2_000, leakCycles: 10 };

/**
 * Compare `actual` with a budget. `kind: "max"` means actual must be <= limit,
 * `"min"` means actual must be >= limit. Null actual or limit = not measured.
 */
export function check(name, actual, limit, kind = "max", note) {
  if (limit === null || limit === undefined) return { name, actual, limit: null, pass: null, note: note ?? "无预算" };
  if (actual === null || actual === undefined || Number.isNaN(actual)) {
    return { name, actual: null, limit, kind, pass: false, note: note ?? "未测得" };
  }
  const pass = kind === "max" ? actual <= limit : actual >= limit;
  return { name, actual, limit, kind, pass, ...(note ? { note } : {}) };
}
