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

    showLatest('claude_web', 'claude-status');
    showLatest('chatgpt_web', 'chatgpt-status');
})();
