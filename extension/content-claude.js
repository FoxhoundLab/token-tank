/**
 * Content script for claude.ai — captures subscription usage caps.
 *
 * Claude.ai doesn't expose usage caps via API. This scrapes the DOM
 * for rate limit messages, message counts, and quota indicators.
 */

(function() {
    'use strict';

    function extractUsage() {
        const data = {
            timestamp: new Date().toISOString(),
            message_count: null,
            rate_limited: false,
            limit_message: null,
        };

        // Look for rate limit / quota messages in the DOM
        const allText = document.body.innerText || '';

        // Match patterns like "You've reached your limit" or "resets in X hours"
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

        // Count conversation messages (rough estimate)
        const messageElements = document.querySelectorAll('[data-testid*="message"], .font-user-message');
        data.message_count = messageElements.length;

        // Send to background script
        chrome.runtime.sendMessage({
            type: 'CLAUDE_USAGE',
            payload: data,
        }).catch(() => {
            // Background script may not be ready; ignore
        });
    }

    // Run once on load
    if (document.readyState === 'complete') {
        extractUsage();
    } else {
        window.addEventListener('load', extractUsage);
    }

    // Re-run periodically (Claude UI changes without page reload)
    setInterval(extractUsage, 60000); // every 60 seconds
})();
