import * as THREE from 'three';
import { Builder } from './builder.js';
import { metricBox } from './materials.js';
import { loft, wing, nozzle, flipFaces } from './shipkit.js';
import { platedHull } from './hullkit.js';
import {
  skinHull, nozzle as bellNozzle, nozzleMaterials, kitMaterials, LiveryAtlas, planeDecal, addParts, bevelBox, rodBetween,
  rcsBlock, antenna, radiator, lightPod, ventPanel, dockingClamp, landingStrut, projUV,
} from './hullkit2.js';
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
    // lot mobile : une seule cellule (un appel de rendu par matériau, le vaisseau est petit et se déplace)
    if (dynamic) this.B.cellSize = Infinity;
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
  /** pose une liste de pièces hullkit2 ({geo, role}) avec un jeu de matériaux par rôle */
  parts(list, matSet, pos = [0, 0, 0], rot = null, opts = {}) {
    addParts((g, m, p, r, o) => this.add(g, m, p, r, o), list, matSet, pos, rot, opts);
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
// eslint-disable-next-line no-unused-vars
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
  plate: ds(mats.paint(plate, { kind: 'hull', uv: 2.5, grime: 0.85, scratch: 0.9, rust: 0.05 })),
  alt: ds(mats.paint(alt, { kind: 'hull', uv: 2.5, grime: 0.9, scratch: 0.9, rust: 0.08 })),
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

// =============================================================================== Héron Mk II : coque extérieure
// Cargo léger polyvalent de 35 m (hullkit2) : fuselage lissé à sections chanfreinées (peinture claire sur le
// dos, composite sombre sous la ceinture), nez à ventre relevé (menton), verrière cerclée à vitrages réels
// (le pilote voit au travers : la coque et sa doublure intérieure sont percées), ailes basses en caisson
// biseauté avec pylônes d'emport et nacelles VTOL en bout d'aile, deux nacelles de propulsion d'épaule à
// tuyères en cloche (lueur pilotée par le vol : S.engines / S.vtolEngines.setThrust), carénage dorsal à
// couronne de tourelle, radiateurs, RCS, antennes, feux, train escamotable (S.gear) et livrée HL-0907.
// Repère local de l'aire : nez vers -Z. Les emplacements d'armes (shipgear.js HERON_MOUNTS) tombent sur
// les supports : ailes (±8,4 ; 3,05 ; 0,4), menton (0 ; 2,3 ; -14), dos (0 ; 8,95 ; 2,4), ventre (0 ; 1,45 ; -9,6).
export const HERON_REG = 'HL-0907';

function heronExterior(S, ctx) {
  const { mats } = ctx;
  const RX = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const K = kitMaterials(mats, { hull: 0xc8c5bb, dark: 0x2e3236, accent: 0x2c6d8c, wear: 1.1 });
  const NZ = nozzleMaterials(mats, { glow: 0x9cc4ff, idle: 0.04, key: 'heron' });
  const VZ = nozzleMaterials(mats, { glow: 0x8ab8ff, idle: 0.0, key: 'heronv' });
  const M = { ...K, ...NZ, fin: mats.smooth(0x9a9c9e, 0.45, 0.9, { grime: 0.7, rust: 0.05, floor: 0 }), lens: K.lensWhite, mech: K.mech, chrome: K.chrome };
  const VM = { ...M, outer: VZ.outer, inner: VZ.inner, lip: VZ.lip, glow: VZ.glow };
  const frameDS = ds(K.frame);
  const liner = ds(mats.paint(0x2b3034, { plain: true, rough: 0.6, grime: 0.3 }));
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b2730, roughness: 0.04, metalness: 0.92, transparent: true, opacity: 0.42, side: THREE.DoubleSide, envMapIntensity: 1.6, depthWrite: false });
  const winLit = mats.emissive(0xffd6a0, 1.1);
  const collide = (g) => { const c = (g.index ? g.toNonIndexed() : g.clone()); c.applyMatrix4(S.M); S.CB.addCollider(c); };
  const onHull = (h, z, a, dsh = 0, lift = 0) => {
    const q = h.point(z, a, dsh);
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), q.n));
    return { pos: q.p.clone().addScaledVector(q.n, lift).toArray(), rot: [e.x, e.y, e.z], n: q.n, p: q.p };
  };

  // ---------------------------------------------------------------- livrée (régions déclarées d'abord)
  const L = new LiveryAtlas({ ppm: 40, accent: '#2c6d8c', wear: 0.5, seed: 907 });
  const rStripe = L.region(22.0, 0.46, (d) => { d.stripe(0.14, 0.3, d.accent); d.stripe(0.0, 0.07, '#25282b'); });
  const rReg = L.region(9.6, 0.86, (d) => d.text(`HÉRON MK II · ${HERON_REG}`, 0.05, 0.12, 0.62, { color: '#26292c', spacing: 0.06 }));
  const rOp = L.region(7.4, 0.3, (d) => d.text('ARMATEUR LIBRE · PORT D’ATTACHE HALDEN-7 · AIRE 02', 0.04, 0.05, 0.2, { color: '#3a3e42', weight: 600, spacing: 0.08 }));
  const rNose = L.region(3.4, 1.25, (d) => {
    const c = d.ctx, k = d.px, H = 1.25 * k;
    c.fillStyle = d.accent; c.beginPath(); c.moveTo(0.5 * k, H); c.lineTo(3.4 * k, H); c.lineTo(3.4 * k, 0); c.lineTo(0, 0); c.fill();
    d.text('07', 0.85, 0.16, 0.95, { color: '#e9e4d6', weight: 700 });
    d.rect(2.25, 0.2, 0.06, 0.85, '#e9e4d6');
  });
  const rTop = L.region(4.6, 1.0, (d) => d.text(HERON_REG, 0.05, 0.1, 0.85, { color: '#2a2d30', weight: 700, spacing: 0.08 }));
  const rWalk = L.region(3.2, 1.6, (d) => {
    d.rect(0, 0, 0.06, 1.6, '#2a2d30'); d.rect(3.14, 0, 0.06, 1.6, '#2a2d30');
    d.text('NE PAS MARCHER', 0.25, 0.62, 0.3, { color: '#2a2d30', weight: 700 });
  });
  const rPyl = L.region(2.0, 0.3, (d) => d.text('EMPORT · 1 200 KG', 0.03, 0.04, 0.2, { color: '#e2b83a', weight: 700 }));
  const rChev = L.region(7.4, 0.3, (d) => d.chevrons(0, 0, 7.4, 0.3, { pitch: 0.2 }));
  const rChevV = L.region(3.0, 0.26, (d) => d.chevrons(0, 0, 3.0, 0.26, { pitch: 0.18 }));
  const rBlast = L.region(3.0, 0.5, (d) => { d.chevrons(0, 0, 3.0, 0.13, { pitch: 0.12 }); d.text('DANGER · SOUFFLE', 0.04, 0.16, 0.27, { color: '#e7c23a', weight: 700 }); });
  const rCrew = L.region(2.6, 0.32, (d) => d.text('ACCÈS ÉQUIPAGE ▸', 0.03, 0.05, 0.23, { color: '#e2b83a', weight: 700 }));
  const rRescue = L.region(2.6, 0.42, (d) => { d.rect(0, 0, 0.12, 0.42, d.accent); d.text('SECOURS ▸ ÉVACUATION', 0.22, 0.08, 0.24, { color: '#2a2d30', weight: 700 }); });
  L.build();
  const LM = L.material();
  const decal = (geo) => S.add(geo, LM, [0, 0, 0], null, { cast: false, receive: true });

  // ---------------------------------------------------------------- fuselage : stations
  // sections trapèze chanfreiné-arrondi : ventre plat, flancs à peine inclinés, arêtes biseautées
  const B = { w: 4.6, tw: 4.4, h: 3.5, y: 5.0, c: 0.65, r: 0.28 };
  const ST = [
    { z: -20.3, w: 0.32, tw: 0.24, h: 0.17, hb: 0.2, y: 4.22, c: 0.06, r: 0.06 },
    { z: -19.65, w: 1.65, tw: 1.15, h: 0.85, hb: 0.85, y: 4.32, c: 0.3, r: 0.22 },
    { z: -18.4, w: 2.75, tw: 2.0, h: 1.75, hb: 1.35, y: 4.62, c: 0.48, r: 0.28 },
    { z: -16.6, w: 3.8, tw: 3.0, h: 2.8, hb: 1.9, y: 4.97, c: 0.6, r: 0.28 },
    { z: -14.6, w: 4.45, tw: 3.9, h: 3.35, hb: 2.25, y: 5.0, c: 0.65, r: 0.28 },
    { z: -12.4, ...B, tw: 4.3, hb: 2.65 },
    { z: -10.0, ...B, hb: 3.1 },
    { z: -8.0, ...B, hb: 3.15 },
    { z: 12.5, ...B, hb: 3.15 },
    { z: 15.0, w: 4.45, tw: 4.25, h: 3.4, hb: 3.1, y: 5.05, c: 0.65, r: 0.28 },
  ];
  const zN = ST[0].z, zT = ST[ST.length - 1].z;
  const hold = { x: 3.62, y0: 2.02, y1: 4.98 };
  const H = skinHull(ST, { radial: 8, steps: 2, cap0: true, cap1: { hole: [-hold.x, hold.y0, hold.x, hold.y1] } });
  const WAIST = 0.42; // séparation peinture claire / composite (angle sous l'horizontale)
  const arcLen = (z, a0, a1) => { const p0 = H.point(z, a0), p1 = H.point(z, a1); let d = p1.s - p0.s; if (d <= 0) d += p0.Lt; return d; };
  const piece = (z0, z1, a0, a1, mat, o = {}) => {
    const zm = (z0 + z1) / 2, len = Math.max(arcLen(z0, a0, a1), arcLen(z1, a0, a1), arcLen(zm, a0, a1));
    const segS = Math.max(2, Math.ceil(len / (o.ds ?? 0.11)));
    const segZ = Math.max(1, Math.ceil((z1 - z0) / (o.dz ?? 0.5)));
    const g = H.patch({ z0, z1, a0, a1, off: o.off ?? 0, segZ, segS, metric: true });
    S.add(g, mat, [0, 0, 0], null, o.opts ?? {});
    return g;
  };
  // vitrages : bandes [z0, z1] × [a0, a1] (angles polaires, π/2 = dessus) — la coque et la doublure sont percées
  const WS = { z0: -18.95, z1: -15.75, a0: 0.86, a1: RX - 0.86 };     // pare-brise
  const SW = [{ z0: -17.5, z1: -14.1, a0: 0.3, a1: 0.76 }, { z0: -17.5, z1: -14.1, a0: RX - 0.76, a1: RX - 0.3 }];
  const holes = [WS, ...SW];
  // découpe en tranches de z, puis en arcs : composite sous la ceinture, peinture au-dessus (moins les vitrages)
  const cuts = [...new Set([zN, -12.4, -8.0, 12.5, zT, ...holes.flatMap((h) => [h.z0, h.z1])])].sort((a, b) => a - b);
  const dzOf = (z) => (z < -12.4 ? 0.28 : z < -8 ? 0.5 : z < 12.5 ? 2.05 : 0.5);
  const NOSE_END = -8.8;
  for (let i = 0; i < cuts.length - 1; i++) {
    const za = cuts[i], zb = cuts[i + 1], dz = dzOf(za);
    const inH = holes.filter((h) => h.z0 <= za + 1e-6 && h.z1 >= zb - 1e-6).sort((a, b) => a.a0 - b.a0);
    let a = -WAIST;
    for (const h of inH) { piece(za, zb, a, h.a0, K.hull, { dz }); a = h.a1; }
    piece(za, zb, a, RX + WAIST, K.hull, { dz });
    piece(za, zb, RX + WAIST, 2 * RX - WAIST, za < -12.4 - 1e-6 ? K.hull : K.hullDark, { dz, ds: 0.16 });
    // doublure intérieure du poste (vue depuis le siège : seuls les vitrages laissent voir dehors)
    if (zb <= NOSE_END + 1e-6 || za < NOSE_END) {
      const z1 = Math.min(zb, NOSE_END);
      let b = -RX / 2 + 1e-3;
      for (const h of inH) { piece(za, z1, b, h.a0, liner, { off: -0.07, dz, ds: 0.2, opts: { cast: false } }); b = h.a1; }
      piece(za, z1, b, 3 * RX / 2 - 1e-3, liner, { off: -0.07, dz, ds: 0.2, opts: { cast: false } });
    }
  }
  S.add(H.cap0, K.hull);
  // ventre du nez en composite (plus étroit que la ceinture : le nez reste clair vu de face), raccord cerclé
  S.add(H.patch({ z0: -19.4, z1: -12.4, a0: RX + 0.78, a1: 2 * RX - 0.78, off: 0.006, segZ: 24, segS: 14, metric: true }), K.hullDark);
  S.add(H.band({ z: -12.4, width: 0.26, depth: 0.04, a0: RX + WAIST - 0.04, a1: 2 * RX - WAIST + 0.04, segS: 40 }), K.service);
  S.add(H.cap1, K.hullDark);
  // collisions : nez (le reste du fuselage est couvert par les boîtes, la soute reste ouverte à l'arrière)
  collide(H.patch({ z0: zN, z1: NOSE_END, a0: -RX / 2 + 1e-3, a1: 3 * RX / 2 - 1e-3, segZ: 16, segS: 28 }));

  // ---------------------------------------------------------------- verrière : vitrages + cadre en relief
  const fr = (g) => S.add(g, frameDS);
  for (const h of holes) {
    S.add(H.patch({ z0: h.z0, z1: h.z1, a0: h.a0, a1: h.a1, off: -0.025, segZ: Math.ceil((h.z1 - h.z0) / 0.25), segS: 14 }), glass, [0, 0, 0], null, { cast: false });
    for (const z of [h.z0, h.z1]) fr(H.raised({ z0: z - 0.08, z1: z + 0.08, a0: h.a0 - 0.035, a1: h.a1 + 0.035, depth: 0.09, base: -0.02, segZ: 1, segS: 14 }));
    for (const a of [h.a0, h.a1]) fr(H.strip({ z0: h.z0, z1: h.z1, angle: a, width: 0.15, depth: 0.09, base: -0.02, segZ: Math.ceil((h.z1 - h.z0) / 0.25) }));
  }
  // meneaux du pare-brise, traverse, montant des vitrages latéraux
  for (const a of [RX / 2 - 0.36, RX / 2 + 0.36]) fr(H.strip({ z0: WS.z0, z1: WS.z1, angle: a, width: 0.11, depth: 0.08, base: -0.02, segZ: 12 }));
  fr(H.raised({ z0: -17.42, z1: -17.3, a0: WS.a0, a1: WS.a1, depth: 0.07, base: -0.02, segZ: 1, segS: 12 }));
  for (const h of SW) fr(H.raised({ z0: -15.86, z1: -15.74, a0: h.a0, a1: h.a1, depth: 0.07, base: -0.02, segZ: 1, segS: 4 }));
  // capot de verrière : ressaut peint derrière le pare-brise, essuie-glaces / lave-vitre
  S.add(H.raised({ z0: -15.75, z1: -15.2, a0: 0.3, a1: RX - 0.3, depth: 0.045, segZ: 2, segS: 24 }), K.service);

  // ---------------------------------------------------------------- nervures, liston, trappes
  for (const z of [-8.6, 10.6]) S.add(H.band({ z, width: 0.3, depth: 0.03, a0: -WAIST + 0.06, a1: RX + WAIST - 0.06, segS: 64 }), K.hull);
  S.add(H.band({ z: 14.65, width: 0.5, depth: 0.08, segS: 72 }), K.service);
  for (const a of [-WAIST, RX + WAIST]) S.add(H.strip({ z0: -12.53, z1: 14.5, angle: a, width: 0.2, depth: 0.07, segZ: 28 }), K.service);
  for (const s of [1, -1]) {
    const side = s > 0 ? 0 : RX;
    // trappes de service (composite) et panneau d'accès avionique sous le poste
    for (const [z0, z1, h, sh] of [[3.8, 5.4, 0.6, -0.75], [8.4, 10.0, 0.8, -0.6]]) {
      S.add(H.raised({ z0, z1, angle: side, height: h, shift: sh * s, depth: 0.03, segZ: 2, segS: 3 }), K.hullDark);
    }
    S.add(H.raised({ z0: -10.4, z1: -8.8, angle: s > 0 ? -0.28 : RX + 0.28, height: 0.7, depth: 0.03, segZ: 3, segS: 3 }), K.hullDark);
    // hublots du pont supérieur (vitrage éclairé de l'intérieur + cadre)
    for (let k = 0; k < 6; k++) {
      const z0 = -6.6 + k * 2.75, z1 = z0 + 0.7, a = s > 0 ? 0.3 : RX - 0.3;
      S.add(H.patch({ z0, z1, angle: a, height: 0.42, off: 0.03, segZ: 2, segS: 2 }), winLit, [0, 0, 0], null, { cast: false });
      S.add(H.raised({ z0: z0 - 0.07, z1: z1 + 0.07, angle: a, height: 0.56, depth: 0.035, segZ: 2, segS: 2, base: -0.01 }), K.frame);
    }
  }
  // porte de soute : encadrement, tunnel, chevrons
  S.add(bevelBox(7.9, 0.34, 0.3, 0.08), K.service, [0, hold.y1 + 0.17, zT + 0.05]);
  for (const s of [-1, 1]) {
    S.add(bevelBox(0.34, hold.y1 - hold.y0 + 0.3, 0.3, 0.08), K.service, [s * (hold.x + 0.17), (hold.y0 + hold.y1) / 2 + 0.1, zT + 0.05]);
    S.add(bevelBox(0.06, hold.y1 - hold.y0, 0.62, 0.02), K.mech, [s * (hold.x - 0.03), (hold.y0 + hold.y1) / 2, 14.7]);
    const v = planeDecal(3.0, 0.26, rChevV.uv); v.rotateZ(Math.PI / 2); v.translate(s * (hold.x + 0.48), 3.5, zT + 0.012); decal(v);
  }
  S.add(bevelBox(hold.x * 2, 0.06, 0.62, 0.02), K.mech, [0, hold.y1 - 0.03, 14.7]);
  { const g = planeDecal(7.4, 0.3, rChev.uv); g.translate(0, hold.y1 + 0.55, zT + 0.012); decal(g); }
  { const g = planeDecal(2.6, 0.32, rCrew.uv); g.translate(-2.2, 5.85, zT + 0.012); decal(g); }
  // cloison arrière : grilles d'extraction, trappe de la baie machines, feux de poupe
  for (const s of [-1, 1]) S.parts(ventPanel(1.3, 0.7, 0.06), M, [s * 2.3, 7.35, zT], [Math.PI / 2, 0, 0]);
  S.add(bevelBox(1.2, 1.0, 0.08, 0.03), K.service, [0, 7.0, zT + 0.04]);
  S.add(bevelBox(0.5, 0.08, 0.1, 0.02), K.hazard, [0, 7.55, zT + 0.07]);
  for (const s of [-1, 1]) { S.parts(lightPod({ r: 0.07 }), M, [s * 3.9, 6.6, zT], [Math.PI / 2, 0, 0]); }

  // ---------------------------------------------------------------- nez : menton, capteurs, phares, RCS
  const belly = (z) => H.point(z, -RX / 2).p.y;
  S.add(new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.black, [0, belly(-17.6) - 0.06, -17.6], [Math.PI, 0, 0]);
  S.add(new THREE.CylinderGeometry(0.36, 0.4, 0.12, 20), K.mech, [0, belly(-17.6) - 0.02, -17.6]);
  // support de menton (berceau d'arme) et carénage
  S.add(bevelBox(1.5, 0.22, 2.4, 0.07), K.service, [0, belly(-14.0) - 0.02, -14.0], [-0.17, 0, 0]);
  for (const s of [-1, 1]) S.add(bevelBox(0.12, 0.3, 1.9, 0.03), K.mech, [s * 0.5, belly(-14.0) - 0.12, -14.0], [-0.17, 0, 0]);
  // phares d'atterrissage
  for (const s of [-1, 1]) {
    S.add(new THREE.CylinderGeometry(0.17, 0.21, 0.14, 16), K.mech, [s * 1.25, belly(-16.0) - 0.02, -16.0]);
    S.add(new THREE.CircleGeometry(0.15, 16), K.lensWhite, [s * 1.25, belly(-16.0) - 0.095, -16.0], [Math.PI / 2, 0, 0], { cast: false });
  }
  // RCS avant (épaules du nez) et arrière (nacelles)
  for (const s of [-1, 1]) {
    const q = onHull(H, -14.9, s > 0 ? 0.55 : RX - 0.55, 0, 0.15);
    S.parts(rcsBlock({ size: 0.42, dirs: ['+y', s > 0 ? '+x' : '-x', '-z', '+z'] }), M, q.pos, q.rot);
    const q2 = onHull(H, -11.0, s > 0 ? -0.55 : RX + 0.55, 0, 0.15);
    S.parts(rcsBlock({ size: 0.38, dirs: ['+y', '-z', '+z'] }), M, q2.pos, q2.rot);
  }

  // ---------------------------------------------------------------- carénage dorsal, couronne de tourelle
  const spine = skinHull([
    { z: -6.4, w: 0.25, tw: 0.2, h: 0.04, hb: 0.1, y: 8.48, c: 0.04, r: 0.03 },
    { z: -4.2, w: 1.35, tw: 1.0, h: 0.42, hb: 0.1, y: 8.52, c: 0.16, r: 0.08 },
    { z: 10.6, w: 1.35, tw: 1.0, h: 0.42, hb: 0.1, y: 8.52, c: 0.16, r: 0.08 },
    { z: 12.9, w: 0.5, tw: 0.35, h: 0.12, hb: 0.1, y: 8.5, c: 0.08, r: 0.04 },
  ], { radial: 28, steps: 5, smooth: true, cap1: true });
  S.add(spine.geometry, K.hull);
  S.add(spine.cap1, K.service);
  for (const z of [-1.2, 6.2]) S.add(spine.band({ z, width: 0.22, depth: 0.03, a0: -0.2, a1: RX + 0.2 }), K.service);
  // couronne (toujours présente ; la tourelle s'y pose) : anneau, capot, boulons
  S.add(new THREE.CylinderGeometry(1.28, 1.36, 0.12, 40), K.mech, [0, 8.9, 2.4]);
  S.add(new THREE.TorusGeometry(1.2, 0.05, 6, 40), K.bare, [0, 8.96, 2.4], [Math.PI / 2, 0, 0]);
  S.add(new THREE.CylinderGeometry(1.08, 1.12, 0.06, 40), K.service, [0, 8.97, 2.4]);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; S.add(bevelBox(0.3, 0.06, 0.18, 0.02), K.hazard, [Math.cos(a) * 1.32, 8.97, 2.4 + Math.sin(a) * 1.32], [0, -a, 0]); }
  // radiateurs d'épaule, antennes, dôme de capteurs
  for (const s of [-1, 1]) S.parts(radiator({ len: 5.4, h: 0.34, n: 9, w: 1.25 }), M, [s * 2.55, 8.5, 8.4]);
  S.parts(antenna({ type: 'dish', h: 0.9, r: 0.38, tilt: 0.75 }), M, [1.9, 8.5, -6.4]);
  S.parts(antenna({ type: 'whip', h: 1.5 }), M, [-1.9, 8.5, -7.6]);
  S.parts(antenna({ type: 'blade', h: 0.42 }), M, [0, 8.94, -2.8]);
  S.parts(antenna({ type: 'mast', h: 1.05 }), M, [1.2, 8.5, 12.3]);
  S.parts(ventPanel(1.6, 0.9, 0.06), M, [0, 8.5, 13.7]);
  S.parts(antenna({ type: 'blade', h: 0.38 }), M, [0, 1.88, -3.0], [Math.PI, 0, 0]);
  S.add(new THREE.SphereGeometry(0.42, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.smooth(0x9aa4aa, 0.25, 0.4), [-1.5, 8.55, -4.4]);
  S.add(new THREE.CylinderGeometry(0.48, 0.52, 0.1, 18), K.mech, [-1.5, 8.53, -4.4]);
  // capot d'accès dorsal et décalcomanie d'immatriculation (lisible d'au-dessus)
  S.add(H.raised({ z0: -10.4, z1: -9.0, angle: RX / 2, height: 1.4, depth: 0.03, segZ: 2, segS: 3 }), K.hullDark);
  decal(H.patch({ z0: -14.4, z1: -10.0, angle: RX / 2, height: 0.96, uv: rTop.uv, readable: true, up: [0, 0, -1], segZ: 6, segS: 3 }));

  // ---------------------------------------------------------------- ailes basses, pylônes d'emport, nacelles VTOL
  const WY = 3.75, WT = 0.44, WB = 0.12;
  for (const s of [-1, 1]) {
    const pts = [[4.2, -3.4], [9.75, 0.0], [9.75, 6.4], [4.2, 7.6]].map(([x, z]) => new THREE.Vector2(s * x, -z));
    const wg0 = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: WT - 2 * WB, bevelEnabled: true, bevelThickness: WB, bevelSize: WB, bevelOffset: -WB, bevelSegments: 1, curveSegments: 1 });
    wg0.rotateX(-Math.PI / 2); wg0.translate(0, WY - (WT - 2 * WB) / 2, 0);
    const wg = wg0.index ? wg0.toNonIndexed() : wg0; wg.computeVertexNormals(); projUV(wg, 1);
    S.add(wg, K.hull);
    collide(wg);
    // ventre d'aile en composite
    const ub = bevelBox(4.6, 0.04, 5.4, 0.015); ub.rotateY(0); S.add(ub, K.hullDark, [s * 6.75, WY - WT / 2 - 0.01, 3.6]);
    // bord d'attaque en métal nu, volets de bord de fuite séparés par un jour, cloisons d'aile
    const le = rodBetween(V(s * 4.3, WY, -3.3), V(s * 9.7, WY, 0.05), 0.13, 10); S.add(le, K.bare);
    S.add(bevelBox(4.9, 0.12, 0.9, 0.03), K.hullDark, [s * 6.95, WY - 0.02, 7.05], [0.1, s * Math.atan2(1.2, 5.55), 0]);
    S.add(bevelBox(0.08, 0.16, 4.4, 0.02), K.service, [s * 7.4, WY + WT / 2 + 0.06, 3.4]);
    // pylône d'emport (point d'accrochage d'arme sous l'aile)
    S.add(bevelBox(0.36, 0.34, 2.3, 0.07), K.service, [s * 8.4, WY - WT / 2 - 0.15, 0.6]);
    S.add(bevelBox(0.5, 0.06, 1.5, 0.02), K.mech, [s * 8.4, WY - WT / 2 - 0.33, 0.6]);
    for (const z of [0.05, 1.15]) S.add(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), K.chrome, [s * 8.4, WY - WT / 2 - 0.38, z]);
    { const g = planeDecal(2.0, 0.3, rPyl.uv); g.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(s * (8.4 + 0.185), WY - WT / 2 - 0.15, 0.6); decal(g); }
    // marquages d'extrados : bande d'accent au saumon, zone de passage
    { const g = planeDecal(3.2, 1.6, rWalk.uv); g.rotateX(-Math.PI / 2); if (s < 0) g.rotateY(Math.PI); g.translate(s * 5.6, WY + WT / 2 + 0.006, 2.4); decal(g); }
    S.add(bevelBox(0.5, 0.02, 6.1, 0.005), K.accent, [s * 9.35, WY + WT / 2 + 0.004, 3.25], null, { cast: false });
    // nacelle VTOL de saumon (tuyère orientable vers le bas)
    const vx = s * 10.3;
    const pod = skinHull([
      { z: -0.75, w: 0.06, h: 0.06, x: vx, y: WY, n: 2.2, steps: 2 },
      { z: -0.4, w: 0.28, h: 0.28, x: vx, y: WY, n: 2.2, steps: 3 },
      { z: 0.8, w: 0.78, h: 0.78, x: vx, y: WY, n: 2.4, steps: 4 },
      { z: 6.4, w: 0.78, h: 0.78, x: vx, y: WY, n: 2.4, steps: 3 },
      { z: 7.6, w: 0.42, h: 0.42, x: vx, y: WY, n: 2.2 },
    ], { radial: 32, cap1: true });
    S.add(pod.geometry, K.hull);
    S.add(pod.cap1, K.mech);
    S.add(pod.patch({ z0: -0.74, z1: 1.6, a0: -RX / 2 + 1e-3, a1: 3 * RX / 2 - 1e-3, off: 0.004, segZ: 8, segS: 24, metric: true }), K.accent);
    for (const z of [1.8, 5.8]) S.add(pod.band({ z, width: 0.16, depth: 0.03 }), K.service);
    collide(skinHull([{ z: -0.4, w: 0.3, h: 0.3, x: vx, y: WY }, { z: 0.8, w: 0.8, h: 0.8, x: vx, y: WY }, { z: 7.6, w: 0.45, h: 0.45, x: vx, y: WY }], { radial: 10, steps: 2 }).geometry);
    S.parts(bellNozzle({ rt: 0.26, re: 0.56, len: 0.62, wall: 0.04, seg: 28, mount: 0, gimbal: false, bands: 1 }), VM, [vx, WY - 0.3, 3.8], [Math.PI / 2, 0, 0]);
    S.add(new THREE.TorusGeometry(0.66, 0.06, 6, 28), K.mech, [vx, WY - 0.72, 3.8], [Math.PI / 2, 0, 0]);
    // feux de navigation (bâbord rouge, tribord vert) et RCS de saumon
    S.parts(lightPod({ r: 0.08 }), M, [s * 11.06, WY, 3.8], [0, 0, -s * Math.PI / 2]);
    S.navLight([s * 11.2, WY, 3.8], s < 0 ? 0xff2010 : 0x20ff40, 0);
    S.parts(rcsBlock({ size: 0.36, dirs: ['+y', '-y', '+z'] }), M, [vx, WY + 0.86, 6.2]);
  }

  // ---------------------------------------------------------------- nacelles de propulsion (épaules) + tuyères
  const EX = 4.85, EY = 7.05;
  for (const s of [-1, 1]) {
    const nx = s * EX;
    const nst = [
      { z: 4.55, w: 0.14, tw: 0.11, h: 0.12, hb: 0.15, x: nx, y: EY, c: 0.04, r: 0.04, steps: 3 },
      { z: 5.0, w: 0.55, tw: 0.45, h: 0.5, hb: 0.6, x: nx, y: EY, c: 0.16, r: 0.12, steps: 4 },
      { z: 6.6, w: 1.1, tw: 0.95, h: 1.0, hb: 1.25, x: nx, y: EY, c: 0.38, r: 0.18, steps: 3 },
      { z: 7.8, w: 1.15, tw: 1.0, h: 1.05, hb: 1.3, x: nx, y: EY, c: 0.4, r: 0.18, steps: 3 },
      { z: 14.4, w: 1.15, tw: 1.0, h: 1.05, hb: 1.3, x: nx, y: EY, c: 0.4, r: 0.18, steps: 3 },
      { z: 15.55, w: 0.95, tw: 0.82, h: 0.88, hb: 1.05, x: nx, y: EY, c: 0.34, r: 0.16 },
    ];
    const cowl = skinHull(nst.slice(0, 4), { radial: 40 });
    const nac = skinHull(nst.slice(3), { radial: 40, cap1: true });
    S.add(cowl.geometry, K.hull);
    S.add(nac.geometry, K.hull);
    S.add(nac.cap1, K.mech);
    collide(skinHull([nst[1], nst[3], nst[5]].map((t) => ({ ...t, steps: 2 })), { radial: 12 }).geometry);
    // anneau d'accent (seule couleur vive), cerclages, ventre composite, trappes
    S.add(nac.band({ z: 8.2, width: 0.42, depth: 0.03 }), K.accent);
    for (const z of [10.2, 12.6]) S.add(nac.band({ z, width: 0.2, depth: 0.045 }), K.service);
    S.add(nac.patch({ z0: 7.9, z1: 14.3, a0: RX + 0.3, a1: 2 * RX - 0.3, off: 0.005, segZ: 10, segS: 10, metric: true }), K.hullDark);
    S.add(nac.raised({ z0: 9.6, z1: 11.4, angle: s > 0 ? 0.25 : RX - 0.25, height: 0.8, depth: 0.03, segZ: 2, segS: 3 }), K.hullDark);
    S.add(nac.band({ z: 15.2, width: 0.32, depth: 0.04 }), K.bare);
    // fixation sur la coque (carénage d'épaule)
    S.add(bevelBox(0.9, 0.5, 8.4, 0.16), K.service, [s * 4.1, 7.95, 10.6], [0, 0, -s * 0.75]);
    S.parts(bellNozzle({ rt: 0.42, re: 0.98, len: 1.65, wall: 0.05, seg: 40, mount: 0.55, bands: 2 }), M, [nx, EY, 15.45]);
    decal(nac.patch({ z0: 11.6, z1: 14.6, angle: s > 0 ? 0.6 : RX - 0.6, height: 0.5, uv: rBlast.uv, readable: true, segZ: 6, segS: 2 }));
    S.parts(rcsBlock({ size: 0.42, dirs: ['+y', s > 0 ? '+x' : '-x', '+z', '-z'] }), M, [nx + s * 0.86, EY + 0.86, 13.6], [0, 0, -s * Math.PI / 4]);
    S.cbox(2.5, 2.6, 11.6, [nx, EY - 0.1, 10.8]);
  }
  S.engines = NZ;          // tuyères principales : setThrust(0..1), piloté par Flight
  S.vtolEngines = VZ;      // tuyères VTOL de saumon
  S.thrusters = { main: [[-EX, EY, 17.1], [EX, EY, 17.1]], vtol: [[-10.3, WY - 0.92, 3.8], [10.3, WY - 0.92, 3.8]] };

  // ---------------------------------------------------------------- ventre : berceaux, trappes de train
  S.add(bevelBox(1.9, 0.12, 2.9, 0.04), K.service, [0, belly(-9.4) - 0.02, -9.4]);              // berceau du module de minage
  for (const s of [-1, 1]) S.add(bevelBox(0.1, 0.1, 2.6, 0.02), K.chrome, [s * 0.8, belly(-9.4) - 0.1, -9.4]);
  S.add(bevelBox(2.4, 0.04, 5.2, 0.015), K.service, [0, 1.85, 4.0]);
  // feux : balises anticollision (dessus / dessous), feu de poupe
  S.parts(lightPod({ r: 0.09 }), M, [0, 8.92, -4.8]);
  S.navLight([0, 9.12, -4.8], 0xff3018, 0.3);
  S.parts(lightPod({ r: 0.08 }), M, [0, 1.84, 0.4], [Math.PI, 0, 0]);
  S.navLight([0, 1.66, 0.4], 0xff3018, 0.95);
  S.parts(lightPod({ r: 0.08 }), M, [0, 8.6, 12.85]);
  S.navLight([0, 8.78, 12.85], 0xffffff, 1.1);

  // ---------------------------------------------------------------- livrée (décalcomanies conformes)
  for (const s of [1, -1]) {
    const side = s > 0 ? 0 : RX;
    decal(H.patch({ z0: -12.6, z1: 13.9, angle: side, shift: s * 0.95, height: 0.46, uv: rStripe.uv, readable: true, segZ: 10, segS: 2 }));
    decal(H.patch({ z0: -8.4, z1: 1.2, angle: side, shift: s * -0.2, height: 0.86, uv: rReg.uv, readable: true, segZ: 6, segS: 2 }));
    decal(H.patch({ z0: -8.4, z1: -1.0, angle: side, shift: s * -0.75, height: 0.3, uv: rOp.uv, readable: true, segZ: 6, segS: 2 }));
    decal(H.patch({ z0: -14.0, z1: -10.6, angle: side, shift: s * -0.15, height: 1.25, uv: rNose.uv, readable: true, segZ: 6, segS: 4 }));
    decal(H.patch({ z0: 11.0, z1: 13.6, angle: side, shift: s * -0.2, height: 0.42, uv: rRescue.uv, readable: true, segZ: 3, segS: 2 }));
  }

  // ---------------------------------------------------------------- train d'atterrissage escamotable
  // lot propre (S.gear.group) : Flight le remonte dans la coque en vol ; cales au sol visibles posé seulement
  const GB = new Builder(null), CB = new Builder(null);
  const gadd = (Bd) => (g, m, p, r, o = {}) => Bd.add(g, m, Builder.matrix(p, r), { ...o, parent: S.M });
  const chock = mats.plastic(0xd4a017, 0.6);
  for (const s of [-1, 1]) {
    for (const [x, z, br] of [[2.4, -11.0, '+z'], [3.2, 9.5, '-z']]) {
      const by = belly(z), h = by + 0.12;
      addParts(gadd(GB), landingStrut({ h, r: 0.19, pad: 1.25, brace: br }), M, [s * x, 0, z]);
      for (const k of [-1, 1]) gadd(CB)(metricBox(0.25, 0.2, 0.3, 1), chock, [s * x + k * 0.85, 0.1, z]);
      // trappes de puits ouvertes (de part et d'autre du puits)
      for (const k of [-1, 1]) gadd(GB)(bevelBox(0.05, 0.75, 1.5, 0.015), K.hullDark, [s * x + k * 0.62, by - 0.4, z], [0, 0, k * 0.12]);
      S.add(bevelBox(1.3, 0.05, 1.6, 0.02), K.black, [s * x, by + 0.005, z]);
    }
  }
  const gearGroup = new THREE.Group(), chocks = new THREE.Group();
  GB.finalize(gearGroup); CB.finalize(chocks);
  S.worldGroup.add(gearGroup, chocks);
  S.gear = { group: gearGroup, chocks, k: 1, travel: 1.5 };
}

function buildHeron(ctx) {
  const pad = PADS.p2;
  const c0 = ctx.builder.colliders.length;
  const S = new ShipCtx(ctx, pad, 'heron', true);
  const { mats } = ctx;
  // -------------------------------------------------- matériaux
  const metal = mats.metal(0x55595c);
  const chrome = mats.smooth(0xc8ccce, 0.25, 1.0, { grime: 0.3, floor: 0.2 });
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
  // -------------------------------------------------- coque extérieure (hullkit2)
  heronExterior(S, ctx);

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
  // (la grille est vide : les caisses des contrats de fret y sont arrimées, voir game/cargo.js)
  // rover garé côté bâbord
  rover(S, mats, -2.3, fy, 9.0, Math.PI);
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
  // rampe mobile : pivot à la charnière (haut de la rampe), relevée en vol
  const rampPivot = new THREE.Group();
  rampPivot.position.set(0, fy, hz1);
  S.group.add(rampPivot);
  const rampMesh = (geo, mat, p, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(p[0], p[1] - fy, p[2] - hz1); m.rotation.x = rAng; m.castShadow = cast; m.receiveShadow = true; rampPivot.add(m); return m; };
  rampMesh(metricBox(hw * 2 - 0.3, 0.16, rampLen, 1), mats.metal(0x5a5e60, { rough: 0.5 }), [0, fy / 2 + 0.02, hz1 + 2.3]);
  for (const sx of [-1, 1]) {
    rampMesh(metricBox(0.08, 0.28, rampLen, 2), yellow, [sx * (hw - 0.25), fy / 2 + 0.2, hz1 + 2.3], false);
    const v = new THREE.CylinderGeometry(0.07, 0.07, 2.4, 16); const vm = new THREE.Mesh(v, chrome); vm.position.set(sx * (hw - 0.5), fy * 0.75 + 0.3 - fy, hz1 + 1.0 - hz1); vm.rotation.x = Math.PI / 2 - 0.85; rampPivot.add(vm);
  }
  S.ramp = { pivot: rampPivot, closed: -(rAng + Math.PI / 2), k: 0 };

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

// Cargo lourd de 33 m : cabine émoussée à verrière cerclée, poutre de soute biseautée (soute arrière
// ouverte, rampe), berceau dorsal à conteneurs, deux nacelles à tuyères en cloche, train lourd, livrée.
// Coque lisse hullkit2 (UV en mètres → tôles « hull » à l'échelle), tout fusionné par le Builder.
function buildMulet(ctx) {
  const pad = PADS.p3;
  const S = new ShipCtx(ctx, pad, 'mulet');
  const { mats } = ctx;
  const K = kitMaterials(mats, { hull: 0xbdbab0, dark: 0x30343a, accent: 0xd0601a });
  const NZ = nozzleMaterials(mats, { glow: 0x9cc4ff, idle: 0.06, key: 'mulet' });
  const M = { ...K, ...NZ, fin: mats.smooth(0x9a9c9e, 0.45, 0.9, { grime: 0.7, rust: 0.05, floor: 0 }), lens: K.lensWhite, mech: K.mech, chrome: K.chrome };
  const fy = 2.3, iw = 3.6, cy = 7.6;
  const RX = Math.PI;

  // ---------------------------------------------------------------- livrée (régions déclarées d'abord)
  const L = new LiveryAtlas({ ppm: 40, accent: '#d0601a', wear: 0.55, seed: 2207 });
  const rStripe = L.region(22.5, 0.5, (d) => { d.stripe(0.16, 0.3, d.accent); d.stripe(0.02, 0.07, '#25282b'); });
  const rReg = L.region(8.5, 0.9, (d) => d.text('MULET H4 · HT-2207', 0.05, 0.12, 0.66, { color: '#26292c', spacing: 0.06 }));
  const rOp = L.region(7, 0.34, (d) => d.text('SILLAGE ORBITAL LOGISTICS — HALDEN-7', 0.05, 0.05, 0.24, { color: '#3a3e42', weight: 600, spacing: 0.1 }));
  const rCab = L.region(4.6, 1.5, (d) => {
    const c = d.ctx, k = d.px, H = 1.5 * k;
    c.fillStyle = d.accent; c.beginPath(); c.moveTo(0, H); c.lineTo(4.6 * k, H); c.lineTo(4.6 * k, 0.25 * k); c.lineTo(3.9 * k, 0); c.lineTo(0, 0); c.fill();
    d.text('04', 0.25, 0.2, 1.0, { color: '#e9e4d6', weight: 700 });
    d.rect(1.65, 0.28, 2.6, 0.07, '#26292c');
    d.text('AIRE 03 · HALDEN', 1.65, 0.42, 0.26, { color: '#26292c', weight: 600 });
  });
  const rChev = L.region(7.6, 0.36, (d) => d.chevrons(0, 0, 7.6, 0.36, { pitch: 0.22 }));
  const rChevV = L.region(5.6, 0.3, (d) => d.chevrons(0, 0, 5.6, 0.3, { pitch: 0.2 }));
  const rBlast = L.region(3.6, 0.55, (d) => { d.chevrons(0, 0, 3.6, 0.14, { pitch: 0.12 }); d.text('DANGER · SOUFFLE', 0.04, 0.17, 0.3, { color: '#e7c23a', weight: 700 }); });
  const rCharge = L.region(3.2, 0.42, (d) => d.text('CHARGE MAX 120 T', 0.04, 0.06, 0.32, { color: '#e2b83a', weight: 700 }));
  const rNo = L.region(1.4, 0.9, (d) => d.text('H4', 0.05, 0.08, 0.8, { color: '#26292c', weight: 700 }));
  L.build();
  const LM = L.material();
  const decal = (geo) => S.add(geo, LM, [0, 0, 0], null, { cast: false, receive: true });

  // ---------------------------------------------------------------- poutre de soute (deux tons)
  const spineSt = [
    { z: -10.2, w: 4.3, tw: 3.9, h: 2.9, hb: 3.1, y: 5.1, c: 0.5, r: 0.16, steps: 3 },
    { z: -8.0, w: 5.0, tw: 4.6, h: 3.4, hb: 3.4, y: 5.0, c: 0.55, r: 0.18, steps: 8 },
    { z: 14.9, w: 5.0, tw: 4.6, h: 3.4, hb: 3.4, y: 5.0, c: 0.55, r: 0.18, steps: 1 },
    { z: 15.5, w: 4.85, tw: 4.45, h: 3.28, hb: 3.28, y: 5.0, c: 0.6, r: 0.18 },
  ];
  const WAIST = 0.32; // ligne de séparation peinture claire / composite sombre (angle sous l'horizontale)
  const spineTop = skinHull(spineSt, { radial: 40, smooth: false, arc: [-WAIST, RX + WAIST] });
  const spineBot = skinHull(spineSt, { radial: 20, smooth: false, arc: [RX + WAIST, 2 * RX - WAIST], cap0: true, cap1: { hole: [-3.68, 2.22, 3.68, 7.68] } });
  S.add(spineTop.geometry, K.hull);
  S.add(spineBot.geometry, K.hullDark);
  S.add(spineBot.cap0, K.service);
  S.add(spineBot.cap1, K.service);
  const sp = spineTop; // surface de référence (patchs)
  // nervures structurelles (cadres) et liston de flanc
  for (const z of [-7.4, -1.4, 4.6, 10.6]) S.add(sp.band({ z, width: 0.42, depth: 0.07, a0: -0.75, a1: RX + 0.75 }), K.service);
  for (const z of [-9.2, 15.15]) S.add(sp.band({ z, width: 0.5, depth: 0.09, a0: -0.75, a1: RX + 0.75 }), K.service);
  for (const a of [-WAIST + 0.02, RX + WAIST - 0.02]) S.add(sp.strip({ z0: -8.6, z1: 14.9, angle: a, width: 0.22, depth: 0.08 }), K.service);
  // trappes et panneaux composites rapportés
  for (const s of [1, -1]) {
    const a = s > 0 ? 0.05 : RX - 0.05;
    for (const [z0, z1, h, sh] of [[-6.4, -4.6, 1.1, -0.7], [0.2, 2.6, 0.8, -0.7], [11.6, 13.8, 0.9, -0.7]]) {
      S.add(sp.raised({ z0, z1, angle: a, height: h, shift: sh * s, depth: 0.035, segZ: 2, segS: 2 }), K.hullDark);
    }
  }
  // gaines de train sous le ventre
  for (const s of [-1, 1]) S.add(spineBot.raised({ z0: 8.7, z1: 11.3, angle: -RX / 2, height: 1.2, shift: s * 3.8, depth: 0.05, segZ: 2, segS: 2 }), K.service);

  // ---------------------------------------------------------------- cabine (nez émoussé, verrière cerclée)
  const cabSt = [
    { z: -17.6, w: 2.7, tw: 1.7, h: 0.55, hb: 1.25, y: 3.95, c: 0.3, r: 0.18, steps: 3 },
    { z: -17.1, w: 3.45, tw: 2.35, h: 1.05, hb: 1.95, y: 4.3, c: 0.4, r: 0.22, steps: 5 },
    { z: -16.0, w: 3.95, tw: 2.75, h: 2.3, hb: 2.85, y: 5.0, c: 0.45, r: 0.25, steps: 5 },
    { z: -14.8, w: 4.15, tw: 3.05, h: 2.75, hb: 3.2, y: 5.2, c: 0.5, r: 0.25, steps: 3 },
    { z: -12.6, w: 4.15, tw: 3.05, h: 2.8, hb: 3.3, y: 5.2, c: 0.5, r: 0.25, steps: 3 },
    { z: -9.6, w: 4.15, tw: 3.05, h: 2.8, hb: 3.3, y: 5.2, c: 0.5, r: 0.25 },
  ];
  const cab = skinHull(cabSt, { radial: 48, cap0: true });
  S.add(cab.geometry, K.hull);
  S.add(cab.cap0, K.hullDark);
  // ventre de la cabine en composite (patch conforme)
  S.add(cab.patch({ z0: -17.3, z1: -9.7, a0: RX + 0.45, a1: 2 * RX - 0.35, off: 0.006, segZ: 14, segS: 10, metric: true }), K.hullDark);
  // collier cabine / poutre
  S.add(cab.band({ z: -9.85, width: 0.45, depth: 0.1 }), K.service);
  // verrière : vitrage conforme + cadre (meneaux et traverses en relief)
  const gz0 = -16.95, gz1 = -15.25, ga0 = 0.42, ga1 = RX - 0.42;
  S.add(cab.patch({ z0: gz0, z1: gz1, a0: ga0, a1: ga1, off: 0.004, segZ: 6, segS: 16 }), K.glass, [0, 0, 0], null, { cast: false });
  for (const z of [gz0, gz1]) S.add(cab.raised({ z0: z - 0.08, z1: z + 0.08, a0: ga0 - 0.04, a1: ga1 + 0.04, depth: 0.08, segZ: 1, segS: 16 }), K.frame);
  for (const a of [ga0, 0.95, RX / 2, RX - 0.95, ga1]) S.add(cab.strip({ z0: gz0, z1: gz1, angle: a, width: 0.12, depth: 0.08, segZ: 6 }), K.frame);
  // hublots latéraux
  for (const s of [1, -1]) {
    const a = s > 0 ? 0.42 : RX - 0.42;
    for (const [z0, z1] of [[-14.5, -13.5], [-13.2, -12.2]]) {
      S.add(cab.patch({ z0, z1, angle: a, height: 0.55, off: 0.004, segZ: 2, segS: 2 }), K.glass, [0, 0, 0], null, { cast: false });
      S.add(cab.raised({ z0: z0 - 0.06, z1: z1 + 0.06, angle: a, height: 0.69, depth: 0.03, segZ: 2, segS: 2, base: -0.02 }), K.frame);
    }
    // porte d'équipage (bâbord) : cadre en relief
    if (s < 0) S.add(cab.raised({ z0: -11.9, z1: -10.6, angle: RX + 0.05, height: 2.0, depth: 0.025, segZ: 2, segS: 4 }), K.service);
  }
  // capteur de menton + pare-chocs du nez
  S.add(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), K.black, [0, 2.35, -16.2], [Math.PI, 0, 0]);
  S.add(bevelBox(4.4, 0.32, 0.36, 0.1), K.service, [0, 3.35, -17.62]);
  for (const s of [-1, 1]) {
    S.add(bevelBox(1.0, 0.4, 0.14, 0.05), K.frame, [s * 1.55, 4.05, -17.58]);
    for (const k of [-1, 1]) S.add(new THREE.CircleGeometry(0.12, 16), K.lensWhite, [s * 1.55 + k * 0.24, 4.05, -17.66], [0, Math.PI, 0], { cast: false });
  }

  // ---------------------------------------------------------------- berceau dorsal : conteneurs
  const contCol = [0x7a3a2c, 0x2f4d66, 0x6a6a5c, 0x7d6a34];
  const yTop = 8.4;
  for (let b = 0; b < 3; b++) {
    const zc = -4.4 + b * 6.0;
    for (const s of [-1, 1]) {
      if (b === 2 && s > 0) continue; // emplacement vide : pinces visibles
      const cm = mats.cladding(contCol[(b * 2 + (s > 0 ? 1 : 0)) % 4], { grime: 0.8, rust: 0.25 });
      S.box(2.44, 2.44, 5.7, cm, [s * 1.33, yTop + 0.06 + 1.22, zc], null, { tex: 2 });
      // cadres d'extrémité du conteneur
      for (const e of [-1, 1]) S.add(bevelBox(2.5, 2.5, 0.12, 0.03), K.mech, [s * 1.33, yTop + 0.06 + 1.22, zc + e * 2.86]);
    }
    if (b === 2) for (const e of [-1, 1]) for (const x of [0.6, 2.1]) S.parts(dockingClamp({ size: 0.55 }), M, [x, yTop, zc + e * 2.2]);
  }
  // gaines techniques le long des flancs (sur le composite sombre), colliers tous les 2 m
  for (const s of [-1, 1]) {
    for (const [y, r] of [[3.05, 0.09], [2.8, 0.06]]) {
      const x = s * (5.0 + r + 0.02);
      S.add(rodBetween(new THREE.Vector3(x, y, -7.6), new THREE.Vector3(x, y, 14.4), r, 10), K.mech);
    }
    for (let z = -7; z <= 14; z += 2) S.add(bevelBox(0.16, 0.48, 0.12, 0.03), K.service, [s * 5.12, 2.93, z]);
  }
  // rails du berceau + poteaux aux nervures
  for (const s of [-1, 1]) S.add(bevelBox(0.3, 0.14, 18.4, 0.04), K.service, [s * 2.75, yTop + 0.07, 1.6]);
  for (const z of [-7.4, -1.4, 4.6, 10.6]) for (const s of [-1, 1]) {
    S.add(bevelBox(0.3, 1.5, 0.34, 0.05), K.service, [s * 2.85, yTop + 0.75, z]);
    S.add(bevelBox(0.32, 0.12, 0.36, 0.02), K.hazard, [s * 2.85, yTop + 1.56, z]);
  }

  // ---------------------------------------------------------------- nacelles + pylônes + tuyères
  for (const s of [-1, 1]) {
    const nx = s * 7.5, ny = 5.4;
    const nacSt = [
      { z: 2.4, w: 1.12, h: 1.08, x: nx, y: ny, n: 2.25, steps: 3 },
      { z: 3.0, w: 1.42, h: 1.38, x: nx, y: ny, n: 2.3, steps: 2 },
      { z: 3.6, w: 1.5, h: 1.45, x: nx, y: ny, n: 2.35, steps: 4 },
      { z: 10.6, w: 1.5, h: 1.45, x: nx, y: ny, n: 2.35, steps: 5 },
      { z: 12.6, w: 0.95, h: 0.92, x: nx, y: ny, n: 2.1 },
    ];
    const cowl = skinHull(nacSt.slice(0, 3), { radial: 40, cap0: true });
    const nac = skinHull(nacSt.slice(2), { radial: 40, cap1: true });
    S.add(cowl.geometry, K.accent);
    S.add(cowl.cap0, K.vent);
    S.add(nac.geometry, K.hull);
    S.add(nac.cap1, K.mech);
    // lèvre d'entrée d'air
    S.add(new THREE.TorusGeometry(1.06, 0.07, 8, 40), K.bare, [nx, ny, 2.42]);
    S.add(new THREE.CylinderGeometry(0.28, 0.4, 0.5, 20), K.mech, [nx, ny, 2.3], [Math.PI / 2, 0, 0]);
    // cerclages, panneau composite inférieur, trappes de maintenance
    for (const z of [4.3, 7.2, 10.1]) S.add(nac.band({ z, width: 0.22, depth: 0.05 }), K.service);
    S.add(nac.patch({ z0: 3.7, z1: 10.9, a0: RX + 0.5, a1: 2 * RX - 0.5, off: 0.006, segZ: 12, segS: 8, metric: true }), K.hullDark);
    S.add(nac.raised({ z0: 5.0, z1: 6.6, angle: s > 0 ? 0.2 : RX - 0.2, height: 0.9, depth: 0.03, segZ: 2, segS: 3 }), K.hullDark);
    S.parts(ventPanel(0.9, 1.4, 0.07), M, [nx, ny + 1.42, 8.8]);
    // pylône (biseauté, carénage incliné) + radiateur
    const px = s * 6.05;
    S.add(bevelBox(2.4, 1.0, 7.2, 0.18), K.hull, [px, 5.7, 7.2]);
    S.add(bevelBox(2.2, 0.5, 7.0, 0.12), K.hullDark, [px, 5.0, 7.2]);
    S.parts(radiator({ len: 5.2, h: 0.42, n: 8, w: 1.2 }), M, [s * 5.6, 6.2, 7.4]);
    // tuyère principale
    S.parts(bellNozzle({ rt: 0.46, re: 1.08, len: 2.5, wall: 0.055, seg: 40, mount: 0.75, bands: 2 }), M, [nx, ny, 13.15]);
    // bouclier thermique arrière (anneau en métal nu, teinté)
    S.add(nac.band({ z: 12.3, width: 0.3, depth: 0.04 }), K.bare);
    // livrée nacelle
    decal(nac.patch({ z0: 7.6, z1: 11.1, angle: s > 0 ? 0.35 : RX - 0.35, height: 0.55, uv: rBlast.uv, readable: true, segZ: 6, segS: 2 }));
    // feux de position (bâbord rouge, tribord vert) en bout de nacelle
    S.parts(lightPod({ r: 0.08 }), M, [s * 9.0, ny, 4.2], [0, 0, -s * Math.PI / 2]);
    S.navLight([s * 9.14, ny, 4.2], s < 0 ? 0xff2010 : 0x20ff40, 0);
    // RCS
    S.parts(rcsBlock({ size: 0.42, dirs: ['+y', '-y', s > 0 ? '+x' : '-x'] }), M, [nx + s * 1.25, ny + 0.75, 11.2], [0, 0, -s * 0.5]);
  }
  // RCS aux quatre coins de la poutre
  for (const s of [-1, 1]) for (const z of [-7.0, 14.2]) S.parts(rcsBlock({ size: 0.46, dirs: ['+y', s > 0 ? '+x' : '-x', z < 0 ? '-z' : '+z'] }), M, [s * 4.46, 8.26, z], [0, 0, -s * Math.PI / 4]);

  // ---------------------------------------------------------------- antennes, feux, détails cabine
  S.parts(antenna({ type: 'dish', h: 1.1, r: 0.42, tilt: 0.7 }), M, [-1.4, 7.97, -11.2]);
  S.parts(antenna({ type: 'whip', h: 1.6 }), M, [1.6, 7.97, -12.6]);
  S.parts(antenna({ type: 'blade', h: 0.45 }), M, [0.3, 7.99, -13.6]);
  S.parts(antenna({ type: 'mast', h: 1.2 }), M, [3.4, 8.4, 14.0]);
  S.parts(lightPod({ r: 0.09 }), M, [0, 7.98, -10.6]);
  S.navLight([0, 8.17, -10.6], 0xff3018, 0.3);
  S.parts(lightPod({ r: 0.09 }), M, [0, 8.4, 15.0]);
  S.navLight([0, 8.6, 15.0], 0xffffff, 0.9);
  S.parts(lightPod({ r: 0.08 }), M, [0, 1.62, 2.0], [Math.PI, 0, 0]);
  S.navLight([0, 1.42, 2.0], 0xff3018, 0.75);
  // phares d'atterrissage sous le nez
  for (const s of [-1, 1]) {
    S.add(new THREE.CylinderGeometry(0.16, 0.2, 0.14, 16), K.mech, [s * 1.1, 2.06, -15.6]);
    S.add(new THREE.CircleGeometry(0.14, 16), K.lensWhite, [s * 1.1, 1.985, -15.6], [Math.PI / 2, 0, 0], { cast: false });
  }

  // ---------------------------------------------------------------- livrée (décalcomanies conformes)
  for (const s of [1, -1]) {
    const side = s > 0 ? 0 : RX;
    decal(sp.patch({ z0: -7.9, z1: 14.6, angle: side, shift: s * 2.1, height: 0.5, uv: rStripe.uv, readable: true, segZ: 8, segS: 2 }));
    decal(sp.patch({ z0: -6.6, z1: 1.9, angle: side, shift: s * 1.2, height: 0.9, uv: rReg.uv, readable: true, segZ: 6, segS: 2 }));
    decal(sp.patch({ z0: -6.6, z1: 0.4, angle: side, shift: s * 0.45, height: 0.34, uv: rOp.uv, readable: true, segZ: 6, segS: 2 }));
    decal(cab.patch({ z0: -14.9, z1: -10.3, angle: side, shift: s * -0.55, height: 1.5, uv: rCab.uv, readable: true, segZ: 8, segS: 4 }));
  }
  decal(cab.patch({ z0: -12.4, z1: -11.0, angle: RX / 2, height: 0.9, uv: rNo.uv, readable: true, up: [0, 0, -1], segZ: 3, segS: 3 }));
  // chevrons autour de l'ouverture de soute (face arrière plane)
  {
    const g = planeDecal(7.6, 0.36, rChev.uv); g.translate(0, 7.95, 15.53); decal(g);
    for (const s of [-1, 1]) { const v = planeDecal(5.6, 0.3, rChevV.uv); v.rotateZ(Math.PI / 2); v.translate(s * 3.95, 4.95, 15.53); decal(v); }
    const c = planeDecal(3.2, 0.42, rCharge.uv); c.translate(0, 6.9, -9.88); decal(c);
  }
  // cadre de l'ouverture
  S.add(bevelBox(8.1, 0.5, 0.3, 0.08), K.service, [0, 7.93, 15.4]);
  for (const s of [-1, 1]) S.add(bevelBox(0.5, 5.8, 0.3, 0.08), K.service, [s * 3.93, 5.0, 15.4]);

  // ---------------------------------------------------------------- soute : plancher, parois, plafond, éclairage
  const floorM = mats.metal(0x55595b, { rough: 0.65 });
  const wallM = mats.paint(0x6c716f, { kind: 'wide', uv: 3, grime: 0.7, scratch: 0.5, rust: 0.1 });
  S.box(iw * 2, 0.15, 25.5, floorM, [0, fy - 0.07, 2.75], null, { tex: 2 });
  for (const s of [-1, 1]) {
    S.box(0.15, cy - fy, 25.5, wallM, [s * iw, (fy + cy) / 2, 2.75], null, { tex: 3 });
    for (let z = -9; z < 15; z += 2) S.box(0.25, cy - fy, 0.2, K.mech, [s * (iw - 0.1), (fy + cy) / 2, z], null, { cast: false });
    S.box(0.1, 0.06, 23, K.hazard, [s * (iw - 0.2), fy + 1.0, 2.5], null, { cast: false });
  }
  S.box(iw * 2, 0.15, 25.5, wallM, [0, cy, 2.75]);
  for (let z = -8; z < 14; z += 4) S.box(1.2, 0.05, 0.3, mats.emissive(0xfff2dd, 3.5), [0, cy - 0.1, z], null, { cast: false });
  S.box(iw * 2, cy - fy, 0.2, wallM, [0, (fy + cy) / 2, -10]);
  // rampe arrière : tablier, longerons, charnière, vérins
  const rampLen = Math.hypot(fy, 5.2), ang = Math.atan2(fy, 5.2);
  S.box(iw * 2 - 0.2, 0.18, rampLen, mats.metal(0x5a5e60, { rough: 0.5 }), [0, fy / 2 + 0.02, 15.5 + 2.6], [ang, 0, 0], { tex: 2 });
  S.add(new THREE.CylinderGeometry(0.16, 0.16, iw * 2 - 0.3, 16), K.mech, [0, fy - 0.05, 15.5], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) {
    S.box(0.16, 0.3, rampLen, K.hazard, [s * (iw - 0.15), fy / 2 + 0.2, 15.5 + 2.6], [ang, 0, 0], { cast: false });
    S.add(rodBetween(new THREE.Vector3(s * (iw - 0.4), 6.6, 15.3), new THREE.Vector3(s * (iw - 0.4), 1.55, 17.6), 0.11, 12), K.mech);
    S.add(rodBetween(new THREE.Vector3(s * (iw - 0.4), 3.5, 16.7), new THREE.Vector3(s * (iw - 0.4), 1.4, 17.7), 0.06, 10), K.chrome);
  }
  // train d'atterrissage
  const chock = mats.plastic(0xd4a017, 0.6);
  for (const s of [-1, 1]) {
    for (const [x, z, h, br] of [[3.4, -12.0, 1.95, '+z'], [3.8, 10.0, 1.65, '-z']]) {
      S.parts(landingStrut({ h, r: 0.24, pad: 1.5, brace: br }), M, [s * x, 0, z]);
      S.box(0.25, 0.2, 0.3, chock, [s * x + 0.95, 0.1, z]);
      S.box(0.25, 0.2, 0.3, chock, [s * x - 0.95, 0.1, z]);
    }
  }
  S.engines = NZ; // S.engines.setThrust(0..1) : lueur des tuyères (veille par défaut)

  // collisions
  S.cbox(10.4, fy, 31, [0, fy / 2, 0]);
  for (const s of [-1, 1]) S.cbox(0.4, cy - fy, 26, [s * (iw + 0.2), (fy + cy) / 2, 2.5]);
  for (const s of [-1, 1]) S.cbox(1.4, 6.8, 25.5, [s * 4.4, 5.0, 2.75]);
  for (const s of [-1, 1]) S.cbox(3.0, 2.9, 12.5, [s * 7.5, 5.4, 8.4]);
  S.cbox(iw * 2, 0.3, 26, [0, cy + 0.15, 2.5]);
  S.cbox(9.6, 3.0, 18.5, [0, 9.7, 1.6]);
  S.cbox(8.4, 6.6, 7.8, [0, 5.2, -13.4]);
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
  S.add(canopy, glass, [0, 0.55, 1.6], [-0.45, 0, 0], { cast: false });
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
  const fy = 1.55;
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
