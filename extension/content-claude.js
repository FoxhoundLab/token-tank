/**
 * Content script for claude.ai — captures subscription usage caps.
 *
 * Claude.ai doesn't expose usage caps via any public API — the numbers
 * on the account's "Plan usage limits" panel (Settings → Usage) are an
 * internal surface the web app renders for itself. This script scrapes
 * that panel's DOM while you're signed in and posts the real
 * session/weekly percentages to Token Tank.
 *
 * DOM scraping is inherently fragile — Anthropic can restyle the panel
 * at any time. The extraction below is written to survive that as long
 * as possible: it doesn't depend on class names or test-ids (Claude's
 * web app doesn't expose stable ones for this panel), only on the
 * panel's *text content* ("X% used", "Resets in …", "Resets <day> …",
 * "Weekly limits"). If Anthropic changes the wording, extraction stops
 * silently rather than sending garbage — see extractQuotaWindows().
 */

(function() {
    'use strict';

    // ── Legacy rate-limit heuristics (chat page) ──────────────────
    function extractUsage() {
        const data = {
            timestamp: new Date().toISOString(),
            message_count: null,
            rate_limited: false,
            limit_message: null,
        };

        const allText = document.body.innerText || '';
        const limitPatterns = [
            /(?:reached|hit|exceeded).{0,40}(?:limit|quota|cap)/i,
            /(?:resets?|available).{0,30}(?:in|at)\s+\d+\s*(?:hour|minute|second)/i,
        ];
        for (const pattern of limitPatterns) {
            const match = allText.match(pattern);
            if (match) {
                data.rate_limited = true;
                data.limit_message = match[0];
                break;
            }
        }

        const messageElements = document.querySelectorAll('[data-testid*="message"], .font-user-message');
        data.message_count = messageElements.length;

        chrome.runtime.sendMessage({ type: 'CLAUDE_USAGE', payload: data }).catch(() => {});
    }

    // ── Plan usage limits panel scraper ───────────────────────────
    // Row title → canonical QuotaWindow.window_type / label. Extend
    // this map if Anthropic's short model names differ from what's
    // seen here — everything else in the pipeline keys off the string
    // produced here, so this is the one map to edit.
    const MODEL_SLUGS = [
        [/fable/i, 'fable-5'],
        [/opus/i, 'opus-4-8'],
        [/sonnet/i, 'sonnet'],
        [/haiku/i, 'haiku'],
    ];

    const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    function slugify(title) {
        for (const [pattern, slug] of MODEL_SLUGS) {
            if (pattern.test(title)) return slug;
        }
        return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    /** "Resets in 4 hr 48 min" → ISO instant. */
    function parseRelativeReset(text) {
        const m = text.match(/resets?\s+in\s+(?:(\d+)\s*hr)?\D*(?:(\d+)\s*min)?/i);
        if (!m || (!m[1] && !m[2])) return null;
        const hours = parseInt(m[1] || '0', 10);
        const mins = parseInt(m[2] || '0', 10);
        if (hours === 0 && mins === 0) return null;
        return new Date(Date.now() + (hours * 60 + mins) * 60000).toISOString();
    }

    /** "Resets Sat 9:00 PM" → next occurrence, as an ISO instant. */
    function parseWeekdayReset(text) {
        const m = text.match(/resets?\s+([A-Za-z]{3,9})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
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

    function parseResetText(text) {
        return parseRelativeReset(text) || parseWeekdayReset(text);
    }

    /** Best-effort "row title" — the short label above/near a %-used
        line, excluding the reset/percent text itself. */
    function findRowTitle(pctEl) {
        let node = pctEl;
        for (let depth = 0; depth < 5 && node; depth++) {
            const container = node.parentElement;
            if (!container) break;
            const candidates = Array.from(container.querySelectorAll('*'))
                .concat([container])
                .map((el) => el.textContent?.trim())
                .filter((t) => t && t.length > 0 && t.length < 40)
                .filter((t) => !/%\s*used/i.test(t))
                .filter((t) => !/resets?\b/i.test(t))
                .filter((t) => !/learn more/i.test(t));
            if (candidates.length > 0) {
                // Shortest candidate is usually the label itself, not a
                // wrapper that also swallowed the label's own text.
                return candidates.sort((a, b) => a.length - b.length)[0];
            }
            node = container;
        }
        return null;
    }

    /** True if `text` (a heading-like string) marks the weekly section. */
    function isWeeklyHeading(text) {
        return /weekly limits/i.test(text);
    }

    function extractQuotaWindows() {
        const bodyText = document.body.innerText || '';
        if (!/plan usage limits/i.test(bodyText)) return []; // panel not on screen

        // Walk the document once, recording headings and %-used rows in
        // DOM order so each row can be attributed to the nearest
        // preceding "Weekly limits" heading (or none, for the session row).
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let underWeekly = false;
        const rows = [];
        const seenPct = new Set();

        while (walker.nextNode()) {
            const el = walker.currentNode;
            // Only look at leaf-ish text to avoid re-processing the same
            // heading/row dozens of times as the walker descends.
            if (el.children.length > 0) continue;
            const text = el.textContent?.trim();
            if (!text) continue;

            if (isWeeklyHeading(text)) {
                underWeekly = true;
                continue;
            }

            const pctMatch = text.match(/^(\d{1,3})%\s*used$/i);
            if (pctMatch) {
                if (seenPct.has(el)) continue;
                seenPct.add(el);
                rows.push({ el, pct: parseInt(pctMatch[1], 10), underWeekly });
            }
        }

        const windows = [];
        for (const row of rows) {
            const title = findRowTitle(row.el);
            if (!title) continue;

            // Reset text usually lives in the same row container as the
            // title — search a small ancestor scope for it.
            let resetText = null;
            let scope = row.el.parentElement;
            for (let depth = 0; depth < 4 && scope && !resetText; depth++) {
                const m = scope.textContent?.match(/resets?[^.]{0,40}/i);
                if (m) resetText = m[0];
                scope = scope.parentElement;
            }
            const resetAt = resetText ? parseResetText(resetText) : null;

            let windowType;
            let label;
            const lower = title.toLowerCase();
            if (/current session/.test(lower) || (!row.underWeekly && /session/.test(lower))) {
                windowType = '5h';
                label = '5h Session';
            } else if (row.underWeekly && /all models/.test(lower)) {
                windowType = 'weekly';
                label = 'Weekly · All models';
            } else if (row.underWeekly) {
                windowType = `model:${slugify(title)}`;
                label = title;
            } else {
                // No section context at all — fall back to keyword match
                // so a restyled panel with just one section still works.
                windowType = /weekly/.test(lower) ? 'weekly' : `model:${slugify(title)}`;
                label = title;
            }

            windows.push({
                window_type: windowType,
                label,
                used: row.pct,
                limit: 100,
                unit: 'percent',
                reset_at: resetAt,
            });
        }
        return windows;
    }

    function captureQuota() {
        const windows = extractQuotaWindows();
        // Record every attempt so the popup can distinguish "never ran
        // here" from "ran but found nothing" — a wrong page vs a broken
        // scraper.
        chrome.storage.local.set({
            claude_web_last_attempt: {
                timestamp: new Date().toISOString(),
                found: windows.length,
                url: location.href,
            },
        });
        // Never send an empty capture — the backend replaces all
        // extension-sourced windows for this provider on every POST, so
        // an empty payload (scraped on a page without the panel) would
        // silently wipe the last good reading instead of just skipping.
        if (windows.length === 0) return;

        chrome.storage.local.set({
            claude_web_quota: { windows, timestamp: new Date().toISOString() },
        });
        chrome.runtime.sendMessage({
            type: 'CLAUDE_QUOTA',
            payload: { windows, timestamp: new Date().toISOString() },
        }).catch(() => {});
    }

    function runAll() {
        extractUsage();
        captureQuota();
    }

    if (document.readyState === 'complete') {
        runAll();
    } else {
        window.addEventListener('load', runAll);
    }

    setInterval(runAll, 60000);

    // claude.ai is a single-page app — the usage panel mounts/unmounts
    // without a navigation event, so also watch for DOM changes and
    // re-scan shortly after things settle (debounced).
    let debounce = null;
    const observer = new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(captureQuota, 1200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
