# T004 — 非自走棋题材（星港物流）被标成 executable auto-battler

| 字段 | 值 |
| --- | --- |
| 套件 | H02-starport-convoy（run1） |
| 层 | **解析（NL / mechanics infer）** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness/H02-run1/` |
| 项目 | `project_8aa92e0a-bd61-4e81-8247-62f1954ecca0` |

## 现象

粘贴星港车队规则书（物流路线，明确写「非自走棋默认包」）后：

- `requestedMechanics: ["auto-battler"]`
- `runtimeSupport` **executable**，kernel `auto-battler-v1`
- content = **潮阵默认表**（礁蟹…）
- 未声明「无 logistics 内核」

违反 H02 SUCCESS：不得把物流静默当成可玩自走棋闭环。

## 根因（候选）

规则书含否定句「非自走棋…」；mechanics cue `/自走棋|…/` 仍命中（与 T002 pack 否定同类问题）。亦可能其它弱 cue。

## 期望

- 否定语境下的「自走棋」不选 auto-battler；或
- 无正向自走棋玩法描述时，Plan **不**标 executable，unsupported 写明缺 logistics/route 内核。

## 最小通用修法（交裁定；本票先开票）

对 mechanics infer 应用与 T002 同类的「否定邻近/同句」过滤；并避免仅因反例字样命中。禁止为星港写潮阵皮肤。

## 状态
**已实现**；H02-run2 通过（network-route-v1）。
