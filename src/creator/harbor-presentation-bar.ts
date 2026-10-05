/**
 * AREA-W4-03 — settlecoast-inspired presentation bar for harbor Room.
 * Rights-safe flagship `港口十三号` must read as a harbor voyage on the invite
 * URL (token hierarchy, cargo/dock affordances, spectator landmarks).
 * ADR 0014 establishes Three.js 3D tables as GoDesk's default render surface.
 */
export const HARBOR_PRESENTATION_BAR = {
  flagshipExample: "港口十三号",
  visualReference: "settlecoast",
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
