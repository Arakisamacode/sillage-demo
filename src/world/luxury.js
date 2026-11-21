import * as THREE from 'three';
import { DECK_Y } from './habitat.js';
import { neonTexture, neonMaterial, Screen, FONT } from './signage.js';
import { stationPanel } from './scififurn.js';
import { loft, wing, flipFaces, nozzle } from './shipkit.js';

// « La Couronne » : étage de prestige sous une coupole nervurée vitrée, ouverte sur l'espace, accessible par un
// ascenseur panoramique en verre depuis le hall du pont habitat. Haute couture (Maison Élysée), combinaisons de haute
// technologie (Nova Atelier), salle d'exposition de yachts stellaires (Aérodyne), salon-bar Le Zénith, conciergerie,
// bassin et sculpture orbitale au centre.

export const LUX_Y = 70;
export const LUX = { x: -92, z: -0.5, R: 22, H: 14 };
const O = new THREE.Vector3(LUX.x, LUX_Y, LUX.z);
/** point du plan à l'angle th (0 = +z, π/2 = +x) et au rayon r */
const P = (th, r, y = 0) => new THREE.Vector3(O.x + Math.sin(th) * r, LUX_Y + y, O.z + Math.cos(th) * r);
const faceIn = (th) => th + Math.PI;          // regard vers le centre
const LIFT = { c: -0.5, x0: -111.8, x1: -109.4 };

// ------------------------------------------------------------------ textures générées (marbres)
function marble(base, veins, gold, size = 1024, seed = 3) {
  let s = seed; const R = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 300; i++) { const x = R() * size, y = R() * size, r = 30 + R() * 140; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},0.035)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  g.filter = 'blur(0.8px)';
  const vein = (col, w, a) => {
    g.strokeStyle = col; g.globalAlpha = a; g.lineWidth = w;
    let x = R() * size, y = R() * size, ang = R() * 6.28;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 40; k++) { ang += (R() - 0.5) * 0.7; x += Math.cos(ang) * 22; y += Math.sin(ang) * 22; g.lineTo(x, y); }
    g.stroke(); g.globalAlpha = 1;
  };
  for (let i = 0; i < 26; i++) vein(veins, 0.6 + R() * 2.2, 0.12 + R() * 0.3);
  for (let i = 0; i < (gold ? 7 : 0); i++) vein(gold, 0.8 + R() * 1.6, 0.35 + R() * 0.3);
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Yacht stellaire de présentation (création du projet) : coque nacrée, verrière fumée, filets dorés, réacteurs. */
function yacht() {
  const g = new THREE.Group();
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xf2f0ec, metalness: 0.35, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide, envMapIntensity: 1.3 });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x12161a, metalness: 0.7, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 1, roughness: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1820, metalness: 0.9, roughness: 0.03, clearcoat: 1, side: THREE.DoubleSide, envMapIntensity: 2 });
  const add = (geo, m, p = [0, 0, 0], r = [0, 0, 0]) => { const o = new THREE.Mesh(geo, m); o.position.set(...p); o.rotation.set(...r); o.castShadow = true; g.add(o); return o; };
  const hull = [
    { z: -5.6, w: 0.05, h: 0.05, y: 1.45, n: 2 }, { z: -4.7, w: 0.62, h: 0.42, y: 1.48, n: 2.2, fb: 0.25 },
    { z: -2.6, w: 1.3, h: 0.95, y: 1.6, n: 2.4, fb: 0.35 }, { z: 0.6, w: 1.75, h: 1.15, y: 1.7, n: 2.6, fb: 0.4 },
    { z: 3.2, w: 1.65, h: 1.05, y: 1.72, n: 2.7, fb: 0.35 }, { z: 4.9, w: 1.2, h: 0.75, y: 1.74, n: 2.5 },
  ];
  add(loft(hull, { radial: 64, steps: 10, arc: [-0.12, Math.PI + 0.12] }), pearl);
  add(loft(hull.map((h) => ({ ...h, w: h.w * 1.004, h: h.h * 1.004 })), { radial: 48, steps: 10, arc: [Math.PI + 0.1, Math.PI * 2 - 0.1] }), dark);
  for (const s of [-1, 1]) add(loft(hull.slice(1, 5).map((h) => ({ ...h, w: h.w * 1.01, h: 0.025, y: h.y - 0.05, x: 0 })), { radial: 4, steps: 8, arc: s > 0 ? [-0.2, 0.2] : [Math.PI - 0.2, Math.PI + 0.2] }), gold);
  add(loft([
    { z: -3.7, w: 0.2, h: 0.06, y: 2.32, n: 2 }, { z: -2.6, w: 0.72, h: 0.4, y: 2.38, n: 2.2 },
    { z: -0.7, w: 0.92, h: 0.55, y: 2.46, n: 2.4 }, { z: 1.2, w: 0.66, h: 0.3, y: 2.56, n: 2.3 },
  ], { radial: 36, steps: 6, arc: [0.04, Math.PI - 0.04] }), glass);
  for (const s of [-1, 1]) {
    const wg = wing([[0, -0.4], [3.6, 2.6], [3.7, 3.6], [0, 4.4]], 0.14);
    wg.applyMatrix4(new THREE.Matrix4().makeScale(s, 1, 1)); if (s < 0) flipFaces(wg);
    add(wg, pearl, [s * 1.4, 1.42, 0.2]);
        add(new THREE.BoxGeometry(0.3, 0.12, 1.4), dark, [s * 5.0, 1.42, 3.9]);
    const fin = wing([[0, 0], [1.2, 1.1], [1.2, 1.9], [0, 2.3]], 0.1); fin.rotateZ(-Math.PI / 2);
    add(fin, pearl, [s * 0.9, 2.45, 2.7], [0, 0, s * 0.35]);
    add(nozzle(0.42, 0.7), dark, [s * 0.75, 1.7, 4.75]);
    add(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 3.2) }), [s * 0.75, 1.7, 5.5]);
    add(new THREE.CylinderGeometry(0.035, 0.05, 0.9, 10), gold, [s * 1.2, 0.45, 1.6]);
  }
  add(new THREE.CylinderGeometry(0.035, 0.05, 0.9, 10), gold, [0, 0.45, -3.2]);
  return g;
}

export function buildLuxury(ctx) {
  const { mats, scene, builder: B } = ctx;
  const low = ctx.quality.name === 'low';
  const Y = LUX_Y;
  const add = (geo, mat, m, opts = {}) => B.add(geo, mat, m, { cast: opts.cast ?? false, collide: opts.collide ?? false });
  const M4 = (p, ry = 0, s = [1, 1, 1], rx = 0, rz = 0) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(...s));
  const box = (w, h, d, m, p, ry = 0, col = false) => { const g = new THREE.BoxGeometry(w, h, d); add(g, m, M4(p, ry), { collide: col }); };
  // ---------------------------------------------------------------- matériaux
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.18, envMapIntensity: 1.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, metalness: 1, roughness: 0.06, envMapIntensity: 1.4 });
  const blackMarble = marble('#121416', '#8a9098', '#c8a050');
  blackMarble.repeat.set(0.16, 0.16);
  const floorM = new THREE.MeshPhysicalMaterial({ map: blackMarble, roughness: 0.28, metalness: 0.0, clearcoat: 0.55, clearcoatRoughness: 0.12, envMapIntensity: 0.7 });
  const whiteMarbleT = marble('#ebe8e3', '#9a9690', '#c8a050', 1024, 7);
  const whiteMarble = new THREE.MeshPhysicalMaterial({ map: whiteMarbleT, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xf2f0ec, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, metalness: 0.1 });
  const graphite = new THREE.MeshPhysicalMaterial({ color: 0x1a1d21, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1, metalness: 0.2 });
  const velvet = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.75, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.4) });
  const glassDome = new THREE.MeshPhysicalMaterial({ color: 0xbfd8ff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.5 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xd8ecff, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2 });
  const glowGold = mats.emissive(0xffd27a, 2.4), glowWhite = mats.emissive(0xfff4e6, 3.0), glowCyan = mats.emissive(0x8fe0ff, 2.6);
  const wallLux = stationPanel(0x2a2c30, { rough: 0.3, cw: 128, ch: 512, clear: 0.9 });
  const ds = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };
  /** dalle en secteur d'anneau (comptoirs, étagères courbes) : rayons r0..r1, angles th0..th1, épaisseur h posée à y */
  const arcSlab = (r0, r1, th0, th1, h, y, m, col = false) => {
    const n = Math.max(8, Math.ceil((th1 - th0) * r1 * 3)), pts = [];
    for (let i = 0; i <= n; i++) { const t = th0 + (th1 - th0) * (i / n); pts.push(new THREE.Vector2(r1 * Math.sin(t), -r1 * Math.cos(t))); }
    for (let i = n; i >= 0; i--) { const t = th0 + (th1 - th0) * (i / n); pts.push(new THREE.Vector2(r0 * Math.sin(t), -r0 * Math.cos(t))); }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: h, bevelEnabled: h > 0.05, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    add(g, m, M4(O.clone().setY(y)), { collide: col });
  };

  // ---------------------------------------------------------------- sol : marbre noir veiné d'or, incrustations, trémie de l'ascenseur
  const { R, H } = LUX;
  const shape = new THREE.Shape(); shape.absarc(0, 0, R, 0, Math.PI * 2, false);
  const hx0 = LIFT.x0 - O.x - 0.1, hx1 = LIFT.x1 - O.x + 0.1, hz = 1.45;
  const hole = new THREE.Path(); hole.moveTo(hx0, -hz); hole.lineTo(hx1, -hz); hole.lineTo(hx1, hz); hole.lineTo(hx0, hz); hole.lineTo(hx0, -hz);
  shape.holes.push(hole);
  const fg = new THREE.ShapeGeometry(shape, 96); fg.rotateX(-Math.PI / 2);
  add(fg, floorM, M4(O.clone().setY(Y + 0.01)));
  box(R * 2, 0.4, R * 2, graphite, O.clone().setY(Y - 0.2));       // dalle (sous-face)
  // structure porteuse : calice nacré sous la dalle, prolongé par un fût jusqu'au toit du hall du pont habitat,
  // nervures et bagues lumineuses (visible depuis l'espace et par la verrière de la Cour des Saveurs)
  {
    const prof = [[R + 0.3, -0.35], [R - 0.6, -1.1], [R - 4, -2.6], [R - 9, -5.4], [R - 14, -9.5], [6.2, -14], [5.2, -18.5], [5.0, -(Y - (DECK_Y + 5.2))]];
    const lat = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 96);
    add(lat, ds(pearl), M4(O.clone()));
    for (let k = 0; k < 16; k++) {
      const th = (k / 16) * Math.PI * 2;
      B.tube(prof.slice(0, 7).map(([r, y]) => P(th, r + 0.25, y).toArray()), 0.22, graphite, { radial: 6, segments: 40, cast: false });
    }
    for (const [r, y] of [[R - 1.6, -1.6], [R - 9.2, -5.5], [5.25, -18]]) add(new THREE.TorusGeometry(r + 0.05, 0.06, 6, 128), glowGold, M4(O.clone().setY(Y + y), 0, [1, 1, 1], Math.PI / 2));
    for (let k = 0; k < 24; k++) { const th = (k / 24) * Math.PI * 2; add(new THREE.SphereGeometry(0.12, 8, 6), mats.emissive(k % 2 ? 0xffffff : 0xff3a2a, 4), M4(P(th, R + 0.35, -0.35))); }
    // fût : bagues et hublots éclairés
    for (let y = -22; y < -14; y += 2.5) add(new THREE.TorusGeometry(5.1, 0.08, 6, 64), glowWhite, M4(O.clone().setY(Y + y), 0, [1, 1, 1], Math.PI / 2));
  }
  // collisions de sol, en laissant libre la trémie de l'ascenseur
  const cb = (x0, x1, z0, z1) => B.colliderBox(x1 - x0, 0.3, z1 - z0, [(x0 + x1) / 2, Y - 0.15, (z0 + z1) / 2]);
  cb(O.x - R, LIFT.x0 - 0.1, O.z - R, O.z + R); cb(LIFT.x1 + 0.1, O.x + R, O.z - R, O.z + R);
  cb(LIFT.x0 - 0.1, LIFT.x1 + 0.1, O.z - R, LIFT.c - 1.45); cb(LIFT.x0 - 0.1, LIFT.x1 + 0.1, LIFT.c + 1.45, O.z + R);
  // incrustations dorées : anneaux concentriques et rayons
  for (const r of [5.6, 9.2, 15.6]) add(new THREE.RingGeometry(r - 0.035, r + 0.035, 128).rotateX(-Math.PI / 2), r === 9.2 ? glowGold : gold, M4(O.clone().setY(Y + 0.015)));
  for (let k = 0; k < 24; k++) { const th = (k / 24) * Math.PI * 2, a = P(th, 9.2, 0.014), b = P(th, 15.6, 0.014), mid = a.clone().add(b).multiplyScalar(0.5); add(new THREE.BoxGeometry(0.05, 0.004, 6.4), gold, M4(mid, th)); }

  // ---------------------------------------------------------------- coupole : nervures, anneaux, vitrage, oculus
  const ribs = low ? 16 : 24;
  const rib = (th) => { const pts = []; for (let i = 0; i <= 28; i++) { const t = (i / 28) * (Math.PI / 2) * 0.93; pts.push(P(th, R * Math.cos(t), H * Math.sin(t)).toArray()); } return pts; };
  for (let k = 0; k < ribs; k++) {
    const th = (k / ribs) * Math.PI * 2;
    B.tube(rib(th), 0.14, pearl, { radial: 8, segments: 48, cast: false });
    B.tube(rib(th).map((p) => [p[0], p[1] - 0.16, p[2]]), 0.03, glowWhite, { radial: 4, segments: 48, cast: false });
  }
  for (const t of [0.42, 0.85, 1.22]) {
    add(new THREE.TorusGeometry(R * Math.cos(t), 0.11, 8, 160), pearl, M4(O.clone().setY(Y + H * Math.sin(t)), 0, [1, 1, 1], Math.PI / 2));
    add(new THREE.TorusGeometry(R * Math.cos(t) - 0.12, 0.025, 4, 160), glowGold, M4(O.clone().setY(Y + H * Math.sin(t) - 0.08), 0, [1, 1, 1], Math.PI / 2));
  }
  add(new THREE.TorusGeometry(R, 0.3, 10, 160), pearl, M4(O.clone().setY(Y + 0.3), 0, [1, 1, 1], Math.PI / 2));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 32, 0, Math.PI * 2, 0, Math.PI / 2), glassDome);
  dome.scale.set(R, H, R); dome.position.copy(O); dome.renderOrder = 2; scene.add(dome);
  const ocR = R * Math.cos(Math.PI / 2 * 0.93);
  add(new THREE.TorusGeometry(ocR, 0.18, 10, 64), gold, M4(O.clone().setY(Y + H * Math.sin(Math.PI / 2 * 0.93)), 0, [1, 1, 1], Math.PI / 2));
  add(new THREE.TorusGeometry(ocR - 0.2, 0.05, 6, 64), glowWhite, M4(O.clone().setY(Y + H * Math.sin(Math.PI / 2 * 0.93) - 0.15), 0, [1, 1, 1], Math.PI / 2));
  // garde-corps invisible (limite de la coupole)
  for (let k = 0; k < 40; k++) { const th = (k / 40) * Math.PI * 2, p = P(th, R - 0.4, 1.5); B.colliderBox(3.6, 3, 0.4, p.toArray(), [0, th, 0]); }

  // ---------------------------------------------------------------- centre : bassin miroir et sculpture orbitale
  add(new THREE.CylinderGeometry(4.6, 4.75, 0.5, 96, 1), whiteMarble, M4(O.clone().setY(Y + 0.25)), { collide: true });
  add(new THREE.CylinderGeometry(4.3, 4.3, 0.02, 96), new THREE.MeshPhysicalMaterial({ color: 0x06141c, roughness: 0.02, metalness: 0.4, clearcoat: 1, envMapIntensity: 2.2 }), M4(O.clone().setY(Y + 0.45)));
  add(new THREE.TorusGeometry(4.3, 0.02, 6, 128), glowCyan, M4(O.clone().setY(Y + 0.44), 0, [1, 1, 1], Math.PI / 2));
  add(new THREE.CylinderGeometry(0.25, 0.4, 2.0, 32), chrome, M4(O.clone().setY(Y + 1.4)));
  const orrery = new THREE.Group(); orrery.position.copy(O).setY(Y + 4.4); scene.add(orrery);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 48, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.4) })); orrery.add(core);
  const rings = [];
  for (const [r, tilt] of [[1.2, 0.3], [1.75, -0.6], [2.35, 1.1]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 12, 128), gold); ring.rotation.x = Math.PI / 2 + tilt; orrery.add(ring); const moon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 12), chrome); moon.position.x = r; ring.add(moon); rings.push(ring); }
  ctx.updaters.push((dt, t) => { if (!orrery.visible) return; rings.forEach((rg, i) => { rg.rotation.z = t * (0.25 + i * 0.12) * (i % 2 ? -1 : 1); }); core.scale.setScalar(1 + Math.sin(t * 1.3) * 0.04); });

  // ---------------------------------------------------------------- pavillons : cloisons courbes rétroéclairées
  const pavilion = (thc, span, h = 3.6, r = 20.6) => {
    add(new THREE.CylinderGeometry(r, r, h, 64, 1, true, thc - span, span * 2), ds(wallLux), M4(O.clone().setY(Y + h / 2)));
    add(new THREE.CylinderGeometry(r - 0.06, r - 0.06, 0.05, 64, 1, true, thc - span, span * 2), glowGold, M4(O.clone().setY(Y + h - 0.1)));
    add(new THREE.CylinderGeometry(r - 0.06, r - 0.06, 0.04, 64, 1, true, thc - span, span * 2), glowGold, M4(O.clone().setY(Y + 0.06)));
    for (let k = -2; k <= 2; k++) { const th = thc + (k / 2.5) * span; add(new THREE.BoxGeometry(0.06, h - 0.4, 0.04), glowWhite, M4(P(th, r - 0.05, h / 2), th)); }
  };
  const logo = (text, color, thc, size = 3.4, y = 3.1, r = 20.45) => {
    const nt = neonTexture(text, color, { size: 90 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size / nt.aspect), neonMaterial(nt.tex, 2.2));
    m.position.copy(P(thc, r, y)); m.rotation.y = faceIn(thc); scene.add(m);
  };
  const podium = (p, r = 0.55, m = whiteMarble) => {
    add(new THREE.CylinderGeometry(r, r + 0.05, 0.22, 48), m, M4(p.clone().setY(Y + 0.11)), { collide: true });
    add(new THREE.TorusGeometry(r + 0.02, 0.012, 6, 64), glowGold, M4(p.clone().setY(Y + 0.2), 0, [1, 1, 1], Math.PI / 2));
  };
  const desk = (thc, r, w = 2.2) => {
    const p = P(thc, r);
    arcSlab(r, r + 0.5, thc - w / 2 / r, thc + w / 2 / r, 1.0, Y, whiteMarble, true);
    arcSlab(r - 0.06, r + 0.56, thc - w / 2 / r - 0.01, thc + w / 2 / r + 0.01, 0.04, Y + 1.0, gold);
    add(new THREE.CylinderGeometry(r - 0.02, r - 0.02, 0.03, 48, 1, true, thc - w / 2 / r, w / r), glowGold, M4(O.clone().setY(Y + 0.12)));
    return { customer: P(thc, r - 0.9), clerk: P(thc, r + 1.0), faceClerk: faceIn(thc), faceCustomer: thc, pos: p };
  };

  const out = { lights: [], spots: {}, mannequins: [], suits: [], seats: [], stools: [], loop: [], shafts: [] };

  // Maison Élysée (haute couture), nord-ouest
  {
    const th = -Math.PI * 0.27;
    pavilion(th, 0.36);
    logo('MAISON ÉLYSÉE', '#ffe4b0', th, 4.2);
    for (let k = -1; k <= 1; k++) { const p = P(th + k * 0.17, 16.2); podium(p); out.mannequins.push({ p, face: faceIn(th + k * 0.17), k: k + 1 }); }
    // portants chromés et vêtements suspendus
    for (const s of [-1, 1]) {
      const thr = th + s * 0.27, c = P(thr, 19.2), yaw = faceIn(thr) + Math.PI / 2;
      for (const dz of [-0.85, 0.85]) add(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 12), chrome, M4(c.clone().add(new THREE.Vector3(Math.sin(yaw) * dz, 0.85, Math.cos(yaw) * dz))));
      add(new THREE.CylinderGeometry(0.018, 0.018, 1.8, 12), chrome, M4(c.clone().setY(Y + 1.68), yaw, [1, 1, 1], Math.PI / 2));
      const cols = [0xf4f0e8, 0x14161a, 0x8a1e2e, 0x2a3a6a, 0xd8c08a, 0xe8e4f0, 0x1a3a2a];
      for (let i = 0; i < 7; i++) {
        const d = -0.75 + i * 0.25, q = c.clone().add(new THREE.Vector3(Math.sin(yaw) * d, 0, Math.cos(yaw) * d));
        add(new THREE.TorusGeometry(0.17, 0.008, 4, 16, Math.PI), chrome, M4(q.clone().setY(Y + 1.56), yaw + Math.PI / 2));
        const coat = new THREE.CapsuleGeometry(0.2, 0.75, 4, 12); coat.scale(1, 1, 0.22);
        add(coat, velvet(cols[(i + (s > 0 ? 3 : 0)) % cols.length]), M4(q.clone().setY(Y + 1.06), yaw + Math.PI / 2 + (i % 2 ? 0.08 : -0.08)));
      }
    }
    // miroir en pied cerclé d'or, table d'exposition, fauteuil
    { const p = P(th + 0.12, 19.9), yaw = faceIn(th + 0.12); add(new THREE.BoxGeometry(0.9, 2.1, 0.03), chrome, M4(p.clone().setY(Y + 1.15), yaw)); add(new THREE.BoxGeometry(0.98, 2.18, 0.02), gold, M4(p.clone().setY(Y + 1.15).add(new THREE.Vector3(Math.sin(yaw) * -0.02, 0, Math.cos(yaw) * -0.02)), yaw)); }
    { const p = P(th - 0.1, 13.6); add(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 48), whiteMarble, M4(p.clone().setY(Y + 0.78))); add(new THREE.CylinderGeometry(0.08, 0.3, 0.76, 24), gold, M4(p.clone().setY(Y + 0.38)), { collide: true });
      for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.3, 0.05, 0.22), velvet([0xf4f0e8, 0x14161a, 0x8a1e2e, 0xd8c08a][i]), M4(p.clone().setY(Y + 0.83 + (i % 2) * 0.05).add(new THREE.Vector3(Math.cos(i * 1.6) * 0.3, 0, Math.sin(i * 1.6) * 0.3)), i)); }
    out.spots.couture = desk(th - 0.24, 17.4, 1.8);
    out.spots.couture.label = 'Maison Élysée';
  }

  // Nova Atelier (combinaisons de haute technologie), sud-ouest
  {
    const th = -Math.PI * 0.73;
    pavilion(th, 0.36);
    logo('NOVA ATELIER', '#9fe8ff', th, 4.0);
    for (let k = -1; k <= 1; k++) {
      const thk = th + k * 0.18, p = P(thk, 17.2);
      add(new THREE.CylinderGeometry(0.75, 0.8, 0.25, 48), graphite, M4(p.clone().setY(Y + 0.125)), { collide: true });
      add(new THREE.TorusGeometry(0.72, 0.02, 6, 64), glowCyan, M4(p.clone().setY(Y + 0.26), 0, [1, 1, 1], Math.PI / 2));
      add(new THREE.CylinderGeometry(0.72, 0.72, 2.3, 48, 1, true), glassM, M4(p.clone().setY(Y + 1.4)));
      add(new THREE.CylinderGeometry(0.78, 0.78, 0.18, 48), graphite, M4(p.clone().setY(Y + 2.62)));
      add(new THREE.TorusGeometry(0.7, 0.02, 6, 64), glowCyan, M4(p.clone().setY(Y + 2.52), 0, [1, 1, 1], Math.PI / 2));
      out.suits.push({ p: p.clone().setY(Y + 0.25), face: faceIn(thk), k: k + 1 });
    }
    // établi holographique : silhouette de combinaison en fil de lumière
    { const p = P(th + 0.26, 15.2); add(new THREE.CylinderGeometry(0.6, 0.6, 0.9, 32), graphite, M4(p.clone().setY(Y + 0.45)), { collide: true }); add(new THREE.CylinderGeometry(0.55, 0.55, 0.02, 32), glowCyan, M4(p.clone().setY(Y + 0.91)));
      const holo = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 4, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2, 2.8), wireframe: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); holo.position.copy(p).setY(Y + 1.45); scene.add(holo);
      ctx.updaters.push((dt, t) => { holo.rotation.y = t * 0.8; }); out.holo = holo; }
    out.spots.nova = desk(th - 0.26, 16.6, 1.8);
    out.spots.nova.label = 'Nova Atelier';
  }

  // Aérodyne (yachts stellaires), est
  {
    const th = Math.PI * 0.5;
    pavilion(th, 0.44, 4.2);
    logo('AÉRODYNE', '#ffffff', th, 4.4, 3.6);
    const c = P(th, 13.6);
    const turn = new THREE.Group(); turn.position.copy(c).setY(Y); scene.add(turn);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.5, 0.18, 96), graphite); plate.position.y = 0.09; plate.receiveShadow = true; turn.add(plate);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(5.42, 0.03, 6, 160), glowCyan); edge.rotation.x = Math.PI / 2; edge.position.y = 0.17; turn.add(edge);
    const ship = yacht(); ship.position.y = 0.18; turn.add(ship);
    B.colliderBox(9.6, 2.5, 9.6, [c.x, Y + 1.25, c.z]);
    ctx.updaters.push((dt) => { if (turn.visible) turn.rotation.y += dt * 0.12; });
    out.turntable = turn;
    // fiche technique holographique
    const spec = new Screen(512, 320, (g, w, h) => {
      g.fillStyle = 'rgba(6,14,22,0.92)'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8fe0ff'; g.lineWidth = 2; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#ffffff'; g.font = `700 30px ${FONT}`; g.fillText('AÉRODYNE  SÉRIE 9', 26, 54);
      g.fillStyle = '#8fe0ff'; g.font = `500 17px ${FONT}`; g.fillText('Yacht stellaire · 4 passagers · 2 suites', 26, 84);
      const L = [['Longueur', '11,2 m'], ['Saut quantique', '72 Gm'], ['Vitesse de croisière', '1 280 m/s'], ['Intérieur', 'cuir de culture, noyer fossile'], ['Bouclier', 'Égide S4 intégré'], ['Prix', '48 500 000 ¤ · sur commande']];
      L.forEach(([a, b], i) => { g.fillStyle = '#9aa6b2'; g.font = `500 16px ${FONT}`; g.fillText(a, 26, 126 + i * 30); g.fillStyle = i === 5 ? '#ffd27a' : '#f2f2f2'; g.font = `600 16px ${FONT}`; g.fillText(b, 230, 126 + i * 30); });
    }, { period: 1e9, intensity: 1.4 });
    ctx.screens.push(spec);
    const sp = P(th - 0.36, 15.6), sm = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.25), spec.material); sm.position.copy(sp).setY(Y + 1.6); sm.rotation.y = faceIn(th - 0.36); scene.add(sm);
    add(new THREE.CylinderGeometry(0.04, 0.12, 1.0, 16), chrome, M4(sp.clone().setY(Y + 0.5)));
    out.spots.aero = { pos: P(th - 0.36, 14.5), staff: P(th - 0.3, 15.3), face: faceIn(th - 0.3) };
  }

  // Le Zénith (salon-bar), nord-est
  {
    const th = Math.PI * 0.12;
    pavilion(th, 0.3, 3.8);
    logo('LE ZÉNITH', '#ffd27a', th, 3.4, 3.25);
    // comptoir courbe en onyx rétroéclairé
    const r = 17.2, span = 0.2;
    add(new THREE.CylinderGeometry(r, r, 1.08, 64, 1, true, th - span, span * 2), ds(new THREE.MeshPhysicalMaterial({ map: marble('#d8a860', '#6a4010', '#fff0c0', 512, 11), emissive: new THREE.Color(0.55, 0.32, 0.08), emissiveMap: null, roughness: 0.15, clearcoat: 1 })), M4(O.clone().setY(Y + 0.54)));
    arcSlab(r - 0.08, r + 0.5, th - span, th + span, 0.06, Y + 1.08, graphite);
    arcSlab(r + 0.02, r + 0.45, th - span, th + span, 1.08, Y, graphite, true);
    // étagères de bouteilles rétroéclairées
    for (const y of [1.4, 1.95, 2.5]) {
      arcSlab(19.95, 20.45, th - 0.24, th + 0.24, 0.03, Y + y, glowGold);
      for (let i = 0; i < 16; i++) { const thb = th - 0.22 + (i / 15) * 0.44, p = P(thb, 20.15, y + 0.02); add(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 12), new THREE.MeshPhysicalMaterial({ color: [0x2a5a2a, 0x6a2a10, 0xd8c890, 0x1a1a3a][i % 4], roughness: 0.05, transmission: 0, clearcoat: 1, metalness: 0.2 }), M4(p.clone().setY(Y + y + 0.17))); }
    }
    out.spots.bar = { pos: P(th, r - 0.9), bartender: P(th, r + 1.1), faceBartender: faceIn(th) };
    // tabourets
    for (let i = 0; i < 5; i++) {
      const ths = th - 0.16 + i * 0.08, p = P(ths, r - 0.75);
      add(new THREE.CylinderGeometry(0.21, 0.19, 0.08, 32), velvet(0x5a1a22), M4(p.clone().setY(Y + 0.78)));
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.74, 12), chrome, M4(p.clone().setY(Y + 0.37)));
      add(new THREE.CylinderGeometry(0.2, 0.22, 0.02, 32), chrome, M4(p.clone().setY(Y + 0.01)));
      out.stools.push({ p, yaw: ths, taken: null });
    }
    // banquettes courbes en velours et tables basses
    for (const [ths, rr] of [[th + 0.42, 12.6], [th - 0.05, 11.6]]) {
      const n = 6, sp = 0.08;
      for (let i = 0; i < n; i++) {
        const tt = ths + (i - (n - 1) / 2) * sp, p = P(tt, rr + 0.35);
        add(new THREE.BoxGeometry(0.95, 0.42, 0.62), velvet(0x1c2a3a), M4(p.clone().setY(Y + 0.21), tt), { collide: true });
        add(new THREE.BoxGeometry(0.95, 0.5, 0.16), velvet(0x1c2a3a), M4(P(tt, rr + 0.62, 0.55), tt));
        if (i % 2 === 0) out.seats.push({ p: P(tt, rr + 0.32), yaw: faceIn(tt), taken: null });
      }
      add(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 48), whiteMarble, M4(P(ths, rr - 0.9, 0.42)));
      add(new THREE.CylinderGeometry(0.2, 0.32, 0.4, 24), gold, M4(P(ths, rr - 0.9, 0.2)), { collide: true });
      for (let i = 0; i < 3; i++) { const q = P(ths + (i - 1) * 0.03, rr - 0.9, 0.445); add(new THREE.CylinderGeometry(0.03, 0.006, 0.14, 12), glassM, M4(q.clone().setY(Y + 0.52))); add(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), glassM, M4(q.clone().setY(Y + 0.485))); }
    }
  }

  // Conciergerie face à l'ascenseur, et galerie d'observation au sud (banquettes face à l'espace)
  out.spots.concierge = desk(-Math.PI / 2 + 0.22, 14.2, 2.0);
  for (const th of [Math.PI * 0.86, Math.PI, -Math.PI * 0.94]) {
    const p = P(th, 18.6), yaw = th;
    add(new THREE.BoxGeometry(2.4, 0.42, 0.7), velvet(0xd8d0c0), M4(p.clone().setY(Y + 0.21), yaw), { collide: true });
    add(new THREE.BoxGeometry(2.6, 0.06, 0.8), gold, M4(p.clone().setY(Y + 0.03), yaw));
    for (const d of [-0.7, 0.7]) out.seats.push({ p: p.clone().add(new THREE.Vector3(Math.cos(yaw) * d, 0, -Math.sin(yaw) * d)), yaw, taken: null, view: true });
  }
  // jardinières de verre (plantes) entre les pavillons
  const MD = ctx.models;
  for (const th of [-Math.PI * 0.5 - 0.42, -Math.PI * 0.5 + 0.5, Math.PI * 0.3, Math.PI * 0.72, -Math.PI * 0.95]) {
    const p = P(th, 19.0);
    add(new THREE.CylinderGeometry(0.75, 0.6, 0.8, 48), whiteMarble, M4(p.clone().setY(Y + 0.4)), { collide: true });
    add(new THREE.TorusGeometry(0.75, 0.025, 6, 64), gold, M4(p.clone().setY(Y + 0.8), 0, [1, 1, 1], Math.PI / 2));
    if (MD?.has('potted_plant_02')) MD.place(B, low ? 'potted_plant_04' : 'potted_plant_02', p.x, Y + 0.78 - (low ? 0.55 : 0.6), p.z, { fit: ['y', 1.8], ry: th });
  }
  // sphère des tendances d'Iréna Solvay (galerie d'observation, au sud) : anneaux de calculs, nuage de trajectoires
  {
    const th = Math.PI - 0.2, base = P(th, 14.4);
    add(new THREE.CylinderGeometry(0.55, 0.75, 0.9, 48), graphite, M4(base.clone().setY(Y + 0.45)), { collide: true });
    add(new THREE.TorusGeometry(0.6, 0.02, 6, 64), glowCyan, M4(base.clone().setY(Y + 0.88), 0, [1, 1, 1], Math.PI / 2));
    const sph = new THREE.Group(); sph.position.copy(base).setY(Y + 2.1); scene.add(sph);
    const glyphTex = (seed) => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 64; const g = c.getContext('2d');
      let q = seed; const r = () => { q = (q * 16807) % 2147483647; return q / 2147483647; };
      const sy = ['Σ', '∫', '∂', 'λ', 'Ψ', 'Δ', 'ψ', '∞', '≈', 'μ', 'σ', '√', 'π', 'Ω', '∇', '→', '·', '='];
      g.font = '600 34px monospace'; g.fillStyle = '#ffffff';
      let x = 0; while (x < 1024) { const t = r() < 0.55 ? sy[Math.floor(r() * sy.length)] : String(Math.floor(r() * 1000) / 100); g.globalAlpha = 0.45 + r() * 0.55; g.fillText(t, x, 44); x += g.measureText(t).width + 8 + r() * 10; }
      const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
    };
    const bands = [];
    for (const [r, tilt, col, sd] of [[0.9, 0.2, [0.5, 1.8, 2.6], 3], [1.05, -0.5, [2.4, 1.8, 0.7], 7], [1.2, 1.05, [0.6, 2.0, 2.4], 11]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 96, 1, true), new THREE.MeshBasicMaterial({ map: glyphTex(sd), color: new THREE.Color(...col), transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = tilt; sph.add(m); bands.push(m);
    }
    const N = 1400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, rr = 0.75 * Math.cbrt(Math.random()); pos.set([Math.sqrt(1 - u * u) * Math.cos(a) * rr, u * rr, Math.sqrt(1 - u * u) * Math.sin(a) * rr], i * 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cloud = new THREE.Points(pg, new THREE.PointsMaterial({ color: new THREE.Color(1.6, 2.2, 2.6), size: 0.025, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); sph.add(cloud);
    const curve = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.008, 4, 96, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.6) })); curve.rotation.set(0.6, 0, 0.3); sph.add(curve);
    ctx.updaters.push((dt, t) => { if (!sph.visible) return; sph.rotation.y = t * 0.12; bands.forEach((b, i) => { b.rotation.y = t * (0.2 + i * 0.07) * (i % 2 ? -1 : 1); b.material.map.offset.x = (t * 0.02 * (i + 1)) % 1; }); cloud.rotation.y = -t * 0.3; curve.rotation.z = 0.3 + Math.sin(t * 0.4) * 0.4; });
    out.sphere = sph;
    out.irenaSpot = { p: P(th + 0.07, 13.2), face: Math.atan2(base.x - P(th + 0.07, 13.2).x, base.z - P(th + 0.07, 13.2).z), talk: P(th + 0.1, 12.0) };
  }
  // parcours de promenade (anneau de 8,5 m) et arrêts devant les vitrines
  for (let k = 0; k < 16; k++) out.loop.push(P((k / 16) * Math.PI * 2, 8.6));

  // ---------------------------------------------------------------- ascenseur panoramique (verre) : pont habitat ↔ La Couronne
  {
    const { c, x0, x1 } = LIFT, y0 = DECK_Y - 0.4, y1 = Y + 3.4;
    const post = (x, z) => add(new THREE.BoxGeometry(0.12, y1 - y0, 0.12), pearl, M4(new THREE.Vector3(x, (y0 + y1) / 2, z)));
    for (const x of [x0, x1]) for (const z of [c - 1.35, c + 1.35]) post(x, z);
    add(new THREE.BoxGeometry(0.03, y1 - y0, 2.6), glassM, M4(new THREE.Vector3(x0, (y0 + y1) / 2, c)), { collide: true });
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(2.4, y1 - y0, 0.03), glassM, M4(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, c + s * 1.35)), { collide: true });
    add(new THREE.BoxGeometry(0.03, Y - 3.2 - DECK_Y, 2.6), glassM, M4(new THREE.Vector3(x1, (DECK_Y + 3.0 + Y - 0.2) / 2, c)));
    for (let y = DECK_Y + 4; y < Y; y += 2.5) add(new THREE.TorusGeometry(0.05, 0.02, 4, 8), glowGold, M4(new THREE.Vector3(x1 + 0.02, y, c - 1.3)));
    for (const y of [DECK_Y, Y]) B.colliderBox(2.4, 0.3, 2.6, [(x0 + x1) / 2, y - 0.15, c]);
    add(new THREE.BoxGeometry(2.7, 0.2, 2.9), pearl, M4(new THREE.Vector3((x0 + x1) / 2, y1 + 0.1, c)));
    // cabine vitrée
    const cab = new THREE.Group();
    const cm = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); cab.add(o); return o; };
    cm(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 48), graphite, 1.2, -0.06, 0);
    cm(new THREE.RingGeometry(0.9, 1.0, 64).rotateX(-Math.PI / 2), glowGold, 1.2, 0.005, 0);
    cm(new THREE.CylinderGeometry(1.15, 1.15, 0.1, 48), pearl, 1.2, 2.75, 0);
    cm(new THREE.TorusGeometry(0.9, 0.03, 6, 64).rotateX(Math.PI / 2), glowWhite, 1.2, 2.68, 0);
    cm(new THREE.CylinderGeometry(1.12, 1.12, 2.6, 48, 1, true, Math.PI * 0.62, Math.PI * 1.76), glassM, 1.2, 1.35, 0);
    cm(new THREE.TorusGeometry(1.12, 0.025, 6, 64, Math.PI * 1.76).rotateX(Math.PI / 2).rotateY(Math.PI * 0.12), gold, 1.2, 1.0, 0);
    const panel = cm(new THREE.BoxGeometry(0.05, 0.4, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 0.6) }), 0.15, 1.3, 0.6);
    cab.position.set(x0 + 0.05, DECK_Y, c); scene.add(cab);
    const doors = {};
    for (const y of [DECK_Y, Y]) {
      add(new THREE.BoxGeometry(0.2, 0.35, 2.7), pearl, M4(new THREE.Vector3(x1, y + 2.85, c)));
      add(new THREE.BoxGeometry(0.22, 0.03, 2.2), glowGold, M4(new THREE.Vector3(x1 + 0.01, y + 2.66, c)));
      const leaves = [];
      for (const s2 of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.6, 0.9), glassM); m.position.set(x1, y + 1.3, c + s2 * 0.45); scene.add(m);
        const fr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 0.04), gold); fr.position.set(0, 0, s2 * 0.43); m.add(fr);
        leaves.push({ m, s: s2, base: c + s2 * 0.45 });
      }
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.5, 0.3) }));
      lamp.position.set(x1 + 0.15, y + 3.1, c); scene.add(lamp);
      const door = {
        x: x1, z: c, y, w: 1.8, h: 2.6, open: 0, target: 0, leaves, lamp, shaft: null,
        box: new THREE.Box3(new THREE.Vector3(x1 - 0.15, y, c - 0.9), new THREE.Vector3(x1 + 0.15, y + 2.6, c + 0.9)),
        update(dt, actors) {
          const S = this.shaft, here = S && !S.moving && Math.abs(S.y - this.y) < 0.05;
          let near = false;
          if (here) for (const p of actors) if (Math.abs(p.x - this.x) < 2.6 && Math.abs(p.z - this.z) < 1.6 && Math.abs((p.y ?? 0) - this.y) < 2) { near = true; break; }
          const P2 = ctx.player?.pos; if (here && P2 && Math.abs(P2.x - this.x) < 2.6 && Math.abs(P2.z - this.z) < 1.6 && Math.abs(P2.y - this.y) < 2) near = true;
          this.target = here && (near || S.hold > 0) ? 1 : 0;
          this.open += Math.sign(this.target - this.open) * Math.min(Math.abs(this.target - this.open), dt * 1.8);
          const e = this.open * this.open * (3 - 2 * this.open);
          for (const l of leaves) l.m.position.z = l.base + l.s * e * 0.85;
          lamp.material.color.setRGB(here ? 2.4 : 4, here ? 2.0 : 1.5, 0.3);
        },
      };
      ctx.doors.push(door);
      doors[y] = door;
    }
    const S = { c, x0, x1, cab, panel, doors, y: DECK_Y, moving: false, hold: 0, levels: [DECK_Y, Y], inside: (y) => new THREE.Vector3(x0 + 1.15, y, c) };
    doors[DECK_Y].shaft = doors[Y].shaft = S;
    out.shafts.push(S);
    // enseigne dans le hall du pont habitat
    const nt = neonTexture('LA COURONNE · GALERIE DE PRESTIGE ▲', '#ffd27a', { size: 80 });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2 / nt.aspect), neonMaterial(nt.tex, 2.0));
    sg.position.set(x1 + 0.3, DECK_Y + 3.35, c); sg.rotation.y = Math.PI / 2; scene.add(sg);
  }

  // ---------------------------------------------------------------- éclairage (actif quand le joueur est à l'étage)
  const lp = low ? [[0, 0, 7]] : [[0, 0, 7], [-Math.PI * 0.27, 15, 3.5], [-Math.PI * 0.73, 15, 3.5], [Math.PI * 0.5, 13, 6], [Math.PI * 0.12, 15, 3.4]];
  for (const [th, r, y] of lp) { const l = new THREE.PointLight(0xffe6c8, r === 0 ? 60 : 30, r === 0 ? 30 : 14, 2); l.position.copy(P(th, r, y)); l.visible = false; scene.add(l); out.lights.push(l); }
  out.dynamic = [dome, orrery, out.turntable, out.holo, out.sphere];
  out.onLevel = (p) => p.y > Y - 5;
  out.P = P; out.faceIn = faceIn;
  return out;
}

// ======================================================================== clientèle et personnel
const RICH = [
  { top: 0xf4f0e8, bottom: 0xf4f0e8, boot: 0xd8c8a8, accent: 0xd4af37, zip: true, belt: true },
  { top: 0x121417, bottom: 0x121417, boot: 0x0a0a0a, accent: 0xd4af37, zip: true },
  { top: 0x6a1222, bottom: 0x1a1214, boot: 0x0e0a0a, accent: 0xe8c878, belt: true },
  { top: 0xe8e4f0, bottom: 0x2a2c3a, boot: 0x1a1a22, accent: 0x9fd8ff, zip: true },
  { top: 0x1a2a4a, bottom: 0x1a2a4a, boot: 0x0e1018, accent: 0xd8d8e8, zip: true, belt: true },
  { top: 0xd8c8a0, bottom: 0x3a3226, boot: 0x2a2018, accent: 0xf4f0e8, belt: true },
];
export const LUX_SUITS = [
  { tier: 2, plate: 0xf2f0ea, under: 0x2a2c30, accent: 0xd4af37, light: 0xffe0a0 },
  { tier: 3, plate: 0x16181c, under: 0x0a0b0c, accent: 0x4ad8ff, light: 0x6fe8ff },
  { tier: 3, plate: 0xe8e4dc, under: 0x3a3226, accent: 0xd4af37, light: 0xfff0c0 },
];

/** Personnages de La Couronne : mannequins vivants, combinaisons exposées, personnel, clientèle fortunée. */
export function populateLuxury(ctx, lib, player, L) {
  const { scene } = ctx;
  const people = [], spin = [], walkers = [];
  const looks = [['UF_light', 'Hair_Buns'], ['UM_dark', 'Hair_SimpleParted'], ['UF_dark', 'Hair_Long'], ['UM_light', 'Hair_Beard'], ['UF_light', 'Hair_Long'], ['UM_dark', 'Hair_Buzzed']];
  const mk = (i, outfit, p, yaw, anim, extra = {}) => {
    const [model, hair] = looks[i % looks.length];
    const c = lib.create(model, { height: model.startsWith('UF') ? 1.72 : 1.84, hair, hairColor: [0x1a120c, 0xd8c098, 0x3a2414, 0x0a0a0a][i % 4], ...extra });
    c.setOutfit(outfit); c.root.position.copy(p); c.root.rotation.y = yaw;
    if (anim) c.play(anim, { fade: 0 });
    c.root.traverse((o) => { o.castShadow = false; });
    c.root.visible = false; scene.add(c.root); people.push(c); return c;
  };
  // mannequins vivants sur podiums tournants (Maison Élysée)
  for (const m of L.mannequins) { const c = mk(m.k * 2, RICH[m.k], m.p.clone().setY(LUX_Y + 0.22), m.face, null); c.noTalk = true; spin.push({ c, sp: 0.18 }); }
  // combinaisons de haute technologie dans les vitrines (Nova Atelier)
  for (const s of L.suits) { const c = mk(s.k + 1, { top: 0x1a1c20, bottom: 0x1a1c20, boot: 0x0a0a0a, accent: LUX_SUITS[s.k].accent, gloves: true }, s.p, s.face, null, { armor: LUX_SUITS[s.k], armorShadows: false }); c.noTalk = true; spin.push({ c, sp: -0.25 }); }
  // ---------------------------------------------------------------- moteur de routines (déplacements, actions, attentes)
  const turnTo0 = (c, yaw, dt, k = 6) => { let d = yaw - c.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); c.root.rotation.y += d * (1 - Math.exp(-dt * k)); };
  const step = (n, dt) => {
    if (n.c.inDialog) { n.c.setSpeed(0); return; }
    if (!n.q.length) n.q = n.plan(n);
    const s = n.q[0], c = n.c;
    if (!s) return;
    if (s.fn) { n.q.shift(); n.t = 0; s.fn(n); return; }
    if (s.moveF && !s.move) s.move = s.moveF(n);
    if (s.move) {
      const d = new THREE.Vector3().subVectors(s.move, n.pos).setY(0), len = d.length();
      s.each?.(n, dt);
      if (len < 0.08) { n.q.shift(); return; }
      n.pos.addScaledVector(d.normalize(), Math.min(len, (s.speed || 1.05) * dt));
      c.root.position.copy(n.pos); turnTo0(c, Math.atan2(d.x, d.z), dt, 8); c.setSpeed(s.speed || 1.05);
      if (c.override) c.stop(0.25);
    } else {
      if (n.t === 0) { c.setSpeed(0); if (s.anim && s.anim !== 'idle') c.play(s.anim, { fade: 0.35 }); else if (c.override) c.stop(0.3); }
      n.t += dt;
      if (s.face !== undefined) turnTo0(c, typeof s.face === 'function' ? s.face(n) : s.face, dt);
      if (s.until ? s.until(n, dt) : n.t >= s.dur) { n.t = 0; n.q.shift(); }
    }
  };
  const actors = [];
  const actor = (c, plan, opts = {}) => { const n = { c, plan, q: [], pos: c.root.position.clone(), t: 0, ...opts }; actors.push(n); return n; };
  const R2 = (a, b) => a + Math.random() * (b - a);
  const LP = L.P, FI = L.faceIn, at = (th, r) => LP(th, r), out = (th) => th;   // out : regard vers l'extérieur (vitrine)
  const w = (th, r, sp) => ({ move: at(th, r), speed: sp });
  const act = (anim, dur, face) => ({ anim, dur, face });

  // ---------------------------------------------------------------- personnel : chacun sa routine de travail
  const staff = { top: 0x121417, bottom: 0x121417, boot: 0x0a0a0a, accent: 0xd4af37, zip: true };
  const S = L.spots, T0 = -Math.PI * 0.27, T1 = -Math.PI * 0.73, TA = Math.PI * 0.5, TB = Math.PI * 0.12, TC = -Math.PI / 2 + 0.22;
  // conciergerie : accueil, saisie au terminal, accueil des arrivants
  const conciergeC = mk(0, staff, S.concierge.clerk, S.concierge.faceClerk, null);
  actor(conciergeC, () => [act('talk', R2(4, 7), FI(TC)), act('idle', R2(2, 4), FI(TC)), w(TC + 0.08, 15.2), act('interact', R2(3, 5), FI(TC + 0.08)), w(TC, 15.2), act('idle', R2(2, 3), FI(TC))]);
  // Maison Élysée : comptoir, retouches aux portants, coup d'œil aux mannequins, pliage sur la table
  actor(mk(4, { ...staff, accent: 0xf4f0e8 }, S.couture.clerk, S.couture.faceClerk, null), () => [
    act(Math.random() < 0.5 ? 'talk' : 'idle', R2(4, 7), FI(T0 - 0.24)),
    w(T0 - 0.27, 18.55), act('interact', R2(3, 5), out(T0 - 0.27)),
    w(T0 - 0.24, 18.4), w(T0 - 0.15, 18.4), w(T0 + 0.12, 19.0), act('idle', 2, out(T0 + 0.12)),
    w(T0 + 0.27, 18.55), act('interact', R2(3, 5), out(T0 + 0.27)),
    w(T0 + 0.22, 17.0), w(T0 + 0.17, 15.25), act('idle', R2(2, 4), out(T0 + 0.17)),
    w(T0 - 0.1, 14.55), act('interact', R2(3, 5), FI(T0 - 0.1)),
    w(T0 - 0.15, 16.8), w(T0 - 0.15, 18.4), w(T0 - 0.24, 18.4),
  ]);
  // Nova Atelier : comptoir, contrôle des vitrines, réglage de l'établi holographique
  actor(mk(1, { ...staff, accent: 0x6fe8ff }, S.nova.clerk, S.nova.faceClerk, null), () => [
    act('idle', R2(4, 7), FI(T1 - 0.26)),
    w(T1 - 0.33, 17.6), w(T1 - 0.33, 15.9), w(T1 - 0.18, 16.0), act('interact', R2(3, 4), out(T1 - 0.18)),
    w(T1, 16.0), act('idle', R2(2, 3), out(T1)), w(T1 + 0.18, 16.0), act('interact', R2(3, 4), out(T1 + 0.18)),
    w(T1 + 0.26, 14.3), act('interact', R2(4, 6), out(T1 + 0.26)),
    w(T1 - 0.33, 15.9), w(T1 - 0.33, 17.6), w(T1 - 0.26, 17.6),
  ]);
  // Aérodyne : présentation du yacht, retour à la fiche technique
  actor(mk(3, { top: 0xf4f0e8, bottom: 0x2a2c30, boot: 0x1a1a1a, accent: 0x8fe0ff, zip: true }, S.aero.staff, S.aero.face, null), () => [
    act('talk', R2(4, 7), S.aero.face), w(TA - 0.5, 12.0), w(TA - 0.45, 8.2), w(TA - 0.2, 7.7),
    act('talk', R2(4, 6), (n) => Math.atan2(L.turntable.position.x - n.pos.x, L.turntable.position.z - n.pos.z)),
    w(TA - 0.45, 8.2), w(TA - 0.5, 12.0), w(TA - 0.3, 15.3),
  ]);
  // barman : service, essuyage du comptoir, bouteille sur l'étagère
  actor(mk(5, { top: 0x1a1214, bottom: 0x121417, boot: 0x0a0a0a, accent: 0xffd27a, zip: true }, S.bar.bartender, S.bar.faceBartender, null), () => [
    act('talk', R2(3, 6), FI(TB)), w(TB - 0.14, 18.3), act('interact', R2(3, 5), FI(TB - 0.14)),
    w(TB + 0.08, 18.9), act('pickup', 2.4, out(TB + 0.08)), w(TB + 0.14, 18.3), act('interact', R2(2, 4), FI(TB + 0.14)), w(TB, 18.3),
  ]);
  // sécurité privée : ronde autour de l'arrivée de l'ascenseur
  actor(mk(1, { top: 0x1a1c20, bottom: 0x1a1c20, boot: 0x0a0a0a, accent: 0xd4af37, gloves: true }, LP(-Math.PI / 2 - 0.16, 16.4), FI(-Math.PI / 2 - 0.16), null, { armor: { tier: 2, plate: 0x24272c, under: 0x101214, accent: 0xd4af37, light: 0xffd27a }, armorShadows: false }), () => [
    act('idle', R2(6, 10), FI(-Math.PI / 2 - 0.16)), w(-Math.PI / 2 + 0.45, 16.6, 0.8), act('idle', R2(4, 6), FI(-Math.PI / 2 + 0.45)),
    w(-Math.PI / 2 - 0.5, 16.6, 0.8), act('idle', R2(4, 6), FI(-Math.PI / 2 - 0.5)), w(-Math.PI / 2 - 0.16, 16.4, 0.8),
  ]);
  for (const n of actors) n.c.talkRole = 'personnel';
  // Iréna Solvay, prévisionniste, devant sa sphère
  const irenaC = mk(2, { top: 0x14303a, bottom: 0x1a1c22, boot: 0x0e0e10, accent: 0xd4af37, zip: true, belt: true }, L.irenaSpot.p, L.irenaSpot.face, null);
  L.npcs = { concierge: conciergeC, irena: irenaC };
  // clientèle assise (salon)
  L.seats.slice(0, 5).forEach((st, i) => { st.taken = true; const c = mk(i + 2, RICH[(i + 2) % RICH.length], st.p, st.yaw, i % 2 ? 'sitTalk' : 'sit'); if (i === 1) L.npcs.aldric = c; });

  // ---------------------------------------------------------------- visiteurs fortunés : de leur cabine du pont habitat à
  // La Couronne par l'ascenseur panoramique, quelques vitrines, le bar ou la vue, puis retour en cabine
  const SH = L.shafts, HB = ctx.habitat;
  const inCab = (Sh) => { const P = player.pos; return P.x > Sh.x0 - 0.2 && P.x < Sh.x1 - 0.1 && Math.abs(P.z - Sh.c) < 1.1 && Math.abs(P.y - Sh.y) < 3; };
  const liftSteps = (fromY, toY) => {
    const Sh = SH[0];
    Sh.boarding ||= new Set(); Sh.waiting ||= new Set();
    let inner;
    return [
      { fn: (n) => Sh.waiting.add(n) },
      { moveF: () => new THREE.Vector3(Sh.x1 + 1.2 + Math.random() * 1.0, fromY, Sh.c + (Math.random() - 0.5) * 1.7) },
      { anim: 'idle', face: -Math.PI / 2, until: () => {
        const E = ctx.luxLift; if (!E) return false;
        if (E.isAt(Sh, fromY)) { Sh.hold = Math.max(Sh.hold, 1.2); return Sh.doors[fromY].open > 0.85; }
        if (!Sh.moving) E.call(Sh, fromY, 'npc');
        return false;
      } },
      { fn: (n) => { Sh.waiting.delete(n); Sh.boarding.add(n); inner = new THREE.Vector3(Sh.x0 + 0.7 + Math.random() * 0.9, fromY, Sh.c + (Math.random() - 0.5) * 1.1); } },
      { moveF: () => inner, speed: 0.9, each: () => { Sh.hold = Math.max(Sh.hold, 1.0); } },
      { fn: (n) => { Sh.boarding.delete(n); n.cab = Sh; n.wait = 0; } },
      { anim: 'idle', face: Math.PI / 2, until: (n, dt) => {
        const E = ctx.luxLift;
        if (Sh.moving) { n.pos.y = Sh.y; n.c.root.position.y = Sh.y; return false; }
        if (Math.abs(Sh.y - toY) < 0.05) { n.pos.y = n.c.root.position.y = toY; Sh.hold = Math.max(Sh.hold, 1.2); return Sh.doors[toY].open > 0.85; }
        n.wait += dt;
        if (E && n.wait > 2.2 && !Sh.boarding.size && ![...Sh.waiting].some((x) => Math.abs(x.pos.y - Sh.y) < 1) && !inCab(Sh)) E.send(Sh, toY);
        return false;
      } },
      { fn: (n) => { n.cab = null; } },
      { moveF: () => new THREE.Vector3(Sh.x1 + 1.9, toY, Sh.c + (Math.random() - 0.5) * 1.2), each: () => { Sh.hold = Math.max(Sh.hold, 0.6); } },
    ];
  };
  // déplacements sous la coupole : par l'anneau de promenade (8,6 m) pour contourner bassin, plateau et comptoirs
  const angOf = (p) => Math.atan2(p.x - LP(0, 0).x, p.z - LP(0, 0).z);
  const ring = (a0, a1) => {
    let d = a1 - a0; d = Math.atan2(Math.sin(d), Math.cos(d));
    const n = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI / 8))), pts = [];
    for (let i = 0; i <= n; i++) pts.push({ move: at(a0 + (d * i) / n, 8.6) });
    return pts;
  };
  const goTo = (n, th, r, extra = []) => { const a = angOf(n.pos); return [{ move: at(a, 8.6) }, ...ring(a, th).slice(1), { move: at(th, r) }, ...extra]; };
  const STOPS = [
    () => { const th = T0 - 0.24; return [...goToL(th, 16.4), act('talk', R2(5, 9), out(th)), act('idle', R2(2, 4), out(th))]; },
    () => { const th = T1 - 0.26; return [...goToL(th, 15.7), act('talk', R2(5, 9), out(th)), act('idle', R2(2, 3), out(th))]; },
    () => { const th = T0 + (Math.floor(Math.random() * 3) - 1) * 0.17; return [...goToL(th, 15.1), act('idle', R2(4, 7), out(th))]; },
    () => { const th = T1 + (Math.floor(Math.random() * 3) - 1) * 0.18; return [...goToL(th, 15.6), act('idle', R2(4, 7), out(th))]; },
    () => { const th = TA - 0.55; return [...goToL(th, 12.5), act(Math.random() < 0.5 ? 'talk' : 'idle', R2(5, 9), (n) => Math.atan2(L.turntable.position.x - n.pos.x, L.turntable.position.z - n.pos.z))]; },
    () => { const th = TB + R2(-0.12, 0.12); return [...goToL(-0.07, 16.2), { move: at(th, 16.15) }, act('talk', R2(6, 12), out(th)), { move: at(-0.07, 16.2) }]; },
    () => {
      const st = L.seats.filter((x) => x.view && !x.taken)[0];
      if (!st) return [];
      const th = angOf(st.p);
      return [{ fn: () => { st.taken = true; } }, ...goToL(th, 17.6), { move: st.p.clone(), speed: 0.6 }, act('sit', R2(15, 28), st.yaw), act('idle', 0.8, st.yaw), { move: at(th, 17.4) }, { fn: () => { st.taken = null; } }];
    },
  ];
  let cur = null;
  const goToL = (th, r) => goTo(cur, th, r);
  const homes = HB.cabinDoors;
  const visitPlan = (n) => {
    if (!ctx.time.open('galerie')) return [{ fn: (m) => { m.away = 60; } }];
    const home = homes[Math.floor(Math.random() * homes.length)];
    n.c.setOutfit(RICH[Math.floor(Math.random() * RICH.length)]);
    n.pos.copy(home.pos); n.c.root.position.copy(home.pos); n.c.root.rotation.y = Math.PI;
    return [{ move: home.pos.clone().add(new THREE.Vector3(0, 0, -1.2)) }, ...liftSteps(DECK_Y, LUX_Y), ...luxStroll(), ...leave()];
  };
  const luxStroll = () => {
    const picks = [...STOPS].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
    return picks.map((f) => ({ fn: (m) => { cur = m; m.q.unshift(...f()); } }));
  };
  const leave = () => [
    { fn: (m) => { cur = m; m.q.unshift(...goToL(-Math.PI / 2, 14.6)); } },
    ...liftSteps(LUX_Y, DECK_Y),
    { fn: (m) => { const home = homes[Math.floor(Math.random() * homes.length)]; m.q.unshift({ move: home.pos.clone().add(new THREE.Vector3(0, 0, -1.2)) }, { move: home.pos.clone() }, { fn: (k) => { k.away = R2(15, 50); } }); } },
  ];
  const visitors = [];
  const nV = ctx.quality.name === 'low' ? 4 : 7;
  for (let i = 0; i < nV; i++) {
    const c = mk(i + 3, RICH[i % RICH.length], homes[0].pos, 0, null);
    const n = actor(c, visitPlan, { visitor: true });
    if (i < nV / 2) { const p = at((i / nV) * Math.PI * 2, 8.6); n.pos.copy(p); c.root.position.copy(p); n.q = [...luxStroll(), ...leave()]; }
    else n.away = R2(2, 40);
    visitors.push(n);
  }
  // promeneurs : tour du bassin, arrêts devant les vitrines
  const stops = [S.couture.customer, S.nova.customer, LP(TA - 0.55, 12.5)];
  for (let i = 0; i < 2; i++) {
    const c = mk(i + 1, RICH[(i + 3) % RICH.length], L.loop[i * 8], 0, null);
    walkers.push({ c, i: i * 8, pause: Math.random() * 3, pos: L.loop[i * 8].clone(), detour: null, k: i });
  }
  const turnTo = (c, yaw, dt, k = 6) => { let d = yaw - c.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); c.root.rotation.y += d * (1 - Math.exp(-dt * k)); };
  const stepWalk = (w, dt) => {
    if (w.c.inDialog) { w.c.setSpeed(0); return; }
    if (w.pause > 0) { w.pause -= dt; w.c.setSpeed(0); if (w.look) turnTo(w.c, w.look, dt); if (w.pause <= 0) { if (w.c.override) w.c.stop(0.3); w.look = null; } return; }
    const T = w.detour || L.loop[w.i];
    const d = new THREE.Vector3().subVectors(T, w.pos).setY(0), len = d.length();
    if (len < 0.15) {
      if (w.detour) { w.detour = null; w.pause = 5 + Math.random() * 6; w.look = Math.atan2(L.P(0, 0).x - w.pos.x, L.P(0, 0).z - w.pos.z) + Math.PI; if (Math.random() < 0.5) w.c.play('talk', { fade: 0.4 }); return; }
      w.i = (w.i + 1) % L.loop.length;
      if (Math.random() < 0.18) { const s = stops[Math.floor(Math.random() * stops.length)]; w.detour = s.clone().setY(LUX_Y).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2)); }
      return;
    }
    w.pos.addScaledVector(d.normalize(), Math.min(len, 1.0 * dt));
    w.c.root.position.copy(w.pos);
    turnTo(w.c, Math.atan2(d.x, d.z), dt, 8);
    w.c.setSpeed(1.0);
  };
  ctx.luxPeople = people;
  ctx.updaters.push((dt) => {
    const on = L.onLevel(player.pos);
    for (const l of L.lights) l.visible = on;
    for (const o of L.dynamic) if (o) o.visible = on || o === L.dynamic[0];
    const cam = ctx.camera.position;
    // visiteurs : simulés partout (pont habitat, ascenseur, coupole), visibles au niveau du joueur
    for (const n of visitors) {
      if (n.away > 0) { n.away -= dt; n.c.root.visible = false; if (n.away <= 0) { n.away = 0; n.q = []; } else continue; }
      step(n, dt);
      const vis = Math.abs(player.pos.y - n.pos.y) < 6 && n.c.root.position.distanceToSquared(player.pos) < 3600;
      n.c.root.visible = vis;
      if (vis && n.c.root.position.distanceToSquared(cam) < 1600) n.c.update(dt, cam);
    }
    if (!on) { for (const c of people) if (!visitors.some((v) => v.c === c)) c.root.visible = false; return; }
    for (const n of actors) if (!n.visitor) step(n, dt);
    for (const w of walkers) stepWalk(w, dt);
    for (const s of spin) s.c.root.rotation.y += dt * s.sp;
    for (const c of people) { if (visitors.some((v) => v.c === c)) continue; c.root.visible = !c.gone; if (c.gone) continue; if (c.root.position.distanceToSquared(cam) < 1600) c.update(dt, cam); }
  });
  return { people, walkers, visitors, actors };
}
