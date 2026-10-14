# GoDesk 硬度套件（hardness）

验收对象：**插件管线**（NL → 内核配置 → 呈现 → 迭代），不是潮阵/赛博样例抛光。  
权威验收规格：[ACCEPTANCE.md](./ACCEPTANCE.md)。指针：[`docs/hardness-acceptance.md`](../hardness-acceptance.md)。

## 套件索引

| ID | 目录 | 形态 | 题材 | 主要压测层 |
| --- | --- | --- | --- | --- |
| H01 | [suites/H01-ash-mercenaries](./suites/H01-ash-mercenaries/) | 完整规则书 | 灰烬佣兵团（奇幻自走棋，非潮汐名） | 内容生成 / 呈现 |
| H02 | [suites/H02-starport-convoy](./suites/H02-starport-convoy/) | 规则书 | 星港车队（物流路线） | 解析 |
| H03 | [suites/H03-dark-harbor-auction](./suites/H03-dark-harbor-auction/) | 规则书 | 暗港拍卖 | 解析 |
| H04 | [suites/H04-dialogue-autobattler](./suites/H04-dialogue-autobattler/) | 12 轮对话 | 灰烬风格自走棋逐步加内容 | 迭代 / 内容生成 |
| H05 | [suites/H05-hard-coop-puzzle](./suites/H05-hard-coop-puzzle/) | 规则书（故意难） | 雾林协奏合作解谜 | 解析假阳性 |

每套含 `INPUT.md`、`SUCCESS.md`、`README.md`。

## Loop 协议

1. **跑套件**：Playwright 只点本地插件 UI；证据仓外 `/workspace/g3d-evidence/godesk-YYYY-MM-DD/hardness/H0N-runK/`。
2. **记失败层**：解析 | 内核配置 | 内容生成 | 呈现 | 迭代（见 ACCEPTANCE §4）。
3. **开票**：`tickets/T###-....md`（层、复现输入、期望、最小通用修法；禁止样例特例）。
4. **只改这一处通用引擎缺口**（本 worktree）；禁止 Collecta、禁止 merge main、禁止 Cloud Agent。
5. **重跑该套件 + 已通过套件回归**；运行摘要进 `runs/`。
6. **不自宣达标**；每完成一轮（尤其 H01 首轮）交给大主管裁定下一刀。

停止条件：用户喊停，或全部套件稳定通过。

## 证据与运行记录

- 仓外截图/日志：`/workspace/g3d-evidence/godesk-2026-10-14/hardness/`
- 仓内指针：`docs/hardness/runs/*.md`（ticket id、证据路径、层结论；无 PNG）
