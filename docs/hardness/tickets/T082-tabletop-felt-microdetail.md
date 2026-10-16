# T082 — tabletop felt microdetail

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02+H03+H04 stage-close 可见 weave/normal/roughness；可读性不伤；无 debug overlay |
| 层 | **共享呈现**（feltPileMaterial / materials cloth） |
| 状态 | **关** |
| tip | `f9bf087` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t082/` |

## 问题
共享绿毡偏塑料平涂，缺织纹/法线/粗糙度微细节。

## 实现（通用）
1. feltPileMaterial：weave albedo + normalMap + roughnessMap + installPattern(cloth)。
2. materials.ts cloth GLSL 加密 weave/pile。
3. **不**自宣 ≥9。
