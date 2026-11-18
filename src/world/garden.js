import * as THREE from 'three';
import { DECK_Y } from './habitat.js';
import { neonTexture, neonMaterial, Screen, FONT } from './signage.js';

// « Le Grand Dôme » : jardin sous coupole vitrée (56 m de diamètre) au niveau du pont habitat, relié à la Cour des
// Saveurs par une passerelle vitrée. Pelouse vallonnée, colline, bassin (poissons, canards, nénuphars, roseaux),
// chemins, arbres, ferme (grange, enclos, moutons, chèvres, poules), potager, aire de jeux, place aux lampions avec
// glacier et snack, tables de pique-nique. Ciel artificiel qui suit l'horloge de la station.

export const DOME = { x: -40, z: 5, R: 28, H: 22 };
const Y = DECK_Y;
const C = new THREE.Vector3(DOME.x, Y, DOME.z);
/** local (u, v) → monde */
const W = (u, h, v) => new THREE.Vector3(DOME.x + u, Y + h, DOME.z + v);

// ------------------------------------------------------------------ relief
const POND = { u: 6, v: -5 };
const pondR = (a) => 5.2 + 0.8 * Math.sin(3 * a + 0.5) + 0.45 * Math.cos(5 * a);
export function heightAt(u, v) {
  let h = 0;
  const dh = Math.hypot(u + 16, v + 15), rh = 9.5;           // colline au sud-ouest
  if (dh < rh) { const t = 1 - dh / rh; h += 3.4 * t * t * (3 - 2 * t); }
  const d = Math.hypot(u, v);
  // arrivée de la passerelle (u < -17, v ≈ 15) : sol plat au niveau du pont
  const ent = u < -16 ? THREE.MathUtils.clamp(1 - (Math.abs(v - 15) - 2) / 1.6, 0, 1) * THREE.MathUtils.clamp((-16 - u) / 2, 0, 1) : 0;
  if (d > 24.5) h += (d - 24.5) * 0.45 * (1 - ent);             // talus le long de la coupole
  const pu = u - POND.u, pv = v - POND.v, pd = Math.hypot(pu, pv), pr = pondR(Math.atan2(pv, pu));
  if (pd < pr + 0.8) { const t = THREE.MathUtils.clamp((pr + 0.8 - pd) / 1.6, 0, 1); h -= 1.0 * t * t * (3 - 2 * t); }
  h += Math.sin(u * 0.35) * Math.cos(v * 0.3) * 0.12 * (1 - ent);    // légères ondulations
  // terrasses aplanies : place, aire de jeux, grange, potager
  for (const [cu, cv, r0, r1] of FLAT) { const dd = Math.hypot(u - cu, v - cv); if (dd < r1) h *= THREE.MathUtils.smoothstep(dd, r0, r1); }
  return h;
}
export const inPond = (u, v, m = 0) => { const pu = u - POND.u, pv = v - POND.v; return Math.hypot(pu, pv) < pondR(Math.atan2(pv, pu)) + m; };

// ------------------------------------------------------------------ chemins (polylignes locales)
const ring = []; for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; ring.push([Math.cos(a) * 15, Math.sin(a) * 15]); }
export const PATHS = {
  ring,
  entry: [[-25, 15], [-20, 13.2], [-15.5, 10.6], [-12.4, 8.3], [-8.8, 6.6], [-6.2, 5.4]],
  farm: [[14.8, -0.5], [17.5, -0.5]],
  play: [[0, 15], [0.5, 16.5], [1.2, 17.6]],
  hill: [[-10.6, -10.6], [-13, -13], [-15.5, -15]],
  veg: [[0, -15], [2.5, -17.5], [5, -19]],
};
const PLAZA = { u: -3, v: 4, r: 5.4 };
const FARM = { u0: 16.5, u1: 25, v0: -7.5, v1: 6.5 };
const PLAY = { u: 2, v: 21 };
const FLAT = [[-3, 4, 5.8, 7.5], [2, 21, 6.6, 8.4], [21.5, 3.2, 3.6, 5.5], [6.5, -21, 6.2, 8]];
const VEG = { u0: 1, u1: 12, v0: -24, v1: -18 };
const PEN = { u: -13.5, v: 17.5, w: 4.6, d: 3.4, hutch: { u: -15.1, v: 18.4 } };

function grassBlades(mats) {
  // touffes d'herbe haute et fleurs sauvages : cartes texturées (canvas, transparence)
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 90; i++) {
    const x = 20 + Math.random() * 216, hgt = 120 + Math.random() * 120, lean = (Math.random() - 0.5) * 60;
    g.strokeStyle = `hsl(${85 + Math.random() * 30}, ${45 + Math.random() * 25}%, ${22 + Math.random() * 22}%)`; g.lineWidth = 2 + Math.random() * 3;
    g.beginPath(); g.moveTo(x, 256); g.quadraticCurveTo(x + lean * 0.3, 256 - hgt * 0.6, x + lean, 256 - hgt); g.stroke();
  }
  for (let i = 0; i < 9; i++) { const x = 30 + Math.random() * 196, y = 70 + Math.random() * 80; g.fillStyle = ['#f4f0e0', '#ffd23a', '#d86aa8', '#9a7aff'][i % 4]; for (let p = 0; p < 6; p++) { g.beginPath(); g.arc(x + Math.cos(p) * 5, y + Math.sin(p) * 5, 4, 0, 7); g.fill(); } g.fillStyle = '#e8a020'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
}
function leafCards() {
  // feuillage : grappes de feuilles sur fond transparent
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 110, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
    g.save(); g.translate(x, y); g.rotate(Math.random() * 6.28);
    g.fillStyle = `hsl(${95 + Math.random() * 35}, ${40 + Math.random() * 25}%, ${20 + Math.random() * 25}%)`;
    g.beginPath(); g.ellipse(0, 0, 9 + Math.random() * 6, 4 + Math.random() * 3, 0, 0, 7); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
}

export function buildGarden(ctx) {
  const { mats, scene, builder: B } = ctx;
  const low = ctx.quality.name === 'low';
  const MD = ctx.models;
  const add = (geo, mat, m, o = {}) => B.add(geo, mat, m, { cast: o.cast ?? false, collide: o.collide ?? false });
  const M4 = (p, ry = 0, s = [1, 1, 1], rx = 0, rz = 0) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(...s));
  const box = (w, h, d, m, p, ry = 0, col = false) => add(new THREE.BoxGeometry(w, h, d), m, M4(p, ry), { collide: col });
  const cyl = (r1, r2, h, m, p, seg = 12, col = false, rot = [0, 0, 0]) => add(new THREE.CylinderGeometry(r1, r2, h, seg), m, M4(p, rot[1], [1, 1, 1], rot[0], rot[2]), { collide: col });
  const ph = (id, u, v, o = {}) => MD?.place(B, id, ...W(u, heightAt(u, v) + (o.dy || 0), v).toArray(), o);
  const P = (id, rough = 1) => mats.ph(id, 0xffffff, { rough, metal: 0, grime: 0, scratch: 0, floor: 0 });
  const out = { lights: [], seats: [], tables: [], benches: [], people: {}, dyn: [] };

  // ---------------------------------------------------------------- matériaux
  const grass = P('lawn'), dirt = P('park_dirt'), sand = P('coast_sand_01'), bark = P('bark_brown_02'), soil = P('raked_dirt');
  const planks = P('weathered_planks'), roof = P('roof_planks'), pebbles = P('river_small_rocks');
  const steel = mats.smooth(0xc8ccd0, 0.3, 0.9, { grime: 0.1, rust: 0 });
  const paint = (c) => mats.plastic(c, 0.45);
  const glow = (c, i = 2.6) => mats.emissive(c, i);

  // ---------------------------------------------------------------- sol : pelouse vallonnée (grille déformée en disque)
  {
    const R = DOME.R - 0.15, N = low ? 72 : 110;
    const g = new THREE.PlaneGeometry(2 * R, 2 * R, N, N); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      let u = p.getX(i), v = p.getZ(i); const d = Math.hypot(u, v);
      if (d > R) { u *= R / d; v *= R / d; }
      p.setXYZ(i, u, heightAt(u, v), v); uv.setXY(i, u / 3, v / 3);
    }
    g.computeVertexNormals();
    add(g, grass, M4(C.clone()), { collide: true });
    // dalle porteuse (sous-face visible de l'extérieur)
    cyl(DOME.R + 0.4, DOME.R - 1.5, 1.2, mats.paint(0x4a4e54, { grime: 0.5 }), W(0, -1.75, 0), 64);
    // jupe de terre : ferme le bord du terrain jusqu'à la dalle (vu de l'extérieur, à travers le vitrage)
    {
      const pos = [], idx = [], n = 128;
      for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2, u = Math.cos(a) * R, v = Math.sin(a) * R; pos.push(u, heightAt(u, v), v, u, -1.15, v); if (k) { const i = (k - 1) * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); } }
      const sk = new THREE.BufferGeometry(); sk.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sk.setIndex(idx); sk.computeVertexNormals();
      const skM = mats.ph('raked_dirt', 0x8a7a64, { rough: 1, metal: 0, grime: 0, scratch: 0, floor: 0 }); skM.side = THREE.DoubleSide;
      add(sk, skM, M4(C.clone()));
    }
  }
  // fond du bassin (galets) et collision d'eau (on ne marche pas dans le bassin)
  {
    const sh = new THREE.Shape(); for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2, r = pondR(a) + 0.3; const x = POND.u + Math.cos(a) * r, y = -(POND.v + Math.sin(a) * r); k ? sh.lineTo(x, y) : sh.moveTo(x, y); }
    const bed = new THREE.ShapeGeometry(sh, 24); bed.rotateX(-Math.PI / 2);
    const uv = bed.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    add(bed, pebbles, M4(C.clone().setY(Y - 0.97)));
    for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2, r = pondR(a) - 0.2; B.colliderBox(1.4, 1.6, 0.4, W(POND.u + Math.cos(a) * r, 0.3, POND.v + Math.sin(a) * r).toArray(), [0, -a + Math.PI / 2, 0]); }
    out.pondBed = bed;
    // eau : surface animée (légère houle, reflets du ciel)
    const ws = new THREE.ShapeGeometry(sh, 32); ws.rotateX(-Math.PI / 2);
    // eau : ondulations animées, reflet du ciel du dôme (Fresnel), éclats du soleil, fond visible par transparence
    const waterM = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uT: { value: 0 }, uDay: { value: 1 }, uCam: { value: new THREE.Vector3() } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uT, uDay; uniform vec3 uCam; varying vec3 vW;
        void main(){
          vec2 p = vW.xz;
          vec2 g = vec2(sin(p.x * 3.1 + uT * 1.3) + sin(p.y * 2.3 - uT * 1.1) * 0.6 + sin((p.x + p.y) * 5.7 + uT * 2.2) * 0.35,
                        cos(p.y * 3.4 + uT * 1.2) + cos(p.x * 2.6 + uT * 0.9) * 0.6 + cos((p.x - p.y) * 6.1 - uT * 2.0) * 0.35);
          vec3 n = normalize(vec3(g.x * 0.045, 1.0, g.y * 0.045));
          vec3 v = normalize(uCam - vW);
          float fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
          vec3 sky = mix(vec3(0.04, 0.06, 0.12), mix(vec3(0.95, 0.55, 0.35), vec3(0.55, 0.75, 0.95), smoothstep(0.5, 1.0, uDay)), smoothstep(0.0, 0.5, uDay));
          vec3 deep = mix(vec3(0.02, 0.05, 0.08), vec3(0.08, 0.28, 0.27), uDay);
          vec3 col = mix(deep, sky, fr);
          vec3 h = normalize(v + vec3(0.0, 1.0, 0.0));
          col += pow(max(dot(n, h), 0.0), 220.0) * 1.8 * uDay;
          gl_FragColor = vec4(col, mix(0.55, 0.92, fr));
        }`,
    });
    const water = new THREE.Mesh(ws, waterM); out.waterM = waterM;
    water.position.copy(C).setY(Y - 0.28); water.renderOrder = 2; scene.add(water);
    out.water = water;
    // nénuphars et roseaux
    const lily = mats.plastic(0x3a7a2a, 0.6), lilyF = mats.plastic(0xf2c8d8, 0.5), reed = mats.plastic(0x5a7a3a, 0.8);
    for (let k = 0; k < 14; k++) {
      const a = k * 2.4, r = pondR(a) * (0.35 + (k % 4) * 0.15), u = POND.u + Math.cos(a) * r, v = POND.v + Math.sin(a) * r;
      const g = new THREE.CylinderGeometry(0.32, 0.32, 0.01, 18, 1, false, 0.3, Math.PI * 1.85);
      add(g, lily, M4(W(u, -0.27, v), k));
      if (k % 3 === 0) { add(new THREE.SphereGeometry(0.09, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lilyF, M4(W(u + 0.1, -0.26, v))); }
    }
    for (let k = 0; k < (low ? 10 : 22); k++) {
      const a = k * 0.29 + 3.6; if (Math.sin(a * 2) < -0.2) continue;
      const r = pondR(a) - 0.15, u = POND.u + Math.cos(a) * r, v = POND.v + Math.sin(a) * r;
      for (let j = 0; j < 5; j++) add(new THREE.CylinderGeometry(0.008, 0.015, 1.1 + Math.random() * 0.6, 4), reed, M4(W(u + (Math.random() - 0.5) * 0.3, -0.1, v + (Math.random() - 0.5) * 0.3), 0, [1, 1, 1], (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2));
    }
    // rochers moussus et galets autour du bassin
    for (const [a, id, s] of [[0.6, 'rock_moss_set_02', 2.2], [2.3, 'namaqualand_boulders_01', 1.6], [3.4, 'namaqualand_boulders_01', 1.3], [4.6, 'rock_moss_set_02', 1.8], [5.6, 'namaqualand_boulders_01', 1.5]]) {
      const r = pondR(a) + 0.7, u = POND.u + Math.cos(a) * r, v = POND.v + Math.sin(a) * r;
      ph(id, u, v, { fit: ['max', s], ry: a * 2, dy: -0.35 });
    }
  }
  // ---------------------------------------------------------------- chemins de terre battue
  const ribbon = (pts, w, closed = false) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([u, v]) => new THREE.Vector3(u, 0, v)), closed, 'centripetal');
    const n = Math.max(8, Math.round(curve.getLength() * 1.5)), pos = [], uv = [], idx = [];
    let L = 0, prev = null;
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n), nx = -t.z, nz = t.x;
      if (prev) L += p.distanceTo(prev); prev = p;
      for (const s of [-1, 1]) { const u = p.x + nx * s * w / 2, v = p.z + nz * s * w / 2; pos.push(u, heightAt(u, v) + 0.035, v); uv.push(s * w / 4 + 0.5, L / 2); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    // faces vers le haut (sinon éliminées par le rendu des faces arrière)
    if (g.attributes.normal.getY(0) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
    add(g, dirt, M4(C.clone()));
  };
  ribbon(PATHS.ring.slice(0, -1), 2.2, true);
  for (const k of ['entry', 'farm', 'play', 'hill', 'veg']) ribbon(PATHS[k], 1.8);
  // bordures de pierre le long du grand cercle
  for (let k = 0; k < 96; k++) { const a = (k / 96) * Math.PI * 2; for (const r of [13.9, 16.1]) { const u = Math.cos(a) * r, v = Math.sin(a) * r; add(new THREE.BoxGeometry(0.18, 0.08, 0.95), mats.paint(0x8a8478, { grime: 0.4 }), M4(W(u, heightAt(u, v) + 0.03, v), -a)); } }

  // ---------------------------------------------------------------- arbres (tronc écorce + couronne de feuillage en cartes)
  const leaves = leafCards();
  const trunkG = (h, r) => { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(r * (1.35 - t * 0.65) * (1 + (i === 0 ? 0.35 : 0)), t * h)); } return new THREE.LatheGeometry(pts, 9); };
  const tree = (u, v, s = 1, kind = 0) => {
    const h0 = heightAt(u, v), H = (4.2 + kind * 1.2) * s, r = 0.22 * s;
    const tg = trunkG(H * 0.7, r); const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * H * 0.5);
    add(tg, bark, M4(W(u, h0 - 0.05, v), u * 3), { cast: !low });
    // branches maîtresses
    for (let b = 0; b < 4; b++) { const a = b * 1.57 + u; add(new THREE.CylinderGeometry(r * 0.25, r * 0.45, H * 0.35, 6), bark, M4(W(u + Math.cos(a) * H * 0.08, h0 + H * 0.62, v + Math.sin(a) * H * 0.08), a, [1, 1, 1], 0.7, 0)); }
    // couronne : grappes de cartes croisées
    const cr = (1.6 + kind * 0.4) * s, cy = h0 + H * 0.78, nC = low ? 7 : 12;
    for (let k = 0; k < nC; k++) {
      const a = k * 2.399, rr = cr * Math.sqrt((k + 0.5) / nC), y = cy + Math.sin(k * 1.7) * cr * 0.45;
      const p = W(u + Math.cos(a) * rr * 0.8, 0, v + Math.sin(a) * rr * 0.8).setY(Y + y);
      const sz = cr * (1.0 + (k % 3) * 0.15);
      for (const ry of [0, Math.PI / 2]) add(new THREE.PlaneGeometry(sz * 1.6, sz * 1.3), leaves, M4(p, a + ry, [1, 1, 1], (k % 2 ? 0.3 : -0.25)));
      add(new THREE.PlaneGeometry(sz * 1.5, sz * 1.5), leaves, M4(p.clone().setY(Y + y + 0.2), a, [1, 1, 1], -Math.PI / 2));
    }
    B.colliderBox(r * 2.4, 2.4, r * 2.4, W(u, h0 + 1.2, v).toArray());
  };
  const TREES = [[-19, -6, 1.1, 1], [-22, -14, 1, 0], [-9, -21, 1.2, 1], [-18, 21, 1, 0], [-9, 22.5, 1.1, 1], [-24, 4, 0.9, 0], [11, 21.5, 1, 1],
    [21, -14, 1.1, 1], [12, -16, 0.9, 0], [-5, -9, 0.8, 0], [10, 4, 0.8, 0], [-11, 2, 0.7, 0], [24, 12, 0.9, 0], [-1, 13, 0.75, 1], [-26, -6, 0.8, 0], [16, -21, 0.9, 1]];
  for (const [u, v, s, k] of (low ? TREES.slice(0, 11) : TREES)) tree(u, v, s, k);
  // touffes d'herbe haute, buissons, fleurs, fougères (modèles photoscannés) le long des chemins
  const blades = grassBlades(mats);
  const tuft = (u, v, s) => { const h0 = heightAt(u, v); for (const ry of [0, 1.05, 2.1]) add(new THREE.PlaneGeometry(0.9 * s, 0.7 * s), blades, M4(W(u, h0 + 0.33 * s, v), ry)); };
  let rs = 7; const rnd = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
  const free = (u, v) => Math.hypot(u, v) < 26 && !inPond(u, v, 1.2) && Math.abs(Math.hypot(u, v) - 15) > 1.6 && Math.hypot(u - PLAZA.u, v - PLAZA.v) > PLAZA.r + 1 &&
    !(u > FARM.u0 - 1 && u < FARM.u1 + 1 && v > FARM.v0 - 1 && v < FARM.v1 + 1) && Math.hypot(u - PLAY.u, v - PLAY.v) > 7.5 && !(u > VEG.u0 - 1 && u < VEG.u1 + 1 && v > VEG.v0 - 1 && v < VEG.v1 + 1) &&
    Math.hypot(u + 18, v - 13) > 3 && !(Math.abs(u - PEN.u) < PEN.w / 2 + 1.2 && Math.abs(v - PEN.v) < PEN.d / 2 + 1.2);
  for (let k = 0; k < (low ? 70 : 160); k++) { const u = (rnd() - 0.5) * 52, v = (rnd() - 0.5) * 52; if (free(u, v)) tuft(u, v, 0.8 + rnd() * 0.6); }
  const plants = ['fern_02', 'shrub_02', 'shrub_04', 'flower_gazania', 'flower_empodium', 'flower_ursinia', 'wild_rooibos_bush'];
  for (let k = 0, n = 0; k < 400 && n < (low ? 22 : 48); k++) {
    const a = rnd() * Math.PI * 2, r = [12.5, 17.5, 19, 22.5][k % 4] + rnd() * 1.5, u = Math.cos(a) * r, v = Math.sin(a) * r;
    if (!free(u, v)) continue;
    const id = plants[n % plants.length];
    ph(id, u, v, { fit: ['max', id.startsWith('flower') ? 0.7 : id === 'shrub_02' ? 2.2 : 1.3], ry: rnd() * 6 }); n++;
  }
  ph('tree_stump_01', -20, 8, { fit: ['max', 1.3], ry: 1 }); ph('garden_gnome', -19.2, 8.6, { fit: ['y', 0.55], dy: 0.32, ry: 2.2 });

  // ---------------------------------------------------------------- place aux lampions : terrasse, tables, glacier, snack
  {
    const pl = new THREE.CircleGeometry(PLAZA.r, 48); pl.rotateX(-Math.PI / 2);
    const uv = pl.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3.5, uv.getY(i) * 3.5);
    add(pl, planks, M4(W(PLAZA.u, heightAt(PLAZA.u, PLAZA.v) + 0.07, PLAZA.v)), { collide: true });
    add(new THREE.TorusGeometry(PLAZA.r, 0.07, 6, 64), planks, M4(W(PLAZA.u, heightAt(PLAZA.u, PLAZA.v) + 0.07, PLAZA.v), 0, [1, 1, 1], Math.PI / 2));
    const h0 = heightAt(PLAZA.u, PLAZA.v) + 0.08;
    // tables de pique-nique (bancs intégrés) et places assises
    for (const [du, dv, ry] of [[-2.4, -1.6, 0.3], [2.3, -1.9, -0.4], [-2.6, 2.4, -0.2], [1.6, 2.7, 0.5]]) {
      const u = PLAZA.u + du, v = PLAZA.v + dv;
      ph('wooden_picnic_table', u, v, { fit: ['x', 1.9], ry, dy: 0.08, cast: !low });
      B.colliderBox(1.9, 0.8, 1.2, W(u, h0 + 0.4, v).toArray(), [0, ry, 0]);
      for (const s of [-1, 1]) for (const o of [-0.45, 0.45]) {
        const fw = new THREE.Vector3(Math.sin(ry + (s > 0 ? Math.PI : 0)), 0, Math.cos(ry + (s > 0 ? Math.PI : 0)));
        const side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
        const p = W(u, h0 - 0.02, v).addScaledVector(fw, -0.62).addScaledVector(side, o);
        out.seats.push({ p, yaw: Math.atan2(fw.x, fw.z), taken: null, table: W(u, h0, v) });
      }
      out.tables.push(W(u, h0, v));
    }
    // mâts et guirlandes de lampions en papier (couleurs chaudes)
    const mast = W(PLAZA.u, h0 + 4.4, PLAZA.v), poles = [];
    cyl(0.07, 0.09, 4.6, mats.paint(0x3a2a1c, { plain: true }), W(PLAZA.u, h0 + 2.3, PLAZA.v), 8);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; const p = W(PLAZA.u + Math.cos(a) * (PLAZA.r + 0.4), h0, PLAZA.v + Math.sin(a) * (PLAZA.r + 0.4)); cyl(0.05, 0.07, 3.3, mats.paint(0x3a2a1c, { plain: true }), p.clone().setY(Y + h0 + 1.65), 8); poles.push(p.clone().setY(Y + h0 + 3.25)); }
    const cols = [0xff6a3a, 0xffc04a, 0xff4a6a, 0xffe08a, 0xff8a2a, 0x8adcff];
    const lamp = cols.map((c) => glow(c, 2.4));
    let li = 0;
    const string = (a, b, sag) => {
      B.cable(a.toArray(), b.toArray(), sag, 0.008, mats.paint(0x1a1a1a, { plain: true }));
      for (let t = 0.08; t < 0.95; t += 0.14) {
        const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t) + 0.13;
        const L = lamp[li++ % lamp.length];
        add(li % 3 ? new THREE.SphereGeometry(0.13, 12, 8) : new THREE.CylinderGeometry(0.11, 0.11, 0.24, 12), L, M4(p, 0, li % 3 ? [1, 1.15, 1] : [1, 1, 1]));
      }
    };
    for (let k = 0; k < 6; k++) { string(mast, poles[k], 0.45); string(poles[k], poles[(k + 1) % 6], 0.35); }
    out.lights.push({ pos: W(PLAZA.u, h0 + 3, PLAZA.v), color: 0xffb070, i: 26, d: 14, night: 1 });
    // glacier : chariot à parasol rayé, bacs de glaces colorées sous vitre, cornets
    {
      const u = PLAZA.u - 5.6, v = PLAZA.v - 3.8, hh = heightAt(u, v) + 0.05, ry = 0.9;
      const G = new THREE.Group(); G.position.copy(W(u, hh, v)); G.rotation.y = ry; scene.add(G); out.dyn.push(G);
      const mk = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = !low; G.add(o); return o; };
      const pastel = new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: 0.35, clearcoat: 0.8 }), pink = new THREE.MeshPhysicalMaterial({ color: 0xff9ec8, roughness: 0.35, clearcoat: 0.8 });
      mk(new THREE.BoxGeometry(1.6, 0.85, 0.8), pastel, 0, 0.6, 0);
      mk(new THREE.BoxGeometry(1.64, 0.12, 0.84), pink, 0, 1.06, 0);
      for (const s of [-1, 1]) { const w = mk(new THREE.TorusGeometry(0.22, 0.05, 8, 20), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }), s * 0.62, 0.22, 0.42); w.rotation.y = 0; }
      const glassM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.25, clearcoat: 1 });
      mk(new THREE.BoxGeometry(1.3, 0.3, 0.6), glassM, 0, 1.27, 0);
      const flav = [0xfff2d8, 0x5a3020, 0xffa0b8, 0x9ae07a, 0xffd23a, 0xb08aff];
      flav.forEach((c, i) => { mk(new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }), -0.5 + i * 0.2, 1.13, -0.05); });
      for (let k = 0; k < 6; k++) mk(new THREE.ConeGeometry(0.035, 0.13, 10), new THREE.MeshStandardMaterial({ color: 0xd8a050, roughness: 0.8 }), 0.66, 1.2 + k * 0.02, 0.2).rotation.x = Math.PI;
      mk(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), steel, -0.2, 1.9, 0.1);
      for (let k = 0; k < 8; k++) { const seg = mk(new THREE.ConeGeometry(1.2, 0.5, 3, 1, true, (k / 8) * Math.PI * 2, Math.PI / 4), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xffffff : 0xff6a8a, side: THREE.DoubleSide, roughness: 0.7 }), -0.2, 2.75, 0.1); seg.rotation.y = 0; }
      const nt = neonTexture('GLACES', '#ff9ec8', { size: 70 });
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9 / nt.aspect), neonMaterial(nt.tex, 1.6)); sg.position.set(0, 0.7, 0.41); G.add(sg);
      B.colliderBox(1.7, 1.2, 0.9, W(u, hh + 0.6, v).toArray(), [0, ry, 0]);
      const fw = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      out.glacier = { vendor: W(u, hh, v).addScaledVector(fw, -0.75), vendorYaw: ry, customer: W(u, hh, v).addScaledVector(fw, 1.0), yaw: ry + Math.PI };
    }
    // snack : kiosque en planches, auvent rayé, comptoir, tableau du menu
    {
      const u = PLAZA.u + 6.2, v = PLAZA.v + 3.6, hh = heightAt(u, v), ry = -2.3;
      const base = M4(W(u, hh, v), ry), at = (x, y, z, sx, sy, sz, m, rx = 0) => add(new THREE.BoxGeometry(sx, sy, sz), m, base.clone().multiply(M4(new THREE.Vector3(x, y, z), 0, [1, 1, 1], rx)), { collide: true });
      at(0, 1.1, -1.1, 3.0, 2.2, 0.12, planks); at(-1.45, 1.1, 0, 0.12, 2.2, 2.2, planks); at(1.45, 1.1, 0, 0.12, 2.2, 2.2, planks);
      at(0, 0.5, 0.95, 3.0, 1.0, 0.25, planks); at(0, 1.03, 1.0, 3.1, 0.06, 0.45, mats.paint(0x6a4a32, { plain: true }));
      at(0, 2.35, 0, 3.4, 0.12, 2.8, roof, -0.12);
      for (let k = 0; k < 9; k++) add(new THREE.BoxGeometry(0.34, 0.03, 0.9), k % 2 ? paint(0xfff4e8) : paint(0x2a8a5a), base.clone().multiply(M4(new THREE.Vector3(-1.36 + k * 0.34, 2.12, 1.45), 0, [1, 1, 1], 0.45)));
      const menu = new Screen(256, 160, (c, w, h) => {
        c.fillStyle = '#1c2420'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd27a'; c.font = `700 22px ${FONT}`; c.fillText('LE SNACK DU DÔME', 12, 28);
        c.fillStyle = '#f2f2ea'; c.font = `500 15px ${FONT}`; [['Crêpe sucre-citron', 5], ['Hot-dog', 7], ['Gaufre', 5], ['Limonade de Lys', 3]].forEach(([n, p], i) => { c.fillText(n, 12, 60 + i * 24); c.fillText(`${p} ¤`, 200, 60 + i * 24); });
      }, { period: 1e9, intensity: 1.1 });
      ctx.screens.push(menu);
      const mm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), menu.material);
      mm.position.copy(W(u, hh, v)).add(new THREE.Vector3(0, 1.75, -1.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry)); mm.rotation.y = ry; scene.add(mm);
      const fw = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      out.snack = { vendor: W(u, hh, v).addScaledVector(fw, 0.1), vendorYaw: ry, customer: W(u, hh, v).addScaledVector(fw, 1.8), yaw: ry + Math.PI };
      ph('barrel_03', u + 1.9, v + 0.6, { fit: ['y', 0.9] }); ph('wooden_crate_02', u - 2.0, v - 1.0, { fit: ['x', 0.9], ry: 0.4 });
    }
  }

  // ---------------------------------------------------------------- aire de jeux (sable, toboggan, balançoires, tourniquet, bascule, dôme d'escalade)
  {
    const { u, v } = PLAY, h0 = heightAt(u, v);
    const sb = new THREE.CircleGeometry(6, 48); sb.rotateX(-Math.PI / 2); const uv = sb.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 4);
    add(sb, sand, M4(W(u, h0 + 0.05, v), 0, [1, 1, 0.72]));
    add(new THREE.TorusGeometry(6, 0.12, 6, 64), mats.plastic(0xd85a3a, 0.5), M4(W(u, h0 + 0.08, v), 0, [1, 0.72, 1], Math.PI / 2));
    const red = paint(0xe84a3a), blue = paint(0x3a7ae8), yel = paint(0xf2c23a), grn = paint(0x4ab85a);
    // toboggan : échelle, plateforme, toit, glissière incurvée
    const S0 = W(u - 3.5, h0, v - 1.5);
    for (const [dx, dz] of [[0, 0], [1.2, 0], [0, 1.2], [1.2, 1.2]]) cyl(0.06, 0.06, 2.6, blue, S0.clone().add(new THREE.Vector3(dx, 1.3, dz)), 8, true);
    box(1.35, 0.1, 1.35, yel, S0.clone().add(new THREE.Vector3(0.6, 1.5, 0.6)));
    add(new THREE.ConeGeometry(1.05, 0.7, 4), red, M4(S0.clone().add(new THREE.Vector3(0.6, 2.95, 0.6)), Math.PI / 4));
    for (let k = 0; k < 6; k++) box(0.75, 0.04, 0.06, blue, S0.clone().add(new THREE.Vector3(0.6, 0.25 * k + 0.2, -0.3)));
    const slideC = new THREE.CatmullRomCurve3([[0.6, 1.55, 1.3], [0.6, 1.2, 2.2], [0.6, 0.6, 3.1], [0.6, 0.3, 3.7]].map(([x, y, z]) => S0.clone().add(new THREE.Vector3(x, y, z))));
    {
      // glissière en U (fond + rebords) balayée le long de la courbe
      const N = 28, prof = [[-0.3, 0.16], [-0.3, 0.02], [-0.22, 0], [0.22, 0], [0.3, 0.02], [0.3, 0.16]], pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const p = slideC.getPointAt(i / N), t = slideC.getTangentAt(i / N), side = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3().crossVectors(t, side).normalize().multiplyScalar(-1);
        if (up.y < 0) up.negate();
        for (const [x, y] of prof) pos.push(p.x + side.x * x + up.x * y, p.y + side.y * x + up.y * y - 0.02, p.z + side.z * x + up.z * y);
        if (i) for (let k = 0; k < prof.length - 1; k++) { const a = (i - 1) * prof.length + k, b = i * prof.length + k; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals();
      add(sg, mats.plastic(0xe84a3a, 0.35), new THREE.Matrix4());
      for (const t of [0.35, 0.7]) { const p = slideC.getPointAt(t); cyl(0.05, 0.05, p.y - S0.y, blue, new THREE.Vector3(p.x, (p.y + S0.y) / 2, p.z), 8); }
    }
    out.slide = { ladder: S0.clone().add(new THREE.Vector3(0.6, 0, -0.55)), top: S0.clone().add(new THREE.Vector3(0.6, 1.55, 0.6)), curve: slideC, end: S0.clone().add(new THREE.Vector3(0.6, 0, 4.3)) };
    B.colliderBox(1.5, 3, 1.5, S0.clone().add(new THREE.Vector3(0.6, 1.5, 0.6)).toArray());
    // balançoires (sièges animés)
    const SW = W(u + 2.5, h0, v - 3.2);
    for (const s of [-1, 1]) { cyl(0.06, 0.06, 2.6, steel, SW.clone().add(new THREE.Vector3(s * 1.6, 1.25, 0.5)), 8, true, [-0.2, 0, 0]); cyl(0.06, 0.06, 2.6, steel, SW.clone().add(new THREE.Vector3(s * 1.6, 1.25, -0.5)), 8, true, [0.2, 0, 0]); }
    cyl(0.06, 0.06, 3.3, steel, SW.clone().add(new THREE.Vector3(0, 2.45, 0)), 8, false, [0, 0, Math.PI / 2]);
    out.swings = [-0.7, 0.7].map((dx) => {
      const g = new THREE.Group(); g.position.copy(SW).add(new THREE.Vector3(dx, 2.45, 0)); scene.add(g); out.dyn.push(g);
      for (const s of [-1, 1]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.95, 4), new THREE.MeshStandardMaterial({ color: 0x8a8e92, metalness: 0.8, roughness: 0.3 })); ch.position.set(s * 0.22, -0.97, 0); g.add(ch); }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.25), new THREE.MeshStandardMaterial({ color: 0xe84a3a, roughness: 0.5 })); seat.position.y = -1.95; g.add(seat);
      return { g, ph: Math.random() * 6, amp: 0.15, busy: null, base: SW.clone().add(new THREE.Vector3(dx, 0, 0)) };
    });
    // tourniquet
    const MR = W(u + 3.6, h0, v + 2.4);
    const mr = new THREE.Group(); mr.position.copy(MR); scene.add(mr); out.dyn.push(mr);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.12, 32), new THREE.MeshStandardMaterial({ color: 0xf2c23a, roughness: 0.5 })); disc.position.y = 0.25; mr.add(disc);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; const bar = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xe84a3a : 0x3a7ae8, roughness: 0.4 })); bar.position.set(Math.cos(a) * 0.9, 0.35, Math.sin(a) * 0.9); bar.rotation.y = -a; mr.add(bar); }
    out.merry = { g: mr, c: MR, ang: 0, speed: 0.6, riders: [] };
    B.colliderBox(2.6, 0.5, 2.6, MR.clone().setY(MR.y + 0.25).toArray());
    // bascule
    const SS = W(u - 1.2, h0, v + 4.2);
    cyl(0.12, 0.18, 0.5, blue, SS.clone().setY(SS.y + 0.25), 10, true);
    const ss = new THREE.Group(); ss.position.copy(SS).setY(SS.y + 0.5); scene.add(ss); out.dyn.push(ss);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x4ab85a, roughness: 0.5 })); ss.add(plank);
    for (const s of [-1, 1]) { const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe84a3a })); hnd.position.set(s * 1.25, 0.12, 0); hnd.rotation.y = Math.PI / 2; ss.add(hnd); }
    out.seesaw = { g: ss, c: SS, busy: [null, null] };
    // dôme d'escalade géodésique (tubes colorés)
    const DG = W(u + 0.5, h0, v + 0.8);
    const ico = new THREE.IcosahedronGeometry(1.5, 1), pos = ico.attributes.position, seen = new Set();
    for (let i = 0; i < pos.count; i += 3) for (let e = 0; e < 3; e++) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i + e), b = new THREE.Vector3().fromBufferAttribute(pos, i + (e + 1) % 3);
      if (a.y < -0.05 || b.y < -0.05) continue;
      const key = [a, b].map((p) => p.toArray().map((x) => x.toFixed(2)).join()).sort().join('|'); if (seen.has(key)) continue; seen.add(key);
      const mid = a.clone().add(b).multiplyScalar(0.5), dir = b.clone().sub(a), len = dir.length();
      add(new THREE.CylinderGeometry(0.035, 0.035, len, 6), [red, blue, yel, grn][seen.size % 4], new THREE.Matrix4().compose(DG.clone().add(mid), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()), new THREE.Vector3(1, 1, 1)));
    }
    B.colliderBox(3, 1.6, 3, DG.clone().setY(DG.y + 0.8).toArray());
    out.playZone = { u, v, r: 6 };
    // obstacles de l'aire de jeux (points de course des enfants)
    const obs = [[S0.x + 0.6, S0.z + 0.6, 1.2], [S0.x + 0.6, S0.z + 2.4, 1.6], [SW.x, SW.z, 2.2], [MR.x, MR.z, 1.8], [SS.x, SS.z, 1.8], [DG.x, DG.z, 1.9]];
    out.blockedPlay = (uu, vv) => obs.some(([x, z, r]) => Math.hypot(uu + DOME.x - x, vv + DOME.z - z) < r);
    ph('rubber_duck_toy', u - 0.8, v - 2.6, { fit: ['y', 0.25], ry: 1.2, dy: 0.05 });
    // bancs des parents autour de l'aire
    for (const [du, dv] of [[-6.8, 1.2], [-6.0, -3.2], [7.0, -0.6], [6.4, -3.6]]) {
      const bu = u + du, bv = v + dv, ry = Math.atan2(-du, -dv); ph('painted_wooden_bench', bu, bv, { fit: ['x', 1.6], ry, dy: 0.03 });
      const fw = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), sd = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
      for (const o of [-0.4, 0.4]) out.benches.push({ p: W(bu, heightAt(bu, bv) + 0.02, bv).addScaledVector(fw, 0.08).addScaledVector(sd, o), yaw: ry, taken: null });
    }
    out.lights.push({ pos: W(u, h0 + 6, v), color: 0xfff2dc, i: 22, d: 16 });
  }

  // ---------------------------------------------------------------- ferme : grange, enclos, abreuvoir, foin ; potager et épouvantail
  {
    const { u0, u1, v0, v1 } = FARM, fh = (u, v) => heightAt(u, v);
    const post = mats.paint(0x6a4a32, { plain: true, rough: 0.8 });
    const fence = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 2), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let k = 0; k <= n; k++) { const t = k / n, u = a[0] + (b[0] - a[0]) * t, v = a[1] + (b[1] - a[1]) * t; box(0.12, 1.1, 0.12, post, W(u, fh(u, v) + 0.55, v)); }
      for (const y of [0.45, 0.85]) { const mu = (a[0] + b[0]) / 2, mv = (a[1] + b[1]) / 2; box(L, 0.08, 0.05, planks, W(mu, fh(mu, mv) + y, mv), -ang); }
      const mu = (a[0] + b[0]) / 2, mv = (a[1] + b[1]) / 2; B.colliderBox(L, 1.4, 0.3, W(mu, fh(mu, mv) + 0.7, mv).toArray(), [0, -ang, 0]);
    };
    fence([u0, v0], [u1, v0]); fence([u1, v0], [u1, v1]); fence([u1, v1], [u0, v1]); fence([u0, v1], [u0, 1]); fence([u0, -1.8], [u0, v0]);
    // portail
    box(0.12, 1.3, 0.12, post, W(u0, fh(u0, 1) + 0.65, 1)); box(0.12, 1.3, 0.12, post, W(u0, fh(u0, -1.8) + 0.65, -1.8));
    for (const y of [0.4, 0.8]) box(0.05, 0.08, 2.6, planks, W(u0 - 0.6, fh(u0, 0) + y, -0.4), 0.45);
    B.colliderBox(0.3, 1.4, 2.8, W(u0, fh(u0, 0) + 0.7, -0.4).toArray());
    // grange (planches rouges, toit à deux pans, porte ouverte)
    const bu = 22, bv = 3.2, bh = fh(bu, bv), red = mats.ph('weathered_planks', 0xc8503a, { rough: 1, metal: 0, grime: 0.2, scratch: 0, floor: 0 });
    box(4.4, 2.8, 0.15, red, W(bu, bh + 1.4, bv + 2), 0, true); box(0.15, 2.8, 4, red, W(bu + 2.2, bh + 1.4, bv), 0, true);
    box(0.15, 2.8, 4, red, W(bu - 2.2, bh + 1.4, bv), 0, true);
    box(1.4, 2.8, 0.15, red, W(bu - 1.5, bh + 1.4, bv - 2), 0, true); box(1.4, 2.8, 0.15, red, W(bu + 1.5, bh + 1.4, bv - 2), 0, true);
    box(1.6, 0.6, 0.15, red, W(bu, bh + 2.5, bv - 2));
    const tri = new THREE.Shape([new THREE.Vector2(-2.2, 0), new THREE.Vector2(2.2, 0), new THREE.Vector2(0, 1.4)]);
    for (const dv of [-2, 2]) add(new THREE.ExtrudeGeometry(tri, { depth: 0.15, bevelEnabled: false }), red, M4(W(bu, bh + 2.8, bv + dv - 0.075)));
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(2.75, 0.1, 4.6), roof, M4(W(bu + s * 1.1, bh + 3.5, bv), 0, [1, 1, 1], 0, -s * 0.565));
    box(1.3, 2.2, 0.06, mats.paint(0x1a1210, { plain: true }), W(bu, bh + 1.1, bv - 1.9));
    for (const [x, y] of [[-0.35, 0.5], [0.35, 0.5], [0, 1.1]]) add(new THREE.CylinderGeometry(0.45, 0.45, 1.0, 16), mats.paint(0xd8b860, { plain: true, rough: 0.95 }), M4(W(bu - 3.2 + x, bh + 0.45 + (y > 1 ? 0.45 : 0), bv - 3.2), 0, [1, 1, 1], 0, Math.PI / 2));
    // abreuvoir et mangeoire
    box(1.6, 0.4, 0.5, post, W(19, fh(19, -5.5) + 0.2, -5.5), 0, true); box(1.5, 0.02, 0.4, mats.glass(0x6aa8c8, 0.6), W(19, fh(19, -5.5) + 0.36, -5.5));
    ph('wooden_bucket_01', 20.4, -5.2, { fit: ['y', 0.45] }); ph('wicker_basket_02', 18, 4.8, { fit: ['x', 0.4] });
    out.farmZone = { u0: u0 + 0.8, u1: u1 - 0.8, v0: v0 + 0.8, v1: v1 - 0.8, barn: { u: bu, v: bv } };
    // bauge des cochons (boue) au fond de l'enclos
    { const mud = new THREE.CircleGeometry(1.7, 24); mud.rotateX(-Math.PI / 2); add(mud, mats.ph('raked_dirt', 0x4a3424, { rough: 0.75, metal: 0, grime: 0, scratch: 0, floor: 0 }), M4(W(21.8, fh(21.8, -4.6) + 0.03, -4.6), 0, [1.2, 1, 0.8])); }
    // enclos des lapins (près de l'aire de jeux) : clôture basse, clapier, foin, carottes
    {
      const { u, v, w, d, hutch } = PEN, ph0 = (a, b) => fh(a, b);
      for (const [a, b, c2, e] of [[u - w / 2, v - d / 2, u + w / 2, v - d / 2], [u + w / 2, v - d / 2, u + w / 2, v + d / 2], [u + w / 2, v + d / 2, u - w / 2, v + d / 2], [u - w / 2, v + d / 2, u - w / 2, v - d / 2]]) {
        const L = Math.hypot(c2 - a, e - b), ang = Math.atan2(e - b, c2 - a), n = Math.ceil(L / 0.9);
        for (let k = 0; k <= n; k++) { const t = k / n, pu = a + (c2 - a) * t, pv = b + (e - b) * t; box(0.07, 0.6, 0.07, post, W(pu, ph0(pu, pv) + 0.3, pv)); }
        for (const y of [0.2, 0.48]) { const mu = (a + c2) / 2, mv = (b + e) / 2; box(L, 0.06, 0.03, planks, W(mu, ph0(mu, mv) + y, mv), -ang); }
        const mu = (a + c2) / 2, mv = (b + e) / 2; B.colliderBox(L, 1.0, 0.25, W(mu, ph0(mu, mv) + 0.5, mv).toArray(), [0, -ang, 0]);
      }
      const hh = ph0(hutch.u, hutch.v);
      box(1.1, 0.55, 0.8, planks, W(hutch.u, hh + 0.38, hutch.v)); box(1.25, 0.06, 0.95, roof, W(hutch.u, hh + 0.7, hutch.v), 0);
      for (const s2 of [-1, 1]) box(0.06, 0.1, 0.06, post, W(hutch.u + s2 * 0.5, hh + 0.05, hutch.v));
      box(0.4, 0.3, 0.02, mats.paint(0x1a1210, { plain: true }), W(hutch.u + 0.15, hh + 0.33, hutch.v + 0.41));
      add(new THREE.CylinderGeometry(0.35, 0.4, 0.25, 12), mats.paint(0xd8b860, { plain: true, rough: 0.95 }), M4(W(u + 1.4, ph0(u + 1.4, v - 1) + 0.12, v - 1)));
      for (let k = 0; k < 5; k++) { const cu = u + 0.6 + k * 0.12, cv = v + 0.9; add(new THREE.ConeGeometry(0.02, 0.14, 6), mats.plastic(0xff7a1a, 0.6), M4(W(cu, ph0(cu, cv) + 0.025, cv), k, [1, 1, 1], Math.PI / 2, 0)); }
      add(new THREE.CylinderGeometry(0.12, 0.1, 0.06, 14), steel, M4(W(u - 0.8, ph0(u - 0.8, v - 1.1) + 0.03, v - 1.1)));
      out.rabbitPen = PEN;
    }
    const nt = neonTexture('FERME DU DÔME', '#ffd27a', { size: 60 });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6 / nt.aspect), new THREE.MeshStandardMaterial({ map: nt.tex, transparent: true }));
    sg.position.copy(W(u0 - 0.1, fh(u0, 1) + 1.45, 1)); sg.rotation.y = -Math.PI / 2; scene.add(sg);
    // potager : planches de culture, salades, poireaux, tuteurs, épouvantail, arrosoir
    const { u0: a0, u1: a1, v0: c0, v1: c1 } = VEG;
    const lettuce = mats.plastic(0x5aaa3a, 0.7), leek = mats.plastic(0x7ab84a, 0.6), tom = mats.plastic(0xd8402a, 0.4);
    for (let r = 0; r < 3; r++) {
      const vv = c0 + 1 + r * 2, uu = (a0 + a1) / 2;
      const bed = new THREE.BoxGeometry(a1 - a0, 0.25, 1.2); const uv = bed.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i));
      add(bed, soil, M4(W(uu, fh(uu, vv) + 0.06, vv)), { collide: true });
      for (let k = 0; k < 10; k++) {
        const x = a0 + 0.6 + k * ((a1 - a0 - 1.2) / 9), y = fh(x, vv) + 0.2;
        if (r === 0) add(new THREE.SphereGeometry(0.17, 10, 7), lettuce, M4(W(x, y + 0.08, vv), k, [1, 0.7, 1]));
        else if (r === 1) for (let j = 0; j < 3; j++) add(new THREE.CylinderGeometry(0.02, 0.03, 0.45, 5), leek, M4(W(x + (j - 1) * 0.08, y + 0.22, vv + (j % 2 ? 0.1 : -0.1))));
        else { add(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 4), post, M4(W(x, y + 0.55, vv))); add(new THREE.SphereGeometry(0.25, 8, 6), leek, M4(W(x, y + 0.6, vv), 0, [0.8, 1.4, 0.8])); for (let j = 0; j < 3; j++) add(new THREE.SphereGeometry(0.045, 8, 6), tom, M4(W(x + Math.cos(j * 2) * 0.18, y + 0.4 + j * 0.15, vv + Math.sin(j * 2) * 0.18))); }
      }
    }
    // épouvantail
    const su = a1 + 0.8, sv = c0 + 3, sh2 = fh(su, sv);
    cyl(0.04, 0.05, 2.0, post, W(su, sh2 + 1.0, sv), 6); cyl(0.03, 0.03, 1.4, post, W(su, sh2 + 1.55, sv), 6, false, [0, 0, Math.PI / 2]);
    box(0.7, 0.6, 0.25, mats.plastic(0x3a5a9a, 0.9), W(su, sh2 + 1.35, sv)); add(new THREE.SphereGeometry(0.17, 10, 8), mats.plastic(0xd8c890, 0.9), M4(W(su, sh2 + 1.9, sv)));
    add(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 16), mats.plastic(0xc8a050, 0.9), M4(W(su, sh2 + 2.02, sv))); add(new THREE.CylinderGeometry(0.15, 0.17, 0.16, 12), mats.plastic(0xc8a050, 0.9), M4(W(su, sh2 + 2.1, sv)));
    ph('watering_can_metal_01', a0 - 0.6, c0 + 1.5, { fit: ['max', 0.45], ry: 0.6 }); ph('planter_box_02', a0 - 0.8, c1 + 0.6, { fit: ['x', 1.2], ry: 0.2 });
    out.vegZone = VEG;
    out.lights.push({ pos: W(20, 7, 0), color: 0xfff2dc, i: 20, d: 16 });
  }

  // ---------------------------------------------------------------- lanternes le long des chemins
  for (let k = 0; k < (low ? 8 : 14); k++) {
    const a = (k / (low ? 8 : 14)) * Math.PI * 2 + 0.2, r = 16.9, u = Math.cos(a) * r, v = Math.sin(a) * r;
    if (!free(u, v) && Math.hypot(u - PLAY.u, v - PLAY.v) < 7.5) continue;
    const h0 = heightAt(u, v);
    cyl(0.04, 0.06, 1.6, mats.paint(0x2a2a2a, { plain: true }), W(u, h0 + 0.8, v), 8);
    ph('wooden_lantern_01', u, v, { fit: ['y', 0.42], dy: 1.6 });
    add(new THREE.SphereGeometry(0.07, 8, 6), glow(0xffc070, 3), M4(W(u, h0 + 1.78, v)));
    out.lights.push({ pos: W(u, h0 + 1.9, v), color: 0xffb060, i: 9, d: 8, lamp: 1 });
  }

  // ---------------------------------------------------------------- coupole : vitrage, nervures, ciel artificiel, soleil
  const { R, H } = DOME;
  {
    const ribM = mats.smooth(0xe8eaec, 0.3, 0.6, { grime: 0.1, rust: 0 });
    const n = low ? 14 : 20;
    for (let k = 0; k < n; k++) {
      const th = (k / n) * Math.PI * 2, pts = [];
      for (let i = 0; i <= 24; i++) { const t = (i / 24) * (Math.PI / 2) * 0.96; pts.push(W(Math.cos(th) * R * Math.cos(t), H * Math.sin(t), Math.sin(th) * R * Math.cos(t)).toArray()); }
      B.tube(pts, 0.16, ribM, { radial: 6, segments: 40, cast: false });
    }
    for (const t of [0.35, 0.75, 1.15]) add(new THREE.TorusGeometry(R * Math.cos(t), 0.12, 6, 120), ribM, M4(W(0, H * Math.sin(t), 0), 0, [1, 1, 1], Math.PI / 2));
    add(new THREE.TorusGeometry(R, 0.35, 8, 120), mats.paint(0x6a6e72, { grime: 0.3 }), M4(W(0, 0.2, 0), 0, [1, 1, 1], Math.PI / 2));
    // ciel : dôme intérieur dont la teinte suit l'heure (bleu le jour, transparent la nuit : étoiles)
    const sky = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide,
      uniforms: { uDay: { value: 1 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uDay; varying vec3 vP;
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){ float h = clamp(vP.y, 0.0, 1.0);
          vec3 day = mix(vec3(0.46,0.68,0.94), vec3(0.14,0.36,0.82), pow(h, 0.7));
          vec3 dusk = mix(vec3(1.0,0.52,0.28), vec3(0.22,0.16,0.42), pow(h, 0.7));
          float d = smoothstep(0.25, 0.75, uDay);
          vec3 col = mix(dusk, day, d);
          // nuages projetés (bruit fractal) : blancs le jour, rosés au crépuscule
          vec2 q = vP.xz / max(0.25, h + 0.35) * 2.2;
          float cl = smoothstep(0.52, 0.78, fbm(q + vec2(3.1, 1.7)));
          col = mix(col, mix(vec3(1.0, 0.72, 0.6), vec3(0.98), d), cl * 0.75 * (0.3 + 0.7 * h));
          gl_FragColor = vec4(col * (0.75 + 0.35 * uDay), (0.12 + 0.86 * uDay) * (0.75 + 0.25 * h)); }`,
    });
    const skyM = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), sky);
    skyM.scale.set(R - 0.3, H - 0.3, R - 0.3); skyM.position.copy(C); skyM.renderOrder = 1; scene.add(skyM);
    const glassD = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: 0.03, transparent: true, opacity: 0.05, side: THREE.FrontSide, depthWrite: false, envMapIntensity: 0.5, specularIntensity: 0.35, fog: false });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2), glassD);
    dome.scale.set(R, H, R); dome.position.copy(C); dome.renderOrder = 2; scene.add(dome);
    // soleil artificiel (disque lumineux au zénith)
    const sun = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.6, 3), transparent: true }));
    sun.position.copy(W(0, H - 0.8, 0)); sun.rotation.x = Math.PI / 2; scene.add(sun);
    out.sky = sky; out.sun = sun;
    // collisions : bord de la coupole
    const thE = Math.atan2(15, -24);
    for (let k = 0; k < 44; k++) { const th = (k / 44) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(th - thE), Math.cos(th - thE))) < 0.1) continue; B.colliderBox(4.2, 4, 0.4, W(Math.cos(th) * (R - 0.6), 2, Math.sin(th) * (R - 0.6)).toArray(), [0, -th + Math.PI / 2, 0]); }
    out.lights.push({ pos: W(0, H - 3, 0), color: 0xfff4e0, i: 420, d: 60, sun: 1 });
    out.lights.push({ pos: W(-14, 9, -10), color: 0xfff0d8, i: 60, d: 26, sun: 1 });
    out.lights.push({ pos: W(6, 8, -6), color: 0xeaf4ff, i: 40, d: 20, sun: 1 });
  }
  // ---------------------------------------------------------------- passerelle vitrée depuis la Cour des Saveurs + structure porteuse
  {
    const x0 = -70.2, x1 = -61.9, z = 20, w = 3.6, hh = 3.4;
    box(x1 - x0, 0.3, w + 0.4, mats.paint(0x2a2e33), new THREE.Vector3((x0 + x1) / 2, Y - 0.15, z), 0, true);
    const fl = new THREE.PlaneGeometry(x1 - x0, w); fl.rotateX(-Math.PI / 2); add(fl, planks, M4(new THREE.Vector3((x0 + x1) / 2, Y + 0.02, z)));
    const gl = mats.glass(0xcfe8ff, 0.12), fr = mats.smooth(0xe8eaec, 0.3, 0.6, { grime: 0.1, rust: 0 });
    for (const s of [-1, 1]) { box(x1 - x0, hh, 0.04, gl, new THREE.Vector3((x0 + x1) / 2, Y + hh / 2, z + s * w / 2), 0, true); box(x1 - x0, 0.1, 0.12, fr, new THREE.Vector3((x0 + x1) / 2, Y + hh, z + s * w / 2)); }
    box(x1 - x0, 0.04, w, gl, new THREE.Vector3((x0 + x1) / 2, Y + hh + 0.4, z));
    for (let x = x0 + 0.5; x < x1; x += 1.8) { const arc = new THREE.TorusGeometry(w / 2, 0.06, 6, 24, Math.PI); add(arc, fr, M4(new THREE.Vector3(x, Y + hh - 1.4, z), Math.PI / 2, [1, 1.1, 1])); for (const s of [-1, 1]) box(0.08, hh - 1.4, 0.08, fr, new THREE.Vector3(x, Y + (hh - 1.4) / 2, z + s * w / 2)); }
    // portique d'entrée dans la coupole (cadre lumineux, enseigne)
    for (const s of [-1, 1]) box(0.3, hh + 0.5, 0.3, fr, new THREE.Vector3(x1, Y + (hh + 0.5) / 2, z + s * (w / 2 + 0.15)), 0, true);
    box(0.3, 0.3, w + 0.6, fr, new THREE.Vector3(x1, Y + hh + 0.5, z));
    box(0.06, 0.06, w + 0.4, glow(0x9aff8a, 2.2), new THREE.Vector3(x1 + 0.17, Y + hh + 0.38, z));
    {
      const nt = neonTexture('LE GRAND DÔME', '#b8ffb0', { size: 70 });
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6 / nt.aspect), neonMaterial(nt.tex, 1.8));
      sg.position.set(x1 - 3.5, Y + hh - 0.25, z); sg.rotation.y = -Math.PI / 2; scene.add(sg);
    }
    // piliers porteurs sous la dalle du dôme (vers les toits de la galerie et du hangar)
    for (let k = 0; k < 8; k++) {
      const th = (k / 8) * Math.PI * 2 + 0.2, p = W(Math.cos(th) * (R - 4), 0, Math.sin(th) * (R - 4));
      const top = Y - 2.3, bot = 14, L2 = top - bot;
      cyl(0.45, 0.65, L2, mats.paint(0x5a5e64, { grime: 0.5 }), p.clone().setY(bot + L2 / 2), 10);
      add(new THREE.TorusGeometry(0.5, 0.06, 6, 16), glow(0xffd27a, 2.2), M4(p.clone().setY(top - 2), 0, [1, 1, 1], Math.PI / 2));
    }
  }
  out.pondR = pondR; out.C = C; out.W = W; out.heightAt = heightAt; out.inPond = inPond; out.POND = POND; out.PLAZA = PLAZA; out.PLAY = PLAY; out.paths = PATHS;
  out.inside = (p) => p.y > Y - 3 && p.y < Y + H && Math.hypot(p.x - C.x, p.z - C.z) < R + 2;
  out.near = (p) => p.y > Y - 6 && p.y < Y + H + 4 && Math.hypot(p.x - C.x, p.z - C.z) < R + 30;
  // lumières (virtuelles : la réserve de lumières les prend en charge)
  out.lightObjs = out.lights.map((L) => { const l = new THREE.PointLight(L.color, L.i, L.d, 2); l.position.copy(L.pos); l.userData = L; scene.add(l); return l; });
  return out;
}
