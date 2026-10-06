/**
 * G3D-JUDGE-PIECES · hex-scene kit, loaded lazily by SceneHost (in parallel with
 * the Tidewell GLBs, before the first hex reconcile). Everything here is used
 * only by the hex-settlement board, so the generic tabletop scenes and the
 * render3d core chunk never pay for it (own `g3d-hexkit-*` chunk, budgeted in
 * scripts/check-size-budgets.mjs).
 */
export {
  CameraDirector,
  cameraModeFor,
  framingPoints,
  islandCenter,
} from "./camera-rig";
export { DiceOverlay } from "./dice-overlay";
export { mapHexSettlementToScene } from "./mappers/hex-settlement";
export { createNumberLabelLayer, projectLabels } from "./number-labels";
export { buildLegalHitOverlays, disposeHitOverlay, disposeSharedHitResources } from "./hit-targets";
export { disposePieceGeometries, pieceGeometry } from "./assets/pieces";
export { diceTrayGeometry, dieGeometry, disposeDiceGeometries } from "./assets/dice-geometry";
