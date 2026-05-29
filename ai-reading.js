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

function orientTone(card) {
  if (!card) return "";
  return card.orientation === "逆位"
    ? `偏${card.keywords[0]}，但表达不稳定或未说透`
    : `有${card.keywords[0]}、${card.keywords[1] || card.keywords[0]}的倾向`;
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
  if (!/(还是|或在|或是|或者)/.test(text)) return null;
  const parts = text.split(/还是|或在|或是|或者/);
  if (parts.length < 2) return null;
  const b = parts[parts.length - 1].trim().slice(0, 12);
  const left = parts[parts.length - 2];
  const aMatch = left.match(/([\u4e00-\u9fa5A-Za-z·]{2,12})$/);
  const a = (aMatch?.[1] || left).trim().slice(-12);
  if (!a || !b) return null;
  return { a, b };
}

function choiceHint(question) {
  const choice = detectChoiceOptions(question);
  if (!choice) return "";
  return `【二选一 · 必写】用户要在「${choice.a}」与「${choice.b}」之间分辨。
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
    asksOffer: /offer|录用|入职|跳槽|离职/i.test(q),
    asksWhenWhere: /什么时候|何时|多久|几月|几周|时间|哪里|什么地方|在哪|哪座|城市/.test(q),
    asksOtherFeeling: p.isRelationship && /他|她|对方|ta/i.test(q) && /感觉|喜欢|爱|态度|怎么想|在意/.test(q),
    asksShouldIDo: p.isDecision || /该不该|要不要|是否|继续|放弃|离开|主动/.test(q),
    asksFuture: p.isFuture || /未来|会不会|能不能|结果|发展/.test(q),
    asksEmotion: p.isEmotion || /累|焦虑|难过|情绪|疲惫|压力/.test(q),
    choice: detectChoiceOptions(q)
  };
}

function userAnswerPlaybook(reading) {
  const p = reading.questionProfile || {};
  const sig = questionSignals(reading);
  const q = reading.question || "";
  const lines = [];

  lines.push(`【用户原话】「${q}」`);
  lines.push(`【接住 → 答问 → 贴牌】写作顺序：①先接住用户此刻感受（呼应【此刻心情】）②回应字面问题 ③用对应牌位牌意佐证。禁止只讲牌、禁止只安慰不答问。`);

  if (sig.asksOffer || (p.isCareer && /工作|职业|面试|岗位/.test(q))) {
    lines.push(`【职业 / offer】用户要的是「机会节奏 + 落地感」，不是空泛鼓励。`);
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

  if (name.includes("圣杯八")) {
    return rev
      ? `也许你想离开旧状态却还没迈出去，${name}逆位让「何时何地」暂时卡住`
      : `也许你已经准备转向新阶段，${name}正位提示离开的节奏正在启动`;
  }
  if (name.includes("星币十")) {
    return rev
      ? `也许长期稳定（城市、户口、家庭期待）还在晃动，${name}逆位拖慢了落地感`
      : `也许现实保障正在对齐，${name}正位指向可落地的稳定结构`;
  }
  if (name.includes("圣杯六")) {
    return rev
      ? `也许怀旧与旧安全感在拉扯你，${name}逆位提醒别只凭记忆选城`
      : `也许答案在「哪里更让你安心」，${name}正位邀请先修复归属感`;
  }
  if (name.includes("星币七")) {
    return rev
      ? `也许评估期被拉长，${name}逆位提示别在焦虑里催结果`
      : `也许仍在等收成，${name}正位与${k[0] || "评估"}有关`;
  }
  if (name.includes("宝剑九")) {
    return `也许夜间担心放大了不确定，${name}邀请你先区分事实与想象`;
  }

  if (sig.choice && (q.includes("深圳") || q.includes("上海"))) {
    if (card.position === "阻碍" && card.suitKey === "pentacles") {
      return rev
        ? `也许两城比较时，现实门槛（生活成本、稳定感）被放大，${name}逆位是卡点`
        : `也许${name}在提醒你核对哪边更能给你长期稳定`;
    }
    if (card.position === "建议" && card.suitKey === "cups") {
      return `也许先问哪座城市更让你安心，${name}比急着定时间更重要`;
    }
  }

  if (card.position === "现状") {
    if (sig.asksOffer || (p.isCareer && /offer|工作|职业/.test(reading.question || ""))) {
      return rev
        ? `也许你对新机会还在观望，${name}提示先盘点已投入与真正想要的回报`
        : `可能正处在「等收成、做评估」的阶段，${name}与${k[0] || "现实"}有关`;
    }
    if (sig.asksOtherFeeling) {
      return rev
        ? `也许关系里仍有${k[0] || "波动"}，${name}提示别只靠猜测读对方`
        : `可能对方心意有${k[0] || "温度"}，但还需要时间看清`;
    }
    return `也许当下核心是${k[0] || "看清自己"}，${name}在描述你此刻站的位置`;
  }

  if (card.position === "阻碍") {
    if (sig.asksOffer) {
      return rev
        ? `也许卡点不在「有没有机会」，而是对新起点还缺一点踏实感`
        : `可能新机会已在眼前，真正挡住你的是敢不敢接下这份「新土」`;
    }
    return rev
      ? `也许阻力来自${k[0] || "犹豫"}未说透，${name}在提醒你放慢`
      : `可能${k[0] || "现实因素"}正是眼下需要先面对的部分`;
  }

  if (card.position === "建议") {
    if (sig.asksEmotion || name.includes("宝剑九")) {
      return `也许先把脑内最坏设想放轻，${name}邀请你区分事实与担心`;
    }
    if (sig.asksOffer || p.isCareer) {
      return `也许不必今天拍板，先让${k[0] || "判断"}在清醒时完成`;
    }
    return `也许可以试着朝${k[0] || "更清楚"}迈一小步，${name}支持温柔推进`;
  }

  if (card.position === "今日指引") {
    return `也许今天只需守住${k[0] || "节奏"}，${name}在陪你回到当下`;
  }

  if (card.position === "对方或外界") {
    return `也许外界环境有${k[0] || "变量"}，${name}提示你把目光放在真实互动上`;
  }

  if (card.position === "隐藏因素") {
    return `也许还有${k[0] || "未说清"}在影响你，${name}提醒你看见全貌`;
  }

  if (card.position === "下一步") {
    return `也许下一步不必很大，${name}与${k[0] || "小步"}有关`;
  }

  return `也许${name}在提醒你留意${k[0] || "感受"}与${k[1] || "节奏"}`;
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

  lines.push(`【模块绑牌 · 必守】
- presentState：句1 接住【此刻心情】；句2 回应用户字面问题；句3 【现状】牌名+正/逆位佐证（共 90-120 字）。
- innerTheme：一句故事线 + 一句温和希望（不是结果承诺）；禁止关键词拼接。
- innerTension：命名两难并正常化（「这样想很正常」），交叉【现状】与【阻碍】；逆位写成「还没找到出口的能量」。
- gentleActions：1-2 条本周小步，至少 1 条是自我关怀（休息/写下/找人聊），至少 1 条扣【建议】牌。
- closingLine：看见用户（半句）+ 牌阵收束（半句）+ 陪伴感（半句）；回扣用户问题的一个词。`);
  lines.push(spreadSynthesisHint(reading));
  return lines.join("\n");
}

function buildPositionReading(card, reading) {
  const bridge = interpretCardLine(card, reading);
  return clampAtSentence(`${card.position}·${cardLabel(card)}：${bridge}`, 85);
}

function groundPresentState(reading) {
  const now = cardByPosition(reading.cards, "现状", "今日指引", "我") || reading.cards?.[0];
  if (!now) return moodEmbraceLine(reading.mood);
  const sig = questionSignals(reading);
  const embrace = moodEmbraceLine(reading.mood);
  let answer = "";
  if (sig.asksOffer && sig.asksWhenWhere) {
    answer = "就 offer 何时何地，牌看更像还在辨认方向，尚未到最后定局。";
  } else if (sig.asksOffer) {
    answer = "就 offer 走向，牌看当前仍在评估与等待之间。";
  } else if (sig.choice) {
    answer = `就「${sig.choice.a}」与「${sig.choice.b}」，牌面暂未给出单边答案。`;
  } else {
    answer = `就「${trimQuestion(reading.question)}」，牌在陪你慢慢看清。`;
  }
  const core = clampAtSentence(interpretCardLine(now, reading), 50);
  return clampAtSentence(
    `${embrace}${answer}【现状】${cardLabel(now)}：${core}`,
    120
  );
}

function groundInnerTheme(reading) {
  const cards = reading.cards || [];
  if (cards.length < 2) return "牌面在陪你辨认当下真正重要的那一件事，光还没有熄灭。";
  const [a, b, c] = cards;
  const block = b?.position === "阻碍" ? b : b;
  const advice = c || cards.at(-1);
  return clampAtSentence(
    `从${a.name}到${block.name}确有拉扯，但${advice.name}仍在指向一条更忠于内心的路`,
    60
  );
}

function groundInnerTension(reading) {
  const now = cardByPosition(reading.cards, "现状", "今日指引", "我");
  const block = cardByPosition(reading.cards, "阻碍", "隐藏因素");
  if (!now || !block) {
    return "一方面你想尽快看清答案，另一方面你又怕选错——这样想很正常，不必责怪自己。";
  }
  const normalize = "这样想并不说明你软弱，只是你在认真对待自己的人生。";
  return clampAtSentence(
    `一方面${now.name}${now.orientation === "逆位" ? "逆位" : "正位"}让你${now.orientation === "逆位" ? "难以前行" : "看见当下"}；另一方面${block.name}${block.orientation === "逆位" ? "逆位" : "正位"}把${(block.keywords || [])[0] || "现实"}拉进拉扯。${normalize}`,
    100
  );
}

function groundClosingLine(reading) {
  const advice = cardByPosition(reading.cards, "建议", "下一步") || reading.cards?.at(-1);
  const sig = questionSignals(reading);
  if (!advice) {
    return "谢谢你今晚的认真。愿你温柔且清醒地前行，我会陪你慢慢看清。";
  }
  const companion = sig.choice
    ? "你不必独自硬扛，城市与时间会在节奏对齐后更清晰。"
    : "你不必一次想通全部，此刻照顾好自己也很好。";
  return clampAtSentence(
    `谢谢你今晚的认真。${advice.name}邀请你先安顿感受，${companion}`,
    58
  );
}

function groundHeadline(reading) {
  const advice = cardByPosition(reading.cards, "建议", "下一步");
  const now = cardByPosition(reading.cards, "现状", "今日指引", "我") || reading.cards?.[0];
  if (advice?.actionHint) {
    const hint = advice.actionHint.replace(/[。.!！]/g, "");
    if (hint.length >= 4 && hint.length <= 12) return hint;
    return hint.slice(0, 12);
  }
  const gentle = {
    犹豫: "在转弯处稍作停顿",
    焦虑: "先安放心里的不安",
    等待: "给答案一点生长时间",
    离开: "允许自己慢慢转向",
    怀旧: "带着温柔走向新阶段"
  };
  const k0 = now?.keywords?.[0] || "";
  for (const [key, title] of Object.entries(gentle)) {
    if (k0.includes(key)) return title;
  }
  if (now?.name) return `在${now.name}里找回节奏`.slice(0, 12);
  return "星月陪你慢慢看清";
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

/** 在句号处截断，避免逐张解读半截句 */
function clampAtSentence(text, max) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw;
  const slice = raw.slice(0, max);
  const lastPunc = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("！"),
    slice.lastIndexOf("？"),
    slice.lastIndexOf("；")
  );
  if (lastPunc >= Math.floor(max * 0.5)) return slice.slice(0, lastPunc + 1);
  return `${slice.trim()}…`;
}

function cardLabel(card) {
  return `${card.name}（${card.orientation}）`;
}

function formatCardForPrompt(card) {
  const orient = card.orientation === "逆位" ? "逆位" : "正位";
  const essence = card.girlToneMeaning || card.actionHint || "";
  const lines = [
    `【${card.position}】${card.name}（${orient}）`,
    `关键词：${(card.keywords || []).join("、")}`,
    `花色：${card.suit || ""}${card.element ? `·${card.element}` : ""}`,
    `牌意精华：${essence}`,
    `行动提示：${card.actionHint || "—"}`
  ];
  return lines.join("\n");
}

function spreadSynthesisHint(reading) {
  const cards = reading.cards || [];
  if (!cards.length) return "";
  const chain = cards
    .map((card) => `${card.position}=${card.name}${card.orientation === "逆位" ? "逆" : "正"}`)
    .join(" → ");
  return `【牌阵能量链】${chain}。写作时按此因果链合参：从现状出发，看见阻碍如何卡住，再从建议找出口；整篇解读须能回答用户原问题。`;
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
  const cardsText = (reading.cards || []).map((card) => formatCardForPrompt(card)).join("\n\n");

  const jsonNote = strictJson
    ? "\n【重要】上次输出不是合法 JSON。本次只输出一个 JSON 对象，不要 Markdown，不要解释，字符串内不要用换行。"
    : "";

  return {
    system: `你是「星月少女塔罗馆」的 AI 塔罗牌师。你的首要任务：让用户感到【情绪被接住、被温柔引导、愿意信任你】，同时用本次牌阵认真回应 ta 的问题。

══════════════════
一、牌师人格 · 星月（最高优先级）
══════════════════
1. 【接住 → 答问 → 贴牌】先命名用户感受，再回应字面问题，最后用牌佐证。禁止只安慰不答问，也禁止只分析不共情。
2. 【关系语气】温柔、稳定、不评判；像并肩坐着的牌师，不是考官或预言机。全文「你」直接对话；「我」可偶尔出场（全篇 ≤2 次，如「我懂」「我想陪你看到」）。
3. 【牌面驱动】每模块引用具体牌名；正/逆位必须与输入一致。逆位说成「还没找到出口的能量」，不说「坏消息」。
4. 【合参牌阵】按 现状→阻碍→建议 因果链写；依据「牌意精华」转化，禁止照搬输入套话。

══════════════════
二、专业边界（增信，不吓人）
══════════════════
- 禁止：塔罗告诉你、命中注定、一定会/不会、具体日期承诺、医疗法律投资承诺、替用户拍板二选一。
- 二选一：可比较两选项各自呼应什么；说不清时写「也许尚未到必须二选一」，并说明现阶段更该核对什么。
- 边界写在心里，不要反复提醒用户「别焦虑」「别猜测」——用接住和引导代替说教。

══════════════════
三、各字段写法
══════════════════
headline（8-12字）
  像牌师给你的今晚主题，温柔命名，可有希望感。
  ✗「犹豫不走中害怕改变」 ✓「在离开前，先听见自己的心」

presentState（3句，共 90-120 字）
  句1：接住【此刻心情】（急/乱/迷茫/想放下…），让用户感到被看见
  句2：回应用户字面问题（时间/地点/对方/去留…）
  句3：【现状】牌名+正/逆位+关键词佐证
  ✓「我懂你想快点看清 offer 走向，这种等待并不轻松。就何时何地，牌看尚在观望期。圣杯八逆位提示你想走却还没迈步。」

innerTheme（1句，40-60 字）
  三牌故事线 + 温和希望（非结果承诺）。
  ✓「想离开旧局却难迈步，现实在拖你，但建议牌仍指向更忠于内心的路。」

reminders（2-3 条，每条 35-48 字）
  按牌位顺序；每条含牌名+正/逆位+对用户的具体提醒；句式不雷同；语气像温柔提醒，不是训诫。

innerTension（1-2句，75-100 字）
  命名内心两难并正常化（「这样想很正常」）；交叉【现状】与【阻碍】；二选一可比较两选项。

reflectionQuestions（恰好 2 个，各 ≤38 字）
  开放、慈悲、扣题；帮用户自我探索，不是审问。
  ✓「如果不必今天做决定，你希望自己被怎样对待？」

gentleActions（恰好 2 条，各 ≤42 字）
  至少 1 条自我关怀（休息/写下/找人聊/对自己好一点）
  至少 1 条从【建议】牌推导的可执行小步

closingLine（1句，45-58 字）
  结构：看见用户 + 牌阵收束 + 陪伴感；回扣用户问题的一个词。
  ✓「谢谢你今晚的认真。牌看节奏仍在对齐，你不必独自硬扛，我会陪你慢慢看清。」

positionReadings（每张 60-85 字，完整成句）
  牌位+牌名+正/逆位 → 牌意 → 扣回用户问题；三张牌开头句式不可相同。

══════════════════
四、问题类型速查
══════════════════
- offer / 职业：流程阶段感 + 区分事实与焦虑；问时间用阶段，不给具体日期。
- 城市 / 二选一：分别写两选项各核对什么，可说「质感略偏…但仍需核实」。
- 关系 / 对方：倾向+不确定，不替对方表白。
- 去留：继续/暂缓/先沟通，不说绝对答案。
- 情绪：先承认感受合理，再给微小恢复动作。

【输出】仅一个合法 JSON 对象，不要 Markdown，不要解释：${jsonNote}
{
  "headline": "8-12字温柔主题",
  "presentState": "3句：接住心情+答问+现状牌",
  "innerTheme": "故事线+温和希望",
  "reminders": ["按牌位顺序2-3条"],
  "innerTension": "两难+正常化，可含二选一",
  "reflectionQuestions": ["恰好2个，慈悲开放"],
  "gentleActions": ["恰好2条，含1条自我关怀"],
  "closingLine": "看见+收束+陪伴",
  "positionReadings": [{"position":"牌位","cardName":"牌名","text":"60-85字完整句"}]
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
请在 presentState 句1 用类似语气接住这份感受（可参考：「${embrace}」），再回应字面问题。
closingLine 也须让用户感到被陪伴，而非被丢下。`;
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
      text: clampAtSentence(item.text, 85) || fallback.positionReadings?.[index]?.text || card?.keywords?.[0] || ""
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
  return /连成一条线|辨认你的节奏|正描出起点|带来拉扯，而.+指向出口/.test(String(text || ""));
}

function hasHopeTone(text) {
  return /路|希望|出口|光|仍在|指向|温柔|安心|对齐|慢慢|值得|陪伴/.test(String(text || ""));
}

function isColdHeadline(text) {
  return /中|受阻|恐惧|焦虑|失败|不行/.test(String(text || "")) && text.length <= 12;
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
    let text = clampAtSentence(sanitizeCopy(item.text), 85);
    if (
      isWeakLine(text)
      || !mentionsCard(text, card)
      || text.length < 28
      || orientationMismatch(text, card)
    ) {
      text = buildPositionReading(card, reading);
    }
    return {
      position: card.position,
      cardName: card.name,
      text: text || fallback.positionReadings[index]?.text
    };
  });
}

function normalizeAiResult(parsed, reading) {
  const fallback = buildGentleFallback(reading);
  let positionReadings = normalizePositionReadings(parsed, reading, fallback);
  positionReadings = polishPositionReadings(positionReadings, reading, fallback);

  const nowCard = cardByPosition(reading.cards, "现状", "今日指引", "我");
  let presentState = clampAtSentence(sanitizeCopy(parsed.presentState || parsed.opening), 120) || fallback.presentState;
  const citesNowCard = nowCard ? mentionsCard(presentState, nowCard) : true;
  const nowOrientOk = nowCard ? !orientationMismatch(presentState, nowCard) : true;
  if (
    isWeakLine(presentState)
    || !holdsEmotion(presentState, reading)
    || !citesNowCard
    || !nowOrientOk
    || !addressesUserQuestion(presentState, reading)
  ) {
    presentState = groundPresentState(reading) || clampText(answerUserQuestion(reading).directAnswer, 120);
  }

  let innerTheme = clampAtSentence(sanitizeCopy(parsed.innerTheme), 60) || fallback.innerTheme;
  if (isWeakLine(innerTheme) || isMechanicalTheme(innerTheme) || !hasHopeTone(innerTheme)) {
    innerTheme = groundInnerTheme(reading);
  } else if (!reading.cards?.some((c) => mentionsCard(innerTheme, c))) {
    innerTheme = groundInnerTheme(reading);
  }

  const reminders = polishReminders(normalizeStringList(parsed.reminders, 3, 48), reading, fallback);
  let innerTension = clampAtSentence(sanitizeCopy(parsed.innerTension || parsed.synthesis), 100) || fallback.innerTension;
  const blockCard = cardByPosition(reading.cards, "阻碍", "隐藏因素");
  if (
    isWeakLine(innerTension)
    || !nowCard
    || !blockCard
    || !mentionsCard(innerTension, nowCard)
    || orientationMismatch(innerTension, nowCard)
    || orientationMismatch(innerTension, blockCard)
  ) {
    innerTension = groundInnerTension(reading);
  }
  const reflectionQuestions =
    normalizeStringList(parsed.reflectionQuestions, 2, 38, 2) || fallback.reflectionQuestions;
  let gentleActions = normalizeStringList(parsed.gentleActions, 2, 42)
    || normalizeStringList(parsed.action ? [parsed.action] : null, 2, 42)
    || fallback.gentleActions;
  gentleActions = ensureSelfCareAction(gentleActions, reading);

  let closingLine = clampAtSentence(sanitizeCopy(parsed.closingLine || parsed.star), 58) || fallback.closingLine;
  const adviceCard = cardByPosition(reading.cards, "建议", "下一步");
  if (
    isWeakLine(closingLine)
    || !holdsEmotion(closingLine, reading)
    || !reading.cards?.some((c) => mentionsCard(closingLine, c))
    || (adviceCard && orientationMismatch(closingLine, adviceCard))
  ) {
    closingLine = groundClosingLine(reading);
  }

  let headline = clampAtSentence(sanitizeCopy(parsed.headline), 14) || groundHeadline(reading) || fallback.headline;
  if (isColdHeadline(headline)) {
    headline = groundHeadline(reading) || fallback.headline;
  }

  return {
    headline,
    presentState,
    innerTheme,
    reminders,
    innerTension,
    reflectionQuestions,
    gentleActions,
    closingLine,
    positionReadings,
    directAnswer: presentState,
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

  const reminders = cards.slice(0, 3).map((card) => {
    const line = interpretCardLine(card, reading);
    return clampAtSentence(`【${card.position}】${cardLabel(card)}：${line}`, 42);
  });
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
  if (sig.asksOffer) {
    reflectionQuestions = [
      "offer 里哪些条件已书面确认，哪些还只是你的担心？",
      "如果暂缓一周，你最想先照顾好自己哪一部分？"
    ];
  }
  if (sig.choice) {
    reflectionQuestions = [
      `哪座城市更像${cards.find((c) => c.suitKey === "cups")?.name || "圣杯"}所说的安心感？`,
      "如果先不问时间，你更想先弄清哪座城的现实条件？"
    ].map((item) => item.slice(0, 38));
  }

  let gentleActions = [
    "今晚允许自己早一点休息，答案可以明天再想",
    "可以试着列一张「已确认事实 / 我的担心」对照表"
  ];
  if (p.isCareer) {
    gentleActions[1] = "可以试着核对 offer 的试用期、团队与节奏是否匹配你";
  }
  gentleActions = ensureSelfCareAction(gentleActions, reading);

  return {
    headline: groundHeadline(reading) || (sig.asksOffer ? "给答案一点生长时间" : base.headline),
    presentState: groundPresentState(reading) || clampText(base.directAnswer, 120),
    innerTheme: groundInnerTheme(reading),
    reminders: reminders.length ? reminders : ["也许你需要先放慢一点，再谈选择"],
    innerTension: groundInnerTension(reading),
    reflectionQuestions: reflectionQuestions.map((item) => item.slice(0, 38)),
    gentleActions,
    closingLine: groundClosingLine(reading),
    positionReadings,
    directAnswer: base.directAnswer,
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

  const sections = [
    { title: "此刻的状态", text: ai.presentState || ai.directAnswer },
    { title: "你内心正在关注的主题", text: ai.innerTheme || ai.insight },
    { title: "这次抽卡给你的提醒", list: ai.reminders }
  ];

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
