# T086 — tabletop lighting layer rig

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02+H03+H04 stage-close pixel；T074 purge；不伤 T079/T081 contact shadows |
| 层 | **共享呈现 / lighting** |
| 状态 | **证据齐，待主管裁** |
| tip | `5fb9155` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t086/` |

## 问题
桌面顶光偏平，缺 soft fill / rim 层次。

## 实现（通用）
1. LightingSpec + createLightingRig：fill/rim DirectionalLight（不投阴影）。
2. desk kernels（含 network）默认开启层。
3. **不**自宣 ≥9。
