import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { weldBody } from './garment.js';

// Armure de combinaison : des plaques fines qui épousent le corps (générées à partir du maillage du corps soudé,
// décollées de 2 à 3,5 cm, lissées, liées au même squelette : elles se déforment avec les membres), avec épaisseur
// visible sur les bords (retour vers le vêtement). Les joints entre plaques, chanfreins, liserés de couleur et voyants
// sont dessinés en shader à partir de la position de repos. Quelques éléments rigides et discrets complètent
// (module dorsal plat, col, ceinture fine).

const RB = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 3, r);

const MATS = new Map();
function armorMaterials(colors, L) {
  const key = JSON.stringify(colors);
  if (MATS.has(key)) return MATS.get(key);
  const plateC = new THREE.Color(colors.plate ?? 0x2e3439), underC = new THREE.Color(colors.under ?? 0x1a1d20);
  const accentC = new THREE.Color(colors.accent ?? 0x8a7a3a), lightC = new THREE.Color(colors.light ?? 0x5fe6c8);
  const lum = plateC.r * 0.3 + plateC.g * 0.59 + plateC.b * 0.11;
  const shell = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: lum > 0.5 ? 0.12 : 0.35, envMapIntensity: lum > 0.5 ? 0.6 : 0.9 });
  const u = { uPlate: { value: plateC }, uUnder: { value: underC }, uAccent: { value: accentC }, uLight: { value: lightC },
    uL: { value: new THREE.Vector4(L.shoulderX, L.elbowX, L.hip, L.neck) }, uL2: { value: new THREE.Vector4(L.kneeY, L.ankleY, L.chestY, L.wristX) } };
  shell.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vRest; uniform vec3 uPlate, uUnder, uAccent, uLight; uniform vec4 uL, uL2;
      float hA(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float nA(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hA(i), hA(i+vec3(1,0,0)), f.x), mix(hA(i+vec3(0,1,0)), hA(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hA(i+vec3(0,0,1)), hA(i+vec3(1,0,1)), f.x), mix(hA(i+vec3(0,1,1)), hA(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 R = vRest; float ax = abs(R.x);
        float isArm = step(uL.x - 0.03, ax), isLeg = step(R.y, uL.z - 0.02) * (1.0 - isArm);
        float isTorso = (1.0 - isArm) * (1.0 - isLeg);
        // distance au joint le plus proche (mètres)
        float d = 1.0;
        // torse : plastron en deux pectoraux, plaques abdominales, flancs, dos en trois segments
        d = min(d, isTorso > 0.5 ? abs(R.y - (uL.z + 0.085)) : 1.0);
        d = min(d, isTorso > 0.5 ? abs(R.y - (uL.z + 0.165)) : 1.0);
        d = min(d, isTorso > 0.5 ? abs(R.y - (uL2.z - 0.07)) : 1.0);
        d = min(d, isTorso > 0.5 && R.y > uL2.z - 0.07 && R.z > 0.0 ? ax : 1.0);

        // bras : épaulière, plaques du bras, coudière, avant-bras en deux coques
        d = min(d, isArm > 0.5 ? abs(ax - (uL.x + 0.09)) : 1.0);
        d = min(d, isArm > 0.5 ? abs(ax - (uL.y - 0.04)) : 1.0);
        d = min(d, isArm > 0.5 ? abs(ax - (uL.y + 0.045)) : 1.0);
        // jambes : cuissard, genouillère, tibia
        d = min(d, isLeg > 0.5 ? abs(R.y - (uL2.x + 0.075)) : 1.0);
        d = min(d, isLeg > 0.5 ? abs(R.y - (uL2.x - 0.06)) : 1.0);
        float groove = 1.0 - smoothstep(0.0018, 0.0042, d);
        float bevel = (1.0 - smoothstep(0.0042, 0.011, d)) * (1.0 - groove);
        vec3 col = uPlate;
        // liserés de couleur : bord supérieur du plastron, épaulières, cuissards
        float stripe = isTorso * (1.0 - smoothstep(0.004, 0.007, abs(R.y - (uL2.z + 0.035)))) * step(0.03, ax) * step(ax, 0.12) * step(0.0, R.z)
                     + isArm * (1.0 - smoothstep(0.004, 0.007, abs(ax - (uL.x + 0.075))))
                     + isLeg * (1.0 - smoothstep(0.004, 0.007, abs(R.y - (uL2.x + 0.1)))) * step(0.0, R.z);
        col = mix(col, uAccent, clamp(stripe, 0.0, 1.0));
        // usure : micro-rayures, bords éclaircis, légère salissure dans les creux
        float wear = nA(R * 90.0) * 0.5 + nA(R * 260.0) * 0.5;
        col *= 0.9 + 0.12 * wear;
        col = mix(col, uUnder, groove);
        col += bevel * 0.08 * (0.6 + 0.4 * wear);
        col *= 1.0 - 0.18 * (1.0 - smoothstep(0.004, 0.018, d));   // ombrage au fond des joints
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.34 + 0.18 * nA(vRest * 140.0), 0.85, groove);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // voyants : barrette pectorale gauche, témoin d'avant-bras
        float led = isTorso * step(0.0, vRest.z) * step(abs(vRest.y - (uL2.z + 0.005)), 0.0045) * step(0.035, vRest.x) * step(vRest.x, 0.085)
                  + isArm * step(abs(ax - mix(uL.y, uL2.w, 0.3)), 0.022) * step(abs(vRest.z - 0.0), 0.004) * step(0.0, vRest.y - (uL.w - 0.15));
        totalEmissiveRadiance += uLight * 3.0 * clamp(led, 0.0, 1.0);`);
  };
  shell.customProgramCacheKey = () => 'armorShell';
  const under = new THREE.MeshStandardMaterial({ color: underC, roughness: 0.6, metalness: 0.3 });
  const plate = new THREE.MeshStandardMaterial({ color: plateC, roughness: 0.38, metalness: 0.4 });
  const accent = new THREE.MeshStandardMaterial({ color: accentC, roughness: 0.45, metalness: 0.4 });
  const light = new THREE.MeshBasicMaterial({ color: lightC.clone().multiplyScalar(3) });
  const out = { shell, under, plate, accent, light };
  MATS.set(key, out);
  return out;
}

const SHELLS = new Map();
/** Coques d'armure (géométrie skinnée) pour un corps et un niveau de protection. */
function armorShell(body, L, tier) {
  const key = body.uuid + '|' + tier;
  if (SHELLS.has(key)) return SHELLS.get(key);
  const { pos, nrm, tris, sIdx, sW, n } = weldBody(body);
  // zones de plaques : champ signé (> 0 à l'intérieur), épaisseur ; les bords sont découpés le long de f = 0 (bords nets)
  const R = [
    { t: 1, o: 0.024, f: (x, y) => Math.min(y - (L.hip + 0.035), (L.neck - 0.06) - y, (L.shoulderX - 0.02) - x) },                       // plastron et dos
    { t: 2, o: 0.03, f: (x, y) => Math.min(x - (L.shoulderX - 0.07), (L.shoulderX + 0.12) - x, y - (L.shoulderY - 0.03)) },              // épaulières
    { t: 3, o: 0.02, f: (x) => Math.min(x - (L.shoulderX + 0.13), (L.elbowX - 0.04) - x) },                                               // bras
    { t: 1, o: 0.02, f: (x) => Math.min(x - (L.elbowX + 0.04), (L.wristX - 0.05) - x) },                                                  // avant-bras
    { t: 2, o: 0.02, f: (x, y, z) => Math.min(0.035 - Math.abs(x - L.elbowX), -z - 0.005) },                                              // coudières
    { t: 2, o: 0.02, f: (x, y) => Math.min((L.shoulderX - 0.06) - x, (L.hip - 0.11) - y, y - (L.kneeY + 0.08)) },                        // cuissards
    { t: 2, o: 0.028, f: (x, y, z) => Math.min((L.shoulderX - 0.06) - x, (L.kneeY + 0.07) - y, y - (L.kneeY - 0.065), z + 0.0) },        // genouillères
    { t: 2, o: 0.022, f: (x, y) => Math.min((L.shoulderX - 0.06) - x, (L.kneeY - 0.075) - y, y - (L.ankleY + 0.13)) },                  // tibias
  ].filter((r) => r.t <= tier);
  const F = new Float32Array(n), off = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.abs(pos[i * 3]), y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    let best = -1e9, o = 0;
    for (const r of R) { const v = r.f(x, y, z); if (v > best) { best = v; o = r.o; } }
    F[i] = best; off[i] = o;
  }
  const near = (i) => F[i] > -0.03;
  const q = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) q[i * 3 + k] = pos[i * 3 + k] + nrm[i * 3 + k] * off[i];
  // lissage (Taubin) des coques, bordures comprises
  const nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
    if (!near(a) && !near(b) && !near(c)) continue;
    nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
  }
  const tmp = new Float32Array(n * 3);
  const pass = (lam) => {
    for (let i = 0; i < n; i++) {
      const s = nb[i];
      if (!s.size) { for (let k = 0; k < 3; k++) tmp[i * 3 + k] = q[i * 3 + k]; continue; }
      let mx = 0, my = 0, mz = 0; for (const j of s) { mx += q[j * 3]; my += q[j * 3 + 1]; mz += q[j * 3 + 2]; }
      tmp[i * 3] = q[i * 3] + lam * (mx / s.size - q[i * 3]); tmp[i * 3 + 1] = q[i * 3 + 1] + lam * (my / s.size - q[i * 3 + 1]); tmp[i * 3 + 2] = q[i * 3 + 2] + lam * (mz / s.size - q[i * 3 + 2]);
    }
    q.set(tmp);
  };
  for (let it = 0; it < 18; it++) { pass(0.55); pass(-0.58); }
  for (let i = 0; i < n; i++) {
    if (!nb[i].size) continue;
    const d = (q[i * 3] - pos[i * 3]) * nrm[i * 3] + (q[i * 3 + 1] - pos[i * 3 + 1]) * nrm[i * 3 + 1] + (q[i * 3 + 2] - pos[i * 3 + 2]) * nrm[i * 3 + 2];
    const min = off[i] * 0.7; if (d < min) for (let k = 0; k < 3; k++) q[i * 3 + k] += nrm[i * 3 + k] * (min - d);
  }
  // sommets de sortie (coque et tranche), y compris points de découpe interpolés sur les arêtes
  const P2 = [], S2 = [], W2 = [], I2 = [], outer = new Map(), inner = new Map();
  const emit = (p, si) => { P2.push(p[0], p[1], p[2]); for (let k = 0; k < 4; k++) { S2.push(sIdx[si * 4 + k]); W2.push(sW[si * 4 + k]); } return P2.length / 3 - 1; };
  const base = (i, inn) => [0, 1, 2].map((k) => (inn ? pos[i * 3 + k] + nrm[i * 3 + k] * 0.008 : q[i * 3 + k]));
  const V = (i, inn = false) => { const M = inn ? inner : outer; if (!M.has(i)) M.set(i, emit(base(i, inn), i)); return M.get(i); };
  const C = (a, b, inn = false) => {
    const k = (inn ? 'i' : 'o') + (a < b ? a + ',' + b : b + ',' + a), M = inn ? inner : outer;
    if (M.has(k)) return M.get(k);
    const t = F[a] / (F[a] - F[b]), pa = base(a, inn), pb = base(b, inn);
    const id = emit(pa.map((v, j) => v + (pb[j] - v) * t), t < 0.5 ? a : b);
    M.set(k, id); return id;
  };
  const rim = [];     // arêtes de bord (ids de coque et de tranche)
  for (let t = 0; t < tris.length; t += 3) {
    const T = [tris[t], tris[t + 1], tris[t + 2]], s = T.map((i) => F[i] >= 0);
    const nIn = s.filter(Boolean).length;
    if (nIn === 0) continue;
    if (nIn === 3) { I2.push(V(T[0]), V(T[1]), V(T[2])); continue; }
    // polygone découpé (ordre conservé)
    const poly = [], polyI = [], cut = [];
    for (let e = 0; e < 3; e++) {
      const a = T[e], b = T[(e + 1) % 3];
      if (s[e]) { poly.push(V(a)); polyI.push(null); }
      if (s[e] !== s[(e + 1) % 3]) { poly.push(C(a, b)); polyI.push(C(a, b, true)); cut.push(poly.length - 1); }
    }
    for (let k = 1; k < poly.length - 1; k++) I2.push(poly[0], poly[k], poly[k + 1]);
    if (cut.length === 2) rim.push([poly[cut[0]], poly[cut[1]], polyI[cut[0]], polyI[cut[1]]]);
  }
  // tranche des plaques (épaisseur visible sur les bords découpés)
  for (const [a, b, ai, bi] of rim) I2.push(a, ai, b, b, ai, bi, a, b, ai, b, bi, ai);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(S2, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(W2, 4));
  g.setIndex(I2); g.computeVertexNormals(); g.computeBoundingSphere();
  SHELLS.set(key, g);
  return g;
}

/**
 * body : maillage du corps (gabarit), bones : os en pose de repos, zones : { neck, wrist, hip }.
 * Renvoie { skinned: [{ geo, mat }], rigid: [{ bone, mesh }] }.
 */
export function buildArmor(body, bones, zones, colors = {}) {
  // tier : 1 léger (plastron, avant-bras), 2 moyen (+ épaulières, coudières, jambières), 3 lourd (+ bras, module dorsal)
  const tier = colors.tier ?? 3;
  const wp = (nm) => bones[nm].getWorldPosition(new THREE.Vector3());
  const L = { shoulderX: Math.abs(wp('upperarm_l').x), shoulderY: wp('upperarm_l').y, elbowX: Math.abs(wp('lowerarm_l').x), wristX: Math.abs(wp('hand_l').x),
    hip: zones.hip, neck: zones.neck, kneeY: wp('calf_l').y, ankleY: wp('foot_l').y, chestY: wp('spine_03').y + 0.06 };
  const M = armorMaterials(colors, L);
  const skinned = [{ geo: armorShell(body, L, tier), mat: M.shell }];
  // éléments rigides discrets
  const pieces = [];
  const put = (bone, mat, geo, pos, rot = [0, 0, 0]) => {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1)));
    pieces.push({ bone, mat, geo });
  };
  const chest = wp('spine_03'), neck = wp('neck_01'), pelvis = wp('pelvis');
  // col montant fin
  if (tier >= 2) put('spine_03', M.under, new THREE.TorusGeometry(0.085, 0.012, 8, 28), [0, neck.y - 0.035, neck.z - 0.005], [Math.PI / 2 - 0.15, 0, 0]);
  // ceinture fine et deux poches plates
  put('pelvis', M.under, new THREE.CylinderGeometry(0.152, 0.148, 0.035, 28, 1, true), [0, pelvis.y + 0.06, pelvis.z]);
  for (const a of [-1.1, 1.1]) put('pelvis', M.plate, RB(0.06, 0.055, 0.022, 0.008), [Math.sin(a) * 0.155, pelvis.y + 0.045, Math.cos(a) * 0.14 + pelvis.z], [0, a, 0]);
  // module dorsal plat (survie, recycleur), profilé et collé au dos
  if (tier >= 3) {
    put('spine_03', M.plate, RB(0.24, 0.3, 0.055, 0.02), [0, chest.y - 0.05, chest.z - 0.155], [0.08, 0, 0]);
    put('spine_03', M.under, RB(0.16, 0.18, 0.02, 0.006), [0, chest.y - 0.06, chest.z - 0.19], [0.08, 0, 0]);
    for (const s of [-1, 1]) {
      put('spine_03', M.under, new THREE.CylinderGeometry(0.011, 0.011, 0.22, 10), [s * 0.1, chest.y - 0.05, chest.z - 0.185], [0.08, 0, 0]);
      put('spine_03', M.light, new THREE.BoxGeometry(0.03, 0.006, 0.004), [s * 0.05, chest.y + 0.08, chest.z - 0.2]);
    }
  }
  return { skinned, rigid: finish(pieces, bones) };
}

function finish(pieces, bones) {
  // fusion par (os, matériau) puis passage dans le repère de l'os
  const groups = new Map();
  for (const p of pieces) {
    const k = p.bone + '|' + p.mat.uuid;
    if (!groups.has(k)) groups.set(k, { bone: p.bone, mat: p.mat, geos: [] });
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal'].includes(a)) g.deleteAttribute(a);
    groups.get(k).geos.push(g);
  }
  const out = [];
  for (const g of groups.values()) {
    const geo = mergeGeometries(g.geos, false);
    const inv = new THREE.Matrix4().copy(bones[g.bone].matrixWorld).invert();
    geo.applyMatrix4(inv);
    const mesh = new THREE.Mesh(geo, g.mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    out.push({ bone: g.bone, mesh });
  }
  return out;
}

// ------------------------------------------------------------------ armes portées (étui de cuisse, dos)
const GUN = {
  body: new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.45, metalness: 0.7 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8, metalness: 0.1 }),
  holster: new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.85, metalness: 0.05 }),
};
const GUN_ACCENT = {};
function gunAccent(c) { return GUN_ACCENT[c] || (GUN_ACCENT[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.4 })); }

/** Arme rangée : kind 'sidearm' (étui cuisse droite) ou 'primary' (dos, en diagonale). shape : pistol|revolver|rifle|smg|sniper|shotgun */
export function buildGear(bones, kind, shape, accent = 0x8a7a3a) {
  const wp = (n) => bones[n].getWorldPosition(new THREE.Vector3());
  const pieces = [];
  const A = gunAccent(accent);
  const put = (bone, mat, geo, pos, rot = [0, 0, 0]) => {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1)));
    pieces.push({ bone, mat, geo });
  };
  if (kind === 'sidearm') {
    const th = wp('thigh_r'), kn = wp('calf_r');
    const c = th.clone().lerp(kn, 0.3);
    const x = c.x - 0.11, y = c.y, z = c.z;
    put('thigh_r', GUN.holster, RB(0.05, 0.2, 0.09, 0.012), [x, y - 0.02, z]);
    put('thigh_r', GUN.holster, new THREE.BoxGeometry(0.02, 0.03, 0.12), [x + 0.035, y + 0.12, z]);
    const long = shape === 'revolver' ? 0.06 : 0;
    put('thigh_r', GUN.grip, RB(0.035, 0.11, 0.045, 0.008), [x, y + 0.13, z - 0.02], [0.25, 0, 0]);
    put('thigh_r', GUN.body, RB(0.04, 0.05, 0.11 + long, 0.008), [x, y + 0.17, z + 0.02 + long / 2]);
    put('thigh_r', A, new THREE.BoxGeometry(0.042, 0.012, 0.05), [x, y + 0.195, z + 0.0]);
    return finish(pieces, bones);
  }
  // arme longue : en travers du dos, canon vers le haut à gauche
  const ch = wp('spine_03');
  const L = { rifle: 0.82, smg: 0.6, sniper: 1.12, shotgun: 0.86 }[shape] ?? 0.8;
  const o = [ch.x, ch.y - 0.05, ch.z - 0.25], rz = 0.75;
  const R = (dx, dy) => [o[0] + Math.cos(rz) * dx - Math.sin(rz) * dy, o[1] + Math.sin(rz) * dx + Math.cos(rz) * dy, o[2]];
  put('spine_03', GUN.body, RB(L * 0.55, 0.075, 0.05, 0.01), R(0, 0), [0, 0, rz]);                // carcasse
  put('spine_03', GUN.body, new THREE.CylinderGeometry(0.014, 0.016, L * 0.42, 8), R(L * 0.48, 0.015), [0, 0, rz - Math.PI / 2]); // canon
  put('spine_03', GUN.grip, RB(L * 0.25, 0.07, 0.04, 0.01), R(-L * 0.38, -0.01), [0, 0, rz]);     // crosse
  put('spine_03', GUN.grip, RB(0.035, 0.09, 0.035, 0.008), R(-0.05, -0.07), [0, 0, rz - 0.3]);   // poignée
  put('spine_03', GUN.grip, RB(0.04, 0.11, 0.03, 0.006), R(0.08, -0.08), [0, 0, rz + 0.15]);     // chargeur
  put('spine_03', A, new THREE.BoxGeometry(L * 0.3, 0.015, 0.055), R(0.02, 0.045), [0, 0, rz]);  // liseré
  if (shape === 'sniper') put('spine_03', GUN.body, new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10), R(0.05, 0.075), [0, 0, rz - Math.PI / 2]);
  if (shape === 'shotgun') put('spine_03', GUN.grip, new THREE.CylinderGeometry(0.02, 0.02, L * 0.3, 8), R(L * 0.3, -0.025), [0, 0, rz - Math.PI / 2]);
  put('spine_03', GUN.holster, new THREE.BoxGeometry(0.03, 0.5, 0.012), [ch.x - 0.05, ch.y - 0.02, ch.z - 0.2], [0, 0, -0.75]); // sangle
  return finish(pieces, bones);
}
