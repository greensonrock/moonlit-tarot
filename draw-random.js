import { randomInt } from "node:crypto";

const DEFAULT_REVERSE_RATE = 0.5;
const DEFAULT_ORIENT_MODE = "linked";

/** 读取抽牌配置（支持 .env: REVERSE_RATE, ORIENT_MODE） */
export function getDrawConfig() {
  const rawRate = process.env.REVERSE_RATE;
  let reverseRate = rawRate != null && rawRate !== "" ? Number(rawRate) : DEFAULT_REVERSE_RATE;
  if (!Number.isFinite(reverseRate) || reverseRate < 0 || reverseRate > 1) {
    reverseRate = DEFAULT_REVERSE_RATE;
  }

  const mode = String(process.env.ORIENT_MODE || DEFAULT_ORIENT_MODE).toLowerCase();
  const orientMode = mode === "independent" ? "independent" : "linked";

  return { reverseRate, orientMode };
}

/** [0, 1) 均匀随机 */
export function randomUnit() {
  return randomInt(0, 1_000_000) / 1_000_000;
}

/** 概率 p 为 true（使用 crypto.randomInt） */
export function randomChance(probability) {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  return randomUnit() < probability;
}

/** Fisher-Yates 洗牌（原地） */
export function shuffleInPlace(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * 从牌堆抽取 count 张。
 * - linked（默认）：洗牌前为每张赋正/逆位，更接近实体牌「整叠洗好后抽顶牌」
 * - independent：先抽牌再独立掷正/逆位（旧逻辑）
 */
export function drawCardsFromDeck(deck, count, config = getDrawConfig()) {
  const { reverseRate, orientMode } = config;
  const n = Math.min(count, deck.length);

  if (orientMode === "linked") {
    const entries = deck.map((card) => ({
      card,
      reversed: randomChance(reverseRate)
    }));
    shuffleInPlace(entries);
    return entries.slice(0, n);
  }

  const order = deck.map((_, index) => index);
  shuffleInPlace(order);
  return order.slice(0, n).map((index) => ({
    card: deck[index],
    reversed: randomChance(reverseRate)
  }));
}

/**
 * 按用户在扇形牌阵里点选的位置真正决定抽到的牌（建议2）。
 * - 先用 crypto 洗牌得到一个隐藏排列（用户看不到哪张在哪），再为每张赋正/逆位；
 *   这模拟真实占卜：你凭直觉点选位置，翻开才知道是哪张牌。
 * - selectedSlots 里不同的点选位置 → 不同的牌；保证「点选有意义」。
 * - 当 selectedSlots 缺失或非法时，回退为抽顶部 count 张（与旧行为一致）。
 */
export function drawCardsBySelection(deck, count, selectedSlots, config = getDrawConfig()) {
  const { reverseRate } = config;
  const n = Math.min(count, deck.length);

  const order = deck.map((_, index) => index);
  shuffleInPlace(order);
  const reversedFlags = deck.map(() => randomChance(reverseRate));

  const validSlots = Array.isArray(selectedSlots)
    ? selectedSlots
        .map((s) => Number(s))
        .filter((s) => Number.isInteger(s) && s >= 0)
    : [];

  // 去重后取前 n 个点选位置；不足或非法则用洗牌顶部补齐
  const seen = new Set();
  const chosenSlots = [];
  for (const s of validSlots) {
    if (seen.has(s)) continue;
    seen.add(s);
    chosenSlots.push(s);
    if (chosenSlots.length === n) break;
  }
  for (let i = 0; chosenSlots.length < n && i < order.length; i += 1) {
    if (!seen.has(i)) {
      seen.add(i);
      chosenSlots.push(i);
    }
  }

  return chosenSlots.slice(0, n).map((slot) => {
    const deckIndex = order[slot % order.length];
    return { card: deck[deckIndex], reversed: reversedFlags[deckIndex] };
  });
}

/** 从数组均匀随机取一项 */
export function pickRandom(items) {
  if (!items?.length) return null;
  return items[randomInt(0, items.length)];
}
