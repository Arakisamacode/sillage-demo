// Télécharge des modèles 3D photoscannés CC0 de Poly Haven (glTF 1k), les allège (simplification
// meshoptimizer, textures JPEG redimensionnées) et les écrit en .glb dans public/assets/models/ph/.
// Usage : node tools/fetch_ph_models.mjs public/assets/models/ph   (jardin : SET=garden … public/assets/models/garden)
import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT = process.argv[2] || 'public/assets/models/ph';
// [identifiant Poly Haven, taille des textures (px), nombre de triangles visé (0 = inchangé)]
export const MODELS = (process.env.SET === 'garden') ? [
  ['fern_02', 512, 4000], ['shrub_02', 1024, 6000], ['shrub_04', 512, 4000], ['flower_gazania', 512, 4000], ['flower_empodium', 512, 0],
  ['flower_ursinia', 512, 4000], ['wild_rooibos_bush', 512, 6000], ['wooden_picnic_table', 1024, 0], ['painted_wooden_bench', 512, 0],
  ['wooden_lantern_01', 512, 3000], ['wooden_bucket_01', 512, 2500], ['barrel_03', 512, 0], ['wooden_crate_02', 512, 2500],
  ['wicker_basket_02', 512, 3000], ['watering_can_metal_01', 512, 3000], ['rock_moss_set_02', 1024, 9000], ['namaqualand_boulders_01', 512, 4000],
  ['tree_stump_01', 512, 4000], ['garden_gnome', 512, 5000], ['rubber_duck_toy', 256, 1500], ['planter_box_02', 512, 4000],
] : [
  ['croissant', 512, 1200], ['hamburger_buns', 512, 2400], ['carrot_cake', 512, 3000], ['strawberry_chocolate_cake', 512, 4000],
  ['lemon', 256, 700], ['food_lime_01', 256, 700], ['food_apple_01', 256, 800], ['food_avocado_01', 256, 800],
  ['yellow_onion', 256, 700], ['food_ginger_01', 256, 1200], ['food_kiwi_01', 256, 800], ['food_pomegranate_01', 256, 800],
  ['potted_plant_04', 512, 4000], ['potted_plant_02', 1024, 16000],
  ['wooden_cutting_board', 512, 1200], ['wine_bottles_01', 512, 7000],
  ['cardboard_box_01', 512, 1200], ['plastic_crate_01', 512, 3000],
];

const UA = { 'User-Agent': 'sillage-asset-fetch/1.0' };
// curl (respecte le proxy HTTPS de l'environnement)
const get = async (url) => execFileSync('curl', ['-sSfL', '--retry', '3', '-A', UA['User-Agent'], url], { maxBuffer: 1 << 28 });
const resizeJpg = (buf, size) => {
  const tmp = fs.mkdtempSync('/tmp/phm-'), a = path.join(tmp, 'in'), b = path.join(tmp, 'out.jpg');
  fs.writeFileSync(a, buf);
  execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
s = int(sys.argv[3])
if max(im.size) > s: im = im.resize((s, s), Image.LANCZOS)
im.save(sys.argv[2], quality=85)`, a, b, String(size)]);
  const out = fs.readFileSync(b); fs.rmSync(tmp, { recursive: true }); return out;
};

const io = new NodeIO();
await MeshoptSimplifier.ready;
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(3);
for (const [id, tex, tris, suffix = ''] of MODELS) {
  if (only.length && !only.includes(id + suffix)) continue;
  const files = JSON.parse((await get(`https://api.polyhaven.com/files/${id}`)).toString());
  const g = files.gltf['1k'].gltf;
  const work = fs.mkdtempSync('/tmp/phm-' + id + '-');
  fs.writeFileSync(path.join(work, 'm.gltf'), await get(g.url));
  for (const [rel, f] of Object.entries(g.include)) {
    fs.mkdirSync(path.dirname(path.join(work, rel)), { recursive: true });
    fs.writeFileSync(path.join(work, rel), await get(f.url));
  }
  const doc = await io.read(path.join(work, 'm.gltf'));
  const count = () => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  const before = count();
  await doc.transform(weld());
  if (tris && before > tris) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: tris / before, error: 0.02, lockBorder: false }));
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) for (const s of p.listSemantics()) if (/^(COLOR_|TEXCOORD_[1-9])/.test(s)) p.setAttribute(s, null);
  for (const t of doc.getRoot().listTextures()) {
    t.setImage(resizeJpg(Buffer.from(t.getImage()), tex)); t.setMimeType('image/jpeg'); t.setURI(t.getURI().replace(/\.\w+$/, '.jpg'));
  }
  await doc.transform(dedup(), prune());
  const dst = path.join(OUT, id + suffix + '.glb');
  await io.write(dst, doc);
  console.log((id + suffix).padEnd(28), String(Math.round(before)).padStart(6), '→', String(Math.round(count())).padStart(6), 'tri', (fs.statSync(dst).size / 1024).toFixed(0).padStart(5), 'Ko');
  fs.rmSync(work, { recursive: true });
}
