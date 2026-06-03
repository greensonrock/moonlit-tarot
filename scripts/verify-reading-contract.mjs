#!/usr/bin/env node
/** Intent×Domain 契约层烟测：泛化路径，非单一 offer case */
import {
  intentGuidanceBlock,
  addressesQuestion,
  reflectionQuestionsFallback,
  hasDomainLeak,
  readingCtx
} from "../reading-contract.js";
import { analyzeQuestion } from "../public/question-profile.js";
import { tarotDeck } from "../tarot-data.js";
import { READING_SYNTHESIS_VERSION } from "../reading-synthesis.js";

function pick(name, pos, rev = false) {
  const c = tarotDeck.find((x) => x.name === name);
  return { ...c, position: pos, orientation: rev ? "逆位" : "正位", keywords: rev ? c.reversed : c.upright };
}

const CASES = [
  {
    label: "career·outcome",
    question: "接下来offer会是什么情况",
    theme: "career",
    intent: "outcome_forecast",
    cards: [pick("星币五", "现状", true), pick("权杖骑士", "阻碍"), pick("权杖十", "建议")]
  },
  {
    label: "relationship·partner",
    question: "他对我还有没有感觉",
    theme: "relationship",
    intent: "partner_attitude",
    cards: [pick("圣杯骑士", "现状"), pick("宝剑七", "阻碍", true), pick("力量", "建议")]
  },
  {
    label: "emotion·regulation",
    question: "最近焦虑到睡不着怎么办",
    theme: "emotion",
    intent: "emotion_regulation",
    cards: [pick("月亮", "现状"), pick("宝剑九", "阻碍"), pick("星星", "建议")]
  },
  {
    label: "self·clarity",
    question: "我怎么才能重新喜欢自己",
    theme: "self",
    intent: "self_clarity",
    cards: [pick("隐士", "现状"), pick("恶魔", "阻碍", true), pick("太阳", "建议")]
  }
];

let ok = true;
for (const c of CASES) {
  const reading = {
    question: c.question,
    theme: c.theme,
    themeLabel: c.theme,
    mood: "urgent",
    spread: "three",
    questionProfile: analyzeQuestion(c.question, c.theme),
    cards: c.cards
  };
  const ctx = readingCtx(reading);
  const prompt = intentGuidanceBlock(reading);
  const refs = reflectionQuestionsFallback(reading);
  const cardNames = c.cards.map((x) => x.name);
  const checks = {
    intent: ctx.intent === c.intent,
    prompt: prompt.includes("解读契约") && prompt.includes(ctx.intentLabel || ctx.intent),
    anchors: addressesQuestion(c.question, reading),
    refs: refs.length === 2 && refs.some((r) => cardNames.some((n) => r.includes(n))),
    cleanText: !hasDomainLeak(refs[0], reading)
  };
  if (c.theme !== "career") {
    checks.leakDetect = hasDomainLeak("offer仍在评估窗", reading);
  }
  const pass = Object.values(checks).every(Boolean);
  console.log(pass ? "OK" : "FAIL", "contract·" + c.label);
  if (!pass) {
    console.log(" ", Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(", "));
    ok = false;
  }
}

console.log("Synthesis:", READING_SYNTHESIS_VERSION);
if (!ok) process.exit(1);
console.log("Reading contract checks passed.");
