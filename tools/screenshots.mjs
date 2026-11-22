// Captures d'écran automatiques pour la revue artistique.
// Usage : node tools/screenshots.mjs [url-base] [shot1,shot2,...] [quality] [outdir]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
import fs from 'fs';

const base = process.argv[2] || 'http://localhost:5173/';
const shots = (process.argv[3] || 'overview').split(',');
const quality = process.argv[4] || 'high';
const out = process.argv[5] || 'shots';
const w = +(process.env.W || 1280), h = +(process.env.H || 720);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
for (const s of shots) {
  const t0 = Date.now();
  await page.goto(`${base}?shot=${s}&quality=${quality}${process.env.EXTRA || ''}`);
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 400000, polling: 500 });
  } catch (e) { console.log('timeout', s); }
  await page.screenshot({ path: `${out}/${s}.png`, timeout: 300000 });
  console.log(`${s}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
const uniq = [...new Set(logs)].filter((l) => !l.includes('GPU stall') && !l.includes('[verbose]'));
if (uniq.length) console.log(uniq.slice(0, 40).join('\n'));
await browser.close();
