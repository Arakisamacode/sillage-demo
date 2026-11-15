// Mesure : coût CPU de la simulation (IA, véhicules, animation) et appels de rendu par niveau de qualité.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const base = process.argv[2] || 'http://localhost:5173/';
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const q of (process.argv[3] || 'low,high').split(',')) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(base + '?quality=' + q);
  await page.waitForSelector('#start:not(.hidden)', { timeout: 300000 });
  const r = await page.evaluate(() => {
    const A = window.__app;
    document.getElementById('start').classList.add('hidden');
    let t = 0;
    for (let i = 0; i < 60; i++) A.simulate(1 / 30, (t += 1 / 30));
    const t0 = performance.now();
    for (let i = 0; i < 150; i++) A.simulate(1 / 30, (t += 1 / 30));
    const sim = (performance.now() - t0) / 150;
    const info = A.renderer.three.info; info.autoReset = false; info.reset();
    A.camera.position.set(6, 1.7, 26); A.camera.lookAt(-4, 4, -40);
    A.renderer.render(1 / 30);
    const tris = info.render.triangles, calls = info.render.calls;
    info.reset();
    A.camera.position.set(-46, 1.7, -3); A.camera.lookAt(-80, 1.2, -7);
    A.renderer.render(1 / 30);
    return { sim: sim.toFixed(2) + ' ms', agents: A.crowd.agents.length, hangar: { calls, tris }, gallery: { calls: info.render.calls, tris: info.render.triangles }, geos: info.memory.geometries, tex: info.memory.textures, programs: info.programs.length };
  });
  console.log(q, JSON.stringify(r));
  await page.close();
}
await browser.close();
