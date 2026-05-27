#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-4173}"
NODE="${NODE:-/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node}"
CF="${ROOT}/.bin/cloudflared"

if ! lsof -i ":${PORT}" -P -n -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Starting app on 0.0.0.0:${PORT}..."
  HOST=0.0.0.0 PORT="${PORT}" "${NODE}" "${ROOT}/server.js" &
  sleep 1
fi

if [[ ! -x "${CF}" ]]; then
  echo "Downloading cloudflared..."
  mkdir -p "${ROOT}/.bin"
  arch="$(uname -m)"
  case "${arch}" in
    arm64) asset="cloudflared-darwin-arm64.tgz" ;;
    x86_64) asset="cloudflared-darwin-amd64.tgz" ;;
    *) echo "Unsupported arch: ${arch}"; exit 1 ;;
  esac
  curl -fsSL -o /tmp/cloudflared.tgz "https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}"
  tar -xzf /tmp/cloudflared.tgz -C "${ROOT}/.bin" cloudflared
  chmod +x "${CF}"
fi

echo "Starting Cloudflare tunnel -> http://127.0.0.1:${PORT}"
echo "(Keep this terminal open; URL is shown below)"
exec "${CF}" tunnel --url "http://127.0.0.1:${PORT}"
