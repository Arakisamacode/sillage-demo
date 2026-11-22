// Conversion d'une sélection de personnages et d'animaux Microsoft Rocketbox (licence MIT) pour le jeu.
// Prérequis : dépôt cloné (git clone https://github.com/microsoft/microsoft-rocketbox), serveur Vite lancé sur le
// port 5173. Le script crée le temps de la conversion deux liens public/_rb (Assets) et public/_rbtex (textures
// temporaires), puis les supprime (sinon ils seraient copiés dans la version publiée).
// Usage : node tools/convert/rocketbox.mjs <chemin Assets> [id…]
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const require = createRequire(import.meta.url);
const pw = require('playwright');
const ASSETS = path.resolve(process.argv[2]);
const TEX = fs.mkdtempSync('/tmp/rbtex-');
for (const [l, t] of [['public/_rb', ASSETS], ['public/_rbtex', TEX]]) { try { fs.unlinkSync(l); } catch { /* absent */ } fs.symlinkSync(t, l); }
const cleanup = () => { for (const l of ['public/_rb', 'public/_rbtex']) { try { fs.unlinkSync(l); } catch { /* déjà retiré */ } } };
process.on('exit', cleanup);
const OUT = 'public/assets/characters/rb';
// [identifiant, dossier, type, taille textures corps, tête, triangles visés]
export const SET = [
  ...['Female_Adult_01', 'Female_Adult_03', 'Female_Adult_05', 'Female_Adult_08', 'Female_Adult_11', 'Female_Adult_14',
    'Male_Adult_02', 'Male_Adult_05', 'Male_Adult_08', 'Male_Adult_11', 'Male_Adult_14', 'Male_Adult_18'].map((n) => [n, `Avatars/Adults/${n}`, 'human', 512, 1024, 11000]),
  ...['Business_Female_02', 'Business_Male_03', 'Chef_Female_01', 'Gardener_Male_01', 'Medical_Male_01'].map((n) => [n, `Avatars/Professions/${n}`, 'human', 512, 1024, 11000]),
  ...['Female_Child_01', 'Female_Child_02', 'Male_Child_01', 'Male_Child_02'].map((n) => [n, `Avatars/Children/${n}`, 'human', 512, 1024, 10000]),
  ...['Sheep_White_01', 'Goat_White_01', 'Goat_Brown_01', 'Pig_Pink_01', 'Bird_Chicken_Brown_01', 'Bird_Chicken_White_01', 'Bird_Rooster_Brown_01', 'Bird_Duck_Male_01', 'Bird_Duck_Female_01']
    .map((n) => [n, `Animals/${n}`, 'animal', 512, 512, 4500]),
];

const only = process.argv.slice(3);
fs.mkdirSync(OUT, { recursive: true });
await MeshoptSimplifier.ready;
const io = new NodeIO();
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('erreur page', e.message));
await page.goto('http://127.0.0.1:5173/tools/convert/fbx.html');
await page.waitForFunction(() => window.ready);
for (const [id, dir, kind, sb, sh, tris] of SET) {
  if (only.length && !only.includes(id)) continue;
  const texOut = path.join(TEX, id);
  const got = execFileSync('python3', ['-I', 'tools/convert/rb_textures.py', path.join(ASSETS, dir, 'Textures'), texOut, String(sb), String(sh)]).toString().trim();
  const fbx = `/_rb/${dir}/Export/${id}.fbx`;
  const r = await page.evaluate(([u, t, k]) => window.convert(u, t, k), [fbx, `/_rbtex/${id}/`, kind]);
  const tmp = path.join(TEX, id + '.raw.glb');
  fs.writeFileSync(tmp, Buffer.from(r.b64, 'base64'));
  const doc = await io.read(tmp);
  const count = () => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + p.getIndices().getCount() / 3, 0), 0);
  await doc.transform(weld());
  const before = count();
  if (before > tris) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: tris / before, error: 0.004, lockBorder: true }));
  await doc.transform(dedup(), prune());
  const dst = path.join(OUT, id + '.glb');
  await io.write(dst, doc);
  console.log(id.padEnd(24), `os renommés ${r.renamed}`.padEnd(16), `taille ${r.size.join('×')}`.padEnd(26), `${Math.round(before)} → ${Math.round(count())} tri`.padEnd(20), `${(fs.statSync(dst).size / 1024).toFixed(0)} Ko`, `[${got}]`);
}
await browser.close();
