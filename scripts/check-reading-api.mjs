#!/usr/bin/env node
/** 仅验证 AI 解读专用 API（DMXAPI_READING_KEY） */
import { loadEnv } from "./load-env.mjs";
import { getReadingApiConfig, isReadingApiConfigured } from "../dmx-reading-api.js";

loadEnv();

if (!isReadingApiConfigured()) {
  console.error("FAIL 未配置 DMXAPI_READING_KEY（或回退 DMXAPI_KEY）");
  process.exit(1);
}

const { apiKey, base, model } = getReadingApiConfig();
const mask = apiKey.length > 12 ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : "(短)";
const keySource = process.env.DMXAPI_READING_KEY ? "DMXAPI_READING_KEY" : "DMXAPI_KEY";

console.log(`AI解读 Key: ${mask} (${keySource})`);
console.log(`Base: ${base}`);
console.log(`Model: ${model}`);

const r = await fetch(`${base}/v1/chat/completions`, {
  method: "POST",
  headers: { Authorization: apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "回复ok" }],
    max_tokens: 5
  })
});

const text = await r.text();
console.log(`chat: ${r.status} ${text.slice(0, 120).replace(/\n/g, " ")}`);

if (r.ok) {
  console.log("\nOK AI 解读 API 可用");
  process.exit(0);
}

if (r.status === 401) {
  console.error("\n→ 401：请在 https://www.dmxapi.cn 重新生成 Key，写入 .env 的 DMXAPI_READING_KEY");
} else {
  console.error("\n→ 请求失败，请检查模型名与余额");
}
process.exit(1);
