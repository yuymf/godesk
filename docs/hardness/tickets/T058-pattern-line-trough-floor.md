# T058 — pattern 行槽改槽道（非圆坑）+ 地板行

| 字段 | 值 |
| --- | --- |
| 回归靶 | H04 before/after lines-close；unit trough ≠ wall-slot；T036/T047/T050/T054 绿 |
| 层 | **共享呈现** |
| 状态 | **关** |
| tip | `e9afddd` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t058/` |

## 问题
Pattern 行 1–5 空槽呈圆坑；需可读槽道条带，并露出地板行。

## 实现（通用）
1. `line-trough` 网格：拉长凹陷条；空行仅槽床、满格仍 glazed-tile。
2. 席位地板行 trough。与 T054 墙印花方格区分。
3. **不**自宣 ≥9。

## 验收
- [x] H04 lines-close before/after
- [x] unit line trough ≠ wall-slot round pit
- [x] T036/T047/T050/T054 guards green
