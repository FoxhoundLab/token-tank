/**
 * Background service worker — receives data from content scripts,
 * stores in chrome.storage, and forwards to Token Tank backend.
 */

const TOKEN_TANK_URL = 'http://localhost:8000/api/v1/extension/usage';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLAUDE_USAGE' || message.type === 'CHATGPT_USAGE') {
        const provider = message.type === 'CLAUDE_USAGE' ? 'claude_web' : 'chatgpt_web';

        // Store in chrome.storage
        chrome.storage.local.get([provider], (result) => {
            const history = result[provider] || [];
            history.push(message.payload);
            // Keep last 1000 entries
            if (history.length > 1000) history.shift();
            chrome.storage.local.set({ [provider]: history });
        });

        // Forward to Token Tank backend (fire and forget)
        fetch(TOKEN_TANK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: provider,
                data: message.payload,
                timestamp: message.payload.timestamp,
            }),
        }).catch(() => {
            // Backend may not be running; data is still in chrome.storage
        });

        sendResponse({ status: 'captured' });
    }
    return true;
});
