/**
 * 模型解读策略层：只负责把「用户工作/生活情境」整理成模型可读上下文。
 * 不生成解读正文、不用牌名模板拼答案——正文由大模型根据牌面推理产出。
 */

const MOOD_LABELS = {
  lost: "有点迷茫",
  urgent: "很想知道答案",
  calmChaos: "表面平静但心里很乱",
  turning: "期待一个转机",
  release: "想放下某件事"
};

const THEME_LABELS = {
  relationship: "关系与亲密",
  career: "工作与职业",
  future: "未来与选择",
  self: "自我与成长",
  emotion: "情绪与生活"
};

/** 从原话提取「事实性情境」，供模型推理，不产出结论 */
export function extractSituationalFacts(question = "") {
  const q = String(question || "").trim();
  const facts = [];
  if (/面试|二面|三面|复试|初面|HR/.test(q)) facts.push("处于招聘/面试流程中");
  if (/没消息|等消息|等结果|没回音|没回复|静默/.test(q)) facts.push("正在等待外部反馈，不确定性偏高");
  if (/offer|录用|入职|签约/.test(q)) facts.push("涉及录用/入职/offer 议题");
  if (/两个|二个|两家|几个|多条线/.test(q)) facts.push("同时面对多个机会或并行节点");
  if (/跳槽|离职|裸辞|辞职/.test(q)) facts.push("在考虑或经历职业变动");
  if (/加班|老板|同事|项目|绩效|裁员/.test(q)) facts.push("当下工作压力是背景之一");
  if (/累|疲惫|焦虑|睡不着|撑不住/.test(q)) facts.push("身心消耗明显，精力是隐性变量");
  if (/他|她|对方|喜欢|在一起|分手|复合/.test(q)) facts.push("关系/对方是问题核心");
  if (/该不该|要不要|还是|选择|去留/.test(q)) facts.push("需要做选择或承担选择后果");
  if (/未来|会不会|能不能|发展|方向/.test(q)) facts.push("关心走向与节奏，而非单一事件");
  if (!facts.length) facts.push("带着一件具体的生活/work 困惑前来");
  return facts;
}

export function inferLifeSpheres(profile = {}) {
  const spheres = [];
  if (profile.isCareer || profile.asksOffer || profile.asksInterview) spheres.push("工作");
  if (profile.isRelationship) spheres.push("关系");
  if (profile.isEmotion) spheres.push("情绪");
  if (profile.isSelf) spheres.push("自我");
  if (profile.isFuture || profile.isDecision) spheres.push("选择与方向");
  if (!spheres.length) spheres.push("生活整体");
  const hasWork = spheres.includes("工作");
  const hasLife = spheres.some((s) => ["情绪", "自我", "生活整体"].includes(s));
  const blend = hasWork && (hasLife || profile.isEmotion)
    ? "工作与生活交织（决策会牵动精力、节奏与关系）"
    : hasWork
      ? "以工作/职业场景为主轴"
      : "以生活与内在状态为主轴";
  return { list: spheres, blend };
}

export function describeReadingTask(profile = {}, question = "") {
  const q = String(question || "");
  if (profile.asksInterview || /面试|二面/.test(q)) {
    return "先回答「流程现在像什么阶段、两个没消息可能意味着什么」，再解释三牌；区分对方流程 vs 你内心的公平/失控感；给本周可执行的跟进动作，不保证录用、不写具体日期。";
  }
  if (profile.asksOffer || /offer/.test(q)) {
    return "先回答 offer 进程与风险点，再解释三牌；强调书面核对与事实/担心分离，不保证结果。";
  }
  if (profile.asksOtherFeeling) {
    return "先回答关系温度与不确定点，再解释三牌；照见你在关系里的体验，不替对方读心。";
  }
  if (profile.isDecision || profile.isFuture || /该不该|还是/.test(q)) {
    return "先给牌理倾向与权衡框架，再解释三牌；可比较选项质感，不替用户拍板唯一答案。";
  }
  if (profile.isEmotion) {
    return "先承认感受合理，再用牌指出能量与恢复路径，给微小可执行步。";
  }
  if (profile.isRelationship) {
    return "先答关系温度与不确定点，再解释三牌；照见用户在关系里的体验，不替对方读心。";
  }
  if (profile.isRelease) {
    return "先回应「能否放下/如何走出」，再解释三牌；允许哀伤，给收回注意力的小步。";
  }
  if (profile.isSelf) {
    return "先回应自我状态与内在需求，再解释三牌；innerTheme 做觉察框定，给可自我核对的小步。";
  }
  return "先直接回应原问题，再用现状→阻碍→建议串成因果；给明确倾向与一张小行动卡。";
}

export function buildLifeWorkContext(reading) {
  const p = reading.questionProfile || {};
  const q = reading.question || p.text || "";
  const spheres = inferLifeSpheres(p);
  return {
    question: q,
    themeLabel: reading.themeLabel || THEME_LABELS[reading.theme] || "生活",
    moodLabel: MOOD_LABELS[reading.mood] || "有些不确定",
    intent: p.intent || "自我确认",
    coreNeed: p.coreNeed || "被看见、被理解",
    caution: p.caution || "",
    lifeBlend: spheres.blend,
    spheres: spheres.list,
    situationalFacts: extractSituationalFacts(q),
    readingTask: describeReadingTask(p, q),
    spread:
      reading.spread === "one"
        ? "单张：照见此刻一个核心课题"
        : "三张：现状（此刻立足）→ 阻碍（阴影/卡点）→ 建议（可整合态度与动作）"
  };
}

/**
 * 注入模型的「整体策略」正文（用户消息的一部分）
 */
export function buildModelStrategyBrief(reading) {
  const ctx = buildLifeWorkContext(reading);
  const cards = reading.cards || [];
  const chain = cards
    .map((c) => `${c.position}·${c.name}（${c.orientation}）`)
    .join(" → ");

  const factLines = ctx.situationalFacts.map((f) => `- ${f}`).join("\n");
  const p = reading.questionProfile || {};
  const themeMismatch = (p.isCareer || p.asksOffer || p.asksInterview)
    && /自我|成长/.test(ctx.themeLabel)
    && !/工作|职业|野心/.test(ctx.themeLabel);
  const intentLine = p.readingIntentLabel || p.readingIntent || p.intent || "自我确认";

  return `【解读策略 · 模型主通道】
你不是填模板，而是塔罗师 + 荣格式觉察同伴：根据「用户情境 + 牌面象征」推理，产出贴牌、贴问题、可执行的解读。

══════════════════
一、用户的工作/生活情境（只列事实，此处不下结论）
══════════════════
领域侧重：${ctx.lifeBlend}
解读意图：${intentLine}
用户选定主题：${ctx.themeLabel}
${themeMismatch ? "【主轴提醒】字面问题偏工作/职业，解读请以问题事实与牌面为主，勿被「自我与成长」主题带偏。" : ""}
${factLines}
- 用户原话：「${ctx.question}」
- 此刻心情：${ctx.moodLabel}
- 内在最需要：${ctx.coreNeed}
${ctx.caution ? `- 伦理提醒：${ctx.caution}` : ""}

══════════════════
二、你这盘要完成的推理任务
══════════════════
${ctx.readingTask}

══════════════════
三、牌阵结构（${ctx.spread}）
══════════════════
${chain || "（见下方牌面输入）"}
- 现状：自我此刻如何呈现
- 阻碍：情结/阴影/未整合部分，或外在真实卡点
- 建议：可被意识承接的态度；配本周一个具体动作
- 荣格：牌是象征镜子；关系题少读心；职业题把焦虑从脑补拉回可核对事实

══════════════════
四、输出契约（JSON 字段）
══════════════════
- directVerdict（必写）：第一句直接答字面问题（阶段/倾向/温度/宜否），再点名三张牌位与牌名作依据；禁止「就你问的…」套话；禁止「别急着下结论」「不必今天想通」逃避作答
- briefSummary：与 directVerdict 同方向，半句接住 + 浓缩
- positionReadings：每张先半句扣原问题，再解该牌；50–68字
- innerTheme：重新框定——表层困惑 → 更深内在课题（一句）
- gentleActions：两条，本周可执行，扣用户工作/生活场景（对象+步骤）
- 全文第二人称「你」；禁止算命腔、禁止保证录用/分手/具体日期

══════════════════
五、专业边界
══════════════════
- 允许：阻滞、延迟、冷淡、评估期、不确定——这是如实读牌
- 禁止：命中注定、一定会/不会、替用户做不可逆决定`;
}
