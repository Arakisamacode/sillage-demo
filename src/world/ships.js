import * as THREE from 'three';
import { Builder } from './builder.js';
import { metricBox } from './materials.js';
import { loft, wing, nozzle, flipFaces } from './shipkit.js';
import { PADS } from './layout.js';
import { paintedText, decalMaterial } from './signage.js';

// Quatre vaisseaux originaux, modélisés en code :
//  - « Héron » (corvette du joueur, aire 02) avec intérieur accessible par la rampe arrière
//  - « Mulet H4 » (cargo lourd, aire 03), soute ouverte, chargement en cours
//  - « Faucon » (chasseur léger, aire 04), en maintenance
//  - « Navette ST-40 » (aire 05), débarquement de passagers

class ShipCtx {
  constructor(ctx, pad, name) {
    this.ctx = ctx;
    this.B = ctx.builder;
    this.mats = ctx.mats;
    this.heading = pad.heading;
    this.origin = new THREE.Vector3(pad.x, 0, pad.z);
    this.M = new THREE.Matrix4().compose(this.origin, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, pad.heading, 0)), new THREE.Vector3(1, 1, 1));
    this.name = name;
    this.group = new THREE.Group();
    this.group.position.copy(this.origin);
    this.group.rotation.y = pad.heading;
    ctx.scene.add(this.group);
    this.navLights = [];
  }
  add(geo, mat, pos = [0, 0, 0], rot = null, opts = {}) {
    return this.B.add(geo, mat, Builder.matrix(pos, rot), { ...opts, parent: this.M });
  }
  box(w, h, d, mat, pos, rot, opts = {}) { return this.add(metricBox(w, h, d, opts.tex ?? 2), mat, pos, rot, opts); }
  cyl(rt, rb, h, mat, pos, rot, opts = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, opts.seg ?? 16, 1, opts.open ?? false), mat, pos, rot, opts); }
  /** boîte de collision en coordonnées locales */
  cbox(w, h, d, pos) {
    const p = new THREE.Vector3(...pos).applyMatrix4(this.M);
    this.B.colliderBox(w, h, d, [p.x, p.y, p.z], [0, this.heading, 0]);
  }
  /** empreinte au sol pour l'évitement des PNJ */
  footprint(hw, hd, cx = 0, cz = 0) {
    const p = new THREE.Vector3(cx, 0, cz).applyMatrix4(this.M);
    this.B.addObstacle(p.x, p.z, hw, hd, this.heading);
  }
  local(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.M); }
  navLight(pos, color, blink = 0) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(8) }));
    m.position.set(...pos);
    this.group.add(m);
    this.navLights.push({ m, blink, base: m.material.color.clone() });
  }
  decal(lines, width, pos, rotY, opts = {}) {
    const { tex, aspect } = paintedText(lines, { size: 140, wear: 0.6, ...opts });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / aspect), decalMaterial(tex, { rough: 0.5 }));
    m.position.set(...pos); m.rotation.y = rotY;
    if (opts.rotX) m.rotation.x = opts.rotX;
    this.group.add(m);
    return m;
  }
  gear(x, z, h, mats, opts = {}) {
    const strut = mats.smooth(0x3a3d40, 0.55, 0.9);
    const chrome = mats.smooth(0xd0d4d6, 0.15, 1.0, { grime: 0.3, floor: 0.2 });
    const r = opts.r ?? 0.14;
    this.cyl(r * 1.3, r * 1.3, h * 0.55, strut, [x, h * 0.72, z]);
    this.cyl(r * 0.8, r * 0.8, h * 0.5, chrome, [x, h * 0.32, z], null, { seg: 12 });
    this.box(0.9 * (opts.pad ?? 1), 0.18, 1.2 * (opts.pad ?? 1), strut, [x, 0.09, z]);
    this.box(0.5, 0.25, 0.6, strut, [x, 0.25, z]);
    // bras de compas
    this.box(0.08, h * 0.5, 0.08, strut, [x, h * 0.55, z + 0.35], [0.35, 0, 0]);
    // flexibles hydrauliques
    this.ctx.builder.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + r * 1.4, h, z), new THREE.Vector3(x + r * 1.8, h * 0.6, z + 0.1), new THREE.Vector3(x + r * 1.1, h * 0.3, z),
    ]), 10, 0.025, 5), mats.rubber(), new THREE.Matrix4(), { parent: this.M, cast: false });
    // cales de roue jaunes
    if (opts.chocks !== false) {
      const y = mats.plastic(0xd4a017, 0.6);
      this.box(0.25, 0.2, 0.3, y, [x + 0.62, 0.1, z]);
      this.box(0.25, 0.2, 0.3, y, [x - 0.62, 0.1, z]);
    }
  }
}

function greebles(S, mat, x0, x1, y, z0, z1, n, seedv) {
  let s = seedv;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < n; i++) {
    const w = 0.15 + r() * 0.6, d = 0.2 + r() * 0.9, h = 0.05 + r() * 0.18;
    S.box(w, h, d, mat, [x0 + r() * (x1 - x0), y + h / 2, z0 + r() * (z1 - z0)], null, { cast: false, tex: 1 });
  }
}

// =============================================================================== Héron (joueur)

function buildHeron(ctx) {
  const pad = PADS.p2;
  const S = new ShipCtx(ctx, pad, 'heron');
  const { mats } = ctx;
  const hull = mats.paint(0xc9c6bd, { grime: 0.75, scratch: 0.8, rust: 0.05 });
  const hull2 = mats.paint(0x3d4347, { grime: 0.7 });
  const accent = mats.paint(0xc0571e, { grime: 0.6 });
  const metal = mats.metal(0x55595c);
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1015, roughness: 0.05, metalness: 1.0, envMapIntensity: 1.4 });

  // fuselage
  const fus = loft([
    { z: -12.2, w: 0.25, h: 0.2, y: 3.5, n: 2.2 },
    { z: -10.5, w: 2.0, h: 1.3, y: 3.45, n: 2.3, fb: 0.2 },
    { z: -7.5, w: 3.9, h: 2.4, y: 3.45, n: 2.6, fb: 0.35 },
    { z: -3, w: 4.8, h: 2.1, y: 3.55, n: 3.0, fb: 0.4 },
    { z: 4, w: 4.9, h: 2.05, y: 3.6, n: 3.2, fb: 0.45 },
    { z: 9, w: 4.4, h: 1.95, y: 3.7, n: 3.2, fb: 0.45 },
    { z: 11.3, w: 3.9, h: 1.75, y: 3.75, n: 3.4, fb: 0.4 },
  ], { radial: 48, steps: 7, texSize: 5 });
  S.add(fus, hull);
  // bande de couleur basse (sous-coque sombre)
  const belly = loft([
    { z: -9.5, w: 2.4, h: 0.7, y: 2.75, n: 3, fb: 0.0 },
    { z: -3, w: 4.6, h: 0.9, y: 2.55, n: 4, fb: 0.0 },
    { z: 9, w: 4.2, h: 0.85, y: 2.6, n: 4, fb: 0.0 },
    { z: 11.25, w: 3.75, h: 0.7, y: 2.62, n: 4, fb: 0.0 },
  ], { radial: 40, steps: 5, texSize: 2, arc: [Math.PI * 1.02, Math.PI * 1.98] });
  S.add(belly, hull2);
  // verrière
  const canopy = loft([
    { z: -11.0, w: 0.9, h: 0.25, y: 4.05, n: 2.2 },
    { z: -9.5, w: 1.6, h: 0.75, y: 4.15, n: 2.4 },
    { z: -7.0, w: 1.7, h: 0.95, y: 4.3, n: 2.6 },
    { z: -5.0, w: 1.5, h: 0.55, y: 4.55, n: 2.6 },
  ], { radial: 28, steps: 6, arc: [0.05, Math.PI - 0.05] });
  S.add(canopy, glass, [0, 0, 0], null, { cast: false });
  // montants de verrière
  for (const x of [-0.75, 0.75]) S.box(0.07, 0.07, 4.2, hull2, [x, 4.92, -7.8], [-0.12, 0, x * 0.25]);
  // dos : arête dorsale, carénages, antennes
  S.box(0.6, 0.35, 12, hull, [0, 5.55, 3.8], [0.01, 0, 0], { tex: 3 });
  greebles(S, metal, -1.4, 1.4, 5.5, -2, 10, 22, 4242);
  S.cyl(0.02, 0.02, 1.2, metal, [0.6, 6.1, 7]);
  S.cyl(0.02, 0.02, 0.8, metal, [-0.5, 6.0, 8.5]);
  // nacelles moteur
  for (const s of [-1, 1]) {
    const nac = loft([
      { z: -2.0, w: 0.3, h: 0.3, y: 3.0, x: s * 4.3, n: 2 },
      { z: -0.5, w: 0.95, h: 0.9, y: 3.0, x: s * 4.3, n: 2.2 },
      { z: 6, w: 1.1, h: 1.05, y: 3.0, x: s * 4.3, n: 2.4 },
      { z: 10.8, w: 1.0, h: 0.95, y: 3.0, x: s * 4.3, n: 2.3 },
    ], { radial: 28, steps: 5 });
    S.add(nac, hull);
    S.add(nozzle(0.85, 1.4), metal, [s * 4.3, 3.0, 10.7]);
    // fond de tuyère légèrement incandescent (moteurs en refroidissement)
    S.add(new THREE.CircleGeometry(0.62, 20), mats.emissive(0xff6a2a, 0.9), [s * 4.3, 3.0, 10.9], null, { cast: false });
    // entrée d'air
    S.add(new THREE.CircleGeometry(0.55, 20), mats.metal(0x111315), [s * 4.3, 3.0, -1.55], [0, Math.PI, 0], { cast: false });
    // pylône
    S.box(1.6, 0.5, 6.5, hull2, [s * 3.3, 3.05, 4.5]);
    // ailes
    const wg = wing([[0, -2.5], [4.6, 3.6], [4.6, 6.4], [0, 7.4]], 0.32);
    const wm = new THREE.Matrix4().makeScale(s, 1, 1);
    wg.applyMatrix4(wm);
    if (s < 0) flipFaces(wg.index ? wg : wg);
    S.add(wg, hull, [s * 4.6, 2.85, 0]);
    // bandes orange en bout d'aile
    S.box(0.5, 0.36, 2.8, accent, [s * 9.0, 2.85, 5.0], null, { tex: 1 });
    // dérive inclinée
    const fin = wing([[0, 0], [2.6, 3.0], [2.6, 4.6], [0, 6.0]], 0.22);
    fin.rotateZ(-Math.PI / 2);
    S.add(fin, hull, [s * 4.3, 3.9, 4.2], [0, 0, s * 0.42]);
    S.navLight([s * 9.25, 2.85, 5.0], s < 0 ? 0xff2010 : 0x20ff40, 0);
    S.navLight([s * 5.6, 6.4, 9.2], 0xffffff, 1.0 + s * 0.3);
    // trappes de visite ouvertes sur une nacelle (côté droit)
    if (s > 0) {
      S.box(0.06, 0.6, 1.0, hull, [s * 5.55, 2.4, 2.0], [0, 0, 0.9]);
      S.box(0.02, 0.5, 0.9, mats.metal(0x1a1b1c), [s * 5.38, 2.9, 2.0], [0, 0, 0.2]);
    }
  }
  // marquages
  S.decal(['HÉRON · HL-2207'], 4.2, [-2.66 - 0.23, 3.7, 1.2], -Math.PI / 2, { color: '#2a2e31', size: 120, wear: 0.4 });
  S.decal(['HL-2207'], 3.2, [2.89, 3.7, 1.2], Math.PI / 2, { color: '#2a2e31', size: 120, wear: 0.4 });
  // bande orange longitudinale
  for (const s of [-1, 1]) S.box(0.04, 0.2, 13, accent, [s * 4.86, 3.1, 2.5], null, { cast: false, tex: 1 });

  // ---------------------------------------------------------------- intérieur (soute + cockpit)
  const iw = 1.95, fy = 2.05, cy = 4.85;
  const floorM = mats.metal(0x4b4f52, { rough: 0.6 });
  const wallM = mats.paint(0xa8aaa6, { grime: 0.4, floor: 0.6 });
  const darkM = mats.paint(0x2b2f32);
  S.box(iw * 2 + 0.2, 0.12, 17.5, floorM, [0, fy - 0.06, 2.6], null, { tex: 2 });
  for (const s of [-1, 1]) {
    S.box(0.12, cy - fy, 15.2, wallM, [s * iw, (fy + cy) / 2, 3.7], null, { tex: 2 });
    // casiers, banquettes, filets
    for (let z = -3; z < 9; z += 1.3) S.box(0.35, 1.9, 1.2, darkM, [s * (iw - 0.22), fy + 1.15, z], null, { cast: false });
    S.box(0.5, 0.45, 3.0, mats.plastic(0x5b2d1c, 0.8), [s * (iw - 0.3), fy + 0.22, 9.2]);
    // nervures
    for (let z = -4; z <= 11; z += 2.5) S.box(0.2, cy - fy, 0.18, darkM, [s * (iw - 0.06), (fy + cy) / 2, z], null, { cast: false });
  }
  S.box(iw * 2, 0.12, 15.2, wallM, [0, cy, 3.7], null, { tex: 2 });
  // bandeaux lumineux au plafond
  S.box(0.25, 0.04, 12, mats.emissive(0xfff0dc, 4), [0, cy - 0.08, 3.5], null, { cast: false });
  // cloison cockpit avec passage
  S.box(0.9, cy - fy, 0.15, darkM, [-1.45, (fy + cy) / 2, -3.9]);
  S.box(0.9, cy - fy, 0.15, darkM, [1.45, (fy + cy) / 2, -3.9]);
  S.box(2.0, 0.6, 0.15, darkM, [0, cy - 0.3, -3.9]);
  // cockpit : plancher, sièges, consoles
  S.box(3.4, 0.12, 6.0, floorM, [0, fy + 0.25, -7.0]);
  for (const x of [-0.8, 0.8]) {
    const seat = mats.plastic(0x222426, 0.7);
    S.box(0.6, 0.15, 0.6, seat, [x, fy + 0.75, -7.0]);
    S.box(0.6, 0.9, 0.15, seat, [x, fy + 1.25, -6.65], [-0.2, 0, 0]);
    S.cyl(0.08, 0.1, 0.45, metal, [x, fy + 0.5, -7.0]);
    S.box(0.9, 0.7, 0.6, darkM, [x, fy + 0.9, -8.6], [0.4, 0, 0]);
    S.box(0.45, 0.3, 0.02, mats.emissive(0x3ec7ff, 2.2), [x - 0.2, fy + 1.27, -8.42], [-0.6, 0, 0], { cast: false });
    S.box(0.35, 0.28, 0.02, mats.emissive(0xffa040, 1.8), [x + 0.22, fy + 1.27, -8.42], [-0.6, 0, 0], { cast: false });
  }
  S.box(3.0, 0.5, 0.8, darkM, [0, fy + 1.1, -9.4], [0.5, 0, 0]);
  // cadre de porte arrière
  S.box(0.25, cy - fy + 0.3, 0.3, darkM, [-iw - 0.05, (fy + cy) / 2, 11.25]);
  S.box(0.25, cy - fy + 0.3, 0.3, darkM, [iw + 0.05, (fy + cy) / 2, 11.25]);
  S.box(iw * 2 + 0.4, 0.4, 0.3, darkM, [0, cy + 0.1, 11.25]);
  // rampe : panneau incliné + vérins
  const rampLen = Math.hypot(fy, 4.3), ang = Math.atan2(fy, 4.3);
  const ramp = new THREE.Group();
  S.box(iw * 2 - 0.1, 0.14, rampLen, mats.metal(0x5a5e60, { rough: 0.55 }), [0, fy / 2 + 0.02, 11.3 + 2.15], [-ang, 0, 0], { tex: 1 });
  for (let k = 0; k < 8; k++) S.box(iw * 2 - 0.3, 0.04, 0.05, mats.metal(0x2a2c2e), [0, fy / 2 + 0.11 + (k - 3.5) * -0.2 * Math.sin(ang), 11.3 + 2.15 + (k - 3.5) * 0.5 * Math.cos(ang)], [-ang, 0, 0], { cast: false });
  for (const s of [-1, 1]) {
    S.box(0.06, 0.3, rampLen, mats.paint(0xc89a1e), [s * (iw - 0.05), fy / 2 + 0.18, 11.3 + 2.15], [-ang, 0, 0], { cast: false });
    S.cyl(0.06, 0.06, 2.0, mats.smooth(0xc8ccce, 0.2, 1), [s * (iw - 0.25), fy * 0.7 + 0.2, 12.3], [Math.PI / 2 - 0.9, 0, 0]);
  }
  // collisions : ventre, parois, plafond, cockpit, rampe, nacelles
  S.cbox(5.6, fy, 23, [0, fy / 2, -0.4]);         // sous le plancher (inaccessible)
  for (const s of [-1, 1]) S.cbox(0.4, 3.2, 16, [s * (iw + 0.2), fy + 1.6, 3.5]);
  S.cbox(iw * 2, 0.3, 16, [0, cy + 0.15, 3.5]);
  S.cbox(3.8, 3.2, 0.3, [0, fy + 1.6, -10.3]);
  for (const s of [-1, 1]) S.cbox(0.3, 3.2, 6.5, [s * 1.75, fy + 1.6, -7.2]);
  for (const s of [-1, 1]) S.cbox(2.4, 2.2, 13, [s * 4.3, 3.0, 4.4]);
  // pente de la rampe (surface de marche) + garde-corps
  {
    const g = new THREE.PlaneGeometry(iw * 2 - 0.1, rampLen + 0.1).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    const m = Builder.matrix([0, fy / 2 + 0.09, 11.3 + 2.15], [-ang, 0, 0]);
    g.applyMatrix4(m); g.applyMatrix4(S.M);
    ctx.builder.addCollider(g);
    const f = new THREE.PlaneGeometry(iw * 2, 17.5).toNonIndexed(); f.rotateX(-Math.PI / 2);
    f.applyMatrix4(Builder.matrix([0, fy, 2.6])); f.applyMatrix4(S.M); ctx.builder.addCollider(f);
    const c = new THREE.PlaneGeometry(3.4, 6).toNonIndexed(); c.rotateX(-Math.PI / 2);
    c.applyMatrix4(Builder.matrix([0, fy + 0.31, -7])); c.applyMatrix4(S.M); ctx.builder.addCollider(c);
  }
  // train d'atterrissage
  S.gear(0, -8.2, 2.3, mats, { r: 0.12 });
  for (const s of [-1, 1]) S.gear(s * 2.6, 5.5, 1.9, mats, { r: 0.16, pad: 1.2 });
  S.footprint(4.6, 11.5, 0, 0);
  S.footprint(9.0, 2.5, 0, 3.5);

  // lumière intérieure chaude
  if (ctx.quality.name !== 'low') {
    const l = new THREE.PointLight(0xffd9b0, 6, 9, 2);
    l.position.copy(S.local(0, 4.3, 5));
    ctx.scene.add(l);
  }
  S.interior = { floorY: fy, rampTop: S.local(0, fy, 11.3), rampBottom: S.local(0, 0, 15.6), seat: S.local(-0.8, fy + 0.9, -7.0), cockpit: S.local(0, fy + 1.6, -7.5) };
  return S;
}

// =============================================================================== Mulet H4 (cargo)

function buildMulet(ctx) {
  const pad = PADS.p3;
  const S = new ShipCtx(ctx, pad, 'mulet');
  const { mats } = ctx;
  const hull = mats.paint(0xa3a88f, { grime: 0.8, scratch: 0.5, rust: 0.3 });
  const hull2 = mats.paint(0x5a605a, { grime: 0.8, scratch: 0.4, rust: 0.3 });
  const yellow = mats.paint(0xc89a1e, { grime: 0.9 });
  const metal = mats.metal(0x4d5154);
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1015, roughness: 0.08, metalness: 1.0 });
  const fy = 2.3, iw = 3.6, cy = 7.6;
  // corps principal anguleux
  const body = loft([
    { z: -15.5, w: 2.6, h: 2.0, y: 4.6, n: 3 },
    { z: -13, w: 4.6, h: 3.1, y: 4.9, n: 5, fb: 0.1 },
    { z: -8, w: 5.0, h: 3.4, y: 5.0, n: 7, fb: 0.15 },
    { z: 12, w: 5.0, h: 3.4, y: 5.0, n: 7, fb: 0.15 },
    { z: 15.5, w: 4.8, h: 3.2, y: 5.0, n: 7, fb: 0.15 },
  ], { radial: 56, steps: 6, texSize: 5 });
  S.add(body, hull);
  // passerelle de commandement surélevée
  const bridge = loft([
    { z: -14.2, w: 0.8, h: 0.3, y: 8.3, n: 3 },
    { z: -13, w: 2.4, h: 1.0, y: 8.4, n: 4 },
    { z: -8, w: 2.8, h: 1.2, y: 8.5, n: 5 },
    { z: -4, w: 2.4, h: 0.9, y: 8.4, n: 5 },
  ], { radial: 36, steps: 5, arc: [0.02, Math.PI - 0.02] });
  S.add(bridge, hull2);
  S.box(4.6, 0.12, 0.8, glass, [0, 8.85, -13.2], [0.75, 0, 0], { cast: false });
  for (const x of [-1.6, 1.6]) S.box(1.4, 0.7, 0.08, glass, [x * 1.05, 8.7, -12.5], [0, x * 0.35, 0], { cast: false });
  // côtes de renfort et bandes de danger
  for (let z = -10; z <= 12; z += 2.75) {
    const rib = loft([{ z: z - 0.12, w: 5.12, h: 3.5, y: 5.0, n: 7, fb: 0.15 }, { z: z + 0.12, w: 5.12, h: 3.5, y: 5.0, n: 7, fb: 0.15 }], { radial: 56, steps: 1 });
    S.add(rib, hull2, [0, 0, 0], null, { cast: false });
  }
  // conteneurs/modules latéraux et moteurs
  for (const s of [-1, 1]) {
    S.box(1.4, 2.6, 18, hull2, [s * 5.6, 4.6, 1.5], null, { tex: 3 });
    for (const z of [-4, 10]) {
      const pod = loft([
        { z: z - 2.5, w: 0.4, h: 0.4, y: 5.2, x: s * 7.3, n: 2 },
        { z: z - 1.5, w: 1.3, h: 1.3, y: 5.2, x: s * 7.3, n: 2.2 },
        { z: z + 2.8, w: 1.35, h: 1.35, y: 5.2, x: s * 7.3, n: 2.2 },
      ], { radial: 24, steps: 4 });
      S.add(pod, hull);
      S.add(nozzle(1.1, 1.3), metal, [s * 7.3, 5.2, z + 2.7]);
      S.add(new THREE.CircleGeometry(0.85, 20), mats.metal(0x0d0e0f), [s * 7.3, 5.2, z + 2.9], null, { cast: false });
      S.box(1.8, 0.6, 2.0, hull2, [s * 6.4, 5.2, z + 0.5]);
    }
    S.navLight([s * 7.3, 6.7, -4], s < 0 ? 0xff2010 : 0x20ff40, 0);
    // bandes de danger sur les flancs
    S.box(0.05, 0.4, 18, yellow, [s * 6.31, 3.5, 1.5], null, { cast: false, tex: 1 });
  }
  greebles(S, metal, -3.5, 3.5, 8.35, -2, 14, 40, 777);
  // marquages
  S.decal(['MULET H4', 'SILLAGE ORBITAL LOGISTICS'], 6.5, [-6.31, 5.6, 1.5], -Math.PI / 2, { color: '#d9d2bf', size: 120, wear: 1.2 });
  S.decal(['MH4-0918'], 4, [6.31, 5.6, 1.5], Math.PI / 2, { color: '#d9d2bf', size: 140, wear: 1.2 });
  S.decal(['CHARGE MAX 120 T'], 2.6, [0, 7.0, 15.56], 0, { color: '#e6c040', size: 100, wear: 0.8 });

  // soute : plancher, parois, plafond, éclairage
  const floorM = mats.metal(0x55595b, { rough: 0.65 });
  S.box(iw * 2, 0.15, 25, floorM, [0, fy - 0.07, 2.5], null, { tex: 2 });
  for (const s of [-1, 1]) {
    S.box(0.15, cy - fy, 25, hull2, [s * iw, (fy + cy) / 2, 2.5], null, { tex: 3 });
    for (let z = -9; z < 15; z += 2) S.box(0.25, cy - fy, 0.2, metal, [s * (iw - 0.1), (fy + cy) / 2, z], null, { cast: false });
    S.box(0.1, 0.06, 23, mats.paint(0xc89a1e), [s * (iw - 0.2), fy + 1.0, 2.5], null, { cast: false });
  }
  S.box(iw * 2, 0.15, 25, hull2, [0, cy, 2.5]);
  for (let z = -8; z < 14; z += 4) S.box(1.2, 0.05, 0.3, mats.emissive(0xfff2dd, 3.5), [0, cy - 0.1, z], null, { cast: false });
  S.box(iw * 2, cy - fy, 0.2, hull2, [0, (fy + cy) / 2, -10]);
  // porte arrière (rampe large)
  const rampLen = Math.hypot(fy, 5.2), ang = Math.atan2(fy, 5.2);
  S.box(iw * 2 - 0.2, 0.18, rampLen, mats.metal(0x5a5e60, { rough: 0.5 }), [0, fy / 2 + 0.02, 15.5 + 2.6], [-ang, 0, 0], { tex: 2 });
  for (const s of [-1, 1]) {
    S.box(0.1, 0.25, rampLen, yellow, [s * (iw - 0.15), fy / 2 + 0.2, 15.5 + 2.6], [-ang, 0, 0], { cast: false });
    S.cyl(0.09, 0.09, 3.0, mats.smooth(0xc8ccce, 0.2, 1), [s * (iw - 0.4), fy * 0.8 + 0.5, 16.5], [Math.PI / 2 - 1.0, 0, 0]);
  }
  // pieds d'atterrissage
  for (const s of [-1, 1]) for (const z of [-11, 10]) S.gear(s * 4.0, z, 2.6, mats, { r: 0.24, pad: 1.6 });
  // collisions
  S.cbox(10.4, fy, 31, [0, fy / 2, 0]);
  for (const s of [-1, 1]) S.cbox(0.4, cy - fy, 26, [s * (iw + 0.2), (fy + cy) / 2, 2.5]);
  for (const s of [-1, 1]) S.cbox(3.2, 6, 26, [s * 6.0, 4.6, 2.5]);
  S.cbox(iw * 2, 0.3, 26, [0, cy + 0.15, 2.5]);
  S.cbox(10, 7, 6, [0, 5, -13]);
  {
    const g = new THREE.PlaneGeometry(iw * 2 - 0.2, rampLen + 0.1).toNonIndexed(); g.rotateX(-Math.PI / 2);
    g.applyMatrix4(Builder.matrix([0, fy / 2 + 0.11, 15.5 + 2.6], [-ang, 0, 0])); g.applyMatrix4(S.M); ctx.builder.addCollider(g);
    const f = new THREE.PlaneGeometry(iw * 2, 25).toNonIndexed(); f.rotateX(-Math.PI / 2);
    f.applyMatrix4(Builder.matrix([0, fy, 2.5])); f.applyMatrix4(S.M); ctx.builder.addCollider(f);
  }
  S.footprint(8.4, 16, 0, -0.5);
  if (ctx.quality.name !== 'low') {
    const l = new THREE.PointLight(0xfff0d8, 10, 14, 2);
    l.position.copy(S.local(0, 6.8, 8));
    ctx.scene.add(l);
  }
  S.cargo = { floorY: fy, rampTop: S.local(0, fy, 15.5), rampBottom: S.local(0, 0, 20.7), slots: [] };
  for (let z = 12; z >= -6; z -= 2.6) for (const x of [-1.6, 1.6]) S.cargo.slots.push(S.local(x, fy, z));
  return S;
}

// =============================================================================== Faucon (chasseur)

function buildFaucon(ctx) {
  const pad = PADS.p4;
  const S = new ShipCtx(ctx, pad, 'faucon');
  const { mats } = ctx;
  const hull = mats.paint(0x5a6168, { grime: 0.6, scratch: 0.5, rust: 0.05 });
  const hull2 = mats.paint(0x22262a);
  const red = mats.paint(0x8c1e18, { grime: 0.5 });
  const metal = mats.metal(0x55595c);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a1408, roughness: 0.05, metalness: 1.0, envMapIntensity: 1.5 });
  const fus = loft([
    { z: -8.0, w: 0.12, h: 0.12, y: 2.2, n: 2 },
    { z: -6.0, w: 0.8, h: 0.6, y: 2.25, n: 2.4, fb: 0.2 },
    { z: -3.0, w: 1.5, h: 1.0, y: 2.35, n: 2.6, fb: 0.3 },
    { z: 1.0, w: 1.8, h: 1.05, y: 2.4, n: 3, fb: 0.35 },
    { z: 5.5, w: 1.9, h: 0.95, y: 2.45, n: 3.2, fb: 0.35 },
    { z: 7.0, w: 1.7, h: 0.85, y: 2.45, n: 3.2 },
  ], { radial: 40, steps: 7 });
  S.add(fus, hull);
  const canopy = loft([
    { z: -4.5, w: 0.3, h: 0.1, y: 3.0, n: 2 },
    { z: -3.2, w: 0.65, h: 0.5, y: 3.05, n: 2.2 },
    { z: -1.2, w: 0.7, h: 0.62, y: 3.1, n: 2.3 },
    { z: 0.5, w: 0.5, h: 0.35, y: 3.15, n: 2.3 },
  ], { radial: 24, steps: 6, arc: [0.03, Math.PI - 0.03] });
  // verrière ouverte (relevée vers l'arrière)
  const can = S.add(canopy, glass, [0, 0.55, 1.6], [-0.45, 0, 0], { cast: false });
  for (const s of [-1, 1]) {
    const wg = wing([[0, -1.5], [4.8, 4.0], [4.8, 5.6], [0, 6.2]], 0.22);
    wg.applyMatrix4(new THREE.Matrix4().makeScale(s, 1, 1));
    if (s < 0) flipFaces(wg);
    S.add(wg, hull, [s * 1.4, 2.15, 0]);
    S.box(0.4, 0.25, 1.6, red, [s * 6.2, 2.15, 4.8], null, { tex: 1 });
    // dérives
    const fin = wing([[0, 0], [1.9, 1.8], [1.9, 2.8], [0, 3.6]], 0.16);
    fin.rotateZ(-Math.PI / 2);
    S.add(fin, hull, [s * 1.2, 2.9, 3.6], [0, 0, s * 0.3]);
    // moteurs
    const eng = loft([
      { z: 1, w: 0.5, h: 0.5, y: 2.3, x: s * 0.95, n: 2 },
      { z: 3, w: 0.75, h: 0.75, y: 2.3, x: s * 0.95, n: 2 },
      { z: 7.6, w: 0.72, h: 0.72, y: 2.3, x: s * 0.95, n: 2 },
    ], { radial: 22, steps: 4 });
    S.add(eng, hull2);
    S.add(nozzle(0.62, 0.9), metal, [s * 0.95, 2.3, 7.5]);
    S.add(new THREE.CircleGeometry(0.45, 18), mats.metal(0x0b0c0d), [s * 0.95, 2.3, 7.65], null, { cast: false });
    // canons sous l'aile
    S.cyl(0.07, 0.07, 3.2, metal, [s * 3.2, 1.95, -0.5], [Math.PI / 2, 0, 0], { seg: 8 });
    S.navLight([s * 6.4, 2.15, 4.8], s < 0 ? 0xff2010 : 0x20ff40, 0);
  }
  // trappes de visite ouvertes (flanc gauche) avec entrailles
  S.box(0.05, 0.9, 1.4, hull, [-2.4, 1.3, 1.8], [0, 0, -0.7]);
  S.box(0.3, 0.8, 1.3, mats.metal(0x1d1f20, { rough: 0.9 }), [-1.7, 2.1, 1.8], null, { cast: false });
  for (let k = 0; k < 5; k++) ctx.builder.cable(S.local(-1.75, 1.8 + k * 0.08, 1.4 + k * 0.2).toArray(), S.local(-2.6, 0.02, 0.6 + k * 0.5).toArray(), 0.15, 0.02, k % 2 ? mats.rubber() : mats.plastic(0x2a6fbd));
  // plaque arrachée posée au sol
  S.box(1.4, 0.04, 1.0, hull, [-3.2, 0.02, 0.4], [0, 0.4, 0]);
  S.decal(['FC-31'], 1.4, [1.82, 2.5, 1.5], Math.PI / 2, { color: '#c9c3b5', size: 120, wear: 0.9 });
  S.decal(['NE PAS MARCHER'], 1.2, [3.8, 2.29, 3.6], 0, { color: '#c9c3b5', size: 70, wear: 0.9, rotX: -Math.PI / 2 });
  S.gear(0, -4.5, 1.5, mats, { r: 0.08 });
  for (const s of [-1, 1]) S.gear(s * 1.3, 2.5, 1.35, mats, { r: 0.1 });
  S.cbox(3.8, 3.2, 15, [0, 1.6, 0]);
  S.cbox(12, 0.6, 5, [0, 2.15, 3.5]);
  S.footprint(2.2, 8, 0, 0);
  S.footprint(6.6, 2.5, 0, 3.5);
  S.service = { panel: S.local(-2.6, 0, 1.8), weld: S.local(-1.6, 2.6, 2.2), fuelPort: S.local(1.9, 2.0, 4.5), nose: S.local(0, 0, -8) };
  return S;
}

// =============================================================================== Navette ST-40

function buildNavette(ctx) {
  const pad = PADS.p5;
  const S = new ShipCtx(ctx, pad, 'navette');
  const { mats } = ctx;
  const hull = mats.paint(0xd8d8d2, { grime: 0.6, scratch: 0.6, rust: 0.02 });
  const blue = mats.paint(0x1f4f7a, { grime: 0.6 });
  const hull2 = mats.paint(0x2f3438);
  const metal = mats.metal(0x55595c);
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0e12, roughness: 0.05, metalness: 1.0 });
  const fy = 1.55, iw = 1.9;
  const fus = loft([
    { z: -9.5, w: 0.5, h: 0.4, y: 3.0, n: 2.2 },
    { z: -7.8, w: 1.9, h: 1.4, y: 3.0, n: 2.5, fb: 0.3 },
    { z: -5, w: 2.4, h: 1.8, y: 3.0, n: 3.4, fb: 0.4 },
    { z: 6, w: 2.4, h: 1.8, y: 3.0, n: 3.4, fb: 0.4 },
    { z: 8.6, w: 2.0, h: 1.4, y: 3.1, n: 3, fb: 0.3 },
    { z: 9.6, w: 1.0, h: 0.7, y: 3.3, n: 2.5 },
  ], { radial: 44, steps: 6 });
  S.add(fus, hull);
  // bande bleue
  for (const s of [-1, 1]) S.box(0.05, 0.35, 13, blue, [s * 2.42, 3.0, 0.5], null, { cast: false, tex: 1 });
  // hublots
  for (let z = -4; z <= 5; z += 1.3) for (const s of [-1, 1]) S.box(0.06, 0.45, 0.6, glass, [s * 2.41, 3.55, z], null, { cast: false });
  S.box(2.6, 0.7, 0.1, glass, [0, 3.7, -8.1], [0.9, 0, 0], { cast: false });
  // moteurs arrière et ailerons courts
  for (const s of [-1, 1]) {
    const wg = wing([[0, -1], [2.2, 1.5], [2.2, 3.0], [0, 3.5]], 0.25);
    wg.applyMatrix4(new THREE.Matrix4().makeScale(s, 1, 1)); if (s < 0) flipFaces(wg);
    S.add(wg, hull, [s * 2.2, 2.2, 4.5]);
    S.add(nozzle(0.55, 0.9), metal, [s * 1.0, 3.1, 9.4]);
    S.navLight([s * 4.45, 2.2, 7.5], s < 0 ? 0xff2010 : 0x20ff40, 0);
  }
  greebles(S, metal, -1.2, 1.2, 4.75, -5, 7, 18, 31337);
  S.decal(['ST-40 · LIGNE HALDEN — TERMINUS'], 4.2, [2.43, 2.5, 0.5], Math.PI / 2, { color: '#1f4f7a', size: 110, wear: 0.4 });
  // porte latérale (côté +x = vers le sas une fois tournée) + escalier escamotable
  S.box(0.08, 2.0, 1.3, hull2, [2.42, 2.55, -3.0], null, { cast: false });
  S.box(0.06, 2.0, 1.2, mats.emissive(0xffe4c0, 1.6), [2.38, 2.55, -3.0], null, { cast: false });
  const steps = 5;
  for (let i = 0; i < steps; i++) S.box(0.35, 0.06, 1.1, metal, [2.6 + (steps - i) * 0.3, (i + 1) * (fy / steps), -3.0]);
  for (const s of [-1, 1]) S.box(1.7, 0.05, 0.05, mats.paint(0xc89a1e), [3.3, fy * 0.5 + 0.9, -3.0 + s * 0.55], [0, 0, -0.75]);
  S.gear(0, -6, 1.6, mats, { r: 0.1 });
  for (const s of [-1, 1]) S.gear(s * 1.6, 4, 1.4, mats, { r: 0.12 });
  S.cbox(5.0, 4.6, 19, [0, 2.3, 0]);
  S.cbox(9, 0.6, 3.5, [0, 2.2, 6]);
  S.footprint(2.9, 9.8, 0, 0);
  S.door = { outside: S.local(4.8, 0, -3.0), inside: S.local(2.0, 0, -3.0) };
  return S;
}

export function buildShips(ctx) {
  const ships = {
    heron: buildHeron(ctx),
    mulet: buildMulet(ctx),
    faucon: buildFaucon(ctx),
    navette: buildNavette(ctx),
  };
  let t = 0;
  ctx.updaters.push((dt) => {
    t += dt;
    for (const s of Object.values(ships)) {
      for (const n of s.navLights) {
        const on = n.blink ? ((t + n.blink) % 1.4) < 0.08 : true;
        n.m.material.color.copy(n.base).multiplyScalar(on ? 1 : 0.05);
      }
    }
  });
  return ships;
}
