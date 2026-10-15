# T163 · H01/H02 seat-close product-frame residual

| field | value |
| --- | --- |
| baseline tip | `c67cde7` |
| evidence | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t163/` |
| tipSrc | `H0x-t162/*/after` (visual @ tip) |

## Pixel gate（硬约束 · 禁止 soft 收票）

| suite | crop | mean | ge20% | gate |
| --- | --- | --- | --- | --- |
| H01 | seat-close | **11.277** | **15.31** | **PASS** |
| H02 | seat-close | 4.984 | **6.10** | **PASS** |

## Guards
- H04 upper-ink vs T161：delta −1.19 · lighter_ok · not_darkened
- H04 vs T158：lighter_ok
- H05 T157 abs：185.7 → 173.7 · calm_ok

## Change（共享）
- `felt-wood-rim` dual-lip（dark undercut + bright crown + inner gold fillet）
- `felt-wood-lip` gold tint via woodRimMaterial
- hex meeple dual-lip rim + scale 1.85；`HEX_ISLAND_LIGHTING` rim 0.92 / warmer ground

未合 main。#179 draft。不自宣达标。
