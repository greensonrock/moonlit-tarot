#!/usr/bin/env node
/**
 * 泛化 AI 解读 case 烟测（走真实 API）
 * 验证：aiPowered、明确观点、非模糊回避、结合牌面、非规则回退覆盖
 *
 * 用法:
 *   node scripts/verify-ai-cases.mjs
 *   node scripts/verify-ai-cases.mjs --case=interview
 *   API_BASE=http://127.0.0.1:4173 node scripts/verify-ai-cases.mjs
 */
import { loadEnv } from "./load-env.mjs";
import { buildGentleFallback } from "../ai-reading.js";
import { analyzeQuestion } from "../public/question-profile.js";

loadEnv();

const API_BASE = (process.env.API_BASE || "http://127.0.0.1:4173").replace(/\/$/, "");
const caseFilter = process.argv.find((a) => a.startsWith("--case="))?.split("=")[1];

const EVASIVE = /别急着下结论|不必今天想通|顺其自然|答案会自己浮现|可能还在观察|也许会有|先等等看|感受值得被看见/;

const LEAN_BY_INTENT = {
  win_lose_forecast: /偏|宜|不宜|胜算|顺风|逆风|赢面|控仓|小注|五五开|有利|不利|不宜重仓|有胜算|难赢/,
  outcome_forecast: /偏|倾向|更像|宜|不宜|仍在|不是已|评估|流程|窗口|走向|阶段|有戏|没黄|一锤定音|机会|进展|反馈/,
  partner_attitude: /偏|温度|有温度|偏淡|未说透|互动|靠近|冷淡|余地|态度|心意|低谷|信号|不是误会|痛苦|执念|秩序|追着他/,
  yes_no_decision: /宜|不宜|可以|暂缓|主动|推进|放下|离开|小步|开口|靠近|缓/,
  emotion_regulation: /先|稳|睡|身体|焦虑|照顾|节奏|呼吸|减负|恢复/,
  self_clarity: /偏|重建|辨认|整合|价值|值得|方向|小步/
};

/** @type {Array<{id:string,question:string,spread:string,theme:string,mood:string,expectIntent:string}>} */
const CASES = [
  {
    id: "poker-one",
    question: "今天打德州会赢吗",
    spread: "one",
    theme: "future",
    mood: "urgent",
    expectIntent: "win_lose_forecast"
  },
  {
    id: "interview",
    question: "刚刚面试的机会会是怎么样，上周二面完还没消息",
    spread: "three",
    theme: "career",
    mood: "urgent",
    expectIntent: "outcome_forecast"
  },
  {
    id: "offer-wait",
    question: "接下来offer情况会是怎么样的",
    spread: "three",
    theme: "career",
    mood: "turning",
    expectIntent: "outcome_forecast"
  },
  {
    id: "partner-feeling",
    question: "他对我还有没有感觉，最近联系变少了",
    spread: "three",
    theme: "relationship",
    mood: "lost",
    expectIntent: "partner_attitude"
  },
  {
    id: "should-confess",
    question: "我该不该主动表白",
    spread: "three",
    theme: "relationship",
    mood: "urgent",
    expectIntent: "yes_no_decision"
  },
  {
    id: "anxiety-sleep",
    question: "最近焦虑到睡不着怎么办",
    spread: "three",
    theme: "emotion",
    mood: "calmChaos",
    expectIntent: "emotion_regulation"
  }
];

function leanPattern(intent) {
  return LEAN_BY_INTENT[intent] || /偏|宜|不宜|倾向|更像|可以|暂缓|值得|明确/;
}

async function fetchReading(body) {
  const r = await fetch(`${API_BASE}/api/reading`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 120)}`);
  }
  return r.json();
}

async function healthCheck() {
  const r = await fetch(`${API_BASE}/api/health`);
  if (!r.ok) throw new Error(`health ${r.status}`);
  const h = await r.json();
  if (!h.aiEnabled) throw new Error("aiEnabled=false，请先启动服务并配置 DMXAPI_READING_KEY");
  return h;
}

function evaluateCase(reading, c) {
  const ai = reading.summary?.aiCompact || {};
  const verdict = ai.directVerdict || "";
  const cards = reading.cards || [];
  const cardNames = cards.map((x) => x.name);
  const fb = buildGentleFallback(reading);
  const lean = leanPattern(c.expectIntent);
  const intent = reading.questionProfile?.readingIntent;

  const checks = {
    aiPowered: reading.aiPowered === true,
    intent: intent === c.expectIntent,
    hasVerdict: verdict.length >= 14,
    clearLean: lean.test(verdict),
    notEvasive: !EVASIVE.test(verdict),
    mentionsCard: cardNames.some((n) => verdict.includes(n)) || cards.length === 1,
    differsFromFallback: verdict !== fb.directVerdict && !verdict.startsWith(fb.directVerdict.slice(0, 20)),
    hasActions: (ai.gentleActions || []).length >= 1,
    hasPositionReadings: (ai.positionReadings || []).length === cards.length
  };

  return { checks, verdict, brief: ai.briefSummary, cards: cardNames, intent, fbVerdict: fb.directVerdict };
}

async function main() {
  const health = await healthCheck();
  console.log(`API ${API_BASE} · aiEnabled · ${health.readingApi?.model} @ ${health.readingApi?.base}\n`);

  const list = caseFilter ? CASES.filter((c) => c.id === caseFilter) : CASES;
  if (!list.length) {
    console.error(`未知 case: ${caseFilter}，可选: ${CASES.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }

  let allOk = true;
  const rows = [];

  for (const c of list) {
    process.stdout.write(`运行 ${c.id}… `);
    const t0 = Date.now();
    let reading;
    try {
      reading = await fetchReading({
        question: c.question,
        spread: c.spread,
        theme: c.theme,
        mood: c.mood
      });
    } catch (e) {
      console.log(`ERROR ${e.message}`);
      allOk = false;
      rows.push({ c, pass: false, error: e.message });
      continue;
    }
    const ms = Date.now() - t0;
    const { checks, verdict, brief, cards, intent, fbVerdict } = evaluateCase(reading, c);
    const pass = Object.values(checks).every(Boolean);
    console.log(pass ? `OK (${(ms / 1000).toFixed(1)}s)` : `FAIL (${(ms / 1000).toFixed(1)}s)`);
    if (!pass) {
      const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
      console.log(`  failed: ${failed.join(", ")}`);
      console.log(`  intent: ${intent} (expect ${c.expectIntent})`);
      console.log(`  cards: ${cards.join(" / ")}`);
      console.log(`  verdict: ${verdict.slice(0, 90)}…`);
      if (!checks.differsFromFallback) {
        console.log(`  fallback: ${fbVerdict.slice(0, 70)}…`);
      }
      allOk = false;
    } else {
      console.log(`  verdict: ${verdict.slice(0, 88)}`);
      console.log(`  brief: ${(brief || "").slice(0, 60)}`);
    }
    rows.push({ c, pass, checks, verdict, cards, ms });
  }

  console.log("\n--- 汇总 ---");
  const passed = rows.filter((r) => r.pass).length;
  console.log(`${passed}/${rows.length} case 通过`);
  for (const r of rows) {
    console.log(`${r.pass ? "✓" : "✗"} ${r.c.id} · ${r.c.question.slice(0, 28)}`);
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("FAIL", e.message);
  console.error("提示: 先 node server.js 启动服务");
  process.exit(1);
});
