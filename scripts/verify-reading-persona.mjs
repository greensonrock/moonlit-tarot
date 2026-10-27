import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TAROT_PERSONA_V3, resolveRoastLevel } from "../reading-persona.js";
import { buildReadingPrompt } from "../ai-reading.js";
import { tarotDeck } from "../tarot-data.js";
import { analyzeQuestion } from "../public/question-profile.js";

const question = "我已经做了五版计划，但一直没有开始，我是不是太拖延了？";
const card = tarotDeck.find((item) => item.slug === "pentacles-eight");
const reading = {
  question, theme: "self", themeLabel: "自我与成长", mood: "urgent", spread: "one",
  questionProfile: analyzeQuestion(question, "self"),
  cards: [{ ...card, orientation: "逆位", position: "今日指引", keywords: card.reversed }]
};
const prompt = buildReadingPrompt(reading);
assert.equal(TAROT_PERSONA_V3, readFileSync(new URL("../prompts/tarot-persona-v3.md", import.meta.url), "utf8"));
assert.ok(prompt.system.startsWith(TAROT_PERSONA_V3));
assert.match(prompt.system, /roast_level=2/);
assert.match(prompt.system, /信息不足/);
assert.match(prompt.system, /positionReadings/);
assert.match(prompt.user, /card_id：pentacles-eight/);
assert.ok(!prompt.user.includes("【范例 1 · 职业/等待 · 中立偏暖】"));
assert.equal(resolveRoastLevel({ question: "连续面试失败，我是不是很没用？", roastLevel: 3 }), 0);
assert.equal(resolveRoastLevel({ question: "我不想活了" }), 0);
assert.equal(resolveRoastLevel({ question, roastLevel: 3 }), 3);
assert.equal(resolveRoastLevel({ question, roastLevel: 9 }), 2);
assert.match(buildReadingPrompt({ ...reading, question: "连续面试失败，我是不是很没用？" }).system, /roast_level=0/);
console.log("OK V3 原文、人设注入、JSON 适配、默认等级及脆弱情绪降级");
