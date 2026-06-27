# Token Tank — developer convenience targets.
#
# Uses the backend virtualenv at backend/.venv. Run `make install` first.

PY := backend/.venv/bin/python
PYTEST := backend/.venv/bin/pytest

.DEFAULT_GOAL := help
.PHONY: help install test test-verbose frontend build run init clean dist

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install backend (editable, with dev extras) + frontend deps
	$(PY) -m pip install -e ".[dev]"
	cd frontend && npm install

test: ## Run the backend test suite
	cd backend && .venv/bin/pytest tests/ -q

test-verbose: ## Run the backend test suite (verbose)
	cd backend && .venv/bin/pytest tests/ -v

frontend: ## Type-check the frontend
	cd frontend && npx tsc --noEmit

build: ## Production frontend build
	cd frontend && npm run build

run: ## Start proxy (8848) + FastAPI (8000)
	$(PY) -m token_tank

init: ## Initialize ~/.token-tank/ with default config
	$(PY) -m token_tank init

dist: ## Build sdist + wheel
	$(PY) -m build

clean: ## Remove build artifacts and caches
	rm -rf build dist *.egg-info backend/*.egg-info
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf .pytest_cache backend/.pytest_cache frontend/dist
