import { useEffect, useState } from "react";
import type { PerfSnapshot } from "./perf";

function formatMs(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} ms`;
}

function formatMb(bytes: number | null | undefined): string {
  return bytes === null || bytes === undefined ? "—" : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** `?perf=1` overlay (SPEC §4.6.3): live frame stats and one-click JSON export. */
export function PerfOverlay() {
  const [snapshot, setSnapshot] = useState<PerfSnapshot | null>(null);

  useEffect(() => {
    const read = () => setSnapshot(window.__godeskPerf?.snapshot() ?? null);
    read();
    const timer = window.setInterval(read, 500);
    return () => window.clearInterval(timer);
  }, []);

  function exportJson() {
    const latest = window.__godeskPerf?.snapshot();
    if (!latest) return;
    const blob = new Blob([JSON.stringify(latest, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `godesk-perf-${latest.tier}-${Date.now()}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }

  return (
    <aside
      aria-label="性能覆盖层"
      data-testid="g3d-perf-overlay"
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 2,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(15, 23, 42, 0.82)",
        color: "#f8fafc",
        font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
        pointerEvents: "auto",
      }}
    >
      <div>档位 {snapshot?.tier ?? "—"}{snapshot?.tierSource === "query" ? "（?tier）" : ""}</div>
      <div>fps {snapshot?.fps?.toFixed(1) ?? "—"}</div>
      <div>p50 {formatMs(snapshot?.frameTimeMs.p50 ?? null)} · p95 {formatMs(snapshot?.frameTimeMs.p95 ?? null)}</div>
      <div>draw {snapshot?.renderer.calls ?? "—"} · tris {snapshot?.renderer.triangles ?? "—"}</div>
      <div>geo {snapshot?.renderer.geometries ?? "—"} · tex {snapshot?.renderer.textures ?? "—"}</div>
      <div>heap {formatMb(snapshot?.jsHeap?.usedBytes)}</div>
      <div>可交互 {snapshot?.interactiveMs === null || snapshot?.interactiveMs === undefined ? "—" : `${snapshot.interactiveMs} ms`}</div>
      <button onClick={exportJson} style={{ marginTop: 6 }} type="button">
        导出 JSON
      </button>
    </aside>
  );
}
