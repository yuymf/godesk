# T110 — desk exterior grain continuity（T098 软续）

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02+H03+H04 stage-close；框外桌面与 rim grain 连续；不砍 T092/T098 |
| 层 | **共享呈现** |
| 状态 | **关** |
| tip | `8251050` |
| 来源 | T105 · 框外桌面仍软断层 |

## 问题
框外桌面与木缘色/光泽断层（table `#7a4e28` vs rim）。

## 实现（通用）
desk/table token 对齐 rim；共享 grain shade/normal；deskWood repeat 贴近 rim。
