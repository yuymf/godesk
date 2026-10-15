# T139 · contact-shadow-pixel-residual

| tip base | `d7ea1f6` |
| --- | --- |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t139/` |
| 层 | 共享呈现 · `softContactShadow` footprint×1.22 + opacity ceiling 0.58 / floor 0.32 + pure black |

## Gate

| suite | wide mean | wide ge20% | ok |
| --- | --- | --- | --- |
| H02 | 3.03 | 4.29 | soft residual |
| H03 | 3.64 | **5.35** | **PASS** |
| H04 | 3.84 | **5.69** | **PASS** |

Rule: mean≥5 OR ge20≥5% vs tip（T138 after）。H03/H04 过门；H02 记 soft。
Prior T106/T135/T138 opacity floors kept（boost clamp 1.02/0.68；opacity ≥0.32）。purge green。

未合 main。不自宣 ≥9。
