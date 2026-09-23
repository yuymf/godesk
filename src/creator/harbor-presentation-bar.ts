/**
 * AREA-W4-03 — settlecoast-inspired **2D** presentation bar for harbor Room.
 * Rights-safe flagship `港口十三号` must read as a harbor voyage on the invite
 * URL (token hierarchy, cargo/dock affordances, spectator landmarks).
 * Explicit non-goal: WebGL / 3D / GameFactory engine port.
 */
export const HARBOR_PRESENTATION_BAR = {
  dimensionality: "2d" as const,
  flagshipExample: "港口十三号",
  visualReference: "settlecoast",
  never: [
    "WebGL",
    "3D engine",
    "GameFactory-3D",
    "build settlecoast in 3D",
  ] as const,
} as const;

export const HARBOR_LANDMARK_TEST_IDS = {
  board: "harbor-voyage-board",
  phaseChrome: "harbor-phase-chrome",
  phaseLabel: "harbor-phase-label",
  phaseDetail: "harbor-phase-detail",
  cargoTracks: "harbor-cargo-tracks",
  cargoTrack: (cargoId: string) => `harbor-cargo-track-${cargoId}`,
  shipToken: (cargoId: string) => `harbor-ship-token-${cargoId}`,
  movementConsole: "harbor-movement-console",
  dockBoard: "harbor-dock-board",
  dockGroup: {
    货船: "harbor-dock-group-cargo",
    港口: "harbor-dock-group-port",
    船厂: "harbor-dock-group-yard",
    特殊行动: "harbor-dock-group-special",
  },
  playerLedger: "harbor-player-ledger",
} as const;

export const HARBOR_DOCK_GROUP_KIND = {
  货船: "cargo",
  港口: "port",
  船厂: "yard",
  特殊行动: "special",
} as const;
