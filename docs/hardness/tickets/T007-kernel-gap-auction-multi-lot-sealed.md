# T007 — 暗港拍卖多拍品/密封出价超出 auction-bidding-v1（内核能力缺口）

| 字段 | 值 |
| --- | --- |
| 套件 | H03-dark-harbor-auction |
| 层 | **内核配置 / 内容**（auction-bidding 能力边界） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness/H03-run3/` |
| 裁定 | 大主管选同款最小扩 **auction-bidding-v1** |

## 实现

在不扭曲 bid/pass 语义下增加 **harbor subset**：

| 支柱 | 落地 |
| --- | --- |
| 多 lot | content 拍品牌库；成交/流拍后进入黑市再亮下一件；牌库空 → 资金最高胜 |
| 密封 | `bidVisibility: sealed`（顺序提交后结算）；H03「密封/加价」默认 **open** 加价 |
| 黑市 | `market` 阶段 `sell` / `pass_market`；`reserve × marketMult` 回笼筹码 |

诚实 unsupported：3–4 人、实时同时密封、议价交易。

## 状态

**已实现**；H03-run3 **全过**。
