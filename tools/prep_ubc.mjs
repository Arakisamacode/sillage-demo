// Prépare les « Universal Base Characters » de Quaternius (CC0, version gratuite Standard) :
// textures ramenées à 1024 px (JPEG), attributs inutiles supprimés, sortie en .glb.
// Usage : node tools/prep_ubc.mjs "<dossier Universal Base Characters[Standard]>" public/assets/characters/ubc
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
const [,, SRC, OUT] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync('/tmp/ubc-');
const toJpg = (src, dst, size) => execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB').resize((int(sys.argv[3]),) * 2, Image.LANCZOS)
im.save(sys.argv[2], quality=86)`, src, dst, String(size)]);
const io = new NodeIO();

async function convert(gltfPath, outName, swaps = {}) {
  const dir = path.dirname(gltfPath);
  const j = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
  const work = fs.mkdtempSync(path.join(tmp, 'w'));
  for (const b of j.buffers) fs.copyFileSync(path.join(dir, b.uri), path.join(work, b.uri));
  for (const im of j.images || []) {
    let uri = swaps[im.uri] || im.uri;
    let src = path.join(dir, uri);
    if (!fs.existsSync(src)) src = path.join(dir, uri.replace('_png.png', '.png'));
    const dst = im.uri.replace(/\.png$/, '.jpg');
    toJpg(src, path.join(work, dst), /Hair|Eye/.test(uri) ? 512 : 1024);
    im.uri = dst; im.mimeType = 'image/jpeg';
  }
  fs.writeFileSync(path.join(work, 'm.gltf'), JSON.stringify(j));
  const doc = await io.read(path.join(work, 'm.gltf'));
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    for (const s of p.listSemantics()) if (/^(COLOR_|TEXCOORD_[1-9])/.test(s)) p.setAttribute(s, null);
  }
  await doc.transform(dedup(), prune());
  const out = path.join(OUT, outName);
  await io.write(out, doc);
  console.log(outName, (fs.statSync(out).size / 1024).toFixed(0), 'Ko');
}

const B = path.join(SRC, 'Base Characters/Godot - UE');
await convert(path.join(B, 'Superhero_Male_FullBody.gltf'), 'UM_dark.glb');
await convert(path.join(B, 'Superhero_Male_FullBody.gltf'), 'UM_light.glb', { 'T_Superhero_Male_Dark.png': '../Textures/T_Superhero_Male_Ligh.png' });
await convert(path.join(B, 'Superhero_Female_FullBody.gltf'), 'UF_dark.glb');
await convert(path.join(B, 'Superhero_Female_FullBody.gltf'), 'UF_light.glb', { 'T_Superhero_Female_Dark_BaseColor.png': '../Textures/T_Superhero_Female_Light_BaseColor.png' });
const H = path.join(SRC, 'Hairstyles/Origin at 0/glTF (Godot)');
for (const f of fs.readdirSync(H).filter((f) => f.endsWith('.gltf'))) await convert(path.join(H, f), f.replace('.gltf', '.glb'));
