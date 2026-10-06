/**
 * G3D-JUDGE-PIECES · on-canvas camera toolbar (wood / parchment).
 *
 * Self-contained (inline styles + inline SVG, no CSS file) so Track B's HUD
 * rebuild can keep, move or replace it: everything goes through
 * `CameraRigApi` (zoomIn / zoomOut / setZoom / rotate / reset / subscribe).
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CameraRigApi, CameraRigState } from "../camera-rig";

const WOOD = "linear-gradient(180deg, #6b4428 0%, #4e301b 55%, #3f2615 100%)";
const PARCHMENT = "#f3e4c1";
const BRASS = "#c9a25a";

const barStyle: CSSProperties = {
  position: "absolute",
  top: 10,
  left: 10,
  zIndex: 2,
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 6px",
  borderRadius: 10,
  background: WOOD,
  border: `1px solid ${BRASS}`,
  boxShadow: "0 2px 6px rgb(0 0 0 / 35%), inset 0 1px 0 rgb(255 255 255 / 14%)",
  color: PARCHMENT,
  font: "600 12px/1 system-ui, -apple-system, 'PingFang SC', sans-serif",
  userSelect: "none",
  touchAction: "manipulation",
};

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  padding: 0,
  borderRadius: 7,
  border: "1px solid rgb(201 162 90 / 55%)",
  background: "rgb(243 228 193 / 10%)",
  color: PARCHMENT,
  cursor: "pointer",
};

const dividerStyle: CSSProperties = { width: 1, height: 20, background: "rgb(201 162 90 / 45%)", margin: "0 2px" };

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
      {children}
    </svg>
  );
}

const ICONS = {
  zoomOut: (
    <Icon>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21M7.5 10.5h6" />
    </Icon>
  ),
  zoomIn: (
    <Icon>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21M7.5 10.5h6M10.5 7.5v6" />
    </Icon>
  ),
  rotateLeft: (
    <Icon>
      <path d="M4 5v5h5" />
      <path d="M4.6 10A8 8 0 1 1 6 16.5" />
    </Icon>
  ),
  rotateRight: (
    <Icon>
      <path d="M20 5v5h-5" />
      <path d="M19.4 10A8 8 0 1 0 18 16.5" />
    </Icon>
  ),
  reset: (
    <Icon>
      <path d="M12 3 3 9.5V21h6v-6h6v6h6V9.5z" />
    </Icon>
  ),
};

export type CameraToolbarCopy = {
  toolbar: string;
  zoomOut: string;
  zoomIn: string;
  zoom: string;
  rotateLeft: string;
  rotateRight: string;
  reset: string;
};

export const CAMERA_TOOLBAR_COPY: Record<"zh" | "en", CameraToolbarCopy> = {
  zh: { toolbar: "视角", zoomOut: "缩小", zoomIn: "放大", zoom: "缩放", rotateLeft: "向左旋转", rotateRight: "向右旋转", reset: "复位视角" },
  en: { toolbar: "Camera", zoomOut: "Zoom out", zoomIn: "Zoom in", zoom: "Zoom", rotateLeft: "Rotate left", rotateRight: "Rotate right", reset: "Reset view" },
};

export function CameraToolbar({
  api,
  copy = CAMERA_TOOLBAR_COPY.zh,
  compact = false,
}: {
  api: CameraRigApi;
  copy?: CameraToolbarCopy;
  /** Narrow canvases (phones): drop the slider, keep buttons + readout. */
  compact?: boolean;
}) {
  const [state, setState] = useState<CameraRigState>(() => api.getState());
  useEffect(() => api.subscribe(setState), [api]);
  const percent = state.zoomPercent;
  return (
    <div aria-label={copy.toolbar} data-testid="g3d-camera-toolbar" role="toolbar" style={barStyle}>
      <button aria-label={copy.zoomOut} onClick={() => api.zoomOut()} style={buttonStyle} title={copy.zoomOut} type="button">
        {ICONS.zoomOut}
      </button>
      {!compact && <input
        aria-label={copy.zoom}
        max={Math.round(state.maxZoom * 100)}
        min={Math.round(state.minZoom * 100)}
        onChange={(event) => api.setZoom(Number(event.currentTarget.value) / 100)}
        step={5}
        style={{ width: 84, accentColor: BRASS, cursor: "pointer" }}
        type="range"
        value={percent}
      />}
      <button aria-label={copy.zoomIn} onClick={() => api.zoomIn()} style={buttonStyle} title={copy.zoomIn} type="button">
        {ICONS.zoomIn}
      </button>
      <output aria-live="off" style={{ minWidth: 38, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{percent}%</output>
      <span aria-hidden="true" style={dividerStyle} />
      <button aria-label={copy.rotateLeft} onClick={() => api.rotate(-1)} style={buttonStyle} title={copy.rotateLeft} type="button">
        {ICONS.rotateLeft}
      </button>
      <button aria-label={copy.rotateRight} onClick={() => api.rotate(1)} style={buttonStyle} title={copy.rotateRight} type="button">
        {ICONS.rotateRight}
      </button>
      <button aria-label={copy.reset} onClick={() => api.reset()} style={buttonStyle} title={copy.reset} type="button">
        {ICONS.reset}
      </button>
    </div>
  );
}
