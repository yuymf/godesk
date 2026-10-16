# T186 · shareReady 好友/链接条 purge

**Baseline tip:** `1e9d791`  
**Status:** Done · 证据未入库

## 门

| 项 | 结果 |
|---|---|
| shareReadyVisible | **false**（H01–H05） |
| inviteLinkRowPresent | **false** |
| H01 canvasShare | **0.9218** ≥0.88 |
| H02–H05 share | **0.88** |
| rejectedShell | false |

## 改动（共享）

- `RoomView.tsx` · seated share chrome 不挂载 invitation-heading / invitation-link-row
- `surface.css` / `tidewell-game-screen.css` · chrome-collapse 下 invite/link `display:none`
