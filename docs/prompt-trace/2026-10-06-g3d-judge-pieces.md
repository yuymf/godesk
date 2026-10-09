# Prompt trace — G3D-JUDGE-PIECES（Track C，2026-10-06）

- **用户指令（经大主管，19:43 Asia/Shanghai）**：
  - 停止条件：汐屿（Tidewell）视觉对标 settlecoast.com，按左右对照逐轮评判。AI 美术闸门豁免（来源登记在 `assets/LICENSES.md`，不阻塞）。**不得复制 settlecoast 的素材或代码。**
  - CI 因账单受阻：完整本地验证，不合入。省 Actions：文档随代码同提交，每个里程碑只 push 一次，只有冲突时才合 main，draft PR。
  - 范围 = round-1 `GAPS.md` 的 #4 / #5 / #6：
    - **棋子**：自建低多边形渔村（坡屋顶、烟囱、门窗，屋顶 / 墙为座位色）；港镇为更大的多体块建筑 / 塔楼；栈道为座位色涂装木梁；雾灯（盗贼）为兜帽斗篷人偶，待机轻微浮动，移动时沿弧线跳步；评审模式与减少动态效果下静止；能实例化的按类型实例化。
    - **骰子**：圆角 3D 骰子 + 真点数，放在岛旁木质骰盘里；先翻滚、再确定性地落到服务端点数；不用物理库；评审预设显示落定的骰子。
    - **镜头**：自动取景，桌面 / 手机都把岛放满视口；本方回合 3/4 斜视，电脑 / 对手回合平滑过渡到近俯视；尊重减少动态效果；画布上的木质 / 羊皮纸迷你工具条（缩放 −/+、滑杆、左右旋转、复位），自包含在 `render3d/overlay`，暴露小 API（Track B 在重做 HUD）；限制缩放与环绕。
  - 分支 `feat/g3d-judge-pieces` 基于 `feat/g3d-judge-r1` @ `bcfd09d`（#148），draft PR base `feat/g3d-judge-r1`。Track D 负责地形 / 岛 / 海岸 / 水；Track B 负责 DOM HUD / 布局。e2e 端口 8833。
- **代码作者**：Track C 执行代理手写（box 上 Codex 额度用尽）。
- **决策**：
  - **全部程序化几何，零外部素材**：`src/render3d/assets/pieces.ts`、`assets/dice-geometry.ts`。每个棋子由基本体拼装，转成非索引三角形（面法线 → 低多边形硬边），烘焙顶点色后合成一个 BufferGeometry。座位色在顶点色里，所以三把共享白色 `vertexColors` 材质（棋子 / 人偶 / 骰子）服务所有座位，draw call 仍是每 (类型, 座位) 一个 InstancedMesh。`assets/LICENSES.md` 规定运行时程序化几何不产生文件、不登记，故未加行。GLB 包里不再取 settlement / city / road / fog_lamp / dice / dice_tray（`model-templates.ts` 删掉死代码，decor / 羊 / 码头 / 船照旧）。
  - **比例**：按评审参照的读图比例放大（渔村约 1/5 格宽，港镇约 1/4，雾灯约 1/3 格宽高）；棋子立在格面（`TILE_TOP_Y` 0.28）上；雾灯在有点数的格子上站到筹码旁（`ROBBER_TOKEN_OFFSET`），沙漠居中。
  - **骰子**：`RoundedBoxGeometry`（three/examples）+ 几何点数（1 点红色），两枚骰子合批进 1 个 InstancedMesh（以前 2 个独立 mesh）。翻滚沿用 G3D-09 预计算曲线（`precomputeDiceTumble`，确定性），新增朝向（yaw）与从骰盘角落滑入；最后一帧精确落到服务端点数。骰盘位置随画布朝向：横屏在岛右侧偏前，竖屏在岛下方（`diceAnchorFor`）。
  - **池化补间可见性修复**：以前补间只改句柄，InstancedMesh 矩阵只有 reconcile 时才同步，池化棋子的落子 / 雾灯弧线动画其实看不见。`MotionController` 记录被补间改过的对象（`drainDirty()`，含最后一帧），SceneHost 每帧把它们的矩阵推回实例池。
  - **镜头**：`src/render3d/camera-rig.ts`。`fitDistance` 闭式求解（每点 D ≥ q·d + max(|q·r|/tanH, |q·u|/tanV)），取景点 = 全部格子六角顶点 + 港口 + 骰盘四角，目标点固定在岛中心；`CameraDirector` 管模式（play 50° / overview 9°）、缩放（拟合距离的 70%–320%）、环绕（极角 0–68°）、平移夹紧（岛半径 60% 内、贴桌面）。自动过渡走 `MotionController.camera()`，仍记 `camera` 600 ms（减少动态效果 0 ms，满足 G3D-09 e2e）；用户拖拽时停止自动过渡；`localSeat` 新 prop（HexSettlementBoard 传 `viewerSeat`）。原先建造 / 掷骰 / 雾灯时把镜头拉向棋子的 reframe 去掉（与自动取景冲突）。
  - **工具条**：`src/render3d/overlay/CameraToolbar.tsx`，内联样式 + 内联 SVG，`role="toolbar"`，放在 `role="img"` 宿主的兄弟节点（img 的子节点不进无障碍树）。API `CameraRigApi`：`zoomIn / zoomOut / setZoom / rotate(±1) / reset / getState / subscribe`；SceneHost 新增 `cameraToolbar`（默认 true）和 `onCameraApi`，Track B 可以隐藏它、用自己的 HUD 控件。窄画布（< 480 px）隐藏滑杆。
  - **评审工具**：新增预设 `a-topdown`（近俯视）和 `b-robber`（≈320% 雾灯近景）；`judge-capture.mjs` 加拍 `a3-topdown-ai-turn`、`b3-terrain-320pct-forest-sheep-robber`、`f2-dice-settled-10`；`judge-compose.mjs` 遇到与参考变体同名的截图优先配对。
  - **体积**：render3d 核心预算 210 KB 很紧。程序化几何放在 `render3d/assets/`（与 GLB 加载器同属 render3d-assets chunk），`three/examples/jsm/geometries/` 归入 render3d-assets；工具条单独懒加载 chunk `g3d-overlay-*`（新增 ≤ 6 KB 预算）；`?judge=1` 的评审机位改为懒加载 `g3d-judge-*`（dev-only，不进生产核心）。
- **跨轨道备注**（不在本刀范围）：近俯视 + 宽画布时能看到水面边缘（`WATER_HALF_EXTENT` 9）和后面的米色天空，属 Track D 的水面；建议加大水面范围或做暗角。页面截图里画布只占页面一小块，属 Track B 布局。
- **本地验证**（CI 受阻，box 负载约 20，单个 wrangler 8833）：typecheck ✓；unit 464/464；worker 210/210；e2e 58 通过 / 4 显式跳过 / 0 失败（分两次跑，最终构建上重跑 hex-settlement-motion、tabletop-3d-boards 等）；size ✓（render3d 核心 209.60 / 210 KB，工具条 1.43 KB）；verify:assets ✓；perf:ci ✓（leaks 0）。
- **Draw call（`renderer.info.render.calls`，稳态 / 峰值，预算 高 150 / 中 100 / 低 60）**：开局 高 23/41、中 23/41、低 23/35；中局 高 27/49、中 27/49、低 27/43（基线 bcfd09d 开局 24/43、中局 28/51）。三角形 ≤ 31.5k。
- **评审 round-2p**：截图与差距表只在 `/workspace/g3d-evidence/judge/round-2p/`（不进仓库）。自评：棋子 2→4、骰子 2→6、镜头 3→5；**未达标**。剩余：棋子在默认视角偏小、雾灯太暗；俯视露水面边缘；骰盘不像参照那样钉在视窗右下；工具条缺 Pan / Harbors / Island tour。
- **跨轨道备注 2**：评审拍摄时 wrangler 打出 `Uncaught Error at webSocketClose`（`worker/creator-projects-do.ts`，对已关闭的 socket 再 `close(code)`，1006 等保留码会抛错），之后 8833 不再响应、需重启。本分支未改 worker，留给 worker 负责人。

## 迭代 2（20:57 指令）
- **worker 挂死修复（单独提交）**：根因是 `webSocketClose` 把对端的关闭码原样回传给 `socket.close(code)`。浏览器直接断开（Playwright 关上下文、页面崩溃）时运行时报 1006，空 Close 帧报 1005，这些是协议保留码，`close()` 抛 `InvalidAccessError: Invalid WebSocket close code: 1006`，在 `wrangler dev` 里表现为 `Uncaught Error at webSocketClose`。兼容日期 2026-07-29 已开启 `web_socket_auto_reply_to_close`，握手由运行时完成，回传本就可选。修复：`sendableCloseCode()` 只放行 1000–1003 / 1007–1014 / 3000–4999，其余映射 1000，并 try/catch。`worker/session-socket-close.test.ts` 先复现（修复前 1005/1006/1015 三例抛错），修复后 5/5 通过。
- **用户指令（20:57）**：同分支 / 同 PR 再迭代一轮（保持 draft，最后只 push 一次，文档同提交）：① 棋子放大到默认桌面取景房屋约 22–28 px 高，烘焙 AO / 顶点色明暗 + 座位色屋顶 / 墙微染色，雾灯加浅色描边或提亮斗篷；② 骰盘钉在屏幕角（桌面右下、iPhone 手牌之上），用独立小正交叠加渲染或相机相对固定，**不改 Track B 的 DOM HUD 布局**；③ 俯视 / AI 取景永不露天空，桌面与 iPhone 都只有岛 + 海；预算允许时工具条加 平移 / 港口 / 环岛游览；④ render3d 核心 209.6 / 210 KB：懒加载或裁剪腾空间，不要只抬预算；⑤ 修 worker `webSocketClose` 挂死并补测试，单独提交。21:47 补充：中断后先本地 WIP 提交，最终 squash 成干净提交再 push。
- **代码作者**：仍由 Track C 执行代理手写（box Codex 额度用尽）。
- **棋子**（`assets/pieces.ts`）：`SETTLEMENT_SCALE` 1.72（约 0.41 宽 × 0.45 高）、`CITY_SCALE` 1.6；每坡 3 排深浅交替的瓦片、4 根木构转角柱 + 顶梁；墙为石灰色向座位色插值 24%（`wallTint`），屋顶为座位色略压暗；`bakeShading()` 把接地 AO（底部 0.6 → 1）和朝下面 ×0.66 / 朝上面 ×1.08 烘进顶点色（零额外 draw call / 贴图）。道路梁加高加宽。雾灯 ×1.62、斗篷提亮为灰绿（`#34504a`），外加一圈浅色反向外壳（`invertHull()`，背面描边）以在灰岩格上读得出。单测 `pieces.test.ts` 按导演同款取景（`playFraming`，910×505）投影房屋高度，断言 22–28 px。
- **骰盘叠加**（`dice-overlay.ts`）：骰子与骰盘不再在世界里，世界树只留不可见句柄（reconcile / 动效照旧改句柄），叠加场景里的 mesh 每帧同步句柄位姿；主渲染后用同一个 WebGLRenderer 剪裁到右下角视口（宽 22%（横屏）/ 36%（竖屏），120–300 px，高 ≤ 45%）`clearDepth()` 再画一遍正交相机（36° 俯角）+ 软阴影椭圆。不碰 DOM / HUD（Track B #149）。`renderer.info.autoReset = false`，每帧手动 `reset()`，draw call 统计包含两遍。`data-dice-overlay="x,y,w,h"` 供 e2e / 评审读取。**重挂载修复**：kit 已加载时叠加层同步创建，否则同一次 commit 的 hex effect 看到旧 `ready`，骰子会落回世界场景（perf:ci 的 `leak.memoryDriftAfter10Remounts` 因此报 1，修复后为 0）。
- **镜头**（`camera-rig.ts`）：水面是 ±9 的平面（`WATER_HALF_EXTENT`），外面是米色天空穹顶。`maxSeaDistance()` 闭式求"视锥四角射线全部落在 y=0 海面方块内"的最大距离，`maxSeaPolar()` 二分求最大安全俯角，`seaSafeFraming()` 先压低俯角、再裁到格子（港口可出画）。AI 回合 / 港口视图为硬约束（总是无天空）；本方回合 `playFraming()` 先保 ≥ 18° 斜视，海面盖不住（桌面 ≥ 1.8 宽画布）时退到更平而不露天空，tiles 始终完整。`update()` 里按位姿缓存夹紧 `controls.maxDistance / maxPolarAngle`，手动缩放 / 旋转也不会拉出天空。SceneHost 读取可选的 `water.seaHalfExtent` 调 `director.setSeaExtent()`——Track D 远海环（`WATER_FAR_HALF_EXTENT = 60`）落地后自动恢复斜视（单测覆盖 ±60）。工具条加 平移（切换左键 / 单指平移，`aria-pressed`）、港口（俯视全岛 + 港口）、环岛游览（6 段 × 1.1 s 共 360°，再按停止并复位，减少动态效果立即结束，任何手动操作打断）。
- **体积**：hex 盘专用模块（镜头导演、骰盘叠加、hex mapper、点数贴花、命中区、程序化棋子入口）经 `src/render3d/hex-kit.ts` 门面 `import()` 懒加载，与 Tidewell GLB 并行、`ready` 前完成；通用桌面不加载。`vite.config.ts` 把它命名为 `g3d-hexkit-*`（放在 render3d-only 规则之前），`scripts/check-size-budgets.mjs` 与 `docs/perf/emulation-protocol.md` 新增 ≤ 10 KB 预算。render3d 核心 209.60 → 205.80 / 210 KB（预算未放宽），hexkit 7.42 KB，工具条 1.78 KB。
- **worker 挂死修复（单独提交 `7437dfc`）**：根因是 `webSocketClose` 把对端关闭码原样回传给 `socket.close(code)`。浏览器直接断开（Playwright 关上下文、页面崩溃）时报 1006，空 Close 帧报 1005——这些是协议保留码，`close()` 抛 `InvalidAccessError`，在 `wrangler dev` 里表现为 `Uncaught Error at webSocketClose`。兼容日期 2026-07-29 已开启 `web_socket_auto_reply_to_close`，握手由运行时完成。修复：`sendableCloseCode()` 只放行 1000–1003 / 1007–1014 / 3000–4999，其余映射 1000，并 try/catch。`worker/session-socket-close.test.ts` 先复现（修复前 1005/1006/1015 三例抛错），修复后 5/5 通过。
- **跨轨道备注 3（Track D）**：SceneHost 已读可选的 `water.seaHalfExtent` 并调 `director.setSeaExtent()`。Track D 的远海环（`WATER_FAR_HALF_EXTENT = 60`，已在 `/workspace/godesk-trackD-judge` 未合入）落地后，本方回合宽屏即可在 ±60 海面下恢复 ≥ 18°–50° 斜视（单测 `camera-rig.test.ts` 覆盖 half=60）。请在 water controller 上暴露 `seaHalfExtent`。
- **本地验证（迭代 2，CI 可用但合入由 merge train 管；本分支保持 draft）**：typecheck ✓；unit 484/484；worker 215/215（含 session-socket-close 5）；e2e 分两段共 58 通过 / 4 跳过（8833）；size ✓（核心 205.80 / 210，hexkit 7.42 / 10，overlay 1.78 / 6）；perf:ci ✓（含 leak.memoryDrift=0）；verify:assets ✓。Draw call：开局 高/中/低 稳态/峰值 26/41、26/42、26/36；中局 30/50、30/50、30/44。
- **评审 round-2p2**：截图与差距表在 `/workspace/g3d-evidence/judge/round-2p2/`（不进仓库）。自评：棋子 4→5、骰子 6→7、镜头 5→7；全局约 3/10；**未达标**。剩余：宽屏本方回合退近俯视（远海环未合入）、棋子无手绘贴图、托盘遮 iPhone 岛角、AI/本方构图差异变小。

## 迭代 3（2p3，23:10 指令）
- **用户**：棋子再放大（房屋默认 play 取景 28–34 px）、城市明显更高更宽、道路加粗+木纹色、强盗更高+兜帽轮廓/描边；骰盘改成参照那种薄深色毡垫（不要深木盒）+ 骰子约 1.4× + 点数更清楚；默认 play 倾角贴近参照 ≈35–40°（不要 a-default 纯俯视），AI 回合仍扁平；`seaHalfExtent` 有则用、无则 TODO 不阻塞。
- **棋子**：`SETTLEMENT_SCALE` 1.45（play 38°/地板 35° 取景下投影 ≈31 px）、`CITY_SCALE` 1.68、`ROBBER_SCALE` 1.9；道路梁加厚加宽 + 座位色木纹条；强盗加高帽尖 + 加宽浅色描边；`contactShadow()` 椭圆接地软影 + 更强 `bakeShading` 接触 AO。
- **骰盘**：`DIE_SIZE` 0.44→0.62（×1.4）；托盘改为薄深色毡垫（`rimHeight` 0.028，无高木墙/斜角盖），点数半径 ×0.11；仍为画布角叠加。
- **镜头**：`CAMERA_MODE_POLAR_DEG.play` 50→38，`PLAY_MIN_POLAR_DEG` 18→35；`playFraming` 不再退到纯俯视（宽屏可露角天空，等 Track D 远海环）。SceneHost：`seaHalfExtent` 有限正数才 `setSeaExtent`，并留 TODO。
- **代码作者**：Track C 执行代理手写（box Codex 额度用尽）。

## 暂停（23:25 大主管 round-2 裁定）
- 大主管 round-2：**未达标**；棋子自评 5 → 他评 ~4。
- 优先级 #1：三轨叠进同一画面。Track D 正在把 #149+#151 叠进 #148。本分支 **暂停**，不另开分支。
- 2p3 WIP 已提交并 push（薄毡垫骰盘 + play ≈38° + 棋子放大），合成后再改：真正房屋/城市/道路模型（非几何体拼装）、斗篷强盗小人、骰盘保持薄垫风格。

## Round-3/4 刀序②（`feat/g3d-judge-r3-pieces` @ stacked #148）
- 大主管 round-3 **未达标**；交付改为 round-4 叠屏对比（Track D 最终再叠截图）。本分支只动棋子模型。
- **房屋/城市/道路**：可读微缩建筑（石基、半木构、凹窗+窗棂、门框台阶、门廊、四坡瓦、山墙封檐；城市双层厅堂 + 方塔扶壁/垛口/旗）；道路为独立座位色木板压在枕木上。仍合并为一份 BufferGeometry → InstancedMesh（每 kind×seat 1 draw）。
- **强盗**：斗篷小人（腿/躯干/披风片/兜帽深影/灯笼），非 lathe 圆柱；浅色反向外壳描边。
- **骰盘**：保持薄毡垫（不改）。
- 不改 HUD CSS / 地形 props。手写（Codex 额度用尽）。

## Round-5p 刀序③+④（feat/g3d-judge-r5-pieces @ stacked #148 d5be4ce）

- 大主管 round-4 **未达标**；本分支在叠屏基线上旁支改棋子可读性 + 动效可见性。
- **③ 棋子俯视可读**：渔村/港镇壳体积加大（宽深墙脊 + 烟囱/天窗），SETTLEMENT_SCALE 1.62 / CITY_SCALE 1.95（play 取景房屋约 34–48 px）；强盗 ROBBER_SCALE 2.25，兜帽/披风/浅色 rim 加宽加高。
- **glTF**：调研 asset-server/downloads Kenney Nature Kit（仅自然物/帐篷，无房屋）+ Polyhaven 树 → **未替换**棋子；登记见 assets/LICENSES.md round-5p 调研段。
- **④ 动效**：强盗 hop 720 ms、3 跳、弧高约 ×2.4；资源 +N 弹出 CSS 放大弹跳 1.8s（tidewell-resource-pop），gain 超时 2000 ms。
- 端口 8833；draft PR base feat/g3d-judge-r1；手写（Codex 额度用尽）；**未达标**（交大主管裁定）。
