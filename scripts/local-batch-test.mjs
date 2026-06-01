import { generateAiSummary } from "../ai-reading.js";
import { tarotDeck } from "../tarot-data.js";
import { getCardKnowledge } from "../tarot-knowledge.js";

const find = (n) => tarotDeck.find((c) => c.name === n);
function mk(spec, positions) {
  return spec.map(([n, o], i) => {
    const b = find(n);
    const k = getCardKnowledge({ ...b, orientation: o });
    return {
      ...b, position: positions[i], orientation: o,
      keywords: o === "逆位" ? b.reversed : b.upright,
      element: k?.element, imagery: k?.imagery
    };
  });
}
const POS = ["现状", "阻碍", "建议"];

const scenarios = [
  {
    label: "关系·对方心意",
    profile: { intent: "感情关系", subject: "对方", coreNeed: "想知道他的心意", isRelationship: true },
    mood: "lost",
    question: "他到底喜不喜欢我，我们最近联系变少了",
    cards: mk([["圣杯骑士", "正位"], ["宝剑三", "逆位"], ["恋人", "正位"]], POS)
  },
  {
    label: "情绪·焦虑",
    profile: { intent: "情绪梳理", subject: "自己", coreNeed: "想平静下来", isEmotion: true },
    mood: "calmChaos",
    question: "最近特别焦虑，晚上睡不着，怎么调整自己",
    cards: mk([["宝剑九", "正位"], ["宝剑四", "逆位"], ["星星", "正位"]], POS)
  },
  {
    label: "二选一·城市",
    profile: { intent: "未来与选择", subject: "选择", coreNeed: "想做决定", isFuture: true, isDecision: true },
    mood: "turning",
    question: "两个offer，一个深圳一个上海，到底去哪个",
    cards: mk([["权杖二", "逆位"], ["星币七", "正位"], ["战车", "正位"]], POS)
  },
  {
    label: "去留·职业",
    profile: { intent: "职业方向", subject: "工作", coreNeed: "想知道要不要继续", isCareer: true },
    mood: "calmChaos",
    question: "这份工作还要继续吗，累但有认可",
    cards: mk([["星币六", "正位"], ["星币四", "正位"], ["星币王后", "正位"]], POS)
  },
  {
    label: "未来·转机",
    profile: { intent: "未来与选择", subject: "未来", coreNeed: "想看到希望", isFuture: true },
    mood: "lost",
    question: "今年下半年会有转机吗，现在卡得很难受",
    cards: mk([["命运之轮", "逆位"], ["宝剑十", "正位"], ["太阳", "正位"]], POS)
  }
];

for (const s of scenarios) {
  const reading = {
    theme: "future", themeLabel: s.profile.intent, mood: s.mood,
    question: s.question, spread: "three", questionProfile: s.profile, cards: s.cards
  };
  const ai = await generateAiSummary(reading);
  const tone = (ai.spreadTone?.labels || []).map((l) => `${l.position}${l.label}`).join("·");
  console.log("\n========== " + s.label + " ==========");
  console.log("牌面:", s.cards.map((c) => `${c.position}=${c.name}${c.orientation}`).join(" | "));
  console.log("基调:", tone);
  console.log("headline:", ai.headline);
  console.log("浓缩:", ai.briefSummary);
  console.log("主题链:", ai.innerTheme);
  (ai.positionReadings || []).forEach((p) => console.log("  ·", p.text));
  console.log("温柔尝试:", ai.gentleActions);
  console.log("收尾:", ai.closingLine);
}
