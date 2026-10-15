# T088 — hex desk density dressing

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 stage-wide/close；不破 T062/T067/T070；purge clean |
| 层 | **共享呈现 / terrain-props** |
| 状态 | **证据齐，待主管裁** |
| tip | `9a4f154` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t088/` |

## 问题
H01 六角桌空区仍大（T085 债）。

## 实现（通用）
1. PROP_COUNTS 抬 desert/ore/brick 密度。
2. `placeShoreDressing`：岛外空环共享 pebble/boulder/pineSmall（非汐屿包）。
3. **不**自宣 ≥9。
