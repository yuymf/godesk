# 2026-10-12 — #160 follow-up: imported models on Replay

## Goal

Replay path (`/replay/<id>`, share guest) shows imported GLBs — assert via `data-imported-models`.

## Root cause

`ReplayView` mounted `HexSettlementScenePreview` / `NetworkRouteBoard` but never fetched or passed `importedModels` (unlike `PlayablePreview` after #164).

## Fix

Same guest ACL as #164 (already on branch). Pass `importedModels` through ReplayView → HexSettlementScenePreview / NetworkRouteBoard → SceneHost (mirror PlayablePreview wiring).

## Base

Stacked on rebased #164 (`feat/imported-guest-play`) atop `main` (includes merged #163 G3D-16). Branch: `feat/imported-replay`.

## Out of scope

- Production sidecar absence (unchanged).
- Collecta CWS bump (frozen).
- Do not merge; draft PR only. Keep #164 draft open.
- HarborVoyage / WorkerPlacement / Othello tabletop boards still omit `importedModels` props (same as PlayablePreview #164).
