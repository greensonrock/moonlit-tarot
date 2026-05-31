#!/usr/bin/env node
/**
 * Evaluate fallback/merge reading objectivity on fixed challenging spreads.
 */
import { buildGentleFallback } from "../ai-reading.js";
import { tarotDeck } from "../tarot-data.js";

function findCard(namePart) {
  return tarotDeck.find((c) => c.name.includes(namePart));
}

function mockReading(cards, question, theme = "career", mood = "urgent") {
  const isRelationship = theme === "relationship";
  return {
    theme,
    mood,
    question,
    spread: "three",
    themeLabel: isRelationship ? "心动与关系" : "工作与野心",
    questionProfile: {
      text: question,
      intent: isRelationship ? "关系确认" : "职业方向",
      isCareer: theme === "career",
      isRelationship,
      isDecision: /该不该|要不要/.test(question)
    },
    cards: cards.map((spec, index) => {
      const base = findCard(spec.name);
      if (!base) throw new Error(`Card not found: ${spec.name}`);
      const reversed = spec.reversed;
      return {
        ...base,
        position: ["现状", "阻碍", "建议"][index],
        orientation: reversed ? "逆位" : "正位",
        keywords: reversed ? base.reversed : base.upright
      };
    })
  };
}

const POSITIVE_ONLY = /在路上|别慌|会好|耐心等|好事多|给你出口|仍在给你|别急着否定|慢慢会|熬过/;
const CHALLENGE_MARKERS = /卡|阻|拖|耗|冲突|延迟|冷淡|失衡|损失|结束|崩|束缚|犹豫|代价|风险|阻滞|观望|消耗|拉扯|内耗|偏淡|评估|核实|流程|不稳|延迟|打破|恐惧|诱惑|执念/;

function analyzeOutput(label, ai) {
  const corpus = [
    ai.briefSummary,
    ai.presentState,
    ai.innerTheme,
    ai.closingLine,
    ...(ai.positionReadings || []).map((p) => p.text),
    ...(ai.reminders || [])
  ].join("\n");
  const overlyPositive = POSITIVE_ONLY.test(corpus) && !CHALLENGE_MARKERS.test(corpus);
  const hasChallenge = CHALLENGE_MARKERS.test(corpus);
  console.log(`\n=== ${label} ===`);
  console.log("浓缩:", ai.briefSummary);
  console.log("主题线:", ai.innerTheme);
  ai.positionReadings?.forEach((p) => console.log(`${p.position}:`, p.text));
  console.log("收束:", ai.closingLine);
  console.log("挑战词:", hasChallenge ? "✓ 有" : "✗ 无");
  console.log("空安慰:", overlyPositive ? "✗ 疑似只有正面" : "✓ 通过");
  return { hasChallenge, overlyPositive };
}

const cases = [
  mockReading(
    [{ name: "星币六", reversed: false }, { name: "皇后", reversed: true }, { name: "圣杯王后", reversed: false }],
    "接下来offer会出现在什么时候和什么地方"
  ),
  mockReading(
    [{ name: "高塔", reversed: true }, { name: "太阳", reversed: false }, { name: "权杖五", reversed: true }],
    "接下来offer会出现在什么时候和什么地方"
  ),
  mockReading(
    [{ name: "恶魔", reversed: false }, { name: "宝剑十", reversed: false }, { name: "星星", reversed: true }],
    "他目前对我是什么感觉",
    "relationship",
    "lost"
  ),
  mockReading(
    [{ name: "圣杯五", reversed: true }, { name: "月亮", reversed: false }, { name: "节制", reversed: false }],
    "我该不该继续这段关系",
    "relationship",
    "lost"
  )
];

let pass = 0;
for (const reading of cases) {
  const ai = buildGentleFallback(reading);
  const r = analyzeOutput(reading.question, ai);
  if (r.hasChallenge && !r.overlyPositive) pass += 1;
}
console.log(`\n总结: ${pass}/${cases.length} 组挑战牌阵回退解读通过客观性检查`);
