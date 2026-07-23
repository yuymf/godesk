export type ReviewStatus = "confirmed" | "needs-review" | "blocked";

export type Anchor = {
  label: string;
  page?: number;
  asset?: string;
};

export type RuleFact = {
  id: string;
  title: string;
  detail: string;
  status: ReviewStatus;
  confidence: number;
  anchor: Anchor;
};

export const goods = [
  { id: "nutmeg", name: "肉豆蔻", en: "Nutmeg", color: "#8c4d32", die: 4 },
  { id: "silk", name: "丝绸", en: "Silk", color: "#286a8a", die: 3 },
  { id: "ginseng", name: "人参", en: "Ginseng", color: "#d6a637", die: 2 },
  { id: "jade", name: "玉石", en: "Jade", color: "#568264", die: 1 },
] as const;

export const componentGroups = [
  { name: "游戏板", count: 1, note: "含航道、港口、船厂、海盗、领航员与保险区", anchor: { asset: "play-1.jpg", label: "整桌照片" } },
  { name: "平底船", count: 3, note: "每航次装载 4 种货物中的 3 种", anchor: { page: 2, label: "规则书 p.2" } },
  { name: "货物骰", count: 4, note: "肉豆蔻 d4、丝绸 d3、人参 d2、玉石 d1", anchor: { page: 1, label: "规则书 p.1" } },
  { name: "货价标记", count: 4, note: "货物进港后在黑市价值表上前进", anchor: { page: 7, label: "规则书 p.7" } },
  { name: "股份", count: 20, note: "每种货物 5 股", anchor: { page: 1, label: "规则书 p.1" } },
  { name: "伙计", count: 20, note: "5 色；三人局每人使用 4 个", anchor: { page: 1, label: "规则书 p.1" } },
  { name: "比索", count: 1, note: "银行、竞标、支付与结算使用", anchor: { page: 1, label: "规则书 p.1" } },
] as const;

export const ruleFacts: RuleFact[] = [
  {
    id: "players",
    title: "玩家与起始资源",
    detail: "3–5 人；每人 30 比索与 2 张股份。三人局每人使用 4 名伙计。",
    status: "confirmed",
    confidence: 0.99,
    anchor: { page: 1, label: "规则书 p.1" },
  },
  {
    id: "harbor-master",
    title: "港务长竞标",
    detail: "每航次先竞标港务长；赢家可买 1 股、选择 3 种装船货物并设定起航位置。",
    status: "confirmed",
    confidence: 0.98,
    anchor: { page: 2, label: "规则书 p.2" },
  },
  {
    id: "start",
    title: "起航位置约束",
    detail: "三艘船起始位置总和必须为 9，且单船不得超过 5。",
    status: "confirmed",
    confidence: 0.99,
    anchor: { page: 2, label: "规则书 p.2" },
  },
  {
    id: "turn-order",
    title: "三人局航次节奏",
    detail: "前两轮只放置伙计；随后交替进行三次移动与两次剩余放置，共 4 次放置、3 次移动。",
    status: "confirmed",
    confidence: 0.96,
    anchor: { page: 3, label: "规则书 p.3" },
  },
  {
    id: "spaces",
    title: "可投资区域",
    detail: "船上货物、港口 A/B/C、船厂 A/B/C、海盗、大小领航员与保险代理。",
    status: "confirmed",
    confidence: 0.97,
    anchor: { page: 3, label: "规则书 p.3–5" },
  },
  {
    id: "pirates",
    title: "海盗时机",
    detail: "第二次移动后恰停 13 的船可被登船；第三次移动后恰停 13 的船被劫掠。",
    status: "confirmed",
    confidence: 0.96,
    anchor: { page: 5, label: "规则书 p.5" },
  },
  {
    id: "pilot-order",
    title: "领航员先于末次移动",
    detail: "大小领航员在第三次掷骰移动前，按规则调整船位。",
    status: "confirmed",
    confidence: 0.95,
    anchor: { page: 5, label: "规则书 p.5" },
  },
  {
    id: "edge-case",
    title: "待确认：领航与海盗的边界组合",
    detail: "需要用规则实例复核多船同时处于 13、领航员移动后触发顺序等组合情形。",
    status: "needs-review",
    confidence: 0.61,
    anchor: { page: 5, label: "规则书 p.5–6" },
  },
  {
    id: "licensing",
    title: "素材发布授权",
    detail: "本轮仅获准做内部验证；商业发布与素材再分发授权尚未取得。",
    status: "blocked",
    confidence: 1,
    anchor: { asset: "PROVENANCE.md", label: "来源台账" },
  },
];

export const phaseGraph = [
  { id: "auction", label: "竞标港务长", anchor: "p.2" },
  { id: "setup", label: "买股 / 装船 / 定起点", anchor: "p.2" },
  { id: "place-1", label: "放置 ①", anchor: "p.3" },
  { id: "place-2", label: "放置 ②", anchor: "p.3" },
  { id: "move-1", label: "移动 ①", anchor: "p.3" },
  { id: "place-3", label: "放置 ③", anchor: "p.3" },
  { id: "move-2", label: "移动 ② / 海盗登船", anchor: "p.5" },
  { id: "place-4", label: "放置 ④", anchor: "p.3" },
  { id: "pilot", label: "领航员调整", anchor: "p.5" },
  { id: "move-3", label: "移动 ③ / 劫掠", anchor: "p.5" },
  { id: "settle", label: "港口 / 船厂 / 货价结算", anchor: "p.6–7" },
] as const;

export const sourcePages = Array.from({ length: 8 }, (_, index) => ({
  page: index + 1,
  src: `/manila/rules/page-${index + 1}.png`,
}));

export const projectSummary = {
  title: "Manila / 马尼拉",
  sourceCount: 8,
  photoCount: 7,
  confirmedFacts: ruleFacts.filter((fact) => fact.status === "confirmed").length,
  reviewFacts: ruleFacts.filter((fact) => fact.status === "needs-review").length,
  blockedFacts: ruleFacts.filter((fact) => fact.status === "blocked").length,
};
