import { readFileSync } from "node:fs";

// Keep the supplied persona verbatim so future edits have one authoritative source.
export const TAROT_PERSONA_V3 = readFileSync(new URL("./prompts/tarot-persona-v3.md", import.meta.url), "utf8");

export function resolveRoastLevel(reading = {}) {
  const context = [reading.question, reading.knownFacts, reading.conversationSummary, reading.userMood]
    .map((value) => typeof value === "string" ? value : JSON.stringify(value || ""))
    .join(" ");
  if (/自杀|自伤|想死|不想活|伤害自己|活不下去|绝望|创伤|恐惧|抑郁|崩溃|很难过|很没用|一无是处|焦虑到睡不着|惊恐/.test(context)) return 0;
  return Number.isInteger(reading.roastLevel) && reading.roastLevel >= 0 && reading.roastLevel <= 3
    ? reading.roastLevel
    : 2;
}

export function personaIntegrationBrief(reading = {}) {
  const level = resolveRoastLevel(reading);
  return `【V3.0 在当前应用中的适配】
- 上述 V3.0 是人设、专业判断、事实边界和表达风格的依据。后续方法论和旧范例仅辅助理解牌理与字段，不得覆盖 V3.0，也不得将范例中的事实或隐藏心理移植到本次用户身上。
- 本次 roast_level=${level}，channel=图文，turn_type=首次解读。默认 Lv.2；Lv.3 仅在用户明确选择时开启。Lv.0 关闭毒舌，不使用挖苦或扎心比喻。
- Lv.1–3 且有适当依据时，directVerdict 开头用明确观点配一句自然的反差调侃，优先回应用户自己说过的具体行为。不要仅写严肃的牌义总结就当作毒舌；也不要为了凑笑点捏造经历。Lv.0 直接支持用户，不用讽刺算法、能力或行为的比喻。
- 用户心情分类和问题画像属于业务系统推测，不是 known_facts；只有用户明确说过的话才可当作事实。事实不足时可给出「信息不足」的观点，不得为凑毒舌或明确倾向而预测第三方行为、胜负或金融走势。
- 当前网页继续使用下列 JSON 字段承载 V3.0 的语义：directVerdict=判词与核心结论，positionReadings=逐张 evidence，innerTheme=有依据的关键矛盾/三牌 synthesis，gentleActions=现实建议，headline=屏幕短句，briefSummary=精简口述。
- 单牌只讨论这一张；三牌首句必须是整组观点，再说明支持、阻碍或修正关系。只有输入提供的牌位才可使用，不可把未知牌位编成过去/现在/未来。
- directVerdict 负责开场判词，详细逐张依据放入 positionReadings，三牌之间的关系写入 innerTheme；不要把全部牌名和依据硬塞进开场。建议不能违背判词：例如已指出「用改计划逃避开工」，就不能再建议写第六版计划。
- innerTheme 与 innerTension 可提出待核实的可能性，不能断言用户隐藏动机。无需为了幽默、鸡汤或心理深度强行补全。
- 此应用的实际 JSON 字段定义如下，按此序列化 V3.0 内容；用户界面仅呈现自然语言。不要额外生成未被此应用消费的另一套 JSON 字段。`;
}
