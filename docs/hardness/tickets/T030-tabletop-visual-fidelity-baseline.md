# T030 — 共享 TabletopStage 视觉保真（抛光基线）

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04（及 H05）共享 3D 桌面观感 |
| 层 | **共享呈现**（`defaultRenderSpec` / `tabletop-objects` / materials） |
| 状态 | **关** |
| tip | `4686cd31ba4f4d2d43226eeed9f9cb1b1075150e` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t030/` |

## 现象
T026–T028 已挂 TabletopStage，但桌面内核默认仍偏塑料占位件（扁平盒/光材质）。总验收要画面精良基线抬升，非样例特判。

## 实现（通用）
1. gem / pattern / auction（及 generic desk）`defaultRenderSpec`：cloth/grain 材质、clearcoat 棋子、card/disc/resource/building 绑定、略近机位（fov 32 / distance 14）。
2. `geometryFor`：`card` → 圆角挤出卡牌；`disc` → 微冠筹码；`token` FALLBACK → disc。
3. `fallbackTabletopRender` 与 desk 内核对齐 bindings。
4. 单测：`render-spec-desk-t030.test.ts`；既有 tabletop 测试不回退。
5. **不**自宣产品 ≥9。

## 验收对照
- [x] H03+H04+H05 Room 同机位观感相对 T026–T028 有可辨材质/光影抬升（before=`H0x-t030/before/*`；after=`H0x-t030/H0x/15-room-stage.png`；baked render 含 cloth+card+distance≤14）
- [x] 单测不回退；无样例特判；#179 draft；Collecta/T021 未动
