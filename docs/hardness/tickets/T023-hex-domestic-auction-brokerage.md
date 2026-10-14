# T023 — hex-settlement：国内拍卖 / 复杂多方经纪（最小可玩子集）

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 |
| 层 | **内核**（hex-settlement-v1）及可共享的成交原语 |
| 状态 | **闭** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H01-t023/` |

## 现象
hex 已有协商国内交易 propose/accept、银行/港口、2–4 席。诚实 unsupported：**复杂多方经纪 / domestic auction**（非单纯 2 席）。

## 期望（通用能力 · 草案）
1. **Domestic auction 最小子集**：资源/发展牌等可进入公开或密封短拍，多人出价，最高者支付并获得标的（参数化底价 / 回合内次数上限）。
2. **Multi-party brokerage**：多于买卖双方的中介分成或第三人参与成交（可复用 T020 gallery award-cut 原语，不写样例名进验收句）。

## 落地
1. **Domestic sealed auction**：自有资源标的进入 `domestic_auction`；密封出价/弃权；齐后最高者支付并获得标的（底价参数化；回合内次数上限）。流拍退回托管。
2. **Multi-party brokerage**：共享 `splitBrokerageAward` / `resolveSealedBids`；≥3 席且启用 cut 时次高席获分成，余款归卖家。
3. play-kernel `allowsOffTurnAction` 允许非当前席提交密封出价。

## 验收对照
- [x] H01 冷启动：floors 不回退；unsupported 收窄为实时多拍经纪（见 T024）
- [x] 单测：国内拍卖路径 ≥1 绿；多方经纪路径 ≥1 绿
- [x] 无样例 IP 特判；未合 #179；Collecta 未动

## Out of scope
- 重做基础建造/产资源；T021；合 #179
- 全量实时议价矩阵（可后续票）

## 相关
- 前序：T014 协商交易、T019 席位、T020 gallery 经纪原语
- 回归靶：H01
