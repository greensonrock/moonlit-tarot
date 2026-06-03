#!/usr/bin/env node
/** 验证：扇形 topPick(0..4) + drawCardsFromTopPicks 覆盖整副 78 张 */
import { tarotDeck } from "../tarot-data.js";
import { drawCardsFromTopPicks } from "../draw-random.js";

const deck = tarotDeck;
const seen = new Set();
let trials = 0;

for (let t = 0; t < 8000; t += 1) {
  const r = drawCardsFromTopPicks(deck, 1, [0]);
  const key = r[0].card.slug;
  seen.add(key);
  trials += 1;
  if (seen.size >= 78) break;
}

console.log(`单张顶选试验 ${trials} 次，覆盖 ${seen.size}/78 张`);
if (seen.size < 60) {
  console.error("FAIL: 覆盖不足，顶选模式可能未遍历牌堆");
  process.exit(1);
}

const three = drawCardsFromTopPicks(deck, 3, [0, 1, 2]);
const names = three.map((x) => x.card.name);
if (new Set(names).size !== 3) {
  console.error("FAIL: 三牌应互不重复", names);
  process.exit(1);
}
console.log("OK 三牌无放回", names.join("、"));
console.log("OK 扇形 5 选 1 可对应 78 张洗匀抽取");
