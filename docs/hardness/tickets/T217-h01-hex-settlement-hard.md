# T217 · H01 soft→HARD（共享 hex/聚落/桌面部件层）

## SUCCESS
- H01 vs tip `bdbbc8a` HARD（mean≥5 OR ge20≥5%）
- H02∧H03∧H04∧H05 守 HARD
- 守卫：share 0.93/0.88、purge false、center/corner calm、T157/T161/T193/T202、continuity

## 改动（共享，无 suite fork）
- `materials.ts`：`TERRAIN_SATURATION` 1.48→1.95
- `tokens.ts`：`HEX_ISLAND_LIGHTING` + `TERRAIN_MATERIALS` chroma
- `assets/pieces.ts`：settlement/city/road/robber/meeple scales（hex 聚落可读）
- `render-spec.ts`：hex-settlement materials/lighting/bindings；network map/piece 可读性
- `tabletop-objects.ts`：felt/wood microcontrast；house mesh（桌面部件）

## 证据
`/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t217/`
