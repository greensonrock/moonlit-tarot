import { generateAiSummary } from "../ai-reading.js";
import { tarotDeck } from "../tarot-data.js";
import { getCardKnowledge } from "../tarot-knowledge.js";

const find = (n) => tarotDeck.find((c) => c.name === n);
function mk(spec, positions) {
  return spec.map(([n, o], i) => {
    const b = find(n);
    const k = getCardKnowledge({ ...b, orientation: o });
    return { ...b, position: positions[i], orientation: o, keywords: o === "逆位" ? b.reversed : b.upright, element: k?.element, imagery: k?.imagery };
  });
}
const POS = ["现状", "阻碍", "建议"];

const scenarios = [
  {
    label: "小安·该不该裸辞(含宝剑三)",
    profile: { intent: "职业方向", subject: "工作处境", coreNeed: "想理清要不要裸辞", isCareer: true },
    mood: "calmChaos",
    question: "新主管很强势细节控，我每天焦虑到失眠，到底该不该马上裸辞",
    cards: mk([["宝剑三", "正位"], ["宝剑八", "正位"], ["星币四", "逆位"]], POS)
  },
  {
    label: "二选一·城市(无『还是』)",
    profile: { intent: "未来与选择", subject: "选择", coreNeed: "想做决定", isFuture: true, isDecision: true },
    mood: "turning",
    question: "两个offer，一个深圳一个上海，到底去哪个",
    cards: mk([["权杖二", "逆位"], ["星币七", "正位"], ["战车", "正位"]], POS)
  }
];

for (const s of scenarios) {
  const reading = { theme: "future", themeLabel: s.profile.intent, mood: s.mood, question: s.question, spread: "three", questionProfile: s.profile, cards: s.cards };
  const ai = await generateAiSummary(reading);
  console.log("\n========== " + s.label + " ==========");
  console.log("牌面:", s.cards.map((c) => `${c.position}=${c.name}${c.orientation}`).join(" | "));
  console.log("headline:", ai.headline);
  console.log("浓缩(镜子+结论):", ai.briefSummary);
  console.log("重新框定/觉察:", ai.innerTheme);
  console.log("内心拉扯:", ai.innerTension);
  (ai.positionReadings || []).forEach((p) => console.log("  ·", p.text));
  console.log("温柔尝试:", ai.gentleActions);
  console.log("收尾:", ai.closingLine);
}
