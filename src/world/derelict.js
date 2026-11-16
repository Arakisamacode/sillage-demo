import * as THREE from 'three';
import { Builder } from './builder.js';

// Intérieur d'abordage : soute d'un cargo pirate (« Rançonneur »), construite une fois, loin de tout.
// Le joueur y est transféré par le sas d'arrimage quand il aborde un cargo désemparé.
// Repère local : x le long de la soute (sas du Héron en x = -2, porte des pirates en x = 30), z en travers, y vers le haut.

export const BOARD_COVER = [
  [5, 3.6, 2.4, 2.4, 1.25], [6, -4, 3.0, 1.6, 1.25], [10, 0, 1.6, 3.2, 1.25], [13, 4.6, 2.4, 2.4, 2.5], [14, -4.6, 2.4, 2.4, 1.25],
  [18, 1.5, 3.0, 1.6, 1.25], [21, -3.6, 1.6, 3.0, 1.25], [22, 5, 2.4, 2.4, 2.5], [26, 0.5, 2.4, 2.4, 1.25], [26.5, -5, 2.4, 1.6, 1.25],
];
export const BAY = { x0: -1.6, x1: 29.4, z: 6.4 };

export function buildDerelict(ctx) {
  const { mats, scene } = ctx;
  const origin = new THREE.Vector3(6000, -1500, 6000);
  const B = new Builder(null);
  const P = (x, y, z) => [origin.x + x, origin.y + y, origin.z + z];
  const box = (w, h, d, m, p, col, opts = {}) => { B.box(w, h, d, m, P(...p), opts.rot || [0, 0, 0], { cast: false, tex: 4 }); if (col) ctx.builder.colliderBox(w, h, d, P(...p), opts.rot || [0, 0, 0]); };
  const cyl = (r, h, m, p, rot) => B.cyl(r, r, h, m, P(...p), rot, { cast: false, seg: 12 });
  const shell = mats.paint(0x4a4440, { grime: 0.95, scratch: 0.8, rust: 0.45 });
  const dark = mats.paint(0x26231f, { grime: 0.9, scratch: 0.7, rust: 0.35 });
  const deck = mats.diamond(0x6a625a);
  const metal = mats.metal(0x2a2826, { rough: 0.65 });
  const rust = mats.paint(0x7a3a1c, { grime: 0.9, rust: 0.8 });
  const yellow = mats.paint(0xc8901a, { plain: true, rough: 0.6, grime: 0.8 });
  const red = mats.emissive(0xff3a1a, 3.2), amber = mats.emissive(0xffa040, 2.2), dim = mats.emissive(0xffd0a0, 1.2);
  const L = 33, W = 14, H = 6.2, cx = 13.9;
  // coque : plancher, plafond, murs, cloisons d'extrémité
  box(L, 0.6, W, dark, [cx, -0.3, 0], true);
  box(L - 0.4, 0.04, W - 0.4, deck, [cx, 0.01, 0]);
  box(L, 0.4, W, dark, [cx, H + 0.2, 0], true);
  for (const s of [-1, 1]) {
    box(L, H, 0.4, shell, [cx, H / 2, s * (W / 2 + 0.2)], true);
    // membrures et passerelle latérale
    for (let x = -1; x <= 29; x += 3.2) {
      box(0.35, H, 0.5, metal, [x, H / 2, s * (W / 2 - 0.2)]);
      box(0.35, 0.4, W, metal, [x, H - 0.25, 0]);
    }
    cyl(0.18, L - 1, rust, [cx, H - 0.8, s * (W / 2 - 0.6)], [0, 0, Math.PI / 2]);
    cyl(0.12, L - 1, metal, [cx, H - 1.25, s * (W / 2 - 0.55)], [0, 0, Math.PI / 2]);
    for (let x = 1; x < 29; x += 6.4) box(1.6, 0.08, 0.1, red, [x, H - 0.55, s * (W / 2 - 0.35)]);
    box(L - 1, 0.06, 0.25, yellow, [cx, 0.03, s * (W / 2 - 1.2)]);
  }
  for (const [x, m] of [[-2.2, shell], [30.2, shell]]) box(0.4, H, W, m, [x, H / 2, 0], true);
  // sas d'arrimage (côté Héron) : cadre, porte ouverte, gyrophares
  box(0.5, 3.4, 0.5, yellow, [-1.8, 1.7, -1.6]); box(0.5, 3.4, 0.5, yellow, [-1.8, 1.7, 1.6]); box(0.5, 0.5, 3.7, yellow, [-1.8, 3.45, 0]);
  box(0.2, 2.9, 2.7, mats.metal(0x101214, { rough: 0.4 }), [-1.95, 1.45, 0]);
  box(0.1, 0.2, 2.6, dim, [-1.7, 3.1, 0]);
  // porte des pirates
  box(0.5, 3.8, 0.6, metal, [29.8, 1.9, -2.2]); box(0.5, 3.8, 0.6, metal, [29.8, 1.9, 2.2]); box(0.5, 0.6, 5, metal, [29.8, 4.1, 0]);
  box(0.2, 3.4, 3.8, mats.metal(0x0c0d0e, { rough: 0.5 }), [29.95, 1.7, 0]);
  box(0.1, 0.25, 3.8, red, [29.6, 3.95, 0]);
  // marquages au sol et contrebande
  for (let x = 2; x < 28; x += 4) box(1.8, 0.02, 0.2, yellow, [x, 0.04, 0]);
  const crateCols = [0x4a3a2a, 0x2f3a3a, 0x5a2a1e, 0x3a3a2a];
  BOARD_COVER.forEach(([x, z, w, d, h], i) => {
    box(w, h, d, mats.cladding(crateCols[i % crateCols.length]), [x, h / 2, z], true);
    box(w + 0.06, 0.1, d + 0.06, metal, [x, h - 0.05, z]);
    if (i % 3 === 0) box(w * 0.5, 0.05, 0.02, amber, [x, h * 0.6, z + d / 2 + 0.02]);
  });
  // câbles pendants et tuyaux éventrés
  for (const [x, z] of [[8, 2], [16.5, -1.5], [24, 3]]) cyl(0.04, 2.2, metal, [x, H - 1.2, z], null);
  const meshes = B.finalize(scene);
  for (const m of meshes) { m.castShadow = false; m.receiveShadow = false; }
  // éclairage de secours (allumé seulement pendant un abordage)
  const lights = [new THREE.PointLight(0xff7a40, 0, 22, 1.6), new THREE.PointLight(0xffb070, 0, 22, 1.6)];
  lights[0].position.set(...P(6, H - 1, 0)); lights[1].position.set(...P(21, H - 1, 0));
  for (const l of lights) { l.visible = false; scene.add(l); }
  ctx.updaters.push((dt, t) => {
    if (!lights[0].visible) return;
    lights[0].intensity = 70 * (0.8 + 0.2 * Math.sin(t * 13) * Math.sin(t * 3.1));
    lights[1].intensity = (t % 2.3) < 0.08 ? 10 : 80;
  });
  return { origin, rot: new THREE.Quaternion(), lights, start: { x: 0.2, z: 0 }, door: { x: 29.2, z: 0 } };
}
