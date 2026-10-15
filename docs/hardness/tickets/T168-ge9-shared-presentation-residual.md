# T168 — ≥9 共享呈现：canvasShare / chrome collapse

| 字段 | 值 |
| --- | --- |
| 来源 | T167 全景 · H01 侧栏/底栏偏重；H02–H05 share≈0.78 |
| 层 | **共享呈现（CSS chrome + meeple 台座收敛）** |
| 状态 | **关（share 抬升）** |

## 可验目标
- 抬 **H02–H05 canvasShare**（相对 tip `b533fd7` / H0x-t167）
- 抬 **H01 桌面占比**：侧栏/底栏更窄、半透明，不淹 tabletop-3d
- `is-chrome-collapse` 仍在；禁止样例特判
- 保 T157 / T161 / T164 / T166 方向

## 不做
不自宣 ≥9；不合 main；#179 draft

## 结果
| suite | tip→after share |
| --- | --- |
| H01 | 0.8091→**0.8345** |
| H02–H05 | 0.78→**0.88** |
chrome-collapse OK；T157/T161 方向保住。
