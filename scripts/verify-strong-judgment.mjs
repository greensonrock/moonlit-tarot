#!/usr/bin/env node
/** 强判断 + 心理学深度 + AI 追问烟测 */
import { buildReadingPrompt, normalizeAiResult } from "../ai-reading.js";
import { analyzeQuestion } from "../public/question-profile.js";
import { tarotDeck } from "../tarot-data.js";
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

const reading = {
  question: "接下来offer会是什么情况",
  theme: "career",
  themeLabel: "工作与野心",
  mood: "urgent",
  spread: "three",
  questionProfile: analyzeQuestion("接下来offer会是什么情况", "career"),
  cards: [pick("星币五", "现状", true), pick("权杖骑士", "阻碍"), pick("权杖十", "建议")]
};

const prompt = buildReadingPrompt(reading);
const promptOk =
  /强判断/.test(prompt.system + prompt.user)
  && /配得感|害怕|许可/.test(prompt.system)
  && /reflectionQuestions.*本盘/.test(prompt.system + prompt.user);

const weakAi = {
  directVerdict: "可能还在观察中，也许会有消息。",
  innerTheme: "三张牌连起来看现状阻碍建议。",
  reflectionQuestions: ["如果暂缓一周，你最想先照顾好自己哪一部分？", "你到底在抗拒什么？"],
  positionReadings: reading.cards.map((c) => ({
    position: c.position,
    cardName: c.name,
    text: `${c.position}·${c.name}：就 offer 而言，${c.name}指向${c.keywords[0]}，需要放进你的等待节奏里理解。`
  })),
  briefSummary: "我懂你在等。结论：先等等看。",
  presentState: "悬空感我能感受到。",
  gentleActions: ["列出待确认项", "发礼貌跟进"],
  closingLine: "别在想象里消耗自己",
  headline: "等待观察"
};

const strongAi = {
  ...weakAi,
  directVerdict: "offer仍在评估窗，不是已黄——现状星币五逆：焦虑在松动；阻碍权杖骑士：竞争或冲劲被压住；建议权杖十：划掉一件不必独自扛的事。",
  innerTheme: "你真正怕的不是没结果，而是没消息时被读成「我不够好」。",
  reflectionQuestions: [
    "offer 里哪些条件已书面确认，哪些还只是你的担心？",
    "权杖十提示减负——哪一件事你其实不必一个人扛？"
  ]
};

const weakOut = normalizeAiResult(weakAi, reading);
const strongOut = normalizeAiResult(strongAi, reading);

let ok = promptOk;
if (!/不是|仍在|展开|一锤定音|评估|流程/.test(weakOut.directVerdict)) {
  console.log("FAIL weak verdict not replaced:", weakOut.directVerdict);
  ok = false;
}
if (!/不够|读成|配得|价值|许可|认真|被选择|确定感/.test(weakOut.innerTheme)) {
  console.log("FAIL weak innerTheme not grounded:", weakOut.innerTheme);
  ok = false;
}
if (/暂缓一周|你到底在抗拒/.test(weakOut.reflectionQuestions?.join("") || "")) {
  console.log("FAIL generic reflection kept:", weakOut.reflectionQuestions);
  ok = false;
}
if (!/不是|仍在|展开|一锤定音|评估/.test(strongOut.directVerdict)) {
  console.log("FAIL strong verdict overwritten:", strongOut.directVerdict);
  ok = false;
}
if (!strongOut.reflectionQuestions?.join("").includes("权杖十")) {
  console.log("FAIL strong reflection not preserved:", strongOut.reflectionQuestions);
  ok = false;
}

const crisisPrompt = buildReadingPrompt({
  ...reading,
  question: "最近撑不住了，有时候不想活了怎么办",
  questionProfile: analyzeQuestion("最近撑不住了，有时候不想活了怎么办", "emotion")
});
if (!/危机边界/.test(crisisPrompt.system)) {
  console.log("FAIL crisis block missing");
  ok = false;
}

console.log(ok ? "OK" : "FAIL", "strong-judgment");
console.log("  weak→verdict:", weakOut.directVerdict.slice(0, 50));
console.log("  strong→reflection:", strongOut.reflectionQuestions?.[0]);
console.log("Synthesis:", READING_SYNTHESIS_VERSION);
if (!ok) process.exit(1);
console.log("Strong judgment checks passed.");
