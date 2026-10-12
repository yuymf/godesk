# 2026-10-12 — Harbor / Worker / Othello `importedModels` parity

## Goal

HarborVoyage, WorkerPlacement, and Othello paths fetch imported GLB with shareToken into SceneHost / TabletopStage (guest room + /play + /replay).

## Root cause

`RoomView` / `PlayablePreview` / `ReplayView` already fetched `importedModels` (after #164/#165) but only passed them to HexSettlement / NetworkRoute. HarborVoyageBoard / WorkerPlacementBoard / OthelloBoard mounted `TabletopStage` without the prop.

## Fix

Add optional `importedModels` to the three boards → `TabletopStage` (same as NetworkRouteBoard). Pass from RoomView, PlayablePreview, ReplayView.

## Base

Stacked on `feat/imported-replay` (#165 = rebased #164 + Replay) atop `origin/main` @ `6d7080e`.
Included commits from #164/#165: `d9f6c0f` (guest+/play ACL), `daefa55` (Replay).
Branch: `feat/imported-parity-hwo`. Keep #164/#165/#166 drafts; do not merge.

## Out of scope

- Production sidecar absence (unchanged).
- Collecta CWS bump (frozen).
- size+Lighthouse → full `GODESK_LAUNCH_GATE=block` (later unless trivial).
