#!/bin/bash
# Token Tank Proxy Server startup script
# Starts the transparent proxy on localhost:8848

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT/backend"

echo "⛽ Starting Token Tank Proxy on localhost:8848..."
exec .venv/bin/python -m token_tank.proxy.server
