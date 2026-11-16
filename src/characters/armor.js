import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Armure articulée (plastron, sac dorsal, épaulières, protège-avant-bras, cuissardes, genouillères,
// ceinture à poches) : pièces rigides construites en pose de repos puis accrochées aux os.

const RB = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, r);

function armorMaterials(colors) {
  const plate = new THREE.MeshStandardMaterial({ color: colors.plate ?? 0x2e3439, roughness: 0.42, metalness: 0.55 });
  const under = new THREE.MeshStandardMaterial({ color: colors.under ?? 0x1a1d20, roughness: 0.7, metalness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: colors.accent ?? 0x8a7a3a, roughness: 0.5, metalness: 0.3 });
  const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.light ?? 0x5fe6c8).multiplyScalar(3) });
  return { plate, under, accent, light };
}

/**
 * bones : dictionnaire nom -> os (pose de repos, matrices monde à jour).
 * Renvoie une liste de { bone, mesh } à accrocher.
 */
export function buildArmor(bones, colors = {}) {
  const M = armorMaterials(colors);
  // tier : 1 léger (plastron, col, ceinture, avant-bras), 2 moyen (+ épaulières, cuissardes), 3 lourd (+ sac dorsal)
  const tier = colors.tier ?? 3;
  const wp = (n) => bones[n].getWorldPosition(new THREE.Vector3());
  const pieces = [];   // { bone, mat, geo (en coordonnées monde de repos) }
  const put = (bone, mat, geo, pos, rot = [0, 0, 0]) => {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1)));
    pieces.push({ bone, mat, geo });
  };
  const chest = wp('spine_03'), sp2 = wp('spine_02'), sp1 = wp('spine_01'), neck = wp('neck_01'), pelvis = wp('pelvis');
  // plastron (deux plaques + plaque ventrale) et col
  put('spine_03', M.plate, RB(0.36, 0.26, 0.09, 0.03), [0, chest.y + 0.03, chest.z + 0.14], [-0.08, 0, 0]);
  put('spine_03', M.accent, RB(0.12, 0.08, 0.03, 0.01), [0.1, chest.y + 0.08, chest.z + 0.19], [-0.08, 0, 0]);
  put('spine_03', M.light, new THREE.BoxGeometry(0.05, 0.012, 0.01), [-0.11, chest.y + 0.1, chest.z + 0.19]);
  put('spine_02', M.plate, RB(0.3, 0.13, 0.07, 0.025), [0, sp2.y - 0.02, sp2.z + 0.13]);
  put('spine_01', M.under, RB(0.28, 0.1, 0.06, 0.02), [0, sp1.y, sp1.z + 0.12]);
  put('spine_03', M.under, new THREE.TorusGeometry(0.11, 0.035, 8, 18), [0, neck.y - 0.03, neck.z - 0.01], [Math.PI / 2, 0, 0]);
  // sac dorsal : caisson, ailettes, réservoirs, voyants
  if (tier >= 3) {
  put('spine_03', M.plate, RB(0.34, 0.42, 0.15, 0.03), [0, chest.y - 0.03, chest.z - 0.2]);
  put('spine_03', M.under, RB(0.2, 0.2, 0.05, 0.01), [0, chest.y - 0.06, chest.z - 0.29]);
  for (let i = 0; i < 4; i++) put('spine_03', M.under, new THREE.BoxGeometry(0.16, 0.012, 0.02), [0, chest.y - 0.14 + i * 0.035, chest.z - 0.32]);
  for (const s of [-1, 1]) {
    put('spine_03', M.accent, new THREE.CylinderGeometry(0.04, 0.04, 0.34, 12), [s * 0.2, chest.y - 0.05, chest.z - 0.2]);
    put('spine_03', M.light, new THREE.BoxGeometry(0.02, 0.02, 0.01), [s * 0.1, chest.y + 0.15, chest.z - 0.28]);
  }
  }
  // épaulières, brassards, protège-avant-bras, gants renforcés
  for (const [s, side] of [[1, 'l'], [-1, 'r']]) {
    const sh = wp(`upperarm_${side}`), el = wp(`lowerarm_${side}`), wr = wp(`hand_${side}`);
    if (tier >= 2) {
    put(`upperarm_${side}`, M.plate, RB(0.19, 0.09, 0.2, 0.035), [sh.x + s * 0.06, sh.y + 0.075, sh.z], [0, 0, s * -0.25]);
    put(`upperarm_${side}`, M.accent, RB(0.17, 0.03, 0.18, 0.01), [sh.x + s * 0.07, sh.y + 0.125, sh.z], [0, 0, s * -0.25]);
    const mid = el.clone().lerp(sh, 0.45);
    put(`upperarm_${side}`, M.under, new THREE.CylinderGeometry(0.062, 0.058, 0.14, 12), [mid.x, mid.y, mid.z], [0, 0, Math.PI / 2]);
    }
    const fa = el.clone().lerp(wr, 0.55);
    put(`lowerarm_${side}`, M.plate, new THREE.CylinderGeometry(0.058, 0.05, Math.abs(wr.x - el.x) * 0.62, 12), [fa.x, fa.y, fa.z], [0, 0, Math.PI / 2]);
    put(`lowerarm_${side}`, M.light, new THREE.BoxGeometry(0.03, 0.01, 0.02), [fa.x, fa.y + 0.058, fa.z + 0.02]);
    put(`hand_${side}`, M.under, RB(0.08, 0.04, 0.09, 0.012), [wr.x + s * 0.06, wr.y + 0.025, wr.z]);
  }
  // ceinture à poches
  put('pelvis', M.under, new THREE.CylinderGeometry(0.17, 0.165, 0.06, 20), [0, pelvis.y + 0.07, pelvis.z]);
  for (const a of [-0.9, -0.3, 0.3, 0.9, 2.6]) put('pelvis', M.accent, RB(0.07, 0.08, 0.04, 0.01), [Math.sin(a) * 0.18, pelvis.y + 0.05, Math.cos(a) * 0.16 + pelvis.z], [0, a, 0]);
  // cuissardes et genouillères
  if (tier >= 2) for (const side of ['l', 'r']) {
    const th = wp(`thigh_${side}`), kn = wp(`calf_${side}`), an = wp(`foot_${side}`);
    const t = th.clone().lerp(kn, 0.5);
    put(`thigh_${side}`, M.plate, RB(0.12, 0.2, 0.05, 0.02), [t.x, t.y, t.z + 0.085]);
    put(`calf_${side}`, M.plate, RB(0.11, 0.11, 0.06, 0.03), [kn.x, kn.y + 0.01, kn.z + 0.085]);
    const c = kn.clone().lerp(an, 0.45);
    put(`calf_${side}`, M.under, RB(0.1, 0.18, 0.05, 0.02), [c.x, c.y, c.z + 0.075]);
  }
  return finish(pieces, bones);
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
