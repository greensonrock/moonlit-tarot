#!/usr/bin/env node
/**
 * Configure Render production env from local .env (DMXAPI_* only).
 * Usage: RENDER_API_KEY=rnd_xxx node scripts/configure-render-production.js
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SERVICE_NAME = "moonlit-tarot";
const API = "https://api.render.com/v1";

async function loadDotEnv() {
  const vars = {};
  try {
    const raw = await readFile(path.join(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // optional
  }
  return vars;
}

async function api(key, pathname, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`Render API ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function findService(apiKey) {
  let cursor;
  for (let page = 0; page < 10; page += 1) {
    const qs = new URLSearchParams({ limit: "50" });
    if (cursor) qs.set("cursor", cursor);
    const data = await api(apiKey, `/services?${qs}`);
    const match = (data || []).find((item) => item.service?.name === SERVICE_NAME || item.name === SERVICE_NAME);
    if (match) return match.service || match;
    cursor = data?.cursor;
    if (!cursor) break;
  }
  throw new Error(`Service not found: ${SERVICE_NAME}`);
}

async function upsertEnv(apiKey, serviceId, envKey, value) {
  await api(apiKey, `/services/${serviceId}/env-vars`, {
    method: "POST",
    body: { envVar: { key: envKey, value } }
  });
}

async function triggerDeploy(apiKey, serviceId) {
  await api(apiKey, `/services/${serviceId}/deploys`, {
    method: "POST",
    body: { clearCache: "do_not_clear" }
  });
}

async function main() {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) {
    console.error("Missing RENDER_API_KEY. Get one from https://dashboard.render.com/u/settings#api-keys");
    process.exit(1);
  }

  const dotenv = await loadDotEnv();
  const dmxKey = process.env.DMXAPI_KEY || dotenv.DMXAPI_KEY;
  if (!dmxKey) {
    console.error("Missing DMXAPI_KEY in .env");
    process.exit(1);
  }

  const service = await findService(apiKey);
  const serviceId = service.id;
  console.log(`Found service: ${service.name} (${serviceId})`);

  const pairs = [
    ["DMXAPI_KEY", dmxKey],
    ["DMXAPI_MODEL", process.env.DMXAPI_MODEL || dotenv.DMXAPI_MODEL || "deepseek-v4-flash"],
    ["DMXAPI_BASE", process.env.DMXAPI_BASE || dotenv.DMXAPI_BASE || "https://www.dmxapi.com"]
  ];

  for (const [key, value] of pairs) {
    await upsertEnv(apiKey, serviceId, key, value);
    console.log(`Set env: ${key}`);
  }

  await triggerDeploy(apiKey, serviceId);
  const url = service.serviceDetails?.url || `https://${SERVICE_NAME}.onrender.com`;
  console.log(`Deploy triggered. Production URL: ${url}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
