# T005 — Shell 标题来自规则书题名，而非写死「潮阵」

| 字段 | 值 |
| --- | --- |
| 层 | **呈现（presentation / theme / branding）** |
| 复现 | H01 灰烬规则书生成后 HUD 仍显示「潮阵」/「汐屿·我方」 |
| 期望 | `branding.title`（及规则书写明的席位名）来自 H1 / 「产品称呼」；短 prompt 无题名时才回落 pack 默认 |
| 最小通用修法 | `inferBrandingFromRulesBook` + generate 路径写入 `configure_auto_battler.config.branding` |
| 状态 | **已实现**（与 T004 同轮） |
