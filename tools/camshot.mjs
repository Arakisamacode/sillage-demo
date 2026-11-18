// Rendu d’une vue libre (revue artistique) : node tools/camshot.mjs sortie.png "px,py,pz" "lx,ly,lz" [fov] [js avant rendu] [L,H]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require('playwright');
const [out, P, L, fov = '60', js = '', wh = '960,540'] = process.argv.slice(2);
const [w, h] = wh.split(',').map(Number);
const b = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: w, height: h } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:5173/?shot=dome_ext&quality=low&warm=0&sim=1&frames=1`);
await p.waitForFunction(() => window.__shotReady === true, null, { timeout: 400000, polling: 500 });
const r = await p.evaluate(([P, L, fov, js]) => {
  const A = window.__app; let res = null;
  if (js) res = new Function('A', js)(A);
  const c = A.camera; c.fov = +fov; c.updateProjectionMatrix();
  for (let i = 0; i < 3; i++) { A.simulate(1 / 30, 50 + i / 30); c.position.set(...P.split(',').map(Number)); c.lookAt(...L.split(',').map(Number)); A.renderer.render(1 / 30); }
  return res;
}, [P, L, fov, js]);
if (r != null) console.log(typeof r === 'string' ? r : JSON.stringify(r));
await p.screenshot({ path: out });
await b.close();
