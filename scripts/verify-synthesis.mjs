#!/usr/bin/env node
/** 系统化解读烟测：问题×牌面×知识库×心理学 四层断言 */
import { buildGentleFallback } from "../ai-reading.js";
import { analyzeQuestion, resolveReadingContext } from "../public/question-profile.js";
import { inferQuestionContext } from "../reading-knowledge.js";
import { tarotDeck } from "../tarot-data.js";
import { READING_SYNTHESIS_VERSION } from "../reading-synthesis.js";

const BAD = /就你问的|悬崖边|提灯独行|juggling|这股能量暂时没有顺畅流动|不必今天就想通/;
const HARSH = /谣言中伤/;

function pick(name, pos, rev = false) {
  const c = tarotDeck.find((x) => x.name === name);
  if (!c) throw new Error(`missing ${name}`);
  return {
    ...c,
    position: pos,
    orientation: rev ? "逆位" : "正位",
    keywords: rev ? c.reversed : c.upright
  };
}

function runCase(label, question, cards, theme, extra = () => true) {
  const profile = analyzeQuestion(question, theme);
  const reading = {
    question,
    theme,
    themeLabel:
      theme === "career" ? "工作与野心" :
      theme === "relationship" ? "心动与关系" :
      theme === "emotion" ? "情绪与生活" : "自我与成长",
    mood: "urgent",
    spread: cards.length === 1 ? "one" : "three",
    questionProfile: profile,
    cards
  };
  const fb = buildGentleFallback(reading);
  const blob = JSON.stringify(fb);
  const checks = {
    noTemplate: !BAD.test(blob),
    noHarshReminder: !HARSH.test((fb.reminders || []).join("")),
    verdictStrong: fb.directVerdict.length > 20 && /偏|倾向|可以|不宜|仍在|不是|评估|核验|主动|流程|靠近|小步|睡眠|感受|温度|有没有/.test(fb.directVerdict),
    cardsLinked: cards.every((c) => blob.includes(c.name)),
    psychLayer: !!(fb.innerTheme && fb.presentState && fb.gentleActions?.length),
    positionsOk: fb.positionReadings?.length === cards.length
  };
  const ok = Object.values(checks).every(Boolean) && extra(fb, blob);
  console.log(ok ? "OK" : "FAIL", label);
  if (!ok) {
    console.log("  verdict:", fb.directVerdict.slice(0, 100));
    console.log("  fail:", Object.entries(checks).filter(([, v]) => !v).map(([k]) => k));
  }
  return ok;
}

const cases = [
  ["offer·宝剑七/星币二逆/宝剑国王", "接下来offer情况会是怎么样的", [
    pick("宝剑七", "现状"), pick("星币二", "阻碍", true), pick("宝剑国王", "建议")
  ], "career", (fb) => /offer|核验|信息|评估/.test(fb.directVerdict)],
  ["offer·愚者/隐士/星币六", "offer情况会怎么样，很好奇", [
    pick("愚者", "现状"), pick("隐士", "阻碍"), pick("星币六", "建议")
  ], "career"],
  ["关系·该不该主动", "我该不该主动一点？", [pick("宝剑侍从", "今日指引", true)], "relationship",
    (fb, blob) => /可以|不宜|小步|主动/.test(fb.directVerdict) && !/谣言中伤/.test(blob)],
  ["关系·对方心意", "他对我还有没有感觉", [
    pick("圣杯骑士", "现状"), pick("宝剑七", "阻碍", true), pick("力量", "建议")
  ], "relationship", (fb) => /感觉|温度|互动|有没有|辨认/.test(fb.directVerdict)],
  ["职业·等消息", "上周面试进入二面还没消息", [
    pick("权杖王后", "现状"), pick("圣杯七", "阻碍", true), pick("倒吊人", "建议")
  ], "career"],
  ["情绪·失眠焦虑", "最近焦虑到睡不着，我该怎么办", [
    pick("月亮", "现状"), pick("宝剑九", "阻碍"), pick("星星", "建议")
  ], "emotion", (fb, blob) =>
    /睡眠|焦虑|身体|怎么办|感受|稳/.test(fb.directVerdict + fb.presentState)
    && !/对方/.test(fb.directVerdict)
    && /呼吸|睡|照顾|仪式|散步|热水/.test((fb.gentleActions || []).join(""))],
  ["自我·喜欢自己", "我怎么才能重新喜欢自己？", [
    pick("隐士", "现状"), pick("恶魔", "阻碍", true), pick("太阳", "建议")
  ], "self", (fb, blob) =>
    /自我价值|内在|辨认|值得|重建/.test(fb.directVerdict)
    && !/对方|offer/.test(fb.directVerdict)
    && /自己|需要|小事/.test((fb.gentleActions || []).join(""))],
  ["offer·正义/圣杯四/月亮逆", "接下来offer情况会是怎么样的", [
    pick("正义", "现状"), pick("圣杯四", "阻碍"), pick("月亮", "建议", true)
  ], "career", (fb, blob) =>
    /评估|等待|不是已黄|流程/.test(fb.directVerdict)
    && /倦怠|封闭|麻木|反馈|漏看/.test(fb.positionReadings.find((p) => p.cardName === "圣杯四")?.text || "")
    && /脑补|核对|事实|停/.test(fb.positionReadings.find((p) => p.cardName === "月亮")?.text || "")
    && !/就你问的/.test(blob)]
];

let all = true;
for (const args of cases) {
  if (!runCase(...args)) all = false;
}
console.log("\nSynthesis version:", READING_SYNTHESIS_VERSION);

const INTENT_CASES = [
  ["partner", "他对我还有没有感觉", "relationship", "partner_attitude"],
  ["emotion", "最近焦虑到睡不着，我该怎么办", "emotion", "emotion_regulation"]
];
for (const [label, q, domain, intent] of INTENT_CASES) {
  const profile = analyzeQuestion(q, domain);
  const a = resolveReadingContext({ question: q, theme: profile.dominantTheme, profile });
  const b = inferQuestionContext({ question: q, theme: profile.dominantTheme, questionProfile: profile });
  const match = profile.readingIntent === intent && a.intent === b.intent && a.domain === b.domain;
  console.log(match ? "OK" : "FAIL", "intent·" + label);
  if (!match) all = false;
}

if (!all) process.exit(1);
console.log("All synthesis checks passed.");
