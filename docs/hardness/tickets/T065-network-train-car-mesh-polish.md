# T065 — network train car mesh polish

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 force-claim after map-close；彩车可读；unit |
| 层 | **共享呈现**（network rolling-stock） |
| 状态 | **开** |
| tip | `cffabd9` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t065/` |

## 问题
T062 彩车已上主视，但车体仍是方糖盒。

## 实现（通用）
1. 车厢：窗洞/底盘/车钩可读，沿轨道；禁纯色实心盒。
2. **不**自宣 ≥9。
