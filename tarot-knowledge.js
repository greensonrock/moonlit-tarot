/**
 * 塔罗结构化知识库（建议1）
 *
 * 目标：把「为什么这张牌在这个位置是这个意思」变成可推理、可展示的结构，
 * 而不是只甩 3 个关键词。解读推理 = 意象 + 数字学 + 花色元素 + 牌位透镜 + 正逆。
 *
 * 这一层同时支撑：
 *  - 建议3：情绪极性由「牌位 × 问题 × 牌义」推理，而非牌名硬编码
 *  - 建议4：本地回退也能写出贴牌的具体解读，而非通用模板
 *  - 向用户展示「依据」（意象/元素/数字），即权威感的来源
 */

/** 花色元素领域 */
export const elementProfiles = {
  火: { element: "火", domain: "行动与热情", gift: "意志、推进、创造力", shadow: "急躁、过度燃烧、方向飘忽" },
  水: { element: "水", domain: "情感与关系", gift: "感受、共情、直觉", shadow: "情绪淹没、逃避、界限模糊" },
  风: { element: "风", domain: "思考与沟通", gift: "判断、表达、看清真相", shadow: "焦虑、内耗、用想象代替事实" },
  土: { element: "土", domain: "现实与价值", gift: "落地、稳健、资源", shadow: "僵化、过度算计、被安全感困住" }
};

/** 数字学（1–10）：每个数字的能量阶段 */
export const numerologyMeaning = {
  1: { stage: "种子", theme: "纯粹潜能与开端", note: "能量最纯、尚未成形，是邀请而非结果" },
  2: { stage: "成对", theme: "平衡、选择与关系", note: "两股力量需要协调，常关乎抉择或配对" },
  3: { stage: "成形", theme: "初步成果与协作", note: "想法开始落地，需要他人或外界参与" },
  4: { stage: "稳定", theme: "结构、巩固与停驻", note: "建立秩序，也可能过于固守" },
  5: { stage: "失衡", theme: "冲突、变动与考验", note: "稳定被打破，是成长前的摩擦" },
  6: { stage: "流动", theme: "和谐、回馈与调整", note: "能量重新流动，关乎给予与接受" },
  7: { stage: "评估", theme: "内省、坚持与取舍", note: "停下来衡量，考验信念与耐心" },
  8: { stage: "精熟", theme: "力量、加速与掌控", note: "能量充沛、推进迅速，需善用而非滥用" },
  9: { stage: "近满", theme: "独立、极致与反思", note: "接近完成，常伴随孤独或自我盘点" },
  10: { stage: "圆满", theme: "周期终结、重负与转化", note: "一个循环走到尽头，圆满也意味着交棒" }
};

/** 宫廷牌人格阶段 */
export const courtMeaning = {
  page: { rank: "侍从", theme: "学习、讯息与萌芽", note: "新手心态，带来消息或试探性起步" },
  knight: { rank: "骑士", theme: "行动、追寻与极端", note: "全力投入某个方向，热烈但容易过头" },
  queen: { rank: "王后", theme: "内化的成熟与滋养", note: "把能量沉淀于内，懂得接纳与照顾" },
  king: { rank: "国王", theme: "外化的权威与责任", note: "掌控与主导，对外承担与定调" }
};

/** 牌位透镜：同一张牌在不同位置该怎么读 */
export const positionLens = {
  现状: { role: "当前能量", read: "描述你此刻真实站的位置，不评判好坏" },
  阻碍: { role: "卡点/盲点", read: "正视它如何拖住你——即使是好牌，落在此处也常是「过度依赖」" },
  建议: { role: "出口/方向", read: "给出可落地的下一步姿态，而非保证结果" },
  对方或外界: { role: "他人与环境", read: "外部力量或对方的状态，需互动验证，不替对方定论" },
  隐藏因素: { role: "暗流", read: "尚未被你看见、却在影响判断的部分" },
  下一步: { role: "接下来的动作", read: "更可能展开的行动节奏，是邀请不是命令" },
  今日指引: { role: "今日焦点", read: "今天值得守住的一件小事" },
  我: { role: "自我状态", read: "你自身的能量与课题" }
};

/** 22 张大阿卡那：元素归属 + 意象 + 光明面 + 阴影面 */
export const majorKnowledge = {
  愚者: { element: "风", imagery: "悬崖边轻装起步的旅人，脚下是未知", light: "自由、信任直觉、敢于开始", shadow: "轻率、准备不足、忽视风险" },
  魔术师: { element: "风", imagery: "一手指天一手指地，桌上四元素俱全", light: "把想法显化、整合资源", shadow: "能量分散、操弄、光说不练" },
  女祭司: { element: "水", imagery: "端坐于两柱之间、帷幕后藏着秘密", light: "直觉、内在智慧、静观", shadow: "压抑直觉、信息不明、被动" },
  皇后: { element: "土", imagery: "丰饶花园里的孕育女神", light: "滋养、丰盛、感官与魅力", shadow: "过度付出、自我忽略、占有" },
  皇帝: { element: "火", imagery: "石椅上手持权杖的统治者", light: "秩序、边界、稳定的保护", shadow: "控制欲、僵硬、父权压制" },
  教皇: { element: "土", imagery: "传授教义的宗教权威与两位门徒", light: "传统、指引、可借的经验", shadow: "盲从、教条、被规范束缚" },
  恋人: { element: "风", imagery: "天使祝福下的一对璧人，关乎抉择", light: "深刻联结、价值一致的选择", shadow: "犹豫、价值冲突、逃避承诺" },
  战车: { element: "水", imagery: "驾驭黑白两只斯芬克斯前行的胜者", light: "意志、方向、掌控前进", shadow: "失控、方向摇摆、硬撑" },
  力量: { element: "火", imagery: "少女温柔合上狮口", light: "温柔的坚韧、内在勇气", shadow: "自我怀疑、强撑、压抑本能" },
  隐士: { element: "土", imagery: "提灯独行于雪山的求道者", light: "内省、独处、寻得真知", shadow: "孤立、回避、过度退缩" },
  命运之轮: { element: "火", imagery: "不停转动的命运之轮", light: "转机、周期、顺势而为", shadow: "停滞、被动等待、循环重复" },
  正义: { element: "风", imagery: "持剑与天平的审判者", light: "平衡、真相、为选择负责", shadow: "不公、逃避责任、失衡" },
  倒吊人: { element: "水", imagery: "倒悬却面带平静的人", light: "换角度、臣服、有意义的暂停", shadow: "拖延、无谓牺牲、卡住不动" },
  死神: { element: "水", imagery: "骑白马的死神，旧时代落幕", light: "结束旧的、腾出新空间", shadow: "抗拒改变、被旧事纠缠" },
  节制: { element: "火", imagery: "天使在两杯间调和水流", light: "调和、节奏、疗愈与中道", shadow: "失衡、急躁、过犹不及" },
  恶魔: { element: "土", imagery: "被松垮锁链拴住的两人，其实可自行挣脱", light: "看见欲望与执念的真相", shadow: "被绑定、上瘾、用消耗换安全感" },
  高塔: { element: "火", imagery: "雷电击塌高塔，人坠落", light: "旧结构崩解后的清醒", shadow: "突变冲击、害怕崩塌、逃避真相" },
  星星: { element: "风", imagery: "裸身女子在星空下向水土倾注", light: "希望、疗愈、重获信心", shadow: "失去信心、心力透支、需要休息" },
  月亮: { element: "水", imagery: "月下两塔之间的幽径与暗涌", light: "正视潜意识、让真相浮现", shadow: "迷雾、不安、被想象误导" },
  太阳: { element: "火", imagery: "孩童在向日葵前沐浴阳光", light: "明朗、喜悦、生命力", shadow: "盲目乐观、延迟快乐、信心不足" },
  审判: { element: "火", imagery: "天使吹号，众人自棺中起身回应", light: "觉醒、回应召唤、重生", shadow: "自我批判、不敢回应、困于过去" },
  世界: { element: "土", imagery: "舞者在花环中央，四元素环绕", light: "完成、整合、阶段性圆满", shadow: "未完成、临门一脚、不愿收尾" }
};

/** 从 slug 取小阿卡那点数键（1–10）或宫廷键 */
function minorRankKey(card) {
  const slug = card.slug || "";
  const rank = slug.split("-")[1];
  const map = {
    ace: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10
  };
  if (rank in map) return { type: "number", value: map[rank] };
  if (["page", "knight", "queen", "king"].includes(rank)) return { type: "court", value: rank };
  return null;
}

/** 取一张牌的完整知识：元素、意象、数字/宫廷阶段 */
/** 去掉句尾标点，便于把意象嵌进更长的句子里 */
function trimTail(text) {
  return String(text || "").replace(/[。.！!；;，,…]+$/g, "").trim();
}

export function getCardKnowledge(card) {
  if (!card) return null;
  const isMajor = card.arcana === "大阿卡那";
  if (isMajor) {
    const mk = majorKnowledge[card.name] || {};
    const elem = elementProfiles[mk.element] || null;
    return {
      kind: "major",
      element: mk.element || null,
      elementProfile: elem,
      imagery: trimTail(mk.imagery),
      light: mk.light || (card.upright || []).join("、"),
      shadow: mk.shadow || (card.reversed || []).join("、"),
      numerology: null,
      court: null
    };
  }
  const elem = elementProfiles[card.element] || null;
  const rank = minorRankKey(card);
  return {
    kind: "minor",
    element: card.element || null,
    elementProfile: elem,
    imagery: trimTail((card.girlToneMeaning || "").replace(/^[^：:]+[：:]\s*/, "")),
    light: (card.upright || []).join("、"),
    shadow: (card.reversed || []).join("、"),
    numerology: rank?.type === "number" ? numerologyMeaning[rank.value] : null,
    court: rank?.type === "court" ? courtMeaning[rank.value] : null
  };
}

/**
 * 数字/宫廷的「天然倾向」：仅作基线，最终极性仍要叠加正逆 + 牌位 + 问题。
 * 返回 -1（偏挑战）/ 0（中性）/ +1（偏支持）
 */
function numerologyBias(card) {
  const rank = minorRankKey(card);
  if (!rank) return 0;
  if (rank.type === "number") {
    if ([5, 10].includes(rank.value)) return -1;
    if ([1, 3, 4, 6, 9].includes(rank.value)) return 1;
    return 0; // 2,7,8 视语境
  }
  if (rank.type === "court") {
    if (rank.value === "knight") return 0; // 行动力强但易过头
    if (["queen", "king"].includes(rank.value)) return 1; // 成熟掌控
    return 0; // page 中性
  }
  return 0;
}

/** 大阿卡那的天然倾向（基线） */
function majorBias(card) {
  const supportive = ["太阳", "星星", "世界", "恋人", "力量", "节制", "命运之轮", "审判"];
  const heavy = ["高塔", "恶魔", "月亮", "死神"];
  if (supportive.includes(card.name)) return 1;
  if (heavy.includes(card.name)) return -1;
  return 0;
}

const SUPPORT_LEXICON = /希望|疗愈|完成|明朗|喜悦|丰盛|吸引|和谐|整合|重生|转机|资源|清晰|平衡|勇气|缓和|减压|解脱|改善|复苏|走出|回流|认清|看见|滋养|稳健|落地|联结|安居|韧性|胜利/;
const CHALLENGE_LEXICON = /崩|破|冲突|恐惧|失败|损失|消耗|束缚|延迟|受阻|拖延|结束|打破|算计|封闭|悲伤|内耗|失衡|轻率|操控|抗拒|诱惑|混乱|不公|疲惫|压力|犹豫|空转|动摇|散乱|偏执|僵|贪婪|嫉妒|鲁莽|匮乏|debt|孤立/;

/**
 * 建议3 核心：上下文情绪极性 = 牌位 × 问题 × 牌义（数字/元素/正逆），
 * 不再用牌名 includes 硬编码。
 * 返回 "challenge" | "support" | "neutral"
 */
export function contextualValence(card, profile = {}) {
  if (!card) return "neutral";
  const rev = card.orientation === "逆位";
  const pos = card.position || "";
  const keys = (card.keywords || []).join("");

  // 1) 基线倾向（数字/宫廷/大牌）
  let score = card.arcana === "大阿卡那" ? majorBias(card) : numerologyBias(card);

  // 2) 关键词语义微调
  if (SUPPORT_LEXICON.test(keys)) score += 0.6;
  if (CHALLENGE_LEXICON.test(keys)) score -= 0.6;

  // 3) 正逆：逆位让「好牌打折、难牌松动」，整体拉向中性
  if (rev) {
    score = score * 0.4; // 向 0 收拢
    // 逆位的难牌常表示「能量在释放/松动」，再补一点中性偏暖
    if (score < 0) score += 0.3;
  }

  // 4) 花色 × 问题领域：错位的元素更可能是挑战
  if (profile.isRelationship && card.suitKey === "swords" && !rev) score -= 0.4;
  if (profile.isCareer && card.suitKey === "pentacles") score += 0.3;
  if (profile.isEmotion && card.suitKey === "cups" && rev) score -= 0.3;

  // 5) 牌位透镜：极性仍主要由牌义（关键词/正逆/数字）决定，不因牌位强行翻向
  // 阻碍/隐藏因素位：仅对「略偏支持」的正位好牌轻收一档，不硬改成挑战
  if ((pos === "阻碍" || pos === "隐藏因素") && score > 0.2 && !rev) {
    score *= 0.75;
  }
  if (pos === "建议" && score < -0.2 && !rev) {
    // 建议位的难牌：是要你「正视/处理」，归为中性课题而非纯挑战
    return "neutral";
  }

  if (score >= 0.5) return "support";
  if (score <= -0.5) return "challenge";
  return "neutral";
}

export function valenceLabel(valence) {
  return { challenge: "挑战", support: "支持", neutral: "中性" }[valence] || "中性";
}

/**
 * 建议4：从知识库合成「为什么」一句话（用于 prompt 与回退解读），
 * 形如：意象 → 元素领域 → 数字阶段 → 牌位透镜。
 */
export function describeCardWhy(card, profile = {}) {
  const k = getCardKnowledge(card);
  if (!k) return "";
  const rev = card.orientation === "逆位";
  const stage = k.numerology
    ? `数字${cardNumber(card)}属「${k.numerology.stage}」（${k.numerology.theme}）`
    : k.court
      ? `${k.court.rank}阶段（${k.court.theme}）`
      : "";
  const elem = k.elementProfile
    ? `${k.element}元素主${k.elementProfile.domain}`
    : "";
  const facet = rev ? `逆位偏向：${k.shadow}` : `正位偏向：${k.light}`;
  const parts = [k.imagery, elem, stage, facet].filter(Boolean);
  return parts.join("；");
}

function cardNumber(card) {
  const rank = minorRankKey(card);
  return rank?.type === "number" ? rank.value : "";
}

/** 不含牌位修正的「基线极性」：用于区分「好牌落阻碍=过度依赖」与「难牌落阻碍=困难本身」 */
function baseValence(card, profile) {
  return contextualValence({ ...card, position: "现状" }, profile);
}

/**
 * 建议4：合成贴牌的牌位解读（本地回退用），结构「依据 + 落到牌位」。
 * 不再是「XX是当前主要阻力」式的空模板。
 */
export function composePositionReading(card, profile = {}) {
  const k = getCardKnowledge(card);
  if (!k) return "";
  const rev = card.orientation === "逆位";
  const pos = card.position || "现状";
  const facetWords = rev ? k.shadow : k.light;
  const lead = facetWords.split("、")[0] || (card.keywords?.[0] || "这股能量");
  const domain = k.elementProfile?.domain || "这件事";
  const base = baseValence(card, profile);

  if (pos === "阻碍" || pos === "隐藏因素") {
    if (base === "support" && !rev) {
      // 好牌落阻碍位 = 过度依赖（把长处用成了执念）
      return `你把「${lead}」当成唯一支点，反而在${domain}上卡住——${k.imagery}提醒别让长处变成执念。`;
    }
    if (rev) {
      return `${k.imagery}；逆位下，${lead}正在暗处松动或失衡，先看清它如何左右你的判断。`;
    }
    // 难牌/中性牌落阻碍位 = 困难本身就是要正视的卡点
    return `真正卡住你的就是这股能量：${k.imagery}，这正是现在要先认清、别绕开的部分。`;
  }

  if (pos === "建议" || pos === "下一步") {
    return rev
      ? `顺着「${lead}」的方向，但放慢、先向内核对：${k.imagery}——逆位提示别急着外推。`
      : `可行的方向是${lead}：${k.imagery}，朝这里迈一小步，但仍要核对现实。`;
  }

  if (pos === "对方或外界") {
    return `外界/对方更像「${lead}」的状态（${domain}）；这是倾向不是定论，仍需真实互动验证。`;
  }

  // 现状 / 我 / 今日指引
  // 即使数字基线偏正，若关键词本身是痛苦/困顿，也不能用「可借的底子」这种支持语气
  const painfulLead = CHALLENGE_LEXICON.test(lead) || CHALLENGE_LEXICON.test(facetWords);
  if (base === "challenge" || painfulLead) {
    return `你此刻处在「${lead}」里：${k.imagery}，${rev ? "这股能量还没顺畅落地" : "并不轻松"}，先承认它，再看清下一步。`;
  }
  if (base === "support") {
    return `你此刻有「${lead}」可借：${k.imagery}，是当下能把握的底子，但别跳过核实。`;
  }
  return `你此刻的能量是「${lead}」：${k.imagery}，还在辨认阶段，别急着定论。`;
}
