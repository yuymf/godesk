# 创作首页：收紧首屏构图，让可玩案例更早出现

Status: implemented locally; automated validation passed; human visual acceptance pending
Date: 2026-10-03
Written against: `8bde720e34c3f7c7b21b5d518b72cdf9baf074a8` plus the existing uncommitted working tree.

用户认为当前页面仍未达到 [Bookmark.gallery](https://bookmark.gallery/) 的质感，
并在推荐“首屏构图”方向后要求继续。本计划按该方向收敛一个整体改动：
导航、欢迎区、输入区和案例区在首屏中的比例。具体文案和几何是本计划
提出的设计决策。下文保留实施前证据和要求；实施结果见文末。

本计划独立于审查报告，执行者无需会话上下文。现有工作树包含上一轮
品牌和页面修改，以及用户的 `.spec-workflow/`；不要重置、覆盖或清理它们。

## Evidence chain

- Surface: `http://127.0.0.1:8800/chatgpt-plugin/new`，逻辑首页 `/`。
  `src/public-mount.ts:4–9` 处理公开挂载路径，`src/App.tsx:5–9` 进入
  CreatorWorkspace，`src/creator/CreatorWorkspace.tsx:30` 渲染 CreatorHome。
  `src/main.tsx:4–8` 加载 tokens、通用样式、shell 样式和 home 样式。
- Problem: 用户明确反馈整体视觉仍需提升。实时 1280×720 画面中，header
  宽 1240px，欢迎区标题一行；composer 为 720×361px，案例区从 y≈824px
  开始。390×844、scrollY=0 时 composer 高约 475.6px，案例区从 y≈906.4px
  开始。输入表单占据首屏主要面积，当前构图尚未体现用户期望的参考感。
  这是用户提出的新设计目标，不把这些尺寸冒充现有规范违规。
- Design evidence: 参考站的桌面导航集中在居中胶囊内，两行标题后接短说明
  和主操作，产品画面随后出现。当前 `DESIGN.md:7–15` 已规定轻量黑白
  框架、胶囊操作、由游戏内容提供颜色；`:30–31` 提供圆角和间距体系；
  `:50–54` 提供字体和正文行距；`:58–60` 要求 composer 居中、内部左对齐、
  原创案例在下方且手机导航可见；`:85–89` 保留直接创作入口。
- Owner: `src/creator/CreatorHome.tsx:273–443` 拥有该页面结构；
  `src/creator/creator-home.css` 拥有欢迎区、composer 与案例的局部样式。
  `.shell-header` 基础规则属于 `src/creator/creator-shell.css:7–12`，
  也被其他页面消费，因此此次只添加首页局部规则。
- Scope and affected surfaces: 仅 CreatorHome 在两个挂载路径的桌面与手机
  构图，以及因首页标题变动需要调整的两个 E2E 文件。游戏列表、设置、
  Studio、Room、Replay 与安装页用于回归检查，不接受新的视觉方案。
- Uncertainty: 尚无改版后的实际渲染或测试结果；参考站手机端未取得证据。
  手机上传说明自然换行和本机 CJK 字体可能影响首屏高度，须通过实际
  viewport 检查。下述折叠线目标是验收条件，不是测量结果。

## Design decision

采用“居中导航 → 两行结果标题 → 紧凑真实输入 → 可玩案例”的构图。
首屏仍能直接写想法、选开局、上传文件和生成游戏。通过缩短空输入框、
合并手机上传排列和复用现有间距，使案例更早进入视野。

不增加一个需要再次点击才进入创作的介绍页。用户已认可的双牌标志、
Manrope/CJK 字体、黑白框架、原创建例美术继续构成 GoDesk 的身份。
不复制参考站的花朵、插图、手机截图或阴影。

目标结构：

```text
         [ GoDesk   创作台  我的游戏  设置  在 Codex 中使用 ]

                         双牌标志
                     把想法变成游戏，
                     邀请朋友一起玩。
                    两行简短的创作说明

           [ 三行原生文本输入，可继续输入或手动拉高 ]
           [ 三个常用开局                          ]
           [ 剧本或规则上传 ] [ 图片上传           ]
           [ 操作帮助              生成可玩版本    ]

先玩一局现成的
[ 原创建例 ]           [ 原创建例 ]           [ 原创建例 ]
```

手机端导航仍为可见的两行结构；上传保持两列，提交帮助和按钮保留纵向
排列。窄屏文字可自然换行，禁止用固定高度截断内容。

## Reuse

- `Brand`、`GameMark`：`src/creator/CreatorBrand.tsx`，保留现有双牌资产。
- 现有 `.shell-header`、`.studio-welcome`、`.studio-composer`、
  `.studio-dropzone`、`.studio-submit-row`、`.studio-examples`，调整首页组合。
- `src/creator/design-tokens.css`：`--space-2` 8、`--space-3` 12、
  `--space-4` 16、`--space-5` 24、`--space-6` 40；`--radius-sm` 8、
  `--radius-xl` 24、`--radius-pill`；`--paper`、`--ink`、`--line`、
  `--muted`、`--surface-raised`。不新建 token 或配置层。
- 720px composer 宽度、现有标题 `clamp(28px, 3.2vw, 46px)`、输入字号
  16px、原生 textarea、现有 44px 主操作尺寸继续复用。64px 导航最小高度
  来自 DESIGN.md 的间距体系，不新建尺寸 token。
- Exemplar: `creator-home.css:7` 的 composer 居中宽度；
  `creator-shell.css:12` 的浅边框胶囊；`creator-home.css:27` 的 8px 控件；
  `creator-shell.css:16` 的 1.65 正文行距。案例仍用 `ExampleArtwork`。

这些现有所有者足以表达改动。无需新组件库、共享 Hero/Nav 原语或双套首页。

## Changes

1. `src/creator/CreatorHome.tsx`
   - Change: H1 使用两个连续的块级 span，文案固定为“把想法变成游戏，”
     和“邀请朋友一起玩。”。保持一个 H1。欢迎说明固定为两行：“写下想法，
     或上传剧本和规则。”以及“生成可玩的一局，用链接邀请朋友。”。
   - Change: textarea 的 `rows` 从 4 改为 3，保持原生纵向 resize。
     其余结构不拆分；导航、开局、两个上传 label、图片用途选择、footer、
     progress/error、案例及最近项目继续使用当前组成。
   - Preserve: description、rulebook、visualAssets、selectedStarterId、busy
     的状态和回调；12000 字上限；Ctrl/⌘ + Enter 提交；文件 accept、
     拖放、文件名/大小、图片数量和用途说明；全部导航链接、href 挂载规则；
     生成计划和 Playability Floor；现有按钮的 disabled 与进度行为。
   - Verify: 输入内容不因布局修改丢失；选择上传后信息和图片用途仍可见；
     从首页仍能实际生成或启动一局，并取得好友可用的邀请链接。

2. `src/creator/creator-home.css`
   - Change — navigation: 仅用 `.studio-home .shell-header` 及其后代选择器
     覆盖共享布局。桌面宽度 `min(calc(100% - 48px), 720px)`、顶部外距
     `--space-5`、最小高度 64px、内距 `--space-2 --space-5`、1px
     `--line` 边框、`--paper` 背景、`--radius-pill` 圆角；不加阴影。
     首页 nav gap 使用 `--space-5`。
   - Change — mobile navigation: 在现有 680px header 断点内保留两行和
     所有链接。首页 header 宽度 `calc(100% - 40px)`、内距
     `--space-2 --space-4`、行间 gap `--space-3`、圆角 `--radius-xl`；
     nav gap 为 `--space-3`。安装链接仍可见，不引入折叠菜单。
   - Change — welcome: 桌面和现有 900/600px 分支统一使用顶部外距
     `--space-6`、底部 `--space-5`，替换旧 80/56/44px 与 32/28px。
     H1 保留现有字号 clamp、tracking 和 1.2 行距，字重改为已有规范的
     500；两个 H1 span 各自 display:block。欢迎说明顶部外距
     `--space-4`、行距 1.65，保留 15px/手机 13px 与当前 max-width。
     双牌 mark 的 36px/手机 30px 和相邻间距继续使用当前规则。
   - Change — composer: 所有尺寸使用内距 `--space-4`，宽度720px和
     24px圆角不变。删除桌面 textarea 的 112px min-height 与手机132px
     覆盖，由 `rows=3`、现有16px字号和1.75输入行距决定初始高度；保留
     resize:vertical、焦点样式，不增加高度脚本。starter row 上下外距
     统一 `--space-3`，gap 和按钮样式保留。
   - Change — attachments: 桌面/手机都使用
     `repeat(2, minmax(0, 1fr))`、gap `--space-3`，删除手机一列覆盖。
     上传 label 使用 box-sizing:border-box、min-height:44px、
     内距 `--space-2 --space-3`、gap `--space-2`；圆角遵循现有普通控件
     规则 `--radius-sm`。保留 strong 的文件名省略和 small 的完整说明，
     small 允许自然换行，选中文件时容器可增高。不得隐藏上传帮助、
     文件元信息或图片用途来强行满足首屏目标。
   - Change — footer: 顶部外距和手机纵向 gap 使用 `--space-3`，帮助文字
     行距 1.65；保留现有 desktop 横排、mobile 纵排、44px 按钮、文字、
     disabled、spinner 和 aria-describedby。
   - Change — examples: 将 `.studio-examples, .studio-recent` 的合并外距
     规则拆成独立规则，只有 `.studio-examples` 的顶部外距在桌面/手机
     改为 `--space-6`；`.studio-recent` 保留原来的80px/手机56px。
     其他案例列数、插画比例、标题、介绍、按钮和最近项目布局不变。
   - Preserve: 全局 tokens 与共享 shell 样式；首页黑白框架；案例颜色；
     现有焦点、hover、选中、生成中、错误及长内容表现。
   - Verify: 1280×720 首屏完整容纳欢迎区和生成按钮；390×844 空闲且
     scrollY=0 时案例区标题完整进入视野；1440×900 出现案例美术开头。
     320px 窄屏不横向溢出，内容可向下延展；不要求320px也满足折叠线目标。

3. `e2e/gallery-design-language.spec.ts`
   - Change: 原来的 H1 定位改为匹配新的完整标题，匹配连续文本允许
     span 间空白。增加1280×720与390×844的空闲首屏可见范围检查；
     使用 boundingBox 判定按钮/案例标题的位置，不以 `toBeVisible`
     代替是否进入视野。保留1440宽度的现有流程。
   - Change: 通过真实 file input 选择有效的 TXT 和 PNG，断言文件名、
     图片数与用途控件仍显示。当前 `e2e/` 未查到可复用的上传 fixture，
     使用 Playwright 的文件 buffer 输入，在此 spec 内提供最小有效样本，
     不另建 fixture 体系。仅覆盖此次重排可能损坏的路径，不新增截图
     快照作为行为验证的替代。
   - Preserve: 安装页进入创作、starter 输入、案例开局、键盘操作、Room
     邀请链接、第二个浏览器 context 加入和采取体裁行动、双方看到状态、
     Replay、品牌导航、游戏列表和设置的现有完整故事。
   - Verify: 上述两人流程通过；上传的布局变化未使提交或用途选择失效。

4. `e2e/charter-playable-output.spec.ts`
   - Change: 当前第30和147行的旧首页标题断言改为新的标题；保留其所有
     生成、真实体裁和 Playability Floor 的断言，不放宽超时或删除失败路径。
   - Preserve: 完整“来源输入 → 可玩输出 → 他人可加入”的产品验证。
   - Verify: 与完整E2E一起通过，不以标题断言通过宣称玩法验证完成。

## Scope

- Inherit: CreatorHome 在逻辑 `/` 和公开 `/chatgpt-plugin/new` 的欢迎区、
  空输入、输入后、文件选中、busy/error 与案例区域；首页的手机分支。
- Verify: 安装页进入首页；首页到我的游戏、设置；Brand 回首页；案例到
  Shared Session、好友加入与 Replay；其他共享 `.shell-header` 消费页面。
- Exclude: 品牌资产和 Plugin 元数据、后台生成机制、Kernel、Room、Replay
  设计、全局字体/token、案例美术替换、全站图标重构、新依赖。
  审查中独立的 selected-chip 配色和案例简介行距不在此次构图改动中。
  欢迎/footer 行距和上传圆角只在其本次局部重排内遵守既有规则。

## Validation

- Product: 从首页写入或上传来源，完成现有计划/编译路径，进入满足
  Playability Floor 的 Shared Session；好友用邀请URL加入并采取一个
  体裁行动，双方看到相同的新状态。另验证现成案例仍可实际开局。
- Interface: 检查1280×720、1440×900、390×844和320px宽度；字体加载后
  且scrollY=0记录空闲首屏。检查空输入、starter选中、长想法、长文件名、
  多张图片/用途选择、生成中及失败提示。只有空闲状态有首屏高度目标；
  已选资料/报错可自然增高。检查键盘聚焦、Enter开局和Ctrl/⌘Enter提交。
- System: 首页局部规则不影响 `/games`、`/settings` 及 Studio；无新共享
  Hero/Nav 组件、并行主题、字体、阴影或配置层。双牌资产不变。
- Repository: `pnpm build` → TypeScript与Vite构建通过。
  `pnpm test:e2e` → 完整Playwright绿灯，包含真实导航、输入、开局、邀请、
  好友行动和回放；不能只运行新标题断言。保留既有有原因的skip，不新增
  skip来躲避回归。本计划未执行这些命令，既往测试结果不是改版验证。
- Visual acceptance: 行为绿灯后提供实际桌面/手机画面供用户验收首屏
  比例。不得以行为测试通过宣称已经达到参考站的视觉质量。

## Stop conditions

- 当前首页 owner 或加载顺序已变化：重查源码与现有方案再继续，禁止
  凭这些行号覆盖用户的新改动。
- 首屏目标只有隐藏导航、来源控件、上传帮助或分享约束才能达到：停止
  该压缩方式，回到现有组件内检查实际换行和间距，不删除可用端到端流程。
- 需要扩大全局 shell、修改玩法或引入新依赖才能实施：停止扩大范围，
  先记录新的证据；此次首页构图无此必要。
- 全量Playwright失败：修复此次回归并保留产品路径，不能以静态截图
  或HTTP验证替代。新旧问题需按实际失败证据区分，不先归为既存问题。

## Design documentation

- After acceptance and validation: 执行者在 `DESIGN.md` 的 Layout 段更新
  首页结果型两行标题、局部居中胶囊导航和紧凑composer示意；明确普通
  内容可在手机自然增高，导航一直可见，案例实际开局。该决定替换旧
  “question”文案与平面header示意，保留黑白框架、字体、原创案例和
  composer-first决定。ADR0011/0012无需修改。
- 本计划阶段不修改 DESIGN.md。用户的继续指令用于推进此构图方案，
  不等于新渲染已获视觉验收。

## Working-tree evidence fingerprints

执行前核对实际内容，hash不一致时重查差异，不回滚工作树：

```text
160d3e64b5ddc904307317fa2eecff1a38ad916f94c22495c0c3907961b964a1  DESIGN.md
ffeb46c883bbf15d592a1e5b23039c9db0b28b3a823b7c6ef613ec066753ca60  src/creator/CreatorHome.tsx
4c2784df7684a388223baf7964c4a56c16b429e56f9164fce0af70ba1b456771  src/creator/creator-home.css
81f8f10943762400044eb3c3662ae4501d921423360f1f1c15eed5089e3876c0  src/creator/creator-shell.css
a71c156b92fee9ab5a6b7a14abf8b23be0fc47a143880a45388c5b2392641921  src/creator/design-tokens.css
```

## Implementation verification — 2026-10-03

- 用户在收到实施方案和“直接实施”入口后要求继续，本轮执行首屏改版。
  修改限于 CreatorHome、creator-home.css、两个相关 E2E spec 与本次记录；
  现有品牌、其他页面和生成/分享逻辑保持原实现。未添加依赖或提交代码。
- `pnpm build`：通过。
- `GODESK_E2E_EVIDENCE_DIR=/Users/halyu/Documents/Codex/artifacts/godesk-home-20261003 pnpm test:e2e`：
  41 passed、4 skipped，57.2s。四项为现有人工/现场验收矩阵项，本轮未新增skip。
  完整故事包含来源生成、三种首屏尺寸的案例开局、第二浏览器加入和体裁
  行动、双方状态、Replay；同时检查TXT上传、长文件名、两张PNG、图片
  用途切换与320px长内容无横向溢出。
- 新首屏位置断言通过：1280×720的生成按钮完整入屏；390×844的案例标题
  完整入屏。查看了实际桌面/手机截图，不以静态截图代替行为验证。
- 本机1280×720实时渲染：导航为720×64px、y=24；composer为720×289px、
  y≈375.8；案例标题y≈704.8。相较审查时composer361px缩短72px，案例区
  由y≈824前移约119px。不同字体环境的具体像素可略有差异。
- 预览：[本地创作首页](http://127.0.0.1:8800/chatgpt-plugin/new)，已打开并保留。
- 截图：[桌面](/Users/halyu/Documents/Codex/artifacts/godesk-home-20261003/home-desktop.png)、
  [1280桌面](/Users/halyu/Documents/Codex/artifacts/godesk-home-20261003/home-compact-desktop.png)、
  [手机](/Users/halyu/Documents/Codex/artifacts/godesk-home-20261003/home-mobile.png)。
- DESIGN.md已记录实施后的首页构图；未修改ADR0011/0012。
  自动化与本机视觉复查不代表用户已认可参考站相似度。
- 测试期间一次Worker websocket关闭回调输出Uncaught Error，测试继续并
  全部通过；该回调来源文件本轮未改动，未完成其原因诊断，未扩大此UI任务。
