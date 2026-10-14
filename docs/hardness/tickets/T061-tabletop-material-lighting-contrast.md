# T061 — tabletop material/lighting contrast

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01–H05 Room stage 各一帧 vs 前 tip；守卫不断；禁单主题贴图特例 |
| 层 | **共享呈现**（MaterialLibrary + lighting） |
| 状态 | **关** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t061/` |

## 问题
五套可玩但材质/光影平；卡/宝石/釉/框画对比弱。

## 实现（通用）
1. 抬 specular/albedo 对比与阴影可读；禁单主题 texture specials。
2. **仍不自宣 ≥9**。
