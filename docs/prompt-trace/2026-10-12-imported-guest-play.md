# 2026-10-12 — #160 follow-up: imported models for share guests + /play

## Goal

Fix known limits from #160 (GoDesk ② CC0 GLB pull):

1. Share-link guests can load imported GLB via `imported-blob`.
2. `/play/<build>` preview no longer skips imported models.

## Root cause

- Guest ACL: `isPublicShareApi` excluded `/api/projects/*`; room/build share tokens omitted `project`; `getImportedSceneModels` did not pass `share=`.
- `/play`: `PlayablePreview` / `HexSettlementScenePreview` never fetched or passed `importedModels`.

## Fix

- Mint `project` into room/build share tokens; allow GET `view=imported-assets|imported-blob` for share guests (legacy tokens resolve project via session/build DO lookup).
- Client passes `shareToken` into list + blob URLs; `/play` loads imported models into SceneHost.

## Out of scope

- Production sidecar absence (unchanged).
- Collecta CWS bump (frozen).
- Do not merge; draft PR only. #163 untouched.
