# T164 — H02 shadow residual under dark-clamp

| 字段 | 值 |
| --- | --- |
| 来源 | T161 H02 guard soft（mean≈3.95） |
| 层 | **共享呈现** |
| 状态 | **关（像素门过）** |

## 差距
夹紧 H04 过暗后 H02 route residual 像素门偏弱；下一刀 route/halo 再抬，勿毁 T161 upper-ink 变亮与 T157 ink。

## 结果（本刀）
- H02 wide vs tip: mean **8.04** · ge20 **14.49%** → **PASS**
- H04 upper-ink：not_darkened_vs_t161 · vs_t158 lighter_ok
- T157 abs calm 保住
- 手段：route softContactShadow usable*1.45 / opacity 0.70（不改 T161 mid blot）
