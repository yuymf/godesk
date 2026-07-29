import type {
  GameDefinition,
  SourceLibraryEntry,
} from "../src/creator/project-contract";

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
    summary: "押注货船航线，在有限回合里用高风险行动抢先积累声望。",
    players: "3 人",
    duration: "20 分钟",
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

export function isDefaultExampleId(value: unknown): value is DefaultExampleId {
  return DEFAULT_EXAMPLES.some((example) => example.id === value);
}

function source(
  id: string,
  name: string,
  content: string,
  createdAt: string,
): SourceLibraryEntry {
  return {
    id,
    kind: "brief",
    name,
    content,
    readiness: "ready",
    provenance: {
      origin: "creator-authored",
      locator: "GoDesk default example catalog",
      confidence: 1,
    },
    createdAt,
  };
}

export function instantiateDefaultExample(
  exampleId: DefaultExampleId,
  definitionId: string,
  createdAt: string,
): { definition: GameDefinition; sources: SourceLibraryEntry[] } {
  if (exampleId === "harbor-13") {
    const sourceId = "source_harbor_13_original_brief";
    return {
      sources: [
        source(
          sourceId,
          "港口十三号原创玩法简述",
          "三家商会争夺航线。玩家每回合选择稳健装货、冒险抢航或港口情报，最先取得 15 点声望者获胜。此案例只复用通用的航运押注题材，不含任何第三方规则表达、美术或照片。",
          createdAt,
        ),
      ],
      definition: {
        id: definitionId,
        version: 1,
        name: "港口十三号",
        pitch: "在三条拥挤航线上押下有限资源，抢先赢得港口声望。",
        playerCount: 3,
        durationMinutes: 20,
        rules: [
          {
            id: "rule_harbor_turn",
            text: "轮到你时，从三个公开行动中选择一个并获得对应声望。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "rule_harbor_victory",
            text: "任一玩家达到 15 点声望时立即获胜；若 12 回合后无人达到，声望最高者获胜。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        components: [
          {
            id: "component_harbor_board",
            name: "港口航线板",
            quantity: 1,
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "component_harbor_markers",
            name: "商会声望标记",
            quantity: 3,
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        setup: ["每名玩家将声望设为 0。", "将回合标记放在第 1 格。"],
        actions: [
          {
            id: "steady-cargo",
            label: "稳健装货",
            description: "装载可靠货物，获得 2 点声望。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "risky-sailing",
            label: "冒险抢航",
            description: "抢占高风险航线，获得 3 点声望。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "harbor-intel",
            label: "港口情报",
            description: "交换可靠消息，获得 1 点声望。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        board: {
          layout: "三条并列航线与一条公共声望轨。",
          zones: [
            { id: "route-east", name: "东线", description: "稳定的近海航线。" },
            { id: "route-storm", name: "风暴线", description: "高风险远海航线。" },
            { id: "harbor", name: "港务厅", description: "公开情报与结算区。" },
          ],
        },
        phases: [{ id: "action", name: "商会行动" }, { id: "check", name: "胜负检查" }],
        scenarios: [{ id: "first-voyage", name: "首航教学局" }],
        presentation: { theme: "harbor-ledger" },
        runtimeSupport: {
          status: "executable",
          unsupported: ["原内部马尼拉 fixture 的拍卖、船只和骰子规则未包含在此公开案例。"],
          kernel: {
            type: "score-race-v1",
            victoryTarget: 15,
            maxTurns: 12,
            actions: [
              { id: "steady-cargo", label: "稳健装货", points: 2 },
              { id: "risky-sailing", label: "冒险抢航", points: 3 },
              { id: "harbor-intel", label: "港口情报", points: 1 },
            ],
          },
        },
      },
    };
  }

  const sourceId = "source_mistpeak_lodge_original_brief";
  return {
    sources: [
      source(
        sourceId,
        "雾岭山庄原创玩法简述",
        "调查员共同探索一座被雾气包围的原创山庄，通过调查、协作和封印行动累计线索。此机制切片不含隐藏背叛、第三方角色、房间、剧本、规则文字或美术。",
        createdAt,
      ),
    ],
    definition: {
      id: definitionId,
      version: 1,
      name: "雾岭山庄",
      pitch: "在雾气封锁出口前，合作调查房间并封印山庄里的异响。",
      playerCount: 4,
      durationMinutes: 30,
      rules: [
        {
          id: "rule_lodge_turn",
          text: "轮到你时选择调查、协作或封印，并将所得线索加入团队总分。",
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
        {
          id: "rule_lodge_victory",
          text: "团队在 14 回合内累计 18 条线索即获胜，否则雾气吞没出口。",
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
      ],
      components: [
        {
          id: "component_lodge_map",
          name: "山庄房间图",
          quantity: 1,
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
        {
          id: "component_lodge_clues",
          name: "线索标记",
          quantity: 18,
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
      ],
      setup: ["将团队线索设为 0。", "所有调查员从门厅开始。"],
      actions: [
        {
          id: "investigate",
          label: "调查房间",
          description: "检查当前房间，获得 2 条线索。",
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
        {
          id: "cooperate",
          label: "结伴协作",
          description: "交换发现并获得 1 条线索。",
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
        {
          id: "seal-anomaly",
          label: "封印异象",
          description: "冒险处理异响，获得 3 条线索。",
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
      ],
      board: {
        layout: "门厅连接书房、温室与阁楼的原创固定地图。",
        zones: [
          { id: "foyer", name: "门厅", description: "调查员的共同起点。" },
          { id: "study", name: "旧书房", description: "散落着住客记录。" },
          { id: "greenhouse", name: "雾温室", description: "玻璃外只有白雾。" },
          { id: "attic", name: "阁楼", description: "异响最密集的区域。" },
        ],
      },
      phases: [{ id: "explore", name: "调查行动" }, { id: "fog", name: "雾气推进" }],
      scenarios: [{ id: "sealed-bell", name: "封住午夜钟声" }],
      presentation: { theme: "mistpeak-archive" },
      runtimeSupport: {
        status: "executable",
        unsupported: ["这是合作计分机制切片，不包含隐藏身份或中途背叛系统。"],
        kernel: {
          type: "score-race-v1",
          victoryTarget: 18,
          maxTurns: 14,
          actions: [
            { id: "investigate", label: "调查房间", points: 2 },
            { id: "cooperate", label: "结伴协作", points: 1 },
            { id: "seal-anomaly", label: "封印异象", points: 3 },
          ],
        },
      },
    },
  };
}
