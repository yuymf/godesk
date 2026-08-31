export type DefaultExampleId = "harbor-13" | "mistpeak-lodge" | "idea-relay";

export interface DefaultExample {
  id: DefaultExampleId;
  title: string;
  kicker: string;
  summary: string;
  players: string;
  duration: string;
  status: string;
  rights: string;
}

export const DEFAULT_EXAMPLES: DefaultExample[] = [
  {
    id: "harbor-13",
    title: "港口十三号",
    kicker: "原创港口竞速案例",
    summary: "派遣伙计、掷骰航行与领航结算，单航次抢先积累信用。",
    players: "3 人",
    duration: "25 分钟",
    status: "可玩对局",
    rights: "GoDesk 原创内容，不含原版规则、美术或照片",
  },
  {
    id: "mistpeak-lodge",
    title: "雾岭山庄",
    kicker: "原创山庄探索案例",
    summary: "秘密身份、公开发言与互相指控，找出藏在山庄里的凶手。",
    players: "3 人",
    duration: "20 分钟",
    status: "可玩对局",
    rights: "GoDesk 原创内容，不含第三方角色、剧本或美术",
  },
  {
    id: "idea-relay",
    title: "灵感接力",
    kicker: "无棋盘的对话创作游戏",
    summary: "轮流扩展一个共同创意、加入约束并连接前文，率先达到目标分。",
    players: "2–6 人",
    duration: "12 分钟",
    status: "可分享对话游戏",
    rights: "GoDesk 原创规则与程序化界面",
  },
];

export function isDefaultExampleId(value: unknown): value is DefaultExampleId {
  return DEFAULT_EXAMPLES.some((example) => example.id === value);
}
