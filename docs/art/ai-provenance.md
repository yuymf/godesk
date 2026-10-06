# AI 生成美术资产来源记录（G3D-ART）

- 决策：用户 2026-10-06 11:08（Asia/Shanghai）允许汐屿美术使用 AI 生图；**G3D-17 正式上线前须完成法务审查**。
- 许可证 id：`LicenseRef-AI-Generated`（已加入 `scripts/verify-assets.mjs` 白名单；CI 对每条此类资产输出 warning「法务审查: 待 G3D-17」，不失败）。
- 生成工具：Grok Bot GenerateImage（工具返回名；底层模型名未返回）。生成日期：2026-10-06（11:10–11:15 Asia/Shanghai）。
- 输入：仅文本提示词；无任何参考图输入；**未使用任何第三方图像**，也未临摹。
- 原始输出：均为 1280x720 JPEG（工具忽略宽高比参数）。原始 JPEG 与生成清单不入库，保存在工作机 `/workspace/g3d-evidence/G3D-ART/raw/`。
- 后处理脚本：`scripts/process-ai-art.py`（裁切、无缝化、法线/ORM 推导、键出 alpha、9-slice 重建、toktx/WebP 压缩）；登记脚本：`scripts/register-ai-art.mjs`。
- 每个文件的逐行记录（工具、完整提示词、日期、后处理、`法务审查: 待 G3D-17`）见 `assets/LICENSES.md` 中 `LicenseRef-AI-Generated` 行。
- 注：原清单说明卡片/图标/筹码面使用的是“去掉部分色值的同风格变体”STYLE；下表按原清单文字展开 STYLE 全文记录。

公共风格后缀 STYLE：Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game.

贴图公共前缀 TEX：Seamless tileable square texture, orthographic top-down albedo only, no lighting direction, no baked shadows, no border, evenly distributed detail across the whole square, edges wrap seamlessly: 

## 提示词全文

| id | 原始文件 | 完整提示词 |
| --- | --- | --- |
| S1 | `S1-style-terrain-sheet.jpg` | Style board sheet: six flat-topped hexagonal terrain tiles viewed straight top-down on a neutral parchment background, arranged in a 3x2 grid: pine forest, rolling pasture with tiny sheep, golden wheat fields, terracotta clay hills, grey ore mountain with rocky peaks, sandy desert dunes. Crisp silhouettes, slight bevel. Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game. |
| S2 | `S2-style-sea-harbor.jpg` | Top-down view of a calm turquoise sea with soft stylised wave ripples, a small wooden harbor pier with rope posts at one edge, shallow sandy shoal gradient near the shore. Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game. |
| S3 | `S3-style-hud-card.jpg` | Game UI style sample: a minimal parchment panel frame with thin teal ink double border, small wave-motif corner ornaments and rounded corners, plus a vertical playing-card frame with a blank empty illustration window, flat front view, centered, interiors completely empty. Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game. |
| S4 | `S4-style-resource-icons.jpg` | Set of five game resource icons in a single row on a plain flat parchment background: a bundle of logs (wood), a stack of terracotta clay bricks, a fluffy wool bundle, a golden wheat sheaf, a chunk of blue-grey ore crystal. Bold silhouettes, thick soft outline, readable at 32px, evenly spaced. Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game. |
| T1 | `T1-forest.jpg` | Seamless tileable square texture, orthographic top-down albedo only, no lighting direction, no baked shadows, no border, evenly distributed detail across the whole square, edges wrap seamlessly: dense stylised pine and broadleaf forest canopy clusters seen from directly above, with small gaps of mossy ground. Hand-painted stylised board-game look, palette moss green #6E9A4A, deep pine green, sea teal accents. |
| T2 | `T2-pasture.jpg` | Seamless tileable square texture, orthographic top-down albedo only, no lighting direction, no baked shadows, no border, evenly distributed detail across the whole square, edges wrap seamlessly: soft green grass meadow seen from directly above with small clover patches and tiny scattered wildflowers. |
| T3 | `T3-fields.jpg` | Seamless tileable square texture, orthographic top-down albedo only, no lighting direction, no baked shadows, no border, evenly distributed detail across the whole square, edges wrap seamlessly: golden wheat field seen from directly above, parallel rows of ripe wheat with subtle variation in ripeness. |
| T3b | `T3b-fields-clumps.jpg` | Seamless tileable square texture, orthographic top-down albedo only, no lighting direction, no baked shadows, no border, edges wrap seamlessly: a ripe wheat field seen from directly above as irregular organic clumps of wheat ears and stalk tufts scattered in random directions, NO rows, NO stripes, NO parallel lines, with small patches of lighter straw and a few tiny red poppies, uneven natural variation in gold tones. Hand-painted stylised board-game look, clean readable shapes, palette wheat gold #E3B341, warm ochre, pale straw, tiny touches of moss green. No text, no logos, no watermark. |
| T4 | `T4-hills-clay.jpg` | Seamless tileable square texture, orthographic top-down albedo only, no lighting direction, no baked shadows, no border, evenly distributed detail across the whole square, edges wrap seamlessly: terracotta clay earth seen from directly above with shallow terrace lines, small clay pits and sparse dry grass tufts. |
| T5 | `T5-mountain-ore.jpg` | Seamless tileable square texture, orthographic top-down albedo only, no lighting direction, no baked shadows, no border, evenly distributed detail across the whole square, edges wrap seamlessly: grey-blue rocky mountain ground seen from directly above with angular stones, scree and faint bluish ore veins. |
| T6 | `T6-desert.jpg` | Seamless tileable square texture, orthographic top-down albedo only, no lighting direction, no baked shadows, no border, evenly distributed detail across the whole square, edges wrap seamlessly: warm desert sand seen from directly above with soft wind ripples and small scattered pebbles. |
| T7 | `T7-sea.jpg` | Seamless tileable square texture, orthographic top-down albedo only, no lighting direction, no baked shadows, no border, evenly distributed detail across the whole square, edges wrap seamlessly: turquoise ocean surface seen from directly above with stylised soft wave ripple lines and gentle colour variation, no land, no objects. |
| T8 | `T8-harbor-planks.jpg` | Seamless tileable square texture, orthographic top-down albedo only, no lighting direction, no baked shadows, no border, evenly distributed detail across the whole square, edges wrap seamlessly: weathered wooden dock planks seen from directly above, parallel boards with small nail heads and wood grain, teal-grey weathered wood. |
| C1 | `C1-resource-wood.jpg` | Vertical card illustration: misty pine grove on a small island hill, freshly cut logs stacked in the foreground, sea glimpsed behind. Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game., full-bleed, no frame |
| C2 | `C2-resource-brick.jpg` | Vertical card illustration: terracotta clay hills on a coastal island with a small brick kiln and neatly stacked bricks in the foreground. Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game. |
| C3 | `C3-resource-sheep.jpg` | Vertical card illustration: salt-grass coastal meadow on an island with a few fluffy sheep grazing, calm sea and sky behind. Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game. |
| C4 | `C4-resource-wheat.jpg` | Vertical card illustration: golden wheat terraces on an island slope with tied sheaves in the foreground and the sea in the distance. Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game. |
| C5 | `C5-resource-ore.jpg` | Vertical card illustration: grey reef-rock sea cliffs with glowing pale blue ore veins and a small wooden mine cart on rails, waves below. Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game. |
| C6 | `C6-dev-fog-signal.jpg` | Vertical card illustration: a small island lighthouse whose beam pierces coastal fog at dusk, a small sailing boat approaching. Original stylised board-game art, warm soft daylight, gentle soft-PBR shading, hand-painted look with clean readable shapes, cohesive palette (sea teal #2E7F86, sand #E8D3A2, moss green #6E9A4A, wheat gold #E3B341, clay terracotta #B8643C, slate grey-blue #7A8794, parchment #F3E7C9), no text, no letters, no logos, no watermark, not resembling any existing commercial board game. (soft dusk light) |
| N1 | `N1-number-token.jpg` | Top-down round game token face centered on a plain flat background: cream parchment disc with a thin terracotta rim and a subtle embossed wave ring near the edge, the center completely empty and plain for a number to be printed later. |

## 用途映射

- S1：风格样本（不入运行时）
- S2：风格样本（不入运行时）
- S3：HUD 面板框 / 卡框
- S4：资源图标 ×5
- T1：t01-pine
- T2：t03-meadow
- T3：已弃用（平行麦垄平铺过于规整，G3D-ART-2 由 T3b 取代）
- T3b：t04-wheat（2026-10-06 12:05 生成）
- T4：t02-clay
- T5：t05-reef
- T6：t06-sand
- T7：未使用（海面为自研 shader）
- T8：t08-wood
- C1：resource-wood
- C2：resource-brick
- C3：resource-sheep
- C4：resource-wheat
- C5：resource-ore
- C6：dev-fog-signal
- N1：t11-parchment（3D 筹码面）+ UI 筹码面
