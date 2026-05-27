const app = document.querySelector("#app");

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

const state = {
  step: "home",
  theme: "",
  mood: "",
  question: "",
  spread: "three",
  selectedSlots: [],
  reading: null,
  revealed: []
};

const spreadCount = () => ({ one: 1, three: 3, four: 4 }[state.spread] || 3);

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
          <button class="btn primary" data-next="theme">开始抽牌</button>
          <button class="btn secondary" data-demo>快速体验</button>
          <button class="btn secondary" data-history>抽卡记录</button>
        </div>
      </div>
      <div class="moon-deck" aria-hidden="true">
        <span class="hero-card"></span>
        <span class="hero-card"></span>
        <span class="hero-card"></span>
      </div>
    </div>
  `;
  shell.querySelector("[data-next]").addEventListener("click", () => go("theme"));
  shell.querySelector("[data-demo]").addEventListener("click", () => {
    state.theme = "relationship";
    state.mood = "calmChaos";
    state.question = "他现在对我是怎样的感觉？";
    state.spread = "three";
    go("shuffle");
  });
  shell.querySelector("[data-history]").addEventListener("click", () => go("history"));
  return screen(shell);
}

function renderTheme() {
  const grid = document.createElement("div");
  grid.className = "grid";
  themes.forEach(([id, title, desc]) => {
    grid.append(option(title, desc, state.theme === id, () => {
      state.theme = id;
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
  const box = document.createElement("div");
  box.className = "question-box";
  const presets = questions[state.theme] || questions.relationship;
  box.innerHTML = `
    <textarea placeholder="写下你想问的问题，例如：我该不该继续等待这段关系？">${state.question}</textarea>
    <div class="chips"></div>
    <div class="actions">
      <button class="btn secondary" data-back>上一步</button>
      <button class="btn primary" data-next>继续</button>
    </div>
  `;
  const textarea = box.querySelector("textarea");
  textarea.addEventListener("input", () => {
    state.question = textarea.value;
  });
  const chips = box.querySelector(".chips");
  presets.forEach((text) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      state.question = text;
      textarea.value = text;
    });
    chips.append(chip);
  });
  box.querySelector("[data-back]").addEventListener("click", () => go("mood"));
  box.querySelector("[data-next]").addEventListener("click", () => {
    state.question = textarea.value.trim() || presets[0];
    go("spread");
  });
  return screen(panel("把问题说给牌听", "可以直接写，也可以点选一句更接近你此刻心事的问题。", box, "3 / 5"));
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
  wrap.querySelector("[data-back]").addEventListener("click", () => go("spread"));
  return screen(wrap);
}

function renderPick() {
  state.selectedSlots = [];
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="hint">牌已经洗好并摊成扇形。请在同一个界面里点选 ${spreadCount()} 张牌，抽中的牌会从牌阵里轻轻上浮。</div>
    <div class="fan-table" aria-label="扇形塔罗牌阵">
      <div class="pick-count">已选择 <strong>0</strong> / ${spreadCount()}</div>
      <div class="fan-deck"></div>
    </div>
    <div class="actions">
      <button class="btn secondary" data-back>重新洗牌</button>
      <button class="btn primary" data-next disabled>查看牌面</button>
    </div>
  `;
  const grid = body.querySelector(".fan-deck");
  const next = body.querySelector("[data-next]");
  const countLabel = body.querySelector(".pick-count strong");
  const fanSize = 23;
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
        card.classList.add("selected");
        state.selectedSlots.push(index);
      }
      card.dataset.order = state.selectedSlots.indexOf(index) + 1 || "";
      grid.querySelectorAll(".pick-card").forEach((item, itemIndex) => {
        item.dataset.order = state.selectedSlots.indexOf(itemIndex) + 1 || "";
      });
      countLabel.textContent = state.selectedSlots.length;
      next.disabled = state.selectedSlots.length !== spreadCount();
    });
    grid.append(card);
  });
  body.querySelector("[data-back]").addEventListener("click", () => go("shuffle"));
  next.addEventListener("click", fetchReading);
  return screen(panel("抽出回应你的牌", "不要想太久，第一眼被吸引的那张，通常最诚实。", body, "5 / 5"));
}

async function fetchReading() {
  app.querySelector("[data-next]").disabled = true;
  toast("星光正在整理牌面...");
  const response = await fetch("/api/reading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      theme: state.theme,
      mood: state.mood,
      question: state.question,
      spread: state.spread,
      selectedSlots: state.selectedSlots
    })
  });
  state.reading = await response.json();
  state.revealed = state.reading.cards.map(() => false);
  go("reveal");
}

function renderReveal() {
  const wrap = document.createElement("div");
  wrap.className = "shell reveal-layout";
  wrap.innerHTML = `
    <div class="panel">
      <p class="eyebrow">Reveal</p>
      <h2>逐张翻开今晚的牌</h2>
      <p class="lede">每张牌都对应一个位置。全部翻开后，就可以查看 AI 为你写下的完整解读。</p>
    </div>
    <div class="reading-cards"></div>
    <div class="actions">
      <button class="btn secondary" data-again>重新抽卡</button>
      <button class="btn primary" data-report disabled>查看 AI 解读</button>
    </div>
  `;
  const cards = wrap.querySelector(".reading-cards");
  const reportButton = wrap.querySelector("[data-report]");
  state.reading.cards.forEach((card, index) => {
    const el = document.createElement("button");
    el.className = `tarot-card ${state.revealed[index] ? "revealed" : ""}`;
    el.innerHTML = `
      <div class="tarot-inner">
        <div class="face back"></div>
        <div class="face front">
          <div class="position">${card.position}</div>
          <img class="card-image" src="${card.image}" alt="${card.name} ${card.nameEn} 卡面图" draggable="false">
          <h3 class="card-name">${card.name}</h3>
          <div class="orientation">${card.orientation}</div>
          <p class="card-hint">${card.shortHint}</p>
        </div>
      </div>
    `;
    el.addEventListener("click", () => {
      state.revealed[index] = true;
      el.classList.add("revealed");
      reportButton.disabled = !state.revealed.every(Boolean);
      if (card.arcana === "大阿卡那") toast("这是一张能量较强的牌。");
      if (card.orientation === "逆位") toast("逆位不是坏消息，是一个温柔提醒。");
    });
    cards.append(el);
  });
  wrap.querySelector("[data-again]").addEventListener("click", () => go("shuffle"));
  reportButton.disabled = !state.revealed.every(Boolean);
  reportButton.addEventListener("click", () => go("report"));
  return screen(wrap);
}

function renderReport() {
  const reading = state.reading;
  const wrap = document.createElement("div");
  wrap.className = "shell report";
  const cards = reading.cards.map((card) => `${card.position}：${card.name} ${card.orientation}`).join("<br>");
  const cardImages = reading.cards.map((card) => `
    <figure class="mini-card">
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
        <div class="meta-row"><span>今日行动</span><strong>${reading.summary.action}</strong></div>
      </div>
      <div class="actions">
        <button class="btn primary" data-save>保存结果</button>
        <button class="btn secondary" data-home>换个问题</button>
        <button class="btn secondary" data-history>抽卡记录</button>
      </div>
    </aside>
    <section class="summary panel">
      <p class="eyebrow">AI Reading</p>
      <h2>AI 为你整理的解读</h2>
      ${reading.summary.sections.map(section => summarySection(section)).join("")}
      <div class="actions">
        <button class="btn secondary" data-again>重新抽卡</button>
      </div>
    </section>
  `;
  wrap.querySelector("[data-save]").addEventListener("click", saveResult);
  wrap.querySelector("[data-home]").addEventListener("click", resetAll);
  wrap.querySelector("[data-history]").addEventListener("click", () => go("history"));
  wrap.querySelector("[data-again]").addEventListener("click", () => go("shuffle"));
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

function summarySection(section) {
  if (section.list) {
    return `
      <article class="summary-section">
        <h3>${escapeHtml(section.title)}</h3>
        <ul>${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
    `;
  }
  return `
    <article class="summary-section">
      <h3>${escapeHtml(section.title)}</h3>
      <p>${escapeHtml(section.text)}</p>
    </article>
  `;
}

function historyItem(item, index) {
  const star = item.summary?.sections?.at(-1)?.text || "愿你慢慢看清自己真正想靠近的方向。";
  return `
    <article class="history-item">
      <div>
        <p class="eyebrow">${item.date || `记录 ${index + 1}`}</p>
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
  state.question = "";
  state.selectedSlots = [];
  state.reading = null;
  state.revealed = [];
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

  const text = `星月少女塔罗馆\n问题：${state.reading.question}\n关键词：${state.reading.summary.keyword}\n星语：${state.reading.summary.sections.at(-1).text}`;
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
