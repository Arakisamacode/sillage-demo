// Remplace les .glb/.exr d'un build par des .b64.txt (hébergement Artifact).
import fs from 'fs';
import path from 'path';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(process.argv[2])) {
  if (!/\.(glb|exr)$/.test(f)) continue;
  fs.writeFileSync(f + '.b64.txt', fs.readFileSync(f).toString('base64'));
  fs.unlinkSync(f);
  console.log('packed', f);
}
