import { createHash, randomUUID } from "node:crypto";
import { TAROT_PERSONA_V3 } from "./reading-persona.js";
import { getReadingApiConfig, isReadingApiConfigured } from "./dmx-reading-api.js";
import { getCardKnowledge } from "./tarot-knowledge.js";
import { tarotDeck } from "./tarot-data.js";

export const AGENT_VERSION = "moonlit-v5.21-20261028";
const hash = (value) => createHash("sha256").update(value).digest("hex");
export const PERSONA_HASH = hash(TAROT_PERSONA_V3);

const OUTPUT_CONTRACT = `【应用输出】只返回 JSON，不要 Markdown。所有给用户看的话由 AI 原创，程序不补写塔罗结论。
{
 "mode":"reading | need_info | safe_support",
 "reality":{"decision_requested":"用户真正问的决定；如有时间点须保留","reported_benefits":["原话给出的好处"],"reported_costs":["原话给出的代价"],"other_facts":["原话给出的其他事实"],"unreported_context":["用户未提供、模型无法判断的现实信息；不代表用户本人不知道"]},
 "judgment":{"type":"明确倾向 | 附带条件 | 核心矛盾 | 信息不足","conclusion":"明确结论","tension":"有依据的权衡","uncertainty":"哪些现实信息没有提供给模型；不能写成用户自己没核实"},
 "evidence":[{"card_id":"实际抽中的牌","orientation":"正位或逆位","position":"实际牌位","meaning":"该牌在本次正逆位的专业含义","user_anchor":null,"relevance":"牌义如何影响用户的问题，而不是证明现实事实；有用户事实时 user_anchor 写原话短句，否则 null"}],
 "synthesis":{"connection":"三张牌如何形成这次问题特有的主线","alternative":"同一牌阵在事实未知时另一种合理解释","deciding_signal":"哪一个现实信号能区分两种解释"},
 "response":{"verdict":"一到三句当面说的话；先直接回答每个问题，再给有依据的善意反差；Lv.0 不调侃","analysis":"用自然短句讲清现实、关键牌义及多牌关系，避免逐张报账和免责腔","advice":"一个能验证关键未知项的具体动作，或空字符串","screen":"6–14字短句","voice":"独立可读的口语版本"},
 "style":{"roast_level":0,"reason":"采用此强度的理由"}
}
【推理顺序】
1. reality 只收用户已明确说过的事；把未提供的信息放到 unreported_context，优先保留一到两项真正会改变判断的背景，不罗列通用职业清单。用户没告诉模型，不等于用户自己不知道、没问过或没核实；不要把沉默当作现实中的信息缺失。收益与代价都要进入权衡；一项好处不能自动扩展成其他好处，也不能断言下一份工作会轻易复制当前收益。用户明确的不适不因时长短或牌面而变成「情绪放大」。
2. evidence 按 draw 的每张牌逐项填写，card_id、正逆位、牌位完全一致。card_knowledge.selectedMeaning 是本次正逆位的主要语义。user_anchor 只能引用用户已提供的具体事实短句；没有对应事实就填 null，relevance 只能提出本牌让人核实的可能性或判断角度。不要把逆位侍从直接写成用户懒惰、同事传话、承诺落空或公司问题；牌位也不证明这些已发生。三牌的 synthesis 要先讲主线，再讲另一种合理读法，最后说明哪项现实信号可区分两者；不能用第二种读法当免责清单，也不能无事实就把第一种读法写成现实结论。单牌 synthesis=null。
3. judgment 先依据牌阵形成一个有方向的暂时行动判断，同时正面处理 synthesis.alternative：为什么暂取这一边，什么现实信号会使判断改变。用户没有提供足以比较的现实收益与代价时，不强迫判断最终留或走；必须明确现在采取什么行动（例如暂缓不可逆的决定、在原岗位做一次有目标的核实，或开始准备替代方案），并用本次牌阵说明为什么是这一步。不要对用户说“你给的信息不够”，而是说“就这组牌，我倾向先……；若现实中……，判断会变”。只有“判不了，先查工资成长”这种没有牌面依据的通用清单才不合格。不能机械把星币译为薪酬账本、宝剑译为消息核实；从 selectedMeaning 找本次牌真正不同的作用。已知事实必须优先于牌面想象；未来是否继续，应看下一阶段可能得到什么和付出什么，不能仅凭过去已完成或尚未完成决定。
4. 先确定每个子问题的答案，再写 response。verdict 用一到三句：第一句给暂时倾向，后面用这组牌独有的因果关系解释，不把所有牌名硬塞进判词。用户问多个问题时逐一回答。问未来会不会发生时，若无法确定，明确说无法确定并指出可验证的现实信号。analysis 用可以念出来的短句，说明实际正逆位与牌位如何共同改变判断；不要把建议位逆牌读成用户已犯的错。advice 只给一件与建议牌对应的可执行核实动作；若无法知道用户是否已核实，可说“如果这项还不清楚，就核对它”，不能命令用户补做一件可能已经完成的事。不擅自指定用户任职时长、过去半年、几个月期限或固定三项清单。Lv.2/3 只有用户提供足够事实时才从真实矛盾长出善意反差；事实少时不靠牌名数量、倒置画面或拟人双关硬凑笑点。
5. 逐句检查用户可见文字：陈述、反问、玩笑、比喻都不能暗示 reality 里没有的既往行为、动机、心理、工作状况或第三方想法。问题只给一句话时，牌的焦虑、过渡、共情等主题也不能直接变成“你在熬夜想最坏结果”“你已经在离开”“你怕别人为难”等经历；写成这张牌提醒你留意的风险，或说明若现实中确有这种情形才如何判断。不要用具体故事来补全用户的沉默。若某个心理解释在前句只是“如果”，后句也不能悄悄改写成用户确有此动机的拉扯；条件必须贯穿判词、解析与建议。次数只证明重复，不证明每次更精、标准更高、投入更认真或故意逃避。不要凭用户的一个数字发明一般阈值，例如“计划改到第三版多数时候够用”；具体期限可以作为建议提出，不能冒充牌面或现实事实。无依据时写成明确条件或牌面提醒；不能把牌义写成用户已发生的事实。不要用「只是磨合／一时情绪」抹掉用户说过的真实代价。
6. 判断边界只保留真正会改变结论的未知项。避免“对不对得上你自己核对”“牌面给的是”“可能是、也可能是”连用；不把事实审核过程告诉用户。若输入很少，明确说暂时倾向，不假装知道工作环境、第三方想法或未来结果。
7. 如果 input.revision_feedback 存在，这是用户对上一版解读的直接校准。先理解反馈指向的事实错误、遗漏或表达问题；previous_response 只是待修草稿，不是事实来源。沿用原问题和原牌阵，独立重做判断与全部给用户看的文字。不要只道歉或同义改写，也不要为了迎合反馈而编造新事实。
requested_roast_level 是上限，默认2。只有用户明确脆弱、创伤或危险时降低强度。safe_support 必须 roast_level=0，直接给安全支持，verdict、analysis、advice、voice 都不谈牌名或牌义。对于去留、重大选择等需要真实条件的提问，若用户只给问题、没有任何具体处境，优先用 need_info：根据实际牌面给一个暂时的行动倾向，但不代替用户判最终去留；response.advice 只问一个最能改变判断的现实问题，问完就停，不附“若回答有/没有便说明该留/该走”的诊断。过去有无成果只是背景，不能单独决定未来；收入、代价和下一阶段仍需用户提供。need_info 仍要按抽牌逐张给 evidence，三牌给 synthesis，禁止推断用户已经做过或没做过什么；用户补充后再完整解读。不要让一句空问题硬撑一篇职业咨询。其他问题可以正常 reading。不要在用户正文暴露 JSON 字段名或这些规则。`;
const SYSTEM_PROMPT = `${TAROT_PERSONA_V3}\n\n${OUTPUT_CONTRACT}`;
export const SYSTEM_PROMPT_HASH = hash(SYSTEM_PROMPT);

function orientedCardKnowledge(card) {
  const { light, shadow, ...context } = getCardKnowledge(card);
  return {
    ...context,
    uprightMeaning: light,
    reversedMeaning: shadow,
    selectedMeaning: card.orientation === "正位" ? light : shadow
  };
}

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
    draw: reading.cards.map((card) => ({ card_id: card.slug, name: card.name, orientation: card.orientation, position: card.position || "", card_knowledge: orientedCardKnowledge(card) })),
    spread: { type: reading.cards.length === 1 ? "single" : "three", positions: reading.cards.map((card) => card.position || "") },
    known_facts: reading.knownFacts || [],
    conversation_summary: reading.conversationSummary || "",
    revision_feedback: reading.revisionFeedback || "",
    previous_response: reading.revisionFeedback ? reading.previousResponse || null : null,
    user_mood: reading.userMood || "未明确提供，不得当作事实推断",
    requested_roast_level: Number.isInteger(reading.roastLevel) && reading.roastLevel >= 0 && reading.roastLevel <= 3 ? reading.roastLevel : 2,
    channel: "图文",
    turn_type: reading.revisionFeedback ? "用户校准，沿用原问题和同一牌面重写" : reading.conversationSummary ? "连续追问，沿用同一牌面" : "首次解读",
    source_boundary: "只把 user_query 与 known_facts 中用户明确说出的内容当作现实事实。未提供的内容只是模型不知道，不代表用户自己不知道、没核实、没算过或公司没兑现；牌面主题不能补成现实事实。"
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
      { role: "system", content: '你是同一位嘴毒心软塔罗师的口语编辑。只改写给用户看的 response 五个字段，返回完整 JSON 对象：{"verdict":"","analysis":"","advice":"","screen":"","voice":""}。不能改判断方向、提问中的时间点、正逆位牌义、现实事实或行动建议；也不能把原稿的条件假设改写成用户确有的心理或行为；不能新编行为、情绪、动机或第三方想法。重复次数不等于越做越精、标准越来越高或用户故意逃避。用户选了 Lv.3：verdict 最多两句、约 45–70 汉字，先直接回答每个问题，再留一处比普通劝告更鲜明、出人意料、但善意的具体画面；不要在判词里重复事实两遍，也不要堆两个互不相关的比喻，展开的牌义放 analysis。可从 draft.voice 提炼最自然的一句，但不要照搬整段。比喻必须遵守牌面实际阶段：在途不能说成到岸，萌芽不能说成结果。只重复事实、加问号、语气更硬或解释“牌面说的是”都不算。吐槽用户已知的选择矛盾，不吐槽人格或痛苦。解析说人话，说明关键牌怎样支持结论；建议保持一件事。不要展示写作过程。' },
      { role: "user", content: JSON.stringify({ question: reading.question, cards: reading.cards.map(c => ({ name: c.name, orientation: c.orientation, position: c.position, ...orientedCardKnowledge(c) })), reality: output.reality, judgment: output.judgment, evidence: output.evidence, synthesis: output.synthesis, draft: output.response }) }
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
  if (output.mode === "need_info" && !/[？?]$/.test(output.response.advice.trim())) throw new Error("补充信息模式只能以一个待回答的问题结尾");
  if (!Number.isInteger(output.style?.roast_level) || output.style.roast_level < 0 || output.style.roast_level > agentInput(reading).requested_roast_level) throw new Error("实际毒舌等级超出用户选择范围");
  requiredText(output.style.reason, "style.reason");
  if (output.mode === "safe_support") {
    if (output.style.roast_level !== 0) throw new Error("安全支持必须关闭毒舌");
    const supportText = [output.response.verdict, output.response.analysis, output.response.advice, output.response.voice].join(" ");
    if (/(?:正位|逆位)/.test(supportText) || reading.cards.some((card) => supportText.includes(card.name))) throw new Error("安全支持不能用牌面解释危险处境");
  }
  if (output.mode === "safe_support") return output;
  const reality = output.reality;
  if (!reality || typeof reality !== "object") throw new Error("reality 必须整理用户已知事实与未知项");
  requiredText(reality.decision_requested, "reality.decision_requested");
  for (const key of ["reported_benefits", "reported_costs", "other_facts", "unreported_context"]) {
    if (!Array.isArray(reality[key]) || !reality[key].every(item => typeof item === "string" && item.trim())) throw new Error("reality." + key + " 必须是非空字符串数组");
  }

  if (!Array.isArray(output.evidence) || output.evidence.length !== reading.cards.length) throw new Error("evidence 必须覆盖全部且仅覆盖本次实际抽牌");
  reading.cards.forEach((card, index) => {
    const evidence = output.evidence[index];
    if (evidence.card_id !== card.slug || evidence.orientation !== card.orientation || evidence.position !== (card.position || "")) throw new Error(`evidence[${index}] 的牌名、牌位或正逆位不一致`);
    requiredText(evidence.meaning, "evidence.meaning");
    requiredText(evidence.relevance, "evidence.relevance");
    if (evidence.user_anchor !== null) {
      requiredText(evidence.user_anchor, "evidence.user_anchor");
      const sources = [reading.question, ...(reading.knownFacts || [])].filter(value => typeof value === "string");
      if (!sources.some(source => source.includes(evidence.user_anchor))) throw new Error(`evidence[${index}] 的用户事实锚点不是原话`);
    }
  });
  if (reading.cards.length === 1 && output.synthesis !== null) throw new Error("单牌 synthesis 必须为 null");
  if (reading.cards.length === 3) {
    if (!output.synthesis || typeof output.synthesis !== "object" || Array.isArray(output.synthesis)) throw new Error("三牌 synthesis 必须包含主线、另一种读法和区分信号");
    for (const field of ["connection", "alternative", "deciding_signal"]) requiredText(output.synthesis[field], `synthesis.${field}`);
  }
  if (!["明确倾向", "附带条件", "核心矛盾", "信息不足"].includes(output.judgment?.type)) throw new Error("judgment.type 无效");
  for (const field of ["conclusion", "tension", "uncertainty"]) requiredText(output.judgment?.[field], `judgment.${field}`, field !== "conclusion");
  return output;
}

async function auditFactBoundary(output, reading, { apiKey, base, model }) {
  if (output.mode === "safe_support") return { checked: false, unsupported: [], decisionAnswered: true, qualityOk: true, voiceOk: true, reviewAttempts: 0 };
  const messages = [
    { role: "system", content: `你是独立审稿人，只评价用户最终会读到的 response 及其推理依据。用户问题、明确事实、实际抽牌是证据；牌义只能提出观察角度，不能证明用户、同事或公司已经做过什么。
逐项独立审查：
1. unsupported：最多列出3处把未提供的行为、动机、承诺、传话、任职时间、收益或损失写成既成事实的文字；检查 reality、judgment、evidence.relevance、synthesis、response 全链路。“可能”“更像”、反问、玩笑也不能掩盖已暗示的事实。未来建议和明确条件假设可接受，但后文不能把假设升级成事实。user_anchor 必须确实支撑该牌对现实的应用；null 表示没有用户事实可作证。reality.unreported_context 只表示模型没收到信息，不能推断用户本人“没问清”“账没算”“只有传闻”或公司确实信息混乱；“我没听到资源安排”可以，“你的资源账单空着/去问清资源”若暗示用户尚未确认则不行。用户已说清楚某项事实时，不能用逆位牌否定它或凭空增加另一项已缺失的事实。可说“我还不知道”，不能说“你还没核实”。
2. decision_answered：先看 mode 与用户给出的现实事实。reading 事实充分时，verdict 必须回答去留或行动方向；事实稀少时，不得强迫牌替现实决定去留，但 verdict 必须给一项明确的当前行动决定，并说清它怎样从本次牌阵得来、哪项现实信号会改变该行动。need_info 则须给牌面的暂时行动方向，并只问一个真正会改变判断的现实问题，不要求最终去留答案。只有“判不了”“先核对收入、成长、消耗”这样的通用清单，或没有动作的对称条件句才为 false。多子问题须逐一回答，未来事件不能保证时要明说。
3. quality_ok：本次正逆位和牌位须解释正确，evidence 到 synthesis 到 verdict/advice 要形成能追溯的逻辑。若把逆位的风险写成用户或第三方现状，或从宝剑沟通风险无依据跳到“同事传话”，从星币务实风险跳到“承诺未兑现”，判 false。若换一组三张牌也能原样使用这段职业账本，或机械把星币写成工资账、宝剑写成消息核实，或建议牌只被当成用户已犯的错，判 false。检查 synthesis.alternative 是否是真正合理的另一读法，deciding_signal 是否能区分两种解释；若最终判词在没有用户事实支持时忽略另一读法、把牌面某个阶段当成现实已发生，判 false。过去成果或未完成目标不能单独决定是否继续。need_info 的 advice 必须问完就停；若把某个答案提前解释为岗位本身有问题或只需调整投入、替用户做去留诊断，判 false。建议的具体对象、期限、数量不能冒充用户提供的事实。
4. voice_ok：检查 verdict、analysis、advice。事实少时允许简短、诚实、带一点锋芒，但不强求毒舌。直说“你给的信息不够”、数牌、牌翻身/躺下、无关双关、人格标签、连续审核报告式句子均不是洞察；明显破坏口语与理解时判 false。幽默须来自用户真实事实与牌的因果关系。
只返回一行 JSON：{"unsupported":[],"decision_answered":true,"decision_reason":"","quality_ok":true,"quality_reason":"","voice_ok":true,"voice_reason":""}。原因各不超过50字。` },
    { role: "user", content: JSON.stringify({ mode: output.mode, question: reading.question, reality: output.reality, judgment: output.judgment, cards: reading.cards.map(c => ({ name: c.name, orientation: c.orientation, position: c.position, ...orientedCardKnowledge(c) })), evidence: output.evidence, synthesis: output.synthesis, roast_level: output.style.roast_level, response: { verdict: output.response.verdict, analysis: output.response.analysis, advice: output.response.advice } }) }
  ];
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${base}/v1/chat/completions`, {
        method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 8000, response_format: { type: "json_object" }, messages }),
        signal: AbortSignal.timeout(45000)
      });
      if (!response.ok) throw Object.assign(new Error(`审稿服务暂时不可用（${response.status}）`), { statusCode: 503 });
      const data = await response.json();
      const content = String(data.choices?.[0]?.message?.content || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      if (process.env.MOONLIT_DEBUG_AGENT === "1") console.warn("tarot audit response", { chars: content.length, finishReason: data.choices?.[0]?.finish_reason, closed: content.endsWith("}") });
      let audit;
      try { audit = JSON.parse(content); }
      catch {
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start < 0 || end <= start) throw new SyntaxError("审稿 JSON 不完整");
        audit = JSON.parse(content.slice(start, end + 1));
      }
      if (!Array.isArray(audit.unsupported) || !audit.unsupported.every(item => typeof item === "string") || typeof audit.decision_answered !== "boolean" || typeof audit.quality_ok !== "boolean" || typeof audit.voice_ok !== "boolean") throw new Error(`审稿 JSON 字段不完整：${Object.keys(audit).join(',')}`);
      return { checked: true, unsupported: audit.unsupported.slice(0, 3), decisionAnswered: audit.decision_answered, decisionReason: String(audit.decision_reason || ""), qualityOk: audit.quality_ok, qualityReason: String(audit.quality_reason || ""), voiceOk: audit.voice_ok, voiceReason: String(audit.voice_reason || ""), reviewAttempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      if (process.env.MOONLIT_DEBUG_AGENT === "1") console.warn("tarot audit retry", attempt + 1, error.message);
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw Object.assign(new Error("AI 解读校验暂时没有完成，牌面已保留，请重试。"), { statusCode: 503, cause: lastError });
}

export async function generateTarotAgent(reading) {
  if (!isReadingApiConfigured()) throw Object.assign(new Error("AI 解读尚未连接，请配置解读服务后重试。"), { statusCode: 503 });
  const { apiKey, base, model } = getReadingApiConfig();
  const prompt = buildAgentPrompt(reading);
  const baseMessages = [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }];
  const started = Date.now();
  const callId = randomUUID();
  let lastError;
  let requestId = null;
  let revisionFeedback = "";
  let previousValidContent = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const messages = revisionFeedback
      ? [...baseMessages, ...(previousValidContent ? [{ role: "assistant", content: previousValidContent }] : []), { role: "user", content: revisionFeedback }]
      : baseMessages;
    let content = "";
    try {
      const response = await fetch(`${base}/v1/chat/completions`, {
        method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, temperature: .45, max_tokens: 5000, response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(65000)
      });
      if (!response.ok) throw Object.assign(new Error(`解读服务暂时不可用（${response.status}），请稍后重试。`), { statusCode: 503 });
      const data = await response.json();
      requestId = data.id || null;
      content = data.choices?.[0]?.message?.content || "";
      const raw = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
      validateAgentOutput(raw, reading);
      previousValidContent = content;
      const styled = await polishStrongVoice(raw, reading, { apiKey, base, model });
      validateAgentOutput(styled.output, reading);
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
      if (process.env.MOONLIT_DEBUG_AGENT === "1") console.warn("tarot generation retry", attempt + 1, error.message);
      if (error.statusCode === 503 && error.cause) break;
      if (!content) {
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      revisionFeedback = `上一版未通过复核：${error.message}。请修正上版 JSON 中引发此问题的推理与文案，保留已经正确的牌义和已知事实。尤其不要把“用户没告诉模型”写成“用户没有核实”；如果某项现实前提没有用户原话支撑，就从判断、synthesis 和 response 中一并撤掉，改为明确的核实方向。不要只给原猜测加“可能/如果”，不要引入另一段新故事。事实稀少时，给清楚的当下行动决定和能改变它的一项现实信号；若 mode=need_info，保持只追问一项关键背景，不把牌义写成用户现状。返回完整合法 JSON。`;
    }
  }
  throw Object.assign(new Error(lastError?.statusCode === 503 ? lastError.message : "AI 本次未返回完整且匹配牌面的解读，请重试。"), { statusCode: 503 });
}
