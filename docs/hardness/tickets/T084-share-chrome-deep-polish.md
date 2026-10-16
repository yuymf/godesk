# T084 — share chrome deep polish

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01–H03（+H04）chrome before/after；feedback collapsed；action log 不夺桌；shareReady；hasDevTone=false |
| 层 | **共享呈现 / Room chrome** |
| 状态 | **关** |
| tip | `e4d6c29` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t084/` |

## 问题
T080 后行动记录/行动条仍易夺桌面；分享条可再收。

## 实现（通用）
1. tabletop 入座：action-log 默认折叠；desk-action-drawer 更薄 chip。
2. 保留 copy-link + shareReady；feedback off-table；无 raw localhost。
3. **不**自宣 ≥9。
