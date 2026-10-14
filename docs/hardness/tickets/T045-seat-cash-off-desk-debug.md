# T045 — 共享席位现金/分值离桌面调试字

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05 close；H03/H04 smoke |
| 层 | **共享呈现**（seat economy marker / labels） |
| 状态 | **开** |
| tip | （实现后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t045/` |

## 现象
半透明灰「100」字牌贴在席位旁，像调试 billboard。

## 实现（通用）
1. **禁止**桌面持久半透明分值/现金字。
2. 现金 → 可数筹码塔 **或** 仅 HUD（同 T043 phase→HUD 原则）。
3. 无样例特判。**不**自宣 ≥9。

## 验收
- [ ] H05 before/after close
- [ ] H03/H04 smoke
- [ ] 单测无 billboard 分值 token
