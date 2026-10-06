/**
 * G3D-JUDGE-PIECES · on-canvas camera toolbar (wood / parchment).
 *
 * Self-contained (inline styles + inline SVG, no CSS file) so Track B's HUD
 * rebuild can keep, move or replace it: everything goes through
 * `CameraRigApi` (zoom / rotate / reset / pan mode / harbours / island tour / subscribe).
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CameraRigApi, CameraRigState } from "../camera-rig";

const BRASS = "#c9a25a";

/** round-6 ②：默认半透明、小尺寸，悬停/焦点才醒目，不抢岛。 */
const barStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  zIndex: 2,
  display: "flex",
  alignItems: "center",
  gap: 2,
  padding: "3px 5px",
  borderRadius: 8,
  background: "linear-gradient(180deg, rgb(80 52 32 / 55%) 0%, rgb(48 30 18 / 62%) 100%)",
  border: "1px solid rgb(201 162 90 / 35%)",
  boxShadow: "0 1px 3px rgb(0 0 0 / 22%)",
  color: "rgb(243 228 193 / 78%)",
  font: "600 11px/1 system-ui, -apple-system, 'PingFang SC', sans-serif",
  userSelect: "none",
  touchAction: "manipulation",
  opacity: 0.42,
  transition: "opacity 160ms ease, background 160ms ease, box-shadow 160ms ease",
};

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  padding: 0,
  borderRadius: 6,
  border: "1px solid rgb(201 162 90 / 40%)",
  background: "rgb(243 228 193 / 8%)",
  color: "inherit",
  cursor: "pointer",
};

const pressedOverlay: CSSProperties = { background: "rgb(201 162 90 / 45%)", borderColor: BRASS };
const pressedStyle: CSSProperties = { ...buttonStyle, ...pressedOverlay };
const wideButtonStyle: CSSProperties = { ...buttonStyle, width: "auto", gap: 4, padding: "0 7px" };

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
  pan: (
    <Icon>
      <path d="M12 2v20M2 12h20M12 2 9 5M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" />
    </Icon>
  ),
  harbors: (
    <Icon>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v14M8 11h8M5 14a7 7 0 0 0 14 0" />
    </Icon>
  ),
  tour: (
    <Icon>
      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
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
  pan: string;
  harbors: string;
  tour: string;
};

export const CAMERA_TOOLBAR_COPY: Record<"zh" | "en", CameraToolbarCopy> = {
  zh: { toolbar: "视角", zoomOut: "缩小", zoomIn: "放大", zoom: "缩放", rotateLeft: "向左旋转", rotateRight: "向右旋转", reset: "复位视角", pan: "平移", harbors: "港口", tour: "环岛游览" },
  en: { toolbar: "Camera", zoomOut: "Zoom out", zoomIn: "Zoom in", zoom: "Zoom", rotateLeft: "Rotate left", rotateRight: "Rotate right", reset: "Reset view", pan: "Pan", harbors: "Harbors", tour: "Island tour" },
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
    <div aria-label={copy.toolbar} className="g3d-camera-toolbar" data-testid="g3d-camera-toolbar" role="toolbar" style={barStyle}>
      <button aria-label={copy.zoomOut} onClick={() => api.zoomOut()} style={buttonStyle} title={copy.zoomOut} type="button">
        {ICONS.zoomOut}
      </button>
      {!compact && <input
        aria-label={copy.zoom}
        max={Math.round(state.maxZoom * 100)}
        min={Math.round(state.minZoom * 100)}
        onChange={(event) => api.setZoom(Number(event.currentTarget.value) / 100)}
        step={5}
        style={{ width: 56, accentColor: BRASS, cursor: "pointer", opacity: 0.85 }}
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
      <span aria-hidden="true" style={dividerStyle} />
      <button
        aria-label={copy.pan}
        aria-pressed={state.panMode}
        onClick={() => api.setPanMode(!state.panMode)}
        style={state.panMode ? pressedStyle : buttonStyle}
        title={copy.pan}
        type="button"
      >
        {ICONS.pan}
      </button>
      <button aria-label={copy.harbors} onClick={() => api.showHarbors()} style={compact ? buttonStyle : wideButtonStyle} title={copy.harbors} type="button">
        {ICONS.harbors}
        {false && <span>{copy.harbors}</span>}
      </button>
      <button
        aria-label={copy.tour}
        aria-pressed={state.touring}
        onClick={() => api.tour()}
        style={state.touring ? { ...(compact ? buttonStyle : wideButtonStyle), ...pressedOverlay } : compact ? buttonStyle : wideButtonStyle}
        title={copy.tour}
        type="button"
      >
        {ICONS.tour}
        {false && <span>{copy.tour}</span>}
      </button>
    </div>
  );
}
