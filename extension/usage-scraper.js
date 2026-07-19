/**
 * Shared usage-panel scraper.
 *
 * None of these providers expose plan usage through a public API, so the
 * numbers have to come off the page you're already looking at. Rather
 * than five divergent scrapers, each site supplies a small config and
 * this engine does the extraction.
 *
 * The engine is text-pattern based on purpose: none of these sites offer
 * stable class names or test-ids for their usage panels, but they all
 * render human-readable strings ("42% used", "1,240 / 5,000 requests",
 * "Resets in 3 hr 12 min"). Text survives restyling far better than
 * selectors do. If a site changes its *wording*, extraction stops and
 * reports zero windows rather than inventing numbers.
 *
 * Exposed as window.TokenTankScraper for the per-site content scripts.
 */

(function() {
    'use strict';

    const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    // ── Reset-time parsing ────────────────────────────────────────
    /** "resets in 4 hr 48 min" / "3 hours 5 minutes" → ISO instant. */
    function parseRelativeReset(text) {
        const m = text.match(
            /resets?\s*(?:in)?\s*(?:(\d+)\s*(?:hr|hour)s?)?[\s,]*(?:(\d+)\s*(?:min|minute)s?)?/i
        );
        if (!m || (!m[1] && !m[2])) return null;
        const hours = parseInt(m[1] || '0', 10);
        const mins = parseInt(m[2] || '0', 10);
        if (hours === 0 && mins === 0) return null;
        return new Date(Date.now() + (hours * 60 + mins) * 60000).toISOString();
    }

    /** "resets Sat 9:00 PM" → next occurrence as an ISO instant. */
    function parseWeekdayReset(text) {
        const m = text.match(/resets?\s+(?:on\s+)?([A-Za-z]{3,9})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!m) return null;
        const dayIdx = WEEKDAYS.indexOf(m[1].slice(0, 3).toLowerCase());
        if (dayIdx === -1) return null;
        let hour = parseInt(m[2], 10) % 12;
        if (/PM/i.test(m[4])) hour += 12;
        const minute = parseInt(m[3], 10);

        const now = new Date();
        const target = new Date(now);
        target.setHours(hour, minute, 0, 0);
        let dayDelta = (dayIdx - now.getDay() + 7) % 7;
        if (dayDelta === 0 && target.getTime() <= now.getTime()) dayDelta = 7;
        target.setDate(target.getDate() + dayDelta);
        return target.toISOString();
    }

    /** "resets on 2026-08-01" / "renews Aug 1, 2026" → ISO instant. */
    function parseDateReset(text) {
        const iso = text.match(/(?:resets?|renews?)[^\d]{0,12}(\d{4}-\d{2}-\d{2})/i);
        if (iso) {
            const d = new Date(`${iso[1]}T00:00:00`);
            if (!isNaN(d.getTime())) return d.toISOString();
        }
        const named = text.match(
            /(?:resets?|renews?)[^A-Za-z]{0,6}([A-Z][a-z]{2,8})\s+(\d{1,2})(?:,?\s*(\d{4}))?/i
        );
        if (named) {
            const year = named[3] ? parseInt(named[3], 10) : new Date().getFullYear();
            const d = new Date(`${named[1]} ${named[2]}, ${year}`);
            if (!isNaN(d.getTime())) return d.toISOString();
        }
        return null;
    }

    function parseResetText(text) {
        if (!text) return null;
        return parseRelativeReset(text) || parseWeekdayReset(text) || parseDateReset(text);
    }

    // ── Number parsing ────────────────────────────────────────────
    const num = (s) => parseFloat(String(s).replace(/,/g, ''));

    /**
     * Recognize a usage measurement in a string. Returns
     * {used, limit, unit} or null. Ordered most-specific first.
     */
    function parseMeasurement(text) {
        // "1,240 / 5,000 requests"  ·  "12 of 50 credits"
        const ratio = text.match(
            /([\d,]+(?:\.\d+)?)\s*(?:\/|of|out of)\s*([\d,]+(?:\.\d+)?)\s*([A-Za-z%]+)?/i
        );
        if (ratio) {
            const used = num(ratio[1]);
            const limit = num(ratio[2]);
            if (!isNaN(used) && !isNaN(limit) && limit > 0) {
                let unit = (ratio[3] || '').toLowerCase();
                if (/req/.test(unit)) unit = 'requests';
                else if (/cred|coin|point/.test(unit)) unit = 'credits';
                else if (/tok/.test(unit)) unit = 'tokens';
                else if (unit === '%') unit = 'percent';
                else unit = unit ? 'credits' : 'requests';
                return { used, limit, unit };
            }
        }

        // "42% used"  ·  "42% of your weekly limit"  ·  "42% remaining"
        const pct = text.match(/(\d{1,3}(?:\.\d+)?)\s*%\s*(used|remaining|left|of)?/i);
        if (pct) {
            const value = parseFloat(pct[1]);
            if (!isNaN(value) && value <= 100) {
                const remaining = /remaining|left/i.test(pct[2] || '');
                return { used: remaining ? 100 - value : value, limit: 100, unit: 'percent' };
            }
        }
        return null;
    }

    // ── DOM helpers ───────────────────────────────────────────────
    const NOISE = /^(learn more|upgrade|manage|billing|see details|view usage|close|back)$/i;

    /** Nearest short, label-like text for a measurement element. */
    function findRowTitle(el, maxDepth = 5) {
        let node = el;
        for (let depth = 0; depth < maxDepth && node; depth++) {
            const container = node.parentElement;
            if (!container) break;
            const candidates = Array.from(container.querySelectorAll('*'))
                .concat([container])
                .map((e) => e.textContent?.trim())
                .filter((t) => t && t.length > 1 && t.length < 44)
                .filter((t) => !parseMeasurement(t))
                .filter((t) => !/resets?|renews?/i.test(t))
                .filter((t) => !NOISE.test(t));
            if (candidates.length > 0) {
                return candidates.sort((a, b) => a.length - b.length)[0];
            }
            node = container;
        }
        return null;
    }

    /** Reset phrase near an element, searching a few ancestors up. */
    function findResetText(el, maxDepth = 4) {
        let scope = el.parentElement;
        for (let depth = 0; depth < maxDepth && scope; depth++) {
            const m = scope.textContent?.match(/(?:resets?|renews?)[^.]{0,44}/i);
            if (m) return m[0];
            scope = scope.parentElement;
        }
        return null;
    }

    function slugify(title, modelSlugs = []) {
        for (const [pattern, slug] of modelSlugs) {
            if (pattern.test(title)) return slug;
        }
        return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    /**
     * Scrape usage windows from the current page.
     *
     * config:
     *   panelHint    RegExp — page must contain this or we bail (avoids
     *                scraping unrelated pages and posting junk)
     *   sectionHints [[RegExp, windowType]] — headings that switch the
     *                active window type for rows that follow
     *   defaultType  window_type when no section matched
     *   modelSlugs   [[RegExp, slug]] for per-model rows
     *   classify(title, ctx) optional override → {window_type, label}|null
     */
    function scrape(config) {
        // innerText reflects rendered text but is undefined in non-visual
        // DOM implementations (and empty for display:none subtrees);
        // textContent is the reliable fallback.
        const body = document.body;
        const bodyText = (body && (body.innerText || body.textContent)) || '';
        if (config.panelHint && !config.panelHint.test(bodyText)) return [];

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let section = null;
        const rows = [];
        const seen = new Set();

        while (walker.nextNode()) {
            const el = walker.currentNode;
            if (el.children.length > 0) continue; // leaf text only
            const text = el.textContent?.trim();
            if (!text || text.length > 80) continue;

            for (const [pattern, type] of config.sectionHints || []) {
                if (pattern.test(text)) {
                    section = type;
                    break;
                }
            }

            const measurement = parseMeasurement(text);
            if (measurement && !seen.has(el)) {
                seen.add(el);
                rows.push({ el, measurement, section });
            }
        }

        const windows = [];
        for (const row of rows) {
            const title = findRowTitle(row.el) || row.section || config.defaultType || 'usage';
            const resetAt = parseResetText(findResetText(row.el));

            let classified = null;
            if (typeof config.classify === 'function') {
                classified = config.classify(title, { section: row.section, ...row.measurement });
                if (classified === null) continue; // explicit skip
            }

            const windowType =
                classified?.window_type ||
                row.section ||
                (config.modelSlugs?.some(([p]) => p.test(title))
                    ? `model:${slugify(title, config.modelSlugs)}`
                    : config.defaultType || 'weekly');

            windows.push({
                window_type: windowType,
                label: classified?.label || title,
                used: row.measurement.used,
                limit: row.measurement.limit,
                unit: row.measurement.unit,
                reset_at: resetAt,
            });
        }

        // Collapse genuine duplicates only. Keyed on type+label, not type
        // alone: a panel can legitimately show two monthly quotas (e.g. a
        // request allowance and a separate web-search credit pool), and
        // keying on type would silently discard the second.
        const deduped = [];
        const taken = new Set();
        for (const w of windows) {
            const key = `${w.window_type}|${(w.label || '').toLowerCase()}`;
            if (taken.has(key)) continue;
            taken.add(key);
            deduped.push(w);
        }
        return deduped;
    }

    /**
     * Wire a site up: scrape on load, on an interval, and after DOM
     * mutations settle (these are all SPAs). Never sends an empty
     * capture — the backend replaces all extension windows per POST, so
     * an empty payload would wipe the last good reading.
     */
    function install(providerKey, config) {
        function capture() {
            let windows = [];
            try {
                windows = scrape(config);
            } catch (err) {
                windows = [];
            }
            // Record every attempt so the popup can distinguish "never
            // ran here" from "ran but found nothing" — the difference
            // between a wrong page and a broken scraper.
            chrome.storage.local.set({
                [`${providerKey}_last_attempt`]: {
                    timestamp: new Date().toISOString(),
                    found: windows.length,
                    url: location.href,
                },
            });
            if (windows.length === 0) return;

            chrome.storage.local.set({
                [`${providerKey}_quota`]: { windows, timestamp: new Date().toISOString() },
            });
            chrome.runtime
                .sendMessage({
                    type: 'PROVIDER_QUOTA',
                    provider: providerKey,
                    payload: { windows, timestamp: new Date().toISOString() },
                })
                .catch(() => {});
        }

        if (document.readyState === 'complete') capture();
        else window.addEventListener('load', capture);

        setInterval(capture, 60000);

        let debounce = null;
        const observer = new MutationObserver(() => {
            clearTimeout(debounce);
            debounce = setTimeout(capture, 1200);
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    window.TokenTankScraper = { scrape, install, parseResetText, parseMeasurement };
})();
