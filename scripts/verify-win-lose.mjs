#!/usr/bin/env node
/** 输赢/能不能成类问题须给出明确主观倾向 */
import { buildGentleFallback, normalizeAiResult } from "../ai-reading.js";
import { analyzeQuestion } from "../public/question-profile.js";
import { tarotDeck } from "../tarot-data.js";
import { addressesQuestion } from "../reading-contract.js";

function pick(name, pos, rev = false) {
  const c = tarotDeck.find((x) => x.name === name);
  return {
    ...c,
    position: pos,
    orientation: rev ? "逆位" : "正位",
    keywords: rev ? c.reversed : c.upright
  };
}

const question = "今天打德州会不会赢";
const reading = {
  question,
  theme: "future",
  themeLabel: "未来与选择",
  mood: "urgent",
  spread: "three",
  questionProfile: analyzeQuestion(question, "future"),
  cards: [pick("太阳", "现状"), pick("月亮", "阻碍", true), pick("节制", "建议")]
};

const LEAN = /偏|宜|不宜|胜算|顺风|逆风|赢面|控仓|小注|五五开|有利|不利|不宜重仓|有胜算/;
const EVASIVE = /仍在展开|不是已否|尚未一锤定音|先观察|也许|可能还在/;

const fb = buildGentleFallback(reading);
let ok = true;

if (reading.questionProfile.readingIntent !== "win_lose_forecast") {
  console.log("FAIL intent not win_lose_forecast:", reading.questionProfile.readingIntent);
  ok = false;
}
if (!LEAN.test(fb.directVerdict)) {
  console.log("FAIL fallback verdict not lean:", fb.directVerdict);
  ok = false;
}
if (EVASIVE.test(fb.directVerdict)) {
  console.log("FAIL fallback verdict too evasive:", fb.directVerdict);
  ok = false;
}
if (!addressesQuestion(fb.directVerdict, reading)) {
  console.log("FAIL verdict does not address question");
  ok = false;
}

const weakAi = {
  directVerdict: "可能还在观察中，事情仍在展开窗，先等等看。",
  briefSummary: "感受值得被看见。",
  innerTheme: "三张牌连起来看。",
  positionReadings: reading.cards.map((c) => ({
    position: c.position,
    cardName: c.name,
    text: `${c.position}·${c.name}：泛泛而谈。`
  })),
  gentleActions: ["慢慢来"],
  closingLine: "顺其自然",
  headline: "观望"
};
const weakOut = normalizeAiResult(weakAi, reading);
if (!/可能还在观察中|也许会有消息/.test(weakOut.directVerdict)) {
  console.log("FAIL weak AI verdict overwritten by engine:", weakOut.directVerdict);
  ok = false;
}

console.log(ok ? "OK" : "FAIL", "win-lose-forecast");
console.log("  verdict:", fb.directVerdict);
if (!ok) process.exit(1);
console.log("Win/lose forecast checks passed.");
