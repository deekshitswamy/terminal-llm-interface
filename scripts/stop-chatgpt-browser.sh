#!/usr/bin/env bash

set -euo pipefail

GATEWAY_DIR="${HOME}/Library/Application Support/terminal-chat/catgpt-gateway"
PID_FILE="${GATEWAY_DIR}/.terminal-chat-gateway.pid"

if [ ! -d "${GATEWAY_DIR}" ]; then
  echo "Gateway is not installed." >&2
  exit 1
fi

if [ -f "${PID_FILE}" ]; then
  PID="$(cat "${PID_FILE}")"
  if [ -n "${PID}" ] && kill -0 "${PID}" 2>/dev/null; then
    kill "${PID}"
    rm -f "${PID_FILE}"
    echo "ChatGPT gateway stopped."
    exit 0
  fi
  rm -f "${PID_FILE}"
fi

LISTENER_PID="$(lsof -tiTCP:8000 -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "${LISTENER_PID}" ]; then
  COMMAND="$(ps -p "${LISTENER_PID}" -o command= 2>/dev/null || true)"
  if printf '%s' "${COMMAND}" | grep -q "src.api.server"; then
    kill "${LISTENER_PID}" 2>/dev/null || true
    echo "ChatGPT gateway stopped."
    exit 0
  fi
fi

echo "ChatGPT gateway is not running."
