#!/usr/bin/env node
/** P5：模拟 AI 漂移输出，断言 normalizeAiResult 强制 Interpret 地板 */
import { normalizeAiResult } from "../ai-reading.js";
import { analyzeQuestion } from "../public/question-profile.js";
import { tarotDeck } from "../tarot-data.js";
import { interpretCardInContext } from "../reading-knowledge.js";
import { READING_SYNTHESIS_VERSION } from "../reading-synthesis.js";

function pick(name, pos, rev = false) {
  const c = tarotDeck.find((x) => x.name === name);
  return {
    ...c,
    position: pos,
    orientation: rev ? "逆位" : "正位",
    keywords: rev ? c.reversed : c.upright
  };
}

const cards = [
  pick("正义", "现状"),
  pick("圣杯四", "阻碍"),
  pick("月亮", "建议", true)
];
const reading = {
  question: "接下来offer情况会是怎么样的",
  theme: "career",
  themeLabel: "工作与野心",
  mood: "turning",
  spread: "three",
  questionProfile: analyzeQuestion("接下来offer情况会是怎么样的", "career"),
  cards
};

const aiDrift = {
  directVerdict:
    "offer更像评估等待期，不是已黄。现状正义正：流程仍在转动；阻碍圣杯四正：你内心倦怠；建议月亮逆：停止脑补。",
  briefSummary:
    "offer更像评估等待期，不是已黄。现状正义正：流程仍在转动，需要你保持平衡等待判断。",
  presentState:
    "我感受到你在等一个转机。offer更像评估等待期，不是已黄。现状正义正：流程仍在转动。",
  innerTheme: "底层是对值不值得被认真对待的怀疑。",
  positionReadings: cards.map((c) => ({
    position: c.position,
    cardName: c.name,
    text: `${c.position}·${c.name}：AI自由发挥倦怠与不满 narrative`
  })),
  gentleActions: ["列出待确认项，发礼貌跟进", "本周核对一条 offer 事实"],
  reflectionQuestions: ["你更怕机会没了，还是怕推进一小步？", "不要只在细节里找确定感"],
  reminders: ["评估", "倦怠"],
  closingLine: "别在想象里消耗自己",
  headline: "评估等待"
};

const out = normalizeAiResult(aiDrift, reading);
let ok = true;

for (const card of cards) {
  const engine = interpretCardInContext(card, reading);
  const pr = out.positionReadings.find((p) => p.cardName === card.name);
  if (!pr?.text.includes(engine.slice(0, 8))) {
    console.log("FAIL position not from engine:", card.name, pr?.text);
    ok = false;
  }
}

if (/AI自由发挥|内心倦怠 narrative/.test(JSON.stringify(out))) {
  console.log("FAIL AI drift leaked into output");
  ok = false;
}

if (isDup(out.briefSummary, out.directVerdict)) {
  console.log("FAIL briefSummary duplicates verdict");
  ok = false;
}

if (!/评估|等待|不是已黄/.test(out.directVerdict)) {
  console.log("FAIL verdict direction");
  ok = false;
}

console.log(ok ? "OK" : "FAIL", "P5 normalizeAiResult floor");
console.log("  verdict:", out.directVerdict.slice(0, 80) + "…");
console.log("  圣杯四:", out.positionReadings.find((p) => p.cardName === "圣杯四")?.text);
console.log("Synthesis:", READING_SYNTHESIS_VERSION);
if (!ok) process.exit(1);
console.log("P5 AI normalize checks passed.");

function isDup(a, b) {
  const left = String(a || "").replace(/\s/g, "");
  const right = String(b || "").replace(/\s/g, "");
  if (left.length < 12 || right.length < 12) return false;
  const lead = right.slice(0, Math.min(24, right.length));
  return left.includes(lead) && left.length <= right.length * 1.2;
}
