#!/usr/bin/env bash

set -euo pipefail

GATEWAY_DIR="${HOME}/Library/Application Support/terminal-chat/catgpt-gateway"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_SCRIPT="${SCRIPT_DIR}/start-chatgpt-browser.sh"

if [ ! -x "${GATEWAY_DIR}/.venv/bin/python" ]; then
  echo "Gateway is not installed yet. Run npm run setup:chatgpt-browser first." >&2
  exit 1
fi

osascript <<EOF
tell application "Terminal"
  activate
  set loginTab to do script "cd " & quoted form of "${GATEWAY_DIR}" & " && source .venv/bin/activate && HEADLESS=false python scripts/first_login.py && bash " & quoted form of "${START_SCRIPT}" & "; exit"
  repeat while busy of loginTab
    delay 1
  end repeat
  try
    close (first window whose selected tab is loginTab) saving no
  end try
end tell
EOF

echo "Opened a Terminal window for ChatGPT login. After sign-in, it will start the headless relay and close itself."
