/**
 * 塔罗卡面生成器
 *
 * 目标：保留现有视觉风格（纸感渐变、金/紫描边、双角光点、标题排版），
 * 把中央图案换成「传统塔罗（韦特系）场景元素」：
 *  - 大阿卡那：各自的标志性场景（如死神骑马、星星倾注、太阳孩童等）
 *  - 小阿卡那：传统花色符号按点数布局 + 元素场景背景，并为最具叙事性的牌单独绘制
 *  - 宫廷牌：人物持本花色法器（侍从立、骑士乘马、王后/国王坐于王座）
 *
 * 文案（牌名、关键词）直接读取 tarot-data.js，保证与解读一致。
 * 逆位由前端 CSS 旋转处理，这里只画正位。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tarotDeck, suits } from "./tarot-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "public", "assets", "cards");
mkdirSync(OUT, { recursive: true });

// —— 调色板 ——
const INK = "#3A3350";
const SOFT = "#6A5F77";
const GOLD = "#C99B52";
const GOLDL = "#F8DFA7";
const PURPLE = "#9A78C9";
const SKIN = "#EAC9A6";
const SKY1 = "#FBF6FF";
const SKY2 = "#EAF1FF";

const suitColor = Object.fromEntries(suits.map((s) => [s.key, s.color]));

// —— 场景窗口 ——
const WX = 46, WY = 100, WW = 228, WH = 256;
const CX = 160;
const WB = WY + WH; // 356 底边
const HZ = 296;     // 地平线

const P = (n) => Number(Number(n).toFixed(2));

// —— 几何/图元 ——
function starPath(cx, cy, R, r, points = 5, rot = -Math.PI / 2) {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    d += `${i === 0 ? "M" : "L"}${P(x)} ${P(y)} `;
  }
  return d + "Z";
}

function sceneBg(accent) {
  return `<clipPath id="win"><rect x="${WX}" y="${WY}" width="${WW}" height="${WH}" rx="18"/></clipPath>
  <g clip-path="url(#win)">
    <rect x="${WX}" y="${WY}" width="${WW}" height="${WH}" fill="url(#sky)"/>
    <circle cx="${CX}" cy="${WY + 12}" r="150" fill="${accent}" opacity=".05"/>`;
}
const sceneEnd = `</g><rect x="${WX}" y="${WY}" width="${WW}" height="${WH}" rx="18" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/>`;

function ground(color = "#cdbf9b", op = 0.5, y = HZ) {
  return `<rect x="${WX}" y="${y}" width="${WW}" height="${WB - y}" fill="${color}" opacity="${op}"/>`;
}
function water(y = 310, color = "#8fb3df", op = 0.45) {
  let waves = "";
  for (let i = 0; i < 3; i++) {
    const yy = y + 12 + i * 12;
    waves += `<path d="M${WX} ${yy} q24 -7 48 0 t48 0 t48 0 t48 0 t48 0" fill="none" stroke="#fff" stroke-width="1.4" opacity=".5"/>`;
  }
  return `<rect x="${WX}" y="${y}" width="${WW}" height="${WB - y}" fill="${color}" opacity="${op}"/>${waves}`;
}
function mountains(y = HZ, color = "#a7adcf", op = 0.45) {
  return `<path d="M${WX} ${y} L96 ${y - 46} L138 ${y - 12} L190 ${y - 56} L244 ${y - 8} L${WX + WW} ${y} Z" fill="${color}" opacity="${op}"/>`;
}
function sun(cx, cy, r, color = GOLD, rays = true) {
  let ray = "";
  if (rays) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const x1 = cx + Math.cos(a) * (r + 5), y1 = cy + Math.sin(a) * (r + 5);
      const x2 = cx + Math.cos(a) * (r + 18), y2 = cy + Math.sin(a) * (r + 18);
      ray += `<line x1="${P(x1)}" y1="${P(y1)}" x2="${P(x2)}" y2="${P(y2)}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    }
  }
  return `<g opacity=".92">${ray}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity=".5"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2"/></g>`;
}
function crescent(cx, cy, r, color = GOLDL) {
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity=".85"/><circle cx="${cx + r * 0.5}" cy="${cy - r * 0.2}" r="${r}" fill="url(#sky)"/></g>`;
}
function moonFace(cx, cy, r, color = GOLDL) {
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity=".75"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GOLD}" stroke-width="1.5"/><path d="M${cx - r * 0.45} ${cy - r * 0.1} q${r * 0.45} ${r * 0.5} ${r * 0.9} 0" fill="none" stroke="${GOLD}" stroke-width="1.4"/><circle cx="${cx - r * 0.4}" cy="${cy - r * 0.35}" r="2" fill="${GOLD}"/><circle cx="${cx + r * 0.35}" cy="${cy - r * 0.35}" r="2" fill="${GOLD}"/></g>`;
}
function littleStars(list, color = GOLDL) {
  return list.map(([x, y, r]) => `<path d="${starPath(x, y, r, r * 0.45, 5)}" fill="${color}" opacity=".9"/>`).join("");
}
function person(cx, baseY, h, robe, { skin = SKIN, headR } = {}) {
  const hr = headR || h * 0.12;
  const top = baseY - h;
  const sh = top + hr * 2.1;
  return `<g>
    <path d="M${P(cx - h * 0.26)} ${P(baseY)} C${P(cx - h * 0.22)} ${P(top + h * 0.32)} ${P(cx - hr)} ${P(sh)} ${cx} ${P(sh)} C${P(cx + hr)} ${P(sh)} ${P(cx + h * 0.22)} ${P(top + h * 0.32)} ${P(cx + h * 0.26)} ${P(baseY)} Z" fill="${robe}" opacity=".88"/>
    <circle cx="${cx}" cy="${P(top + hr)}" r="${P(hr)}" fill="${skin}"/>
  </g>`;
}
function halo(cx, cy, r, color = GOLDL) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="3" opacity=".8"/>`;
}
function pillars(color = "#b9aed6") {
  return `<rect x="${WX + 6}" y="${WY + 26}" width="20" height="${WH - 40}" fill="${color}" opacity=".5"/>
  <rect x="${WX + WW - 26}" y="${WY + 26}" width="20" height="${WH - 40}" fill="${color}" opacity=".5"/>`;
}
function towers(color = "#9aa0c0") {
  const t = (x) => `<rect x="${x - 12}" y="${HZ - 56}" width="24" height="56" fill="${color}" opacity=".55"/><path d="M${x - 14} ${HZ - 56} L${x} ${HZ - 72} L${x + 14} ${HZ - 56} Z" fill="${color}" opacity=".6"/>`;
  return t(WX + 34) + t(WX + WW - 34);
}

// —— 花色法器 ——
function emblem(suitKey, cx, cy, s = 1) {
  const c = suitColor[suitKey];
  if (suitKey === "wands") {
    return `<g><line x1="${cx}" y1="${P(cy - 24 * s)}" x2="${cx}" y2="${P(cy + 24 * s)}" stroke="${c}" stroke-width="${4 * s}" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${P(cy - 24 * s)}" r="${3 * s}" fill="#7fae6f"/>
      <path d="M${cx} ${P(cy - 10 * s)} q${8 * s} ${-4 * s} ${10 * s} ${4 * s}" fill="none" stroke="#7fae6f" stroke-width="${2 * s}"/>
      <path d="M${cx} ${P(cy + 4 * s)} q${-8 * s} ${-4 * s} ${-10 * s} ${4 * s}" fill="none" stroke="#7fae6f" stroke-width="${2 * s}"/></g>`;
  }
  if (suitKey === "cups") {
    return `<g fill="${c}" opacity=".85"><path d="M${P(cx - 12 * s)} ${P(cy - 8 * s)} Q${cx} ${P(cy + 12 * s)} ${P(cx + 12 * s)} ${P(cy - 8 * s)} Z"/>
      <rect x="${P(cx - 2 * s)} " y="${P(cy + 4 * s)}" width="${4 * s}" height="${10 * s}"/>
      <rect x="${P(cx - 9 * s)}" y="${P(cy + 14 * s)}" width="${18 * s}" height="${4 * s}" rx="2"/>
      <ellipse cx="${cx}" cy="${P(cy - 8 * s)}" rx="${12 * s}" ry="${3.4 * s}" fill="#fff" opacity=".55"/></g>`;
  }
  if (suitKey === "swords") {
    const top = cy - 26 * s, gy = cy + 10 * s, bot = cy + 26 * s;
    return `<g stroke="${c}" stroke-width="${3 * s}" stroke-linecap="round"><line x1="${cx}" y1="${P(top)}" x2="${cx}" y2="${P(bot)}"/><line x1="${P(cx - 9 * s)}" y1="${P(gy)}" x2="${P(cx + 9 * s)}" y2="${P(gy)}"/></g><circle cx="${cx}" cy="${P(bot)}" r="${3 * s}" fill="${c}"/>`;
  }
  // pentacles
  return `<g><circle cx="${cx}" cy="${cy}" r="${16 * s}" fill="${c}" opacity=".32"/><circle cx="${cx}" cy="${cy}" r="${16 * s}" fill="none" stroke="${c}" stroke-width="${2 * s}"/><path d="${starPath(cx, cy, 12 * s, 6 * s, 5)}" fill="none" stroke="${c}" stroke-width="${1.6 * s}"/></g>`;
}

// 点数布局（窗口内）
function pipLayout(count) {
  const cols2 = [WX + 64, WX + WW - 64];
  const rows = {
    1: [[CX, 228]],
    2: [[CX, 168], [CX, 288]],
    3: [[CX, 150], [cols2[0], 252], [cols2[1], 252]],
    4: [[cols2[0], 168], [cols2[1], 168], [cols2[0], 288], [cols2[1], 288]],
    5: [[cols2[0], 160], [cols2[1], 160], [CX, 226], [cols2[0], 292], [cols2[1], 292]],
    6: [[cols2[0], 156], [cols2[1], 156], [cols2[0], 226], [cols2[1], 226], [cols2[0], 296], [cols2[1], 296]],
    7: [[cols2[0], 150], [cols2[1], 150], [cols2[0], 214], [cols2[1], 214], [cols2[0], 278], [cols2[1], 278], [CX, 318]],
    8: [[cols2[0], 148], [cols2[1], 148], [cols2[0], 206], [cols2[1], 206], [cols2[0], 264], [cols2[1], 264], [cols2[0], 320], [cols2[1], 320]],
    9: [[WX + 56, 150], [CX, 150], [WX + WW - 56, 150], [WX + 56, 224], [CX, 224], [WX + WW - 56, 224], [WX + 56, 298], [CX, 298], [WX + WW - 56, 298]],
    10: [[WX + 56, 146], [WX + WW - 56, 146], [CX, 178], [WX + 56, 214], [WX + WW - 56, 214], [WX + 56, 266], [WX + WW - 56, 266], [CX, 250], [WX + 56, 312], [WX + WW - 56, 312]]
  };
  return rows[count] || rows[1];
}

// —— 大阿卡那场景 ——
const majorScene = {
  fool: (a) => `${mountains(HZ, "#c9b6e6", .4)}${ground("#e6dcc4", .5)}${sun(WX + WW - 34, WY + 40, 16, GOLDL)}
    ${person(CX - 6, 300, 120, PURPLE)}
    <line x1="${CX + 34}" y1="300" x2="${CX + 54}" y2="200" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${CX + 56}" cy="196" r="9" fill="${GOLD}" opacity=".7"/>
    <circle cx="${CX - 40}" cy="312" r="10" fill="#fff" opacity=".8"/><circle cx="${CX - 40}" cy="312" r="10" fill="none" stroke="${SOFT}" stroke-width="1.5"/>
    <path d="${starPath(CX, 150, 9, 4, 5)}" fill="${GOLDL}"/>`,
  magician: (a) => `${ground("#e3dcc8", .5)}<text x="${CX}" y="146" text-anchor="middle" font-size="26" fill="${GOLD}">∞</text>
    ${person(CX, 296, 132, PURPLE)}
    <line x1="${CX}" y1="186" x2="${CX}" y2="150" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/>
    <rect x="${CX - 52}" y="300" width="104" height="10" rx="4" fill="#cbb98f" opacity=".7"/>
    ${emblem("cups", CX - 36, 292, .7)}${emblem("swords", CX - 12, 292, .6)}${emblem("wands", CX + 14, 292, .6)}${emblem("pentacles", CX + 38, 292, .6)}`,
  "high-priestess": (a) => `${pillars()}${water(322)}${crescent(CX, 332, 12)}
    ${person(CX, 300, 130, "#7e8bd0")}
    <circle cx="${CX}" cy="186" r="9" fill="none" stroke="${GOLDL}" stroke-width="3"/>
    <path d="M${CX - 30} 210 h60" stroke="#fff" stroke-width="2" opacity=".6"/>`,
  empress: (a) => `${ground("#cfe0bf", .6)}${sun(WX + WW - 36, WY + 38, 14, GOLDL)}
    ${person(CX, 300, 132, "#cf8aa6")}
    <path d="${starPath(CX, 168, 12, 6, 12)}" fill="${GOLDL}" opacity=".7"/>
    <g stroke="#7fae6f" stroke-width="2"><line x1="${CX - 44}" y1="320" x2="${CX - 44}" y2="298"/><line x1="${CX - 36}" y1="320" x2="${CX - 36}" y2="300"/><line x1="${CX + 40}" y1="320" x2="${CX + 40}" y2="300"/></g>`,
  emperor: (a) => `${mountains(HZ, "#c79a72", .5)}${ground("#d9c39c", .5)}
    <rect x="${CX - 40}" y="250" width="80" height="80" rx="6" fill="#b98a86" opacity=".5"/>
    ${person(CX, 300, 120, "#c2615f")}
    <circle cx="${CX - 40}" cy="250" r="8" fill="#c2615f" opacity=".6"/><circle cx="${CX + 40}" cy="250" r="8" fill="#c2615f" opacity=".6"/>
    <circle cx="${CX}" cy="192" r="8" fill="${GOLD}" opacity=".7"/>`,
  hierophant: (a) => `${pillars()}${ground("#d8cdb2", .5)}
    ${person(CX, 296, 126, "#b86a72")}
    <path d="M${CX - 10} 176 v-18 M${CX + 10} 176 v-18 M${CX} 176 v-22" stroke="${GOLDL}" stroke-width="3"/>
    ${person(CX - 52, 326, 56, "#9aa0c0")}${person(CX + 52, 326, 56, "#9aa0c0")}`,
  lovers: (a) => `${sun(CX, WY + 40, 18, GOLDL)}${ground("#cfe0bf", .5)}
    <path d="M${CX - 24} ${WY + 58} q24 -22 48 0" fill="none" stroke="${GOLDL}" stroke-width="3" opacity=".8"/>
    ${person(CX - 40, 312, 104, "#7e8bd0")}${person(CX + 40, 312, 104, "#cf8aa6")}`,
  chariot: (a) => `${towers()}${ground("#d6cbaf", .5)}
    ${littleStars([[CX - 40, WY + 34, 5], [CX, WY + 26, 6], [CX + 40, WY + 34, 5]])}
    <rect x="${CX - 44}" y="266" width="88" height="56" rx="6" fill="#9aa0c0" opacity=".55"/>
    ${person(CX, 286, 86, "#8f6fc0")}
    <circle cx="${CX - 30}" cy="332" r="6" fill="${INK}" opacity=".6"/><circle cx="${CX + 30}" cy="332" r="6" fill="#fff" opacity=".8" stroke="${SOFT}"/>`,
  strength: (a) => `${ground("#cfe0bf", .5)}<text x="${CX}" y="156" text-anchor="middle" font-size="24" fill="${GOLD}">∞</text>
    ${person(CX - 24, 300, 116, "#e8d49a")}
    <ellipse cx="${CX + 40}" cy="300" rx="34" ry="22" fill="#d9a24e" opacity=".6"/>
    <circle cx="${CX + 58}" cy="288" r="14" fill="#d9a24e" opacity=".7"/>`,
  hermit: (a) => `${mountains(HZ, "#a7adcf", .5)}${ground("#cfc6b0", .4)}
    ${person(CX, 304, 132, "#8b86a0")}
    <circle cx="${CX - 40}" cy="250" r="13" fill="none" stroke="${GOLD}" stroke-width="2"/><path d="${starPath(CX - 40, 250, 7, 3, 6)}" fill="${GOLDL}"/>
    <line x1="${CX + 40}" y1="220" x2="${CX + 40}" y2="320" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/>`,
  "wheel-of-fortune": (a) => `${littleStars([[WX + 30, WY + 40, 5], [WX + WW - 30, WY + 40, 5]])}
    <circle cx="${CX}" cy="228" r="62" fill="none" stroke="${GOLD}" stroke-width="3" opacity=".8"/>
    <circle cx="${CX}" cy="228" r="40" fill="${PURPLE}" opacity=".12"/>
    <g stroke="${GOLD}" stroke-width="2" opacity=".7">${Array.from({ length: 8 }, (_, i) => { const a2 = i * Math.PI / 4; return `<line x1="${P(CX + Math.cos(a2) * 22)}" y1="${P(228 + Math.sin(a2) * 22)}" x2="${P(CX + Math.cos(a2) * 60)}" y2="${P(228 + Math.sin(a2) * 60)}"/>`; }).join("")}</g>
    <text x="${CX}" y="236" text-anchor="middle" font-size="22" fill="${GOLD}">∞</text>`,
  justice: (a) => `${pillars()}${ground("#d8cdb2", .4)}
    ${person(CX, 300, 124, "#8f6fc0")}
    <line x1="${CX + 30}" y1="300" x2="${CX + 30}" y2="208" stroke="${GOLD}" stroke-width="3"/>
    <g stroke="${GOLD}" stroke-width="2"><line x1="${CX - 52}" y1="214" x2="${CX - 12}" y2="214"/><line x1="${CX - 46}" y1="214" x2="${CX - 50}" y2="232"/><line x1="${CX - 18}" y1="214" x2="${CX - 14}" y2="232"/></g>`,
  "hanged-man": (a) => `${ground("#cfc6b0", .4)}
    <line x1="${WX + 30}" y1="170" x2="${WX + WW - 30}" y2="170" stroke="#8a6f4a" stroke-width="5"/>
    <line x1="${CX}" y1="170" x2="${CX}" y2="200" stroke="#8a6f4a" stroke-width="3"/>
    <g transform="rotate(180 ${CX} 256)">${person(CX, 300, 110, "#7e8bd0")}</g>
    ${halo(CX, 322, 18)}`,
  death: (a) => `${towers()}${sun(CX, HZ - 64, 12, GOLDL)}${ground("#cfc6b0", .45)}
    <ellipse cx="${CX}" cy="318" rx="58" ry="14" fill="#fff" opacity=".55"/>
    ${person(CX - 6, 300, 70, "#6f6a86")}
    <circle cx="${CX - 6}" cy="246" r="11" fill="#f2eee6"/><circle cx="${CX - 10}" cy="244" r="2" fill="${INK}"/><circle cx="${CX - 2}" cy="244" r="2" fill="${INK}"/>
    <line x1="${CX + 34}" y1="300" x2="${CX + 34}" y2="206" stroke="${GOLD}" stroke-width="3"/><path d="M${CX + 34} 208 h26 v18 h-26 Z" fill="#fff" opacity=".8" stroke="${SOFT}"/>`,
  temperance: (a) => `${mountains(HZ, "#a7adcf", .4)}${water(320)}${sun(WX + WW - 34, WY + 38, 12, GOLDL)}
    ${person(CX, 308, 128, "#cf8aa6")}
    <path d="M${CX - 4} 222 q-10 14 -22 24" fill="none" stroke="#8fb3df" stroke-width="3"/>
    ${emblem("cups", CX - 30, 236, .7)}${emblem("cups", CX + 26, 256, .7)}
    <path d="M${CX - 22} 246 q14 8 30 14" fill="none" stroke="#8fb3df" stroke-width="2"/>`,
  devil: (a) => `<rect x="${WX}" y="${WY}" width="${WW}" height="${WH}" fill="#2c2440" opacity=".18"/>${ground("#5b5170", .4)}
    ${person(CX, 268, 96, "#6a5b86")}
    <path d="M${CX - 12} 188 l-8 -16 M${CX + 12} 188 l8 -16" stroke="${INK}" stroke-width="3"/>
    ${person(CX - 52, 330, 48, "#8a7fa0")}${person(CX + 52, 330, 48, "#8a7fa0")}
    <path d="M${CX} 300 q-26 8 -50 22 M${CX} 300 q26 8 50 22" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".6"/>`,
  tower: (a) => `<rect x="${WX}" y="${WY}" width="${WW}" height="${WH}" fill="#2c2440" opacity=".14"/>${ground("#7a6f55", .4)}
    <rect x="${CX - 26}" y="190" width="52" height="130" fill="#9aa0c0" opacity=".6"/>
    <path d="M${CX - 28} 190 L${CX} 162 L${CX + 28} 190 Z" fill="${GOLD}" opacity=".5"/>
    <path d="M${WX + 40} ${WY + 12} L${CX - 6} 188 L${CX + 12} 176" stroke="${GOLDL}" stroke-width="3" fill="none"/>
    <path d="M${CX - 40} 250 q-6 14 -2 28 M${CX + 40} 250 q6 14 2 28" stroke="${GOLD}" stroke-width="3" fill="none" opacity=".7"/>`,
  star: (a) => `${water(318)}${ground("#cfe0bf", .35, 318)}
    <path d="${starPath(CX, 168, 18, 8, 8)}" fill="${GOLDL}"/>
    ${littleStars([[WX + 40, 150, 6], [WX + WW - 40, 150, 6], [WX + 60, 200, 5], [WX + WW - 60, 200, 5], [CX - 30, 130, 4], [CX + 30, 130, 4], [CX, 210, 4]])}
    ${person(CX, 320, 92, "#7fb0c9")}
    ${emblem("cups", CX - 36, 296, .6)}${emblem("cups", CX + 32, 300, .6)}`,
  moon: (a) => `${towers()}${water(320)}${moonFace(CX, 170, 26)}
    <path d="M${CX} 320 L${CX - 6} 250 L${CX + 4} 250 Z" fill="#e9dcc0" opacity=".5"/>
    <path d="M${CX - 60} 332 l8 -20 6 14 4 -10 4 16 Z" fill="#8b86a0" opacity=".7"/>
    <path d="M${CX + 44} 332 l8 -22 6 16 5 -12 5 18 Z" fill="#7a7090" opacity=".7"/>
    <path d="M${CX - 8} 344 q8 -6 16 0" fill="none" stroke="${SOFT}" stroke-width="2"/>`,
  sun: (a) => `${sun(CX, 178, 34, GOLD)}${ground("#cfe0bf", .55)}
    <rect x="${WX + 24}" y="296" width="${WW - 48}" height="10" rx="4" fill="#cbb98f" opacity=".6"/>
    ${Array.from({ length: 4 }, (_, i) => { const x = WX + 40 + i * 50; return `<line x1="${x}" y1="296" x2="${x}" y2="270" stroke="#7fae6f" stroke-width="2"/><circle cx="${x}" cy="266" r="7" fill="${GOLD}" opacity=".7"/>`; }).join("")}
    ${person(CX, 332, 56, "#d98f5c")}`,
  judgement: (a) => `${mountains(HZ, "#a7adcf", .4)}${ground("#cfc6b0", .4)}
    ${person(CX, 200, 70, "#cf8aa6")}
    <line x1="${CX + 16}" y1="180" x2="${CX + 44}" y2="166" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/>
    ${person(CX - 44, 332, 50, "#9aa0c0")}${person(CX, 338, 54, "#9aa0c0")}${person(CX + 44, 332, 50, "#9aa0c0")}`,
  world: (a) => `<g><ellipse cx="${CX}" cy="228" rx="64" ry="92" fill="none" stroke="#7fae6f" stroke-width="5" opacity=".6"/></g>
    ${person(CX, 282, 96, "#cf8aa6")}
    ${littleStars([[WX + 28, WY + 26, 6], [WX + WW - 28, WY + 26, 6], [WX + 28, WB - 22, 6], [WX + WW - 28, WB - 22, 6]], PURPLE)}`
};

// —— 宫廷牌 ——
function courtScene(card) {
  const c = suitColor[card.suitKey];
  const rank = card.slug.split("-")[1];
  const base = `${mountains(HZ, "#b9b0d2", .35)}${card.suitKey === "cups" ? water(316) : ground("#d6cbaf", .45)}`;
  if (rank === "knight") {
    return `${base}
      <ellipse cx="${CX}" cy="322" rx="58" ry="14" fill="#fff" opacity=".4"/>
      <path d="M${CX - 50} 320 q10 -54 56 -54 q34 0 40 30 l-6 24 Z" fill="#cdbf9b" opacity=".6"/>
      ${person(CX - 6, 286, 70, c)}
      <line x1="${CX - 46}" y1="320" x2="${CX - 46}" y2="346" stroke="${INK}" stroke-width="3"/><line x1="${CX + 30}" y1="320" x2="${CX + 30}" y2="346" stroke="${INK}" stroke-width="3"/>
      ${emblem(card.suitKey, CX + 40, 250, .9)}`;
  }
  if (rank === "page") {
    return `${base}${person(CX, 312, 120, c)}${emblem(card.suitKey, CX, 210, 1.1)}`;
  }
  // queen / king on throne
  const thr = `<rect x="${CX - 46}" y="200" width="92" height="132" rx="8" fill="#b3a9cc" opacity=".45"/><rect x="${CX - 46}" y="190" width="92" height="18" rx="6" fill="#b3a9cc" opacity=".55"/>`;
  const crown = rank === "king"
    ? `<path d="M${CX - 14} 214 l4 -16 5 12 5 -14 5 14 5 -12 4 16 Z" fill="${GOLD}" opacity=".8"/>`
    : `<path d="M${CX - 12} 214 q12 -18 24 0 Z" fill="${GOLD}" opacity=".8"/>`;
  return `${base}${thr}${person(CX, 322, 116, c)}${crown}${emblem(card.suitKey, CX + 40, 246, .95)}`;
}

// —— 小阿卡那（数字牌）——
const minorScene = {
  // 最具叙事性的牌单独绘制
  "swords-three": (card) => {
    const c = suitColor.swords;
    return `<rect x="${WX}" y="${WY}" width="${WW}" height="${WH}" fill="#9aa0c0" opacity=".12"/>
      <path d="M${CX} 168 C${CX - 56} 168 ${CX - 56} 248 ${CX} 286 C${CX + 56} 248 ${CX + 56} 168 ${CX} 168 Z" fill="#cf8aa6" opacity=".55"/>
      ${[-1, 0, 1].map((d) => `<g transform="rotate(${d * 26} ${CX} 226)"><line x1="${CX}" y1="150" x2="${CX}" y2="300" stroke="${c}" stroke-width="3" stroke-linecap="round"/><line x1="${CX - 9}" y1="278" x2="${CX + 9}" y2="278" stroke="${c}" stroke-width="3"/></g>`).join("")}`;
  },
  "cups-three": (card) => `${ground("#cfe0bf", .5)}${[CX - 46, CX, CX + 46].map((x, i) => emblem("cups", x, 230 - (i === 1 ? 16 : 0), 1.1)).join("")}
    <path d="M${CX - 46} 214 q46 -30 92 0" fill="none" stroke="${GOLDL}" stroke-width="2" opacity=".6"/>`,
  "wands-ten": (card) => `${ground("#d6cbaf", .5)}${person(CX, 320, 110, suitColor.wands)}
    <g transform="rotate(-16 ${CX} 230)">${Array.from({ length: 10 }, (_, i) => `<line x1="${CX - 36 + i * 8}" y1="200" x2="${CX - 36 + i * 8}" y2="260" stroke="${suitColor.wands}" stroke-width="3" stroke-linecap="round"/>`).join("")}</g>`,
  "swords-ten": (card) => `<rect x="${WX}" y="${WY}" width="${WW}" height="${WH}" fill="#2c2440" opacity=".1"/>${ground("#9aa0c0", .4, 300)}
    ${Array.from({ length: 10 }, (_, i) => `<line x1="${WX + 24 + i * 19}" y1="306" x2="${WX + 24 + i * 19}" y2="250" stroke="${suitColor.swords}" stroke-width="3" stroke-linecap="round"/>`).join("")}
    <line x1="${WX + 16}" y1="306" x2="${WX + WW - 16}" y2="306" stroke="${SOFT}" stroke-width="2"/>`
};

function minorPips(card) {
  const count = card.symbolCount;
  const suitKey = card.suitKey;
  const bg = suitKey === "cups" || suitKey === "swords"
    ? `${mountains(HZ, "#b4b9d8", .3)}${suitKey === "cups" ? water(322) : ground("#cdbf9b", .4)}`
    : `${mountains(HZ, "#c7bda0", .3)}${ground(suitKey === "wands" ? "#d9c7a0" : "#d3c39a", .45)}`;
  const aceHand = count === 1
    ? `<path d="M${CX - 30} 300 q30 -16 60 0" fill="#fff" opacity=".5"/><ellipse cx="${CX}" cy="300" rx="20" ry="10" fill="#fff" opacity=".6"/>`
    : "";
  const pips = pipLayout(count).map(([x, y]) => emblem(suitKey, x, y, count >= 9 ? 0.7 : count >= 6 ? 0.82 : 0.95)).join("");
  return `${bg}${aceHand}${pips}`;
}

function sceneFor(card) {
  const accent = card.arcana === "大阿卡那" ? PURPLE : suitColor[card.suitKey];
  let inner;
  if (card.arcana === "大阿卡那") {
    inner = (majorScene[card.slug] || (() => ground("#d6cbaf", .4) + sun(CX, 200, 22)))(accent);
  } else {
    const rank = card.slug.split("-")[1];
    if (["page", "knight", "queen", "king"].includes(rank)) inner = courtScene(card);
    else if (minorScene[card.slug]) inner = minorScene[card.slug](card);
    else inner = minorPips(card);
  }
  return `${sceneBg(accent)}${inner}${sceneEnd}`;
}

// —— 卡片外框（保留原风格）——
function renderCard(card) {
  const accent = card.arcana === "大阿卡那" ? PURPLE : suitColor[card.suitKey];
  const kw = `${card.upright[0]}${card.upright[1] ? " · " + card.upright[1] : ""}`;
  const bottom = card.upright[2] || card.nameEn;
  return `<svg width="320" height="520" viewBox="0 0 320 520" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${card.name}">
  <rect x="10" y="10" width="300" height="500" rx="30" fill="url(#paper)" stroke="url(#edge)" stroke-width="2"/>
  <rect x="28" y="28" width="264" height="464" rx="22" fill="rgba(255,255,255,.30)" stroke="rgba(255,255,255,.7)"/>
  <circle cx="56" cy="74" r="22" fill="${accent}" opacity=".14"/>
  <circle cx="264" cy="446" r="30" fill="${GOLDL}" opacity=".2"/>
  <text x="160" y="62" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="22" font-weight="700" fill="#2C2439">${card.name}</text>
  <text x="160" y="86" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="12" font-weight="600" fill="#7E718D">${card.nameEn}</text>
  ${sceneFor(card)}
  <text x="160" y="402" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="14" font-weight="700" fill="#6A5F77">${kw}</text>
  <text x="160" y="446" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13" font-weight="700" fill="${accent}">${card.arcana}</text>
  <text x="160" y="474" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="16" font-weight="700" fill="#5C5368">${bottom}</text>
  <defs>
    <linearGradient id="paper" x1="22" y1="18" x2="302" y2="510" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFDF8"/><stop offset=".52" stop-color="#F8EEF7"/><stop offset="1" stop-color="#EAF4FF"/>
    </linearGradient>
    <linearGradient id="edge" x1="14" y1="10" x2="310" y2="510" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFF8E8"/><stop offset=".5" stop-color="${GOLDL}"/><stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <linearGradient id="sky" x1="0" y1="${WY}" x2="0" y2="${WB}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${SKY1}"/><stop offset="1" stop-color="${SKY2}"/>
    </linearGradient>
  </defs>
</svg>`;
}

let n = 0;
for (const card of tarotDeck) {
  writeFileSync(join(OUT, `${card.slug}.svg`), renderCard(card), "utf8");
  n++;
}
console.log(`已生成 ${n} 张卡面 → ${OUT}`);
