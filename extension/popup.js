/**
 * Popup script — shows latest captured subscription data.
 */

(function() {
    'use strict';

    function showLatest(provider, elementId) {
        chrome.storage.local.get([provider], (result) => {
            const history = result[provider] || [];
            const latest = history[history.length - 1];
            const el = document.getElementById(elementId);
            if (!el) return;

            if (!latest) {
                el.textContent = 'No data yet — visit claude.ai or chatgpt.com';
                return;
            }

            if (latest.rate_limited) {
                el.textContent = '⚠️ RATE LIMITED: ' + (latest.limit_message || 'unknown');
            } else if (latest.upgrade_prompt) {
                el.textContent = '⚡ Near limit (upgrade prompt shown)';
            } else {
                const ts = new Date(latest.timestamp);
                el.textContent = '✓ OK · ' + ts.toLocaleTimeString();
            }
        });
    }

    function showQuota() {
        chrome.storage.local.get(['claude_web_quota', 'claude_web_quota_sync'], (result) => {
            const el = document.getElementById('claude-quota');
            if (!el) return;
            const capture = result.claude_web_quota;
            const sync = result.claude_web_quota_sync;

            if (!capture || !capture.windows || capture.windows.length === 0) {
                el.textContent = 'No plan-limits panel captured yet — open claude.ai → Settings → Usage while signed in.';
                return;
            }

            const ts = new Date(capture.timestamp).toLocaleTimeString();
            const lines = capture.windows.map((w) => `${w.label ?? w.window_type}: ${w.used}% used`);
            const syncNote = sync
                ? sync.ok
                    ? 'synced ✓'
                    : `sync failed (${sync.status || 'offline'}) — is Token Tank running?`
                : 'not yet synced';

            el.textContent = `${lines.join(' · ')}  (captured ${ts}, ${syncNote})`;
        });
    }

    showLatest('claude_web', 'claude-status');
    showLatest('chatgpt_web', 'chatgpt-status');
    showQuota();
})();
