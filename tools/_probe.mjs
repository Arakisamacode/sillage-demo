import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require('playwright');
const b = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:5173/?shot=dome_play&quality=low&warm=0&frames=' + (process.env.FR || 1));
await p.waitForFunction(() => window.__shotReady === true, null, { timeout: 400000, polling: 500 });
console.log(await p.evaluate(process.argv[2] ? new Function(process.argv[2]) : () => {
  const out = [];
  window.__app.scene.traverse((o) => { if (o.isMesh && o.material?.alphaTest > 0.3 && o.material.map?.image?.tagName === 'CANVAS') { o.geometry.computeBoundingBox(); out.push([o.geometry.attributes.position.count, o.visible, o.layers.mask, JSON.stringify(o.geometry.boundingBox.min), o.material.map.image.width]); } });
  return JSON.stringify(out);
}));
await b.close();
