#!/usr/bin/env bash

set -euo pipefail

GATEWAY_DIR="${HOME}/Library/Application Support/terminal-chat/catgpt-gateway"
PID_FILE="${GATEWAY_DIR}/.terminal-chat-gateway.pid"
LOG_FILE="${GATEWAY_DIR}/logs/terminal-chat-gateway.out"
BROWSER_PROFILE_DIR="${GATEWAY_DIR}/browser_data"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HIDER_SCRIPT="${SCRIPT_DIR}/hide-chatgpt-browser.sh"
PATCH_SCRIPT="${SCRIPT_DIR}/patch-chatgpt-gateway.py"
HIDER_PID_FILE="${HOME}/Library/Application Support/terminal-chat/.chatgpt-browser-hider.pid"
HIDER_SCREEN_NAME="terminal-chat-browser-hider"
MAX_WAIT_SECONDS=120

cleanup_browser_profile_processes() {
  local pids=""

  pids="$(ps ax -o pid=,command= | grep "${BROWSER_PROFILE_DIR}" | grep -v grep | awk '{print $1}' | tr '\n' ' ' || true)"
  if [ -n "${pids// /}" ]; then
    kill ${pids} 2>/dev/null || true
    sleep 1
    kill -9 ${pids} 2>/dev/null || true
  fi

  screen -S terminal-chat-gateway -X quit >/dev/null 2>&1 || true
  screen -S "${HIDER_SCREEN_NAME}" -X quit >/dev/null 2>&1 || true

  if [ -f "${HIDER_PID_FILE}" ]; then
    local hider_pid
    hider_pid="$(cat "${HIDER_PID_FILE}" 2>/dev/null || true)"
    if [ -n "${hider_pid}" ] && kill -0 "${hider_pid}" 2>/dev/null; then
      kill "${hider_pid}" 2>/dev/null || true
      sleep 1
      kill -9 "${hider_pid}" 2>/dev/null || true
    fi
    rm -f "${HIDER_PID_FILE}"
  fi
}

wait_for_stale_shutdown() {
  local listener_pid=""
  local remaining_profile_pids=""

  for _ in {1..30}; do
    listener_pid="$(lsof -tiTCP:8001 -sTCP:LISTEN 2>/dev/null || true)"
    remaining_profile_pids="$(ps ax -o pid=,command= | grep "${BROWSER_PROFILE_DIR}" | grep -v grep || true)"

    if [ -z "${listener_pid}" ] && [ -z "${remaining_profile_pids}" ]; then
      return 0
    fi

    sleep 1
  done

  return 1
}

cleanup_stale_gateway() {
  local listener_pid
  listener_pid="$(lsof -tiTCP:8001 -sTCP:LISTEN 2>/dev/null || true)"

  if [ -n "${listener_pid}" ]; then
    local command
    command="$(ps -p "${listener_pid}" -o command= 2>/dev/null || true)"
    if printf '%s' "${command}" | grep -q "src.api.server"; then
      kill "${listener_pid}" 2>/dev/null || true
      sleep 1
    fi
  fi

  if [ -f "${PID_FILE}" ]; then
    local pid
    pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
    if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
      sleep 1
    fi
    rm -f "${PID_FILE}"
  fi

  cleanup_browser_profile_processes
  wait_for_stale_shutdown || true
}

start_window_hider() {
  screen -S "${HIDER_SCREEN_NAME}" -X quit >/dev/null 2>&1 || true

  if [ -f "${HIDER_PID_FILE}" ]; then
    local hider_pid
    hider_pid="$(cat "${HIDER_PID_FILE}" 2>/dev/null || true)"
    if [ -n "${hider_pid}" ] && kill -0 "${hider_pid}" 2>/dev/null; then
      return 0
    fi
    rm -f "${HIDER_PID_FILE}"
  fi

  screen -dmS "${HIDER_SCREEN_NAME}" bash -lc "exec bash \"${HIDER_SCRIPT}\""
}

if [ ! -d "${GATEWAY_DIR}" ]; then
  echo "Gateway is not installed yet. Run npm run setup:chatgpt-browser first." >&2
  exit 1
fi

cd "${GATEWAY_DIR}"

if [ ! -x ".venv/bin/python" ]; then
  echo "Gateway Python environment is missing. Run npm run setup:chatgpt-browser first." >&2
  exit 1
fi

mkdir -p logs
: > "${LOG_FILE}"
python3 "${PATCH_SCRIPT}" >/dev/null

if curl -sf http://127.0.0.1:8001/healthz >/dev/null 2>&1; then
  start_window_hider
  echo "ChatGPT gateway is already running."
  exit 0
fi

cleanup_stale_gateway

screen -dmS terminal-chat-gateway bash -lc "cd \"${GATEWAY_DIR}\" && mkdir -p logs && echo \$\$ > \"${PID_FILE}\" && exec .venv/bin/python -m src.api.server >> \"${LOG_FILE}\" 2>&1"

for ((attempt=1; attempt<=MAX_WAIT_SECONDS; attempt+=1)); do
  if curl -sf http://127.0.0.1:8001/healthz >/dev/null 2>&1; then
    start_window_hider
    echo "ChatGPT gateway started. API: http://127.0.0.1:8001/v1"
    exit 0
  fi

  if [ -f "${PID_FILE}" ]; then
    PID="$(cat "${PID_FILE}")"
    if [ -n "${PID}" ] && ! kill -0 "${PID}" 2>/dev/null; then
      echo "ChatGPT gateway exited during startup. Check ${LOG_FILE}" >&2
      tail -n 80 "${LOG_FILE}" >&2 || true
      exit 1
    fi
  fi

  sleep 1
done

echo "ChatGPT gateway did not become ready within ${MAX_WAIT_SECONDS}s. Check ${LOG_FILE}" >&2
tail -n 80 "${LOG_FILE}" >&2 || true
exit 1
