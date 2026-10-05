# Prompt trace 约定（G3D）

每一次关键 C2C / Codex / goal-mode 会话的提示词与决策轨迹写入本目录，作为可检索的工程证据。聊天记录不是可靠存档。

## 命名

```text
YYYY-MM-DD-G3D-xx-short-slug.md
```

- `YYYY-MM-DD`：会话开始日（Asia/Shanghai）。
- `G3D-xx`：主任务 id；跨任务或 bootstrap 会话用明确 slug（如 `bootstrap`、`M0`）替代数字位。
- `short-slug`：英文短横线小写，说明本刀主题。

示例：`2026-10-05-bootstrap-handoff.md`、`2026-10-06-G3D-01-adr-0014.md`。

## 每个文件必填字段

| 字段 | 说明 |
| --- | --- |
| goal | 本刀目标与成功标准 |
| tool | `C2C` / `Codex` / `goal-mode`（可多选，写明主通道） |
| prompts used | 关键提示词全文或可复现摘录；含系统约束与用户硬约束 |
| decisions | 拍板项、取舍理由、明确不做的事 |
| outcomes | 产物路径、测试结果摘要、未完成项 |
| links | 关联 PR URL、issue、Notion 任务、commit SHA |

推荐用二级标题按上表顺序组织，便于 diff 与检索。

## 禁止入库

- 实机 / 模拟截图、录屏、原始日志、`.env`、密钥、token。
- 大段无关聊天全文。

上述证据贴在对应 **PR 评论**，本目录只保留可阅读的决策与提示词轨迹。

## 何时写

- 每个 coding 刀开始前或结束后各写 / 更新一份。
- 里程碑出口评审前补齐本里程碑全部轨迹索引。
- Bootstrap / 交接刀也要写（见本目录既有 handoff 文件）。
