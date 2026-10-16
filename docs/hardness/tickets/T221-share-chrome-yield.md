# T221 · 分享帧 chrome 再让路（通用 HUD/底栏/落点浮层）

## SUCCESS
- H01 canvasShare ≥0.93 且不降；H02–H05 ≥0.88
- shareReady/invite purge 保持 false；twSide/Dock 不回涨（H01 16px/3px）
- 相对 tip 有可见 chrome 让路；不得靠暗暈/裁切桌面凑 HARD
- 守卫 center/corner/T157/T161/T193/T202 全绿
- 只动共享 chrome / surface.css / tidewell-game-screen；禁止 suite fork

## 数字（vs tip `8bb40c5` wide）
| suite | share | mean | ge20% | center | corner |
|-------|-------|------|-------|--------|--------|
| H01 | **0.962** | 45.71 | 53.5 | ok | ok |
| H02 | 0.88 | 25.25 | 23.3 | ok | ok |
| H03 | 0.88 | 20.48 | 25.1 | ok | ok |
| H04 | 0.88 | 17.50 | 22.3 | ok | ok |
| H05 | 0.88 | 19.12 | 25.9 | ok | ok |

purge: shareReadyVisible=false / inviteLinkRowPresent=false · tw H01 16/3 · cornerFails=0 centerFails=0 · T157/T161/T193/T202 绿

证据：`…/hardness-real/H0x-t221/`（不入库）
