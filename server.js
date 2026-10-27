import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tarotDeck, getTarotStats, cardImagePath } from './tarot-data.js';
import { drawCardsFromRitualSelection, drawCardsFromDeck, getDrawConfig } from './draw-random.js';
import { getReadingApiConfig, isReadingApiConfigured } from './dmx-reading-api.js';
import { generateTarotAgent, AGENT_VERSION, PERSONA_HASH, SYSTEM_PROMPT_HASH } from './tarot-agent.js';
import { getCardKnowledge } from './tarot-knowledge.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
try {
  const env = await readFile(path.join(root, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const match = line.trim().match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
    if (match && (match[1].startsWith('DMXAPI_') || !process.env[match[1]])) process.env[match[1]] = match[2].trim();
  }
} catch {}
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const positions = { one: ['此刻的启示'], three: ['现状', '阻碍', '建议'] };
const check = (condition, message) => { if (!condition) throw Object.assign(new Error(message), { statusCode: 422 }); };
const cardArt = cardImagePath;

function makeReading(cards, input) {
  return {
    date: new Date().toISOString(), question: String(input.question || '').trim(), spread: cards.length === 1 ? 'one' : 'three',
    roastLevel: Number.isInteger(input.roastLevel) ? input.roastLevel : 2,
    knownFacts: Array.isArray(input.knownFacts) ? input.knownFacts.slice(0, 10) : [],
    userMood: typeof input.userMood === 'string' ? input.userMood.slice(0, 120) : '',
    cards: cards.map(card => ({ ...card, image: cardArt(card.slug) }))
  };
}

async function readWithAgent(reading) {
  check(reading.question.length >= 4 && reading.question.length <= 500, '请用 4–500 个字描述这一次的问题。');
  const { output, trace } = await generateTarotAgent(reading);
  const { previousResponse, ...publicReading } = reading;
  return { ...publicReading, aiPowered: true, agentOutput: output, agentTrace: trace };
}

async function drawReading(input, interpret = true) {
  check(['one', 'three'].includes(input.spread), '请选择单牌或三牌。');
  const count = positions[input.spread].length;
  if (input.drawMode === 'ritual') {
    check(Array.isArray(input.selectedSlots) && input.selectedSlots.length === count && new Set(input.selectedSlots).size === count && input.selectedSlots.every(i => Number.isInteger(i) && i >= 0 && i < 78), '抽牌位置无效，请重新确认。');
    check(Array.isArray(input.deckOrder) && input.deckOrder.length === 78 && new Set(input.deckOrder).size === 78 && input.deckOrder.every(i => Number.isInteger(i) && i >= 0 && i < 78), '洗牌顺序不完整，请重新洗牌。');
    check(Number.isInteger(input.cutIndex) && input.cutIndex >= 0 && input.cutIndex < 78, '切点无效。');
  }
  const config = input.reversals === false ? { ...getDrawConfig(), reverseRate: 0 } : getDrawConfig();
  const drawn = input.drawMode === 'ritual'
    ? drawCardsFromRitualSelection(tarotDeck, count, input.selectedSlots, input.cutIndex, config, input.deckOrder)
    : drawCardsFromDeck(tarotDeck, count, config);
  const cards = drawn.map(({ card, reversed }, index) => ({ ...card, position: positions[input.spread][index], orientation: reversed ? '逆位' : '正位' }));
  const reading = makeReading(cards, input);
  return interpret ? readWithAgent(reading) : reading;
}

async function followupReading(input) {
  check([1, 3].includes(input.cards?.length), '追问需要沿用完整的原牌阵。');
  const seen = new Set();
  const cards = input.cards.map(item => {
    const card = tarotDeck.find(card => card.slug === item.slug);
    check(card && !seen.has(card.slug) && ['正位', '逆位'].includes(item.orientation), '原牌阵数据无效。');
    seen.add(card.slug);
    return { ...card, position: typeof item.position === 'string' ? item.position.slice(0, 30) : '', orientation: item.orientation };
  });
  const reading = makeReading(cards, input);
  reading.conversationSummary = typeof input.conversationSummary === 'string' ? input.conversationSummary.slice(0, 8000) : '';
  reading.revisionFeedback = typeof input.revisionFeedback === 'string' ? input.revisionFeedback.trim().slice(0, 600) : '';
  if (reading.revisionFeedback) {
    check(reading.revisionFeedback.length >= 4, '请具体说出哪句不准确，至少写 4 个字。');
    const previous = input.previousResponse;
    check(previous && typeof previous === 'object', '请提供需要校准的上一版解读。');
    reading.previousResponse = Object.fromEntries(
      ['verdict', 'analysis', 'advice'].map(key => [key, typeof previous[key] === 'string' ? previous[key].slice(0, 2000) : ''])
    );
  }
  return readWithAgent(reading);
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) { size += chunk.length; check(size <= 30000, '请求内容过长。'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { throw Object.assign(new Error('请求格式无效。'), { statusCode: 422 }); }
}
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, { status:'ok', service:'moonlit-tarot', aiEnabled:isReadingApiConfigured(), agent:{version:AGENT_VERSION,personaHash:PERSONA_HASH,systemPromptHash:SYSTEM_PROMPT_HASH,model:getReadingApiConfig().model,interpretation:'AI only',ruleFallback:false} });
    }
    if (req.method === 'GET' && url.pathname === '/api/cards') return sendJson(res, { ...getTarotStats(), cards:tarotDeck.map(card=>{const {slug,name,nameEn,arcana,suit}=card;const knowledge=getCardKnowledge(card);return {slug,name,nameEn,arcana,suit,image:cardArt(slug),thumbnail:`/assets/cards-atelier-thumbs/${slug}.jpg`,imagery:knowledge?.imagery||'',light:knowledge?.light||'',shadow:knowledge?.shadow||''}}) });
    if (req.method === 'POST' && url.pathname === '/api/reading') return sendJson(res, await drawReading(await body(req)));
    if (req.method === 'POST' && url.pathname === '/api/draw') return sendJson(res, await drawReading(await body(req), false));
    if (req.method === 'POST' && url.pathname === '/api/reading/followup') return sendJson(res, await followupReading(await body(req)));
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, {error:'此操作不受支持。'},405);
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(publicDir, '.' + requested);
    if (!file.startsWith(publicDir + path.sep)) return sendJson(res,{error:'Not found'},404);
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':path.extname(file)==='.html' ? 'no-store' : 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(res,{error:'Not found'},404);
    console.error('Request failed:',error.message);
    sendJson(res, {error:error.statusCode ? error.message : '暂时没有完成这次操作，请稍后重试。'}, error.statusCode || 500);
  }
});
server.listen(port,host,()=>console.log(`Moonlit Tarot: http://127.0.0.1:${port} · Agent ${AGENT_VERSION} · AI only`));
