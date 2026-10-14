# T068 — network train car bogie/wheels

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 force-claim≥2；map-close pixel；unit |
| 层 | **共享呈现**（network rolling-stock） |
| 状态 | **开** |
| tip | `1e30315` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t068/` |

## 问题
T065 有底盘/窗，但侧视/map-close 仍易读成滑块；缺轮对/转向架。

## 实现（通用）
1. 彩车：low-poly bogie（轴+双轮或简易转向架）；侧视可读为「车」。
2. 禁 pack 硬编码。**不**自宣 ≥9。
