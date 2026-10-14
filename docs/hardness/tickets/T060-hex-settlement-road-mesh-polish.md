# T060 — hex settlement/road mesh polish

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 after stage-close ≥2 settle+≥2 road 形态可读；unit；无 pack 特例 |
| 层 | **共享呈现**（hex piece kit） |
| 状态 | **关** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t060/` |

## 问题
T057 证明落子，但 mesh 仍像积木，远产品桌面。

## 实现（通用）
1. settlement = 可读坡顶农舍；road = 边对齐条棱；city 更高耸轮廓。
2. 禁文字标签冒充。复用 T057 force-build 取 after 镜头。
3. **不**自宣 ≥9。
