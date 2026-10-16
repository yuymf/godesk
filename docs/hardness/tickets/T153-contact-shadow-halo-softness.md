# T153 — contact-shadow halo softness

| 字段 | 值 |
| --- | --- |
| 回归靶 | T150 halo polish → softer stepped falloff |
| 层 | **共享呈现** · softContactShadow |
| 状态 | **关（soft H04/H02）** → Open T154 |

## 实现（通用）
- 更轻 mid halo + 更宽 soft veil；card/tile soft footprints
- 保 T106 boost clamp / core / H02 floors（guard）

## Gate
H03 PASS；H04/H02 soft residual → T154
