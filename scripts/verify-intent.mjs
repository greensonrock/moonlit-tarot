#!/usr/bin/env node
/** 意图单源 + AI 地板烟测 */
import { analyzeQuestion, resolveReadingContext, READING_INTENTS } from "../public/question-profile.js";
import { inferQuestionContext } from "../reading-knowledge.js";
import { READING_SYNTHESIS_VERSION } from "../reading-synthesis.js";

const CASES = [
  ["offer", "接下来offer情况会是怎么样的", "career", "outcome_forecast"],
  ["partner", "他对我还有没有感觉", "relationship", "partner_attitude"],
  ["active", "我该不该主动一点？", "relationship", "yes_no_decision"],
  ["emotion", "最近焦虑到睡不着，我该怎么办", "emotion", "emotion_regulation"],
  ["self", "我怎么才能重新喜欢自己？", "self", "self_clarity"]
];

let ok = true;
for (const [label, q, domain, intent] of CASES) {
  const theme =
    domain === "emotion" ? "emotion" :
    domain === "career" ? "career" :
    domain === "self" ? "self" :
    "relationship";
  const profile = analyzeQuestion(q, theme);
  const fromProfile = resolveReadingContext({ question: q, theme: profile.dominantTheme, profile });
  const fromReading = inferQuestionContext({
    question: q,
    theme: profile.dominantTheme,
    questionProfile: profile
  });
  const match =
    profile.readingIntent === intent
    && profile.domain === domain
    && fromProfile.intent === intent
    && fromReading.intent === fromProfile.intent
    && fromProfile.domain === fromReading.domain;
  console.log(match ? "OK" : "FAIL", label, profile.readingIntent, profile.domain);
  if (!match) ok = false;
}

if (!READING_INTENTS.partner_attitude) {
  console.log("FAIL READING_INTENTS missing");
  ok = false;
}

console.log("Synthesis:", READING_SYNTHESIS_VERSION);
if (!ok) process.exit(1);
console.log("Intent single-source checks passed.");
