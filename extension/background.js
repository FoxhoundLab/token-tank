/**
 * Background service worker — receives data from content scripts,
 * stores in chrome.storage, and forwards to Token Tank backend.
 *
 * MV3 lifecycle note: the worker can be terminated as soon as a message
 * listener responds. Any fetch still in flight dies with it. So every
 * handler here *awaits* its network call and only then calls
 * sendResponse — keeping the message channel (and the worker) alive for
 * the duration. Responding early is what silently loses syncs.
 */

// Default backend port is 8000, but port 8000 is often already taken by
// other local projects — Token Tank's launch config in this environment
// runs it on 8080. Edit this if you run Token Tank on a different port.
const TOKEN_TANK_BASE = 'http://localhost:8080/api/v1';

const USAGE_PROVIDER = {
    CLAUDE_USAGE: 'claude_web',
    CHATGPT_USAGE: 'chatgpt_web',
};

function setLocal(items) {
    return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

function getLocal(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

/** POST scraped quota windows; record the outcome for the popup. */
async function syncQuota(providerKey, windows) {
    const stamp = new Date().toISOString();
    try {
        const resp = await fetch(`${TOKEN_TANK_BASE}/extension/quota`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: providerKey, windows }),
        });
        let detail = null;
        if (!resp.ok) {
            // Surface the backend's own explanation (unknown provider,
            // provider not configured, validation error) rather than a
            // bare status code — it's usually the actual fix.
            try {
                const body = await resp.json();
                detail = body?.detail ?? null;
            } catch {
                detail = null;
            }
        }
        await setLocal({
            [`${providerKey}_sync`]: {
                ok: resp.ok,
                status: resp.status,
                detail,
                windows: windows.length,
                timestamp: stamp,
            },
        });
    } catch (err) {
        await setLocal({
            [`${providerKey}_sync`]: {
                ok: false,
                status: 0,
                detail: String(err && err.message ? err.message : err),
                windows: windows.length,
                timestamp: stamp,
            },
        });
    }
}

/** Legacy rate-limit heuristic capture (claude.ai chat, chatgpt.com). */
async function recordUsage(provider, payload) {
    const result = await getLocal([provider]);
    const history = result[provider] || [];
    history.push(payload);
    if (history.length > 1000) history.shift();
    await setLocal({ [provider]: history });

    try {
        await fetch(`${TOKEN_TANK_BASE}/extension/usage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider,
                data: payload,
                timestamp: payload.timestamp,
            }),
        });
    } catch {
        // Backend may not be running; data is still in chrome.storage
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLAUDE_USAGE' || message.type === 'CHATGPT_USAGE') {
        recordUsage(USAGE_PROVIDER[message.type], message.payload).then(
            () => sendResponse({ status: 'captured' }),
            (err) => sendResponse({ status: 'error', error: String(err) }),
        );
        return true; // keep the channel open until the work finishes
    }

    // Claude's dedicated plan-limits scraper
    if (message.type === 'CLAUDE_QUOTA') {
        syncQuota('claude_web', message.payload.windows).then(
            () => sendResponse({ status: 'synced' }),
            (err) => sendResponse({ status: 'error', error: String(err) }),
        );
        return true;
    }

    // Generic scraper (Grok, Z.AI, MiniMax, Ollama Pro)
    if (message.type === 'PROVIDER_QUOTA' && message.provider) {
        syncQuota(message.provider, message.payload.windows).then(
            () => sendResponse({ status: 'synced' }),
            (err) => sendResponse({ status: 'error', error: String(err) }),
        );
        return true;
    }

    return false;
});
