#!/usr/bin/env node
/** AI prompt 地板烟测：buildReadingPrompt 须含牌理地板且与本地 verdict 同向 */
import { buildReadingPrompt } from "../ai-reading.js";
import { buildGentleFallback } from "../ai-reading.js";
import { analyzeQuestion } from "../public/question-profile.js";
import { tarotDeck } from "../tarot-data.js";
import { buildSpreadVerdict } from "../reading-synthesis.js";
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

function makeReading(q, theme, cards, themeLabel) {
  return {
    question: q,
    theme,
    themeLabel: themeLabel || "当下",
    mood: "urgent",
    spread: cards.length === 1 ? "one" : "three",
    questionProfile: analyzeQuestion(q, theme),
    cards
  };
}

const CASES = [
  [
    "career",
    makeReading(
      "接下来offer情况会是怎么样的",
      "career",
      [pick("宝剑七", "现状"), pick("星币二", "阻碍", true), pick("宝剑国王", "建议")],
      "工作与野心"
    ),
    /offer|评估|核验/
  ],
  [
    "self",
    makeReading(
      "我怎么才能重新喜欢自己？",
      "self",
      [pick("隐士", "现状"), pick("恶魔", "阻碍", true), pick("太阳", "建议")],
      "自我与成长"
    ),
    /自我价值|内在|辨认|值得/
  ]
];

let ok = true;
for (const [label, reading, pattern] of CASES) {
  const prompt = buildReadingPrompt(reading);
  const floor = buildSpreadVerdict(reading);
  const fb = buildGentleFallback(reading);
  const checks = {
    hasSystem: typeof prompt.system === "string" && prompt.system.includes("directVerdict"),
    hasFloorSection: prompt.user.includes("牌理推理地板"),
    floorInPrompt: prompt.user.includes(floor.slice(0, 20)),
    hasDomainIntent: prompt.user.includes("解读域/意图"),
    alignsFallback: pattern.test(fb.directVerdict),
    noBanned: !/就你问的[「『][^」』]+[」』]：/.test(prompt.user)
  };
  const pass = Object.values(checks).every(Boolean);
  console.log(pass ? "OK" : "FAIL", "prompt·" + label);
  if (!pass) {
    console.log(" ", Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(", "));
    ok = false;
  }
}

console.log("Synthesis:", READING_SYNTHESIS_VERSION);
if (!ok) process.exit(1);
console.log("AI prompt floor checks passed.");
