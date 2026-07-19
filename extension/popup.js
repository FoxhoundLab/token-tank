/**
 * Popup — per-provider capture + sync status.
 *
 * The point of this panel is diagnosis: it must make the difference
 * between "you haven't visited the usage page yet", "the scraper ran
 * but found nothing" (wording changed / wrong page) and "captured but
 * the backend is unreachable" immediately obvious, rather than leaving
 * you to infer it from stale numbers on the dashboard.
 */

(function() {
    'use strict';

    const PROVIDERS = [
        { key: 'claude_web', name: 'Claude Max', hint: 'claude.ai → Settings → Usage' },
        { key: 'grok_web', name: 'Grok', hint: 'grok.com or console.x.ai → account/usage' },
        { key: 'zai_web', name: 'Z.AI GLM', hint: 'z.ai → console → usage' },
        { key: 'minimax_web', name: 'MiniMax', hint: 'minimax.io → console → usage' },
        { key: 'ollama_web', name: 'Ollama Pro', hint: 'ollama.com → settings' },
    ];

    function render(provider, state) {
        const { quota, sync, attempt } = state;
        const row = document.createElement('div');
        row.className = 'status';

        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = provider.name;
        row.appendChild(label);

        const value = document.createElement('div');
        value.className = 'value';

        if (quota && quota.windows && quota.windows.length > 0) {
            const lines = quota.windows
                .map((w) => {
                    const unit = w.unit === 'percent' ? '%' : ` ${w.unit}`;
                    const amount =
                        w.unit === 'percent'
                            ? `${Math.round(w.used)}%`
                            : `${w.used}/${w.limit}${unit}`;
                    return `${w.label || w.window_type}: ${amount}`;
                })
                .join(' · ');
            value.textContent = lines;
            value.classList.add('ok');

            const note = document.createElement('div');
            note.className = 'note';
            const captured = new Date(quota.timestamp).toLocaleTimeString();
            if (sync && sync.ok) {
                note.textContent = `captured ${captured} · synced ✓`;
            } else if (sync) {
                const why = sync.detail || (sync.status ? `HTTP ${sync.status}` : 'backend unreachable');
                note.textContent = `captured ${captured} · SYNC FAILED — ${why}`;
                note.classList.add('warn');
            } else {
                note.textContent = `captured ${captured} · not yet synced (reload the extension, then revisit this page)`;
            }
            row.appendChild(value);
            row.appendChild(note);
        } else if (attempt) {
            value.textContent = 'Ran, but found no usage panel';
            value.classList.add('warn');
            const note = document.createElement('div');
            note.className = 'note warn';
            note.textContent = `last tried ${new Date(attempt.timestamp).toLocaleTimeString()} — open ${provider.hint}`;
            row.appendChild(value);
            row.appendChild(note);
        } else {
            value.textContent = 'No data yet';
            value.classList.add('idle');
            const note = document.createElement('div');
            note.className = 'note';
            note.textContent = `visit ${provider.hint}`;
            row.appendChild(value);
            row.appendChild(note);
        }

        return row;
    }

    /**
     * SYNC NOW — POST every stored capture straight from the popup.
     * The popup page shares the extension's host permissions but not the
     * service worker's lifecycle, so this works even if the worker is
     * being torn down mid-fetch — and any failure is reported right
     * here with the actual reason instead of vanishing.
     */
    const BACKEND = 'http://localhost:8080/api/v1';

    async function syncNow() {
        const result = document.getElementById('sync-now-result');
        result.textContent = 'syncing…';
        result.className = 'note';

        const keys = PROVIDERS.map((p) => `${p.key}_quota`);
        const stored = await new Promise((r) => chrome.storage.local.get(keys, r));
        const outcomes = [];

        for (const provider of PROVIDERS) {
            const capture = stored[`${provider.key}_quota`];
            if (!capture || !capture.windows || capture.windows.length === 0) continue;
            try {
                const resp = await fetch(`${BACKEND}/extension/quota`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider: provider.key, windows: capture.windows }),
                });
                let detail = null;
                if (!resp.ok) {
                    try { detail = (await resp.json())?.detail ?? null; } catch { /* keep null */ }
                }
                await new Promise((r) => chrome.storage.local.set({
                    [`${provider.key}_sync`]: {
                        ok: resp.ok,
                        status: resp.status,
                        detail,
                        windows: capture.windows.length,
                        timestamp: new Date().toISOString(),
                    },
                }, r));
                outcomes.push(`${provider.name}: ${resp.ok ? '✓' : detail || `HTTP ${resp.status}`}`);
            } catch (err) {
                outcomes.push(`${provider.name}: ${err && err.message ? err.message : err}`);
            }
        }

        if (outcomes.length === 0) {
            result.textContent = 'nothing captured yet — visit a usage page first';
            result.className = 'note warn';
        } else {
            result.textContent = outcomes.join(' · ');
            result.className = outcomes.every((o) => o.endsWith('✓')) ? 'note' : 'note warn';
            refresh();
        }
    }

    const container = document.getElementById('providers');
    const keys = PROVIDERS.flatMap((p) => [
        `${p.key}_quota`,
        `${p.key}_sync`,
        `${p.key}_last_attempt`,
    ]);

    function refresh() {
        chrome.storage.local.get(keys, (result) => {
            if (!container) return;
            container.innerHTML = '';
            for (const provider of PROVIDERS) {
                container.appendChild(
                    render(provider, {
                        quota: result[`${provider.key}_quota`],
                        sync: result[`${provider.key}_sync`],
                        attempt: result[`${provider.key}_last_attempt`],
                    }),
                );
            }
        });
    }

    refresh();
    document.getElementById('sync-now')?.addEventListener('click', syncNow);
})();
