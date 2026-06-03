#!/usr/bin/env node
/** 结构契约烟测（不调用 API） */
import { analyzeQuestion, inferThemeFromQuestion } from "../public/question-profile.js";
import { buildGentleFallback } from "../ai-reading.js";

const offerQ = "接下来offer情况会是怎么，上周2面试两个进入二面还没消息";
const theme = inferThemeFromQuestion(offerQ);
const profile = analyzeQuestion(offerQ, theme);

if (theme !== "career") {
  console.error("FAIL: offer question should infer career, got", theme);
  process.exit(1);
}

const reading = {
  question: offerQ,
  theme,
  mood: "urgent",
  spread: "three",
  questionProfile: profile,
  cards: [
    { position: "现状", name: "权杖王后", orientation: "正位", keywords: ["自信", "魅力"], suitKey: "wands", actionHint: "把自信用在具体表达上" },
    { position: "阻碍", name: "圣杯七", orientation: "逆位", keywords: ["认清现实"], suitKey: "cups" },
    { position: "建议", name: "倒吊人", orientation: "正位", keywords: ["暂停", "换角度"], suitKey: "major", actionHint: "先核对事实再行动" }
  ]
};

const fb = buildGentleFallback(reading);
const VERDICT_LEAN = /偏|倾向|更像|适合|宜|可以|暂缓|值得|评估|等待|主动|推进/;
const checks = [
  [VERDICT_LEAN.test(fb.directVerdict), "directVerdict 强判断"],
  [!/^就你问的/.test(fb.directVerdict), "无就你问前缀"],
  [fb.gentleActions?.length === 2, "gentleActions 两条"],
  [!/慢慢来|先不急着决定/.test(fb.gentleActions?.join("") || ""), "动作非空话"],
  [fb.positionReadings?.length === 3, "三牌解读"]
];

let ok = true;
for (const [pass, label] of checks) {
  console.log(pass ? "OK" : "FAIL", label);
  if (!pass) ok = false;
}
if (!ok) process.exit(1);
console.log("\nSample directVerdict:\n", fb.directVerdict);
