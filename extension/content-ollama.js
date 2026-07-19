/**
 * Ollama Pro (ollama.com) usage scraper.
 *
 * The Pro plan shows cloud inference allowances on the account/settings
 * pages. Ollama's local server is separate and already tracked by the
 * proxy — this only covers the hosted Pro quota.
 */

(function() {
    'use strict';
    if (!window.TokenTankScraper) return;

    window.TokenTankScraper.install('ollama_web', {
        panelHint: /usage|limit|quota|plan|pro|subscription/i,
        sectionHints: [
            [/hourly|rolling|per hour/i, '5h'],
            [/daily|per day|today/i, '5h'],
            [/weekly|per week/i, 'weekly'],
            [/monthly|per month|billing (?:period|cycle)/i, 'monthly'],
        ],
        defaultType: 'monthly',
        modelSlugs: [],
    });
})();
