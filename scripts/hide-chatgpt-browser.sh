#!/usr/bin/env bash

set -euo pipefail

GATEWAY_URL="http://127.0.0.1:8001/healthz"
APP_ROOT="${HOME}/Library/Application Support/terminal-chat"
PID_FILE="${APP_ROOT}/.chatgpt-browser-hider.pid"

mkdir -p "${APP_ROOT}"

hide_browser_windows() {
  osascript <<'EOF' >/dev/null 2>&1 || true
try
  if application "Chromium" is running then
    tell application "Chromium"
      try
        set miniaturized of every window to true
      end try
      hide
    end tell
  end if
end try

try
  if application "Google Chrome for Testing" is running then
    tell application "Google Chrome for Testing"
      try
        set miniaturized of every window to true
      end try
      hide
    end tell
  end if
end try
EOF
}

cleanup() {
  rm -f "${PID_FILE}"
}

trap cleanup EXIT
echo "$$" > "${PID_FILE}"

while curl -sf "${GATEWAY_URL}" >/dev/null 2>&1; do
  hide_browser_windows
  sleep 2
done
