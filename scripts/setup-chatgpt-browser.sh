#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${HOME}/Library/Application Support/terminal-chat"
GATEWAY_DIR="${APP_ROOT}/catgpt-gateway"
GATEWAY_REPO="https://github.com/GautamVhavle/CatGPT-Gateway.git"
PATCH_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/patch-chatgpt-gateway.py"

mkdir -p "${APP_ROOT}"

if [ ! -d "${GATEWAY_DIR}/.git" ]; then
  git clone "${GATEWAY_REPO}" "${GATEWAY_DIR}"
else
  git -C "${GATEWAY_DIR}" pull --ff-only
fi

cd "${GATEWAY_DIR}"

if [ ! -f ".env" ]; then
  cp .env.example .env
fi

python3 - <<'PY'
from pathlib import Path

env_path = Path(".env")
lines = env_path.read_text().splitlines()
updates = {
    "PROVIDER": "chatgpt",
    "API_TOKEN": "terminal-chat-local",
    "API_PORT": "8001",
    "HEADLESS": "false",
    "HIDE_BROWSER_WINDOWS": "true",
    "SLOW_MO": "0",
    "SELECTOR_TIMEOUT": "6000",
    "POLL_INTERVAL_MS": "250",
    "TYPING_SPEED_MIN": "8",
    "TYPING_SPEED_MAX": "18",
    "THINKING_PAUSE_MIN": "120",
    "THINKING_PAUSE_MAX": "300",
    "RATE_LIMIT_SECONDS": "1",
    "VERBOSE": "false",
    "VNC_PASSWORD": "catgpt",
}

seen = set()
out = []

for line in lines:
    if "=" not in line or line.lstrip().startswith("#"):
        out.append(line)
        continue

    key, _, _ = line.partition("=")
    if key in updates:
        out.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        out.append(line)

for key, value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")

env_path.write_text("\n".join(out) + "\n")
PY

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
patchright install chromium
python3 "${PATCH_SCRIPT}"

echo "ChatGPT gateway is ready at ${GATEWAY_DIR}"
