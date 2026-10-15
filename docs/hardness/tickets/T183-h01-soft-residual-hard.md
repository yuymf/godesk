# T183 · H01 soft residual → hard（shared presentation）

**Baseline tip:** `c6cbe75`  
**Status:** Done（hard gate）· 证据未入库

## 门

| 项 | 结果 |
|---|---|
| H01 wide mean_abs / ge20 | **39.45 / 56.45%** · hard PASS（mean≥5 OR ge20≥5%） |
| H01 seatClose | 39.76 / 59.45% · hard |
| H01 canvasShare | **0.88** ≥0.88 |
| chrome | `--tw-side:40px` / `--tw-dock:14px` |
| H02–H05 share | ≥0.88 · wide hard vs tip |
| 禁止 soft 收票 / hex 样例特判 | 遵守 · 只动共享层 |

## 改动（共享引擎/呈现）

- `tokens.ts` · `TERRAIN_MATERIALS` chroma + `HEX_ISLAND_LIGHTING` stage-wide
- `materials.ts` · `TERRAIN_SATURATION = 1.28`
- `water/mesh.ts` · DEFAULT_SPEC shallow/deep
- `render-spec.ts` · hex/harbor water + hex materials/lighting（kernel family）
- `pieces.ts` / `tabletop-objects.ts` · meeple/felt weave

## 守卫

- T036/T047 绿
- T157 H05 close_calm_ok
- T161：本票 H04 vs tip(t182) upper +1.37（soft note）；**T184 t161-guard vs T161 tip lighter_ok**
