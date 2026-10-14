# T003 — 完整规则书单位/羁绊表未进入 content（H01 最卡层）

| 字段 | 值 |
| --- | --- |
| 套件 | H01-ash-mercenaries（run2/run3） |
| 层 | **内容生成（content / packs / units）** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness/H01-run2/`、`H01-run3/` |
| 依赖 | T001（胜负句 startHp）已修；T002（pack 否定 cue）已修 |

## 现象

粘贴灰烬规则书后：

- 解析：命中 `auto-battler` ✅
- 配置：`configure_auto_battler` + executable ✅；tuning 读到 startHp30/gold10/board 7×2 ✅；theme `ember` ✅
- **内容**：单位/羁绊仍为默认 pack 表（潮汐或机甲），规则书表「矿工/火法/…」「岩浆/岩石/暗影」全部进 `unsupported`「未执行的创作者要求」
- 迭代句「把单位池换成矿工、盾卫…并加上岩浆岩石暗影」**不改** content
- 呈现：ember 棋盘可玩一回合（run3：30→25）但品牌/名单错

## 期望

规则书中的单位表与羁绊表进入 `configure_auto_battler.config.content`（或登记为可选用 pack 后由 cue/显式选择写入），房间商店卡面显示灰烬名；未识别列如实进 unsupported。

## 候选通用修法（交大主管选一，本票不实现）

1. **Markdown/表格 → content 通用解析**（长文规则书摄入）：识别 `| name | cost | atk | hp | traits |` 与羁绊表行，生成 units/traits patch。  
2. **登记 ash pack**（cue→整表）：与 cyber 同机制；规则书仍须能覆盖/校验 pack。  
3. **迭代「整表替换」动词**：`把单位池换成 A、B、C` + `加上羁绊 X/Y` 的通用批量写入。

禁止：只为灰烬写死 if；禁止样例皮肤抛光。

## 建议下一刀

优先 **1 或 3**（不新增题材特例也能让 H01/H04 过规则忠实度）；若大主管要先扩 pack 生态则选 2。
