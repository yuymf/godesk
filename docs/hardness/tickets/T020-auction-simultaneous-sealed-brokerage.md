# T020 — auction-bidding：同时密封 + 多方经纪

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05（及 H01 多方经纪若共享） |
| 层 | **内核**（auction-bidding-v1） |
| 状态 | **开** |
| 证据 | （待） |

## 现象（Open · regress-t015）
gallery：open / sealed（序贯）/ fixed / double + 行情卖出 + 轮初补牌 + 2–5 席已有。诚实 unsupported：**同时实时密封**、**多方经纪**。

## 期望（通用能力）
1. **Simultaneous sealed**：同一拍卖步全员同时提交密封价，同时揭示比价；非轮流密封。
2. **Multi-party brokerage**：多于买卖两方的中介/分成或多人竞价成交规则（通用参数，非题材剧本）。

## 验收
- 冷启动 H05：上述能力可执行或 unsupported 精确收窄；floors 不回退。
- 单元：同时密封比价至少 1 绿；经纪路径至少 1 绿。
- harbor / 已有 gallery 模式不回归；无样例 IP 特判。

## Out of scope
- 重做 open/fixed/double；Collecta；合 #179
- hex 国内拍卖若需独立票，可挂本票「共享成交原语」备注，不写样例名进验收句

## 相关
- 回归靶：H05
- 前序：T012 gallery 模式、T015 席位/双画/补牌
