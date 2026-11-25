import * as THREE from 'three';
import { Builder } from './builder.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  skinHull, nozzle, nozzleMaterials, kitMaterials, LiveryAtlas, addParts, bevelBox, rodBetween, rcsBlock, antenna, radiator, lightPod, ventPanel, dockingClamp,
} from './hullkit2.js';
import { HX, SHIPLOCK } from './layout.js';
import { keepFromPlayer, targetBlocked } from '../ai/keepout.js';
import { paintedText, decalMaterial, neonTexture, neonMaterial, Screen, FONT, canvas as mkCanvas } from './signage.js';
import { sciFurniture } from './scififurn.js';
import { shipDecor } from './shipdecor.js';
import { container, crate, barrel, workbench, toolChest, gasRack, extinguisher } from './props.js';

// Frégate de transport « Atalante » (190 m), amarrée le long du flanc est de la station et reliée au hangar 07
// par un tube d'abordage (sas 3). Trois ponts habitables :
//  A (cargo, machines) : sas, vestiaire, réserve, atelier, armurerie, survie, garage, soute double hauteur, salle des machines
//  B (équipage)        : infirmerie, quatre cabines, réfectoire et cuisine, salon d'observation, coursive au-dessus de la soute
//  C (commandement)    : passerelle (baie vitrée face à la planète), cabine du capitaine, salle de briefing, salon panoramique
// Les ponts sont reliés par un escalier à deux volées. Portes coulissantes automatiques, éclairage par pièce.

export const SHIP = { x0: 66, x1: 98, cx: 82, zA: -30, zEnd: 56, zBow: -42, yA: 0, yB: 4.6, yC: 9.2, h: 4.0 };
const S = SHIP;
const CX0 = 80, CX1 = 84;                       // coursive centrale

export function buildBigShip(ctx) {
  const { mats, scene, builder: B } = ctx;
  const low = ctx.quality.name === 'low';
  const out = { lights: [], doors: [], seats: [], spots: {}, rooms: [], interior: { A: [], B: [], C: [] } };
  // masquage par pont : la géométrie intérieure est étiquetée selon le pont (A, B, C) et n'est dessinée que près
  // du vaisseau (pont courant et ponts voisins), jamais depuis le hangar, la galerie ou les étages de la station
  const sceneBefore = new Set(scene.children);
  const deckOf = (y) => (y < 4.4 ? 'A' : y < 9.0 ? 'B' : 'C');
  B.tagFn = (c) => (c.x > S.x0 - 0.6 && c.x < S.x1 + 0.6 && c.z > S.zBow - 0.6 && c.z < S.zEnd + 0.6 && c.y > -0.5 && c.y < 14 ? 'ship' + deckOf(c.y) : null);
  // ---------------------------------------------------------------- matériaux
  // familles de panneaux (UV des boîtes de la frégate : 1 unité = 2 m)
  const wallM = mats.paint(0xc9ced3, { kind: 'wide', uv: 2, grime: 0.35, scratch: 0.3, rust: 0, rough: 0.6 });
  const wallLow = mats.paint(0x4a5058, { kind: 'service', uv: 2, grime: 0.6, scratch: 0.5, rust: 0.05 });
  const wallWarm = mats.paint(0x8a7a66, { plain: true, rough: 0.7, grime: 0.2 });
  const hullIn = mats.paint(0x5d6368, { kind: 'hull', uv: 2, grime: 0.8, scratch: 0.6, rust: 0.1 });
  const floorM = mats.diamond ? mats.diamond(0x9a9ea2) : wallLow;
  const floorTile = mats.ph('large_grey_tiles', 0xb8bcc0, { rough: 1, metal: 0, grime: 0.3, scratch: 0.2, floor: 0.5 });
  const ceilM = mats.paint(0x2c3136, { kind: 'service', uv: 3, grime: 0.5 });   // dalles : UV 3 m
  const trim = mats.metal(0x8c9094, { rough: 0.35, grime: 0.3 });
  const dark = mats.metal(0x24272a, { rough: 0.7 });
  const yellow = mats.paint(0xd8a62a, { grime: 0.6, scratch: 0.6 });
  const glass = mats.glass(0x9fc4dc, 0.12);
  const ledW = mats.emissive(0xeaf2ff, 3.0), ledWarm = mats.emissive(0xffd9a8, 2.4), ledCyan = mats.emissive(0x6fdcff, 2.6), ledRed = mats.emissive(0xff3a2a, 3);
  const F = sciFurniture(ctx);
  const D = shipDecor(ctx, B);
  const M_parquet = D.M.wood(0x8a6a4c);
  const box = (w, h, d, m, p, col = false, rot = null, tex = 2) => B.box(w, h, d, m, p, rot, { collide: col, cast: false, tex });
  const light = (x, y, z, color = 0xeaf2ff, i = 14, d = 11) => { const l = new THREE.PointLight(color, i, d, 2); l.position.set(x, y, z); scene.add(l); out.lights.push(l); return l; };

  // ---------------------------------------------------------------- murs, dalles, plafonds
  /** mur le long de z (à x), ouvertures [za, zb, hauteur] */
  const wallZ = (x, z0, z1, y, h = S.h, holes = [], m = wallM, t = 0.22) => {
    let cur = z0;
    for (const [a, b, hh] of [...holes].sort((p, q) => p[0] - q[0])) {
      if (a > cur) { box(t, h, a - cur, m, [x, y + h / 2, (cur + a) / 2], true); box(t + 0.04, 0.9, a - cur, wallLow, [x, y + 0.45, (cur + a) / 2]); }
      if (hh < h) box(t, h - hh, b - a, m, [x, y + hh + (h - hh) / 2, (a + b) / 2], true);
      for (const zz of [a, b]) box(t + 0.12, hh, 0.14, trim, [x, y + hh / 2, zz]);
      box(t + 0.12, 0.14, b - a + 0.28, trim, [x, y + hh + 0.07, (a + b) / 2]);
      cur = b;
    }
    if (z1 > cur) { box(t, h, z1 - cur, m, [x, y + h / 2, (cur + z1) / 2], true); box(t + 0.04, 0.9, z1 - cur, wallLow, [x, y + 0.45, (cur + z1) / 2]); }
  };
  /** mur le long de x (à z) */
  const wallX = (z, x0, x1, y, h = S.h, holes = [], m = wallM, t = 0.22) => {
    let cur = x0;
    for (const [a, b, hh] of [...holes].sort((p, q) => p[0] - q[0])) {
      if (a > cur) { box(a - cur, h, t, m, [(cur + a) / 2, y + h / 2, z], true); box(a - cur, 0.9, t + 0.04, wallLow, [(cur + a) / 2, y + 0.45, z]); }
      if (hh < h) box(b - a, h - hh, t, m, [(a + b) / 2, y + hh + (h - hh) / 2, z], true);
      for (const xx of [a, b]) box(0.14, hh, t + 0.12, trim, [xx, y + hh / 2, z]);
      box(b - a + 0.28, 0.14, t + 0.12, trim, [(a + b) / 2, y + hh + 0.07, z]);
      cur = b;
    }
    if (x1 > cur) { box(x1 - cur, h, t, m, [(cur + x1) / 2, y + h / 2, z], true); box(x1 - cur, 0.9, t + 0.04, wallLow, [(cur + x1) / 2, y + 0.45, z]); }
  };
  /** rectangles de [x0,x1]×[z0,z1] privés des trous */
  const rects = (x0, x1, z0, z1, holes = []) => {
    const xs = [x0, ...holes.flatMap((h) => [h[0], h[1]]), x1].filter((v) => v >= x0 && v <= x1).sort((a, b) => a - b), out2 = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i], b = xs[i + 1], mid = (a + b) / 2; if (b - a < 0.01) continue;
      const hs = holes.filter((h) => mid > h[0] && mid < h[1]).sort((p, q) => p[2] - q[2]);
      let z = z0;
      for (const h of hs) { if (h[2] > z) out2.push([a, b, z, h[2]]); z = Math.max(z, h[3]); }
      if (z1 > z) out2.push([a, b, z, z1]);
    }
    return out2;
  };
  /** dalle : sol (dessus à y), plafond du niveau inférieur (dessous), trous [x0,x1,z0,z1] */
  const slab = (x0, x1, z0, z1, y, holes = [], fm = floorM, under = true) => {
    for (const [a, b, c, d] of rects(x0, x1, z0, z1, holes)) {
      box(b - a, 0.1, d - c, fm, [(a + b) / 2, y - 0.05, (c + d) / 2], true, null, 3);
      if (under) box(b - a, 0.5, d - c, ceilM, [(a + b) / 2, y - 0.35, (c + d) / 2], false, null, 3);
    }
  };
  /** garde-corps le long d'un segment */
  const rail = (a, b, y) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
    const m = [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2];
    box(0.06, 0.06, L, yellow, [m[0], y + 1.05, m[2]], false, [0, ry, 0]);
    box(0.04, 0.04, L, trim, [m[0], y + 0.55, m[2]], false, [0, ry, 0]);
    for (let t = 0; t <= L; t += 1.2) box(0.05, 1.05, 0.05, trim, [a[0] + dx * (t / L), y + 0.52, a[1] + dz * (t / L)]);
    B.colliderBox(L, 1.1, 0.1, [m[0], y + 0.55, m[2]], [0, ry + Math.PI / 2, 0]);
  };
  /** bandeau lumineux au plafond */
  // éclairage de plafond : dans les coursives, pavés lumineux encastrés espacés (le plafond reste visible entre eux)
  // plutôt qu'un seul ruban éblouissant sur toute la longueur ; ailleurs, un pavé unique cerclé
  const ledSoft = mats.emissive(0xeaf2ff, 1.5);
  const ledStrip = (x0, x1, z0, z1, y, m = ledSoft) => {
    const w = x1 - x0, L = z1 - z0, yy = y - 0.62;
    if (L > w * 3) {
      for (let z = z0 + 1.2; z < z1 - 0.6; z += 2.5) {
        box(Math.min(1.4, w - 0.4) + 0.1, 0.05, 0.62, trim, [(x0 + x1) / 2, yy + 0.01, z]);
        box(Math.min(1.4, w - 0.4), 0.02, 0.5, m === ledW ? ledSoft : m, [(x0 + x1) / 2, yy - 0.02, z]);
      }
      return;
    }
    box(w + 0.1, 0.05, L + 0.1, trim, [(x0 + x1) / 2, yy + 0.01, (z0 + z1) / 2]);
    box(w, 0.02, L, m === ledW ? ledSoft : m, [(x0 + x1) / 2, yy - 0.02, (z0 + z1) / 2]);
  };
  /** volée d'escalier : marches visibles, rampe de collision ; de (za, ya) à (zb, yb) entre x0 et x1 */
  const flight = (x0, x1, za, ya, zb, yb) => {
    const n = Math.round(Math.abs(yb - ya) / 0.19), dz = (zb - za) / n, dy = (yb - ya) / n, w = x1 - x0;
    for (let k = 0; k < n; k++) {
      box(w, 0.06, Math.abs(dz) + 0.02, floorM, [(x0 + x1) / 2, ya + dy * (k + 1) - 0.03, za + dz * (k + 0.5)]);
      box(w, Math.abs(dy), 0.03, wallLow, [(x0 + x1) / 2, ya + dy * (k + 0.5), za + dz * k]);
      box(w * 0.9, 0.012, 0.04, yellow, [(x0 + x1) / 2, ya + dy * (k + 1) + 0.004, za + dz * (k + 1) - Math.sign(dz) * 0.04]);
    }
    const L = Math.hypot(zb - za, yb - ya), th = Math.atan2(-(yb - ya), zb - za);
    const cz = (za + zb) / 2, cy = (ya + yb) / 2 - 0.12;
    B.colliderBox(w, 0.2, L + 0.4, [(x0 + x1) / 2, cy, cz], [th, 0, 0]);
    // limon sous la volée (vu depuis le niveau inférieur)
    B.add(new THREE.BoxGeometry(w, 0.25, L), wallLow, new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, cy - 0.2, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(th, 0, 0)), new THREE.Vector3(1, 1, 1)), { cast: false });
    for (const xx of [x0, x1]) for (let k = 0; k <= n; k += 3) box(0.05, 1.0, 0.05, trim, [xx, ya + dy * k + 0.5, za + dz * k]);
    for (const xx of [x0, x1]) B.add(new THREE.BoxGeometry(0.06, 0.06, L), yellow, new THREE.Matrix4().compose(new THREE.Vector3(xx, cy + 1.12, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(th, 0, 0)), new THREE.Vector3(1, 1, 1)), { cast: false });
  };
  /** porte coulissante automatique (axe 'x' : le passage traverse un mur le long de z) */
  const door = (axis, x, z, y, w = 1.8, h = 2.4, tint = 0x8a9096) => {
    const leaves = [];
    const mat = mats.metal(tint, { rough: 0.35, grime: 0.3 });
    for (const s2 of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.08 : w / 2, h, axis === 'x' ? w / 2 : 0.08), mat);
      const base = axis === 'x' ? new THREE.Vector3(x, y + h / 2, z + s2 * w / 4) : new THREE.Vector3(x + s2 * w / 4, y + h / 2, z);
      g.position.copy(base); scene.add(g); leaves.push({ g, s: s2, base });
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.09 : 0.06, h * 0.7, axis === 'x' ? 0.06 : 0.09), yellow);
      stripe.position.set(axis === 'x' ? 0 : -s2 * (w / 4 - 0.05), 0, axis === 'x' ? -s2 * (w / 4 - 0.05) : 0); g.add(stripe);
    }
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.06 : 0.4, 0.08, axis === 'x' ? 0.4 : 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3, 0.6) }));
    lamp.position.set(x, y + h + 0.2, z); scene.add(lamp);
    const D = {
      x, z, y, w, h, open: 0, target: 0, leaves, lamp, inShip: true,
      box: axis === 'x' ? new THREE.Box3(new THREE.Vector3(x - 0.15, y, z - w / 2), new THREE.Vector3(x + 0.15, y + h, z + w / 2)) : new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - 0.15), new THREE.Vector3(x + w / 2, y + h, z + 0.15)),
      update(dt, actors) {
        let near = false;
        for (const p of actors) if (Math.abs((p.y ?? 0) - y) < 2 && Math.hypot(p.x - x, p.z - z) < 2.4) { near = true; break; }
        if (!near) for (const p of out.crewPos || []) if (Math.abs(p.y - y) < 2 && Math.hypot(p.x - x, p.z - z) < 2.2) { near = true; break; }
        this.target = near ? 1 : 0;
        const was = this.open;
        this.open += Math.sign(this.target - this.open) * Math.min(Math.abs(this.target - this.open), dt * 2.2);
        if ((was === 0 && this.open > 0) || (was === 1 && this.open < 1)) this.onMove?.(this.target > 0.5);
        const e = this.open * this.open * (3 - 2 * this.open);
        for (const l of leaves) { l.g.position.copy(l.base); if (axis === 'x') l.g.position.z += l.s * e * (w / 2 - 0.05); else l.g.position.x += l.s * e * (w / 2 - 0.05); }
        lamp.material.color.setRGB(this.open > 0.05 ? 3 : 0.4, this.open > 0.05 ? 2.2 : 3, 0.5);
      },
    };
    ctx.doors.push(D); out.doors.push(D);
    return D;
  };
  const sign = (lines, w, p, ry, color = '#e8e2d2', size = 120) => {
    const t = paintedText(lines, { size, color, wear: 0.5 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / t.aspect), decalMaterial(t.tex, { rough: 0.6 }));
    m.position.set(...p); m.rotation.y = ry; scene.add(m);
  };
  const DH = 2.4;    // hauteur des portes

  /** habillage d'une coursive (x0..x1) le long de z : couples de structure, gaines, chemins de câbles, numéros, éclairage de sol */
  const dressCorridor = (x0, x1, z0, z1, y, doorsZ = []) => {
    const pipeA = mats.paint(0x2f6f9f, { grime: 0.5 }), pipeB = mats.paint(0x9a6a2a, { grime: 0.6 }), tray = mats.metal(0x5a6066, { rough: 0.5 });
    const ceil = y + S.h;
    B.pipe([[x0 + 0.35, ceil - 0.35, z0 + 0.5], [x0 + 0.35, ceil - 0.35, z1 - 0.5]], 0.09, pipeA, { cast: false, flangeMat: dark });
    B.pipe([[x0 + 0.62, ceil - 0.3, z0 + 0.5], [x0 + 0.62, ceil - 0.3, z1 - 0.5]], 0.07, pipeB, { cast: false, flangeMat: dark });
    box(0.5, 0.06, z1 - z0 - 1, tray, [x1 - 0.45, ceil - 0.35, (z0 + z1) / 2]);
    for (let z = z0 + 2; z < z1 - 1; z += 4) {
      if (doorsZ.some((dz) => Math.abs(dz - z) < 1.4)) continue;
      // couple : montants et traverse
      for (const xx of [x0 + 0.17, x1 - 0.17]) box(0.14, S.h - 0.1, 0.32, mats.paint(0x6a7076, { grime: 0.5 }), [xx, y + S.h / 2, z]);
      box(x1 - x0, 0.22, 0.32, mats.paint(0x6a7076, { grime: 0.5 }), [(x0 + x1) / 2, ceil - 0.15, z]);
      box(0.05, 0.12, 0.3, ledWarm, [x0 + 0.26, y + 0.18, z]); box(0.05, 0.12, 0.3, ledWarm, [x1 - 0.26, y + 0.18, z]);
      if (Math.round(z) % 12 === 2) sign([`C-${String(Math.round(z + 60)).padStart(3, '0')}`], 0.42, [x0 + 0.25, y + 2.3, z + 0.5], Math.PI / 2, '#d8d2c4', 120);
    }
    // grille centrale au sol, extincteurs, interphones
    box(1.0, 0.012, z1 - z0 - 0.5, mats.grating ? mats.grating() : dark, [(x0 + x1) / 2, y + 0.008, (z0 + z1) / 2]);
    for (let z = z0 + 9; z < z1 - 2; z += 18) { extinguisher(ctx, x1 - 0.25, y + 0.6, z, -Math.PI / 2); box(0.04, 0.3, 0.2, ledCyan, [x0 + 0.13, y + 1.5, z + 1]); }
    const len = z1 - z0 - 0.4, zm = (z0 + z1) / 2, chrome = D.M.brushed();
    for (const xx of [x0 + 0.13, x1 - 0.13]) {
      box(0.02, 0.22, len, dark, [xx, y + 0.12, zm]);                               // plinthe
      box(0.035, 0.035, len, chrome, [xx + (xx < (x0 + x1) / 2 ? 0.05 : -0.05), y + 1.0, zm]);   // main courante
    }
    for (let z = z0 + 5; z < z1 - 3; z += 18) if (!doorsZ.some((dz) => Math.abs(dz - z) < 1.5)) D.terminal(x1 - 0.12, y, z, -Math.PI / 2, [0x3a8ab8, 0x3ac870, 0xd8a62a][Math.abs(Math.round(z)) % 3]);
  };

  // ================================================================= PONT A (y 0) : cargo et machines
  const yA = S.yA;
  slab(S.x0, S.x1, S.zA, S.zEnd, yA, [], floorM, false);
  // dalle B (sol du pont B / plafond du pont A) : trous de la soute, de la volée 1, de la salle des machines
  slab(S.x0, S.x1, S.zA, 38.1, S.yB, [[86.6, S.x1, -14, 38.1], [74.2, 77, -27, -19]]);
  slab(S.x0, S.x1, 38.1, S.zEnd, S.yB, [[73, 91, 41, 53]]);       // galerie autour du réacteur
  // dalle C (pont de commandement, à l'avant) et toit du pont B ailleurs
  slab(S.x0, S.x1, S.zBow, -2, S.yC, [[77, 80, -27, -19]]);
  slab(S.x0, S.x1, -2, S.zEnd, S.yC);
  slab(68, 96, S.zBow, -2, S.yC + S.h + 0.6, [], ceilM, true);   // toit du pont C
  // enveloppe intérieure (flancs, cloisons avant et arrière)
  wallX(S.zA, S.x0, S.x1, yA, S.h * 2 + 0.6, [], hullIn);
  wallX(S.zEnd, S.x0, S.x1, yA, S.h * 2 + 0.6, [], hullIn);
  wallZ(S.x1, S.zA, S.zEnd, yA, S.h, [], hullIn);
  wallZ(S.x0, S.zA, S.zEnd, yA, S.h, [[-10.8, -7.2, 3.0]], hullIn);   // sas d'abordage (bâbord)
  // coursive centrale (pont A) : cloisons x 80 / x 84 avec portes
  wallZ(CX0, S.zA, 38, yA, S.h, [[-19.8, -18, DH], [-16.4, -14.6, DH], [-10, -8.2, DH], [3, 4.8, DH], [16, 17.8, DH], [29, 30.8, DH]]);
  wallZ(CX1, S.zA, 38, yA, S.h, [[-20, -17, 3.2], [5, 9, 3.8]]);
  wallX(38, S.x0, S.x1, yA, S.h, [[81.1, 82.9, DH]]);
  // cloisons bâbord (x 66..80) : réserve | escalier | vestiaire | sas | atelier | armurerie | survie
  wallZ(74, S.zA, -18, yA);
  wallX(-18, S.x0, CX0, yA, S.h, [[68.5, 70.3, DH]]);
  wallX(-13, S.x0, CX0, yA);
  wallX(-5, S.x0, CX0, yA);
  wallX(12, S.x0, CX0, yA);
  wallX(22, S.x0, CX0, yA);
  // cloison tribord : garage | soute
  wallX(-14, CX1, S.x1, yA, S.h);
  // portes
  door('x', CX0, -18.9, yA); door('x', CX0, -15.5, yA); door('x', CX0, -9.1, yA); door('x', CX0, 3.9, yA); door('x', CX0, 16.9, yA); door('x', CX0, 29.9, yA);
  door('z', 82, 38, yA); door('z', 69.4, -18, yA);
  const airlock = door('x', S.x0, -9, yA, 3.6, 3.0, 0x5a6066);
  // signalétique au sol et aux murs de la coursive
  dressCorridor(CX0, CX1, S.zA, 38, yA, [-18.9, -15.5, -9.1, 3.9, 16.9, 29.9, -18.5, 7]);
  ledStrip(CX0 + 0.3, CX1 - 0.3, S.zA, 38, S.yB);
  for (let z = S.zA + 4; z < 38; z += 10) light(82, 3.2, z, 0xeaf2ff, 8, 10);
  sign(['PONT A', 'CARGO · MACHINES'], 1.8, [CX0 + 0.13, 2.9, -12], Math.PI / 2, '#d8d2c4', 110);
  sign(['SALLE DES MACHINES ▶'], 2.0, [CX0 + 0.13, 2.9, 34], Math.PI / 2, '#f0c050', 110);
  // ---------- sas et vestibule (z -13..-5)
  {
    box(0.3, 0.02, 3.4, yellow, [S.x0 + 1.2, yA + 0.012, -9]);
    for (let k = 0; k < 6; k++) box(0.6, 0.02, 0.12, yellow, [S.x0 + 0.6 + k * 0.9, yA + 0.012, -10.9]);
    const scr = new Screen(256, 128, (c, w, h, t) => {
      c.fillStyle = '#0a1a14'; c.fillRect(0, 0, w, h); c.fillStyle = '#7dff9a'; c.font = `700 22px ${FONT}`; c.fillText('SAS · PRESSURISÉ', 12, 34);
      c.font = `500 16px ${FONT}`; c.fillStyle = '#c8f0d0'; c.fillText('101,3 kPa · O₂ 21 %', 12, 64); c.fillText(`ATALANTE ↔ HALDEN-7 · ${(t % 60).toFixed(0).padStart(2, '0')} s`, 12, 92);
    }, { period: 1, intensity: 1.2 });
    ctx.screens.push(scr);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), scr.material); sm.position.set(S.x0 + 0.14, 1.6, -11.8); sm.rotation.y = Math.PI / 2; scene.add(sm);
    for (let x = 69.5; x < 79; x += 1.0) box(0.9, 2.0, 0.5, mats.paint(0x3a4a5a, { grime: 0.4 }), [x, 1.0, -12.6], true);   // casiers contre la cloison
    F.bench(73, yA, -5.6, 3.0);
    light(73, 3.2, -9, 0xdff0ff, 10, 9);
    sign(['FRÉGATE ATALANTE', 'IMMATRICULATION HT-4471'], 2.4, [72, 3.0, -12.88], 0, '#e8e2d2', 100);
    out.spots.airlock = new THREE.Vector3(S.x0 + 2, yA, -9);
  }
  // ---------- vestiaire des scaphandres (z -18..-13)
  {
    for (let x = 67; x < 79; x += 1.4) { box(1.1, 2.2, 0.7, mats.paint(0x2a3440, { grime: 0.5 }), [x + 0.5, 1.1, -17.5], true); box(0.9, 0.06, 0.02, ledCyan, [x + 0.5, 2.05, -17.14]); }
    F.bench(73, yA, -15.2, 4);
    light(73, 3.2, -15.5, 0xdff0ff, 8, 8);
  }
  // ---------- réserve (x 66..74, z -30..-18)
  {
    for (const [x, z, k] of [[67.5, -28.5, 0], [69.2, -28.5, 1], [67.5, -26.6, 2], [71, -28.6, 3], [72.6, -26, 1], [67.6, -22, 4], [69.3, -21.8, 0]]) crate(ctx, x, 0, z, k * 0.3, 1, k % 5);
    for (const [x, z] of [[72.5, -21], [72.5, -22.2]]) barrel(ctx, x, 0, z, 0x2b5e8c);
    box(0.5, 3.2, 7, dark, [S.x0 + 0.4, 1.6, -24]);      // rayonnage
    for (let y = 0.6; y < 3; y += 0.8) box(0.6, 0.05, 7, trim, [S.x0 + 0.45, y, -24]);
    light(70, 3.2, -24, 0xfff2e0, 7, 8);
  }
  // ---------- atelier (z -5..12)
  {
    workbench(ctx, 68, -1, Math.PI / 2); workbench(ctx, 68, 4, Math.PI / 2); toolChest(ctx, 68, 9, Math.PI / 2, 0xa3241b);
    gasRack(ctx, 77.6, 9.5, -Math.PI / 2);
    D.toolWall(66.14, 0, 1.5, Math.PI / 2, 2.6); D.toolWall(66.14, 0, 6.5, Math.PI / 2, 2.0);
    D.terminal(79.87, 0, 7.2, -Math.PI / 2); D.pallet(75.2, 0, 10.3, 0.15, 2, 3);
    D.rack(70.8, 0, -4.4, 0, 1, 2, 2);
    for (const [x, z] of [[74, 1], [75.5, 6]]) crate(ctx, x, 0, z, 0.4, 1.2, 2);
    box(4, 0.08, 6, mats.paint(0x3a3e42, { grime: 0.8 }), [75, yA + 0.04, 3.5]);
    light(73, 3.2, 3.5, 0xfff2e0, 12, 11);
  }
  // ---------- armurerie (z 12..22)
  {
    for (let z = 13; z < 21.5; z += 1.6) { box(0.4, 2.4, 1.3, dark, [S.x0 + 0.35, 1.2, z + 0.6], true); for (let k = 0; k < 4; k++) box(0.06, 0.9, 0.08, trim, [S.x0 + 0.6, 1.4, z + 0.2 + k * 0.28]); }
    box(4, 0.95, 1.2, mats.paint(0x2a3038, { grime: 0.5 }), [74, 0.48, 17], true);
    box(4.1, 0.05, 1.3, ledRed, [74, 0.97, 17]);
    light(73, 3.2, 17, 0xffd0c0, 8, 9);
  }
  // ---------- survie (recycleurs d'air, réservoirs) z 22..38
  {
    for (const [x, z] of [[68, 25], [68, 29], [68, 33]]) { const g = new THREE.CylinderGeometry(0.9, 0.9, 3.4, 18); B.add(g, mats.paint(0x6a7a86, { grime: 0.5 }), new THREE.Matrix4().makeTranslation(x, 1.7, z), { cast: false, collide: true }); box(1.9, 0.12, 0.12, yellow, [x, 2.6, z]); }
    for (const z of [25, 31]) { box(2.6, 2.2, 1.4, mats.paint(0x3e4650, { grime: 0.5 }), [76, 1.1, z], true); box(2.2, 0.5, 0.02, ledCyan, [76, 1.6, z - 0.71]); }
    B.pipe([[70, 3.4, 24], [70, 3.4, 37], [79, 3.4, 37]], 0.18, mats.paint(0x2f6f9f, { grime: 0.5 }), { cast: false, flangeMat: dark });
    light(73, 3.2, 30, 0xd8f0ff, 9, 10);
  }
  // ---------- garage (tribord avant, z -30..-14) : véhicule de surface, outillage
  {
    const rover = mats.paint(0xd8dcde, { grime: 0.6, scratch: 0.5 });
    box(3.2, 1.4, 5.4, rover, [91, 1.25, -23], true); box(2.6, 1.0, 2.6, glass, [91, 2.4, -24.2]);
    for (const [dx, dz] of [[-1.7, -1.8], [1.7, -1.8], [-1.7, 1.8], [1.7, 1.8]]) { const g = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 18).rotateZ(Math.PI / 2); B.add(g, dark, new THREE.Matrix4().makeTranslation(91 + dx, 0.55, -23 + dz), { cast: false }); }
    toolChest(ctx, 96.5, -16, Math.PI, 0x2a5a8a); extinguisher(ctx, 97.6, 0.6, -19, -Math.PI / 2);
    for (let k = 0; k < 8; k++) box(0.6, 0.015, 0.25, yellow, [86.5 + k * 1.4, yA + 0.012, -15]);
    light(91, 3.4, -22, 0xfff2e0, 12, 12);
  }
  // ---------- soute (tribord, z -14..38, double hauteur) : conteneurs, portique, filets
  {
    const cols = [0x8a3a2a, 0x2a5a7a, 0x5a6a3a, 0xb07a2a, 0x3a3e44];
    let k = 0;
    for (const z of [-8, 0, 8, 22, 30]) { container(ctx, 94.2, 0, z, 0, cols[k % 5], `ATL-${100 + k * 7}`); if (k % 2 === 0) container(ctx, 94.2, 2.6, z, 0, cols[(k + 2) % 5], `ATL-${200 + k * 3}`); k++; }
    for (const z of [-6, 4, 26]) container(ctx, 90.4, 0, z, 0, cols[(k++) % 5], `ATL-${300 + k}`);
    for (const [x, z] of [[89, 14], [90.5, 15], [89.6, 16.6]]) crate(ctx, x, 0, z, 0.3, 1.3, 3);
    D.rack(96.9, 0, 3, -Math.PI / 2, 3, 3, 1); D.rack(96.9, 0, 26.5, -Math.PI / 2, 3, 3, 4);
    for (const [x, z, r, n] of [[88.4, 33.8, 0.1, 2], [88.6, 36.1, -0.08, 3], [89.2, -10.6, 0.05, 2], [90.6, -10.4, -0.1, 1], [88.6, 19.6, 0.2, 2]]) D.pallet(x, 0, z, r, n, Math.round(x * 3 + z));
    D.palletJack(90.4, 0, 34.6, Math.PI / 2 + 0.2);
    D.terminal(84.12, 0, 10, Math.PI / 2); D.terminal(84.12, 0, 22, Math.PI / 2, 0xd8a62a);
    // portique roulant (rails sous la dalle C)
    for (const x of [86.8, 97.6]) box(0.3, 0.5, 52, dark, [x, S.yC - 0.9, 12]);
    box(11, 0.6, 0.6, yellow, [92.2, S.yC - 1.3, 10]); box(0.8, 0.8, 0.8, dark, [92.2, S.yC - 1.9, 10]);
    B.cable([92.2, S.yC - 2.2, 10], [92.2, 3.2, 10], 0, 0.03, dark);
    // marquage au sol, éclairage puissant
    for (const z of [-12, 36]) box(11, 0.02, 0.3, yellow, [92, 0.012, z]);
    for (const z of [-4, 12, 28]) { light(92, 7, z, 0xf4f8ff, 22, 18); ledStrip(88, 96, z - 1, z + 1, S.yC, ledW); }
    sign(['SOUTE PRINCIPALE', 'CHARGE MAX 2 400 T'], 3.2, [S.x1 - 0.13, 6.4, 12], -Math.PI / 2, '#e8e2d2', 110);
  }
  // ---------- salle des machines (z 38..56, double hauteur) : réacteur, échangeurs, pupitres
  {
    const rc = new THREE.Vector3(82, 0, 47);
    B.add(new THREE.CylinderGeometry(2.6, 3.0, 8.4, 32, 1, false), mats.metal(0x5a6066, { rough: 0.35 }), new THREE.Matrix4().makeTranslation(rc.x, 4.2, rc.z), { cast: false, collide: true });
    for (const y of [1.2, 3.0, 4.8, 6.6]) B.add(new THREE.TorusGeometry(2.75, 0.12, 8, 40).rotateX(Math.PI / 2), ledCyan, new THREE.Matrix4().makeTranslation(rc.x, y, rc.z), { cast: false });
    for (let a = 0; a < 6; a++) { const ang = (a / 6) * Math.PI * 2; B.pipe([[rc.x + Math.cos(ang) * 2.8, 7.4, rc.z + Math.sin(ang) * 2.8], [rc.x + Math.cos(ang) * 6.5, 7.4, rc.z + Math.sin(ang) * 6.5], [rc.x + Math.cos(ang) * 6.5, 0.4, rc.z + Math.sin(ang) * 6.5]], 0.22, mats.paint(0x9a6a2a, { grime: 0.6 }), { cast: false, flangeMat: dark }); }
    for (const [x, z, ry] of [[70, 42, Math.PI / 2], [70, 50, Math.PI / 2], [94, 46, -Math.PI / 2]]) { box(1.6, 1.0, 0.8, dark, [x, 0.5, z], true, [0, ry, 0]); box(1.4, 0.5, 0.05, ledCyan, [x + Math.sin(ry) * 0.43, 1.15, z + Math.cos(ry) * 0.43], false, [0, ry, 0]); }
    box(12, 0.02, 12, mats.paint(0x2a2e32, { grime: 0.7 }), [82, 0.012, 47]);
    D.valvePanel(66.2, 0, 46, Math.PI / 2, 3); D.valvePanel(97.8, 0, 51.5, -Math.PI / 2, 3);
    D.terminal(97.86, 0, 41.5, -Math.PI / 2, 0x3ac870); D.terminal(66.14, 0, 53.5, Math.PI / 2, 0xd8a62a);
    D.rack(74, 0, 55.3, Math.PI, 2, 2, 6); D.pallet(90.5, 0, 54.6, 0.1, 2, 9);
    for (const x of [72, 92]) for (const z of [39.4, 54.6]) box(1.2, 0.012, 0.3, yellow, [x, 0.02, z]);
    rail([73, 41], [91, 41], S.yB); rail([73, 53], [91, 53], S.yB); rail([73, 41], [73, 53], S.yB); rail([91, 41], [91, 53], S.yB);
    for (const z of [41, 53]) light(82, 6, z, 0x9fe8ff, 18, 16);
    light(70, 3, 47, 0xffd0a0, 8, 10);
    out.spots.reactor = rc.clone();
  }

  // ================================================================= ESCALIER (x 74..80, z -30..-17)
  flight(74.4, 76.8, -19, 0, -27, S.yB);          // A -> B (vers l'avant)
  flight(77.2, 79.6, -27, S.yB, -19, S.yC);       // B -> C (vers l'arrière)
  wallZ(74, -30, -17, S.yB, S.h, [[-29.6, -27.6, DH]]);   // infirmerie <-> palier B
  wallX(-17, 74, CX0, S.yB);
  rail([77, -27], [77, -19], S.yB);
  rail([77, -27], [77, -19], S.yC); rail([77, -27], [80, -27], S.yC);
  wallX(-30, 74, CX0, S.yC, S.h, [], wallM);
  wallZ(74, -31, -17, S.yC); wallX(-17, 74, CX0, S.yC);
  box(5.6, 0.3, 0.15, ledWarm, [77, S.yC - 0.3, -29.85]);
  light(77, 7, -24, 0xfff2e0, 10, 12);
  sign(['▲ PONT B · ÉQUIPAGE', '▲ PONT C · COMMANDEMENT'], 1.6, [79.86, 2.6, -17.6], -Math.PI / 2, '#e8e2d2', 90);

  // ================================================================= PONT B (y 4.6) : équipage
  const yB = S.yB;
  wallZ(CX0, S.zA, 38, yB, S.h, [[-30, -27.4, DH + 0.4], [-14.5, -12.7, DH], [-6.2, -4.4, DH], [2, 3.8, DH], [10.3, 12.1, DH], [19.5, 21.3, DH], [32, 33.8, DH]]);
  wallZ(CX1, S.zA, -14, yB, S.h, [[-21.5, -19.7, DH]]);
  wallX(-14, CX1, S.x1, yB);
  wallZ(S.x0, S.zA, 38.1, yB, S.h, [[19, 35, 2.6]], hullIn);     // baies du réfectoire (bâbord)
  wallZ(S.x1, S.zA, -14, yB, S.h, [[-28, -16, 2.8]], hullIn);    // baies du salon d'observation (tribord)
  wallZ(S.x1, -14, S.zEnd, yB, S.h, [], hullIn);
  wallZ(S.x0, 38.1, S.zEnd, yB, S.h, [], hullIn);
  for (const [x, z0, z1] of [[S.x0, 19, 35], [S.x1, -28, -16]]) box(0.04, 2.2, z1 - z0, glass, [x, yB + 0.6 + 1.1, (z0 + z1) / 2], true);
  wallX(38.1, S.x0, S.x1, yB, S.h, [[81.1, 82.9, DH]]);
  dressCorridor(CX0, CX1, S.zA, -14, yB, [-28.6, -20.6]); dressCorridor(CX0, CX1, -14, 38, yB, [-13.6, -5.3, 2.9, 11.2, 20.4, 32.9]);
  // coursive au-dessus de la soute : garde-corps, éclairage
  rail([86.6, -14], [86.6, 38], yB);
  ledStrip(CX0 + 0.3, CX1 - 0.3, S.zA, 38, S.yC);
  for (let z = S.zA + 4; z < 38; z += 10) light(82, yB + 3.2, z, 0xeaf2ff, 7, 10);
  sign(['PONT B', 'ÉQUIPAGE'], 1.6, [CX0 + 0.13, yB + 2.9, -9], Math.PI / 2, '#d8d2c4', 110);
  door('x', CX0, -13.6, yB); door('x', CX0, -5.3, yB); door('x', CX0, 2.9, yB); door('x', CX0, 11.2, yB); door('x', CX0, 20.4, yB); door('x', CX0, 32.9, yB);
  door('x', CX1, -20.6, yB); door('z', 82, 38.1, yB); door('x', 74, -28.6, yB);
  // ---------- infirmerie (x 66..74, z -30..-17)
  {
    box(7.7, 0.02, 12.7, mats.plastic(0xd8e2e4, 0.35), [70, yB + 0.02, -23.5]); D.cozy(66.11, 73.89, -29.89, -17.11, yB, S.h, '', 0xf0f4f4);
    for (const z of [-28, -24.5]) D.medBed(68.4, yB, z, -Math.PI / 2);
    box(2.4, 0.03, 0.03, trim, [68.4, yB + 2.45, -26.25]); box(2.2, 2.0, 0.02, mats.plastic(0x9ac8d0, 0.9), [68.4, yB + 1.4, -26.25]);   // rideau entre les lits
    D.medCabinet(66.5, yB, -21, Math.PI / 2, 2.4, 2.1);
    D.desk(72.6, yB, -19.8, Math.PI, 1.4); F.chair(72.6, yB, -20.7, 0, 1);
    D.sideTable(70.6, yB, -22.6, 0.85);
    D.rug(70.2, yB, -26.2, 0, 3.4, 5.6, 0xc8dde2, 0x8ab0b8);
    D.ceilingPanel(68.6, yB, -28, S.h - 0.02, 1.4, 1.4, false); D.ceilingPanel(68.6, yB, -24.5, S.h - 0.02, 1.4, 1.4, false);
    D.plant(73.3, yB, -29.4, 1.0, 'potted_plant_02');
    const ms = new Screen(256, 160, (c, w, h, t) => { c.fillStyle = '#04120e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#4dff9a'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x < w; x += 4) { const p = ((x + t * 80) % 90); c.lineTo(x, 80 - (p > 40 && p < 48 ? (p - 40) * 9 : 0) + Math.sin(x * 0.1) * 2); } c.stroke(); c.fillStyle = '#c8f0d0'; c.font = `600 18px ${FONT}`; c.fillText('INFIRMERIE · BLOC 1', 10, 24); }, { period: 0.1, intensity: 1.3 });
    ctx.screens.push(ms);
    const msm = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62), ms.material); msm.position.set(S.x0 + 0.14, yB + 1.9, -26); msm.rotation.y = Math.PI / 2; scene.add(msm);
    light(70, yB + 3.2, -24, 0xf0faff, 10, 9);
    sign(['INFIRMERIE'], 1.4, [73.86, yB + 2.8, -25], -Math.PI / 2, '#7dff9a', 110);
  }
  // ---------- cabines (x 66..80, z -18..15), séparées par des cloisons
  {
    const cab = [[-17, -9], [-9, -1], [-1, 7], [7, 15]];
    for (let i = 1; i < cab.length; i++) wallX(cab[i][0], S.x0, CX0, yB);
    wallX(-17, S.x0, 74, yB);
    wallX(15, S.x0, CX0, yB);
    cab.forEach(([z0, z1], i) => {
      const zc = (z0 + z1) / 2;
      box(CX0 - S.x0 - 0.3, 0.02, z1 - z0 - 0.3, mats.plastic([0x3a4252, 0x42383a, 0x34403a, 0x3e3a46][i], 0.95), [(S.x0 + CX0) / 2, yB + 0.012, zc]);   // moquette
      // coin nuit (x 66..74.5) : lits superposés contre la cloison, bureau sous le hublot, bibliothèque, fauteuil
      D.cozy(S.x0 + 0.11, 74.43, z0 + 0.11, z1 - 0.11, yB, S.h, 'nsw', [0xd8d0c4, 0xd0d4d8, 0xd4d0c8, 0xd8d0d4][i]);
      const duv = [0x3a4a6a, 0x5a4a3a, 0x3a5a4a, 0x4a3a5a][i];
      D.bed(67.2, yB, z0 + 0.68, Math.PI / 2, { col: duv, bunk: true });
      D.desk(66.45, yB, zc + 2.2, Math.PI / 2, 1.4);
      F.chair(67.35, yB, zc + 2.2, -Math.PI / 2, i);
      D.shelves(66.3, yB, zc - 0.55, Math.PI / 2, 1.5, 1.9, 0.32, i + 1);
      // cloison chambre / petit salon (passage au centre)
      D.partition('z', z0 + 0.11, z1 - 0.11, 71.4, yB, S.h - 0.03, [[zc - 0.6, zc + 0.6, 2.2]]);
      D.art(71.47, yB + 1.75, zc + 2.4, Math.PI / 2, 1.0, 0.7, i); D.art(71.33, yB + 1.75, zc - 2.3, -Math.PI / 2, 0.8, 0.6, i + 3);
      D.armchair(72.6, yB, zc - 1.6, Math.PI / 2, [0x6a4a36, 0x3a4a5a, 0x5a3a3a, 0x4a5a48][i]);
      D.sideTable(72.5, yB, zc - 2.75);
      D.floorLamp(72.0, yB, zc - 3.3);
      D.rug(73.0, yB, zc - 1.6, Math.PI / 2, 2.2, 1.6, 0x5a5048, 0x2a2420);
      D.rug(68.8, yB, zc, 0, 2.2, 2.2, [0x6a5a48, 0x4a5a6a, 0x5a4a5a, 0x4a5a4a][i]);
      D.wardrobe(72.9, yB, z1 - 0.38, Math.PI, 1.5, 2.3, 0.56, [0x3a3e46, 0x463e36, 0x363e3a, 0x3e3646][i]);
      D.plant(68.9, yB, z1 - 0.4, 0.9, i % 2 ? 'potted_plant_02' : 'potted_plant_04');
      D.sconce(66.14, yB + 1.55, z0 + 1.7, Math.PI / 2);
      D.ceilingPanel(68.7, yB, zc, S.h - 0.02, 1.4, 1.0); D.ceilingPanel(73, yB, zc - 1, S.h - 0.02, 0.8, 0.8);
      box(0.05, 0.8, 1.4, mats.glass(0x203040, 0.3), [74.38, yB + 1.6, zc - 1.6]); box(0.02, 0.7, 1.3, ledCyan, [74.34, yB + 1.6, zc - 1.6]);
      // cabinet de toilette (entrée, x 74.5..80) : douche, WC suspendu, lavabo, armoire d'entrée
      wallZ(74.5, z0, z1, yB, S.h, [[zc + 1.2, zc + 2.6, 2.2]], wallWarm, 0.14);
      D.shower(77.6, yB, z0 + 0.95, 0, 1.5, 1.75);
      box(0.06, 2.1, 1.75, mats.glass(0xd0e4ee, 0.22), [76.82, yB + 1.08, z0 + 0.95]);
      D.toilet(79.55, yB, z0 + 0.5, -Math.PI / 2);
      D.vanity(78.3, yB, z1 - 0.32, Math.PI);
      D.wardrobe(79.5, yB, zc + 2.9, -Math.PI / 2, 1.5, 2.3, 0.56, 0x4a4e56);
      box(5.2, 0.02, z1 - z0 - 0.3, mats.ph('large_grey_tiles', 0xd8d8d4, { rough: 0.6, metal: 0, grime: 0.1, scratch: 0.1 }), [77.25, yB + 0.016, zc]);
      D.ceilingPanel(77.4, yB, zc, S.h - 0.02, 0.9, 0.9, false);
      box(0.04, 0.6, 1.0, ledWarm, [S.x0 + 0.14, yB + 1.6, zc + 2.2]);      // hublot éclairé (écran-fenêtre)
      light(68.7, yB + 3.2, zc, 0xffd9a8, 6, 7); light(73, yB + 3.0, zc - 1, 0xffd9a8, 3, 4);
      light(77.5, yB + 3.2, zc, 0xf4f8ff, 4, 5);
      sign([`CABINE ${['B1', 'B2', 'B3', 'B4'][i]}`], 0.9, [CX0 + 0.13, yB + 2.65, zc + (i === 0 ? 3.5 : 0)], Math.PI / 2, '#e8e2d2', 100);
      out.seats.push({ p: new THREE.Vector3(67.2, yB + 0.55, z0 + 0.68), yaw: 0, taken: null });
    });
  }
  // ---------- réfectoire et cuisine (x 66..80, z 15..38) : baies sur l'espace
  {
    for (const [z, k] of [[20, 0], [25, 1], [30, 2], [35, 3]]) { F.table(69.5, yB, z, k, 0.738, 0.9); for (const a of [0, Math.PI]) F.chair(69.5 + Math.sin(a) * 0.9, yB, z + Math.cos(a) * 0.9, a + Math.PI, k + 1); out.seats.push({ p: new THREE.Vector3(69.5, yB, z - 0.9), yaw: 0, taken: null, table: new THREE.Vector3(69.5, yB + 0.74, z) }); }
    // cuisine : plans de travail, plaques, hotte, réfrigérateur
    box(1.0, 0.92, 9, mats.smooth(0xc8ccd0, 0.3, 0.9, { grime: 0.2, rust: 0 }), [78.9, yB + 0.46, 27], true);
    box(1.0, 0.04, 9.1, mats.plastic(0x1a1a1a, 0.3), [78.9, yB + 0.94, 27]);
    for (const z of [24, 26]) box(0.6, 0.01, 0.6, ledRed, [78.9, yB + 0.965, z]);
    box(1.0, 0.5, 3, mats.smooth(0xb8bcc0, 0.3, 0.95, { grime: 0.2, rust: 0 }), [78.9, yB + 3.0, 25]);
    box(0.9, 2.1, 1.2, mats.smooth(0xd8dcde, 0.3, 0.8, { grime: 0.1, rust: 0 }), [79, yB + 1.05, 33.5], true);
    box(4.2, 1.0, 0.7, mats.plastic(0x3a3e44, 0.5), [75.5, yB + 0.5, 22], true); box(4.3, 0.05, 0.8, mats.plastic(0xe8e8e8, 0.3), [75.5, yB + 1.02, 22]);
    for (let z = 18; z < 38; z += 5) { light(71, yB + 3.2, z, 0xffd9a8, 8, 8); F.lamp(69.5, yB + 2.4, z, yB + S.h); }
    box(13.8, 0.02, 22.8, floorTile, [73, yB + 0.012, 26.5]);
    D.cozy(66.11, 79.89, 15.11, 37.89, yB, S.h, '', 0xd4ccc0);
    D.clad('z', 15.11, 37.89, 79.89, -1, yB, S.h - 0.03, [[19.5, 21.3, DH], [32, 33.8, DH]], 0x6a4a34);
    D.clad('x', 66.11, 79.89, 15.11, 1, yB, S.h - 0.03, [], 0x6a4a34); D.clad('x', 66.11, 79.89, 37.99, -1, yB, S.h - 0.03, [], 0x6a4a34);
    if (ctx.models) {
      const Mo = ctx.models;
      Mo.place(B, 'wooden_cutting_board', 78.9, yB + 0.96, 28.6, { fit: ['max', 0.45], ry: 0.3 });
      for (const [id, dz] of [['lemon', 0], ['food_lime_01', 0.1], ['yellow_onion', 0.22], ['food_apple_01', -0.14]]) Mo.place(B, id, 79.0, yB + 0.96, 29.6 + dz, { fit: ['max', 0.08] });
      Mo.place(B, 'croissant', 75.2, yB + 1.045, 22, { fit: ['max', 0.14] }); Mo.place(B, 'croissant', 75.5, yB + 1.045, 22.1, { fit: ['max', 0.14], ry: 1 });
      Mo.place(B, 'carrot_cake', 76.3, yB + 1.045, 22, { fit: ['max', 0.24] });
      for (const [z, k] of [[20, 0], [25, 1], [30, 2], [35, 3]]) Mo.place(B, ['food_apple_01', 'food_kiwi_01', 'food_pomegranate_01', 'lemon'][k], 69.5, yB + 0.745, z + 0.05, { fit: ['max', 0.08] });
      Mo.place(B, 'potted_plant_04', 67, yB, 37, { fit: ['y', 1.3] }); Mo.place(B, 'potted_plant_04', 67, yB, 16, { fit: ['y', 1.1] });
    }
    sign(['RÉFECTOIRE'], 1.6, [CX0 + 0.13, yB + 2.9, 24], Math.PI / 2, '#ffd27a', 110);
    out.spots.galley = new THREE.Vector3(77.9, yB, 26); out.spots.mess = new THREE.Vector3(72, yB, 27);
  }
  // ---------- salon d'observation (tribord avant, x 84..98, z -30..-14)
  {
    box(13.7, 0.02, 15.7, M_parquet, [91, yB + 0.02, -22]); D.cozy(84.11, 97.8, -29.9, -14.1, yB, S.h, '', 0xe0d8cc);
    D.clad('z', -29.89, -14.11, 84.11, 1, yB, S.h - 0.03, [[-21.5, -19.7, DH]], 0x5a3a24); D.clad('x', 84.11, 97.89, -14.11, -1, yB, S.h - 0.03, [], 0x5a3a24); D.clad('x', 84.11, 97.89, -29.89, 1, yB, S.h - 0.03, [], 0x5a3a24);
    for (const [z, c] of [[-26.5, 0x3a4a5a], [-20, 0x5a4a3a]]) {
      D.sofa(93.4, yB, z, Math.PI / 2, 2.6, c);
      D.coffeeTable(95, yB, z, Math.PI / 2, 1.2, 0.6);
      D.armchair(95.2, yB, z - 2.0, 0, 0x6a4a36); D.armchair(95.2, yB, z + 2.0, Math.PI, 0x6a4a36);
      D.rug(94.6, yB, z, Math.PI / 2, 4.6, 3.2, 0x5a6470, 0x2a2e34);
      D.floorLamp(92.6, yB, z - 1.6);
      D.ceilingPanel(94.5, yB, z, S.h - 0.02, 2.4, 0.5);
    }
    D.slats('x', 89.5, 96.6, -23.25, yB, 2.2, 0x5a3a24); D.planterBox(88.6, yB, -23.25, 0, 1.4);
    F.planter(87, yB, -28, 0.8); F.planter(87, yB, -16, 0.8);
    ctx.models?.place(B, 'potted_plant_04', 87, yB + 0.62, -28, { fit: ['y', 1.2] });
    ctx.models?.place(B, 'potted_plant_04', 87, yB + 0.62, -16, { fit: ['y', 1.1] });
    D.bottleWall(84.35, yB, -23.2, Math.PI / 2, 2.4);
    D.art(84.13, yB + 1.8, -27.5, Math.PI / 2, 1.4, 0.9, 7); D.art(84.13, yB + 1.8, -17.2, Math.PI / 2, 1.4, 0.9, 9);
    light(91, yB + 3.2, -22, 0xffe8d0, 8, 10);
    sign(['SALON D\'OBSERVATION'], 1.8, [CX1 - 0.13, yB + 2.9, -24], -Math.PI / 2, '#e8e2d2', 100);
  }
  // ---------- galerie du réacteur (pont B, z 38..56) : passerelle autour du puits
  {
    for (const z of [40, 54]) box(14, 0.06, 0.3, yellow, [82, yB + 0.01, z]);
    sign(['RÉACTEUR À FUSION · ACCÈS RÉGLEMENTÉ'], 3.4, [82, yB + 3.1, 55.86], Math.PI, '#f0c050', 100);
  }

  // ================================================================= PONT C (y 9.2) : commandement (avant, z -42..-2)
  const yC = S.yC;
  // enveloppe du pont C
  wallZ(68, -31, -2, yC, S.h, [[-29, -20, 2.8]], hullIn);  // baie de la cabine du capitaine
  wallZ(96, -31, -2, yC, S.h, [[-29, -5, 2.9]], hullIn);   // grande baie du salon panoramique
  for (const [x, z0, z1] of [[68, -29, -20], [96, -29, -5]]) box(0.04, 2.4, z1 - z0, glass, [x, yC + 0.4 + 1.2, (z0 + z1) / 2], true);
  wallX(-2, 68, 96, yC, S.h, [], hullIn);
  wallZ(CX0, -31, -2, yC, S.h, [[-19, -17.2, DH], [-10, -8.2, DH]]);
  wallZ(CX1, -31, -2, yC, S.h, [[-12, -10.2, DH]]);
  wallX(-17, 68, 74, yC, S.h, [[70.1, 71.9, DH]]);
  wallX(-31, 68, 96, yC, S.h, [[80.6, 83.4, 2.8]]);
  door('x', CX1, -11.1, yC); door('x', CX0, -9.1, yC); door('z', 71, -17, yC);
  ledStrip(CX0 + 0.3, CX1 - 0.3, -31, -2, yC + S.h + 0.6);
  dressCorridor(CX0, CX1, -31, -2, yC, [-18.1, -11.1, -9.1, -29.5]);
  light(82, yC + 3.2, -16, 0xeaf2ff, 7, 10);
  sign(['PONT C', 'COMMANDEMENT'], 1.6, [CX1 - 0.13, yC + 2.9, -20], -Math.PI / 2, '#d8d2c4', 110);
  // sols chauds (moquette technique) des espaces de commandement
  box(11.8, 0.02, 28.8, floorTile, [90, yC + 0.012, -16.6]); box(5.8, 0.02, 14.8, floorTile, [71, yC + 0.012, -9.5]);
  // ---------- passerelle (z -42..-31) : baie avant, pupitres, siège du commandant, table holographique
  {
    // baie vitrée inclinée face à l'avant (la planète)
    wallX(S.zBow, 68, 96, yC, 0.9, [], hullIn);
    for (const [a, b] of [[68, 72], [92, 96]]) wallX(S.zBow, a, b, yC, S.h, [], hullIn);
    wallZ(68, S.zBow, -31, yC, S.h, [], hullIn); wallZ(96, S.zBow, -31, yC, S.h, [], hullIn);
    box(20, S.h - 0.9, 0.05, glass, [82, yC + 0.9 + (S.h - 0.9) / 2, S.zBow + 0.05], true);
    for (let x = 72; x <= 92; x += 4) box(0.18, S.h - 0.9, 0.22, dark, [x, yC + 0.9 + (S.h - 0.9) / 2, S.zBow + 0.1]);
    box(28, 0.02, 11, floorTile, [82, yC + 0.012, -36.5]);
    // estrade, pupitres en arc, écrans
    box(10, 0.12, 4, mats.paint(0x2a2e33, { grime: 0.3 }), [82, yC + 0.06, -35]);
    const console = (x, z, ry) => {
      box(2.2, 0.85, 0.8, dark, [x, yC + 0.43, z], true, [0, ry, 0]);
      box(2.1, 0.06, 0.7, mats.plastic(0x16191c, 0.25), [x, yC + 0.9, z], false, [0, ry, 0]);
      box(1.9, 0.55, 0.05, ledCyan, [x - Math.sin(ry) * 0.3, yC + 1.25, z - Math.cos(ry) * 0.3], false, [0, ry, 0]);
    };
    for (const [x, z, ry] of [[73, -39.5, 0.35], [77.5, -40.2, 0.1], [86.5, -40.2, -0.1], [91, -39.5, -0.35]]) { console(x, z, ry); F.chair(x + Math.sin(ry) * 0.9, yC, z + Math.cos(ry) * 0.9, ry + Math.PI, 2); }
    F.chair(82, yC + 0.12, -34.2, Math.PI, 2); box(0.5, 0.75, 0.5, dark, [83.1, yC + 0.5, -34.2]); box(0.45, 0.04, 0.3, ledCyan, [83.1, yC + 0.9, -34.2]);
    // table holographique (planète, trajectoire)
    B.add(new THREE.CylinderGeometry(1.2, 1.3, 0.9, 32), dark, new THREE.Matrix4().makeTranslation(82, yC + 0.45, -37), { cast: false, collide: true });
    B.add(new THREE.TorusGeometry(1.15, 0.03, 6, 40).rotateX(Math.PI / 2), ledCyan, new THREE.Matrix4().makeTranslation(82, yC + 0.92, -37), { cast: false });
    const holo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.9, 1.3), wireframe: true, transparent: true, opacity: 0.55 }));
    holo.position.set(82, yC + 1.75, -37); scene.add(holo); out.holo = holo;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.008, 4, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.4) }));
    ring.rotation.x = Math.PI / 2.3; holo.add(ring);
    const navS = new Screen(512, 160, (c, w, h, t) => {
      c.fillStyle = '#04101a'; c.fillRect(0, 0, w, h); c.fillStyle = '#6fdcff'; c.font = `700 26px ${FONT}`; c.fillText('ATALANTE · AMARRÉE À HALDEN-7 · SAS 3', 16, 36);
      c.font = `500 18px ${FONT}`; c.fillStyle = '#c8e8f8'; c.fillText(`Réacteur 12 % · Soute 1 840 / 2 400 t · Équipage 9`, 16, 72); c.fillText(`Prochain départ : Relais Corvin · fenêtre dans ${Math.max(0, 47 - Math.floor(t / 60) % 48)} min`, 16, 104);
      c.fillStyle = 'rgba(111,220,255,0.25)'; c.fillRect(16, 124, (w - 32) * ((t % 30) / 30), 8);
    }, { period: 0.5, intensity: 1.4 });
    ctx.screens.push(navS);
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.38), navS.material); ns.position.set(82, yC + 3.1, -31.2); ns.rotation.y = Math.PI; scene.add(ns);
    for (const x of [74, 82, 90]) light(x, yC + 3.4, -36, 0xbfe8ff, 9, 12);
    sign(['PASSERELLE'], 1.6, [82, yC + 2.9, -30.86], 0, '#6fdcff', 110);
    out.spots.helm = new THREE.Vector3(82, yC + 0.12, -34.2); out.spots.bridge = new THREE.Vector3(82, yC, -33);
  }
  // ---------- cabine du capitaine (x 68..74, z -31..-17) : lit, bureau, bibliothèque, baie
  {
    box(5.8, 0.02, 13.8, mats.plastic(0x3a3430, 0.95), [71, yC + 0.012, -24]);          // moquette
    D.cozy(68.11, 73.89, -30.89, -17.11, yC, S.h, 'nse', 0xd8d0c4, 0x4a3024);
    D.doubleBed(71, yC, -29.65, 0, 0x2a3a5a);
    D.rug(71, yC, -27.6, 0, 3.0, 2.0, 0x6a2a2a, 0xc8a070);
    D.desk(72.9, yC, -19.6, Math.PI, 1.6); F.chair(72.9, yC, -20.5, 0, 2);
    D.shelves(73.78, yC, -24.3, -Math.PI / 2, 2.6, 2.3, 0.34, 7);
    D.slats('x', 68.15, 71.2, -26.15, yC, 2.7, 0x4a3024);
    D.planterBox(70.9, yC, -25.75, 0, 0.9);
    D.sofa(70.4, yC, -23.6, -Math.PI / 2, 2.2, 0x5a3a2a);
    D.coffeeTable(69.2, yC, -23.6, Math.PI / 2, 1.1, 0.6);
    D.rug(69.7, yC, -23.6, Math.PI / 2, 3.0, 2.4, 0x3a4a5a, 0xd8c8a8);
    D.floorLamp(70.6, yC, -21.8); D.plant(68.6, yC, -18.3, 1.3, 'potted_plant_04');
    D.wardrobe(68.9, yC, -17.5, 0, 1.6, 2.3, 0.56, 0x3a2a20);
    D.ceilingPanel(71, yC, -28.5, S.h - 0.02, 1.8, 1.0); D.ceilingPanel(71, yC, -22.5, S.h - 0.02, 1.8, 1.0);
    for (const x of [69.6, 72.4]) D.sconce(x, yC + 1.6, -30.86, 0);
    D.art(71, yC + 1.85, -30.87, 0, 1.4, 0.8, 1);
    light(71, yC + 3, -24, 0xffd9a8, 7, 8);
  }
  // ---------- salle de briefing (x 68..80, z -17..-2) : grande table, écran mural
  {
    box(11.7, 0.02, 14.7, mats.plastic(0x2e3238, 0.95), [74, yC + 0.02, -9.5]); D.cozy(68.11, 79.89, -16.89, -2.11, yC, S.h, '', 0xd8dce0);
    D.clad('z', -16.89, -2.11, 79.89, -1, yC, S.h - 0.03, [[-10, -8.2, DH]], 0x3a3e44); D.clad('z', -16.89, -2.11, 68.11, 1, yC, S.h - 0.03, [], 0x3a3e44);
    D.clad('x', 68.11, 79.89, -16.89, 1, yC, S.h - 0.03, [[70.1, 71.9, DH]], 0x3a3e44); D.clad('x', 68.11, 79.89, -2.11, -1, yC, S.h - 0.03, [], 0x3a3e44);
    D.confTable(74, yC, -9.5, 0, 5.6, 1.9);
    D.rug(74, yC, -9.5, 0, 7.6, 4.2, 0x2a3440, 0x1a1e24);
    for (const z of [-15.8, -3.2]) { D.plant(69, yC, z, 1.2, 'potted_plant_02'); D.ceilingPanel(74, yC, z + (z < -9 ? 3 : -3), S.h - 0.02, 3.6, 0.4, false); }
    D.ceilingPanel(74, yC, -9.5, S.h - 0.02, 5.0, 1.2, false);
    D.wardrobe(78.9, yC, -15, -Math.PI / 2, 2.4, 1.0, 0.5, 0x2a2e34);
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) F.chair(71.9 + k * 1.4, yC, -9.5 + s * 1.35, s > 0 ? Math.PI : 0, 2);
    const bs = new Screen(384, 200, (c, w, h, t) => { c.fillStyle = '#081018'; c.fillRect(0, 0, w, h); c.strokeStyle = '#6fdcff'; c.strokeRect(10, 10, w - 20, h - 20); c.fillStyle = '#e8f4ff'; c.font = `700 22px ${FONT}`; c.fillText('ROUTE HALDEN-7 → CORVIN', 22, 44); c.strokeStyle = '#ffd27a'; c.beginPath(); c.moveTo(40, 160); c.quadraticCurveTo(190, 60 + Math.sin(t) * 6, 340, 120); c.stroke(); c.fillStyle = '#ff6a4a'; c.beginPath(); c.arc(220, 104, 6, 0, 7); c.fill(); c.fillStyle = '#c8d8e8'; c.font = `500 15px ${FONT}`; c.fillText('Zone de risque : ceinture d\'Ardent', 150, 180); }, { period: 0.4, intensity: 1.3 });
    ctx.screens.push(bs);
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.67), bs.material); bm.position.set(68.16, yC + 1.9, -9.5); bm.rotation.y = Math.PI / 2; scene.add(bm);
    light(74, yC + 3.2, -9.5, 0xeaf2ff, 9, 10);
  }
  // ---------- salon panoramique (x 84..96, z -31..-2) : fauteuils face à la baie, bar
  {
    box(11.6, 0.02, 28.6, M_parquet, [90.1, yC + 0.02, -16.5]);
    D.cozy(84.11, 95.9, -30.9, -2.1, yC, S.h, '', 0xe0d8cc);
    D.clad('z', -30.89, -2.11, 84.11, 1, yC, S.h - 0.03, [[-12, -10.2, DH]], 0x5a3a24);          // mur côté coursive (porte)
    D.clad('x', 84.11, 95.89, -30.89, 1, yC, S.h - 0.03, [], 0x5a3a24); D.clad('x', 84.11, 95.89, -2.11, -1, yC, S.h - 0.03, [], 0x5a3a24);
    for (const [z, c] of [[-26, 0x3a4652], [-17.6, 0x5a4636], [-9.2, 0x3e4a3e]]) {
      D.rug(93.4, yC, z, 0, 3.6, 4.4, [0x8a7a64, 0x5a6470, 0x7a6a5a][Math.abs(Math.round(z)) % 3], 0x2a2420);
      D.sofa(92.4, yC, z, Math.PI / 2, 2.6, c);
      D.coffeeTable(93.9, yC, z, Math.PI / 2, 1.2, 0.6);
      D.armchair(94.1, yC, z - 1.95, 0, 0x7a5a3a); D.armchair(94.1, yC, z + 1.95, Math.PI, 0x7a5a3a);
      D.floorLamp(91.6, yC, z - 1.7);
      D.ceilingPanel(93, yC, z, S.h - 0.02, 2.6, 0.5);
    }
    for (const z of [-21.8, -13.4]) { D.slats('x', 89, 94.6, z, yC, 2.2, 0x5a3a24); D.planterBox(88.2, yC, z, 0, 1.4); }
    D.bar(86.4, yC, -16, Math.PI / 2, 6);
    for (const [z, k] of [[-27, 2], [-8.5, 3], [-4.2, 4]]) D.art(84.13, yC + 1.8, z, Math.PI / 2, 1.6, 1.0, k);
    for (let z = -18.4; z < -13; z += 1.2) D.stool(87.3, yC, z);
    D.bottleWall(84.35, yC, -16, Math.PI / 2, 5);
    for (const z of [-30.3, -3]) D.plant(85, yC, z, 1.4, 'potted_plant_04', z);
    D.plant(95.6, yC, -13.2, 1.1, 'potted_plant_02'); D.plant(95.6, yC, -22, 1.1, 'potted_plant_02');
    for (const z of [-24, -14, -6]) light(90, yC + 3.2, z, 0xffe0c0, 7, 9);
    out.spots.lounge = new THREE.Vector3(91, yC, -16);
  }

  // ================================================================= TUBE D'ABORDAGE (hangar x 32 -> sas x 66, z -9)
  {
    const z = SHIPLOCK.z, w = 3.6, hh = 3.2, xa = HX + 0.3, xb = S.x0;
    const L = xb - xa, xc = (xa + xb) / 2;
    box(L, 0.1, w, floorM, [xc, -0.05, z], true, null, 3);
    box(L, 0.4, w + 0.6, dark, [xc, -0.3, z]);
    for (const s of [-1, 1]) { box(L, hh, 0.12, mats.paint(0x6a7076, { kind: 'service', uv: 2, grime: 0.5 }), [xc, hh / 2, z + s * w / 2], true); box(L, 0.12, 0.2, ledW, [xc, hh - 0.2, z + s * (w / 2 - 0.12)]); }
    box(L, 0.15, w, mats.paint(0x3a3e42, { grime: 0.5 }), [xc, hh, z]);
    // hublots du tube (un sur deux allumé côté extérieur)
    for (let x = xa + 3; x < xb - 2; x += 4) for (const s of [-1, 1]) { box(1.4, 0.6, 0.04, glass, [x, 1.6, z + s * (w / 2 - 0.07)]); }
    for (let x = xa + 1; x < xb; x += 3) for (const s of [-1, 1]) box(0.18, hh, 0.3, dark, [x, hh / 2, z + s * (w / 2 + 0.06)]);
    // arceaux extérieurs et soufflets aux deux extrémités
    for (let x = xa + 6; x < xb; x += 4) B.add(new THREE.TorusGeometry(w / 2 + 0.4, 0.14, 6, 20, Math.PI).rotateY(Math.PI / 2), mats.paint(0x5d6368, { grime: 0.7 }), new THREE.Matrix4().makeTranslation(x, hh - 1.6, z), { cast: false });
    for (let x = xa + 2; x < xb - 1; x += 6) light(x, hh - 0.4, z, 0xeaf2ff, 5, 7);
    door('x', HX - 0.3, z, 0, 3.6, 3.0, 0x5a6066);                      // porte côté hangar
    sign(['SAS 3 · FRÉGATE ATALANTE', 'EMBARQUEMENT ÉQUIPAGE'], 3.2, [HX - 0.02, 4.1, z], -Math.PI / 2, '#f0c050', 110);
    out.spots.tubeHangar = new THREE.Vector3(HX - 1.5, 0, z);
  }

  // ================================================================= COQUE EXTÉRIEURE (constructeur à part, sans collisions)
  B.tagFn = null;
  // objets ajoutés directement à la scène à l'intérieur (portes, lampes, écrans, enseignes) : même masquage
  for (const o of scene.children) {
    if (sceneBefore.has(o) || o.isLight || o === out.holo) continue;
    const p = o.position;
    if (p.x > S.x0 - 1 && p.x < S.x1 + 1 && p.z > S.zBow - 1 && p.z < S.zEnd + 1 && p.y > -1 && p.y < 15) out.interior[deckOf(p.y)].push(o);
  }
  const E = new Builder(null); E.cellSize = 1000;
  out.exterior = atalanteExterior(ctx, E);
  const em = E.finalize(scene);
  for (const m of em) { m.castShadow = false; m.receiveShadow = false; }

  out.inside = (p) => p.x > S.x0 - 1 && p.x < S.x1 + 1 && p.z > S.zBow - 1 && p.z < S.zEnd + 1 && p.y > -1 && p.y < 15;
  out.near = (p) => (p.x > HX - 4 && p.x < S.x1 + 6 && p.z > S.zBow - 10 && p.z < S.zEnd + 10 && p.y > -2 && p.y < 18);
  /** maillages fusionnés de la station : récupère ceux de l'intérieur du vaisseau (étiquetés) */
  out.registerMeshes = (list) => { for (const m of list) { const t = m.userData.tag; if (t && t.startsWith('ship')) out.interior[t.slice(4)].push(m); } };
  out.visibleDecks = null;   // (null : force le premier passage)
  out.updateCull = (p, force = false) => {
    // cage d'escalier (x 73..81, z -31..-16) : vue plongeante jusqu'au pont A depuis le pont C
    const stair = p && p.x > 73 && p.x < 81 && p.z > -31 && p.z < -16;
    const show = !p || !out.near(p) ? '' : !out.inside(p) ? 'A' : p.y < 4.0 ? 'AB' : p.y < 8.6 || stair ? 'ABC' : 'BC';
    if (show === out.visibleDecks && !force) return;
    out.visibleDecks = show;
    for (const k of ['A', 'B', 'C']) for (const m of out.interior[k]) m.visible = show.includes(k);
  };
  ctx.updaters.push(() => out.updateCull(ctx.cullFromCamera ? ctx.camera.position : ctx.player?.pos));
  for (const l of out.lights) l.userData.ship = true;
  ctx.updaters.push((dt, t) => { if (out.holo) { out.holo.rotation.y += dt * 0.3; out.holo.visible = out.near(ctx.player?.pos || new THREE.Vector3(1e9, 0, 0)); } });
  void airlock; void neonTexture; void neonMaterial; void low;
  return out;
}

// ------------------------------------------------------------------ coque extérieure de l'Atalante
// Frégate d'escorte « used future » construite avec hullkit2 : coque lissée à sections chanfreinées
// (deux tons, ventre en composite sombre), château de commandement à verrière inclinée, quille ventrale,
// ceinture blindée, baies réelles (percées dans la coque, embrasures jusqu'aux cloisons intérieures),
// collier d'abordage autour du tube du sas 3, tuyères en cloche, radiateurs, antennes, RCS, livrée.
// Contrat géométrique : l'intérieur (x 66..98, y 0..13,8, z -42..56) est entièrement enveloppé ; la peau
// est à simple face (normales sortantes) : vue de l'intérieur, elle n'est jamais dessinée devant une baie.
// Tout est regroupé par matériau puis ajouté à E (un appel de rendu par matériau, aucune collision).
function atalanteExterior(ctx, E) {
  const { mats } = ctx;
  const PI = Math.PI, TAU = PI * 2, CX = S.cx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const K = kitMaterials(mats, { hull: 0x9ea19f, dark: 0x2e3236, accent: 0x8f2f20, service: 0x63686d });
  const NZ = nozzleMaterials(mats, { glow: 0x9cc4ff, idle: 0.3, key: 'atalante' });
  const fin = mats.smooth(0xb9bcbd, 0.36, 0.85, { grime: 0.5, scratch: 0.4, rust: 0, floor: 0 });
  const M = { ...K, ...NZ, fin, lens: K.lensWhite };
  // vitrages : verre fumé épais, lueur intérieure (dégradé : plafonniers en haut, quelques stores baissés)
  const glassMat = (key, em, ei, seed) => {
    const ck = 'ata_glass_' + key;
    if (mats.cache[ck]) return mats.cache[ck];
    const c = mkCanvas(64, 32), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 32);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, '#c8c8c8'); gr.addColorStop(0.6, '#5a5a5a'); gr.addColorStop(1, '#262626');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 32);
    let r = seed;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let x = 0; x < 64; x += 4) { const k = rnd(); if (k < 0.3) { g.fillStyle = `rgba(0,0,0,${0.45 + k})`; g.fillRect(x, 0, 4, 32); } else if (k > 0.85) { g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x, 0, 4, 14); } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ color: 0x1c242b, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.25, emissive: em, emissiveIntensity: ei, emissiveMap: t, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    return (mats.cache[ck] = m);
  };
  const glassLit = glassMat('lit', 0xffc88a, 0.55, 7);
  const glassBridge = glassMat('bridge', 0x7fdcff, 0.32, 3);
  const navRed = mats.emissive(0xff2a1a, 7), navGreen = mats.emissive(0x2aff6a, 7);
  const strobe = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // ------------------------------------------------ collecte par matériau (fusion finale : un lot par matériau)
  const bag = new Map();
  let tris = 0;
  const put = (g, m, mtx) => {
    let q = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k);
    if (!q.attributes.uv) q.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
    if (!q.attributes.normal) q.computeVertexNormals();
    if (mtx) q.applyMatrix4(mtx);
    q.morphAttributes = {};
    tris += q.attributes.position.count / 3;
    (bag.get(m) || bag.set(m, []).get(m)).push(q);
  };
  const add = (g, m, p = null, r = null) => put(g, m, p || r ? Builder.matrix(p || [0, 0, 0], r) : null);
  const parts = (list, p, r = null, set = M) => addParts((g, m) => add(g, m, p, r), list, set);
  const partsM = (list, mtx, set = M) => addParts((g, m) => put(g, m, mtx), list, set);
  /** repère posé sur la coque : +Y local selon la normale de surface (lift : décollement) */
  const onHull = (hull, z, ang, ds = 0, lift = 0, spin = 0) => {
    const q = hull.point(z, ang, ds);
    const quat = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), q.n);
    if (spin) quat.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), spin));
    return new THREE.Matrix4().compose(q.p.clone().addScaledVector(q.n, lift), quat, V(1, 1, 1));
  };
  const offsetV = (g, dv) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) + dv); };

  /**
   * Peau découpée : tronçon de coque (stations), restreint aux angles polaires [A0, A1] (sens CCW), percé de
   * fenêtres { z0, z1, a0, a1 } (le tronçon doit alors être prismatique). Les coupures angulaires (breaks) sont
   * communes à tous les tronçons d'une même coque → mêmes sommets aux jonctions (aucune fente).
   */
  const holed = (stations, A0, A1, holes, breaks, matOf, o = {}) => {
    const nrm = (a) => { while (a < A0 - 1e-6) a += TAU; while (a >= A0 + TAU - 1e-6) a -= TAU; return a; };
    const zA = stations[0].z, zB = stations[stations.length - 1].z;
    const hs = holes.filter((h) => h.z1 > zA && h.z0 < zB).map((h) => ({ z0: h.z0, z1: h.z1, a0: nrm(h.a0), a1: nrm(h.a1) }));
    const as = [...new Set([A0, A1, ...breaks.map(nrm).filter((a) => a > A0 + 1e-4 && a < A1 - 1e-4)])].sort((a, b) => a - b);
    const zl = [...new Set([zA, zB, ...hs.flatMap((h) => [h.z0, h.z1]).filter((z) => z > zA && z < zB)])].sort((a, b) => a - b);
    for (let i = 0; i < zl.length - 1; i++) {
      const za = zl[i], zb = zl[i + 1], zm = (za + zb) / 2;
      const st = zl.length > 2 ? [{ ...stations[0], z: za }, { ...stations[0], z: zb }] : stations;
      for (let k = 0; k < as.length - 1; k++) {
        const a = as[k], b = as[k + 1], am = (a + b) / 2;
        if (hs.some((h) => zm > h.z0 && zm < h.z1 && am > h.a0 && am < h.a1)) continue;
        const n = Math.max(2, Math.ceil(((b - a) / TAU) * (o.rad ?? 120)));
        const h = skinHull(st, { arc: [a, b], radial: n, smooth: o.smooth ?? false, steps: o.steps ?? 1, cap0: k === 0 && !!o.cap0, cap1: k === 0 && !!o.cap1 });
        offsetV(h.geometry, za);
        add(h.geometry, matOf(am));
        if (h.cap0) add(h.cap0, o.capMat);
        if (h.cap1) add(h.cap1, o.capMat);
      }
    }
  };
  /** embrasure : parois du percement (de la peau jusqu'à `D` sous la surface), tournées vers l'ouverture */
  const reveal = (hull, o, D) => {
    const g = hull.raised({ ...o, base: -D, depth: D });
    const skip = o.segZ * o.segS * 6, P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array;
    const n = P.length / 3 - skip, p = new Float32Array(n * 3), nn = new Float32Array(n * 3), u = new Float32Array(n * 2);
    for (let t = 0; t < n; t += 3) for (let k = 0; k < 3; k++) {
      const src = skip + t + [0, 2, 1][k], dst = t + k;
      for (let c = 0; c < 3; c++) { p[dst * 3 + c] = P[src * 3 + c]; nn[dst * 3 + c] = -N[src * 3 + c]; }
      u[dst * 2] = U[src * 2]; u[dst * 2 + 1] = U[src * 2 + 1];
    }
    const w = new THREE.BufferGeometry();
    w.setAttribute('position', new THREE.BufferAttribute(p, 3)); w.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); w.setAttribute('uv', new THREE.BufferAttribute(u, 2));
    return w;
  };
  /** baie : embrasure, vitrage en retrait, cadre extérieur en relief, meneaux */
  const windowAt = (hull, w, glass, D, step = 0) => {
    const segZ = Math.max(2, Math.ceil((w.z1 - w.z0) / 1.5)), segS = 2, fw = 0.2;
    add(reveal(hull, { z0: w.z0, z1: w.z1, a0: w.a0, a1: w.a1, segZ, segS }, D), K.frame);
    add(hull.patch({ z0: w.z0, z1: w.z1, a0: w.a0, a1: w.a1, off: -0.16, segZ, segS, readable: true }), glass);
    add(hull.raised({ z0: w.z0 - fw, z1: w.z1 + fw, angle: w.a0, shift: -fw / 2, height: fw, depth: 0.12, segZ, segS: 1 }), K.frame);
    add(hull.raised({ z0: w.z0 - fw, z1: w.z1 + fw, angle: w.a1, shift: fw / 2, height: fw, depth: 0.12, segZ, segS: 1 }), K.frame);
    for (const z of [w.z0 - fw / 2, w.z1 + fw / 2]) add(hull.raised({ z0: z - fw / 2, z1: z + fw / 2, a0: w.a0, a1: w.a1, depth: 0.12, segZ: 1, segS: 2 }), K.frame);
    if (step) for (let z = w.z0 + step; z < w.z1 - step * 0.4; z += step) add(hull.raised({ z0: z - 0.08, z1: z + 0.08, a0: w.a0, a1: w.a1, base: -0.18, depth: 0.2, segZ: 1, segS: 2 }), K.frame);
  };

  // ================================================================ coque principale (ponts A et B)
  // section : trapèze chanfreiné (y -2,6..9,8, demi-largeur 17,2 → 17,0) ; ventre sombre sous la ligne W
  const W = 0.3, TOPA = 0.392;
  const SEC = { x: CX, y: 3.6, w: 17.2, tw: 17.0, h: 6.2, hb: 6.2, c: 1.3, r: 0.35 };
  const hwM = (y) => 17.2 - (0.2 * (y + 2.6)) / 12.4;
  const aM = (s, y) => { const a = Math.atan2(y - 3.6, hwM(y)); return s > 0 ? a : PI - a; };
  const win = (aF, s, z0, z1, y0, y1) => ({ z0, z1, a0: s > 0 ? aF(1, y0) : aF(-1, y1), a1: s > 0 ? aF(1, y1) : aF(-1, y0) });
  const mainWins = [
    { ...win(aM, -1, 19, 35, 4.85, 7.3), glass: glassLit, step: 2 },          // réfectoire (bâbord)
    { ...win(aM, 1, -28, -16, 4.85, 7.45), glass: glassLit, step: 2 },        // salon d'observation (tribord)
    ...[-13, -5, 3, 11].map((zc) => ({ ...win(aM, -1, zc + 1.65, zc + 2.75, 5.85, 6.55), glass: glassLit, step: 0 })),   // hublots des cabines
  ];
  const tubeHole = { z0: -11.3, z1: -6.7, a0: aM(-1, 4.3), a1: PI + W };       // tube d'abordage (sas 3)
  const mainHoles = [...mainWins, tubeHole];
  const breaksM = [-W, TOPA, PI - TOPA, PI + W, ...mainHoles.flatMap((h) => [h.a0, h.a1])];
  const matM = (am) => { const a = ((am % TAU) + TAU) % TAU; return a > PI + W - 1e-4 && a < TAU - W + 1e-4 ? K.hullDark : K.hull; };
  const bowSt = [
    { x: CX, z: -76, y: 5.6, w: 0.5, tw: 0.9, h: 1.4, hb: 2.6, c: 0.2, r: 0.15, steps: 5 },
    { x: CX, z: -70, y: 5.0, w: 3.6, tw: 5.2, h: 3.0, hb: 4.6, c: 0.7, r: 0.3, steps: 7 },
    { x: CX, z: -62, y: 4.3, w: 9.2, tw: 11.0, h: 4.4, hb: 5.9, c: 1.0, r: 0.35, steps: 7 },
    { x: CX, z: -54, y: 3.8, w: 14.2, tw: 15.2, h: 5.6, hb: 6.3, c: 1.2, r: 0.35, steps: 5 },
    { ...SEC, z: -48, steps: 2 }, { ...SEC, z: -46, steps: 1 }, { ...SEC, z: -45 },
  ];
  const aftSt = [
    { ...SEC, z: 56, steps: 3 },
    { x: CX, z: 59, y: 3.7, w: 16.6, tw: 16.2, h: 5.9, hb: 6.0, c: 1.3, r: 0.35, steps: 4 },
    { x: CX, z: 63, y: 3.8, w: 14.6, tw: 13.8, h: 5.0, hb: 5.4, c: 1.2, r: 0.35, steps: 4 },
    { x: CX, z: 67.5, y: 3.9, w: 12.6, tw: 11.6, h: 4.3, hb: 4.7, c: 1.1, r: 0.3 },
  ];
  holed(bowSt, -W, TAU - W, [], breaksM, matM, { smooth: true, cap0: true, capMat: K.hullDark });
  holed([{ ...SEC, z: -45 }, { ...SEC, z: -42.2 }], -W, TAU - W, mainHoles, breaksM, matM);
  holed([{ ...SEC, z: -42.2 }, { ...SEC, z: -1.85 }], PI - TOPA, TAU + TOPA, mainHoles, breaksM, matM);   // sous le château : pas de pont
  holed([{ ...SEC, z: -1.85 }, { ...SEC, z: 56 }], -W, TAU - W, mainHoles, breaksM, matM);
  holed(aftSt, -W, TAU - W, [], breaksM, matM, { smooth: true, cap1: true, capMat: K.service });
  // surfaces de référence (non dessinées) pour les pièces conformes
  const refM = skinHull([{ ...SEC, z: -46 }, { ...SEC, z: 57 }], { radial: 96, smooth: false, steps: 1 });
  const bowRef = skinHull(bowSt, { radial: 96 });
  const aftRef = skinHull(aftSt, { radial: 96 });
  for (const w of mainWins) windowAt(refM, w, w.glass, 0.92, w.step);

  // ================================================================ château de commandement (pont C)
  const SUP = { x: CX, y: 11.7, w: 15.9, tw: 14.25, h: 2.9, hb: 2.9, c: 0.7, r: 0.25 };
  const LOW = { x: CX, y: 9.35, w: 15.5, tw: 14.6, h: 0.55, hb: 0.55, c: 0.4, r: 0.2 };
  const hwS = (y) => 15.9 - (1.65 * (y - 8.8)) / 5.8;
  const aS = (s, y) => { const a = Math.atan2(y - 11.7, hwS(y)); return s > 0 ? a : PI - a; };
  const SA0 = -0.16, SA1 = PI + 0.16;
  const supWins = [
    { ...win(aS, -1, -29, -20, 9.95, 12.05), step: 1.8 },    // cabine du capitaine (bâbord)
    { ...win(aS, 1, -29, -5, 9.95, 12.1), step: 2.4 },       // salon panoramique (tribord)
  ];
  const breaksS = [0.22, PI - 0.22, ...supWins.flatMap((h) => [h.a0, h.a1])];
  const matS = () => K.hull;
  holed([{ ...LOW, z: -45.2, steps: 3 }, { ...SUP, z: -42.5 }], SA0, SA1, [], breaksS, matS, { cap0: true, capMat: K.hull });
  holed([{ ...SUP, z: -42.5 }, { ...SUP, z: -1.4 }], SA0, SA1, supWins, breaksS, matS);
  holed([{ ...SUP, z: -1.4, steps: 3 }, { ...LOW, z: 5.5 }], SA0, SA1, [], breaksS, matS, { cap1: true, capMat: K.hull });
  const refS = skinHull([{ ...SUP, z: -43 }, { ...SUP, z: -1 }], { radial: 96, smooth: false });
  const rake = skinHull([{ ...LOW, z: -45.2 }, { ...SUP, z: -42.5 }], { radial: 96, smooth: false });
  for (const w of supWins) windowAt(refS, w, glassLit, 1.08, w.step);
  // verrière de passerelle (face inclinée) : entourage sombre, vitrage, meneaux alignés sur ceux de l'intérieur
  {
    const z0 = -44.95, z1 = -42.85;
    add(rake.patch({ z0: z0 - 0.2, z1: z1 + 0.18, angle: PI / 2, height: 22.6, off: 0.03, segZ: 4, segS: 12, metric: true }), K.frame);
    add(rake.patch({ z0, z1, angle: PI / 2, height: 20.8, off: 0.07, segZ: 4, segS: 12, readable: true }), glassBridge);
    for (const dx of [-10.35, -6, -2, 2, 6, 10.35]) add(rake.strip({ z0: z0 - 0.1, z1: z1 + 0.1, angle: PI / 2, shift: dx, width: dx * dx > 100 ? 0.36 : 0.2, depth: 0.16, segZ: 3 }), K.frame);
    add(rake.raised({ z0: z1 - 0.02, z1: z1 + 0.26, angle: PI / 2, height: 21.4, depth: 0.18, segZ: 1, segS: 12 }), K.frame);
    add(rake.raised({ z0: z0 - 0.3, z1: z0 + 0.02, angle: PI / 2, height: 21.4, depth: 0.18, segZ: 1, segS: 12 }), K.frame);
    // visière pare-soleil et ses consoles
    add(bevelBox(25.4, 0.32, 1.9, 0.1), K.service, [CX, 14.83, -42.95], [-0.1, 0, 0]);
    for (const dx of [-11.6, -4, 4, 11.6]) add(bevelBox(0.3, 0.5, 1.2, 0.06), K.mech, [CX + dx, 14.72, -42.6]);
  }
  // nervures du château, liston haut, trappes et grilles du toit
  for (const z of [-31, -2.6]) add(refS.band({ z, width: 0.45, depth: 0.12, a0: SA0 + 0.05, a1: SA1 - 0.05, segS: 160 }), K.service);
  for (const s of [-1, 1]) {
    add(refS.strip({ z0: -42.3, z1: -1.6, angle: aS(s, 13.3), width: 0.3, depth: 0.12, segZ: 4 }), K.service);
    add(refS.strip({ z0: -42.3, z1: -1.6, angle: aS(s, 9.72), width: 0.22, depth: 0.1, segZ: 4 }), K.mech);
    add(refS.raised({ z0: -41.7, z1: -31.6, a0: s > 0 ? aS(1, 10.1) : aS(-1, 12.4), a1: s > 0 ? aS(1, 12.4) : aS(-1, 10.1), depth: 0.07, segZ: 2, segS: 2 }), K.service);
  }
  for (const [x, z] of [[-8, -16], [8, -16], [-8, -9], [8, -9]]) parts(ventPanel(2.4, 1.6, 0.14), [CX + x, 14.6, z]);
  for (const [x, z, w, d] of [[-6, -26, 3.0, 2.2], [6, -26, 3.0, 2.2], [0, -12, 4.0, 3.0]]) add(bevelBox(w, 0.12, d, 0.04), K.hullDark, [CX + x, 14.64, z]);

  // ---------------------------------------------------------------- mât de détection (sur le toit du château)
  const ctSt = [
    { x: CX, z: -39.4, y: 14.85, w: 4.0, tw: 3.0, h: 0.35, hb: 0.6, c: 0.25, r: 0.12, steps: 3 },
    { x: CX, z: -36.6, y: 15.9, w: 5.2, tw: 4.2, h: 1.5, hb: 1.6, c: 0.45, r: 0.18, steps: 1 },
    { x: CX, z: -24.2, y: 15.9, w: 5.2, tw: 4.2, h: 1.5, hb: 1.6, c: 0.45, r: 0.18, steps: 3 },
    { x: CX, z: -21.2, y: 14.85, w: 4.0, tw: 3.0, h: 0.35, hb: 0.6, c: 0.25, r: 0.12 },
  ];
  const ct = skinHull(ctSt, { radial: 48, smooth: false, cap0: true, cap1: true });
  add(ct.geometry, K.hull); add(ct.cap0, K.hull); add(ct.cap1, K.hull);
  add(ct.patch({ z0: -38.9, z1: -37.0, angle: PI / 2, height: 6.2, off: 0.04, segZ: 3, segS: 6 }), K.glass);   // optiques de veille
  add(ct.band({ z: -30.4, width: 0.35, depth: 0.1, segS: 96 }), K.service);
  for (const s of [-1, 1]) for (const z of [-33.6, -27.2]) add(bevelBox(0.14, 2.3, 2.7, 0.05), K.black, [CX + s * 4.72, 15.85, z], [0, 0, s * 0.31]);   // réseaux à balayage électronique
  parts(antenna({ type: 'mast', h: 6.5 }), [CX, 17.38, -29]);
  parts(antenna({ type: 'dish', h: 1.6, r: 1.5, tilt: 0.8 }), [CX - 2.0, 17.38, -24.8]);
  parts(antenna({ type: 'dish', h: 1.2, r: 0.9, tilt: -0.7 }), [CX + 2.1, 17.38, -34.2]);
  for (const [x, z, h] of [[1.6, -35.8, 3.2], [-1.6, -35.4, 2.6], [2.4, -22.6, 2.2]]) parts(antenna({ type: 'whip', h }), [CX + x, 17.38, z]);
  for (const [x, z] of [[-2.6, -31], [0.8, -26.5]]) parts(antenna({ type: 'blade', h: 0.7 }), [CX + x, 17.38, z]);
  add(new THREE.SphereGeometry(1.15, 24, 10, 0, TAU, 0, PI / 2), K.hullDark, [CX, 17.38, -22.3]);
  partsM(lightPod({ r: 0.14 }), new THREE.Matrix4().makeTranslation(CX, 17.38 + 6.5, -29), { mech: K.mech, lens: strobe });

  // ================================================================ quille ventrale
  const keelSt = [
    { x: CX, z: -53, y: -2.3, w: 2.4, tw: 3.0, h: 0.4, hb: 0.6, c: 0.2, r: 0.1, steps: 4 },
    { x: CX, z: -47, y: -3.0, w: 7.6, tw: 8.6, h: 0.8, hb: 1.5, c: 0.6, r: 0.2, steps: 1 },
    { x: CX, z: 44, y: -3.0, w: 7.6, tw: 8.6, h: 0.8, hb: 1.5, c: 0.6, r: 0.2, steps: 4 },
    { x: CX, z: 52, y: -2.4, w: 4.0, tw: 5.0, h: 0.5, hb: 0.6, c: 0.3, r: 0.12 },
  ];
  const keel = skinHull(keelSt, { radial: 40, cap0: true, cap1: true });
  add(keel.geometry, K.hullDark); add(keel.cap0, K.hullDark); add(keel.cap1, K.hullDark);
  for (const z of [-40, -22, -4, 14, 32]) add(keel.band({ z, width: 0.4, depth: 0.1, segS: 60 }), K.service);
  for (const [z0, z1] of [[-36, -26], [-18, -8], [18, 28]]) add(keel.raised({ z0, z1, angle: -PI / 2, height: 5.6, depth: 0.06, segZ: 2, segS: 3 }), K.service);   // trappes de soute ventrale

  // ================================================================ blindage, nervures, liston, panneaux
  // bulbes blindés (sponsons) du bas des flancs : peau ouverte côté coque, plaques de blindage en relief ;
  // interrompus à bâbord au droit du tube d'abordage
  const SPN = (s, z, k) => ({ x: CX + s * 16.4, z, y: 0.9, w: 2.0 * k + 0.05, tw: 2.8 * k + 0.05, h: 2.7 * (0.35 + 0.65 * k), hb: 2.9 * (0.35 + 0.65 * k), c: 0.9 * k + 0.05, r: 0.25 });
  for (const s of [-1, 1]) {
    for (const zz of s > 0 ? [[-46, -40, 50, 56.5]] : [[-46, -40, -21, -16], [-2, 3, 50, 56.5]]) {
      const st = zz.map((z, i) => ({ ...SPN(s, z, i === 0 || i === 3 ? 0.12 : 1), steps: i === 1 ? 1 : 5 }));
      const up = s > 0 ? [-0.5, PI / 2 - 0.02] : [PI / 2 + 0.02, PI + 0.5], dn = s > 0 ? [-PI / 2 + 0.02, -0.5] : [PI + 0.5, 1.5 * PI - 0.02];
      const sp = skinHull(st, { radial: 22, arc: up });
      add(sp.geometry, K.hull);
      add(skinHull(st, { radial: 10, arc: dn }).geometry, K.hullDark);
      for (let z = zz[1] + 0.3; z < zz[2] - 1.5; z += 6.4) {
        const z1 = Math.min(z + 6.2, zz[2] - 0.3);
        add(sp.raised({ z0: z, z1, angle: s > 0 ? 0 : PI, shift: s * 0.25, height: 3.2, depth: 0.12, segZ: 2, segS: 2 }), K.service);
        add(sp.raised({ z0: z + 0.25, z1: z1 - 0.25, angle: s > 0 ? 0 : PI, shift: s * 0.25, height: 2.7, depth: 0.22, segZ: 2, segS: 2 }), K.service);
      }
      add(sp.strip({ z0: zz[1], z1: zz[2], angle: s > 0 ? 0.62 : PI - 0.62, width: 0.25, depth: 0.1, segZ: 4 }), K.mech);
    }
    const range = (y0, y1) => (s > 0 ? [aM(1, y0), aM(1, y1)] : [aM(-1, y1), aM(-1, y0)]);
    for (const z of [-35.5]) { const [a0, a1] = range(5.0, 6.8); add(refM.raised({ z0: z, z1: z + 1.6, a0, a1, depth: 0.05, segZ: 1, segS: 2 }), K.hullDark); }
    // panneaux composites sombres du haut des flancs (entre les couples, hors baies et inscriptions)
    for (const [z0, z1] of s > 0 ? [[-37.6, -31.4], [-13.6, -0.4], [36.9, 53.6]] : [[-30.6, -14.4]]) {
      const [a0, a1] = range(4.45, 7.55);
      add(refM.raised({ z0, z1, a0, a1, depth: 0.07, segZ: 2, segS: 2 }), K.hullDark);
      parts(ventPanel(1.4, 0.9, 0.1), [CX + s * 17.13, 6.0, z1 - 1.4], [0, 0, -s * PI / 2]);
    }
  }
  // couples (nervures transversales) : interrompus sous le château
  for (const z of [-38, -31, -14, 0, 17, 36.5, 54]) {
    const under = z > -42.2 && z < -1.85;
    add(refM.band({ z, width: 0.5, depth: 0.12, a0: under ? PI - TOPA + 0.03 : -PI / 2 + 0.001, a1: under ? TAU + TOPA - 0.03 : 1.5 * PI - 0.001, segS: 240 }), K.service);
  }
  for (const z of [-67, -56.5, -50.5]) add(bowRef.band({ z, width: 0.45, depth: 0.12, segS: 200 }), K.service);
  for (const z of [57.6]) add(aftRef.band({ z, width: 0.45, depth: 0.12, segS: 200 }), K.service);
  add(aftRef.band({ z: 67.1, width: 0.7, depth: 0.14, segS: 200 }), K.bare);   // bouclier thermique arrière

  // ---------------------------------------------------------------- pont arrière : cellules de lancement, dorsale, radiateurs
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
    add(bevelBox(1.5, 0.14, 1.5, 0.04), K.hullDark, [CX + s * 0.95, 9.86, 7.6 + i * 1.85]);
    add(bevelBox(1.2, 0.05, 0.12, 0.01), K.hazard, [CX + s * 0.95, 9.95, 7.0 + i * 1.85]);
  }
  add(bevelBox(4.6, 0.06, 10.2, 0.03), K.service, [CX, 9.81, 11.3]);
  const spSt = [
    { x: CX, z: 19, y: 10.2, w: 2.6, tw: 1.8, h: 0.3, hb: 0.5, c: 0.2, r: 0.1, steps: 3 },
    { x: CX, z: 22, y: 10.7, w: 4.2, tw: 3.2, h: 1.1, hb: 1.0, c: 0.5, r: 0.15, steps: 1 },
    { x: CX, z: 52, y: 10.7, w: 4.2, tw: 3.2, h: 1.1, hb: 1.0, c: 0.5, r: 0.15, steps: 3 },
    { x: CX, z: 57.5, y: 9.9, w: 3.0, tw: 2.2, h: 0.4, hb: 0.6, c: 0.25, r: 0.1 },
  ];
  const spine = skinHull(spSt, { radial: 40, smooth: false, cap0: true, cap1: true });
  add(spine.geometry, K.hull); add(spine.cap0, K.hull); add(spine.cap1, K.hull);
  for (const z of [26, 33, 40, 47]) add(spine.band({ z, width: 0.3, depth: 0.08, segS: 60 }), K.service);
  for (const z of [29.5, 43.5]) parts(ventPanel(2.0, 2.6, 0.1), [CX, 11.8, z]);
  for (const s of [-1, 1]) for (const z of [26.5, 37.5, 48.5]) parts(radiator({ len: 9.6, h: 1.6, n: 14, w: 4.2 }), [CX + s * 6.6, 9.8, z]);
  parts(antenna({ type: 'dish', h: 2.2, r: 2.4, tilt: 0.9 }), [CX, 11.8, 54.5]);
  // ailerons radiateurs déployés (en V, depuis l'arête du pont)
  for (const s of [-1, 1]) {
    const ang = s * 0.42, h = 5.2, x0 = CX + s * 15.2, y0 = 9.75;
    const cx = x0 + s * Math.sin(0.42) * h / 2, cy = y0 + Math.cos(0.42) * h / 2;
    add(bevelBox(0.22, h, 19, 0.06), M.fin, [cx, cy, 38], [0, 0, -ang]);
    for (let z = 29.5; z <= 46.6; z += 1.9) add(bevelBox(0.34, h - 0.3, 0.12, 0.03), K.mech, [cx, cy, z], [0, 0, -ang]);
    add(bevelBox(0.5, 0.36, 19.4, 0.08), K.service, [x0 + s * Math.sin(0.42) * (h - 0.1), y0 + Math.cos(0.42) * (h - 0.1), 38], [0, 0, -ang]);
    add(rodBetween(V(x0, y0 + 0.2, 28.2), V(x0, y0 + 0.2, 47.8), 0.28, 12), K.mech);
    for (const z of [29.2, 38, 46.8]) add(bevelBox(1.1, 0.7, 0.9, 0.08), K.service, [x0 - s * 0.3, y0 + 0.3, z]);
  }

  // ================================================================ tuyères (trois principales, quatre verniers)
  parts(nozzle({ rt: 1.4, re: 3.6, len: 7.6, wall: 0.14, seg: 56, mount: 1.6, bands: 3 }), [CX, 4.4, 67.6]);
  for (const s of [-1, 1]) parts(nozzle({ rt: 1.0, re: 2.6, len: 5.8, wall: 0.11, seg: 44, mount: 1.2 }), [CX + s * 8.0, 3.0, 67.6]);
  for (const [x, y] of [[-9.4, 7.0], [9.4, 7.0], [-4.6, -0.1], [4.6, -0.1]]) parts(nozzle({ rt: 0.3, re: 0.75, len: 1.4, wall: 0.04, seg: 24, mount: 0.4, bands: 1, gimbal: false }), [CX + x, y, 67.55]);
  for (const [x, y, r] of [[0, 4.4, 2.15], [-8.0, 3.0, 1.55], [8.0, 3.0, 1.55]]) add(new THREE.TorusGeometry(r, 0.16, 8, 40), K.bare, [CX + x, y, 67.55]);
  for (const s of [-1, 1]) add(bevelBox(0.5, 8.0, 0.5, 0.08), K.mech, [CX + s * 4.9, 3.9, 67.6]);
  add(bevelBox(20, 0.5, 0.5, 0.08), K.mech, [CX, 8.05, 67.6]);
  // conduites d'ergols : du bouclier arrière vers les carters de pompe
  for (const [x, y, r] of [[0, 4.4, 1.4], [-8, 3.0, 1.0], [8, 3.0, 1.0]]) {
    for (const a of [0.6, 2.5, 4.4]) {
      const ca = Math.cos(a), sa = Math.sin(a);
      add(rodBetween(V(CX + x + ca * r * 1.9, y + sa * r * 1.9, 67.5), V(CX + x + ca * r * 1.15, y + sa * r * 1.15, 68.3), 0.1, 8), K.mech);
    }
    add(new THREE.TorusGeometry(r * 1.55, 0.12, 8, 36), K.mech, [CX + x, y, 67.75]);
  }

  // ================================================================ amarrage : collier du tube, pinces, bras, ombilicaux
  {
    const zt = SHIPLOCK.z;
    // collier : linteau, seuil et jambages entre la peau et la cloison intérieure (le tube et la porte restent libres)
    add(bevelBox(1.66, 1.1, 4.8, 0.05), K.mech, [64.98, 3.86, zt]);
    add(bevelBox(1.66, 1.25, 4.8, 0.05), K.mech, [64.98, -1.17, zt]);
    for (const dz of [-2.215, 2.215]) add(bevelBox(1.66, 6.2, 0.37, 0.04), K.mech, [64.98, 1.3, zt + dz]);
    // cadre d'arrimage en saillie + soufflets
    add(bevelBox(0.7, 0.8, 8.4, 0.12), K.service, [64.55, 4.95, zt]);
    add(bevelBox(0.7, 0.7, 8.4, 0.12), K.service, [65.0, -2.05, zt]);
    for (const dz of [-3.85, 3.85]) add(bevelBox(0.7, 6.4, 0.7, 0.12), K.service, [64.55, 1.45, zt + dz]);
    for (const x of [63.15, 63.65, 64.15]) {
      add(bevelBox(0.3, 0.32, 4.9, 0.08), K.rubber, [x, 3.55, zt]);
      add(bevelBox(0.3, 0.32, 4.9, 0.08), K.rubber, [x, -0.72, zt]);
      for (const dz of [-2.3, 2.3]) add(bevelBox(0.3, 4.6, 0.32, 0.08), K.rubber, [x, 1.42, zt + dz]);
    }
    const rz = new THREE.Matrix4().makeRotationZ(PI / 2);
    for (const [y, z] of [[5.6, zt - 2.0], [5.6, zt + 2.0]]) partsM(dockingClamp({ size: 1.1 }), new THREE.Matrix4().makeTranslation(64.2, y, z).multiply(rz));
    for (const dz of [-4.7, 4.7]) partsM(dockingClamp({ size: 0.9 }), new THREE.Matrix4().makeTranslation(64.4, 1.4, zt + dz).multiply(rz));
    for (const dz of [-3.3, 3.3]) partsM(lightPod({ r: 0.12 }), new THREE.Matrix4().makeTranslation(64.2, 5.5, zt + dz).multiply(rz), { mech: K.mech, lens: navGreen });
    // bras de maintien (station → frégate) : poutre, vérin, patin sur la coque
    for (const z of [-22, 2, 50]) {
      add(bevelBox(27.8, 1.2, 1.4, 0.12), K.mech, [50.3, 8.8, z]);
      add(bevelBox(2.6, 1.8, 1.9, 0.16), K.service, [38.0, 8.8, z]);
      add(rodBetween(V(40, 7.9, z + 0.9), V(62.5, 8.3, z + 0.9), 0.14, 10), K.chrome);
      add(bevelBox(0.9, 2.6, 2.6, 0.12), K.hazard, [64.4, 8.8, z]);
      add(bevelBox(0.5, 3.4, 3.4, 0.1), K.service, [65.05, 8.6, z], [0, 0, 0.18]);
    }
    for (const z of [-30, 12]) {
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(37.2, 12.5, z), V(48, 9.2, z + 1.2), V(58, 8.9, z + 2.2), V(64.4, 7.4, z + 2.6)]), 40, 0.24, 8), K.rubber);
      add(bevelBox(0.6, 1.0, 1.0, 0.08), K.mech, [64.75, 7.4, z + 2.6]);
    }
  }

  // ================================================================ tourelles de défense rapprochée
  const turret = (mtx) => {
    const L = [];
    L.push({ geo: new THREE.CylinderGeometry(1.25, 1.45, 0.42, 28).translate(0, 0.21, 0), role: 'service' });
    L.push({ geo: new THREE.SphereGeometry(1.05, 24, 10, 0, TAU, 0, PI / 2).translate(0, 0.42, 0), role: 'hull' });
    L.push({ geo: bevelBox(0.9, 0.62, 0.8, 0.08).translate(0, 0.98, -0.75), role: 'mech' });
    for (const x of [-0.22, 0.22]) {
      L.push({ geo: rodBetween(V(x, 1.0, -1.0), V(x, 1.04, -3.1), 0.075, 10), role: 'mech' });
      L.push({ geo: rodBetween(V(x, 1.04, -3.0), V(x, 1.045, -3.3), 0.1, 10), role: 'chrome' });
    }
    L.push({ geo: bevelBox(0.34, 0.3, 0.42, 0.05).translate(0.78, 1.0, -0.2), role: 'black' });
    partsM(L, mtx);
  };
  turret(onHull(bowRef, -61.5, PI / 2, 0, 0, 0));
  for (const s of [-1, 1]) {
    turret(new THREE.Matrix4().makeTranslation(CX + s * 11.2, 14.6, -38.6));
    turret(new THREE.Matrix4().compose(V(CX + s * 11.2, 14.6, -5.6), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), s * 2.2), V(1, 1, 1)));
    turret(new THREE.Matrix4().compose(V(CX + s * 11.5, 9.8, 54.5), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), PI - s * 0.5), V(1, 1, 1)));
  }
  for (const z of [-30, 34]) turret(new THREE.Matrix4().compose(V(CX, -4.5, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(PI, z > 0 ? 0 : PI, 0)), V(1, 1, 1)));

  // ================================================================ RCS, feux, nez
  for (const s of [-1, 1]) {
    for (const [z, hull] of [[-47.5, bowRef], [58.5, aftRef]]) {
      const fore = z < 0 ? '-z' : '+z';
      partsM(rcsBlock({ size: 1.2, dirs: ['+y', '+x', '-x', fore] }), onHull(hull, z, s > 0 ? 0.33 : PI - 0.33, 0, 0.02));
      partsM(rcsBlock({ size: 1.2, dirs: ['+y', '+x', '-x', fore] }), onHull(hull, z, s > 0 ? -0.33 : PI + 0.33, 0, 0.02));
    }
    partsM(lightPod({ r: 0.22 }), onHull(refM, -46.2, aM(s, 7.4)), { mech: K.mech, lens: s < 0 ? navRed : navGreen });
    partsM(lightPod({ r: 0.16 }), onHull(refS, -41.8, aS(s, 13.6)), { mech: K.mech, lens: strobe });
  }
  partsM(lightPod({ r: 0.2 }), onHull(aftRef, 66.2, PI / 2), { mech: K.mech, lens: K.lensWhite });
  partsM(lightPod({ r: 0.2 }), new THREE.Matrix4().compose(V(CX, -4.5, 8), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), PI), V(1, 1, 1)), { mech: K.mech, lens: navRed });
  // nez : canon axial (bouche) et radôme
  add(new THREE.CylinderGeometry(0.62, 0.78, 1.6, 24, 1, false), K.mech, [CX, 5.6, -76.6], [PI / 2, 0, 0]);
  add(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 20), K.black, [CX, 5.6, -77.42], [PI / 2, 0, 0]);
  add(new THREE.TorusGeometry(0.7, 0.1, 8, 24), K.bare, [CX, 5.6, -77.35]);
  partsM([{ geo: new THREE.SphereGeometry(0.9, 20, 10, 0, TAU, 0, PI / 2), role: 'hullDark' }], onHull(bowRef, -64, -PI / 2, 0, -0.1));
  for (const s of [-1, 1]) partsM([{ geo: new THREE.CylinderGeometry(0.3, 0.36, 0.2, 16).translate(0, 0.05, 0), role: 'mech' }, { geo: new THREE.CircleGeometry(0.26, 16).rotateX(-PI / 2).translate(0, 0.16, 0), role: 'lensWhite' }], onHull(bowRef, -60, -PI / 2, s * 3.4));

  // ================================================================ trappe de soute (tribord)
  {
    const [a0, a1] = [aM(1, 4.1), aM(1, 7.4)];
    add(refM.raised({ z0: 24, z1: 35.4, a0, a1, depth: 0.06, segZ: 3, segS: 3 }), K.hull);
    for (const [y0, y1] of [[3.9, 4.1], [7.4, 7.6]]) add(refM.raised({ z0: 23.8, z1: 35.6, a0: aM(1, y0), a1: aM(1, y1), depth: 0.12, segZ: 3, segS: 1 }), K.frame);
    for (const z of [23.9, 35.5]) add(refM.raised({ z0: z - 0.1, z1: z + 0.1, a0, a1, depth: 0.12, segZ: 1, segS: 2 }), K.frame);
    for (const z of [25.2, 29.7, 34.2]) add(bevelBox(0.4, 0.5, 1.0, 0.06), K.mech, [CX + 17.2, 7.85, z]);
  }

  // ================================================================ livrée (atlas unique)
  const Lv = new LiveryAtlas({ ppm: 30, accent: '#8f2f20', wear: 0.5, seed: 4471 });
  const ink = '#25282b';
  const rName = Lv.region(14, 2.5, (d) => d.text('ATALANTE', 7, 0.08, 2.05, { color: ink, align: 'center', spacing: 0.1 }));
  const rNavy = Lv.region(14, 0.5, (d) => d.text('MARINE DE HALDEN · ESCORTE DE CONVOI', 7, 0.06, 0.36, { color: '#3a3e42', weight: 600, align: 'center', spacing: 0.12 }));
  const rReg = Lv.region(9.4, 1.5, (d) => d.text('HT-4471', 4.7, 0.06, 1.36, { color: ink, align: 'center', spacing: 0.08 }));
  const rNum = Lv.region(5.4, 4.2, (d) => d.text('71', 2.7, 0.1, 4.0, { color: ink, align: 'center', spacing: 0.04 }));
  const rStripe = Lv.region(28, 0.6, (d) => { d.stripe(0.3, 0.26, d.accent); d.stripe(0.06, 0.1, d.accent); });
  const rChevV = Lv.region(0.4, 6.4, (d) => d.chevrons(0, 0, 0.4, 6.4, { pitch: 0.26 }));
  const rDock = Lv.region(8, 0.5, (d) => { d.rect(0, 0, 8, 0.5, ink); d.text('SAS 3 · ARRIMAGE ÉQUIPAGE', 4, 0.07, 0.34, { color: '#e7c23a', align: 'center', spacing: 0.1 }); });
  const rThr = Lv.region(9, 0.62, (d) => { d.chevrons(0, 0, 9, 0.16, { pitch: 0.14 }); d.rect(0, 0.18, 9, 0.44, ink); d.text('DANGER · SOUFFLE DES TUYÈRES', 4.5, 0.24, 0.32, { color: '#e7c23a', align: 'center', spacing: 0.08 }); });
  const rRcs = Lv.region(1.6, 0.42, (d) => { d.rect(0, 0, 1.6, 0.42, ink); d.text('RCS', 0.8, 0.07, 0.3, { color: '#e7c23a', align: 'center' }); });
  Lv.build();
  const LM = Lv.material();
  const decal = (g) => add(g, LM);
  for (const s of [-1, 1]) {
    const R = (y0, y1) => (s > 0 ? { a0: aM(1, y0), a1: aM(1, y1) } : { a0: aM(-1, y1), a1: aM(-1, y0) });
    const RS = (y0, y1) => (s > 0 ? { a0: aS(1, y0), a1: aS(1, y1) } : { a0: aS(-1, y1), a1: aS(-1, y0) });
    const [nz0, nz1] = s > 0 ? [1.4, 15.4] : [37.6, 51.6];
    decal(refM.patch({ z0: nz0, z1: nz1, ...R(4.95, 7.45), uv: rName.uv, readable: true, segZ: 6, segS: 2, off: 0.02 }));
    decal(refM.patch({ z0: nz0, z1: nz1, ...R(4.35, 4.85), uv: rNavy.uv, readable: true, segZ: 6, segS: 2, off: 0.02 }));
    decal(refS.patch({ z0: -41.2, z1: -31.8, ...RS(10.45, 11.95), uv: rReg.uv, readable: true, segZ: 6, segS: 2, off: 0.09 }));
    decal(bowRef.patch({ z0: -64.8, z1: -59.4, angle: s > 0 ? 0 : PI, shift: s * 1.1, height: 4.2, uv: rNum.uv, readable: true, segZ: 10, segS: 6, off: 0.02 }));
    decal(refM.patch({ z0: -45.6, z1: 56.4, ...R(7.8, 8.4), uv: rStripe.uv, readable: true, segZ: 40, segS: 2, off: 0.02 }));
    decal(aftRef.patch({ z0: 58.4, z1: 66.6, angle: s > 0 ? 0 : PI, shift: s * -1.6, height: 0.62, uv: rThr.uv, readable: true, segZ: 10, segS: 2, off: 0.02 }));
    for (const [z, h] of [[-47.5, bowRef], [58.5, aftRef]]) decal(h.patch({ z0: z - 0.8, z1: z + 0.8, angle: s > 0 ? 0 : PI, shift: s * 3.5, height: 0.42, uv: rRcs.uv, readable: true, segZ: 2, segS: 2, off: 0.02 }));
  }
  decal(bowRef.patch({ z0: -49.9, z1: -45.9, angle: PI / 2, height: 4.2, uv: rNum.uv, readable: true, up: [0, 0, -1], segZ: 6, segS: 6, off: 0.02 }));
  // marquage du sas : chevrons autour du collier, plaque d'identification
  {
    const zt = SHIPLOCK.z;
    for (const dz of [-4.55, 4.55]) decal(refM.patch({ z0: zt + dz - 0.2, z1: zt + dz + 0.2, a0: aM(-1, 5.0), a1: aM(-1, -1.4), uv: rChevV.uv, readable: true, segZ: 1, segS: 6, off: 0.02 }));
    decal(refM.patch({ z0: zt - 4, z1: zt + 4, a0: aM(-1, 7.45), a1: aM(-1, 6.95), uv: rDock.uv, readable: true, segZ: 4, segS: 1, off: 0.02 }));
  }

  // ------------------------------------------------ fusion finale
  for (const [m, list] of bag) E.add(list.length > 1 ? mergeGeometries(list, false) : list[0], m, new THREE.Matrix4(), { cast: false, receive: true });
  // feux à éclats (stroboscopes blancs)
  let clock = 0;
  ctx.updaters.push((dt) => { clock += dt; const k = clock % 1.7; strobe.color.setScalar(k < 0.07 || (k > 0.24 && k < 0.3) ? 14 : 0.15); });
  return { engines: NZ, tris: Math.round(tris) };
}

// ------------------------------------------------------------------ équipage de l'Atalante
export function populateBigShip(ctx, lib, player, SH) {
  const { scene } = ctx;
  const people = [], actors = [];
  const R2 = (a, b) => a + Math.random() * (b - a);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const uniform = { top: 0x1c2a3e, bottom: 0x1c2a3e, boot: 0x101214, accent: 0xd4a23a, zip: true, belt: true };
  const mk = (model, opts, p, yaw, role, name) => {
    const c = lib.create(model, { height: model.startsWith('UF') ? 1.7 : 1.82, ...opts });
    if (opts.outfit) c.setOutfit(opts.outfit);
    c.root.position.copy(p); c.root.rotation.y = yaw; c.root.traverse((o) => { o.castShadow = false; });
    c.root.visible = false; c.talkRole = role; c.shipName = name; scene.add(c.root); people.push(c); return c;
  };
  const turn = (c, yaw, dt, k = 6) => { let d = yaw - c.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); c.root.rotation.y += d * (1 - Math.exp(-dt * k)); };
  const step = (n, dt) => {
    const c = n.c; if (c.inDialog) { c.setSpeed(0); return; }
    if (!n.q.length) n.q = n.plan(n);
    const s = n.q[0]; if (!s) return;
    if (s.move) {
      const d = new THREE.Vector3().subVectors(s.move, n.pos).setY(0), len = d.length();
      if (len < 0.1) { n.q.shift(); return; }
      if (targetBlocked(n.pos, s.move, player)) { c.setSpeed(0); return; }   // cible occupée par le joueur : attente
      n.pos.addScaledVector(d.normalize(), Math.min(len, (s.speed || 1.15) * dt)); keepFromPlayer(n.pos, player, d.x, d.z); n.pos.y = s.move.y;
      c.root.position.copy(n.pos); turn(c, Math.atan2(d.x, d.z), dt, 8); c.setSpeed(s.speed || 1.15); if (c.override) c.stop(0.25);
      return;
    }
    if (n.t === 0) { c.setSpeed(0); if (s.anim && s.anim !== 'idle') c.play(s.anim, { fade: 0.35 }); else if (c.override) c.stop(0.3); }
    n.t += dt; if (s.face !== undefined) turn(c, s.face, dt);
    if (n.t >= s.dur) { n.t = 0; n.q.shift(); }
  };
  const actor = (c, plan) => { const n = { c, plan, q: [], pos: c.root.position.clone(), t: 0 }; actors.push(n); return n; };
  const act = (anim, dur, face) => ({ anim, dur, face });
  const yA = SHIP.yA, yB = SHIP.yB, yC = SHIP.yC;
  // capitaine : table holographique, pupitres, fauteuil de commandement
  const cap = mk('UF_dark', { hair: 'Hair_Buns', outfit: { ...uniform, top: 0x14202e, accent: 0xe8c45a } }, V(82, yC, -35.6), Math.PI, 'capitaine', 'Capitaine Ilse Varga');
  actor(cap, () => [act('talk', R2(6, 10), Math.PI), { move: V(84.5, yC, -37) }, act('interact', R2(3, 5), -Math.PI / 2), { move: V(82, yC + 0.12, -33.4) }, act('idle', R2(4, 7), Math.PI), { move: V(82, yC, -35.6) }]);
  // pilotes aux pupitres (assis)
  for (const [x, z, ry, m] of [[77.5 + Math.sin(0.1) * 0.9, -40.2 + Math.cos(0.1) * 0.9, 0.1 + Math.PI, 'UM_light'], [86.5 + Math.sin(-0.1) * 0.9, -40.2 + Math.cos(-0.1) * 0.9, -0.1 + Math.PI, 'UF_light']]) {
    const c = mk(m, { hair: m.startsWith('UF') ? 'Hair_Long' : 'Hair_Buzzed', outfit: uniform }, V(x, yC, z), ry, 'équipage', null);
    actor(c, () => [act('sit', R2(10, 18), ry), act('sitTalk', R2(3, 6), ry)]);
  }
  // mécanicien au réacteur
  const eng = mk('UM_dark', { hair: 'Hair_Beard', outfit: { top: 0x5d6168, bottom: 0x3a3d42, boot: 0x16181a, accent: 0xe8762a, hivis: true } }, V(76.5, yA, 47), Math.PI / 2, 'équipage', null);
  actor(eng, () => [act('repair', R2(6, 10), Math.PI / 2), { move: V(71, yA, 43) }, act('interact', R2(3, 5), -Math.PI / 2), { move: V(76.5, yA, 47) }]);
  // cuisinière et médecin (personnages réalistes)
  const cook = mk('UF_light', { rb: 'Chef_Female_01', civil: true }, V(77.9, yB, 26), Math.PI / 2, 'cuisinier', null);
  actor(cook, () => [act('interact', R2(4, 7), Math.PI / 2), { move: V(77.9, yB, 31) }, act('pickup', 2.4, Math.PI / 2), { move: V(77.9, yB, 24) }, act('interact', R2(3, 5), Math.PI / 2)]);
  const doc = mk('UM_light', { rb: 'Medical_Male_01', civil: true }, V(71, yB, -26), -Math.PI / 2, 'équipage', 'Dr Oren Halsey');
  actor(doc, () => [act('idle', R2(5, 8), -Math.PI / 2), { move: V(72.6, yB, -21.3) }, act('interact', R2(3, 5), 0), { move: V(71, yB, -26) }]);
  // manutentionnaire dans la soute
  const load = mk('UM_light', { hair: 'Hair_SimpleParted', outfit: { top: 0x3a4a2a, bottom: 0x2a2c30, boot: 0x16181a, accent: 0xd8a62a, hivis: true } }, V(91, yA, -2), Math.PI / 2, 'équipage', null);
  actor(load, () => [act('interact', R2(4, 6), Math.PI / 2), { move: V(91, yA, 12) }, act('pickup', 2.4, Math.PI / 2), { move: V(91, yA, 20) }, act('idle', 3, Math.PI / 2), { move: V(91, yA, -2) }]);
  // équipage au repos : réfectoire (assis), salon d'observation, coursives
  const sits = [[69.5, 20 + 0.9, Math.PI], [69.5, 25 - 0.9, 0], [69.5, 30 + 0.9, Math.PI]];
  sits.forEach(([x, z, ry], i) => { const c = mk(i % 2 ? 'UF_dark' : 'UM_dark', { hair: i % 2 ? 'Hair_Long' : 'Hair_Buzzed', outfit: uniform }, V(x, yB, z), ry, 'équipage', null); actor(c, () => [act(i === 1 ? 'sitTalk' : 'sit', R2(12, 22), ry), act('sitTalk', R2(4, 8), ry)]); });
  const lounge = mk('UF_light', { hair: 'Hair_Buns', outfit: uniform }, V(92.55, yC, -17.6), Math.PI / 2, 'équipage', null);
  actor(lounge, () => [act('sit', R2(15, 25), Math.PI / 2)]);
  const walkers = [];
  for (const [y, za, zb, m] of [[yA, -26, 34, 'UM_light'], [yB, -24, 34, 'UF_light']]) {
    const c = mk(m, { hair: m.startsWith('UF') ? 'Hair_Buns' : 'Hair_SimpleParted', outfit: uniform }, V(82, y, za), 0, 'équipage', null);
    const n = actor(c, () => [{ move: V(81.6, y, zb) }, act('idle', R2(2, 4), 0), { move: V(82.4, y, za) }, act('talk', R2(2, 4), Math.PI)]);
    walkers.push(n);
  }
  SH.crewPos = [];
  ctx.shipPeople = people;
  const blk = []; ctx.shipBlockers = () => { blk.length = 0; for (const c of people) if (c.root.visible) blk.push({ pos: c.root.position }); return blk; };
  ctx.updaters.push((dt) => {
    const near = SH.near(player.pos), cam = ctx.camera.position;
    SH.crewPos.length = 0;
    for (const n of actors) {
      if (!near) { n.c.root.visible = false; continue; }
      step(n, dt);
      if (walkers.includes(n)) SH.crewPos.push(n.pos);
      const vis = Math.abs(n.pos.y - player.pos.y) < 5.5 || n.pos.distanceToSquared(player.pos) < 400;
      n.c.root.visible = vis;
      if (vis && n.pos.distanceToSquared(player.pos) < 2500) n.c.update(dt, cam);
    }
  });
  return { people, actors, cap };
}
