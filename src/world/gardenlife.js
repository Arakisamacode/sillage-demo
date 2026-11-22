import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { DECK_Y } from './habitat.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Vie du Grand Dôme : enfants (chat, balançoires, toboggan, tourniquet, bascule, canards), parents sur les bancs,
// glacier et snack, clients aux tables, promeneurs, fermier et jardinière ; animaux en instances (un appel de rendu
// par pièce et par espèce) : moutons, chèvres, poules, canards et canetons, carpes koï, papillons, hirondelles.

const Y = DECK_Y;
const R2 = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ------------------------------------------------------------------ géométries d'animaux (couleurs par sommet)
const vc = (g, col, jitter = 0) => {
  g = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const j = 1 + (Math.random() - 0.5) * jitter; a[i * 3] = c.r * j; a[i * 3 + 1] = c.g * j; a[i * 3 + 2] = c.b * j; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
};
const T = (g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
/** fusion + occlusion ambiante approchée : dessous et creux assombris (lecture des volumes) */
const merge = (list, ao = 0.45) => {
  const g = mergeGeometries(list); g.computeBoundingBox(); g.computeBoundingSphere();
  const p = g.attributes.position, c = g.attributes.color, n = g.attributes.normal, b = g.boundingBox, h = Math.max(1e-3, b.max.y - b.min.y);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - b.min.y) / h, k = (1 - ao) + ao * Math.min(1, 0.25 + t * 1.1) * (0.8 + 0.2 * Math.max(0, n.getY(i)));
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  return g;
};
function wool(r, detail = 2) {
  let g = new THREE.IcosahedronGeometry(r, detail + 1); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + 0.09 * Math.sin(v.x * 31) * Math.sin(v.y * 27) * Math.sin(v.z * 29) + 0.05 * Math.sin(v.x * 71 + v.z * 53); v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function speciesGeos() {
  const S = {};
  // mouton : laine bouclée, tête noire (pivot du cou), pattes fines
  S.sheep = {
    body: merge([vc(T(wool(0.5), 0, 0.72, 0, 0, 0, 0, 0.82, 0.72, 1.22), 0xeeeae0, 0.12), vc(T(wool(0.12, 1), 0, 0.78, -0.6), 0xe8e4d8, 0.1)]),
    head: merge([vc(T(new THREE.SphereGeometry(0.12, 12, 8), 0, -0.02, 0.17, 0.5, 0, 0, 0.9, 1, 1.5), 0x1e1a18, 0.08), vc(T(wool(0.13, 1), 0, 0.07, 0.07), 0xeeeae0, 0.1),
      vc(T(new THREE.BoxGeometry(0.14, 0.03, 0.06), 0.13, 0.04, 0.08, 0, 0, -0.4), 0x2a2420), vc(T(new THREE.BoxGeometry(0.14, 0.03, 0.06), -0.13, 0.04, 0.08, 0, 0, 0.4), 0x2a2420),
      vc(T(new THREE.SphereGeometry(0.018, 6, 4), 0.06, 0.03, 0.24), 0x0a0a0a), vc(T(new THREE.SphereGeometry(0.018, 6, 4), -0.06, 0.03, 0.24), 0x0a0a0a)]),
    neck: new THREE.Vector3(0, 0.88, 0.55),
    leg: vc(T(new THREE.CylinderGeometry(0.035, 0.03, 0.5, 6), 0, -0.25, 0), 0x2a2420), hip: 0.5, hips: [[0.18, 0.4], [-0.18, 0.4], [0.18, -0.38], [-0.18, -0.38]],
  };
  // chèvre : pelage court bicolore, cornes, barbiche, queue relevée
  S.goat = {
    body: merge([vc(T(new THREE.CapsuleGeometry(0.22, 0.55, 6, 12), 0, 0.72, 0, Math.PI / 2, 0, 0, 1, 1, 1), 0x6a4a32, 0.15), vc(T(new THREE.CapsuleGeometry(0.2, 0.2, 4, 10), 0, 0.68, 0.18, Math.PI / 2, 0, 0, 1.02, 0.95, 1), 0xf2eee6, 0.08),
      vc(T(new THREE.ConeGeometry(0.04, 0.16, 6), 0, 0.92, -0.48, -0.8, 0, 0), 0x3a2a1c)]),
    head: merge([vc(T(new THREE.CapsuleGeometry(0.08, 0.2, 4, 8), 0, 0.02, 0.12, 1.2, 0, 0), 0x6a4a32, 0.1), vc(T(new THREE.TorusGeometry(0.1, 0.018, 5, 10, 2.2), 0.05, 0.1, -0.02, 0, 1.4, 0), 0x8a7a60), vc(T(new THREE.TorusGeometry(0.1, 0.018, 5, 10, 2.2), -0.05, 0.1, -0.02, 0, 1.4, 0), 0x8a7a60),
      vc(T(new THREE.ConeGeometry(0.025, 0.1, 5), 0, -0.1, 0.18, Math.PI, 0, 0), 0xf2eee6), vc(T(new THREE.BoxGeometry(0.12, 0.025, 0.05), 0.1, 0.04, 0.03, 0, 0, -0.6), 0x5a3a24), vc(T(new THREE.BoxGeometry(0.12, 0.025, 0.05), -0.1, 0.04, 0.03, 0, 0, 0.6), 0x5a3a24)]),
    neck: new THREE.Vector3(0, 0.95, 0.45),
    leg: vc(T(new THREE.CylinderGeometry(0.03, 0.025, 0.56, 6), 0, -0.28, 0), 0x4a3424), hip: 0.58, hips: [[0.13, 0.32], [-0.13, 0.32], [0.13, -0.3], [-0.13, -0.3]],
  };
  // poule : corps rond, queue en éventail, crête rouge, bec jaune
  S.hen = {
    body: merge([vc(T(new THREE.SphereGeometry(0.15, 12, 8), 0, 0.27, 0, 0, 0, 0, 0.85, 0.9, 1.15), 0xb06a32, 0.18), vc(T(new THREE.ConeGeometry(0.09, 0.2, 6), 0, 0.38, -0.16, -0.7, 0, 0, 0.5, 1, 1), 0x6a3a1a, 0.1),
      vc(T(new THREE.SphereGeometry(0.08, 8, 6), 0.11, 0.27, -0.01, 0, 0, 0, 0.35, 0.8, 1.3), 0x8a4a22), vc(T(new THREE.SphereGeometry(0.08, 8, 6), -0.11, 0.27, -0.01, 0, 0, 0, 0.35, 0.8, 1.3), 0x8a4a22)]),
    head: merge([vc(T(new THREE.SphereGeometry(0.065, 10, 8), 0, 0.03, 0.03), 0xb06a32, 0.1), vc(T(new THREE.BoxGeometry(0.015, 0.05, 0.07), 0, 0.1, 0.03), 0xd8202a), vc(T(new THREE.ConeGeometry(0.018, 0.05, 5), 0, 0.02, 0.1, Math.PI / 2, 0, 0), 0xf2b82a), vc(T(new THREE.SphereGeometry(0.015, 5, 4), 0, -0.02, 0.08, 0, 0, 0, 1, 1.6, 1), 0xd8202a)]),
    neck: new THREE.Vector3(0, 0.36, 0.12),
    leg: vc(T(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), 0, -0.08, 0), 0xe8b030), hip: 0.17, hips: [[0.05, 0], [-0.05, 0]],
  };
  // canard colvert (mâle), cane brune, caneton jaune : corps flottant + tête (pivot du cou)
  const duck = (bodyC, wingC, headC, s = 1) => ({
    body: merge([vc(T(new THREE.SphereGeometry(0.17, 12, 8), 0, 0.06, 0, 0, 0, 0, 0.8, 0.6, 1.3), bodyC, 0.1), vc(T(new THREE.ConeGeometry(0.06, 0.16, 6), 0, 0.12, -0.22, -1.9, 0, 0, 1, 1, 0.5), wingC),
      vc(T(new THREE.SphereGeometry(0.1, 8, 6), 0.1, 0.09, -0.03, 0, 0, 0, 0.4, 0.55, 1.5), wingC), vc(T(new THREE.SphereGeometry(0.1, 8, 6), -0.1, 0.09, -0.03, 0, 0, 0, 0.4, 0.55, 1.5), wingC)]).scale(s, s, s),
    head: merge([vc(T(new THREE.CylinderGeometry(0.035, 0.045, 0.12, 8), 0, 0.02, 0), headC), vc(T(new THREE.SphereGeometry(0.06, 10, 8), 0, 0.1, 0.02), headC, 0.05), vc(T(new THREE.BoxGeometry(0.05, 0.018, 0.09), 0, 0.085, 0.09), 0xf2a01a), vc(T(new THREE.SphereGeometry(0.01, 5, 4), 0.045, 0.12, 0.04), 0x0a0a0a), vc(T(new THREE.SphereGeometry(0.01, 5, 4), -0.045, 0.12, 0.04), 0x0a0a0a)]).scale(s, s, s),
    neck: new THREE.Vector3(0, 0.12 * s, 0.17 * s),
  });
  S.drake = duck(0x8a8a88, 0x5a4a3a, 0x1a5a2a); S.duck = duck(0x8a6a48, 0x6a4a30, 0x7a5a3a); S.duckling = duck(0xf2d24a, 0xe8c040, 0xf2d24a, 0.45);
  // carpe koï : corps fuselé bicolore, nageoire caudale animée
  const koi = vc(T(new THREE.SphereGeometry(0.09, 12, 8), 0, 0, 0, 0, 0, 0, 0.75, 0.6, 2.4), 0xffffff, 0.05);
  { const p = koi.attributes.position, c = koi.attributes.color; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), x = p.getX(i), on = Math.sin(z * 22 + x * 9) > -0.2 || p.getY(i) > 0.03; if (on) c.setXYZ(i, 1.0, 0.42, 0.1); } }
  S.koi = { body: merge([koi, vc(T(new THREE.ConeGeometry(0.03, 0.08, 5), 0.06, -0.02, 0.05, 0, 0, -1.2), 0xff8a40), vc(T(new THREE.ConeGeometry(0.03, 0.08, 5), -0.06, -0.02, 0.05, 0, 0, 1.2), 0xff8a40)]),
    tail: vc(T(new THREE.ConeGeometry(0.07, 0.16, 4, 1, true), 0, 0, -0.08, -Math.PI / 2, 0, 0, 0.2, 1, 1), 0xff6a2a) };
  // aile de papillon / d'hirondelle (instanciées, couleur par instance)
  const wing = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.05, 0.035), new THREE.Vector2(0.06, -0.005), new THREE.Vector2(0.035, -0.04), new THREE.Vector2(0, -0.01)]));
  S.wing = vc(wing, 0xffffff);
  const bw = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.04), new THREE.Vector2(0.28, -0.02), new THREE.Vector2(0.3, -0.06), new THREE.Vector2(0, -0.05)])); bw.rotateX(-Math.PI / 2);
  // cochon : corps rose trapu, groin, oreilles tombantes, queue en tire-bouchon
  S.pig = {
    body: merge([vc(T(new THREE.CapsuleGeometry(0.24, 0.42, 6, 14), 0, 0.44, 0, Math.PI / 2, 0, 0, 1, 0.92, 1), 0xf0a8a0, 0.08), vc(T(new THREE.TorusGeometry(0.04, 0.012, 5, 10, 4.5), 0, 0.52, -0.47, 0, Math.PI / 2, 0), 0xe89890)]),
    head: merge([vc(T(new THREE.SphereGeometry(0.16, 12, 9), 0, -0.02, 0.08, 0, 0, 0, 1, 0.95, 1.05), 0xf0a8a0, 0.06), vc(T(new THREE.CylinderGeometry(0.075, 0.08, 0.08, 12), 0, -0.05, 0.24, Math.PI / 2, 0, 0), 0xe08888),
      vc(T(new THREE.SphereGeometry(0.014, 5, 4), 0.025, -0.05, 0.285), 0x5a2a2a), vc(T(new THREE.SphereGeometry(0.014, 5, 4), -0.025, -0.05, 0.285), 0x5a2a2a),
      vc(T(new THREE.ConeGeometry(0.06, 0.12, 3), 0.1, 0.1, 0.06, 0.9, 0, -0.5), 0xe89890), vc(T(new THREE.ConeGeometry(0.06, 0.12, 3), -0.1, 0.1, 0.06, 0.9, 0, 0.5), 0xe89890),
      vc(T(new THREE.SphereGeometry(0.016, 6, 4), 0.07, 0.03, 0.19), 0x101010), vc(T(new THREE.SphereGeometry(0.016, 6, 4), -0.07, 0.03, 0.19), 0x101010)]),
    neck: new THREE.Vector3(0, 0.46, 0.38),
    leg: vc(T(new THREE.CylinderGeometry(0.045, 0.04, 0.24, 7), 0, -0.12, 0), 0xd88880), hip: 0.24, hips: [[0.13, 0.22], [-0.13, 0.22], [0.13, -0.22], [-0.13, -0.22]],
  };
  // lapin : corps rond, longues oreilles, queue en pompon (déplacement par bonds)
  const bun = (c) => ({
    body: merge([vc(T(new THREE.SphereGeometry(0.1, 12, 9), 0, 0.1, 0, 0, 0, 0, 1, 0.95, 1.4), c, 0.08), vc(T(new THREE.SphereGeometry(0.04, 8, 6), 0, 0.13, -0.14), 0xf8f8f4), vc(T(new THREE.SphereGeometry(0.045, 8, 6), 0.06, 0.04, -0.06, 0, 0, 0, 0.8, 0.6, 1.6), c), vc(T(new THREE.SphereGeometry(0.045, 8, 6), -0.06, 0.04, -0.06, 0, 0, 0, 0.8, 0.6, 1.6), c)]),
    head: merge([vc(T(new THREE.SphereGeometry(0.065, 10, 8), 0, 0.02, 0.04, 0, 0, 0, 1, 0.95, 1.1), c, 0.05), vc(T(new THREE.SphereGeometry(0.03, 8, 6), 0.03, 0.13, 0.0, -0.25, 0, -0.18, 0.5, 2.6, 0.9), c), vc(T(new THREE.SphereGeometry(0.03, 8, 6), -0.03, 0.13, 0.0, -0.25, 0, 0.18, 0.5, 2.6, 0.9), c),
      vc(T(new THREE.SphereGeometry(0.011, 5, 4), 0.04, 0.04, 0.08), 0x0a0a0a), vc(T(new THREE.SphereGeometry(0.011, 5, 4), -0.04, 0.04, 0.08), 0x0a0a0a), vc(T(new THREE.SphereGeometry(0.01, 5, 4), 0, 0.0, 0.11), 0xd88a8a)]),
    neck: new THREE.Vector3(0, 0.16, 0.13),
  });
  S.bunny = bun(0xc8b8a0); S.bunnyW = bun(0xf2f0ea); S.bunnyD = bun(0x5a4a3c);
  S.bird = { body: merge([vc(T(new THREE.SphereGeometry(0.05, 8, 6), 0, 0, 0, 0, 0, 0, 0.8, 0.7, 2.2), 0x1a1c2a), vc(T(new THREE.ConeGeometry(0.03, 0.14, 4), 0, 0, -0.16, -Math.PI / 2, 0, 0, 1, 1, 0.3), 0x1a1c2a), vc(T(new THREE.SphereGeometry(0.03, 6, 4), 0, -0.01, 0.06), 0xc84a2a)]), wing: vc(bw, 0x1e2232) };
  return S;
}

/** Ensemble d'instances : une pièce = un InstancedMesh ; set(i, matrice) puis commit(). */
class Parts {
  constructor(scene, geo, n, mat) {
    this.m = new THREE.InstancedMesh(geo, mat, n);
    this.m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.m.frustumCulled = false; this.m.castShadow = false; this.m.receiveShadow = true;
    scene.add(this.m); this.n = n;
  }
  set(i, M) { this.m.setMatrixAt(i, M); }
  commit() { this.m.instanceMatrix.needsUpdate = true; }
}

// ------------------------------------------------------------------ animaux réalistes (Microsoft Rocketbox, MIT)
// Pas d'animations fournies : les os sont pilotés directement (pattes en diagonale, tête qui broute ou picore,
// queue, oreilles). Les rotations sont exprimées autour de l'axe latéral de l'animal puis ramenées dans le repère
// de chaque os, à partir de la pose de repos.
const AX = new THREE.Vector3(1, 0, 0);
class RBAnimal {
  constructor(src) {
    this.g = new THREE.Group();
    this.obj = SkeletonUtils.clone(src); this.g.add(this.obj);
    this.obj.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false; } });
    this.g.updateMatrixWorld(true);
    const B = {}; this.obj.traverse((o) => { if (o.isBone) B[o.name.replace(/^[a-z]+_/, '')] = o; });
    const gq = this.g.getWorldQuaternion(new THREE.Quaternion()).invert();
    const prep = (b) => { if (!b) return null; const P = b.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(gq); return { b, q0: b.quaternion.clone(), P, Pi: P.clone().invert() }; };
    this.legs = [['L_Thigh', 0], ['R_Thigh', Math.PI], ['L_UpperArm', Math.PI], ['R_UpperArm', 0]].map(([n, ph]) => B[n] && { ...prep(B[n]), ph, front: /Arm/.test(n) }).filter(Boolean);
    this.necks = ['Neck', 'Neck1', 'Neck2', 'Neck3'].map((n) => prep(B[n])).filter(Boolean);
    this.head = prep(B.Head); this.tail = prep(B.Tail); this.ears = [prep(B.Ear_L), prep(B.Ear_R)].filter(Boolean);
    // sens de la marche (la tête est-elle vers +z ?) et hauteur du sol
    const hz = B.Head ? B.Head.getWorldPosition(new THREE.Vector3()).z : 1, pz = B.Pelvis ? B.Pelvis.getWorldPosition(new THREE.Vector3()).z : 0;
    this.face = hz >= pz ? 1 : -1; this.yawOff = this.face > 0 ? 0 : Math.PI;
    const box = new THREE.Box3().setFromObject(this.obj); this.lift = -box.min.y;
  }
  _rot(j, ang, axis = AX) {
    const R = new THREE.Quaternion().setFromAxisAngle(axis, ang * this.face);
    j.b.quaternion.copy(j.Pi).multiply(R).multiply(j.P).multiply(j.q0);
  }
  /** pos (monde), yaw, ph (phase de marche), moving (m/s), head (0 = droite, 1 = au sol), t (temps), roll */
  pose(pos, yaw, ph, moving, head, t, opts = {}) {
    this.g.position.copy(pos); this.g.position.y += this.lift * this.g.scale.y; this.g.rotation.set(0, yaw + this.yawOff, opts.roll || 0);
    const amp = Math.min(1, moving * 2) * (opts.legAmp ?? 0.5);
    for (const L of this.legs) this._rot(L, Math.sin(ph + L.ph) * amp * (L.front ? 0.9 : 1));
    const nn = Math.max(1, this.necks.length);
    for (const N of this.necks) this._rot(N, head * (opts.neckBend ?? 1.1) / nn);
    if (this.head) this._rot(this.head, head * 0.25 + Math.sin(t * 0.9) * 0.05);
    if (this.tail) this._rot(this.tail, Math.sin(t * 6 + ph) * 0.25, new THREE.Vector3(0, 1, 0));
    for (const [k, E] of this.ears.entries()) this._rot(E, Math.max(0, Math.sin(t * 0.7 + k * 2.1)) ** 8 * 0.6, new THREE.Vector3(0, 0, 1));
  }
}

export function populateGarden(ctx, lib, player, G) {
  const { scene } = ctx;
  const low = ctx.quality.name === 'low';
  const W = G.W, H = G.heightAt;
  const people = [], actors = [];
  const at = (u, v) => W(u, H(u, v), v);
  const uvOf = (p) => [p.x - G.C.x, p.z - G.C.z];

  // ---------------------------------------------------------------- personnages
  const ADULT = [['UF_light', 'Hair_Long'], ['UM_dark', 'Hair_SimpleParted'], ['UF_dark', 'Hair_Buns'], ['UM_light', 'Hair_Beard'], ['UF_light', 'Hair_Buns'], ['UM_light', 'Hair_Buzzed'], ['UF_dark', 'Hair_Long'], ['UM_dark', 'Hair_Buzzed']];
  const CASUAL = [{ top: 0x3a6a9a, bottom: 0x2a2e36 }, { top: 0xd8a040, bottom: 0x3a3a40 }, { top: 0x8a3a4a, bottom: 0x2a2a2e }, { top: 0x4a7a4a, bottom: 0x3a3428 }, { top: 0xe8e2d4, bottom: 0x4a5a6a }, { top: 0x5a4a7a, bottom: 0x2a2a30 }, { top: 0xc86a3a, bottom: 0x2e3238 }];
  const KIDC = [{ top: 0xff5a4a, bottom: 0x3a5aa8 }, { top: 0xffd23a, bottom: 0x2a6a4a }, { top: 0x4ac8e8, bottom: 0x3a3a48 }, { top: 0xff8ac8, bottom: 0x5a4a8a }, { top: 0x7ad84a, bottom: 0x2a3a6a }, { top: 0xffa03a, bottom: 0x4a3a2a }];
  const mk = (i, outfit, p, yaw, opt = {}) => {
    const [model, hair] = opt.look || ADULT[i % ADULT.length];
    const kid = !!opt.kid;
    const hgt = kid ? R2(1.14, 1.38) : model.startsWith('UF') ? R2(1.62, 1.74) : R2(1.74, 1.88);
    const c = lib.create(model, { height: hgt, civil: true, kid, rb: opt.rb, hair, hairColor: [0x2a1d14, 0xd8c098, 0x4a3020, 0x16110d, 0x8a5a30][i % 5] });
    c.setOutfit({ boot: 0x1a1a1a, accent: 0xf2f2ee, zip: false, belt: !kid, ...outfit });
    c.root.position.copy(p); c.root.rotation.y = yaw;
    c.root.traverse((o) => { o.castShadow = false; });
    c.kid = kid; c.root.visible = false; scene.add(c.root); people.push(c);
    if (kid && !c.rb) c.model.position.y = -0.056 * hgt;   // jambes raccourcies : les pieds restent au sol
    return c;
  };
  // proportions d'enfant : tête plus grosse (os de tête, la coiffure suit)
  // proportions d'enfant : tête plus grosse, jambes et bras plus courts (os redimensionnés après l'animation)
  const kidLook = (c) => {
    if (!c.kid || c.rb) return;     // les enfants Rocketbox ont déjà de vraies proportions d'enfant
    const b = c.bones;
    b.Head?.scale.setScalar(1.3); b.neck_01?.scale.setScalar(0.92);
    for (const k of ['thigh_l', 'thigh_r']) b[k]?.scale.setScalar(0.88);
    for (const k of ['upperarm_l', 'upperarm_r']) b[k]?.scale.setScalar(0.9);
  };

  // ---------------------------------------------------------------- moteur de routines (comme à La Couronne) avec suivi du relief
  const turnTo = (c, yaw, dt, k = 6) => { const d = wrap(yaw - c.root.rotation.y); c.root.rotation.y += d * (1 - Math.exp(-dt * k)); };
  const ground = (p) => { const [u, v] = uvOf(p); return Y + H(u, v); };
  const step = (n, dt) => {
    const c = n.c;
    if (c.inDialog) { c.setSpeed(0); return; }
    if (!n.q.length) n.q = n.plan(n);
    const s = n.q[0];
    if (!s) return;
    if (s.fn) { n.q.shift(); n.t = 0; s.fn(n); return; }
    if (s.moveF && !s.move) s.move = s.moveF(n);
    if (s.move) {
      const d = new THREE.Vector3().subVectors(s.move, n.pos).setY(0), len = d.length();
      if (len < 0.1) { n.q.shift(); return; }
      const sp = s.speed || n.speed || 1.1;
      n.pos.addScaledVector(d.normalize(), Math.min(len, sp * dt));
      if (!s.fly) n.pos.y = ground(n.pos);
      c.root.position.copy(n.pos); turnTo(c, Math.atan2(d.x, d.z), dt, 8); c.setSpeed(sp);
      if (c.override) c.stop(0.25);
      return;
    }
    if (n.t === 0) { c.setSpeed(0); if (s.anim && s.anim !== 'idle') c.play(s.anim, { fade: 0.35, speed: s.ts }); else if (c.override && !s.keep) c.stop(0.3); s.enter?.(n); }
    n.t += dt;
    s.each?.(n, dt);
    if (s.face !== undefined) turnTo(c, typeof s.face === 'function' ? s.face(n) : s.face, dt);
    if (s.until ? s.until(n, dt) : n.t >= s.dur) { n.t = 0; n.q.shift(); s.exit?.(n); }
  };
  const actor = (c, plan, o = {}) => { const n = { c, plan, q: [], pos: c.root.position.clone(), t: 0, ...o }; actors.push(n); return n; };
  const act = (anim, dur, face, o = {}) => ({ anim, dur, face, ...o });
  const faceTo = (p) => (n) => Math.atan2(p.x - n.pos.x, p.z - n.pos.z);

  // ---------------------------------------------------------------- réseau de chemins : grand cercle (r 15) + embranchements
  const RING = 15;
  const ringPt = (a, r = RING) => at(Math.cos(a) * r, Math.sin(a) * r);
  const angOf = (p) => { const [u, v] = uvOf(p); return Math.atan2(v, u); };
  const SPUR = {
    plaza: { a: Math.atan2(8.3, -12.4), pts: [[-8.8, 6.6], [-6.2, 5.4]] },
    entry: { a: Math.atan2(8.3, -12.4), pts: [[-15.5, 10.6], [-20, 13.2], [-22.6, 14.6]] },
    farm: { a: 0, pts: [[16.2, -0.5]] },
    play: { a: Math.PI / 2, pts: [[0.5, 16.5], [1.2, 17.6]] },
    veg: { a: -Math.PI / 2, pts: [[2.5, -17.5], [5, -19.4]] },
    hill: { a: -Math.PI * 0.75, pts: [[-13, -13], [-15.2, -14.8]] },
  };
  const along = (a0, a1) => { const d = wrap(a1 - a0), n = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI / 10))), out = []; for (let i = 1; i <= n; i++) out.push({ move: ringPt(a0 + (d * i) / n) }); return out; };
  /** du point courant (sur un embranchement ou sur le cercle) vers une destination */
  const go = (dest, last = null, sp) => ({ fn: (m) => { m.q.unshift(...route(m, dest, last, sp)); } });
  const route = (n, dest, last = null, sp) => {
    const out = [], from = n.at;
    if (from && SPUR[from]) for (const [u, v] of [...SPUR[from].pts].reverse()) out.push({ move: at(u, v), speed: sp });
    const a0 = from && SPUR[from] ? SPUR[from].a : angOf(n.pos);
    out.push({ move: ringPt(a0), speed: sp });
    const a1 = SPUR[dest] ? SPUR[dest].a : dest;
    for (const s of along(a0, a1)) out.push({ ...s, speed: sp });
    if (SPUR[dest]) for (const [u, v] of SPUR[dest].pts) out.push({ move: at(u, v), speed: sp });
    if (last) out.push({ move: last, speed: sp });
    out.push({ fn: (m) => { m.at = SPUR[dest] ? dest : null; } });
    return out;
  };

  // ---------------------------------------------------------------- vendeurs
  const gl = G.glacier, sn = G.snack;
  const glacierC = mk(0, { top: 0xf2f2ee, bottom: 0xff9ec8, accent: 0xff6a8a }, gl.vendor, gl.vendorYaw);
  glacierC.talkRole = 'glacier'; glacierC.shopId = 'dome_glace';
  actor(glacierC, () => [act('idle', R2(4, 8), gl.vendorYaw), act('interact', R2(2, 3), gl.vendorYaw), act('talk', R2(3, 6), gl.vendorYaw)]).shop = 'dome_glace';
  const snackC = mk(1, { top: 0x2a8a5a, bottom: 0x2a2e36, accent: 0xfff4e8 }, sn.vendor, sn.vendorYaw);
  snackC.talkRole = 'snack'; snackC.shopId = 'dome_snack';
  actor(snackC, () => [act('interact', R2(4, 7), sn.vendorYaw), act('idle', R2(2, 4), sn.vendorYaw), act('pickup', 2.4, sn.vendorYaw + Math.PI), act('talk', R2(3, 5), sn.vendorYaw)]).shop = 'dome_snack';

  // ---------------------------------------------------------------- fermier : abreuvoir, grange, enclos ; jardinière : potager
  const FZ = G.farmZone, inFarm = (u, v) => u > FZ.u0 && u < FZ.u1 && v > FZ.v0 && v < FZ.v1 && !(Math.abs(u - FZ.barn.u) < 2.7 && Math.abs(v - FZ.barn.v) < 2.6);
  const farmPt = () => { for (let k = 0; k < 30; k++) { const u = R2(FZ.u0, FZ.u1), v = R2(FZ.v0, FZ.v1); if (inFarm(u, v)) return [u, v]; } return [18, -3]; };
  const farmer = mk(3, { top: 0x5a6a3a, bottom: 0x3a4a6a, accent: 0xd8c890, boot: 0x3a2a1a }, at(19.5, -4.6), Math.PI, { rb: 'Gardener_Male_01' });
  farmer.talkRole = 'fermier';
  actor(farmer, () => {
    const [u, v] = farmPt();
    return [{ move: at(19, -4.9) }, act('interact', R2(3, 5), Math.PI), { move: at(u, v), speed: 0.9 }, act('idle', R2(3, 6), R2(-3, 3)), { move: at(22, 0.3), speed: 0.9 }, act('pickup', 2.4, Math.PI), { move: at(17.3, -0.4), speed: 0.9 }, act('talk', R2(4, 7), -Math.PI / 2)];
  }).day = true;
  const gardener = mk(4, { top: 0x7a5a3a, bottom: 0x4a5a3a, accent: 0xe8d24a, boot: 0x3a2a1a }, at(4, -20.6), 0);
  gardener.talkRole = 'jardinier';
  const VZ = G.vegZone;
  actor(gardener, () => {
    const out = [];
    for (let r = 0; r < 3; r++) { const v = VZ.v0 + 1 + r * 2 - 0.95, u = R2(VZ.u0 + 1, VZ.u1 - 1); out.push({ move: at(u, v), speed: 0.8 }, act('repair', R2(6, 10), 0)); }
    out.push({ move: at(VZ.u0 - 0.9, VZ.v0 + 2.4), speed: 0.8 }, act('pickup', 2.4, -Math.PI / 2), act('idle', R2(2, 4), Math.PI / 2));
    return out;
  }).day = true;

  // ---------------------------------------------------------------- parents sur les bancs (aire de jeux)
  const parents = [];
  const nPar = low ? 2 : 4;
  G.benches.forEach((b, i) => {
    if (i % 2 || parents.length >= nPar) return;
    b.taken = 'npc';
    const c = mk(i + 2, CASUAL[i % CASUAL.length], b.p, b.yaw);
    c.talkRole = 'parent'; c.play(i % 4 ? 'sit' : 'sitTalk', { fade: 0 }); parents.push(c);
    const n = actor(c, () => [act(Math.random() < 0.6 ? 'sit' : 'sitTalk', R2(10, 25), b.yaw, { keep: true })]);
    n.seat = b; n.day = true;
  });

  // ---------------------------------------------------------------- enfants
  const PZ = G.PLAY;
  const playFree = (u, v) => Math.hypot(u - PZ.u, (v - PZ.v) / 0.72) < 5.5 && !G.blockedPlay(u, v);
  const playPt = () => { for (let k = 0; k < 40; k++) { const a = R2(0, 6.28), r = Math.sqrt(Math.random()) * 6; const u = PZ.u + Math.cos(a) * r, v = PZ.v + Math.sin(a) * r * 0.72; if (playFree(u, v)) return at(u, v); } return at(PZ.u + 5, PZ.v - 1); };
  const kids = [];
  const sw = G.swings, mr = G.merry, ss = G.seesaw, sl = G.slide;
  const kidPlans = {
    // chat : course effrénée d'un point à l'autre, arrêts essoufflés
    tag: (n) => { const out = []; for (let k = 0; k < 5; k++) out.push({ move: playPt(), speed: R2(2.4, 3.6) }, act('idle', R2(0.4, 1.6))); out.push(act('talk', R2(1.5, 3))); return out; },
    // balançoire
    swing: (n) => {
      const s = sw.find((x) => !x.busy); if (!s) return kidPlans.tag(n);
      s.busy = n;
      return [{ move: s.base.clone().add(new THREE.Vector3(0, 0, -0.9)), speed: 2.2 }, { move: s.base.clone(), speed: 0.8 },
        { anim: 'sit', dur: R2(14, 26), enter: (m) => { m.ride = s; s.amp = 0.5; }, exit: (m) => { m.ride = null; s.amp = 0.12; } },
        { fn: () => { s.busy = null; } }, { move: s.base.clone().add(new THREE.Vector3(0, 0, -1.2)), speed: 1.5 }];
    },
    // toboggan : échelle, glissade assise, course pour recommencer
    slide: (n) => [{ move: sl.ladder, speed: 2.4 }, act('idle', 0.3, 0),
      { anim: 'idle', dur: 1.4, enter: (m) => { m.climb = { a: sl.ladder.clone(), b: sl.top.clone(), t: 0, dur: 1.4 }; }, exit: (m) => { m.climb = null; m.pos.copy(sl.top); } },
      { anim: 'sit', dur: 1.3, enter: (m) => { m.glide = { t: 0, dur: 1.3 }; }, exit: (m) => { m.glide = null; m.pos.copy(sl.end); m.pos.y = ground(m.pos); m.c.root.position.copy(m.pos); } },
      act('idle', R2(0.3, 1), Math.PI), { move: playPt(), speed: 3 }],
    // tourniquet : debout sur le plateau, tourne avec lui
    merry: (n) => {
      if (mr.riders.length >= 2) return kidPlans.tag(n);
      return [{ move: mr.c.clone().add(new THREE.Vector3(1.9, 0, 0)), speed: 2.4 },
        { anim: 'idle', dur: R2(10, 18), enter: (m) => { mr.riders.push(m); m.mrA = Math.atan2(m.pos.z - mr.c.z, m.pos.x - mr.c.x) - mr.ang; }, exit: (m) => { mr.riders.splice(mr.riders.indexOf(m), 1); } },
        { fn: (m) => { const a = mr.ang + m.mrA; m.pos.set(mr.c.x + Math.cos(a) * 1.9, mr.c.y, mr.c.z + Math.sin(a) * 1.9); m.pos.y = ground(m.pos); m.c.root.position.copy(m.pos); } },
        { move: playPt(), speed: 2.2 }];
    },
    // enclos des lapins : on court voir les lapins, on leur tend une carotte à travers la clôture
    bunnies: () => {
      const P2 = G.rabbitPen, spot = at(P2.u + R2(-1.6, 1.6), P2.v - P2.d / 2 - 0.5);
      return [{ move: at(P2.u + 3.5, P2.v - P2.d / 2 - 1.6), speed: 2.6 }, { move: spot, speed: 1.4 }, act('interact', R2(3, 5), 0), act('idle', R2(2, 5), 0), act('interact', 2.5, 0), { move: playPt(), speed: 2.6 }];
    },
    // bascule : deux places
    seesaw: (n) => {
      const k = ss.busy.indexOf(null); if (k < 0) return kidPlans.tag(n);
      ss.busy[k] = n;
      const off = ss.c.clone().add(new THREE.Vector3((k ? 1 : -1) * 1.25, 0, 0.8));
      return [{ move: off, speed: 2.2 }, { anim: 'sit', dur: R2(12, 20), enter: (m) => { m.saw = k; }, exit: (m) => { m.saw = null; } },
        { fn: () => { ss.busy[k] = null; } }, { move: off.clone(), speed: 1.5 }];
    },
  };
  const kidPlan = (n) => {
    if (n.inPond) return [];
    const r = Math.random();
    const kind = r < 0.26 ? 'tag' : r < 0.44 ? 'swing' : r < 0.6 ? 'slide' : r < 0.74 ? 'merry' : r < 0.86 ? 'seesaw' : 'bunnies';
    return kidPlans[kind](n);
  };
  const nKids = low ? 4 : 6;
  for (let i = 0; i < nKids; i++) {
    const fem = i % 2 === 1;
    const look = fem ? pick([['UF_light', 'Hair_Buns'], ['UF_dark', 'Hair_Long'], ['UF_light', 'Hair_Long']]) : pick([['UM_light', 'Hair_SimpleParted'], ['UM_dark', 'Hair_Buzzed'], ['UM_light', 'Hair_Buzzed']]);
    const p = playPt();
    const c = mk(i, { ...KIDC[i % KIDC.length], accent: 0xffffff }, p, R2(0, 6), { kid: true, look });
    c.talkRole = 'enfant';
    kids.push(actor(c, kidPlan, { kid: true, speed: 1.6, day: true }));
  }
  // un enfant et son père nourrissent les canards ; ils vont ensuite chercher une glace et reviennent
  const pondSpot = (a, m = 0.9) => { const r = G.pondR(a) + m; return at(G.POND.u + Math.cos(a) * r, G.POND.v + Math.sin(a) * r); };
  const feedA = 2.6, feedP = pondSpot(feedA, 0.95), feedK = pondSpot(feedA + 0.13, 0.75);
  G.feed = null;
  const cone = () => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.11, 10), new THREE.MeshStandardMaterial({ color: 0xd8a050, roughness: 0.8 })); c.rotation.x = Math.PI; c.position.y = 0.0; g.add(c);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: pick([0xffa0b8, 0xfff2d8, 0x5a3020, 0x9ae07a]), roughness: 0.7 })); s.position.y = 0.07; g.add(s);
    return g;
  };
  {
    const dad = mk(5, CASUAL[2], feedP, 0); dad.talkRole = 'parent';
    const kid = mk(7, { ...KIDC[3], accent: 0xffffff }, feedK, 0, { kid: true, look: ['UF_light', 'Hair_Buns'] }); kid.talkRole = 'enfant';
    const toPond = (n, p) => [go(Math.atan2(G.POND.v + Math.sin(feedA) * 9, G.POND.u + Math.cos(feedA) * 9)), { move: p, speed: 1 }, { fn: (m) => { m.at = null; } }];
    const kidN = actor(kid, (n) => [
      ...toPond(n, feedK),
      { anim: 'interact', dur: R2(14, 22), ts: 0.8, face: faceTo(at(G.POND.u, G.POND.v)), enter: () => { G.feed = feedK; }, exit: () => { G.feed = null; }, each: (m) => { if (m.t % 2.2 < 0.02) m.c.play('interact', { fade: 0.2, restart: true }); } },
      act('talk', 2, faceTo(feedP)),
      go('plaza', gl.customer.clone().add(new THREE.Vector3(0.6, 0, 0.3)), 1.1),
      act('idle', R2(4, 7), gl.yaw, { exit: (m) => m.c.hold(cone(), 'cone') }),
      go(Math.atan2(-2, 9), null, 1.1),
      act('idle', 1.5), { fn: (m) => { m.c.hold(null); m.at = null; } },
    ], { kid: true, speed: 1.1, day: true });
    actor(dad, (n) => [
      ...toPond(n, feedP), act('talk', R2(16, 24), faceTo(at(G.POND.u, G.POND.v))), act('idle', 2),
      go('plaza', gl.customer.clone()), act('talk', R2(4, 7), gl.yaw), act('idle', 1.2),
      go(Math.atan2(-2, 9)), act('idle', 1.5), { fn: (m) => { m.at = null; } },
    ], { speed: 1.05, day: true });
    kids.push(kidN);
  }

  // ---------------------------------------------------------------- clients aux tables (crêpes, glaces) et promeneurs
  const seats = G.seats.slice();
  const diners = [];
  const nDin = low ? 3 : 6;
  const food = (kind) => {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.012, 16), new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.4 })); g.add(plate);
    if (kind === 'crepe') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.015, 3), new THREE.MeshStandardMaterial({ color: 0xe0a850, roughness: 0.7 })); c.position.y = 0.012; c.scale.set(1.2, 1, 0.8); g.add(c); }
    else { const c = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: pick([0xffa0b8, 0xfff2d8, 0x5a3020]), roughness: 0.7 })); c.position.y = 0.04; g.add(c); }
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xf2e04a, roughness: 0.2, transparent: true, opacity: 0.8 })); cup.position.set(0.16, 0.06, 0.04); g.add(cup);
    return g;
  };
  for (let i = 0; i < nDin && i < seats.length; i++) {
    const st = seats[(i * 3) % seats.length]; if (st.taken) continue;
    st.taken = 'npc';
    const c = mk(i + 4, CASUAL[(i + 3) % CASUAL.length], st.p, st.yaw);
    c.talkRole = 'promeneur';
    const plateP = st.p.clone().addScaledVector(new THREE.Vector3(Math.sin(st.yaw), 0, Math.cos(st.yaw)), 0.42); plateP.y = st.table.y + 0.79;
    const f = food(i % 2 ? 'crepe' : 'glace'); f.position.copy(plateP); scene.add(f); G.dyn.push(f);
    let eating = false;
    const n = actor(c, () => [{ anim: 'sit', keep: true, dur: R2(8, 16), face: st.yaw, enter: (m) => { eating = true; m.c.eat(plateP, null); } },
      { anim: 'sitTalk', dur: R2(6, 12), face: st.yaw, enter: (m) => { if (eating) { m.c.eat(null); eating = false; } } }]);
    n.seat = st; n.day = true; n.food = f; diners.push(n);
  }
  // promeneurs : couples et solitaires sur le grand cercle, haltes au bassin, sur la colline, devant l'enclos et le potager
  const HALTS = [
    () => { const a = R2(1.5, 4.4); return { dest: Math.atan2(G.POND.v + Math.sin(a) * 9, G.POND.u + Math.cos(a) * 9), last: pondSpot(a, 1.1), face: faceTo(at(G.POND.u, G.POND.v)) }; },
    () => ({ dest: 'farm', last: at(15.6, R2(-3.5, 2.5)), face: 0 }),
    () => ({ dest: 'hill', last: null, face: Math.PI / 4 }),
    () => ({ dest: 'veg', last: at(R2(3, 10), -16.8), face: -Math.PI / 2 }),
    () => ({ dest: Math.atan2(17.5, -13.5), last: at(G.rabbitPen.u + R2(-1.4, 1.4), G.rabbitPen.v - G.rabbitPen.d / 2 - 0.7), face: 0 }),
    () => ({ dest: 'play', last: at(PZ.u - 7.6, PZ.v - 1), face: Math.PI / 2 }),
  ];
  const walkPlan = (n) => {
    const h = pick(HALTS)();
    const out = [...route(n, h.dest, h.last), act(Math.random() < 0.5 && n.pair ? 'talk' : 'idle', R2(5, 12), h.face)];
    if (Math.random() < 0.3) out.push(go('plaza', gl.customer.clone().add(new THREE.Vector3(R2(-0.5, 0.5), 0, R2(0.2, 0.8)))), act('idle', R2(3, 5), gl.yaw));
    return out;
  };
  const nWalk = low ? 3 : 6;
  for (let i = 0; i < nWalk; i++) {
    const a = (i / nWalk) * Math.PI * 2, p = ringPt(a);
    const c = mk(i + 1, CASUAL[(i + 5) % CASUAL.length], p, 0);
    c.talkRole = 'promeneur';
    const n = actor(c, walkPlan, { speed: R2(0.9, 1.15), pair: i % 3 === 0 });
    n.q = [act('idle', R2(0, 4))];
  }

  // ---------------------------------------------------------------- animaux
  const S = speciesGeos();
  const animMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const wingMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x000000 });
  const herd = (sp, n, region, opts = {}) => {
    const g = S[sp], list = [];
    for (let i = 0; i < n; i++) { const [u, v] = region.pt(); list.push({ u, v, yaw: R2(0, 6.28), tu: u, tv: v, state: 'idle', t: R2(0, 4), ph: R2(0, 6), head: 0, sp: opts.speed || 0.6, s: opts.scale?.(i) ?? 1 }); }
    // modèles réalistes si disponibles (sinon : maquettes instanciées)
    const ids = opts.rb?.filter((id) => lib.animals?.[id]);
    if (ids?.length) {
      const rb = list.map((a, i) => { const A2 = new RBAnimal(lib.animals[ids[i % ids.length]]); A2.g.scale.setScalar(a.s * (opts.rbScale ?? 1)); A2.g.visible = false; scene.add(A2.g); return A2; });
      return { sp, g, parts: {}, rb, list, region, opts };
    }
    const parts = { body: new Parts(scene, g.body, n, animMat), head: new Parts(scene, g.head, n, animMat) };
    if (g.leg) parts.leg = new Parts(scene, g.leg, n * g.hips.length, animMat);
    return { sp, g, parts, list, region, opts };
  };
  const farmRegion = { pt: farmPt, ok: inFarm };
  const PEN = G.rabbitPen, penOk = (u, v) => Math.abs(u - PEN.u) < PEN.w / 2 - 0.25 && Math.abs(v - PEN.v) < PEN.d / 2 - 0.25 && !(Math.abs(u - PEN.hutch.u) < 0.7 && Math.abs(v - PEN.hutch.v) < 0.5);
  const penRegion = { pt: () => { for (let k = 0; k < 30; k++) { const u = PEN.u + R2(-PEN.w / 2, PEN.w / 2), v = PEN.v + R2(-PEN.d / 2, PEN.d / 2); if (penOk(u, v)) return [u, v]; } return [PEN.u, PEN.v]; }, ok: penOk };
  const pondOk = (u, v) => G.inPond(u, v, -0.9);
  const pondRegion = { pt: () => { for (let k = 0; k < 40; k++) { const u = G.POND.u + R2(-5, 5), v = G.POND.v + R2(-5, 5); if (pondOk(u, v)) return [u, v]; } return [G.POND.u, G.POND.v]; }, ok: pondOk };
  const herds = [
    herd('sheep', 4, farmRegion, { speed: 0.45, scale: (i) => (i === 3 ? 0.7 : 1), rb: ['Sheep_White_01'], rbScale: 0.85 }),
    herd('goat', 2, farmRegion, { speed: 0.6, rb: ['Goat_White_01', 'Goat_Brown_01'], rbScale: 0.8 }),
    herd('hen', low ? 4 : 7, farmRegion, { speed: 0.9, peck: true, rb: ['Bird_Chicken_Brown_01', 'Bird_Chicken_White_01', 'Bird_Rooster_Brown_01'] }),
    herd('drake', 2, pondRegion, { speed: 0.35, swim: true, rb: ['Bird_Duck_Male_01'] }),
    herd('duck', 2, pondRegion, { speed: 0.35, swim: true, rb: ['Bird_Duck_Female_01'] }),
    herd('duckling', low ? 2 : 4, pondRegion, { speed: 0.4, swim: true, follow: true }),
    herd('pig', 2, farmRegion, { speed: 0.35, scale: (i) => (i ? 0.8 : 1), rb: ['Pig_Pink_01'] }),
    herd('bunny', 2, penRegion, { speed: 1.1, hop: true }),
    herd('bunnyW', low ? 1 : 2, penRegion, { speed: 1.1, hop: true }),
    herd('bunnyD', 1, penRegion, { speed: 1.1, hop: true }),
  ];
  const _E2 = new THREE.Euler(0, 0, 0, 'ZYX'), _M = new THREE.Matrix4(), _P = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _V = new THREE.Vector3(), _S = new THREE.Vector3(), _O = new THREE.Vector3();
  const updHerd = (h, dt, T0) => {
    const { g, parts, list, region, opts } = h;
    list.forEach((a, i) => {
      // comportement : marche vers une cible, broute / picore, s'arrête
      a.t -= dt;
      if (opts.follow) { const mom = herds[4].list[i % 2]; const bx = mom.u - Math.sin(mom.yaw) * (0.45 + 0.3 * (i >> 1)), bz = mom.v - Math.cos(mom.yaw) * (0.45 + 0.3 * (i >> 1)); a.tu = bx + Math.sin(i * 2.1) * 0.15; a.tv = bz + Math.cos(i * 2.1) * 0.15; a.state = 'walk'; }
      else if (opts.swim && G.feed && a.t < 0) { const [fu, fv] = uvOf(G.feed); const d = 0.9 + (i % 3) * 0.35, ang = Math.atan2(G.POND.v - fv, G.POND.u - fu) + (i - 1) * 0.4; a.tu = fu + Math.cos(ang) * d; a.tv = fv + Math.sin(ang) * d; if (!region.ok(a.tu, a.tv)) [a.tu, a.tv] = region.pt(); a.state = 'walk'; a.t = R2(1, 2); }
      else if (a.t < 0) {
        if (a.state === 'walk' || Math.random() < 0.4) { a.state = opts.swim ? 'idle' : Math.random() < 0.6 ? 'graze' : 'idle'; a.t = R2(3, 9); }
        else { let k = 0; do { const r = opts.peck ? 1.6 : opts.swim ? 3 : 3.5; a.tu = a.u + R2(-r, r); a.tv = a.v + R2(-r, r); } while (!region.ok(a.tu, a.tv) && ++k < 12); if (k >= 12) [a.tu, a.tv] = region.pt(); a.state = 'walk'; a.t = 12; }
      }
      let moving = 0;
      if (a.state === 'walk') {
        const du = a.tu - a.u, dv = a.tv - a.v, d = Math.hypot(du, dv);
        if (d < 0.08) { if (!opts.follow) { a.state = 'idle'; a.t = R2(0.5, 3); } }
        else {
          const want = Math.atan2(du, dv); a.yaw += wrap(want - a.yaw) * (1 - Math.exp(-dt * 4));
          const sp = Math.min(d, a.sp * (opts.follow ? 1.4 : 1) * dt * Math.max(0, Math.cos(wrap(want - a.yaw))));
          const nu = a.u + Math.sin(a.yaw) * sp, nv = a.v + Math.cos(a.yaw) * sp;
          if (region.ok(nu, nv) || opts.follow) { a.u = nu; a.v = nv; moving = sp / dt; } else a.t = -1;
        }
      }
      a.ph += dt * (moving > 0 ? 9 + moving * 6 : 0);
      // tête : broute (baissée, petits mouvements), picore (coups rapides), regarde autour
      const tgtHead = a.state === 'graze' ? (opts.peck ? (Math.sin(T0 * 9 + i) > 0.3 ? 1.1 : 0.2) : 0.95 + Math.sin(T0 * 3 + i) * 0.08) : Math.sin(T0 * 0.7 + i * 2) * 0.12;
      a.head += (tgtHead - a.head) * (1 - Math.exp(-dt * (opts.peck ? 18 : 4)));
      const y = opts.swim ? Y - 0.3 + Math.sin(T0 * 1.6 + i) * 0.008 : Y + H(a.u, a.v);
      const bob = opts.swim ? 0 : opts.hop ? Math.abs(Math.sin(a.ph * 0.5)) * 0.13 * (moving > 0 ? 1 : 0) : Math.abs(Math.sin(a.ph)) * 0.015 * (moving > 0 ? 1 : 0);
      if (h.rb) {
        const A2 = h.rb[i];
        // canards : seule la moitié haute dépasse de l'eau ; poules et canards : cou plus mobile
        const p = _V.copy(W(a.u, 0, a.v)).setY(opts.swim ? Y - 0.28 - 0.12 * A2.g.scale.y - A2.lift * A2.g.scale.y + Math.sin(T0 * 1.6 + i) * 0.008 : y + bob);
        A2.pose(p, a.yaw, a.ph, moving, opts.swim ? a.head * 0.4 : a.head, T0 + i, { legAmp: opts.swim ? 0.7 : opts.peck ? 0.6 : 0.45, neckBend: opts.peck ? 1.4 : 1.1, roll: opts.swim ? Math.sin(T0 * 1.3 + i) * 0.04 : 0 });
        if (opts.swim) A2.g.position.y = Y - 0.28 - 0.1 + Math.sin(T0 * 1.6 + i) * 0.008;
        return;
      }
      _P.compose(_V.copy(W(a.u, 0, a.v)).setY(y + bob), _Q.setFromEuler(_E.set(opts.swim ? 0 : -0.04 * Math.sin(a.ph), a.yaw, opts.swim ? Math.sin(T0 * 1.3 + i) * 0.04 : 0)), _S.setScalar(a.s));
      parts.body.set(i, _P);
      _M.compose(_O.copy(g.neck), _Q.setFromEuler(_E.set(a.head, Math.sin(T0 * 0.5 + i * 3) * 0.3 * (a.state === 'idle' ? 1 : 0.2), 0)), _S.setScalar(1));
      parts.head.set(i, _M.premultiply(_P));
      if (parts.leg) g.hips.forEach(([x, z], k) => {
        const sw = Math.sin(a.ph + (k === 0 || k === 3 ? 0 : Math.PI)) * 0.45 * Math.min(1, moving * 2);
        _M.compose(_O.set(x, g.hip, z), _Q.setFromEuler(_E.set(sw, 0, 0)), _S.setScalar(1));
        parts.leg.set(i * g.hips.length + k, _M.premultiply(_P));
      });
    });
    for (const p of Object.values(parts)) p.commit();
  };
  // poissons : nage en boucle sous la surface
  const nFish = low ? 5 : 9;
  const koiB = new Parts(scene, S.koi.body, nFish, animMat), koiT = new Parts(scene, S.koi.tail, nFish, animMat);
  const fish = Array.from({ length: nFish }, (_, i) => ({ a: R2(0, 6.28), r: R2(1, 3.8), sp: R2(0.15, 0.32) * (i % 2 ? 1 : -1), d: R2(0.45, 0.75), s: R2(0.8, 1.4), ph: R2(0, 6) }));
  koiB.m.setColorAt(0, new THREE.Color(1, 1, 1));
  fish.forEach((f, i) => { koiB.m.setColorAt(i, new THREE.Color().setHSL(0.06 + (i % 3) * 0.03, 0.4, i % 4 === 0 ? 0.9 : 0.65)); });
  // papillons et hirondelles
  const nBf = low ? 6 : 12, nBird = low ? 3 : 5;
  const bfL = new Parts(scene, S.wing, nBf, wingMat), bfR = new Parts(scene, S.wing, nBf, wingMat);
  const BFC = [0xffd23a, 0xff8a2a, 0xffffff, 0x6ab8ff, 0xd86aa8, 0xf2f0a0];
  const flies = Array.from({ length: nBf }, (_, i) => { const a = R2(0, 6.28), r = R2(9, 22); bfL.m.setColorAt(i, new THREE.Color(BFC[i % BFC.length])); bfR.m.setColorAt(i, new THREE.Color(BFC[i % BFC.length])); return { p: W(Math.cos(a) * r, 0, Math.sin(a) * r), v: new THREE.Vector3(), ph: R2(0, 6), t: 0, tgt: null }; });
  const brB = new Parts(scene, S.bird.body, nBird, animMat), brL = new Parts(scene, S.bird.wing, nBird, wingMat), brR = new Parts(scene, S.bird.wing, nBird, wingMat);
  const birds = Array.from({ length: nBird }, () => ({ a: R2(0, 6.28), r: R2(7, 19), h: R2(9, 16), sp: R2(0.25, 0.45) * (Math.random() < 0.5 ? -1 : 1), ph: R2(0, 6), dip: R2(0, 6) }));
  const updSmall = (dt, T0) => {
    fish.forEach((f, i) => {
      f.a += f.sp * dt / Math.max(0.6, f.r * 0.4); f.ph += dt * 7;
      let u = G.POND.u + Math.cos(f.a) * f.r, v = G.POND.v + Math.sin(f.a) * f.r * 0.85;
      if (!G.inPond(u, v, -0.6)) { f.r *= 0.995; u = G.POND.u + Math.cos(f.a) * f.r; v = G.POND.v + Math.sin(f.a) * f.r * 0.85; }
      const yaw = Math.atan2(-Math.sin(f.a) * Math.sign(f.sp), Math.cos(f.a) * 0.85 * Math.sign(f.sp)) + (f.sp > 0 ? 0 : 0);
      _P.compose(_V.copy(W(u, -f.d + Math.sin(T0 * 0.4 + i) * 0.05, v)), _Q.setFromEuler(_E.set(0, yaw + Math.sin(f.ph) * 0.12, 0)), _S.setScalar(f.s)); koiB.set(i, _P);
      _M.compose(_O.set(0, 0, -0.2), _Q.setFromEuler(_E.set(0, Math.sin(f.ph + 1) * 0.5, 0)), _S.setScalar(1)); koiT.set(i, _M.premultiply(_P));
    });
    koiB.commit(); koiT.commit();
    flies.forEach((f, i) => {
      f.t -= dt; f.ph += dt * 22;
      if (f.t < 0 || !f.tgt) { const a = R2(0, 6.28), r = R2(9, 23), u = Math.cos(a) * r, v = Math.sin(a) * r; f.tgt = W(u, H(u, v) + R2(0.4, 1.6), v); f.t = R2(4, 9); }
      f.v.addScaledVector(_V.subVectors(f.tgt, f.p).normalize(), dt * 1.2).add(_V.set(R2(-1, 1), R2(-1, 1), R2(-1, 1)).multiplyScalar(dt * 2.4));
      f.v.clampLength(0, 0.9); f.p.addScaledVector(f.v, dt);
      const yaw = Math.atan2(f.v.x, f.v.z), flap = Math.sin(f.ph) * 1.1;
      _P.compose(f.p, _Q.setFromEuler(_E.set(0, yaw, 0)), _S.setScalar(1.6));
      _M.compose(_O.set(0, 0, 0), _Q.setFromEuler(_E2.set(Math.PI / 2, 0, flap, 'ZYX')), _S.setScalar(1)); bfL.set(i, _M.clone().premultiply(_P));
      _M.compose(_O.set(0, 0, 0), _Q.setFromEuler(_E2.set(Math.PI / 2, 0, -flap, 'ZYX')), _S.set(-1, 1, 1)); bfR.set(i, _M.premultiply(_P));
    });
    bfL.commit(); bfR.commit();
    birds.forEach((b, i) => {
      b.a += b.sp * dt; b.ph += dt * 14; b.dip += dt * 0.3;
      const p = W(Math.cos(b.a) * b.r, b.h + Math.sin(b.dip) * 1.5, Math.sin(b.a) * b.r);
      const yaw = Math.atan2(-Math.sin(b.a) * Math.sign(b.sp), Math.cos(b.a) * Math.sign(b.sp));
      const glide = Math.sin(b.ph * 0.13) > 0.3, flap = glide ? 0.1 : Math.sin(b.ph) * 0.7;
      _P.compose(p, _Q.setFromEuler(_E.set(0, yaw, -Math.sign(b.sp) * 0.35)), _S.setScalar(1)); brB.set(i, _P);
      _M.compose(_O.set(0.03, 0.01, 0), _Q.setFromEuler(_E.set(0, 0, flap)), _S.setScalar(1)); brL.set(i, _M.clone().premultiply(_P));
      _M.compose(_O.set(-0.03, 0.01, 0), _Q.setFromEuler(_E.set(0, 0, -flap)), _S.set(-1, 1, 1)); brR.set(i, _M.premultiply(_P));
    });
    brB.commit(); brL.commit(); brR.commit();
  };
  const animalMeshes = [];
  scene.traverse((o) => { if (o.isInstancedMesh && (o.material === animMat || o.material === wingMat)) animalMeshes.push(o); });

  // ---------------------------------------------------------------- mise à jour (simulée seulement à proximité du dôme)
  let T0 = 0, nightK = 0, base = null;
  const MOON = new THREE.Color(0x6a88c8);
  const upd = (dt) => {
    const near = G.near(player.pos), inside = G.inside(player.pos);
    for (const m of animalMeshes) m.visible = near;
    for (const h of herds) if (h.rb) for (const A2 of h.rb) A2.g.visible = near;
    for (const o of G.dyn) o.visible = near;
    G.water.visible = near;
    // ciel : jour, crépuscule, nuit étoilée ; lampions plus forts le soir
    const dusk = ctx.time.dusk;
    G.sky.uniforms.uDay.value = 1 - dusk;
    G.waterM.uniforms.uDay.value = 1 - dusk; G.waterM.uniforms.uT.value += dt; G.waterM.uniforms.uCam.value.copy(ctx.camera.position);
    G.sun.material.opacity = 1 - dusk;
    for (const l of G.lightObjs) { const L = l.userData; l.visible = near; l.intensity = L.sun ? L.i * (1 - dusk * 0.92) : L.night ? L.i * (0.5 + dusk * 1.5) : L.lamp ? L.i * dusk : L.i; }
    // nuit sous la coupole : la lumière planétaire et l'ambiance de la station baissent, clair de lune bleuté
    const LT = ctx.lights, k = (inside ? dusk : 0);
    nightK += (k - nightK) * (1 - Math.exp(-dt * 2));
    if (LT?.sun) {
      if (base === null) base = { sun: LT.sun.intensity, hemi: LT.hemi?.intensity ?? 0, env: 0.85, col: LT.sun.color.clone() };
      LT.sun.intensity = base.sun * (1 - 0.8 * nightK);
      LT.sun.color.copy(base.col).lerp(MOON, nightK);
      if (LT.hemi) LT.hemi.intensity = base.hemi * (1 - 0.75 * nightK);
      ctx.scene.environmentIntensity = base.env * (1 - 0.7 * nightK);
    }
    if (!near) { for (const c of people) c.root.visible = false; return; }
    T0 += dt;
    // équipements animés
    for (const s of sw) { s.ph += dt * 2.05; s.g.rotation.x = Math.sin(s.ph) * s.amp; }
    mr.speed += ((mr.riders.length ? 1.1 : 0.15) - mr.speed) * (1 - Math.exp(-dt * 0.8)); mr.ang += mr.speed * dt; mr.g.rotation.y = -mr.ang;
    const both = ss.busy[0] && ss.busy[1] && ss.busy[0].saw !== undefined && ss.busy[1].saw !== undefined;
    ss.g.rotation.z = both ? Math.sin(T0 * 1.8) * 0.26 : ss.g.rotation.z * 0.95 + (ss.busy[0] ? 0.26 : ss.busy[1] ? -0.26 : 0.26) * 0.05;
    // personnages
    const cam = ctx.camera.position, hr = ctx.time.hour, late = hr >= 21.5 || hr < 7.5;
    for (const n of actors) {
      // le soir, les familles rentrent ; les marchands suivent leurs horaires
      if ((n.day && late) || (n.shop && !ctx.time.open(n.shop))) { n.c.root.visible = false; if (n.food) n.food.visible = false; continue; }
      if (n.food) n.food.visible = true;
      step(n, dt);
      const c = n.c;
      // attaches : balançoire, tourniquet, bascule, échelle, glissade
      if (n.ride && n.ride.busy === n) { const s = n.ride, a = s.g.rotation.x; const p = s.g.position.clone().add(new THREE.Vector3(0, -1.95 * Math.cos(a), 1.95 * Math.sin(a))); n.pos.copy(p); c.root.position.set(p.x, p.y - 0.33, p.z - 0.05); c.root.rotation.set(a * 0.6, 0, 0); }
      else if (n.mrA !== undefined && mr.riders.includes(n)) { const a = mr.ang + n.mrA; n.pos.set(mr.c.x + Math.cos(a) * 0.95, mr.c.y + 0.31, mr.c.z + Math.sin(a) * 0.95); c.root.position.copy(n.pos); c.root.rotation.set(0, -a + Math.PI, 0); }
      else if (n.saw !== null && n.saw !== undefined) { const k = n.saw, a = ss.g.rotation.z, x = (k ? 1 : -1) * 1.25; c.root.position.set(ss.g.position.x + x * Math.cos(a), ss.g.position.y + x * Math.sin(a) - 0.33, ss.g.position.z); c.root.rotation.set(0, k ? -Math.PI / 2 : Math.PI / 2, 0); }
      else if (n.climb) { const C = n.climb; C.t += dt; const k = Math.min(1, C.t / C.dur); n.pos.lerpVectors(C.a, C.b, k); c.root.position.copy(n.pos); c.root.rotation.set(0, 0, 0); }
      else if (n.glide) { const g = n.glide; g.t += dt; const k = Math.min(1, (g.t / g.dur) ** 1.4); const p = sl.curve.getPointAt(k); const tg = sl.curve.getTangentAt(k); n.pos.copy(p); c.root.position.set(p.x, p.y - 0.29, p.z); c.root.rotation.set(0, Math.atan2(tg.x, tg.z), 0); }
      else if (c.root.rotation.x || c.root.rotation.z) c.root.rotation.set(0, c.root.rotation.y, 0);
      const vis = c.root.position.distanceToSquared(player.pos) < 3600 && (inside || G.near(player.pos));
      c.root.visible = vis;
      if (vis && c.root.position.distanceToSquared(cam) < 1600) { c.update(dt, cam); kidLook(c); }
    }
    for (const h of herds) updHerd(h, dt, T0);
    updSmall(dt, T0);
  };
  ctx.updaters.push(upd);
  ctx.gardenPeople = people;
  return { people, actors, kids, parents, glacierC, snackC, farmer, gardener };
}
