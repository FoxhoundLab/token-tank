# One-Shot Revamp v2 — Report

**Branch:** `feat/one-shot-revamp-v2` (from `main` @ 56aaa93)
**Executor:** Fable 5 HIGH · single session · 2026-07-09
**Diff:** 20 files, +1431 / −352 (frontend only — under the 1500-line abort threshold)

## Screenshots

- Desktop 1440px: [`docs/design-ref/after-v2-desktop.png`](design-ref/after-v2-desktop.png)
- Mobile 375px: [`docs/design-ref/after-v2-mobile.png`](design-ref/after-v2-mobile.png)

## Moves shipped (one commit per move)

| Commit | Move |
|---|---|
| `chrome:` | Corner brackets (8-stroke gradient overlay on every `.panel`), mono ID strips with hardware serials (`PROVIDER · 03` / `TT-ANT-SUB`), CRT scanline overlay + ambient horizon glow |
| `typography:` | **Inverted title bands** — heavy ink Sigurd 800 on a light strip (the Novean signature). Heroes to 700 / −0.03em with baseline K/M/B suffixes. All micro-labels JetBrains Mono 0.7rem uppercase |
| `segmentation:` | SegmentRail rewritten as discrete countable blocks (default 10) with 2px gaps, dim unused segments visible, energy-edge glow on the last lit block |
| `shapes:` | StatusGlyph component — ● live / ◆ standby / ▲ error / □ info / ■ critical(pulse). Applied to topbar, system status, provider cards, settings connection cells, link-down panel |
| `density:` | 10+ readouts per card: hero duo, fuel/balance rail + exhaustion projection, 6-cell readout grid (requests, avg/req, burn per min+hr, month totals), 7d model mix, per-provider LIVE/STANDBY pulse, POLL timestamp. New `CountdownStrip` (subscription) + `SpendTiles` (API) |
| `gauge:` | Center mono-700 percentage readout inside the arc, "FUEL REMAINING" sub-label, alarm glow pulsing only on warn/danger |
| `topbar:` | Bracket-bordered hardware badge + TT monogram, toggle-switch nav (lit left edge when active), `StatusStrip` secondary instruments line (clock / operator / uptime / poll / link / heap), live signal value (`tok/s` live, `mm:ss ago` standby) |
| `settings:` | Theme cards preview a miniature gauge + 6-block rail in each theme's own palette, Sigurd 800 names, ACTIVE tag. Chrome/ID/shape moves cover the rest of the page |
| `mobile:` | 6px brackets, heroes 1.8–2.2rem, single-column stack with full chrome, zero horizontal overflow (verified programmatically at 375/640/1440) |
| `telemetry honesty:` | Quota-derived fuel, UTC countdown parsing, adaptive cost decimals (see Deviations) |

Three card models stay visually distinct: subscription = fuel rail + hour-segmented reset countdown; API = balance rail + 7-day spend tiles with today highlighted; local = ∞ unmetered plate + throughput, no escalation colors.

## Verification gate results

### §5.1 Static checks

```
$ npx tsc --noEmit          → clean (zero errors)
$ npm run build             → ✓ built in 504ms
                              dist/assets/index-BcOrGqoS.css  30.32 kB │ gzip 6.31 kB
                              dist/assets/index-Dx0TZcTv.js  178.92 kB │ gzip 55.93 kB
$ .venv/bin/pytest tests/ -q → 134 passed, 1 warning in 0.96s
```

Note: the suite is now 134 tests (grew past the brief's 124 on `main` before this branch); all pass, backend untouched.

### §5.2 Forbidden patterns

```
console.log        → none
TODO/FIXME         → none
Inter/Geist/SF Pro/Helvetica/Arial → none
  (the naive grep matches setInterval/clearInterval; a precise
   font-name grep returns clean)
border-radius ≥5px → none (radius is 0 everywhere via --radius)
```

### §5.3 Visual gate (seeded demo, `http://localhost:8080`)

Verified on the live seeded board, screenshots saved:

1. Cockpit chrome on every panel — brackets, ID tags, scanlines ✓
2. Typography hierarchy — heroes dominate, inverted Sigurd-800 bands, mono uppercase labels ✓
3. Segments countable — 10-block rails, dim unused blocks visible ✓
4. Three card types distinct at a glance ✓
5. Status shapes everywhere (●/◆/▲/□/■) ✓
6. 10+ readouts per provider card ✓
7. Reads as instrument panel, not a Stripe/Linear/Tailwind template ✓

### §5.4 Live behavior

- `GET /api/v1/dashboard` — every surfaced field present (`today_tokens`, `today_cost`, `month_*`, `burn_rate_*`, `fuel_level`, `provider_type`, `api_tier`)
- `GET /api/v1/quota` — windows with `used/limit/unit/reset_at/percentage` drive quota bars, countdown strip, fuel derivation
- `GET /api/v1/providers/{id}/history?range=7d` — daily totals (incl. `request_count`) + model breakdown drive spend tiles, request/avg-per-req readouts, model mix
- End-to-end pulse test: injected a usage record into the demo DB → within one 5s poll the topbar flipped to `● LIVE · 214.3 tok/s` and exactly the affected provider's card flag went LIVE; the others stayed ◆ STANDBY.

### §5.5 Themes

All four themes captured and verified (tank / midnight / mono / cyberpunk): brackets render at contrast (they ride each theme's accent), scanlines visible, inverted bands + typography hold, warn/danger amber/red distinguishable from every accent.

### §5.6 Mobile (375px)

`scrollWidth == clientWidth` verified at 375/640/1440 after fixing a real overflow (system-status stats grid min-content pushed the page to 540px — status body now stacks on narrow screens). Full chrome intact in the mobile screenshot; cards stack single-column.

## Deviations from the brief

1. **§2.3 said "the dashboard API already returns 7-day data — verify and surface it." It does not.** `/api/v1/dashboard` has no daily series, request counts, or model breakdown. The pre-existing `/providers/{id}/history` endpoint (Sprint 3C) returns exactly that. Rather than fabricate (Trap 6) or gut the density mandate, the Dashboard fetches that already-wired endpoint on the existing 30s slow cadence (alongside quotas). No backend changes, no new endpoints or data shapes.
2. **Quota-derived fuel.** The backend's `fuel_level` is a hardcoded `1.0` placeholder ("needs plan limits"), which pinned every fuel rail and the master gauge at 100%. Per §4 ("compute it from existing fields"), fuel now derives from the tightest quota window when windows exist, falling back to `fuel_level` otherwise. This also makes the CRITICAL/■ reserve flag and exhaustion projection real.
3. **UTC parsing fix (pre-existing bug).** The API serializes UTC datetimes without a timezone suffix; `new Date()` parsed them as local time, skewing every countdown by the UTC offset (a 2h14m reset displayed as 9h13m). `parseUTC()` in `utils/time.ts` treats suffix-less timestamps as UTC. This also corrects the pre-existing QuotaBar countdown.
4. **Micro-label opacity 0.75, not the brief's 0.55.** `--tank-label` is already a mid-tone; 0.55 on top of it fell below readable contrast on the panel background. Labels still visibly recede behind data.
5. **Local-card "uptime" skipped.** No uptime field exists anywhere in the API; per Trap 6 it was skipped rather than invented. Local cards show throughput, avg/req, 7d requests, month tokens, and model mix instead. (Session uptime lives honestly in the topbar StatusStrip.)
6. **`CountdownTimer.tsx` left untouched.** It is dead code (never imported, predates this pass, uses hardcoded colors). Deleting it felt out of scope for a visual pass; flagged here for a future cleanup.

## Known issues

- Seeded demo costs are sub-cent, so some readouts show `$0.0000`–`$0.0025`; adaptive decimals keep them honest but they look odd until real traffic flows.
- `MEM` in the StatusStrip appears only in Chromium (non-standard `performance.memory`); other browsers simply omit the cell.
- The three subscription/API demo providers share identical injected quota windows (62%/59%), so their rails look similar in the screenshots — an artifact of the demo data, not the UI.

## Not merged

Branch pushed to `origin/feat/one-shot-revamp-v2`. **Not merged to `main`** — awaiting Snake's review.
