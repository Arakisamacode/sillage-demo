import * as THREE from 'three';
import { Builder } from './builder.js';
import { metricBox, worldUV } from './materials.js';
import { AIRLOCK, GALLERY, HX } from './layout.js';
import { neonTexture, neonMaterial, paintedText, decalMaterial, Screen, FONT, rand, seed, pictogram, canvas } from './signage.js';
import { Local, bench, crate } from './props.js';

// Sas + galerie marchande : vitrine panoramique sur la planète, boutiques, kiosque café,
// panneau des départs, bancs, jardinières.

export const SHOPS = [
  { id: 'nouilles', name: 'NOUILLES ORBITALES', color: '#ff5a3c', x: -94 },
  { id: 'cafe', name: 'CAFÉ PÉRIHÉLIE', color: '#ffb84a', x: -84 },
  { id: 'pieces', name: 'PIÈCES & RECHANGES', color: '#5fe6ff', x: -74 },
  { id: 'pharma', name: 'PHARMACIE', color: '#4dff8a', x: -64 },
  { id: 'combis', name: 'COMBINAISONS VEGA', color: '#c58bff', x: -54 },
];

export function buildGallery(ctx) {
  const { scene, mats, builder: B, quality } = ctx;
  seed(4242);
  const G = GALLERY;
  const cx = (G.x0 + G.x1) / 2, cz = (G.z0 + G.z1) / 2, W = G.x1 - G.x0, D = G.z1 - G.z0;
  const wall = mats.paint(0xd4d9dd, { grime: 0.3, scratch: 0.3, rust: 0, rough: 0.6 });
  const wallDark = mats.paint(0x3a3e42, { grime: 0.6 });
  const trim = mats.metal(0x8c9094, { rough: 0.35, grime: 0.3 });
  const dark = mats.paint(0x24282b);

  // ------------------------------------------------------------------ sas
  {
    const z = AIRLOCK.z, w = AIRLOCK.w, h = AIRLOCK.h;
    const x0 = -HX - 0.6, x1 = G.x1;
    const len = x0 - x1, xc = (x0 + x1) / 2;
    const floorG = new THREE.PlaneGeometry(len, w); floorG.rotateX(-Math.PI / 2);
    const fm = Builder.matrix([xc, 0.001, z]); worldUV(floorG, 2, fm);
    B.add(floorG, mats.grating(), fm, { collide: true, cast: false });
    B.box(len, 0.1, w, mats.metal(0x202325), [xc, -0.06, z], null, { cast: false });
    for (const s of [-1, 1]) {
      B.box(len, h, 0.4, mats.paint(0x6a7075, { grime: 0.7 }), [xc, h / 2, z + s * (w / 2 + 0.2)], null, { collide: true, tex: 2 });
      // buses de décontamination et bandeaux lumineux
      for (let k = 0; k < 4; k++) B.cyl(0.06, 0.09, 0.15, mats.smooth(0x999999, 0.3, 1), [x1 + 2 + k * 1.8, 2.6, z + s * (w / 2 - 0.05)], [Math.PI / 2, 0, 0], { cast: false });
      B.box(len - 1, 0.06, 0.05, mats.emissive(0xffa040, 3), [xc, 3.6, z + s * (w / 2 - 0.02)], null, { cast: false });
      B.box(len - 1, 0.25, 0.3, mats.vent(), [xc, 0.2, z + s * (w / 2 - 0.1)], null, { cast: false });
    }
    B.box(len, 0.4, w + 0.8, mats.paint(0x3a3e42), [xc, h + 0.2, z], null, { collide: true });
    B.box(len - 0.8, 0.04, 0.4, mats.emissive(0xdff0ff, 2.2), [xc, h - 0.03, z], null, { cast: false });
    // cadres de portes
    for (const x of [-HX - 0.3, G.x1 + 0.3]) {
      B.box(0.7, 0.5, w + 1.2, dark, [x, h + 0.25, z]);
      for (const s of [-1, 1]) B.box(0.7, h, 0.5, dark, [x, h / 2, z + s * (w / 2 + 0.25)], null, { collide: true });
      B.box(0.72, 0.18, w + 1.2, mats.paint(0xc89a1e), [x, h + 0.05, z], null, { cast: false });
    }
    const oliveA = mats.paint(0x7a7a3a, { plain: true, rough: 0.5, grime: 0.5 });
    for (const x of [-HX - 0.05, G.x1 + 0.05]) {
      for (const s2 of [-1, 1]) B.box(0.8, h + 1.4, 0.6, oliveA, [x, (h + 1.4) / 2, z + s2 * (w / 2 + 0.7)], null, { collide: true });
      B.box(0.8, 0.6, w + 2.0, oliveA, [x, h + 1.1, z]);
    }
    ctx.airlockDoors = [
      makeDoor(ctx, -HX - 0.3, z, w, h, 'SAS 2 · HANGAR 07'),
      makeDoor(ctx, G.x1 + 0.3, z, w, h, 'SAS 2 · GALERIE'),
    ];
    ctx.doors = [...ctx.airlockDoors];
    // panneau d'état
    const st = new Screen(256, 96, (c, cw, ch, t) => {
      c.fillStyle = '#081016'; c.fillRect(0, 0, cw, ch);
      const open = ctx.airlockDoors.some((d) => d.open > 0.5);
      c.fillStyle = open ? '#4dff8a' : '#ffb040';
      c.font = `700 30px ${FONT}`; c.fillText(open ? 'PASSAGE' : 'PRESSURISÉ', 14, 40);
      c.font = `500 18px ${FONT}`; c.fillStyle = '#9fd9ff'; c.fillText('1013 hPa · 21 °C · O2 21 %', 14, 72);
    }, { period: 0.5, intensity: 1.4 });
    ctx.screens.push(st);
    for (const [x, ry] of [[-HX - 2.2, Math.PI / 2], [G.x1 + 2.2, -Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), st.material);
      m.position.set(x, 2.6, z + w / 2 - 0.02); m.rotation.y = Math.PI;
      scene.add(m);
    }
  }

  // ------------------------------------------------------------------ sol, plafond
  {
    const fg = new THREE.PlaneGeometry(W, D); fg.rotateX(-Math.PI / 2);
    const fm = Builder.matrix([cx, 0, cz]); worldUV(fg, 3, fm);
    const floorMat = mats.stationFloor();
    B.add(fg, floorMat, fm, { collide: true, cast: false });
    // cheminements : bandes sombres bordées de liserés lumineux encastrés
    for (const z of [G.z0 + 5.5, G.z1 - 7.5]) {
      B.box(W, 0.012, 1.4, mats.paint(0x22262a, { plain: true, rough: 0.35, grime: 0.2, floor: 0 }), [cx, 0.006, z], null, { cast: false, receive: true });
      for (const s of [-1, 1]) B.box(W, 0.014, 0.05, mats.emissive(0x8fd3ff, 2.4), [cx, 0.007, z + s * 0.72], null, { cast: false });
    }
    // joints transversaux tous les 6 m (alignés sur les caissons du plafond)
    for (let x = G.x0 + 6; x < G.x1; x += 6) B.box(0.04, 0.01, D - 1, mats.metal(0x4a4f54, { rough: 0.4 }), [x, 0.005, cz], null, { cast: false });
    // plafond à caissons + gorges lumineuses
    B.box(W, 0.4, D, mats.paint(0x3c4044), [cx, G.h + 0.2, cz], null, { cast: false, tex: 4 });
    for (let x = G.x0 + 3; x < G.x1; x += 6) {
      B.box(0.5, 0.7, D, wallDark, [x, G.h - 0.35, cz], null, { cast: false });
    }
    for (let x = G.x0 + 6; x < G.x1 - 1; x += 6) {
      B.box(0.12, 0.05, D - 14, mats.emissive(0xe6f0ff, 4.0), [x, G.h - 0.72, cz - 1], null, { cast: false });
    }
    // plafond à pans inclinés le long des deux façades, bordés de bandes LED (lignes obliques)
    const panel = mats.paint(0xc9ced2, { plain: true, rough: 0.5, grime: 0.25, floor: 0 });
    const led = mats.emissive(0xe6f0ff, 5.0);
    for (const [zEdge, dir] of [[G.z1, -1], [G.z0, 1]]) {
      const ang = 0.55, len = 5.2;
      const zc = zEdge + dir * Math.cos(ang) * len / 2, yc = G.h - 0.3 - Math.sin(ang) * len / 2;
      B.box(W, 0.12, len, panel, [cx, yc, zc], [dir * -ang, 0, 0], { cast: false, tex: 3 });
      for (let x = G.x0 + 3; x < G.x1; x += 6) {
        B.box(0.1, 0.06, len, led, [x, yc - 0.07, zc], [dir * -ang, 0, 0], { cast: false });
        B.box(0.3, 0.2, len, wallDark, [x + 0.25, yc - 0.06, zc], [dir * -ang, 0, 0], { cast: false });
      }
      B.box(W, 0.05, 0.08, led, [cx, G.h - 0.3 - Math.sin(ang) * len - 0.05, zEdge + dir * Math.cos(ang) * len], null, { cast: false });
    }
  }

  // ------------------------------------------------------------------ baie panoramique (sud)
  {
    const z = G.z0;
    const glass = mats.glass(0x9ab8cc, 0.07);
    B.box(W, 0.6, 0.8, trim, [cx, 0.3, z], null, { collide: true });
    B.box(W, 1.2, 1.0, wallDark, [cx, G.h - 0.6, z], null, {});
    B.colliderBox(W, G.h, 0.4, [cx, G.h / 2, z]);
    for (let x = G.x0; x <= G.x1; x += 5) {
      B.box(0.3, G.h, 0.5, trim, [x, G.h / 2, z]);
    }
    B.box(W, 0.12, 0.3, trim, [cx, 6.2, z]);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(W, G.h - 1.8), glass);
    p.position.set(cx, (G.h - 1.8) / 2 + 0.6, z + 0.05);
    scene.add(p);
    // rambarde et lisse lumineuse
    B.box(W, 0.06, 0.06, trim, [cx, 1.05, z + 0.9]);
    for (let x = G.x0 + 1; x < G.x1; x += 2.5) B.box(0.05, 1.05, 0.05, trim, [x, 0.52, z + 0.9], null, { cast: false });
    B.box(W, 0.03, 0.03, mats.emissive(0x9fd9ff, 3), [cx, 0.62, z + 0.4], null, { cast: false });
    B.colliderBox(W, 1.1, 0.2, [cx, 0.55, z + 0.9]);
    // bancs face à la vue
    for (let x = G.x0 + 6; x < G.x1 - 4; x += 10) bench(ctx, x, z + 3.2, Math.PI, 3.0, mats.plastic(0x6b4a33, 0.6));
  }

  // ------------------------------------------------------------------ murs est/ouest
  {
    // est : mur avec le sas
    const x = G.x1;
    const z = AIRLOCK.z, w = AIRLOCK.w;
    const a0 = G.z0, a1 = z - w / 2 - 0.5, b0 = z + w / 2 + 0.5, b1 = G.z1;
    B.box(0.5, G.h, a1 - a0, wall, [x + 0.25, G.h / 2, (a0 + a1) / 2], null, { collide: true, tex: 3 });
    B.box(0.5, G.h, b1 - b0, wall, [x + 0.25, G.h / 2, (b0 + b1) / 2], null, { collide: true, tex: 3 });
    B.box(0.5, G.h - AIRLOCK.h, w + 1, wall, [x + 0.25, (G.h + AIRLOCK.h) / 2, z], null, { tex: 3 });
    // ouest : porte coulissante vers le module habitat + court couloir sombre
    const dz = cz - 4, dw = 3.2, dh = 3.2;
    const za = dz - dw / 2 - 0.4, zb = dz + dw / 2 + 0.4;
    B.box(0.5, G.h, za - G.z0, wall, [G.x0 - 0.25, G.h / 2, (G.z0 + za) / 2], null, { collide: true, tex: 3 });
    B.box(0.5, G.h, G.z1 - zb, wall, [G.x0 - 0.25, G.h / 2, (zb + G.z1) / 2], null, { collide: true, tex: 3 });
    B.box(0.5, G.h - dh, zb - za, wall, [G.x0 - 0.25, (G.h + dh) / 2, dz], null, { tex: 3 });
    for (const s of [-1, 1]) B.box(0.6, dh, 0.4, dark, [G.x0 - 0.2, dh / 2, dz + s * (dw / 2 + 0.2)], null, { collide: true });
    B.box(5, 0.3, dw + 1, dark, [G.x0 - 2.8, dh + 0.15, dz]);
    for (const s of [-1, 1]) B.box(5, dh, 0.3, dark, [G.x0 - 2.8, dh / 2, dz + s * (dw / 2 + 0.15)], null, { collide: true });
    B.box(0.3, dh, dw + 1, dark, [G.x0 - 5.2, dh / 2, dz], null, { collide: true });
    B.box(4.6, 0.05, 0.3, mats.emissive(0xffc890, 1.2), [G.x0 - 2.8, dh - 0.05, dz], null, { cast: false });
    B.box(5, 0.05, dw, mats.metal(0x2a2c2e), [G.x0 - 2.8, 0.01, dz], null, { cast: false, collide: true });
    ctx.habitatDoor = makeDoor(ctx, G.x0 - 0.2, dz, dw, dh, 'MODULE HABITAT');
  }

  ctx.doors.push(ctx.habitatDoor);

  // ------------------------------------------------------------------ boutiques (nord)
  for (const s of SHOPS) shop(ctx, s, wall, wallDark, trim);
  // trumeaux entre boutiques
  for (let x = G.x0; x <= G.x1; x += 10) {
    if (x > G.x0 + 1 && x < G.x1 - 1) B.box(2.0, G.h, 0.6, wall, [x, G.h / 2, G.z1 + 0.3], null, { collide: true, tex: 3 });
  }
  B.box(4, G.h, 0.6, wall, [G.x0 + 2, G.h / 2, G.z1 + 0.3], null, { collide: true, tex: 3 });
  B.box(8, G.h, 0.6, wall, [G.x1 - 4, G.h / 2, G.z1 + 0.3], null, { collide: true, tex: 3 });
  // bandeau haut au-dessus des boutiques
  B.box(W, G.h - 4.6, 0.6, wall, [cx, 4.6 + (G.h - 4.6) / 2, G.z1 + 0.3], null, { tex: 3 });

  // ------------------------------------------------------------------ kiosque café central
  kiosk(ctx, -72, -7);
  // jardinières avec arbustes stylisés
  for (const [x, z] of [[-90, -6], [-56, -6], [-82, -14], [-62, -14]]) planter(ctx, x, z);
  // colonnes rondes
  for (const x of [-92, -80, -64, -52]) {
    B.cyl(0.45, 0.45, G.h, mats.paint(0xa9a69e, { grime: 0.4 }), [x, G.h / 2, 2], null, { seg: 20 });
    B.cyl(0.55, 0.55, 0.3, trim, [x, 0.15, 2], null, { seg: 20, cast: false });
    B.colliderBox(1.0, G.h, 1.0, [x, G.h / 2, 2]);
    B.addObstacle(x, 2, 0.6, 0.6, 0);
  }
  // bancs centraux dos à dos
  for (const x of [-86, -58]) { bench(ctx, x, 1.0, Math.PI, 2.6); bench(ctx, x, 3.0, 0, 2.6); }
  // tableau des départs suspendu
  departures(ctx, -72, 6.6, 4.5);
  // grand écran publicitaire mur ouest
  adScreen(ctx);
  // signalétique
  const sign = (lines, w, pos, ry, opts) => {
    const { tex, aspect } = paintedText(lines, { size: 110, wear: 0.2, color: '#e8e2d2', ...opts });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), decalMaterial(tex, { rough: 0.5 }));
    m.position.set(...pos); m.rotation.y = ry; scene.add(m);
  };
  sign(['◄ MODULE HABITAT · NAVETTES'], 4.2, [G.x0 + 0.03, 4.4, cz - 4], Math.PI / 2, { color: '#f0c050' });
  sign(['HANGAR 07 ►'], 2.6, [G.x1 - 0.02, 5.0, AIRLOCK.z], -Math.PI / 2, { color: '#f0c050' });
  sign(['GALERIE DU BELVÉDÈRE'], 7, [G.x1 - 0.02, 7.6, -14], -Math.PI / 2, { color: '#d8d2c4', wear: 0.4 });

  // éclairage de la galerie
  const lights = [];
  const pts = quality.name === 'low' ? [[-72, -6]] : [[-90, -6], [-72, -6], [-54, -6]];
  for (const [x, z] of pts) {
    const l = new THREE.PointLight(0xffd7a8, 35, 26, 2);
    l.position.set(x, G.h - 1.2, z);
    scene.add(l); lights.push(l);
  }
  const fill = new THREE.SpotLight(0xffe2c0, 220, 40, 1.1, 0.9, 2);
  fill.position.set(-72, G.h - 0.5, -4); fill.target.position.set(-72, 0, -4);
  scene.add(fill, fill.target);
}

// ==================================================================== porte coulissante
function makeDoor(ctx, x, z, w, h, label) {
  const { mats, scene } = ctx;
  const leaves = [];
  const mat = mats.paint(0x535a60, { grime: 0.7, scratch: 0.8, plain: true, rough: 0.5 });
  const stripe = mats.paint(0xc89a1e);
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    const leaf = new THREE.Mesh(metricBox(0.18, h, w / 2, 1.5), mat);
    leaf.castShadow = leaf.receiveShadow = true;
    g.add(leaf);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, w / 2), stripe);
    st.position.y = -h / 2 + 0.6; g.add(st);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.35), mats.glass(0x9ab8cc, 0.4));
    win.position.set(0, 0.5, -s * 0.5); g.add(win);
    g.position.set(x, h / 2, z + s * w / 4);
    scene.add(g);
    leaves.push({ g, s, base: z + s * w / 4 });
  }
  const { tex, aspect } = paintedText([label], { size: 90, wear: 0.3, color: '#f0c050' });
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6 / aspect), decalMaterial(tex));
    m.position.set(x + side * 0.37, h + 0.25, z); m.rotation.y = side * Math.PI / 2;
    scene.add(m);
  }
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.5, 0.3) }));
  lamp.position.set(x, h + 0.55, z);
  scene.add(lamp);
  const door = {
    x, z, w, h, open: 0, target: 0, leaves, lamp,
    // boîte de collision dynamique (désactivée quand la porte est ouverte)
    box: new THREE.Box3(new THREE.Vector3(x - 0.15, 0, z - w / 2), new THREE.Vector3(x + 0.15, h, z + w / 2)),
    update(dt, actors) {
      let near = false;
      for (const p of actors) if (Math.abs(p.x - x) < 3.6 && Math.abs(p.z - z) < 3.2) { near = true; break; }
      this.target = near ? 1 : 0;
      const prev = this.open;
      this.open += Math.sign(this.target - this.open) * Math.min(Math.abs(this.target - this.open), dt * 1.4);
      if (prev !== this.open && this.onMove) this.onMove(this.open > prev);
      const e = this.open * this.open * (3 - 2 * this.open);
      for (const l of leaves) l.g.position.z = l.base + l.s * e * (w / 2 - 0.1);
      lamp.material.color.setRGB(this.open > 0.5 ? 0.4 : 4, this.open > 0.5 ? 4 : 1.5, 0.3);
    },
  };
  return door;
}

// ==================================================================== boutique
function shop(ctx, s, wall, wallDark, trim) {
  const { mats, builder: B, scene } = ctx;
  const G = GALLERY;
  const x = s.x, z0 = G.z1, depth = 6, w = 8, h = 4.4;
  // intérieur
  const L = new Local(B, x, 0, z0, 0, scene);
  const floorM = s.id === 'pieces' ? mats.metal(0x55595c, { rough: 0.6 }) : mats.tiles(s.id === 'pharma' ? 0xe8efe8 : 0xb8b0a4);
  L.box(w, 0.05, depth + 0.6, floorM, [0, 0.025, depth / 2 - 0.3], null, { cast: false, tex: 2, collide: true });
  L.box(w, h, 0.3, wall, [0, h / 2, depth + 0.15], null, { tex: 3 });
  for (const sx of [-1, 1]) L.box(0.3, h, depth, wall, [sx * (w / 2 + 0.15), h / 2, depth / 2], null, { tex: 3 });
  L.box(w + 0.6, 0.3, depth, mats.paint(0x2c3034), [0, h + 0.15, depth / 2]);
  L.cbox(w, h, 0.3, [0, h / 2, depth + 0.15]);
  for (const sx of [-1, 1]) L.cbox(0.3, h, depth, [sx * (w / 2 + 0.15), h / 2, depth / 2]);
  // éclairage intérieur (bandeaux)
  L.box(w - 1, 0.05, 0.3, mats.emissive(0xfff1dc, 7), [0, h - 0.05, depth / 2], null, { cast: false });
  L.box(w - 1, 0.05, 0.3, mats.emissive(0xfff1dc, 7), [0, h - 0.05, depth / 2 + 1.8], null, { cast: false });
  // vitrine : vitrage + porte ouverte (au centre)
  const glass = mats.glass(0xaac4d4, 0.1);
  for (const sx of [-1, 1]) {
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, h - 0.5), glass);
    gm.position.set(x + sx * 2.7, (h - 0.5) / 2 + 0.25, z0 + 0.05);
    scene.add(gm);
    L.cbox(2.6, h, 0.1, [sx * 2.7, h / 2, 0.05]);
    L.box(0.1, h, 0.15, trim, [sx * 1.4, h / 2, 0.05]);
    L.box(2.8, 0.25, 0.2, trim, [sx * 2.7, 0.12, 0.05], null, { cast: false });
  }
  L.box(w, 0.12, 0.2, trim, [0, h - 0.06, 0.05]);
  // cadre structurel vert olive autour de la devanture + bandeau d'enseigne
  const olive = mats.paint(0x7a7a3a, { plain: true, rough: 0.5, grime: 0.5 });
  for (const sx of [-1, 1]) L.box(0.45, h + 1.6, 0.5, olive, [sx * (w / 2 + 0.05), (h + 1.6) / 2, -0.15]);
  L.box(w + 0.9, 0.35, 0.5, olive, [0, h + 1.6, -0.15]);
  L.box(w + 0.9, 0.18, 0.55, olive, [0, h + 0.05, -0.15]);
  for (const sx of [-1, 1]) L.box(0.06, h + 1.4, 0.06, mats.emissive(0xe6f0ff, 2.2), [sx * (w / 2 - 0.2), (h + 1.4) / 2, -0.42], null, { cast: false });
  // enseigne néon
  const nt = neonTexture(s.name, s.color, { size: 110 });
  const nh = 1.05, nw = Math.min(nh * nt.aspect, 7.6);
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(nw, nw / nt.aspect), neonMaterial(nt.tex, 2.6));
  neon.position.set(x, h + 0.75, z0 - 0.33);
  neon.rotation.y = Math.PI;
  neon.renderOrder = 4;
  scene.add(neon);
  B.box(nw + 0.4, 1.1, 0.06, mats.paint(0x1c1f22), [x, h + 0.75, z0 - 0.28], null, { cast: false });
  // éclairage de vitrine (réel uniquement en qualité haute)
  if (ctx.quality.name === 'high' || ctx.quality.name === 'ultra') {
    const l = new THREE.PointLight(new THREE.Color(s.color).lerp(new THREE.Color(0xffffff), 0.6), 30, 10, 2);
    l.position.set(x, h - 0.6, z0 + 2.5);
    scene.add(l);
  }
  // comptoir et caisse
  const counter = mats.paint(s.id === 'pieces' ? 0x3a4a5a : 0x5a3c28, { grime: 0.4, plain: true, rough: 0.5 });
  L.box(3.2, 1.05, 0.7, counter, [-1.6, 0.525, 3.2], null, { collide: true });
  L.box(3.3, 0.05, 0.8, mats.metal(0xa0a4a8, { rough: 0.3, grime: 0.3 }), [-1.6, 1.07, 3.2], null, { cast: false });
  L.box(0.4, 0.3, 0.05, mats.emissive(0x3ec7ff, 1.6), [-0.6, 1.25, 3.1], [-0.3, 0, 0], { cast: false });
  L.obstacle(1.8, 0.6, -1.6, 3.2);
  // étagères chargées
  for (const sx of [-1, 1]) {
    L.box(0.45, 2.4, depth - 1.5, mats.metal(0x4b4f52), [sx * (w / 2 - 0.3), 1.2, depth / 2 + 0.4], null, { collide: true });
    for (let k = 0; k < 4; k++) {
      L.box(0.5, 0.04, depth - 1.5, mats.metal(0x6b6f72), [sx * (w / 2 - 0.3), 0.4 + k * 0.55, depth / 2 + 0.4], null, { cast: false });
      for (let i = 0; i < 8; i++) {
        const col = [0xb8452e, 0x2f6f9a, 0xd9b44a, 0x4a7d3a, 0xe6e1d6, 0x6a3f7a, 0x2b2b2b][Math.floor(rand() * 7)];
        L.box(0.3, 0.15 + rand() * 0.25, 0.25 + rand() * 0.2, mats.plastic(col, 0.6), [sx * (w / 2 - 0.3), 0.55 + k * 0.55 + 0.1, 1.2 + i * 0.52], null, { cast: false });
      }
    }
    L.obstacle(0.4, (depth - 1.5) / 2, sx * (w / 2 - 0.3), depth / 2 + 0.4);
  }
  // mobilier spécifique
  if (s.id === 'nouilles' || s.id === 'cafe') {
    for (const dx of [1.0, 2.6]) {
      L.cyl(0.4, 0.4, 0.04, mats.metal(0x9a9da0, { rough: 0.3 }), [dx, 1.05, 1.6], null, { seg: 18 });
      L.cyl(0.04, 0.04, 1.03, mats.metal(0x2b2f32), [dx, 0.52, 1.6], null, { seg: 8 });
      L.cbox(0.8, 1.1, 0.8, [dx, 0.55, 1.6]);
      L.obstacle(0.45, 0.45, dx, 1.6);
    }
    // menu lumineux
    const menu = new Screen(256, 160, (c, cw, ch) => {
      c.fillStyle = '#120a06'; c.fillRect(0, 0, cw, ch);
      c.fillStyle = s.color; c.font = `700 22px ${FONT}`; c.fillText(s.id === 'cafe' ? 'CARTE' : 'MENU', 12, 28);
      c.font = `500 15px ${FONT}`; c.fillStyle = '#f2e6d6';
      const items = s.id === 'cafe' ? ['Espresso', 'Café long', 'Thé fumé', 'Chicorée'] : ['Ramen protéiné', 'Soba aux algues', 'Bouillon miso', 'Raviolis vapeur'];
      items.forEach((it, i) => { c.fillText(it, 12, 58 + i * 24); c.fillText(`${(i + 2) * 3},50 ¤`, 190, 58 + i * 24); });
    }, { period: 5, intensity: 1.6 });
    ctx.screens.push(menu);
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), menu.material);
    L.decal(mm, [-1.6, 2.6, depth - 0.02], [0, Math.PI, 0]);
  }
  if (s.id === 'combis') {
    // mannequins de combinaisons (formes simples)
    for (const dx of [1.2, 2.6]) {
      L.cyl(0.25, 0.22, 1.1, mats.plastic(0xd8d4cc, 0.5), [dx, 1.45, 1.4], null, { seg: 14 });
      L.cyl(0.17, 0.17, 0.4, mats.glass(0x9ab8cc, 0.5), [dx, 2.2, 1.4], null, { seg: 14 });
      L.cyl(0.1, 0.1, 0.9, mats.plastic(0xd8d4cc, 0.5), [dx, 0.45, 1.4], null, { seg: 10 });
    }
  }
  if (s.id === 'pieces') {
    for (let i = 0; i < 3; i++) crate(ctx, ...L.world(1.5 + (i % 2) * 1.3, 0, 1.4 + Math.floor(i / 2) * 1.2).toArray(), 0.2 * i, 0.7, i);
  }
  ctx.shopSpots = ctx.shopSpots || {};
  ctx.shopSpots[s.id] = {
    clerk: L.world(-1.6, 0, 4.0), clerkFace: L.world(-1.6, 0, 2.0),
    customer: L.world(-1.6, 0, 2.25), entry: L.world(0, 0, -1.2), inside: L.world(0.8, 0, 2.2),
  };
}

function kiosk(ctx, x, z) {
  const { mats, builder: B } = ctx;
  const L = new Local(B, x, 0, z, 0, ctx.scene);
  const body = mats.paint(0x5a3c28, { grime: 0.4, plain: true, rough: 0.5 });
  // comptoir circulaire en segments
  const n = 12, r = 2.2;
  for (let i = 0; i < n; i++) {
    if (i === 3) continue; // passage personnel
    const a = (i / n) * Math.PI * 2;
    L.box(1.15, 1.05, 0.45, body, [Math.cos(a) * r, 0.525, Math.sin(a) * r], [0, -a + Math.PI / 2, 0]);
    L.box(1.2, 0.05, 0.6, mats.metal(0xa0a4a8, { rough: 0.25, grime: 0.3 }), [Math.cos(a) * r, 1.07, Math.sin(a) * r], [0, -a + Math.PI / 2, 0], { cast: false });
  }
  L.cyl(0.25, 0.25, 4.0, mats.metal(0x3a3e42), [0, 2.0, 0], null, { seg: 12 });
  L.cyl(2.6, 2.6, 0.25, mats.paint(0x2a2e31), [0, 3.6, 0], null, { seg: 32 });
  L.cyl(2.5, 2.5, 0.05, mats.emissive(0xffd9a8, 2.0), [0, 3.46, 0], null, { seg: 32, cast: false });
  // machine à café pro + tasses
  L.box(0.9, 0.55, 0.5, mats.metal(0xb8bcbe, { rough: 0.2, grime: 0.2 }), [0, 1.35, -1.6]);
  L.box(0.3, 0.15, 0.02, mats.emissive(0xff8040, 2), [0, 1.5, -1.34], null, { cast: false });
  for (let i = 0; i < 5; i++) L.cyl(0.04, 0.035, 0.08, mats.plastic(0xf0f0f0, 0.4), [-0.3 + i * 0.15, 1.13, -2.2], null, { seg: 8, cast: false });
  // tabourets
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    if (Math.abs(a - 1.6) < 0.4) continue;
    L.cyl(0.2, 0.2, 0.06, mats.plastic(0x2a2a2a, 0.6), [Math.cos(a) * 3.0, 0.75, Math.sin(a) * 3.0], null, { seg: 12 });
    L.cyl(0.03, 0.03, 0.72, mats.metal(0x8c9094), [Math.cos(a) * 3.0, 0.36, Math.sin(a) * 3.0], null, { seg: 6, cast: false });
  }
  B.colliderBox(4.8, 1.1, 4.8, [x, 0.55, z]);
  B.addObstacle(x, z, 2.7, 2.7, 0);
  const nt = neonTexture('CAFÉ · KIOSQUE', '#ffb84a', { size: 90 });
  for (let k = 0; k < 2; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6 / nt.aspect), neonMaterial(nt.tex, 2.4));
    m.position.set(x, 4.05, z + (k ? 2.62 : -2.62)); m.rotation.y = k ? 0 : Math.PI;
    ctx.scene.add(m);
  }
  ctx.kiosk = { x, z, r };
}

function planter(ctx, x, z) {
  const { mats, builder: B } = ctx;
  B.box(2.2, 0.7, 2.2, mats.concrete(0x8a8780), [x, 0.35, z], null, { collide: true });
  B.box(2.0, 0.05, 2.0, mats.plastic(0x2a1f16, 0.95), [x, 0.68, z], null, { cast: false });
  // plantes à feuilles en lanière (type yucca / dracaena)
  const leafMats = ctx.leafMats || (ctx.leafMats = [0x2c4a26, 0x3b5e2c, 0x23401f].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide })));
  const leaf = new THREE.PlaneGeometry(0.09, 0.9, 1, 4);
  leaf.translate(0, 0.45, 0);
  const p = leaf.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, y * y * 0.35); p.setX(i, p.getX(i) * (1 - y / 1.0)); }
  leaf.computeVertexNormals();
  for (let c = 0; c < 4; c++) {
    const ox = x + (rand() - 0.5) * 1.2, oz = z + (rand() - 0.5) * 1.2, trunk = 0.3 + rand() * 1.1;
    B.cyl(0.04, 0.06, trunk, mats.plastic(0x4a3a2a, 0.9), [ox, 0.7 + trunk / 2, oz], null, { seg: 6, cast: false });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rand() * 0.3, tilt = 0.3 + rand() * 1.0, sc = 0.6 + rand() * 0.6;
      B.add(leaf, leafMats[i % 3], Builder.matrix([ox, 0.7 + trunk, oz], [tilt, a, 0], [sc, sc, sc]), { cast: false });
    }
  }
  B.addObstacle(x, z, 1.3, 1.3, 0);
}

function departures(ctx, x, y, z) {
  const { mats, builder: B, scene } = ctx;
  const rows = [
    ['HL-2207', 'HÉRON', 'AIRE 02', 'À QUAI'],
    ['MH4-0918', 'MULET H4', 'AIRE 03', 'CHARGEMENT'],
    ['ST-40', 'NAVETTE HALDEN', 'AIRE 05', 'DÉBARQUEMENT'],
    ['FC-31', 'FAUCON', 'AIRE 04', 'MAINTENANCE'],
    ['KV-118', 'KARAVEL', '—', 'EN APPROCHE'],
    ['ST-41', 'NAVETTE HALDEN', 'AIRE 05', 'RETARDÉ'],
  ];
  const scr = new Screen(512, 256, (c, w, h, t) => {
    c.fillStyle = '#05080c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffb84a'; c.font = `700 26px ${FONT}`; c.fillText('DÉPARTS · ARRIVÉES', 16, 34);
    c.fillStyle = '#7d8a96'; c.font = `500 16px ${FONT}`;
    const now = 14 * 60 + Math.floor(t / 4) % 60;
    c.fillText(`HEURE STATION ${Math.floor(now / 60)}:${String(now % 60).padStart(2, '0')}`, 330, 34);
    c.fillRect(16, 46, w - 32, 1);
    rows.forEach((r, i) => {
      const y = 76 + i * 30;
      c.fillStyle = '#e8e2d2'; c.font = `600 18px ${FONT}`;
      c.fillText(r[0], 16, y); c.fillText(r[1], 120, y); c.fillText(r[2], 290, y);
      const blink = r[3] === 'EN APPROCHE' && Math.sin(t * 4) > 0;
      c.fillStyle = r[3] === 'RETARDÉ' ? '#ff6050' : r[3] === 'À QUAI' ? '#4dff8a' : '#9fd9ff';
      if (!blink) c.fillText(r[3], 380, y);
    });
  }, { period: 0.5, intensity: 1.8 });
  ctx.screens.push(scr);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), scr.material);
    m.position.set(x, y, z + s * 0.16); m.rotation.y = s > 0 ? 0 : Math.PI;
    scene.add(m);
  }
  B.box(3.8, 2.0, 0.3, mats.paint(0x1c1f22), [x, y, z]);
  for (const s of [-1, 1]) B.cyl(0.02, 0.02, GALLERY.h - y - 1, mats.metal(0x333333), [x + s * 1.6, (GALLERY.h + y + 1) / 2, z], null, { seg: 4, cast: false });
}

function adScreen(ctx) {
  const G = GALLERY;
  const scr = new Screen(512, 256, (c, w, h, t) => {
    const k = Math.floor(t / 8) % 3;
    const g = c.createLinearGradient(0, 0, w, h);
    const cols = [['#0b1d33', '#2a6fbd'], ['#2b0d10', '#c2452f'], ['#0d2a1c', '#2fae6a']][k];
    g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(380 + Math.sin(t * 0.3 + i) * 20, 128, 30 + i * 16, 0, 7); c.fill(); }
    c.fillStyle = '#ffffff'; c.font = `700 40px ${FONT}`;
    const txt = [['SILLAGE', 'ORBITAL LOGISTICS'], ['NOUILLES', 'ORBITALES'], ['VOYAGEZ', 'LÉGER']][k];
    c.fillText(txt[0], 30, 110); c.font = `500 26px ${FONT}`; c.fillText(txt[1], 30, 150);
    c.font = `400 16px ${FONT}`; c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fillText(['Fret · Transit · Stockage — Halden-7', 'Galerie du Belvédère · ouvert 24 h', 'Navettes vers la surface toutes les heures'][k], 30, 190);
  }, { period: 0.25, intensity: 2.0 });
  ctx.screens.push(scr);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), scr.material);
  m.position.set(G.x0 + 0.05, 6.5, 2); m.rotation.y = Math.PI / 2;
  ctx.scene.add(m);
}
