/**
 * Content script for chatgpt.com — captures GPT-4 usage limits.
 *
 * ChatGPT shows rate limit messages when the user hits GPT-4 caps.
 * This scrapes those messages and reports them to the Token Tank backend.
 */

(function() {
    'use strict';

    function extractUsage() {
        const data = {
            timestamp: new Date().toISOString(),
            model: null,
            rate_limited: false,
            limit_message: null,
            upgrade_prompt: false,
        };

        const allText = document.body.innerText || '';

        // Match GPT-4 rate limit patterns
        const limitPatterns = [
            /You'?ve reached (?:the )?GPT-?4 (?:limit|cap)/i,
            /Too many requests in \d+ (?:hour|minute)/i,
            /(?:limit|cap) reached/i,
        ];

        for (const pattern of limitPatterns) {
            const match = allText.match(pattern);
            if (match) {
                data.rate_limited = true;
                data.limit_message = match[0];
                break;
            }
        }

        // Detect which model is active
        const modelIndicator = document.querySelector('[data-testid="model-switcher-button"], button[aria-label*="model"]');
        if (modelIndicator) {
            data.model = modelIndicator.textContent?.trim() || null;
        }

        // Detect upgrade prompts (sign that user is near limits)
        if (/upgrade to plus|upgrade for more/i.test(allText)) {
            data.upgrade_prompt = true;
        }

        chrome.runtime.sendMessage({
            type: 'CHATGPT_USAGE',
            payload: data,
        }).catch(() => {});
    }

    if (document.readyState === 'complete') {
        extractUsage();
    } else {
        window.addEventListener('load', extractUsage);
    }

    setInterval(extractUsage, 60000);
})();
