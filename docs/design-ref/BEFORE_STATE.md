# Token Tank — Pre-Beautification State (2026-06-27)

## Current Visual State

The dashboard currently uses a basic dark theme (`#0a0a0a` bg, `#1a1a1a` surfaces,
`#f59e0b` accent). It's functional but visually flat — no texture overlays, no
multi-theme system, no animated gauge, no scanline effects.

### What's rendering now:
- **HTML title:** ⛽ Token Tank — AI Usage Monitor
- **Layout:** Single column, header with app title + settings button
- **Dashboard:** Grid of provider cards (currently empty — no providers configured)
- **Fuel gauge:** Simple CSS bar (not SVG, no animation)
- **Settings:** Provider picker grid with add/remove, key input, proxy config
- **Theme:** Single dark theme with a light-mode toggle (data-theme="light")
- **Fonts:** System font stack (no custom fonts loaded yet)

### CSS Inventory (frontend/src/styles/global.css — 553 lines):
- `:root` dark theme variables (lines 1-20)
- `:root[data-theme="light"]` light override (lines 22-36)
- Reset + body + app layout (lines 38-60)
- Header styles (lines 57-80)
- Dashboard grid + cards (lines 81-140)
- Fuel gauge styles (lines 141-180)
- Provider card styles (lines 181-250)
- Settings panel styles (lines 251-400)
- Skeleton/loading animations (lines 401-450)
- Error boundary styles (lines 451-500)
- Responsive breakpoints (lines 501-553)

### What exists but isn't wired:
- `frontend/src/styles/fonts.css` — @font-face declarations (NEW, not imported yet)
- `frontend/src/styles/themes.css` — 4-theme skeleton (NEW, not imported yet)
- `frontend/public/assets/fonts/*.woff2` — 9 font files ready to use

### Frontend bundle size:
- `index-BmTXRD4t.js` — 155KB (49KB gzipped)
- `index-ByINNNzG.css` — 11KB (3KB gzipped)
- Total: 166KB / 52KB gzipped

### Backend serving:
- FastAPI on `:8000` serving frontend from `frontend/dist/`
- Proxy on `:8848` forwarding to upstream providers
- Dashboard endpoint returns `{"providers": []}` (no providers configured)
