const app = document.querySelector("#app");

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
  relationship: ["他现在对我是怎样的感觉？", "我该不该主动一点？", "这段关系真正需要被看见的是什么？"],
  future: ["未来三个月我需要注意什么？", "我应该选择稳定还是冒险？", "我现在最需要相信什么？"],
  career: ["我该继续坚持这份工作吗？", "最近的努力会有结果吗？", "我适合换一个方向吗？"],
  self: ["我为什么总是走不出来？", "我现在最需要修复的内在能量是什么？", "我该如何重新喜欢自己？"],
  emotion: ["最近为什么总觉得很累？", "我该怎么让自己轻松一点？", "今天我的情绪想告诉我什么？"]
};

const ritualLines = [
  "星月正在感应你的问题…",
  "牌阵开始对齐…",
  "AI 正在读取牌意…",
  "即将为你揭晓…"
];

const state = {
  step: "home",
  theme: "",
  mood: "",
  question: "",
  spread: "three",
  quickPath: false,
  selectedSlots: [],
  reading: null,
  revealed: [],
  reportExpanded: false
};

const spreadCount = () => ({ one: 1, three: 3, four: 4 }[state.spread] || 3);

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
      <div class="ritual-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
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

function hideRitualOverlay(el) {
  clearInterval(el?._ritualTimer);
  el?.remove();
}

function startQuickDraw() {
  state.theme = "self";
  state.mood = "lost";
  state.question = "";
  state.spread = "one";
  state.quickPath = true;
  state.reading = null;
  state.revealed = [];
  state.selectedSlots = [];
  state.reportExpanded = false;
  buzz([8, 18, 8]);
  go("question");
}

function redrawSameQuestion() {
  state.selectedSlots = [];
  state.reading = null;
  state.revealed = [];
  state.reportExpanded = false;
  buzz(10);
  toast("同一问题，新的牌局 ✦");
  go("shuffle");
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
    shuffle: renderShuffle,
    pick: renderPick,
    reveal: renderReveal,
    report: renderReport,
    history: renderHistory
  };
  app.innerHTML = "";
  app.append(screens[state.step]());
}

function screen(children, className = "") {
  const el = document.createElement("section");
  el.className = `screen ${className}`;
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
  shell.className = "shell hero";
  shell.innerHTML = `
    <div class="hero-stage">
      <div>
        <p class="eyebrow">Moonlit Tarot</p>
        <h1>星月少女塔罗馆</h1>
        <p class="lede">把心里的问题交给今晚的牌。这里不会替你做决定，只会陪你更温柔、更清醒地看见自己。</p>
        <div class="actions">
          <button class="btn primary" data-next="theme">完整流程</button>
          <button class="btn secondary" data-history>抽卡记录</button>
        </div>
      </div>
      <button class="moon-deck tap-deck" type="button" aria-label="点击卡牌，带着一个问题抽一张">
        <span class="hero-card c1"></span>
        <span class="hero-card c2"></span>
        <span class="hero-card c3"></span>
        <span class="tap-hint">单张速读 · 带个问题照见此刻 ✦</span>
      </button>
    </div>
  `;
  shell.querySelector("[data-next]").addEventListener("click", () => {
    state.quickPath = false;
    go("theme");
  });
  shell.querySelector(".tap-deck").addEventListener("click", startQuickDraw);
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
      setTimeout(() => go("mood"), 120);
    }));
  });
  return screen(panel("你今晚想问哪一颗星？", "选择一个最贴近你心事的方向，牌面会围绕它展开。", grid, "1 / 5"));
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
  textarea.addEventListener("input", () => {
    state.question = textarea.value;
    hint.classList.remove("is-error");
  });
  const chips = box.querySelector(".chips");
  presets.forEach((text) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      state.question = text;
      textarea.value = text;
      hint.classList.remove("is-error");
    });
    chips.append(chip);
  });
  box.querySelector("[data-back]").addEventListener("click", () => go(quick ? "home" : "mood"));
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
    go(quick ? "shuffle" : "spread");
  });
  const title = quick ? "先把问题说给牌听" : "把问题说给牌听";
  const subtitle = quick
    ? "单张速读：带着一个真正的问题，抽一张照见此刻。"
    : "可以直接写，也可以点选一句更接近你此刻心事的问题。";
  return screen(panel(title, subtitle, box, quick ? "带着问题 · 单张" : "3 / 5"));
}

function renderSpread() {
  const wrap = document.createElement("div");
  wrap.className = "grid";
  spreads.forEach(([id, title, desc, detail]) => {
    wrap.append(option(`${title}｜${desc}`, detail, state.spread === id, () => {
      state.spread = id;
      setTimeout(() => go("shuffle"), 120);
    }));
  });
  return screen(panel("选择今晚的牌阵", "越多牌，答案越像一封完整的信；越少牌，提醒越轻盈直接。", wrap, "4 / 5"));
}

function renderShuffle() {
  const wrap = document.createElement("div");
  wrap.className = "shell panel shuffle-scene";
  wrap.innerHTML = `
    <div>
      <p class="eyebrow">Hold to Shuffle</p>
      <h2>请想着你的问题，停留三秒</h2>
      <p class="lede">当星光聚满，牌会准备好回应你。</p>
      ${askBanner()}
    </div>
    <button class="deck-stack" aria-label="长按洗牌">
      <span class="hold-ring"></span>
      <span class="stack-card" style="--i:0"></span>
      <span class="stack-card" style="--i:1"></span>
      <span class="stack-card" style="--i:2"></span>
      <span class="stack-card" style="--i:3"></span>
    </button>
    <p class="hint">长按牌堆，或点击下方按钮完成洗牌。</p>
    <div class="actions">
      <button class="btn secondary" data-back>上一步</button>
      <button class="btn primary" data-skip>开始抽牌</button>
    </div>
  `;

  const deck = wrap.querySelector(".deck-stack");
  let timer = null;
  let start = 0;
  const reset = () => {
    clearInterval(timer);
    deck.classList.remove("charging");
    deck.style.setProperty("--charge", 0);
  };
  const complete = () => {
    reset();
    toast("牌已经洗好，请抽出回应你的那几张。");
    go("pick");
  };
  deck.addEventListener("pointerdown", () => {
    start = Date.now();
    deck.classList.add("charging");
    timer = setInterval(() => {
      const charge = Math.min(1, (Date.now() - start) / 1800);
      deck.style.setProperty("--charge", charge.toFixed(2));
      if (charge >= 1) complete();
    }, 30);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((event) => deck.addEventListener(event, reset));
  wrap.querySelector("[data-skip]").addEventListener("click", complete);
  wrap.querySelector("[data-back]").addEventListener("click", () => {
    go(state.quickPath ? "question" : "spread");
  });
  return screen(wrap);
}

function renderPick() {
  state.selectedSlots = [];
  const body = document.createElement("div");
  body.innerHTML = `
    ${askBanner()}
    <div class="hint">牌已经洗好并摊成扇形。请在同一个界面里点选 ${spreadCount()} 张牌，抽中的牌会从牌阵里轻轻上浮。</div>
    <div class="fan-table" aria-label="扇形塔罗牌阵">
      <div class="pick-count" data-pick-count>已选择 <strong>0</strong> / ${spreadCount()}</div>
      <div class="fan-deck"></div>
    </div>
    <div class="actions">
      <button class="btn secondary" data-back>重新洗牌</button>
      <button class="btn primary" data-next disabled>查看牌面</button>
    </div>
  `;
  const grid = body.querySelector(".fan-deck");
  const next = body.querySelector("[data-next]");
  const countWrap = body.querySelector("[data-pick-count]");
  const countLabel = body.querySelector(".pick-count strong");
  const fanSize = 23;
  let wasComplete = false;
  const updatePickCount = () => {
    const done = state.selectedSlots.length === spreadCount();
    countLabel.textContent = state.selectedSlots.length;
    countWrap.classList.toggle("is-complete", done);
    next.disabled = !done;
    if (done) {
      next.classList.add("pulse-ready");
      if (!wasComplete) {
        toast("选好了！点击查看牌面 ✦");
        buzz([8, 16, 8]);
      }
    } else {
      next.classList.remove("pulse-ready");
    }
    wasComplete = done;
  };
  Array.from({ length: fanSize }, (_, index) => {
    const card = document.createElement("button");
    card.className = "pick-card";
    const center = (fanSize - 1) / 2;
    const distance = index - center;
    const angle = distance * 4.2;
    const x = distance * 18;
    const y = Math.abs(distance) * 1.8;
    card.style.setProperty("--angle", `${angle}deg`);
    card.style.setProperty("--x", `${x}px`);
    card.style.setProperty("--y", `${y}px`);
    card.style.setProperty("--z", index);
    card.setAttribute("aria-label", `第 ${index + 1} 张背面牌`);
    card.addEventListener("click", () => {
      if (card.classList.contains("selected")) {
        card.classList.remove("selected");
        state.selectedSlots = state.selectedSlots.filter((item) => item !== index);
      } else if (state.selectedSlots.length < spreadCount()) {
        card.classList.add("selected", "just-picked");
        state.selectedSlots.push(index);
        setTimeout(() => card.classList.remove("just-picked"), 420);
        buzz(8);
      }
      card.dataset.order = state.selectedSlots.indexOf(index) + 1 || "";
      grid.querySelectorAll(".pick-card").forEach((item, itemIndex) => {
        item.dataset.order = state.selectedSlots.indexOf(itemIndex) + 1 || "";
      });
      updatePickCount();
    });
    grid.append(card);
  });
  updatePickCount();
  body.querySelector("[data-back]").addEventListener("click", () => go("shuffle"));
  next.addEventListener("click", fetchReading);
  return screen(panel("抽出回应你的牌", "不要想太久，第一眼被吸引的那张，通常最诚实。", body, "5 / 5"));
}

async function fetchReading() {
  const button = app.querySelector("[data-next]");
  if (button) button.disabled = true;
  const overlay = showRitualOverlay();
  buzz(12);
  try {
    const response = await fetch("/api/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        theme: state.theme || "relationship",
        mood: state.mood || "lost",
        question: state.question || questions.relationship[0],
        spread: state.spread,
        selectedSlots: state.selectedSlots
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.reading = await response.json();
    if (!state.reading?.cards?.length) throw new Error("empty reading");
    state.revealed = state.reading.cards.map(() => false);
    state.reportExpanded = false;
    hideRitualOverlay(overlay);
    toast("牌已回应你，请逐张翻开 ✦");
    buzz([10, 24, 10]);
    go("reveal");
  } catch {
    hideRitualOverlay(overlay);
    toast("星光有点弱，请再试一次。");
    if (button) button.disabled = false;
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

/** 翻牌瞬间的「牌师低语」：取该牌位的真实解读，去掉重复的位置·牌名前缀 */
function cardWhisper(index) {
  const pr = state.reading?.summary?.aiCompact?.positionReadings?.[index];
  const raw = pr?.text || state.reading?.cards?.[index]?.shortHint || "";
  return String(raw).replace(/^[^：:]{1,16}[：:]\s*/, "").trim();
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
    if (guideEl) guideEl.textContent = "牌面已全部呈现。你可以静静感受每一张牌带来的讯息。";
    if (hintEl) hintEl.textContent = "点击下方按钮，阅读 AI 为你写下的完整解读";
    return;
  }
  const position = state.reading.cards[next].position;
  if (guideEl) guideEl.textContent = `牌师提示：请先翻开「${position}」`;
  if (hintEl) hintEl.textContent = "轻触高亮的牌背，像在桌面上亲手翻开";
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
    const allOpen = state.revealed.every(Boolean);
    reportButton.disabled = !allOpen;

    const whisperEl = wrap.querySelector("[data-whisper]");
    if (whisperEl) {
      const line = cardWhisper(index);
      if (line) {
        whisperEl.textContent = `牌师低语 · ${card.position}：${line}`;
        whisperEl.classList.remove("show");
        void whisperEl.offsetWidth;
        whisperEl.classList.add("show");
      }
    }
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
      reportButton.classList.add("pulse-ready");
      toast("全部翻开了！可以查看解读 ✦");
      buzz([8, 20, 8]);
    }
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
  if (!state.revealed?.length || state.revealed.length !== total) {
    state.revealed = state.reading.cards.map(() => false);
  }
  const wrap = document.createElement("div");
  wrap.className = `shell reveal-layout reveal-layout--${spreadId}`;
  wrap.innerHTML = `
    <div class="panel reveal-intro">
      <p class="eyebrow">Reveal</p>
      <h2>逐张翻开今晚的牌</h2>
      <p class="lede">像真实占卜桌面一样，由牌师引导你一张一张翻开。每张牌对应一个牌位，全部揭开后即可阅读完整解读。</p>
      <p class="reveal-guide" data-reveal-guide aria-live="polite"></p>
      <div class="reveal-progress" aria-live="polite">
        <span class="reveal-progress-label">已翻开 <strong data-revealed-count>0</strong> / ${total}</span>
        <span class="reveal-progress-track" aria-hidden="true"><span class="reveal-progress-fill" data-reveal-fill></span></span>
      </div>
    </div>
    <div class="reveal-table">
      <div class="reveal-table-glow" aria-hidden="true"></div>
      <div class="reading-cards reveal-deck reveal-deck--${spreadId}"></div>
      <p class="reveal-table-hint">轻触尚未翻开的牌背</p>
      <p class="reveal-whisper" data-whisper aria-live="polite"></p>
    </div>
    <div class="actions reveal-actions">
      <button class="btn secondary" data-redraw>同题再抽</button>
      <button class="btn secondary" data-newq>新的问题</button>
      <button class="btn primary" data-report disabled>查看 AI 解读</button>
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
    slot.style.setProperty("--slot", index);
    slot.style.setProperty("--stagger", index);
    if (state.revealed[index]) slot.classList.add("is-revealed");

    const label = document.createElement("span");
    label.className = "slot-label";
    label.textContent = card.position;

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
    el.innerHTML = `
      <div class="tarot-inner">
        <div class="face back">
          <span class="back-shimmer" aria-hidden="true"></span>
          <span class="card-tap-hint">翻开</span>
        </div>
        <div class="face front">
          <div class="position">${escapeHtml(card.position)}</div>
          <img class="card-image" src="${card.image}" alt="${card.name} ${card.nameEn} 卡面图" draggable="false">
          <h3 class="card-name">${escapeHtml(card.name)}</h3>
          <div class="orientation">${escapeHtml(card.orientation)}</div>
          ${card.element || card.numerologyStage ? `<div class="card-basis-tags">${card.element ? `<span class="card-basis-tag">${escapeHtml(card.element)}元素</span>` : ""}${card.numerologyStage ? `<span class="card-basis-tag">${escapeHtml(card.numerologyStage)}</span>` : ""}</div>` : ""}
          <p class="card-hint">${escapeHtml(card.shortHint)}</p>
          ${card.imagery ? `<p class="card-imagery">✦ ${escapeHtml(card.imagery)}</p>` : ""}
        </div>
      </div>
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

    slot.append(label, el);
    deck.append(slot);
  });

  wrap.querySelector("[data-redraw]").addEventListener("click", redrawSameQuestion);
  wrap.querySelector("[data-newq]").addEventListener("click", resetAll);
  reportButton.disabled = !state.revealed.every(Boolean);
  if (!reportButton.disabled) reportButton.classList.add("pulse-ready");
  reportButton.addEventListener("click", () => go("report"));
  syncProgress();
  updateRevealGuide(wrap);
  return screen(wrap);
}

function renderReport() {
  const reading = state.reading;
  const teaser = reportTeaser(reading);
  const wrap = document.createElement("div");
  wrap.className = "shell report";
  const cards = reading.cards.map((card) => `${card.position}：${card.name} ${card.orientation}`).join("<br>");
  const cardImages = reading.cards.map((card) => `
    <figure class="mini-card ${card.arcana === "大阿卡那" ? "is-major" : ""}">
      <img src="${card.image}" alt="${card.name} 卡面图">
      <figcaption>${card.position}</figcaption>
    </figure>
  `).join("");
  wrap.innerHTML = `
    <aside class="report-card" id="report-card">
      <p class="eyebrow">${reading.date}</p>
      <h2>你的星月报告</h2>
      <div class="mini-spread">${cardImages}</div>
      <div class="report-meta">
        <div class="meta-row"><span>问题</span><strong>${escapeHtml(reading.question)}</strong></div>
        <div class="meta-row"><span>问题类型</span><strong>${escapeHtml(reading.questionProfile?.intent || "星月指引")}</strong></div>
        <div class="meta-row"><span>主题</span><strong>${reading.themeLabel}</strong></div>
        <div class="meta-row"><span>牌面</span><strong>${cards}</strong></div>
        <div class="meta-row"><span>今日关键词</span><strong>${reading.summary.keyword}</strong></div>
        <div class="meta-row"><span>幸运色</span><strong>${reading.summary.luckyColor}</strong></div>
        <div class="meta-row"><span>温柔尝试</span><strong>${reading.summary.action}</strong></div>
      </div>
      <div class="actions report-loop">
        <button class="btn primary" data-save>保存结果</button>
        <button class="btn secondary" data-redraw>同题再抽</button>
        <button class="btn secondary" data-newq>新的问题</button>
        <button class="btn secondary" data-history>抽卡记录</button>
      </div>
    </aside>
    <section class="summary panel">
      <div class="summary-head">
        <div>
          <p class="eyebrow">AI Reading</p>
          <h2>AI 为你整理的解读</h2>
        </div>
        ${readingSourceBadge(reading)}
      </div>
      <article class="reward-reveal">
        <p class="reward-label">✦ 牌面回应</p>
        ${renderVisualTeaser(reading, teaser)}
        <button class="btn primary" data-expand type="button">${state.reportExpanded ? "收起完整解读" : "展开图像化解读"}</button>
      </article>
      <div class="summary-detail ${state.reportExpanded ? "" : "is-collapsed"}">
        ${renderVisualSummary(reading)}
      </div>
    </section>
  `;
  wrap.querySelector("[data-save]").addEventListener("click", saveResult);
  wrap.querySelector("[data-redraw]").addEventListener("click", redrawSameQuestion);
  wrap.querySelector("[data-newq]").addEventListener("click", resetAll);
  wrap.querySelector("[data-history]").addEventListener("click", () => go("history"));
  wrap.querySelector("[data-expand]").addEventListener("click", () => {
    state.reportExpanded = !state.reportExpanded;
    app.innerHTML = "";
    app.append(renderReport());
  });
  return screen(wrap);
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem("moonlit-tarot-history") || "[]");
  const body = document.createElement("div");
  body.innerHTML = `
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
    if (title === "浓缩总结") organized.briefSummary = section;
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

function renderVisualSummary(reading) {
  const organized = organizeSummarySections(reading);
  const hasAiStructure = Boolean(
    organized.briefSummary
    || organized.presentState
    || organized.innerTheme
    || organized.positionReadings.length
    || organized.closingLine
  );

  if (!hasAiStructure) {
    return (reading.summary?.sections || []).map((section) => summarySection(section)).join("");
  }

  const remindersList = organized.reminders?.list
    || (organized.reminders?.text ? [organized.reminders.text] : null);
  const questionsList = organized.reflectionQuestions?.list
    || (organized.reflectionQuestions?.text ? [organized.reflectionQuestions.text] : null);
  const actionsList = organized.gentleActions?.list
    || (organized.gentleActions?.text ? [organized.gentleActions.text] : null);

  return `
    <div class="visual-summary">
      ${renderVisualJourney(reading)}
      <div class="visual-summary__chips">
        ${renderVisualChip("心情", moodLabel(reading.mood))}
        ${renderVisualChip("主题", reading.themeLabel)}
        ${renderVisualChip("关键词", reading.summary?.keyword)}
        ${renderSpreadValenceChips(reading)}
      </div>
      <div class="visual-summary__grid">
        ${organized.briefSummary ? renderVisualModule({
          kind: "closing",
          title: "浓缩总结",
          text: organized.briefSummary.text,
          emphasis: true
        }) : ""}
        ${!organized.briefSummary && organized.presentState ? renderVisualModule({
          kind: "state",
          title: organized.presentState.title,
          text: organized.presentState.text
        }) : ""}
        ${organized.briefSummary && organized.presentState
          && organized.presentState.text !== organized.briefSummary.text
          && !isSimilarSummaryCopy(organized.presentState.text, organized.briefSummary.text)
          ? renderVisualModule({
          kind: "state",
          title: "补充感受",
          text: organized.presentState.text
        }) : ""}
        ${organized.innerTheme ? renderVisualModule({
          kind: "theme",
          title: organized.innerTheme.title,
          text: organized.innerTheme.text
        }) : ""}
        ${remindersList?.length ? renderVisualModule({
          kind: "reminders",
          title: organized.reminders?.title || "这次抽卡给你的提醒",
          list: remindersList
        }) : ""}
      </div>
      ${renderVisualPositionCards(reading, organized.positionReadings)}
      <div class="visual-summary__grid">
        ${organized.innerTension ? renderVisualModule({
          kind: "tension",
          title: organized.innerTension.title,
          text: organized.innerTension.text
        }) : ""}
        ${questionsList?.length ? renderVisualModule({
          kind: "questions",
          title: organized.reflectionQuestions?.title || "可以陪你想一想的问题",
          list: questionsList
        }) : ""}
        ${actionsList?.length ? renderVisualModule({
          kind: "actions",
          title: organized.gentleActions?.title || "接下来你可以温柔地尝试",
          list: actionsList
        }) : ""}
        ${organized.closingLine ? renderVisualModule({
          kind: "closing",
          title: organized.closingLine.title,
          text: organized.closingLine.text,
          emphasis: true
        }) : ""}
      </div>
      ${organized.other.map((section) => summarySection(section)).join("")}
    </div>
  `;
}

function renderVisualTeaser(reading, teaser) {
  return `
    <div class="visual-teaser">
      <div class="visual-teaser__keyword">
        <span class="visual-teaser__glow" aria-hidden="true"></span>
        <strong>${escapeHtml(teaser.keyword)}</strong>
      </div>
      ${teaser.brief ? `<p class="visual-brief">${escapeHtml(teaser.brief)}</p>` : ""}
      ${renderVisualJourney(reading, { compact: true })}
      ${!teaser.brief && teaser.summary ? `<p class="reward-summary">${escapeHtml(teaser.summary)}</p>` : ""}
      ${teaser.action ? `
        <div class="visual-action-pill">
          <span class="visual-action-pill__icon" aria-hidden="true">↳</span>
          <span>${escapeHtml(teaser.action)}</span>
        </div>
      ` : ""}
      <blockquote class="visual-closing-quote">
        <span class="visual-closing-quote__mark" aria-hidden="true">✧</span>
        ${escapeHtml(teaser.star)}
      </blockquote>
    </div>
  `;
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
  return `
    <article class="history-item">
      <div>
        <p class="eyebrow">${item.date || `记录 ${index + 1}`}</p>
        ${thumbs ? `<div class="history-thumbs">${thumbs}</div>` : ""}
        <h3>${escapeHtml(item.question || "我的问题")}</h3>
        <p>${escapeHtml(star)}</p>
      </div>
      <strong>${escapeHtml(item.summary?.keyword || "星月提醒")}</strong>
    </article>
  `;
}

function go(step) {
  state.step = step;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetAll() {
  state.step = "theme";
  state.quickPath = false;
  state.question = "";
  state.selectedSlots = [];
  state.reading = null;
  state.revealed = [];
  state.reportExpanded = false;
  buzz(8);
  toast("开启新的提问 ✦");
  render();
}

async function saveResult() {
  const payload = {
    ...state.reading,
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
