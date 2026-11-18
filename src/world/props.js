import * as THREE from 'three';
import { Builder } from './builder.js';
import { metricBox } from './materials.js';
import { HX, Z_BAY, Z_BACK, PADS, STORAGE, AIRLOCK, COLS } from './layout.js';
import { paintedText, decalMaterial, Screen, FONT, rand, seed } from './signage.js';

// Accessoires : conteneurs, caisses, fûts, servantes, établis, bornes, chariots, coin pause.

/** Aide : transformations locales (position + rotation Y) vers un Builder. */
export class Local {
  constructor(B, x, y, z, ry = 0, scene = null) {
    this.B = B; this.ry = ry; this.scene = scene;
    this.M = Builder.matrix([x, y, z], [0, ry, 0]);
  }
  box(w, h, d, mat, p, rot, opts = {}) {
    const g = metricBox(w, h, d, opts.tex ?? 1);
    this.B.add(g, mat, Builder.matrix(p, rot), { ...opts, parent: this.M });
    if (opts.collide) this.cbox(w, h, d, p);
    return g;
  }
  cyl(rt, rb, h, mat, p, rot, opts = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, opts.seg ?? 14, 1, opts.open ?? false);
    this.B.add(g, mat, Builder.matrix(p, rot), { ...opts, parent: this.M });
    return g;
  }
  geo(g, mat, p, rot, opts = {}) { this.B.add(g, mat, Builder.matrix(p, rot), { ...opts, parent: this.M }); }
  world(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.M); }
  cbox(w, h, d, p) {
    const c = this.world(...p);
    this.B.colliderBox(w, h, d, [c.x, c.y, c.z], [0, this.ry, 0]);
  }
  obstacle(hw, hd, cx = 0, cz = 0) {
    const c = this.world(cx, 0, cz);
    this.B.addObstacle(c.x, c.z, hw, hd, this.ry);
  }
  decal(mesh, p, rot) {
    mesh.position.copy(this.world(...p));
    mesh.rotation.set(rot ? rot[0] : 0, this.ry + (rot ? rot[1] : 0), rot ? rot[2] : 0, 'YXZ');
    this.scene.add(mesh);
  }
}

const textCache = new Map();
function stencil(lines, width, color = '#e8e2d2', wear = 1, size = 120) {
  const key = lines.join('|') + color + width;
  let t = textCache.get(key);
  if (!t) { t = paintedText(lines, { size, color, wear }); textCache.set(key, t); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / t.aspect), decalMaterial(t.tex, { rough: 0.6 }));
  m.receiveShadow = true;
  return m;
}

// --------------------------------------------------------------------------- conteneur ISO-like
export function container(ctx, x, y, z, ry, color, label) {
  const { builder: B, mats, scene } = ctx;
  const L = new Local(B, x, y, z, ry, scene);
  const body = mats.cladding(color, { grime: 0.9, rust: 0.6 });
  const frame = mats.paint(0x2f3336, { grime: 0.8, rust: 0.5, plain: true, rough: 0.6 });
  const w = 2.45, h = 2.6, d = 6.0;
  L.box(w - 0.1, h - 0.1, d - 0.1, body, [0, h / 2, 0], null, { tex: 1.6 });
  // nervures (tôle ondulée)
  // cadre et pièces de coin
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    L.box(0.16, h, 0.16, frame, [sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08)]);
    for (const sy of [0, 1]) L.box(0.2, 0.14, 0.2, frame, [sx * (w / 2 - 0.08), sy * (h - 0.14) + 0.07, sz * (d / 2 - 0.08)], null, { cast: false });
  }
  for (const sy of [0, 1]) for (const sx of [-1, 1]) L.box(0.12, 0.14, d, frame, [sx * (w / 2 - 0.06), sy * (h - 0.14) + 0.07, 0], null, { cast: false });
  // portes avec barres de verrouillage
  for (const s of [-0.55, -0.2, 0.2, 0.55]) L.cyl(0.025, 0.025, h - 0.4, mats.smooth(0x7d8083, 0.4, 0.9), [s, h / 2, d / 2 + 0.02], null, { cast: false, seg: 6 });
  L.cbox(w, h, d, [0, h / 2, 0]);
  if (y < 0.1) L.obstacle(w / 2 + 0.2, d / 2 + 0.2);
  if (label) {
    for (const s of [-1, 1]) L.decal(stencil([label], 2.6, '#e9e3d4', 1.3), [s * (w / 2 + 0.035), h * 0.62, 0.8], [0, s * Math.PI / 2, 0]);
    L.decal(stencil([label.split(' ')[0]], 1.2, '#e9e3d4', 1.3), [0, h * 0.75, d / 2 + 0.06], [0, 0, 0]);
  }
}

// --------------------------------------------------------------------------- caisse
export function crate(ctx, x, y, z, ry, s = 1, kind = 0) {
  const { builder: B, mats } = ctx;
  const L = new Local(B, x, y, z, ry, ctx.scene);
  const colors = [0x5c6b4a, 0x6a6e70, 0x3d4a5a, 0x8a5a2a, 0x2c3134];
  const body = mats.paint(colors[kind % colors.length], { grime: 0.85, scratch: 0.9, rust: 0.2, plain: true, rough: 0.7 });
  const edge = mats.paint(0x232628, { grime: 0.7, plain: true, rough: 0.6 });
  const w = 1.2 * s, h = 0.9 * s, d = 0.9 * s;
  L.box(w, h, d, body, [0, h / 2, 0], null, { tex: 1.5 });
  // arêtes renforcées
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box(0.06, h + 0.01, 0.06, edge, [sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02)], null, { cast: false });
  L.box(w + 0.02, 0.06, d + 0.02, edge, [0, h - 0.03, 0], null, { cast: false });
  L.box(w + 0.02, 0.06, d + 0.02, edge, [0, 0.03, 0], null, { cast: false });
  // sangles / poignées
  if (kind % 2 === 0) L.box(0.08, h + 0.02, d + 0.02, mats.plastic(0xc8901a, 0.7), [w * 0.2, h / 2, 0], null, { cast: false });
  for (const sx of [-1, 1]) L.box(0.04, 0.06, 0.25, edge, [sx * (w / 2 + 0.02), h * 0.7, 0], null, { cast: false });
  L.cbox(w, h, d, [0, h / 2, 0]);
  return h;
}

export function pallet(ctx, x, z, ry) {
  const L = new Local(ctx.builder, x, 0, z, ry, ctx.scene);
  const wood = ctx.mats.plastic(0x6b5238, 0.85);
  for (const s of [-0.5, 0, 0.5]) L.box(0.1, 0.1, 1.2, wood, [s, 0.05, 0], null, { cast: false });
  for (const s of [-0.5, -0.25, 0, 0.25, 0.5]) L.box(1.2, 0.03, 0.12, wood, [0, 0.115, s], null, { cast: false });
}

// --------------------------------------------------------------------------- fûts
export function barrel(ctx, x, y, z, color = 0x2b5e8c, tipped = false) {
  const { builder: B, mats } = ctx;
  const m = mats.paint(color, { grime: 0.85, rust: 0.4 });
  const L = new Local(B, x, y, z, rand() * 6, ctx.scene);
  const rot = tipped ? [Math.PI / 2, 0, 0] : null;
  const yc = tipped ? 0.29 : 0.44;
  L.cyl(0.29, 0.29, 0.88, m, [0, yc, 0], rot, { seg: 16 });
  for (const k of [-0.28, 0, 0.28]) {
    const p = tipped ? [0, yc, k] : [0, yc + k, 0];
    L.cyl(0.3, 0.3, 0.035, m, p, rot, { seg: 16, cast: false });
  }
  if (!tipped) L.cyl(0.04, 0.04, 0.03, mats.smooth(0x222222, 0.5, 0.8), [0.15, 0.9, 0.05], null, { seg: 6, cast: false });
  L.cbox(0.58, 0.88, 0.58, [0, 0.44, 0]);
}

// --------------------------------------------------------------------------- servante d'atelier
export function toolChest(ctx, x, z, ry, color = 0xa3241b) {
  const { builder: B, mats } = ctx;
  const L = new Local(B, x, 0, z, ry, ctx.scene);
  const body = mats.paint(color, { grime: 0.7, scratch: 0.9, rust: 0.05, plain: true, rough: 0.45 });
  const dark = mats.smooth(0x1b1c1d, 0.5, 0.6);
  const chrome = mats.smooth(0xc8ccce, 0.2, 1);
  L.box(1.1, 0.95, 0.55, body, [0, 0.55, 0]);
  for (let k = 0; k < 6; k++) {
    L.box(1.02, 0.01, 0.01, dark, [0, 0.22 + k * 0.14, 0.28], null, { cast: false });
    L.box(0.5, 0.02, 0.03, chrome, [0, 0.27 + k * 0.14, 0.29], null, { cast: false });
  }
  L.box(1.14, 0.04, 0.6, mats.rubber(), [0, 1.04, 0], null, { cast: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.cyl(0.05, 0.05, 0.04, dark, [sx * 0.48, 0.05, sz * 0.22], [Math.PI / 2, 0, 0], { seg: 8, cast: false });
  // tiroir ouvert
  L.box(0.98, 0.1, 0.45, body, [0, 0.83, 0.42]);
  // outils posés dessus
  L.box(0.3, 0.03, 0.05, chrome, [-0.2, 1.08, 0.1], [0, 0.4, 0], { cast: false });
  L.box(0.25, 0.04, 0.04, mats.plastic(0xd4a017), [0.2, 1.08, -0.05], [0, -0.3, 0], { cast: false });
  L.cyl(0.04, 0.04, 0.22, mats.plastic(0x2255aa), [0.35, 1.17, 0.1], null, { seg: 8, cast: false });
  L.box(0.35, 0.12, 0.18, mats.plastic(0xb5531d), [-0.25, 1.12, -0.1], [0, 0.2, 0], { cast: false });
  L.cbox(1.1, 1.1, 0.6, [0, 0.55, 0]);
  L.obstacle(0.7, 0.45);
}

// --------------------------------------------------------------------------- établi
export function workbench(ctx, x, z, ry) {
  const { builder: B, mats } = ctx;
  const L = new Local(B, x, 0, z, ry, ctx.scene);
  const frame = mats.paint(0x3a4a5a, { grime: 0.8 });
  const top = mats.metal(0x6a6d6f, { rough: 0.55 });
  L.box(2.4, 0.06, 0.9, top, [0, 0.92, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box(0.06, 0.9, 0.06, frame, [sx * 1.15, 0.45, sz * 0.4]);
  L.box(2.3, 0.04, 0.8, frame, [0, 0.25, 0], null, { cast: false });
  // panneau perforé avec outils
  L.box(2.4, 1.2, 0.04, mats.paint(0x56606a), [0, 1.75, -0.43]);
  for (let i = 0; i < 9; i++) L.box(0.04, 0.2 + rand() * 0.25, 0.03, mats.smooth(i % 3 ? 0x9a9da0 : 0xb5531d, 0.4, i % 3 ? 0.9 : 0.1), [-1.0 + i * 0.25, 1.75, -0.4], [0, 0, (rand() - 0.5) * 0.4], { cast: false });
  // étau, lampe, pièces
  L.box(0.18, 0.12, 0.25, mats.paint(0x2a5c8a), [0.9, 1.01, 0.2]);
  L.cyl(0.08, 0.08, 0.12, mats.smooth(0x888888, 0.4, 0.9), [-0.4, 1.01, 0.1], null, { cast: false });
  L.box(0.4, 0.03, 0.3, mats.metal(0x333333), [-0.9, 0.96, 0.1], [0, 0.3, 0], { cast: false });
  L.box(0.2, 0.15, 0.15, mats.plastic(0xd4a017), [0.4, 1.02, 0.25], null, { cast: false });
  L.box(0.5, 0.05, 0.15, mats.emissive(0xfff0dd, 3), [0, 2.4, -0.3], null, { cast: false });
  L.cbox(2.4, 1.0, 0.9, [0, 0.5, 0]);
  L.obstacle(1.3, 0.6);
}

// --------------------------------------------------------------------------- borne de contrôle avec écran animé
export function terminal(ctx, x, z, ry, kind = 'pad', label = 'AIRE 02') {
  const { builder: B, mats } = ctx;
  const L = new Local(B, x, 0, z, ry, ctx.scene);
  const body = mats.paint(0x3b4147, { grime: 0.7, plain: true, rough: 0.5 });
  L.box(0.6, 1.0, 0.45, body, [0, 0.5, 0]);
  L.box(0.7, 0.55, 0.12, body, [0, 1.25, -0.05], [-0.35, 0, 0]);
  L.box(0.7, 0.06, 0.5, mats.paint(0xc89a1e), [0, 0.03, 0], null, { cast: false });
  L.cbox(0.7, 1.4, 0.5, [0, 0.7, 0]);
  L.obstacle(0.45, 0.4);
  const scr = new Screen(256, 160, (c, w, h, t) => drawPadScreen(c, w, h, t, kind, label), { period: 0.4 + rand() * 0.4, intensity: 1.5 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38), scr.material);
  L.decal(m, [0, 1.27, 0.015], [-0.35, 0, 0]);
  ctx.screens.push(scr);
}

function drawPadScreen(c, w, h, t, kind, label) {
  c.fillStyle = '#04121a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#3ec7ff'; c.font = `600 20px ${FONT}`; c.fillText(label, 10, 24);
  c.fillStyle = '#7fe3ff'; c.font = `500 13px ${FONT}`;
  if (kind === 'pad') {
    c.fillText('STATUT : OCCUPÉ', 10, 46);
    c.fillText('CARBURANT', 10, 70);
    const f = 0.55 + 0.4 * Math.sin(t * 0.05);
    c.strokeStyle = '#3ec7ff'; c.strokeRect(90, 60, 150, 12); c.fillRect(92, 62, 146 * f, 8);
    c.fillText('ALIM. SOL  ' + (Math.sin(t) > 0 ? '●' : '○') + ' 400 Hz', 10, 94);
    c.fillStyle = '#ffb040';
    c.fillText('CHAMP DE CONFINEMENT : ACTIF', 10, 118);
    for (let i = 0; i < 20; i++) { c.fillStyle = `rgba(62,199,255,${0.2 + 0.6 * Math.abs(Math.sin(t * 2 + i))})`; c.fillRect(10 + i * 11, 132, 8, 14 * Math.abs(Math.sin(t * 1.3 + i * 0.7))); }
  } else if (kind === 'cargo') {
    c.fillText('MANIFESTE MH4-0918', 10, 46);
    const items = ['MÉTAUX RAFFINÉS', 'PIÈCES DÉTACHÉES', 'VIVRES', 'MÉDICAL', 'EAU'];
    items.forEach((it, i) => { c.fillStyle = i === Math.floor(t / 3) % 5 ? '#ffb040' : '#7fe3ff'; c.fillText(`${it}`, 10, 66 + i * 17); c.fillText(`${(12 + i * 7) % 40} T`, 200, 66 + i * 17); });
  } else {
    c.fillText('DIAGNOSTIC FC-31', 10, 46);
    for (let i = 0; i < 6; i++) { c.fillStyle = i === 3 ? '#ff5040' : '#7fe3ff'; c.fillText(['PROPULSION', 'AVIONIQUE', 'BOUCLIER', 'TRAIN', 'ARMEMENT', 'SUPPORT VIE'][i] + (i === 3 ? ' — DÉFAUT' : ' — OK'), 10, 66 + i * 15); }
  }
}

// --------------------------------------------------------------------------- groupe électrogène de parc (GPU) + câble au vaisseau
export function groundPower(ctx, x, z, ry, cableTo) {
  const { builder: B, mats } = ctx;
  const L = new Local(B, x, 0, z, ry, ctx.scene);
  const body = mats.paint(0xc89a1e, { grime: 0.9, scratch: 0.9, rust: 0.2, plain: true, rough: 0.55 });
  L.box(1.4, 1.0, 2.2, body, [0, 0.75, 0], null, { tex: 1.5 });
  L.box(1.45, 0.08, 2.25, mats.paint(0x2c3134), [0, 1.28, 0], null, { cast: false });
  for (let k = 0; k < 6; k++) L.box(1.42, 0.03, 0.04, mats.metal(0x222222), [0, 0.6 + k * 0.08, 0.6], null, { cast: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.cyl(0.18, 0.18, 0.12, mats.rubber(), [sx * 0.62, 0.18, sz * 0.75], [0, 0, Math.PI / 2], { seg: 12 });
  L.box(0.08, 0.08, 1.2, mats.metal(0x2c3134), [0, 0.3, -1.6], null, { cast: false });
  L.box(0.3, 0.2, 0.05, mats.emissive(0x50ff80, 2), [0.4, 1.0, 1.11], null, { cast: false });
  L.cbox(1.5, 1.3, 2.3, [0, 0.65, 0]);
  L.obstacle(0.8, 1.3);
  if (cableTo) {
    const a = L.world(0.6, 0.9, 1.1);
    const pts = [a.toArray(), [a.x + (cableTo.x - a.x) * 0.3, 0.05, a.z + (cableTo.z - a.z) * 0.3], [a.x + (cableTo.x - a.x) * 0.7, 0.05, a.z + (cableTo.z - a.z) * 0.7], cableTo.toArray()];
    B.tube(pts, 0.035, mats.rubber(), { radial: 6, segments: 40, cast: false });
  }
}

// --------------------------------------------------------------------------- cônes, bornes, chaînes
export function cone(ctx, x, z) {
  const L = new Local(ctx.builder, x, 0, z, 0, ctx.scene);
  L.cyl(0.03, 0.17, 0.7, ctx.mats.plastic(0xd2541a, 0.6), [0, 0.37, 0], null, { seg: 12 });
  L.cyl(0.11, 0.135, 0.12, ctx.mats.plastic(0xe8e8e8, 0.4), [0, 0.38, 0], null, { seg: 12, cast: false });
  L.box(0.42, 0.04, 0.42, ctx.mats.plastic(0x1a1a1a, 0.8), [0, 0.02, 0], null, { cast: false });
}

export function stanchions(ctx, pts) {
  const { builder: B, mats } = ctx;
  const post = mats.paint(0xc89a1e);
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    B.cyl(0.04, 0.04, 1.0, post, [x, 0.5, z], null, { seg: 8 });
    B.cyl(0.18, 0.2, 0.06, mats.plastic(0x1a1a1a, 0.8), [x, 0.03, z], null, { seg: 12, cast: false });
    if (i > 0) {
      const [px, pz] = pts[i - 1];
      B.cable([px, 0.95, pz], [x, 0.95, z], 0.18, 0.02, mats.plastic(0xd4a017, 0.5));
    }
  }
}

// --------------------------------------------------------------------------- bouteilles de gaz en râtelier
export function gasRack(ctx, x, z, ry) {
  const L = new Local(ctx.builder, x, 0, z, ry, ctx.scene);
  const { mats } = ctx;
  L.box(1.8, 0.05, 0.5, mats.paint(0x2c3134), [0, 0.03, 0], null, { cast: false });
  L.box(1.8, 0.06, 0.06, mats.paint(0x2c3134), [0, 1.1, 0.25]);
  for (const sx of [-1, 1]) L.box(0.06, 1.2, 0.5, mats.paint(0x2c3134), [sx * 0.9, 0.6, 0]);
  const cols = [0x2a6a3a, 0x2a6a3a, 0x7a1f1a, 0x1f3f6a, 0x7a1f1a];
  for (let i = 0; i < 5; i++) {
    L.cyl(0.13, 0.13, 1.35, mats.paint(cols[i], { grime: 0.6 }), [-0.68 + i * 0.34, 0.68, 0], null, { seg: 12 });
    L.cyl(0.05, 0.13, 0.15, mats.smooth(0x999999, 0.3, 1), [-0.68 + i * 0.34, 1.42, 0], null, { seg: 10, cast: false });
  }
  L.cbox(1.8, 1.5, 0.6, [0, 0.75, 0]);
  L.obstacle(1.0, 0.35);
}

// --------------------------------------------------------------------------- distributeur, table et bancs (coin pause)
export function breakArea(ctx, x, z, ry) {
  const L = new Local(ctx.builder, x, 0, z, ry, ctx.scene);
  const { mats } = ctx;
  // distributeur de boissons
  L.box(1.0, 1.95, 0.8, mats.paint(0x8a2a1e, { grime: 0.6 }), [0, 0.975, 0]);
  L.box(0.6, 1.1, 0.02, mats.emissive(0xffe8c8, 1.4), [-0.12, 1.25, 0.41], null, { cast: false });
  L.box(0.18, 0.5, 0.03, mats.paint(0x1b1b1b), [0.36, 1.2, 0.41], null, { cast: false });
  L.box(0.12, 0.08, 0.02, mats.emissive(0x50ff80, 3), [0.36, 1.55, 0.43], null, { cast: false });
  L.cbox(1.0, 2.0, 0.8, [0, 1, 0]);
  // machine à café
  L.box(0.7, 1.6, 0.6, mats.metal(0x5d6164, { rough: 0.4 }), [1.2, 0.8, -0.1]);
  L.box(0.4, 0.25, 0.02, mats.emissive(0x3ec7ff, 1.8), [1.2, 1.3, 0.21], null, { cast: false });
  L.box(0.3, 0.2, 0.2, mats.metal(0x111111), [1.2, 0.9, 0.2], null, { cast: false });
  L.cbox(0.7, 1.6, 0.6, [1.2, 0.8, -0.1]);
  // table haute + gobelets
  L.cyl(0.4, 0.4, 0.04, mats.metal(0x4b4f52), [1.0, 1.08, 1.4], null, { seg: 20 });
  L.cyl(0.04, 0.04, 1.06, mats.metal(0x2b2f32), [1.0, 0.53, 1.4], null, { seg: 8 });
  L.cyl(0.25, 0.25, 0.03, mats.metal(0x2b2f32), [1.0, 0.02, 1.4], null, { seg: 16, cast: false });
  for (const [dx, dz] of [[0.12, 0.05], [-0.1, -0.1]]) L.cyl(0.035, 0.03, 0.1, mats.plastic(0xeeeeee, 0.6), [1.0 + dx, 1.15, 1.4 + dz], null, { seg: 8, cast: false });
  L.cbox(0.8, 1.1, 0.8, [1.0, 0.55, 1.4]);
  // poubelle
  L.cyl(0.25, 0.22, 0.75, mats.paint(0x3a5a3a), [-0.9, 0.375, 0.2], null, { seg: 14 });
  L.obstacle(1.6, 1.4, 0.4, 0.6);
}

export function bench(ctx, x, z, ry, len = 2.0, mat = null) {
  const L = new Local(ctx.builder, x, 0, z, ry, ctx.scene);
  const { mats } = ctx;
  const seat = mat || mats.metal(0x4b4f52, { rough: 0.5 });
  L.box(len, 0.06, 0.45, seat, [0, 0.45, 0]);
  L.box(len, 0.4, 0.05, seat, [0, 0.72, -0.22], [-0.15, 0, 0]);
  for (const s of [-1, 1]) L.box(0.06, 0.45, 0.4, mats.metal(0x2b2f32), [s * (len / 2 - 0.1), 0.225, 0]);
  L.cbox(len, 0.5, 0.5, [0, 0.25, 0]);
  L.obstacle(len / 2 + 0.1, 0.35);
}

// --------------------------------------------------------------------------- extincteur
export function extinguisher(ctx, x, y, z, ry) {
  const L = new Local(ctx.builder, x, y, z, ry, ctx.scene);
  L.cyl(0.08, 0.08, 0.5, ctx.mats.plastic(0xb01c14, 0.35), [0, 0.25, 0], null, { seg: 10, cast: false });
  L.box(0.04, 0.12, 0.12, ctx.mats.smooth(0x222222, 0.4, 0.8), [0, 0.55, 0], null, { cast: false });
  L.box(0.3, 0.7, 0.02, ctx.mats.paint(0xb01c14), [0, 0.3, -0.1], null, { cast: false });
}

// --------------------------------------------------------------------------- échelle appuyée
export function ladder(ctx, x, z, ry, h = 3.5) {
  const L = new Local(ctx.builder, x, 0, z, ry, ctx.scene);
  const m = ctx.mats.smooth(0xb8bcbe, 0.35, 0.9);
  const tilt = 0.25;
  for (const s of [-1, 1]) L.box(0.05, h, 0.08, m, [s * 0.22, h / 2 * Math.cos(tilt), h / 2 * Math.sin(tilt)], [tilt, 0, 0], { cast: false });
  for (let k = 0.3; k < h; k += 0.3) L.box(0.44, 0.03, 0.03, m, [0, k * Math.cos(tilt), k * Math.sin(tilt)], null, { cast: false });
}

// =========================================================================== mise en place
export function buildProps(ctx) {
  ctx.screens = ctx.screens || [];
  seed(98765);
  const { ships } = ctx;

  // --- stockage fret (fond est) : piles de conteneurs
  const colors = [0x8a3a22, 0x2c4f6e, 0x5d6656, 0x9a5a1e, 0x6b6e70, 0x3a5a4a];
  const labels = ['SOL 4471 22', 'HAL 0918 07', 'SOL 2209 40', 'KRV 7731 18', 'SOL 0042 09', 'HAL 5512 33'];
  let ci = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const x = STORAGE.x - 6.0 + j * 2.7, z = STORAGE.z - 2;
      const stack = i === 0 ? 3 : i === 1 ? 2 : 1;
      for (let k = 0; k < stack; k++) container(ctx, x + (k % 2) * 0.08 - 0.04, k * 2.6, z + i * 0.0 + (i - 1) * 0, 0, colors[ci++ % colors.length], labels[ci % labels.length]);
      if (i > 0) break;
    }
  }
  // seconde rangée de conteneurs le long du mur du fond (couchés selon x)
  for (let k = 0; k < 2; k++) container(ctx, 12, k * 2.6, Z_BACK - 2.0, Math.PI / 2, colors[(ci++ + 2) % colors.length], labels[(ci + 3) % labels.length]);
  // caisses et palettes devant
  const crateSpots = [[STORAGE.x + 2.5, STORAGE.z - 4], [STORAGE.x + 4.2, STORAGE.z - 4.2], [STORAGE.x + 3.3, STORAGE.z - 1.5], [STORAGE.x + 1.5, STORAGE.z + 2], [STORAGE.x + 4.5, STORAGE.z + 1]];
  crateSpots.forEach(([x, z], i) => {
    pallet(ctx, x, z, rand() * 0.3);
    let y = 0.13;
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) y += crate(ctx, x + (rand() - 0.5) * 0.1, y, z + (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.2, 0.9 + rand() * 0.3, i + k);
    ctx.builder.addObstacle(x, z, 0.8, 0.8, 0);
  });

  // --- caisses le long des murs
  const wallCrates = [[-HX + 2.2, -30], [-HX + 2.2, -27.8], [-HX + 2.4, 22], [-HX + 2.2, 24.2], [HX - 2.2, -38], [HX - 2.3, -8.5], [HX - 2.2, -6.3]];
  wallCrates.forEach(([x, z], i) => {
    let y = 0;
    const n = 1 + (i % 3);
    for (let k = 0; k < n; k++) y += crate(ctx, x, y, z, (rand() - 0.5) * 0.3, 0.8 + rand() * 0.5, i + k * 2);
    ctx.builder.addObstacle(x, z, 0.8, 0.7, 0);
  });
  // fûts
  for (const [x, z, c] of [[-HX + 2.0, -18, 0x2b5e8c], [-HX + 2.6, -17.4, 0x2b5e8c], [-HX + 2.0, -16.8, 0x9a3a1a], [HX - 2.2, 8.6, 0xc89a1e], [HX - 2.0, 9.3, 0xc89a1e], [HX - 2.6, 9.0, 0x3a5a3a]]) barrel(ctx, x, 0, z, c);
  barrel(ctx, HX - 3.6, 0, 9.4, 0x3a5a3a, true);
  ctx.builder.addObstacle(-HX + 2.3, -17.4, 0.9, 1.0, 0);
  ctx.builder.addObstacle(HX - 2.6, 9.2, 1.2, 0.9, 0);

  // --- zone maintenance (aire 04, chasseur)
  const f = PADS.p4;
  toolChest(ctx, f.x + 1.0, f.z + 7.2, Math.PI + 0.2);
  toolChest(ctx, f.x - 0.6, f.z + 7.4, Math.PI - 0.1, 0x2a5c8a);
  workbench(ctx, HX - 1.2, 19.5, -Math.PI / 2);
  gasRack(ctx, HX - 0.8, 23.5, -Math.PI / 2);
  terminal(ctx, f.x - 4.0, f.z + 7.0, Math.PI, 'diag', 'AIRE 04');
  for (const [dx, dz] of [[-9.5, -4], [-9.5, 4], [-6, -7.5], [9.2, -2]]) cone(ctx, f.x + dx, f.z + dz);

  // --- aire 02 (joueur) et 03 (cargo)
  terminal(ctx, PADS.p2.x + 9.5, PADS.p2.z + 13.5, -Math.PI / 4, 'pad', 'AIRE 02');
  terminal(ctx, PADS.p3.x - 9.0, PADS.p3.z + 10.5, Math.PI / 4, 'cargo', 'AIRE 03');
  terminal(ctx, PADS.p5.x + 7.5, PADS.p5.z - 7.5, Math.PI * 0.75, 'pad', 'AIRE 05');
  if (ships) {
    groundPower(ctx, PADS.p2.x + 7.6, PADS.p2.z + 9.5, 0.3, null);
    groundPower(ctx, PADS.p3.x - 9.5, PADS.p3.z - 3, -0.2, ships.mulet.local(-5.0, 2.5, -3));
  }
  // --- coin pause près du sas
  breakArea(ctx, -HX + 0.8, AIRLOCK.z + 7.0, Math.PI / 2);
  bench(ctx, -HX + 1.0, AIRLOCK.z - 7.5, Math.PI / 2, 2.4);
  // --- extincteurs sur les poteaux
  for (let i = 1; i < COLS.length - 2; i += 2) {
    extinguisher(ctx, HX - 1.3, 1.0, COLS[i] + 0.6, -Math.PI / 2);
    extinguisher(ctx, -HX + 1.3, 1.0, COLS[i] + 0.6, Math.PI / 2);
  }
  // --- barrières devant la baie
  stanchions(ctx, [[-21, Z_BAY + 3.2], [-17, Z_BAY + 3.2], [-13, Z_BAY + 3.2]]);
  stanchions(ctx, [[13, Z_BAY + 3.2], [17, Z_BAY + 3.2], [21, Z_BAY + 3.2]]);

  // animation des écrans
  ctx.updaters.push((dt, t) => { for (const s of ctx.screens) s.update(dt, t); });
}
