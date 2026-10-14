# T044 — 共享毡面「产品绿布」材质

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 同机位 |
| 层 | **共享呈现**（MaterialLibrary / felt-inset / board cloth） |
| 状态 | **开** |
| tip | （实现后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t044/` |

## 现象
毡面 inset 仍偏泥棕硬纸板；缺产品绿呢布感。

## 实现（通用）
1. 桌面 cloth 默认饱和深绿（可主题覆盖）；roughness≈1 + 微噪声/绒感。
2. 保持木缘对比；无样例特判色。**不**自宣 ≥9。

## 验收
- [ ] H03/H04/H05 before/after
- [ ] 单测 material binding
