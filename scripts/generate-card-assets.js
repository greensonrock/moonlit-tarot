import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tarotDeck } from "../tarot-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/assets/cards");

const majorSymbols = {
  fool: "◇",
  magician: "✦",
  "high-priestess": "☾",
  empress: "✿",
  emperor: "◆",
  hierophant: "☉",
  lovers: "♡",
  chariot: "▵",
  strength: "∞",
  hermit: "✧",
  "wheel-of-fortune": "◎",
  justice: "⚖",
  "hanged-man": "▽",
  death: "✕",
  temperance: "♢",
  devil: "△",
  tower: "▱",
  star: "✶",
  moon: "☽",
  sun: "☀",
  judgement: "◌",
  world: "◍"
};

const suitStyles = {
  wands: { color: "#C56B74", symbol: wandSymbol },
  cups: { color: "#6D8FD7", symbol: cupSymbol },
  swords: { color: "#7F84A8", symbol: swordSymbol },
  pentacles: { color: "#B38A45", symbol: pentacleSymbol }
};

await mkdir(outDir, { recursive: true });

for (const card of tarotDeck) {
  await writeFile(path.join(outDir, `${card.slug}.svg`), renderCard(card), "utf8");
}

console.log(`Generated ${tarotDeck.length} tarot card SVG assets in ${outDir}`);

function renderCard(card) {
  const accent = card.suitKey ? suitStyles[card.suitKey].color : "#9A78C9";
  const title = escapeXml(card.name);
  const subtitle = escapeXml(card.nameEn);
  const keyword = escapeXml(card.upright[0]);
  const art = card.arcana === "大阿卡那" ? majorArt(card, accent) : minorArt(card, accent);

  return `<svg width="320" height="520" viewBox="0 0 320 520" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
  <rect x="10" y="10" width="300" height="500" rx="30" fill="url(#paper)" stroke="url(#edge)" stroke-width="2"/>
  <rect x="28" y="28" width="264" height="464" rx="22" fill="rgba(255,255,255,.34)" stroke="rgba(255,255,255,.72)"/>
  <circle cx="56" cy="74" r="22" fill="${accent}" opacity=".14"/>
  <circle cx="264" cy="446" r="30" fill="#F8DFA7" opacity=".18"/>
  <text x="160" y="62" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="22" font-weight="700" fill="#2C2439">${title}</text>
  <text x="160" y="86" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="12" font-weight="600" fill="#7E718D">${subtitle}</text>
  ${art}
  <text x="160" y="448" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13" font-weight="700" fill="${accent}">${escapeXml(card.arcana)}</text>
  <text x="160" y="474" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="16" font-weight="700" fill="#5C5368">${keyword}</text>
  <defs>
    <linearGradient id="paper" x1="22" y1="18" x2="302" y2="510" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFDF8"/>
      <stop offset=".52" stop-color="#F8EEF7"/>
      <stop offset="1" stop-color="#EAF4FF"/>
    </linearGradient>
    <linearGradient id="edge" x1="14" y1="10" x2="310" y2="510" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFF8E8"/>
      <stop offset=".5" stop-color="#F8DFA7"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
  </defs>
</svg>`;
}

function majorArt(card, accent) {
  const symbol = majorSymbols[card.slug] || "✦";
  return `
  <text x="160" y="180" text-anchor="middle" font-family="Georgia,serif" font-size="42" fill="${accent}" opacity=".28">${escapeXml(card.displayNumber)}</text>
  <circle cx="160" cy="252" r="90" fill="${accent}" opacity=".08"/>
  <circle cx="160" cy="252" r="68" stroke="${accent}" stroke-width="2" opacity=".45"/>
  <path d="M92 252c36-48 100-48 136 0-36 48-100 48-136 0Z" stroke="#C99B52" stroke-width="2" opacity=".62"/>
  <text x="160" y="282" text-anchor="middle" font-family="Georgia,serif" font-size="88" fill="${accent}">${escapeXml(symbol)}</text>
  <path d="M160 126l8 20 22 2-17 14 5 22-18-12-18 12 5-22-17-14 22-2 8-20Z" fill="#C99B52" opacity=".6"/>
  <text x="160" y="386" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="14" font-weight="700" fill="#6A5F77">${escapeXml(card.upright.slice(1).join(" · "))}</text>`;
}

function minorArt(card, accent) {
  const symbol = suitStyles[card.suitKey].symbol;
  const symbolCount = card.symbolCount || 1;
  const court = card.symbolCount ? "" : courtFigure(card, accent);
  const symbols = card.symbolCount ? symbolGrid(symbol, symbolCount, accent) : "";
  return `
  <text x="50" y="125" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-weight="700" fill="${accent}">${escapeXml(card.displayNumber)}</text>
  <text x="270" y="410" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-weight="700" fill="${accent}">${escapeXml(card.displayNumber)}</text>
  <circle cx="160" cy="252" r="102" fill="${accent}" opacity=".07"/>
  <rect x="76" y="132" width="168" height="236" rx="32" fill="rgba(255,255,255,.44)" stroke="${accent}" stroke-width="1.5" opacity=".74"/>
  ${symbols}
  ${court}
  <text x="160" y="398" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="14" font-weight="700" fill="#6A5F77">${escapeXml(card.upright.slice(1).join(" · "))}</text>`;
}

function symbolGrid(drawSymbol, count, accent) {
  const cols = count <= 3 ? count : count <= 6 ? 3 : 4;
  const rows = Math.ceil(count / cols);
  const gapX = cols === 1 ? 0 : 44;
  const gapY = rows === 1 ? 0 : 54;
  const startX = 160 - ((cols - 1) * gapX) / 2;
  const startY = 250 - ((rows - 1) * gapY) / 2;
  return Array.from({ length: count }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return drawSymbol(startX + col * gapX, startY + row * gapY, accent, 0.95);
  }).join("\n");
}

function wandSymbol(x, y, color, opacity) {
  return `<g opacity="${opacity}"><path d="M${x - 8} ${y + 24}L${x + 8} ${y - 24}" stroke="${color}" stroke-width="5" stroke-linecap="round"/><circle cx="${x + 10}" cy="${y - 26}" r="5" fill="#F8DFA7"/></g>`;
}

function cupSymbol(x, y, color, opacity) {
  return `<g opacity="${opacity}"><path d="M${x - 18} ${y - 18}h36v24c0 16-36 16-36 0v-24Z" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round"/><path d="M${x - 10} ${y + 24}h20M${x} ${y + 8}v16" stroke="${color}" stroke-width="4" stroke-linecap="round"/></g>`;
}

function swordSymbol(x, y, color, opacity) {
  return `<g opacity="${opacity}"><path d="M${x} ${y - 28}L${x + 10} ${y + 10}L${x} ${y + 30}L${x - 10} ${y + 10}Z" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/><path d="M${x - 18} ${y + 8}h36" stroke="#C99B52" stroke-width="4" stroke-linecap="round"/></g>`;
}

function pentacleSymbol(x, y, color, opacity) {
  return `<g opacity="${opacity}"><circle cx="${x}" cy="${y}" r="24" fill="none" stroke="${color}" stroke-width="4"/><path d="M${x} ${y - 18}l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L${x} ${y + 11}l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8L${x} ${y - 18}Z" fill="#F8DFA7" stroke="${color}" stroke-width="1.5"/></g>`;
}

function courtFigure(card, accent) {
  const crown = card.slug.includes("king") || card.slug.includes("queen");
  const knight = card.slug.includes("knight");
  const page = card.slug.includes("page");
  return `
  <g>
    <circle cx="160" cy="214" r="34" fill="${accent}" opacity=".2" stroke="${accent}" stroke-width="2"/>
    ${crown ? `<path d="M128 190l18 16 14-22 14 22 18-16v38h-64v-38Z" fill="#F8DFA7" stroke="${accent}" stroke-width="2"/>` : ""}
    ${knight ? `<path d="M112 286c24-54 74-56 100-8 10 18-8 40-34 28-18-8-32-8-54 6-16 10-22-6-12-26Z" fill="#F8DFA7" opacity=".7" stroke="${accent}" stroke-width="2"/>` : ""}
    ${page ? `<path d="M130 185c18-20 42-20 60 0l-12 24h-36l-12-24Z" fill="#F8DFA7" opacity=".72" stroke="${accent}" stroke-width="2"/>` : ""}
    <path d="M104 346c14-54 42-86 56-86s42 32 56 86H104Z" fill="${accent}" opacity=".16" stroke="${accent}" stroke-width="2"/>
    ${suitStyles[card.suitKey].symbol(160, 312, accent, 1)}
  </g>`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
