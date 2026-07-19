/**
 * Grok (x.ai / grok.com) usage scraper.
 *
 * SuperGrok / Grok subscriptions show request quotas on the account or
 * settings pages. Config is intentionally broad — the panel wording
 * hasn't been verified against a live logged-in page, so it accepts any
 * usage-shaped measurement and reports what it finds via the popup
 * rather than guessing at a structure it can't see.
 */

(function() {
    'use strict';
    if (!window.TokenTankScraper) return;

    window.TokenTankScraper.install('grok_web', {
        panelHint: /usage|limit|quota|subscription|plan/i,
        sectionHints: [
            [/(?:2|two)[\s-]?hour|rolling window/i, '5h'],
            [/weekly|per week|7[\s-]?day/i, 'weekly'],
            [/monthly|per month|billing (?:period|cycle)/i, 'monthly'],
        ],
        defaultType: 'weekly',
        modelSlugs: [
            [/grok[\s-]?4[\s-]?heavy/i, 'grok-4-heavy'],
            [/grok[\s-]?4/i, 'grok-4'],
            [/grok[\s-]?3/i, 'grok-3'],
        ],
    });
})();
