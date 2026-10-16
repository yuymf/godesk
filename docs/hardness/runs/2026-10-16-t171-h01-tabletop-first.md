# T171 · H01 tabletop-first / chrome 再收

| 字段 | 值 |
| --- | --- |
| 基线 | `031e9a1` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t171/` |
| 层 | 共享 chrome / hit-targets / pieces |

## 数字门
- **H01** canvasShare=0.9218 · side='80px' · dock='36px' · shareOk=True · soft=False
- **H02** canvasShare=0.8800 · side='' · dock='' · shareOk=True · soft=False
- **H03** canvasShare=0.8800 · side='' · dock='' · shareOk=True · soft=True
- **H04** canvasShare=0.8800 · side='' · dock='' · shareOk=True · soft=True
- **H05** canvasShare=0.8800 · side='' · dock='' · shareOk=True · soft=True

- H01 目标 **≥0.88**：达成（0.9218）
- H02–H05 share 地板 **≥0.88**：达成
- T161 upper-ink lighter：OK · T157 abs ink calm：OK
- T036/T047：绿（unit）

## Soft → Open
H03/H04/H05 pixel vs tip soft（chrome/meeple 改不动这些桌面的主像素）→ 诚实 Open **T174**（观感残差 backlog）。

## 实现
- `--tw-side:80px` / `--tw-dock:36px`；dock overlay；stage `minmax(88vh)`
- legal-ring opacity 0.42 / emissive 0.32 / torus 0.022
- meeple → seat tray（木托盘+chip）
