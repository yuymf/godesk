# T050 — 共享 pattern 席位盘（pattern 行 + 墙格）

| 字段 | 值 |
| --- | --- |
| 回归靶 | H04 before/after seat-close；unit wall/pattern nodes |
| 层 | **共享呈现**（pattern-draft seat board） |
| 状态 | **关** |
| tip | `0442425` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t050/` |

## 问题
H04 席位像空白大理石板，不是个人 pattern 行 + 墙格。

## 实现（通用）
1. 每席：可见 pattern 行（1–5 槽）+ 5×5 墙格（空槽可读）；已贴墙砖分色可数。
2. 禁空白实心板冒充席位盘（去掉 wall:board region）。
3. 空槽 `slot` binding；满槽 glazed-tile。
4. **不**自宣 ≥9。

## 验收
- [x] H04 before/after seat-close
- [x] unit wall/pattern nodes
- [x] T036 守卫仍绿
