/**
 * 系统化牌理推理层
 *
 * 解读 = 问题语境 × 牌位角色 × 牌面语义（元素/数字/宫廷/大牌原型 × 正逆）
 *
 * 不依赖「愚者+隐士」式 case 表；78 张牌通过组合 grammar 生成扣题短句。
 */
import {
  contextualValence,
  getCardKnowledge,
  majorKnowledge,
  numerologyMeaning,
  courtMeaning
} from "./tarot-knowledge.js";
import { resolveReadingContext, READING_INTENTS as QUESTION_INTENTS } from "./public/question-profile.js";

export { QUESTION_INTENTS };

/** 大牌原型族（22 张归并到 8 族，再 × 问题域 × 牌位 读） */
const MAJOR_FAMILIES = {
  beginning: ["愚者", "魔术师"],
  inner_search: ["女祭司", "隐士", "倒吊人"],
  nurture_structure: ["皇后", "皇帝", "教皇"],
  will_choice: ["恋人", "战车", "力量"],
  cycle_justice: ["命运之轮", "正义"],
  ending_change: ["死神", "高塔"],
  shadow_confusion: ["恶魔", "月亮"],
  clarity_growth: ["星星", "太阳", "审判", "世界"],
  balance: ["节制"]
};

function majorFamily(name) {
  for (const [family, names] of Object.entries(MAJOR_FAMILIES)) {
    if (names.includes(name)) return family;
  }
  return "beginning";
}

function pickFacet(card, rev, ctx) {
  const k = getCardKnowledge(card);
  const pool = rev
    ? (card.reversed?.length ? card.reversed : String(k?.shadow || "").split("、"))
    : (card.upright?.length ? card.upright : String(k?.light || card.keywords?.join("、") || "").split("、"));
  const words = pool.filter(Boolean);

  const elem = card.suitKey || card.element;
  const court = cardCourt(card);
  const relAct =
    ctx
    && (ctx.domain === "relationship" || ctx.intent === "yes_no_decision")
    && /主动|开口|靠近|联系|要不要|该不该/.test(ctx.question || "");

  if (relAct && (elem === "swords" || elem === "风")) {
    const soft = words.find((w) => /言语|沟通|多疑|信息|鲁莽|轻率|观察|消息|表达/.test(w));
    if (soft) return soft;
    if (court === "page") return rev ? "表达方式还欠稳" : "试探性靠近";
  }

  if (ctx?.domain === "relationship" && rev) {
    const gentle = words.find((w) => /言语|沟通|多疑|信息|鲁莽|轻率|观察|消息/.test(w));
    if (gentle) return gentle;
  }

  if (ctx && (ctx.domain === "emotion" || ctx.intent === "emotion_regulation")) {
    const gentle = words.find((w) => /焦虑|失眠|担心|休息|希望|疗愈|迷雾|不安|恐惧|压力|疲惫/.test(w));
    if (gentle) return gentle;
    const harsh = /谣言|中伤|报复|冷酷|毁灭|死亡|恶魔/;
    if (harsh.test(words[0] || "")) {
      return rev ? "需要被看见的不安" : "恢复的小入口";
    }
  }

  if (ctx && (ctx.domain === "self" || ctx.intent === "self_clarity")) {
    const gentle = words.find((w) => /内省|独处|觉醒|希望|疗愈|勇气|整合|释放|重生|信心|成长/.test(w));
    if (gentle) return gentle;
    if (rev) return "旧模式还在拉扯";
    return "自我辨认";
  }

  return words[0] || card.keywords?.[0] || "信号";
}

function cardNumber(card) {
  const slug = card.slug || "";
  const rank = slug.split("-")[1];
  const map = { ace: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  return map[rank] || null;
}

function cardCourt(card) {
  const slug = card.slug || "";
  const rank = slug.split("-")[1];
  return ["page", "knight", "queen", "king"].includes(rank) ? rank : null;
}

/**
 * 从 reading 推断解读语境（委托 question-profile 单源）
 */
export function inferQuestionContext(reading) {
  return resolveReadingContext({
    question: reading.question,
    theme: reading.theme,
    themeLabel: reading.themeLabel,
    profile: reading.questionProfile
  });
}

/** 情绪域 × 元素 × 牌位 */
function emotionElementLine(element, pos, facet, rev, ctx) {
  const sleepIssue = /失眠|睡不着|夜|凌晨/.test(ctx.question || "");

  if (element === "风" || element === "swords") {
    if (pos === "现状") return rev ? `思绪停不下、自我审问在放大` : sleepIssue ? `头脑高度警觉，夜里尤其难关机` : `理性在接管——${facet}让心很难松下来`;
    if (pos === "阻碍") return rev ? `用分析/自责困住自己，越问越睡不着` : sleepIssue ? `夜间的反复想拖住休息` : `过度思考把感受搁在后面`;
    if (pos === "建议") return rev ? `把担心写下一句就停，别在脑内连播` : `给大脑一个「下班信号」：清单落纸面，然后离开屏幕`;
  }
  if (element === "水" || element === "cups") {
    if (pos === "现状") return rev ? `情绪翻涌、界限模糊，难自我安抚` : `感受是入口——${facet}需要被好好接住`;
    if (pos === "阻碍") return rev ? `逃避感受或压抑需要，反而更耗` : `感受没出口，转成身体/睡眠的警报`;
    if (pos === "建议") return rev ? `先允许自己难过/害怕，再谈下一步` : `用一件小的自我照顾（热水/呼吸/找人聊）先稳住`;
  }
  if (element === "火" || element === "wands") {
    if (pos === "现状") return rev ? `内在耗竭、冲劲断档` : `还有恢复的火种，但不宜再硬撑`;
    if (pos === "阻碍") return rev ? `燃尽感拖住行动` : `把「必须立刻好起来」压在自己身上`;
    if (pos === "建议") return rev ? `先减一项任务，留恢复空间` : `做一件 10 分钟就能完成、能感到「我还好」的小事`;
  }
  if (element === "土" || element === "pentacles") {
    if (pos === "现状") return rev ? `身体/日常节奏失衡，安全感下滑` : `回到身体与日常——${facet}是稳住的锚`;
    if (pos === "阻碍") return rev ? `用忙碌/刷手机逃避，睡眠更碎` : `生活结构松散，情绪缺少容器`;
    if (pos === "建议") return rev ? `固定一个最小作息锚点（如起床时间）` : `今晚优先：睡眠、饮食、散步里选一项先做到`;
  }
  if (pos === "现状") return rev ? `${facet}在情绪里翻涌` : `感受层面——${facet}是当前信号`;
  if (pos === "阻碍") return rev ? `情绪淹没判断` : `卡点在你如何对待自己的需要`;
  if (pos === "建议") return rev ? `先照顾身体，再谈决定` : `朝${facet}迈一小步，不求立刻想通`;
  return rev ? `${facet}仍在拉扯` : `${facet}值得先被看见`;
}

/** 自我域 × 元素 × 牌位 */
function selfElementLine(element, pos, facet, rev, ctx) {
  const release = /放下|走出来|走不出|翻篇|释怀|忘记/.test(ctx.question || "");

  if (element === "风" || element === "swords") {
    if (pos === "现状") return rev ? `自我批判/过度分析在拖住你` : `清晰认知是入口——先辨认反复出现的念头`;
    if (pos === "阻碍") return rev ? `用「想通」代替行动，越内耗越僵` : `卡在自我怀疑或完美主义`;
    if (pos === "建议") return rev ? `把评判改成观察：「我注意到…」` : `把标准从「一次到位」改成「先迈一步」`;
  }
  if (element === "水" || element === "cups") {
    if (pos === "现状") return rev ? `感受被压住太久，难自我接纳` : `感受是线索——${facet}指向真正需要被接住的自己`;
    if (pos === "阻碍") return rev ? `逃避脆弱，反而更孤独` : release ? `还没允许哀伤/失落被看见` : `用取悦他人代替自我确认`;
    if (pos === "建议") return rev ? `先对自己说一句真实需要` : `做一件只为取悦自己的事，不附带产出`;
  }
  if (element === "火" || element === "wands") {
    if (pos === "现状") return rev ? `动力断档，像燃尽` : `仍有重新点燃的可能——从小目标开始`;
    if (pos === "阻碍") return rev ? `怕再投入会受伤，所以不敢动` : `把「必须立刻改变」压在自己身上`;
    if (pos === "建议") return rev ? `恢复一项你曾喜欢的微行动` : `选一件 10 分钟能完成、只属于你的事`;
  }
  if (element === "土" || element === "pentacles") {
    if (pos === "现状") return rev ? `日常失序，安全感下滑` : `回到身体与节奏——${facet}是稳住的锚`;
    if (pos === "阻碍") return rev ? `用忙碌证明自己值得，反而更空` : `价值感绑在外在成就上`;
    if (pos === "建议") return rev ? `固定一个最小自我照顾习惯` : `列三条「我做得还不错」的事实，每天只看一次`;
  }
  if (pos === "现状") return rev ? `${facet}还未整合` : `自我辨认中——${facet}是当前信号`;
  if (pos === "阻碍") return rev ? `旧模式拖住更新` : `卡点在你如何定义「值得」`;
  if (pos === "建议") return rev ? `先松绑，再求答案` : `朝${facet}迈一小步，重建自我证据`;
  return rev ? `${facet}仍在拉扯` : `${facet}值得先被看见`;
}

/** 元素 × 问题域 × 牌位：韦特系专业读法（无意象堆砌） */
function elementLine(ctx, element, pos, facet, rev) {
  const { domain, intent } = ctx;
  const d = domain;
  const career = d === "career" || (d === "decision" && /offer|工作/.test(ctx.question));

  if (d === "emotion" || intent === "emotion_regulation") {
    return emotionElementLine(element, pos, facet, rev, ctx);
  }

  if (d === "self" || intent === "self_clarity") {
    return selfElementLine(element, pos, facet, rev, ctx);
  }

  if (element === "风" || element === "swords") {
    if (career || intent === "outcome_forecast" && /offer|面试/.test(ctx.question)) {
      if (pos === "现状") return rev ? `${facet}让信息/沟通未理顺，别用猜补全 offer 画面` : `评估与筛选是主线——${facet}指向信息/表达是当前关键`;
      if (pos === "阻碍") return rev ? `言语误读或过度分析拖慢判断` : `信息不全、沟通卡壳或各自保留`;
      if (pos === "建议") return rev ? `先停猜，用一个问题把事实问清` : `用清晰、专业的表达确认进度与条件`;
    }
    if (d === "relationship" || intent === "partner_attitude") {
      if (pos === "现状") return rev ? `多疑或消息误读，别靠脑补` : `话还没说透，${facet}在关系里是关键`;
      if (pos === "阻碍") return rev ? `用分析代替靠近，越问越僵` : `沟通方式或信息不全卡住互动`;
      if (pos === "建议") return rev ? `先核实一条让你焦虑的信息` : `一句清晰、低压的表达比试探有效`;
    }
    if (intent === "yes_no_decision" && /主动|开口|靠近|联系|要不要|该不该/.test(ctx.question)) {
      if (pos === "今日指引" || pos === "建议" || pos === "我") {
        return rev
          ? `表达还带试探/冲动，不宜连环消息——轻量、低压的主动比猛攻更合适`
          : `可以小步靠近——用一句清晰表达，比反复猜更有效`;
      }
      if (pos === "现状") return rev ? `心里想靠近，表达方式却容易用力过猛` : `靠近的窗口在，关键在怎么说`;
      if (pos === "阻碍") return rev ? `用分析/试探代替真实表达，越拖越僵` : `卡在「怕丢脸」与「怕错过」之间`;
    }
    if (pos === "现状") return rev ? `${facet}在思绪里打结，先分清事实与担心` : `理性与判断是主线——${facet}值得先看清`;
    if (pos === "阻碍") return rev ? `想太多、说太少，内耗拖住你` : `卡在沟通/真相未明，别绕开`;
    if (pos === "建议") return rev ? `放慢表达，先向内核对再外说` : `把想法落成一句可核对的话`;
  }

  if (element === "土" || element === "pentacles") {
    if (career) {
      if (pos === "现状") return rev ? `对薪资/稳定/条件的焦虑被放大` : `现实回报与交换条件是主线——${facet}仍在展开`;
      if (pos === "阻碍") return rev ? `节奏失衡、多线并行，难聚焦一条 offer 线` : `资源/门槛/条件未谈拢，或自我估值偏离市场`;
      if (pos === "建议") return rev ? `先修正预期与优先级，再谈` : `把交换条件写清楚，主动核对薪资/职责/试用期`;
    }
    if (d === "relationship") {
      if (pos === "现状") return rev ? `安全感/现实基础不稳` : `稳定与可预期的行动是关系底色`;
      if (pos === "阻碍") return rev ? `用物质或付出代替真实沟通` : `现实顾虑（距离/时间/投入）拖住靠近`;
      if (pos === "建议") return rev ? `别用「对他好」替代表达需求` : `看稳定行动，不只听漂亮话`;
    }
    if (pos === "现状") return rev ? `${facet}在现实面未落地` : `现实与资源层面——${facet}是当前主信号`;
    if (pos === "阻碍") return rev ? `过度算计或僵化，反而卡住` : `物质/安全感议题是主要卡点`;
    if (pos === "建议") return rev ? `先稳基础，再推进` : `朝${facet}迈一小步，并核对现实反馈`;
  }

  if (element === "火" || element === "wands") {
    if (career) {
      if (pos === "现状") return rev ? `推进动能受阻或方向飘忽` : `仍有行动空间——${facet}提示动能/竞争在场`;
      if (pos === "阻碍") return rev ? `燃尽或不敢再投，怕白忙` : `竞争、节奏或冲劲被压住`;
      if (pos === "建议") return rev ? `先恢复动力，再跟进` : `推进一个可见的小成果，再决定下一步`;
    }
    if (pos === "现状") return rev ? `热情未落地或忽冷忽热` : `行动与热度——${facet}在展开`;
    if (pos === "阻碍") return rev ? `冲动过后乏力，或方向摇摆` : `急躁/竞争/耗散拖住节奏`;
    if (pos === "建议") return rev ? `控火力，留退路` : `把意图落在一个具体、可执行的邀请上`;
  }

  if (element === "水" || element === "cups") {
    if (career) {
      if (pos === "现状") return rev ? `情绪起伏影响对 offer 的判断` : `团队氛围、价值认同在影响你的选择`;
      if (pos === "阻碍") return rev ? `用感觉代替核实 offer 事实` : `对 offer/机会反馈呈现倦怠或封闭，别因麻木漏看仍在来的信息`;
      if (pos === "建议") return rev ? `先稳情绪，再谈条件` : `问清「这份工作是否让我被需要/被尊重」`;
    }
    if (d === "relationship" || intent === "partner_attitude") {
      if (pos === "现状") return rev ? `情感起伏大、未说透` : `情感仍在流动，有互动余地`;
      if (pos === "阻碍") return rev ? `逃避深度沟通` : `感受与表达不同步`;
      if (pos === "建议") return rev ? `先稳自己的需要，再表达` : `用真诚表达替代反复猜`;
    }
    if (pos === "现状") return rev ? `${facet}在情绪里翻涌，别急着定论` : `感受层面——${facet}是当前入口`;
    if (pos === "阻碍") return rev ? `情绪淹没判断` : `感受未说出口，或界限模糊`;
    if (pos === "建议") return rev ? `先照顾感受，再行动` : `用一次温柔但不逼人的表达靠近`;
  }

  return rev ? `${facet}仍在拉扯，先看清再动` : `${facet}是当前主信号，仍在展开`;
}

/** 数字学微调（小阿卡那） */
function numberNuance(num, ctx, pos, rev) {
  if (!num) return "";
  const n = numerologyMeaning[num];
  if (!n) return "";
  const career = ctx.domain === "career" || /offer|面试/.test(ctx.question);

  if (num === 2) {
    if (pos === "阻碍" && rev) return career ? "多线并行、生活与求职拉扯" : "两条线失衡、顾此失彼";
    if (pos === "现状") return "在两条线/两种节奏间调配";
  }
  if (num === 7) {
    if (pos === "现状" && ctx.domain === "career") return "策略/评估/信息未全";
    if (pos === "阻碍") return "隐藏信息或过度策略拖慢";
  }
  if (num === 4) {
    if (pos === "阻碍" && career) return "停驻/倦怠，对反馈或机会关闭接收";
    if (pos === "现状" && career) return "在稳定评估与停驻感之间";
  }
  if (num === 5) return pos === "阻碍" ? "冲突、变动或摩擦是卡点" : "";
  if (num === 6) return pos === "建议" && career ? "对齐给予与回报、交换是否公平" : "";
  if (num === 10) return pos === "阻碍" ? "周期收尾或负担过重" : "";
  return n.theme.length <= 8 ? n.theme : "";
}

/** 宫廷牌微调 */
function courtNuance(rank, pos, rev, ctx, lineLen = 0) {
  const c = courtMeaning[rank];
  if (!c) return "";
  if (lineLen >= 42) return "";
  if (ctx?.intent === "yes_no_decision" && /主动|开口|靠近/.test(ctx.question || "")) {
    if (rank === "page") return rev ? "先轻后真" : "小步试探";
  }
  if (rank === "king") return pos === "建议" ? "用原则与清晰框架做决定" : pos === "阻碍" ? "权威/控制感变成防御" : "成熟外化的掌控面";
  if (rank === "page") return "试探性消息或起步";
  if (rank === "knight") return rev ? "冲动或半途而废" : "全力投入某方向";
  if (rank === "queen") return "内化的成熟与滋养";
  return "";
}

/** 大牌 × 问题域 × 牌位 */
function majorLine(card, ctx, pos, rev) {
  const family = majorFamily(card.name);
  const facet = pickFacet(card, rev, ctx);
  const career = ctx.domain === "career" || /offer|面试|工作/.test(ctx.question);
  const emotion = ctx.domain === "emotion" || ctx.intent === "emotion_regulation";
  const relationship = ctx.domain === "relationship" || ctx.intent === "partner_attitude";
  const self = ctx.domain === "self" || ctx.intent === "self_clarity";

  const SELF = {
    inner_search: {
      现状: { up: "你在向内找答案，独处是资源", rev: "独处变成反刍，越陷越深" },
      阻碍: { up: "卡在过度内省，缺少对外验证", rev: "把沉默当成唯一解法" },
      建议: { up: "列三个你在乎的价值，对照现状", rev: "别一个人扛完所有问题" }
    },
    shadow_confusion: {
      现状: { up: "旧自我叙事还在影响判断", rev: "被「我不够好」的剧本绑住" },
      阻碍: { up: "执念/旧模式拖住自我更新", rev: "害怕松开就会失去自己" },
      建议: { up: "辨认什么在滋养你，什么只是消耗", rev: "先松绑，再求完美答案" }
    },
    clarity_growth: {
      现状: { up: "自我恢复的能量在回来", rev: "还不敢相信自己值得" },
      阻碍: { up: "信心不足拖住更新节奏", rev: "把进步误判成「不该有」" },
      建议: { up: "从小处重建「我值得」的证据", rev: "先允许一点点好受" }
    },
    ending_change: {
      现状: { up: "旧身份在松动，更新已开始", rev: "害怕改变意味着失败" },
      建议: { up: "结束一种耗竭模式，给新自我腾位", rev: "别用旧办法证明价值" }
    },
    will_choice: {
      建议: { up: "选定一个自我价值标准，然后小步实践", rev: "方向摇摆，先定主线" }
    },
    nurture_structure: {
      建议: { up: "用稳定的小习惯重建自我边界", rev: "对自己太苛刻，边界反而更乱" }
    }
  };

  const EMOTION = {
    shadow_confusion: {
      现状: { up: "潜意识/担心仍在翻涌，夜里信号更强", rev: "睡前的脑内剧场放大恐惧" },
      阻碍: { up: "模糊感与担心拖住恢复", rev: "把想象当定论，难放松" },
      建议: { up: "先把「事实」与「担心」分两栏，再求答案", rev: "先停补剧情，回到呼吸与身体" }
    },
    clarity_growth: {
      现状: { up: "疗愈与希望在，但需要时间落地", rev: "暂时不敢允许自己好受一点" },
      阻碍: { up: "信心不足拖住恢复节奏", rev: "把好转误判成「不该有」" },
      建议: { up: "从一小束希望/休息开始，不是立刻想通", rev: "先恢复，再谈人生大题" }
    },
    inner_search: {
      现状: { up: "你在向内找答案，这本身合理", rev: "独处变成反刍，越陷越深" },
      阻碍: { up: "卡在反复想、缺少对外出口", rev: "把沉默当成唯一解法" },
      建议: { up: "找一个人或一张纸，把最重的担心说一次", rev: "别一个人扛完整套剧本" }
    },
    ending_change: {
      现状: { up: "旧应对方式在失效，需要更新", rev: "害怕改变作息/习惯" },
      建议: { up: "结束一种耗竭模式，给新节奏腾位", rev: "别用旧办法硬扛" }
    },
    will_choice: {
      建议: { up: "温柔的坚持比硬撑更有效", rev: "在「必须坚强」里把自己逼太紧" }
    }
  };

  const CAREER = {
    beginning: {
      现状: { up: "局面仍像新窗口在打开，并非「没有可能」", rev: "把未定当冲动，或资料不全就想往下跳" },
      阻碍: { up: "机会尚在起步，流程/准备未落地", rev: "因未知而不敢动" },
      建议: { up: "用小试探步拿反馈（跟进/补材料）", rev: "先补齐准备与信息" }
    },
    inner_search: {
      现状: { up: "外部反馈偏少，处在你收集信息的阶段", rev: "闷头琢磨、与外界断联" },
      阻碍: { up: "卡在信息未齐、评估偏慢——不是黄了，是还没说到位", rev: "把沉默误读成拒绝" },
      建议: { up: "列待确认项，发一次礼貌跟进或书面澄清", rev: "别继续一个人猜" }
    },
    shadow_confusion: {
      现状: { up: "信息仍有模糊地带，别靠猜补全", rev: "焦虑放大、把想象当事实" },
      阻碍: { up: "迷雾/执念拖住判断", rev: "被最坏剧本绑住" },
      建议: { up: "把「事实」与「担心」分两栏写清", rev: "先停脑内补剧情" }
    },
    clarity_growth: {
      现状: { up: "整体偏正向在走，你的状态是加分项", rev: "信心不足，不敢把优势亮出来" },
      建议: { up: "把优势写进跟进或复盘", rev: "先恢复信心再推进" }
    },
    ending_change: {
      现状: { up: "旧预期在松动，需重新对焦", rev: "害怕突变" },
      阻碍: { up: "结构变化打乱节奏", rev: "抗拒接受已变事实" },
      建议: { up: "接受信息更新，重列节点", rev: "别死守旧剧本" }
    },
    will_choice: {
      建议: { up: "选定标准后主动推进，不宜再拖", rev: "方向摇摆，先定主线" }
    },
    cycle_justice: {
      现状: { up: "流程仍在转动，未到终局", rev: "感觉卡在循环里" },
      阻碍: { up: "时机/公平感未明", rev: "被动等待" }
    }
  };

  const REL = {
    will_choice: {
      现状: { up: "吸引与选择都在，关系有温度", rev: "价值冲突或犹豫" },
      建议: { up: "先对齐你要什么，再表达", rev: "别用试探代替选择" }
    },
    inner_search: {
      阻碍: { up: "对方偏慢热或互动频率低", rev: "把距离全读成不喜欢" },
      建议: { up: "给空间，也给自己一次清晰表达", rev: "别追也别完全断联" }
    },
    shadow_confusion: {
      现状: { up: "感受在，但对方/局面未说透", rev: "你也在压抑直觉或过度猜疑" }
    }
  };

  const table = career ? CAREER : emotion ? EMOTION : self ? SELF : relationship ? REL : null;
  const row = table?.[family]?.[pos]?.[rev ? "rev" : "up"];
  if (row) return row;

  // 通用大牌回退：原型 + 牌位（不用 imagery）
  if (pos === "阻碍") return rev ? `${facet}在暗处拖慢节奏` : `主要卡在${facet}——需正视`;
  if (pos === "建议") return rev ? `沿${facet}方向，先向内核对` : `朝${facet}迈一小步，并核实反馈`;
  return rev ? `${facet}还未顺畅落地` : `当前主调是${facet}，仍在辨认`;
}

/**
 * 核心：单张牌在「问题 × 牌位」下的系统化解读
 */
export function interpretCardInContext(card, reading) {
  if (!card) return "";
  const ctx = inferQuestionContext(reading);
  const pos = card.position || "现状";
  const rev = card.orientation === "逆位";
  const k = getCardKnowledge(card);
  const facet = pickFacet(card, rev, ctx);

  let line;
  if (card.arcana === "大阿卡那" || !card.suitKey) {
    line = majorLine(card, ctx, pos, rev);
  } else {
    const elem = card.suitKey || card.element;
    line = elementLine(ctx, elem, pos, facet, rev);
    const num = cardNumber(card);
    const numBit = numberNuance(num, ctx, pos, rev);
    const court = cardCourt(card);
    const courtBit = courtNuance(court, pos, rev, ctx, line.length);
    if (numBit && !line.includes(numBit)) line = `${line}（${numBit}）`;
    else if (courtBit && line.length < 36) line = `${line}——${courtBit}`;
  }

  // 阻碍位 + 支持极性 → 过度依赖句式
  const valence = contextualValence(card, ctx.profile);
  if ((pos === "阻碍" || pos === "隐藏因素") && valence === "support" && !rev) {
    line = `你把「${facet}」当成唯一支点，反而卡住——${line}`;
  }

  return line.replace(/[；;，,。\s]+$/g, "").trim();
}

/** 牌位前缀（扣题，非套话） */
export function positionAnchor(card, reading) {
  const ctx = inferQuestionContext(reading);
  const pos = card.position;
  const career = ctx.domain === "career" || /offer|面试/.test(ctx.question);

  if (career && ctx.intent === "outcome_forecast") {
    if (pos === "现状") return "就 offer 现在这一步，";
    if (pos === "阻碍") return "卡住进度的是，";
    if (pos === "建议") return "更值得做的是，";
  }
  if (ctx.intent === "partner_attitude") {
    if (pos === "现状") return "就对方态度，";
    if (pos === "阻碍") return "主要卡在，";
    if (pos === "建议") return "你可以，";
  }
  if (ctx.intent === "yes_no_decision" && pos === "建议") return "就你的问题，";
  if ((ctx.domain === "emotion" || ctx.intent === "emotion_regulation") && pos === "建议") return "就你此刻的需要，";
  if ((ctx.domain === "emotion" || ctx.intent === "emotion_regulation") && pos === "现状") return "就你现在的感受，";
  if ((ctx.domain === "self" || ctx.intent === "self_clarity") && pos === "现状") return "就你此刻的自我状态，";
  if ((ctx.domain === "self" || ctx.intent === "self_clarity") && pos === "建议") return "就你的成长方向，";
  return "";
}

export function cardReadingText(card, reading) {
  const anchor = positionAnchor(card, reading);
  const body = interpretCardInContext(card, reading);
  return `${anchor}${body}`;
}

function cardByPosition(cards, ...positions) {
  return cards.find((c) => positions.includes(c.position));
}

/** 从三牌语义推断总判断（无 case 表） */
export function inferSpreadLead(reading, now, block, advice) {
  const ctx = inferQuestionContext(reading);
  const p = ctx.profile;
  const nowV = now ? contextualValence(now, p) : "neutral";
  const blockV = block ? contextualValence(block, p) : "neutral";
  const advV = advice ? contextualValence(advice, p) : "neutral";
  const nowText = now ? interpretCardInContext(now, reading) : "";
  const blockText = block ? interpretCardInContext(block, reading) : "";

  const careerOffer = ctx.domain === "career" || /offer|面试|录用/.test(ctx.question);

  if (careerOffer && ctx.intent === "outcome_forecast") {
    const infoGap = /信息|秘密|未全|猜|保留|策略|沟通|评估|筛选/.test(nowText + blockText);
    const multiLine = /多线|拉扯|失衡|juggling|并行|顾此失彼/.test(blockText);
    const waitPhase = /未齐|偏慢|收集|等待|评估/.test(blockText);
    const positiveNow = nowV === "support" || /打开|正向|加分|窗口/.test(nowText);

    if (infoGap && multiLine) return "offer更偏「信息未说透 + 多线拉扯」——不是没戏，要用清晰沟通核验，别靠猜";
    if (infoGap && waitPhase) return "offer走向偏「等待观察期，不是已否」——反馈未齐，别用沉默填最坏答案";
    if (positiveNow && blockV === "challenge") return "offer更像评估等待期、不是已黄——有底子，但阻碍在信息与节奏";
    if (blockV === "challenge" && advV !== "challenge") return "offer仍在流程中——卡点已明确，建议牌指向可行动的小步";
    return "offer仍在评估窗、尚未一锤定音——先分清事实与担心，再决定要不要跟进";
  }

  if (ctx.intent === "partner_attitude") {
    const asksFeeling = /感觉|喜欢|爱|还有没有|心意|态度/.test(ctx.question);
    const warmNow = nowV === "support" || /流动|温度|互动|情感|吸引|余地|靠近/.test(nowText);
    const coldNow = nowV === "challenge" || /偏淡|误读|僵|策略|分析代替/.test(nowText + blockText);

    if (asksFeeling && warmNow && blockV !== "challenge") {
      return "就「有没有感觉」：牌面偏有温度、互动仍在——还需要真实接触验证，别只靠猜";
    }
    if (asksFeeling && warmNow && blockV === "challenge") {
      return "就「有没有感觉」：有互动余地，但卡点也在——温度在，表达方式/节奏是变量";
    }
    if (asksFeeling && coldNow) {
      return "就「有没有感觉」：牌面偏淡或未说透——更像辨认期，用一次清晰互动比脑补更接近答案";
    }
    if (nowV === "support") return "牌面偏「有温度但未说透」——情感在流动，还需真实互动验证";
    if (nowV === "challenge") return "牌面偏「偏淡或未定型」——别用猜代替对话";
    return "心意仍在辨认期——靠近需要一次清晰表达";
  }

  if (ctx.intent === "yes_no_decision") {
    const focus = advice || now;
    if (/主动|开口|靠近/.test(ctx.question)) {
      if (focus) {
        const fRev = focus.orientation === "逆位";
        const fV = contextualValence(focus, p);
        const isWind = focus.suitKey === "swords" || focus.name?.includes("宝剑");
        if (fRev && isWind) return "可以小步主动，不宜猛攻——先一句清晰、低压的表达，再看回应";
        if (fV === "support" && !fRev) return "牌面略偏向「可以靠近」——真诚小步比继续猜更有效";
        if (fV === "challenge" || fRev) return "宜先缓半步——把表达方式校准后再主动，比赌气式逼近更划算";
      }
      if (advV === "support" && blockV === "challenge") return "可以小步靠近——方式比时机更关键，先轻后真";
      return "牌面偏「先校准表达方式，再决定要不要主动」";
    }
    if (advV === "support" && blockV === "challenge") return "牌面略偏向「做」——阻碍在卡点，但出口明确";
    if (advV === "challenge") return "牌面偏「先缓一步」——不宜今天 all in";
    return "倾向小步验证，再定大局";
  }

  if (ctx.intent === "binary_choice") return "先看各自代价与资源，再定方向——不宜凭焦虑选";

  if (ctx.domain === "emotion" || ctx.intent === "emotion_regulation") {
    const sleepIssue = /失眠|睡不着|夜/.test(ctx.question);
    if (sleepIssue && advV === "support") {
      return "牌面偏「先稳睡眠与身体，再谈人生大题」——焦虑在拉警报，不是你在做错";
    }
    if (blockV === "challenge" && advV === "support") {
      return "情绪卡点清楚，出口在恢复与小步——今晚先照顾自己，小步就够";
    }
    if (blockV === "challenge" && advV === "challenge") {
      return "牌面偏「需要先减负」——硬撑只会放大失眠/焦虑，先收一小步";
    }
    return "感受需要被看见——先把身体与节奏稳住，再决定下一步";
  }

  if (ctx.domain === "self" || ctx.intent === "self_clarity") {
    const release = /放下|走出来|走不出|释怀|翻篇/.test(ctx.question);
    const selfWorth = /喜欢自己|自信|重新|价值|配不配/.test(ctx.question);
    if (release && advV === "support") {
      return "牌面偏「可以慢慢松绑」——放下是过程，出口在重建自我价值的小步";
    }
    if (selfWorth && advV === "support") {
      return "牌面偏「自我价值可以重建」——从辨认需要开始，不必一次到位";
    }
    if (blockV === "challenge" && advV === "support") {
      return "自我卡点已明确——旧模式在阻碍位，建议牌指向可整合的一小步";
    }
    if (blockV === "challenge" && advV === "challenge") {
      return "牌面偏「需要先减负」——别用自我批判推动改变，先稳一小步";
    }
    return "牌面指向内在辨认——在照顾好自己的节奏里，答案会慢慢清楚";
  }

  return "牌阵合参后，主线落在你的原问题与抽到的牌面因果链上";
}

export function inferInnerTheme(reading, now, block, advice) {
  const ctx = inferQuestionContext(reading);
  const careerOffer = ctx.domain === "career" || /offer|面试/.test(ctx.question);

  if (careerOffer) {
    const blockText = block ? interpretCardInContext(block, reading) : "";
    if (/未齐|偏慢|收集|等待/.test(blockText)) {
      return "你卡的不只是 silence，而是把「没消息」迅速读成「没戏」——评估期要的是核实，不是脑补。";
    }
    if (/信息|秘密|猜|保留/.test(interpretCardInContext(now, reading) + blockText)) {
      return "表面在问 offer 走向，底层在问：我值不值得被认真选择？先把事实与想象分开。";
    }
    return "好奇背后是对确定感的需要——这很正常；牌提醒用核实代替空等。";
  }
  if (ctx.intent === "partner_attitude") {
    return "你要的可能不是一句喜欢，而是确认自己值得被认真对待——牌是镜子，不是测谎仪。";
  }
  if (ctx.intent === "yes_no_decision") {
    return "表面在问选不选，底层在问：我配不配要一个清楚答案、配不配主动。";
  }
  if (ctx.domain === "emotion" || ctx.intent === "emotion_regulation") {
    if (/失眠|睡不着/.test(ctx.question)) {
      return "表面在问怎么办，底层在问：我能不能允许自己先停下来——睡眠不是奖励，是底盘。";
    }
    return "表面在问情绪怎么办，底层在问：我值不值得被温柔对待——包括被你自己。";
  }
  if (ctx.domain === "self" || ctx.intent === "self_clarity") {
    if (/喜欢自己|自信|重新/.test(ctx.question)) {
      return "表面在问怎么喜欢自己，底层在问：我配不配无条件对自己好。";
    }
    if (/走出来|放下|走不出|释怀/.test(ctx.question)) {
      return "表面在问怎么走出，底层在问：如果我松开，是否就等于不曾重要。";
    }
    return "表面在问自我状态，底层在问：我能不能按自己的节奏被看见。";
  }
  if (now && block && advice) {
    const nk = pickFacet(now, now.orientation === "逆位", ctx);
    const bk = pickFacet(block, block.orientation === "逆位", ctx);
    return `同一条线：从「${nk}」出发，被「${bk}」拖慢，${advice.name}指向把出口收成可核对的一小步。`;
  }
  return "牌在帮你看清：真正要紧的不是完美答案，而是下一步是否贴你的需要。";
}

export function inferStoryLayers(reading) {
  const ctx = inferQuestionContext(reading);
  const cards = reading.cards || [];
  const now = cardByPosition(cards, "现状", "今日指引", "我") || cards[0];
  const block = cardByPosition(cards, "阻碍", "隐藏因素");
  const advice = cardByPosition(cards, "建议", "下一步") || cards.at(-1);
  const themeLabel = ctx.themeLabel || reading.themeLabel || "当下";

  if (cards.length >= 3 && now && block && advice) {
    const description = [
      `牌阵看见：${now.name}描出${interpretCardInContext(now, reading)}`,
      `${block.name}指出${interpretCardInContext(block, reading)}`,
      `${advice.name}建议${interpretCardInContext(advice, reading)}`
    ].join("；") + "。";

    const careerOffer = ctx.domain === "career" || /offer|面试/.test(ctx.question);
    let situation;
    let meaning;

    if (careerOffer) {
      situation = `放回${themeLabel}：「${now.name}」看局面起点，「${block.name}」看卡点，「${advice.name}」定交换与下一步——本周重点是事实节点，不是情绪下注。`;
      meaning = inferInnerTheme(reading, now, block, advice);
    } else if (ctx.intent === "partner_attitude") {
      situation = `放回关系里：${now.name}看互动温度，${block.name}看卡点，${advice.name}看你怎么表达需求。`;
      meaning = inferInnerTheme(reading, now, block, advice);
    } else if (ctx.domain === "emotion" || ctx.intent === "emotion_regulation") {
      situation = `放回${themeLabel}：${now.name}看当下感受，${block.name}看消耗点，${advice.name}定恢复的小步——本周先稳节奏，再求大答案。`;
      meaning = inferInnerTheme(reading, now, block, advice);
    } else if (ctx.domain === "self" || ctx.intent === "self_clarity") {
      situation = `放回${themeLabel}：${now.name}看自我状态，${block.name}看旧模式卡点，${advice.name}定整合的小步——本周先重建自我证据，不求一次想通。`;
      meaning = inferInnerTheme(reading, now, block, advice);
    } else {
      situation = `三牌合参（${now.name}→${block.name}→${advice.name}），主线扣你的原问题。`;
      meaning = inferInnerTheme(reading, now, block, advice);
    }
    return { description, situation, meaning };
  }

  if (cards.length === 1 && now) {
    return {
      description: `${now.name}（${now.orientation}）在「${now.position}」：${interpretCardInContext(now, reading)}。`,
      situation: `放回${themeLabel}，这一张牌直接扣你的原问题。`,
      meaning: inferInnerTheme(reading, now, null, null)
    };
  }

  return { description: "", situation: "", meaning: "" };
}

export function inferActions(reading) {
  const ctx = inferQuestionContext(reading);
  const advice = cardByPosition(reading.cards, "建议", "下一步", "今日指引");
  const careerOffer = ctx.domain === "career" || /offer|面试/.test(ctx.question);

  if (careerOffer) {
    const elem = advice?.suitKey || advice?.element;
    const second =
      elem === "pentacles" || advice?.name?.includes("星币")
        ? "列出薪资/职责/试用期三条，发一封礼貌跟进确认进度"
        : elem === "swords" || advice?.name?.includes("宝剑")
          ? "写一封清晰邮件/消息：确认评估进度与一个具体事实"
          : "为每条机会写一行：最后联系日、联系人、下一步节点";
    return [second, "本周对最在意的一家发一条跟进，不连发"];
  }
  if (ctx.intent === "partner_attitude") {
    return ["写下你最想确认的一个事实（对方做过什么、没做什么）", "选一次合适场合，用一句直接问法表达需求"];
  }
  if (ctx.intent === "yes_no_decision" && /主动|开口/.test(ctx.question)) {
    return ["写一句不逼答的主动表达，48小时内发出", "发出后做一件与结果无关的自我照顾小事"];
  }
  if (ctx.domain === "emotion" || ctx.intent === "emotion_regulation") {
    const sleepIssue = /失眠|睡不着/.test(ctx.question);
    if (sleepIssue) {
      return ["今晚固定一个睡前仪式（关屏+3分钟呼吸），不逼自己立刻睡着", "把最重的担心写一句在纸上，明早再处理"];
    }
    return ["选一件 10 分钟的自我照顾（散步/热水/找人聊），今天完成", "把「必须立刻好起来」改成「我先稳一小步」"];
  }
  if (ctx.domain === "self" || ctx.intent === "self_clarity") {
    const release = /放下|走出来|走不出|释怀/.test(ctx.question);
    if (release) {
      return ["写下一段「我可以先放下什么」——只写一条", "做一件标记「新开始」的小事（整理/散步/洗澡）"];
    }
    return ["写一句：我现在最需要被怎样对待", "本周做一件只为自己的小事，不附带产出"];
  }
  return [advice?.actionHint || "把建议牌落成一件本周可核对的小事", "把最在意的一点写成一句话，每天只看一次"];
}
