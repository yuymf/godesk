export type DefaultExampleId = "harbor-13" | "mistpeak-lodge";

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
    kicker: "原马尼拉机制 Demo 的公开安全版",
    summary: "派遣伙计、掷骰航行与领航结算，单航次抢先积累信用。",
    players: "3 人",
    duration: "25 分钟",
    status: "可玩机制切片",
    rights: "GoDesk 原创内容，不含原版规则、美术或照片",
  },
  {
    id: "mistpeak-lodge",
    title: "雾岭山庄",
    kicker: "原创山庄探索案例",
    summary: "调查房间、封印异象，在雾气吞没山庄前共同取得足够线索。",
    players: "2–4 人",
    duration: "30 分钟",
    status: "可玩机制切片",
    rights: "GoDesk 原创内容，不含第三方角色、剧本或美术",
  },
];
