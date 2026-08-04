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
          "三家商会争夺三条货船航线。玩家轮流派遣伙计到货船、栈桥、干坞、私掠与领航位置；随后航行三次并结算进港/进坞收益。此案例只复用通用航运题材，不含任何第三方规则表达、美术或照片。",
          createdAt,
        ),
      ],
      definition: {
        id: definitionId,
        version: 1,
        name: "港口十三号",
        pitch: "在三条拥挤航线上押下有限资源，用放置、航行与领航抢先积累信用。",
        playerCount: 3,
        durationMinutes: 25,
        rules: [
          {
            id: "rule_harbor_place",
            text: "共 4 轮放置：每轮每名玩家派遣 1 名伙计到仍有空位且付得起的位置。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "rule_harbor_sail",
            text: "第 2、3 轮放置后各航行一次；第 4 轮放置后经领航再进行最后一次航行。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "rule_harbor_settle",
            text: "航次结束时按进港、进坞与私掠结果结算信用；信用最高者领先。",
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
            id: "component_harbor_ships",
            name: "货船标记",
            quantity: 3,
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "component_harbor_workers",
            name: "商会伙计",
            quantity: 12,
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "component_harbor_dice",
            name: "货船骰",
            quantity: 3,
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        setup: [
          "每名玩家持有 30 信用与 4 名伙计。",
          "三艘货船分别停在 4、3、2。",
          "港务商会先行动。",
        ],
        actions: [
          {
            id: "place-cargo",
            label: "派伙计上船",
            description: "选择琥珀货、钴蓝绸或雪松木货船的空位。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "place-port",
            label: "押注栈桥",
            description: "占据东/中/西栈桥，按进港艘数结算。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "place-yard",
            label: "押注干坞",
            description: "占据干坞，按进坞艘数结算。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "sail",
            label: "掷骰航行",
            description: "三艘货船按各自骰面前进。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "pilot",
            label: "领航调整",
            description: "末次航行前将一艘船前后调整。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        board: {
          layout: "三条并列航线、栈桥、干坞、私掠与领航区。",
          zones: [
            { id: "route-amber", name: "琥珀航线", description: "d4 货船，货值 24。" },
            { id: "route-cobalt", name: "钴蓝航线", description: "d3 货船，货值 18。" },
            { id: "route-cedar", name: "雪松航线", description: "d2 货船，货值 12。" },
            { id: "piers", name: "栈桥区", description: "按进港艘数派发信用。" },
            { id: "yards", name: "干坞区", description: "按进坞艘数派发信用。" },
            { id: "specials", name: "特殊区", description: "私掠、领航与港务保险。" },
          ],
        },
        phases: [
          { id: "placement", name: "派遣伙计" },
          { id: "movement", name: "航行" },
          { id: "pilot", name: "领航" },
          { id: "settlement", name: "航次结算" },
        ],
        scenarios: [{ id: "first-voyage", name: "首航教学局" }],
        presentation: {
          theme: "harbor-voyage",
          visuals: [{
            provenance: "kit",
            label: "Harbor voyage fallback kit",
          }],
        },
        runtimeSupport: {
          status: "executable",
          unsupported: [
            "多航次终局、股份拍卖、贷款与盲客未包含在此单航次切片。",
            "原内部马尼拉 fixture 的商标文案、美术与照片未包含。",
          ],
          kernel: {
            type: "harbor-voyage-v1",
            playerCount: 3,
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
      presentation: {
        theme: "mistpeak-archive",
        visuals: [{
          provenance: "kit",
          label: "Mistpeak archive fallback kit",
        }],
      },
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
