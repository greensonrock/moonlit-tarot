#!/usr/bin/env node
/** P6：AI 主责解读 — 有效 AI 分牌保留；漂移/弱句才回退引擎 */
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

const aiGood = {
  directVerdict:
    "offer更像评估等待期，不是已黄。现状正义正：流程仍在转动；阻碍圣杯四正：你内心倦怠；建议月亮逆：停止脑补。",
  briefSummary:
    "我感受到你在等一个转机。offer更像评估等待期，不是已黄——先分清事实与担心。",
  presentState: "悬空感我能感受到。结论：流程仍在评估期，先分清已知信息与脑补的担心。",
  descriptionLayer: "牌面看见评估仍在进行，不是一锤定音。",
  situationLayer: "你困的不是安静，而是把没消息读成否定。",
  meaningLayer: "一边想快点有结果，一边又怕听到坏消息。",
  innerTheme: "底层是对值不值得被认真对待的怀疑。",
  positionReadings: cards.map((c) => ({
    position: c.position,
    cardName: c.name,
    text: `${c.position}·${c.name}（${c.orientation}）：就 offer 而言，${c.name}指向${c.keywords?.[0] || "关键信号"}，需要放进你的等待节奏里理解。`
  })),
  gentleActions: ["列出待确认项，发礼貌跟进", "本周核对一条 offer 事实"],
  reflectionQuestions: ["你更怕机会没了，还是怕推进一小步？", "不要只在细节里找确定感"],
  reminders: ["评估", "倦怠"],
  closingLine: "别在想象里消耗自己",
  headline: "评估等待"
};

const aiDrift = {
  ...aiGood,
  positionReadings: cards.map((c) => ({
    position: c.position,
    cardName: c.name,
    text: "AI自由发挥 narrative without card name"
  }))
};

const goodOut = normalizeAiResult(aiGood, reading);
const driftOut = normalizeAiResult(aiDrift, reading);
let ok = true;

const cupFourGood = goodOut.positionReadings.find((p) => p.cardName === "圣杯四");
if (!cupFourGood?.text.includes("倦怠") && !cupFourGood?.text.includes("圣杯四")) {
  console.log("FAIL good AI position not preserved:", cupFourGood?.text);
  ok = false;
}

if (/就 offer 现在这一步，对/.test(cupFourGood?.text || "")) {
  console.log("FAIL good AI replaced by engine template:", cupFourGood?.text);
  ok = false;
}

if (!goodOut.descriptionLayer || !goodOut.situationLayer) {
  console.log("FAIL story layers missing from AI");
  ok = false;
}

const cupFourDrift = driftOut.positionReadings.find((p) => p.cardName === "圣杯四");
const engineSnippet = interpretCardInContext(cards[1], reading).slice(0, 8);
if (!cupFourDrift?.text.includes(engineSnippet)) {
  console.log("FAIL drift not guarded by engine:", cupFourDrift?.text);
  ok = false;
}

if (/AI自由发挥/.test(JSON.stringify(driftOut))) {
  console.log("FAIL drift leaked");
  ok = false;
}

console.log(ok ? "OK" : "FAIL", "P6 AI-primary normalize");
console.log("  good 圣杯四:", cupFourGood?.text?.slice(0, 60));
console.log("  drift 圣杯四:", cupFourDrift?.text?.slice(0, 60));
console.log("Synthesis:", READING_SYNTHESIS_VERSION);
if (!ok) process.exit(1);
console.log("P6 AI-primary checks passed.");
