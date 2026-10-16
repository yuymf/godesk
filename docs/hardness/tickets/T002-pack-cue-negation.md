# T002 — pack cue 命中否定句「非赛博机甲」

| 字段 | 值 |
| --- | --- |
| 套件 | H01-ash-mercenaries（run2） |
| 层 | **内容生成（content / packs）** — `resolveAutoBattlerPack` cue |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness/H01-run2/` |
| 项目 | `project_90f02eae-d036-49c5-887d-32d8d1b25dd1` |

## 复现

规则书正文写「非潮汐、非赛博机甲」「不得使用…赛博机甲默认名」。  
`resolveAutoBattlerPack` 的 cyber `cues: /机甲|赛博|…/` 仍命中 → branding「机甲自走棋」、单位钻头机兵。

## 期望

否定语境（非/不是/不要/别用/禁止/不得… + cue）**不**选该 pack；无正向题材 cue 时回落默认 pack（tide），并继续把规则书单位表列为未执行（由后续票处理整表摄入）。

## 最小通用修法

`resolveAutoBattlerPack`：cue 命中时检查命中位置前是否紧邻否定词；是则跳过。不绑灰烬/潮阵名字。单测：含「非赛博机甲」的自走棋想法 → 非 cyber。

## 实现注记
短窗（8 字）+ 同句回溯到上一句号/换行，覆盖「非赛博机甲」与「不得使用…赛博机甲默认名」。
