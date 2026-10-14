# T045 — 共享席位现金/分值离桌面调试字

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05 close；H03/H04 smoke |
| 层 | **共享呈现**（seat economy marker / labels） |
| 状态 | **关** |
| tip | （feat commit 后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t045/` |

## 实现（通用）
1. 禁止桌面持久半透明分值/现金字（mapper 过滤 + 布局去 tip）。
2. 现金 → 可数筹码塔；席位筹码进 HUD。
3. 无样例特判。**不**自宣 ≥9。

## 验收
- [x] H05 before/after close
- [x] H03/H04 smoke
- [x] 单测无 billboard 分值 token
