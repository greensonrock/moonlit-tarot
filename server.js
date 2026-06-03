import http from "node:http";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCompactFallback, generateAiSummary, mergeAiSummary } from "./ai-reading.js";
import { cardReadingText, READING_SYNTHESIS_VERSION } from "./reading-synthesis.js";
import {
  drawCardsBySelection,
  drawCardsFromDeck,
  drawCardsFromTopPicks,
  getDrawConfig,
  isTopPickDraw,
  pickRandom
} from "./draw-random.js";
import { getTarotStats, tarotDeck } from "./tarot-data.js";
import { describeCardWhy, getCardKnowledge } from "./tarot-knowledge.js";
import { analyzeQuestion, inferMoodFromQuestion, inferThemeFromQuestion } from "./public/question-profile.js";

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

async function drawReading({ theme, mood, question, spread, selectedSlots, drawMode }) {
  const positions = spreadPositions[spread] || spreadPositions.three;
  const q = question?.trim() || "";
  const effectiveTheme = theme || inferThemeFromQuestion(q);
  const effectiveMood = mood || inferMoodFromQuestion(q);
  const questionProfile = analyzeQuestion(q || "我现在最需要看见什么？", effectiveTheme);
  const alignedTheme = questionProfile.dominantTheme || effectiveTheme;
  const drawConfig = getDrawConfig();
  const useTopPick =
    drawMode === "top"
    || drawMode === "fan"
    || isTopPickDraw(selectedSlots, positions.length);
  const drawn = useTopPick
    ? drawCardsFromTopPicks(deck, positions.length, selectedSlots, drawConfig)
    : Array.isArray(selectedSlots) && selectedSlots.length
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
    return drawnCard;
  });

  const readingCtx = {
    question: q || "我现在最需要看见什么？",
    theme: alignedTheme,
    themeLabel: themeLabels[alignedTheme] || themeLabels[effectiveTheme] || "心动与关系",
    mood: effectiveMood,
    questionProfile,
    cards
  };

  for (const card of cards) {
    card.analysis = cardReadingText(card, readingCtx).slice(0, 140);
  }

  const reading = {
    date: new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date()),
    theme: alignedTheme,
    themeLabel: themeLabels[alignedTheme] || themeLabels[effectiveTheme] || "心动与关系",
    mood: effectiveMood,
    question: q || "我现在最需要看见什么？",
    spread,
    cards,
    questionProfile,
    summary: buildSummary({ theme: alignedTheme, mood: effectiveMood, question: q, cards, questionProfile }),
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
        synthesisVersion: READING_SYNTHESIS_VERSION,
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
  try {
    for (const iface of Object.values(os.networkInterfaces())) {
      for (const addr of iface ?? []) {
        if (addr.family === "IPv4" && !addr.internal) {
          console.log(`  LAN access: http://${addr.address}:${port}`);
        }
      }
    }
  } catch {
    // In some sandboxed environments, enumerating interfaces may fail; localhost is still valid.
  }
});
