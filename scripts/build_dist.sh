#!/usr/bin/env bash
# Build the frontend, bundle it into the Python package, and build sdist + wheel.
#
# Produces a self-contained distribution: `pip install token-tank` will serve
# the dashboard from token_tank/webui/ with no source checkout required.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PY="${PYTHON:-backend/.venv/bin/python}"

echo "==> Building frontend"
(cd frontend && npm run build)

echo "==> Bundling UI into token_tank/webui"
rm -rf backend/token_tank/webui
cp -R frontend/dist backend/token_tank/webui

echo "==> Building sdist + wheel"
rm -rf dist
"$PY" -m build

echo "==> Validating with twine"
"$PY" -m twine check dist/*

echo "==> Done. Artifacts:"
ls -1 dist/
