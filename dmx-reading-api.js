/**
 * AI 解读专用 API 配置（仅用于抽牌后的解析，不用于文生图等脚本）
 * 优先 DMXAPI_READING_*，未设置时回退 DMXAPI_* 以兼容旧 .env
 */

const DEFAULT_BASE = "https://www.dmxapi.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

export function getReadingApiConfig() {
  return {
    apiKey: (process.env.DMXAPI_READING_KEY || process.env.DMXAPI_KEY || "").trim(),
    base: (process.env.DMXAPI_READING_BASE || process.env.DMXAPI_BASE || DEFAULT_BASE).replace(/\/$/, ""),
    model: process.env.DMXAPI_READING_MODEL || process.env.DMXAPI_MODEL || DEFAULT_MODEL
  };
}

export function isReadingApiConfigured() {
  return Boolean(getReadingApiConfig().apiKey);
}

/** 启动时/健康检查用：是否已配置且令牌有效（需先 ping） */
export function readingApiStatusExtra(ping = {}) {
  const cfg = getReadingApiConfig();
  return {
    configured: Boolean(cfg.apiKey),
    model: cfg.model,
    base: cfg.base,
    keySource: process.env.DMXAPI_READING_KEY ? "DMXAPI_READING_KEY" : process.env.DMXAPI_KEY ? "DMXAPI_KEY" : null,
    ...ping
  };
}
