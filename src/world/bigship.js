import * as THREE from 'three';
import { Builder } from './builder.js';
import { platedHull } from './hullkit.js';
import { HX, SHIPLOCK } from './layout.js';
import { paintedText, decalMaterial, neonTexture, neonMaterial, Screen, FONT } from './signage.js';
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
  const out = { lights: [], doors: [], seats: [], spots: {}, rooms: [] };
  // ---------------------------------------------------------------- matériaux
  const wallM = mats.paint(0xc9ced3, { grime: 0.35, scratch: 0.3, rust: 0, rough: 0.6 });
  const wallLow = mats.paint(0x4a5058, { grime: 0.6, scratch: 0.5, rust: 0.05 });
  const wallWarm = mats.paint(0x8a7a66, { plain: true, rough: 0.7, grime: 0.2 });
  const hullIn = mats.paint(0x5d6368, { grime: 0.8, scratch: 0.6, rust: 0.1 });
  const floorM = mats.diamond ? mats.diamond(0x9a9ea2) : wallLow;
  const floorTile = mats.ph('large_grey_tiles', 0xb8bcc0, { rough: 1, metal: 0, grime: 0.3, scratch: 0.2, floor: 0.5 });
  const ceilM = mats.paint(0x2c3136, { grime: 0.5 });
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
  const ledStrip = (x0, x1, z0, z1, y, m = ledW) => box(Math.max(0.12, x1 - x0), 0.04, Math.max(0.12, z1 - z0), m, [(x0 + x1) / 2, y - 0.62, (z0 + z1) / 2]);
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
      Mo.place(B, 'potted_plant_04', 67, yB, 37, { fit: ['y', 1.3] }); Mo.place(B, 'potted_plant_02', 67, yB, 16, { fit: ['y', 1.1] });
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
    ctx.models?.place(B, 'potted_plant_02', 87, yB + 0.62, -16, { fit: ['y', 1.1] });
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
    for (const s of [-1, 1]) { box(L, hh, 0.12, mats.paint(0x6a7076, { grime: 0.5 }), [xc, hh / 2, z + s * w / 2], true); box(L, 0.12, 0.2, ledW, [xc, hh - 0.2, z + s * (w / 2 - 0.12)]); }
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
  const E = new Builder(null); E.cellSize = 1000;
  {
    const ds = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; return c; };
    const hm = { plate: mats.paint(0x7a8086, { grime: 0.7, scratch: 0.6, rust: 0.08 }), alt: mats.paint(0x4e545a, { grime: 0.8, scratch: 0.6, rust: 0.1 }), under: ds(mats.metal(0x1d2023, { rough: 0.7 })) };
    const hull = platedHull([
      { z: -54, w: 3, h: 3, y: 7, n: 2.2 }, { z: -48, w: 12, h: 8, y: 7.5, n: 2.4 }, { z: -43, w: 17, h: 11, y: 7.5, n: 2.6 }, { z: -34, w: 20, h: 13, y: 6.6, n: 2.8 },
      { z: 58, w: 20, h: 13, y: 6.6, n: 2.8 }, { z: 70, w: 17, h: 11, y: 6, n: 2.6 }, { z: 128, w: 17, h: 11, y: 6, n: 2.6 }, { z: 138, w: 12, h: 9, y: 6, n: 2.4 },
    ], { facets: 22, steps: 5, plateEvery: [2, 1], altRandom: 0.25, seed: 77, gap: 0.12, thick: 0.25 });
    // le module platedHull est centré sur x = 0 : on le décale sur l'axe du vaisseau
    const shift = new THREE.Matrix4().makeTranslation(S.cx, 0, 0);
    E.add(hull.under, hm.under, shift, { cast: false }); E.add(hull.plates, hm.plate, shift, { cast: false }); E.add(hull.alt, hm.alt, shift, { cast: false });
    // dorsale : château de commandement (verrière avant éclairée), antennes, radiateurs
    E.box(26, 4.5, 34, hm.plate, [S.cx, 18.5, -20], null, { cast: false, tex: 6 });
    E.box(22, 0.6, 30, hm.alt, [S.cx, 21, -20], null, { cast: false, tex: 6 });
    E.box(20, 2.6, 0.2, mats.emissive(0x9fd8ff, 1.4), [S.cx, 12.2, -51.5], null, { cast: false });
    for (let k = 0; k < 12; k++) E.box(1.6, 0.6, 0.1, mats.emissive(0xffd9a8, 2.2), [S.cx - 9 + k * 1.6, 7.8, -50.2 + Math.abs(k - 5.5) * 0.15], null, { cast: false });
    for (const s of [-1, 1]) for (let z = -30; z < 40; z += 3.5) if ((z * 7) % 3 < 2) E.box(0.1, 0.5, 1.4, mats.emissive(0xffd9a8, 2.2), [S.cx + s * 20.05, 6.8, z], null, { cast: false });
    for (const s of [-1, 1]) for (let z = 75; z < 125; z += 7) E.box(14, 0.2, 5.5, mats.metal(0xc8ccd0, { rough: 0.3 }), [S.cx + s * 24, 6, z], null, { cast: false });
    for (const s of [-1, 1]) E.box(6, 1.2, 55, dark, [S.cx + s * 18.5, 6, 100], null, { cast: false });
    for (const [x, h] of [[S.cx - 6, 14], [S.cx + 5, 10]]) { E.cyl(0.25, 0.3, h, dark, [x, 21 + h / 2, -10], null, { cast: false, seg: 8 }); E.box(4, 0.2, 0.2, dark, [x, 21 + h * 0.8, -10], null, { cast: false }); }
    // tuyères (trois grandes, quatre de manœuvre), lueur des moteurs au repos
    for (const [dx, dy, r] of [[0, 6, 5.5], [-9, 4, 3.6], [9, 4, 3.6]]) {
      E.add(new THREE.CylinderGeometry(r * 0.75, r, 9, 24, 1, true).rotateX(Math.PI / 2), mats.metal(0x3a3e42, { rough: 0.4 }), new THREE.Matrix4().makeTranslation(S.cx + dx, dy, 142), { cast: false });
      E.add(new THREE.CircleGeometry(r * 0.72, 24).rotateY(Math.PI), mats.emissive(0x6aaaff, 1.2), new THREE.Matrix4().makeTranslation(S.cx + dx, dy, 140), { cast: false });
    }
    // nom peint sur les flancs
    const t = paintedText(['ATALANTE', 'HT-4471'], { size: 220, color: '#e9e4d8', spacing: 14, wear: 1.2 });
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(30, 30 / t.aspect), decalMaterial(t.tex, { rough: 0.8 })); m.position.set(S.cx + s * 17.4, 8, 92); m.rotation.y = s * Math.PI / 2; scene.add(m); }
    // amarrage : bras de maintien entre la coque de la station et la frégate, ombilicaux
    for (const z of [-6, 30, 64]) { E.box(26, 1.4, 1.4, dark, [50, 9, z], null, { cast: false }); E.box(2, 3, 2, yellow, [63.5, 9, z], null, { cast: false }); }
    for (const z of [-22, 40]) E.cable([37.5, 12, z], [62.5, 10, z + 3], 2.5, 0.25, mats.paint(0x2a2a2a, { plain: true }));
    // feux de position
    for (const [x, y, z, c] of [[S.cx - 20.4, 6.6, -30, 0xff2a1a], [S.cx + 20.4, 6.6, -30, 0x2aff6a], [S.cx, 22, 30, 0xffffff], [S.cx, -6.6, 60, 0xffffff]]) E.box(0.5, 0.5, 0.5, mats.emissive(c, 6), [x, y, z], null, { cast: false });
  }
  const em = E.finalize(scene);
  for (const m of em) { m.castShadow = false; m.receiveShadow = false; }

  out.inside = (p) => p.x > S.x0 - 1 && p.x < S.x1 + 1 && p.z > S.zBow - 1 && p.z < S.zEnd + 1 && p.y > -1 && p.y < 15;
  out.near = (p) => (p.x > HX - 4 && p.x < S.x1 + 6 && p.z > S.zBow - 10 && p.z < S.zEnd + 10 && p.y > -2 && p.y < 18);
  for (const l of out.lights) l.userData.ship = true;
  ctx.updaters.push((dt, t) => { if (out.holo) { out.holo.rotation.y += dt * 0.3; out.holo.visible = out.near(ctx.player?.pos || new THREE.Vector3(1e9, 0, 0)); } });
  void airlock; void neonTexture; void neonMaterial; void low;
  return out;
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
      n.pos.addScaledVector(d.normalize(), Math.min(len, (s.speed || 1.15) * dt)); n.pos.y = s.move.y;
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
