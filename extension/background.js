/**
 * Background service worker — receives data from content scripts,
 * stores in chrome.storage, and forwards to Token Tank backend.
 */

const TOKEN_TANK_BASE = 'http://localhost:8000/api/v1';

const PROVIDER_MAP = {
    CLAUDE_USAGE: 'claude_web',
    CHATGPT_USAGE: 'chatgpt_web',
};

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLAUDE_USAGE' || message.type === 'CHATGPT_USAGE') {
        const provider = PROVIDER_MAP[message.type];

        chrome.storage.local.get([provider], (result) => {
            const history = result[provider] || [];
            history.push(message.payload);
            if (history.length > 1000) history.shift();
            chrome.storage.local.set({ [provider]: history });
        });

        fetch(`${TOKEN_TANK_BASE}/extension/usage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider,
                data: message.payload,
                timestamp: message.payload.timestamp,
            }),
        }).catch(() => {
            // Backend may not be running; data is still in chrome.storage
        });

        sendResponse({ status: 'captured' });
        return true;
    }

    if (message.type === 'CLAUDE_QUOTA') {
        fetch(`${TOKEN_TANK_BASE}/extension/quota`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'claude_web',
                windows: message.payload.windows,
            }),
        })
            .then((resp) => {
                chrome.storage.local.set({
                    claude_web_quota_sync: {
                        ok: resp.ok,
                        status: resp.status,
                        timestamp: new Date().toISOString(),
                    },
                });
            })
            .catch(() => {
                chrome.storage.local.set({
                    claude_web_quota_sync: {
                        ok: false,
                        status: 0,
                        timestamp: new Date().toISOString(),
                    },
                });
            });

        sendResponse({ status: 'captured' });
        return true;
    }

    return true;
});
