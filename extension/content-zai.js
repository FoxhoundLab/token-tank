/**
 * Z.AI (z.ai / bigmodel.cn) usage scraper.
 *
 * The GLM coding plan shows prompt/request allowances and a monthly web
 * search + reader quota. Both English and the zh-CN wording are matched,
 * since the console localizes.
 */

(function() {
    'use strict';
    if (!window.TokenTankScraper) return;

    window.TokenTankScraper.install('zai_web', {
        panelHint: /usage|limit|quota|plan|用量|额度|套餐/i,
        sectionHints: [
            [/(?:5|five)[\s-]?hour|rolling|当前会话/i, '5h'],
            [/weekly|per week|每周/i, 'weekly'],
            [/monthly|per month|每月|web search|reader/i, 'monthly'],
        ],
        defaultType: 'weekly',
        modelSlugs: [
            [/glm[\s-]?5\.2/i, 'glm-5-2'],
            [/glm[\s-]?5/i, 'glm-5'],
            [/glm[\s-]?4/i, 'glm-4'],
        ],
    });
})();
