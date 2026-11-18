import * as THREE from 'three';
import { Builder } from './builder.js';
import { DECK_Y } from './habitat.js';
import { DOME } from './garden.js';
import { paintedText, decalMaterial } from './signage.js';

// Superstructure de Halden-7 : le pont habitat, la Cour des Saveurs, La Couronne et le Grand Dôme ne flottent plus.
// - plateforme porteuse blindée (8 m d'épaisseur) sous tout le pont habitat, socle cylindrique sous le dôme ;
// - coque pressurisée à panneaux autour des modules du pont (nervures, ceintures, hublots, ouvertures alignées sur
//   les vitrages intérieurs : baie du hall, vitrage ouest de la Cour, verrière, passerelle du dôme, ascenseur panoramique) ;
// - tour des ascenseurs, pylônes sur le toit de la galerie, jambes de force sur le toit du hangar, poutre-caisson et
//   tube pressurisé jusqu'au corps de la station ;
// - équipements de toit (radiateurs, échangeurs, antennes, parabole, gaines), marquages, feux de navigation.

const Y = DECK_Y;
const E = { x0: -142.5, x1: -69.3, z0: -26.5, z1: 54.5, y0: Y - 0.5, y1: Y + 8.4 };   // enveloppe du pont habitat
const P = { y0: Y - 9.5, y1: Y - 0.5 };                                                  // plateforme porteuse

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

export function buildSuperstructure(ctx) {
  const { mats, scene } = ctx;
  const B = new Builder(null);
  const R = rng(4242);
  const hull = mats.paint(0x5d6368, { grime: 0.8, scratch: 0.6, rust: 0.1 });
  const hullD = mats.paint(0x464b50, { grime: 0.9, scratch: 0.7, rust: 0.12 });
  const hullL = mats.paint(0x7b8187, { grime: 0.7, scratch: 0.5, rust: 0.06 });
  const hullW = mats.paint(0xa9aeb2, { grime: 0.6, scratch: 0.4, rust: 0.04 });
  const dark = mats.metal(0x24272a, { rough: 0.7 });
  const steel = mats.metal(0x8a9094, { rough: 0.35 });
  const ochre = mats.paint(0xb8862a, { grime: 0.8, scratch: 0.8, rust: 0.1 });
  const win = mats.emissive(0xffd9a8, 2.2), winC = mats.emissive(0xbfe0ff, 2.0), deckL = mats.emissive(0xfff2d8, 3.2);
  const box = (w, h, d, m, p, rot = null) => B.box(w, h, d, m, p, rot, { cast: false, tex: 6 });
  const tones = [hull, hullD, hullL, hull, hullD];

  /** Pan de coque plaqué. axis 'x' : mur à x = c, étendu en z ; 'z' : mur à z = c, étendu en x. out = ±1 (normale). */
  const wall = ({ axis, c, a0, a1, y0, y1, out, holes = [], windows = 0, thick = 0.6 }) => {
    const P3 = (a, y, o = 0) => (axis === 'x' ? [c + out * o, y, a] : [a, y, c + out * o]);
    const B3 = (la, h, d) => (axis === 'x' ? [d, h, la] : [la, h, d]);
    const add = (aa, ab, ya, yb, m, o, d) => { if (ab - aa < 0.02 || yb - ya < 0.02) return; box(...B3(ab - aa, yb - ya, d), m, P3((aa + ab) / 2, (ya + yb) / 2, o)); };
    const inHole = (a, y, m = 0) => holes.some((h) => a > h.a0 - m && a < h.a1 + m && y > h.y0 - m && y < h.y1 + m);
    // âme : découpée autour des ouvertures
    const cuts = [a0, ...holes.flatMap((h) => [h.a0, h.a1]), a1].sort((p, q) => p - q);
    for (let i = 0; i < cuts.length - 1; i++) {
      const s0 = cuts[i], s1 = cuts[i + 1], mid = (s0 + s1) / 2;
      const hs = holes.filter((h) => mid > h.a0 && mid < h.a1).sort((p, q) => p.y0 - q.y0);
      let y = y0;
      for (const h of hs) { add(s0, s1, y, h.y0, hull, 0, thick); y = h.y1; }
      add(s0, s1, y, y1, hull, 0, thick);
    }
    // ébrasements des ouvertures (encadrement épais, liseré lumineux)
    for (const h of holes) {
      if (h.noFrame) continue;
      const d = h.depth ?? 1.2, o = -(d / 2) + thick / 2;
      add(h.a0 - 0.35, h.a1 + 0.35, h.y0 - 0.35, h.y0, hullW, o + 0.1, d + 0.2);
      add(h.a0 - 0.35, h.a1 + 0.35, h.y1, h.y1 + 0.35, hullW, o + 0.1, d + 0.2);
      add(h.a0 - 0.35, h.a0, h.y0, h.y1, hullW, o + 0.1, d + 0.2);
      add(h.a1, h.a1 + 0.35, h.y0, h.y1, hullW, o + 0.1, d + 0.2);
      add(h.a0, h.a1, h.y1 + 0.05, h.y1 + 0.12, deckL, thick / 2 + 0.2, 0.06);
    }
    // plaques de blindage (tons variés, légèrement en saillie)
    const cw = 3.2, ch = 2.2;
    for (let a = a0 + 0.2; a < a1 - cw * 0.5; a += cw) for (let y = y0 + 0.3; y < y1 - ch * 0.5; y += ch) {
      const w = Math.min(cw, a1 - a) - 0.12, h = Math.min(ch, y1 - y) - 0.1;
      if (inHole(a + w / 2, y + h / 2, 1.0) || inHole(a, y, 0.4) || inHole(a + w, y + h, 0.4)) continue;
      if (R() < 0.62) add(a + 0.06, a + w, y + 0.05, y + h, tones[Math.floor(R() * tones.length)], thick / 2 + 0.04, 0.08);
    }
    // membrures verticales et ceintures horizontales
    for (let a = a0 + 3.2; a < a1 - 1; a += 6.4) { if (holes.some((h) => a > h.a0 - 0.6 && a < h.a1 + 0.6)) { const h = holes.find((k) => a > k.a0 - 0.6 && a < k.a1 + 0.6); add(a - 0.25, a + 0.25, y0, h.y0 - 0.35, hullD, thick / 2 + 0.2, 0.4); add(a - 0.25, a + 0.25, h.y1 + 0.35, y1, hullD, thick / 2 + 0.2, 0.4); } else add(a - 0.25, a + 0.25, y0, y1, hullD, thick / 2 + 0.2, 0.4); }
    for (const yb of [y0 + 0.5, y1 - 0.45]) {
      let s = a0;
      for (const h of [...holes].sort((p, q) => p.a0 - q.a0)) { if (yb > h.y0 - 0.4 && yb < h.y1 + 0.4) { add(s, h.a0 - 0.35, yb - 0.22, yb + 0.22, hullD, thick / 2 + 0.15, 0.3); s = h.a1 + 0.35; } }
      add(s, a1, yb - 0.22, yb + 0.22, hullD, thick / 2 + 0.15, 0.3);
    }
    // hublots éclairés (cabines, bureaux, coursives de service)
    if (windows) for (let a = a0 + 1.6; a < a1 - 1.6; a += 3.2) {
      const yw = y0 + windows;
      if (inHole(a, yw, 1.2) || R() < 0.22) continue;
      add(a - 0.65, a + 0.65, yw - 0.28, yw + 0.28, dark, thick / 2 + 0.03, 0.06);
      if (R() < 0.75) add(a - 0.55, a + 0.55, yw - 0.2, yw + 0.2, R() < 0.8 ? win : winC, thick / 2 + 0.07, 0.03);
    }
  };
  /** Pan horizontal plaqué (toit ou sous-face) avec trémies. */
  const slab = ({ x0, x1, z0, z1, y, up, holes = [], thick = 0.6, m = hull }) => {
    const xs = [x0, ...holes.flatMap((h) => [h.x0, h.x1]), x1].sort((p, q) => p - q);
    for (let i = 0; i < xs.length - 1; i++) {
      const s0 = xs[i], s1 = xs[i + 1], mid = (s0 + s1) / 2;
      const hs = holes.filter((h) => mid > h.x0 && mid < h.x1).sort((p, q) => p.z0 - q.z0);
      let z = z0;
      for (const h of hs) { if (h.z0 > z) box(s1 - s0, thick, h.z0 - z, m, [mid, y, (z + h.z0) / 2]); z = h.z1; }
      if (z1 > z) box(s1 - s0, thick, z1 - z, m, [mid, y, (z + z1) / 2]);
    }
    const inH = (x, z, mm) => holes.some((h) => x > h.x0 - mm && x < h.x1 + mm && z > h.z0 - mm && z < h.z1 + mm);
    for (let x = x0 + 0.3; x < x1 - 2; x += 4) for (let z = z0 + 0.3; z < z1 - 2; z += 3) {
      if (inH(x + 2, z + 1.5, 2.6)) continue;
      if (R() < 0.55) box(3.85, 0.07, 2.85, tones[Math.floor(R() * tones.length)], [x + 2, y + up * (thick / 2 + 0.03), z + 1.5]);
    }
    for (let x = x0 + 4; x < x1 - 1; x += 8) { if (!holes.some((h) => x > h.x0 - 0.6 && x < h.x1 + 0.6)) box(0.5, 0.35, z1 - z0, hullD, [x, y + up * (thick / 2 + 0.17), (z0 + z1) / 2]); }
  };

  // ---------------------------------------------------------------- plateforme porteuse sous le pont habitat
  const Px0 = E.x0 - 1.5, Px1 = E.x1 + 1.5, Pz0 = E.z0 - 1.5, Pz1 = E.z1 + 1.5, Py = (P.y0 + P.y1) / 2, Ph = P.y1 - P.y0;
  wall({ axis: 'z', c: Pz0, a0: Px0, a1: Px1, y0: P.y0, y1: P.y1, out: -1, windows: 4.2 });
  wall({ axis: 'z', c: Pz1, a0: Px0, a1: Px1, y0: P.y0, y1: P.y1, out: 1, windows: 4.2 });
  wall({ axis: 'x', c: Px0, a0: Pz0, a1: Pz1, y0: P.y0, y1: P.y1, out: -1, windows: 4.2 });
  wall({ axis: 'x', c: Px1, a0: Pz0, a1: Pz1, y0: P.y0, y1: P.y1, out: 1, windows: 4.2 });
  // sous-face, trémie des gaines d'ascenseur (les cabines la traversent)
  slab({ x0: Px0, x1: Px1, z0: Pz0, z1: Pz1, y: P.y0, up: -1, m: hullD, holes: [{ x0: -123, x1: -119.6, z0: -15.8, z1: -6.2 }] });
  // pont supérieur de la plateforme (autour de l'enveloppe) : coursive extérieure
  slab({ x0: Px0, x1: Px1, z0: Pz0, z1: Pz1, y: P.y1 - 0.3, up: 1, holes: [{ x0: E.x0 + 0.3, x1: E.x1 - 0.3, z0: E.z0 + 0.3, z1: E.z1 - 0.3 }] });
  // chanfreins (arêtes basses) et balises de bord
  for (const [a, b, z, o] of [[Px0, Px1, Pz0, -1], [Px0, Px1, Pz1, 1]]) box(b - a, 1.4, 1.4, hullD, [(a + b) / 2, P.y0 + 0.3, z - o * 0.3], [Math.PI / 4, 0, 0]);
  for (const [a, b, x, o] of [[Pz0, Pz1, Px0, -1], [Pz0, Pz1, Px1, 1]]) box(1.4, 1.4, b - a, hullD, [x - o * 0.3, P.y0 + 0.3, (a + b) / 2], [0, 0, Math.PI / 4]);
  const navR = mats.emissive(0xff3a2a, 5), navG = mats.emissive(0x3aff6a, 5), navW = mats.emissive(0xffffff, 6);
  for (let x = Px0 + 2; x < Px1; x += 6) for (const z of [Pz0 - 0.35, Pz1 + 0.35]) box(0.3, 0.12, 0.12, deckL, [x, P.y1 - 0.2, z]);
  for (let z = Pz0 + 2; z < Pz1; z += 6) for (const x of [Px0 - 0.35, Px1 + 0.35]) box(0.12, 0.12, 0.3, deckL, [x, P.y1 - 0.2, z]);

  // ---------------------------------------------------------------- coque pressurisée du pont habitat
  const LIFT = { x0: -112.3, x1: -108.9, z0: -2.2, z1: 1.2 };
  // sud : baie du hall (vitrage intérieur à z = -24, x -111..-81, y +0.7..+5.2)
  wall({ axis: 'z', c: E.z0, a0: E.x0, a1: E.x1, y0: E.y0, y1: E.y1, out: -1, windows: 2.6, holes: [{ a0: -111, a1: -81, y0: Y + 0.7, y1: Y + 5.2, depth: 2.6 }] });
  wall({ axis: 'z', c: E.z1, a0: E.x0, a1: E.x1, y0: E.y0, y1: E.y1, out: 1, windows: 2.6 });
  // ouest : vitrage de la Cour (x = -140, z 12.5..51.5, y +0.9..+6.2)
  wall({ axis: 'x', c: E.x0, a0: E.z0, a1: E.z1, y0: E.y0, y1: E.y1, out: -1, windows: 2.6, holes: [{ a0: 12.5, a1: 51.5, y0: Y + 0.9, y1: Y + 6.2, depth: 2.6 }] });
  // est : passerelle du Grand Dôme (z 18.2..21.8, jusqu'à +3.9)
  wall({ axis: 'x', c: E.x1, a0: E.z0, a1: E.z1, y0: E.y0, y1: E.y1, out: 1, windows: 2.6, holes: [{ a0: 17.9, a1: 22.1, y0: Y - 0.5, y1: Y + 4.1, depth: 1.0, noFrame: true }] });
  // ébrasements fermés entre les vitrages intérieurs et la coque (on ne voit pas le vide technique)
  {
    const fill = mats.paint(0x2e3236, { grime: 0.6 });
    box(30, 0.3, 2.6, fill, [-96, Y + 0.55, -25.2]); box(30, 0.3, 2.6, fill, [-96, Y + 5.35, -25.2]);
    for (const x of [-111.15, -80.85]) box(0.3, 4.8, 2.6, fill, [x, Y + 2.95, -25.2]);
    box(2.6, 0.3, 39, fill, [-141.3, Y + 0.75, 32]); box(2.6, 0.3, 39, fill, [-141.3, Y + 6.35, 32]);
    for (const z of [12.35, 51.65]) box(2.6, 5.6, 0.3, fill, [-141.3, Y + 3.55, z]);
    // jardinières de baie (verdure visible du hall)
    const MD = ctx.models;
    for (let x = -108.5, k = 0; x < -82; x += 3.4, k++) {
      if (!MD?.place(B, 'planter_box_02', x, Y + 0.7, -25.5, { fit: ['x', 2.2] })) box(2.2, 0.4, 0.8, mats.plastic(0x2a3a22, 0.9), [x, Y + 0.9, -25.6]);
      MD?.place(B, ['fern_02', 'shrub_04', 'flower_gazania', 'wild_rooibos_bush'][k % 4], x + (k % 2 ? 0.4 : -0.4), Y + 1.05, -25.5, { fit: ['max', k % 4 === 2 ? 0.5 : 0.9], ry: k });
    }
  }
  // toit : trémies de la verrière de la Cour et de l'ascenseur panoramique de La Couronne
  const SKY = { x0: -126.3, x1: -83.7, z0: 22.7, z1: 41.3 };
  slab({ x0: E.x0, x1: E.x1, z0: E.z0, z1: E.z1, y: E.y1, up: 1, holes: [SKY, LIFT] });
  // puits de lumière au-dessus de la verrière (parois lisses, liseré)
  for (const [w, d, x, z] of [[SKY.x1 - SKY.x0, 0.3, (SKY.x0 + SKY.x1) / 2, SKY.z0], [SKY.x1 - SKY.x0, 0.3, (SKY.x0 + SKY.x1) / 2, SKY.z1], [0.3, SKY.z1 - SKY.z0, SKY.x0, (SKY.z0 + SKY.z1) / 2], [0.3, SKY.z1 - SKY.z0, SKY.x1, (SKY.z0 + SKY.z1) / 2]]) {
    box(w, E.y1 - (Y + 7.9) + 0.6, d, hullW, [x, (E.y1 + Y + 7.9) / 2, z]);
    box(w + (d < 1 ? 0 : 0.2), 0.08, d < 1 ? 0.08 : d, deckL, [x, E.y1 + 0.36, z]);
  }
  // gaine de l'ascenseur panoramique jusqu'au toit (cadre, feux)
  for (const [x, z] of [[LIFT.x0, LIFT.z0], [LIFT.x1, LIFT.z0], [LIFT.x0, LIFT.z1], [LIFT.x1, LIFT.z1]]) box(0.35, 1.2, 0.35, steel, [x, E.y1 + 0.6, z]);

  // ---------------------------------------------------------------- équipements de toit
  {
    // batteries de radiateurs (ailettes claires sur bâtis sombres)
    for (const [x0, z0, n] of [[-138, -22, 6], [-138, 46, 6], [-78, 46, 4], [-78, -22, 4]]) {
      box(n * 1.6 + 0.6, 0.5, 4.2, dark, [x0 + n * 0.8, E.y1 + 0.55, z0 + 2.1]);
      for (let k = 0; k < n; k++) box(0.12, 2.6, 3.8, mats.metal(0xc8ccd0, { rough: 0.3 }), [x0 + 0.5 + k * 1.6, E.y1 + 2.1, z0 + 2.1]);
    }
    // échangeurs thermiques et centrales d'air (caissons, ventilateurs)
    for (const [x, z] of [[-134, 4], [-134, 14], [-76, 8], [-76, 30], [-98, 48], [-120, 48]]) {
      box(4.2, 1.8, 3.2, hullL, [x, E.y1 + 1.2, z]);
      for (const dx of [-1, 1]) { B.cyl(0.7, 0.7, 0.1, dark, [x + dx * 1.05, E.y1 + 2.15, z], null, { cast: false, seg: 18 }); B.cyl(0.08, 0.08, 0.2, steel, [x + dx * 1.05, E.y1 + 2.2, z], null, { cast: false, seg: 8 }); }
    }
    // gaines techniques sur le toit
    B.pipe([[-140, E.y1 + 0.9, -20], [-140, E.y1 + 0.9, 50], [-72, E.y1 + 0.9, 50], [-72, E.y1 + 0.9, -20]], 0.35, mats.paint(0x8a6a3a, { grime: 0.8 }), { cast: false, flangeMat: dark });
    B.pipe([[-139, E.y1 + 0.6, -21], [-139, E.y1 + 0.6, 49], [-73, E.y1 + 0.6, 49]], 0.22, mats.metal(0x9aa0a4, { rough: 0.4 }), { cast: false, flangeMat: dark });
    // mâts d'antennes et parabole de communication
    for (const [x, z, h] of [[-138, -4, 16], [-74, 52, 12], [-131, 52, 20]]) {
      B.cyl(0.25, 0.35, h, dark, [x, E.y1 + h / 2, z], null, { cast: false, seg: 8 });
      for (let k = 1; k < 4; k++) box(2.4 - k * 0.5, 0.12, 0.12, dark, [x, E.y1 + h * (k / 4), z]);
      box(0.3, 0.3, 0.3, navR, [x, E.y1 + h + 0.2, z]);
    }
    const dish = new THREE.SphereGeometry(4, 24, 10, 0, Math.PI * 2, 0, 0.75);
    B.add(dish, mats.paint(0xd8dcde, { grime: 0.4, scratch: 0.3 }), new THREE.Matrix4().compose(new THREE.Vector3(-128, E.y1 + 6.5, 30), new THREE.Quaternion().setFromEuler(new THREE.Euler(-2.3, 0.6, 0)), new THREE.Vector3(1, 1, 1)), { cast: false });
    B.cyl(0.5, 0.8, 4.5, dark, [-128, E.y1 + 2.3, 30], null, { cast: false, seg: 12 });
    // marquages d'aire de maintenance (ocre) et projecteurs de toit
    for (const [x, z] of [[-100, -10], [-90, 48]]) { box(10, 0.04, 0.4, ochre, [x, E.y1 + 0.33, z - 5]); box(10, 0.04, 0.4, ochre, [x, E.y1 + 0.33, z + 5]); box(0.4, 0.04, 10, ochre, [x - 5, E.y1 + 0.33, z]); box(0.4, 0.04, 10, ochre, [x + 5, E.y1 + 0.33, z]); }
  }

  // ---------------------------------------------------------------- tour des ascenseurs (rez-de-chaussée → plateforme)
  {
    const tx0 = -125.2, tx1 = -117.6, tz0 = -17.6, tz1 = -3.8, ty0 = 4.7, ty1 = P.y0;
    wall({ axis: 'x', c: tx0, a0: tz0, a1: tz1, y0: ty0, y1: ty1, out: -1, windows: 0 });
    wall({ axis: 'z', c: tz0, a0: tx0, a1: tx1, y0: ty0, y1: ty1, out: -1, windows: 0 });
    wall({ axis: 'z', c: tz1, a0: tx0, a1: tx1, y0: ty0, y1: ty1, out: 1, windows: 0 });
    wall({ axis: 'x', c: tx1, a0: tz0, a1: tz1, y0: ty0, y1: ty1, out: 1, windows: 0 });
    // fenêtres de la cage (bandes verticales éclairées : on voit monter les cabines la nuit)
    for (const z of [-14, -8]) box(0.08, ty1 - ty0 - 4, 0.6, winC, [tx0 - 0.42, (ty0 + ty1) / 2, z]);
  }

  // ---------------------------------------------------------------- pylônes sur le toit de la galerie (y 13,1) et poutre-caisson
  const pylon = (x, z, yb, yt, r = 1.6) => {
    box(r * 2, yt - yb, r * 2, hull, [x, (yb + yt) / 2, z]);
    for (const s of [-1, 1]) { box(0.35, yt - yb, r * 2 + 0.3, hullD, [x + s * r, (yb + yt) / 2, z]); box(r * 2 + 0.3, yt - yb, 0.35, hullD, [x, (yb + yt) / 2, z + s * r]); }
    box(r * 3, 1.2, r * 3, hullD, [x, yb + 0.6, z]); box(r * 3, 1.2, r * 3, hullD, [x, yt - 0.6, z]);
    for (let y = yb + 3; y < yt - 2; y += 4) box(r * 2 + 0.5, 0.3, r * 2 + 0.5, hullD, [x, y, z]);
  };
  const strut = (a, b, r = 0.45, m = dark) => { B.tube([a, b], r, m, { smooth: false, radial: 8, segments: 2, cast: false }); };
  for (const x of [-98, -84, -70]) for (const z of [-19, -5, 7]) pylon(x, z, 13.1, P.y0);
  for (const x of [-98, -84]) for (const z of [-19, -5]) { strut([x, 14, z], [x + 14, P.y0 - 1, z + 12]); strut([x + 14, 14, z], [x, P.y0 - 1, z + 12]); }
  // poutre-caisson nord : sous la Cour des Saveurs jusqu'au corps de la station (x -24)
  {
    const zb = 46, yb = P.y0 - 3, xb0 = -142, xb1 = -15;
    box(xb1 - xb0, 3.2, 4.2, hullD, [(xb0 + xb1) / 2, yb, zb]);
    for (let x = xb0 + 2; x < xb1; x += 6) { box(0.4, 3.6, 4.6, dark, [x, yb, zb]); if (x < -70) strut([x, yb + 1.6, zb], [x + 6, P.y0, zb], 0.25); }
    for (let x = xb0 + 4; x < xb1; x += 12) box(0.3, 0.12, 0.12, navW, [x, yb - 1.7, zb - 2.15]);
    // tube pressurisé (coursive vers le corps) avec anneaux de raidissement
    const t0 = new THREE.Vector3(-80, P.y0 - 2.5, 40), t1 = new THREE.Vector3(-24.5, 22, 62);
    B.tube([t0.toArray(), t1.toArray()], 2.6, hull, { smooth: false, radial: 16, segments: 2, cast: false });
    const dir = t1.clone().sub(t0), L = dir.length(); dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    for (let s = 2; s < L - 1; s += 4) B.add(new THREE.CylinderGeometry(2.85, 2.85, 0.6, 16), hullD, new THREE.Matrix4().compose(t0.clone().addScaledVector(dir, s), q, new THREE.Vector3(1, 1, 1)), { cast: false });
    for (let s = 6; s < L - 4; s += 8) B.add(new THREE.BoxGeometry(0.6, 0.3, 1.2), win, new THREE.Matrix4().compose(t0.clone().addScaledVector(dir, s).add(new THREE.Vector3(0, 2.62, 0)), q, new THREE.Vector3(1, 1, 1)), { cast: false });
    box(10, 8, 10, hull, [-24, 22, 62]);
  }
  // diagonales de reprise sous l'ouest de la plateforme (vers la tour des ascenseurs et la poutre)
  for (const [a, b] of [[[-121, P.y0 - 4, -17], [-140, P.y0, -24]], [[-121, P.y0 - 4, -4], [-140, P.y0, 20]], [[-121, 12, -10], [-138, P.y0, -10]], [[-138, P.y0 - 3, 46], [-130, P.y0, 10]]]) strut(a, b, 0.6, hullD);

  // ---------------------------------------------------------------- socle cylindrique du Grand Dôme et jambes de force
  {
    const cx = DOME.x, cz = DOME.z, Rd = DOME.R + 2.2, y0 = Y - 9.2, y1 = Y - 0.06, n = 48;
    const drum = new THREE.CylinderGeometry(Rd, Rd - 1.2, y1 - y0, n, 1, true);
    B.add(drum, hull, new THREE.Matrix4().makeTranslation(cx, (y0 + y1) / 2, cz), { cast: false });
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, rot = [0, -a + Math.PI / 2, 0];
      box(0.5, y1 - y0, 0.5, hullD, [cx + Math.cos(a) * (Rd + 0.05), (y0 + y1) / 2, cz + Math.sin(a) * (Rd + 0.05)], rot);
      if (k % 2) box(1.4, 0.4, 0.08, R() < 0.8 ? win : winC, [cx + Math.cos(a + 0.065) * (Rd + 0.02), y0 + 4.6, cz + Math.sin(a + 0.065) * (Rd + 0.02)], rot);
    }
    for (const yy of [y0 + 0.5, y1 - 0.5]) B.add(new THREE.TorusGeometry(Rd + 0.1, 0.3, 6, n), hullD, new THREE.Matrix4().compose(new THREE.Vector3(cx, yy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)), { cast: false });
    // coursive extérieure du socle (garde-corps, balises)
    B.add(new THREE.TorusGeometry(Rd + 0.9, 0.05, 4, 96), steel, new THREE.Matrix4().compose(new THREE.Vector3(cx, y1 + 1.0, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)), { cast: false });
    B.add(new THREE.RingGeometry(DOME.R + 0.3, Rd + 1.0, 96, 1), hullD, new THREE.Matrix4().compose(new THREE.Vector3(cx, y1 + 0.02, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)), { cast: false });
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; box(0.18, 0.1, 0.18, k % 6 ? mats.emissive(0xfff2d8, 1.2) : navR, [cx + Math.cos(a) * (Rd + 0.9), y1 + 1.1, cz + Math.sin(a) * (Rd + 0.9)]); }
    // sous-face et jambes : sur le toit du hangar (x > -36) ou sur celui de la galerie
    const under = new THREE.CircleGeometry(Rd - 1.2, n); under.rotateX(Math.PI / 2);
    B.add(under, hullD, new THREE.Matrix4().makeTranslation(cx, y0, cz), { cast: false });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + 0.15, x = cx + Math.cos(a) * (Rd - 3), z = cz + Math.sin(a) * (Rd - 3);
      const onHangar = x > -35 && z > -45 && z < 30, onGallery = x < -42 && x > -102 && z > -24 && z < 10;
      const yb = onHangar ? 29.1 : onGallery ? 13.1 : null;
      if (yb !== null) { pylon(x, z, yb, y0, 1.2); continue; }
      // sinon : jambe de force inclinée vers le toit du hangar
      const tx = Math.max(-33, Math.min(28, x + 10)), tz = Math.max(-42, Math.min(27, z));
      strut([x, y0, z], [tx, 29.3, tz], 0.7, hullD); box(3, 0.8, 3, hullD, [tx, 29.5, tz]);
    }
  }

  // ---------------------------------------------------------------- grands marquages peints (face sud, vers la baie et la planète)
  {
    const t = paintedText(['HALDEN-7'], { size: 220, color: '#e9e4d8', spacing: 18, wear: 1.4 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 26 / t.aspect), decalMaterial(t.tex, { rough: 0.8 }));
    m.position.set(-104, Py + 0.4, Pz0 - 0.45); m.rotation.y = Math.PI; scene.add(m);
    const t2 = paintedText(['PONT HABITAT · H-3'], { size: 120, color: '#d8b04a', spacing: 6, wear: 1.2 });
    const m2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 9 / t2.aspect), decalMaterial(t2.tex, { rough: 0.8 }));
    m2.position.set(-133, Y + 6.6, E.z0 - 0.75); m2.rotation.y = Math.PI; scene.add(m2);
    const t3 = paintedText(['GRAND DÔME'], { size: 140, color: '#e9e4d8', spacing: 8, wear: 1.2 });
    const m3 = new THREE.Mesh(new THREE.PlaneGeometry(10, 10 / t3.aspect), decalMaterial(t3.tex, { rough: 0.8 }));
    const a = -Math.PI / 2 - 0.35; m3.position.set(DOME.x + Math.cos(a) * (DOME.R + 2.3), Y - 5.2, DOME.z + Math.sin(a) * (DOME.R + 2.3)); m3.rotation.y = -a + Math.PI / 2 + Math.PI; scene.add(m3);
  }

  const meshes = B.finalize(scene);
  for (const m of meshes) { m.castShadow = false; m.receiveShadow = false; }
  // feux de navigation clignotants (coins de la plateforme : bâbord rouge, tribord vert, blancs à éclats)
  const beacons = [];
  const bm = (c) => new THREE.MeshBasicMaterial({ color: c });
  for (const [x, y, z, c, ph] of [[Px0 - 0.6, P.y1, Pz0 - 0.6, new THREE.Color(6, 0.4, 0.3), 0], [Px1 + 0.6, P.y1, Pz0 - 0.6, new THREE.Color(0.4, 6, 0.8), 0], [Px0 - 0.6, P.y1, Pz1 + 0.6, new THREE.Color(6, 0.4, 0.3), 0.9], [Px1 + 0.6, P.y1, Pz1 + 0.6, new THREE.Color(0.4, 6, 0.8), 0.9],
    [-131, E.y1 + 20.4, 52, new THREE.Color(8, 8, 8), 0.3], [DOME.x, Y - 1.2, DOME.z - DOME.R - 2.4, new THREE.Color(8, 8, 8), 1.2]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), bm(c)); m.position.set(x, y, z); m.userData.ph = ph; scene.add(m); beacons.push(m);
  }
  ctx.updaters.push((dt, t) => { for (const b of beacons) b.visible = ((t + b.userData.ph) % 2.0) < 0.18; });
  return { E, P, meshes };
}
