import type {
  RuleSystem,
  SourceLibraryEntry,
} from "../src/creator/project-contract";
import {
  DEFAULT_EXAMPLES,
  isDefaultExampleId,
  type DefaultExampleId,
} from "../src/creator/default-examples";

export { DEFAULT_EXAMPLES, isDefaultExampleId };
export type { DefaultExampleId };

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
  ruleSystemId: string,
  createdAt: string,
): { ruleSystem: RuleSystem; sources: SourceLibraryEntry[] } {
  if (exampleId === "harbor-13") {
    const sourceId = "source_harbor_13_original_brief";
    return {
      sources: [
        source(
          sourceId,
          "港口十三号原创玩法简述",
          "三家商会争夺三条货船航线。玩家轮流派遣伙计到货船、栈桥、干坞、私掠与领航位置；随后航行三次并结算进港或进坞收益。",
          createdAt,
        ),
      ],
      ruleSystem: {
        id: ruleSystemId,
        version: 1,
        name: "港口十三号",
        pitch: "在三条拥挤航线上押下有限资源，用放置、航行与领航抢先积累信用。",
        participants: { min: 3, max: 3, default: 3, roles: [] },
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
        constraints: [
          {
            id: "constraint_harbor_capacity",
            text: "伙计只能放到仍有空位且当前商会付得起的位置。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        entities: [
          {
            id: "entity_harbor_board",
            name: "港口航线板",
            kind: "object",
            quantity: 1,
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "entity_harbor_ships",
            name: "货船标记",
            kind: "token",
            quantity: 3,
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "entity_harbor_workers",
            name: "商会伙计",
            kind: "token",
            quantity: 12,
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "entity_harbor_dice",
            name: "货船骰",
            kind: "object",
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
        playSurface: {
          kind: "table",
          layout: "三条并列航线、栈桥、干坞、私掠与领航区。",
          regions: [
            { id: "route-amber", name: "琥珀航线", description: "d4 货船，货值 24。" },
            { id: "route-cobalt", name: "钴蓝航线", description: "d3 货船，货值 18。" },
            { id: "route-cedar", name: "雪松航线", description: "d2 货船，货值 12。" },
            { id: "piers", name: "栈桥区", description: "按进港艘数派发信用。" },
            { id: "yards", name: "干坞区", description: "按进坞艘数派发信用。" },
            { id: "specials", name: "特殊区", description: "私掠、领航与港务保险。" },
          ],
        },
        stages: [
          { id: "placement", name: "派遣伙计" },
          { id: "movement", name: "航行" },
          { id: "pilot", name: "领航" },
          { id: "settlement", name: "航次结算" },
        ],
        outcomes: [{ id: "first-voyage", name: "首航教学局" }],
        presentation: {
          theme: "harbor-voyage",
          visuals: [{
            provenance: "kit",
            label: "Harbor voyage presentation kit",
          }],
        },
        runtimeSupport: {
          status: "executable",
          unsupported: [
            "多航次终局、股份拍卖、贷款与盲客未包含在此单航次切片。",
          ],
          kernel: {
            type: "harbor-voyage-v1",
            playerCount: 3,
          },
        },
      },
    };
  }

  if (exampleId === "idea-relay") {
    const sourceId = "source_idea_relay_original_brief";
    return {
      sources: [
        source(
          sourceId,
          "灵感接力原创玩法简述",
          "灵感接力：参与者轮流公开发言，扩展共同创意、加入新约束或连接前文。每句发言写入记录，并按行动计分。率先达到目标分者获胜。游戏只需要共享提示与对话，不使用棋盘或实体道具。",
          createdAt,
        ),
      ],
      ruleSystem: {
        id: ruleSystemId,
        version: 1,
        name: "灵感接力",
        pitch: "把一个点子传下去；每个人都让它更具体，也更难一点。",
        participants: { min: 2, max: 6, default: 3, roles: [] },
        durationMinutes: 12,
        rules: [
          {
            id: "rule_idea_turn",
            text: "参与者按座位顺序轮流选择一个创意行动，并必须写出一句发言。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "rule_idea_continuity",
            text: "新内容必须保留并回应至少一个已有元素。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "rule_idea_win",
            text: "率先达到 8 分者获胜；18 回合后仍无人达到时最高分获胜。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        constraints: [
          {
            id: "constraint_idea_continuity",
            text: "新内容必须保留并回应至少一个已有元素。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        entities: [
          {
            id: "entity_shared_idea",
            name: "共同创意",
            kind: "concept",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "entity_constraints",
            name: "当前约束",
            kind: "concept",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "entity_transcript",
            name: "发言记录",
            kind: "object",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        setup: ["选出一句起始创意。", "随机确定第一位参与者。"],
        actions: [
          {
            id: "extend",
            label: "扩展创意",
            description: "增加一个与现有内容一致的新元素，获得 1 分。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "constraint",
            label: "加入约束",
            description: "增加一个之后所有人都必须遵守的约束，获得 2 分。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "connect",
            label: "连接前文",
            description: "把两个已有元素组合成一个新关系，获得 3 分。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        playSurface: {
          kind: "conversation",
          layout: "prompt-and-response",
          regions: [],
        },
        stages: [{ id: "relay", name: "创意接力" }],
        outcomes: [{ id: "target-score", name: "率先达到 8 分" }],
        presentation: {
          theme: "idea-relay",
          visuals: [{
            provenance: "kit",
            label: "程序化提示卡与共享分数界面",
          }],
        },
        runtimeSupport: {
          status: "executable",
          unsupported: ["文本内容的质量与约束一致性由真人评议；内核记录发言、轮次与计分。"],
          kernel: {
            type: "conversation-relay-v1",
            victoryTarget: 8,
            maxTurns: 18,
            actions: [
              { id: "extend", label: "扩展创意", points: 1 },
              { id: "constraint", label: "加入约束", points: 2 },
              { id: "connect", label: "连接前文", points: 3 },
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
          "三到四名调查员在雾岭山庄找出隐藏的凶手。每人秘密拿到身份牌。先轮流公开发言，再互相指控。被指控最多的人被揭晓：若是凶手则其余人获胜。",
          createdAt,
        ),
    ],
    ruleSystem: {
      id: ruleSystemId,
      version: 1,
      name: "雾岭山庄",
        pitch: "在雾气封锁出口前，靠发言和指控找出藏在调查员里的凶手。",
        participants: {
          min: 3,
          max: 4,
          default: 3,
          roles: [
            { id: "culprit", name: "凶手", description: "隐藏身份，误导指控。" },
            { id: "detective", name: "侦探", description: "组织发言并找出凶手。" },
            { id: "civilian-2", name: "平民", description: "提供证词并投票。" },
          ],
        },
      durationMinutes: 30,
      rules: [
        {
          id: "rule_lodge_turn",
            text: "先轮流公开发言，每人必须说一句对山庄异响的判断。",
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
        {
          id: "rule_lodge_victory",
            text: "所有人发言后每人指控一名其他玩家；揭晓被指控最多的人。",
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
      ],
      constraints: [
        {
          id: "constraint_lodge_limit",
            text: "每人只能发言一次、指控一次，不能指控自己。",
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
      ],
      entities: [
        {
          id: "entity_lodge_roles",
          name: "身份牌",
          kind: "card",
          quantity: 3,
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
        {
          id: "entity_lodge_transcript",
          name: "发言记录",
          kind: "object",
          quantity: 1,
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
        {
          id: "entity_lodge_map",
          name: "山庄房间图",
          kind: "location",
          quantity: 1,
          sourceId,
          provenance: "source-anchored",
          confidence: 1,
        },
      ],
        setup: ["秘密发放一张凶手、一张侦探，其余为平民。", "从座位 0 开始发言。"],
        actions: [
          {
            id: "speak",
            label: "发言",
            description: "公开说一句对本局的判断，写入发言记录。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
          {
            id: "accuse",
            label: "指控",
            description: "指控一名其他玩家。",
            sourceId,
            provenance: "source-anchored",
            confidence: 1,
          },
        ],
        playSurface: {
          kind: "conversation",
          layout: "山庄会客厅里的发言与指控。",
          regions: [
            { id: "parlor", name: "会客厅", description: "调查员对质的地方。" },
          ],
        },
        stages: [{ id: "discuss", name: "发言" }, { id: "accuse", name: "指控" }],
        outcomes: [{ id: "reveal", name: "揭晓被指控最多的人" }],
      presentation: {
        theme: "mistpeak-archive",
        visuals: [{
          provenance: "kit",
          label: "Mistpeak archive presentation kit",
        }],
      },
      runtimeSupport: {
        status: "executable",
          unsupported: ["山庄叙事质量由真人评议；内核只执行身份、发言与指控。"],
          kernel: {
            type: "hidden-role-v1",
            playerCount: 3,
            roles: [
              { id: "culprit", name: "凶手", alignment: "culprit" },
              { id: "detective", name: "侦探", alignment: "town" },
              { id: "civilian-2", name: "平民", alignment: "town" },
            ],
          },
      },
    },
  };
}
