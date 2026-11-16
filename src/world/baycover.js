import * as THREE from 'three';
import { neonTexture, neonMaterial } from './signage.js';
import { AIRLOCK, HX } from './layout.js';

// Caisses de transit devant la baie du hangar 07 : décor permanent qui sert de couverture lors d'une intrusion.
// Repère « arène » : origine (0, 0, -25), axe x local vers la baie (z monde décroissant), axe z local = x monde.
export const STATION_ARENA = { origin: new THREE.Vector3(0, 0, -25), yaw: Math.PI / 2 };
// x, z, profondeur (le long de x local), largeur (le long de z local), hauteur
export const STATION_COVER = [
  [11, -22, 2.4, 2.4, 1.25], [15, -15, 1.6, 3.2, 1.25], [11.5, -5, 2.4, 2.4, 2.5], [15.5, 2, 1.6, 3.0, 1.25],
  [12.5, 6, 2.4, 2.4, 1.25], [13.5, 22, 2.4, 2.4, 2.5], [16.5, 17, 1.6, 3.0, 1.25],
];

export function buildBayCover(ctx) {
  const { mats, builder } = ctx;
  const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, STATION_ARENA.yaw, 0));
  const W = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(rot).add(STATION_ARENA.origin).toArray();
  const cols = [0x5c6b4a, 0x3d4a5a, 0x6a5a3a, 0x8a5a2a, 0x2f5e8a];
  const trim = mats.metal(0x2a2d30, { rough: 0.6 });
  const yellow = mats.paint(0xd9a21b, { plain: true, rough: 0.6, grime: 0.6 });
  STATION_COVER.forEach(([x, z, w, d, h], i) => {
    const r = [0, STATION_ARENA.yaw, 0];
    builder.box(w, h, d, mats.cladding(cols[i % cols.length]), W(x, h / 2, z), r, { tex: 4 });
    builder.box(w + 0.06, 0.1, d + 0.06, trim, W(x, h - 0.05, z), r);
    builder.box(w + 0.06, 0.1, d + 0.06, trim, W(x, 0.05, z), r);
    builder.box(w * 0.7, 0.02, 0.12, yellow, W(x, h + 0.01, z), r);
    builder.colliderBox(w, h, d, W(x, h / 2, z), r);
    const p = W(x, 0, z);
    builder.addObstacle(p[0], p[2], d / 2 + 0.2, w / 2 + 0.2, 0);
  });
}

/** Signalétique du sas côté hangar : enseigne lumineuse et balisage vert du cadre. */
export function buildAirlockSign(ctx) {
  const x = -HX + 0.32, z = AIRLOCK.z;
  const nt = neonTexture('GALERIE MARCHANDE', '#7dff9a', { size: 110 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4 / nt.aspect), neonMaterial(nt.tex, 2.2));
  sign.position.set(x, 8.0, z); sign.rotation.y = Math.PI / 2;
  ctx.scene.add(sign);
  const strip = ctx.mats.emissive(0x7dff9a, 3);
  const w = AIRLOCK.w, h = AIRLOCK.h;
  for (const s of [-1, 1]) ctx.builder.box(0.08, h, 0.12, strip, [x + 0.05, h / 2, z + s * (w / 2 + 0.15)], null, { cast: false });
  ctx.builder.box(0.08, 0.12, w + 0.4, strip, [x + 0.05, h + 0.1, z], null, { cast: false });
}
