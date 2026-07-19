# Scraper engine tests

Exercises `usage-scraper.js` against synthetic usage panels — the parts
that can be verified without a logged-in session on each provider's site.

Covers: percentage rows with section headings, ratio/credit rows, reset
parsing (relative, weekday, calendar date), "N% remaining" inversion,
duplicate collapsing, and the negative case (an unrelated page must
yield zero windows, never a fabricated one).

```bash
npm install jsdom --no-save
node extension/test/scraper-test.mjs
```

Note this validates the **extraction engine**, not the per-site configs —
those depend on each provider's live DOM, which can only be confirmed by
loading the extension and visiting the real usage page (watch the popup).
