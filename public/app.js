import { inferMoodFromQuestion, inferThemeFromQuestion } from "/question-profile.js";

const app = document.querySelector("#app");
const BUILD_ID = "20260605b";

function askBanner() {
  const q = (state.question || "").trim();
  if (!q) return "";
  return `<p class="ask-banner">你正带着这个问题抽牌：<span>「${escapeHtml(q)}」</span></p>`;
}

const themes = [
  ["relationship", "心动与关系", "暧昧、靠近、边界与真实表达"],
  ["future", "未来与选择", "方向、转机、未知与勇气"],
  ["career", "工作与野心", "职场、价值感、坚持或改变"],
  ["self", "自我与成长", "内在修复、独处、成为自己"],
  ["emotion", "情绪与生活", "疲惫、松弛、日常能量整理"]
];

const moods = [
  ["lost", "有点迷茫", "想听见一个更清楚的方向"],
  ["urgent", "很想知道答案", "心里有一点等不及"],
  ["calmChaos", "表面平静但心里很乱", "很多细节在脑子里循环"],
  ["turning", "期待一个转机", "希望事情出现新的可能"],
  ["release", "想放下某件事", "想把自己从消耗里带出来"]
];

const spreads = [
  ["one", "1 张牌", "今日指引", "适合快速得到一句提醒"],
  ["three", "3 张牌", "现状 / 阻碍 / 建议", "适合认真看清一件事"],
  ["four", "4 张牌", "我 / 外界 / 隐藏因素 / 下一步", "适合关系或选择题"]
];

const questions = {
  relationship: ["这段关系里，我最需要看清什么？", "我该不该主动一点？", "这段关系真正需要被看见的是什么？"],
  future: ["未来三个月我需要注意什么？", "我应该选择稳定还是冒险？", "我现在最需要相信什么？"],
  career: ["我该继续坚持这份工作吗？", "最近的努力会有结果吗？", "我适合换一个方向吗？"],
  self: ["我为什么总是走不出来？", "我现在最需要修复的内在能量是什么？", "我该如何重新喜欢自己？"],
  emotion: ["最近为什么总觉得很累？", "我该怎么让自己轻松一点？", "今天我的情绪想告诉我什么？"]
};

const CHAPTER_META = {
  "现状": { bridge: "故事从这里开始。这张牌照见你此刻站的位置——", role: "起点" },
  "阻碍": { bridge: "但牌也看见了一堵墙。真正卡住你的，就藏在这里——", role: "阻力" },
  "建议": { bridge: "而牌给出的出口，在这片能量里——", role: "出口" },
  "今日指引": { bridge: "你抽到的这一张，像一面镜子——", role: "镜子" },
  "我": { bridge: "先看你自己。这张牌说的是你内在的状态——", role: "内在" },
  "对方或外界": { bridge: "再看外界。这张牌指向你周围的影响——", role: "外界" },
  "隐藏因素": { bridge: "还有一层你没完全看见的力量——", role: "暗流" },
  "下一步": { bridge: "牌阵的最后一章，指向你可以迈出的一步——", role: "行动" }
};

const ACT_LABELS = ["第一章", "第二章", "第三章", "第四章"];

const ritualLines = [
  "先把问题放在牌桌中央。",
  "洗牌中，顺序正在重新变得陌生。",
  "停一下，让牌面自己靠近。",
  "三张牌正在离开牌堆。"
];

const state = {
  step: "home",
  theme: "",
  mood: "",
  question: "",
  spread: "three",
  quickPath: false,
  selectedSlots: [],
  pickStep: 0,
  slotPool: null,
  fanOrder: [],
  fanShuffling: false,
  deckShuffling: false,
  deckShuffleStartMs: 0,
  deckReady: false,
  fanSpread: false,
  fanSpreadSettled: false,
  fetchFailed: false,
  reading: null,
  revealed: [],
  resonanceCard: null,
  resonanceAngle: "",
  followupFocus: "",
  readingFeedback: "",
  reportExpanded: false
};

const spreadCount = () => ({ one: 1, three: 3, four: 4 }[state.spread] || 3);

const SPREAD_POSITIONS = {
  one: ["今日指引"],
  three: ["现状", "阻碍", "建议"],
  four: ["我", "对方或外界", "隐藏因素", "下一步"]
};

function spreadPositions() {
  return SPREAD_POSITIONS[state.spread] || SPREAD_POSITIONS.three;
}

const FULL_DECK_SIZE = 78;
/**
 * 扇形展示张数 = 每轮从「洗匀后的整副牌」牌堆顶露出的候选数。
 * 用户点第 i 张 → topPick=i → drawCardsFromTopPicks（78 张无放回），不是 13 槽当下标。
 */
const FAN_PICK_SIZE = 5;

function shuffleArray(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function shuffleFanOrder() {
  state.fanOrder = shuffleArray([...Array(FAN_PICK_SIZE).keys()]);
}

function resetPickSession() {
  state.pickStep = 0;
  state.selectedSlots = [];
  state.slotPool = shuffleArray([...Array(FULL_DECK_SIZE).keys()]);
  shuffleFanOrder();
}

function resetDrawSession() {
  cancelDeckShuffleAnim();
  state.deckShuffling = false;
  state.deckShuffleStartMs = 0;
  state.deckReady = false;
  state.fanSpread = false;
  state.fanSpreadSettled = false;
  state.fetchFailed = false;
  resetPickSession();
}

function deckShuffleDuration() {
  return state.quickPath ? 2800 : 3400;
}

function shufflePhaseText(progress) {
  if (progress < 0.22) return "把整副牌分成两半…";
  if (progress < 0.52) return "左右交错，洗匀顺序…";
  if (progress < 0.78) return "拍匀牌堆，让牌自己落定…";
  return `从牌堆顶抽出 ${FAN_PICK_SIZE} 张候选…`;
}

function syncShuffleVisual(root) {
  if (!root || !state.deckShuffling || !state.deckShuffleStartMs) return;
  const duration = deckShuffleDuration();
  const progress = Math.min(1, (performance.now() - state.deckShuffleStartMs) / duration);
  const phaseEl = root.querySelector("[data-shuffle-phase]");
  if (phaseEl) phaseEl.textContent = shufflePhaseText(progress);
  const pile = root.querySelector("[data-deck-pile] .deck-stack");
  if (pile) {
    pile.classList.toggle("is-riffle-split", progress >= 0.1 && progress < 0.48);
    pile.classList.toggle("is-riffle-merge", progress >= 0.48 && progress < 0.76);
    pile.classList.toggle("is-riffle-settle", progress >= 0.76);
  }
  const fill = root.querySelector("[data-shuffle-progress-fill]");
  if (fill) fill.style.width = `${Math.round(progress * 100)}%`;
  const pct = root.querySelector("[data-shuffle-progress-pct]");
  if (pct) pct.textContent = `${Math.round(progress * 100)}%`;
}

let deckShuffleAnimFrame = null;

function cancelDeckShuffleAnim() {
  if (deckShuffleAnimFrame) {
    cancelAnimationFrame(deckShuffleAnimFrame);
    deckShuffleAnimFrame = null;
  }
}

function drawQuestionLine() {
  const q = (state.question || "").trim();
  if (!q) return "";
  const short = q.length > 52 ? `${q.slice(0, 52)}…` : q;
  return `<p class="draw-question-line" title="${escapeHtml(q)}">「${escapeHtml(short)}」</p>`;
}

function buildSpreadGhostMarkup(need, step, positions, deckReady) {
  const spreadClass = need === 1 ? "one" : need === 4 ? "four" : "three";
  return `
    <div class="draw-spread-ghosts draw-spread-ghosts--${spreadClass}" data-spread-ghosts aria-label="牌阵空位">
      ${positions.slice(0, need).map((pos, i) => {
        const filled = i < step;
        const current = deckReady && i === step;
        return `
          <div class="draw-ghost-slot${filled ? " is-filled" : ""}${current ? " is-current" : ""}" data-ghost-slot="${i}">
            <span class="draw-ghost-slot__label">${escapeHtml(pos)}</span>
            <div class="draw-ghost-slot__card" aria-hidden="true"></div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function getDrawViewState() {
  const need = spreadCount();
  const positions = spreadPositions();
  const step = state.pickStep;
  const shuffling = state.deckShuffling;
  const deckReady = state.deckReady && !shuffling;
  const fanSpread = state.fanSpread && deckReady;
  const picking = deckReady && fanSpread;
  const currentPos = positions[step] || positions[0];
  return { need, positions, step, shuffling, deckReady, fanSpread, picking, currentPos };
}

function drawHeadlineText(v) {
  if (state.fetchFailed) return "解读未完成";
  if (v.shuffling) return "洗匀牌堆";
  if (v.picking) return `选第 ${drawProgressLabel()} 张 · ${v.currentPos}`;
  return "牌桌就位";
}

function drawStageHint(v) {
  if (state.fetchFailed) return "选牌已保留，可重新生成解读";
  if (v.shuffling) return `专注你的问题 · 整副 ${FULL_DECK_SIZE} 张正在洗匀`;
  if (v.picking) return `凭直觉点一张 · 落入「${v.currentPos}」`;
  return "";
}

function buildFanClassList(v) {
  return [
    "card-fan",
    v.shuffling ? "is-deck is-shuffling is-ritual-shuffle" : "",
    v.fanSpread ? "is-spread" : "is-deck",
    state.fanShuffling && !v.shuffling ? "is-shuffling" : "",
    state.fanSpreadSettled && v.fanSpread ? "is-spread-settled" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function applyFanCardLayout(fan) {
  if (!fan) return;
  if (!state.fanOrder?.length) shuffleFanOrder();
  const center = (FAN_PICK_SIZE - 1) / 2;
  fan.querySelectorAll(".fan-card").forEach((btn, displayIndex) => {
    const pickIndex = state.fanOrder[displayIndex];
    if (pickIndex === undefined) return;
    const offset = displayIndex - center;
    btn.dataset.fanPick = String(pickIndex);
    btn.style.setProperty("--fan-angle", `${offset * 13}deg`);
    btn.style.setProperty("--fan-lift", `${Math.round(Math.abs(offset) * 10)}px`);
    btn.style.setProperty("--fan-x", `${offset * 26}px`);
    btn.style.setProperty("--fan-z", String(displayIndex + 1));
    btn.style.setProperty("--fan-i", String(displayIndex));
  });
}

function syncDrawView(root) {
  if (!root) return;
  const v = getDrawViewState();
  root.className = `shell table-session draw-flow draw-flow--live${v.shuffling ? " draw-flow--shuffling" : ""}${
    v.picking ? " draw-flow--picking" : ""
  }`;

  const hasReadingReady = Boolean(state.reading?.cards?.length);
  const committing = v.deckReady && v.step >= v.need && !state.fetchFailed && fetchingReading && !hasReadingReady;
  const commit = root.querySelector("[data-draw-commit]");
  if (commit) commit.hidden = !committing;
  root.classList.toggle("is-busy", committing);

  root.querySelectorAll("[data-card-fan] .fan-card").forEach((btn) => {
    btn.disabled = committing;
  });
  root.querySelectorAll("[data-reshuffle-fan], [data-back]").forEach((btn) => {
    btn.disabled = committing;
  });

  const debug = root.querySelector("[data-draw-debug]");
  if (debug) {
    debug.textContent = `build=${BUILD_ID} fetching=${fetchingReading ? 1 : 0} busy=${committing ? 1 : 0} step=${v.step}/${v.need}`;
  }

  const headline = root.querySelector("[data-draw-headline]");
  if (headline) headline.textContent = drawHeadlineText(v);

  const hint = root.querySelector("[data-draw-subline]");
  if (hint) {
    const text = drawStageHint(v);
    hint.textContent = text;
    hint.hidden = !text;
  }

  const ritual = root.querySelector("[data-shuffle-ritual]");
  if (ritual) {
    ritual.classList.toggle("is-active", v.shuffling);
    ritual.setAttribute("aria-hidden", v.shuffling ? "false" : "true");
  }

  root.querySelectorAll("[data-ghost-slot]").forEach((el, i) => {
    el.classList.toggle("is-filled", i < v.step);
    el.classList.toggle("is-current", v.deckReady && i === v.step);
  });

  const fan = root.querySelector("[data-card-fan]");
  if (fan && !fan.dataset.morphLock) {
    fan.className = buildFanClassList(v);
    fan.hidden = v.shuffling;
  }

  const pile = root.querySelector("[data-deck-pile]");
  if (pile) {
    pile.hidden = v.deckReady;
    pile.classList.toggle("is-active", v.shuffling);
  }

  const reshuffle = root.querySelector("[data-reshuffle-fan]");
  if (reshuffle) reshuffle.hidden = !(v.fanSpread && !state.fetchFailed);

  syncShuffleVisual(root);

  const back = root.querySelector("[data-back]");
  if (back) back.textContent = v.deckReady && v.step > 0 ? "撤销上一张" : "返回";
}

function runFanReshuffle(root) {
  if (!root) return;
  shuffleFanOrder();
  state.fanShuffling = true;
  const fan = root.querySelector("[data-card-fan]");
  if (fan) {
    applyFanCardLayout(fan);
    fan.classList.add("is-shuffling");
    fan.querySelectorAll(".fan-card").forEach((c) => {
      c.disabled = false;
      c.classList.remove("is-picked");
    });
  }
  syncDrawView(root);
  setTimeout(() => {
    state.fanShuffling = false;
    fan?.classList.remove("is-shuffling");
    syncDrawView(root);
  }, 520);
}

function finishDeckShuffle() {
  state.deckShuffling = false;
  state.deckReady = true;
  state.fanSpread = true;
  state.fanShuffling = true;
  state.deckShuffleStartMs = 0;
  buzz([8, 16, 8]);

  const root = app.querySelector("[data-draw-root]");
  if (!root) {
    go("draw", { scroll: false });
    return;
  }

  root.querySelector("[data-shuffle-ritual]")?.classList.remove("is-active");

  const pile = root.querySelector("[data-deck-pile]");
  if (pile) pile.classList.remove("is-active");

  const v = getDrawViewState();
  const headline = root.querySelector("[data-draw-headline]");
  if (headline) headline.textContent = drawHeadlineText(v);
  const hint = root.querySelector("[data-draw-subline]");
  if (hint) {
    hint.textContent = drawStageHint(v);
    hint.hidden = !hint.textContent;
  }
  root.classList.remove("draw-flow--shuffling");
  root.classList.add("draw-flow--picking");

  const revealFan = () => {
    const fan = root.querySelector("[data-card-fan]");
    if (!fan) return;
    fan.hidden = false;
    fan.dataset.morphLock = "1";
    fan.classList.remove("is-ritual-shuffle", "is-deck");
    fan.classList.add("is-spread-morph", "is-spread", "is-shuffling");
    requestAnimationFrame(() => {
      fan.querySelectorAll(".fan-card").forEach((card) => {
        card.style.opacity = "";
      });
    });
    setTimeout(() => {
      state.fanShuffling = false;
      state.fanSpreadSettled = true;
      delete fan.dataset.morphLock;
      fan.classList.remove("is-shuffling", "is-spread-morph");
      syncDrawView(root);
    }, 640);
  };

  if (pile) {
    setTimeout(() => {
      pile.hidden = true;
      revealFan();
    }, 360);
  } else {
    revealFan();
  }
}

function bindDrawHandlers(wrap) {
  const fan = wrap.querySelector("[data-card-fan]");
  const primary = wrap.querySelector("[data-draw-next]");
  const reshuffle = wrap.querySelector("[data-reshuffle-fan]");
  let pickLocked = false;

  const spreadFan = () => {
    if (!state.deckReady || state.deckShuffling || state.fetchFailed) return;
    if (state.fanSpread) {
      runFanReshuffle(wrap);
      return;
    }
    state.fanSpread = true;
    state.fanShuffling = true;
    shuffleFanOrder();
    applyFanCardLayout(fan);
    buzz([8, 12, 8]);
    const fanEl = wrap.querySelector("[data-card-fan]");
    fanEl?.classList.add("is-spread", "is-shuffling");
    fanEl?.classList.remove("is-deck");
    syncDrawView(wrap);
    setTimeout(() => {
      state.fanShuffling = false;
      fanEl?.classList.remove("is-shuffling");
      syncDrawView(wrap);
    }, 560);
  };

  const selectFanCard = (btn, topPick) => {
    const need = spreadCount();
    if (pickLocked || !state.fanSpread || !state.deckReady || state.fetchFailed) return;
    if (!Number.isInteger(topPick) || topPick < 0 || topPick >= FAN_PICK_SIZE) return;
    pickLocked = true;
    const slotIndex = state.pickStep;
    btn.classList.add("is-picked");
    wrap.querySelectorAll(".fan-card").forEach((c) => {
      c.disabled = true;
    });
    buzz(10);
    state.selectedSlots.push(topPick);
    state.pickStep += 1;
    const posLabel = spreadPositions()[Math.min(slotIndex, spreadPositions().length - 1)];
    const ghost = wrap.querySelector(`[data-ghost-slot="${slotIndex}"]`);
    ghost?.classList.add("is-filled", "is-landing");
    toast(`「${posLabel}」位已就位`);
    setTimeout(() => {
      ghost?.classList.remove("is-landing");
      pickLocked = false;
      if (state.pickStep >= need) {
        fetchReading();
        return;
      }
      state.fanSpread = true;
      runFanReshuffle(wrap);
    }, 480);
  };

  fan?.addEventListener("click", (event) => {
    if (!state.fanSpread) {
      if (state.deckReady) spreadFan();
      return;
    }
    const btn = event.target.closest("[data-fan-pick]");
    if (!btn) return;
    const topPick = Number(btn.dataset.fanPick);
    if (Number.isInteger(topPick) && topPick >= 0 && topPick < FAN_PICK_SIZE) selectFanCard(btn, topPick);
  });

  primary?.addEventListener("click", () => {
    if (!state.fetchFailed) return;
    state.fetchFailed = false;
    fetchReading();
  });

  reshuffle?.addEventListener("click", () => {
    if (!state.fanSpread || state.fetchFailed) return;
    runFanReshuffle(wrap);
  });

  wrap.querySelector("[data-back]").addEventListener("click", () => {
    const v = getDrawViewState();
    if (v.deckReady && state.pickStep > 0) {
      state.pickStep -= 1;
      state.selectedSlots.pop();
      state.fetchFailed = false;
      state.fanSpread = true;
      shuffleFanOrder();
      applyFanCardLayout(wrap.querySelector("[data-card-fan]"));
      syncDrawView(wrap);
      return;
    }
    resetDrawSession();
    go("home");
  });

  const startDeckShuffleAnim = () => {
    if (state.deckReady || state.fetchFailed || state.step !== "draw" || !state.deckShuffleStartMs) return;
    const duration = deckShuffleDuration();
    const tick = () => {
      if (state.step !== "draw") {
        cancelDeckShuffleAnim();
        return;
      }
      const root = app.querySelector("[data-draw-root]");
      if (root) syncShuffleVisual(root);
      if (performance.now() - state.deckShuffleStartMs >= duration) {
        deckShuffleAnimFrame = null;
        finishDeckShuffle();
        return;
      }
      deckShuffleAnimFrame = requestAnimationFrame(tick);
    };
    cancelDeckShuffleAnim();
    deckShuffleAnimFrame = requestAnimationFrame(tick);
  };

  if (!state.deckReady && !state.fetchFailed) {
    startDeckShuffleAnim();
  } else if (state.deckShuffling) {
    startDeckShuffleAnim();
  }
}

function isOtherFeelingQuestion(text = "") {
  const q = String(text || "").trim();
  return /他|她|对方|ta/i.test(q) && /感觉|喜欢|爱|态度|怎么想|在意|心里|爱不爱/.test(q);
}

function isStrongEmotionQuestion(text = "") {
  return /崩溃|撑不住|受不了|不想活|想死|自杀|伤害自己|睡不着|痛苦到|焦虑到|绝望|活不下去/.test(String(text || ""));
}

function drawProgressLabel() {
  const need = spreadCount();
  const step = Math.min(state.pickStep + 1, need);
  return `${step} / ${need}`;
}

/** 某张牌位的完整解读正文（翻牌 / 故事章节共用） */
function getPositionReadingFull(reading, index) {
  const card = reading?.cards?.[index];
  if (!card) return "";
  const pr = reading.summary?.aiCompact?.positionReadings?.[index];
  if (pr?.text) return stripPositionReading(pr.text, card);
  const section = reading.summary?.sections?.find((s) => {
    const t = s.title || "";
    return t.startsWith(`${card.position}｜`) || t.startsWith(`${card.position}|`);
  });
  if (section?.text) return stripPositionReading(section.text, card);
  return [card.shortHint, card.imagery, card.why].filter(Boolean).join(" ").trim();
}

function spreadActionLabels() {
  const single = state.spread === "one";
  return {
    redraw: single ? "再抽一张" : "同题再抽",
    newQuestion: single ? "换个问题" : "新的问题",
    redrawToast: single ? "同一问题，再抽一张 ✦" : "同一问题，新的牌局 ✦",
    newQuestionToast: single ? "带着新的问题再来 ✦" : "开启新的提问 ✦"
  };
}

function buzz(pattern = 8) {
  if (!navigator.vibrate) return;
  navigator.vibrate(Array.isArray(pattern) ? pattern : [pattern]);
}

function showRitualOverlay() {
  document.querySelector(".ritual-overlay")?.remove();
  const el = document.createElement("div");
  el.className = "ritual-overlay";
  el.innerHTML = `
    <div class="ritual-card" role="status" aria-live="polite">
      <div class="ritual-deal" aria-hidden="true">
        <span class="ritual-deal__deck"></span>
        <span class="ritual-deal__card c1"></span>
        <span class="ritual-deal__card c2"></span>
        <span class="ritual-deal__card c3"></span>
      </div>
      <p class="ritual-line" data-ritual-line>${ritualLines[0]}</p>
      <div class="ritual-bar" aria-hidden="true"><span data-ritual-bar style="width:18%"></span></div>
    </div>
  `;
  document.body.append(el);
  let index = 0;
  el._ritualTimer = setInterval(() => {
    index = (index + 1) % ritualLines.length;
    el.querySelector("[data-ritual-line]").textContent = ritualLines[index];
    el.querySelector("[data-ritual-bar]").style.width = `${Math.min(96, 22 + index * 24)}%`;
  }, 2200);
  return el;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hideRitualOverlay(el) {
  clearInterval(el?._ritualTimer);
  el?.remove();
}

function setDrawBusy(busy) {
  const root = app.querySelector("[data-draw-root]");
  if (!root) return;
  if (busy && state.pickStep < spreadCount()) {
    return;
  }
  syncDrawView(root);
}

async function fadeToStep(step, options = {}) {
  const current = state.step;
  if (current === step) return;
  const shouldFade = (current === "draw" && step === "reveal") || (current === "reveal" && step === "draw");
  if (!shouldFade) {
    go(step, options);
    return;
  }
  app.classList.add("app-fade");
  // ensure transition starts
  void app.offsetWidth;
  app.classList.add("app-fade--out");
  await wait(120);
  go(step, { ...options, scroll: false });
  // allow DOM to paint then fade in
  await wait(30);
  app.classList.remove("app-fade--out");
  await wait(220);
  app.classList.remove("app-fade");
}

function homeQuestionValue() {
  return (document.querySelector("#home-question")?.value || state.question || "").trim();
}

function beginReadingFromHome({ quick }) {
  const q = homeQuestionValue();
  if (q.length < 4) {
    toast("先写下你想问的一句话（至少 4 个字）");
    document.querySelector("#home-question")?.focus();
    buzz([6, 12, 6]);
    return;
  }
  state.question = q;
  state.quickPath = quick;
  state.spread = quick ? "one" : "three";
  state.theme = inferThemeFromQuestion(q);
  state.mood = inferMoodFromQuestion(q);
  state.reading = null;
  state.revealed = [];
  state.resonanceCard = null;
  state.resonanceAngle = "";
  state.followupFocus = "";
  state.readingFeedback = "";
  state.reportExpanded = false;
  resetDrawSession();
  buzz([8, 18, 8]);
  go("draw");
}

function buildFanCardsMarkup() {
  if (!state.fanOrder?.length) shuffleFanOrder();
  const center = (FAN_PICK_SIZE - 1) / 2;
  return state.fanOrder
    .map((pickIndex, displayIndex) => {
      const offset = displayIndex - center;
      const angle = offset * 13;
      const lift = Math.round(Math.abs(offset) * 10);
      const spreadX = offset * 26;
      const z = displayIndex + 1;
      return `
        <button
          type="button"
          class="choose-card fan-card"
          data-fan-pick="${pickIndex}"
          style="--fan-angle:${angle}deg;--fan-lift:${lift}px;--fan-x:${spreadX}px;--fan-z:${z};--fan-i:${displayIndex}"
          aria-label="选择牌堆顶第 ${pickIndex + 1} 候选（整副 ${FULL_DECK_SIZE} 张已洗匀）"
        >
          <span class="choose-card__glow" aria-hidden="true"></span>
          <span class="choose-card__back"></span>
          <span class="choose-card__shimmer" aria-hidden="true"></span>
        </button>
      `;
    })
    .join("");
}

function slotReadingBlock(reading, index) {
  const card = reading?.cards?.[index];
  if (!card) return "";
  const text = getPositionReadingFull(reading, index);
  const basis = [card.element ? `${card.element}元素` : "", card.imagery || ""].filter(Boolean).join(" · ");
  return `
    <div class="slot-reading" data-slot-reading hidden>
      <p class="slot-reading__label">${escapeHtml(card.position)} · 说给你听</p>
      <p class="slot-reading__text">${escapeHtml(text)}</p>
      ${basis ? `<p class="slot-reading__basis"><span>牌理</span>${escapeHtml(basis)}</p>` : ""}
    </div>
  `;
}

function redrawSameQuestion() {
  state.selectedSlots = [];
  state.pickStep = 0;
  state.slotPool = null;
  resetDrawSession();
  state.reading = null;
  state.revealed = [];
  state.resonanceCard = null;
  state.resonanceAngle = "";
  state.followupFocus = "";
  state.readingFeedback = "";
  state.reportExpanded = false;
  buzz(10);
  toast(spreadActionLabels().redrawToast);
  go("draw");
}

function sectionText(reading, title) {
  return reading.summary?.sections?.find((item) => item.title === title)?.text || "";
}

function sectionListFirst(reading, title) {
  const section = reading.summary?.sections?.find((item) => item.title === title);
  if (section?.list?.length) return section.list[0];
  return section?.text || "";
}

function isSimilarSummaryCopy(a, b) {
  const left = String(a || "").replace(/\s/g, "");
  const right = String(b || "").replace(/\s/g, "");
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  return left.slice(0, 18) === right.slice(0, 18);
}

function reportTeaser(reading) {
  const compact = reading.summary?.aiCompact;
  const brief =
    sectionText(reading, "浓缩总结")
    || compact?.briefSummary
    || "";
  const summary =
    brief
    || sectionText(reading, "此刻的状态")
    || compact?.presentState
    || sectionText(reading, "总结")
    || compact?.directAnswer
    || "";
  return {
    keyword: reading.summary?.keyword || "星月指引",
    brief,
    summary,
    star:
      sectionText(reading, "最后想留给你的一句话")
      || compact?.closingLine
      || sectionText(reading, "今日星语")
      || "愿你温柔且清醒地前行。",
    action:
      sectionListFirst(reading, "接下来你可以温柔地尝试")
      || reading.summary?.action
      || sectionText(reading, "行动建议")
      || ""
  };
}

function render() {
  const screens = {
    home: renderHome,
    theme: renderTheme,
    mood: renderMood,
    question: renderQuestion,
    spread: renderSpread,
    draw: renderDraw,
    reveal: renderReveal,
    report: renderReport,
    history: renderHistory
  };
  app.innerHTML = "";
  app.append(screens[state.step]());
}

function screen(children, className = "") {
  const el = document.createElement("section");
  el.className = `screen ${className}`.trim();
  el.append(children);
  return el;
}

function panel(title, subtitle, body, stepText) {
  const shell = document.createElement("div");
  shell.className = "shell panel";
  shell.innerHTML = `
    <div class="step-header">
      <div>
        <p class="eyebrow">Moonlit Tarot</p>
        <h2>${title}</h2>
        <p class="lede">${subtitle}</p>
      </div>
      <div class="progress">${stepText}</div>
    </div>
  `;
  shell.append(body);
  return shell;
}

function renderHome() {
  const shell = document.createElement("div");
  shell.className = "shell hero home-compact";
  const presets = questions.relationship.slice(0, 3);
  shell.innerHTML = `
    <div class="home-layout">
      <header class="home-intro">
        <p class="eyebrow">Moonlit Tarot</p>
        <h1>星月少女塔罗馆</h1>
        <p class="lede">写下你的问题，从扇形牌阵里凭直觉点一张。翻开就能看见牌给你的话。</p>
      </header>
      <div class="home-question panel">
        <label class="home-question__label" for="home-question">你今天想问什么？</label>
        <textarea id="home-question" placeholder="例如：这段关系里，我最需要看清什么？" maxlength="120">${escapeHtml(state.question)}</textarea>
        <div class="chips home-chips" data-home-chips></div>
      </div>
      <div class="home-hero-deck">
        <button type="button" class="home-hero-card" data-hero-start aria-label="点击卡牌开始">
          <span class="choose-card__glow" aria-hidden="true"></span>
          <span class="choose-card__back"></span>
          <span class="choose-card__shimmer" aria-hidden="true"></span>
          <span class="home-hero-card__cta">点击卡牌开始</span>
        </button>
        <p class="home-hero-deck__hint">整副 78 张洗匀后抽取 · 写好问题点牌或选张数</p>
      </div>
      <div class="home-fan-preview" aria-hidden="true">
        <div class="card-fan card-fan--preview is-spread">
          ${buildFanCardsMarkup()}
        </div>
      </div>
      <div class="home-actions">
        <button class="btn primary home-actions__main" type="button" data-start-one>抽 1 张 · 快速照见</button>
        <button class="btn secondary" type="button" data-start-three>抽 3 张 · 看清局面</button>
        <button class="btn ghost" type="button" data-history>抽卡记录</button>
      </div>
    </div>
  `;
  const textarea = shell.querySelector("#home-question");
  textarea.addEventListener("input", () => {
    state.question = textarea.value;
  });
  const chips = shell.querySelector("[data-home-chips]");
  presets.forEach((text) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      state.question = text;
      textarea.value = text;
      textarea.focus();
    });
    chips.append(chip);
  });
  shell.querySelector("[data-hero-start]")?.addEventListener("click", () => {
    const q = homeQuestionValue();
    if (q.length < 4) {
      toast("先写下你想问的一句话（至少 4 个字）");
      document.querySelector("#home-question")?.focus();
      buzz([6, 12, 6]);
      return;
    }
    beginReadingFromHome({ quick: false });
  });
  shell.querySelector("[data-start-one]").addEventListener("click", () => beginReadingFromHome({ quick: true }));
  shell.querySelector("[data-start-three]").addEventListener("click", () => beginReadingFromHome({ quick: false }));
  shell.querySelector("[data-history]").addEventListener("click", () => go("history"));
  return screen(shell);
}

function renderTheme() {
  const grid = document.createElement("div");
  grid.className = "grid";
  themes.forEach(([id, title, desc]) => {
    grid.append(option(title, desc, state.theme === id, () => {
      state.theme = id;
      state.quickPath = false;
      state.mood = "calmChaos";
      setTimeout(() => go("question"), 120);
    }));
  });
  return screen(panel("这次先看哪一类事？", "只选一个方向就够了。不要把问题讲完整，牌会从你的反应里继续收窄。", grid, "1 / 4"));
}

function renderMood() {
  const grid = document.createElement("div");
  grid.className = "grid";
  moods.forEach(([id, title, desc]) => {
    grid.append(option(title, desc, state.mood === id, () => {
      state.mood = id;
      setTimeout(() => go("question"), 120);
    }));
  });
  return screen(panel("先听一下此刻的心情", "这一步会影响最后的 AI 解读语气，让它更像在回应现在的你。", grid, "2 / 5"));
}

function renderQuestion() {
  const quick = state.quickPath;
  const box = document.createElement("div");
  box.className = "question-box";
  // 单张速读没有选过主题，给一组通用的好问题；完整流程用主题预设
  const presets = quick
    ? ["我此刻最需要看见什么？", "关于这件事，我忽略了什么？", "我现在该把力气放在哪里？", "对这个选择，我内心真正的声音是什么？"]
    : (questions[state.theme] || questions.relationship);
  box.innerHTML = `
    <textarea placeholder="写下你真正想问的那一件事，例如：新主管让我很焦虑，我该不该裸辞？">${state.question}</textarea>
    <p class="field-hint" data-q-hint>带着一个具体的问题抽牌，解读会更有针对性。</p>
    <div class="chips"></div>
    <div class="actions">
      <button class="btn secondary" data-back>上一步</button>
      <button class="btn primary" data-next>${quick ? "抽这一张" : "继续"}</button>
    </div>
  `;
  const textarea = box.querySelector("textarea");
  const hint = box.querySelector("[data-q-hint]");
  const syncQuestionEthics = () => {
    const ethics = box.querySelector(".question-ethics");
    const emotion = box.querySelector(".question-emotion");
    if (isOtherFeelingQuestion(textarea.value)) {
      if (!ethics) {
        const el = document.createElement("p");
        el.className = "question-ethics";
        el.textContent = "牌会照见你在关系里的感受与模式，不是读取对方内心的监控器。";
        hint.after(el);
      }
    } else {
      ethics?.remove();
    }
    if (isStrongEmotionQuestion(textarea.value)) {
      if (!emotion) {
        const el = document.createElement("p");
        el.className = "question-emotion";
        el.textContent = "这份感受听起来已经很重。我们可以先慢一点；如果你有伤害自己的冲动，请优先联系身边可信的人或当地紧急求助。";
        (box.querySelector(".question-ethics") || hint).after(el);
      }
    } else {
      emotion?.remove();
    }
  };
  textarea.addEventListener("input", () => {
    state.question = textarea.value;
    hint.classList.remove("is-error");
    syncQuestionEthics();
  });
  syncQuestionEthics();
  const chips = box.querySelector(".chips");
  presets.forEach((text) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      state.question = text;
      textarea.value = text;
      hint.classList.remove("is-error");
      syncQuestionEthics();
    });
    chips.append(chip);
  });
  box.querySelector("[data-back]").addEventListener("click", () => go("home"));
  box.querySelector("[data-next]").addEventListener("click", () => {
    const q = textarea.value.trim();
    if (q.length < 4) {
      hint.textContent = "先写下或点选一个你想问的问题，牌才知道要回应什么。";
      hint.classList.add("is-error");
      textarea.focus();
      buzz([6, 12, 6]);
      return;
    }
    state.question = q;
    resetDrawSession();
    go(quick ? "draw" : "spread");
  });
  const title = quick ? "先把问题说给牌听" : "把问题说给牌听";
  const subtitle = quick
    ? "单张速读：带着一个真正的问题，抽一张照见此刻。"
    : "可以直接写，也可以点选一句更接近你此刻心事的问题。";
  return screen(panel(title, subtitle, box, quick ? "快速 · 单张" : "2 / 4"));
}

function renderSpread() {
  const wrap = document.createElement("div");
  wrap.className = "grid";
  spreads.filter(([id]) => id !== "four").forEach(([id, title, desc, detail]) => {
    wrap.append(option(`${title}｜${desc}`, detail, state.spread === id, () => {
      state.spread = id;
      resetDrawSession();
      setTimeout(() => go("draw"), 120);
    }));
  });
  return screen(panel("要轻一点，还是看完整一局？", "快速就抽一张；深度默认三张。别让牌阵选择变成另一道题。", wrap, "3 / 4"));
}

function renderDraw() {
  if (state.reading?.cards?.length && state.pickStep >= spreadCount()) {
    return renderReveal();
  }

  if (!state.deckReady && !state.fetchFailed) {
    if (!state.deckShuffling) {
      state.deckShuffling = true;
      state.deckShuffleStartMs = performance.now();
      shuffleFanOrder();
    }
  }

  const need = spreadCount();
  const positions = spreadPositions();
  const step = state.pickStep;
  const shuffling = state.deckShuffling;
  const deckReady = state.deckReady && !shuffling;
  const fanSpread = state.fanSpread && deckReady;
  const picking = deckReady && fanSpread;
  const currentPos = positions[step] || positions[0];

  const hasReadingReady = Boolean(state.reading?.cards?.length);
  const committing = deckReady && step >= need && !state.fetchFailed && fetchingReading && !hasReadingReady;
  const debugFlags = `build=${BUILD_ID} fetching=${fetchingReading ? 1 : 0} busy=${committing ? 1 : 0} step=${step}/${need}`;

  const v = { need, positions, step, shuffling, deckReady, fanSpread, picking, currentPos };
  const stageHint = drawStageHint(v);
  const fanClass = buildFanClassList(v);

  const wrap = document.createElement("div");
  wrap.className = `shell table-session draw-flow draw-flow--live${shuffling ? " draw-flow--shuffling" : ""}${
    picking ? " draw-flow--picking" : ""
  }`;
  wrap.dataset.drawRoot = "1";
  wrap.innerHTML = `
    <header class="table-session__head draw-flow__head draw-flow__head--compact">
      ${drawQuestionLine()}
      <h2 class="draw-flow__title" data-draw-headline>${escapeHtml(drawHeadlineText(v))}</h2>
      <p class="draw-stage-hint" data-draw-subline ${stageHint ? "" : "hidden"}>${escapeHtml(stageHint)}</p>
    </header>
    <div class="table-surface draw-flow__table">
      <div class="table-surface__rim" aria-hidden="true"></div>
      <div class="draw-table-stage">
        <div class="draw-cosmic-mat" aria-hidden="true"></div>
        <div class="draw-commit-overlay" data-draw-commit ${committing ? "" : "hidden"} aria-live="polite">
          <div class="draw-commit-card">
            <p class="draw-commit-title">牌阵就位中…</p>
            <p class="draw-commit-sub">你的牌还在桌上。我们正在把解读写进每个牌位。</p>
            <p class="draw-commit-debug" data-draw-debug hidden>${escapeHtml(debugFlags)}</p>
            <button type="button" class="btn secondary draw-commit-exit" data-draw-force-exit>退出并重试</button>
          </div>
        </div>
        ${buildSpreadGhostMarkup(need, step, positions, deckReady)}
        <div class="draw-deck-zone" data-deck-zone>
          <div class="deck-shuffle-pile${shuffling ? " is-active" : ""}" data-deck-pile ${deckReady ? "hidden" : ""}>
            <div class="deck-stack deck-stack--draw is-shuffling">
              <span class="deck-riffle deck-riffle--left" aria-hidden="true"></span>
              <span class="deck-riffle deck-riffle--right" aria-hidden="true"></span>
              <span class="stack-card" style="--i:0"></span>
              <span class="stack-card" style="--i:1"></span>
              <span class="stack-card" style="--i:2"></span>
              <span class="stack-card" style="--i:3"></span>
              <span class="stack-card" style="--i:4"></span>
            </div>
            <p class="deck-shuffle-pile__count">整副 ${FULL_DECK_SIZE} 张 · 洗匀后露出 ${FAN_PICK_SIZE} 张候选</p>
            <p class="deck-shuffle-pile__phase" data-shuffle-phase>把整副牌分成两半…</p>
            <div class="shuffle-progress shuffle-progress--pile" aria-hidden="true">
              <span class="shuffle-progress__track"><span class="shuffle-progress__fill" data-shuffle-progress-fill style="width:8%"></span></span>
              <span class="shuffle-progress__pct" data-shuffle-progress-pct>0%</span>
            </div>
          </div>
          <div class="shuffle-ritual${shuffling ? " is-active" : ""}" data-shuffle-ritual aria-hidden="${!shuffling}">
            <span class="shuffle-ritual__ring" aria-hidden="true"></span>
            <span class="shuffle-ritual__label">洗匀中</span>
          </div>
          <div class="${fanClass}" data-card-fan ${shuffling ? "hidden" : ""}>
            ${buildFanCardsMarkup()}
          </div>
        </div>
      </div>
    </div>
    <div class="actions table-session__actions draw-flow__actions">
      <button class="btn secondary" data-back>${deckReady && step > 0 ? "撤销上一张" : "返回"}</button>
      <button class="btn secondary" data-reshuffle-fan ${fanSpread && !state.fetchFailed ? "" : "hidden"}>再理一轮</button>
      <button class="btn primary" data-draw-next ${state.fetchFailed ? "" : "hidden"}">重新解读</button>
    </div>
  `;

  bindDrawHandlers(wrap);
  // Ensure commit overlay reflects latest async flags.
  syncDrawView(wrap);
  wrap.querySelector("[data-draw-force-exit]")?.addEventListener("click", () => {
    fetchingReading = false;
    state.fetchFailed = true;
    setDrawBusy(false);
    syncDrawView(wrap);
    toast("已退出就位中，可点「重新解读」。");
  });
  return screen(wrap, "screen--draw");
}

let fetchingReading = false;

async function fetchReading() {
  if (fetchingReading) return;
  fetchingReading = true;
  state.fetchFailed = false;
  setDrawBusy(true);
  const ritualMinimum = wait(state.quickPath ? 1400 : 1800);
  buzz(12);
  let timeout = null;
  try {
    const controller = new AbortController();
    const timeoutMs = state.quickPath ? 45000 : 65000;
    timeout = setTimeout(() => controller.abort(), timeoutMs);

    const responsePromise = fetch("/api/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        theme: state.theme || inferThemeFromQuestion(state.question),
        mood: state.mood || inferMoodFromQuestion(state.question),
        question: state.question || questions.relationship[0],
        spread: state.spread,
        drawMode: "top",
        selectedSlots: state.selectedSlots
      })
    });
    const response = await responsePromise;
    clearTimeout(timeout);
    timeout = null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.reading = await response.json();
    if (!state.reading?.cards?.length) throw new Error("empty reading");
    state.theme = state.reading.theme || state.theme;
    state.mood = state.reading.mood || state.mood;
    state.revealed = state.reading.cards.map(() => false);
    state.resonanceCard = null;
    state.resonanceAngle = "";
    state.followupFocus = "";
    state.readingFeedback = "";
    state.reportExpanded = false;
    await ritualMinimum;
    toast("牌已进阵，翻开即可看见解读。");
    buzz([10, 24, 10]);
    fetchingReading = false;
    const drawRoot = app.querySelector("[data-draw-root]");
    if (drawRoot) syncDrawView(drawRoot);
    await fadeToStep("reveal");
    if (state.step === "draw") go("reveal");
  } catch (error) {
    state.fetchFailed = true;
    if (error?.name === "AbortError") {
      toast("生成解读超时了。牌已保留，可点「重新解读」。");
    } else {
      toast("解读未完成。选牌已保留，请点「重新解读」。");
    }
    setDrawBusy(false);
    fetchingReading = false;
    const root = app.querySelector("[data-draw-root]");
    if (root) syncDrawView(root);
    else go("draw", { scroll: false });
  } finally {
    fetchingReading = false;
    if (timeout) clearTimeout(timeout);
    setDrawBusy(false);
    const root = app.querySelector("[data-draw-root]");
    if (root) syncDrawView(root);
  }
}

const ELEMENT_COLORS = {
  火: "#ff8a5c",
  水: "#5cc8ff",
  风: "#d9c7ff",
  土: "#9bd6a3"
};

function nextRevealIndex() {
  if (!state.revealed?.length) return 0;
  return state.revealed.findIndex((open) => !open);
}

/** 翻牌瞬间的「牌师低语」：完整牌位解读（不截断） */
function cardWhisper(index) {
  return getPositionReadingFull(state.reading, index);
}

function coreSymbols(card, count = 3) {
  const source = Array.isArray(card?.keywords) ? card.keywords : [];
  return source.slice(0, count).join("、") || card?.shortHint?.replace(/^逆位：/, "").split(/[，。；;]/)[0] || "此刻的信号";
}

function resonanceAngles(card) {
  const keys = Array.isArray(card?.keywords) ? card.keywords : [];
  const first = keys[0] || "这张牌的表面状态";
  const second = keys[2] || keys[1] || "它背后更安静的部分";
  const positionHint = card?.position ? `${card.position}位` : "这张牌";
  return [
    ["surface", `更像「${first}」`, `${positionHint}先照见的是一个正在发生的状态：${first}。`],
    ["under", `更像「${second}」`, `这张牌也可能是在指向更深的一层：${second}。`]
  ];
}

function selectedResonanceCard(reading = state.reading) {
  const cards = reading?.cards || [];
  return Number.isInteger(state.resonanceCard) ? cards[state.resonanceCard] : null;
}

function resonanceAngleLabel(reading = state.reading) {
  const card = selectedResonanceCard(reading);
  const found = card ? resonanceAngles(card).find(([id]) => id === state.resonanceAngle) : null;
  return found?.[1]?.replace(/^更像「|」$/g, "") || "";
}

function feedbackLabel(value = state.readingFeedback) {
  return {
    yes: "有共鸣",
    off: "有点不准",
    angle: "换个角度看"
  }[value] || "";
}

function renderResonancePanel(reading) {
  const cards = reading.cards || [];
  if (!cards.length) return "";
  const picked = state.resonanceCard;
  const pickedCard = selectedResonanceCard(reading);
  const angleOptions = pickedCard ? resonanceAngles(pickedCard) : [];
  const first = cards[0];
  const second = cards[1] || cards[0];
  const prompt = cards.length > 1
    ? "这几张牌里，哪一张最像你现在的感觉？"
    : "这张牌里，哪个词最贴近你现在的感觉？";
  const contrast = cards.length > 1
    ? `你更在意「${coreSymbols(first, 1)}」，还是「${coreSymbols(second, 1)}」？`
    : `你更在意「${coreSymbols(first, 1)}」，还是它背后的停顿感？`;
  return `
    <section class="resonance-panel" aria-live="polite">
      <p class="resonance-panel__eyebrow">先别看解释</p>
      <h3>${cards.length > 1 ? "哪一张让你停了一下？" : escapeHtml(prompt)}</h3>
      <p>${escapeHtml(contrast)}</p>
      <div class="resonance-options">
        ${cards.map((card, index) => `
          <button class="resonance-chip${picked === index ? " is-selected" : ""}" type="button" data-resonance="${index}">
            <span>${escapeHtml(card.name)}</span>
            <small>${escapeHtml(coreSymbols(card))}</small>
          </button>
        `).join("")}
      </div>
      ${pickedCard ? `
        <div class="resonance-confirm">
          <p class="resonance-confirm__lead">我会先从「${escapeHtml(pickedCard.name)}」看起。它更像是在说哪一层？</p>
          <div class="resonance-confirm__options">
            ${angleOptions.map(([id, label, desc]) => `
              <button class="resonance-angle${state.resonanceAngle === id ? " is-selected" : ""}" type="button" data-resonance-angle="${id}">
                <span>${escapeHtml(label)}</span>
                <small>${escapeHtml(desc)}</small>
              </button>
            `).join("")}
          </div>
          <p class="resonance-confirm__note">这个选择会改变后面解读的重心。</p>
        </div>
      ` : ""}
      <button class="btn primary" data-report ${picked === null || !state.resonanceAngle ? "disabled" : ""}>进入分层解读</button>
    </section>
  `;
}

function readingDirectVerdict(reading = state.reading) {
  const compact = reading?.summary?.aiCompact || {};
  const section = (reading?.summary?.sections || []).find((s) => s.title === "牌师判断");
  return section?.text || compact.directVerdict || compact.directAnswer || "";
}

function updateVerdictPreview(wrap) {
  const box = wrap?.querySelector("[data-verdict-preview]");
  const textEl = wrap?.querySelector("[data-verdict-text]");
  if (!box || !textEl) return;
  const allOpen = state.revealed?.length && state.revealed.every(Boolean);
  const verdict = readingDirectVerdict();
  if (allOpen && verdict) {
    box.hidden = false;
    textEl.textContent = verdict.length > 140 ? `${verdict.slice(0, 140)}…` : verdict;
  } else {
    box.hidden = true;
    textEl.textContent = "";
  }
}

function updateRevealGuide(wrap) {
  const next = nextRevealIndex();
  const guideEl = wrap.querySelector("[data-reveal-guide]");
  const hintEl = wrap.querySelector(".reveal-table-hint");
  wrap.querySelectorAll(".reveal-slot").forEach((slot, index) => {
    const open = Boolean(state.revealed[index]);
    slot.classList.toggle("is-revealed", open);
    slot.classList.toggle("is-next", !open && index === next);
    slot.classList.toggle("is-waiting", !open && next !== -1 && index !== next);
  });
  if (next === -1) {
    if (guideEl) guideEl.textContent = "牌已全部翻开。下方即是说给你的解读。";
    if (hintEl) hintEl.textContent = "可继续查看完整报告";
    return;
  }
  const position = state.reading.cards[next].position;
  if (guideEl) guideEl.textContent = `翻开「${position}」——牌面与解读会一起出现。`;
  if (hintEl) hintEl.textContent = "轻触高亮的牌背";
}

function flipRevealCard({ index, card, el, slot, wrap, reportButton, isMajor, isReversed, syncProgress }) {
  if (state.revealed[index] || el.dataset.flipping === "1") return;
  el.dataset.flipping = "1";
  state.revealed[index] = true;
  el.classList.add("revealed", "is-flipping");
  slot.classList.add("is-revealed");
  el.setAttribute("aria-label", `${card.position}，已翻开`);
  syncProgress();
  updateRevealGuide(wrap);
  void el.offsetWidth;

  const finishFlip = () => {
    if (el.dataset.flipping !== "1") return;
    el.dataset.flipping = "0";
    el.classList.remove("is-flipping");
    el.querySelector(".face.back")?.setAttribute("aria-hidden", "true");
    el.querySelector(".face.front")?.setAttribute("aria-hidden", "false");
    const allOpen = state.revealed.every(Boolean);
    reportButton.disabled = !allOpen;
    if (allOpen) reportButton.classList.add("pulse-ready");

    const metaEl = slot.querySelector(".card-meta");
    if (metaEl) {
      metaEl.hidden = false;
      metaEl.classList.add("is-visible");
    }

    const readingEl = slot.querySelector("[data-slot-reading]");
    if (readingEl) {
      readingEl.hidden = false;
      readingEl.classList.add("is-visible");
    }

    const whisperEl = wrap.querySelector("[data-whisper]");
    if (whisperEl) {
      const full = cardWhisper(index);
      const snippet = full.length > 88 ? `${full.slice(0, 88)}…` : full;
      whisperEl.textContent = `${card.name} · ${card.orientation} — ${snippet}`;
      whisperEl.classList.remove("show");
      void whisperEl.offsetWidth;
      whisperEl.classList.add("show");
    }
    slot.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const glow = wrap.querySelector(".reveal-table-glow");
    const elemColor = ELEMENT_COLORS[card.element];
    if (glow && elemColor) glow.style.setProperty("--glow-elem", elemColor);
    if (isMajor) {
      el.classList.add("burst");
      slot.classList.add("slot-burst");
      toast("✦ 大阿卡那降临 — 能量格外清晰");
      buzz([10, 30, 12]);
    } else if (isReversed) {
      toast("逆位：能量尚未顺畅，请结合牌意阅读");
      buzz(6);
    } else {
      buzz(8);
    }
    if (allOpen) {
      toast("翻开完成，可查看完整报告。");
      buzz([8, 20, 8]);
    }
    updateVerdictPreview(wrap);
  };

  const inner = el.querySelector(".tarot-inner");
  let done = false;
  const onTransitionEnd = (event) => {
    if (event.target !== inner || event.propertyName !== "transform") return;
    if (done) return;
    done = true;
    inner.removeEventListener("transitionend", onTransitionEnd);
    finishFlip();
  };
  inner.addEventListener("transitionend", onTransitionEnd);
  setTimeout(() => {
    if (!done) {
      done = true;
      inner.removeEventListener("transitionend", onTransitionEnd);
      finishFlip();
    }
  }, 900);
}

function renderReveal() {
  const spreadId = state.spread || "three";
  const total = state.reading.cards.length;
  const actions = spreadActionLabels();
  const single = spreadId === "one";
  if (!state.revealed?.length || state.revealed.length !== total) {
    state.revealed = state.reading.cards.map(() => false);
  }
  const wrap = document.createElement("div");
  wrap.className = `shell table-session reveal-layout reveal-layout--${spreadId} theme-${state.theme || "self"}`;
  wrap.innerHTML = `
    <div class="reveal-stage">
      <aside class="reveal-side panel">
        <p class="eyebrow">星月牌桌 · 翻牌</p>
        <h2>${single ? "翻开这一张" : "按顺序翻开"}</h2>
        <p class="lede">翻开即看见牌面与解读。先读给你听的那段话，再决定是否看完整报告。</p>
        ${askBanner()}
        <p class="reveal-guide" data-reveal-guide aria-live="polite"></p>
        <div class="reveal-progress" aria-live="polite">
          <span class="reveal-progress-label">已翻开 <strong data-revealed-count>0</strong> / ${total}</span>
          <span class="reveal-progress-track" aria-hidden="true"><span class="reveal-progress-fill" data-reveal-fill></span></span>
        </div>
        <div class="reveal-verdict-preview" data-verdict-preview hidden>
          <p class="reveal-verdict-preview__label">牌师判断 · 预览</p>
          <p class="reveal-verdict-preview__text" data-verdict-text></p>
        </div>
      </aside>
      <div class="reveal-main">
        <div class="table-surface reveal-table">
          <div class="table-surface__rim" aria-hidden="true"></div>
          <div class="reveal-table-glow" aria-hidden="true"></div>
          <div class="reading-cards reveal-deck reveal-deck--${spreadId}"></div>
          <p class="reveal-table-hint">${single ? "轻触牌背翻开" : "轻触高亮牌背，按牌位顺序翻开"}</p>
          <p class="reveal-whisper" data-whisper aria-live="polite"></p>
        </div>
      </div>
    </div>
    <div class="actions reveal-actions table-session__actions">
      <button class="btn secondary" data-redraw>${actions.redraw}</button>
      <button class="btn secondary" data-newq>${actions.newQuestion}</button>
      <button class="btn primary" data-report disabled>查看完整报告</button>
    </div>
  `;
  const deck = wrap.querySelector(".reading-cards");
  const reportButton = wrap.querySelector("[data-report]");
  const countEl = wrap.querySelector("[data-revealed-count]");
  const fillEl = wrap.querySelector("[data-reveal-fill]");

  const syncProgress = () => {
    const opened = state.revealed.filter(Boolean).length;
    countEl.textContent = String(opened);
    fillEl.style.width = `${(opened / total) * 100}%`;
    wrap.classList.toggle("reveal-complete", opened === total);
  };

  state.reading.cards.forEach((card, index) => {
    const slot = document.createElement("div");
    slot.className = "reveal-slot";
    slot.dataset.cardIndex = String(index);
    slot.style.setProperty("--slot", index);
    slot.style.setProperty("--stagger", index);
    if (state.revealed[index]) slot.classList.add("is-revealed");

    const label = document.createElement("span");
    label.className = "slot-label";
    label.innerHTML = `<span class="slot-label__order">${index + 1}</span><span class="slot-label__name">${escapeHtml(card.position)}</span>`;

    const el = document.createElement("button");
    const isMajor = card.arcana === "大阿卡那";
    const isReversed = card.orientation === "逆位";
    el.type = "button";
    el.style.setProperty("--stagger", index);
    el.className = [
      "tarot-card",
      state.revealed[index] ? "revealed" : "",
      isMajor ? "is-major" : "",
      isReversed ? "is-reversed" : ""
    ].filter(Boolean).join(" ");
    const elemColor = ELEMENT_COLORS[card.element];
    if (elemColor) el.style.setProperty("--elem-color", elemColor);
    el.setAttribute("aria-label", `${card.position}，${state.revealed[index] ? "已翻开" : "点击翻开"}`);
    const basisLine = [card.element ? `${card.element}元素` : "", card.numerologyStage || "", card.imagery || ""]
      .filter(Boolean)
      .join(" · ");
    const keywords = (card.keywords || []).slice(0, 3).join(" · ");

    el.innerHTML = `
      <div class="tarot-inner">
        <div class="face back" aria-hidden="${state.revealed[index] ? "true" : "false"}">
          <span class="choose-card__glow" aria-hidden="true"></span>
          <span class="choose-card__back"></span>
          <span class="choose-card__shimmer" aria-hidden="true"></span>
          <span class="card-tap-hint">翻开</span>
        </div>
        <div class="face front" aria-hidden="${state.revealed[index] ? "false" : "true"}">
          <img class="card-image" src="${card.image}" alt="${card.name} ${card.nameEn} 卡面图" draggable="false">
        </div>
      </div>
    `;

    const meta = document.createElement("div");
    meta.className = `card-meta${state.revealed[index] ? " is-visible" : ""}`;
    meta.hidden = !state.revealed[index];
    meta.innerHTML = `
      <h3 class="card-name">${escapeHtml(card.name)}</h3>
      <div class="orientation">${escapeHtml(card.orientation)}</div>
      ${keywords ? `<p class="card-keywords">${escapeHtml(keywords)}</p>` : ""}
    `;

    const triggerFlip = (event) => {
      event.preventDefault();
      event.stopPropagation();
      flipRevealCard({ index, card, el, slot, wrap, reportButton, isMajor, isReversed, syncProgress });
    };

    el.addEventListener("click", triggerFlip);
    el.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      triggerFlip(event);
    });

    slot.append(label, el, meta);
    const readingWrap = document.createElement("div");
    readingWrap.innerHTML = slotReadingBlock(state.reading, index);
    const readingEl = readingWrap.firstElementChild;
    if (state.revealed[index]) {
      readingEl.hidden = false;
      readingEl.classList.add("is-visible");
    }
    slot.append(readingEl);
    deck.append(slot);
  });

  wrap.querySelector("[data-redraw]").addEventListener("click", redrawSameQuestion);
  wrap.querySelector("[data-newq]").addEventListener("click", resetAll);
  reportButton.disabled = !state.revealed.every(Boolean);
  if (!reportButton.disabled) reportButton.classList.add("pulse-ready");
  reportButton.addEventListener("click", () => go("report"));
  syncProgress();
  updateRevealGuide(wrap);
  updateVerdictPreview(wrap);
  return screen(wrap, "screen--reveal");
}

function bindResonancePanel(root) {
  const reportButtons = root.querySelectorAll("[data-report]");
  const syncResonanceVisual = () => {
    const picked = state.resonanceCard;
    root.classList.toggle("has-resonance-card", picked !== null);
    root.querySelectorAll(".reveal-slot").forEach((slot) => {
      const active = Number(slot.dataset.cardIndex) === picked;
      slot.classList.toggle("is-resonance", active);
      slot.classList.toggle("is-dimmed", picked !== null && !active);
    });
  };
  const syncReportButtons = () => {
    const ready = state.resonanceCard !== null && Boolean(state.resonanceAngle);
    reportButtons.forEach((button) => {
      button.disabled = !ready;
      button.classList.toggle("pulse-ready", ready);
    });
  };
  root.querySelectorAll("[data-resonance]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.resonanceCard = Number(btn.dataset.resonance);
      state.resonanceAngle = "";
      root.querySelector("[data-resonance-host]").innerHTML = renderResonancePanel(state.reading);
      bindResonancePanel(root);
      syncResonanceVisual();
      buzz(8);
    });
  });
  root.querySelectorAll("[data-resonance-angle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.resonanceAngle = btn.dataset.resonanceAngle;
      root.querySelector("[data-resonance-host]").innerHTML = renderResonancePanel(state.reading);
      bindResonancePanel(root);
      syncResonanceVisual();
      buzz([6, 16, 6]);
    });
  });
  syncResonanceVisual();
  syncReportButtons();
  const panelReport = root.querySelector(".resonance-panel [data-report]");
  panelReport?.addEventListener("click", () => {
    if (state.resonanceCard !== null && state.resonanceAngle) go("report");
  });
}

function renderReport() {
  const reading = state.reading;
  const actions = spreadActionLabels();
  const story = collectStoryData(reading);
  const resonanceCard = selectedResonanceCard(reading);
  const angleLabel = resonanceAngleLabel(reading);
  const fbLabel = feedbackLabel();
  const wrap = document.createElement("div");
  wrap.className = `shell report theme-${reading.theme || state.theme || "self"}`;
  const cardImages = reading.cards.map((card) => `
    <figure class="mini-card ${card.arcana === "大阿卡那" ? "is-major" : ""}">
      <img src="${card.image}" alt="${card.name} 卡面图">
      <figcaption>${card.position}</figcaption>
    </figure>
  `).join("");
  wrap.innerHTML = `
    <aside class="report-card" id="report-card">
      <p class="eyebrow">${reading.date}</p>
      <h2>星月报告</h2>
      <div class="mini-spread">${cardImages}</div>
      <div class="report-meta">
        <div class="meta-row"><span>问题</span><strong>${escapeHtml(reading.question)}</strong></div>
        <div class="meta-row"><span>主题</span><strong>${reading.themeLabel}</strong></div>
        <div class="meta-row"><span>故事关键词</span><strong>${escapeHtml(story.headline)}</strong></div>
        ${resonanceCard ? `<div class="meta-row"><span>共鸣牌</span><strong>${escapeHtml(resonanceCard.name)}</strong></div>` : ""}
        ${angleLabel ? `<div class="meta-row"><span>确认层</span><strong>${escapeHtml(angleLabel)}</strong></div>` : ""}
        ${fbLabel ? `<div class="meta-row"><span>校准反馈</span><strong>${escapeHtml(fbLabel)}</strong></div>` : ""}
        <div class="meta-row"><span>幸运色</span><strong>${reading.summary.luckyColor}</strong></div>
      </div>
      <div class="actions report-loop">
        <button class="btn primary" data-save>保存结果</button>
        <button class="btn secondary" data-redraw>${actions.redraw}</button>
        <button class="btn secondary" data-newq>${actions.newQuestion}</button>
        <button class="btn secondary" data-history>抽卡记录</button>
      </div>
    </aside>
    <section class="summary panel story-panel">
      <div class="summary-head">
      <div>
          <p class="eyebrow">Layered Reading</p>
          <h2>分层解读</h2>
          <p class="summary-subtitle">先给你一句基于牌面的判断，再展开每张牌与可执行的小步。</p>
        </div>
        ${readingSourceBadge(reading)}
      </div>
      ${renderTarotStory(reading)}
    </section>
  `;
  wrap.querySelector("[data-save]").addEventListener("click", saveResult);
  wrap.querySelector("[data-redraw]").addEventListener("click", redrawSameQuestion);
  wrap.querySelector("[data-newq]").addEventListener("click", resetAll);
  wrap.querySelector("[data-history]").addEventListener("click", () => go("history"));
  wrap.querySelectorAll("[data-followup]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.followupFocus = btn.dataset.followup;
      go("report", { scroll: false });
    });
  });
  wrap.querySelectorAll("[data-feedback]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.readingFeedback = btn.dataset.feedback;
      go("report", { scroll: false });
    });
  });
  initStoryReveal(wrap);
  return screen(wrap);
}

function initStoryReveal(root) {
  const nodes = root.querySelectorAll(".story-prologue, .story-layer, .story-chapter, .story-turn, .story-beat, .story-followup, .story-feedback, .story-finale");
  if (!nodes.length || !("IntersectionObserver" in window)) {
    nodes.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  nodes.forEach((el) => observer.observe(el));
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem("moonlit-tarot-history") || "[]");
  const body = document.createElement("div");
  body.innerHTML = `
    ${history.length ? renderHistoryInsights(history) : ""}
    <div class="history-list">
      ${history.length ? history.map((item, index) => historyItem(item, index)).join("") : `
        <article class="history-empty">
          <h3>还没有保存的报告</h3>
          <p>完成一次抽卡后，可以在结果页保存它。那些曾经让你犹豫的瞬间，也会慢慢变成你成长的线索。</p>
        </article>
      `}
    </div>
    <div class="actions">
      <button class="btn primary" data-new>开始新的抽卡</button>
      <button class="btn secondary" data-home>返回首页</button>
    </div>
  `;
  body.querySelector("[data-new]").addEventListener("click", resetAll);
  body.querySelector("[data-home]").addEventListener("click", () => go("home"));
  return screen(panel("我的抽卡记录", "这里保存最近 12 次报告，适合回看当时的心情和后来发生的变化。", body, "History"));
}

function topCount(items) {
  const counts = items.filter(Boolean).reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || null;
}

function renderHistoryInsights(history) {
  const recent = history.slice(0, 5);
  const theme = topCount(recent.map((item) => item.themeLabel || item.theme));
  const resonance = topCount(recent.map((item) => item.interaction?.resonanceCard));
  const feedback = topCount(recent.map((item) => feedbackLabel(item.interaction?.readingFeedback)));
  const decisionCount = recent.filter((item) => /该不该|要不要|继续|离开|放弃|选择/.test(item.question || "")).length;
  const lines = [];
  if (theme && theme[1] > 1) lines.push(`最近 ${recent.length} 次里，你有 ${theme[1]} 次在看「${theme[0]}」。`);
  if (resonance && resonance[1] > 1) lines.push(`你反复停在「${resonance[0]}」，这张牌可能是近期最常出现的入口。`);
  if (decisionCount >= 2) lines.push(`你反复在问选择题。也许你不是没有答案，而是在等一个外部许可。`);
  if (feedback && feedback[1] > 1) lines.push(`你的校准反馈常是「${feedback[0]}」，这会影响下次解读该更直接还是更换角度。`);
  if (!lines.length) lines.push("记录还不多。等多抽几次，这里会开始显示你反复绕回的主题。");
  return `
    <section class="history-insights">
      <p class="eyebrow">Repeated Pattern</p>
      <h3>最近的回声</h3>
      <ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    </section>
  `;
}

function option(title, desc, selected, onClick) {
  const button = document.createElement("button");
  button.className = `option ${selected ? "selected" : ""}`;
  button.innerHTML = `<strong>${title}</strong><span>${desc}</span>`;
  button.addEventListener("click", onClick);
  return button;
}

function readingSourceBadge(reading) {
  if (reading?.aiPowered) {
    return `
      <div class="reading-source is-ai" role="status" aria-label="本解读由 AI 生成">
        <span class="reading-source-dot" aria-hidden="true"></span>
        <span class="reading-source-text">本解读由 AI 生成</span>
      </div>
    `;
  }
  const note = reading?.aiError ? escapeHtml(reading.aiError) : "当前为本地精简版解读";
  return `
    <div class="reading-source is-fallback" role="status" aria-label="精简版解读">
      <span class="reading-source-dot" aria-hidden="true"></span>
      <span class="reading-source-text">精简版解读</span>
      <span class="reading-source-note">${note}</span>
    </div>
  `;
}

function moodLabel(moodId) {
  return moods.find(([id]) => id === moodId)?.[1] || "";
}

function organizeSummarySections(reading) {
  const sections = reading.summary?.sections || [];
  const organized = {
    directVerdict: null,
    briefSummary: null,
    presentState: null,
    innerTheme: null,
    reminders: null,
    positionReadings: [],
    innerTension: null,
    reflectionQuestions: null,
    gentleActions: null,
    closingLine: null,
    other: []
  };

  for (const section of sections) {
    const title = section.title || "";
    if (title === "牌师判断") organized.directVerdict = section;
    else if (title === "浓缩总结") organized.briefSummary = section;
    else if (title === "此刻的状态") organized.presentState = section;
    else if (title === "你内心正在关注的主题") organized.innerTheme = section;
    else if (title === "这次抽卡给你的提醒") organized.reminders = section;
    else if (title.includes("｜")) organized.positionReadings.push(section);
    else if (title === "内心的拉扯点") organized.innerTension = section;
    else if (title === "可以陪你想一想的问题") organized.reflectionQuestions = section;
    else if (title === "接下来你可以温柔地尝试") organized.gentleActions = section;
    else if (title === "最后想留给你的一句话") organized.closingLine = section;
    else organized.other.push(section);
  }

  return organized;
}

function cardForSectionTitle(reading, title) {
  const [position, name] = String(title || "").split("｜").map((part) => part.trim());
  return reading.cards?.find((card) => card.name === name || card.position === position);
}

function renderVisualJourney(reading, { compact = false } = {}) {
  const cards = reading.cards || [];
  if (!cards.length) return "";

  const nodes = cards.map((card, index) => `
    <div class="visual-journey__node ${compact ? "is-compact" : ""}">
      <div class="visual-journey__thumb ${card.arcana === "大阿卡那" ? "is-major" : ""} ${card.orientation === "逆位" ? "is-reversed" : ""}">
        <img src="${card.image}" alt="${escapeHtml(card.name)}">
        <span class="visual-journey__orient">${card.orientation === "逆位" ? "逆" : "正"}</span>
      </div>
      <span class="visual-journey__pos">${escapeHtml(card.position)}</span>
      ${compact ? "" : `<span class="visual-journey__name">${escapeHtml(card.name)}</span>`}
      ${index < cards.length - 1 ? `<span class="visual-journey__line" aria-hidden="true"></span>` : ""}
    </div>
  `).join("");

  return `
    <div class="visual-journey ${compact ? "is-compact" : ""}" role="img" aria-label="牌阵旅程：${cards.map((c) => c.position).join("、")}">
      ${nodes}
    </div>
  `;
}

function renderSpreadValenceChips(reading) {
  const labels = reading.summary?.aiCompact?.spreadTone?.labels
    || (reading.cards || []).map((card) => ({
      position: card.position,
      name: card.name,
      valence: inferCardValenceLabel(card)
    }));
  if (!labels.length) return "";
  const text = labels.map((item) => `${item.position}${item.valence}`).join(" · ");
  return renderVisualChip("牌阵基调", text);
}

function inferCardValenceLabel(card) {
  const keys = (card.keywords || []).join("");
  const challenge =
    /崩|破|冲突|恐惧|失败|损失|消耗|束缚|延迟|受阻|拖延|结束|打破|恶魔|高塔|宝剑九|宝剑十|圣杯五|权杖十|星币五|月亮|坏消息|算计|封闭|悲伤|内耗|失衡|轻率|操控|抗拒|诱惑|混乱|不公|疲惫|压力/.test(
      keys
    )
    || /高塔|恶魔|宝剑九|宝剑十|圣杯五|权杖十|星币五|月亮/.test(card.name || "");
  const support =
    /希望|疗愈|完成|明朗|喜悦|丰盛|吸引|和谐|整合|重生|转机|资源|清晰|平衡|勇气|缓和|减压|解脱|改善|复苏|走出|回流/.test(
      keys
    )
    || /太阳|星星|世界/.test(card.name || "");
  if (challenge && !support) return "挑战";
  if (support && !challenge) return "支持";
  return "中性";
}

function renderVisualChip(label, value) {
  if (!value) return "";
  return `
    <span class="visual-chip">
      <span class="visual-chip__label">${escapeHtml(label)}</span>
      <span class="visual-chip__value">${escapeHtml(value)}</span>
    </span>
  `;
}

function renderVisualModule({ kind, title, text, list, emphasis = false }) {
  const icons = {
    state: "☽",
    theme: "≋",
    reminders: "✦",
    tension: "⇄",
    questions: "?",
    actions: "↳",
    closing: "✧"
  };
  const body = list?.length
    ? `<ol class="visual-module__list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`
    : `<div class="visual-module__text">${formatSectionText(text)}</div>`;

  return `
    <article class="visual-module visual-module--${kind} ${emphasis ? "is-emphasis" : ""}">
      <div class="visual-module__head">
        <span class="visual-module__icon" aria-hidden="true">${icons[kind] || "✦"}</span>
        <h3>${escapeHtml(title)}</h3>
      </div>
      ${body}
    </article>
  `;
}

function renderVisualPositionCards(reading, sections) {
  if (!sections.length) return "";

  const cards = sections.map((section) => {
    const card = cardForSectionTitle(reading, section.title);
    const [position, name] = section.title.split("｜").map((part) => part.trim());
    const media = card
      ? `
        <div class="visual-position__media ${card.arcana === "大阿卡那" ? "is-major" : ""} ${card.orientation === "逆位" ? "is-reversed" : ""}">
          <img src="${card.image}" alt="${escapeHtml(card.name)}">
          <span class="visual-position__orient">${card.orientation === "逆位" ? "逆位" : "正位"}</span>
        </div>
      `
      : `<div class="visual-position__media is-placeholder"><span>✦</span></div>`;

    const basis = card
      ? [card.element ? `${card.element}元素` : "", card.numerologyStage || "", card.imagery || ""]
          .filter(Boolean)
          .join(" · ")
      : "";
    return `
      <article class="visual-position">
        ${media}
        <div class="visual-position__body">
          <p class="visual-position__meta">
            <span class="visual-position__pos">${escapeHtml(position)}</span>
            <span class="visual-position__name">${escapeHtml(name || card?.name || "")}</span>
          </p>
          <div class="visual-position__text">${formatSectionText(section.text)}</div>
          ${basis ? `<p class="visual-position__basis"><span>牌理依据</span>${escapeHtml(basis)}</p>` : ""}
        </div>
      </article>
    `;
  }).join("");

  return `
    <section class="visual-positions" aria-label="逐张牌解读">
      <h3 class="visual-positions__title">牌面解读图谱</h3>
      <div class="visual-positions__grid">${cards}</div>
    </section>
  `;
}

function stripPositionReading(text, card) {
  let body = String(text || "").trim();
  const prefix = new RegExp(`^${card.position}[·•][^：:]{0,28}[：:]\\s*`);
  body = body.replace(prefix, "");
  const namePrefix = new RegExp(`^${card.name}(（${card.orientation}）|${card.orientation}|正位|逆位)?[：:]\\s*`, "g");
  body = body.replace(namePrefix, "").trim();
  return body || card.shortHint || "";
}

function stripVerdictPrefix(text) {
  return String(text || "")
    .replace(/^就你问的[「『][^」』]+[」』]：\s*/, "")
    .replace(/^就你问的[^：]+：\s*/, "")
    .trim();
}

function collectStoryData(reading) {
  const organized = organizeSummarySections(reading);
  const compact = reading.summary?.aiCompact || {};
  const cards = reading.cards || [];

  const positionMap = {};
  organized.positionReadings.forEach((section) => {
    const card = cardForSectionTitle(reading, section.title);
    if (card) positionMap[card.position] = stripPositionReading(section.text, card);
  });
  (compact.positionReadings || []).forEach((item) => {
    if (!positionMap[item.position]) {
      const card = cards.find((c) => c.position === item.position);
      positionMap[item.position] = card ? stripPositionReading(item.text, card) : item.text;
    }
  });

  const chapters = cards.map((card, index) => {
    const meta = CHAPTER_META[card.position] || { bridge: "这张牌在这个位置说——", role: card.position };
    return {
      act: ACT_LABELS[index] || `第${index + 1}章`,
      card,
      bridge: meta.bridge,
      role: meta.role,
      text: positionMap[card.position] || card.shortHint || "",
      valence: inferCardValenceLabel(card)
    };
  });

  const resonanceIndex = Number.isInteger(state.resonanceCard) ? state.resonanceCard : null;
  const resonance = resonanceIndex !== null ? cards[resonanceIndex] : null;
  const resonanceChapter = resonance ? chapters.find((chapter) => chapter.card === resonance) : null;
  const resonanceAngle = resonance ? resonanceAngles(resonance).find(([id]) => id === state.resonanceAngle) : null;

  const directVerdict = stripVerdictPrefix(
    organized.directVerdict?.text
      || compact.directVerdict
      || compact.directAnswer
      || ""
  );
  const briefSummary = organized.briefSummary?.text || compact.briefSummary || "";
  return {
    headline: compact.headline || reading.summary?.keyword || "星月指引",
    directVerdict,
    briefSummary,
    descriptionLayer: compact.descriptionLayer || "",
    situationLayer: compact.situationLayer || "",
    meaningLayer: compact.meaningLayer || "",
    mirror: briefSummary
      || (directVerdict ? "" : organized.presentState?.text || compact.presentState || ""),
    presentState: organized.presentState?.text && !isSimilarSummaryCopy(organized.presentState.text, organized.briefSummary?.text || compact.briefSummary)
      ? organized.presentState.text
      : "",
    chapters,
    reframe: organized.innerTheme?.text || compact.innerTheme || "",
    tension: organized.innerTension?.text || compact.innerTension || "",
    reminders: organized.reminders?.list || compact.reminders || [],
    questions: organized.reflectionQuestions?.list || compact.reflectionQuestions || [],
    actions: organized.gentleActions?.list || compact.gentleActions || (reading.summary?.action ? [reading.summary.action] : []),
    closing: organized.closingLine?.text || compact.closingLine || sectionText(reading, "最后想留给你的一句话") || "",
    resonance,
    resonanceChapter,
    resonanceAngle,
    isSingle: cards.length === 1
  };
}

function renderStoryCardMedia(card) {
  const elemColor = ELEMENT_COLORS[card.element];
  const style = elemColor ? ` style="--story-elem:${elemColor}"` : "";
  return `
    <figure class="story-chapter__card ${card.arcana === "大阿卡那" ? "is-major" : ""} ${card.orientation === "逆位" ? "is-reversed" : ""}"${style}>
      <img src="${card.image}" alt="${escapeHtml(card.name)} ${card.orientation}">
      <figcaption>
        <span class="story-chapter__name">${escapeHtml(card.name)}</span>
        <span class="story-chapter__orient">${escapeHtml(card.orientation)}</span>
      </figcaption>
    </figure>
  `;
}

function renderStoryChapter(chapter, index) {
  const { act, card, bridge, role, text, valence } = chapter;
  const basis = [card.element ? `${card.element}元素` : "", card.numerologyStage || "", card.imagery || ""]
    .filter(Boolean)
    .join(" · ");
  const keywords = (card.keywords || []).slice(0, 4).join(" · ");
  return `
    <article class="story-chapter" style="--chapter-i:${index}">
      <header class="story-chapter__head">
        <span class="story-chapter__act">${act} · ${escapeHtml(card.position)}</span>
        <span class="story-chapter__role">${escapeHtml(role)}</span>
        <span class="story-chapter__valence is-${valence === "挑战" ? "challenge" : valence === "支持" ? "support" : "neutral"}">${valence}</span>
      </header>
      <div class="story-chapter__body">
        ${renderStoryCardMedia(card)}
        <div class="story-chapter__narrative">
          <p class="story-chapter__meta">${escapeHtml(card.name)} · ${escapeHtml(card.orientation)}${keywords ? ` · ${escapeHtml(keywords)}` : ""}</p>
          <p class="story-chapter__bridge">${escapeHtml(bridge)}</p>
          <p class="story-chapter__text">${escapeHtml(text)}</p>
          ${card.imagery ? `<p class="story-chapter__imagery">✦ ${escapeHtml(card.imagery)}</p>` : ""}
          ${basis ? `<p class="story-chapter__basis"><span>牌理</span>${escapeHtml(basis)}</p>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderTarotStory(reading) {
  const story = collectStoryData(reading);
  const hasAi = Boolean(story.mirror || story.chapters.some((c) => c.text));

  if (!hasAi) {
    return (reading.summary?.sections || []).map((section) => summarySection(section)).join("");
  }

  const resonanceLine = story.resonance
    ? `你先被「${story.resonance.name}」抓住，说明这次牌阵的入口不在完整答案，而在「${coreSymbols(story.resonance, 2)}」这层感受。`
    : "";
  const angleLine = story.resonanceAngle?.[2] || "";
  const resonanceText = story.resonanceChapter?.text || "";
  const firstChapterText = story.chapters?.[0]?.text || "";
  const description = story.descriptionLayer
    || (story.resonance
      ? [resonanceLine, angleLine, resonanceText || story.briefSummary || story.mirror].filter(Boolean).join(" ")
      : [story.briefSummary || story.mirror, story.directVerdict ? "" : firstChapterText].filter(Boolean).join(" "));
  const situation = story.situationLayer
    || (story.resonance
      ? `放回「${reading.themeLabel}」里看，${story.resonance.position}位的「${story.resonance.name}」把重点推向了${coreSymbols(story.resonance, 1)}：这不一定是在替你做决定，更像是在提醒你先确认这份感受从哪里来。`
      : story.reframe || story.presentState || `三牌合参：${story.chapters.map((ch) => ch.card.name).join(" → ")}，主线落在你的原问题上。`);
  const meaning = story.meaningLayer
    || (story.tension
      ? story.tension
      : story.reframe || `这件事对你而言，可能更像一次重新确认自己位置的过程，而不是单纯要一个马上执行的答案。`);
  const action = story.resonance
    ? buildResonanceAction(story.resonance, story.actions?.[0])
    : story.actions?.[0] || story.actions?.[1] || "本周把建议牌落成一件可核对的小事：写下你要确认的一个事实，并安排一次具体跟进。";
  const echo = story.closing
    || "这次抽牌更像是在提醒你：你不是没想法，而是还没准备好承认自己的答案。";
  const sharpQuestion = pickSharpQuestion(story, reading);

  return `
    <article class="tarot-story" aria-label="牌阵故事解读">
      <section class="reader-note" style="--chapter-i:0">
        <p class="reader-note__eyebrow">这次先看这里</p>
        <h3>${story.directVerdict ? "牌师判断" : story.resonance ? `你停在了：${escapeHtml(story.resonance.name)}` : `关于你的问题：${escapeHtml(story.headline)}`}</h3>
        <p class="reader-note__copy reader-note__verdict">${formatVerdictHtml(story.directVerdict || "牌面判断生成中，请展开下方完整牌局查看。")}</p>
        ${story.briefSummary && story.directVerdict && !isSimilarSummaryCopy(story.briefSummary, story.directVerdict)
    ? `<p class="reader-note__brief">${escapeHtml(story.briefSummary)}</p>`
    : ""}
        ${story.reframe && !isSimilarSummaryCopy(story.reframe, story.directVerdict || story.briefSummary)
    ? `<p class="reader-note__reframe">${escapeHtml(story.reframe)}</p>`
    : ""}
        <div class="reader-note__question">
          <span>牌师追问</span>
          <strong>${escapeHtml(sharpQuestion)}</strong>
        </div>
        <p class="reader-note__action">${escapeHtml(action)}</p>
        <blockquote class="reader-note__echo">${escapeHtml(echo)}</blockquote>
      </section>

      <details class="full-reading">
        <summary>展开完整牌局</summary>
        <section class="story-prologue" style="--chapter-i:1">
          <p class="story-prologue__eyebrow">直觉先行 · 你带着这个问题来</p>
          <blockquote class="story-prologue__question">「${escapeHtml(reading.question)}」</blockquote>
          <p class="story-prologue__headline">${escapeHtml(story.headline)}</p>
          ${story.resonance ? `<p class="story-prologue__feeling">你刚才选中的是「${escapeHtml(story.resonance.name)}」。你确认它更贴近「${escapeHtml((story.resonanceAngle?.[1] || coreSymbols(story.resonance, 1)).replace(/^更像「|」$/g, ""))}」，所以这次解读会先从这里进入。</p>` : ""}
          ${renderVisualJourney(reading, { compact: true })}
        </section>

        <div class="story-spine" aria-hidden="true"></div>

        <section class="story-layer-stack" aria-label="四层解读">
          ${renderLayer("1", "描述层", "牌面看见什么，以及与你问题的关系。", description)}
          ${renderLayer("2", "情境层", "放进你的生活/work 情境里理解。", situation)}
          ${renderLayer("3", "意义层", "提炼这件事对你意味着什么。", meaning)}
          ${renderLayer("4", "选择层", "最后才给一个可以轻轻尝试的动作。", action)}
        </section>

        <section class="story-chapters" aria-label="逐张牌补充">
          <p class="story-section-label">${story.isSingle ? "牌面补充 · 只看这一张" : "牌面补充 · 按抽牌顺序"}</p>
          ${story.chapters.map((ch, i) => renderStoryChapter(ch, i + 1)).join("")}
        </section>
      </details>

      ${renderFollowupBox(story)}
      ${renderFeedbackBox(story)}
    </article>
  `;
}

function pickSharpQuestion(story, reading) {
  const aiQ = (story.questions || []).find((q) => q && q.length >= 10 && !/慢慢来|顺其自然|别急着决定/.test(q));
  if (aiQ) return aiQ;
  return buildSharpQuestion(story, reading);
}

function formatVerdictHtml(verdict) {
  const text = stripVerdictPrefix(String(verdict || "").trim());
  if (!text) return "";
  const firstEnd = text.search(/[。！？]/);
  if (firstEnd >= 8 && firstEnd <= 48) {
    const lead = text.slice(0, firstEnd + 1);
    const rest = text.slice(firstEnd + 1).trim();
    return `<strong class="reader-note__verdict-lead">${escapeHtml(lead)}</strong>${rest ? ` ${escapeHtml(rest)}` : ""}`;
  }
  return escapeHtml(text);
}

function buildSharpQuestion(story, reading) {
  const q = reading.question || "";
  const ctx = story.headline || "";

  if (/他|她|对方|ta/i.test(q) && /感觉|喜欢|爱|态度|心意/.test(q)) {
    return "你更想知道对方怎么想，还是更想确认自己值不值得被认真对待？";
  }
  if (/该不该|要不要|是否|继续|放弃|主动/.test(q)) {
    return "你是在问选择，还是在等一个不用承担代价的许可？";
  }
  if (/还是|或者|或是/.test(q) && /选|去|留|哪/.test(q)) {
    return "你卡在选项本身，还是卡在不敢为选择负责？";
  }
  if (/睡不着|焦虑|怎么办|撑不住|情绪/.test(q)) {
    return "你想要答案，还是想要有人先承认你受伤了？";
  }
  if (/自己|成长|喜欢自己|走出|放下/.test(q)) {
    return "你对自己苛刻的，是能力，还是「不够好就不配休息」？";
  }
  if (/什么时候|何时|多久|哪里/.test(q)) {
    return "你急的是时间点，还是急的是「没有消息=否定我」？";
  }
  if (/会怎么样|能不能|会不会|情况|走向|未来|接下来/.test(q)) {
    return "你更怕的是机会没了，还是怕在焦虑里误判了阶段？";
  }

  const key = story.resonance ? coreSymbols(story.resonance, 1) : ctx;
  if (story.resonance?.orientation === "逆位") {
    return `你真正抗拒的，是事情本身，还是承认「${key}」已经发生了？`;
  }
  if (story.resonance?.element === "风") return "你说自己想清楚，其实是不是一直在脑内审判自己？";
  if (story.resonance?.element === "水") return "你想要答案，还是想要有人先承认你受伤了？";
  if (story.resonance?.element === "土") return "你缺的是方向，还是能支撑这个方向的现实资源？";
  if (story.resonance?.element === "火") return "这是热情，还是你已经习惯用行动掩盖不安？";
  return `如果把「${key}」当成镜子，它最先照见的是你哪一部分不安？`;
}

function renderLayer(number, title, subtitle, text) {
  return `
    <article class="story-layer" style="--chapter-i:${Number(number) + 1}">
      <span class="story-layer__number">${number}</span>
      <div>
        <p class="story-layer__kicker">${escapeHtml(title)}</p>
        <h3>${escapeHtml(subtitle)}</h3>
        <p>${escapeHtml(text)}</p>
      </div>
    </article>
  `;
}

function buildResonanceAction(card, fallback = "") {
  const key = coreSymbols(card, 1);
  if (card.orientation === "逆位") {
    return `先不用逼自己马上推进。围绕「${key}」写三句：哪里不顺、哪里太用力、哪里可以先松一点。`;
  }
  if (card.element === "土") return `先把「${key}」落到现实：列出你手上已有资源、缺口，以及本周能补上的一小块。`;
  if (card.element === "水") return `先照顾「${key}」背后的感受：给它一个名字，再决定要不要表达出来。`;
  if (card.element === "风") return `先把「${key}」从脑内拿出来：写下事实、猜测、证据，别让它们混在一起。`;
  if (card.element === "火") return `先检查「${key}」是不是行动力，还是硬撑。今天只做一个不透支自己的动作。`;
  return fallback || `先围绕「${key}」写一句：我真正介意的是什么？`;
}

function buildFollowupOptions(story) {
  const cards = story.chapters.map((chapter) => chapter.card);
  const resonance = story.resonance || cards[0];
  const reversedCount = cards.filter((card) => card.orientation === "逆位").length;
  const elementCount = cards.reduce((acc, card) => {
    if (card.element) acc[card.element] = (acc[card.element] || 0) + 1;
    return acc;
  }, {});
  const dominantElement = Object.entries(elementCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const challenge = story.chapters.find((chapter) => chapter.valence === "挑战");
  const options = [
    ["block", "我现在最大的阻碍是什么？", story.tension || challenge?.text || "阻碍可能不在外面，而在你还没命名的犹豫里。"],
    ["see", "我最需要看见的部分是什么？", story.reframe || story.mirror || "你最需要看见的，可能是自己已经有感觉，只是还没有给它一个位置。"]
  ];
  if (reversedCount >= 2 || resonance?.orientation === "逆位") {
    options.splice(1, 0, ["stuck", "哪里被卡住了？", `逆位把注意力拉回内部。围绕「${coreSymbols(resonance, 1)}」看，卡住的地方可能不是没路，而是节奏还没有顺回来。`]);
  } else if (dominantElement === "风") {
    options.splice(1, 0, ["mind", "我是想太多，还是说太少？", "这组牌更像是在提醒你：先把事实和推测分开，再决定哪些话需要说出口。"]);
  } else if (dominantElement === "水") {
    options.splice(1, 0, ["hurt", "真正受伤的是哪一部分？", "这组牌更在意情绪的流向。你可以先看见受伤处，而不是马上判断谁对谁错。"]);
  } else if (dominantElement === "土") {
    options.splice(1, 0, ["resource", "现实资源够不够支撑我？", "土元素会把问题拉回现实：时间、钱、体力、支持系统，哪一块最先短缺？"]);
  } else if (dominantElement === "火") {
    options.splice(1, 0, ["burn", "我是在行动，还是在硬撑？", "火元素带来动力，也可能带来消耗。现在要分清热情和透支。"]);
  } else {
    options.splice(1, 0, ["wait", "如果我继续等，会发生什么？", story.reminders?.[0] || "继续等未必是坏事，但需要知道自己是在休息，还是在回避。"]);
  }
  return options.slice(0, 3);
}

function renderFollowupBox(story) {
  const options = buildFollowupOptions(story);
  const selected = state.followupFocus;
  const active = options.find(([id]) => id === selected);
  return `
    <section class="story-followup" style="--chapter-i:${story.chapters.length + 3}">
      <p class="story-section-label">继续追问 · 仍围绕本次抽牌</p>
      <div class="story-followup__options">
        ${options.map(([id, label]) => `
          <button type="button" class="story-followup__btn${selected === id ? " is-selected" : ""}" data-followup="${id}">${escapeHtml(label)}</button>
        `).join("")}
      </div>
      ${active ? `<p class="story-followup__answer">${escapeHtml(active[2])}</p>` : `<p class="story-followup__answer is-muted">你可以继续追问，但范围会留在这一次牌阵里。</p>`}
    </section>
  `;
}

function renderFeedbackBox(story) {
  const selected = state.readingFeedback;
  const responses = {
    yes: story.resonance
      ? `那就先抓住「${story.resonance.name}」这条线，不必把整组牌都解释完。它已经指出了最有反应的位置。`
      : "那就先保留这份共鸣，它比一个完整结论更重要。",
    off: "这部分你不认同也正常。可能不是牌错了，而是解释入口还没贴近你；你可以先回到牌面本身，看看不认同的是描述，还是放进现实后的判断。",
    angle: story.resonance
      ? `可以换角度：暂时别把「${story.resonance.name}」当答案，把它当一个问题。它在问：你为什么会先注意到「${coreSymbols(story.resonance, 1)}」？`
      : "可以换角度：先不把牌当答案，只把它当成一个帮助你说出感受的符号。"
  };
  return `
    <section class="story-feedback" style="--chapter-i:${story.chapters.length + 3}">
      <p class="story-section-label">校准 · 你可以不同意</p>
      <div class="story-feedback__options">
        <button type="button" class="story-feedback__btn${selected === "yes" ? " is-selected" : ""}" data-feedback="yes">有共鸣</button>
        <button type="button" class="story-feedback__btn${selected === "off" ? " is-selected" : ""}" data-feedback="off">有点不准</button>
        <button type="button" class="story-feedback__btn${selected === "angle" ? " is-selected" : ""}" data-feedback="angle">换个角度看</button>
      </div>
      <p class="story-feedback__answer">${escapeHtml(selected ? responses[selected] : "塔罗不是判卷。你对牌的反应，也会反过来修正这次解读。")}</p>
    </section>
  `;
}

function renderVisualSummary(reading) {
  return renderTarotStory(reading);
}

function summarySection(section) {
  const bodyClass = section.emphasis ? "summary-section is-emphasis" : "summary-section";
  if (section.list) {
    return `
      <article class="${bodyClass}">
        <h3>${escapeHtml(section.title)}</h3>
        <ul>${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
    `;
  }
  return `
    <article class="${bodyClass}">
      <h3>${escapeHtml(section.title)}</h3>
      <div class="summary-copy">${formatSectionText(section.text)}</div>
    </article>
  `;
}

function formatSectionText(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join("");
}

function historyItem(item, index) {
  const star = item.summary?.sections?.find((s) => s.title === "最后想留给你的一句话")?.text
    || item.summary?.sections?.find((s) => s.title === "今日星语")?.text
    || item.summary?.sections?.at(-1)?.text
    || "愿你慢慢看清自己真正想靠近的方向。";
  const thumbs = (item.cards || []).slice(0, 3).map((card) => `
    <img class="history-thumb ${card.arcana === "大阿卡那" ? "is-major" : ""}" src="${card.image}" alt="">
  `).join("");
  const interaction = item.interaction || {};
  const interactionLine = [
    interaction.resonanceCard ? `共鸣：${interaction.resonanceCard}` : "",
    interaction.resonanceAngle ? `确认：${interaction.resonanceAngle === "surface" ? "表层状态" : "深层感受"}` : "",
    interaction.readingFeedback ? `反馈：${feedbackLabel(interaction.readingFeedback)}` : ""
  ].filter(Boolean).join(" · ");
  return `
    <article class="history-item">
      <div>
        <p class="eyebrow">${item.date || `记录 ${index + 1}`}</p>
        ${thumbs ? `<div class="history-thumbs">${thumbs}</div>` : ""}
        <h3>${escapeHtml(item.question || "我的问题")}</h3>
        ${interactionLine ? `<p class="history-interaction">${escapeHtml(interactionLine)}</p>` : ""}
        <p>${escapeHtml(star)}</p>
      </div>
      <strong>${escapeHtml(item.summary?.keyword || "星月提醒")}</strong>
    </article>
  `;
}

function go(step, options = {}) {
  state.step = step;
  render();
  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function resetAll() {
  const labels = spreadActionLabels();
  state.question = "";
  cancelDeckShuffleAnim();
  state.deckShuffling = false;
  state.deckShuffleStartMs = 0;
  state.deckReady = false;
  state.fanSpread = false;
  state.fanSpreadSettled = false;
  state.fetchFailed = false;
  state.fanShuffling = false;
  state.selectedSlots = [];
  state.pickStep = 0;
  state.slotPool = null;
  state.reading = null;
  state.revealed = [];
  state.resonanceCard = null;
  state.resonanceAngle = "";
  state.followupFocus = "";
  state.readingFeedback = "";
  state.reportExpanded = false;
  buzz(8);
  toast(labels.newQuestionToast);
  go("home");
}

async function saveResult() {
  const payload = {
    ...state.reading,
    interaction: {
      resonanceCard: selectedResonanceCard(state.reading)?.name || "",
      resonanceAngle: state.resonanceAngle,
      resonanceAngleLabel: resonanceAngleLabel(state.reading),
      followupFocus: state.followupFocus,
      readingFeedback: state.readingFeedback
    },
    savedAt: new Date().toISOString()
  };
  const key = "moonlit-tarot-history";
  const history = JSON.parse(localStorage.getItem(key) || "[]");
  history.unshift(payload);
  localStorage.setItem(key, JSON.stringify(history.slice(0, 12)));

  const closing = sectionText(state.reading, "最后想留给你的一句话")
    || state.reading.summary?.sections?.at(-1)?.text
    || "";
  const text = `星月少女塔罗馆\n问题：${state.reading.question}\n关键词：${state.reading.summary.keyword}\n收束：${closing}`;
  try {
    await navigator.clipboard.writeText(text);
    toast("已保存到本机记录，并复制了分享文案。");
  } catch {
    toast("已保存到本机记录。");
  }
}

function toast(message) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2500);
}

function escapeHtml(input) {
  return String(input).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

render();
