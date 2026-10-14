# T071 — room chrome production action dock

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01+H02+H03 stage before/after |
| 层 | **共享呈现 / Room chrome** |
| 状态 | **开** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t071/` |

## 问题
底栏「桌面行动（主交互在 3D；点此展开按钮）」开发腔；状态行字段堆砌。

## 实现（通用）
1. 全 kernel 生产薄行动条 / 折叠芯片文案；缩短状态行，禁 debug 堆砌。
2. 不改玩法语义。**不**自宣 ≥9。
