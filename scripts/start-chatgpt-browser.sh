#!/usr/bin/env bash

set -euo pipefail

GATEWAY_DIR="${HOME}/Library/Application Support/terminal-chat/catgpt-gateway"
PID_FILE="${GATEWAY_DIR}/.terminal-chat-gateway.pid"
LOG_FILE="${GATEWAY_DIR}/logs/terminal-chat-gateway.out"

cleanup_stale_gateway() {
  local listener_pid
  listener_pid="$(lsof -tiTCP:8000 -sTCP:LISTEN 2>/dev/null || true)"

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

if curl -sf http://127.0.0.1:8000/healthz >/dev/null 2>&1; then
  echo "ChatGPT gateway is already running."
  exit 0
fi

cleanup_stale_gateway

screen -dmS terminal-chat-gateway bash -lc "cd \"${GATEWAY_DIR}\" && mkdir -p logs && echo \$\$ > \"${PID_FILE}\" && exec .venv/bin/python -m src.api.server >> \"${LOG_FILE}\" 2>&1"

for _ in {1..45}; do
  if curl -sf http://127.0.0.1:8000/healthz >/dev/null 2>&1; then
    echo "ChatGPT gateway started. API: http://127.0.0.1:8000/v1"
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

echo "ChatGPT gateway did not become ready in time. Check ${LOG_FILE}" >&2
tail -n 80 "${LOG_FILE}" >&2 || true
exit 1
