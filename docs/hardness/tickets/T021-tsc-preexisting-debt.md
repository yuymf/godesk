# T021 — `tsc -b` 预存债（auction / hex / job-runner）

| 字段 | 值 |
| --- | --- |
| 层 | **工程 / 类型债** |
| 状态 | **开 · 未排刀** |
| 优先级 | 低（不阻塞 hardness 内核刀） |

## 现象
`feat/tide-arena-v0` 上 `pnpm build`（`tsc -b && vite build`）仍有预存 TS 错误，与单次 hardness 内核能力无关。冷跑常用路径：`vite build` + node22 `wrangler dev`。

已知簇（示例，以当次 `tsc -b` 为准）：
- `auction-bidding.ts`（status / GalleryAuctionMode）
- `hex-settlement` / `ReplayView` / `RoomView` / `hex-settlement-session`（pendingTrade 等）
- `worker/job-runner.ts`（RuntimeConfigureOperation 联合赋值）
- 若干 `node:fs` 测试类型、unused bot import

## 期望
清到 `pnpm build` 绿；不借机合 #179；不改玩法验收口径。

## Out of scope（本票）
- 不排进 T017–T020 内核刀序列
- 不为通过类型检查放宽 hardness SUCCESS

## 相关
- 大主管裁定 2026-10-14：先记票、先不排刀
