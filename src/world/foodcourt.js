import * as THREE from 'three';
import { DECK_Y } from './habitat.js';
import { neonTexture, neonMaterial, Screen, FONT } from './signage.js';
import { RESTAURANTS } from '../game/food.js';

// Cour des Saveurs : grande salle de restauration du pont habitat (accès par le hall des ascenseurs).
// Dix restaurants autour d'une salle centrale : tables, fontaine, arbres, verrière sur l'espace.

export const COURT = { x0: -140, x1: -70, z0: 12, z1: 52, h: 7.5 };
const Y = DECK_Y;

export function buildFoodCourt(ctx) {
  const { mats, scene, builder: B } = ctx;
  const box = (w, h, d, m, p, rot, col = false) => B.box(w, h, d, m, p, rot || null, { collide: col, cast: false, tex: 2 });
  const cyl = (r1, r2, h, m, p, rot, seg = 14, col = false) => B.cyl(r1, r2, h, m, p, rot || null, { seg, cast: false, collide: col });
  const geo = (g, m, p, rot, scale) => B.add(g, m, Builder_matrix(p, rot, scale), { cast: false });
  const out = { stalls: [], chairs: [], standing: [], lights: [], fx: [] };

  // ------------------------------------------------------------------ couloir d'accès (hall des ascenseurs → cour)
  const wallW = mats.paint(0xd8cfc0, { grime: 0.2, rough: 0.6 }), wood = mats.paint(0x6a4a32, { plain: true, rough: 0.55 });
  const dark = mats.paint(0x24282b), tiles = mats.tiles(0xb8a890);
  {
    const x0 = -118, x1 = -114, z0 = -5, z1 = COURT.z0;
    box(x1 - x0, 0.3, z1 - z0, dark, [(x0 + x1) / 2, Y - 0.15, (z0 + z1) / 2], null, true);
    geo(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), tiles, [(x0 + x1) / 2, Y + 0.01, (z0 + z1) / 2]);
    for (const x of [x0 - 0.15, x1 + 0.15]) box(0.3, 3.2, z1 - z0, wallW, [x, Y + 1.6, (z0 + z1) / 2], null, true);
    box(x1 - x0 + 0.6, 0.3, z1 - z0, dark, [(x0 + x1) / 2, Y + 3.35, (z0 + z1) / 2]);
    for (let z = z0 + 2; z < z1; z += 3) box(2.6, 0.05, 0.3, mats.emissive(0xffd9a8, 1.8), [(x0 + x1) / 2, Y + 3.18, z]);
    box(0.05, 0.25, z1 - z0, wood, [x0 + 0.02, Y + 1.0, (z0 + z1) / 2]); box(0.05, 0.25, z1 - z0, wood, [x1 - 0.02, Y + 1.0, (z0 + z1) / 2]);
  }

  // ------------------------------------------------------------------ salle : sol, murs, plafond à verrière
  const C = COURT, cx = (C.x0 + C.x1) / 2, cz = (C.z0 + C.z1) / 2, W = C.x1 - C.x0, D = C.z1 - C.z0;
  box(W, 0.3, D, dark, [cx, Y - 0.15, cz], null, true);
  geo(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), tiles, [cx, Y + 0.01, cz]);
  // allées : bandes de sol plus sombres
  const aisle = mats.tiles(0x6a6258);
  for (const z of [20, 44]) geo(new THREE.PlaneGeometry(W - 2, 2.6).rotateX(-Math.PI / 2), aisle, [cx, Y + 0.015, z]);
  for (const x of [-120, -90]) geo(new THREE.PlaneGeometry(2.6, 22).rotateX(-Math.PI / 2), aisle, [x, Y + 0.016, 32]);
  // murs (ouverture du couloir au sud, baies à l'ouest)
  box(-118 - C.x0, C.h, 0.3, wallW, [(C.x0 - 118) / 2, Y + C.h / 2, C.z0 - 0.15], null, true);
  box(C.x1 + 114, C.h, 0.3, wallW, [(C.x1 - 114) / 2, Y + C.h / 2, C.z0 - 0.15], null, true);
  box(4, C.h - 3.2, 0.3, wallW, [-116, Y + 3.2 + (C.h - 3.2) / 2, C.z0 - 0.15]);
  box(W, C.h, 0.3, wallW, [cx, Y + C.h / 2, C.z1 + 0.15], null, true);
  box(0.3, C.h, D, wallW, [C.x1 + 0.15, Y + C.h / 2, cz], null, true);
  box(0.3, 0.9, D, wallW, [C.x0 - 0.15, Y + 0.45, cz], null, true);
  box(0.3, C.h - 6.2, D, wallW, [C.x0 - 0.15, Y + 6.2 + (C.h - 6.2) / 2, cz]);
  box(0.06, 5.3, D - 1, mats.glass(0x9fc4dc, 0.14), [C.x0 - 0.15, Y + 0.9 + 2.65, cz], null, true);
  for (let z = C.z0 + 1; z <= C.z1 - 1; z += 4.2) box(0.3, C.h, 0.3, mats.metal(0x5a5048), [C.x0 - 0.1, Y + C.h / 2, z]);
  // lambris bas
  for (const [x, z, w, d] of [[cx, C.z1 - 0.02, W, 0.04], [C.x1 - 0.02, cz, 0.04, D]]) box(w, 1.1, d, wood, [x, Y + 0.55, z]);
  // plafond avec verrière centrale
  const ceil = mats.paint(0x3a3430, { grime: 0.3 });
  const hx0 = -126, hx1 = -84, hz0 = 23, hz1 = 41;
  box(hx0 - C.x0, 0.4, D, ceil, [(C.x0 + hx0) / 2, Y + C.h + 0.2, cz]);
  box(C.x1 - hx1, 0.4, D, ceil, [(hx1 + C.x1) / 2, Y + C.h + 0.2, cz]);
  box(hx1 - hx0, 0.4, hz0 - C.z0, ceil, [(hx0 + hx1) / 2, Y + C.h + 0.2, (C.z0 + hz0) / 2]);
  box(hx1 - hx0, 0.4, C.z1 - hz1, ceil, [(hx0 + hx1) / 2, Y + C.h + 0.2, (hz1 + C.z1) / 2]);
  box(hx1 - hx0, 0.04, hz1 - hz0, mats.glass(0x9fc4dc, 0.1), [(hx0 + hx1) / 2, Y + C.h + 0.35, (hz0 + hz1) / 2]);
  for (let x = hx0; x <= hx1; x += 6) box(0.25, 0.3, hz1 - hz0, mats.metal(0x4a4440), [x, Y + C.h + 0.2, (hz0 + hz1) / 2]);
  for (let z = hz0; z <= hz1; z += 6) box(hx1 - hx0, 0.3, 0.25, mats.metal(0x4a4440), [(hx0 + hx1) / 2, Y + C.h + 0.2, z]);
  // bandeaux lumineux au plafond (hors verrière)
  for (const z of [16, 48]) box(W - 6, 0.05, 0.5, mats.emissive(0xffe0b8, 1.8), [cx, Y + C.h - 0.02, z]);
  // grande enseigne et plan des restaurants à l'entrée
  const nt = neonTexture('COUR DES SAVEURS', '#ffd27a', { size: 120 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 9 / nt.aspect), neonMaterial(nt.tex, 2.4));
  sign.position.set(-116, Y + 5.2, C.z0 + 0.05); scene.add(sign);
  const dir = new Screen(360, 300, (c, w, h) => {
    c.fillStyle = '#120e0a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd27a'; c.font = `700 20px ${FONT}`; c.fillText('COUR DES SAVEURS', 16, 30);
    c.font = `500 13px ${FONT}`;
    RESTAURANTS.forEach((r, i) => { c.fillStyle = r.color; c.fillText(r.label, 16, 62 + i * 23); c.fillStyle = '#d8d0c0'; c.fillText(`${String(r.hours[0]).padStart(2, '0')} h – ${String(r.hours[1] % 24).padStart(2, '0')} h · ${r.cuisine}`, 190, 62 + i * 23); });
  }, { period: 1e9, intensity: 1.5 });
  ctx.screens.push(dir);
  box(0.4, 2.6, 2.2, mats.metal(0x2a2826), [-111.2, Y + 1.3, C.z0 + 1.6], null, true);
  const dm = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.66), dir.material);
  dm.position.set(-111.42, Y + 1.7, C.z0 + 1.6); dm.rotation.y = -Math.PI / 2; scene.add(dm);
  out.directory = new THREE.Vector3(-112.6, Y, C.z0 + 1.6);

  // ------------------------------------------------------------------ restaurants
  const north = RESTAURANTS.slice(0, 6), south = RESTAURANTS.slice(6);
  north.forEach((r, i) => out.stalls.push(stall(ctx, r, -131 + i * 10, C.z1 - 6, 1, out)));
  south.forEach((r, i) => out.stalls.push(stall(ctx, r, -105 + i * 10, C.z0 + 6, -1, out)));

  // ------------------------------------------------------------------ salle : tables, fontaine, arbres, tables hautes, suspensions
  const tableM = mats.smooth(0x3a2a20, 0.4, 0.1), chairM = mats.plastic(0x8a5a3a, 0.6), chairM2 = mats.plastic(0x2a4a5a, 0.6), metal = mats.metal(0x2a2a2a);
  const cols = { A: [-132, -126], B: [-113.5], C: [-98], D: [-84, -78] };
  let n = 0;
  for (const xs of Object.values(cols)) for (const x of xs) for (const z of [24.5, 30, 35.5, 41]) {
    cyl(0.62, 0.62, 0.05, tableM, [x, Y + 0.75, z], null, 20);
    cyl(0.07, 0.25, 0.75, metal, [x, Y + 0.37, z], null, 10);
    B.colliderBox(1.25, 0.8, 1.25, [x, Y + 0.4, z]);
    const cm = n++ % 2 ? chairM : chairM2;
    for (const [dx, dz, yaw] of [[0.95, 0, -Math.PI / 2], [-0.95, 0, Math.PI / 2], [0, 0.95, Math.PI], [0, -0.95, 0]]) {
      box(0.46, 0.08, 0.46, cm, [x + dx, Y + 0.45, z + dz]);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(0.04, 0.45, 0.04, metal, [x + dx + lx, Y + 0.22, z + dz + lz]);
      const bx = -Math.sin(yaw) * 0.22, bz = -Math.cos(yaw) * 0.22;
      box(Math.abs(dz) > 0 ? 0.46 : 0.06, 0.5, Math.abs(dz) > 0 ? 0.06 : 0.46, cm, [x + dx + bx, Y + 0.72, z + dz + bz]);
      out.chairs.push({ p: new THREE.Vector3(x + dx, Y, z + dz), yaw, taken: null });
    }
    // couverts et petits objets sur la table
    box(0.12, 0.01, 0.2, mats.paint(0xf2f2ee, { plain: true }), [x + 0.25, Y + 0.78, z - 0.1]);
    cyl(0.04, 0.035, 0.12, mats.glass(0xcfe8ff, 0.4), [x - 0.2, Y + 0.84, z + 0.15], null, 8);
    // suspension
    cyl(0.01, 0.01, C.h - 3.4, metal, [x, Y + 3.4 + (C.h - 3.4) / 2, z], null, 4);
    cyl(0.28, 0.12, 0.25, mats.emissive([0xffd0a0, 0xffb070, 0xffe8c0][n % 3], 2.2), [x, Y + 3.3, z], null, 14);
  }
  // fontaine centrale avec planète holographique
  cyl(2.6, 2.7, 0.6, mats.paint(0x8a8078, { grime: 0.3 }), [-105, Y + 0.3, 32], null, 32, true);
  cyl(2.35, 2.35, 0.05, mats.glass(0x5fb8e0, 0.55), [-105, Y + 0.56, 32], null, 32);
  cyl(0.3, 0.4, 1.4, mats.paint(0x8a8078), [-105, Y + 1.0, 32], null, 16);
  const holo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 28, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.6, 2.6), wireframe: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  holo.position.set(-105, Y + 2.7, 32); scene.add(holo);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.02, 6, 64), holo.material); ring.position.copy(holo.position); ring.rotation.x = 1.2; scene.add(ring);
  ctx.updaters.push((dt, t) => { holo.rotation.y = t * 0.3; ring.rotation.z = t * 0.2; });
  // arbres en bacs
  for (const [x, z, s] of [[-137.5, 21.5, 1], [-137.5, 42.5, 1], [-72.5, 21.5, 1], [-72.5, 42.5, 1], [-108.5, 26.5, 0.8], [-101.5, 37.5, 0.8]]) {
    box(1.6 * s, 0.7, 1.6 * s, mats.paint(0x4a3a2a, { plain: true }), [x, Y + 0.35, z], null, true);
    cyl(0.1 * s, 0.14 * s, 2.2 * s, mats.paint(0x5a3a20, { plain: true }), [x, Y + 0.7 + 1.1 * s, z], null, 8);
    for (let k = 0; k < 6; k++) geo(new THREE.IcosahedronGeometry(0.55 * s, 1), mats.plastic([0x3a6a2a, 0x4a7a32, 0x2e5a26][k % 3], 0.8), [x + Math.cos(k * 1.1) * 0.5 * s, Y + 2.6 * s + 0.4 + (k % 2) * 0.35, z + Math.sin(k * 1.1) * 0.5 * s]);
  }
  // tables hautes le long des allées (on mange debout)
  for (const z of [21.6, 42.4]) for (const x of [-131, -111, -97, -80]) {
    cyl(0.38, 0.38, 0.04, tableM, [x, Y + 1.08, z], null, 16);
    cyl(0.05, 0.25, 1.08, metal, [x, Y + 0.54, z], null, 8);
    B.colliderBox(0.8, 1.1, 0.8, [x, Y + 0.55, z]);
    out.standing.push({ p: new THREE.Vector3(x, Y, z), side: z < 32 ? -1 : 1 });
  }
  // lumières (allumées quand le joueur est sur le pont)
  for (const [x, z, c] of [[-120, 32, 0xffd0a0], [-90, 32, 0xffc890]]) { const l = new THREE.PointLight(c, 0, 40, 1.4); l.position.set(x, Y + 6, z); l.visible = false; scene.add(l); out.lights.push(l); }
  // vapeur et flammes des cuisines
  fxUpdater(ctx, out.fx);
  return out;
}

function Builder_matrix(p, rot, scale) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))), new THREE.Vector3(...(scale || [1, 1, 1])));
  return m;
}

// =============================================================================== stand de restaurant
/** cx : centre du stand ; zf : façade (côté salle) ; dir : +1 cuisine vers +z (stands nord), -1 vers -z (stands sud). */
function stall(ctx, r, cx, zf, dir, out) {
  const { mats, scene, builder: B } = ctx;
  const rotY = dir > 0 ? Math.PI : 0;                  // les objets « regardent » la salle
  const W = (u, y, v) => [cx + u * -dir, Y + y, zf + v * dir];   // u : gauche/droite vu de la salle, v : profondeur vers la cuisine
  const V3 = (u, y, v) => new THREE.Vector3(...W(u, y, v));
  const box = (w, h, d, m, p, col = false, extra = [0, 0, 0]) => B.box(w, h, d, m, W(...p), [extra[0], rotY + extra[1], extra[2]], { collide: col, cast: false, tex: 2 });
  const cyl = (r1, r2, h, m, p, seg = 14, rot = [0, 0, 0], col = false) => B.cyl(r1, r2, h, m, W(...p), [rot[0], rotY + rot[1], rot[2]], { seg, cast: false, collide: col });
  const sph = (rad, m, p, sc = [1, 1, 1], half = false) => { const g = half ? new THREE.SphereGeometry(rad, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2) : new THREE.SphereGeometry(rad, 14, 10); B.add(g, m, Builder_matrix(W(...p), [0, rotY, 0], sc), { cast: false }); };
  const glow = (c, i = 2.4) => mats.emissive(c, i);
  const theme = mats.paint(r.wall, { grime: 0.25, rough: 0.55 }), accent = mats.paint(r.accent, { plain: true, rough: 0.5 });
  const steel = mats.metal(0x9aa0a4, { rough: 0.3 }), darkM = mats.paint(0x1c1e20);
  const P = (c, rough = 0.6) => mats.plastic(c, rough);
  // structure : sol, cloisons, fond carrelé, façade, comptoir, plan de travail, hotte
  B.add(new THREE.PlaneGeometry(9.6, 6).rotateX(-Math.PI / 2), mats.tiles(r.wall), Builder_matrix(W(0, 0.02, 3), [0, rotY, 0]), { cast: false });
  for (const u of [-5, 5]) box(0.25, 4.6, 6, theme, [u, 2.3, 3], true);
  box(10, 4.6, 0.1, theme, [0, 2.3, 5.95]);
  box(9.6, 2.0, 0.05, mats.tiles(0xe8e4dc), [0, 1.7, 5.88]);
  box(10.2, 0.9, 0.3, theme, [0, 4.15, 0.1]);
  box(10.2, 0.1, 0.32, accent, [0, 3.72, 0.1]);
  box(7.0, 1.05, 0.7, theme, [-0.6, 0.525, 1.2], true);
  box(7.1, 0.06, 0.8, mats.smooth(0xd8d4cc, 0.25, 0.1), [-0.6, 1.08, 1.2]);
  box(7.0, 0.12, 0.05, accent, [-0.6, 0.85, 0.83]);
  box(9.2, 0.95, 0.75, steel, [0, 0.47, 5.3], true);
  box(9.3, 0.05, 0.8, mats.metal(0xc8ccd0, { rough: 0.2 }), [0, 0.97, 5.3]);
  box(6.0, 0.6, 1.1, darkM, [0, 2.85, 5.3]);
  box(6.0, 0.05, 1.0, glow(0xffe8c8, 1.5), [0, 2.53, 5.3]);
  // étagère murale
  box(8.6, 0.05, 0.3, steel, [0, 1.9, 5.75]);
  // enseigne néon
  const nt = neonTexture(r.name, r.color, { size: 100 });
  const nw = Math.min(8.6, 0.85 * nt.aspect);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(nw, nw / nt.aspect), neonMaterial(nt.tex, 2.5));
  sign.position.copy(V3(0, 4.15, -0.08)); sign.rotation.y = rotY; scene.add(sign);
  // menu lumineux
  const menu = new Screen(384, 200, (c, w, h) => {
    c.fillStyle = '#100c0a'; c.fillRect(0, 0, w, h);
    c.fillStyle = r.color; c.font = `700 20px ${FONT}`; c.fillText(r.label.toUpperCase(), 14, 30);
    c.font = `500 15px ${FONT}`;
    r.dishes.forEach(([name, price], i) => { c.fillStyle = '#f2ead8'; c.fillText(name, 14, 70 + i * 32); c.fillStyle = r.color; c.fillText(`${price} ¤`, 320, 70 + i * 32); });
  }, { period: 1e9, intensity: 1.6 });
  ctx.screens.push(menu);
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.77), menu.material);
  mm.position.copy(V3(-0.2, 3.6, 5.85)); mm.rotation.y = rotY; scene.add(mm);
  // lampes au-dessus du comptoir
  for (const u of [-3, -0.6, 1.8]) { cyl(0.01, 0.01, 0.9, darkM, [u, 3.2, 1.2], 4); cyl(0.2, 0.08, 0.18, glow(0xffd8a0, 2.2), [u, 2.7, 1.2], 12); }
  // caisse et présentoir à couverts
  box(0.35, 0.25, 0.3, darkM, [2.2, 1.24, 1.2]);
  box(0.3, 0.18, 0.02, glow(0x6fd0ff, 1.4), [2.2, 1.32, 1.04], false, [-0.3, 0, 0]);
  box(0.3, 0.12, 0.2, steel, [1.5, 1.17, 1.3]);
  const fx = out.fx;
  const steam = (u, y, v) => fx.push({ type: 'steam', p: V3(u, y, v) });
  const flame = (u, y, v) => fx.push({ type: 'flame', p: V3(u, y, v) });

  // ------------------------------------------------------------------ équipement propre à chaque cuisine
  const c = r.cuisine;
  if (c === 'chinois') {
    for (const u of [-3, -1.6]) { sph(0.38, darkM, [u, 1.0, 5.2], [1, 0.45, 1], true); flame(u, 1.0, 5.2); cyl(0.04, 0.04, 0.5, wood(mats), [u + 0.35, 1.25, 5.2], 6, [0, 0, 1.2]); }
    for (let k = 0; k < 3; k++) for (const u of [1.0, 1.7]) cyl(0.22, 0.22, 0.11, P(0xc8a46a, 0.8), [u, 1.16 + k * 0.11, 1.25], 14);
    steam(1.35, 1.6, 1.25);
    for (const u of [-4, -1.3, 1.3, 4]) { cyl(0.008, 0.008, 0.4, darkM, [u, 3.5, -0.35], 4); sph(0.24, glow(0xff3a2a, 2.8), [u, 3.15, -0.35], [1, 1.25, 1]); box(0.06, 0.12, 0.06, accent, [u, 2.85, -0.35]); }
    for (let k = 0; k < 4; k++) { box(0.05, 0.35, 0.05, darkM, [2.6 + k * 0.4, 2.0, 5.6]); sph(0.12, P(0x8a3a1a, 0.4), [2.6 + k * 0.4, 1.78, 5.6], [1, 1.5, 0.8]); }
    for (let k = 0; k < 5; k++) cyl(0.09, 0.07, 0.05, P(0xf2f2ee, 0.3), [-2.8 + k * 0.25, 1.95, 5.75], 12);
  } else if (c === 'mexicain') {
    const flagC = [0xff4a8a, 0x3ae0c8, 0xffd27a, 0x8a4aff, 0x7dff6a, 0xff7a1a];
    for (let k = 0; k < 16; k++) box(0.42, 0.42, 0.01, P(flagC[k % 6], 0.9), [-4.7 + k * 0.62, 3.35 - Math.sin((k / 15) * Math.PI) * 0.25, -0.3], false, [0, 0, 0.0]);
    for (const u of [-4.4, 4.4]) { cyl(0.3, 0.25, 0.4, P(0xb86a3a, 0.8), [u, 0.2, -0.5]); cyl(0.12, 0.14, 1.2, P(0x3a7a3a, 0.7), [u, 1.0, -0.5]); cyl(0.07, 0.08, 0.45, P(0x3a7a3a, 0.7), [u + 0.22, 1.2, -0.5]); cyl(0.07, 0.08, 0.4, P(0x3a7a3a, 0.7), [u - 0.2, 1.35, -0.5]); }
    for (let k = 0; k < 6; k++) cyl(0.04, 0.04, 0.2, P(k % 2 ? 0x3a9a3a : 0xc83a2a, 0.3), [0.6 + k * 0.18, 1.21, 1.35]);
    for (const u of [-3.2, -2.4, -1.6]) sph(0.26, P(0xb8603a, 0.85), [u, 1.2, 5.3], [1, 0.9, 1]);
    flame(1.4, 1.0, 5.3); box(1.4, 0.06, 0.6, darkM, [1.4, 1.0, 5.3]);
    for (let k = 0; k < 4; k++) cyl(0.2, 0.2, 0.012, P(0xe8d8a8, 0.9), [3.0, 1.0 + k * 0.014, 5.3], 16);
  } else if (c === 'boulangerie') {
    box(3.0, 0.45, 0.6, mats.glass(0xcfe8ff, 0.25), [-1.2, 1.33, 1.2]);
    for (let k = 0; k < 10; k++) sph(0.08, P([0xd8973a, 0xc8803a, 0x8a4a2a][k % 3], 0.6), [-2.4 + (k % 5) * 0.55, 1.18, 1.05 + Math.floor(k / 5) * 0.3], [1.6, 0.8, 1]);
    for (let k = 0; k < 7; k++) cyl(0.035, 0.035, 0.75, P(0xd8973a, 0.7), [2.0 + (k % 4) * 0.12, 1.55, 1.45], 8, [0.35, 0, 0.12 * (k - 3)]);
    box(0.6, 0.4, 0.3, P(0x8a6a3a, 0.9), [2.2, 1.28, 1.45]);
    box(2.2, 1.6, 0.9, mats.paint(0x8a3a24, { grime: 0.6 }), [2.8, 1.75, 5.35]);
    box(1.2, 0.5, 0.05, glow(0xff8a3a, 3), [2.8, 1.6, 4.88]);
    for (let k = 0; k < 8; k++) cyl(0.035, 0.035, 0.6, P(0xd8973a, 0.7), [-3.8 + k * 0.28, 2.15, 5.7], 8, [0, 0, Math.PI / 2]);
    for (const u of [-4.2, -3.6]) box(0.45, 0.6, 0.35, P(0xf2f2ee, 0.9), [u, 0.3, 4.6]);
  } else if (c === 'tacos') {
    cyl(0.02, 0.02, 1.1, steel, [-2.4, 1.5, 5.25], 6);
    for (let k = 0; k < 5; k++) cyl(0.26 - k * 0.03, 0.29 - k * 0.03, 0.14, P(0xa8402a, 0.5), [-2.4, 1.1 + k * 0.14, 5.25], 14);
    sph(0.16, P(0xe8c23a, 0.5), [-2.4, 1.85, 5.25], [1, 1.3, 1]);
    box(0.7, 0.9, 0.05, glow(0xff5a1a, 2.6), [-2.4, 1.5, 5.62]); flame(-2.4, 1.3, 5.5);
    box(1.8, 0.06, 0.65, darkM, [0.6, 1.0, 5.3]); steam(0.6, 1.1, 5.3);
    for (const [u, col] of [[0.8, 0x4a9a3a], [1.5, 0xc83a2a], [2.2, 0xf2f2ee]]) { box(0.5, 0.12, 0.35, steel, [u, 1.16, 1.25]); for (let k = 0; k < 5; k++) sph(0.05, P(col, 0.4), [u - 0.16 + k * 0.08, 1.24, 1.25]); }
  } else if (c === 'indien') {
    cyl(0.45, 0.5, 0.9, P(0xa85a3a, 0.9), [-3.2, 0.45, 4.6], 16, [0, 0, 0], true);
    cyl(0.25, 0.25, 0.02, glow(0xff6a1a, 3.2), [-3.2, 0.91, 4.6], 14); flame(-3.2, 1.0, 4.6);
    for (const u of [-1.2, -0.3, 0.6]) { cyl(0.22, 0.2, 0.28, mats.metal(0xb87333, { rough: 0.25 }), [u, 1.12, 5.3], 16); steam(u, 1.3, 5.3); }
    const spice = [0xd8a21b, 0xc8402a, 0x8a5a2a, 0xe86a1a, 0x4a7a2a, 0xd84a8a];
    for (let k = 0; k < 14; k++) cyl(0.05, 0.05, 0.14, P(spice[k % 6], 0.6), [-3.6 + k * 0.5, 1.99, 5.75], 10);
    for (let k = 0; k < 18; k++) sph(0.04, glow([0xffd27a, 0xff7a1a, 0xff4a8a][k % 3], 3), [-4.8 + k * 0.56, 3.62 - Math.sin(k / 17 * Math.PI) * 0.2, -0.1]);
    for (let k = 0; k < 4; k++) cyl(0.11, 0.09, 0.06, mats.metal(0xb87333, { rough: 0.25 }), [1.8 + k * 0.28, 1.14, 1.3], 12);
  } else if (c === 'sushi') {
    box(7.0, 0.04, 0.3, darkM, [-0.6, 1.13, 1.05]);
    const plateC = [0xc83a2a, 0x2a5a9a, 0xd9a21b, 0x3a7a3a];
    for (let k = 0; k < 12; k++) { cyl(0.09, 0.09, 0.02, P(plateC[k % 4], 0.3), [-3.8 + k * 0.55, 1.16, 1.05], 12); box(0.1, 0.05, 0.06, P(k % 3 ? 0xe86a4a : 0xf2f2ee, 0.5), [-3.8 + k * 0.55, 1.19, 1.05]); }
    box(2.4, 0.4, 0.55, mats.glass(0xcfe8ff, 0.25), [2.2, 1.31, 1.3]);
    for (let k = 0; k < 5; k++) sph(0.07, P(k % 2 ? 0xe86a4a : 0xb8c0c8, 0.3), [1.3 + k * 0.42, 1.2, 1.3], [3, 0.8, 1]);
    for (let k = 0; k < 6; k++) box(0.75, 0.9, 0.01, P(0x1a2a4a, 0.9), [-3.9 + k * 1.55, 3.25, -0.12]);
    sph(0.3, glow(0xfff2e0, 2.2), [3.8, 3.0, -0.4], [1, 1.3, 1]);
    box(1.5, 0.08, 0.6, mats.paint(0xc8a46a, { plain: true }), [-2.4, 1.0, 5.3]);
  } else if (c === 'burgers') {
    box(2.2, 0.08, 0.65, darkM, [-2.2, 1.0, 5.3]); box(2.0, 0.02, 0.5, glow(0xff5a1a, 2.4), [-2.2, 0.98, 5.3]);
    for (let k = 0; k < 4; k++) cyl(0.1, 0.1, 0.03, P(0x4a2a1a, 0.6), [-2.9 + k * 0.45, 1.06, 5.3], 12);
    steam(-2.2, 1.2, 5.3);
    box(1.0, 0.95, 0.65, steel, [0.6, 0.47, 5.3]); box(0.8, 0.03, 0.5, P(0xd8a21b, 0.2), [0.6, 0.96, 5.3]);
    for (const u of [0.4, 0.8]) box(0.3, 0.12, 0.25, mats.metal(0x6a6e72), [u, 1.1, 5.3]);
    for (const [u, col] of [[1.8, 0xc83a2a], [1.95, 0xe8c23a]]) cyl(0.045, 0.04, 0.22, P(col, 0.3), [u, 1.22, 1.35], 10);
    for (let k = 0; k < 3; k++) { cyl(0.11, 0.11, 0.05, P(0xd8973a, 0.6), [-2.6 + k * 0.5, 1.14, 1.2], 12); cyl(0.11, 0.11, 0.04, P(0x4a2a1a, 0.6), [-2.6 + k * 0.5, 1.18, 1.2], 12); sph(0.11, P(0xd8973a, 0.6), [-2.6 + k * 0.5, 1.21, 1.2], [1, 0.6, 1], true); }
  } else if (c === 'pizzeria') {
    sph(1.0, mats.paint(0x8a4a2a, { grime: 0.7 }), [2.6, 0.95, 5.0], [1, 0.9, 0.9], true);
    box(1.9, 0.95, 1.6, mats.paint(0x6a3a24, { grime: 0.6 }), [2.6, 0.47, 5.0], true);
    box(0.6, 0.35, 0.05, glow(0xff7a2a, 3.2), [2.6, 1.15, 4.2]); flame(2.6, 1.1, 4.5);
    for (let k = 0; k < 6; k++) cyl(0.07, 0.07, 0.5, P(0x6a4a2a, 0.9), [1.6 + (k % 3) * 0.15, 0.08 + Math.floor(k / 3) * 0.13, 4.2], 8, [0, 0, Math.PI / 2]);
    for (let k = 0; k < 3; k++) { cyl(0.24, 0.24, 0.02, P(0xd8973a, 0.7), [-2.6 + k * 0.7, 1.12, 1.2], 18); cyl(0.2, 0.2, 0.01, P(k === 1 ? 0xf2e6a8 : 0xc83a2a, 0.5), [-2.6 + k * 0.7, 1.135, 1.2], 18); }
    box(0.6, 0.02, 0.35, P(0xc8a46a, 0.8), [-1.0, 1.0, 5.3]);
    for (const u of [-3.8, -3.3]) box(0.4, 0.55, 0.3, P(0xf2f2ee, 0.9), [u, 0.27, 4.6]);
  } else if (c === 'café') {
    box(0.9, 0.55, 0.5, mats.metal(0xc8ccd0, { rough: 0.15 }), [-2.4, 1.27, 5.3]); box(0.3, 0.12, 0.02, glow(0xff8a3a, 2), [-2.4, 1.45, 5.04]);
    steam(-2.4, 1.7, 5.3);
    for (let k = 0; k < 6; k++) cyl(0.045, 0.035, 0.08, P(0xf2f2ee, 0.3), [-1.6 + (k % 3) * 0.13, 1.04 + Math.floor(k / 3) * 0.08, 5.3], 10);
    box(2.6, 0.5, 0.6, mats.glass(0xcfe8ff, 0.25), [-1.2, 1.35, 1.2]);
    for (let k = 0; k < 4; k++) { cyl(0.13, 0.13, 0.1, P([0x5a2a1a, 0xf2e6c8, 0xc83a5a, 0x8a5a2a][k], 0.6), [-2.2 + k * 0.6, 1.16, 1.2], 16); cyl(0.13, 0.13, 0.05, P(0xf2f2ee, 0.5), [-2.2 + k * 0.6, 1.24, 1.2], 16); }
    for (const u of [3.4, 4.0]) box(0.5, 0.45, 0.35, P(0x8a6a3a, 0.95), [u, 0.22, 4.6]);
    box(1.2, 0.9, 0.04, mats.paint(0x1c2420), [3.0, 2.3, 5.84]);
  } else {
    // phở : grandes marmites de bouillon, bols, herbes fraîches, lanternes jaunes
    for (const u of [-3.0, -2.0]) { cyl(0.34, 0.32, 0.55, mats.metal(0x9aa0a4, { rough: 0.25 }), [u, 1.25, 5.25], 18); steam(u, 1.6, 5.25); flame(u, 0.98, 5.25); }
    for (let k = 0; k < 5; k++) cyl(0.12, 0.09, 0.06, P(0xf2f2ee, 0.3), [0.4, 1.12 + k * 0.06, 1.3], 14);
    for (const [u, col] of [[1.0, 0x4a9a3a], [1.5, 0x6aba4a], [2.0, 0xe8e8c8]]) { box(0.42, 0.08, 0.3, steel, [u, 1.13, 1.25]); for (let k = 0; k < 4; k++) sph(0.05, P(col, 0.8), [u - 0.12 + k * 0.08, 1.19, 1.25], [1.4, 0.5, 1]); }
    for (const u of [-3.5, -1.2, 1.2, 3.5]) { cyl(0.008, 0.008, 0.35, darkM, [u, 3.5, -0.35], 4); sph(0.22, glow(0xffd23a, 2.6), [u, 3.15, -0.35], [1, 1.3, 1]); }
  }
  // routine du cuisinier et comptoir client
  const yawRoom = dir > 0 ? Math.PI : 0;       // tourné vers la salle
  return {
    r, cx, zf, dir,
    customer: V3(-0.6, 0, -0.35), customerYaw: yawRoom + Math.PI,
    counterSpot: V3(-0.6, 0, 1.95), stove: V3(-1.5, 0, 4.55), stove2: V3(1.2, 0, 4.55),
    faceRoom: yawRoom, faceKitchen: yawRoom + Math.PI,
    approach: V3(-0.6, 0, -1.4),
  };
}

function wood(mats) { return mats.paint(0x6a4a2a, { plain: true, rough: 0.7 }); }

/** Vapeur (bouffées) et flammes (lueurs vacillantes) des cuisines. */
function fxUpdater(ctx, list) {
  const pc = document.createElement('canvas'); pc.width = pc.height = 64;
  const g = pc.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(pc);
  const sprites = [];
  for (const f of list) {
    const n = f.type === 'steam' ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: f.type === 'steam' ? 0xffffff : new THREE.Color(4, 1.6, 0.4), transparent: true, depthWrite: false, blending: f.type === 'steam' ? THREE.NormalBlending : THREE.AdditiveBlending }));
      sp.position.copy(f.p); ctx.scene.add(sp);
      sprites.push({ sp, f, k: k / n });
    }
  }
  ctx.updaters.push((dt, t) => {
    if (!(ctx.player && ctx.player.pos.y > DECK_Y - 5)) { for (const s of sprites) s.sp.visible = false; return; }
    for (const s of sprites) {
      s.sp.visible = true;
      if (s.f.type === 'steam') {
        const k = (t * 0.4 + s.k) % 1;
        s.sp.position.set(s.f.p.x + Math.sin(t + k * 6) * 0.06, s.f.p.y + k * 1.1, s.f.p.z);
        s.sp.scale.setScalar(0.25 + k * 0.6); s.sp.material.opacity = 0.3 * (1 - k);
      } else {
        const fl = 0.6 + Math.sin(t * 17 + s.k * 9) * 0.2 + Math.random() * 0.2;
        s.sp.position.set(s.f.p.x, s.f.p.y + 0.06 + s.k * 0.08, s.f.p.z);
        s.sp.scale.set(0.35 * fl, 0.28 * fl, 1); s.sp.material.opacity = 0.9;
      }
    }
  });
}
