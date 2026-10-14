# T025 — hex-settlement：国内拍卖 live multi-lot + 协商经纪

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 |
| 层 | **内核**（hex-settlement-v1）复用共享成交原语 |
| 状态 | **闭** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H01-t025/` |

## 落地
1. **Live multi-lot**：复用 `auction-floor.ts`；phase `domestic_live_floor`；`floor_raise` / `floor_pass`；卖家可在 cap 内再拍。
2. **协商经纪**：`splitNegotiatedBrokerage` + `set_broker_terms` / 开拍 payload。
3. 保留 T023 密封短拍（`mode: "sealed"`）。

## 验收对照
- [x] H01 冷启动：floors 不回退；unsupported 收窄
- [x] 单测：live multi-lot ≥1 绿；协商经纪 ≥1 绿
- [x] 无样例 IP 特判；未合 #179；Collecta 未动
