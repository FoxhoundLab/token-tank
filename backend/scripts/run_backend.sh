#!/usr/bin/env bash
# scripts/run_backend.sh — Start the Token Tank FastAPI backend.
#
# Usage:
#   bash scripts/run_backend.sh          # default (127.0.0.1:8000)
#   bash scripts/run_backend.sh 9000     # custom port

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Activate venv
if [ -d "$REPO_ROOT/.venv" ]; then
    source "$REPO_ROOT/.venv/bin/activate"
else
    echo "ERROR: No .venv found at $REPO_ROOT/.venv" >&2
    exit 1
fi

HOST="${TOKEN_TANK_API_HOST:-127.0.0.1}"
PORT="${1:-${TOKEN_TANK_API_PORT:-8000}}"

echo "⛽ Token Tank API starting on $HOST:$PORT"
exec uvicorn token_tank.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --reload
