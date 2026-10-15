# T166 — H01 wide + H03 seat-close consistency residual

| 字段 | 值 |
| --- | --- |
| 来源 | T165 soft · H01 wide / H03 seat-close+wide |
| 层 | **共享呈现** |
| 状态 | **关（像素门过）** |

## 差距
跨 suite 共享 chrome/rim 后 H02/H04/H05 已过门；H01 wide 与 H03 seat-close/wide 相对 tip 仍 < mean≥5 OR ge20≥5%。继续抬共享 rim/lighting 一致性，禁止样例特判。

## 结果（本刀）
- H01 wide：mean **7.05** · ge20 4.09% → **PASS**（mean 门）
- H03 wide：mean **23.22** · ge20 **20.55%** → **PASS**
- H03 seat-close：mean **48.97** · ge20 **38.83%** → **PASS**
- Guards：H02 residual 仍在；H04 upper-ink lighter_ok；T157 abs calm
- 手段：SCENE_TOKENS rim/exposure + HEX sun/rim/exposure + dual-lip outer rail + meeple scale 2.15（共享）

