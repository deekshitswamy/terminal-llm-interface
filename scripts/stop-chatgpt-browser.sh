#!/usr/bin/env bash

set -euo pipefail

GATEWAY_DIR="${HOME}/Library/Application Support/terminal-chat/catgpt-gateway"
PID_FILE="${GATEWAY_DIR}/.terminal-chat-gateway.pid"
BROWSER_PROFILE_DIR="${GATEWAY_DIR}/browser_data"
HIDER_PID_FILE="${HOME}/Library/Application Support/terminal-chat/.chatgpt-browser-hider.pid"
HIDER_SCREEN_NAME="terminal-chat-browser-hider"

kill_browser_profile_processes() {
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

wait_for_shutdown() {
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

if [ ! -d "${GATEWAY_DIR}" ]; then
  echo "Gateway is not installed." >&2
  exit 1
fi

if [ -f "${PID_FILE}" ]; then
  PID="$(cat "${PID_FILE}")"
  if [ -n "${PID}" ] && kill -0 "${PID}" 2>/dev/null; then
    kill "${PID}"
    rm -f "${PID_FILE}"
  fi
  rm -f "${PID_FILE}"
fi

LISTENER_PID="$(lsof -tiTCP:8001 -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "${LISTENER_PID}" ]; then
  COMMAND="$(ps -p "${LISTENER_PID}" -o command= 2>/dev/null || true)"
  if printf '%s' "${COMMAND}" | grep -q "src.api.server"; then
    kill "${LISTENER_PID}" 2>/dev/null || true
  fi
fi

kill_browser_profile_processes

wait_for_shutdown || true

echo "ChatGPT gateway stopped and browser profile released."
