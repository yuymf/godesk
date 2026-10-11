/**
 * Always-on slice of the G3D-05 perf probe: the one-off `render3d:interactive`
 * mark and the `?perf=1` switch. The recorder / harness (`./perf`) is loaded
 * lazily only in perf mode so it stays out of the render3d core bundle.
 */
export const INTERACTIVE_MARK = "render3d:interactive";
export const INTERACTIVE_MEASURE = "render3d:tti";

export function perfModeEnabled(search: string = typeof location === "undefined" ? "" : location.search): boolean {
  const value = new URLSearchParams(search).get("perf");
  return value === "1" || value === "true";
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
