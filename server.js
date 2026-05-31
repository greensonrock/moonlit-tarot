import http from "node:http";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCompactFallback, generateAiSummary, mergeAiSummary } from "./ai-reading.js";
import { drawCardsBySelection, drawCardsFromDeck, getDrawConfig, pickRandom } from "./draw-random.js";
import { getTarotStats, tarotDeck } from "./tarot-data.js";
import { describeCardWhy, getCardKnowledge } from "./tarot-knowledge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadEnvFile() {
  try {
    const raw = await readFile(path.join(__dirname, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      // DMXAPI 配置始终以 .env 为准，避免 shell 环境变量覆盖
      if (key.startsWith("DMXAPI_") || !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env optional when vars are set in the shell
  }
}
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

const deck = tarotDeck;

const spreadPositions = {
  one: ["今日指引"],
  three: ["现状", "阻碍", "建议"],
  four: ["我", "对方或外界", "隐藏因素", "下一步"]
};

const themeLabels = {
  relationship: "心动与关系",
  future: "未来与选择",
  career: "工作与野心",
  self: "自我与成长",
  emotion: "情绪与生活"
};

const moodHints = {
  lost: "你现在可能不是没有答案，而是太想马上听见一个确定的声音。",
  urgent: "你很想知道结果，这份急切背后也藏着你认真对待自己的心。",
  calmChaos: "你表面维持着平静，但心里其实已经把很多细节翻来覆去想过。",
  turning: "你正在期待一个转机，也在试着确认自己是不是还值得继续投入。",
  release: "你想放下某件事，但真正难的也许是承认它曾经对你很重要。"
};

async function drawReading({ theme, mood, question, spread, selectedSlots }) {
  const positions = spreadPositions[spread] || spreadPositions.three;
  const questionProfile = analyzeQuestion(question, theme);
  const drawConfig = getDrawConfig();
  // 建议2：用户点选位置真正决定抽到的牌；无点选时回退随机抽顶牌
  const drawn = Array.isArray(selectedSlots) && selectedSlots.length
    ? drawCardsBySelection(deck, positions.length, selectedSlots, drawConfig)
    : drawCardsFromDeck(deck, positions.length, drawConfig);
  const cards = drawn.map(({ card, reversed }, index) => {
    const position = positions[index];
    const drawnCard = {
      ...card,
      id: `${card.arcana}-${card.name}`,
      position,
      orientation: reversed ? "逆位" : "正位",
      keywords: reversed ? card.reversed : card.upright
    };
    const knowledge = getCardKnowledge(drawnCard);
    drawnCard.element = drawnCard.element || knowledge?.element || null;
    drawnCard.imagery = knowledge?.imagery || "";
    drawnCard.numerologyStage = knowledge?.numerology?.stage || knowledge?.court?.rank || (drawnCard.arcana === "大阿卡那" ? "大阿卡那" : "");
    drawnCard.why = describeCardWhy(drawnCard, questionProfile);
    drawnCard.shortHint = reversed
      ? `逆位：${knowledge?.shadow || "这股能量还没顺畅落地"}，值得认真看一眼。`
      : (card.actionHint || knowledge?.light || "");
    return {
      ...drawnCard,
      analysis: analyzeCardForQuestion(drawnCard, questionProfile, index, positions.length)
    };
  });

  const reading = {
    date: new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date()),
    theme,
    themeLabel: themeLabels[theme] || "心动与关系",
    mood,
    question: question?.trim() || "我现在最需要看见什么？",
    spread,
    cards,
    questionProfile,
    summary: buildSummary({ theme, mood, question, cards, questionProfile }),
    aiPowered: false
  };

  if (process.env.DMXAPI_KEY) {
    try {
      const ai = await generateAiSummary(reading);
      if (ai) {
        reading.summary = mergeAiSummary(reading, ai);
        reading.aiPowered = true;
      }
    } catch (error) {
      console.error("AI reading failed:", error.message);
      reading.aiPowered = false;
      reading.aiError = "AI 暂时不可用，已显示精简版解读";
      reading.summary = mergeAiSummary(reading, buildCompactFallback(reading));
    }
  } else {
    reading.summary = mergeAiSummary(reading, buildCompactFallback(reading));
  }

  return reading;
}

/**
 * 问题意图判定（建议5）：从「命中即真」升级为「主题优先 + 加权计分」。
 * - 用户选定的 theme 拥有最高权重，避免「结果/坚持」等通用词误判领域。
 * - 强信号词（offer、复合、放下…）加分，弱/通用词（结果、坚持…）只微调，
 *   且只有在没有明确主题时才足以改变领域归属。
 */
function analyzeQuestion(question = "", theme = "relationship") {
  const text = question.trim() || "我现在最需要看见什么？";

  // 每个领域：强信号（+3）、弱信号（+1）
  const domainSignals = {
    relationship: { strong: ["复合", "暧昧", "表白", "前任", "喜欢我", "对我的感觉", "这段关系", "在一起"], weak: ["他", "她", "ta", "对方", "喜欢", "爱", "关系", "主动", "联系", "心动"] },
    career: { strong: ["offer", "录用", "入职", "离职", "跳槽", "面试", "升职", "工作机会", "这份工作"], weak: ["工作", "职业", "事业", "老板", "同事", "岗位", "项目", "坚持"] },
    emotion: { strong: ["焦虑到", "撑不住", "情绪崩", "睡不着", "很疲惫"], weak: ["累", "焦虑", "难过", "情绪", "疲惫", "压力", "烦"] },
    self: { strong: ["重新喜欢自己", "成为自己", "自我成长", "走不出来"], weak: ["自己", "成长", "内在", "改变", "自信", "修复"] },
    future: { strong: ["未来三个月", "接下来会", "发展方向", "该选哪个", "前景"], weak: ["未来", "发展", "方向", "趋势"] }
  };

  const scoreDomain = (key) => {
    const sig = domainSignals[key];
    let s = theme === key ? 5 : 0; // 用户选定主题：最高权重
    for (const w of sig.strong) if (text.includes(w)) s += 3;
    for (const w of sig.weak) if (text.includes(w)) s += 1;
    return s;
  };

  const scores = {
    relationship: scoreDomain("relationship"),
    career: scoreDomain("career"),
    emotion: scoreDomain("emotion"),
    self: scoreDomain("self"),
    future: scoreDomain("future")
  };

  const isDecision = ["该不该", "要不要", "是否", "选择", "继续", "放弃", "离开", "留下", "还是"].some((w) => text.includes(w));
  const isRelease = ["放下", "走出来", "忘记", "释怀", "翻篇"].some((w) => text.includes(w));

  // 主导领域：取最高分；并列时按主题 > 关系 > 职业 > 情绪 > 自我 > 未来 的稳定顺序
  const order = ["relationship", "career", "emotion", "self", "future"];
  let dominant = order[0];
  for (const key of order) {
    if (scores[key] > scores[dominant]) dominant = key;
  }
  if (scores[dominant] === 0) dominant = theme in scores ? theme : "future";

  const isRelationship = dominant === "relationship";
  const isCareer = dominant === "career";
  const isEmotion = dominant === "emotion";
  const isSelf = dominant === "self";
  // 未来：仅当显式未来词或主题为 future，或问题是抉择且无其他强领域
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

  const caution = isRelationship
    ? "不要把猜测当成证据，也不要用试探代替表达"
    : isCareer
      ? "不要只用忍耐衡量努力，也不要在疲惫时做极端决定"
      : isEmotion
        ? "不要把所有情绪都解释成自己不够好"
        : "不要为了马上安心而匆忙锁死答案";

  return { text, intent, subject, coreNeed, caution, isRelationship, isCareer, isDecision, isEmotion, isRelease, isFuture };
}

function analyzeCardForQuestion(card, profile, index, total) {
  const keywordText = card.keywords.join("、");
  const direction = card.orientation === "逆位"
    ? `以逆位出现，说明「${keywordText}」这股能量暂时没有顺畅流动。`
    : `以正位出现，说明「${keywordText}」这股能量正在比较清楚地显现。`;
  const role = card.position === "建议" || card.position === "下一步"
    ? `放在「${card.position}」，它更像是在告诉你下一步怎么把主动权拿回来。`
    : card.position === "阻碍" || card.position === "隐藏因素"
      ? `放在「${card.position}」，它指向这个问题里容易被忽略、但正在影响你判断的部分。`
      : `放在「${card.position}」，它先描述这件事当前最明显的能量。`;
  const focus = profile.isRelationship
    ? relationshipCardFocus(card, profile)
    : profile.isCareer
      ? careerCardFocus(card, profile)
      : profile.isEmotion
        ? emotionCardFocus(card, profile)
        : generalCardFocus(card, profile);
  const ending = index === total - 1
    ? `所以这张牌给你的出口不是立刻求一个结论，而是${card.actionHint}。`
    : `这会影响你接下来如何理解${profile.subject}。`;

  return `${role}${card.name}${direction}${focus}${ending}`;
}

function relationshipCardFocus(card, profile) {
  if (card.suitKey === "cups") return `放回你的问题里，它更关心真实感受是否被好好表达，而不只是暧昧里的情绪起伏。`;
  if (card.suitKey === "swords") return `放回你的问题里，它提醒你分清事实、想象和对方真实说出口的部分。`;
  if (card.suitKey === "pentacles") return `放回你的问题里，它更看重对方有没有稳定、具体、可持续的行动。`;
  if (card.suitKey === "wands") return `放回你的问题里，它说明吸引力和主动性存在，但也要看热度能不能变成稳定靠近。`;
  return `放回你的问题里，它触碰的是${profile.coreNeed}，不是单纯的喜欢或不喜欢。`;
}

function careerCardFocus(card, profile) {
  if (card.suitKey === "pentacles") return `放回你的问题里，它直接指向现实回报、成长空间和安全感。`;
  if (card.suitKey === "wands") return `放回你的问题里，它更关心你还有没有热情、野心和继续推进的动力。`;
  if (card.suitKey === "swords") return `放回你的问题里，它提醒你用事实、沟通和规划来判断，而不是只凭一时疲惫。`;
  if (card.suitKey === "cups") return `放回你的问题里，它说明情绪体验和团队氛围已经影响你的判断。`;
  return `放回你的问题里，它指向你和这份工作之间更深层的阶段课题。`;
}

function emotionCardFocus(card, profile) {
  if (card.orientation === "逆位") return `放回你的问题里，它像是在说你有一部分感受已经被压住太久，需要先被看见。`;
  return `放回你的问题里，它不是要求你马上振作，而是提醒你找到能恢复能量的小入口。`;
}

function generalCardFocus(card, profile) {
  if (profile.isDecision) return `放回你的问题里，它提醒你把选择拆成代价、期待和真实行动，而不是只问对错。`;
  if (profile.isRelease) return `放回你的问题里，它更像在帮助你辨认：什么还值得保留，什么已经只是在消耗你。`;
  return `放回你的问题里，它让答案更贴近你真正需要的${profile.coreNeed}。`;
}

function buildSummary({ theme, mood, question, cards, questionProfile }) {
  const themeLabel = themeLabels[theme] || "心动与关系";
  const profile = questionProfile || analyzeQuestion(question, theme);
  const majorCount = cards.filter((card) => card.arcana === "大阿卡那").length;
  const reversedCount = cards.filter((card) => card.orientation === "逆位").length;
  const names = cards.map((card) => `${card.position}的${card.name}${card.orientation}`).join("、");
  const first = cards[0];
  const last = cards[cards.length - 1];

  const atmosphere = majorCount >= 2
    ? `这次牌面信息很集中，而且有较强的大阿卡那能量，说明「${profile.text}」不只是表层事件，也牵动着你在${themeLabel}里的深层课题。`
    : `这组牌的氛围很像一封围绕「${profile.text}」展开的信：它没有急着替你下结论，而是在帮你看清${profile.subject}背后真正需要被回应的部分。`;

  const reversedTone = reversedCount
    ? `牌面里的逆位不是否定你，它更像一个温柔的暂停键，提醒你在${profile.intent}里先看见被忽略的情绪、边界或需求。`
    : `整体牌面比较顺畅，说明你并不是完全卡住，只是需要围绕${profile.coreNeed}更清醒地整理下一步。`;

  const advice = makeAdvice(theme, cards, profile);
  const keyword = pickKeyword(cards);
  const luckyColor = pickLuckyColor(theme);
  const starLine = makeStarLine(theme, last, profile);

  return {
    keyword,
    luckyColor,
    action: advice[0],
    sections: [
      {
        title: "问题分析",
        text: `你问的是「${profile.text}」。这更像一个关于「${profile.intent}」的问题，核心不是单纯等一个结果，而是确认${profile.coreNeed}。${profile.caution}。`
      },
      {
        title: "牌面整体氛围",
        text: `${atmosphere} 你抽到的是${names}。${first.name}把开头的能量点亮，而${last.name}更像这次牌给你的出口。`
      },
      {
        title: "卡片分析",
        list: cards.map((card) => `${card.position}｜${card.name}${card.orientation}：${card.analysis}`)
      },
      {
        title: "当前状态",
        text: `${moodHints[mood] || moodHints.lost} 面对「${profile.text}」，你可能一边想保持体面和清醒，一边又希望有人能把复杂的心事说得更明白。`
      },
      {
        title: "隐藏提醒",
        text: `${reversedTone} 这次牌更希望你看见：真正重要的不是立刻得到一个完美答案，而是确认什么正在滋养你，什么只是反复消耗你。`
      },
      {
        title: "现实建议",
        list: advice
      },
      {
        title: "今日星语",
        text: starLine
      }
    ]
  };
}

function makeAdvice(theme, cards, profile = analyzeQuestion("", theme)) {
  const byTheme = {
    relationship: ["不要用反复试探代替真实表达。", "观察对方是否有稳定行动，而不只是短暂的情绪价值。", "保持温柔，但不要放低自己的边界。"],
    career: ["给自己设定一个 7 天观察期，记录消耗你和滋养你的具体事情。", "先推进一个可见的小成果，再决定是否做更大的改变。", "把期待拆成行动，不要只靠忍耐证明努力。"],
    future: ["把选择写成两个清单：我害怕失去什么，我真正想靠近什么。", "先做一个低成本尝试，让现实给你更多反馈。", "不要为了立刻安心，急着把未来锁死。"],
    self: ["今天只修复一个小习惯，不要求自己马上变成全新的样子。", "把注意力从别人怎么看，移回你真实想成为什么样的人。", "给自己一次不解释的休息。"],
    emotion: ["把最困扰你的情绪写成一句话，不评价它，只命名它。", "减少一次无意义刷新，把十分钟还给身体和呼吸。", "找一个温和的出口，而不是继续假装没事。"]
  };
  const base = byTheme[theme] || byTheme.relationship;
  const cardHint = cards[cards.length - 1]?.actionHint;
  const first = profile.isDecision
    ? `把这个问题拆成两个答案：如果继续，你需要看到什么具体变化；如果停止，你要如何保护自己的节奏。`
    : base[0];
  const second = profile.isRelationship
    ? "用一次真诚但不逼迫的表达，替代反复猜测对方的细节。"
    : profile.isCareer
      ? "记录三件现实证据：成长空间、回报感、消耗程度，再做判断。"
      : base[1];
  return [first, second, cardHint || base[2]];
}

function pickKeyword(cards) {
  const pool = cards.flatMap((card) => card.keywords);
  return pickRandom(pool) || "慢慢确认";
}

function pickLuckyColor(theme) {
  return {
    relationship: "玫瑰月光粉",
    career: "香槟金",
    future: "星空蓝",
    self: "珍珠白",
    emotion: "雾紫银"
  }[theme] || "月光银";
}

function makeStarLine(theme, card, profile = analyzeQuestion("", theme)) {
  const lines = {
    relationship: `真正属于你的靠近，不需要你一直猜。`,
    career: `你不是没有光，只是需要一个更适合发光的位置。`,
    future: `未来不是被看见的命运，而是你慢慢走出来的方向。`,
    self: `放下不是输了，而是终于把自己还给自己。`,
    emotion: `情绪不是麻烦，它是在提醒你哪里需要被温柔照顾。`
  };
  if (profile.isDecision) return `答案不急着替你关门，它会先帮你看清哪扇门真的通向自己。`;
  if (card?.arcana === "大阿卡那") return `${lines[theme] || lines.self} ${card.name}把这句话轻轻递给了你。`;
  return lines[theme] || lines.self;
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/api/health") {
      const draw = getDrawConfig();
      sendJson(res, {
        status: "ok",
        service: "moonlit-tarot",
        aiEnabled: Boolean(process.env.DMXAPI_KEY),
        model: process.env.DMXAPI_MODEL || null,
        draw: {
          reverseRate: draw.reverseRate,
          orientMode: draw.orientMode,
          rng: "crypto.randomInt"
        }
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/cards") {
      sendJson(res, {
        ...getTarotStats(),
        basis: "Standard Rider-Waite-Smith style 78-card structure: 22 Major Arcana + 56 Minor Arcana, four suits of 14 cards.",
        cards: deck.map(({ slug, name, nameEn, arcana, suit, image }) => ({ slug, name, nameEn, arcana, suit, image }))
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/reading") {
      sendJson(res, await drawReading(await readBody(req)));
      return;
    }

    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(publicDir, normalized);
    const ext = path.extname(filePath);
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    console.error(error);
    sendJson(res, { error: "Server error" }, 500);
  }
});

await loadEnvFile();
server.listen(port, host, () => {
  console.log(`Moonlit Tarot is running at http://127.0.0.1:${port}`);
  if (process.env.DMXAPI_KEY) {
    console.log(`AI reading: DMXAPI enabled @ ${process.env.DMXAPI_BASE || "https://www.dmxapi.com"}`);
    console.log(`AI model: ${process.env.DMXAPI_MODEL || "deepseek-v4-flash"}`);
  } else {
    console.log("AI reading: template only (set DMXAPI_KEY in .env)");
  }
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        console.log(`  LAN access: http://${addr.address}:${port}`);
      }
    }
  }
});
