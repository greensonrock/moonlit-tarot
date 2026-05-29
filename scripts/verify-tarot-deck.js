#!/usr/bin/env node
import { getTarotStats, tarotDeck, validateMinorMeanings } from "../tarot-data.js";
import { minorArcanaMeanings } from "../minor-arcana-meanings.js";

const validation = validateMinorMeanings();
const stats = getTarotStats();

const oldTemplatePattern = /^(情绪|思考|现实|行动)(起点|推进|积累)/;
const minors = tarotDeck.filter((c) => c.arcana === "小阿卡那");
const legacyUpright = minors.filter((c) => oldTemplatePattern.test(c.upright[0] || ""));

const sameRankAcrossSuits = [];
for (const rank of ["ace", "two", "eight", "nine", "ten", "page", "king"]) {
  const group = minors.filter((c) => c.slug.endsWith(`-${rank}`));
  const sig = group.map((c) => c.upright.join("|")).join(";;");
  if (new Set(group.map((c) => c.upright.join("|"))).size === 1) {
    sameRankAcrossSuits.push(rank);
  }
}

const samples = ["cups-eight", "swords-nine", "pentacles-ten", "cups-six", "wands-eight"];
const sampleOut = samples.map((slug) => {
  const card = tarotDeck.find((c) => c.slug === slug);
  return {
    slug,
    upright: card?.upright,
    reversed: card?.reversed,
    essence: card?.girlToneMeaning
  };
});

const actionHints = new Set(minors.map((c) => c.actionHint));
const uniqueEssence = new Set(minors.map((c) => c.girlToneMeaning));

console.log(JSON.stringify({
  stats,
  validation,
  legacyTemplateUprightCount: legacyUpright.length,
  ranksWithIdenticalUprightAcrossSuits: sameRankAcrossSuits,
  uniqueActionHints: actionHints.size,
  uniqueEssenceLines: uniqueEssence.size,
  minorMeaningsKeys: Object.keys(minorArcanaMeanings).length,
  samples: sampleOut,
  pass: validation.ok && stats.count === 78 && legacyUpright.length === 0 && sameRankAcrossSuits.length === 0
}, null, 2));

process.exit(validation.ok && legacyUpright.length === 0 && sameRankAcrossSuits.length === 0 ? 0 : 1);
