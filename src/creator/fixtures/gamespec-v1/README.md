# GameSpec v1 存储样本（G3D-12 迁移回归用）

本目录的 JSON 是 2026-10-06 在 `origin/main` @ `f13c8ce`（GameSpec `schemaVersion: 1`）上，
通过本地 Worker（`wrangler dev --local`）+ MCP 插件路径真实生成并读回的存储记录，未手工改写：

| 文件 | 来源路径 | Kernel | playSurface.kind |
| --- | --- | --- | --- |
| `nl-othello.rule-system.json` / `nl-othello.build.json` | NL 生成 →批准 →编译 | `disc-flipping-v1` | `table` |
| `nl-hex-settlement.rule-system.json` / `nl-hex-settlement.build.json` | NL 生成 →批准 →编译 | `hex-settlement-v1` | `table` |
| `rulebook-worker-placement.rule-system.json` | 规则书导入（`sourceKind: rulebook`）→批准 | `worker-placement-v1` | `table` |
| `template-harbor-13.rule-system.json` | 模板导入（`templateId: harbor-13`，无 `generation` / `gameSpec` 的旧记录） | `harbor-voyage-v1` | `table` |
| `nl-shared-goal.rule-system.json` | NL 生成 →批准（非空间体裁） | `shared-goal-v1` | `screen` |

它们都带 v1 的 `presentation.theme`，且没有 `render`。迁移测试要求：读入后得到 GameSpec v2、
空间体裁补齐默认 `render`、`theme` 被删除、`validateGameSpec` / `ruleSystemSpecIssues` 通过。
