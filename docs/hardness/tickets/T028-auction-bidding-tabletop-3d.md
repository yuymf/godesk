# T028 — 共享 3D 桌面：auction-bidding → TabletopStage

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05（gallery 子集 · presentation / 可分享 3D） |
| 层 | **共享呈现**（复用 T026/T027 舞台约定） |
| 状态 | **闭** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H05-t028/` |

## 落地
1. `auctionBiddingLayout`：拍品(+双画)、席位筹码/手牌/收藏、画家行情 → TabletopLayout。
2. `TabletopKernelType` + `layoutForStage` 纳入 `auction-bidding-v1`。
3. `AuctionBiddingBoard` 挂 `TabletopStage`；DOM 出价控件保留；Room 透传 render。

## 验收对照
- [x] H05 冷启动：floors passed/passed；Room hasStage+canvas+`data-kernel=auction-bidding-v1`
- [x] H04 smoke：T027 不回退
- [x] 无样例特判；未合 #179；Collecta 未动；T021 未排
