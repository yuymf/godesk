# T044 — 共享毡面「产品绿布」材质

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 同机位 |
| 层 | **共享呈现**（MaterialLibrary / felt-inset / board cloth） |
| 状态 | **关** |
| tip | （feat commit 后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t044/` |

## 实现（通用）
1. 桌面 cloth 默认饱和深绿；roughness≈1 + pile 微噪声。
2. 木缘镂空框 + 毡面抬升（不被实心木顶盖住）。
3. 无样例特判。**不**自宣 ≥9。

## 验收
- [x] H03/H04/H05 before/after
- [x] 单测 material binding
