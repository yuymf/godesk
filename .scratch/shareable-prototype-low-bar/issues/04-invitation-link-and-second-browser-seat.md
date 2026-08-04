# 04 — 邀请链接 + 第二浏览器入座同桌

**What to build:** After Visual Floor passes, the Room shows one invitation
link. A friend opens it in a second browser, claims a seat, and both players
can take turns on the executable rule subset.

**Blocked by:** 01 — 规则书单独输入 + 生成后直达可玩桌; 03 — Visual Floor：排版渲染 + 主题 kit + 分享门闩

**Status:** done

- [x] Room UI exposes a single copyable invitation URL
- [x] Share/invite controls appear only when Visual Floor / share gate passes
- [x] A second browser can open the link and claim or be assigned a seat
- [x] Each seated client submits intents for its own seat against the authoritative Room
- [x] Table State advances coherently for both browsers; replay still reconstructs the Action Log
- [x] Automated tests cover two-client seat claim and intent flow at the Room invitation seam

## Done

Room invitation URLs now lead to a seat-claiming table. Claimed browser clients
can submit only for their own seat; accepted actions remain the source for
deterministic replay reconstruction.
