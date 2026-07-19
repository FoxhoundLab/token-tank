/**
 * Background service worker — receives data from content scripts,
 * stores in chrome.storage, and forwards to Token Tank backend.
 */

// Default backend port is 8000, but port 8000 is often already taken by
// other local projects — Token Tank's launch config in this environment
// runs it on 8080. Edit this if you run Token Tank on a different port.
const TOKEN_TANK_BASE = 'http://localhost:8080/api/v1';

const USAGE_PROVIDER = {
    CLAUDE_USAGE: 'claude_web',
    CHATGPT_USAGE: 'chatgpt_web',
};

/** POST scraped quota windows; record sync outcome for the popup. */
function syncQuota(providerKey, windows) {
    fetch(`${TOKEN_TANK_BASE}/extension/quota`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerKey, windows }),
    })
        .then((resp) => {
            chrome.storage.local.set({
                [`${providerKey}_sync`]: {
                    ok: resp.ok,
                    status: resp.status,
                    windows: windows.length,
                    timestamp: new Date().toISOString(),
                },
            });
        })
        .catch(() => {
            chrome.storage.local.set({
                [`${providerKey}_sync`]: {
                    ok: false,
                    status: 0,
                    windows: windows.length,
                    timestamp: new Date().toISOString(),
                },
            });
        });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Legacy rate-limit heuristic captures (claude.ai chat, chatgpt.com)
    if (message.type === 'CLAUDE_USAGE' || message.type === 'CHATGPT_USAGE') {
        const provider = USAGE_PROVIDER[message.type];

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

    // Claude's dedicated plan-limits scraper
    if (message.type === 'CLAUDE_QUOTA') {
        syncQuota('claude_web', message.payload.windows);
        sendResponse({ status: 'captured' });
        return true;
    }

    // Generic scraper (Grok, Z.AI, MiniMax, Ollama Pro)
    if (message.type === 'PROVIDER_QUOTA' && message.provider) {
        syncQuota(message.provider, message.payload.windows);
        sendResponse({ status: 'captured' });
        return true;
    }

    return true;
});
