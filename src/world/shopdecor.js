import * as THREE from 'three';
import { weaponMesh } from '../game/ground.js';
import { shipGunMesh, turretMesh, miningMesh } from '../game/shipgear.js';
import { neonTexture, neonMaterial } from './signage.js';

// Décor propre à chaque boutique de la galerie : on voit ce qui s'y vend.
// Repère local L de la boutique : x le long de la devanture, z vers le fond (0 = vitrine, depth = mur du fond).

/** Couleurs des articles sur les étagères, par boutique. */
export const SHELF_PALETTE = {
  armes: [0x2a2c2e, 0x4a4a3a, 0x6a5a3a, 0x3a3e42, 0x8a6a3a],
  pieces: [0x3a4a5a, 0x5a6a7a, 0xd9a21b, 0x2a2d30, 0x6a6e70],
  pharma: [0xf2f4f4, 0x3aa86a, 0xd84a3a, 0xe8eef0, 0x6fb8ff],
  combis: [0x1a2436, 0x6a4a32, 0xa89470, 0x2b3036, 0x7a2a24, 0x5d6168],
  nouilles: [0xd84a3a, 0xf2e6d6, 0x3a2a24, 0xe8a23a, 0x2a5a3a],
};

export function shopDecor(ctx, s, L, depth) {
  const { mats, scene } = ctx;
  const place = (obj, p, ry = 0, scale = 1) => { obj.position.copy(L.world(...p)); obj.rotation.y = ry; obj.scale.multiplyScalar(scale); obj.traverse((o) => { if (o.isMesh) o.castShadow = false; }); scene.add(obj); return obj; };
  const sign = (text, color, size, w, p) => {
    const nt = neonTexture(text, color, { size });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / nt.aspect), neonMaterial(nt.tex, 2.0));
    m.position.copy(L.world(...p)); m.rotation.y = Math.PI; scene.add(m);
  };
  const spots = ctx.shopSpots[s.id];

  if (s.id === 'armes') {
    // râtelier mural : vraies armes longues, canons à l'horizontale
    const longs = [['rifle', 0x7a7a3a], ['smg', 0x5a8a5a], ['sniper', 0x4a5a7a], ['shotgun', 0x8a4a2a], ['rifle', 0x9a7a3a], ['smg', 0x3a5a8a]];
    longs.forEach(([shape, acc], i) => place(weaponMesh(shape, acc), [0.15 + (i % 2) * 1.75, 1.45 + Math.floor(i / 2) * 0.62, depth - 0.2], Math.PI / 2, 1.25));
    // vitrine : pistolets sur supports
    for (let i = 0; i < 4; i++) place(weaponMesh(i % 2 ? 'revolver' : 'pistol', [0x6f86a8, 0x9a7a3a][i % 2]), [0.6 + i * 0.6, 1.0, 1.6], 0.5, 1.4);
    sign('ARMES HOMOLOGUÉES STATION', '#ff9a5a', 60, 2.6, [1.5, 3.45, depth - 0.1]);
  }
  if (s.id === 'pieces') {
    // canon sur caisse, tête de minage, tourelle sur socle, générateur de bouclier
    place(shipGunMesh('l2'), [2.8, 0.95, 1.4], -Math.PI / 2, 0.6);
    place(miningMesh('ml2'), [1.5, 0.95, 2.6], 0.4, 0.75);
    L.box(1.4, 0.8, 1.4, mats.metal(0x2a2d30, { rough: 0.5 }), [2.5, 0.4, 4.6], null, { collide: true });
    place(turretMesh(), [2.5, 0.8, 4.6], 0.6, 0.6);
    L.cyl(0.45, 0.5, 1.3, mats.metal(0x5a6a7a, { rough: 0.35 }), [0.6, 0.65, 4.8], null, { seg: 18 });
    L.cyl(0.47, 0.47, 0.08, mats.emissive(0x6fd0ff, 3), [0.6, 1.0, 4.8], null, { seg: 18, cast: false });
    L.cyl(0.47, 0.47, 0.08, mats.emissive(0x6fd0ff, 3), [0.6, 0.55, 4.8], null, { seg: 18, cast: false });
    L.obstacle(0.6, 0.6, 0.6, 4.8);
    sign('ARMEMENT · BOUCLIERS · MINAGE', '#5fe6ff', 60, 2.8, [1.6, 3.5, depth - 0.1]);
  }
  if (s.id === 'pharma') {
    // croix verte lumineuse, capsule de diagnostic, banc d'attente
    const g = mats.emissive(0x4dff8a, 4);
    L.box(0.9, 0.3, 0.05, g, [-1.6, 2.7, depth - 0.12], null, { cast: false });
    L.box(0.3, 0.9, 0.05, g, [-1.6, 2.7, depth - 0.12], null, { cast: false });
    L.box(1.0, 0.6, 2.0, mats.smooth(0xe8eef0, 0.3, 0.2), [2.6, 0.3, 3.6], null, { collide: true });
    const cap = new THREE.SphereGeometry(0.55, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.6, 1.9);
    L.geo(cap, mats.glass(0x9fd8ff, 0.35), [2.6, 0.6, 3.6]);
    L.box(0.9, 0.04, 1.8, mats.emissive(0x6fd0ff, 1.6), [2.6, 0.62, 3.6], null, { cast: false });
    L.box(1.6, 0.45, 0.5, mats.plastic(0x3aa86a, 0.6), [2.4, 0.22, 1.0], null, { collide: true });
    sign('SOINS · STYLOS MÉDICAUX · VIVRES', '#4dff8a', 55, 2.6, [1.4, 3.5, depth - 0.1]);
  }
  if (s.id === 'nouilles') {
    // cuisine au fond : plan de travail, marmites fumantes ; lanternes rouges devant
    L.box(3.4, 0.95, 0.6, mats.metal(0x8a8e92, { rough: 0.3 }), [-1.6, 0.47, depth - 0.45], null, { collide: true });
    const steam = [];
    const pc = document.createElement('canvas'); pc.width = pc.height = 64;
    const pg = pc.getContext('2d'), grd = pg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); pg.fillStyle = grd; pg.fillRect(0, 0, 64, 64);
    const puffTex = new THREE.CanvasTexture(pc);
    for (const dx of [-2.6, -1.6, -0.6]) {
      L.cyl(0.24, 0.2, 0.32, mats.metal(0x5a5e62, { rough: 0.25 }), [dx, 1.11, depth - 0.45], null, { seg: 14 });
      for (let k = 0; k < 3; k++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
        sp.position.copy(L.world(dx, 1.3, depth - 0.45)); sp.scale.setScalar(0.3); sp.userData = { base: sp.position.clone(), k: k / 3 };
        scene.add(sp); steam.push(sp);
      }
    }
    ctx.updaters.push((dt, t) => {
      for (const sp of steam) {
        const k = (t * 0.35 + sp.userData.k) % 1;
        sp.position.set(sp.userData.base.x + Math.sin(t + k * 6) * 0.06, sp.userData.base.y + k * 0.9, sp.userData.base.z);
        sp.scale.setScalar(0.25 + k * 0.5); sp.material.opacity = 0.28 * (1 - k);
      }
    });
    for (const dx of [-3, 0, 3]) {
      L.cyl(0.01, 0.01, 0.6, mats.metal(0x2a2a2a), [dx, 4.1, -0.6], null, { seg: 4, cast: false });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.6, 0.3) }));
      l.scale.y = 1.25; l.position.copy(L.world(dx, 3.7, -0.6)); scene.add(l);
    }
  }
  if (s.id === 'combis') {
    // portants de vêtements (les mannequins habillés sont ajoutés avec les personnages)
    for (const z of [3.2, 4.6]) {
      L.cyl(0.02, 0.02, 1.8, mats.metal(0xa0a4a8, { rough: 0.3 }), [2.6, 1.6, z], [0, 0, Math.PI / 2], { seg: 6, cast: false });
      for (let i = 0; i < 8; i++) {
        const c = SHELF_PALETTE.combis[(i + Math.round(z)) % 6];
        L.box(0.05, 0.9, 0.42, mats.plastic(c, 0.8), [1.85 + i * 0.21, 1.1, z], null, { cast: false });
      }
      for (const dx of [1.7, 3.5]) L.cyl(0.03, 0.03, 1.6, mats.metal(0x6a6e72), [dx, 0.8, z], null, { seg: 6, cast: false });
    }
    spots.mannequins = [{ p: L.world(1.2, 0, 1.4), yaw: Math.PI }, { p: L.world(2.6, 0, 1.4), yaw: Math.PI }, { p: L.world(-3.0, 0, 1.2), yaw: Math.PI * 0.75 }];
  }
  // rideau de fer : descend à la fermeture (horaires de la station), bloque l'entrée
  {
    const W8 = 8, Hs = 4.4;
    const sh = new THREE.Mesh(new THREE.BoxGeometry(W8, Hs, 0.06), mats.cladding(0x5a5e62));
    sh.position.copy(L.world(0, Hs / 2, -0.03)); scene.add(sh);
    const band = new THREE.Mesh(new THREE.BoxGeometry(W8, 0.18, 0.08), mats.paint(0xd9a21b, { plain: true }));
    scene.add(band);
    const c = L.world(0, 0, 0);
    const door = {
      x: c.x, z: c.z, open: 1, shutter: true,
      box: new THREE.Box3(new THREE.Vector3(c.x - W8 / 2, 0, c.z - 0.25), new THREE.Vector3(c.x + W8 / 2, Hs, c.z + 0.15)),
      update(dt) {
        const want = !ctx.time || ctx.time.open(s.id) ? 1 : 0;
        this.open += Math.sign(want - this.open) * Math.min(Math.abs(want - this.open), dt * 0.35);
        const k = 1 - 0.95 * this.open;
        sh.scale.y = k; sh.position.y = Hs - (Hs * k) / 2;
        band.position.set(sh.position.x, Hs - Hs * k + 0.09, sh.position.z - 0.02);
        sh.visible = k > 0.08;
      },
    };
    ctx.doors.push(door);
  }
  // articles exposés qu'on peut examiner (ouvre la boutique sur l'article)
  spots.features = ({
    armes: [[1.0, depth - 1.1, 'ac7'], [1.5, 1.0, 'rv44']],
    pieces: [[2.8, 0.7, 'l2'], [1.5, 1.9, 'ml2'], [2.5, 3.7, 'tur2'], [0.6, 3.9, 'sh2']],
    pharma: [[2.6, 2.4, 'medkit'], [-3.1, 2.0, 'medpen']],
    combis: [[1.2, 0.5, 'o_navy'], [2.6, 0.5, 'o_sand'], [-2.6, 0.6, 'o_black'], [2.6, 2.6, 'a_light']],
    nouilles: [[1.8, 1.0, 'noodles']],
  }[s.id] || []).map(([x, z, item]) => ({ pos: L.world(x, 0, z), item }));
  shopDetails(ctx, s, L, depth);
  (ctx.shopStock || (ctx.shopStock = {}))[s.id] = shopStock(ctx, s, L, 8);
  // repères de la routine du vendeur : poste de caisse, étagère du fond
  spots.back = s.id === 'nouilles' ? L.world(-1.6, 0, 4.75) : L.world(-2.4, 0, 5.2);
  spots.backFace = L.world(s.id === 'nouilles' ? -1.6 : -2.4, 0, 7);
}

// =============================================================================== articles en rayon
/** Article fixe (géométrie fusionnée) posé sur une étagère : forme propre à la boutique. yTop = dessus de la tablette. */
export function shelfProduct(ctx, id, L, x, yTop, z, n) {
  const { mats } = ctx;
  const P = (c, r = 0.6) => mats.plastic(c, r);
  const v = n % 3;
  if (id === 'armes') {
    if (v === 0) { L.box(0.26, 0.16, 0.2, P(0x4a4a2a), [x, yTop + 0.08, z], null, { cast: false }); L.box(0.27, 0.03, 0.05, P(0xd9a21b), [x, yTop + 0.1, z + 0.08], null, { cast: false }); }
    else if (v === 1) { L.box(0.3, 0.08, 0.22, P(0x15171a, 0.4), [x, yTop + 0.04, z], null, { cast: false }); L.box(0.04, 0.02, 0.1, mats.metal(0xa0a4a8), [x + 0.05, yTop + 0.09, z], null, { cast: false }); }
    else { L.cyl(0.035, 0.04, 0.26, mats.metal(0x2a2c2e, { rough: 0.3 }), [x, yTop + 0.06, z], [Math.PI / 2, 0, 0], { cast: false, seg: 10 }); L.box(0.05, 0.05, 0.08, P(0x15171a), [x, yTop + 0.025, z], null, { cast: false }); }
  } else if (id === 'pieces') {
    if (v === 0) { L.cyl(0.07, 0.07, 0.22, mats.metal(0x6a6e72, { rough: 0.35 }), [x, yTop + 0.11, z], null, { cast: false, seg: 12 }); L.cyl(0.072, 0.072, 0.03, mats.emissive(0x5fe6ff, 2), [x, yTop + 0.16, z], null, { cast: false, seg: 12 }); }
    else if (v === 1) { L.box(0.26, 0.2, 0.26, P(0x3a4a5a), [x, yTop + 0.1, z], null, { cast: false }); L.box(0.27, 0.04, 0.27, P(0xd9a21b), [x, yTop + 0.15, z], null, { cast: false }); }
    else { L.cyl(0.09, 0.09, 0.14, mats.metal(0xb87333, { rough: 0.3 }), [x, yTop + 0.07, z], [0, 0, Math.PI / 2], { cast: false, seg: 12 }); }
  } else if (id === 'pharma') {
    for (let k = 0; k < 3; k++) {
      L.box(0.07, 0.12, 0.08, P(0xf2f4f4, 0.5), [x, yTop + 0.06, z - 0.12 + k * 0.12], null, { cast: false });
      L.box(0.072, 0.025, 0.082, P(v === 1 ? 0xd84a3a : 0x3aa86a), [x, yTop + 0.09, z - 0.12 + k * 0.12], null, { cast: false });
    }
    if (v === 2) L.cyl(0.035, 0.035, 0.14, P(0x8a5a2a, 0.3), [x, yTop + 0.07, z + 0.2], null, { cast: false, seg: 10 });
  } else if (id === 'combis') {
    const cols = SHELF_PALETTE.combis;
    if (v === 2) { L.box(0.12, 0.12, 0.26, P(0x1a1c1e), [x, yTop + 0.06, z - 0.08], null, { cast: false }); L.box(0.12, 0.12, 0.26, P(0x1a1c1e), [x, yTop + 0.06, z + 0.08], null, { cast: false }); }
    else for (let k = 0; k < 3; k++) L.box(0.3, 0.05, 0.26, P(cols[(n + k) % cols.length], 0.85), [x, yTop + 0.03 + k * 0.055, z], null, { cast: false });
  } else if (id === 'nouilles') {
    if (v === 0) for (let k = 0; k < 3; k++) L.cyl(0.11, 0.08, 0.05, P(0xf2e6d6, 0.4), [x, yTop + 0.03 + k * 0.05, z], null, { cast: false, seg: 14 });
    else if (v === 1) for (let k = 0; k < 3; k++) L.cyl(0.035, 0.035, 0.12, P([0xd84a3a, 0xe8a23a, 0x2a5a3a][k], 0.4), [x, yTop + 0.06, z - 0.1 + k * 0.1], null, { cast: false, seg: 10 });
    else L.box(0.22, 0.16, 0.06, P(0xe8a23a, 0.7), [x, yTop + 0.08, z], null, { cast: false });
  }
}

/** Article mobile (mis en rayon par le vendeur) : petit groupe de maillages indépendants. */
function stockMesh(id, n) {
  const g = new THREE.Group();
  const M = (c, r = 0.6, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
  if (id === 'armes') { add(new THREE.BoxGeometry(0.26, 0.16, 0.2), M(0x4a4a2a), 0, 0.08, 0); add(new THREE.BoxGeometry(0.27, 0.03, 0.05), M(0xd9a21b), 0, 0.1, 0.08); }
  else if (id === 'pieces') { add(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 12), M(0x6a6e72, 0.35, 0.8), 0, 0.11, 0); add(new THREE.CylinderGeometry(0.072, 0.072, 0.03, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 2.5, 3) }), 0, 0.16, 0); }
  else if (id === 'pharma') { for (let k = 0; k < 3; k++) { add(new THREE.BoxGeometry(0.07, 0.12, 0.08), M(0xf2f4f4, 0.5), 0, 0.06, -0.12 + k * 0.12); add(new THREE.BoxGeometry(0.072, 0.025, 0.082), M(0x3aa86a), 0, 0.09, -0.12 + k * 0.12); } }
  else if (id === 'combis') { for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.3, 0.05, 0.26), M(SHELF_PALETTE.combis[(n + k) % 6], 0.85), 0, 0.03 + k * 0.055, 0); }
  else { for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(0.11, 0.08, 0.05, 14), M(0xf2e6d6, 0.4), 0, 0.03 + k * 0.05, 0); }
  return g;
}

/** Usure et bazar : tuyaux au plafond, dalle décrochée, câbles qui pendent, comptoir encombré, cartons,
 *  et un incident propre à chaque boutique (étincelles, fuite de vapeur, goutte-à-goutte, néon qui clignote). */
export function shopDetails(ctx, s, L, depth) {
  const { mats, scene } = ctx;
  const h = 4.4, cast = { cast: false };
  const pipeM = mats.metal(0x6a6e72, { rough: 0.45, grime: 0.6 }), rustM = mats.paint(0x7a4a2a, { grime: 0.9, rust: 0.7 });
  // tuyaux et chemin de câbles au plafond
  for (const [z, r, m] of [[1.4, 0.09, pipeM], [1.7, 0.06, rustM], [4.9, 0.11, pipeM]]) {
    L.cyl(r, r, 7.6, m, [0, h - 0.3, z], [0, 0, Math.PI / 2], { ...cast, seg: 10 });
    for (const x of [-3, -1, 1, 3]) L.box(0.05, 0.3, 0.05, mats.metal(0x2a2c2e), [x, h - 0.15, z], null, cast);
  }
  L.box(7.6, 0.06, 0.4, mats.metal(0x3a3e42), [0, h - 0.5, 3.2], null, cast);
  for (let i = 0; i < 6; i++) L.cyl(0.015, 0.015, 7.4, mats.plastic([0x1a1a1a, 0xc83a2a, 0x2a5a9a][i % 3], 0.6), [0, h - 0.46, 3.08 + i * 0.05], [0, 0, Math.PI / 2], { ...cast, seg: 5 });
  // dalle de plafond décrochée, trou sombre, câbles qui pendent
  const hx = s.id === 'combis' ? -2.2 : 1.8, hz = 2.4;
  L.box(1.2, 0.02, 1.2, mats.paint(0x0a0b0c), [hx, h - 0.02, hz], null, cast);
  L.box(1.15, 0.04, 1.15, mats.paint(0xc8ccd0, { grime: 0.6 }), [hx - 0.35, h - 0.45, hz], [0, 0, 0.75], cast);
  for (let i = 0; i < 3; i++) {
    const len = 0.6 + i * 0.25;
    L.cyl(0.012, 0.012, len, mats.plastic([0xc83a2a, 0x1a1a1a, 0xd9a21b][i], 0.6), [hx + 0.2 - i * 0.15, h - len / 2, hz + 0.3 - i * 0.2], [0.15 * i, 0, 0.2 - i * 0.12], { ...cast, seg: 4 });
  }
  // comptoir encombré : documents, tablette, tasse, petits colis, lampe
  const cy = 1.1;
  for (let i = 0; i < 4; i++) L.box(0.21, 0.004 + i * 0.002, 0.29, mats.paint(0xf2f2ee, { plain: true }), [-2.5 + i * 0.03, cy + i * 0.005, 3.1 + i * 0.02], [0, 0.15 * i, 0], cast);
  L.box(0.24, 0.015, 0.17, mats.metal(0x111214), [-2.0, cy + 0.01, 3.25], [0, -0.3, 0], cast);
  L.box(0.2, 0.002, 0.13, mats.emissive(0x6fd0ff, 1.4), [-2.0, cy + 0.02, 3.25], [0, -0.3, 0], cast);
  L.cyl(0.045, 0.04, 0.1, mats.plastic(s.id === 'nouilles' ? 0xf2e6d6 : 0xc83a2a, 0.4), [-1.2, cy + 0.05, 3.0], null, { ...cast, seg: 12 });
  L.box(0.3, 0.2, 0.25, mats.paint(0xa07850, { plain: true, rough: 0.9 }), [-0.5, cy + 0.1, 3.3], [0, 0.4, 0], cast);
  L.box(0.22, 0.14, 0.2, mats.paint(0xb88a5a, { plain: true, rough: 0.9 }), [-0.5, cy + 0.27, 3.3], [0, 0.1, 0], cast);
  // cartons au fond, un ouvert
  const card = mats.paint(0xa07850, { plain: true, rough: 0.9 });
  for (const [x, z, sz] of [[-3.0, 5.6, 0.55], [-3.0, 5.6, 0.45], [-2.1, 5.7, 0.5], [3.0, 5.5, 0.6]]) L.box(sz, sz * 0.8, sz, card, [x, x === -3.0 && sz < 0.5 ? 0.66 : sz * 0.4, z], [0, x * 0.3, 0], { cast: false, collide: false });
  L.box(0.62, 0.02, 0.3, card, [3.0, 0.75, 5.32], [0.9, 0, 0], cast);
  // incident propre à la boutique
  const fx = [];
  const sprite = (color, size) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(size); scene.add(sp); return sp; };
  if (s.id === 'pieces') {
    // câble arraché qui crépite
    const p = L.world(hx + 0.2, h - 1.05, hz + 0.3);
    for (let i = 0; i < 8; i++) { const sp = sprite(new THREE.Color(4, 3, 1.2), 0.05); sp.userData = { o: p, v: new THREE.Vector3(), t: 9 }; fx.push(sp); }
    const glow = sprite(new THREE.Color(2, 2.4, 3), 0.25); glow.position.copy(p);
    ctx.updaters.push((dt, t) => {
      const burst = (t % 3.1) < 0.35;
      glow.visible = burst && Math.random() < 0.7;
      for (const sp of fx) {
        sp.userData.t += dt;
        if (burst && sp.userData.t > 0.5 && Math.random() < 0.3) { sp.userData.t = 0; sp.position.copy(p); sp.userData.v.set(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).multiplyScalar(2); }
        const k = sp.userData.t; sp.visible = k < 0.45;
        if (sp.visible) { sp.userData.v.y -= 9.8 * dt; sp.position.addScaledVector(sp.userData.v, dt); }
      }
    });
  } else if (s.id === 'nouilles' || s.id === 'combis') {
    // raccord de tuyau qui fuit (vapeur)
    const p = L.world(-3.2, h - 0.35, 1.7);
    L.cyl(0.08, 0.08, 0.25, rustM, [-3.2, h - 0.45, 1.7], null, { ...cast, seg: 10 });
    for (let i = 0; i < 6; i++) { const sp = sprite(new THREE.Color(0.5, 0.5, 0.5), 0.2); sp.material.blending = THREE.NormalBlending; sp.material.opacity = 0.3; sp.userData = { k: i / 6 }; fx.push(sp); }
    ctx.updaters.push((dt, t) => { for (const sp of fx) { const k = (t * 0.6 + sp.userData.k) % 1; sp.position.set(p.x + Math.sin(t * 2 + k * 5) * 0.08, p.y - 0.15 - k * 0.9, p.z + k * 0.2); sp.scale.setScalar(0.12 + k * 0.5); sp.material.opacity = 0.35 * (1 - k); } });
  } else if (s.id === 'pharma') {
    // goutte-à-goutte d'une conduite, flaque au sol
    const p = L.world(2.8, h - 0.4, 1.7);
    L.cyl(0.25, 0.25, 0.005, mats.glass(0x9fd8ff, 0.4), [2.8, 0.01, 1.7], null, { ...cast, seg: 18 });
    const drop = sprite(new THREE.Color(0.6, 0.9, 1.4), 0.04);
    ctx.updaters.push((dt, t) => { const k = (t % 1.3) / 0.6; drop.visible = k < 1; drop.position.set(p.x, p.y - Math.min(1, k) ** 2 * (h - 0.4), p.z); });
  } else if (s.id === 'armes') {
    // tube néon défaillant qui clignote
    const tube = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.9, 2.6) }));
    tube.position.copy(L.world(-2.2, h - 0.08, 4.6)); scene.add(tube);
    ctx.updaters.push((dt, t) => { const k = t % 4.7; tube.visible = !(k < 0.08 || (k > 0.2 && k < 0.26) || (k > 2.4 && k < 2.9 && Math.sin(t * 60) > 0)); });
  }
}

/** Rayon géré par le vendeur : emplacements visibles (étagère gauche, côté comptoir) qui se vident
 *  quand les clients achètent et que le vendeur remplit avec les cartons du fond. */
export function shopStock(ctx, s, L, w) {
  const slots = [];
  const x = -(w / 2 - 0.3);
  let n = 0;
  for (const k of [1, 2]) for (const i of [5, 6, 7]) {
    const yTop = 0.42 + k * 0.55, z = 1.2 + i * 0.52;
    const mesh = stockMesh(s.id, n++);
    mesh.position.copy(L.world(x, yTop, z));
    ctx.scene.add(mesh);
    const filled = Math.random() < 0.55;
    mesh.visible = filled;
    slots.push({ mesh, filled, stand: L.world(x + 0.75, 0, z), face: L.world(x - 1, 0, z) });
  }
  const box = new THREE.Group();
  const bm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.35), new THREE.MeshStandardMaterial({ color: 0xa07850, roughness: 0.9 }));
  bm.position.y = 0.15; box.add(bm);
  box.visible = false; ctx.scene.add(box);
  return { slots, box };
}
