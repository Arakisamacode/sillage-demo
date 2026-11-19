import * as THREE from 'three';
import { platedHull } from './hullkit.js';
import { Builder } from './builder.js';
import { HX, Z_BAY, Z_BACK, H, GALLERY, AIRLOCK } from './layout.js';

// Extérieur de la station Halden-7 (visible en vol) : enveloppe blindée du hangar et de la galerie,
// corps cylindrique de 400 m, deux anneaux habités reliés par des rayons, hublots et balises.

export function buildExterior(ctx) {
  const { mats, scene } = ctx;
  const B = new Builder(null); B.cellSize = 1000;
  const ds = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; return c; };
  const hm = {
    plate: ds(mats.paint(0x6e747a, { grime: 0.8, scratch: 0.7, rust: 0.1 })),
    alt: ds(mats.paint(0x3a3f44, { grime: 0.9, scratch: 0.7, rust: 0.15 })),
    under: ds(mats.metal(0x1d2023, { rough: 0.7 })),
  };
  const shell = mats.paint(0x5d6368, { grime: 0.8, scratch: 0.6, rust: 0.1 });
  const dark = mats.metal(0x26292c, { rough: 0.7 });
  const win = mats.emissive(0xffd9a8, 2.2);
  const winCold = mats.emissive(0xbfe0ff, 2.0);
  const add = (h) => { B.add(h.under, hm.under, new THREE.Matrix4(), { cast: false }); B.add(h.plates, hm.plate, new THREE.Matrix4(), { cast: false }); B.add(h.alt, hm.alt, new THREE.Matrix4(), { cast: false }); };
  // ---------------------------------------------------------------- enveloppe du hangar
  const zc = (Z_BAY + Z_BACK) / 2, L = Z_BACK - Z_BAY + 4;
  B.box(HX * 2 + 7, 3.5, L, shell, [0, H + 2.2, zc], null, { tex: 8, cast: false });
  // flanc est plein ; flanc ouest percé au droit du sas vers la galerie (le passage reste dégagé)
  B.box(3.4, H + 8, L, shell, [HX + 2.3, H / 2, zc], null, { tex: 8, cast: false });
  {
    const x = -(HX + 2.3), z0 = zc - L / 2, z1 = zc + L / 2, ha = AIRLOCK.z - AIRLOCK.w / 2 - 1.4, hb = AIRLOCK.z + AIRLOCK.w / 2 + 1.4, top = AIRLOCK.h + 1.6;
    B.box(3.4, H + 8, ha - z0, shell, [x, H / 2, (z0 + ha) / 2], null, { tex: 8, cast: false });
    B.box(3.4, H + 8, z1 - hb, shell, [x, H / 2, (hb + z1) / 2], null, { tex: 8, cast: false });
    B.box(3.4, H + 8 - (top + 4), hb - ha, shell, [x, top + (H + 8 - (top + 4)) / 2, AIRLOCK.z], null, { tex: 8, cast: false });
  }
  B.box(HX * 2 + 7, H + 8, 3.4, shell, [0, H / 2, Z_BACK + 2.2], null, { tex: 8, cast: false });
  B.box(HX * 2 + 7, 5, L + 16, dark, [0, -3, zc - 8], null, { tex: 8, cast: false });
  // nervures et radiateurs sur le toit
  for (let z = Z_BAY + 4; z < Z_BACK; z += 8) B.box(HX * 2 + 8, 1.2, 1.2, dark, [0, H + 4.5, z], null, { cast: false });
  for (const s of [-1, 1]) for (let z = Z_BAY + 10; z < Z_BACK - 6; z += 14) B.box(0.3, 9, 10, mats.metal(0x8a9094, { rough: 0.35 }), [s * 18, H + 8.5, z], null, { cast: false });
  // ---------------------------------------------------------------- enveloppe de la galerie
  const G = GALLERY, gx = (G.x0 + G.x1) / 2, gw = G.x1 - G.x0 + 6;
  B.box(gw, 3, G.z1 - G.z0 + 14, shell, [gx, G.h + 1.6, (G.z0 + G.z1) / 2 + 4], null, { tex: 8, cast: false });
  B.box(gw, G.h + 4, 4, shell, [gx, G.h / 2, G.z1 + 9], null, { tex: 8, cast: false });
  {
    // pignon ouest percé au droit du couloir du module habitat (porte « MODULE HABITAT », z = -11)
    const zc2 = (G.z0 + G.z1) / 2 + 4, D = G.z1 - G.z0 + 14, z0 = zc2 - D / 2, z1 = zc2 + D / 2, dz = (G.z0 + G.z1) / 2 - 4, ha = dz - 2.3, hb = dz + 2.3, top = 4.2;
    B.box(4, G.h + 4, ha - z0, shell, [G.x0 - 5, G.h / 2, (z0 + ha) / 2], null, { tex: 8, cast: false });
    B.box(4, G.h + 4, z1 - hb, shell, [G.x0 - 5, G.h / 2, (hb + z1) / 2], null, { tex: 8, cast: false });
    B.box(4, G.h + 4 - (top + 2), hb - ha, shell, [G.x0 - 5, top + (G.h + 4 - (top + 2)) / 2, dz], null, { tex: 8, cast: false });
  }
  B.box(gw, 4, G.z1 - G.z0 + 14, dark, [gx, -2.2, (G.z0 + G.z1) / 2 + 4], null, { tex: 8, cast: false });
  // coursive du sas : coque creuse entre le mur extérieur du hangar et la galerie (le passage reste dégagé)
  {
    const xa = -HX - 2.0, xb = G.x1, cxs = (xa + xb) / 2, lw = xa - xb;
    B.box(lw, G.h - 4.7, 6.6, shell, [cxs, (G.h + 4.7) / 2, -2], null, { tex: 6, cast: false });
    for (const s of [-1, 1]) B.box(lw, 4.7, 0.6, shell, [cxs, 4.7 / 2, -2 + s * 3.0], null, { tex: 6, cast: false });
  }
  // ---------------------------------------------------------------- corps de la station (cylindre couché derrière le hangar)
  const core = platedHull([
    { z: 34, w: 30, h: 30, y: 10, n: 2.2 }, { z: 46, w: 48, h: 48, y: 10, n: 2.2 },
    { z: 380, w: 48, h: 48, y: 10, n: 2.2 }, { z: 420, w: 26, h: 26, y: 10, n: 2.2 },
  ], { facets: 24, steps: 6, plateEvery: [2, 1], altRandom: 0.2, seed: 101, gap: 0.3, thick: 0.6 });
  add(core);
  // anneaux habités : section profilée (plancher extérieur, flancs à double rangée de hublots, verrière intérieure),
  // colliers de raidissement, rayons pressurisés avec cabines de liaison, moyeux autour du corps
  const R = rng(5);
  const glassBand = mats.emissive(0x9fc8ff, 0.55), solar = new THREE.MeshStandardMaterial({ color: 0x0c1a3a, roughness: 0.42, metalness: 0.1, envMapIntensity: 0.25 }), cellLine = mats.metal(0x8a9aa8, { rough: 0.4 });
  const radiator = mats.metal(0xd0d4d8, { rough: 0.3 }), steel = mats.metal(0x6a7074, { rough: 0.45 });
  const RA = 120, prof = [[110, -8], [112, -11], [116, -12], [127, -12], [130.5, -10.5], [131.5, -7], [131.5, 7], [130.5, 10.5], [127, 12], [116, 12], [112, 11], [110, 8], [110, -8]];
  const lathe = (pts, segs = 192) => {
    const g = new THREE.LatheGeometry(pts.map(([r, a]) => new THREE.Vector2(r, a)), segs);
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (Math.PI * 2 * RA) / 6, uv.getY(i) * L / 6);
    g.rotateX(Math.PI / 2); return g;
  };
  for (const zr of [150, 300]) {
    const C0 = new THREE.Vector3(0, 10, zr);
    B.add(lathe(prof), hm.plate, new THREE.Matrix4().makeTranslation(0, 10, zr), { cast: false });
    // verrière intérieure (face tournée vers le moyeu) et bandeaux de plancher
    B.add(lathe([[109.9, -5], [109.9, 5]]), glassBand, new THREE.Matrix4().makeTranslation(0, 10, zr), { cast: false });
    for (const s of [-1, 1]) B.add(lathe([[131.6, s * 2], [131.6, s * 4.5]]), hm.alt, new THREE.Matrix4().makeTranslation(0, 10, zr), { cast: false });
    // colliers de raidissement (cloisons étanches entre segments)
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      B.box(k % 4 ? 0.8 : 1.6, 22.6, k % 4 ? 25 : 25.6, k % 4 ? hm.alt : dark, [Math.cos(a) * 120.8, 10 + Math.sin(a) * 120.8, zr], [0, 0, a + Math.PI / 2], { cast: false });
    }
    // flancs : deux rangées de hublots par côté (allumés ou non), encadrements sombres
    for (const side of [-1, 1]) for (const rr of [118.5, 123.5]) for (let k = 0; k < 170; k++) {
      const a = (k / 170) * Math.PI * 2 + (rr > 120 ? 0.009 : 0);
      if (k % 32 === 0) continue;                                    // cloisons
      const p = [Math.cos(a) * rr, 10 + Math.sin(a) * rr, zr + side * 12.03];
      B.box(0.9, 3.1, 0.06, dark, p, [0, 0, a], { cast: false });
      if (R() < 0.72) B.box(0.7, 2.6, 0.08, R() < 0.78 ? win : winCold, p, [0, 0, a], { cast: false });
    }
    // hublots du plancher extérieur (moins nombreux)
    for (let i = 0; i < 60; i++) { const a = R() * Math.PI * 2; B.box(1.4, 0.4, 2.4, R() < 0.7 ? win : winCold, [Math.cos(a) * 131.55, 10 + Math.sin(a) * 131.55, zr + (R() < 0.5 ? -1 : 1) * (5 + R() * 1.5)], [0, 0, a + Math.PI / 2], { cast: false }); }
    // moyeu : collier autour du corps, sas des rayons
    B.add(new THREE.TorusGeometry(50, 3.2, 10, 64), hm.alt, new THREE.Matrix4().makeTranslation(0, 10, zr), { cast: false });
    B.add(new THREE.CylinderGeometry(51.5, 51.5, 9, 48, 1, true).rotateX(Math.PI / 2), hm.plate, new THREE.Matrix4().makeTranslation(0, 10, zr), { cast: false });
    // rayons : tubes pressurisés (cabine de liaison éclairée), colliers, treillis de reprise
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6, d = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      const r0 = 51.5, r1 = 110.5, L = r1 - r0, mid = C0.clone().addScaledVector(d, (r0 + r1) / 2);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      B.add(new THREE.CylinderGeometry(3.4, 3.4, L, 16, 1, true), hm.plate, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), { cast: false });
      for (let t = 4; t < L; t += 8) B.add(new THREE.CylinderGeometry(3.8, 3.8, 0.8, 16), t % 24 < 8 ? dark : hm.alt, new THREE.Matrix4().compose(C0.clone().addScaledVector(d, r0 + t), q, new THREE.Vector3(1, 1, 1)), { cast: false });
      // bande vitrée de l'ascenseur de rayon
      const side = new THREE.Vector3(0, 0, 1);
      B.add(new THREE.BoxGeometry(0.9, L - 4, 0.2), mats.emissive(0xffd9a8, 1.2), new THREE.Matrix4().compose(mid.clone().addScaledVector(side, 3.35), q, new THREE.Vector3(1, 1, 1)), { cast: false });
      B.add(new THREE.CylinderGeometry(5.5, 3.4, 5, 16), hm.alt, new THREE.Matrix4().compose(C0.clone().addScaledVector(d, r1 - 2), q, new THREE.Vector3(1, 1, 1)), { cast: false });
      for (const o of [-6, 6]) {
        const n = new THREE.Vector3(-d.y, d.x, 0).multiplyScalar(o);
        B.tube([C0.clone().addScaledVector(d, r0 + 2).add(n).toArray(), C0.clone().addScaledVector(d, r1 - 4).add(n.clone().multiplyScalar(0.5)).toArray()], 0.5, steel, { smooth: false, radial: 6, segments: 1, cast: false });
      }
    }
  }
  // ---------------------------------------------------------------- corps : hublots posés sur la coque, rampes de balisage, conduites
  const rc = 48.95;
  for (let i = 0; i < 220; i++) {
    const ang = R() * Math.PI * 2, z = 52 + R() * 322;
    if (Math.abs(z - 150) < 8 || Math.abs(z - 300) < 8) continue;
    B.box(0.12, 1.4, 3 + R() * 8, R() < 0.75 ? win : winCold, [Math.cos(ang) * rc, 10 + Math.sin(ang) * rc, z], [0, 0, ang], { cast: false });
  }
  for (const ang of [Math.PI / 3, (2 * Math.PI) / 3, -Math.PI / 3, (-2 * Math.PI) / 3]) {
    for (let z = 56; z < 376; z += 10) if (Math.abs(z - 150) > 8 && Math.abs(z - 300) > 8) B.box(0.4, 0.4, 0.4, mats.emissive(0xfff2d8, 4), [Math.cos(ang) * 49.3, 10 + Math.sin(ang) * 49.3, z], null, { cast: false });
  }
  for (const ang of [0.35, Math.PI - 0.35]) for (const dr of [0, 1.6]) {
    const r = 49.8 + dr;
    B.pipe([[Math.cos(ang) * r, 10 + Math.sin(ang) * r, 50], [Math.cos(ang) * r, 10 + Math.sin(ang) * r, 374]], 0.6, dr ? mats.paint(0x8a6a3a, { grime: 0.8 }) : steel, { cast: false, flangeMat: dark });
  }
  // ceintures sombres et grandes tôles de teintes différentes (lecture des volumes du corps)
  for (const z of [60, 100, 200, 250, 340, 370]) B.add(new THREE.CylinderGeometry(49.4, 49.4, 3, 24, 1, true).rotateX(Math.PI / 2), dark, new THREE.Matrix4().makeTranslation(0, 10, z), { cast: false });
  const tonesC = [hm.alt, mats.paint(0x8a9096, { grime: 0.7, scratch: 0.5 }), mats.paint(0x4a4f55, { grime: 0.9 }), mats.paint(0x9a7a3a, { grime: 0.9, scratch: 0.7 })];
  for (let i = 0; i < 90; i++) {
    const ang = R() * Math.PI * 2, z = 56 + R() * 316, L = 6 + R() * 18, w = 4 + R() * 8;
    if (Math.abs(z - 150) < 12 + L / 2 || Math.abs(z - 300) < 12 + L / 2) continue;
    B.box(0.12, w, L, tonesC[i % 3 === 0 && R() < 0.15 ? 3 : Math.floor(R() * 3)], [Math.cos(ang) * 49.1, 10 + Math.sin(ang) * 49.1, z], [0, 0, ang], { cast: false });
  }
  // ailes de radiateurs entre les anneaux (panneaux nervurés sur poutres)
  for (const s of [-1, 1]) {
    const x0 = s * 50, x1 = s * 100, z0 = 196, z1 = 254, y = 10;
    B.box(Math.abs(x1 - x0), 1.4, 1.4, dark, [(x0 + x1) / 2, y, (z0 + z1) / 2], null, { cast: false });
    for (const zp of [z0 + 14, z1 - 14]) {
      B.box(Math.abs(x1 - x0) - 6, 0.25, 26, radiator, [(x0 + x1) / 2 + s * 3, y + 0.8, zp], null, { cast: false });
      for (let x = Math.min(x0, x1) + 4; x < Math.max(x0, x1) - 2; x += 2.2) B.box(0.18, 0.4, 26, steel, [x, y + 1.05, zp], null, { cast: false });
    }
  }
  // extrémité arrière : module réacteur, mât et quatre ailes solaires
  B.add(new THREE.CylinderGeometry(11, 13, 22, 24).rotateX(Math.PI / 2), hm.plate, new THREE.Matrix4().makeTranslation(0, 10, 431), { cast: false });
  B.add(new THREE.TorusGeometry(13.2, 1, 8, 32), dark, new THREE.Matrix4().makeTranslation(0, 10, 424), { cast: false });
  B.cyl(1.6, 1.6, 40, dark, [0, 10, 460], [Math.PI / 2, 0, 0], { cast: false, seg: 10 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, d = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a));
    const boom = new THREE.Vector3(0, 10, 470).addScaledVector(d, 30);
    B.add(new THREE.BoxGeometry(44, 0.8, 0.8), dark, new THREE.Matrix4().compose(new THREE.Vector3(0, 10, 470).addScaledVector(d, 24), q, new THREE.Vector3(1, 1, 1)), { cast: false });
    B.add(new THREE.BoxGeometry(40, 0.2, 16), solar, new THREE.Matrix4().compose(boom.clone().addScaledVector(d, 6), q, new THREE.Vector3(1, 1, 1)), { cast: false });
    for (let t = -18; t <= 18; t += 4) B.add(new THREE.BoxGeometry(0.15, 0.24, 16.1), cellLine, new THREE.Matrix4().compose(boom.clone().addScaledVector(d, 6 + t), q, new THREE.Vector3(1, 1, 1)), { cast: false });
    B.add(new THREE.BoxGeometry(40.1, 0.24, 0.15), cellLine, new THREE.Matrix4().compose(boom.clone().addScaledVector(d, 6), q, new THREE.Vector3(1, 1, 1)), { cast: false });
  }
  // antennes et mâts (posés sur la coque)
  for (let i = 0; i < 6; i++) {
    const z = 70 + i * 50, s = i % 2 ? 1 : -1, ang = Math.PI / 2 + s * 0.45, bx = Math.cos(ang) * 48.6, by = 10 + Math.sin(ang) * 48.6;
    if (Math.abs(z - 150) < 10 || Math.abs(z - 300) < 10) continue;
    B.box(4, 1.2, 4, hm.alt, [bx, by + 0.4, z], null, { cast: false });
    B.cyl(0.5, 0.5, 30, dark, [bx, by + 15, z], null, { cast: false, seg: 8 });
    for (let k = 1; k < 4; k++) B.box(10 - k * 2, 0.4, 0.4, dark, [bx, by + k * 7.5, z], null, { cast: false });
  }
  const meshes = B.finalize(scene);
  for (const m of meshes) { m.castShadow = false; m.receiveShadow = false; }
  // balises clignotantes
  const beacons = [];
  const bMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.5, 0.3) });
  for (const p of [[HX + 4, H + 4, Z_BAY - 1], [-HX - 4, H + 4, Z_BAY - 1], [0, 10 + 132, 150], [0, 10 - 132, 300], [132, 10, 300], [-132, 10, 150], [0, 10 + 43, 431], [Math.cos(Math.PI / 2 - 0.45) * 48.6, 10 + Math.sin(Math.PI / 2 - 0.45) * 48.6 + 30.5, 120]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), bMat());
    m.position.set(...p); scene.add(m); beacons.push(m);
  }
  ctx.updaters.push((dt, t) => { for (let i = 0; i < beacons.length; i++) beacons[i].visible = ((t + i * 0.37) % 1.8) < 0.25; });
}

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
