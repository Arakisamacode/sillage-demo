// Optimise les personnages Quaternius (CC0) : suppression des données inutiles, fusion des
// doublons et soudure des sommets.
// Usage : node tools/optimize_characters.mjs public/assets/characters
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld } from '@gltf-transform/functions';
import fs from 'fs';
import path from 'path';
const dir = process.argv[2];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.glb'))) {
  const p = path.join(dir, f);
  const before = fs.statSync(p).size;
  const doc = await io.read(p);
  // pas de quantification : elle ajoute une transformation par maillage, incompatible avec la fusion des peaux
  await doc.transform(dedup(), prune({ keepLeaves: true }), weld());
  await io.write(p, doc);
  console.log(f, (before / 1024).toFixed(0) + ' Ko ->', (fs.statSync(p).size / 1024).toFixed(0) + ' Ko');
}
