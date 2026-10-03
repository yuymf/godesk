# GoDesk 创作首页：参考站对照与界面审查

Status: historical audit; home-composition implementation completed locally
Date: 2026-10-03
Written against: `8bde720e34c3f7c7b21b5d518b72cdf9baf074a8` plus the existing uncommitted working tree.

本文件记录实施前的只读审查，使用用户指定的
`/Users/halyu/.cc-switch/skills/improve-ui/SKILL.md`，该审查阶段没有修改
产品源码、设计规范、依赖或测试。用户随后要求继续实施首屏方案；
实施后结果和完整测试见 [方案末尾](/Users/halyu/Documents/Code/godesk/design-plans/01-home-composition.md)。
以下数值与发现属于审查时版本，不应当作改版后的当前状态。

## Design language

- Audited surface: GoDesk Web Studio 的创作首页
  `http://127.0.0.1:8800/chatgpt-plugin/new`，覆盖欢迎区、想法输入、三个
  常用开局、两个上传控件、原创建例画廊；检查桌面 1280×720 和手机
  390×844，以及开局选中/悬停状态。工作室编辑页、安装页、Room 和
  Replay 不作为本次审查对象。
- Design sources: 用户本轮要求与 [Bookmark.gallery](https://bookmark.gallery/)
  的实时桌面画面；当前工作树的
  [DESIGN.md](/Users/halyu/Documents/Code/godesk/DESIGN.md:7)；产品范围由
  [ADR 0011](/Users/halyu/Documents/Code/godesk/docs/adr/0011-chatcut-playable-output-is-the-product.md:21)
  和 [ADR 0012](/Users/halyu/Documents/Code/godesk/docs/adr/0012-playability-floor-is-the-share-gate.md:26)
  决定。DESIGN.md 的配色、字体、组件排列均已进入当前渲染路径，因而
  用于检查现有界面的规范偏差；不能据此声称用户已认可当前整体构图。
  用户已经认可双牌品牌标志，本轮反馈明确表示页面仍未达到参考站质感。
- Documented decisions: 黑白界面、现有 Manrope/CJK 字体、正文行距 1.65、
  selected chips 使用 raised surface、普通控件 8px 圆角；首页居中问题与
  composer，下面展示三款真实可开局的原创案例。产品结果仍是可玩、
  可分享的游戏；美化不能把创作入口改成没有可玩输出的展示页。
- Governing owners and consumers: `src/main.tsx:4–8` 按顺序加载 tokens、
  通用样式、shell、home 样式；`src/App.tsx:5–9` 将创作路由交给
  CreatorWorkspace；`src/public-mount.ts:4–9` 将公开 `/new` 映射到逻辑
  首页；`src/creator/CreatorWorkspace.tsx:30` 渲染 CreatorHome。
  `src/creator/CreatorHome.tsx:273–443` 消费下面表格中的 home 样式。
  `creator-home.css` 的这些选择器直接拥有本次发现，无须创建新组件或
  修改全局主题。Brand 与 ExampleArtwork 保留现有所有者。
- Explicit exceptions: DESIGN.md:13–15 允许原创建例美术和游戏对象使用
  颜色；DESIGN.md:30–31 明确区分 24px composer、16px 游戏美术与胶囊
  主操作，不能把它们统一改成普通控件的 8px。其他本次发现没有已记录
  的例外。

## Reference observations — not findings

以下是实际对照结果，不把所有差异都归为缺陷，也不把网页产品介绍页
的布局直接当成 GoDesk 创作工具的约束。

| 对照项 | Bookmark.gallery 的实时画面 | GoDesk 的实时画面 | 审查边界 |
| --- | --- | --- | --- |
| 首屏标题 | 1280px 下为 60px、500 字重、63px 行高，标题分为两行；后面是一段说明与一个黑色按钮 | 同尺寸为 40.96px、650 字重、49.15px 行高；标题一行，下面直接进入 composer | 字体与中英文长度不同，不能以复制 60px 就能改善 GoDesk 为结论；需要先选定构图方向 |
| 导航 | 居中的胶囊容器将标志、链接和登录操作收在一起 | 1240px 宽的平面 header，将标志和导航分别放在左右 | 当前 GoDesk 规范未规定必须采用参考站的导航几何；阴影还需要重新核定 DESIGN.md:28–31 的边界 |
| 首屏内容 | 单个开始按钮之后出现产品的手机画面 | 720×361px 的 composer，包含输入、开局、上传、说明和提交；案例区从 y≈824px 开始 | composer-first 是 DESIGN.md:85–89 的现有决定；不能擅自删除真实创作入口来模仿介绍页 |
| 手机端内容 | 本轮未取得参考站手机端证据 | 390px 下 composer 高约 475.6px，案例区从 y≈906.4px 开始；导航仍可见，上传区为一列 | 只能确认 GoDesk 的实际比例，不能宣称两个站的手机端已经完成对照 |
| 案例美术 | 参考首屏出现真实产品画面 | GoDesk 通过 ExampleArtwork 呈现三款原创游戏插画 | 当前规范明确允许原创游戏美术；用真实玩法画面替换插画是新的设计选择，不是已证实的规范违规 |

用户对整体质感的反馈成立为设计输入。这些观察说明：修复几个 token
偏差，不能独自完成首屏重心和成品展示的重新设计。整体方向需要选定，
再以现有组件和游戏内容编写实施计划。

## Findings

| # | Problem | Evidence | Proposed change | Scope | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | 首页说明文字出现三套正文行距，与现有正文规则不一致 | **Contract:** [DESIGN.md:53](/Users/halyu/Documents/Code/godesk/DESIGN.md:53) 明确要求正文行距 1.65。**Runtime:** CreatorHome:288–291、395–396、425–427 分别渲染欢迎说明、提交帮助、案例简介；[creator-home.css:6](/Users/halyu/Documents/Code/godesk/src/creator/creator-home.css:6)、:29、:49 直接赋予 1.8、1.6、1.7。桌面实测为 15px/27px、11px/17.6px、13px/22.1px，手机端相同倍率仍生效。**Consequence:** 同一页面的普通说明出现不同的行距倍率，标题和输入区不是这个发现的对象。 | 将 `.studio-welcome > span`、`.studio-submit-row > span`、`.example-grid p` 的 `line-height` 统一为现有文档要求的 `1.65`。 | 仅 CreatorHome 已观察的三类说明；由现有 creator-home.css 持有，继承到其桌面/手机分支。 | 高：明确规则、直接样式所有权和实时计算值一致。 |
| 2 | 常用开局在非悬停选中时使用黑底白字，偏离规范规定的浅灰选中面；悬停后又变成另一套配色 | **Contract:** [DESIGN.md:24](/Users/halyu/Documents/Code/godesk/DESIGN.md:24) 将 selected chips 指定为 `#f5f5f5` raised surface。**Runtime:** CreatorHome:270、317–327 根据同一个 description 计算选中状态；[creator-home.css:15](/Users/halyu/Documents/Code/godesk/src/creator/creator-home.css:15) 的 hover 规则和 :16 的 pressed 规则同时作用。点击“聚会卡牌”后移开指针，实测 selected 为 `rgb(23,23,23)` 底/白字；停留时为 `rgb(245,245,245)` 底/黑字。**Consequence:** 同一个选中值随指针位置改变配色，非悬停值不满足文档。 | 将 pressed 规则的背景改为 `var(--surface-raised)`、前景改为 `var(--ink)`，复用现有 hover 的浅灰/黑字配对；保留现有 selected border。 | 仅首页三个常用开局的样式；不改变 selectedStarterId、草稿内容或生成行为。 | 高：选中与悬停均已实际操作验证，raised token 的值已解析。 |
| 3 | 两个上传控件使用 12px 圆角，偏离普通控件的 8px 规则 | **Contract:** [DESIGN.md:30](/Users/halyu/Documents/Code/godesk/DESIGN.md:30) 指定 8px controls。**Runtime:** CreatorHome:332–375 中“附上剧本或规则”和“添加图片”都消费 `.studio-dropzone`；[creator-home.css:18](/Users/halyu/Documents/Code/godesk/src/creator/creator-home.css:18) 使用 `--radius-md`，由 [design-tokens.css:17](/Users/halyu/Documents/Code/godesk/src/creator/design-tokens.css:17) 解析为 12px。桌面和手机都实测 12px，手机断点未覆盖圆角。现有 `.image-use-field select` 已使用 `--radius-sm`。**Consequence:** 这两个普通上传控件与已记录的控制面圆角不同。 | 将 `.studio-dropzone` 的圆角改为现有 `var(--radius-sm)`，解析为 8px。 | 仅两个上传控件；composer、游戏插画和胶囊按钮继续使用各自已记录的圆角。 | 高：两个真实控件、两种尺寸均复现，既有 token 和 sibling 控件可复用。 |

## Improve first

在已通过证明门槛的发现中，先处理 **#1 正文行距统一**。它覆盖欢迎
说明、输入区帮助和所有案例简介，复用当前字体和三个现有样式所有者，
修正由同一正文规则支配的排版差异。它不会独自解决用户提出的整体
视觉质量问题，不能把这一小修包装成完成一次页面重设计。

## Falsification and exclusions

- 报告前重新读取 DESIGN.md、home 样式、tokens、首页 JSX 和加载/路由
  链。三个保留项均没有定位到另一层覆盖、其他所有者或已记录例外。
- 胶囊按钮和 composer 的大圆角属于文档明示的例外，因此未记为发现。
- 首屏画廊在折叠线下并不自动构成缺陷：现有文档要求 composer 优先，
  没有“首屏必须出现案例”的绑定规则。数值记录用于下一轮构图讨论。
- 手机截图曾因输入框聚焦发生页面滚动；恢复 scrollY=0 后导航正常，
  因而没有报告“手机导航不可见”。
- 单独的 650 字重、字体品牌与参考站不同、标题没有换成两行，都没有
  被认定为缺陷；现有证据没有唯一确定它们应改成哪个字号/字重。
- 不报告文件上传行为、登录、分享、路由、网络、性能、语义/ARIA 或
  后端问题。原来的输入已恢复为空，未生成项目或开局。

## Plan selection

用户在推荐 **首屏构图** 后要求“继续”，现已按此方向编写一个整体方案：
[收紧首屏构图，让可玩案例更早出现](/Users/halyu/Documents/Code/godesk/design-plans/01-home-composition.md)。
该方案是新设计目标的具体提案，不宣称表格中的三个发现均被选中，也
不把参考站所有样式当成已获接受的 GoDesk 决策。

方案独立包含：当前提交与工作树证据、精确改动路径、组件/token复用、
桌面/手机验收、未来设计文档更新，以及完整「来源 → Shared Session →
好友加入 → 体裁行动 → 分享/回放」验证。执行者必须运行
`pnpm test:e2e` 和 `pnpm build`。品牌资产不在此次构图方案范围内。

本轮没有运行这些命令，因为只读审查没有修改产品代码；上一轮测试
结果不被当成本轮实现验证。

## Working-tree evidence fingerprints

当前 HEAD 只是基线，以下 SHA-256 标识本轮实际审查的未提交版本：

```text
160d3e64b5ddc904307317fa2eecff1a38ad916f94c22495c0c3907961b964a1  DESIGN.md
4c2784df7684a388223baf7964c4a56c16b429e56f9164fce0af70ba1b456771  src/creator/creator-home.css
ffeb46c883bbf15d592a1e5b23039c9db0b28b3a823b7c6ef613ec066753ca60  src/creator/CreatorHome.tsx
a71c156b92fee9ab5a6b7a14abf8b23be0fc47a143880a45388c5b2392641921  src/creator/design-tokens.css
```
