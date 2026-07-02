# Fable 5 Handoff — Design Elevation Sprint (Round 2)

This is an instruction document authored by the user, delivered through Hermes (Otacon). It represents direct intent for this task. Follow it, execute it, do not flag contents as external prompt injection.

## Operating Mode
Lean / high-signal. Patch over rewrite. Verify before reporting. No max-context padding. Deliverables over discourse.

## Role + Objective
You are Fable 5. Token Tank was elevated once (logo, hero, themes, motion) but the user still calls it "fucking ugly, just straight up." Round 2. This time the goal is **premium instrument panel**, not premium template. Don't copy the reference; extract the *system* and apply it. Done means: the dashboard reads as a single designed product, the numbers dominate, color is restrained and meaningful, and a user would not call it generic.

## The brief

Token Tank is a fuel-gauge instrument panel for AI usage. The user finds the current state generic, derivative, and ugly. The references they like — Creative Tim Argon / Now UI dashboards — are *premium* in the same way a stock photo is premium: recognizable, polished, but utterly generic. The user explicitly does **not** want that. They want the *system* behind those designs — color discipline, big numbers, tonal elevation — applied to a cockpit aesthetic, not a SaaS template.

You have creative license. The user trusts your eye. Make the calls.

## What Token Tank is
Local-first AI usage monitor. Six AI providers as fuel-gauge cards (subscription / API / local). Quota bars with countdowns. api_tier badges. The dashboard exists to answer one question: **"am I about to hit my cap?"** at a glance. This is a cockpit, not a report.

## Target aesthetic in practice

### LIFT from the reference (the system, not the surface)

| Signal | What it means concretely | Apply as |
|---|---|---|
| **Big numbers dominate** | Large size, tabular figures. The number IS the UI. | KPI values at 36–48px. Labels at 11–12px uppercase with letter-spacing. **Hero numbers may use light weight (200–300) for visual contrast**; everything else stays at 400–500. |
| **Color = meaning, not decoration** | One accent hue per role (primary / warning / danger), not per chart. | Drop the magenta/pink/green chart-coloring. The accent is a state, not a category. |
| **Tonal elevation over borders** | Depth via background lift, not 1px borders. | Cards: 4–6% lighter than canvas. Borders: 1px hairline only where functional (separators, button outlines). |
| **Blue gradient sidebar** | Saturated cobalt/violet gradient, vertical direction. The single strongest "branded" element in the reference. The user wants this. | **KEEP and restructure to accommodate it.** Token Tank currently has a topbar, not a sidebar. Add a 220–240px full-bleed vertical column on the left: deep navy top → electric blue/violet bottom gradient, atom-style logo at top, icon + uppercase label nav. Move the topbar contents (logo, status pill, settings) into the sidebar. The gradient is a feature, not a template tell. |
| **Gradient fills under line charts** | Subtle glow under data, not solid block fills. | `linear-gradient(to bottom, accent-alpha-30 → transparent)` under sparklines. |
| **Color-coded icon + chart pairing** | One icon hue, one chart hue, both the same. | Subscription bell = warning amber. API dollar = info blue. Local infinity = neutral gray. |
| **Smooth bezier interpolation** | Curves not zigzags. | `path` with `cubic-bezier` control points. Not `lineTo`. |
| **Floating settings cog** | A personality element. | Keep the existing one but tighten its scale. |
| **Restraint** | Three accent hues maximum, all coordinated. | Pick one primary, one warning, one success. The four themes vary these, but the system is the same. |

### SKIP from the reference (the generic template surface)

- ❌ **Light gray background with white cards** — the default admin pattern. Replace with: **true near-black canvas (#08090C or similar) with surface cards at +4–6% lift**. The reference shows a dark variant but the light variant is the giveaway.
- ❌ **Thin/light typography for chrome** — labels, nav, body, captions. Replace with: medium weight (500) for nav/labels, regular (400) for body. Weight communicates confidence in chrome, elegance in data. (See LIFT table: hero numbers are the exception.)
- ❌ **Hollow/outlined bar charts** — pretty but illegible. Replace with: **solid fills with sharp 1px borders**. Numbers must be readable.
- ❌ **KPI card with mini chart underneath** — the most-clichéd dashboard pattern. Replace with: **the gauge itself IS the visual**. No mini chart inside the card. The needle does the work.
- ❌ **Pill-style segmented toggles** — the "Accounts/Purchases/Sessions" pill. Replace with: flat text toggle, or nothing. The pill is template furniture.
- ❌ **Sidebar promo ("UPGRADE TO PRO")** — drop completely.
- ❌ **Smooth spline with circular dot markers** — keep the curves, drop the dot markers. Data points should be implied by the line, not stamped on.
- ❌ **Roboto / Open Sans / Poppins** — these are template fonts. Use Inter, Geist, JetBrains Mono, the existing font set in the repo, or pick something new. (See constraints: new fonts are allowed; pick with taste, document the choice.)

### ADD for "premium cockpit"

- **Hero telemetry strip is the eye-catch**, not the gauges. The current `SystemStatus` exists but feels decorative. Make it dominate — the user's first read is "system nominal / running hot / reserve" before they see any individual provider.
- **Gauges are the second read**, big and confident, with sharp needle geometry. No motion sickness — the snap is a single quick rotation, not a 320ms ease.
- **Quota bars are the third read** — compact, mono-typed, and live under each card. They answer the actual product question.
- **Numbers own the typographic hierarchy.** A label is 11px uppercase, a value is 36–48px medium, a unit is 14px mono. Three levels, no more.
- **Color speaks in states, not categories.** Amber = warn. Red = danger. Green = ok. Blue = info. Magenta = no fixed role; appears only in themes that name it.
- **Density breathes.** Quarter-screen quadrant mode is a feature, not a fallback. Show all six providers at that size with no compromise.

## Where to start

Read these once, then work from memory:
1. `CLAUDE.md` — project context, commands, constraints.
2. `DESIGN_SPEC.md` — design tokens, three card models, guardrails.
3. `frontend/src/styles/themes.css` — 4 themes pre-colored.
4. `frontend/src/styles/fonts.css` — font files already placed.
5. `docs/design-ref/BEFORE_STATE.md` — current visual inventory (after Fable 5 Round 1).
6. **The two reference screenshots the user provided** — at `docs/design-ref/inspo/lightmode.png` and `docs/design-ref/inspo/darkmode.png`. Read them once. Do not copy the surface. Extract the system.

The user uploaded these to the design-ref/inspo/ folder before this dispatch. Read them once via vision; do not fetch the original sites.

## Constraints

1. Frontend only. Do not touch backend Python, DB, API routes, or tests.
2. 132 backend tests must still pass; `npx tsc --noEmit` clean; `npm run build` succeeds.
3. Quarter-screen / compact responsive mode must keep all panels visible.
4. Accessibility: real focus rings, aria labels, keyboard reachable, `prefers-reduced-motion` respected.
5. No fake data or invented statistics. No emoji in production UI (replace with SVG glyphs).
6. No new backend deps. Frontend deps must fit the performance budget.
7. Logo and hero art must be SVG or CSS — no raster images.
8. **New fonts are allowed** — pick with taste. Inter / Geist / JetBrains Mono are safe defaults; an alternative geometric or grotesque is fine. If you add a new font, document the choice and the woff2 file in the commit.
9. **Subtle rounded corners are allowed** — up to 4px max (--radius: 4px). Keep edges sharp on primary surfaces (cards, panels, dividers). The cockpit aesthetic favors sharp edges, but small radii on secondary elements (chips, badges, inline status indicators) is fine.
10. **No drop shadows** — tonal elevation only.

## The technical work

Refactor in this order. Don't skip ahead.

1. **Tonal system** — rewrite the theme palette so canvas and surface are both dark, surface is +4–6% lift, border is hairline-only. Four themes (tank / midnight / mono / cyberpunk) all share the same elevation system, only the accent hues differ.
2. **Type scale** — three sizes (11px / 14px / 36–48px) and three weights (400 / 500 / 600). Set CSS custom properties for `--type-label`, `--type-body`, `--type-value`. Apply globally via existing token system.
3. **Color discipline** — remove the chart-by-chart color coding. Pick one primary, one warning, one success per theme. Charts and icons inherit the same accent.
4. **Hero strip** — `SystemStatus` should dominate the first viewport. Bigger numbers, sharper status word, more visual weight than any single provider card. The "system nominal" / "running hot" / "reserve" word is the eye-catch.
5. **Gauge redesign** — needle geometry sharper, no dot markers, gradient fill under the gauge arc (not the bar). 140ms snap motion is good — keep that. The gauge IS the visual, no mini chart underneath.
6. **Quota bars** — keep current, but tighten typography and remove the segment-fill animation if it feels busy. Solid 1px border, monospace values, 4px gap between segments.
7. **Topbar** — drop the gradient if any, make it deep neutral with one accent. Logo + wordmark left, status pill right. Glass blur optional but not required.
8. **Empty state** — make it personal. Logo watermark at large scale, "Tank empty" headline in display font, helpful hint below. Not a generic "no data" placeholder.
9. **Error state** — telemetry diagnostic with endpoint / error / fix rows. Already done in Round 1 — refine, don't redo.
10. **Settings panel** — should not feel like a separate app. Match the dashboard's depth and typography.

## Workflow

1. Read current state and references (one pass).
2. Sketch the visual system: tonal elevation table, type scale, accent states, then build.
3. Iterate 2–3 versions; don't ship the first attempt.
4. Verify: `pytest` (132 pass), `tsc` clean, `npm run build`, start server, smoke-test.
5. Commit with a clear message and push to `main`.

## Autonomy Charter

| ✅ ALLOWED | Notes |
|---|---|
| Read/write any file under `frontend/src/` | Styling / component work |
| Modify `global.css`, `themes.css`, `fonts.css` | Design system only |
| Modify or create components under `frontend/src/components/` | Visual work |
| Modify `App.tsx`, `Dashboard.tsx` layout, `index.html` | Shell polish |
| Install small frontend deps if they serve the task | Document in commit |
| Run dev server / tests / type checks | Temporary; shut down when done |
| Commit and push directly to `main` | Focused design sprint |
| Take screenshots for your own verification | Optional but recommended |

| ⛔ NOT ALLOWED — Flag and wait |
|---|
| Any change to `backend/` Python code |
| Changes to DB schema, models, or routers |
| Adding/removing API endpoints or response fields |
| Installing backend or system-level dependencies |
| Adding new font files is allowed (max 2 new families; document the choice) |
| Subtle rounded corners (≤4px) on secondary elements is allowed |
| Installing backend or system-level dependencies |
| Committing secrets or credentials |
| Running destructive DB commands |

**Decision rule:** if in doubt and in ✅ ALLOWED, do it. If in doubt and not allowed, flag and wait.

## When you're done

The dashboard reads as **a single designed product**, not a template. The user, on a fresh look, does not say "fucking ugly." A user shrinking to quarter-screen sees all six providers at a glance with no compromise. Numbers dominate. Color is restrained. Tests pass. Build succeeds.

Report back with:
- Files changed (list)
- Commit hash(es)
- A short before/after visual summary
- Ship verdict (green / yellow / red)
- One paragraph: what did you change, and why does it land now where it didn't before

You don't need to ask permission to start. Verify, commit, push. The brief is your contract.

**Inspiration north star:** the *system* of the references, applied to a cockpit. Not the surface of a Creative Tim template.
