/**
 * 问题画像（浏览器 + Node 共用）
 * 从原话推断主题/心情，供首页快径与 analyzeQuestion 使用。
 */

const DOMAIN_SIGNALS = {
  relationship: {
    strong: ["复合", "暧昧", "表白", "前任", "喜欢我", "对我的感觉", "这段关系", "在一起"],
    weak: ["他", "她", "ta", "对方", "喜欢", "爱", "关系", "主动", "联系", "心动"]
  },
  career: {
    strong: ["offer", "录用", "入职", "离职", "跳槽", "面试", "升职", "工作机会", "这份工作"],
    weak: ["工作", "职业", "事业", "老板", "同事", "岗位", "项目", "坚持"]
  },
  emotion: {
    strong: ["焦虑到", "撑不住", "情绪崩", "睡不着", "很疲惫"],
    weak: ["累", "焦虑", "难过", "情绪", "疲惫", "压力", "烦"]
  },
  self: {
    strong: ["重新喜欢自己", "成为自己", "自我成长", "走不出来"],
    weak: ["自己", "成长", "内在", "改变", "自信", "修复"]
  },
  future: {
    strong: ["未来三个月", "接下来会", "发展方向", "该选哪个", "前景", "打德州", "会不会赢"],
    weak: ["未来", "发展", "方向", "趋势", "德州", "扑克", "打牌", "牌局", "赢", "胜算"]
  }
};

const DOMAIN_ORDER = ["relationship", "career", "emotion", "self", "future"];

function scoreDomains(text, themeBoost = "") {
  const scoreDomain = (key) => {
    const sig = DOMAIN_SIGNALS[key];
    let s = themeBoost === key ? 5 : 0;
    for (const w of sig.strong) if (text.includes(w)) s += 3;
    for (const w of sig.weak) if (text.includes(w)) s += 1;
    return s;
  };
  const scores = {};
  for (const key of DOMAIN_ORDER) scores[key] = scoreDomain(key);
  return scores;
}

function pickDominant(scores, fallback = "future") {
  let dominant = DOMAIN_ORDER[0];
  for (const key of DOMAIN_ORDER) {
    if (scores[key] > scores[dominant]) dominant = key;
  }
  if (scores[dominant] === 0) return fallback;
  return dominant;
}

/** 解读引擎用意图（与 reading-knowledge 单源） */
export const READING_INTENTS = {
  outcome_forecast: "结果/走向会怎样",
  win_lose_forecast: "会不会赢/能不能成",
  yes_no_decision: "该不该/要不要",
  partner_attitude: "对方心意/态度",
  binary_choice: "二选一",
  timing: "何时/何地",
  self_clarity: "自我确认/内在",
  emotion_regulation: "情绪梳理"
};

/** 用户要的是明确输赢/成败倾向，不是「仍在展开」 */
export function asksWinLoseOutcome(question = "") {
  const q = String(question || "");
  return /会不会赢|能不能赢|会赢吗|会输吗|赢不赢|能赢吗|打得赢|有胜算|顺不顺|能不能成|会不会成|能成吗|胜算大吗|今天.*赢|今晚.*赢/.test(q);
}

/**
 * 单源：问题 → domain + intent（question-profile 与 reading-knowledge 共用）
 */
export function resolveReadingContext(input = {}) {
  const q = String(input.question || input.profile?.text || "").trim();
  const p = input.profile || {};
  const theme = input.theme || p.dominantTheme || "future";
  const themeLabel = input.themeLabel || "";

  let domain = p.dominantTheme || theme;
  if (p.asksOffer || p.asksInterview || (p.isCareer && /offer|面试|录用|入职|工作|岗位/.test(q))) {
    domain = "career";
  } else if (p.isEmotion || /焦虑到|睡不着|撑不住|情绪崩|很疲惫/.test(q)) {
    domain = "emotion";
  } else if (p.isRelationship) {
    domain = "relationship";
  } else if (p.isSelf) {
    domain = "self";
  } else if (p.isDecision) {
    domain = "decision";
  } else if (/德州|德扑|扑克|打牌|牌局|梭哈|麻将|博彩|赌局|彩票|会不会赢|能不能赢|有胜算/.test(q)) {
    domain = "future";
  } else if (/offer|录用|入职|面试|工作机会|职业|事业|岗位/i.test(q)) {
    domain = "career";
  } else if (theme === "emotion") {
    domain = "emotion";
  } else if (theme === "relationship") {
    domain = "relationship";
  } else if (theme === "self") {
    domain = "self";
  }

  let intent = "outcome_forecast";
  if (p.asksOtherFeeling) {
    intent = "partner_attitude";
  } else if (/他|她|对方|ta/i.test(q) && /感觉|喜欢|态度|心意|爱|有没有/.test(q)) {
    intent = "partner_attitude";
  } else if (p.isRelease) {
    intent = "self_clarity";
  } else if (/该不该|要不要|是否|继续|放弃|离开|主动/.test(q)) {
    intent = "yes_no_decision";
  } else if (/还是|或者|或是/.test(q) && /选|去|留|哪/.test(q)) {
    intent = "binary_choice";
  } else if (/什么时候|何时|多久|哪里|什么地方/.test(q)) {
    intent = "timing";
  } else if (asksWinLoseOutcome(q)) {
    intent = "win_lose_forecast";
  } else if (domain === "emotion" || p.isEmotion) {
    intent = "emotion_regulation";
  } else if (domain === "self" || p.isSelf) {
    intent = "self_clarity";
  } else if (/会怎么样|如何|走向|情况|未来|能不能|会不会|没消息|等消息|等结果/.test(q)) {
    intent = "outcome_forecast";
  }

  const subject =
    intent === "partner_attitude" ? "对方" :
    domain === "career" ? "职业/offer" :
    domain === "relationship" ? "关系" :
    domain === "emotion" ? "你最近的情绪状态" :
    "你";

  return {
    domain,
    intent,
    intentLabel: READING_INTENTS[intent] || intent,
    subject,
    question: q,
    profile: p,
    themeLabel
  };
}

/** 仅从原话推断主题（首页快径，不给 UI 选项加分） */
export function inferThemeFromQuestion(question = "") {
  const text = String(question || "").trim();
  if (!text) return "self";
  const scores = scoreDomains(text, "");
  return pickDominant(scores, "self");
}

/** 从原话推断心情 */
export function inferMoodFromQuestion(question = "") {
  const text = String(question || "");
  if (/很想知道|等不及|赶紧|急|没消息|等结果|等回复/.test(text)) return "urgent";
  if (/放下|释怀|翻篇|走出来|忘记/.test(text)) return "release";
  if (/迷茫|不清楚|不知道怎么办|看不清/.test(text)) return "lost";
  if (/转机|会不会|能不能|接下来/.test(text)) return "turning";
  if (/表面平静|脑子里|翻来覆去|很乱/.test(text)) return "calmChaos";
  return "calmChaos";
}

export function analyzeQuestion(question = "", theme = "relationship") {
  const text = question.trim() || "我现在最需要看见什么？";
  const scores = scoreDomains(text, theme);

  const isDecision = ["该不该", "要不要", "是否", "选择", "继续", "放弃", "离开", "留下", "还是"].some((w) => text.includes(w));
  const isRelease = ["放下", "走出来", "忘记", "释怀", "翻篇"].some((w) => text.includes(w));

  let dominant = pickDominant(scores, theme in scores ? theme : "future");

  const isRelationship = dominant === "relationship";
  const isCareer = dominant === "career";
  const isEmotion = dominant === "emotion";
  const isSelf = dominant === "self";
  const isFuture = dominant === "future" || theme === "future"
    || (isDecision && scores.relationship + scores.career + scores.emotion + scores.self === 0);

  let intent = "自我确认";
  if (isRelationship && isDecision) intent = "关系里的选择";
  else if (isRelationship) intent = "关系确认";
  else if (isCareer && isDecision) intent = "工作去留";
  else if (isCareer) intent = "职业方向";
  else if (isRelease) intent = "放下与释怀";
  else if (isEmotion) intent = "情绪修复";
  else if (isFuture || isDecision) intent = "未来选择";
  else if (isSelf) intent = "自我成长";

  const subject = isRelationship
    ? "你在意的那个人或这段关系"
    : isCareer
      ? "这份工作和你的价值感"
      : isEmotion
        ? "你最近的情绪状态"
        : "你正在面对的选择";

  const coreNeed = isRelationship
    ? "确定感、稳定行动和被认真对待"
    : isCareer
      ? "价值回报、成长空间和可持续的节奏"
      : isEmotion
        ? "被理解、被休息允许和重新找回能量"
        : isRelease
          ? "从旧牵挂里收回注意力"
          : "更清楚地知道自己想靠近什么";

  const asksOtherFeeling = isRelationship
    && /他|她|对方|ta/i.test(text)
    && /感觉|喜欢|爱|态度|怎么想|在意|心里|爱不爱/.test(text);

  let caution = isRelationship
    ? "不要把猜测当成证据，也不要用试探代替表达"
    : isCareer
      ? "不要只用忍耐衡量努力，也不要在疲惫时做极端决定"
      : isEmotion
        ? "不要把所有情绪都解释成自己不够好"
        : "不要为了马上安心而匆忙锁死答案";

  if (asksOtherFeeling) {
    caution = "牌照见的是你在关系里的感受与模式，不是对方脑内的想法；把牌当作镜子，不是监控器。";
  }

  const asksOffer = /offer|录用|入职|offer情况|等消息|等结果|等回复|没消息|HR|笔试|岗位/i.test(text)
    || (isCareer && /新.{0,6}(情况|机会|工作)|会怎么样|如何/i.test(text));
  const asksInterview = /面试|二面|三面|复试|初面|HR面|笔试|投递|没消息|等消息|等结果|没回音/i.test(text);

  const partial = {
    text,
    isRelationship,
    isCareer,
    isDecision,
    isEmotion,
    isRelease,
    isFuture,
    isSelf,
    asksOtherFeeling,
    asksOffer,
    asksInterview,
    dominantTheme: dominant
  };
  const readingCtx = resolveReadingContext({ question: text, theme: dominant, profile: partial });

  return {
    text,
    intent,
    subject,
    coreNeed,
    caution,
    isRelationship,
    isCareer,
    isDecision,
    isEmotion,
    isRelease,
    isFuture,
    isSelf,
    asksOtherFeeling,
    asksOffer,
    asksInterview,
    dominantTheme: dominant,
    domain: readingCtx.domain,
    readingIntent: readingCtx.intent,
    readingIntentLabel: readingCtx.intentLabel
  };
}
