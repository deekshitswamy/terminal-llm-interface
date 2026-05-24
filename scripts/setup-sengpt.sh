#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${HOME}/Library/Application Support/terminal-chat"
VENV_PATH="${APP_ROOT}/sengpt-venv"
PYTHON_BIN="${PYTHON_BIN:-python3.11}"

mkdir -p "${APP_ROOT}"

"${PYTHON_BIN}" -m venv "${VENV_PATH}"
source "${VENV_PATH}/bin/activate"

python -m pip install --upgrade pip
python -m pip install "git+https://github.com/SenZmaKi/Sengpt.git@master" websockets

echo "Sengpt bridge environment is ready at ${VENV_PATH}"
