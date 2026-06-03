import {
  contextualValence,
  valenceLabel,
  describeCardWhy,
  getCardKnowledge
} from "./tarot-knowledge.js";
import { buildFewShotBrief } from "./reading-fewshots.js";
import {
  intentGuidanceBlock,
  addressesQuestion,
  hasDomainLeak,
  presentStateFallback,
  innerTensionFallback,
  closingLineFallback,
  reflectionQuestionsFallback,
  isGenericReflection
} from "./reading-contract.js";
import { buildModelStrategyBrief } from "./reading-strategy.js";
import {
  buildSpreadVerdict,
  buildSpreadInnerTheme,
  buildStoryLayers,
  buildSpreadActions,
  cardReadingText,
  inferQuestionContext
} from "./reading-synthesis.js";

const DEFAULT_BASE = "https://www.dmxapi.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

const moodLabels = {
  lost: "有点迷茫",
  urgent: "很想知道答案",
  calmChaos: "表面平静但心里很乱",
  turning: "期待一个转机",
  release: "想放下某件事"
};

const moodEmbraceLines = {
  lost: "我明白你想听见一个确定的声音，这种悬空感并不容易。",
  urgent: "我懂你想快点知道结果，这份急切背后是你很认真地对待自己的路。",
  calmChaos: "你表面维持着平静，心里却翻涌了很久——这很累，也值得被好好看见。",
  turning: "我感受到你在等一个转机，也在问自己是否还值得继续投入。",
  release: "想放下并不等于不在乎，你只是累了，想给自己一点空间。"
};

const moodResponseKeywords = {
  lost: ["确定", "悬空", "迷茫", "听见"],
  urgent: ["急切", "着急", "尽快", "认真"],
  calmChaos: ["平静", "翻涌", "心里", "看见"],
  turning: ["转机", "投入", "期待"],
  release: ["放下", "空间", "在乎", "累了"]
};

const SELF_CARE_ACTION = /休息|睡|写下|呼吸|散步|找人聊|对自己好|放慢|不必|照顾好|泡杯|安静|抱抱自己/;

function parseAiJson(content) {
  let raw = String(content || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) raw = fenced[1].trim();
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) raw = objectMatch[0];
  raw = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  const attempts = [
    raw,
    raw.replace(/,\s*([}\]])/g, "$1"),
    raw.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'")
  ];

  let lastError;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Invalid AI JSON");
}

function cardByPosition(cards, ...positions) {
  return cards.find((card) => positions.includes(card.position));
}

/**
 * 情绪极性：委托给知识库的「牌位 × 问题 × 牌义（数字/元素/正逆）」推理（建议3）。
 * 不再用牌名 includes 硬编码。profile 可选，缺省时仅按牌位+数字+正逆推断。
 */
function cardValence(card, profile = {}) {
  return contextualValence(card, profile);
}

function cardValenceLabel(card, profile = {}) {
  return valenceLabel(contextualValence(card, profile));
}

function activeCardMeaning(card, profile = {}) {
  const keys = (card.keywords || []).slice(0, 3);
  const kw = keys.join("、") || "—";
  const orient = card.orientation === "逆位" ? "逆位" : "正位";
  let line = `${orient}关键词：${kw}；基调：${cardValenceLabel(card, profile)}`;
  const why = describeCardWhy(card, profile);
  if (why) line += `；牌理依据：${why}`;
  if (card.actionHint) {
    line += `；课题：${String(card.actionHint).replace(/[。.!！]$/, "")}`;
  }
  return line;
}

function spreadHonestyHint(reading) {
  const cards = reading.cards || [];
  if (!cards.length) return "";
  const profile = reading.questionProfile || {};
  const chain = cards.map((c) => `${c.position}·${c.name}(${cardValenceLabel(c, profile)})`).join(" → ");
  const challengeCount = cards.filter((c) => cardValence(c, profile) === "challenge").length;
  return `【牌阵基调 · 必守】${chain}。挑战牌 ${challengeCount} 张。
- 挑战牌：必须点出具体卡点（用关键词），禁止只说「耐心/在路上/别慌/会好的」。
- 支持牌：写实写出助力，禁止空夸。
- 中性牌：写观察与待核实项。
- 每张 positionReadings：结构「如实一句 + 温柔一句」；禁止只报喜，也禁止定命恐吓。`;
}

function soundsOverlyPositive(text) {
  const body = String(text || "");
  return (
    /在路上|别慌|会好|耐心等|好事多|给你出口|仍在给你|别急着否定|慢慢会|熬过/.test(body)
    && !/卡|阻|拖|耗|冲突|延迟|冷淡|失衡|损失|结束|崩|束缚|犹豫|代价|风险|阻滞|观望|不确定|消耗|拉扯|内耗|反复|失衡|债务|算计|封闭|悲伤|恐惧|失败|轻率|操控|拖延|抗拒|诱惑|混乱|不公|内耗|退让|缓和/.test(
      body
    )
  );
}

function orientTone(card) {
  if (!card) return "";
  const k0 = card.keywords?.[0] || "信号";
  const valence = cardValence(card);
  if (valence === "challenge") {
    return card.orientation === "逆位"
      ? `偏${k0}，且表达/推进都不稳定`
      : `${k0}较明显，局面不算轻松`;
  }
  if (valence === "support") {
    return card.orientation === "逆位"
      ? `有${k0}，但还没完全落地`
      : `有${k0}、${card.keywords[1] || k0}的倾向`;
  }
  return card.orientation === "逆位"
    ? `在${k0}上仍有拉扯，还没说透`
    : `围绕${k0}在展开，仍需观察`;
}

const EVASIVE_VERDICT = /别急着下结论|不必今天想通|把问题推回|顺其自然|答案会自己浮现|不用靠猜|别拼命追问|先稳住节奏|成绩就在那|不急着判断|再等等就好|先别慌/;

const VERDICT_LEAN_MARKERS = /偏|倾向|更像|适合|宜|不宜|可以|暂缓|值得|先看|先缓|支持|谨慎|可先|别急着|小步|验证|靠近|开口|主动|推进|放下|离开|等待|评估|有温度|未说透|不是|仍在|尚未|明确|不建议|别用|窗口|一锤定音|没黄|没戏|偏淡|偏有|宜先|不宜猛|要先|还在|更像|更偏/;

const PSYCH_THEME_MARKERS = /价值|配得|害怕|许可|不够|认真|被选择|被对待|脑补|否定|配不配|底层|真正在问|其实是|不是.*而是|配得到|值得被|在等什么|读成|误读|自我|内在|课题|镜子|监控|猜代替|确定感|核实|空等|silence|没消息|不够好/;

function isCrisisQuestion(question = "") {
  return /不想活|想死|自杀|自伤|伤害自己|活不下去|撑不住|受不了|绝望/.test(String(question || ""));
}

function crisisPromptBlock(reading) {
  if (!isCrisisQuestion(reading.question)) return "";
  return `【危机边界 · 最高优先级】
用户可能处于高强度痛苦或自伤风险。请：
- directVerdict：先验证感受真实且很重，不做命运预测、不写具体结果；
- gentleActions：第一条优先建议联系身边可信的人或当地紧急求助，第二条才是微小自我照顾；
- 禁止「会好的」「命中注定」「答案会浮现」等轻飘收束。`;
}

function hasPsychologicalDepth(text) {
  return PSYCH_THEME_MARKERS.test(String(text || ""));
}

function stripVerdictPrefix(text) {
  return String(text || "")
    .replace(/^就你问的[「『][^」』]+[」』]：\s*/, "")
    .replace(/^就你问的[^：]+：\s*/, "")
    .trim();
}

/** 按问题语境选更贴牌的 facet，避免机械取 keywords[0] */
function contextualFacetWord(card, reading) {
  if (!card) return "";
  const k = getCardKnowledge(card);
  const rev = card.orientation === "逆位";
  const sig = questionSignals(reading);
  const q = reading.question || "";
  const pool = rev
    ? (Array.isArray(card.reversed) ? card.reversed : String(k?.shadow || "").split("、"))
    : (Array.isArray(card.upright) ? card.upright : String(k?.light || "").split("、"));
  const words = pool.filter(Boolean);

  if (card.name.includes("宝剑侍从") && rev) {
    if (sig.asksShouldIDo || /主动/.test(q) || reading.questionProfile?.isRelationship) {
      return words.find((w) => /信息|言语|分析|观察|沟通|消息|轻率|多疑/.test(w)) || "信息还没理清";
    }
  }
  if (card.suitKey === "swords" || card.name.includes("宝剑")) {
    if (sig.asksShouldIDo && /主动/.test(q)) {
      return words.find((w) => /沟通|表达|观察|分析|信息|言语/.test(w)) || words[0] || "表达";
    }
  }
  const harsh = /谣言|中伤|报复|冷酷|毁灭|死亡|恶魔|鲁莽伤人/;
  if (harsh.test(words[0] || "")) {
    return rev ? "表达方式还欠稳" : "试探性靠近";
  }
  return words[0] || card.keywords?.[0] || "";
}

/** 综合用户提问 + 抽牌结果，输出强判断（委托牌阵综合引擎） */
function buildSynthesizedVerdict(reading) {
  return stripVerdictPrefix(buildSpreadVerdict(reading));
}

function isStrongVerdict(text, reading) {
  const body = stripVerdictPrefix(colloquializeCopy(text));
  if (!body || body.length < 14) return false;
  if (isWeakLine(body) || EVASIVE_VERDICT.test(body)) return false;
  if (!VERDICT_LEAN_MARKERS.test(body)) return false;
  if (!addressesUserQuestion(body, reading)) return false;
  const cards = reading.cards || [];
  if (cards.length === 1 && cards[0]?.name && !body.includes(cards[0].name)) return false;
  if (cards.length > 1 && cards.filter((c) => body.includes(c.name)).length < Math.min(2, cards.length)) {
    return false;
  }
  if (/还在辨认阶段|待观察|这股能量|悬崖边|提灯独行|天平两端需要流动/.test(body)) return false;
  return true;
}

function buildFallbackDirectVerdict(reading) {
  return buildSynthesizedVerdict(reading);
}

export function answerUserQuestion(reading) {
  const p = reading.questionProfile || {};
  const cards = reading.cards || [];
  const advice = cardByPosition(cards, "建议", "下一步");
  const now = cardByPosition(cards, "现状", "今日指引", "我") || cards[0];
  const directVerdict = buildFallbackDirectVerdict(reading);

  return {
    headline: pickHeadline(cards, p),
    directAnswer: directVerdict,
    directVerdict,
    insight: (p.caution || "把牌当作镜子，先看清再行动。").slice(0, 55),
    cardLines: cards.map((c) => `${c.position}｜${c.name}｜${cardReadingText(c, { ...reading, questionProfile: p }).slice(0, 24)}`),
    action: (advice?.actionHint || now?.actionHint || "落成本周一个可核对的小步。").slice(0, 36),
    star: makeStarLine(p, cards.at(-1)).slice(0, 30)
  };
}

function trimQuestion(q) {
  return String(q).replace(/[？?]\s*$/, "").slice(0, 48);
}

function detectChoiceOptions(question) {
  const text = String(question || "").replace(/[？?]\s*$/, "");
  // 形式一：A 还是/或 B
  if (/(还是|或在|或是|或者)/.test(text)) {
    const parts = text.split(/还是|或在|或是|或者/);
    if (parts.length >= 2) {
      const b = parts[parts.length - 1].trim().slice(0, 12);
      const left = parts[parts.length - 2];
      const aMatch = left.match(/([\u4e00-\u9fa5A-Za-z·]{2,12})$/);
      const a = (aMatch?.[1] || left).trim().slice(-12);
      if (a && b) return { a, b };
    }
  }
  // 形式二：一个A，一个B（如「一个深圳一个上海」）
  const pair = text.match(/一个\s*([\u4e00-\u9fa5A-Za-z·]{1,10}?)[，,、\s]*(?:一个|另一个)\s*([\u4e00-\u9fa5A-Za-z·]{1,10}?)(?=[，,。\s的]|$)/);
  if (pair && pair[1] && pair[2]) return { a: pair[1].trim(), b: pair[2].trim() };
  // 形式三：A 和/跟 B …（选/去/留/挑/选择）哪
  const andPick = text.match(/([\u4e00-\u9fa5A-Za-z·]{2,10})[和跟与]([\u4e00-\u9fa5A-Za-z·]{2,10}).{0,8}(?:选|去|留|挑|选择|决定).{0,3}(?:哪|那)/);
  if (andPick && andPick[1] && andPick[2]) return { a: andPick[1].trim(), b: andPick[2].trim() };
  return null;
}

function choiceHint(question) {
  const choice = detectChoiceOptions(question);
  if (!choice) return "";
  return `【二选一 · 必写】用户要在「${choice.a}」与「${choice.b}」之间分辨。
- directVerdict 必须给出牌理倾向：先写明确倾向（略偏向A/先核对再定/不宜拖着比），再点名三张牌位+牌名作依据；禁止空泛「再等等」。
- presentState 或 innerTension 中，分别用牌意说明两选项各自呼应什么（各半句），再点卡点往往不在选项本身。
- 禁止打包票「一定选 A/选 B」或具体日期；允许「质感上更靠近…，但仍需核实」。`;
}

function linkCardToQuestion(card, profile, asksOther, asksDecision) {
  if (asksOther && ["现状", "对方或外界", "今日指引"].includes(card.position)) {
    return `看对方：${card.keywords[0]}`.slice(0, 12);
  }
  if (asksDecision && ["建议", "下一步", "阻碍"].includes(card.position)) {
    return card.position === "阻碍" ? `卡点：${card.keywords[0]}` : `建议：${card.keywords[0]}`;
  }
  return `${card.keywords[0]}`.slice(0, 12);
}

function questionSignals(reading) {
  const p = reading.questionProfile || {};
  const q = String(reading.question || p.text || "");
  return {
    asksOffer: asksOfferQuestion(reading),
    asksInterview: Boolean(p.asksInterview),
    asksWhenWhere: /什么时候|何时|多久|几月|几周|时间|哪里|什么地方|在哪|哪座|城市/.test(q),
    asksOtherFeeling: p.isRelationship && /他|她|对方|ta/i.test(q) && /感觉|喜欢|爱|态度|怎么想|在意/.test(q),
    asksShouldIDo: p.isDecision || /该不该|要不要|是否|继续|放弃|离开|主动/.test(q),
    asksFuture: p.isFuture || reading.theme === "future" || /未来|会不会|能不能|结果|发展/.test(q),
    asksEmotion: p.isEmotion || /累|焦虑|难过|情绪|疲惫|压力/.test(q),
    choice: detectChoiceOptions(q)
  };
}

/**
 * 是否职业/offer 语境（建议5）：优先信任已升级的意图判定 profile.isCareer，
 * 仅当缺少 profile 时才回退到关键词，避免未来主题误触 offer 套话。
 */
function isCareerQuestion(reading) {
  const p = reading.questionProfile || {};
  if (typeof p.isCareer === "boolean") {
    // 主题为未来/关系/情绪/自我时，profile.isCareer 已由加权判定排除误触
    return p.isCareer;
  }
  const q = String(reading.question || p.text || "");
  return /offer|录用|入职|跳槽|离职|面试|等消息|等结果|等回复|没消息|通知|HR|笔试|岗位|找工作|求职|工作|职业|事业/i.test(q);
}

function asksOfferQuestion(reading) {
  const p = reading.questionProfile || {};
  if (p.asksOffer) return true;
  const q = String(reading.question || p.text || "");
  return /offer|录用|入职|offer情况|等消息|等结果/i.test(q)
    || (isCareerQuestion(reading) && /新.{0,8}(情况|机会)|会怎么样|如何/i.test(q));
}

function pentaclesCardCount(cards) {
  return (cards || []).filter((c) => c.suitKey === "pentacles" || c.name.includes("星币")).length;
}

/** 将单张牌译成扣题的短句（本地回退与 AI 质检共用） */
function interpretCardLine(card, reading) {
  const p = reading.questionProfile || {};
  const sig = questionSignals(reading);
  const k = card.keywords || [];
  const rev = card.orientation === "逆位";
  const name = card.name;
  const q = reading.question || "";

  // —— 仅保留「真正依赖语境」的覆盖；其余统一走知识库推理 ——

  // 关系问对方心意：牌义要落到「倾向 + 需互动验证」，不替对方定论
  if (sig.asksOtherFeeling && ["现状", "对方或外界"].includes(card.position)) {
    return cardValence(card, p) === "support"
      ? `就ta的心意，${name}${rev ? "逆" : "正"}位透出${k[0] || "一点温度"}，但还需要真实互动来验证。`
      : `就ta的心意，${name}${rev ? "逆" : "正"}位看${k[0] || "偏淡或未定型"}，别只靠猜测补全画面。`;
  }

  // 二选一/城市题：把牌意落到「核对哪边」
  if (sig.choice && (q.includes("深圳") || q.includes("上海"))) {
    if (card.position === "阻碍" && card.suitKey === "pentacles") {
      return rev
        ? `两城比较时，现实门槛（生活成本、稳定感）被放大，${name}逆位是卡点`
        : `${name}在提醒你核对哪边更能给你长期稳定`;
    }
    if (card.position === "建议" && card.suitKey === "cups") {
      return `先问哪座城市更让你安心，${name}比急着定时间更重要`;
    }
  }

  // 默认：系统化牌理推理（reading-knowledge）
  return cardReadingText(card, reading);
}

function questionFocusHint(reading) {
  const p = reading.questionProfile || {};
  const sig = questionSignals(reading);
  const positions = (reading.cards || []).map((c) => c.position).join("、");
  const lines = [
    intentGuidanceBlock(reading),
    buildModelStrategyBrief(reading),
    moodResponseHint(reading),
    `【问题类型】${p.intent || "自我确认"}；用户真正关心：${p.subject || "自己"}；此刻最需要：${p.coreNeed || "被看见"}。`
  ];

  if (sig.choice) {
    lines.push(choiceHint(reading.question));
  }

  if (positions) {
    lines.push(`【牌位顺序】${positions}。reminders 共 ${Math.min(reading.cards.length, 3)} 条，严格按此顺序，每条对应一张牌，句式不可雷同。`);
  }

  lines.push(`【强判断 · 必守】
directVerdict 第一句必须是明确立场（倾向/阶段/宜否/温度），禁止「可能」「也许」「还在观察中」作首句主调；第二句起依次用现状/阻碍/建议三牌作证据，每张至少点一次牌名或牌位。
innerTheme 必须落到内在课题（配得感/害怕什么/在等什么许可），禁止只复述牌面关键词。
reflectionQuestions 两条须扣本盘牌面与用户原话，禁止通用模板；第一条会作为「牌师追问」展示。`);
  lines.push(`【读者视角 · 必守】你是直接对用户说话的牌师，全文第二人称「你」。先回应用户原问题的字面意思，再用牌佐证；禁止「用户」「牌显示」「塔罗告诉你」等旁观或算命腔。positionReadings 每条开头先扣用户问题半句再解牌。`);
  lines.push(`【模块绑牌 · 必守 · 去重复 · 如实】
各模块分工不同，禁止把同一段话换个标题重复粘贴：
- briefSummary：全篇唯一浓缩（45-80字）。结构：半句接住 + 半句直接结论（可含挑战/中性，禁止空泛「会好的/在路上」）+ 可选半句温柔收尾。
- presentState：感受 + 一句结论（≤55字），不写牌名；结论须与牌阵基调一致（有挑战牌时不得只报喜）。
- innerTheme：三牌因果链一句（≤56字），把现状→阻碍→建议串成同一主线、并让建议回扣现状那股劲，可含阻力词，不重复 briefSummary。
- reminders：2-3 条便签（每条≤18字），用关键词；挑战牌可写「阻滞/消耗/延迟」类词。
- positionReadings：唯一详细解牌处（50-68字）；结合意象与用户问题，像牌师口述；挑战牌写清卡点，支持牌写清助力。
- descriptionLayer / situationLayer / meaningLayer：四层故事各写一层，禁止与 directVerdict 同句复读。
- innerTension：心理拉扯（≤48字），可承认担心合理，不复述牌面。
- closingLine：短收束（≤32字）；可温暖，但不得否定前文已点出的挑战。
- 口语化：像深夜语音，少用「暗示/迹象/投入度/疏离」等报告腔。`);
  lines.push(spreadHonestyHint(reading));
  lines.push(spreadSynthesisHint(reading));
  lines.push(buildFewShotBrief());
  return lines.join("\n");
}

function pickSpreadHeadline(reading) {
  const block = cardByPosition(reading.cards, "阻碍", "隐藏因素");
  const now = cardByPosition(reading.cards, "现状", "今日指引", "我") || reading.cards?.[0];
  const advice = cardByPosition(reading.cards, "建议", "下一步");
  const sig = questionSignals(reading);

  if (block && block.name.includes("恶魔")) {
    return block.orientation === "逆位" ? "执念在松动" : "先看见执念";
  }

  if (block && cardValence(block) === "challenge") {
    const bk = block.keywords?.[0] || "";
    if (/过度付出|自我忽略|消耗|束缚|内耗|冲突|延迟|阻滞|恐惧|失衡/.test(bk)) {
      return bk.length <= 12 ? `先处理${bk}` : "先看清主要卡点";
    }
    if (bk && bk.length <= 12) return bk;
    return "先正视阻力";
  }

  if (sig.choice) return "二选一，先看清卡点";
  if (sig.asksOffer) return "offer还在评估期";

  const candidates = [
    advice ? contextualFacetWord(advice, reading) : "",
    now ? contextualFacetWord(now, reading) : "",
    block ? contextualFacetWord(block, reading) : ""
  ].filter(Boolean);

  for (const item of candidates) {
    if (item.length >= 4 && item.length <= 12) return item;
  }

  for (const item of candidates) {
    if (!item) continue;
    const short = clampAtSentence(item, 12).replace(/…$/g, "");
    if (short.length >= 4) return short;
  }

  return "星月陪你慢慢看清";
}

function stripCardNamePrefix(bridge, card) {
  const text = String(bridge || "");
  const escaped = card.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`^${escaped}(（${card.orientation}）|${card.orientation}|正位|逆位)?[：:]\\s*`, "g"), "")
    .trim();
}

const STALE_POSITION_PATTERNS =
  /别用焦虑代替事实|处在.+阶段|卡点常在摆脱束缚|认清现实宜慢，别在焦虑里催结果|浪漫追求阶段|处在浪漫追求|offer 侧|是当前主要阻力|宜慢，别在焦虑|被拉长，offer|仍在评估\/等待窗|是当前主要阻力|指向.+，是你此刻站的位置$/;

function normalizePositionBody(raw, card, reading) {
  let body = stripCardNamePrefix(sanitizeCopy(raw), card);
  let prev = "";
  while (body !== prev) {
    prev = body;
    body = stripCardNamePrefix(body, card);
  }
  const posPrefix = new RegExp(`^${card.position}[·•][^：:]{0,24}[：:]\\s*`);
  body = stripCardNamePrefix(body.replace(posPrefix, "").trim(), card);

  const stale =
    STALE_POSITION_PATTERNS.test(String(raw || ""))
    || STALE_POSITION_PATTERNS.test(body)
    || aiSummaryWrongFraming(body, reading);
  if (
    stale
    || isWeakLine(body)
    || !body
    || orientationMismatch(body, card)
    || (cardValence(card) === "challenge" && soundsOverlyPositive(body))
    || new RegExp(`^${card.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(body)
  ) {
    body = stripCardNamePrefix(interpretCardLine(card, reading), card);
  }
  return body;
}

const POSITION_READING_MAX = 92;

function buildPositionReading(card, reading) {
  const bridge = stripCardNamePrefix(interpretCardLine(card, reading), card);
  return clampSentenceClean(`${card.position}·${cardLabel(card)}：${bridge}`, POSITION_READING_MAX);
}

function presentStateFromVerdict(reading) {
  const verdict = stripVerdictPrefix(buildSpreadVerdict(reading));
  const lead = verdict.split("——")[0]?.trim();
  if (!lead || lead.length < 8) return "";
  return lead.length <= 36 ? lead : `${lead.slice(0, 33)}…`;
}

function groundPresentState(reading) {
  const embrace = (moodEmbraceLines[reading.mood] || "我懂你在意。").replace(/。$/, "");
  const verdictLead = presentStateFromVerdict(reading);
  return presentStateFallback(reading, embrace, verdictLead);
}

function groundInnerTension(reading) {
  return innerTensionFallback(reading);
}

function groundClosingLine(reading) {
  const advice = cardByPosition(reading.cards, "建议", "下一步", "今日指引") || reading.cards?.[0];
  const lead = advice ? cardFacetWord(advice, reading) : "";
  return closingLineFallback(reading, lead);
}

/** 取一张牌「此刻最贴切的那个面」：按问题语境选 facet，避免机械取 keywords[0] */
function cardFacetWord(card, reading) {
  if (!card) return "";
  if (reading) return contextualFacetWord(card, reading);
  const rev = card.orientation === "逆位";
  const words = rev ? card.reversed || [] : card.upright || [];
  return words[0] || card.keywords?.[0] || "";
}

function groundInnerTheme(reading) {
  return clampSentenceClean(buildSpreadInnerTheme(reading), 72);
}

function groundHeadline(reading) {
  return pickSpreadHeadline(reading);
}

const BANNED_PHRASES = [
  "塔罗告诉你",
  "牌显示你会",
  "命中注定",
  "一定会",
  "肯定不会"
];

function pickHeadline(cards, profile) {
  const main = cards[0];
  if (profile.isRelationship) return main?.keywords?.[0] || "关系信号";
  if (profile.isDecision) return "先看清再选";
  return main?.keywords?.[0] || "星月指引";
}

function makeStarLine(profile, card) {
  if (profile.isRelationship) return "先确认真实互动，再确认自己的心安。";
  if (profile.isDecision) return "答案会在你更清醒时出现。";
  if (card?.actionHint) return card.actionHint.slice(0, 30);
  return "愿你温柔且清醒地前行。";
}

function clampText(value, max) {
  return String(value || "").trim().slice(0, max);
}

/** 在句号/逗号处截断，避免关键词与浓缩句半截 */
function clampAtSentence(text, max) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw;
  const slice = raw.slice(0, max);
  const lastPunc = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("！"),
    slice.lastIndexOf("？"),
    slice.lastIndexOf("；"),
    slice.lastIndexOf("，"),
    slice.lastIndexOf(",")
  );
  if (lastPunc >= Math.floor(max * 0.45)) {
    const cut = slice.slice(0, lastPunc + 1);
    if (cut.endsWith("，") || cut.endsWith(",")) {
      return `${cut.slice(0, -1)}…`;
    }
    return cut;
  }
  const openQuotes = (slice.match(/[「『]/g) || []).length;
  const closeQuotes = (slice.match(/[」』]/g) || []).length;
  if (openQuotes > closeQuotes) {
    const lastOpen = Math.max(slice.lastIndexOf("「"), slice.lastIndexOf("『"));
    if (lastOpen > 0) return `${slice.slice(0, lastOpen)}…`;
  }
  return `${slice.trim()}…`;
}

/**
 * 逐张解读专用截断：优先在完整句号（。！？）处收尾，宁可短一句，
 * 也不要留「…」半截。只有当全文没有任何句末标点时才退回 clampAtSentence。
 */
function clampSentenceClean(text, max) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw.replace(/[，,、；;]\s*$/, "");
  const slice = raw.slice(0, max);
  const lastEnd = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("！"),
    slice.lastIndexOf("？")
  );
  if (lastEnd >= Math.floor(max * 0.4)) {
    return slice.slice(0, lastEnd + 1);
  }
  // 没有合适的整句边界，退回逗号截断（仍会带…，但这是少数情况）
  return clampAtSentence(raw, max);
}

function isTruncatedHeadline(headline, reading) {
  const h = String(headline || "");
  if (/关系能$|改变关系能$|也会改变关系/.test(h)) return true;
  for (const card of reading.cards || []) {
    const hint = String(card.actionHint || "");
    if (hint.length > h.length && hint.startsWith(h)) return true;
  }
  return false;
}

function normalizeHeadline(text, reading, fallback) {
  let headline = String(text || "").trim().replace(/[。.!！?？…]+$/g, "");
  const openQuotes = (headline.match(/[「『]/g) || []).length;
  const closeQuotes = (headline.match(/[」』]/g) || []).length;
  const broken =
    !headline
    || headline.length > 12
    || openQuotes !== closeQuotes
    || isColdHeadline(headline)
    || isTruncatedHeadline(headline, reading);
  if (broken) {
    return groundHeadline(reading) || fallback.headline;
  }
  return headline;
}

function dedupePresentState(presentState, briefSummary, directVerdict = "") {
  if (!presentState) return "";
  let out = presentState;
  if (briefSummary && isSimilarCopy(out, briefSummary)) {
    const parts = String(out)
      .split(/[。！？]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const briefParts = String(briefSummary)
      .split(/[。！？]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const unique = parts.filter((part) => !briefParts.some((base) => isSimilarCopy(part, base)));
    out = unique.length
      ? unique.map((part) => (part.endsWith("。") ? part : `${part}。`)).join("")
      : "";
  }
  if (directVerdict && out && isSimilarCopy(out, directVerdict)) {
    const parts = String(out).split(/[。！？]/).map((p) => p.trim()).filter(Boolean);
    const verdictParts = String(directVerdict).split(/[。！？]/).map((p) => p.trim()).filter(Boolean);
    const unique = parts.filter((part) => !verdictParts.some((base) => isSimilarCopy(part, base)));
    out = unique.map((part) => (part.endsWith("。") ? part : `${part}。`)).join("");
  }
  return out;
}

function dedupeBriefSummary(briefSummary, directVerdict, reading) {
  let out = String(briefSummary || "").trim();
  if (!out || !directVerdict) return out;
  const dvLead =
    directVerdict.split("——")[0]?.trim()
    || directVerdict.split(/[。！？]/)[0]?.trim()
    || directVerdict.slice(0, 40);
  const dup =
    isSimilarCopy(out, directVerdict)
    || out.startsWith(dvLead.slice(0, Math.min(20, dvLead.length)))
    || (dvLead.length >= 12 && out.includes(dvLead.slice(0, 12)));
  if (dup) {
    const embrace = (moodEmbraceLines[reading.mood] || "我懂你在意。").replace(/。$/, "");
    out = clampAtSentence(`${embrace}。${dvLead}`, 80);
  }
  return out;
}

function cardLabel(card) {
  return `${card.name}（${card.orientation}）`;
}

function formatCardForPrompt(card, profile = {}) {
  const orient = card.orientation === "逆位" ? "逆位" : "正位";
  const k = getCardKnowledge(card);
  const lines = [
    `【${card.position}】${card.name}（${orient}）`,
    activeCardMeaning(card, profile)
  ];
  if (k?.element && k?.elementProfile) {
    lines.push(`元素：${k.element}（主${k.elementProfile.domain}）`);
  }
  if (k?.imagery) {
    lines.push(`牌面意象：${k.imagery}`);
  }
  const lens = positionLensHint(card.position);
  if (lens) lines.push(`牌位透镜（${card.position}）：${lens}`);
  lines.push(`行动提示：${card.actionHint || "—"}`);
  return lines.join("\n");
}

function positionLensHint(position) {
  const map = {
    现状: "描述此刻真实站位，不评判好坏",
    阻碍: "正视它如何拖住你；好牌落此处常是「过度依赖」",
    建议: "给可落地的姿态，不保证结果",
    对方或外界: "外部/对方状态，需互动验证，不替对方定论",
    隐藏因素: "尚未被看见却在影响判断的暗流",
    下一步: "更可能展开的动作节奏",
    今日指引: "今天值得守住的一件小事",
    我: "你自身的状态与课题"
  };
  return map[position] || "";
}

function spreadSynthesisHint(reading) {
  const cards = reading.cards || [];
  if (!cards.length) return "";
  if (cards.length === 1) {
    const c = cards[0];
    const word = cardFacetWord(c, reading) || c.keywords?.[0] || c.name;
    return `【单张速读 · 必守】这一盘只有一张「${c.name}（${c.orientation}）」，不要假装有现状/阻碍/建议三段、不要编造别的牌。请：
- briefSummary：先用牌面意象照见用户此刻关于其问题的真实状态（镜子，让ta觉得「这就是我」），再给一句直接结论。
- innerTheme：把表层问题【重新框定】成更深的课题或视角转换（围绕「${word}」与该牌的元素含义），不要复述牌名。
- gentleActions：给一个本周可做、具体到对象/步骤、且直接回应用户原问题的动作。
- 全篇必须回答用户的原问题，给出明确倾向，禁止「顺其自然/慢慢来」充当主要指引。`;
  }
  const chain = cards
    .map((card) => `${card.position}=${card.name}${card.orientation === "逆位" ? "逆" : "正"}`)
    .join(" → ");
  const now = cardByPosition(cards, "现状", "今日指引", "我") || cards[0];
  const advice = cardByPosition(cards, "建议", "下一步");
  const nowWord = now ? (cardFacetWord(now, reading) || now.keywords?.[0] || now.name) : "";
  const loopNote = now && advice && now !== advice
    ? `\n- 【同一主线闭环·必守】现状(${now.name})与建议(${advice.name})要落在同一条主线上：现状是「这股劲的起点」，建议是「这股劲的出口」。innerTheme 必须用一句话把三张串成因果链（现状的X → 被阻碍的Y卡住 → 建议把X收成一个动作），不要三张各说各话。建议位的 positionReading 结尾要轻轻回扣【现状牌「${now.name}」自己的核心】（围绕「${nowWord}」展开，例如「也正是把开头那份「${nowWord}」落到实处」）——必须用现状牌的真实含义，禁止照抄示例措辞、禁止出现与现状牌无关的词（如不要凭空写「观望」）。`
    : "";
  return `【牌阵能量链】${chain}。写作时按此因果链合参：从现状出发，看见阻碍如何卡住，再从建议找出口；整篇解读须能回答用户原问题。${loopNote}`;
}

function normalizeStringList(value, maxItems, maxLen, exact) {
  const list = Array.isArray(value)
    ? value.map((item) => clampText(item, maxLen)).filter(Boolean)
    : String(value || "")
        .split(/\n+/)
        .map((item) => clampText(item.replace(/^[-•·\d.)\s]+/, ""), maxLen))
        .filter(Boolean);
  const trimmed = list.slice(0, maxItems);
  if (exact && trimmed.length < exact) return null;
  return trimmed.length ? trimmed : null;
}

function buildPromptPayload(reading, { strictJson = false } = {}) {
  const p = reading.questionProfile || {};
  const ctx = inferQuestionContext(reading);
  const choice = detectChoiceOptions(reading.question);
  const cardsText = (reading.cards || []).map((card) => formatCardForPrompt(card, p)).join("\n\n");
  const synthesisReference = stripVerdictPrefix(buildSpreadVerdict(reading));
  const cardReferenceHints = (reading.cards || [])
    .map((card) => `- ${card.position}·${card.name}：${cardReadingText(card, reading)}`)
    .join("\n");

  const jsonNote = strictJson
    ? "\n【重要】上次输出不是合法 JSON。本次只输出一个 JSON 对象，不要 Markdown，不要解释，字符串内不要用换行。"
    : "";

  const crisisBlock = crisisPromptBlock(reading);

  return {
    system: `你是「星月少女塔罗馆」的 AI 塔罗牌师。整篇解读由你根据【用户问题 + 牌面 + 情境策略】推理完成——你是主解读者，不是规则模板的复读机。

原则（简要）：
- 贴牌、贴用户原问题；全文「你」；先给强判断，再展开每张牌与可执行小步。
- directVerdict 必写：第一句必须是明确立场/倾向/阶段/宜否（强判断），第二句起用牌位+牌名作依据；禁止「就你问的…」套话开头；禁止逃避作答。
- positionReadings 由你亲自撰写（50-68字/条）：结合牌面意象、正逆位、牌位透镜与用户原问题，像牌师口述；可参考下方牌理提示整合进自然语言，禁止整句照抄规则模板。
- descriptionLayer / situationLayer / meaningLayer：四层故事由你写，各层角度不同，禁止与 directVerdict 同句复读。
- 荣格式觉察：innerTheme 把表层问题重框到内在课题（配得感/害怕什么/在等什么许可），不复述牌名。
- 禁止：算命腔、保证结果、具体日期、「别急着下结论」「不必今天想通」逃避作答。
${crisisBlock ? `\n${crisisBlock}` : ""}

【输出】仅一个合法 JSON 对象：${jsonNote}
{
  "directVerdict": "≤95字强判断：首句明确立场，再牌证；勿以就你问的开头",
  "headline": "8-12字点题",
  "briefSummary": "45-80字如实浓缩",
  "presentState": "≤55字，感受+结论",
  "descriptionLayer": "≤72字描述层：牌面看见什么、与问题的关系",
  "situationLayer": "≤72字情境层：放进用户生活/work情境",
  "meaningLayer": "≤56字意义层：这件事对用户意味着什么",
  "innerTheme": "≤56字重新框定：须含内在课题(价值/配得/害怕/许可)",
  "reminders": ["0-3条便签"],
  "innerTension": "≤48字心理拉扯",
  "reflectionQuestions": ["恰好2个，须扣本盘牌面与原问"],
  "gentleActions": ["恰好2条"],
  "closingLine": "≤32字短收束",
  "positionReadings": [{"position":"牌位","cardName":"牌名","text":"50-68字"}]
}`,
    user: `${questionFocusHint(reading)}
${crisisBlock}

【牌理参考 · 整合进解读，勿照抄】
本地引擎合参倾向（${ctx.intentLabel || ctx.intent}），供你对齐方向、用自己的话重写：
「${synthesisReference}」

分牌参考（可吸收语义，须改写成自然解读）：
${cardReferenceHints}

【用户问题】${reading.question}
${choice ? choiceHint(reading.question) : ""}
【解读域/意图】${ctx.domain} / ${ctx.intentLabel || ctx.intent}
【用户此刻最需要】${p.coreNeed || "被看见、被理解"}

【主题】${reading.themeLabel}
【此刻心情】${moodLabels[reading.mood] || reading.mood} — ${moodEmbraceLines[reading.mood] || "请温柔接住用户此刻的感受"}

【牌阵】${reading.spread}
【本次牌面 · 正逆位以输入为准】
${cardsText}`
  };
}

/** 供测试与外部集成：构建 AI 解读 prompt（含牌理地板） */
export function buildReadingPrompt(reading, options = {}) {
  return buildPromptPayload(reading, options);
}

function moodEmbraceLine(mood) {
  return moodEmbraceLines[mood] || "谢谢你愿意把此刻的心事带到牌阵里。";
}

function moodHintsSnippet(mood) {
  const hints = {
    lost: "想听见确定声音",
    urgent: "急于要结果",
    calmChaos: "表面平静内心很乱",
    turning: "期待转机",
    release: "想放下"
  };
  return hints[mood] || "";
}

function moodResponseHint(reading) {
  const label = moodLabels[reading.mood] || "有些不确定";
  const embrace = moodEmbraceLines[reading.mood] || "用户此刻需要被温柔地看见。";
  const snippet = moodHintsSnippet(reading.mood);
  return `【此刻心情 · 必回应】用户选了「${label}」（${snippet}）。
请在 presentState 句1 用类似语气接住（可参考：「${embrace}」），再回应字面问题。
结论须与牌阵基调一致：有挑战牌时不得只写「会好的/在路上」。
closingLine 可温暖，但不得推翻前文挑战判断。`;
}

function holdsEmotion(text, reading) {
  const body = String(text || "");
  if (/我理解|我懂|我听见|我看见|并不容易|辛苦了|值得被|谢谢你|陪你|不必独自|照顾好自己/.test(body)) return true;
  const keys = moodResponseKeywords[reading.mood] || [];
  return keys.some((w) => body.includes(w));
}

async function requestAiJson(reading, { strictJson = false, signal } = {}) {
  const apiKey = process.env.DMXAPI_KEY;
  const base = (process.env.DMXAPI_BASE || DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.DMXAPI_MODEL || DEFAULT_MODEL;
  const url = `${base}/v1/chat/completions`;
  const { system, user } = buildPromptPayload(reading, { strictJson });

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: strictJson ? 0.4 : 0.58,
    max_tokens: 2600
  };

  if (!strictJson) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DMXAPI ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`Empty AI response (${data?.choices?.[0]?.finish_reason || "unknown"})`);
  }

  return parseAiJson(content);
}

export async function generateAiSummary(reading) {
  const apiKey = process.env.DMXAPI_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50000);

  try {
    let parsed;
    try {
      parsed = await requestAiJson(reading, { signal: controller.signal });
    } catch (firstError) {
      const retryable = /JSON|Empty AI|DMXAPI 5/.test(String(firstError.message));
      if (!retryable) throw firstError;
      parsed = await requestAiJson(reading, { strictJson: true, signal: controller.signal });
    }
    return normalizeAiResult(parsed, reading);
  } finally {
    clearTimeout(timer);
  }
}

function normalizePositionReadings(parsed, reading, fallback) {
  const cards = reading.cards || [];
  if (!Array.isArray(parsed.positionReadings) || !parsed.positionReadings.length) {
    return fallback.positionReadings || cards.map((card, index) => ({
      position: card.position,
      cardName: card.name,
      text: fallback.cardLines?.[index]?.split("｜").pop() || card.keywords[0]
    }));
  }

  return parsed.positionReadings.slice(0, cards.length).map((item, index) => {
    const card = cards[index];
    return {
      position: String(item.position || card?.position || "").slice(0, 12),
      cardName: String(item.cardName || card?.name || "").slice(0, 16),
      text: clampSentenceClean(item.text, POSITION_READING_MAX) || fallback.positionReadings?.[index]?.text || card?.keywords?.[0] || ""
    };
  });
}

function sanitizeCopy(text) {
  let out = String(text || "").trim();
  for (const phrase of BANNED_PHRASES) {
    out = out.replaceAll(phrase, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function isWeakLine(text) {
  const body = String(text || "");
  if (body.length < 10) return true;
  if (/可能正在浮现|感受值得被看见|关于你的问题，这张牌也许在说/.test(body)) return true;
  if (/^[^。！？]{0,8}(现实评估|现实起点|思考积累)[。！？]?$/.test(body)) return true;
  if (/这股能量暂时没有顺畅流动|放在「/.test(body)) return true;
  return false;
}

function isMechanicalTheme(text) {
  return /连成一条线|辨认你的节奏|正描出起点|带来拉扯，而.+指向出口|经.+到.+，主线在|主线在过度付出$/.test(String(text || ""));
}

function hasHopeTone(text) {
  return /路|希望|出口|光|仍在|指向|温柔|安心|对齐|慢慢|值得|陪伴/.test(String(text || ""));
}

function isColdHeadline(text) {
  return false;
}

/** 安慰型套话：不能充当主要指引（方向/行动/收束） */
const PLATITUDE = /早一?点休息|明天再(想|说|决定)|慢慢来|顺其自然|照顾好自己|用一件小事|找到自己的节奏|答案会(自己|慢慢)?(浮现|出现|来)|先别急着(做)?决定|放轻松就好|静待|耐心等(待|候)就好|陪着?自己(等|慢慢)|等风来/;

function dropPlatitudes(list) {
  return (list || []).filter((item) => item && !PLATITUDE.test(item));
}

/** 行动语句的整洁截断：超长时在最后一个标点处收尾，不留半词/半句 */
function clampActionClean(text, max = 40) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw.replace(/[，,、；;]\s*$/, "");
  const slice = raw.slice(0, max);
  const cut = Math.max(
    slice.lastIndexOf("，"), slice.lastIndexOf("。"), slice.lastIndexOf("、"),
    slice.lastIndexOf("；"), slice.lastIndexOf("！"), slice.lastIndexOf("．"), slice.lastIndexOf(",")
  );
  if (cut >= Math.floor(max * 0.5)) return slice.slice(0, cut).replace(/[，,、；;]\s*$/, "");
  return slice.replace(/[，,、；;]\s*$/, "");
}

/** 让「温柔尝试」具体、有方向：去套话 → 以建议牌行动领衔 → 用回退补足两条 */
function isWeakAction(text) {
  const s = String(text || "").trim();
  if (s.length < 10) return true;
  return PLATITUDE.test(s) || EVASIVE_VERDICT.test(s) || /先不急着决定|写下：我到底在抗拒/.test(s);
}

function buildConcreteGentleActions(reading) {
  const p = reading.questionProfile || {};
  const advice = cardByPosition(reading.cards, "建议", "下一步", "今日指引");
  const q = reading.question || "";
  if (p.asksInterview || p.asksOffer || /面试|offer|没消息|二面/.test(q)) {
    return [
      "为每条机会各写一行：最后联系日、联系人、下一步节点",
      "本周对最在意的一家发一条礼貌跟进，确认评估进度，不连发"
    ];
  }
  if (p.isRelationship || p.asksOtherFeeling) {
    return [
      "写下你最想确认的一个事实（对方做过什么、没做什么）",
      "选一次合适场合，用一句直接问法表达需求，不质问"
    ];
  }
  if (p.isDecision || /该不该|要不要|还是/.test(q)) {
    return [
      "把两个选项各列三项：得到什么、失去什么、需要谁支持",
      "本周做一个最小试探步（谈话/调研/短住），再回看身体反应"
    ];
  }
  if (p.isEmotion) {
    return [
      "今晚留 15 分钟只做一件恢复小事（散步/热水/早睡）",
      "把最耗你的一句担心写下来，标出「事实」与「担心」"
    ];
  }
  const hint = advice?.actionHint || "把建议牌落成一件本周可核对的小事";
  return [clampActionClean(hint, 40), "把最在意的一点写成一句话，贴在显眼处，每天只看一次"];
}

function groundGentleActions(actions, reading, fallback) {
  let list = dropPlatitudes(actions).map((s) => clampActionClean(s, 40)).filter((s) => !isWeakAction(s));
  const advice = cardByPosition(reading.cards, "建议", "下一步", "今日指引") || reading.cards?.[0];
  if (advice?.actionHint && !list.some((it) => isSimilarCopy(it, advice.actionHint))) {
    list.unshift(clampActionClean(advice.actionHint, 40));
  }
  for (const f of fallback?.gentleActions || []) {
    if (list.length >= 2) break;
    if (!isWeakAction(f) && !list.some((it) => isSimilarCopy(it, f))) list.push(f);
  }
  if (list.length < 2 || list.some(isWeakAction)) {
    const concrete = buildConcreteGentleActions(reading);
    for (const item of concrete) {
      if (list.length >= 2) break;
      if (!list.some((it) => isSimilarCopy(it, item))) list.push(item);
    }
  }
  return list.filter((s) => !isWeakAction(s)).slice(0, 2);
}

function ensureSelfCareAction(actions, reading) {
  const list = [...(actions || [])].filter(Boolean);
  if (!list.some((item) => SELF_CARE_ACTION.test(item))) {
    list.unshift("今晚允许自己早一点休息，答案可以明天再想");
  }
  const advice = cardByPosition(reading.cards, "建议", "下一步");
  if (advice && !list.some((item) => mentionsCard(item, advice))) {
    list.push(clampAtSentence(`可以试着按${advice.name}：${interpretCardLine(advice, reading)}`, 42));
  }
  return list.slice(0, 2).map((item) => clampText(item, 42));
}

function addressesUserQuestion(text, reading) {
  return addressesQuestion(text, reading);
}

function orientationMismatch(text, card) {
  if (!card) return false;
  const body = String(text || "");
  const hasName = body.includes(card.name);
  if (!hasName) return false;
  const saysReversed = /逆位/.test(body);
  const saysUpright = /正位/.test(body);
  if (card.orientation === "逆位" && saysUpright && !saysReversed) return true;
  if (card.orientation === "正位" && saysReversed && !saysUpright) return true;
  return false;
}

function polishReminders(reminders, reading, fallback) {
  const cards = reading.cards || [];
  const cleaned = (reminders || []).map((item) => clampText(sanitizeCopy(item), 48)).filter(Boolean);
  const merged = cards.map((card, index) => {
    const candidate = cleaned[index];
    if (candidate && !isWeakLine(candidate) && candidate.includes(card.name) && !orientationMismatch(candidate, card)) {
      return candidate;
    }
    const line = interpretCardLine(card, reading);
    return clampText(`【${card.position}】${cardLabel(card)}：${line}`, 48) || fallback.reminders[index];
  });
  return merged.filter(Boolean).slice(0, 3);
}

function mentionsCard(text, card) {
  const body = String(text || "");
  return body.includes(card.name) || body.includes(card.name.slice(0, 2));
}

function shouldFallbackPosition(raw, card, reading) {
  const body = stripCardNamePrefix(sanitizeCopy(raw), card);
  return (
    !body
    || isWeakLine(body)
    || STALE_POSITION_PATTERNS.test(String(raw || ""))
    || STALE_POSITION_PATTERNS.test(body)
    || aiSummaryWrongFraming(body, reading)
    || orientationMismatch(raw, card)
    || (cardValence(card) === "challenge" && soundsOverlyPositive(body))
    || !mentionsCard(raw, card)
  );
}

function formatPositionReadingText(raw, card) {
  const body = stripCardNamePrefix(sanitizeCopy(raw), card);
  const prefixed = body.includes(`${card.position}·`)
    ? body
    : `${card.position}·${cardLabel(card)}：${body}`;
  return clampSentenceClean(colloquializeCopy(prefixed), POSITION_READING_MAX);
}

function guardPositionReadings(items, reading, fallback) {
  const cards = reading.cards || [];
  return cards.map((card, index) => {
    const raw = items[index]?.text || "";
    const text = shouldFallbackPosition(raw, card, reading)
      ? (buildPositionReading(card, reading) || fallback.positionReadings?.[index]?.text || "")
      : formatPositionReadingText(raw, card);
    return {
      position: card.position,
      cardName: card.name,
      text
    };
  });
}

function colloquializeCopy(text) {
  return String(text || "")
    .replace(/\bjuggling\b/gi, "兼顾多项")
    .replace(/投入度偏低/g, "还不太上心")
    .replace(/疏离或犹豫/g, "有点淡、也在犹豫")
    .replace(/尚未成熟/g, "还没想清楚")
    .replace(/冷淡的迹象/g, "偏冷")
    .replace(/暗示/g, "更像是")
    .replace(/迹象/g, "")
    .replace(/谢谢你今晚的认真。?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitSentences(text) {
  return String(text || "")
    .split(/[。！？；]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);
}

function isSimilarCopy(a, b) {
  const left = String(a || "").replace(/\s/g, "");
  const right = String(b || "").replace(/\s/g, "");
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const short = left.length < right.length ? left : right;
  const long = left.length < right.length ? right : left;
  let hit = 0;
  for (let i = 0; i <= long.length - 6; i += 1) {
    const chunk = long.slice(i, i + 6);
    if (short.includes(chunk)) hit += 1;
  }
  return hit >= 2;
}

function dedupeListAgainstCorpus(list, corpus, maxLen = 48) {
  const pool = Array.isArray(corpus) ? corpus : [corpus];
  return (list || [])
    .map((item) => clampText(colloquializeCopy(item), maxLen))
    .filter((item) => item && !pool.some((base) => isSimilarCopy(item, base)));
}

function aiSummaryWrongFraming(text, reading) {
  const body = String(text || "");
  const sig = questionSignals(reading);
  if (
    sig.choice
    && /还在评估|评估期|评估窗|等消息|等待期|offer 还在|仍在评估/.test(body)
    && !(body.includes(sig.choice.a) && body.includes(sig.choice.b))
  ) {
    return true;
  }
  if (hasDomainLeak(body, reading)) return true;
  if (/仍在评估\/等待窗|是当前主要阻力|宜慢，别在焦虑里催结果/.test(body)) return true;
  return false;
}

function stripDomainLeakage(text, reading) {
  const body = String(text || "");
  if (!body || !hasDomainLeak(body, reading)) return body;
  return "";
}

function buildBriefSummary(reading, ai) {
  if (ai?.briefSummary) {
    let out = clampAtSentence(colloquializeCopy(ai.briefSummary), 80);
    const hasChallenge = (reading.cards || []).some((c) => cardValence(c) === "challenge");
    if (
      (hasChallenge && soundsOverlyPositive(out))
      || aiSummaryWrongFraming(out, reading)
    ) {
      out = buildBriefSummaryFromCards(reading);
    }
    if (/\…$/.test(out) && out.length >= Math.floor(80 * 0.85)) {
      out = buildBriefSummaryFromCards(reading);
    }
    return out;
  }
  return buildBriefSummaryFromCards(reading);
}

function buildBriefSummaryFromCards(reading) {
  const fb = stripVerdictPrefix(buildSpreadVerdict(reading));
  const embrace = (moodEmbraceLines[reading.mood] || "我懂你在意。").replace(/。$/, "");
  if (fb.length >= 70) return clampAtSentence(fb, 80);
  return clampAtSentence(`${embrace}。${fb}`, 80);
}

function compactPresentState(reading, text, briefSummary) {
  let out = colloquializeCopy(text || "");
  const cards = reading.cards || [];
  for (const card of cards) {
    if (card.name && out.includes(card.name)) {
      out = out.replace(new RegExp(`[^。！？]*${card.name}[^。！？]*[。！？]?`, "g"), "");
    }
  }
  out = out.replace(/\s{2,}/g, " ").trim();
  if (out.length < 12) return clampAtSentence(briefSummary, 55);
  return clampAtSentence(out, 55);
}

function filterReminders(reminders, positionReadings, briefSummary) {
  const corpus = [
    briefSummary,
    ...(positionReadings || []).map((item) => item.text)
  ];
  const filtered = dedupeListAgainstCorpus(reminders, corpus, 20);
  return filtered.length ? filtered.slice(0, 3) : [];
}

function dedupeClosingLine(closingLine, briefSummary, gentleActions) {
  let out = colloquializeCopy(closingLine);
  if (isSimilarCopy(out, briefSummary)) {
    out = "今晚先到这儿，照顾好自己就很好。";
  }
  if ((gentleActions || []).some((item) => isSimilarCopy(out, item))) {
    out = "慢慢来，答案会在你节奏对齐时出现。";
  }
  return clampAtSentence(out, 34);
}

function pickStoryLayer(parsed, key, fallbackText, maxLen) {
  const out = clampSentenceClean(colloquializeCopy(parsed[key]), maxLen);
  if (isWeakLine(out) || isMechanicalTheme(out)) return fallbackText;
  return out;
}

export function normalizeAiResult(parsed, reading) {
  const fallback = buildGentleFallback(reading);
  const fallbackLayers = buildStoryLayers(reading);
  let positionReadings = normalizePositionReadings(parsed, reading, fallback);
  positionReadings = guardPositionReadings(positionReadings, reading, fallback);

  let directVerdict = clampAtSentence(
    stripVerdictPrefix(colloquializeCopy(parsed.directVerdict || parsed.verdict)),
    120
  );
  if (!directVerdict || !isStrongVerdict(directVerdict, reading)) {
    directVerdict = fallback.directVerdict || buildSynthesizedVerdict(reading);
  }

  let briefSummary = buildBriefSummary(reading, parsed);
  if (
    soundsOverlyPositive(briefSummary)
    && (reading.cards || []).some((c) => cardValence(c) === "challenge")
  ) {
    briefSummary = buildBriefSummaryFromCards(reading);
  }
  if (
    isWeakLine(briefSummary)
    || !addressesUserQuestion(briefSummary, reading)
    || /不必今天想通|顺其自然|答案会自己浮现|别急着下结论/.test(briefSummary)
  ) {
    const embrace = (moodEmbraceLines[reading.mood] || "").replace(/。$/, "");
    briefSummary = clampAtSentence(
      embrace ? `${embrace}。${directVerdict}` : directVerdict,
      80
    );
  }
  briefSummary = dedupeBriefSummary(briefSummary, directVerdict, reading);
  let presentState = compactPresentState(
    reading,
    sanitizeCopy(parsed.presentState || parsed.opening),
    briefSummary
  ) || fallback.presentState;

  if (isWeakLine(presentState) || !holdsEmotion(presentState, reading)) {
    presentState = compactPresentState(reading, groundPresentState(reading), briefSummary);
  }
  presentState = dedupePresentState(presentState, briefSummary, directVerdict);
  if (!presentState || presentState.length < 12) {
    presentState = compactPresentState(reading, groundPresentState(reading), briefSummary);
  }

  let innerTheme = clampSentenceClean(colloquializeCopy(parsed.innerTheme), 72) || fallback.innerTheme;
  if (
    isWeakLine(innerTheme)
    || isMechanicalTheme(innerTheme)
    || isSimilarCopy(innerTheme, briefSummary)
    || !hasPsychologicalDepth(innerTheme)
  ) {
    innerTheme = groundInnerTheme(reading);
  }

  const descriptionLayer = pickStoryLayer(parsed, "descriptionLayer", fallbackLayers.description, 88);
  const situationLayer = pickStoryLayer(parsed, "situationLayer", fallbackLayers.situation, 88);
  const meaningLayer = pickStoryLayer(parsed, "meaningLayer", fallbackLayers.meaning, 72);

  let reminders = filterReminders(
    normalizeStringList(parsed.reminders, 3, 20),
    positionReadings,
    briefSummary
  );

  let innerTension = clampAtSentence(colloquializeCopy(parsed.innerTension || parsed.synthesis), 50)
    || fallback.innerTension;
  if (hasDomainLeak(innerTension, reading)) {
    innerTension = groundInnerTension(reading);
  }
  if (isWeakLine(innerTension) || isSimilarCopy(innerTension, briefSummary)) {
    innerTension = meaningLayer || groundInnerTension(reading);
  }

  const reflectionQuestionsRaw =
    normalizeStringList(parsed.reflectionQuestions, 2, 34, 2) || fallback.reflectionQuestions;
  let reflectionQuestions = reflectionQuestionsRaw.filter((q) => !isGenericReflection(q));
  if (reflectionQuestions.length < 2) {
    reflectionQuestions = (fallback.reflectionQuestions || []).filter((q) => !isGenericReflection(q));
  }
  if (reflectionQuestions.length < 2) {
    reflectionQuestions = fallback.reflectionQuestions;
  }
  if (reflectionQuestions.some((q) => hasDomainLeak(q, reading))) {
    reflectionQuestions = fallback.reflectionQuestions;
  }

  let gentleActions = normalizeStringList(parsed.gentleActions, 2, 48)
    || normalizeStringList(parsed.action ? [parsed.action] : null, 2, 48)
    || fallback.gentleActions;
  gentleActions = gentleActions.filter((item) => stripDomainLeakage(item, reading));
  gentleActions = dedupeListAgainstCorpus(gentleActions, [briefSummary, ...positionReadings.map((item) => item.text)], 36);
  gentleActions = groundGentleActions(gentleActions, reading, fallback);

  let closingLine = dedupeClosingLine(
    sanitizeCopy(parsed.closingLine || parsed.star) || fallback.closingLine,
    briefSummary,
    gentleActions
  );
  if (isWeakLine(closingLine) || PLATITUDE.test(closingLine)) {
    closingLine = groundClosingLine(reading);
  }

  const headline = normalizeHeadline(sanitizeCopy(parsed.headline), reading, fallback);

  return {
    headline,
    directVerdict,
    briefSummary,
    presentState,
    descriptionLayer,
    situationLayer,
    meaningLayer,
    innerTheme,
    reminders,
    innerTension,
    reflectionQuestions,
    gentleActions,
    closingLine,
    positionReadings,
    spreadTone: {
      challengeCount: (reading.cards || []).filter((c) => cardValence(c) === "challenge").length,
      labels: (reading.cards || []).map((c) => ({
        position: c.position,
        name: c.name,
        valence: cardValenceLabel(c)
      }))
    },
    directAnswer: directVerdict,
    insight: innerTheme,
    cardLines: positionReadings.map((item) => `${item.position}｜${item.cardName}｜${item.text.slice(0, 24)}`),
    action: gentleActions[0],
    star: closingLine
  };
}

function buildReminders(reading) {
  const cards = (reading.cards || []).slice(0, 3);
  const harsh = /谣言|中伤|报复|冷酷|专横|毁灭|死亡|恶魔/;
  return cards.map((card) => {
    let word = contextualFacetWord(card, reading);
    if (!word || harsh.test(word)) {
      word = card.orientation === "逆位" ? "先稳节奏" : "看清一步";
    }
    return clampText(word, 18);
  });
}

/** 本地回退：温柔小屏结构化总结（扣题、按牌位） */
export function buildGentleFallback(reading) {
  const cards = reading.cards || [];
  const base = answerUserQuestion(reading);

  const reminders = buildReminders(reading);
  const positionReadings = cards.map((card) => ({
    position: card.position,
    cardName: card.name,
    text: buildPositionReading(card, reading)
  }));

  const reflectionQuestions = reflectionQuestionsFallback(reading);
  let gentleActions = buildSpreadActions(reading);
  const adviceCard = cardByPosition(cards, "建议", "下一步") || cards.at(-1);
  const leadAction = adviceCard?.actionHint ? clampText(adviceCard.actionHint, 40) : "";
  const spreadIsConcrete = gentleActions.some((it) => /跟进|列出|写|发|核实|确认|散步|呼吸|睡/.test(it));
  if (leadAction && !spreadIsConcrete && !gentleActions.some((it) => isSimilarCopy(it, leadAction))) {
    gentleActions = [leadAction, ...gentleActions].slice(0, 2);
  }

  const layers = buildStoryLayers(reading);
  const directVerdict = stripVerdictPrefix(base.directVerdict || buildFallbackDirectVerdict(reading));
  const briefSummary = buildBriefSummary(reading, null);
  const innerTensionOut = layers.meaning || groundInnerTension(reading);
  return {
    headline: groundHeadline(reading) || base.headline,
    directVerdict,
    briefSummary,
    presentState: compactPresentState(reading, groundPresentState(reading), briefSummary),
    innerTheme: groundInnerTheme(reading),
    reminders: reminders.length ? reminders : [],
    innerTension: innerTensionOut,
    reflectionQuestions: reflectionQuestions.map((item) => item.slice(0, 38)),
    gentleActions,
    closingLine: groundClosingLine(reading),
    positionReadings,
    descriptionLayer: layers.description,
    situationLayer: layers.situation,
    meaningLayer: layers.meaning,
    directAnswer: directVerdict,
    insight: base.insight,
    cardLines: positionReadings.map((item) => `${item.position}｜${item.cardName}｜${item.text.slice(0, 24)}`),
    action: gentleActions[0],
    star: groundClosingLine(reading)
  };
}

export function buildCompactFallback(reading) {
  return buildGentleFallback(reading);
}

export function mergeAiSummary(reading, ai) {
  if (!ai) return reading.summary;

  const verdict = stripVerdictPrefix(ai.directVerdict || "");
  const sections = [];
  if (verdict) {
    sections.push({ title: "牌师判断", text: verdict, emphasis: true });
  }
  if (ai.briefSummary) {
    sections.push({ title: "浓缩总结", text: ai.briefSummary, emphasis: true });
  }
  const presentState = ai.presentState || ai.directAnswer;
  if (presentState && (!ai.briefSummary || !isSimilarCopy(presentState, ai.briefSummary))) {
    sections.push({ title: "此刻的状态", text: presentState });
  }
  sections.push({ title: "你内心正在关注的主题", text: ai.innerTheme || ai.insight });
  if (ai.reminders?.length) {
    sections.push({ title: "这次抽卡给你的提醒", list: ai.reminders });
  }

  ai.positionReadings?.forEach((item) => {
    sections.push({
      title: `${item.position}｜${item.cardName}`,
      text: item.text
    });
  });

  sections.push(
    { title: "内心的拉扯点", text: ai.innerTension },
    { title: "可以陪你想一想的问题", list: ai.reflectionQuestions },
    { title: "接下来你可以温柔地尝试", list: ai.gentleActions },
    { title: "最后想留给你的一句话", text: ai.closingLine || ai.star, emphasis: true }
  );

  const gentleActions = ai.gentleActions || (ai.action ? [ai.action] : []);

  return {
    keyword: ai.headline,
    luckyColor: reading.summary.luckyColor,
    action: gentleActions[0] || ai.action,
    aiCompact: { ...ai, directVerdict: verdict || stripVerdictPrefix(ai.directVerdict || "") },
    sections: sections.filter((section) => section.text || section.list?.length)
  };
}
