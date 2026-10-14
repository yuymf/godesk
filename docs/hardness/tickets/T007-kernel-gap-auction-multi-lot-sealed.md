# T007 — 暗港拍卖多拍品/密封出价超出 auction-bidding-v1（内核能力缺口）

| 字段 | 值 |
| --- | --- |
| 套件 | H03-dark-harbor-auction（run2） |
| 层 | **内核配置 / 内容**（auction-bidding 能力边界） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness/H03-run2/` |
| 前置 | T004 后解析正确绑 auction；本票不是误绑 auto-battler |

## 现象

H03-run2：`requestedMechanics=["auction-bidding"]`，kernel `auction-bidding-v1` executable。unsupported 已诚实写明「单笔公开加价；多拍品经济与密封出价不支持」。规则书核心仍缺：

- 多拍品牌库（24 张）连续亮拍
- 密封出价（规则写同时/密封可选）
- 黑市倍率出售套利与资金终局
- 拍品名册（暗港罗盘…）进入 content

当前只能玩「一笔公开加价/过牌、固定筹码」最小局，不是暗港规则书闭环。

## 复现

1. 粘贴 H03 INPUT → 确认 → 进房
2. 仅单 lot open raise/pass；无多 lot、无黑市阶段、无拍品 content 表

## 期望

- 扩 `auction-bidding-v1`：多 lot 队列 + 可选 sealed + 简单转售；content 吃拍品表；或
- 能力不足时勿标「核心规则已可玩」；unsupported 保持，且套件记部分过

## 最小通用修法方向

通用拍卖能力：lot queue、bid visibility（open|sealed）、post-auction economy hook；拍品 markdown/表 → content。禁止为暗港特判潮阵。

## 状态

**Open**（H03 记「部分过」：解析过；多拍/黑市核心未过）
