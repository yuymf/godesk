# T091 — hex share chrome parity

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 shareReadyVisible + copyLink；无 raw localhost；hasDevTone=false；feedback/action-log 默认折叠 |
| 层 | **共享呈现 / Room chrome** |
| 状态 | **证据齐，待主管裁** |
| tip | `7be79be` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t091/` |

## 问题
T084 后 H01 hex immersive shareReadyVisible=false（债）。

## 实现（通用）
1. shareChromeCompact 覆盖 hexSettlement 入座。
2. 入座 hex 显示折叠 share/seat 条；action-log 默认折叠抽屉。
3. **不**自宣 ≥9。
