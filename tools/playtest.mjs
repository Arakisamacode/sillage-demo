// Test de jouabilité déterministe : on fait avancer la vraie simulation (physique du joueur,
// portes, PNJ) à 30 Hz depuis le test, puis on rend une image aux étapes clés.
// Usage : node tools/playtest.mjs [url] [outdir]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const base = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'shots';
fs.mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(base + '?quality=low');
await page.waitForSelector('#start:not(.hidden)', { timeout: 300000 });
await page.evaluate(() => {
  document.getElementById('start').classList.add('hidden');
  const A = window.__app;
  window.__t = 0;
  window.__walk = (sec, mx, my, run = false, yaw = null) => {
    const p = A.player;
    const inp = { move: { x: mx, y: my }, run, consumeLook: () => ({ dx: 0, dy: 0 }) };
    if (yaw !== null) p.yaw = yaw;
    for (let i = 0; i < sec * 30; i++) {
      p.update(1 / 30, inp, A.crowd.agents.filter((a) => !a.attached), A.doors);
      A.simulate(1 / 30, (window.__t += 1 / 30));
    }
    return { x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2) };
  };
  window.__tp = (x, y, z, yaw) => { const p = A.player; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0; };
});
const walk = (s, mx, my, run, yaw) => page.evaluate(([s, mx, my, run, yaw]) => window.__walk(s, mx, my, run, yaw), [s, mx, my, !!run, yaw ?? null]);
const shot = async (n) => { await page.evaluate(() => window.__app.renderer.render(1 / 30)); await page.screenshot({ path: `${out}/play_${n}.png` }); };

console.log('1. marche 4 s vers l\'avant :', await walk(4, 0, 1));
console.log('   course 3 s :', await walk(3, 0, 1, true));
// rampe du Héron, face au vaisseau (vers -z => yaw 0)
const ramp = await page.evaluate(() => { const r = window.__app.ships.heron.interior.rampBottom; return [r.x, r.z]; });
await page.evaluate(([x, z]) => window.__tp(x, 0.05, z + 2, 0), ramp);
console.log('2. montée de la rampe :', await walk(4, 0, 1));
await shot('ship_ramp');
console.log('   dans la soute :', await walk(5, 0, 1));
console.log('   vers le cockpit :', await walk(3, 0, 1));
const it = await page.evaluate(() => { const p = window.__app.player.pos; return window.__app.interactables().map((i) => i.pos.distanceTo(p).toFixed(2)); });
console.log('   distance aux interactions :', it.join(', '));
  console.log('   jusqu\'au cockpit :', await walk(5, 0, 1));
await shot('ship_inside');
await page.evaluate(() => { window.__app.player.sit(window.__app.seat); window.__walk(1, 0, 0); });
await shot('cockpit');
await page.evaluate(() => { window.__app.player.stand(); });
console.log('   ressortir (demi-tour) :', await walk(12, 0, 1, false, Math.PI));
// sas
await page.evaluate(() => window.__tp(-27, 0.05, -2, Math.PI / 2));
console.log('3. sas, porte hangar :', await walk(3, 0, 1), await page.evaluate(() => window.__app.doors.map((d) => d.open.toFixed(2)).join(' ')));
console.log('   dans le sas :', await walk(5, 0, 1), await page.evaluate(() => window.__app.doors.map((d) => d.open.toFixed(2)).join(' ')));
await shot('airlock');
console.log('   galerie :', await walk(6, 0, 1));
await shot('gallery');
await page.evaluate(() => { window.__app.player.thirdPerson = true; });
console.log('4. 3e personne :', await walk(3, 0, 1));
await shot('third_person');
// collision : foncer dans un mur
await page.evaluate(() => window.__tp(25, 0.05, 0, -Math.PI / 2));
console.log('5. contre le mur est :', await walk(5, 0, 1, true));
// escalier vers la passerelle (ouest, monte vers -z)
await page.evaluate(() => window.__tp(-27.55, 0.05, -28.5, 0));
console.log('6. escalier :', await walk(7, 0, 1));
await shot('stairs');
console.log(logs.slice(0, 20).join('\n') || 'aucune erreur');
await browser.close();
