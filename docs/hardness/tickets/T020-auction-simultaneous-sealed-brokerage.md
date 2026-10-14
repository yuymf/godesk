# T020 — auction-bidding：同时密封 + 多方经纪

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05（及 H01 多方经纪若共享） |
| 层 | **内核**（auction-bidding-v1） |
| 状态 | **闭** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H05-t020/` |

## 落地
1. **Simultaneous sealed**：`allowsOffTurnAction` on play-kernel；gallery sealed 任意未提交席可 `sealed_bid`/`sealed_pass`；齐后揭示比价。
2. **Multi-party brokerage**：≥3 席时成交价次高得 `brokerSecondCutBps` 分成，余款归拍卖官（卖家）。
3. **附带**：`network-route-v1` 挂 `seat-capacity` **2–5**（H02 冷跑 pc=5）。

## 验收对照
- [x] H05 冷启动 floors 不回退；unsupported 收窄
- [x] 单测：同时密封至少 1 绿；经纪至少 1 绿
- [x] H02 席位冷跑；H01/H03 smoke
- [x] 无样例 IP 特判；未合 #179；Collecta 未动

## 仍开
- 超出 award-cut 的实时多拍经纪
- H01 复杂国内拍卖经纪
- T021 未排刀
