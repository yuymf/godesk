# T024 — 超出 award-cut 的实时多拍经纪

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05 |
| 层 | **内核**（auction-bidding-v1 及可共享成交原语） |
| 状态 | **闭** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H05-t024/` |

## 落地
1. **Live multi-lot floor**（共享 `src/runtime/auction-floor.ts`）：多标的可同时 `live_floor`；`floor_raise` / `floor_pass` 实时结算；拍卖官可在 cap 内再拍。
2. **Negotiated brokerage**（`splitNegotiatedBrokerage`）：显式经纪席 + 每单 cutBps，超出固定次高 award-cut。
3. Gallery 默认启用 `liveMultiLotFloor` + `negotiatedBrokerage`（≥3 席）。

## 验收对照
- [x] H05 冷启动：floors 不回退；unsupported 收窄
- [x] 单测：实时多拍 ≥1 绿；协商经纪 ≥1 绿
- [x] 无样例 IP 特判；未合 #179；Collecta 未动

## Out of scope
- T021；合 #179
- 重做 T020 密封揭示与 T023 国内短拍最小子集

## 相关
- 前序：T020 award-cut、T023 hex 国内拍卖最小子集
- 回归靶：H05
