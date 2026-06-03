/**
 * AI 解读契约层 · Intent × Domain 泛化
 * 统一 Prompt 指引、回退文案、校验锚点——禁止单一职场/offer case 表。
 */
import { inferQuestionContext } from "./reading-knowledge.js";

function cardByPosition(cards, ...positions) {
  return cards.find((c) => positions.includes(c.position));
}

export function readingCtx(reading) {
  return inferQuestionContext(reading);
}

/** 各意图强判断方向（供 Prompt 参考，非固定话术） */
export const INTENT_VERDICT_HINTS = {
  outcome_forecast: "先答「阶段/走向」（仍在流程中、不是已否、窗口未关），再牌证",
  partner_attitude: "先答「温度/有没有余地」（偏有温度、偏淡、未说透），再牌证",
  yes_no_decision: "先答「宜/不宜/宜小步」（可以靠近、宜缓半步、不宜猛攻），再牌证",
  binary_choice: "先答「倾向哪边或先核对什么」，再牌证；不打包票",
  timing: "先答「节点未齐/仍在展开」，再牌证；不写具体日期",
  emotion_regulation: "先答「先稳什么」（身体/睡眠/节奏），再牌证",
  self_clarity: "先答「重建/整合方向」，再牌证"
};

/** 域错配泄漏：某域解读中不应出现的他域套话 */
const DOMAIN_LEAK_PATTERNS = {
  relationship: /offer|评估窗|录用|试用期|投递|团队与节奏|offer 走向/,
  emotion: /offer|录用|试用期|他对我有没有|对方心意/,
  self: /offer|录用|对方态度|他对我有没有/,
  career: /喜不喜欢|复合|表白|前任/
};

export function domainLeakPattern(domain) {
  return DOMAIN_LEAK_PATTERNS[domain] || null;
}

export function hasDomainLeak(text, reading) {
  const ctx = readingCtx(reading);
  const pattern = domainLeakPattern(ctx.domain);
  if (!pattern) return false;
  return pattern.test(String(text || ""));
}

export function intentGuidanceBlock(reading) {
  const ctx = readingCtx(reading);
  const hint = INTENT_VERDICT_HINTS[ctx.intent] || INTENT_VERDICT_HINTS.outcome_forecast;
  return `【解读契约 · ${ctx.intentLabel || ctx.intent} × ${ctx.domain}】
- 强判断：${hint}。
- 心理学：innerTheme 须落到内在课题（配得感/害怕什么/在等什么许可），不复述牌名。
- 追问：reflectionQuestions 须扣本盘牌名/牌位与用户原话，禁止通用模板。
- 边界：${ctx.profile?.caution || "不保证结果、不写具体日期、不替他人读心。"}`;
}

export function questionAnchors(reading) {
  const ctx = readingCtx(reading);
  const q = String(reading.question || ctx.question || "");
  const anchors = [];

  switch (ctx.intent) {
    case "outcome_forecast":
      anchors.push("走向", "阶段", "会不会", "能不能", "情况", "结果", "未来", "接下来");
      if (ctx.domain === "career") anchors.push("工作", "机会", "流程", "评估", "消息", "面试");
      break;
    case "partner_attitude":
      anchors.push("对方", "他", "她", "感觉", "喜欢", "态度", "心意", "互动", "有没有");
      break;
    case "yes_no_decision":
      anchors.push("该不该", "要不要", "是否", "继续", "放弃", "主动", "开口", "离开");
      break;
    case "binary_choice":
      anchors.push("选", "去", "留", "还是", "或者", "哪");
      break;
    case "timing":
      anchors.push("什么时候", "何时", "多久", "哪里", "时间", "地点");
      break;
    case "emotion_regulation":
      anchors.push("焦虑", "情绪", "累", "压力", "睡", "怎么办", "撑");
      break;
    case "self_clarity":
      anchors.push("自己", "成长", "内在", "价值", "喜欢自己", "走出");
      break;
    default:
      break;
  }

  const hits = anchors.filter((w) => w && q.includes(w));
  if (hits.length) return hits;
  return [q.slice(0, 8)].filter((w) => w.length >= 2);
}

export function addressesQuestion(text, reading) {
  const body = String(text || "");
  const ctx = readingCtx(reading);
  const anchors = questionAnchors(reading);
  if (anchors.some((w) => body.includes(w))) return true;

  const intentPatterns = {
    outcome_forecast: /阶段|窗口|流程|展开|评估|走向|趋势|仍在|不是已|未定型|等待|核实/,
    partner_attitude: /温度|互动|靠近|冷淡|辨认|有没有|余地|态度/,
    yes_no_decision: /可以|不宜|宜|暂缓|主动|推进|放下|离开|小步|开口/,
    binary_choice: /核对|条件|标准|试探|偏向|质感|选项/,
    timing: /节点|周期|窗口|何时|何地|节奏/,
    emotion_regulation: /睡|身体|焦虑|感受|稳|照顾|呼吸|节奏/,
    self_clarity: /价值|内在|自我|值得|重建|辨认|整合/
  };
  if (intentPatterns[ctx.intent]?.test(body)) return true;

  const cards = reading.cards || [];
  if (cards.length === 1 && cards[0]?.name && body.includes(cards[0].name)) return true;
  if (cards.length > 1 && cards.filter((c) => body.includes(c.name)).length >= Math.min(2, cards.length)) {
    return true;
  }
  return false;
}

export function reflectionQuestionsFallback(reading) {
  const ctx = readingCtx(reading);
  const cards = reading.cards || [];
  const now = cardByPosition(cards, "现状", "今日指引", "我") || cards[0];
  const block = cardByPosition(cards, "阻碍", "隐藏因素") || cards[1];
  const advice = cardByPosition(cards, "建议", "下一步") || cards.at(-1);
  const n = now?.name || "现状牌";
  const b = block?.name || "阻碍牌";
  const a = advice?.name || "建议牌";

  const byIntent = {
    outcome_forecast: [
      "哪些信息已确认，哪些还只是你的担心？",
      `${a}指向的下一步——你愿意先核对哪一件事实？`
    ],
    partner_attitude: [
      "除了「喜不喜欢」，你更需要被怎样对待？",
      `${n}看互动——如果只看行动，对方做过什么、没做什么？`
    ],
    yes_no_decision: [
      "如果只做一小步试探，你最想确认的是什么？",
      `${b}卡在哪里——你怕的，是结果还是表达方式？`
    ],
    binary_choice: [
      "两个选项各列三项：得到什么、失去什么、需要谁支持？",
      `${a}建议——本周你愿意做一个怎样的最小试探？`
    ],
    timing: [
      "时间线里，哪些节点已发生、哪些还在等待？",
      `${n}看当下——如果暂缓一周，你最想先核实什么？`
    ],
    emotion_regulation: [
      "如果把「必须立刻好起来」放一晚，你今晚最需要什么？",
      `${b}在消耗你——这份感受背后，你最担心失去的是什么？`
    ],
    self_clarity: [
      "如果把「应该成为的样子」放一放，你现在最需要什么？",
      `${a}指向的成长——你对自己最苛刻的一条标准是什么？`
    ]
  };

  return (byIntent[ctx.intent] || byIntent.outcome_forecast).map((s) => s.slice(0, 38));
}

export function presentStateFallback(reading, embrace, verdictLead = "") {
  const ctx = readingCtx(reading);
  const e = embrace.replace(/。$/, "");

  if (verdictLead && verdictLead.length >= 8) {
    return `${e}。${verdictLead}。`;
  }

  const byIntent = {
    outcome_forecast: `${e}。事情仍在展开，先分清已确认事实与纯担心。`,
    partner_attitude: `${e}。心意还在辨认期，用互动验证比脑补更接近答案。`,
    yes_no_decision: `${e}。牌在看表达方式，不在否定你在意。`,
    binary_choice: `${e}。你要在选项之间分辨——卡点往往不在选项本身。`,
    timing: `${e}。节点未齐，先把时间线与事实核对清楚。`,
    emotion_regulation: /失眠|睡不着/.test(ctx.question)
      ? `${e}。身体在拉警报——今晚先求睡，不必把人生想完。`
      : `${e}。感受需要被看见，我们再谈怎么办。`,
    self_clarity: `${e}。你在向内找答案，这本身就是在照顾自己。`
  };

  return byIntent[ctx.intent] || `${e}。牌在帮你看清局面，我们先从一小步开始。`;
}

export function innerTensionFallback(reading) {
  const ctx = readingCtx(reading);
  const byIntent = {
    outcome_forecast: "你想快点有结果，又怕在焦虑里做错判断——这份慎重说明你在认真对待。",
    partner_attitude: "你想靠近确认，又怕主动会打破平衡——在意本身就是在乎。",
    yes_no_decision: "你想推进，又怕方式不对——牌在看表达，不在否定你。",
    binary_choice: "既怕选错了浪费机会，又怕不选就一直耗在原地——这很正常。",
    timing: "你想尽快知道何时何地，又怕催得太紧反而坏事——这很正常。",
    emotion_regulation: "你想快点好起来，又怕一放松就更失控——这很正常。",
    self_clarity: "你想立刻变成更好的自己，又怕承认脆弱——这很正常。"
  };
  return byIntent[ctx.intent] || "你想看清答案，又怕一旦投入就难以回头——这很正常。";
}

export function closingLineFallback(reading, adviceFacet = "") {
  const ctx = readingCtx(reading);
  const byIntent = {
    outcome_forecast: "先核对可验证的事实，再谈时机——别让等待替你做决定。",
    partner_attitude: "用一次真实互动确认，比反复猜更靠近答案。",
    yes_no_decision: "把主动收成一句低压表达，比连环试探更接近答案。",
    binary_choice: "把现实条件摆清楚，答案会比你以为的更早浮现。",
    timing: "把已知节点写下来，比空等更接近答案。",
    emotion_regulation: "先照顾身体，答案会在你节奏对齐时出现。",
    self_clarity: "朝自我证据迈一小步，比一次想通更可靠。"
  };
  if (adviceFacet && !/谣言|中伤|报复|冷酷|专横/.test(adviceFacet)) {
    return `朝「${adviceFacet}」迈出具体一步，方向会随行动清楚起来。`;
  }
  return byIntent[ctx.intent] || "把方向落成一个动作，比反复想更快带你靠近答案。";
}

export function sharpQuestionFallback(reading, cards = []) {
  const ctx = readingCtx(reading);
  const advice = cardByPosition(cards, "建议", "下一步") || cards.at(-1);
  const block = cardByPosition(cards, "阻碍", "隐藏因素") || cards[1];
  const a = advice?.name || "建议牌";
  const b = block?.name || "阻碍牌";

  const byIntent = {
    outcome_forecast: "你更怕的是机会没了，还是怕在焦虑里误判了阶段？",
    partner_attitude: "你更想知道对方怎么想，还是更想确认自己值不值得被认真对待？",
    yes_no_decision: "你是在问选择，还是在等一个不用承担代价的许可？",
    binary_choice: "你卡在选项本身，还是卡在不敢为选择负责？",
    timing: "你急的是时间点，还是急的是「没有消息=否定我」？",
    emotion_regulation: "你想要答案，还是想要有人先承认你受伤了？",
    self_clarity: "你对自己苛刻的，是能力，还是「不够好就不配休息」？"
  };

  const base = byIntent[ctx.intent] || `如果把「${a}」当成镜子，它最先照见的是你哪一部分不安？`;
  if (b && ctx.intent === "outcome_forecast") {
    return `「${b}」卡住的，是外部流程，还是你的担心节奏？`;
  }
  return base;
}

export const GENERIC_REFLECTION_PATTERN = /如果暂缓一周|你最想先照顾好自己哪一部分|你到底在抗拒什么|慢慢来|顺其自然/;

export function isGenericReflection(text) {
  return GENERIC_REFLECTION_PATTERN.test(String(text || ""));
}
