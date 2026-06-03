import { randomInt } from "node:crypto";

const DEFAULT_REVERSE_RATE = 0.32;
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
 * 【遗留】按槽位下标从洗牌结果取牌（slot 常仅 0–12，无法覆盖整副 78 张）。
 * 前端已改为扇形展示 + drawMode:"top" + drawCardsFromTopPicks。
 * 仅当 top 模式不可用且传入大槽位时作回退。
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

/**
 * 沉浸抽牌：整副洗好后，每次从牌堆顶最多 3 张里选一张进阵。
 * topPicks[i] ∈ {0,1,2} 表示第 i 次抽取时，取当时顶部的第几张（0 = 最靠近牌堆顶）。
 */
export function drawCardsFromTopPicks(deck, count, topPicks, config = getDrawConfig()) {
  const { reverseRate } = config;
  const n = Math.min(count, deck.length);
  const order = deck.map((_, index) => index);
  shuffleInPlace(order);
  const reversedFlags = deck.map(() => randomChance(reverseRate));
  const remaining = [...order];
  const results = [];

  for (let i = 0; i < n; i += 1) {
    if (!remaining.length) break;
    let choice = Number(topPicks?.[i]);
    if (!Number.isInteger(choice) || choice < 0) choice = 0;
    const maxTop = Math.min(3, remaining.length);
    const pickIndex = Math.min(choice, maxTop - 1);
    const deckIndex = remaining.splice(pickIndex, 1)[0];
    results.push({ card: deck[deckIndex], reversed: reversedFlags[deckIndex] });
  }

  while (results.length < n && remaining.length) {
    const deckIndex = remaining.shift();
    results.push({ card: deck[deckIndex], reversed: reversedFlags[deckIndex] });
  }

  return results;
}

/** 是否为「牌堆顶三选一」提交格式 */
export function isTopPickDraw(selectedSlots, count) {
  if (!Array.isArray(selectedSlots) || selectedSlots.length < count) return false;
  return selectedSlots.slice(0, count).every((s) => {
    const n = Number(s);
    return Number.isInteger(n) && n >= 0 && n <= 2;
  });
}

/** 从数组均匀随机取一项 */
export function pickRandom(items) {
  if (!items?.length) return null;
  return items[randomInt(0, items.length)];
}
