#!/usr/bin/env bash

set -euo pipefail

GATEWAY_DIR="${HOME}/Library/Application Support/terminal-chat/catgpt-gateway"

if [ ! -x "${GATEWAY_DIR}/.venv/bin/python" ]; then
  echo "Gateway is not installed yet. Run npm run setup:chatgpt-browser first." >&2
  exit 1
fi

osascript <<EOF
tell application "Terminal"
  activate
  do script "cd " & quoted form of "${GATEWAY_DIR}" & " && source .venv/bin/activate && HEADLESS=false python scripts/first_login.py"
end tell
EOF

echo "Opened a Terminal window for ChatGPT login. Complete the browser sign-in there, then return here and start the gateway."
