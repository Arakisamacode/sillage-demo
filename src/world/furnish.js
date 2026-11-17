import * as THREE from 'three';
import { GALLERY } from './layout.js';
import { Screen, FONT } from './signage.js';
import { DECK_Y } from './habitat.js';

// Mobilier et objets interactifs de la galerie et du pont habitat : distributeurs, borne-plan,
// salon (canapés, tapis, table holographique), bibliothèque, lampadaires, jardinières.

export function buildFurnish(ctx) {
  const { mats, scene, builder: B } = ctx;
  const box = (w, h, d, m, p, col = false, ry = 0) => B.box(w, h, d, m, p, ry ? [0, ry, 0] : null, { collide: col, cast: false, tex: 2 });
  const out = { vending: [], terminals: [], sofas: [] };
  const G = GALLERY;

  // ------------------------------------------------------------------ galerie : distributeurs (mur est, de part et d'autre du sas)
  const drinks = new Screen(256, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a0e2a'); g.addColorStop(1, '#0a1a2a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd27a'; c.font = `700 30px ${FONT}`; c.fillText('BOISSONS', 30, 50);
    const cols = ['#ff5a3c', '#4dff8a', '#5fe6ff', '#ffb84a', '#c58bff', '#f2f2f2'];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      c.fillStyle = cols[(r * 4 + k) % 6]; c.fillRect(30 + k * 52, 90 + r * 95, 34, 70);
      c.fillStyle = '#ffffff'; c.font = `500 14px ${FONT}`; c.fillText(`${3 + ((r + k) % 3)} ¤`, 34 + k * 52, 178 + r * 95);
    }
  }, { period: 1e9, intensity: 1.5 });
  ctx.screens.push(drinks);
  for (const z of [-8.6, 5.2]) {
    const x = G.x1 - 0.55;
    box(0.9, 2.1, 1.1, mats.paint(0x2a2c30, { grime: 0.3 }), [x, 1.05, z], true);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.5), drinks.material);
    face.position.set(x - 0.46, 1.2, z); face.rotation.y = -Math.PI / 2; scene.add(face);
    box(0.06, 0.18, 0.7, mats.metal(0x111214), [x - 0.46, 0.25, z]);
    box(0.04, 0.06, 0.9, mats.emissive(0xffd27a, 2.4), [x - 0.47, 2.05, z]);
    B.addObstacle(x, z, 0.55, 0.65, 0);
    out.vending.push({ pos: new THREE.Vector3(x - 1.1, 0, z) });
  }
  // borne d'information (plan de la station)
  const map = new Screen(320, 240, (c, w, h) => {
    c.fillStyle = '#071018'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#5fe6ff'; c.lineWidth = 2; c.fillStyle = '#5fe6ff'; c.font = `700 16px ${FONT}`; c.fillText('HALDEN-7 · PLAN', 12, 22);
    const R = (x, y, ww, hh, label, col = '#5fe6ff') => { c.strokeStyle = col; c.strokeRect(x, y, ww, hh); c.fillStyle = col; c.font = `500 11px ${FONT}`; c.fillText(label, x + 4, y + 14); };
    R(190, 50, 115, 150, 'HANGAR 07', '#ffd27a');
    R(40, 70, 135, 90, 'GALERIE', '#5fe6ff');
    R(10, 100, 28, 40, 'HAB.', '#7dff9a');
    c.fillStyle = '#ff5a3c'; c.beginPath(); c.arc(160, 120, 5, 0, 7); c.fill();
    c.fillStyle = '#f2f2f2'; c.font = `500 11px ${FONT}`; c.fillText('VOUS ÊTES ICI', 110, 145);
    c.fillText('Boutiques : côté nord', 40, 190); c.fillText('Ascenseurs : module habitat (ouest)', 40, 206); c.fillText('Contrats de fret : quai, hangar', 40, 222);
  }, { period: 1e9, intensity: 1.6 });
  ctx.screens.push(map);
  {
    const x = G.x1 - 3.4, z = 3.2;
    box(0.5, 1.0, 0.5, mats.metal(0x3a3e42), [x, 0.5, z], true);
    box(0.12, 1.0, 1.4, mats.metal(0x2a2c30), [x, 1.55, z]);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.95), map.material);
    sc.position.set(x - 0.07, 1.55, z); sc.rotation.y = -Math.PI / 2; scene.add(sc);
    B.addObstacle(x, z, 0.4, 0.75, 0);
    out.terminals.push({ pos: new THREE.Vector3(x - 0.9, 0, z) });
  }
  // jardinières supplémentaires le long de l'allée centrale
  for (const x of [-96, -76, -66, -48]) {
    box(1.6, 0.6, 1.6, mats.paint(0x4a3a2a, { plain: true, rough: 0.7 }), [x, 0.3, -6.5], true);
    for (let k = 0; k < 5; k++) B.add(new THREE.IcosahedronGeometry(0.35 + (k % 2) * 0.15, 1), mats.plastic([0x3a6a2a, 0x4a7a32, 0x2e5a26][k % 3], 0.8), new THREE.Matrix4().makeTranslation(x + Math.cos(k * 1.3) * 0.4, 0.95 + (k % 3) * 0.25, -6.5 + Math.sin(k * 1.3) * 0.4), { cast: false });
    B.addObstacle(x, -6.5, 0.9, 0.9, 0);
  }

  // ------------------------------------------------------------------ pont habitat : salon, bibliothèque, lampadaires, écrans
  const Y = DECK_Y;
  const rug = (x, z, w, d, col) => box(w, 0.02, d, mats.plastic(col, 0.95), [x, Y + 0.02, z]);
  rug(-108.5, -16, 5.2, 4.2, 0x5a2e2a); rug(-99.5, -9, 9, 9, 0x2a3440); rug(-108, -4.4, 4, 3.0, 0x3a4a3a);
  // salon : deux canapés face à face, table basse holographique
  const sofaM = mats.plastic(0x6a3a2a, 0.7);
  for (const [z, yaw] of [[-18.2, 0], [-13.8, Math.PI]]) {
    const s = yaw ? -1 : 1;
    box(3.0, 0.45, 0.9, sofaM, [-108.5, Y + 0.22, z], true);
    box(3.0, 0.6, 0.2, sofaM, [-108.5, Y + 0.7, z - s * 0.4]);
    for (const dx of [-1.55, 1.55]) box(0.2, 0.6, 0.9, sofaM, [-108.5 + dx, Y + 0.45, z]);
    for (const dx of [-0.75, 0.75]) out.sofas.push({ x: -108.5 + dx, y: Y, z: z + s * 0.05, yaw });
  }
  box(1.6, 0.4, 1.0, mats.smooth(0x2a2c2e, 0.2, 0.6), [-108.5, Y + 0.2, -16], true);
  const holo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.6, 2.6), wireframe: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  holo.position.set(-108.5, Y + 0.85, -16); scene.add(holo);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.01, 6, 48), holo.material);
  ring.rotation.x = Math.PI / 2.3; ring.position.copy(holo.position); scene.add(ring);
  ctx.updaters.push((dt, t) => { holo.rotation.y = t * 0.4; ring.rotation.z = t * 0.25; });
  // bibliothèque et fauteuils (coin nord-ouest)
  box(0.4, 2.4, 2.0, mats.paint(0x4a3a2a, { plain: true, rough: 0.6 }), [-111.6, Y + 1.2, -4.6], true);
  for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) box(0.25, 0.32 + ((i * 7 + k) % 3) * 0.06, 0.12, mats.plastic([0x7a2a24, 0x2a4a6a, 0xc8a46a, 0x3a5a3a, 0x5a4a7a][(i + k) % 5], 0.7), [-111.35, Y + 0.45 + k * 0.55, -5.45 + i * 0.3]);
  for (const z of [-5.4, -3.2]) { box(0.9, 0.45, 0.9, mats.plastic(0x3a4a5a, 0.7), [-108.4, Y + 0.22, z], true); box(0.2, 0.55, 0.9, mats.plastic(0x3a4a5a, 0.7), [-108.95, Y + 0.7, z]); out.sofas.push({ x: -108.4, y: Y, z, yaw: Math.PI / 2 }); }
  // lampadaires
  for (const [x, z] of [[-110.5, -20], [-106.2, -18.5], [-106.4, 1.3], [-82.5, -21], [-90, -21]]) {
    B.cyl(0.03, 0.03, 1.7, mats.metal(0x2a2a2a), [x, Y + 0.85, z], null, { cast: false, seg: 6 });
    B.cyl(0.18, 0.25, 0.3, mats.emissive(0xffd0a0, 2.2), [x, Y + 1.8, z], null, { cast: false, seg: 12 });
  }
  // écran d'actualités au-dessus de la bibliothèque
  const news = new Screen(320, 180, (c, w, h, t) => {
    c.fillStyle = '#0a0e14'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffb84a'; c.font = `700 15px ${FONT}`; c.fillText('INFOS HALDEN', 12, 22);
    const lines = ['Convoi de Lys : arrivée prévue aire 05', 'Cours du titane en hausse à Lys', 'Ceinture d\'Ardent : pirates signalés', 'Bar La Comète : soirée musique 22 h'];
    const i = Math.floor((t || 0) / 6) % lines.length;
    c.fillStyle = '#f2f2f2'; c.font = `500 14px ${FONT}`; c.fillText(lines[i], 12, 70); c.fillText(lines[(i + 1) % lines.length], 12, 100);
    c.fillStyle = '#5fe6ff'; c.fillRect(12, 150, ((t || 0) % 6) / 6 * 296, 4);
  }, { period: 1, intensity: 1.5 });
  ctx.screens.push(news);
  const nm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), news.material);
  nm.position.set(-111.75, Y + 3.3, -4.6); nm.rotation.y = Math.PI / 2; scene.add(nm);
  // ------------------------------------------------------------------ hangar : terminal de diagnostic, casiers, annonces, racks de pièces
  {
    const diag = new Screen(320, 200, (c, w, h, t) => {
      c.fillStyle = '#06121a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#5fe6ff'; c.font = `700 16px ${FONT}`; c.fillText('HÉRON HL-2207 · DIAGNOSTIC', 12, 24);
      c.strokeStyle = '#5fe6ff'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(160, 50); c.lineTo(200, 150); c.lineTo(160, 135); c.lineTo(120, 150); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(80, 120); c.lineTo(240, 120); c.stroke();
      const k = ((t || 0) * 0.5) % 1;
      c.fillStyle = 'rgba(95,230,255,0.25)'; c.fillRect(0, 40 + k * 140, w, 6);
      c.fillStyle = '#7dff9a'; c.font = `500 12px ${FONT}`; c.fillText('COQUE ✓   BOUCLIER ✓   RÉACTEURS ✓', 40, 185);
    }, { period: 0.15, intensity: 1.5 });
    ctx.screens.push(diag);
    const x = -16.5, z = 9;
    box(0.6, 1.0, 0.6, mats.metal(0x3a3e42), [x, 0.5, z], true);
    box(0.12, 1.1, 1.6, mats.metal(0x2a2c30), [x, 1.6, z]);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95), diag.material);
    sc.position.set(x + 0.07, 1.6, z); sc.rotation.y = Math.PI / 2; scene.add(sc);
    B.addObstacle(x, z, 0.4, 0.8, 0);
    out.diag = { pos: new THREE.Vector3(x + 0.9, 0, z) };
  }
  {
    // casiers du personnel (mur ouest, près du coin pause)
    const x = -31.55;
    for (let i = 0; i < 6; i++) {
      const z = 16.4 + i * 0.62;
      box(0.55, 2.0, 0.6, mats.paint([0x3a4a5a, 0x4a5a3a, 0x5a4a3a][i % 3], { grime: 0.5 }), [x, 1.0, z], true);
      box(0.02, 0.25, 0.12, mats.metal(0xa0a4a8), [x + 0.28, 1.2, z + 0.18]);
      box(0.02, 0.4, 0.4, mats.vent(), [x + 0.28, 1.7, z]);
    }
    box(0.03, 0.06, 0.4, mats.emissive(0x7dff9a, 2.5), [x + 0.29, 1.95, 17.02]);
    B.addObstacle(x, 17.95, 0.35, 1.9, 0);
    out.locker = { pos: new THREE.Vector3(x + 1.1, 0, 17.0) };
    // panneau d'annonces
    const board = new Screen(256, 192, (c, w, h) => {
      c.fillStyle = '#2a2018'; c.fillRect(0, 0, w, h);
      const notes = [['#f2e6b0', 'RECHERCHE ARTILLEUR'], ['#bfe0ff', 'VENDS PIÈCES B2'], ['#ffd0c0', 'PRIMES : PIRATES À ARDENT'], ['#d8f0c8', 'COLOCATION CABINE 14']];
      notes.forEach(([col, txt], i) => {
        const x0 = 12 + (i % 2) * 122, y0 = 14 + Math.floor(i / 2) * 88;
        c.fillStyle = col; c.fillRect(x0, y0, 110, 76); c.fillStyle = '#222'; c.font = `700 11px ${FONT}`;
        txt.split(' ').reduce((acc, wd) => { const l = acc[acc.length - 1]; if ((l + ' ' + wd).length > 13) acc.push(wd); else acc[acc.length - 1] = (l + ' ' + wd).trim(); return acc; }, ['']).forEach((ln, k) => c.fillText(ln, x0 + 6, y0 + 20 + k * 14));
        c.fillStyle = '#c83a2a'; c.beginPath(); c.arc(x0 + 55, y0 + 4, 4, 0, 7); c.fill();
      });
    }, { period: 1e9, intensity: 1.1 });
    ctx.screens.push(board);
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.65), board.material);
    bm.position.set(-31.93, 2.0, 14.6); bm.rotation.y = Math.PI / 2; scene.add(bm);
    box(0.08, 1.8, 2.4, mats.paint(0x5a4030, { plain: true }), [-31.98, 2.0, 14.6]);
    out.board = { pos: new THREE.Vector3(-30.9, 0, 14.6) };
  }
  {
    // racks de pièces et fûts (mur est et ouest)
    const rack = (x, z, dir) => {
      const fm = mats.metal(0x3a3e42, { rough: 0.6 }), yel = mats.paint(0xd9a21b, { plain: true });
      for (const dz of [-2.05, 0, 2.05]) box(0.1, 3.0, 0.1, yel, [x, 1.5, z + dz]);
      for (let k = 0; k < 4; k++) box(0.85, 0.06, 4.2, fm, [x, 0.18 + k * 0.95, z]);
      B.colliderBox(0.85, 3.0, 4.2, [x, 1.5, z]);
      for (let k = 0; k < 3; k++) for (let i = 0; i < 5; i++) {
        const col = [0x8a5a2a, 0x3d4a5a, 0x5c6b4a, 0xb88a2a, 0x6a6e70][(i + k * 2) % 5];
        if ((i + k) % 4 !== 3) box(0.6, 0.5, 0.65, mats.cladding(col), [x - dir * 0.05, 0.46 + k * 0.95, z - 1.65 + i * 0.82]);
      }
      B.addObstacle(x, z, 0.5, 2.2, 0);
    };
    rack(31.2, -24.8, 1); rack(-31.2, -21.5, -1);
    const barrel = mats.paint(0x8a3a2a, { grime: 0.8, rust: 0.4 }), barrel2 = mats.paint(0x2f5e8a, { grime: 0.8, rust: 0.3 });
    for (const [bx, bz] of [[28.6, -16.2], [-28.6, -16.4]]) {
      for (let i = 0; i < 4; i++) B.cyl(0.32, 0.32, 0.95, i % 2 ? barrel2 : barrel, [bx + (i % 2) * 0.7, 0.48, bz + Math.floor(i / 2) * 0.7], null, { seg: 14, collide: true });
      B.addObstacle(bx + 0.35, bz + 0.35, 0.8, 0.8, 0);
    }
  }
  return out;
}
