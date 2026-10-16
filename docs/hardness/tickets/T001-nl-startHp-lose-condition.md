# T001 — NL 将胜负句「生命…0」误读为初始生命

| 字段 | 值 |
| --- | --- |
| 套件 | H01-ash-mercenaries（run1） |
| 层 | **解析（NL / mechanics infer）** — 具体为 `parseKernelEdits` 旋钮匹配 |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness/H01-run1/`（`99-fatal.png`、`log.jsonl`） |
| 项目 | `project_7eb083b2-8a91-4acd-bd0a-0b6c730944fe`（生成 job 失败，未进 Studio） |

## 复现输入

粘贴 `docs/hardness/suites/H01-ash-mercenaries/INPUT.md` 全文到 `/chatgpt-plugin/new` →「生成可玩版本」。

规则书胜负节含：「一方生命降至 0 或以下」「终局时 HP 地板为 0」。

## 观察到的行为

UI：`生成失败: iteration_unsupported: 初始生命只能在 1-200 之间；你写的是 0。`

根因：`startHp` 旋钮 `subject: /(血量|生命|血|hp)/i` 命中「生命降至」/「HP 地板」后的数字 `0`，越界抛 `KernelTuningRangeError`，整次生成中断。

## 期望行为

- 胜负/淘汰语境中的「生命…0」**不**写入 `tuning.startHp`，也不因 0 中断生成。
- 明确的「初始生命/血量 … 30」或「血量改成 30」仍写入 `startHp=30`。
- 通用：任意规则书/对话，不绑灰烬题材名。

## 最小通用修法

在 `worker/kernel-tuning-iteration.ts` 的 `startHp` 旋钮上增加 `exclude`，排除降至/地板/淘汰等胜负语境（已有 `TuningKnob.exclude` 机制，prep 旋钮已用）。加单测覆盖「生命降至 0」不抛错、「初始生命 30」仍生效。

## 非本票

- 规则书整表单位未进 content（内容生成层）— H01 过解析后再开票。
- 样例皮肤抛光。
