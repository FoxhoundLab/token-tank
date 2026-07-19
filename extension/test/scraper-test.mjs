// Exercise the shared scraper engine against synthetic usage panels.
import { JSDOM } from 'jsdom';
import fs from 'fs';

const src = fs.readFileSync(new URL('../usage-scraper.js', import.meta.url), 'utf8');

function run(html, config, label) {
  const dom = new JSDOM(`<body>${html}</body>`, { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.NodeFilter = dom.window.NodeFilter;
  global.chrome = { storage: { local: { set(){} } }, runtime: { sendMessage: () => Promise.resolve() } };
  new Function(src).call(dom.window);
  const out = dom.window.TokenTankScraper.scrape(config);
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(out, null, 1));
  return out;
}

// Grok-ish panel: percentage rows under section headings
run(`
 <h2>Usage</h2>
 <div><div>Grok 4</div><div>37% used</div><div>Resets in 2 hr 15 min</div></div>
 <h3>Weekly limits</h3>
 <div><div>All models</div><div>12% used</div><div>Resets Sat 9:00 PM</div></div>
`, {
  panelHint: /usage|limit/i,
  sectionHints: [[/weekly/i, 'weekly']],
  defaultType: 'weekly',
  modelSlugs: [[/grok[\s-]?4/i, 'grok-4']],
}, 'Grok-style percentage panel');

// Ratio/credits panel (MiniMax/Ollama shape)
run(`
 <h2>Plan usage</h2>
 <div><div>Monthly requests</div><div>1,240 / 5,000 requests</div><div>Renews Aug 1, 2026</div></div>
 <div><div>Web Search</div><div>350 of 1000 credits</div></div>
`, {
  panelHint: /usage|plan/i,
  sectionHints: [[/monthly/i, 'monthly']],
  defaultType: 'monthly',
  modelSlugs: [],
}, 'Ratio + credits panel');

// Negative: unrelated page must yield nothing
run(`<div><p>Welcome back</p><p>Start a new chat</p></div>`, {
  panelHint: /usage|limit|quota/i,
  sectionHints: [],
  defaultType: 'weekly',
}, 'Unrelated page (should be empty)');

// "remaining" inversion
run(`<h2>Quota</h2><div><div>Session</div><div>80% remaining</div></div>`, {
  panelHint: /quota/i, sectionHints: [], defaultType: '5h',
}, 'Remaining-style (80% remaining -> 20 used)');
