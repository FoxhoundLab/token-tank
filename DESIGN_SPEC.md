# Token Tank — Design Specification

**Author:** Otacon (GLM 5.2) · **For:** Fable 5 (Anthropic Fable 5) · **Date:** 2026-06-27

This spec defines the target aesthetic for Token Tank's dashboard. Reference implementation: [`docs/design-ref/hbe-sidepanel.css`](./design-ref/hbe-sidepanel.css) (Hermes Browser Extension CSS, ~1,700 lines). The pattern is brutalist instrument-panel — sharp edges, monochrome discipline, glowing accents on dark backgrounds.

## 1. Brand & Voice

**Token Tank** = AI usage as fuel. The dashboard is an instrument cluster, not a SaaS dashboard. Think cockpit gauges, not Material Design cards.

- **Mood:** Industrial, precise, nocturnal. Heavy contrast. Functional typography.
- **Voice in copy:** Terse. Eyebrow labels in UPPERCASE. No marketing fluff. Status text reads like telemetry.
- **Hero mark:** ⛽ (fuel pump emoji) is the brand glyph. Use as the favicon, empty-state mark, and sidebar logo.

## 2. Design Token Architecture

Port the Hermes pattern: CSS custom properties drive everything. No hardcoded colors outside the variables.

```css
:root {
  /* Signature palette: amber fuel-pump on deep blue-black */
  --tank-bg: #0a0f1a;           /* App canvas */
  --tank-panel: #11192a;         /* Card/panel surface */
  --tank-panel-rgb: 17, 25, 42;  /* For rgba() composition */
  --tank-paper: #fbfcff;         /* Light contrast surface */
  --tank-ink: #0a0f1a;           /* Primary text on light */
  --tank-fg: #e8eef7;            /* Primary text on dark */
  --tank-fg-rgb: 232, 238, 247;
  --tank-accent: #f59e0b;        /* Fuel amber — signature */
  --tank-accent-rgb: 245, 158, 11;
  --tank-accent-deep: #b45309;   /* Pressed/danger fuel */
  --tank-muted: rgba(232, 238, 247, 0.56);
  --tank-line: rgba(245, 158, 11, 0.18);  /* Subtle accent borders */
  --tank-line-strong: rgba(245, 158, 11, 0.62);
  --tank-ok: #10b981;
  --tank-warn: #f59e0b;
  --tank-danger: #ef4444;
  --radius: 0px;                /* SHARP. No rounded corners anywhere. */
}

/* Typography stack — fonts already copied to frontend/public/assets/fonts/ */
--font-display: "Sigurd Variable", "Inter", system-ui, sans-serif;
--font-ui: "Collapse", "Inter", system-ui, sans-serif;
--font-mono: "Courier Prime", "JetBrains Mono", ui-monospace, monospace;
```

**Naming convention:** `--tank-*` prefix for Token Tank-specific vars. Never hardcode colors.

## 3. Theme System

Implement **4 named themes** via `data-theme` attribute on `<html>`:

| Theme | Mood | Accent | Use case |
|---|---|---|---|
| `tank` (default) | Signature amber on midnight | `#f59e0b` | Default brand |
| `midnight` | Deep violet ink on near-black | `#b7a8ff` | Low-light focus |
| `mono` | Pure grayscale terminal aesthetic | `#9ca3af` | Distraction-free |
| `cyberpunk` | Neon green CRT phosphor | `#00ff5f` | Power-user |

Each theme defines its own `--tank-bg`, `--tank-fg`, `--tank-accent`, `--tank-line-strong`, etc. Theme picker lives in Settings (grid of swatch cards with mini previews, like Hermes `theme-card` pattern).

**Storage:** `localStorage["token-tank-theme"]` persists across sessions.

## 4. Typography Rules

- **Display headings** (h1, h2): `--font-display`, `font-weight: 300`, tight letter-spacing (`-0.02em`). Sized with `clamp()` for fluid scaling.
- **Body / UI**: `--font-ui`, normal weight. Sentence case.
- **Labels / eyebrows / buttons**: `--font-ui`, `font-weight: 700`, **UPPERCASE**, `letter-spacing: 0.14em`. These are the "instrument label" feel.
- **Data / numbers / code**: `--font-mono`, `font-variant-numeric: tabular-nums`. Currency, token counts, timestamps — always mono.
- **Buttons**: All caps + wide tracking + 1px solid border. No fill except on hover/active.

## 5. Component Patterns

### Fuel Gauge (`FuelGauge.tsx`)
- SVG-based, viewBox-relative. Needle is a sharp triangle, no anti-aliased softness.
- **Color thresholds:** green (`--tank-ok`) at 0-50%, amber (`--tank-warn`) at 50-80%, red (`--tank-danger`) at 80-100%.
- **Animation:** Needle rotation 320ms ease-out on value change. No continuous animation.
- **Tick marks:** 11 major ticks (0, 10, ..., 100). 5 minor between each major.
- **Label below:** Mono font, e.g. "47.3% · 4.7M tokens". No "of total" language — too verbose.

### Provider Card (`ProviderCard.tsx`)
- **Container:** 1px solid `var(--tank-line)`, zero radius. Background `var(--tank-panel)`.
- **Header:** Provider name (uppercase, tracking) + connection pill (see below).
- **Fuel gauge** fills most of the card.
- **Footer row:** Three mono values — today tokens, today cost, 5hr burn rate. Tight gutters.
- **Hover:** Border color → `var(--tank-line-strong)`. Background slightly lighter. 120ms transition.
- **Disabled state:** Reduced opacity + diagonal hatching overlay.

### Connection Pill (reusable)
- 13px circle, 1px solid border, 5px inner dot. Color-coded states:
  - `ok` — `--tank-accent` border + fill at 14% opacity
  - `warn` — `--tank-warn`
  - `error` — `--tank-danger`
  - `idle` — `--tank-muted`
- No text inside, no tooltip — color does the talking.

### Dashboard Layout (`Dashboard.tsx`)
- Topbar: sticky, `backdrop-filter: blur(8px)`, 1px bottom border, zero radius. Contains brand mark (⛽), connection pill, theme switcher button, settings button.
- Main scroll area: CSS grid, 1 column on mobile, 2 on tablet, 3 on desktop. 12px gap.
- Texture overlay: `::after` pseudo-element on the body with `repeating-linear-gradient` scanlines at 4-6% opacity, `mix-blend-mode: overlay`. Subtle but adds depth.

### Settings (`Settings.tsx`)
- **Section heads:** UPPERCASE + tracking + 1px bottom border.
- **Form controls:** Sharp 1px borders, no rounded corners. Focus state: 2px solid `var(--tank-accent)` outer ring (no box-shadow blur).
- **Toggle switches:** 32×16px, 1px border, internal dot. ON state fills with accent color.
- **Buttons:** Primary = filled accent + dark ink. Secondary = transparent + accent border.
- **Theme picker:** Grid of `theme-card` swatches, 3 columns. Each card shows a mini preview panel with color relationships, plus the theme name.

### Empty States
- Centered in the empty area.
- Brand mark (⛽ SVG) at 30% opacity as background watermark via mask-image.
- Headline in display font, weight 300.
- Subtext: UPPERCASE + tracking, muted color.

## 6. Texture & Depth

**Scanline overlay** — applied to `body::after`:
```css
body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  background-image: repeating-linear-gradient(
    0deg,
    rgba(var(--tank-fg-rgb), 0.04) 0px,
    rgba(var(--tank-fg-rgb), 0.04) 1px,
    transparent 1px,
    transparent 3px
  );
  mix-blend-mode: overlay;
}
```

**Ray-field ambient** — optional radial gradient in top-right corner of the main canvas, 20% opacity, gives depth without distraction.

**Panel borders** — always 1px solid, never shadows. The 1px line IS the elevation.

## 7. Motion

- **Default transition:** `120ms ease` on color, border, background, opacity.
- **No bouncy springs.** No hover scale. No box-shadow blur.
- **Reduced motion:** `prefers-reduced-motion: reduce` → all transitions → 0.01ms.
- **Loading states:** Sharp pulse (border-color flicker), not spinner. Or text "Loading…" in mono.

## 8. Don'ts

- ❌ No rounded corners (the `--radius: 0` is sacred)
- ❌ No drop shadows except on dropdowns/menus
- ❌ No gradients on UI surfaces (only the hero card)
- ❌ No emoji as icons in UI (only the brand glyph and provider avatars)
- ❌ No "card shadow" elevation
- ❌ No pillowy buttons
- ❌ No marketing language in copy ("supercharge your workflow")

## 9. Reference Files

- `docs/design-ref/hbe-sidepanel.css` — full Hermes CSS (~1,700 lines). Read this for the canonical pattern.
- `docs/design-ref/hbe-sidepanel.html` — semantic HTML structure for inspiration.
- `docs/design-ref/img/` — ray-field.svg (ambient texture), badge.webp (sample visual).
- `frontend/public/assets/fonts/` — Sigurd Variable, Collapse (3 weights), Courier Prime, JetBrains Mono (3 weights). Already installed.

## 10. Done Criteria

- [ ] All 4 themes functional and switchable via Settings
- [ ] Fuel gauge needle animates on value change
- [ ] Scanline texture visible but subtle
- [ ] Connection pills color-coded correctly
- [ ] Theme persists across page reload
- [ ] `prefers-reduced-motion` disables all transitions
- [ ] All 124 backend tests still pass
- [ ] Frontend tsc clean, build succeeds
- [ ] No `border-radius` greater than 0 anywhere in CSS

---

Ship something you'd want to look at every day.