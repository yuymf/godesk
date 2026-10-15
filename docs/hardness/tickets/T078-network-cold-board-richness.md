# T078 — network cold board richness

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 cold stage + force-claim；pixel vs empty-board；cars/bogies 不回退 |
| 层 | **共享呈现** |
| 状态 | **开** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t078/` |

## 问题
network-route 冷桌未认领路段过秃。

## 实现
1. 未认领轨：加强 ballast/sleeper，或站间装饰信号杆（非假车）。
2. **不**改 claim 语义 / 不造假 claimed cars。
3. **不**自宣 ≥9。
