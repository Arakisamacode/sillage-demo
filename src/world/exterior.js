import * as THREE from 'three';
import { platedHull } from './hullkit.js';
import { Builder } from './builder.js';
import { HX, Z_BAY, Z_BACK, H, GALLERY } from './layout.js';

// Extérieur de la station Halden-7 (visible en vol) : enveloppe blindée du hangar et de la galerie,
// corps cylindrique de 400 m, deux anneaux habités reliés par des rayons, hublots et balises.

export function buildExterior(ctx) {
  const { mats, scene } = ctx;
  const B = new Builder(null);
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
  for (const s of [-1, 1]) B.box(3.4, H + 8, L, shell, [s * (HX + 2.3), H / 2, zc], null, { tex: 8, cast: false });
  B.box(HX * 2 + 7, H + 8, 3.4, shell, [0, H / 2, Z_BACK + 2.2], null, { tex: 8, cast: false });
  B.box(HX * 2 + 7, 5, L + 16, dark, [0, -3, zc - 8], null, { tex: 8, cast: false });
  // nervures et radiateurs sur le toit
  for (let z = Z_BAY + 4; z < Z_BACK; z += 8) B.box(HX * 2 + 8, 1.2, 1.2, dark, [0, H + 4.5, z], null, { cast: false });
  for (const s of [-1, 1]) for (let z = Z_BAY + 10; z < Z_BACK - 6; z += 14) B.box(0.3, 9, 10, mats.metal(0x8a9094, { rough: 0.35 }), [s * 18, H + 8.5, z], null, { cast: false });
  // ---------------------------------------------------------------- enveloppe de la galerie
  const G = GALLERY, gx = (G.x0 + G.x1) / 2, gw = G.x1 - G.x0 + 6;
  B.box(gw, 3, G.z1 - G.z0 + 14, shell, [gx, G.h + 1.6, (G.z0 + G.z1) / 2 + 4], null, { tex: 8, cast: false });
  B.box(gw, G.h + 4, 4, shell, [gx, G.h / 2, G.z1 + 9], null, { tex: 8, cast: false });
  B.box(4, G.h + 4, G.z1 - G.z0 + 14, shell, [G.x0 - 5, G.h / 2, (G.z0 + G.z1) / 2 + 4], null, { tex: 8, cast: false });
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
  // anneaux habités + rayons
  const R = rng(5);
  for (const zr of [150, 300]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(120, 11, 12, 64), hm.plate);
    ring.position.set(0, 10, zr); scene.add(ring);
    const band = new THREE.Mesh(new THREE.TorusGeometry(120, 11.3, 4, 64, Math.PI * 2), hm.alt);
    band.scale.set(1, 1, 0.25); band.position.copy(ring.position); scene.add(band);
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      B.box(6, 72, 6, dark, [Math.cos(ang) * 84, 10 + Math.sin(ang) * 84, zr], [0, 0, ang + Math.PI / 2], { cast: false });
    }
    // hublots de l'anneau (petites bandes lumineuses sur la face extérieure)
    for (let i = 0; i < 90; i++) {
      const ang = R() * Math.PI * 2;
      B.box(1.6, 0.5, 3 + R() * 6, R() < 0.7 ? win : winCold, [Math.cos(ang) * 131.3, 10 + Math.sin(ang) * 131.3, zr + (R() - 0.5) * 12], [0, 0, ang + Math.PI / 2], { cast: false });
    }
  }
  // hublots et projecteurs du corps
  for (let i = 0; i < 160; i++) {
    const ang = R() * Math.PI * 2, z = 60 + R() * 310;
    const r = 48.8;
    B.box(0.5, 1.6, 4 + R() * 10, R() < 0.75 ? win : winCold, [Math.cos(ang) * r, 10 + Math.sin(ang) * r, z], [0, 0, ang], { cast: false });
  }
  // antennes et mâts
  for (let i = 0; i < 6; i++) {
    const z = 60 + i * 55, s = i % 2 ? 1 : -1;
    B.cyl(0.6, 0.6, 60, dark, [s * 20, 70, z], null, { cast: false, seg: 8 });
    B.box(14, 0.6, 0.6, dark, [s * 20, 95, z], null, { cast: false });
  }
  const meshes = B.finalize(scene);
  for (const m of meshes) { m.castShadow = false; m.receiveShadow = false; }
  // balises clignotantes
  const beacons = [];
  const bMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.5, 0.3) });
  for (const p of [[HX + 4, H + 4, Z_BAY - 1], [-HX - 4, H + 4, Z_BAY - 1], [0, 100, 60], [0, 10 + 131, 150], [0, 10 - 131, 300], [131, 10, 300], [-131, 10, 150], [20, 95, 60], [-20, 95, 115]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), bMat());
    m.position.set(...p); scene.add(m); beacons.push(m);
  }
  ctx.updaters.push((dt, t) => { for (let i = 0; i < beacons.length; i++) beacons[i].visible = ((t + i * 0.37) % 1.8) < 0.25; });
}

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
