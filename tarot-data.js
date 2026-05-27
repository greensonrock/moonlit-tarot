export const majorArcana = [
  ["fool", "愚者", "The Fool", "0", "新的开始", "自由", "冒险", "轻率", "迷失方向", "先允许自己小步出发", "0"],
  ["magician", "魔术师", "The Magician", "I", "主动创造", "资源整合", "显化", "操控", "能量分散", "把想法变成一个具体动作", "I"],
  ["high-priestess", "女祭司", "The High Priestess", "II", "直觉", "秘密", "内在智慧", "压抑直觉", "信息不明", "先听见心里最安静的答案", "II"],
  ["empress", "皇后", "The Empress", "III", "滋养", "丰盛", "魅力", "过度付出", "自我忽略", "照顾好自己也会改变关系能量", "III"],
  ["emperor", "皇帝", "The Emperor", "IV", "秩序", "边界", "稳定", "控制欲", "僵硬", "把规则说清楚，安全感会回来", "IV"],
  ["hierophant", "教皇", "The Hierophant", "V", "承诺", "传统", "学习", "束缚", "盲从", "向可靠的人或经验借一点光", "V"],
  ["lovers", "恋人", "The Lovers", "VI", "吸引", "选择", "和谐", "犹豫", "价值冲突", "看见心动，也看见自己的选择权", "VI"],
  ["chariot", "战车", "The Chariot", "VII", "推进", "意志", "掌控", "失控", "方向摇摆", "把方向握回自己手里", "VII"],
  ["strength", "力量", "Strength", "VIII", "温柔坚韧", "勇气", "自控", "自我怀疑", "强撑", "不必用强硬证明自己的强大", "VIII"],
  ["hermit", "隐士", "The Hermit", "IX", "独处", "内省", "寻找答案", "孤立", "回避", "给答案一点安静长出来的时间", "IX"],
  ["wheel-of-fortune", "命运之轮", "Wheel of Fortune", "X", "转机", "周期", "变化", "停滞", "反复循环", "变化正在靠近，别急着下定论", "X"],
  ["justice", "正义", "Justice", "XI", "平衡", "判断", "真相", "不公平", "逃避责任", "用事实替代反复猜测", "XI"],
  ["hanged-man", "倒吊人", "The Hanged Man", "XII", "暂停", "换角度", "臣服", "拖延", "无谓等待", "有些等待需要被重新定义", "XII"],
  ["death", "死神", "Death", "XIII", "结束", "转化", "更新", "抗拒改变", "旧事纠缠", "结束不是失败，而是腾出新的空间", "XIII"],
  ["temperance", "节制", "Temperance", "XIV", "调和", "节奏", "疗愈", "失衡", "急躁", "慢一点，答案会更清楚", "XIV"],
  ["devil", "恶魔", "The Devil", "XV", "执念", "束缚", "诱惑", "摆脱束缚", "看见阴影", "看见让你上瘾又消耗的部分", "XV"],
  ["tower", "高塔", "The Tower", "XVI", "打破", "真相", "突变", "害怕崩塌", "延迟改变", "崩塌也可能是清醒的开始", "XVI"],
  ["star", "星星", "The Star", "XVII", "希望", "疗愈", "灵感", "失去信心", "需要休息", "把自己放回值得发光的位置", "XVII"],
  ["moon", "月亮", "The Moon", "XVIII", "迷雾", "潜意识", "不安", "真相浮现", "混乱退潮", "不要只在细节里寻找确定感", "XVIII"],
  ["sun", "太阳", "The Sun", "XIX", "明朗", "喜悦", "生命力", "延迟快乐", "信心不足", "让简单真诚的东西照进来", "XIX"],
  ["judgement", "审判", "Judgement", "XX", "觉醒", "回应", "重生", "自我批判", "不敢回应召唤", "你正在准备走向新的版本", "XX"],
  ["world", "世界", "The World", "XXI", "完成", "整合", "圆满", "未完成", "临门一脚", "给自己一个温柔的阶段性认可", "XXI"]
].map(([slug, name, nameEn, number, k1, k2, k3, r1, r2, actionHint, displayNumber], index) => ({
  slug,
  name,
  nameEn,
  number,
  displayNumber,
  index,
  arcana: "大阿卡那",
  arcanaEn: "Major Arcana",
  upright: [k1, k2, k3],
  reversed: [r1, r2, `${k1}受阻`],
  girlToneMeaning: `${name}像一束更深的光，提醒你看见这件事背后的核心课题。`,
  actionHint,
  image: `/assets/cards/${slug}.svg`
}));

export const suits = [
  {
    key: "wands",
    name: "权杖",
    nameEn: "Wands",
    element: "火",
    domain: "行动",
    tone: "热情、灵感、野心",
    color: "#C56B74"
  },
  {
    key: "cups",
    name: "圣杯",
    nameEn: "Cups",
    element: "水",
    domain: "情绪",
    tone: "感受、关系、共鸣",
    color: "#6D8FD7"
  },
  {
    key: "swords",
    name: "宝剑",
    nameEn: "Swords",
    element: "风",
    domain: "思考",
    tone: "沟通、判断、真相",
    color: "#7F84A8"
  },
  {
    key: "pentacles",
    name: "星币",
    nameEn: "Pentacles",
    element: "土",
    domain: "现实",
    tone: "金钱、身体、价值",
    color: "#B38A45"
  }
];

export const minorRanks = [
  ["ace", "王牌", "Ace", 1, "起点", "种子", "机会", "开端受阻", "能量未落地"],
  ["two", "二", "Two", 2, "选择", "互动", "平衡", "摇摆", "难以协调"],
  ["three", "三", "Three", 3, "协作", "扩展", "初步成果", "合作不顺", "进展延迟"],
  ["four", "四", "Four", 4, "稳定", "休整", "安全感", "停滞", "防御过强"],
  ["five", "五", "Five", 5, "冲突", "挑战", "调整", "逃避冲突", "消耗过度"],
  ["six", "六", "Six", 6, "流动", "互惠", "修复", "失衡", "旧事牵绊"],
  ["seven", "七", "Seven", 7, "评估", "选择", "坚持", "犹豫", "看不清重点"],
  ["eight", "八", "Eight", 8, "推进", "练习", "专注", "卡住", "节奏失衡"],
  ["nine", "九", "Nine", 9, "积累", "独立", "临近完成", "压力放大", "难以满足"],
  ["ten", "十", "Ten", 10, "完成", "承担", "阶段结果", "负担过重", "结尾拖延"],
  ["page", "侍从", "Page", null, "学习", "消息", "好奇", "经验不足", "迟疑"],
  ["knight", "骑士", "Knight", null, "追寻", "行动", "推进", "冲动", "方向不稳"],
  ["queen", "王后", "Queen", null, "成熟感受", "接纳", "滋养", "过度内耗", "界限模糊"],
  ["king", "国王", "King", null, "掌控", "稳定输出", "负责", "控制过强", "表达僵硬"]
];

function buildMinorCard(suit, [rankKey, rankName, rankEn, count, k1, k2, k3, r1, r2], rankIndex) {
  const name = `${suit.name}${rankName}`;
  const nameEn = `${rankEn} of ${suit.nameEn}`;
  return {
    slug: `${suit.key}-${rankKey}`,
    name,
    nameEn,
    number: rankEn,
    displayNumber: count ? String(count) : rankEn,
    index: rankIndex,
    arcana: "小阿卡那",
    arcanaEn: "Minor Arcana",
    suit: suit.name,
    suitEn: suit.nameEn,
    suitKey: suit.key,
    element: suit.element,
    symbolCount: count,
    upright: [`${suit.domain}${k1}`, k2, k3],
    reversed: [`${suit.domain}${r1}`, r2, `${k1}受阻`],
    girlToneMeaning: `${name}更贴近日常层面的${suit.domain}，它把注意力放在${suit.tone}与${k1}上。`,
    actionHint: `把${suit.domain}落到今天能完成的一件小事里`,
    image: `/assets/cards/${suit.key}-${rankKey}.svg`
  };
}

export const minorArcana = suits.flatMap((suit) =>
  minorRanks.map((rank, rankIndex) => buildMinorCard(suit, rank, rankIndex))
);

export const tarotDeck = [...majorArcana, ...minorArcana];

export function getTarotStats() {
  return {
    count: tarotDeck.length,
    major: majorArcana.length,
    minor: minorArcana.length,
    suits: suits.map((suit) => ({
      name: suit.name,
      nameEn: suit.nameEn,
      count: minorArcana.filter((card) => card.suitKey === suit.key).length
    }))
  };
}
