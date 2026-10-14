# T055 — gem 席位宝石银行落桌可数

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 seat-close gems>0→nodes；可与 T053 force-buy 同跑；他套 smoke |
| 层 | **共享呈现**（seat gem stacks） |
| 状态 | **关** |
| tip | `19594e6` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t055/` |

## 问题
席位持有宝石需落在席前桌面可数堆叠，不能只在中央银行。

## 实现（通用）
1. 沿用 T052 `seatTableauOrigin` 席前 gem stacks（T036/T052 已映射）。
2. Room：force-buy 后 gems>0 的 seat-close 实证（可共享 T053 inject）。
3. **不**自宣 ≥9。

## 验收
- [x] H03 seat-close gems 可数
- [x] unit seat gems>0 → resource nodes
- [x] 他套 smoke
