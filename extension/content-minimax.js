/**
 * MiniMax (minimax.io / minimax.chat) usage scraper.
 *
 * The MiniMax platform console shows plan allowances and remaining
 * credits. Localized wording (zh-CN) is matched alongside English.
 */

(function() {
    'use strict';
    if (!window.TokenTankScraper) return;

    window.TokenTankScraper.install('minimax_web', {
        panelHint: /usage|limit|quota|plan|balance|credit|用量|额度|套餐/i,
        sectionHints: [
            [/(?:5|five)[\s-]?hour|rolling|当前会话/i, '5h'],
            [/weekly|per week|每周/i, 'weekly'],
            [/monthly|per month|billing (?:period|cycle)|每月/i, 'monthly'],
        ],
        defaultType: 'monthly',
        modelSlugs: [
            [/abab\s?6\.5s/i, 'abab6-5s'],
            [/abab\s?6\.5/i, 'abab6-5'],
            [/m2|minimax[\s-]?m\d/i, 'minimax-m'],
        ],
    });
})();
