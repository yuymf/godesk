export interface RuleAnswer {
  answer: string;
  citation: string | null;
  certain: boolean;
}

const rules = [
  {
    terms: ["目标", "获胜", "赢", "胜利"],
    answer: "完成一次航次后，银币最多的商会获胜。收入来自成功抵港的货船，以及押中的港口、船厂或海盗湾。",
    citation: "原型规则 §1 · 航次目标",
  },
  {
    terms: ["放置", "伙计", "工人", "下注", "费用"],
    answer: "轮到你时选择一艘货船或一个结果区域，支付当前费用并派出一名伙计。同一位置越拥挤，下一次放置越贵。",
    citation: "原型规则 §2 · 派遣伙计",
  },
  {
    terms: ["航行", "骰子", "掷骰", "移动"],
    answer: "所有伙计放完后进入航行阶段。每轮为三艘船各掷一颗六面骰，共航行三轮。骰子结果会作为权威事件写入日志。",
    citation: "原型规则 §3 · 三轮航行",
  },
  {
    terms: ["海盗", "13", "抢劫", "遭劫"],
    answer: "第三轮结束时，恰好停在第 13 格的船会被海盗截获。海盗湾中的伙计平分这些船的货值。",
    citation: "原型规则 §4 · 海盗湾",
  },
  {
    terms: ["港口", "船厂", "结算", "奖励", "银币"],
    answer: "超过第 13 格的船进港，船上伙计平分货值；低于第 13 格的船进入船厂。港口或船厂只要出现对应结果，就会给押中的伙计固定奖励。",
    citation: "原型规则 §5 · 航次结算",
  },
  {
    terms: ["撤销", "回放", "日志", "保存"],
    answer: "每次放置和掷骰都会记录成不可变事件。撤销会移除最后一个事件，回放只重建预览状态，不会修改当前对局。",
    citation: "测试台说明 §2 · 事件记录",
  },
];

export function answerRuleQuestion(question: string): RuleAnswer {
  const normalized = question.trim().toLowerCase();
  const match = rules.find((rule) =>
    rule.terms.some((term) => normalized.includes(term.toLowerCase())),
  );
  if (!match) {
    return {
      answer: "当前原型规则中没有找到明确答案。我不会把常识当成这款游戏的规则；请换一种问法，或查看下方的规则来源。",
      citation: null,
      certain: false,
    };
  }
  return { answer: match.answer, citation: match.citation, certain: true };
}
