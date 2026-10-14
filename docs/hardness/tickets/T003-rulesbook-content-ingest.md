# T003 — 完整规则书单位/羁绊表未进入 content

| 字段 | 值 |
| --- | --- |
| 套件 | H01-ash-mercenaries |
| 层 | **内容生成（content / packs / units）** |
| 大主管裁定 | **选 (1)** 通用「规则书表格→content」解析（不要 ash pack / 不要只做迭代换池） |
| 状态 | **已实现**（`worker/rulesbook-content-tables.ts` + `job-runner` generate 路径）；**H01-run5 规则忠实度闸口通过** |

## 修法

- 模糊对齐表头（名称/费用/攻击/生命/羁绊/外形；羁绊名/档位/效果种类/数值…）
- 解析出的 units+traits **覆盖**默认 pack content；短 prompt 仍走 pack cue
- 未识别列写入 `unsupported`（不静默丢弃）
- 单测：happy path / unknown column / empty

## 复验

证据：`/workspace/g3d-evidence/godesk-2026-10-14/hardness/H01-run5/`  
成功闸：商店为灰烬名（非钻头机兵）；羁绊岩浆/岩石/暗影；可玩 ≥1 回合。
