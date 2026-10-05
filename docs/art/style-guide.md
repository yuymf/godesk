# 汐屿 / Tidewell Isles · 美术风格指南

| 项 | 值 |
| --- | --- |
| 文档 | `docs/art/style-guide.md` |
| 任务 | G3D-23（U-05） |
| 日期 | 2026-10-06（Asia/Shanghai） |
| 身份 | 原创「汐屿 / Tidewell Isles」；品质水位对标 settlecoast **精神**，禁止任何描摹 / 拷贝 |

## 1. 调色板（hex）

### 地表与海洋

| 角色 | Hex | 备注 |
| --- | --- | --- |
| 深潮 | `#1B4F6B` | 远海 / 水体深处 |
| 近岸青 | `#3E8C9A` | 浅水过渡 |
| 泡沫白 | `#E8F2F0` | 浪尖与岸线泡沫 |
| 松林 | `#2F5D3A` | terrain wood |
| 赭土 | `#B35A3C` | terrain brick |
| 盐草 | `#8FA86A` | terrain sheep |
| 麦垄 | `#D4A54A` | terrain wheat |
| 礁岩 | `#6B6E78` | terrain ore |
| 沙洲 | `#C9B28A` | terrain desert |

### UI 羊皮纸

| 角色 | Hex | 备注 |
| --- | --- | --- |
| 纸基 | `#E8D6B8` | U-01 纸纹主色 |
| 纸深 | `#C9B08A` | 面板阴影区 |
| 墨线 | `#2A241C` | 图标与描边 |
| 朱印 | `#A33B2B` | 强调 / 危险 |
| 铜钉 | `#8A6A3D` | 次要强调 |

### 座位色（棋子材质参数）

| 座位 | Hex |
| --- | --- |
| 0 | `#C45C4A` |
| 1 | `#3D7EA6` |
| 2 | `#D2A23A` |
| 3 | `#5B8F5B` |

## 2. 线宽与图标

- 墨线图标统一 `stroke-width: 2`（24×24 viewBox），圆角线帽。
- 禁止填充大块色块作为图标主体；允许极小实心点（骰子点、问号点）。
- HUD 面板用 U-02 撕口 mask；卡片用更窄的 card mask。
- 标题字使用 Fraunces Display（OFL-1.1，拉丁子集）；正文 / HUD 继续 Manrope。

## 3. 光照与机位参考（3D）

| 项 | 值 |
| --- | --- |
| 预设 | `tabletop-day` |
| 主光方位 | 方位角 ≈ 210°，仰角 ≈ 48° |
| 环境 | `RoomEnvironment` + 渐变穹顶（G3D-07） |
| 阴影 | high/medium：PCF 软阴影；low：512 轻阴影 |
| 审图机位 | 俯视约 55°，岛屿居中；截图 1440×900 与 390×844 |

## 4. 几何与贴图规格（摘自 SPEC §5.5）

| 类别 | 规格 |
| --- | --- |
| 地形装饰 | 见 M-02–M-07 三角形上限；打包 `decor.glb` ≤ 250 KB |
| 棋子 | 渔村 ≤ 1500、港镇 ≤ 2500、雾灯 ≤ 1500 三角形；`pieces.glb` ≤ 200 KB |
| PBR | 每套 baseColor ETC1S / normal UASTC / ORM ETC1S；512 ≤ 220 KB/套，256 ≤ 70 KB/套 |
| UI | U-01 ≤ 120 KB；U-03 ≤ 40 KB；U-04 ≤ 40 KB |

## 5. 命名与禁用

- 产品面禁用 “Catan” / 「卡坦」与 settlecoast 品牌元素。
- 术语见 SPEC §1.2（松林、赭土坡、盐草甸、麦垄、礁岩山、沙洲、渔村、港镇、栈道、雾灯、潮签、码头）。

## 6. 评审门

本指南经用户书面确认后，G3D-19–G3D-22、G3D-24、G3D-25 才开始视觉评审。
