# T092 — wood rim microdetail

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02+H03+H04 stage-close pixel mean_abs≥5 OR ge20≥5%；purge clean；不 regress T074/T086 lighting 或 T079/T081 contact shadows |
| 层 | **共享呈现**（woodRimMaterial / materials grain；felt-wood-rim / felt-wood-lip） |
| 状态 | **关**（本批落地后） |
| tip | （feat 提交后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t092/` |

## 问题
共享桌面木框（felt-wood-rim / felt-wood-lip）偏平涂塑料，缺与毡面 T082/T083 对齐的木纹/法线/粗糙度微细节；影响所有 tabletop kernels。

## 实现（通用 engine/presentation）
1. `woodRimMaterial`：longitudinal grain albedo + normalMap + roughnessMap + `installPattern(grain)`。
2. `materials.ts` grain GLSL 加密 ring/pore（桌沿可读）。
3. felt-wood-rim / felt-wood-lip 改用共享材质；保留 castShadow/receiveShadow。
4. **不**自宣 ≥9 / 收口 / SUCCESS。
