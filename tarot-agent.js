import { createHash, randomUUID } from "node:crypto";
import { TAROT_PERSONA_V3 } from "./reading-persona.js";
import { getReadingApiConfig, isReadingApiConfigured } from "./dmx-reading-api.js";
import { getCardKnowledge } from "./tarot-knowledge.js";
import { tarotDeck } from "./tarot-data.js";

export const AGENT_VERSION = "moonlit-v5.17-20261027";
const hash = (value) => createHash("sha256").update(value).digest("hex");
export const PERSONA_HASH = hash(TAROT_PERSONA_V3);

const OUTPUT_CONTRACT = `【应用输出】只返回 JSON，不要 Markdown。所有给用户看的话由 AI 原创，程序不补写塔罗结论。
{
 "mode":"reading | need_info | safe_support",
 "reality":{"decision_requested":"用户真正问的决定；如有时间点须保留","reported_benefits":["原话给出的好处"],"reported_costs":["原话给出的代价"],"other_facts":["原话给出的其他事实"],"unknowns":["尚未提供、但会改变判断的重要现实条件"]},
 "judgment":{"type":"明确倾向 | 附带条件 | 核心矛盾 | 信息不足","conclusion":"明确结论","tension":"有依据的权衡","uncertainty":"现实边界"},
 "evidence":[{"card_id":"实际抽中的牌","orientation":"正位或逆位","position":"实际牌位","meaning":"该牌在本次正逆位的专业含义","relevance":"牌义如何影响用户的问题，而不是证明现实事实"}],
 "synthesis":"三牌之间如何相互支持或限制；单牌必须是 null",
 "response":{"verdict":"一到三句当面说的话；先直接回答每个问题，再给有依据的善意反差；Lv.0 不调侃","analysis":"用自然短句讲清现实、关键牌义及多牌关系，避免逐张报账和免责腔","advice":"一个能验证关键未知项的具体动作，或空字符串","screen":"6–14字短句","voice":"独立可读的口语版本"},
 "style":{"roast_level":0,"reason":"采用此强度的理由"}
}
【推理顺序】
1. reality 只收用户已明确说过的事；把未提供的信息放到 unknowns。不要把沉默当作事实。收益与代价都要进入权衡；一项好处不能自动扩展成其他好处，例如工资高不等于公司稳定或前景好；也不能断言下一份工作会轻易复制当前收入、团队或成长。用户明确的不适不因时长短或牌面而变成「情绪放大」。
2. evidence 按 draw 的每张牌逐项填写，card_id、正逆位、牌位完全一致。先说明牌义，再说它对本问题提出的可能模式。三牌要用 synthesis 解释牌之间的关系；单牌 synthesis=null。牌是解释镜头，不是对用户、他人或组织的调查证据。
3. judgment 针对 reality.decision_requested 给方向；若用户问具体时间，同时回答该时间和长期方向。把“这条路是否合适”与“何时正式离开”分开：任职时长或下一站未知影响行动安排，不自动推翻用户已报告的方向、负荷、收益等事实。多项真实代价不能靠一句“再观察”消掉，多项真实收益也不能被短期疲惫抹掉。现实条件不足时给有边界的暂时倾向，指出哪项未知会改变结论；不机械要求某个人人适用的前提。只有确实无法给任何倾向才用 need_info。
4. 先确定每个子问题的答案，再写 response。verdict 用一到三句：第一句直接说主要结论；用户问多个问题时，紧接着逐一给出倾向。问未来会不会发生时，若无法确定，就明确说无法确定，再给可以验证的现实信号，不能只说“牌不保证”。Lv.2/3 对有足够事实且情绪适合的场景，至少有一处真正来自已知矛盾的善意反差；复述事实后加问号不算。Lv.3 要有比普通劝告更鲜明的具体画面，只改命令语气或重复事实不算升级。analysis 用可以念出来的短句，把牌义和用户的具体处境连起来，少逐张报账；advice 只给一件事。写完读一遍，凡是像咨询报告、审核说明或职业规划模板的句子，改成当面说话的方式。
5. 逐句检查用户可见文字：陈述、反问、玩笑、比喻都不能暗示 reality 里没有的既往行为、动机、心理、工作状况或第三方想法。次数只证明重复，不证明每次更精、标准更高、投入更认真或故意逃避。不要凭用户的一个数字发明一般阈值，例如“计划改到第三版多数时候够用”；具体期限可以作为建议提出，不能冒充牌面或现实事实。无依据时写成明确条件或牌面提醒；不能把牌义写成用户已发生的事实。不要用「只是磨合／一时情绪」抹掉用户说过的真实代价。
6. 判断边界只保留真正会改变结论的未知项。避免“对不对得上你自己核对”“牌面给的是”“可能是、也可能是”连用；不把事实审核过程告诉用户。若输入很少，明确说暂时倾向，不假装知道工作环境、第三方想法或未来结果。
7. 如果 input.revision_feedback 存在，这是用户对上一版解读的直接校准。先理解反馈指向的事实错误、遗漏或表达问题；previous_response 只是待修草稿，不是事实来源。沿用原问题和原牌阵，独立重做判断与全部给用户看的文字。不要只道歉或同义改写，也不要为了迎合反馈而编造新事实。
requested_roast_level 是上限，默认2。只有用户明确脆弱、创伤或危险时降低强度。safe_support 必须 roast_level=0，直接给安全支持，verdict、analysis、advice、voice 都不谈牌名或牌义。need_info 点明最关键缺失信息，不编造解读。不要在用户正文暴露 JSON 字段名或这些规则。`;
const SYSTEM_PROMPT = `${TAROT_PERSONA_V3}\n\n${OUTPUT_CONTRACT}`;
export const SYSTEM_PROMPT_HASH = hash(SYSTEM_PROMPT);

export function agentInput(reading) {
  if (![1, 3].includes(reading.cards?.length)) throw Object.assign(new Error("请选择 1 张或 3 张牌。"), { statusCode: 422 });
  const ids = new Set();
  for (const card of reading.cards) {
    if (!tarotDeck.some((item) => item.slug === card.slug) || ids.has(card.slug) || !["正位", "逆位"].includes(card.orientation)) {
      throw Object.assign(new Error("牌面数据不完整，请重新确认抽牌。"), { statusCode: 422 });
    }
    ids.add(card.slug);
  }
  return {
    user_query: reading.question,
    draw: reading.cards.map((card) => ({ card_id: card.slug, name: card.name, orientation: card.orientation, position: card.position || "", card_knowledge: getCardKnowledge(card) })),
    spread: { type: reading.cards.length === 1 ? "single" : "three", positions: reading.cards.map((card) => card.position || "") },
    known_facts: reading.knownFacts || [],
    conversation_summary: reading.conversationSummary || "",
    revision_feedback: reading.revisionFeedback || "",
    previous_response: reading.revisionFeedback ? reading.previousResponse || null : null,
    user_mood: reading.userMood || "未明确提供，不得当作事实推断",
    requested_roast_level: Number.isInteger(reading.roastLevel) && reading.roastLevel >= 0 && reading.roastLevel <= 3 ? reading.roastLevel : 2,
    channel: "图文",
    turn_type: reading.revisionFeedback ? "用户校准，沿用原问题和同一牌面重写" : reading.conversationSummary ? "连续追问，沿用同一牌面" : "首次解读"
  };
}

export function buildAgentPrompt(reading) {
  return { system: SYSTEM_PROMPT, user: JSON.stringify(agentInput(reading)) };
}

function requiredText(value, label, allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) throw new Error(`${label} 必须是${allowEmpty ? "" : "非空"}字符串`);
}

async function polishStrongVoice(output, reading, { apiKey, base, model }) {
  if (output.mode !== "reading" || output.style.roast_level !== 3) return { output, edited: false };
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: .82, max_tokens: 1400, response_format: { type: "json_object" }, messages: [
      { role: "system", content: '你是同一位嘴毒心软塔罗师的口语编辑。只改写给用户看的 response 五个字段，返回完整 JSON 对象：{"verdict":"","analysis":"","advice":"","screen":"","voice":""}。不能改判断方向、提问中的时间点、正逆位牌义、现实事实或行动建议；不能新编行为、情绪、动机或第三方想法。重复次数不等于越做越精、标准越来越高或用户故意逃避。用户选了 Lv.3：verdict 最多两句、约 45–70 汉字，先直接回答每个问题，再留一处比普通劝告更鲜明、出人意料、但善意的具体画面；不要在判词里重复事实两遍，也不要堆两个互不相关的比喻，展开的牌义放 analysis。可从 draft.voice 提炼最自然的一句，但不要照搬整段。比喻必须遵守牌面实际阶段：在途不能说成到岸，萌芽不能说成结果。只重复事实、加问号、语气更硬或解释“牌面说的是”都不算。吐槽用户已知的选择矛盾，不吐槽人格或痛苦。解析说人话，说明关键牌怎样支持结论；建议保持一件事。不要展示写作过程。' },
      { role: "user", content: JSON.stringify({ question: reading.question, cards: reading.cards.map(c => { const knowledge = getCardKnowledge(c); return { name: c.name, orientation: c.orientation, position: c.position, imagery: knowledge?.imagery, light: knowledge?.light, shadow: knowledge?.shadow }; }), reality: output.reality, judgment: output.judgment, evidence: output.evidence, synthesis: output.synthesis, draft: output.response }) }
    ] }), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`口语编辑服务暂时不可用（${response.status}）`);
  const data = await response.json();
  const content = String(data.choices?.[0]?.message?.content || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const edited = JSON.parse(content);
  for (const key of ["verdict", "analysis", "advice", "screen", "voice"]) requiredText(edited[key], `编辑.${key}`, key === "advice");
  return { output: { ...output, response: edited }, edited: true };
}

/** Validate model output without composing or changing any reading text. */
export function validateAgentOutput(output, reading) {
  if (!output || !["reading", "need_info", "safe_support"].includes(output.mode)) throw new Error("mode 无效");
  for (const field of ["verdict", "analysis", "advice", "screen", "voice"]) requiredText(output.response?.[field], `response.${field}`, field === "advice");
  if (!Number.isInteger(output.style?.roast_level) || output.style.roast_level < 0 || output.style.roast_level > agentInput(reading).requested_roast_level) throw new Error("实际毒舌等级超出用户选择范围");
  requiredText(output.style.reason, "style.reason");
  if (output.mode === "safe_support") {
    if (output.style.roast_level !== 0) throw new Error("安全支持必须关闭毒舌");
    const supportText = [output.response.verdict, output.response.analysis, output.response.advice, output.response.voice].join(" ");
    if (/(?:正位|逆位)/.test(supportText) || reading.cards.some((card) => supportText.includes(card.name))) throw new Error("安全支持不能用牌面解释危险处境");
  }
  if (output.mode !== "reading") return output;
  const reality = output.reality;
  if (!reality || typeof reality !== "object") throw new Error("reality 必须整理用户已知事实与未知项");
  requiredText(reality.decision_requested, "reality.decision_requested");
  for (const key of ["reported_benefits", "reported_costs", "other_facts", "unknowns"]) {
    if (!Array.isArray(reality[key]) || !reality[key].every(item => typeof item === "string" && item.trim())) throw new Error("reality." + key + " 必须是非空字符串数组");
  }

  if (!Array.isArray(output.evidence) || output.evidence.length !== reading.cards.length) throw new Error("evidence 必须覆盖全部且仅覆盖本次实际抽牌");
  reading.cards.forEach((card, index) => {
    const evidence = output.evidence[index];
    if (evidence.card_id !== card.slug || evidence.orientation !== card.orientation || evidence.position !== (card.position || "")) throw new Error(`evidence[${index}] 的牌名、牌位或正逆位不一致`);
    requiredText(evidence.meaning, "evidence.meaning");
    requiredText(evidence.relevance, "evidence.relevance");
  });
  if (reading.cards.length === 1 && output.synthesis !== null) throw new Error("单牌 synthesis 必须为 null");
  if (reading.cards.length === 3) requiredText(output.synthesis, "synthesis");
  if (!["明确倾向", "附带条件", "核心矛盾", "信息不足"].includes(output.judgment?.type)) throw new Error("judgment.type 无效");
  for (const field of ["conclusion", "tension", "uncertainty"]) requiredText(output.judgment?.[field], `judgment.${field}`, field !== "conclusion");
  return output;
}

async function auditFactBoundary(output, reading, { apiKey, base, model }) {
  if (output.mode !== "reading") return { checked: false, unsupported: [], decisionAnswered: true, reviewAttempts: 0 };
  const messages = [
    { role: "system", content: '你是独立审稿人，只评价用户最终会读到的 response，不把 style.reason 的自我宣称当成文风证据。逐句对照用户原话、reality、evidence 与 response。unsupported：列出最多2句把未提供的行为、动机、情绪、组织状况或第三方想法当成事实的文字；反问、比喻、吐槽中的暗示也算事实断言；没有来源的普遍数字阈值也算 unsupported，但明确提出的未来行动期限不算。牌义只支持可能模式，不证明用户已发生什么；明确条件句和未来建议不算断言；“别一个人想”“先去问人”这类未来劝告，若没有声称用户过去确实独自盘算，不算 unsupported。不要把用户报告的损耗无依据地解释为一时情绪，也不要凭某一好处脑补其他好处，或断言下一份工作会轻易复制当前收入、支持、成长；任职时间短可影响行动时机，不能单独推翻用户已述多项不匹配。decision_answered：若用户问多个决定或具体时间，verdict 必须逐一给出清楚倾向；问未来会不会发生，无法确定时须明确说无法确定并指出可验证的现实信号，不能只说“牌不保证”。不能把答案藏在 analysis 或 advice。非决策题为 true。quality_ok：明显无牌面推理、忽视主要已知收益或代价、完全像通用建议、建议与解析互相矛盾，或判词/解析的牌面画面、阶段与输入中实际牌知识矛盾时才为 false；合理条件判断合格。voice_ok：只检查明显的表达失败。Lv.0 或用户明确脆弱时，要求温柔自然且无讽刺；Lv.2/3 且用户给出足够事实时，verdict 应像当面说话，有一处由已知事实支持的善意犀利观察或反差。单纯复述事实、句尾加问号、自称“洞察毒舌”不算。Lv.3 若只重复事实、把劝告说得更硬而没有具体意外的画面或反差，也判 false。事实稀少时允许简短直说，不强求段子。若 verdict 冗长、重复同一事实或连续使用免责、审核、咨询报告式语言以致难听懂，判 false。风格不能以编造事实换取；有争议时保留安全合格文案，判 true。只返回一行 JSON：{"unsupported":[],"decision_answered":true,"decision_reason":"","quality_ok":true,"quality_reason":"","voice_ok":true,"voice_reason":""}。原因各不超过35字，不改写原文。' },
    { role: "user", content: JSON.stringify({ question: reading.question, reality: output.reality, judgment: output.judgment.conclusion, cards: reading.cards.map(c => { const knowledge = getCardKnowledge(c); return { name: c.name, orientation: c.orientation, position: c.position, imagery: knowledge?.imagery, light: knowledge?.light, shadow: knowledge?.shadow }; }), evidence: output.evidence.map(({ card_id, orientation, position, meaning, relevance }) => ({ card_id, orientation, position, meaning, relevance })), roast_level: output.style.roast_level, response: { verdict: output.response.verdict, analysis: output.response.analysis, advice: output.response.advice } }) }
  ];
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${base}/v1/chat/completions`, {
        method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 2600, response_format: { type: "json_object" }, messages }),
        signal: AbortSignal.timeout(45000)
      });
      if (!response.ok) throw Object.assign(new Error(`审稿服务暂时不可用（${response.status}）`), { statusCode: 503 });
      const data = await response.json();
      const content = String(data.choices?.[0]?.message?.content || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      let audit;
      try { audit = JSON.parse(content); }
      catch {
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start < 0 || end <= start) throw new SyntaxError("审稿 JSON 不完整");
        audit = JSON.parse(content.slice(start, end + 1));
      }
      if (!Array.isArray(audit.unsupported) || !audit.unsupported.every(item => typeof item === "string") || typeof audit.decision_answered !== "boolean" || typeof audit.quality_ok !== "boolean" || typeof audit.voice_ok !== "boolean") throw new Error(`审稿 JSON 字段不完整：${Object.keys(audit).join(',')}`);
      return { checked: true, unsupported: audit.unsupported.slice(0, 2), decisionAnswered: audit.decision_answered, decisionReason: String(audit.decision_reason || ""), qualityOk: audit.quality_ok, qualityReason: String(audit.quality_reason || ""), voiceOk: audit.voice_ok, voiceReason: String(audit.voice_reason || ""), reviewAttempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw Object.assign(new Error("AI 解读校验暂时没有完成，牌面已保留，请重试。"), { statusCode: 503, cause: lastError });
}

export async function generateTarotAgent(reading) {
  if (!isReadingApiConfigured()) throw Object.assign(new Error("AI 解读尚未连接，请配置解读服务后重试。"), { statusCode: 503 });
  const { apiKey, base, model } = getReadingApiConfig();
  const prompt = buildAgentPrompt(reading);
  const messages = [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }];
  const started = Date.now();
  const callId = randomUUID();
  let lastError;
  let requestId = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let content = "";
    let parsed = false;
    let candidateForFeedback = "";
    try {
      const response = await fetch(`${base}/v1/chat/completions`, {
        method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, temperature: .72, max_tokens: 5000, response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(65000)
      });
      if (!response.ok) throw Object.assign(new Error(`解读服务暂时不可用（${response.status}），请稍后重试。`), { statusCode: 503 });
      const data = await response.json();
      requestId = data.id || null;
      content = data.choices?.[0]?.message?.content || "";
      const raw = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
      parsed = true;
      validateAgentOutput(raw, reading);
      const styled = await polishStrongVoice(raw, reading, { apiKey, base, model });
      validateAgentOutput(styled.output, reading);
      candidateForFeedback = JSON.stringify(styled.output);
      const factAudit = await auditFactBoundary(styled.output, reading, { apiKey, base, model });
      if (factAudit.unsupported.length) throw new Error(`以下句子把未提供的信息当成事实：${factAudit.unsupported.join('；')}`);
      if (!factAudit.decisionAnswered) throw new Error(`判词未直接回答用户的决策问题：${factAudit.decisionReason}`);
      if (!factAudit.qualityOk) throw new Error(`文案的人设、牌面推理或口语表达不足：${factAudit.qualityReason}`);
      if (!factAudit.voiceOk) throw new Error(`表达不像这位塔罗师在当面说话：${factAudit.voiceReason}`);
      return {
        output: styled.output,
        trace: { callId, requestId, model, version: AGENT_VERSION, personaHash: PERSONA_HASH, systemPromptHash: hash(prompt.system), outputHash: hash(JSON.stringify(styled.output)), latencyMs: Date.now() - started, attempts: attempt + 1, source: "model", modelEdited: styled.edited, rewritten: false, ruleFallback: false, validation: "passed", factAudit: factAudit.checked ? "model-checked" : "not-applicable", auditAttempts: factAudit.reviewAttempts }
      };
    } catch (error) {
      lastError = error;
      if (error.statusCode === 503 && error.cause) break;
      if (!content) {
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      if (parsed) messages.push({ role: "assistant", content: candidateForFeedback || content });
      messages.push({ role: "user", content: `请修正输出问题：${error.message}。保持同一实际牌面与人设，重新输出完整合法 JSON；不要由程序替你补解读。` });
    }
  }
  throw Object.assign(new Error(lastError?.statusCode === 503 ? lastError.message : "AI 本次未返回完整且匹配牌面的解读，请重试。"), { statusCode: 503 });
}
