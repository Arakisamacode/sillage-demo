import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Mobilier détaillé des intérieurs de vaisseau (frégate Atalante) : lits superposés et doubles, canapés,
// fauteuils, tables basses, bureaux équipés, armoires, bibliothèques garnies, salle d'eau, lit médicalisé,
// tabourets, lampadaires, plafonniers et appliques. Tout est fusionné dans le Builder (peu d'appels de rendu).
// Chaque meuble est décrit dans son repère local (avant = +z, yaw autour de y), posé au sol en (x, y, z).

let woodTex = null;
function woodTexture() {
  if (woodTex) return woodTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, 256, 256);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const y = rnd() * 256, a = 0.04 + rnd() * 0.1, w = 0.5 + rnd() * 2.2;
    g.strokeStyle = rnd() > 0.5 ? `rgba(40,30,20,${a})` : `rgba(255,240,220,${a * 0.7})`; g.lineWidth = w;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.5 + Math.sin(x * 0.11 + i * 3) * 0.8);
    g.stroke();
  }
  for (let k = 0; k < 4; k++) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, k * 64); g.lineTo(256, k * 64); g.stroke(); }   // lames
  woodTex = new THREE.CanvasTexture(c); woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.colorSpace = THREE.SRGBColorSpace; woodTex.anisotropy = 4;
  return woodTex;
}

export function shipDecor(ctx, B) {
  const { mats } = ctx;
  const cache = {};
  const memo = (k, f) => cache[k] || (cache[k] = f());
  const M = {
    wood: (c = 0xb08a62) => memo('w' + c, () => new THREE.MeshStandardMaterial({ color: c, map: woodTexture(), roughness: 0.55, metalness: 0 })),
    fabric: (c) => memo('f' + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.9, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.35) })),
    leather: (c) => memo('l' + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.5 })),
    sheet: () => memo('sheet', () => new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.95 })),
    ceramic: () => memo('cer', () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.12, metalness: 0 })),
    chrome: () => mats.smooth(0xd0d4d8, 0.16, 1, { grime: 0, rust: 0, scratch: 0.1 }),
    brushed: () => mats.smooth(0x9aa0a6, 0.38, 0.9, { grime: 0.1, rust: 0 }),
    dark: () => mats.smooth(0x2a2d31, 0.5, 0.6, { grime: 0.15, rust: 0 }),
    lacquer: (c) => memo('lq' + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 })),
    screen: () => memo('scr', () => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3a8ab8).multiplyScalar(1.2) }); return m; }),
    glowW: () => mats.emissive(0xffe2bc, 2.6),
    glowC: () => mats.emissive(0xdff0ff, 2.8),
    glass: (t = 0xbcd4e4, o = 0.18) => mats.glass(t, o),
  };
  // --- géométrie
  const rbox = (w, h, d, r = 0.02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const cyl = (rt, rb, h, n = 16) => new THREE.CylinderGeometry(rt, rb, h, n);
  const frame = (x, y, z, yaw) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  const L = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
  const put = (base, geo, mat, m, collide = false) => B.add(geo, mat, base.clone().multiply(m), { cast: false, collide });
  /** segment entre deux points locaux (tubes, pieds obliques) */
  const rod = (base, a, b, r, mat) => {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    put(base, cyl(r, r, len, 8), mat, new THREE.Matrix4().compose(A.add(Bv).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  };

  const D = {
    M,
    /** lit (superposé si bunk) ; tête contre -z local. Couleur de la couette `col`. */
    bed(x, y, z, yaw, { w = 0.95, l = 2.05, col = 0x3a4a6a, bunk = false, accent = 0xc8a070 } = {}) {
      const b = frame(x, y, z, yaw);
      const level = (h, c) => {
        put(b, rbox(w + 0.08, 0.2, l + 0.08, 0.03), M.dark(), L(0, h - 0.1, 0), true);                       // cadre
        put(b, rbox(w, 0.2, l, 0.07, 3), M.sheet(), L(0, h + 0.1, 0));                                         // matelas
        put(b, rbox(w + 0.05, 0.07, l * 0.6, 0.03, 3), M.fabric(c), L(0, h + 0.22, l * 0.2 + 0.03));             // couette
        put(b, rbox(w + 0.06, 0.1, 0.2, 0.045, 3), M.sheet(), L(0, h + 0.23, l * 0.2 + 0.03 - l * 0.3 - 0.02)); // drap retourné
        put(b, rbox(w + 0.06, 0.035, 0.5, 0.015), M.fabric(accent), L(0, h + 0.265, l / 2 - 0.35));           // plaid
        put(b, rbox(w * 0.68, 0.13, 0.4, 0.06, 3), M.sheet(), L(0, h + 0.27, -l / 2 + 0.28, -0.22));             // oreiller
        put(b, rbox(w + 0.12, 0.62, 0.07, 0.03, 3), M.fabric(0x2c2f34), L(0, h + 0.3, -l / 2 - 0.05));          // tête capitonnée
        for (let k = -1; k <= 1; k++) put(b, rbox(0.012, 0.5, 0.01, 0.004), M.dark(), L(k * w / 3.2, h + 0.3, -l / 2 - 0.015));
        put(b, rbox(0.22, 0.03, 0.05, 0.01), M.glowW(), L(w / 2 - 0.15, h + 0.58, -l / 2 - 0.02));             // liseuse
      };
      level(0.42, col);
      // tiroirs sous le lit
      for (const s of [-1, 1]) { put(b, rbox(0.02, 0.15, 0.85, 0.005), M.lacquer(0x3a3e44), L(w / 2 + 0.045, 0.16, s * 0.47)); put(b, rbox(0.012, 0.02, 0.3, 0.005), M.brushed(), L(w / 2 + 0.06, 0.2, s * 0.47)); }
      put(b, rbox(w - 0.1, 0.04, l - 0.1, 0.01), M.glowW(), L(0, 0.025, 0));                                   // veilleuse au sol
      if (bunk) {
        level(1.72, col === 0x3a4a6a ? 0x6a3a3a : 0x3a4a6a);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(b, rbox(0.06, 2.1, 0.06, 0.02), M.brushed(), L(sx * (w / 2 + 0.06), 1.05, sz * (l / 2 + 0.06)));
        put(b, rbox(0.04, 0.04, l * 0.7, 0.015), M.brushed(), L(w / 2 + 0.06, 2.1, -l * 0.1));                  // garde-corps
        for (let k = 0; k < 5; k++) put(b, rbox(0.05, 0.03, 0.4, 0.01), M.chrome(), L(w / 2 + 0.08, 0.35 + k * 0.33, l / 2 - 0.3));   // échelle
        for (const s of [-1, 1]) put(b, rbox(0.035, 1.75, 0.035, 0.012), M.chrome(), L(w / 2 + 0.08, 1.0, l / 2 - 0.3 + s * 0.2));
      }
    },
    /** lit double avec chevets et lampes */
    doubleBed(x, y, z, yaw, col = 0x2a3a5a) {
      D.bed(x, y, z, yaw, { w: 1.6, l: 2.1, col, accent: 0xb89058 });
      const b = frame(x, y, z, yaw);
      for (const s of [-1, 1]) {
        put(b, rbox(0.5, 0.48, 0.42, 0.03), M.wood(0x6a4a30), L(s * 1.12, 0.24, -0.82), true);
        put(b, rbox(0.42, 0.012, 0.02, 0.004), M.brushed(), L(s * 1.12, 0.36, -0.6));
        put(b, cyl(0.07, 0.09, 0.03), M.brushed(), L(s * 1.12, 0.495, -0.86));
        put(b, cyl(0.012, 0.012, 0.32, 6), M.brushed(), L(s * 1.12, 0.66, -0.86));
        put(b, cyl(0.09, 0.13, 0.18, 18), M.fabric(0xe8dcc4), L(s * 1.12, 0.86, -0.86));
        put(b, cyl(0.08, 0.08, 0.01), M.glowW(), L(s * 1.12, 0.775, -0.86));
      }
      put(b, rbox(0.14, 0.04, 0.2, 0.01), M.lacquer(0x7a2a2a), L(1.05, 0.5, -0.7));          // livre sur le chevet
    },
    /** canapé de `len` m ; dossier côté -z local */
    sofa(x, y, z, yaw, len = 2.2, col = 0x4a5562, { arms = true, pillows = 0xc8a070 } = {}) {
      const b = frame(x, y, z, yaw), d = 0.86, n = Math.max(1, Math.round(len / 0.75)), cw = len / n;
      put(b, rbox(len - 0.06, 0.12, d - 0.12, 0.02), M.dark(), L(0, 0.11, 0.02), true);                       // socle
      put(b, rbox(len - 0.2, 0.01, d - 0.3, 0.004), M.glowW(), L(0, 0.045, 0.02));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(b, cyl(0.022, 0.018, 0.06, 8), M.brushed(), L(sx * (len / 2 - 0.1), 0.03, sz * (d / 2 - 0.12)));
      put(b, rbox(len, 0.22, d, 0.05, 3), M.fabric(col), L(0, 0.27, 0));                                    // assise (structure)
      for (let i = 0; i < n; i++) put(b, rbox(cw - 0.025, 0.13, d - 0.2, 0.055, 3), M.fabric(col), L(-len / 2 + cw * (i + 0.5), 0.44, 0.07));
      put(b, rbox(len, 0.42, 0.16, 0.05, 3), M.fabric(col), L(0, 0.55, -d / 2 + 0.08));                       // dossier
      for (let i = 0; i < n; i++) put(b, rbox(cw - 0.04, 0.38, 0.17, 0.07, 3), M.fabric(col), L(-len / 2 + cw * (i + 0.5), 0.7, -d / 2 + 0.2, -0.16));
      if (arms) for (const s of [-1, 1]) put(b, rbox(0.17, 0.5, d, 0.06, 3), M.fabric(col), L(s * (len / 2 + 0.085), 0.36, 0));
      if (pillows !== null && len > 1.2) for (const s of [-1, 1]) put(b, rbox(0.4, 0.38, 0.12, 0.06, 3), M.fabric(pillows), L(s * (len / 2 - 0.28), 0.67, -d / 2 + 0.32, -0.3, s * 0.25, s * 0.12));
    },
    armchair(x, y, z, yaw, col = 0x6a4a36) { D.sofa(x, y, z, yaw, 0.78, col, { pillows: null }); },
    /** table basse, plateau bois et étagère vitrée */
    coffeeTable(x, y, z, yaw, w = 1.1, d = 0.6, { props = true } = {}) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(w, 0.04, d, 0.015, 3), M.wood(0x8a6040), L(0, 0.42, 0), true);
      put(b, rbox(w - 0.1, 0.012, d - 0.1, 0.005), M.glass(0x8aa0b0, 0.35), L(0, 0.15, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(b, rbox(0.03, 0.4, 0.03, 0.01), M.dark(), L(sx * (w / 2 - 0.06), 0.2, sz * (d / 2 - 0.06)));
      if (!props) return;
      put(b, rbox(0.24, 0.03, 0.17, 0.008), M.lacquer(0x2a4a6a), L(-w / 4, 0.455, 0.02, 0, 0.3));
      put(b, rbox(0.22, 0.025, 0.16, 0.008), M.lacquer(0xc8b070), L(-w / 4, 0.482, 0.03, 0, 0.1));
      put(b, cyl(0.04, 0.035, 0.09, 14), M.ceramic(), L(w / 4, 0.485, -0.05));
      put(b, cyl(0.13, 0.08, 0.06, 20), M.lacquer(0x1e2024), L(w / 10, 0.47, 0.08));
    },
    /** table d'appoint ronde */
    sideTable(x, y, z, h = 0.55) {
      const b = frame(x, y, z, 0);
      put(b, cyl(0.25, 0.25, 0.03, 24), M.wood(0x6a4a30), L(0, h, 0));
      put(b, cyl(0.025, 0.025, h, 8), M.brushed(), L(0, h / 2, 0));
      put(b, cyl(0.18, 0.2, 0.02, 20), M.brushed(), L(0, 0.01, 0));
    },
    /** bureau avec caisson, écran, clavier, lampe ; l'utilisateur est côté +z local */
    desk(x, y, z, yaw, w = 1.4) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(w, 0.04, 0.65, 0.012, 3), M.wood(0x9a7450), L(0, 0.74, 0), true);
      put(b, rbox(0.44, 0.7, 0.58, 0.015), M.lacquer(0x30343a), L(w / 2 - 0.25, 0.36, 0), true);
      for (let k = 0; k < 3; k++) { put(b, rbox(0.4, 0.005, 0.005, 0.002), M.dark(), L(w / 2 - 0.25, 0.25 + k * 0.2, 0.292)); put(b, rbox(0.16, 0.015, 0.02, 0.006), M.brushed(), L(w / 2 - 0.25, 0.33 + k * 0.2, 0.3)); }
      put(b, rbox(0.04, 0.72, 0.58, 0.012), M.lacquer(0x30343a), L(-w / 2 + 0.03, 0.36, 0));
      put(b, rbox(w - 0.5, 0.3, 0.02, 0.006), M.lacquer(0x30343a), L(-0.2, 0.55, -0.28));
      // écran
      put(b, cyl(0.09, 0.1, 0.015, 16), M.dark(), L(0, 0.768, -0.16));
      put(b, rbox(0.04, 0.24, 0.025, 0.01), M.dark(), L(0, 0.89, -0.17));
      put(b, rbox(0.62, 0.37, 0.025, 0.01), M.dark(), L(0, 1.07, -0.15, -0.06));
      put(b, rbox(0.58, 0.33, 0.004, 0.002), M.screen(), L(0, 1.07, -0.136, -0.06));
      put(b, rbox(0.42, 0.015, 0.14, 0.006), M.dark(), L(-0.05, 0.768, 0.12));
      put(b, rbox(0.06, 0.02, 0.1, 0.01), M.dark(), L(0.28, 0.77, 0.12));
      // lampe de bureau articulée
      put(b, cyl(0.07, 0.08, 0.02, 16), M.dark(), L(-w / 2 + 0.18, 0.77, -0.18));
      rod(b, [-w / 2 + 0.18, 0.78, -0.18], [-w / 2 + 0.24, 1.12, -0.1], 0.008, M.brushed());
      rod(b, [-w / 2 + 0.24, 1.12, -0.1], [-w / 2 + 0.38, 1.06, 0.06], 0.008, M.brushed());
      put(b, cyl(0.025, 0.06, 0.08, 14), M.dark(), L(-w / 2 + 0.4, 1.03, 0.08, 0.5));
      put(b, cyl(0.055, 0.055, 0.004, 14), M.glowW(), L(-w / 2 + 0.41, 0.99, 0.1, 0.5));
      put(b, cyl(0.04, 0.035, 0.09, 14), M.ceramic(), L(w / 2 - 0.2, 0.805, 0.1));
    },
    /** armoire deux portes, poignées verticales, liseré lumineux */
    wardrobe(x, y, z, yaw, w = 1.2, h = 2.2, d = 0.6, col = 0x3a3e46) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(w, h, d, 0.02), M.lacquer(col), L(0, h / 2, 0), true);
      for (const s of [-1, 1]) {
        put(b, rbox(w / 2 - 0.015, h - 0.06, 0.02, 0.008), M.lacquer(col), L(s * w / 4, h / 2, d / 2 + 0.008));
        put(b, rbox(0.018, 0.5, 0.025, 0.008), M.brushed(), L(s * 0.06, h * 0.52, d / 2 + 0.035));
      }
      put(b, rbox(w - 0.06, 0.012, 0.012, 0.004), M.glowW(), L(0, h - 0.015, d / 2 + 0.01));
      put(b, rbox(w + 0.02, 0.08, d + 0.02, 0.01), M.dark(), L(0, 0.04, 0));
    },
    /** bibliothèque garnie (livres de hauteurs et couleurs variées, boîtes, objets) */
    shelves(x, y, z, yaw, w = 1.4, h = 1.9, d = 0.32, seed = 1) {
      const b = frame(x, y, z, yaw);
      let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      for (const sx of [-1, 1]) put(b, rbox(0.03, h, d, 0.008), M.wood(0x5a4030), L(sx * (w / 2 - 0.015), h / 2, 0));
      put(b, rbox(w, h, 0.015, 0.005), M.wood(0x4a3424), L(0, h / 2, -d / 2 + 0.008));
      const rows = Math.max(3, Math.round(h / 0.4));
      const BK = [0x8a2a2a, 0x2a4a6a, 0x3a5a3a, 0xc8a050, 0x5a2a4a, 0xd8d0c0, 0x1e2a3a, 0xa05a2a];
      for (let r = 0; r <= rows; r++) {
        const yy = (r / rows) * (h - 0.03) + 0.015;
        put(b, rbox(w - 0.05, 0.025, d - 0.02, 0.006), M.wood(0x5a4030), L(0, yy, 0.005));
        if (r === rows) break;
        let xx = -w / 2 + 0.06;
        while (xx < w / 2 - 0.12) {
          const t = rnd();
          if (t < 0.12) { const bw = 0.18 + rnd() * 0.1; put(b, rbox(bw, 0.14, d * 0.7, 0.01), M.lacquer([0xd8d0c0, 0x2a2e34, 0x8a6a4a][r % 3]), L(xx + bw / 2, yy + 0.085, 0)); xx += bw + 0.03; continue; }
          if (t < 0.2) { put(b, cyl(0.045, 0.035, 0.16, 12), M.ceramic(), L(xx + 0.05, yy + 0.095, 0)); xx += 0.12; continue; }
          if (t < 0.26) { xx += 0.1 + rnd() * 0.15; continue; }
          const n = 3 + Math.floor(rnd() * 8);
          for (let i = 0; i < n && xx < w / 2 - 0.08; i++) {
            const bh = 0.18 + rnd() * 0.12, bt = 0.022 + rnd() * 0.025, lean = i === n - 1 && rnd() > 0.6 ? 0.25 : 0;
            put(b, rbox(bt, bh, d * (0.62 + rnd() * 0.2), 0.004), M.lacquer(BK[Math.floor(rnd() * BK.length)]), L(xx + bt / 2 + lean * 0.1, yy + 0.013 + bh / 2 - lean * 0.01, 0.01, 0, 0, -lean));
            xx += bt + 0.002;
          }
          xx += 0.03;
        }
      }
    },
    /** tapis à bordure */
    rug(x, y, z, yaw, w, d, col, border = 0xd8c8a8) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(w, 0.014, d, 0.005), M.fabric(border), L(0, 0.03, 0));
      put(b, rbox(w - 0.16, 0.016, d - 0.16, 0.005), M.fabric(col), L(0, 0.032, 0));
    },
    /** habillage chaleureux d'une pièce : faux plafond clair, lambris bas (côtés listés : 'n' z0, 's' z1, 'w' x0, 'e' x1) */
    cozy(x0, x1, z0, z1, y, h, sides = 'nswe', col = 0xd8d0c4, wain = 0x6a4a34) {
      const b = frame(0, y, 0, 0);
      put(b, new THREE.BoxGeometry(x1 - x0, 0.02, z1 - z0), M.lacquer(col), L((x0 + x1) / 2, h - 0.012, (z0 + z1) / 2));
      const wm = M.wood(wain), fm = M.fabric(0xb8ae9e);
      for (const c of sides) {
        const alongX = c === 'n' || c === 's', len = alongX ? x1 - x0 : z1 - z0;
        const px = c === 'w' ? x0 + 0.015 : c === 'e' ? x1 - 0.015 : (x0 + x1) / 2, pz = c === 'n' ? z0 + 0.015 : c === 's' ? z1 - 0.015 : (z0 + z1) / 2;
        const g = (hh, t) => (alongX ? new THREE.BoxGeometry(len, hh, t) : new THREE.BoxGeometry(t, hh, len));
        put(b, g(1.0, 0.025), wm, L(px, 0.5, pz));
        put(b, g(h - 1.25, 0.02), fm, L(px, 1.05 + (h - 1.25) / 2 + 0.1, pz));
        put(b, g(0.04, 0.035), M.brushed(), L(px, 1.02, pz));
      }
    },
    /** plafonnier encastré (pièce de hauteur `ch`) */
    ceilingPanel(x, y, z, ch, w = 1.2, d = 1.2, warm = true) {
      const b = frame(x, y + ch, z, 0);
      put(b, rbox(w + 0.08, 0.04, d + 0.08, 0.01), M.brushed(), L(0, -0.02, 0));
      put(b, rbox(w, 0.02, d, 0.006), warm ? M.glowW() : M.glowC(), L(0, -0.04, 0));
    },
    /** applique murale ; avant = +z local (face au mur opposé) */
    sconce(x, y, z, yaw) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(0.14, 0.32, 0.04, 0.012), M.brushed(), L(0, 0, 0.02));
      put(b, rbox(0.1, 0.26, 0.03, 0.01), M.glowW(), L(0, 0, 0.05));
    },
    /** lampadaire */
    floorLamp(x, y, z) {
      const b = frame(x, y, z, 0);
      put(b, cyl(0.16, 0.18, 0.03, 20), M.dark(), L(0, 0.015, 0));
      put(b, cyl(0.014, 0.014, 1.45, 8), M.brushed(), L(0, 0.75, 0));
      put(b, cyl(0.17, 0.22, 0.3, 24), M.fabric(0xe8dcc4), L(0, 1.55, 0));
      put(b, cyl(0.2, 0.2, 0.01, 20), M.glowW(), L(0, 1.405, 0));
    },
    /** tabouret de bar */
    stool(x, y, z, h = 0.76, col = 0x3a2418) {
      const b = frame(x, y, z, 0);
      put(b, cyl(0.2, 0.22, 0.025, 20), M.chrome(), L(0, 0.013, 0));
      put(b, cyl(0.025, 0.025, h - 0.06, 8), M.chrome(), L(0, h / 2, 0));
      put(b, new THREE.TorusGeometry(0.17, 0.012, 6, 20).rotateX(Math.PI / 2), M.chrome(), L(0, 0.3, 0));
      put(b, cyl(0.19, 0.17, 0.07, 22), M.leather(col), L(0, h, 0));
    },
    /** lavabo sur meuble, miroir rétroéclairé ; avant = +z local */
    vanity(x, y, z, yaw) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(0.8, 0.5, 0.46, 0.02), M.wood(0x8a6a4a), L(0, 0.55, 0), true);
      put(b, rbox(0.84, 0.04, 0.5, 0.012), M.ceramic(), L(0, 0.82, 0));
      put(b, cyl(0.2, 0.15, 0.1, 24), M.ceramic(), L(0, 0.86, 0.02));
      put(b, cyl(0.17, 0.13, 0.02, 24), M.lacquer(0xcfd6da), L(0, 0.905, 0.02));
      put(b, cyl(0.015, 0.015, 0.2, 8), M.chrome(), L(0, 0.94, -0.2));
      put(b, rbox(0.03, 0.025, 0.14, 0.01), M.chrome(), L(0, 1.04, -0.14));
      put(b, rbox(0.62, 0.78, 0.02, 0.01), M.glass(0xd8e4ea, 0.55), L(0, 1.5, -0.22));
      put(b, rbox(0.66, 0.82, 0.012, 0.01), M.glowW(), L(0, 1.5, -0.235));
      put(b, cyl(0.03, 0.03, 0.12, 10), M.lacquer(0x3a8a7a), L(0.3, 0.9, -0.12));
    },
    /** toilettes suspendues ; avant = +z local */
    toilet(x, y, z, yaw) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(0.4, 0.55, 0.16, 0.03), M.ceramic(), L(0, 0.75, -0.08));
      put(b, rbox(0.38, 0.34, 0.55, 0.12, 3), M.ceramic(), L(0, 0.3, 0.22));
      put(b, rbox(0.36, 0.03, 0.48, 0.1, 3), M.lacquer(0xe8e8e4), L(0, 0.49, 0.24));
      put(b, rbox(0.16, 0.08, 0.01, 0.005), M.chrome(), L(0, 0.95, 0.005));
    },
    /** douche : receveur, paroi vitrée, colonne et pommeau ; emprise w × d, paroi côté +z */
    shower(x, y, z, yaw, w = 1.0, d = 1.0) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(w, 0.06, d, 0.02), M.ceramic(), L(0, 0.03, 0));
      put(b, rbox(w * 0.3, 0.005, 0.06, 0.002), M.dark(), L(0, 0.063, 0));
      put(b, rbox(w - 0.02, 2.0, 0.012, 0.004), M.glass(0xd0e4ee, 0.22), L(0, 1.06, d / 2 - 0.006));
      put(b, rbox(0.03, 2.0, 0.03, 0.01), M.chrome(), L(w / 2 - 0.02, 1.06, d / 2 - 0.006));
      put(b, rbox(0.03, 1.1, 0.03, 0.012), M.chrome(), L(0, 1.45, -d / 2 + 0.06));
      put(b, rbox(0.03, 0.03, 0.25, 0.012), M.chrome(), L(0, 2.0, -d / 2 + 0.18));
      put(b, cyl(0.12, 0.12, 0.015, 24), M.chrome(), L(0, 1.98, -d / 2 + 0.3));
      put(b, rbox(0.12, 0.16, 0.04, 0.01), M.chrome(), L(0, 1.1, -d / 2 + 0.03));
    },
    /** lit médicalisé : vérin, matelas, barrières, potence, moniteur sur bras */
    medBed(x, y, z, yaw) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(0.7, 0.12, 1.6, 0.03), M.dark(), L(0, 0.08, 0), true);
      for (const s of [-1, 1]) put(b, cyl(0.06, 0.06, 0.06, 12), M.dark(), L(0.28, 0.04, s * 0.7));
      put(b, rbox(0.3, 0.42, 0.5, 0.04), M.brushed(), L(0, 0.35, 0));
      put(b, rbox(0.95, 0.08, 2.05, 0.02), M.lacquer(0xe8ecee), L(0, 0.6, 0), true);
      put(b, rbox(0.88, 0.14, 1.3, 0.06, 3), M.lacquer(0x7ab8c8), L(0, 0.71, 0.35));
      put(b, rbox(0.88, 0.14, 0.72, 0.06, 3), M.lacquer(0x7ab8c8), L(0, 0.83, -0.66, 0.35));
      put(b, rbox(0.55, 0.1, 0.32, 0.05, 3), M.sheet(), L(0, 0.98, -0.8, 0.35));
      put(b, rbox(0.9, 0.04, 0.9, 0.02, 3), M.sheet(), L(0, 0.8, 0.5));
      for (const s of [-1, 1]) { put(b, rbox(0.03, 0.22, 0.8, 0.012), M.lacquer(0xd8dcde), L(s * 0.49, 0.82, -0.3)); put(b, rbox(0.01, 0.02, 0.5, 0.005), M.glowC(), L(s * 0.505, 0.85, -0.3)); }
      put(b, rbox(0.95, 0.4, 0.05, 0.02), M.lacquer(0xd8dcde), L(0, 0.85, -1.04));
      // potence et perfusion
      put(b, cyl(0.02, 0.02, 1.9, 8), M.chrome(), L(0.58, 0.95, -0.95));
      put(b, rbox(0.3, 0.015, 0.015, 0.005), M.chrome(), L(0.58, 1.88, -0.95));
      put(b, rbox(0.1, 0.18, 0.04, 0.02, 3), M.glass(0xe8f4ff, 0.55), L(0.7, 1.75, -0.95));
      // moniteur sur bras
      rod(b, [-0.55, 0.6, -1.0], [-0.55, 1.7, -1.0], 0.02, M.brushed());
      rod(b, [-0.55, 1.7, -1.0], [-0.35, 1.7, -0.6], 0.015, M.brushed());
      put(b, rbox(0.42, 0.3, 0.04, 0.015), M.dark(), L(-0.35, 1.7, -0.58, 0, 0.6));
      put(b, rbox(0.38, 0.26, 0.004, 0.002), mats.emissive(0x2a9a6a, 1.4), L(-0.338, 1.7, -0.558, 0, 0.6));
    },
    /** vitrine médicale (portes vitrées, flacons) ; avant = +z */
    medCabinet(x, y, z, yaw, w = 1.6, h = 2.0) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(w, h, 0.45, 0.02), M.lacquer(0xe8ecee), L(0, h / 2, 0), true);
      put(b, rbox(w - 0.06, h * 0.5, 0.01, 0.005), M.glass(0xd0e8f0, 0.25), L(0, h * 0.7, 0.23));
      for (let r = 0; r < 3; r++) { put(b, rbox(w - 0.1, 0.012, 0.36, 0.004), M.glass(0xe0f0f8, 0.5), L(0, h * 0.48 + r * h * 0.16, 0.02)); for (let k = 0; k < 8; k++) put(b, cyl(0.03, 0.03, 0.08 + (k % 3) * 0.03, 10), M.lacquer([0xf2f2ee, 0x9ac8e8, 0xe89a5a, 0xc8e8c8][(k + r) % 4]), L(-w / 2 + 0.15 + k * (w - 0.3) / 7, h * 0.48 + r * h * 0.16 + 0.06, 0)); }
      for (const s of [-1, 1]) put(b, rbox(w / 2 - 0.02, h * 0.42, 0.015, 0.006), M.lacquer(0xd8dcde), L(s * w / 4, h * 0.22, 0.23));
      put(b, rbox(0.2, 0.2, 0.01, 0.004), mats.emissive(0x3ac870, 2), L(0, h - 0.18, 0.231));
    },
    /** bar : comptoir bois, plateau, repose-pieds, liseré ; clients côté +z */
    bar(x, y, z, yaw, len = 5) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(len, 1.02, 0.6, 0.03), M.wood(0x5a3a24), L(0, 0.51, 0), true);
      for (let k = -len / 2 + 0.3; k < len / 2; k += 0.3) put(b, rbox(0.012, 0.9, 0.01, 0.004), M.dark(), L(k, 0.52, 0.302));
      put(b, rbox(len + 0.1, 0.05, 0.75, 0.02, 3), M.lacquer(0x14161a), L(0, 1.05, 0.05));
      put(b, rbox(len - 0.1, 0.012, 0.012, 0.004), M.glowW(), L(0, 1.0, 0.43));
      put(b, rbox(len - 0.2, 0.012, 0.012, 0.004), M.glowW(), L(0, 0.05, 0.31));
      rod(b, [-len / 2 + 0.1, 0.22, 0.42], [len / 2 - 0.1, 0.22, 0.42], 0.02, M.chrome());
      // verres et bouteilles sur le comptoir
      for (let k = 0; k < 5; k++) put(b, cyl(0.035, 0.03, 0.12, 12), M.glass(0xe8f4ff, 0.4), L(-len / 2 + 0.6 + k * (len - 1.2) / 4, 1.135, 0.1 + (k % 2) * 0.12));
    },
    /** étagère à bouteilles rétroéclairée contre le mur ; avant = +z */
    bottleWall(x, y, z, yaw, len = 4) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(len, 1.6, 0.02, 0.01), M.glowW(), L(0, 1.7, -0.14));
      put(b, rbox(len + 0.1, 1.8, 0.03, 0.01), M.wood(0x3a2418), L(0, 1.7, -0.17));
      for (let r = 0; r < 3; r++) {
        put(b, rbox(len, 0.025, 0.24, 0.008), M.glass(0xe0f0f8, 0.4), L(0, 1.0 + r * 0.52, -0.02));
        for (let k = 0; k < Math.floor(len / 0.16); k++) {
          const c = [0x2a5a2a, 0x6a2a1a, 0xc8a060, 0x1a2a4a, 0xe8e4d8, 0x5a1a2a][(k * 7 + r * 3) % 6];
          const hh = 0.22 + ((k * 5 + r) % 4) * 0.04, xx = -len / 2 + 0.1 + k * 0.16;
          put(b, cyl(0.035, 0.038, hh, 10), M.glass(c, 0.75), L(xx, 1.02 + r * 0.52 + hh / 2, -0.02));
          put(b, cyl(0.012, 0.02, 0.08, 8), M.glass(c, 0.8), L(xx, 1.02 + r * 0.52 + hh + 0.04, -0.02));
        }
      }
      put(b, rbox(len, 0.9, 0.45, 0.02), M.lacquer(0x22252a), L(0, 0.45, 0.06), true);
    },
    /** plante en pot (modèle photoscanné) */
    plant(x, y, z, h = 1.0, id = 'potted_plant_04', ry = 0) { ctx.models?.place(B, id, x, y, z, { fit: ['y', h], ry }); },
    /** grande table de réunion arrondie à liseré lumineux */
    confTable(x, y, z, yaw, w = 5.2, d = 1.7) {
      const b = frame(x, y, z, yaw);
      put(b, rbox(w, 0.06, d, 0.3, 4), M.wood(0x4a3424), L(0, 0.75, 0), true);
      put(b, rbox(w - 0.1, 0.01, d - 0.1, 0.26, 3), M.glowC(), L(0, 0.715, 0));
      for (const s of [-1, 1]) put(b, rbox(0.5, 0.7, d * 0.5, 0.04), M.dark(), L(s * w * 0.3, 0.36, 0));
      put(b, rbox(1.2, 0.004, 0.5, 0.05), mats.emissive(0x2a6a9a, 1.2), L(0, 0.782, 0));
      for (let k = 0; k < 6; k++) put(b, rbox(0.3, 0.006, 0.22, 0.01), M.dark(), L(-w / 2 + 0.7 + (k % 3) * (w - 1.4) / 2, 0.784, (k < 3 ? -1 : 1) * (d / 2 - 0.25)));
    },
  };
  return D;
}
