import * as THREE from 'three';
import { Builder } from '../world/builder.js';
import { metricBox } from '../world/materials.js';

// Véhicules de piste : chariot élévateur, tracteur + remorque, nacelle à ciseaux, chariot carburant.
// Chaque véhicule est un groupe dont la géométrie est fusionnée par matériau.

function kit(mats) {
  return {
    yellow: mats.paint(0xd09a1a, { grime: 0.85, scratch: 0.9, plain: true, rough: 0.5 }),
    dark: mats.paint(0x26292b, { grime: 0.7, plain: true, rough: 0.6 }),
    steel: mats.metal(0x55595c, { rough: 0.55 }),
    rubber: mats.rubber(),
    chrome: mats.smooth(0xc9cdd0, 0.2, 1.0, { grime: 0.3, floor: 0.2 }),
    orange: mats.emissive(0xff8a20, 6),
    lamp: mats.emissive(0xfff2dd, 6),
    red: mats.emissive(0xff2010, 4),
  };
}

function wheel(B, k, x, y, z, r, w) {
  B.add(new THREE.CylinderGeometry(r, r, w, 16), k.rubber, Builder.matrix([x, y, z], [0, 0, Math.PI / 2]));
  B.add(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 10), k.steel, Builder.matrix([x, y, z], [0, 0, Math.PI / 2]), { cast: false });
}

function finalizeGroup(B) {
  const g = new THREE.Group();
  for (const m of B.finalize(g)) { m.matrixAutoUpdate = false; }
  return g;
}

// ===================================================================== chariot élévateur
export function makeForklift(mats) {
  const k = kit(mats);
  const B = new Builder(null);
  // châssis, contrepoids, capot, protège-conducteur
  B.add(metricBox(1.2, 0.6, 2.2, 1.5), k.yellow, Builder.matrix([0, 0.55, 0]));
  B.add(metricBox(1.25, 0.75, 0.6, 1.5), k.dark, Builder.matrix([0, 0.75, -1.05]));
  B.add(metricBox(1.1, 0.45, 0.9, 1.5), k.yellow, Builder.matrix([0, 1.05, -0.55]));
  B.add(metricBox(0.5, 0.12, 0.45, 1), k.dark, Builder.matrix([0, 0.95, 0.15]));          // siège
  B.add(metricBox(0.5, 0.5, 0.1, 1), k.dark, Builder.matrix([0, 1.2, -0.1]), {});         // dossier
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(metricBox(0.07, 1.4, 0.07, 1), k.dark, Builder.matrix([sx * 0.52, 1.55, 0.2 + sz * 0.55]));
  B.add(metricBox(1.12, 0.06, 1.25, 1), k.dark, Builder.matrix([0, 2.27, 0.2]));
  B.add(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 10), k.dark, Builder.matrix([0, 1.2, 0.55], [0.9, 0, 0]));
  B.add(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), k.dark, Builder.matrix([0, 1.0, 0.62], [0.9, 0, 0]));
  B.add(new THREE.BoxGeometry(0.2, 0.08, 0.05), k.lamp, Builder.matrix([0.4, 2.2, 0.85]), { cast: false });
  B.add(new THREE.BoxGeometry(0.2, 0.08, 0.05), k.lamp, Builder.matrix([-0.4, 2.2, 0.85]), { cast: false });
  B.add(new THREE.BoxGeometry(0.1, 0.06, 0.04), k.red, Builder.matrix([0.5, 0.7, -1.36]), { cast: false });
  B.add(new THREE.BoxGeometry(0.1, 0.06, 0.04), k.red, Builder.matrix([-0.5, 0.7, -1.36]), { cast: false });
  wheel(B, k, 0.6, 0.32, 0.65, 0.32, 0.25); wheel(B, k, -0.6, 0.32, 0.65, 0.32, 0.25);
  wheel(B, k, 0.55, 0.26, -0.8, 0.26, 0.22); wheel(B, k, -0.55, 0.26, -0.8, 0.26, 0.22);
  // mât fixe
  for (const sx of [-1, 1]) B.add(metricBox(0.1, 2.6, 0.12, 1), k.steel, Builder.matrix([sx * 0.38, 1.4, 1.18]));
  B.add(metricBox(0.86, 0.1, 0.12, 1), k.steel, Builder.matrix([0, 2.65, 1.18]));
  const body = finalizeGroup(B);
  // tablier + fourches (mobile)
  const C = new Builder(null);
  C.add(metricBox(0.9, 0.5, 0.08, 1), k.dark, Builder.matrix([0, 0.25, 0]));
  for (const sx of [-1, 1]) {
    C.add(metricBox(0.12, 0.05, 1.1, 1), k.steel, Builder.matrix([sx * 0.28, 0.0, 0.55]));
    C.add(metricBox(0.12, 0.5, 0.05, 1), k.steel, Builder.matrix([sx * 0.28, 0.25, 0.03]));
  }
  const carriage = finalizeGroup(C);
  carriage.position.set(0, 0.12, 1.3);
  const g = new THREE.Group();
  g.add(body, carriage);
  // gyrophare
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.4, 0.4) }));
  beacon.position.set(0.4, 2.36, -0.2);
  g.add(beacon);
  return { group: g, carriage, beacon, seat: new THREE.Vector3(0, 0.45, 0.05) };
}

// ===================================================================== tracteur de piste
export function makeTug(mats) {
  const k = kit(mats);
  const B = new Builder(null);
  B.add(metricBox(1.6, 0.55, 2.6, 1.5), k.yellow, Builder.matrix([0, 0.55, 0]));
  B.add(metricBox(1.5, 0.35, 0.9, 1.5), k.yellow, Builder.matrix([0, 0.95, 0.75]));
  B.add(metricBox(0.55, 0.12, 0.5, 1), k.dark, Builder.matrix([0, 0.95, -0.35]));
  B.add(metricBox(0.55, 0.55, 0.1, 1), k.dark, Builder.matrix([0, 1.25, -0.62]));
  B.add(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), k.dark, Builder.matrix([0, 1.25, 0.15], [1.0, 0, 0]));
  B.add(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), k.dark, Builder.matrix([0, 1.05, 0.22], [1.0, 0, 0]));
  B.add(metricBox(1.64, 0.15, 0.2, 1), k.dark, Builder.matrix([0, 0.35, 1.32]));
  B.add(metricBox(0.3, 0.12, 0.4, 1), k.steel, Builder.matrix([0, 0.4, -1.45]));        // attelage
  for (const sx of [-1, 1]) B.add(new THREE.BoxGeometry(0.22, 0.1, 0.04), k.lamp, Builder.matrix([sx * 0.55, 0.95, 1.21]), { cast: false });
  wheel(B, k, 0.72, 0.34, 0.8, 0.34, 0.3); wheel(B, k, -0.72, 0.34, 0.8, 0.34, 0.3);
  wheel(B, k, 0.72, 0.34, -0.8, 0.34, 0.3); wheel(B, k, -0.72, 0.34, -0.8, 0.34, 0.3);
  B.add(metricBox(0.04, 1.2, 0.04, 1), k.dark, Builder.matrix([0.7, 1.4, -0.9]));
  const g = finalizeGroup(B);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.4, 0.4) }));
  beacon.position.set(0.7, 2.05, -0.9);
  g.add(beacon);
  return { group: g, beacon, seat: new THREE.Vector3(0, 0.5, -0.3), hitch: new THREE.Vector3(0, 0.4, -1.6) };
}

export function makeTrailer(mats, crate) {
  const k = kit(mats);
  const B = new Builder(null);
  B.add(metricBox(1.8, 0.2, 3.4, 1.5), k.steel, Builder.matrix([0, 0.6, 0]));
  for (const sx of [-1, 1]) B.add(metricBox(0.05, 0.4, 3.4, 1), k.yellow, Builder.matrix([sx * 0.9, 0.85, 0]));
  B.add(metricBox(0.1, 0.1, 1.2, 1), k.dark, Builder.matrix([0, 0.5, 2.2]));               // timon
  wheel(B, k, 0.85, 0.3, 1.1, 0.3, 0.2); wheel(B, k, -0.85, 0.3, 1.1, 0.3, 0.2);
  wheel(B, k, 0.85, 0.3, -1.1, 0.3, 0.2); wheel(B, k, -0.85, 0.3, -1.1, 0.3, 0.2);
  // chargement : caisses sanglées
  const cm = [0x5c6b4a, 0x3d4a5a, 0x8a5a2a].map((c) => mats.paint(c, { grime: 0.8, plain: true, rough: 0.7 }));
  B.add(metricBox(1.4, 0.9, 1.2, 1.5), cm[0], Builder.matrix([0, 1.15, 0.8]));
  B.add(metricBox(1.2, 0.7, 1.0, 1.5), cm[1], Builder.matrix([0.05, 1.05, -0.7]));
  B.add(metricBox(0.9, 0.5, 0.8, 1.5), cm[2], Builder.matrix([0, 1.65, 0.75]));
  B.add(metricBox(0.06, 1.25, 1.24, 1), mats.plastic(0xc8901a, 0.7), Builder.matrix([0.3, 1.2, 0.8]), { cast: false });
  return { group: finalizeGroup(B) };
}

// ===================================================================== nacelle à ciseaux
export function makeScissorLift(mats) {
  const k = kit(mats);
  const B = new Builder(null);
  B.add(metricBox(1.2, 0.35, 2.2, 1.5), k.yellow, Builder.matrix([0, 0.3, 0]));
  B.add(metricBox(1.1, 0.25, 0.5, 1), k.dark, Builder.matrix([0, 0.55, -0.85]));
  wheel(B, k, 0.55, 0.15, 0.8, 0.15, 0.15); wheel(B, k, -0.55, 0.15, 0.8, 0.15, 0.15);
  wheel(B, k, 0.55, 0.15, -0.8, 0.15, 0.15); wheel(B, k, -0.55, 0.15, -0.8, 0.15, 0.15);
  const base = finalizeGroup(B);
  // plate-forme avec garde-corps
  const P = new Builder(null);
  P.add(metricBox(1.3, 0.1, 2.4, 1), k.steel, Builder.matrix([0, 0, 0]));
  for (const sx of [-1, 1]) {
    P.add(metricBox(0.04, 0.04, 2.4, 1), k.yellow, Builder.matrix([sx * 0.63, 1.05, 0]), { cast: false });
    P.add(metricBox(0.04, 0.04, 2.4, 1), k.yellow, Builder.matrix([sx * 0.63, 0.55, 0]), { cast: false });
    for (const sz of [-1.15, 0, 1.15]) P.add(metricBox(0.04, 1.05, 0.04, 1), k.yellow, Builder.matrix([sx * 0.63, 0.53, sz]), { cast: false });
  }
  P.add(metricBox(1.3, 0.04, 0.04, 1), k.yellow, Builder.matrix([0, 1.05, -1.18]), { cast: false });
  P.add(metricBox(0.4, 0.3, 0.2, 1), k.dark, Builder.matrix([0.4, 1.0, -1.1]), {});   // pupitre
  const platform = finalizeGroup(P);
  // ciseaux : 2 paires de bras par côté (mise à jour dynamique)
  const armGeo = metricBox(0.08, 0.06, 1.0, 1);
  const arms = [];
  for (const sx of [-1, 1]) for (const s of [-1, 1]) {
    const m = new THREE.Mesh(armGeo, k.dark);
    m.castShadow = true;
    arms.push({ m, sx, s });
  }
  const g = new THREE.Group();
  g.add(base, platform);
  for (const a of arms) g.add(a.m);
  const lift = {
    group: g, platform, h: 0.55,
    setHeight(h) {
      this.h = h;
      platform.position.y = h;
      const L = 2.0, rise = h - 0.45;
      const ang = Math.asin(THREE.MathUtils.clamp(rise / L, 0.02, 0.98));
      for (const a of arms) {
        a.m.position.set(a.sx * 0.5, 0.45 + rise / 2, 0);
        a.m.scale.z = L;
        a.m.rotation.x = a.s * ang;
      }
    },
  };
  lift.setHeight(0.55);
  return lift;
}

// ===================================================================== chariot de carburant (citerne)
export function makeFuelCart(mats) {
  const k = kit(mats);
  const B = new Builder(null);
  const red = mats.paint(0x9a2a1c, { grime: 0.9, scratch: 0.8, plain: true, rough: 0.45 });
  B.add(metricBox(1.4, 0.25, 2.6, 1.5), k.dark, Builder.matrix([0, 0.4, 0]));
  B.add(new THREE.CylinderGeometry(0.62, 0.62, 2.0, 20), red, Builder.matrix([0, 1.15, -0.2], [Math.PI / 2, 0, 0]));
  for (const z of [-1.0, 0.6]) B.add(new THREE.CylinderGeometry(0.64, 0.64, 0.06, 20), k.dark, Builder.matrix([0, 1.15, z], [Math.PI / 2, 0, 0]), { cast: false });
  // enrouleur de flexible
  B.add(new THREE.CylinderGeometry(0.38, 0.38, 0.45, 18), k.steel, Builder.matrix([0, 0.95, 1.05], [0, 0, Math.PI / 2]));
  B.add(new THREE.CylinderGeometry(0.33, 0.33, 0.42, 18), k.rubber, Builder.matrix([0, 0.95, 1.05], [0, 0, Math.PI / 2]), { cast: false });
  B.add(metricBox(0.5, 0.4, 0.15, 1), k.dark, Builder.matrix([0.5, 1.2, 1.25]));
  B.add(new THREE.CircleGeometry(0.1, 16), mats.emissive(0xfff0d0, 1.2), Builder.matrix([0.5, 1.25, 1.33]), { cast: false });
  B.add(new THREE.BoxGeometry(0.12, 0.06, 0.02), mats.emissive(0x50ff80, 3), Builder.matrix([0.42, 1.1, 1.33]), { cast: false });
  B.add(metricBox(0.08, 0.08, 1.2, 1), k.dark, Builder.matrix([0, 0.4, -1.8]));
  wheel(B, k, 0.72, 0.3, 0.8, 0.3, 0.2); wheel(B, k, -0.72, 0.3, 0.8, 0.3, 0.2);
  wheel(B, k, 0.72, 0.3, -0.8, 0.3, 0.2); wheel(B, k, -0.72, 0.3, -0.8, 0.3, 0.2);
  return { group: finalizeGroup(B), reel: new THREE.Vector3(0, 0.95, 1.38) };
}

// ===================================================================== suivi de trajectoire
/** Véhicule qui suit une polyligne (boucle ou non) avec arrêt si obstacle devant. */
export class PathDriver {
  constructor(vehicle, pts, opts = {}) {
    this.v = vehicle;
    this.curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], 0, p[1])), !!opts.loop, 'centripetal', 0.3);
    this.length = this.curve.getLength();
    this.s = 0;
    this.speed = 0;
    this.maxSpeed = opts.speed ?? 3;
    this.loop = !!opts.loop;
    this.reverse = !!opts.reverse;
    this.done = false;
  }
  update(dt, blockers) {
    // obstacle devant ? (joueur, PNJ)
    const p = this.v.pos;
    const dir = this.reverse ? -1 : 1;
    const h = this.v.heading;
    const fx = Math.sin(h) * dir, fz = Math.cos(h) * dir;
    let brake = false;
    for (const b of blockers) {
      const dx = b.x - p.x, dz = b.z - p.z;
      const along = dx * fx + dz * fz, side = Math.abs(-dx * fz + dz * fx);
      if (along > 0 && along < 4.5 + this.speed && side < 1.6) { brake = true; break; }
    }
    this.blocked = brake;
    const target = brake ? 0 : this.maxSpeed;
    const remain = this.loop ? Infinity : this.length - this.s;
    const tgt = Math.min(target, Math.sqrt(Math.max(0, remain) * 2 * 1.2));
    this.speed += Math.sign(tgt - this.speed) * Math.min(Math.abs(tgt - this.speed), dt * (brake ? 6 : 1.4));
    this.s += this.speed * dt;
    if (!this.loop && this.s >= this.length - 0.02) { this.s = this.length; this.done = true; this.speed = 0; }
    const u = this.loop ? (this.s % this.length) / this.length : this.s / this.length;
    const pt = this.curve.getPointAt(Math.min(1, u));
    const tan = this.curve.getTangentAt(Math.min(1, u));
    p.x = pt.x; p.z = pt.z;
    let hd = Math.atan2(tan.x, tan.z);
    if (this.reverse) hd += Math.PI;
    let d = hd - this.v.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.v.heading += d * Math.min(1, dt * (this.speed < 0.6 ? 2.2 : 5));
    this.v.speed = this.speed;
  }
}
