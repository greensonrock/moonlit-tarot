import {
  contextualValence,
  valenceLabel,
  describeCardWhy,
  composePositionReading,
  getCardKnowledge
} from "./tarot-knowledge.js";

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

/** 本地回退：先回答用户字面问题，再用牌佐证 */
export function answerUserQuestion(reading) {
  const p = reading.questionProfile || {};
  const cards = reading.cards || [];
  const q = p.text || reading.question || "";
  const now = cardByPosition(cards, "现状", "今日指引", "我") || cards[0];
  const block = cardByPosition(cards, "阻碍", "隐藏因素");
  const advice = cardByPosition(cards, "建议", "下一步");
  const other = cardByPosition(cards, "对方或外界");

  const asksOtherFeeling = p.isRelationship && /他|她|对方|ta/i.test(q) && /感觉|喜欢|爱|态度|怎么想|在意/.test(q);
  const asksShouldIDo = p.isDecision || /该不该|要不要|是否|继续|放弃|离开|主动/.test(q);
  const asksFuture = p.isFuture || /未来|会不会|能不能|结果|发展/.test(q);
  const asksEmotion = p.isEmotion || /累|焦虑|难过|情绪|疲惫|压力/.test(q);
  const choice = detectChoiceOptions(q);

  let directAnswer = "";

  if (choice) {
    directAnswer = `就你问的「${trimQuestion(q)}」：牌面并未明确指向「${choice.a}」或「${choice.b}」的单一答案，更像在提示你先处理当下状态，再谈选择。`;
    const block = cardByPosition(cards, "阻碍", "隐藏因素");
    if (block) {
      directAnswer += block.orientation === "逆位"
        ? `当前卡点在${block.keywords[0]}，容易把选择想成非黑即白。`
        : `隐藏因素是${block.keywords[0]}，可能比城市本身更影响你的感受。`;
    } else if (now) {
      directAnswer += `从「${now.position}」的${now.name}看，${now.keywords[0]}才是眼下更该先看清的部分。`;
    }
  } else if (asksOtherFeeling) {
    const target = other || now;
    directAnswer = `就你问的「${trimQuestion(q)}」：牌看${p.subject || "对方"}目前${orientTone(target)}，不等于已经给明确答案，但心意并非完全冷淡。`;
    if (block) {
      directAnswer += block.orientation === "逆位"
        ? `主要卡点在${block.keywords[0]}，容易猜错或沟通错位。`
        : `隐藏因素是${block.keywords[0]}，你可能还没看到全貌。`;
    }
  } else if (asksShouldIDo) {
    const signal = advice || now;
    directAnswer = `就你问的「${trimQuestion(q)}」：牌面倾向${signal.orientation === "逆位" ? "先缓一缓" : "可以推进"}，关键看${signal.keywords[0]}是否被满足，别只靠情绪做决定。`;
    if (block) directAnswer += `当前阻力在${block.keywords[0]}。`;
  } else if (asksFuture) {
    directAnswer = `就你问的「${trimQuestion(q)}」：短期更像${now.keywords[0]}→${now.keywords[1] || "调整"}的节奏，不是立刻定局的牌。`;
    if (advice) directAnswer += `走向上，${advice.name}提示${advice.keywords[0]}。`;
  } else if (asksEmotion) {
    directAnswer = `就你问的「${trimQuestion(q)}」：你现在的消耗感是真实的；${now.name}${now.orientation}说明内在更需要${now.keywords[0]}，不是你不该有情绪。`;
  } else if (p.isCareer) {
    directAnswer = `就你问的「${trimQuestion(q)}」：工作上${orientTone(now)}，重点核对${p.coreNeed || "价值感与节奏"}是否被满足。`;
  } else {
    directAnswer = `就你问的「${trimQuestion(q)}」：${now.name}（${now.orientation}）指向${now.keywords[0]}，这是当下最需要先承认的信号。`;
  }

  const insight = advice
    ? `结合「${advice.position}」的${advice.name}，你更适合${advice.actionHint || advice.keywords[0]}。`
    : `牌在提醒你：${p.caution || "别用猜测代替沟通"}。`;

  const cardLines = cards.map((c) => {
    const point = linkCardToQuestion(c, p, asksOtherFeeling, asksShouldIDo);
    return `${c.position}｜${c.name}｜${point}`;
  });

  return {
    headline: pickHeadline(cards, p),
    directAnswer: directAnswer.slice(0, 220),
    insight: insight.slice(0, 55),
    cardLines,
    action: (advice?.actionHint || now?.actionHint || "先做一次不逼迫自己的表达。").slice(0, 20),
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
- 本题核心是「如何分辨/选择」：headline 与 briefSummary 要围绕选择与权衡，禁止写成「等待/评估期/还没结果/在等转机」这类等待框架。
- presentState 或 innerTension 中，分别用牌意说明两选项各自呼应什么（各半句即可），再点出真正卡点往往不在选项本身。
- 若牌面无法单边押注：写「也许尚未到必须二选一的时候」，但必须说明「现阶段更值得先核对什么」。
- 禁止只重复选项名称而不给牌面依据；禁止替用户拍板「选 A / 选 B」。`;
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
    asksOffer: isCareerQuestion(reading),
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

function pentaclesCardCount(cards) {
  return (cards || []).filter((c) => c.suitKey === "pentacles" || c.name.includes("星币")).length;
}

function userAnswerPlaybook(reading) {
  const p = reading.questionProfile || {};
  const sig = questionSignals(reading);
  const q = reading.question || "";
  const lines = [];

  lines.push(`【用户原话】「${q}」`);
  lines.push(`【接住 → 答问 → 贴牌】写作顺序：①先接住用户此刻感受（呼应【此刻心情】）②回应字面问题 ③用对应牌位牌意佐证。禁止只讲牌、禁止只安慰不答问。`);

  if (sig.asksFuture && !isCareerQuestion(reading)) {
    lines.push(`【未来与选择】必须写三牌因果故事（现状→阻碍→建议），解释每张牌对用户问题的含义；禁止 offer/评估窗/录用等职业套话，除非用户明确问工作。`);
    lines.push(`【权威读牌】引用花色领域（星币=现实/价值/交换，圣杯=情感，权杖=行动，宝剑=判断）+ 牌意核心，禁止只贴关键词。`);
  }

  if (isCareerQuestion(reading)) {
    lines.push(`【职业 / offer / 等消息】用户要的是「流程节奏 + 内心是否被结果绑太紧」，不是空泛鼓励。`);
    if (/等消息|等结果|没消息|面试/.test(q)) {
      lines.push(`【等消息】写清更像面试后评估窗；区分「对方流程节奏」与「自己对结果的执念」；不说具体日期、不保证录用。`);
    }
    if (sig.asksWhenWhere) {
      lines.push(`【时间】用流程阶段作答（如：尚在积累/窗口接近/需再观望 1–2 个周期），依据【现状】与【阻碍】牌，不说具体日期、不保证成败。`);
      lines.push(`【地点】若问题含城市或地域，在 innerTension 或【建议】牌解读里，分别写两选项各提醒核对什么（生活成本、团队氛围、归属感等），可用「略偏向…的质感，但仍需核实」`);
    } else {
      lines.push(`【节奏】写清当前更像投递期、评估期还是接近落地，用牌意支撑，区分「事实进展」与「内心焦虑」。`);
    }
  }

  if (sig.asksOtherFeeling) {
    lines.push(`【关系 / 对方心意】写清：倾向（有温度/偏淡/未说透）+ 不确定点；不替对方表白，不保证喜欢或不喜欢。`);
  }

  if (sig.asksShouldIDo) {
    lines.push(`【去留决策】给方向：继续推进 / 先缓一缓 / 先沟通再定；说明依据来自哪张牌，不说「一定要/一定不要」。`);
  }

  if (sig.asksFuture && !sig.asksOffer) {
    lines.push(`【未来走向】写清短期节奏（1–3 个月内更像什么能量），不说宿命结论。`);
  }

  if (sig.asksEmotion) {
    lines.push(`【情绪修复】先命名感受、告知感受合理，再给微小恢复动作；不要求立刻振作。`);
  } else {
    lines.push(`【情绪底层】即使用户问的是事（工作/感情/选择），也先在半句话里接住其焦虑或急切，再进入分析。`);
  }

  if (!sig.asksOffer && !sig.asksOtherFeeling && !sig.asksShouldIDo && !sig.asksEmotion) {
    lines.push(`【通用】抓住用户问题里的核心名词（人/事/选择），第一句就要碰到它，再用牌阵展开。`);
  }

  return lines.join("\n");
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

  // 默认：知识库合成（意象 + 元素 + 数字 + 牌位透镜 + 正逆），建议3/4 的主干
  return composePositionReading(card, p);
}

function questionFocusHint(reading) {
  const p = reading.questionProfile || {};
  const sig = questionSignals(reading);
  const positions = (reading.cards || []).map((c) => c.position).join("、");
  const lines = [
    userAnswerPlaybook(reading),
    moodResponseHint(reading),
    `【问题类型】${p.intent || "自我确认"}；用户真正关心：${p.subject || "自己"}；此刻最需要：${p.coreNeed || "被看见"}。`
  ];

  if (sig.choice) {
    lines.push(choiceHint(reading.question));
  }

  if (positions) {
    lines.push(`【牌位顺序】${positions}。reminders 共 ${Math.min(reading.cards.length, 3)} 条，严格按此顺序，每条对应一张牌，句式不可雷同。`);
  }

  lines.push(`【模块绑牌 · 必守 · 去重复 · 如实】
各模块分工不同，禁止把同一段话换个标题重复粘贴：
- briefSummary：全篇唯一浓缩（45-80字）。结构：半句接住 + 半句直接结论（可含挑战/中性，禁止空泛「会好的/在路上」）+ 可选半句温柔收尾。
- presentState：感受 + 一句结论（≤55字），不写牌名；结论须与牌阵基调一致（有挑战牌时不得只报喜）。
- innerTheme：三牌因果链一句（≤56字），把现状→阻碍→建议串成同一主线、并让建议回扣现状那股劲，可含阻力词，不重复 briefSummary。
- reminders：2-3 条便签（每条≤18字），用关键词；挑战牌可写「阻滞/消耗/延迟」类词。
- positionReadings：唯一详细解牌处（50-68字）；挑战牌写清卡点，支持牌写清助力；结构「如实 + 温柔」。
- innerTension：心理拉扯（≤48字），可承认担心合理，不复述牌面。
- closingLine：短收束（≤32字）；可温暖，但不得否定前文已点出的挑战。
- 口语化：像深夜语音，少用「暗示/迹象/投入度/疏离」等报告腔。`);
  lines.push(spreadHonestyHint(reading));
  lines.push(spreadSynthesisHint(reading));
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
    advice?.keywords?.[0],
    now?.keywords?.[0],
    block?.keywords?.[0]
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

function groundPresentState(reading) {
  const sig = questionSignals(reading);
  const embrace = (moodEmbraceLines[reading.mood] || "我懂你在意。").replace(/。$/, "");
  const now = cardByPosition(reading.cards, "现状", "今日指引", "我") || reading.cards?.[0];
  const k0 = now?.keywords?.[0];
  const valence = cardValence(now);

  if (sig.asksOtherFeeling) {
    if (valence === "challenge") {
      return `${embrace}。就ta的心意，牌看偏淡${k0 ? `，${k0}是信号` : ""}，别靠猜。`;
    }
    if (valence === "support") {
      return `${embrace}。牌看有温度${k0 ? `（${k0}）` : ""}，但还没到定论。`;
    }
    return `${embrace}。心意还在辨认期，先看清互动再下结论。`;
  }
  if (sig.choice) {
    const { a, b } = sig.choice;
    return `${embrace}。你要在「${a}」与「${b}」之间分辨——牌说卡点往往不在选项本身，而是你还不敢为选择负责。`;
  }
  if (sig.asksOffer && sig.asksWhenWhere) {
    if (valence === "challenge") {
      return `${embrace}。offer 何时何地仍不明，${k0 || "流程"}上有阻滞要先核实。`;
    }
    return `${embrace}。时间地点还在评估窗，先把事实和担心分开。`;
  }
  if (sig.asksOffer) {
    if (valence === "challenge") {
      return `${embrace}。工作上${k0 || "仍有卡点"}，别在焦虑里催结果。`;
    }
    return `${embrace}。仍在观望/评估期，分清事实和担心。`;
  }
  if (sig.asksFuture && !isCareerQuestion(reading)) {
    if (valence === "challenge") {
      return `${embrace}。牌先看${k0 || "现实卡点"}，别在「值不值」里反复耗。`;
    }
    return `${embrace}。未来还在展开，先把标准与需要分开想。`;
  }
  return `${embrace}。牌在帮你看清局面，不必今天就想通。`;
}

/** 取一张牌「此刻最贴切的那个面」：正位取光明面、逆位取阴影面的首词 */
function cardFacetWord(card) {
  if (!card) return "";
  const rev = card.orientation === "逆位";
  const words = rev ? card.reversed || [] : card.upright || [];
  return words[0] || card.keywords?.[0] || "";
}

function groundInnerTheme(reading) {
  const cards = reading.cards || [];
  if (cards.length === 1) {
    const c = cards[0];
    const word = cardFacetWord(c) || c.keywords?.[0] || "此刻";
    return clampSentenceClean(
      `这张「${c.name}」像镜子照见你此刻的「${word}」——别只盯着表层问题，真正要看清的是它在提醒你把什么收成一个行动。`,
      72
    );
  }
  if (cards.length < 2) return "牌在帮你辨认当下真正要紧的那一件事。";
  const now = cardByPosition(cards, "现状", "今日指引", "我") || cards[0];
  const block = cardByPosition(cards, "阻碍", "隐藏因素") || cards[1];
  const advice = cardByPosition(cards, "建议", "下一步") || cards.at(-1);
  const nk = cardFacetWord(now) || "起点";
  const bk = cardFacetWord(block) || "阻力";

  // 三张串成一条因果链，并让「建议」回扣到「现状」那股劲——同一主线闭环
  if (pentaclesCardCount(cards) >= 2) {
    return clampSentenceClean(
      `从${now.name}的「${nk}」起，被${block.name}的「${bk}」拖住，到${advice?.name || "建议"}其实绕回同一件事：先把滋养放回自己身上。`,
      72
    );
  }

  return clampSentenceClean(
    `从${now.name}的「${nk}」出发，卡在${block.name}的「${bk}」上，而真正的出口，是回到开头这股劲，在${advice?.name || "建议"}里把它收成一个动作。`,
    72
  );
}

function groundInnerTension(reading) {
  const sig = questionSignals(reading);
  if (sig.asksOtherFeeling) {
    return "你想靠近确认，又怕主动会打破平衡——这很正常。";
  }
  if (sig.choice) {
    return "既怕选错了浪费机会，又怕不选就一直耗在原地——这很正常。";
  }
  if (sig.asksOffer) {
    return "你想快点有结果，又怕选错——这份慎重挺珍贵。";
  }
  if (sig.asksFuture && !isCareerQuestion(reading)) {
    return "你想尽快看清方向，又怕一旦选错就回不了头——这很正常。";
  }
  return "你想看清答案，又怕一旦投入就难以回头——这很正常。";
}

function groundClosingLine(reading) {
  const sig = questionSignals(reading);
  const advice = cardByPosition(reading.cards, "建议", "下一步", "今日指引") || reading.cards?.[0];
  const lead = advice ? cardFacetWord(advice) : "";
  if (sig.choice) {
    return "把现实条件摆清楚，答案会比你以为的更早浮现。";
  }
  if (sig.asksOffer) {
    return "先核对硬条件，再谈时机——别让等待替你做决定。";
  }
  if (sig.asksOtherFeeling) {
    return "用一次真实互动确认，比反复猜更靠近答案。";
  }
  if (lead) {
    return `朝「${lead}」迈出具体一步，方向会随行动清楚起来。`;
  }
  return "把方向落成一个动作，比反复想更快带你靠近答案。";
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

function dedupePresentState(presentState, briefSummary) {
  if (!presentState) return "";
  if (!briefSummary || !isSimilarCopy(presentState, briefSummary)) return presentState;
  const parts = String(presentState)
    .split(/[。！？]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const briefParts = String(briefSummary)
    .split(/[。！？]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const unique = parts.filter((part) => !briefParts.some((base) => isSimilarCopy(part, base)));
  if (!unique.length) return "";
  return unique.map((part) => (part.endsWith("。") ? part : `${part}。`)).join("");
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
    const word = cardFacetWord(c) || c.keywords?.[0] || c.name;
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
  const nowWord = now ? (cardFacetWord(now) || now.keywords?.[0] || now.name) : "";
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
  const choice = detectChoiceOptions(reading.question);
  const cardsText = (reading.cards || []).map((card) => formatCardForPrompt(card, p)).join("\n\n");

  const jsonNote = strictJson
    ? "\n【重要】上次输出不是合法 JSON。本次只输出一个 JSON 对象，不要 Markdown，不要解释，字符串内不要用换行。"
    : "";

  return {
    system: `你是「星月少女塔罗馆」的 AI 塔罗牌师。你的任务是：【贴牌如实解读 + 直接回应问题 + 温柔承接情绪】，让用户既感到被理解，也感到你在认真读牌。

══════════════════
一、牌师人格 · 星月
══════════════════
1. 【如实 → 答问 → 接住】先根据牌阵给出客观判断（支持/挑战/中性均可），再回应用户字面问题，最后用半句温柔话承接。禁止只安慰不答问，也禁止只报喜不报忧。
2. 【关系语气】稳定、不评判；像并肩坐着的牌师。全文「你」对话；「我」全篇 ≤2 次。
3. 【牌面驱动】每模块引用具体牌名；正/逆位必须与输入一致。挑战牌必须点出卡点（延迟/冲突/消耗/结构问题/心意偏淡等），再用一句话承接情绪；禁止把挑战牌一律写成「耐心就好/在路上/别慌」。
4. 【合参牌阵】按 现状→阻碍→建议 因果链；依据输入的关键词与基调，禁止套话。
5. 【去重复】详细牌意只在 positionReadings；briefSummary 是全篇浓缩。
6. 【口语化】短句好读；少用「暗示/迹象/投入度/疏离」等报告腔。
7. 【给明确指引·不打太极】每盘必须给出：①一个清晰倾向（更偏向继续/暂缓/先沟通/某条路，并点明依据哪张牌），②一个本周就能做、具体到对象与步骤的动作。禁止用「顺其自然/慢慢来/早点休息明天再想/用一件小事找到节奏/先照顾好自己/答案会自己浮现」这类话充当主要指引——它们至多作为结尾半句的软着陆，绝不能替代方向与行动。
8. 【镜子 + 重新框定·塔罗的真正作用】牌不是预测命运，而是一面镜子：先用牌面意象照见用户此刻压抑的真实感受，让ta觉得「这就是我现在的状态」「连牌都好像懂我」（被看见感）；再借牌的符号结构帮ta把问题【重新框定】——常要把表层问题（要不要逃离/裸辞/二选一）拉到更深一层「我真正的课题是什么、可以怎么成长」。
9. 【元素符号做觉察】元素的心理含义：火=行动/热情，水=情感/关系，风=思想/沟通/语言，土=现实/价值/身体。善用「元素 vs 意象」的张力点醒用户——例：宝剑(风=思想/言语)刺穿红心(情感)，可框定为「你把外部的批评等同于对自我的否定，真正的课题是把『事』和『我』分开」。这种觉察比一句安慰有用得多。

══════════════════
二、专业边界
══════════════════
- 禁止：塔罗告诉你、命中注定、一定会/不会、具体日期承诺、医疗法律投资承诺、替用户拍板二选一。
- 允许：如实指出阻滞、消耗、冷淡、延迟、冲突、不确定——这是专业读牌，不是恐吓。
- 二选一：比较两选项各自呼应什么；说不清时说明「现阶段更该核对什么」。

══════════════════
三、各字段写法
══════════════════
headline（8-12字）：点题，可含挑战词（如「先看清阻滞」），禁止空泛「一切都会好」。

briefSummary（45-80字）：先一句「被看见」（点出ta压抑的真实感受，镜子感）+ 直接结论（可含挑战）+ 可选温柔半句。
  ✓「我懂你想听准信。牌看ta偏淡、互动也少，别急着否定自己，但别靠猜补画面。」
  ✗「offer在路上，别慌，好事多磨。」（无牌意依据的空安慰）

presentState（≤55字）：感受 + 结论；有挑战牌时结论不得相反。

innerTheme（≤56字）：这里是【重新框定/觉察】，不是复述牌面——把表层问题（要不要逃/选哪个）提炼成更深的真正课题或视角转换（例「痛的不是这份工作，而是你把批评等同于否定自己」），可借元素符号点醒，并隐含三牌主线。

reminders（0-3 条，≤18字）：关键词便签；挑战牌可写「阻滞/消耗/延迟」。

innerTension（≤48字）：心理两难，正常化一句。

reflectionQuestions（2 个，≤32字）：口语、好答。

gentleActions（2 条，≤36字）：必须具体、本周可执行、扣住建议牌。第 1 条＝建议牌指向的具体动作（具体到对象/步骤，如「把你的三个成果写成一页发给主管」）；第 2 条＝次要支持步骤。禁止「早点休息/明天再想/慢慢来/顺其自然/照顾好自己」当作行动。

closingLine（≤32字）：带方向的收束，点出该朝哪儿用力；可温暖，但不得是「照顾好自己就好/慢慢来/答案会自己浮现」式空话，也不得推翻前文挑战判断。

positionReadings（每张 50-68 字）：牌位+牌名+正/逆位 → 扣题；结构「如实一句 + 温柔一句」。

══════════════════
四、问题类型速查
══════════════════
- 未来 / 选择：写清路径、标准与需要之间的冲突；禁止 offer/评估窗/录用套话（除非用户明确问工作）。
- offer / 职业：可说流程卡住/评估期/回报不明；问时间用阶段，不给具体日期。
- 关系 / 对方：可说偏淡/未定型/沟通错位；不替对方表白。
- 去留：继续/暂缓/先沟通，不说绝对答案。
- 情绪：先承认感受合理，再给微小恢复动作。

【输出】仅一个合法 JSON 对象，不要 Markdown，不要解释：${jsonNote}
{
  "headline": "8-12字点题",
  "briefSummary": "45-80字如实浓缩",
  "presentState": "≤55字，感受+结论",
  "innerTheme": "≤56字重新框定/觉察(把表层问题拉到真正课题)",
  "reminders": ["0-3条便签"],
  "innerTension": "≤48字心理拉扯",
  "reflectionQuestions": ["恰好2个"],
  "gentleActions": ["恰好2条"],
  "closingLine": "≤32字短收束",
  "positionReadings": [{"position":"牌位","cardName":"牌名","text":"50-68字"}]
}`,
    user: `${questionFocusHint(reading)}

【用户问题】${reading.question}
${choice ? choiceHint(reading.question) : ""}
【用户此刻最需要】${p.coreNeed || "被看见、被理解"}

【主题】${reading.themeLabel}
【此刻心情】${moodLabels[reading.mood] || reading.mood} — ${moodEmbraceLines[reading.mood] || "请温柔接住用户此刻的感受"}

【牌阵】${reading.spread}
【本次牌面 · 正逆位以输入为准】
${cardsText}`
  };
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
    temperature: strictJson ? 0.38 : 0.48,
    max_tokens: 2200
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
function groundGentleActions(actions, reading, fallback) {
  let list = dropPlatitudes(actions).map((s) => clampActionClean(s, 40)).filter(Boolean);
  const advice = cardByPosition(reading.cards, "建议", "下一步", "今日指引") || reading.cards?.[0];
  if (advice?.actionHint && !list.some((it) => isSimilarCopy(it, advice.actionHint))) {
    list.unshift(clampActionClean(advice.actionHint, 40));
  }
  for (const f of fallback?.gentleActions || []) {
    if (list.length >= 2) break;
    if (!list.some((it) => isSimilarCopy(it, f))) list.push(f);
  }
  return list.slice(0, 2);
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

function questionAnchors(reading) {
  const q = String(reading.question || "");
  const sig = questionSignals(reading);
  const anchors = [];
  if (sig.asksOffer) anchors.push("offer", "机会", "工作", "面试", "岗位", "录用");
  if (sig.asksWhenWhere) anchors.push("时间", "什么时候", "哪里", "地方", "城市", "深圳", "上海");
  if (sig.asksOtherFeeling) anchors.push("对方", "他", "她", "喜欢", "态度", "心意");
  if (sig.asksShouldIDo) anchors.push("该不该", "要不要", "继续", "放弃", "离开");
  if (sig.asksEmotion) anchors.push("情绪", "焦虑", "累", "压力", "难过");
  if (sig.choice) anchors.push(sig.choice.a, sig.choice.b);
  const hits = anchors.filter((w) => w && q.includes(w));
  if (hits.length) return hits;
  return [trimQuestion(q).slice(0, 8)].filter((w) => w.length >= 2);
}

function addressesUserQuestion(text, reading) {
  const body = String(text || "");
  const sig = questionSignals(reading);
  const anchors = questionAnchors(reading);
  if (anchors.some((w) => body.includes(w))) return true;
  if (sig.asksWhenWhere && /阶段|窗口|观望|落地|节奏|何时|何地|地点|城市|深圳|上海|周期/.test(body)) return true;
  if (sig.asksOffer && /机会|岗位|面试|录用|入职|流程|投递/.test(body)) return true;
  if (sig.asksOtherFeeling && /对方|心意|态度|互动|靠近|冷淡/.test(body)) return true;
  if (sig.asksShouldIDo && /继续|暂缓|沟通|推进|放下|离开/.test(body)) return true;
  return body.length >= 36;
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

function polishPositionReadings(items, reading, fallback) {
  const cards = reading.cards || [];
  return cards.map((card, index) => {
    const item = items[index] || {};
    let body = normalizePositionBody(item.text, card, reading);
    let text = clampSentenceClean(`${card.position}·${cardLabel(card)}：${body}`, POSITION_READING_MAX);
    if (isWeakLine(text) || text.length < 28) {
      text = buildPositionReading(card, reading);
    }
    return {
      position: card.position,
      cardName: card.name,
      text: text || fallback.positionReadings[index]?.text
    };
  });
}

function colloquializeCopy(text) {
  return String(text || "")
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
  if (!isCareerQuestion(reading) && /offer|评估窗|录用|试用期|投递|offer 侧/.test(body)) return true;
  if (/仍在评估\/等待窗|是当前主要阻力|宜慢，别在焦虑里催结果/.test(body)) return true;
  return false;
}

function stripCareerLeakage(text, reading) {
  const body = String(text || "");
  if (!body || isCareerQuestion(reading)) return body;
  if (/offer|评估窗|录用|试用期|投递|团队与节奏/.test(body)) return "";
  return body;
}

function isCareerTemplateLeak(text, reading) {
  if (isCareerQuestion(reading)) return false;
  return /offer|评估窗|试用期|团队与节奏|快点有结果，又怕选错|offer 走向/.test(String(text || ""));
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
  const sig = questionSignals(reading);
  const embrace = (moodEmbraceLines[reading.mood] || "我懂你在意。").replace(/。$/, "");
  const block = cardByPosition(reading.cards, "阻碍", "隐藏因素");
  const now = cardByPosition(reading.cards, "现状", "今日指引", "我") || reading.cards?.[0];
  const bk = block?.keywords?.[0];
  const challengeCount = (reading.cards || []).filter((c) => cardValence(c) === "challenge").length;

  if (sig.asksOtherFeeling) {
    if (cardValence(now) === "challenge") {
      return clampAtSentence(`${embrace}。牌看ta偏淡${bk ? `，${bk}是主要拉扯` : ""}，别靠猜。`, 80);
    }
    return clampAtSentence(`${embrace}。牌看有互动空间，但还没到定论。`, 80);
  }
  if (sig.choice) {
    const { a, b } = sig.choice;
    return clampAtSentence(
      `${embrace}。你要在「${a}」与「${b}」之间分辨——牌说卡点往往不在选项本身，而是你还不敢为选择负责。`,
      80
    );
  }
  if (sig.asksOffer) {
    const blockDevil = block?.name.includes("恶魔");
    if (blockDevil && block.orientation === "逆位") {
      return clampAtSentence(
        `${embrace}。仍在等消息，但对结果的执念在松动；先回到什么对你真正值得。`,
        80
      );
    }
    if (challengeCount >= 2) {
      return clampAtSentence(`${embrace}。offer 阻滞偏多${bk ? `，${bk}要先处理` : ""}。`, 80);
    }
    if (cardValence(block) === "challenge" && bk) {
      return clampAtSentence(`${embrace}。offer 还在评估，${bk}是当前主要卡点。`, 80);
    }
    if (cardValence(now) === "challenge") {
      return clampAtSentence(`${embrace}。仍在评估窗，${now?.keywords?.[0] || "先核实流程"}。`, 80);
    }
    return clampAtSentence(`${embrace}。offer 还在评估期，分清事实和担心。`, 80);
  }
  if (sig.asksFuture && !isCareerQuestion(reading)) {
    const nowK = now?.keywords?.[0];
    const blockK = block?.keywords?.[0];
    if (pentaclesCardCount(reading.cards) >= 2) {
      return clampAtSentence(
        `${embrace}。牌先看${nowK || "施与受"}是否公平，${block?.name || "阻碍"}再问标准是否太硬。`,
        80
      );
    }
    if (challengeCount >= 2) {
      return clampAtSentence(`${embrace}。挑战牌偏多，先处理${nowK || bk || "主要卡点"}。`, 80);
    }
    return clampAtSentence(`${embrace}。方向还在辨认期，${blockK ? `${blockK}是需要先看清的部分` : "先把标准与需要分开"}。`, 80);
  }
  if (challengeCount >= 2) {
    return clampAtSentence(`${embrace}。牌阵挑战偏多，先处理${bk || now?.keywords?.[0] || "卡点"}。`, 80);
  }
  return clampAtSentence(`${embrace}。牌在帮你看清局面，不必今天就想通。`, 80);
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

export function normalizeAiResult(parsed, reading) {
  const fallback = buildGentleFallback(reading);
  let positionReadings = normalizePositionReadings(parsed, reading, fallback);
  positionReadings = polishPositionReadings(positionReadings, reading, fallback);
  positionReadings = positionReadings.map((item) => ({
    ...item,
    text: clampSentenceClean(colloquializeCopy(item.text), POSITION_READING_MAX)
  }));

  let briefSummary = buildBriefSummary(reading, parsed);
  if (soundsOverlyPositive(briefSummary) && (reading.cards || []).some((c) => cardValence(c) === "challenge")) {
    briefSummary = buildBriefSummaryFromCards(reading);
  }
  let presentState = compactPresentState(
    reading,
    sanitizeCopy(parsed.presentState || parsed.opening),
    briefSummary
  ) || fallback.presentState;

  if (isWeakLine(presentState) || !holdsEmotion(presentState, reading) || !addressesUserQuestion(presentState, reading)) {
    presentState = compactPresentState(reading, groundPresentState(reading), briefSummary);
  }
  presentState = dedupePresentState(presentState, briefSummary);

  let innerTheme = clampSentenceClean(colloquializeCopy(parsed.innerTheme), 72) || fallback.innerTheme;
  if (isWeakLine(innerTheme) || isMechanicalTheme(innerTheme) || isSimilarCopy(innerTheme, briefSummary)) {
    innerTheme = groundInnerTheme(reading);
  }

  let reminders = filterReminders(
    normalizeStringList(parsed.reminders, 3, 20),
    positionReadings,
    briefSummary
  );

  let innerTension = clampAtSentence(colloquializeCopy(parsed.innerTension || parsed.synthesis), 50)
    || fallback.innerTension;
  if (isCareerTemplateLeak(innerTension, reading)) {
    innerTension = groundInnerTension(reading);
  }
  const blockCard = cardByPosition(reading.cards, "阻碍", "隐藏因素");
  const nowCard = cardByPosition(reading.cards, "现状", "今日指引", "我");
  if (
    isWeakLine(innerTension)
    || isSimilarCopy(innerTension, briefSummary)
    || !nowCard
    || !blockCard
    || isSimilarCopy(innerTension, positionReadings.map((item) => item.text).join(""))
  ) {
    innerTension = groundInnerTension(reading);
  }

  const reflectionQuestionsRaw =
    normalizeStringList(parsed.reflectionQuestions, 2, 34, 2) || fallback.reflectionQuestions;
  let reflectionQuestions = reflectionQuestionsRaw;
  if (!isCareerQuestion(reading) && reflectionQuestions.some((q) => isCareerTemplateLeak(q, reading))) {
    reflectionQuestions = fallback.reflectionQuestions;
  }

  let gentleActions = normalizeStringList(parsed.gentleActions, 2, 48)
    || normalizeStringList(parsed.action ? [parsed.action] : null, 2, 48)
    || fallback.gentleActions;
  gentleActions = gentleActions.filter((item) => stripCareerLeakage(item, reading));
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
    briefSummary,
    presentState,
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
    directAnswer: briefSummary,
    insight: innerTheme,
    cardLines: positionReadings.map((item) => `${item.position}｜${item.cardName}｜${item.text.slice(0, 24)}`),
    action: gentleActions[0],
    star: closingLine
  };
}

/** 本地回退：温柔小屏结构化总结（扣题、按牌位） */
export function buildGentleFallback(reading) {
  const p = reading.questionProfile || {};
  const cards = reading.cards || [];
  const base = answerUserQuestion(reading);
  const sig = questionSignals(reading);
  const moodLine = moodLabels[reading.mood] || "有些不确定";

  const reminders = cards.slice(0, 3).map((card) => clampText(card.keywords?.[0] || card.name, 18));
  const positionReadings = cards.map((card) => ({
    position: card.position,
    cardName: card.name,
    text: buildPositionReading(card, reading)
  }));

  let innerTension = "一方面你想尽快看清答案，另一方面你又怕选错——这样想很正常，不必责怪自己。";
  if (sig.asksOffer) {
    innerTension = "一方面你想尽快知道 offer 走向，另一方面你又怕在焦虑里做错选择——这份慎重说明你在认真对待自己。";
  } else if (sig.asksOtherFeeling) {
    innerTension = "一方面你想靠近确认，另一方面你又怕主动打破平衡——在意本身就是在乎。";
  }

  let reflectionQuestions = [
    "如果不必今天做决定，你希望自己被怎样对待？",
    "你现在犹豫的，更多是现实本身，还是对未来的担心？"
  ];
  if (sig.asksFuture && !isCareerQuestion(reading)) {
    reflectionQuestions = [
      "给予与回报里，哪一边让你觉得不公平？",
      "如果把「稳健」放一放，你最想朝哪个方向试探？"
    ];
  } else if (sig.asksOffer) {
    if (/等消息|等结果|面试|没消息/.test(reading.question || "")) {
      reflectionQuestions = [
        "这份工作最吸引你的是什么？",
        "如果暂时没消息，你还能做些什么让自己安心？"
      ];
    } else {
      reflectionQuestions = [
        "offer 里哪些条件已书面确认，哪些还只是你的担心？",
        "如果暂缓一周，你最想先照顾好自己哪一部分？"
      ];
    }
  }
  if (sig.choice) {
    reflectionQuestions = [
      `哪座城市更像${cards.find((c) => c.suitKey === "cups")?.name || "圣杯"}所说的安心感？`,
      "如果先不问时间，你更想先弄清哪座城的现实条件？"
    ].map((item) => item.slice(0, 38));
  }

  const adviceCard = cardByPosition(cards, "建议", "下一步") || cards.at(-1);
  let secondAction;
  if (isCareerQuestion(reading)) {
    secondAction = "把你的具体成果列成一页，对照岗位再决定去留";
  } else if (sig.choice) {
    secondAction = "给两个选项各写三条真实利弊，圈出最不能让的一条";
  } else if (pentaclesCardCount(cards) >= 2) {
    secondAction = "列一张给予/索取清单，看天平偏向哪边";
  } else if (sig.asksOffer) {
    secondAction = "把已书面确认的条件和你的担心分两栏列出";
  } else if (sig.asksOtherFeeling) {
    secondAction = "找一次真实互动去验证，而不是反复猜对方的心思";
  } else if (sig.asksFuture) {
    secondAction = "写下两个方向各自满足你什么、又要你牺牲什么";
  } else {
    secondAction = "把你最在意的那一点，落成本周一个具体动作";
  }
  // 以「建议牌自带的具体行动」领衔，而非泛泛的自我安慰
  const leadAction = adviceCard?.actionHint ? clampText(adviceCard.actionHint, 40) : secondAction;
  let gentleActions = [leadAction, secondAction];
  if (gentleActions[0] === gentleActions[1]) {
    gentleActions[1] = "把你最在意的那一点，落成本周一个具体动作";
  }

  return {
    headline: groundHeadline(reading) || (sig.asksOffer ? "给答案一点生长时间" : base.headline),
    briefSummary: buildBriefSummary(reading, null),
    presentState: compactPresentState(reading, groundPresentState(reading), buildBriefSummary(reading, null)),
    innerTheme: groundInnerTheme(reading),
    reminders: reminders.length ? reminders : [],
    innerTension: groundInnerTension(reading),
    reflectionQuestions: reflectionQuestions.map((item) => item.slice(0, 38)),
    gentleActions,
    closingLine: groundClosingLine(reading),
    positionReadings,
    directAnswer: buildBriefSummary(reading, null),
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

  const sections = [];
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
    aiCompact: ai,
    sections: sections.filter((section) => section.text || section.list?.length)
  };
}
