/**
 * 牌阵综合解读 · 编排层
 * 推理逻辑在 reading-knowledge.js（问题×牌位×牌面语义），此处只做编排与导出。
 */
import {
  inferQuestionContext,
  interpretCardInContext,
  cardReadingText,
  inferSpreadLead,
  inferInnerTheme,
  inferStoryLayers,
  inferActions
} from "./reading-knowledge.js";

export const READING_SYNTHESIS_VERSION = "20260604e";

export { inferQuestionContext, interpretCardInContext, cardReadingText };

function cardByPosition(cards, ...positions) {
  return cards.find((c) => positions.includes(c.position));
}

/** @deprecated 使用 interpretCardInContext */
export function cardSpreadLine(card, reading) {
  return interpretCardInContext(card, reading);
}

/** @deprecated 使用 cardReadingText */
export function cardSpreadReading(card, reading) {
  return cardReadingText(card, reading);
}

/** @deprecated 使用 inferQuestionContext */
export function inferReadingLens(reading) {
  const ctx = inferQuestionContext(reading);
  if (ctx.domain === "career" && ctx.intent === "outcome_forecast") return "offer_outcome";
  if (ctx.intent === "partner_attitude") return "partner_feeling";
  if (ctx.intent === "yes_no_decision") return "should_decide";
  if (ctx.intent === "binary_choice") return "binary_choice";
  return ctx.domain;
}

export function buildSpreadVerdict(reading) {
  const cards = reading.cards || [];
  if (!cards.length) return "牌面尚在落定，先感受当下最想确认的一点。";

  const now = cardByPosition(cards, "现状", "今日指引", "我") || cards[0];
  const block = cardByPosition(cards, "阻碍", "隐藏因素");
  const advice = cardByPosition(cards, "建议", "下一步") || cards.at(-1);

  if (cards.length === 1) {
    const lead = inferSpreadLead(reading, now, null, null);
    const text = `${lead}——${now.name}（${now.orientation}）：${interpretCardInContext(now, reading)}。`;
    return text.length <= 120 ? text : `${text.slice(0, 117)}…`;
  }

  const lead = inferSpreadLead(reading, now, block, advice);
  const parts = [];
  if (now) parts.push(`${now.position}·${now.name}：${interpretCardInContext(now, reading)}`);
  if (block && block !== now) parts.push(`${block.position}·${block.name}：${interpretCardInContext(block, reading)}`);
  if (advice && advice !== now && advice !== block) {
    parts.push(`${advice.position}·${advice.name}：${interpretCardInContext(advice, reading)}`);
  }

  const text = `${lead}——${parts.join("；")}。`;
  return text.length <= 120 ? text : `${text.slice(0, 117)}…`;
}

export function buildSpreadInnerTheme(reading) {
  const cards = reading.cards || [];
  const now = cardByPosition(cards, "现状", "今日指引", "我") || cards[0];
  const block = cardByPosition(cards, "阻碍", "隐藏因素") || cards[1];
  const advice = cardByPosition(cards, "建议", "下一步") || cards.at(-1);
  return inferInnerTheme(reading, now, block, advice);
}

export function buildStoryLayers(reading) {
  return inferStoryLayers(reading);
}

export function buildSpreadActions(reading) {
  return inferActions(reading);
}
