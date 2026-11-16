import * as THREE from 'three';
import { Builder } from './builder.js';
import { neonTexture, neonMaterial } from './signage.js';

// Avant-postes en orbite autour de la planète : destinations des contrats de fret (et plus tard du minage).
// Chaque avant-poste : aire d'atterrissage balisée, passerelle, module principal habité, antennes et balises,
// plus un équipement propre à son activité (dépôt de conteneurs, plateforme minière, serres).

export const OUTPOSTS = [
  { id: 'corvin', name: 'Relais Corvin', kind: 'depot', pos: [-1500, 180, -2400], heading: 0.6, color: '#ffb84a', desc: 'Dépôt de fret indépendant' },
  { id: 'ardent', name: 'Plateforme Ardent-3', kind: 'mine', pos: [2100, -300, -3300], heading: -0.9, color: '#ff7a3a', desc: 'Raffinerie et base minière' },
  { id: 'lys', name: 'Station agricole Lys', kind: 'agri', pos: [-300, 650, -4800], heading: 2.4, color: '#7dff9a', desc: 'Serres orbitales et coopérative' },
];

export function buildOutposts(ctx) {
  const { mats, scene } = ctx;
  const B = new Builder(null);
  const shell = mats.paint(0x8a9096, { grime: 0.7, scratch: 0.6, rust: 0.1 });
  const shellDark = mats.paint(0x3a3f44, { grime: 0.8, scratch: 0.6, rust: 0.15 });
  const metal = mats.metal(0x2a2d30, { rough: 0.6 });
  const deck = mats.diamond(0x9a9ea2);
  const yellow = mats.paint(0xd9a21b, { plain: true, rough: 0.6, grime: 0.6 });
  const white = mats.paint(0xe6e8ea, { plain: true, rough: 0.6, grime: 0.4 });
  const win = mats.emissive(0xffd9a8, 2.2), winCold = mats.emissive(0xbfe0ff, 2.0);
  const padLight = mats.emissive(0x9fd8ff, 5), redL = mats.emissive(0xff5a3a, 4), green = mats.emissive(0x7dff9a, 2.4);
  const glass = mats.glass(0x9ad6b0, 0.35);
  const out = [];
  const beacons = [];
  for (const O of OUTPOSTS) {
    const o = new THREE.Vector3(...O.pos), rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, O.heading, 0));
    const P = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(rot).add(o).toArray();
    const R = (rx = 0, ry = 0, rz = 0) => [rx, ry + O.heading, rz];
    const box = (w, h, d, m, p, r, col) => { B.box(w, h, d, m, P(...p), R(...(r || [])), { cast: false, tex: 4 }); if (col) ctx.builder.colliderBox(w, h, d, P(...p), R(...(r || []))); };
    const cyl = (r1, r2, h, m, p, r, seg = 20) => B.cyl(r1, r2, h, m, P(...p), R(...(r || [])), { cast: false, seg });
    // ------------------------------------------------ aire d'atterrissage (octogone de 34 m)
    cyl(17, 16, 1.6, shellDark, [0, -0.8, 0], null, 8);
    cyl(16.6, 16.6, 0.06, deck, [0, 0.0, 0], null, 8);
    ctx.builder.colliderBox(24, 1.6, 24, P(0, -0.8, 0), R());
    ctx.builder.colliderBox(24, 1.6, 24, P(0, -0.8, 0), R(0, Math.PI / 4));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      box(0.5, 0.25, 0.5, padLight, [Math.cos(a) * 15.6, 0.12, Math.sin(a) * 15.6]);
    }
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      if (i % 2) box(2.2, 0.03, 0.35, white, [Math.cos(a) * 11, 0.04, Math.sin(a) * 11], [0, -a + Math.PI / 2, 0]);
    }
    box(10, 0.03, 0.5, yellow, [0, 0.05, 0]); box(0.5, 0.03, 10, yellow, [0, 0.05, 0]);
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) box(1.2, 0.03, 0.6, yellow, [s * 14, 0.05, -5 + k * 2], [0, 0.6 * s, 0]);
    // dessous : poutres et projecteurs
    for (let i = 0; i < 4; i++) box(34, 1.2, 1.2, metal, [0, -2.2, 0], [0, (i * Math.PI) / 4, 0]);
    // ------------------------------------------------ passerelle vers le module principal (+x)
    box(30, 2.2, 5, shell, [32, -1.0, 0], null, true);
    box(30, 0.3, 0.3, yellow, [32, 0.2, 2.6]); box(30, 0.3, 0.3, yellow, [32, 0.2, -2.6]);
    for (let x = 20; x < 46; x += 4) box(0.4, 2.0, 0.4, metal, [x, 1.0, 2.6]), box(0.4, 2.0, 0.4, metal, [x, 1.0, -2.6]);
    // ------------------------------------------------ module principal : tour cylindrique
    const hx = 60;
    cyl(14, 14, 44, shell, [hx, 4, 0], null, 24);
    cyl(14.4, 14.4, 2, shellDark, [hx, 12, 0], null, 24);
    cyl(14.4, 14.4, 2, shellDark, [hx, -6, 0], null, 24);
    cyl(10, 14, 6, shellDark, [hx, 29, 0], null, 24);
    cyl(4, 10, 8, shell, [hx, -22, 0], null, 16);
    ctx.builder.colliderBox(28, 56, 28, P(hx, 2, 0), R());
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, y = [-2, 6, 16, 20][i % 4];
      box(0.4, 1.0, 3.2, i % 5 ? win : winCold, [hx + Math.cos(a) * 14.05, y, Math.sin(a) * 14.05], [0, -a, 0]);
    }
    // radiateurs et mât d'antenne
    for (const s of [-1, 1]) box(2, 22, 0.3, mats.metal(0xa0a6aa, { rough: 0.3 }), [hx, 6, s * 20], [0, 0, 0]), box(1, 1, 6, metal, [hx, 6, s * 16.5]);
    cyl(0.5, 0.5, 34, metal, [hx, 48, 0], null, 8);
    box(10, 0.4, 0.4, metal, [hx, 58, 0]);
    beacons.push(P(hx, 65.5, 0), P(hx + 5, 58, 0), P(17, 1, 0), P(-17, 1, 0));
    // enseigne
    const nt = neonTexture(O.name.toUpperCase(), O.color, { size: 120 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 22 / nt.aspect), neonMaterial(nt.tex, 2.4));
    sign.position.set(...P(hx - 14.6, 22, 0)); sign.quaternion.copy(rot).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)));
    scene.add(sign);
    // ------------------------------------------------ activité
    if (O.kind === 'depot') {
      box(34, 1.2, 22, shellDark, [hx, -8, -32], null, true);
      const cols = [0x2f5e8a, 0x8a3a2a, 0x5c6b4a, 0xb88a2a, 0x6a6e70];
      for (let i = 0; i < 14; i++) {
        const c = cols[i % cols.length], lvl = Math.floor(i / 7), k = i % 7;
        box(2.5, 2.6, 6.1, mats.cladding(c), [hx - 13 + (k % 4) * 7.5, -6.1 + lvl * 2.65, -38 + Math.floor(k / 4) * 10], null);
      }
      box(1, 16, 1, metal, [hx - 16, 0, -22]); box(1, 16, 1, metal, [hx + 16, 0, -22]); box(34, 1.2, 1.2, yellow, [hx, 8, -22]);
    } else if (O.kind === 'mine') {
      // trémie à minerai, convoyeur et four de raffinage
      cyl(8, 3, 14, mats.paint(0x8a4a22, { grime: 0.9, rust: 0.5 }), [hx, -10, -30], null, 12);
      box(4, 3, 30, metal, [hx, 0, -14], [0.25, 0, 0]);
      cyl(6, 6, 20, shellDark, [hx + 22, 0, -10], null, 16);
      for (let i = 0; i < 3; i++) cyl(1.2, 1.2, 16, metal, [hx + 22 + (i - 1) * 3, 18, -10], null, 10);
      box(2, 2, 2, redL, [hx + 22, 27, -10]);
      cyl(16, 16, 1.0, shellDark, [hx, -14, -30], null, 12);
    } else {
      // serres : modules vitrés éclairés de l'intérieur
      for (let i = 0; i < 4; i++) {
        const z = -24 - i * 14;
        box(26, 10, 12, glass, [hx, 0, z]);
        box(24, 0.4, 10, green, [hx, -4.6, z]);
        box(26.4, 0.6, 12.4, shellDark, [hx, 5.2, z]); box(26.4, 0.6, 12.4, shellDark, [hx, -5.2, z]);
      }
      box(4, 4, 60, shell, [hx, 0, -50]);
    }
    // projecteur de l'aire
    const L = new THREE.PointLight(0xdfeeff, 400, 80, 2);
    L.position.set(...P(0, 18, 0)); scene.add(L);
    out.push({
      ...O,
      pad: { id: O.id, name: O.name, pos: new THREE.Vector3(...P(0, 0, 0)), q: rot.clone(), outpost: O },
      center: new THREE.Vector3(...P(0, 0, 0)),
    });
  }
  const meshes = B.finalize(scene);
  for (const m of meshes) { m.castShadow = false; m.receiveShadow = false; }
  const bMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.5, 0.3) });
  const bm = beacons.map((p) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), bMat); m.position.set(...p); scene.add(m); return m; });
  ctx.updaters.push((dt, t) => { for (let i = 0; i < bm.length; i++) bm[i].visible = ((t + i * 0.41) % 1.6) < 0.25; });
  return out;
}
