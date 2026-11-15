import * as THREE from 'three';
import { Builder } from './builder.js';
import { metricBox } from './materials.js';
import { loft, wing, nozzle, flipFaces } from './shipkit.js';
import { platedHull } from './hullkit.js';
import { PADS } from './layout.js';
import { paintedText, decalMaterial } from './signage.js';

// Quatre vaisseaux originaux, modélisés en code :
//  - « Héron » (corvette du joueur, aire 02) avec intérieur accessible par la rampe arrière
//  - « Mulet H4 » (cargo lourd, aire 03), soute ouverte, chargement en cours
//  - « Faucon » (chasseur léger, aire 04), en maintenance
//  - « Navette ST-40 » (aire 05), débarquement de passagers

class ShipCtx {
  constructor(ctx, pad, name, dynamic = false) {
    this.ctx = ctx;
    // dynamic : géométrie dans un lot propre (déplaçable en vol) ; collisions toujours dans le lot global
    this.CB = ctx.builder;
    this.B = dynamic ? new Builder(null) : ctx.builder;
    this.dynamic = dynamic;
    this.mats = ctx.mats;
    this.heading = pad.heading;
    this.origin = new THREE.Vector3(pad.x, 0, pad.z);
    this.M = new THREE.Matrix4().compose(this.origin, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, pad.heading, 0)), new THREE.Vector3(1, 1, 1));
    this.name = name;
    // root : transformation de vol (identité au repos) ; group : repère local de l'aire ; worldGroup : maillages en coordonnées monde
    this.root = new THREE.Group();
    this.root.matrixAutoUpdate = false;
    ctx.scene.add(this.root);
    this.group = new THREE.Group();
    this.group.position.copy(this.origin);
    this.group.rotation.y = pad.heading;
    this.root.add(this.group);
    this.worldGroup = new THREE.Group();
    this.root.add(this.worldGroup);
    this.navLights = [];
  }
  add(geo, mat, pos = [0, 0, 0], rot = null, opts = {}) {
    return this.B.add(geo, mat, Builder.matrix(pos, rot), { ...opts, parent: this.M });
  }
  box(w, h, d, mat, pos, rot, opts = {}) { return this.add(metricBox(w, h, d, opts.tex ?? 2), mat, pos, rot, opts); }
  cyl(rt, rb, h, mat, pos, rot, opts = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, opts.seg ?? 16, 1, opts.open ?? false), mat, pos, rot, opts); }
  /** coque blindée : sous-structure + plaques (+ plaques alternées), ajoutée aussi aux collisions */
  plated(stations, opts, m) {
    const h = platedHull(stations, opts);
    this.add(h.under, m.under, [0, 0, 0], null, { cast: true });
    this.add(h.plates, m.plate, [0, 0, 0], null, { cast: true });
    this.add(h.alt, m.alt || m.plate, [0, 0, 0], null, { cast: true });
    if (opts.collide !== false) { const c = h.under.clone(); c.applyMatrix4(this.M); this.CB.addCollider(c); }
    return h;
  }
  /** boîte de collision en coordonnées locales */
  cbox(w, h, d, pos) {
    const p = new THREE.Vector3(...pos).applyMatrix4(this.M);
    this.CB.colliderBox(w, h, d, [p.x, p.y, p.z], [0, this.heading, 0]);
  }
  /** empreinte au sol pour l'évitement des PNJ */
  footprint(hw, hd, cx = 0, cz = 0) {
    const p = new THREE.Vector3(cx, 0, cz).applyMatrix4(this.M);
    this.CB.addObstacle(p.x, p.z, hw, hd, this.heading);
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
    this.B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
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

/** section interpolée linéairement entre stations (pour poser des éléments sur la coque) */
function interpStation(st, z) {
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    if (z >= a.z && z <= b.z) {
      const t = (z - a.z) / (b.z - a.z), o = {};
      for (const k of ['w', 'h', 'y', 'n']) o[k] = (a[k] ?? 2.5) + ((b[k] ?? 2.5) - (a[k] ?? 2.5)) * t;
      return o;
    }
  }
  return { n: 2.5, ...st[st.length - 1] };
}

const ds = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; return c; };
const hullMats = (mats, plate, alt) => ({
  plate: ds(mats.paint(plate, { grime: 0.85, scratch: 0.9, rust: 0.05 })),
  alt: ds(mats.paint(alt, { grime: 0.9, scratch: 0.9, rust: 0.08 })),
  under: ds(mats.metal(0x24282b, { rough: 0.6, grime: 0.9 })),
});

function greebles(S, mat, x0, x1, y, z0, z1, n, seedv) {
  let s = seedv;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < n; i++) {
    const w = 0.15 + r() * 0.6, d = 0.2 + r() * 0.9, h = 0.05 + r() * 0.18;
    S.box(w, h, d, mat, [x0 + r() * (x1 - x0), y + h / 2, z0 + r() * (z1 - z0)], null, { cast: false, tex: 1 });
  }
}

// =============================================================================== Héron Mk II (joueur)
// Explorateur bi-pont de 34 m : soute inférieure à grille de fret (rampe arrière, caisses, rover),
// escalier intérieur, pont supérieur habité (passerelle vitrée, cabines, cuisine, salon, baie technique).

function rover(S, mats, x, y, z, ry) {
  const body = mats.paint(0xd6d2c8, { grime: 0.6, scratch: 0.7, plain: true, rough: 0.5 });
  const dark = mats.paint(0x24282b, { plain: true, rough: 0.6 });
  const tire = mats.rubber();
  const M = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
  const put = (g, m, p, r, opts = {}) => S.B.add(g, m, Builder.matrix(p, r), { ...opts, parent: new THREE.Matrix4().multiplyMatrices(S.M, M) });
  put(metricBox(1.9, 0.45, 3.4, 1.5), body, [0, 0.75, 0]);
  put(metricBox(1.7, 0.35, 1.2, 1.5), body, [0, 1.1, -1.05], [0.25, 0, 0]);
  put(metricBox(1.95, 0.12, 3.5, 1), dark, [0, 0.5, 0]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1.15, 0, 1.15]) {
      put(new THREE.CylinderGeometry(0.36, 0.36, 0.32, 16), tire, [sx * 1.05, 0.36, sz], [0, 0, Math.PI / 2]);
      put(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 10), mats.smooth(0x8a8e90, 0.35, 0.9), [sx * 1.05, 0.36, sz], [0, 0, Math.PI / 2], { cast: false });
    }
    // arceau de sécurité
    put(metricBox(0.07, 1.0, 0.07, 1), dark, [sx * 0.85, 1.45, 0.35]);
    put(metricBox(0.07, 1.0, 0.07, 1), dark, [sx * 0.85, 1.45, 1.3]);
    put(metricBox(0.07, 0.07, 1.0, 1), dark, [sx * 0.85, 1.95, 0.82]);
    put(new THREE.BoxGeometry(0.22, 0.1, 0.05), mats.emissive(0xfff2dd, 4), [sx * 0.65, 0.95, -1.72], null, { cast: false });
  }
  put(metricBox(1.77, 0.07, 0.07, 1), dark, [0, 1.95, 0.35]);
  put(metricBox(1.77, 0.07, 0.07, 1), dark, [0, 1.95, 1.3]);
  for (const sx of [-0.4, 0.4]) {
    put(metricBox(0.5, 0.12, 0.5, 1), mats.plastic(0x2a2a2a, 0.7), [sx, 1.05, 0.85]);
    put(metricBox(0.5, 0.55, 0.1, 1), mats.plastic(0x2a2a2a, 0.7), [sx, 1.35, 1.12], [-0.15, 0, 0]);
  }
  put(metricBox(1.4, 0.4, 0.8, 1), mats.paint(0x5c6b4a, { plain: true, rough: 0.7 }), [0, 1.15, 1.85]);
  S.footprint(1.1, 1.9, x, z);
  S.cbox(2.1, 1.6, 3.6, [x, y + 0.8, z]);
}

function buildHeron(ctx) {
  const pad = PADS.p2;
  const c0 = ctx.builder.colliders.length;
  const S = new ShipCtx(ctx, pad, 'heron', true);
  const { mats } = ctx;
  // -------------------------------------------------- matériaux
  const hull = mats.paint(0xd2cfc7, { grime: 0.75, scratch: 0.6, rust: 0.0, plain: true, rough: 0.45 });
  const hullDS = hull.clone(); hullDS.side = THREE.DoubleSide; hullDS.onBeforeCompile = hull.onBeforeCompile; hullDS.customProgramCacheKey = hull.customProgramCacheKey;
  const belly = mats.paint(0x34393d, { grime: 0.7 });
  const trim = mats.paint(0x1e2226, { grime: 0.5, plain: true, rough: 0.45 });
  const accent = mats.paint(0xc8561e, { grime: 0.4, plain: true, rough: 0.4 });
  const metal = mats.metal(0x55595c);
  const chrome = mats.smooth(0xc8ccce, 0.25, 1.0, { grime: 0.3, floor: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x18242c, roughness: 0.03, metalness: 0.9, transparent: true, opacity: 0.35, side: THREE.DoubleSide, envMapIntensity: 1.7, depthWrite: false });
  // intérieur
  const deckM = mats.diamond(0x8c9093);
  const floorUp = mats.paint(0x3a3f44, { plain: true, rough: 0.55, grime: 0.3, floor: 0 });
  const wallIn = mats.paint(0xc9c7c0, { plain: true, rough: 0.6, grime: 0.35 });
  const wallDark = mats.paint(0x2a2f33, { plain: true, rough: 0.55 });
  const holdWall = mats.metal(0x6a6e70, { rough: 0.6 });
  const yellow = mats.paint(0xd0a01c, { plain: true, rough: 0.5, grime: 0.6 });
  const fabric = mats.plastic(0x3b4650, 0.85);
  const leather = mats.plastic(0x5a2f1f, 0.6);
  const light = mats.emissive(0xfff1de, 2.2);
  const blue = mats.emissive(0x3ec7ff, 2.0);
  // -------------------------------------------------- coque blindée à facettes
  const HM = hullMats(mats, 0xd4d1c9, 0x3e4448);
  const ST = [
    { z: -19.0, w: 0.5, h: 0.4, y: 5.6, n: 2.6 },
    { z: -17.2, w: 2.4, h: 1.8, y: 5.7, n: 3.2, fb: 0.1 },
    { z: -14.6, w: 3.8, h: 2.9, y: 5.35, n: 3.6, fb: 0.15 },
    { z: -11.0, w: 4.45, h: 3.45, y: 5.0, n: 4, fb: 0.15 },
    { z: -6.0, w: 4.6, h: 3.55, y: 4.95, n: 4.2, fb: 0.15 },
    { z: 9.0, w: 4.6, h: 3.55, y: 4.95, n: 4.2, fb: 0.15 },
    { z: 13.0, w: 4.4, h: 3.35, y: 5.0, n: 4, fb: 0.12 },
    { z: 15.0, w: 4.1, h: 3.1, y: 5.1, n: 3.8, fb: 0.1 },
  ];
  const gap = 1.2;
  const nose = ST.slice(0, 4);
  S.plated(nose, { facets: 12, steps: 4, arc: [Math.PI / 2 + gap, Math.PI / 2 - gap + Math.PI * 2], plateEvery: [3, 1], altBelow: 3.4, altRandom: 0.03, seed: 11 }, HM);
  S.plated(ST.slice(3), { facets: 16, steps: 5, plateEvery: [3, 1], altBelow: 3.3, altRandom: 0.03, missing: 0.03, seed: 12, collide: false }, HM);
  // verrière à vitrages plans + montants épais sur chaque arête
  const cg = platedHull(nose.slice(1), { facets: 4, steps: 3, arc: [Math.PI / 2 - gap, Math.PI / 2 + gap] });
  const can = new THREE.Mesh(cg.under, glass);
  can.renderOrder = 3;
  S.group.add(can);
  const P = cg.points;
  for (let i = 0; i < P[0].length; i++) S.B.tube(P.map((r) => S.local(r[i].x, r[i].y + 0.02, r[i].z).toArray()), 0.085, trim, { radial: 6, cast: false, smooth: false });
  for (let j = 0; j < P.length; j += 3) S.B.tube(P[j].map((p) => S.local(p.x, p.y + 0.02, p.z).toArray()), 0.07, trim, { radial: 6, cast: false, smooth: false });
  for (const sx of [-1, 1]) {
    // arête de chine (ressaut horizontal) + liseré
    S.box(0.4, 0.26, 26, trim, [sx * 4.72, 4.95, 1.5], null, { tex: 2 });
    S.box(0.04, 0.1, 25, accent, [sx * 4.93, 4.95, 1.5], null, { cast: false, tex: 1 });
    // hublots encadrés du pont supérieur
    for (let z = -6.5; z <= 9; z += 1.55) {
      S.box(0.08, 0.5, 0.92, trim, [sx * 4.7, 6.45, z], null, { cast: false });
      S.box(0.06, 0.36, 0.76, mats.emissive(0xffd9a8, 1.4), [sx * 4.75, 6.45, z], null, { cast: false });
    }
    // trappes de service, grilles, feux
    for (const z of [-3, 3.5, 10]) { S.box(0.1, 0.95, 1.65, HM.alt, [sx * 4.66, 3.0, z], null, { cast: false }); S.box(0.1, 0.18, 0.3, yellow, [sx * 4.72, 3.35, z - 0.6], null, { cast: false }); }
    S.box(0.08, 0.5, 2.6, mats.vent(), [sx * 4.62, 7.4, 6], null, { cast: false });
    S.box(0.06, 0.14, 0.14, mats.emissive(0xffffff, 6), [sx * 4.75, 4.2, -14], null, { cast: false });
    // propulseurs de manœuvre (RCS) : blocs de 3 tuyères
    for (const [z, y] of [[-12, 6.6], [11.5, 3.0]]) {
      S.box(0.3, 0.5, 0.6, HM.alt, [sx * 4.55, y, z]);
      for (const dz of [-0.15, 0.15]) S.cyl(0.07, 0.1, 0.18, metal, [sx * 4.75, y + 0.1, z + dz], [0, 0, Math.PI / 2], { seg: 8, cast: false });
    }
  }
  // dos : épine dorsale blindée, dôme de capteurs, antennes, ailerons
  S.plated([{ z: -3, w: 0.2, h: 0.2, y: 8.5, n: 3 }, { z: -1.5, w: 0.75, h: 0.35, y: 8.6, n: 4 }, { z: 11, w: 0.75, h: 0.4, y: 8.6, n: 4 }, { z: 12.5, w: 0.3, h: 0.2, y: 8.5, n: 3 }], { facets: 8, steps: 2, plateEvery: [1, 1], seed: 13, collide: false }, HM);
  S.cyl(0.6, 0.75, 0.45, trim, [0, 9.05, -4], null, { seg: 12 });
  S.add(new THREE.SphereGeometry(0.55, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.smooth(0x9aa4aa, 0.2, 0.6), [0, 9.25, -4]);
  S.cyl(0.03, 0.03, 1.6, metal, [0.5, 9.6, 6]);
  S.cyl(0.03, 0.03, 1.1, metal, [-0.4, 9.4, 8]);
  greebles(S, metal, -0.6, 0.6, 9.0, -1, 11, 18, 9090);
  for (const sx of [-1, 1]) {
    S.plated([{ z: 6.0, w: 0.12, h: 0.4, y: 9.4, x: sx * 1.6, n: 6 }, { z: 7.0, w: 0.14, h: 1.2, y: 9.9, x: sx * 1.9, n: 6 }, { z: 11.6, w: 0.14, h: 1.3, y: 10.0, x: sx * 2.1, n: 6 }, { z: 12.4, w: 0.1, h: 0.9, y: 10.1, x: sx * 2.2, n: 6 }], { facets: 6, steps: 2, plateEvery: [1, 1], seed: 14 + sx, collide: false }, HM);
    S.navLight([sx * 2.2, 11.1, 12.0], 0xffffff, 1.0 + sx * 0.4);
  }
  // ailes en caisson blindé, enracinées dans la coque
  for (const sx of [-1, 1]) {
    S.plated([
      { z: -3.2, w: 0.4, h: 0.12, y: 3.75, x: sx * 5.0, n: 8 },
      { z: -1.2, w: 2.6, h: 0.26, y: 3.75, x: sx * 6.6, n: 8 },
      { z: 4.6, w: 3.3, h: 0.3, y: 3.75, x: sx * 7.2, n: 8 },
      { z: 6.4, w: 2.6, h: 0.18, y: 3.75, x: sx * 7.4, n: 8 },
    ], { facets: 8, steps: 3, plateEvery: [1, 1], seed: 20 + sx, altRandom: 0.15 }, HM);
    // volets de bord de fuite (séparés par un jour), point d'emport, feux
    S.box(4.6, 0.12, 0.7, HM.alt, [sx * 7.6, 3.7, 6.9], [0.12, 0, 0]);
    S.box(0.2, 0.35, 1.8, metal, [sx * 8.4, 3.38, 1.0]);
    S.cyl(0.11, 0.11, 2.4, mats.metal(0x2a2c2e), [sx * 8.4, 3.1, 0.6], [Math.PI / 2, 0, 0], { seg: 8 });
    S.box(0.5, 0.35, 3.0, accent, [sx * 10.25, 3.75, 3.9], null, { tex: 1 });
    // pod VTOL en bout d'aile
    S.plated([{ z: 0.6, w: 0.35, h: 0.35, x: sx * 10.3, y: 3.75, n: 3 }, { z: 1.6, w: 0.85, h: 0.85, x: sx * 10.3, y: 3.75, n: 3 }, { z: 6.2, w: 0.85, h: 0.85, x: sx * 10.3, y: 3.75, n: 3 }, { z: 7.0, w: 0.5, h: 0.5, x: sx * 10.3, y: 3.75, n: 3 }], { facets: 10, steps: 2, plateEvery: [1, 1], seed: 30 + sx }, HM);
    S.cyl(0.62, 0.62, 0.2, mats.metal(0x1c1e20), [sx * 10.3, 2.95, 3.8], null, { seg: 14 });
    S.add(new THREE.CircleGeometry(0.5, 14), mats.emissive(0x7fb8ff, 0.8), [sx * 10.3, 2.84, 3.8], [Math.PI / 2, 0, 0], { cast: false });
    S.navLight([sx * 11.2, 3.75, 3.8], sx < 0 ? 0xff2010 : 0x20ff40, 0);
  }
  // moteurs principaux intégrés à la coque (nacelles blindées, tuyères, suie)
  for (const sx of [-1, 1]) {
    const x = sx * 3.0, y = 6.6;
    S.plated([
      { z: 4.0, w: 0.5, h: 0.5, x, y, n: 2.6 }, { z: 6.0, w: 1.4, h: 1.4, x, y, n: 2.6 },
      { z: 14.4, w: 1.5, h: 1.5, x, y, n: 2.6 }, { z: 16.2, w: 1.35, h: 1.35, x, y, n: 2.6 },
    ], { facets: 12, steps: 3, plateEvery: [1, 1], seed: 40 + sx }, HM);
    S.add(nozzle(1.15, 1.6), mats.metal(0x3a3d40, { rough: 0.45 }), [x, y, 16.0]);
    for (let k = 0; k < 3; k++) S.cyl(1.2 - k * 0.2, 1.2 - k * 0.2, 0.06, mats.metal(0x1a1b1c), [x, y, 16.6 + k * 0.02], [Math.PI / 2, 0, 0], { seg: 16, cast: false });
    S.add(new THREE.CircleGeometry(0.75, 20), mats.emissive(0xff7a3a, 0.9), [x, y, 16.62], null, { cast: false });
    S.cbox(3.0, 3.0, 12, [x, y, 10.5]);
  }
  // marquages
  S.decal(['HÉRON MK II'], 3.6, [-4.97, 5.6, -2.0], -Math.PI / 2, { color: '#2a2e31', size: 120, wear: 0.6 });
  S.decal(['HL-2207'], 2.4, [4.97, 5.6, -2.0], Math.PI / 2, { color: '#2a2e31', size: 120, wear: 0.6 });

  // -------------------------------------------------- pont inférieur : soute
  const fy = 2.0, cy = 4.85, hw = 3.55;   // plancher, plafond, demi-largeur
  const hz0 = -6, hz1 = 14.4;             // étendue de la soute
  S.box(hw * 2, 0.14, hz1 - hz0, deckM, [0, fy - 0.07, (hz0 + hz1) / 2], null, { tex: 2 });
  for (const sx of [-1, 1]) {
    S.box(0.12, cy - fy, hz1 - hz0, holdWall, [sx * hw, (fy + cy) / 2, (hz0 + hz1) / 2], null, { tex: 3 });
    // rails d'arrimage, nervures, lampes
    S.box(0.08, 0.06, hz1 - hz0 - 0.4, yellow, [sx * (hw - 0.08), fy + 1.0, (hz0 + hz1) / 2], null, { cast: false });
    for (let z = hz0 + 1; z < hz1; z += 2.2) {
      S.box(0.25, cy - fy, 0.22, wallDark, [sx * (hw - 0.12), (fy + cy) / 2, z], null, { cast: false });
      S.box(0.06, 0.35, 0.6, light, [sx * (hw - 0.07), cy - 0.6, z + 1.1], null, { cast: false });
    }
  }
  // plafond de soute avec trémie au-dessus de l'escalier (x -3,55..-2,3 ; z -4,4..0,4)
  const holeX = -2.3, hzA = -4.4, hzB = 0.4;
  S.box(hw - holeX, 0.15, hz1 - hz0, wallDark, [(hw + holeX) / 2, cy + 0.07, (hz0 + hz1) / 2], null, { cast: false });
  S.box(holeX + hw, 0.15, hzA - hz0, wallDark, [(holeX - hw) / 2, cy + 0.07, (hz0 + hzA) / 2], null, { cast: false });
  S.box(holeX + hw, 0.15, hz1 - hzB, wallDark, [(holeX - hw) / 2, cy + 0.07, (hzB + hz1) / 2], null, { cast: false });
  for (let z = hz0 + 2; z < hz1; z += 3) S.box(1.6, 0.04, 0.3, light, [0, cy - 0.02, z], null, { cast: false });
  // cloison avant de soute (porte de la baie machines)
  S.box(hw * 2, cy - fy, 0.18, wallDark, [0, (fy + cy) / 2, hz0]);
  S.box(1.2, 2.1, 0.05, mats.paint(0x6a6e70, { plain: true }), [1.4, fy + 1.05, hz0 + 0.1], null, { cast: false });
  S.box(0.25, 0.08, 0.04, mats.emissive(0xff5040, 3), [1.4, fy + 2.25, hz0 + 0.12], null, { cast: false });
  // grille de fret (marquages) et caisses arrimées
  for (let i = 0; i <= 4; i++) S.box(0.05, 0.01, 9.6, yellow, [-1.2 + i * 1.2 - 0.0, fy + 0.005, 8.2], null, { cast: false, receive: true });
  for (let k = 0; k <= 8; k++) S.box(4.85, 0.01, 0.05, yellow, [1.2, fy + 0.005, 3.4 + k * 1.2], null, { cast: false, receive: true });
  const crateCols = [0x5c6b4a, 0x3d4a5a, 0x8a5a2a, 0x6a6e70];
  const crates = [[2.4, 4.0, 1.1, 0], [2.4, 5.2, 1.1, 1], [1.2, 4.0, 1.1, 2], [2.4, 4.0, 1.1, 3, 1], [2.4, 7.6, 1.1, 1], [1.2, 7.6, 1.1, 0], [2.4, 10.0, 1.1, 2], [2.4, 11.2, 1.1, 3], [2.4, 10.0, 1.1, 0, 1]];
  for (const [x, z, sz, c, lvl] of crates) {
    const y = fy + (lvl ? sz : 0);
    S.box(sz, sz, sz, mats.paint(crateCols[c], { plain: true, rough: 0.7, grime: 0.8 }), [x, y + sz / 2, z]);
    S.box(sz + 0.02, 0.06, sz + 0.02, trim, [x, y + sz - 0.03, z], null, { cast: false });
    S.box(0.08, sz + 0.02, sz + 0.02, mats.plastic(0xc8901a, 0.7), [x, y + sz / 2, z], null, { cast: false });
    if (!lvl) S.cbox(sz, sz * 2, sz, [x, y + sz, z]);
  }
  // sangles d'arrimage du bloc arrière
  S.B.cable(S.local(3.4, fy + 1.0, 9.4).toArray(), S.local(0.6, fy + 0.02, 9.4).toArray(), -0.4, 0.02, mats.plastic(0xc8901a, 0.6));
  // rover garé côté bâbord
  rover(S, mats, -1.6, fy, 6.5, Math.PI);
  // escalier vers le pont supérieur (bâbord avant, monte vers l'avant)
  const sx0 = -2.9, sw = 1.2, sBot = 0.4, sTop = -4.4; // z
  const upY = 5.2;
  const nSteps = 14, rise = (upY - fy) / nSteps, run = (sBot - sTop) / nSteps;
  for (let i = 0; i < nSteps; i++) {
    S.box(sw, 0.06, run + 0.04, deckM, [sx0, fy + (i + 1) * rise - 0.03, sBot - (i + 0.5) * run], null, { cast: false, tex: 1 });
    S.box(sw, rise, 0.03, wallDark, [sx0, fy + (i + 0.5) * rise, sBot - i * run], null, { cast: false });
  }
  const sAng = Math.atan2(upY - fy, sBot - sTop), sLen = Math.hypot(upY - fy, sBot - sTop);
  S.box(0.05, 0.05, sLen, yellow, [sx0 + sw / 2 + 0.05, (fy + upY) / 2 + 0.95, (sBot + sTop) / 2], [sAng, 0, 0], { cast: false });
  for (const k of [0.15, 0.5, 0.85]) S.box(0.04, 0.95, 0.04, metal, [sx0 + sw / 2 + 0.05, fy + (upY - fy) * k + 0.47, sBot - (sBot - sTop) * k], null, { cast: false });

  // -------------------------------------------------- pont supérieur
  const ty = 7.85;                       // plafond
  const uz0 = -9.0, uz1 = 12.6;          // du pied de la passerelle au fond
  // plancher avec trémie de l'escalier
  const slab = (x0, x1, z0, z1, m = floorUp) => S.box(x1 - x0, 0.2, z1 - z0, m, [(x0 + x1) / 2, upY - 0.1, (z0 + z1) / 2], null, { tex: 2 });
  slab(-hw, hw, uz0, sTop);
  slab(sx0 + sw / 2, hw, sTop, sBot);
  slab(-hw, hw, sBot, uz1);
  // plafond, lampes, parois latérales intérieures
  S.box(hw * 2, 0.15, uz1 - uz0, wallIn, [0, ty, (uz0 + uz1) / 2], null, { cast: false });
  for (let z = uz0 + 1; z < uz1; z += 2.4) S.box(0.3, 0.03, 1.4, light, [0, ty - 0.08, z], null, { cast: false });
  for (const sx of [-1, 1]) S.box(0.12, ty - upY, uz1 - uz0, wallIn, [sx * hw, (upY + ty) / 2, (uz0 + uz1) / 2], null, { tex: 2 });
  // habillage des coursives : plinthe sombre, main courante lumineuse, corniche
  for (const sx of [-1, 1]) {
    const x = sx * 0.94;
    S.box(0.04, 0.9, uz1 - uz0 - 0.4, wallDark, [x, upY + 0.45, (uz0 + uz1) / 2], null, { cast: false });
    S.box(0.05, 0.035, uz1 - uz0 - 0.4, mats.emissive(0x9fdcff, 1.6), [x, upY + 0.92, (uz0 + uz1) / 2], null, { cast: false });
    S.box(0.06, 0.12, uz1 - uz0 - 0.4, wallDark, [x, ty - 0.25, (uz0 + uz1) / 2], null, { cast: false });
  }
  S.box(hw * 2, ty - upY, 0.15, wallIn, [0, (upY + ty) / 2, uz1]);
  // garde-corps autour de la trémie
  S.box(0.05, 0.05, sBot - sTop, yellow, [sx0 + sw / 2 + 0.05, upY + 1.0, (sTop + sBot) / 2], null, { cast: false });
  S.box(sw, 0.05, 0.05, yellow, [sx0, upY + 1.0, sBot + 0.02], null, { cast: false });
  for (const z of [sTop + 0.1, (sTop + sBot) / 2, sBot]) S.box(0.04, 1.0, 0.04, metal, [sx0 + sw / 2 + 0.05, upY + 0.5, z], null, { cast: false });
  // cloisons : couloir central x ∈ [-1, 1], pièces de part et d'autre
  const wall = (x, z0, z1, doorZ) => {
    if (doorZ === undefined) { S.box(0.1, ty - upY, z1 - z0, wallIn, [x, (upY + ty) / 2, (z0 + z1) / 2], null, { tex: 2 }); S.cbox(0.12, ty - upY, z1 - z0, [x, (upY + ty) / 2, (z0 + z1) / 2]); return; }
    wall(x, z0, doorZ - 0.5); wall(x, doorZ + 0.5, z1);
    S.box(0.1, ty - upY - 2.1, 1.0, wallIn, [x, (upY + 2.1 + ty) / 2, doorZ]);
    S.box(0.12, 2.1, 0.06, wallDark, [x, upY + 1.05, doorZ - 0.5], null, { cast: false });
    S.box(0.12, 2.1, 0.06, wallDark, [x, upY + 1.05, doorZ + 0.5], null, { cast: false });
  };
  const xwall = (z, x0, x1) => { S.box(x1 - x0, ty - upY, 0.1, wallIn, [(x0 + x1) / 2, (upY + ty) / 2, z], null, { tex: 2 }); S.cbox(x1 - x0, ty - upY, 0.12, [(x0 + x1) / 2, (upY + ty) / 2, z]); };
  // tribord (x > 0) : cabine 1 (z -9..-4), salon (z -4..4), baie technique (z 6.5..12.6)
  wall(1.0, uz0, -4, -6.5); xwall(-4, 1.0, hw);
  wall(1.0, 4, 6.5); wall(1.0, 6.5, uz1, 9.5); xwall(6.5, 1.0, hw);
  // bâbord (x < 0) : cabine 2 (z -9..-4.6), cuisine (z 0.8..6.5), infirmerie / baie (6.5..12.6)
  wall(-1.0, uz0, sTop - 1.4, -7.4); xwall(sTop - 1.4, -hw, -1.0);   // palier d'arrivée de l'escalier
  wall(-1.0, sBot + 0.4, 6.5, 3.6); xwall(6.5, -hw, -1.0); wall(-1.0, 6.5, uz1, 9.5);
  // cabine 1 (tribord avant) : couchette, casier, écran
  S.box(1.9, 0.45, 0.9, wallDark, [2.55, upY + 0.22, -8.0]);
  S.box(1.9, 0.18, 0.85, fabric, [2.55, upY + 0.54, -8.0]);
  S.box(0.5, 0.15, 0.35, mats.plastic(0xe8e4dc, 0.8), [3.2, upY + 0.7, -8.0]);
  S.box(0.6, 1.9, 0.5, wallDark, [3.2, upY + 0.95, -4.4]);
  S.box(0.7, 0.4, 0.03, blue, [2.3, upY + 1.6, -8.9], null, { cast: false });
  // cabine 2 (bâbord avant) : lits superposés
  for (const yy of [0.35, 1.45]) { S.box(1.9, 0.12, 0.85, wallDark, [-2.55, upY + yy, -7.9]); S.box(1.85, 0.15, 0.8, fabric, [-2.55, upY + yy + 0.13, -7.9]); }
  S.box(0.05, 1.7, 0.05, metal, [-1.6, upY + 0.85, -7.5], null, { cast: false });
  // salon (tribord) : banquette en L, table basse, écran mural
  S.box(0.75, 0.42, 5.0, leather, [3.05, upY + 0.21, 0.2]);
  S.box(0.2, 0.55, 5.0, leather, [3.4, upY + 0.65, 0.2]);
  S.box(1.8, 0.42, 0.75, leather, [2.2, upY + 0.21, 2.45]);
  S.cyl(0.55, 0.55, 0.05, mats.smooth(0x2a2e31, 0.25, 0.4), [2.0, upY + 0.42, 0.0], null, { seg: 24 });
  S.cyl(0.08, 0.1, 0.4, metal, [2.0, upY + 0.2, 0.0], null, { seg: 8 });
  S.box(1.8, 1.0, 0.04, mats.emissive(0x86c8ff, 1.2), [2.3, upY + 1.5, -3.9], null, { cast: false });
  S.cbox(0.9, 0.6, 5.0, [3.1, upY + 0.3, 0.2]);
  // cuisine (bâbord) : plan de travail, éléments hauts, table et bancs
  S.box(0.65, 0.95, 4.8, wallIn, [-3.2, upY + 0.47, 3.7]);
  S.box(0.68, 0.05, 4.8, mats.smooth(0x5a5f63, 0.25, 0.6), [-3.2, upY + 0.97, 3.7], null, { cast: false });
  S.box(0.4, 0.6, 4.8, wallIn, [-3.35, upY + 2.0, 3.7]);
  S.box(0.3, 0.2, 0.3, mats.smooth(0xb8bcbe, 0.2, 1), [-3.2, upY + 1.1, 2.4], null, { cast: false });
  S.box(0.05, 0.03, 4.6, light, [-3.1, upY + 1.68, 3.7], null, { cast: false });
  S.box(1.0, 0.05, 1.8, mats.smooth(0x3a2a1e, 0.4, 0), [-1.95, upY + 0.75, 3.6]);
  S.cyl(0.06, 0.08, 0.72, metal, [-1.95, upY + 0.36, 3.6], null, { seg: 8 });
  S.box(0.35, 0.42, 1.8, fabric, [-1.3, upY + 0.21, 3.6]);
  S.cbox(0.7, 1.0, 4.8, [-3.2, upY + 0.5, 3.7]);
  S.cbox(1.0, 0.8, 1.8, [-1.95, upY + 0.4, 3.6]);
  // baie technique (arrière) : armoires, écrans, réservoirs
  for (const sx of [-1, 1]) {
    for (let z = 7.2; z < 12.3; z += 1.1) {
      S.box(0.6, 1.9, 1.0, wallDark, [sx * 3.15, upY + 0.95, z]);
      S.box(0.03, 0.12, 0.6, sx < 0 ? mats.emissive(0x50ff80, 2) : mats.emissive(0xffa030, 2), [sx * 2.84, upY + 1.4, z], null, { cast: false });
    }
    S.cbox(0.6, 2, 5.4, [sx * 3.15, upY + 1, 9.7]);
  }
  S.cyl(0.35, 0.35, 1.6, mats.smooth(0x7a7e80, 0.35, 0.9), [0, upY + 0.8, 11.6], null, { seg: 18 });
  // passerelle de commandement (sous la verrière) : plancher surélevé, sièges, consoles
  const bf = upY + 0.25;
  S.box(hw * 2 - 0.6, 0.2, 7.5, floorUp, [0, bf - 0.1, -12.6], null, { tex: 2 });
  S.box(hw * 2 - 0.6, 0.25, 0.15, wallDark, [0, upY + 0.12, -8.9], null, { cast: false });
  for (const x of [-1.1, 1.1]) {
    const seat = mats.plastic(0x222426, 0.7);
    S.box(0.62, 0.15, 0.62, seat, [x, bf + 0.48, -12.6]);
    S.box(0.62, 1.0, 0.16, seat, [x, bf + 1.0, -12.25], [-0.15, 0, 0]);
    S.box(0.22, 0.25, 0.2, seat, [x, bf + 1.6, -12.15], null, { cast: false });
    S.cyl(0.08, 0.1, 0.42, metal, [x, bf + 0.21, -12.6]);
    S.box(1.0, 0.7, 0.7, wallDark, [x, bf + 0.55, -14.3], [0.45, 0, 0]);
    S.box(0.5, 0.3, 0.02, blue, [x - 0.22, bf + 0.9, -14.08], [-0.65, 0, 0], { cast: false });
    S.box(0.4, 0.28, 0.02, mats.emissive(0xffa040, 1.8), [x + 0.25, bf + 0.9, -14.08], [-0.65, 0, 0], { cast: false });
    S.cyl(0.03, 0.03, 0.35, metal, [x + 0.35, bf + 0.68, -13.2], [0.2, 0, 0], { seg: 6 });
  }
  S.box(2.4, 0.9, 0.6, wallDark, [0, bf + 0.45, -10.4]);
  S.box(1.6, 0.03, 0.4, mats.emissive(0x66d0ff, 0.25), [0, bf + 0.92, -10.4], null, { cast: false });
  // rampe arrière (soute)
  const rampLen = Math.hypot(fy, 4.6), rAng = Math.atan2(fy, 4.6);
  S.box(hw * 2 - 0.3, 0.16, rampLen, mats.metal(0x5a5e60, { rough: 0.5 }), [0, fy / 2 + 0.02, hz1 + 2.3], [rAng, 0, 0], { tex: 1 });
  for (const sx of [-1, 1]) {
    S.box(0.08, 0.28, rampLen, yellow, [sx * (hw - 0.25), fy / 2 + 0.2, hz1 + 2.3], [rAng, 0, 0], { cast: false });
    S.cyl(0.07, 0.07, 2.4, chrome, [sx * (hw - 0.5), fy * 0.75 + 0.3, hz1 + 1.0], [Math.PI / 2 - 0.85, 0, 0]);
  }
  // cadre de porte arrière (soute) et fermeture du pont supérieur
  S.box(0.3, cy - fy + 0.4, 0.4, trim, [-hw - 0.05, (fy + cy) / 2, hz1 + 0.2]);
  S.box(0.3, cy - fy + 0.4, 0.4, trim, [hw + 0.05, (fy + cy) / 2, hz1 + 0.2]);
  S.box(hw * 2 + 0.4, 0.4, 0.4, trim, [0, cy + 0.15, hz1 + 0.2]);
  S.add(new THREE.CircleGeometry(4.1, 40, 0, Math.PI), hull, [0, 5.1, 15.0], null, {});
  // train d'atterrissage
  for (const [x, z] of [[-2.4, -11], [2.4, -11], [-3.2, 9.5], [3.2, 9.5]]) S.gear(x, z, 1.55, mats, { r: 0.17, pad: 1.4 });

  // -------------------------------------------------- collisions
  const plane = (w, d, pos, rot) => { const g = new THREE.PlaneGeometry(w, d).toNonIndexed(); g.rotateX(-Math.PI / 2); g.applyMatrix4(Builder.matrix(pos, rot)); g.applyMatrix4(S.M); ctx.builder.addCollider(g); };
  plane(hw * 2, hz1 - hz0, [0, fy, (hz0 + hz1) / 2]);
  plane(hw * 2 - 0.4, rampLen + 0.1, [0, fy / 2 + 0.1, hz1 + 2.3], [rAng, 0, 0]);
  plane(sw, sLen + 0.1, [sx0, (fy + upY) / 2 + 0.03, (sBot + sTop) / 2], [sAng, 0, 0]);
  plane(hw * 2, sTop - uz0, [0, upY, (uz0 + sTop) / 2]);
  plane(hw - (sx0 + sw / 2), sBot - sTop, [(hw + sx0 + sw / 2) / 2, upY, (sTop + sBot) / 2]);
  plane(hw * 2, uz1 - sBot, [0, upY, (sBot + uz1) / 2]);
  plane(hw * 2 - 0.6, 7.5, [0, bf, -12.6]);
  S.cbox(hw * 2, 0.3, 4, [0, upY + 0.1, -8.95 - 0.0]); // marche vers la passerelle (rebord bas)
  S.cbox(9.4, fy, 31, [0, fy / 2, -1.5]);                            // ventre
  for (const sx of [-1, 1]) {
    S.cbox(0.4, cy - fy, hz1 - hz0, [sx * (hw + 0.2), (fy + cy) / 2, (hz0 + hz1) / 2]);
    S.cbox(0.4, ty - upY, 22, [sx * (hw + 0.2), (upY + ty) / 2, 1.5]);
    S.cbox(6.5, 1.0, 9, [sx * 7.6, 3.75, 2.0]);                     // ailes
    S.cbox(0.3, 1.1, sBot - sTop, [sx0 + sw / 2 + 0.12, upY + 0.55, (sTop + sBot) / 2]);
  }
  S.cbox(hw * 2, 0.3, 30, [0, ty + 0.15, 0]);
  S.cbox(hw * 2, cy - fy, 0.3, [0, (fy + cy) / 2, hz0]);
  S.cbox(hw - holeX, 0.3, hz1 - hz0, [(hw + holeX) / 2, cy + 0.15, (hz0 + hz1) / 2]);
  S.cbox(holeX + hw, 0.3, hzA - hz0, [(holeX - hw) / 2, cy + 0.15, (hz0 + hzA) / 2]);
  S.cbox(holeX + hw, 0.3, hz1 - hzB, [(holeX - hw) / 2, cy + 0.15, (hzB + hz1) / 2]);
  S.cbox(hw * 2 + 1, ty - upY, 0.3, [0, (upY + ty) / 2, uz1 + 0.1]);
  S.cbox(8, 4, 0.4, [0, bf + 1.5, -15.6]);
  for (const sx of [-1, 1]) S.cbox(0.4, 3, 7, [sx * 3.4, bf + 1.4, -12.4]);
  // le joueur ne passe pas sous la soute ouverte entre la rampe et les moteurs
  S.footprint(4.8, 17.5, 0, -1.5);
  S.footprint(10.8, 4.6, 0, 2.0);

  // -------------------------------------------------- lumières intérieures
  const lights = ctx.quality.name === 'low' ? [[0, 4.4, 6, 10]] : [[0, 4.4, 2, 9], [0, 4.4, 10, 9], [0, 7.4, -3, 7], [0, 7.4, 6, 7]];
  for (const [x, y, z, i] of lights) { const l = new THREE.PointLight(0xffe4c4, i, 11, 2); l.position.copy(S.local(x, y, z)); S.worldGroup.add(l); }
  const bl = new THREE.PointLight(0x9fd6ff, 2.5, 5, 2); bl.position.copy(S.local(0, bf + 1.2, -13.5)); S.worldGroup.add(bl);

  const seatPos = S.local(-1.1, bf + 0.3, -12.6);
  S.interior = {
    floorY: fy, cockpitFloor: bf, rampTop: S.local(0, fy, hz1), rampBottom: S.local(0, 0, hz1 + 4.8),
    seat: { pos: seatPos, yaw: pad.heading + Math.PI, eye: S.local(-1.1, bf + 1.45, -12.75), exit: S.local(-1.1, bf + 0.05, -11.2) },
    seatTrigger: S.local(-1.1, bf, -11.8),
  };
  // géométrie du vaisseau : lot propre, attaché au groupe mobile
  S.B.finalize(S.worldGroup);
  S.colliderRange = [c0, ctx.builder.colliders.length];
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
  const HMm = hullMats(mats, 0xa3a88f, 0x4a504a);
  S.plated([
    { z: -15.5, w: 2.6, h: 2.0, y: 4.6, n: 3 },
    { z: -13, w: 4.6, h: 3.1, y: 4.9, n: 5, fb: 0.1 },
    { z: -8, w: 5.0, h: 3.4, y: 5.0, n: 7, fb: 0.15 },
    { z: 12, w: 5.0, h: 3.4, y: 5.0, n: 7, fb: 0.15 },
    { z: 15.5, w: 4.8, h: 3.2, y: 5.0, n: 7, fb: 0.15 },
  ], { facets: 16, steps: 4, plateEvery: [3, 1], altBelow: 2.6, altRandom: 0.05, missing: 0.04, seed: 50 }, HMm);
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
  // conteneurs/modules latéraux et moteurs
  for (const s of [-1, 1]) {
    S.box(1.4, 2.6, 18, hull2, [s * 5.6, 4.6, 1.5], null, { tex: 3 });
    for (const z of [-4, 10]) {
      S.plated([
        { z: z - 2.5, w: 0.4, h: 0.4, y: 5.2, x: s * 7.3, n: 2 },
        { z: z - 1.5, w: 1.3, h: 1.3, y: 5.2, x: s * 7.3, n: 2.2 },
        { z: z + 2.8, w: 1.35, h: 1.35, y: 5.2, x: s * 7.3, n: 2.2 },
      ], { facets: 12, steps: 2, plateEvery: [1, 1], seed: 60 + z, collide: false }, HMm);
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
  S.box(iw * 2 - 0.2, 0.18, rampLen, mats.metal(0x5a5e60, { rough: 0.5 }), [0, fy / 2 + 0.02, 15.5 + 2.6], [ang, 0, 0], { tex: 2 });
  for (const s of [-1, 1]) {
    S.box(0.1, 0.25, rampLen, yellow, [s * (iw - 0.15), fy / 2 + 0.2, 15.5 + 2.6], [ang, 0, 0], { cast: false });
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
    g.applyMatrix4(Builder.matrix([0, fy / 2 + 0.11, 15.5 + 2.6], [ang, 0, 0])); g.applyMatrix4(S.M); ctx.builder.addCollider(g);
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
  const HMf = hullMats(mats, 0x5a6168, 0x2c3034);
  S.plated([
    { z: -8.0, w: 0.12, h: 0.12, y: 2.2, n: 2 },
    { z: -6.0, w: 0.8, h: 0.6, y: 2.25, n: 2.4, fb: 0.2 },
    { z: -3.0, w: 1.5, h: 1.0, y: 2.35, n: 2.6, fb: 0.3 },
    { z: 1.0, w: 1.8, h: 1.05, y: 2.4, n: 3, fb: 0.35 },
    { z: 5.5, w: 1.9, h: 0.95, y: 2.45, n: 3.2, fb: 0.35 },
    { z: 7.0, w: 1.7, h: 0.85, y: 2.45, n: 3.2 },
  ], { facets: 12, steps: 3, plateEvery: [2, 1], altBelow: 1.9, altRandom: 0.08, seed: 70 }, HMf);
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
    S.plated([
      { z: 1, w: 0.5, h: 0.5, y: 2.3, x: s * 0.95, n: 2 },
      { z: 3, w: 0.75, h: 0.75, y: 2.3, x: s * 0.95, n: 2 },
      { z: 7.6, w: 0.72, h: 0.72, y: 2.3, x: s * 0.95, n: 2 },
    ], { facets: 10, steps: 2, plateEvery: [1, 1], seed: 72 + s, collide: false }, HMf);
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
  S.decal(['FC-31'], 1.4, [1.98, 2.5, 1.5], Math.PI / 2, { color: '#c9c3b5', size: 120, wear: 0.9 });
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
  const HMn = hullMats(mats, 0xdcdcd6, 0x1f4f7a);
  S.plated([
    { z: -9.5, w: 0.5, h: 0.4, y: 3.0, n: 2.2 },
    { z: -7.8, w: 1.9, h: 1.4, y: 3.0, n: 2.5, fb: 0.3 },
    { z: -5, w: 2.4, h: 1.8, y: 3.0, n: 3.4, fb: 0.4 },
    { z: 6, w: 2.4, h: 1.8, y: 3.0, n: 3.4, fb: 0.4 },
    { z: 8.6, w: 2.0, h: 1.4, y: 3.1, n: 3, fb: 0.3 },
    { z: 9.6, w: 1.0, h: 0.7, y: 3.3, n: 2.5 },
  ], { facets: 14, steps: 3, plateEvery: [3, 1], altBelow: 2.0, altRandom: 0.02, seed: 80 }, HMn);
  // bande bleue
  for (const s of [-1, 1]) S.box(0.05, 0.35, 13, blue, [s * 2.55, 3.0, 0.5], null, { cast: false, tex: 1 });
  // hublots
  for (let z = -4; z <= 5; z += 1.3) for (const s of [-1, 1]) S.box(0.06, 0.45, 0.6, glass, [s * 2.55, 3.55, z], null, { cast: false });
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
  S.decal(['ST-40 · LIGNE HALDEN — TERMINUS'], 4.2, [2.58, 2.5, 0.5], Math.PI / 2, { color: '#1f4f7a', size: 110, wear: 0.4 });
  // porte latérale (côté +x = vers le sas une fois tournée) + escalier escamotable
  S.box(0.1, 2.0, 1.3, hull2, [2.55, 2.55, -3.0], null, { cast: false });
  S.box(0.06, 2.0, 1.2, mats.emissive(0xffe4c0, 1.6), [2.52, 2.55, -3.0], null, { cast: false });
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
