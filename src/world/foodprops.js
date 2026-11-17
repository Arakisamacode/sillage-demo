import * as THREE from 'three';

// Bibliothèque d'objets détaillés pour la restauration : plats (bols garnis, pizzas, burgers, croissants,
// baguettes, sushis, tacos, raviolis), vaisselle (tasses, verres, bouteilles étiquetées), batterie de cuisine
// (marmites à couvercle, woks, louches, poêles), mobilier (plateaux, présentoirs à condiments, distributeurs
// de serviettes, frigos vitrés, poubelles de tri, potelets à sangle).
// Tout est fusionné dans le lot statique (Builder) avec des matériaux partagés : coût de rendu faible.

const G = {};   // géométries de base réutilisées (clonées par Builder.add)
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
function geos() {
  if (G.bowl) return G;
  G.bowl = lathe([[0, 0], [0.05, 0], [0.07, 0.01], [0.11, 0.05], [0.125, 0.075], [0.118, 0.078], [0.1, 0.05], [0.06, 0.02], [0, 0.015]]);
  G.plate = lathe([[0, 0], [0.1, 0], [0.12, 0.008], [0.15, 0.02], [0.145, 0.022], [0.11, 0.012], [0, 0.01]], 24);
  G.cup = lathe([[0, 0], [0.032, 0], [0.04, 0.03], [0.042, 0.075], [0.038, 0.075], [0.035, 0.03], [0, 0.006]], 16);
  G.saucer = lathe([[0, 0], [0.04, 0], [0.065, 0.012], [0.062, 0.014], [0, 0.006]], 18);
  G.bottle = lathe([[0, 0], [0.032, 0], [0.034, 0.012], [0.034, 0.13], [0.02, 0.17], [0.012, 0.19], [0.012, 0.215], [0, 0.215]], 14);
  G.pot = lathe([[0, 0], [0.2, 0], [0.22, 0.02], [0.22, 0.32], [0.23, 0.33], [0.2, 0.33], [0.2, 0.03], [0, 0.03]], 22);
  G.lid = lathe([[0, 0], [0.225, 0], [0.2, 0.03], [0.08, 0.06], [0.03, 0.065], [0.035, 0.09], [0, 0.095]], 22);
  G.wok = lathe([[0, 0], [0.1, 0.005], [0.22, 0.05], [0.3, 0.12], [0.29, 0.125], [0.2, 0.06], [0.09, 0.02], [0, 0.015]], 22);
  G.glass = lathe([[0, 0], [0.03, 0], [0.036, 0.12], [0.033, 0.12], [0.028, 0.006], [0, 0.006]], 14);
  G.jar = lathe([[0, 0], [0.04, 0], [0.045, 0.02], [0.045, 0.1], [0.032, 0.115], [0.032, 0.13], [0, 0.13]], 14);
  G.croissant = new THREE.TorusGeometry(0.07, 0.035, 8, 14, Math.PI * 1.15);
  G.baguette = new THREE.CapsuleGeometry(0.03, 0.5, 4, 10);
  G.bun = new THREE.SphereGeometry(0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  G.disc = new THREE.CylinderGeometry(1, 1, 1, 18);
  G.crust = new THREE.TorusGeometry(1, 0.12, 6, 28);
  G.ball = new THREE.SphereGeometry(1, 10, 7);
  G.box = new THREE.BoxGeometry(1, 1, 1);
  G.handle = new THREE.TorusGeometry(0.035, 0.008, 5, 10, Math.PI);
  G.shell = new THREE.CylinderGeometry(0.08, 0.08, 0.12, 14, 1, true, 0, Math.PI);
  return G;
}

/** Fabrique liée à un Builder et aux matériaux. place(geo, mat, matriceLocale) dans un repère monde « base ». */
export function foodKit(ctx) {
  const { mats, builder: B } = ctx;
  geos();
  const M = {
    ceramic: mats.smooth(0xf2f0ea, 0.25, 0.0), ceramicD: mats.smooth(0x2a2c2e, 0.3, 0.0), steel: mats.smooth(0xb8bcc0, 0.25, 0.9),
    copper: mats.smooth(0xb87333, 0.25, 0.9), iron: mats.smooth(0x222428, 0.5, 0.6), wood: mats.paint(0x7a5232, { plain: true, rough: 0.7 }),
    bamboo: mats.plastic(0xc8a46a, 0.85), dough: mats.plastic(0xd8973a, 0.65), doughL: mats.plastic(0xe8c07a, 0.7), cheese: mats.plastic(0xf2d06a, 0.5),
    sauce: mats.plastic(0xb8301e, 0.4), pepperoni: mats.plastic(0x9a2a1e, 0.5), basil: mats.plastic(0x2a7a2a, 0.6), lettuce: mats.plastic(0x5aaa3a, 0.7),
    tomato: mats.plastic(0xd8402a, 0.35), meat: mats.plastic(0x5a2a18, 0.7), meatL: mats.plastic(0x8a4a2a, 0.6), rice: mats.plastic(0xf4f2ea, 0.85),
    nori: mats.plastic(0x1a2a1a, 0.6), salmon: mats.plastic(0xf08a5a, 0.4), tuna: mats.plastic(0xc8303a, 0.4), egg: mats.plastic(0xf8f4e8, 0.4), yolk: mats.plastic(0xf0b030, 0.3),
    broth: mats.plastic(0xb8642a, 0.15), brothL: mats.plastic(0xd8a050, 0.15), curry: mats.plastic(0xd8782a, 0.3), noodle: mats.plastic(0xf0dca0, 0.5), herb: mats.plastic(0x4a9a3a, 0.7),
    choco: mats.plastic(0x4a2a1a, 0.5), cream: mats.plastic(0xf8f2e2, 0.6), glassM: mats.glass(0xcfe8ff, 0.35), drinkA: mats.plastic(0xc87a2a, 0.1), drinkB: mats.plastic(0xe8e0c8, 0.3),
    paper: mats.paint(0xf2f2ee, { plain: true, rough: 0.9 }), red: mats.plastic(0xc83a2a, 0.4), yellow: mats.plastic(0xe8c23a, 0.4), green: mats.plastic(0x3a8a3a, 0.4), black: mats.plastic(0x1a1a1c, 0.5),
    tray: mats.plastic(0x3a4a5a, 0.5), trayB: mats.plastic(0x6a3a2a, 0.5),
  };
  const T = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  /** pose une géométrie dans le repère base (Matrix4) avec la transformation locale m */
  const put = (base, geo, mat, m) => B.add(geo, mat, base.clone().multiply(m), { cast: false });
  const K = {
    M, T, put,
    base: (x, y, z, ry = 0) => T(x, y, z, ry),
    // ------------------------------------------------------------- plats
    bowl(base, x, z, kind = 'pho', y = 0) {
      put(base, G.bowl, kind === 'ramen' ? M.ceramicD : M.ceramic, T(x, y, z));
      put(base, G.disc, kind === 'curry' ? M.curry : kind === 'miso' ? M.brothL : M.broth, T(x, y + 0.062, z, 0, 0.105, 0.004, 0.105));
      if (kind === 'pho' || kind === 'ramen') {
        for (let k = 0; k < 5; k++) put(base, G.box, M.noodle, T(x - 0.04 + k * 0.02, y + 0.066, z + (k % 2 ? 0.02 : -0.02), 0.4 * k, 0.012, 0.006, 0.08));
        for (let k = 0; k < 3; k++) put(base, G.box, M.meatL, T(x + 0.02 + k * 0.012, y + 0.068, z - 0.04 + k * 0.03, 0.8, 0.05, 0.005, 0.035));
        for (let k = 0; k < 6; k++) put(base, G.ball, M.herb, T(x - 0.05 + (k % 3) * 0.03, y + 0.069, z + 0.03 + Math.floor(k / 3) * 0.02, 0, 0.012, 0.004, 0.012));
        if (kind === 'ramen') { put(base, G.ball, M.egg, T(x + 0.04, y + 0.068, z + 0.03, 0, 0.025, 0.012, 0.025)); put(base, G.disc, M.yolk, T(x + 0.04, y + 0.078, z + 0.03, 0, 0.012, 0.002, 0.012)); put(base, G.box, M.nori, T(x - 0.06, y + 0.09, z - 0.02, 0.2, 0.05, 0.06, 0.004)); }
      } else if (kind === 'curry') {
        for (let k = 0; k < 5; k++) put(base, G.ball, M.meatL, T(x - 0.04 + (k % 3) * 0.04, y + 0.068, z - 0.02 + Math.floor(k / 3) * 0.04, 0, 0.018, 0.012, 0.018));
        put(base, G.ball, M.cream, T(x + 0.03, y + 0.067, z + 0.03, 0, 0.02, 0.003, 0.02));
      } else if (kind === 'chili') {
        for (let k = 0; k < 8; k++) put(base, G.ball, k % 3 ? M.meat : M.tomato, T(x - 0.05 + (k % 4) * 0.033, y + 0.068, z - 0.03 + Math.floor(k / 4) * 0.05, 0, 0.014, 0.01, 0.014));
      }
    },
    plate(base, x, z, kind = 'main', y = 0) {
      put(base, G.plate, M.ceramic, T(x, y, z));
      if (kind === 'main') {
        put(base, G.ball, M.rice, T(x - 0.04, y + 0.03, z + 0.02, 0, 0.055, 0.035, 0.05));
        put(base, G.box, M.meatL, T(x + 0.045, y + 0.025, z - 0.01, 0.4, 0.09, 0.022, 0.06));
        for (let k = 0; k < 4; k++) put(base, G.ball, k % 2 ? M.herb : M.tomato, T(x + 0.02 + k * 0.022, y + 0.026, z + 0.06, 0, 0.014));
      } else if (kind === 'cake') {
        put(base, G.box, M.choco, T(x, y + 0.04, z, 0.3, 0.07, 0.06, 0.09));
        put(base, G.box, M.cream, T(x, y + 0.072, z, 0.3, 0.072, 0.008, 0.092));
        put(base, G.ball, M.tomato, T(x, y + 0.085, z, 0, 0.012));
      } else if (kind === 'fries') {
        put(base, G.box, M.red, T(x, y + 0.05, z, 0.2, 0.08, 0.09, 0.05));
        for (let k = 0; k < 10; k++) put(base, G.box, M.cheese, T(x - 0.03 + (k % 5) * 0.015, y + 0.11 + (k % 3) * 0.008, z - 0.012 + Math.floor(k / 5) * 0.022, 0.2 + k * 0.3, 0.008, 0.07, 0.008, 0.2 * ((k % 3) - 1)));
      } else if (kind === 'sushi') {
        for (let k = 0; k < 4; k++) K.maki(base, x - 0.06 + k * 0.04, z - 0.02, y + 0.012);
        for (let k = 0; k < 2; k++) K.nigiri(base, x - 0.03 + k * 0.06, z + 0.05, y + 0.012, k ? M.tuna : M.salmon);
      } else if (kind === 'nachos') {
        for (let k = 0; k < 9; k++) put(base, G.box, M.cheese, T(x - 0.06 + (k % 3) * 0.05, y + 0.02 + (k % 2) * 0.012, z - 0.05 + Math.floor(k / 3) * 0.05, k * 0.7, 0.06, 0.004, 0.05, 0.3, 0.2));
        put(base, G.ball, M.herb, T(x + 0.02, y + 0.03, z, 0, 0.035, 0.018, 0.035));
      } else if (kind === 'rolls') {
        for (let k = 0; k < 3; k++) put(base, G.baguette, M.rice, T(x - 0.05 + k * 0.05, y + 0.025, z, 0, 0.7, 0.22, 0.7, Math.PI / 2));
        put(base, G.ball, M.herb, T(x + 0.08, y + 0.02, z + 0.06, 0, 0.025, 0.01, 0.025));
      }
    },
    maki(base, x, z, y) { put(base, G.disc, M.nori, T(x, y + 0.015, z, 0, 0.017, 0.03, 0.017)); put(base, G.disc, M.rice, T(x, y + 0.031, z, 0, 0.015, 0.002, 0.015)); put(base, G.disc, M.salmon, T(x, y + 0.033, z, 0, 0.006, 0.002, 0.006)); },
    nigiri(base, x, z, y, fish) { put(base, G.ball, M.rice, T(x, y + 0.012, z, 0.3, 0.03, 0.014, 0.016)); put(base, G.box, fish, T(x, y + 0.027, z, 0.3, 0.07, 0.008, 0.032)); },
    pizza(base, x, z, y = 0, r = 0.22, top = 'pepperoni') {
      put(base, G.disc, M.dough, T(x, y + 0.006, z, 0, r, 0.012, r));
      put(base, G.crust, M.dough, T(x, y + 0.014, z, 0, r * 0.94, r * 0.94, r * 0.5, Math.PI / 2));
      put(base, G.disc, top === 'quatre' ? M.cheese : M.sauce, T(x, y + 0.014, z, 0, r * 0.86, 0.003, r * 0.86));
      for (let k = 0; k < 9; k++) { const a = k * 2.4, d = r * 0.55 * Math.sqrt((k + 1) / 9); put(base, G.ball, M.cheese, T(x + Math.cos(a) * d, y + 0.017, z + Math.sin(a) * d, 0, r * 0.14, r * 0.02, r * 0.12)); }
      if (top !== 'quatre') for (let k = 0; k < 7; k++) { const a = k * 0.9 + 0.3, d = r * 0.6 * ((k % 3) + 1) / 3; put(base, G.disc, M.pepperoni, T(x + Math.cos(a) * d, y + 0.02, z + Math.sin(a) * d, 0, r * 0.1, 0.003, r * 0.1)); }
      for (let k = 0; k < 4; k++) put(base, G.ball, M.basil, T(x + Math.cos(k * 1.6) * r * 0.35, y + 0.022, z + Math.sin(k * 1.6) * r * 0.35, k, r * 0.07, 0.003, r * 0.04));
      for (let k = 0; k < 3; k++) put(base, G.box, M.meat, T(x, y + 0.021, z, (k * Math.PI) / 3, r * 1.75, 0.002, 0.004));
    },
    burger(base, x, z, y = 0, s = 1) {
      put(base, G.disc, M.dough, T(x, y + 0.012 * s, z, 0, 0.07 * s, 0.024 * s, 0.07 * s));
      put(base, G.disc, M.meat, T(x, y + 0.034 * s, z, 0, 0.072 * s, 0.022 * s, 0.072 * s));
      put(base, G.box, M.cheese, T(x, y + 0.047 * s, z, 0.785, 0.1 * s, 0.004 * s, 0.1 * s));
      put(base, G.disc, M.tomato, T(x, y + 0.052 * s, z, 0, 0.06 * s, 0.008 * s, 0.06 * s));
      put(base, G.disc, M.lettuce, T(x, y + 0.058 * s, z, 0, 0.078 * s, 0.006 * s, 0.078 * s));
      put(base, G.bun, M.dough, T(x, y + 0.061 * s, z, 0, s, 0.75 * s, s));
      for (let k = 0; k < 7; k++) put(base, G.ball, M.cream, T(x + Math.cos(k) * 0.035 * s, y + 0.11 * s - (k % 2) * 0.006 * s, z + Math.sin(k) * 0.035 * s, k, 0.006 * s, 0.003 * s, 0.004 * s));
    },
    taco(base, x, z, y = 0, ry = 0) {
      put(base, G.shell, M.doughL, T(x, y + 0.075, z, ry, 1, 1, 1, 0, Math.PI / 2));
      for (let k = 0; k < 6; k++) put(base, G.ball, [M.meatL, M.lettuce, M.tomato, M.cheese][k % 4], T(x + Math.sin(ry) * (k - 2.5) * 0.018, y + 0.12, z + Math.cos(ry) * (k - 2.5) * 0.018, 0, 0.018, 0.014, 0.018));
    },
    croissant(base, x, z, y = 0, ry = 0) { put(base, G.croissant, M.dough, T(x, y + 0.035, z, ry, 1, 0.8, 1, Math.PI / 2)); },
    baguette(base, x, z, y = 0, ry = 0, tilt = 0) {
      put(base, G.baguette, M.dough, T(x, y + 0.03, z, ry, 1, 1, 1, Math.PI / 2 + tilt));
      for (let k = 0; k < 4; k++) put(base, G.box, M.doughL, T(x + Math.sin(ry) * (k - 1.5) * 0.11, y + 0.06, z + Math.cos(ry) * (k - 1.5) * 0.11, ry + 0.5, 0.012, 0.004, 0.06));
    },
    dumplings(base, x, z, y = 0) {
      put(base, G.disc, M.bamboo, T(x, y + 0.035, z, 0, 0.17, 0.07, 0.17));
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; put(base, G.ball, M.egg, T(x + Math.cos(a) * 0.08, y + 0.08, z + Math.sin(a) * 0.08, a, 0.035, 0.025, 0.03)); }
      put(base, G.ball, M.egg, T(x, y + 0.08, z, 0, 0.035, 0.025, 0.03));
    },
    cup(base, x, z, y = 0, drink = M.drinkA) { put(base, G.saucer, M.ceramic, T(x, y, z)); put(base, G.cup, M.ceramic, T(x, y + 0.006, z)); put(base, G.disc, drink, T(x, y + 0.066, z, 0, 0.036, 0.003, 0.036)); put(base, G.handle, M.ceramic, T(x + 0.04, y + 0.045, z, 0, 1, 1, 1, 0, -Math.PI / 2)); },
    glass(base, x, z, y = 0, drink = M.drinkB) { put(base, G.glass, M.glassM, T(x, y, z)); put(base, G.disc, drink, T(x, y + 0.045, z, 0, 0.03, 0.08, 0.03)); },
    bottle(base, x, z, y = 0, label = M.red, body = M.glassM) { put(base, G.bottle, body, T(x, y, z)); put(base, G.disc, label, T(x, y + 0.07, z, 0, 0.0355, 0.06, 0.0355)); put(base, G.disc, M.black, T(x, y + 0.218, z, 0, 0.014, 0.012, 0.014)); },
    jar(base, x, z, y = 0, fill = M.curry) { put(base, G.jar, M.glassM, T(x, y, z)); put(base, G.disc, fill, T(x, y + 0.045, z, 0, 0.04, 0.08, 0.04)); put(base, G.disc, M.copper, T(x, y + 0.135, z, 0, 0.034, 0.012, 0.034)); },
    // ------------------------------------------------------------- cuisine
    pot(base, x, z, y = 0, s = 1, mat = M.steel) {
      put(base, G.pot, mat, T(x, y, z, 0, s)); put(base, G.lid, mat, T(x, y + 0.33 * s, z, 0, s));
      for (const sx of [-1, 1]) put(base, G.handle, M.iron, T(x + sx * 0.235 * s, y + 0.27 * s, z, sx > 0 ? 0 : Math.PI, s, s, s, 0, -Math.PI / 2));
    },
    wok(base, x, z, y = 0, ry = 0) { put(base, G.wok, M.iron, T(x, y, z, ry)); put(base, G.disc, M.wood, T(x + Math.cos(ry) * 0.42, y + 0.12, z - Math.sin(ry) * 0.42, ry, 0.018, 0.26, 0.018, 0, Math.PI / 2 + 0.2)); },
    ladle(base, x, y, z) { put(base, G.disc, M.steel, T(x, y - 0.18, z, 0, 0.008, 0.36, 0.008)); put(base, G.bun, M.steel, T(x, y - 0.36, z, 0, 0.6, -0.5, 0.6)); },
    pan(base, x, y, z) { put(base, G.disc, M.iron, T(x, y - 0.2, z, 0, 0.13, 0.025, 0.13, Math.PI / 2)); put(base, G.disc, M.iron, T(x, y - 0.03, z, 0, 0.012, 0.16, 0.012)); },
    tray(base, x, z, y = 0, ry = 0, mat = M.tray) { put(base, G.box, mat, T(x, y + 0.006, z, ry, 0.42, 0.012, 0.3)); for (const [dx, dz, w, d] of [[0, 0.15, 0.42, 0.01], [0, -0.15, 0.42, 0.01], [0.21, 0, 0.01, 0.3], [-0.21, 0, 0.01, 0.3]]) put(base, G.box, mat, T(x + Math.cos(ry) * dx + Math.sin(ry) * dz, y + 0.016, z - Math.sin(ry) * dx + Math.cos(ry) * dz, ry, w, 0.02, d)); },
    caddy(base, x, z, y = 0) {
      put(base, G.box, M.steel, T(x, y + 0.005, z, 0, 0.16, 0.01, 0.08));
      put(base, G.box, M.steel, T(x, y + 0.08, z, 0, 0.006, 0.16, 0.006));
      K.bottle(base, x - 0.05, z, y + 0.01, M.red, M.red); K.bottle(base, x, z, y + 0.01, M.yellow, M.yellow);
      put(base, G.disc, M.ceramic, T(x + 0.05, y + 0.04, z - 0.015, 0, 0.012, 0.06, 0.012)); put(base, G.disc, M.black, T(x + 0.05, y + 0.04, z + 0.015, 0, 0.012, 0.06, 0.012));
    },
    napkins(base, x, z, y = 0, ry = 0) { put(base, G.box, M.steel, T(x, y + 0.06, z, ry, 0.12, 0.12, 0.08)); put(base, G.box, M.paper, T(x, y + 0.125, z, ry, 0.09, 0.012, 0.06)); },
    trays(base, x, z, y = 0, n = 6) { for (let k = 0; k < n; k++) K.tray(base, x, z, y + k * 0.022, 0, k % 2 ? M.tray : M.trayB); },
  };
  return K;
}
