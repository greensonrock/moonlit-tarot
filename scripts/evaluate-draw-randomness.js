#!/usr/bin/env node
/**
 * Statistical evaluation of tarot draw randomness.
 * Usage: node scripts/evaluate-draw-randomness.js [trials] [linked|independent]
 */
import { drawCardsFromDeck } from "../draw-random.js";
import { tarotDeck } from "../tarot-data.js";

const TRIALS = Number(process.argv[2]) || 100000;
const ORIENT_MODE = process.argv[3] === "independent" ? "independent" : "linked";
const REVERSE_RATE = 0.5;
const CONFIG = { reverseRate: REVERSE_RATE, orientMode: ORIENT_MODE };

function chiSquare(observed, expected) {
  let stat = 0;
  for (let i = 0; i < observed.length; i += 1) {
    const e = expected[i];
    if (e <= 0) continue;
    const diff = observed[i] - e;
    stat += (diff * diff) / e;
  }
  return stat;
}

const CHI2_CRIT = { 1: 3.841, 3: 7.815, 77: 94.866 };

function run() {
  const deckSize = tarotDeck.length;
  const cardCounts = Object.fromEntries(tarotDeck.map((c) => [c.slug, 0]));
  const reverseCounts = { upright: 0, reversed: 0 };
  const spreadReverseCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const duplicateSpreads = { hasDup: 0, noDup: 0 };
  const majorInSpread = [];
  const positionReverse = [[0, 0], [0, 0], [0, 0]];

  for (let t = 0; t < TRIALS; t += 1) {
    const drawn = drawCardsFromDeck(tarotDeck, 3, CONFIG);
    const slugs = drawn.map((d) => d.card.slug);
    const uniq = new Set(slugs);
    if (uniq.size < slugs.length) duplicateSpreads.hasDup += 1;
    else duplicateSpreads.noDup += 1;

    let revInSpread = 0;
    let major = 0;
    drawn.forEach((entry, idx) => {
      cardCounts[entry.card.slug] += 1;
      if (entry.reversed) {
        reverseCounts.reversed += 1;
        positionReverse[idx][1] += 1;
        revInSpread += 1;
      } else {
        reverseCounts.upright += 1;
        positionReverse[idx][0] += 1;
      }
      if (entry.card.arcana === "大阿卡那") major += 1;
    });
    spreadReverseCounts[revInSpread] += 1;
    majorInSpread.push(major);
  }

  const totalCardDraws = TRIALS * 3;
  const expectedPerCard = totalCardDraws / deckSize;
  const observed = tarotDeck.map((c) => cardCounts[c.slug]);
  const expected = tarotDeck.map(() => expectedPerCard);
  const chi2Cards = chiSquare(observed, expected);

  const expectedRev = totalCardDraws * REVERSE_RATE;
  const chi2Orient = chiSquare(
    [reverseCounts.reversed, reverseCounts.upright],
    [expectedRev, totalCardDraws - expectedRev]
  );

  const p = REVERSE_RATE;
  const expectedSpread = [
    TRIALS * (1 - p) ** 3,
    TRIALS * 3 * p * (1 - p) ** 2,
    TRIALS * 3 * p ** 2 * (1 - p),
    TRIALS * p ** 3
  ];
  const chi2Spread = chiSquare(
    [spreadReverseCounts[0], spreadReverseCounts[1], spreadReverseCounts[2], spreadReverseCounts[3]],
    expectedSpread
  );

  const revRate = reverseCounts.reversed / totalCardDraws;
  const counts = observed.slice().sort((a, b) => a - b);
  const meanMajor = majorInSpread.reduce((a, b) => a + b, 0) / majorInSpread.length;

  console.log("=== 塔罗抽卡随机性评估 ===");
  console.log(`模式: ${ORIENT_MODE}, 逆位率: ${REVERSE_RATE}, 试验: ${TRIALS.toLocaleString()} 次三牌阵`);
  console.log(`随机源: crypto.randomInt (draw-random.js)`);
  console.log("");
  console.log("【单牌均匀性】 χ² =", chi2Cards.toFixed(2), chi2Cards < CHI2_CRIT[77] ? "✓ 通过" : "✗ 未通过");
  console.log(`  每张期望 ${expectedPerCard.toFixed(1)} 次, 范围 ${counts[0]} ~ ${counts[counts.length - 1]}`);
  console.log("");
  console.log("【正逆位】 χ² =", chi2Orient.toFixed(2), chi2Orient < CHI2_CRIT[1] ? "✓ 通过" : "✗ 未通过");
  console.log(`  逆位 ${(revRate * 100).toFixed(2)}% (期望 ${p * 100}%)`);
  console.log("");
  console.log("【每阵逆位张数 B(3,p)】 χ² =", chi2Spread.toFixed(2), chi2Spread < CHI2_CRIT[3] ? "✓ 通过" : "✗ 未通过");
  for (let k = 0; k <= 3; k += 1) {
    console.log(
      `  ${k} 张: ${((spreadReverseCounts[k] / TRIALS) * 100).toFixed(1)}% (期望 ${((expectedSpread[k] / TRIALS) * 100).toFixed(1)}%)`
    );
  }
  console.log("");
  console.log("【同阵重复】", duplicateSpreads.hasDup === 0 ? "✓ 0 次" : `✗ ${duplicateSpreads.hasDup} 次`);
  console.log("【大阿卡那均值】", meanMajor.toFixed(3), "(期望", ((22 / 78) * 3).toFixed(3) + ")");
  console.log("");
  console.log(
    ORIENT_MODE === "linked"
      ? "linked: 洗牌前赋正/逆位 → 更接近实体塔罗整叠洗匀后抽牌"
      : "independent: 抽牌后再掷正/逆位 → 旧版逻辑"
  );
}

run();
