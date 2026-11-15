import * as THREE from 'three';
import { Builder } from './builder.js';
import { metricBox, worldUV } from './materials.js';
import { HX, Z_BAY, Z_BACK, H, CAT_Y, COLS, AIRLOCK, PADS, STORAGE } from './layout.js';
import { canvas, erode, rand, seed, FONT, paintedText, decalMaterial, hazardTexture, pictogram } from './signage.js';

// Coque du hangar : sol, murs, poteaux, fermes de toiture, baie vitrée, passerelles, réseaux.

export function buildHangar(ctx) {
  const { scene, mats, builder: B, quality } = ctx;
  seed(1234);

  const wallPaint = mats.cladding(0x8a9094, { rust: 0.2 });
  const wallLow = mats.paint(0x4a5054, { grime: 0.9, rust: 0.25 });
  const trim = mats.paint(0x2c3134, { grime: 0.8 });
  const steel = mats.metal(0x6b6f72);
  const darkSteel = mats.metal(0x34383b, { rough: 0.7 });
  const yellow = mats.paint(0xc89a1e, { grime: 0.8, scratch: 0.9, plain: true, rough: 0.55 });
  const orange = mats.paint(0xb5531d, { grime: 0.8 });
  const pipeMat = mats.smooth(0x8d8f8c, 0.45, 0.85);
  const pipeGreen = mats.smooth(0x3e5b46, 0.55, 0.3);
  const pipeBlue = mats.smooth(0x2f4a63, 0.5, 0.3);
  const pipeRed = mats.smooth(0x7a2a22, 0.5, 0.3);
  const ductMat = mats.smooth(0x9aa0a3, 0.35, 0.9, { grime: 0.7 });
  const cableMat = mats.rubber();
  const grating = mats.grating();

  // ------------------------------------------------------------------ sol
  const floorW = HX * 2, floorD = Z_BACK - Z_BAY;
  const floorGeo = new THREE.PlaneGeometry(floorW, floorD, 1, 1);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(0, 0, (Z_BACK + Z_BAY) / 2);
  worldUV(floorGeo, 8);
  const floor = new THREE.Mesh(floorGeo, mats.deck());
  floor.receiveShadow = true;
  scene.add(floor);
  B.addCollider(floorGeo.clone().toNonIndexed());

  // marquages au sol (calque peint + traces)
  const marks = floorMarkings(quality);
  const markGeo = floorGeo.clone();
  const mm = new THREE.MeshStandardMaterial({
    map: marks, transparent: true, depthWrite: false, roughness: 0.6, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
  });
  const uv = markGeo.attributes.uv, pos = markGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + HX) / floorW, 1 - (pos.getZ(i) - Z_BAY) / floorD);
  const markMesh = new THREE.Mesh(markGeo, mm);
  markMesh.receiveShadow = true;
  markMesh.renderOrder = 1;
  scene.add(markMesh);

  // ------------------------------------------------------------------ murs latéraux
  for (const side of [-1, 1]) {
    const x = side * HX;
    for (let i = 0; i < COLS.length - 1; i++) {
      const z0 = COLS[i], z1 = COLS[i + 1];
      const zc = (z0 + z1) / 2, len = z1 - z0;
      const hasDoor = side === -1 && AIRLOCK.z > z0 && AIRLOCK.z < z1;
      // soubassement sombre 0-3 m, panneaux clairs au-dessus, bande haute
      if (hasDoor) {
        const dz0 = AIRLOCK.z - AIRLOCK.w / 2 - 0.6, dz1 = AIRLOCK.z + AIRLOCK.w / 2 + 0.6;
        const a = dz0 - z0, b = z1 - dz1;
        B.box(0.6, 3, a, wallLow, [x + side * 0.3, 1.5, z0 + a / 2], null, { collide: true, tex: 7 });
        B.box(0.6, 3, b, wallLow, [x + side * 0.3, 1.5, dz1 + b / 2], null, { collide: true, tex: 7 });
        B.box(0.6, H - 3, len, wallPaint, [x + side * 0.3, 3 + (H - 3) / 2, zc], null, { collide: true, tex: 4 });
      } else {
        B.box(0.6, 3, len, wallLow, [x + side * 0.3, 1.5, zc], null, { collide: true, tex: 7 });
        B.box(0.6, H - 3, len, wallPaint, [x + side * 0.3, 3 + (H - 3) / 2, zc], null, { collide: true, tex: 4 });
      }
      // plinthe et lisses horizontales
      B.box(0.25, 0.25, len, trim, [x - side * 0.1, 3.0, zc]);
      B.box(0.18, 0.35, len, darkSteel, [x - side * 0.05, 0.17, zc]);
      B.box(0.3, 0.4, len, trim, [x - side * 0.12, 15.5, zc]);
      // poteau en I
      if (i > 0) column(B, x, z0, side, steel, darkSteel, yellow);
    }
  }

  // ------------------------------------------------------------------ mur du fond
  {
    const z = Z_BACK;
    // volet roulant de stockage (x 16..24) et grande fenêtre de la salle de contrôle (y 9..12, x -10..10)
    B.box(HX * 2, 3, 0.6, wallLow, [0, 1.5, z + 0.3], null, { collide: true, tex: 7 });
    B.box(HX * 2 - 0.01, H - 3, 0.6, wallPaint, [0, 3 + (H - 3) / 2, z + 0.3], null, { collide: true, tex: 4 });
    B.box(HX * 2, 0.25, 0.25, trim, [0, 3, z - 0.1]);
    B.box(HX * 2, 0.4, 0.3, trim, [0, 15.5, z - 0.12]);
    for (const cx of [-24, -16, -8, 0, 8, 16, 24]) columnZ(B, cx, z, steel, darkSteel, yellow);
    // volet roulant
    shutter(B, mats, 20, z - 0.32, 7.5, 6.5);
    // salle de contrôle : fenêtre inclinée avec cadre
    controlRoom(B, mats, ctx, z);
  }

  // ------------------------------------------------------------------ plafond + fermes
  {
    const ceil = metricBox(HX * 2, 0.5, Z_BACK - Z_BAY, 4);
    B.add(ceil, mats.metal(0x4a4f52, { rough: 0.8 }), Builder.matrix([0, H + 0.25, (Z_BACK + Z_BAY) / 2]), { cast: false });
    // nervures de plafond (pannes) tous les 4 m le long de z
    for (let x = -HX + 4; x < HX; x += 4) B.box(0.3, 0.6, Z_BACK - Z_BAY, darkSteel, [x, H - 0.3, (Z_BACK + Z_BAY) / 2], null, { cast: false });
    for (let i = 1; i < COLS.length - 1; i++) truss(B, COLS[i], steel, darkSteel);
    // pont roulant au-dessus de l'aire 04
    crane(B, mats, PADS.p4.z - 2, yellow, darkSteel);
  }

  // ------------------------------------------------------------------ baie / porte spatiale
  bayFrame(B, mats, ctx);

  // ------------------------------------------------------------------ passerelles
  for (const side of [-1, 1]) catwalk(B, mats, side, grating, steel, yellow);
  backCatwalk(B, mats, grating, steel, yellow);
  stairs(B, mats, 1, 25.5, grating, steel, yellow, -1);   // est, vers le fond
  stairs(B, mats, -1, -36, grating, steel, yellow, 1);   // ouest, côté baie

  // ------------------------------------------------------------------ réseaux : tuyaux, gaines, chemins de câbles
  for (const side of [-1, 1]) {
    const x = side * (HX - 0.55);
    const z0 = Z_BAY + 2, z1 = Z_BACK - 1;
    B.pipe([[x, 5.2, z0], [x, 5.2, z1]], 0.16, pipeMat, { flangeMat: darkSteel });
    B.pipe([[x - side * 0.05, 5.65, z0], [x - side * 0.05, 5.65, z1]], 0.1, side < 0 ? pipeGreen : pipeBlue, { flangeMat: darkSteel });
    B.pipe([[x, 13.2, z0], [x, 13.2, z1 - 2], [x, 13.2 + 0, z1 - 2]], 0.28, pipeMat, { flangeMat: darkSteel });
    B.pipe([[x - side * 0.1, 12.5, z0 + 3], [x - side * 0.1, 12.5, z1]], 0.12, pipeRed, { flangeMat: darkSteel });
    // supports de tuyaux
    for (let z = z0 + 1; z < z1; z += 4) {
      B.box(0.7, 0.08, 0.1, darkSteel, [x + side * 0.15, 4.98, z], null, { cast: false });
      B.box(0.9, 0.1, 0.12, darkSteel, [x + side * 0.1, 12.85, z], null, { cast: false });
    }
    // descentes verticales vers des vannes
    for (const zz of [-26, -3, 13]) {
      if (side === -1 && Math.abs(zz - AIRLOCK.z) < 4) continue;
      B.pipe([[x, 5.2, zz], [x - side * 0.35, 5.2, zz], [x - side * 0.35, 1.1, zz]], 0.1, pipeMat, { flangeMat: darkSteel, bend: 0.25 });
      valve(B, mats, x - side * 0.35, 1.1, zz, side);
    }
    // chemin de câbles avec câbles qui pendent
    const ty = 10.6;
    B.box(0.6, 0.08, z1 - z0, darkSteel, [x - side * 0.6, ty, (z0 + z1) / 2], null, { cast: false });
    B.box(0.04, 0.15, z1 - z0, darkSteel, [x - side * 0.9, ty + 0.07, (z0 + z1) / 2], null, { cast: false });
    for (let z = z0; z < z1 - 4; z += 3 + rand() * 4) {
      if (rand() < 0.45) B.cable([x - side * 0.8, ty, z], [x - side * 0.7, ty, z + 2 + rand() * 4], 0.3 + rand() * 0.9, 0.025, cableMat);
    }
    // gaine de ventilation rectangulaire en haut
    const dy = 18.5;
    B.box(1.4, 0.9, z1 - z0 - 4, ductMat, [x - side * 1.2, dy, (z0 + z1) / 2], null, { cast: true, tex: 1 });
    for (let z = z0 + 2; z < z1 - 2; z += 3) B.box(1.5, 0.98, 0.08, darkSteel, [x - side * 1.2, dy, z], null, { cast: false });
    for (let z = z0 + 4; z < z1 - 4; z += 6) B.box(0.6, 0.06, 0.6, mats.vent(), [x - side * 1.2, dy - 0.48, z], null, { cast: false });
  }
  // gaines transversales sous les fermes
  for (const zz of [-29, -5, 19]) B.box(HX * 2 - 4, 0.8, 1.0, ductMat, [0, 21.7, zz + 1.6], null, { cast: true, tex: 1 });

  // ------------------------------------------------------------------ éléments muraux : grilles, panneaux ouverts, armoires
  wallDetails(B, mats, ctx);

  // ------------------------------------------------------------------ signalétique
  signage(scene, mats);

  // extérieur : bras structurels de la station visibles par la baie
  exterior(B, mats);
}

// ====================================================================== éléments

function column(B, x, z, side, steel, darkSteel, yellow) {
  const cx = x - side * 0.65;
  B.box(1.2, H, 0.12, steel, [cx, H / 2, z - 0.45], null, { collide: true });
  B.box(1.2, H, 0.12, steel, [cx, H / 2, z + 0.45], null, { collide: true });
  B.box(0.12, H, 0.9, darkSteel, [cx, H / 2, z], null, { collide: true });
  B.box(1.5, 0.3, 1.4, darkSteel, [cx, 0.15, z], null, { collide: true });
  // protection jaune en pied de poteau
  B.box(1.32, 1.4, 1.1, yellow, [cx, 0.7, z], null, { collide: true });
  // jarret vers la ferme
  const g = metricBox(0.3, 6.4, 0.3, 2);
  B.add(g, steel, Builder.matrix([x - side * 2.2, H - 5.1, z], [0, 0, side * 0.55]));
  // platines et boulons
  for (const y of [6, 12, 18]) B.box(1.3, 0.04, 1.05, darkSteel, [cx, y, z], null, { cast: false });
}

function columnZ(B, x, z, steel, darkSteel, yellow) {
  const cz = z - 0.65;
  B.box(0.12, H, 1.2, steel, [x - 0.45, H / 2, cz], null, { collide: true });
  B.box(0.12, H, 1.2, steel, [x + 0.45, H / 2, cz], null, { collide: true });
  B.box(0.9, H, 0.12, darkSteel, [x, H / 2, cz]);
  B.box(1.1, 1.4, 1.32, yellow, [x, 0.7, cz], null, { collide: true });
}

function truss(B, z, steel, darkSteel) {
  const y0 = H - 3.6, y1 = H - 0.6;
  B.box(HX * 2, 0.45, 0.45, steel, [0, y0, z]);
  B.box(HX * 2, 0.45, 0.45, steel, [0, y1, z]);
  const n = 16, step = (HX * 2) / n;
  for (let i = 0; i <= n; i++) {
    const x = -HX + i * step;
    B.box(0.22, y1 - y0, 0.22, darkSteel, [x, (y0 + y1) / 2, z], null, { cast: false });
    if (i < n) {
      const dx = step, dy = y1 - y0, L = Math.hypot(dx, dy);
      const g = metricBox(0.18, L, 0.18, 2);
      const a = Math.atan2(dx, dy) * (i % 2 ? 1 : -1);
      B.add(g, darkSteel, Builder.matrix([x + step / 2, (y0 + y1) / 2, z], [0, 0, a]), { cast: false });
    }
  }
}

function crane(B, mats, z, yellow, darkSteel) {
  const y = H - 4.3;
  for (const s of [-1, 1]) B.box(0.5, 0.7, 30, darkSteel, [s * (HX - 2.5), y + 0.3, z], null, { cast: false });
  B.box(HX * 2 - 5, 1.1, 0.8, yellow, [0, y - 0.6, z]);
  B.box(HX * 2 - 5, 1.1, 0.8, yellow, [0, y - 0.6, z + 2]);
  for (const s of [-1, 1]) B.box(1.2, 1.2, 3.0, yellow, [s * (HX - 2.5), y - 0.5, z + 1]);
  // chariot + crochet au-dessus du chasseur
  const tx = 15;
  B.box(2.4, 1.0, 3.0, mats.paint(0x2c3134), [tx, y - 1.5, z + 1]);
  B.cyl(0.02, 0.02, 7, mats.smooth(0x222222, 0.5, 0.8), [tx - 0.3, y - 5.5, z + 1], null, { seg: 4, cast: false });
  B.cyl(0.02, 0.02, 7, mats.smooth(0x222222, 0.5, 0.8), [tx + 0.3, y - 5.5, z + 1], null, { seg: 4, cast: false });
  B.box(0.9, 0.5, 0.5, yellow, [tx, y - 9.2, z + 1]);
  const hook = new THREE.TorusGeometry(0.22, 0.06, 6, 12, Math.PI * 1.4);
  B.add(hook, darkSteel, Builder.matrix([tx, y - 9.7, z + 1], [0, 0, 0.6]));
}

function shutter(B, mats, x, z, w, h) {
  const m = mats.metal(0x6a6e6b, { rough: 0.6 });
  // lames horizontales
  for (let y = 0.12; y < h; y += 0.24) B.box(w, 0.2, 0.08, m, [x, y + 0.1, z], null, { cast: false, collide: false });
  B.colliderBox(w, h, 0.3, [x, h / 2, z]);
  // caisson et glissières
  B.box(w + 1, 0.9, 0.9, mats.paint(0x3a4044), [x, h + 0.45, z - 0.2]);
  for (const s of [-1, 1]) {
    B.box(0.3, h + 0.5, 0.35, mats.paint(0xc89a1e), [x + s * (w / 2 + 0.15), (h + 0.5) / 2, z - 0.05]);
  }
}

function controlRoom(B, mats, ctx, z) {
  const frame = mats.paint(0x30363a);
  const y0 = 9, y1 = 12.5, x0 = -11, x1 = 11;
  // caisson en saillie
  B.box(x1 - x0 + 1, 0.5, 3.2, frame, [0, y0 - 0.25, z - 1.6]);
  B.box(x1 - x0 + 1, 0.6, 3.2, frame, [0, y1 + 0.3, z - 1.6]);
  for (const s of [-1, 1]) B.box(0.5, y1 - y0, 3.2, frame, [s * (x1 + 0.25), (y0 + y1) / 2, z - 1.6]);
  // meneaux inclinés
  const tilt = -0.22;
  for (let x = x0; x <= x1 + 0.01; x += 2.75) {
    const g = metricBox(0.14, y1 - y0 + 0.2, 0.18, 2);
    B.add(g, frame, Builder.matrix([x, (y0 + y1) / 2, z - 3.1], [tilt, 0, 0]));
  }
  // intérieur éclairé : fond, consoles, écrans (émissifs)
  B.box(x1 - x0, y1 - y0, 0.1, mats.paint(0x22272a), [0, (y0 + y1) / 2, z - 0.05]);
  for (let x = x0 + 1.5; x < x1; x += 2.75) {
    B.box(2.2, 0.9, 0.8, mats.paint(0x2a2f33), [x, y0 + 0.45, z - 1.0]);
    B.box(0.9, 0.55, 0.05, mats.emissive(0x58c8ff, 1.4), [x - 0.5, y0 + 1.35, z - 0.65], [-0.2, 0, 0], { cast: false });
    B.box(0.9, 0.55, 0.05, mats.emissive(0xffb050, 1.2), [x + 0.5, y0 + 1.35, z - 0.65], [-0.2, 0, 0], { cast: false });
  }
  B.box(x1 - x0, 0.15, 0.4, mats.emissive(0xffd2a0, 1.2), [0, y1 - 0.1, z - 1.0], null, { cast: false });
  // vitrage
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0 + 0.2), mats.glass(0x8fb0c0, 0.22));
  glass.position.set(0, (y0 + y1) / 2, z - 3.12);
  glass.rotation.x = tilt;
  glass.rotation.y = Math.PI;
  ctx.scene.add(glass);
}

function bayFrame(B, mats, ctx) {
  const z = Z_BAY;
  const frame = mats.paint(0x3b4146, { grime: 0.8 });
  const heavy = mats.metal(0x4d5256);
  const yellow = mats.paint(0xc89a1e, { grime: 0.7, plain: true, rough: 0.55 });
  const doorW = 44, doorH = 16;
  // cadre périphérique massif
  B.box(HX * 2 + 2, 2.2, 2.4, frame, [0, H - 1.1, z], null, { collide: true });
  B.box(2.4, H, 2.4, frame, [-HX, H / 2, z], null, { collide: true });
  B.box(2.4, H, 2.4, frame, [HX, H / 2, z], null, { collide: true });
  // linteau de la porte spatiale
  B.box(doorW + 4, 1.8, 2.8, heavy, [0, doorH + 0.9, z], null, {});
  B.box(doorW + 4, 0.3, 0.2, yellow, [0, doorH + 0.15, z - 1.45]);
  // piédroits de porte (logent les vantaux)
  for (const s of [-1, 1]) {
    B.box(3.0, doorH, 3.2, heavy, [s * (doorW / 2 + 1.5), doorH / 2, z], null, { collide: true });
    // bandes de danger sur le piédroit
    B.box(0.15, doorH, 0.6, yellow, [s * (doorW / 2 + 0.02), doorH / 2, z - 1.0], null, { cast: false });
    // vantail rétracté (visible en bout)
    B.box(1.2, doorH - 0.5, 1.2, mats.metal(0x585d60), [s * (doorW / 2 + 0.7), (doorH - 0.5) / 2, z + 0.6]);
    // vérins
    for (const y of [3, 8, 13]) B.cyl(0.18, 0.18, 2.4, mats.smooth(0xb0b4b5, 0.25, 1), [s * (doorW / 2 + 2.6), y, z - 1.2], [Math.PI / 2, 0, 0], {});
  }
  // vitrage latéral (x 25..31) et haut (y 18..22) : meneaux
  const mull = mats.metal(0x2f3437, { rough: 0.6 });
  const glassMat = mats.glass(0x9ab8cc, 0.08);
  const panes = [];
  for (const s of [-1, 1]) {
    const xa = doorW / 2 + 3, xb = HX - 1.2;
    for (let y = 0; y <= doorH + 2; y += 4.5) B.box(xb - xa, 0.35, 0.6, mull, [s * (xa + xb) / 2, y + 0.17, z]);
    B.box(0.4, doorH + 2, 0.7, mull, [s * (xa + xb) / 2, (doorH + 2) / 2, z]);
    panes.push([s * (xa + xb) / 2, (doorH + 2) / 2, xb - xa, doorH + 2]);
    B.colliderBox(xb - xa, doorH + 2, 0.5, [s * (xa + xb) / 2, (doorH + 2) / 2, z]);
  }
  // bandeau haut vitré
  for (let x = -HX + 1.2; x <= HX - 1.2; x += 5.6) B.box(0.35, H - 2.2 - (doorH + 1.8), 0.6, mull, [x, (doorH + 1.8 + H - 2.2) / 2, z]);
  B.box(HX * 2, 0.35, 0.6, mull, [0, 20.2, z]);
  panes.push([0, (doorH + 1.8 + H - 2.2) / 2, HX * 2 - 2.4, H - 2.2 - (doorH + 1.8)]);
  for (const [x, y, w, h] of panes) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    p.position.set(x, y, z + 0.05);
    ctx.scene.add(p);
  }
  // seuil : rebord, bandes de danger, balises au sol
  B.box(doorW, 0.12, 1.6, mats.metal(0x3a3e41), [0, 0.06, z - 0.2], null, { cast: false, collide: true });
  // tablier extérieur (prolongement du pont)
  B.box(doorW + 6, 1.2, 14, mats.metal(0x3c4044), [0, -0.6, z - 7.5], null, { collide: true });
  B.box(doorW + 6, 0.3, 0.6, yellow, [0, 0.0, z - 14.3]);
  // garde-corps invisibles : le joueur ne sort pas dans l'espace (champ de confinement)
  B.colliderBox(doorW, doorH, 0.3, [0, doorH / 2, z - 0.5]);

  // champ de confinement atmosphérique (léger voile bleuté animé)
  const fieldMat = new THREE.ShaderMaterial({
    uniforms: { uTime: ctx.mats.shared.uTime },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vW;
      void main(){
        float edge = smoothstep(0.0,0.04,vUv.x)*smoothstep(1.0,0.96,vUv.x)*smoothstep(1.0,0.94,vUv.y);
        float bands = 0.5+0.5*sin(vUv.y*220.0 + uTime*1.5);
        float wave = 0.5+0.5*sin(vUv.x*14.0 + vUv.y*5.0 - uTime*0.7);
        float base = 0.010 + 0.012*wave + 0.006*bands;
        float glowEdge = (1.0-smoothstep(0.0,0.02,vUv.x)) + (1.0-smoothstep(1.0,0.98,vUv.x)) + smoothstep(0.985,1.0,vUv.y);
        vec3 c = vec3(0.35,0.65,1.0) * (base*edge + glowEdge*0.35);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), fieldMat);
  field.position.set(0, doorH / 2, z - 0.6);
  field.renderOrder = 5;
  ctx.scene.add(field);
  // projecteurs du champ (émetteurs bleus le long du seuil et du linteau)
  const em = mats.emissive(0x6fb8ff, 5);
  for (let x = -doorW / 2 + 1; x < doorW / 2; x += 2.2) {
    B.box(0.5, 0.08, 0.25, em, [x, 0.14, z - 0.7], null, { cast: false });
    B.box(0.5, 0.08, 0.25, em, [x, doorH - 0.05, z - 1.2], null, { cast: false });
  }
  // feux de piste rouges/verts extérieurs
  for (let i = 0; i < 6; i++) {
    B.box(0.3, 0.12, 0.3, mats.emissive(i % 2 ? 0x40ff70 : 0xff3020, 6), [-doorW / 2 + 1 + i * 0.2 * doorW, 0.06, z - 13.6], null, { cast: false });
  }
}

function catwalk(B, mats, side, grating, steel, yellow) {
  const w = 2.4;
  const x = side * (HX - 1.4 - w / 2);
  const z0 = Z_BAY + 3, z1 = Z_BACK - 1;
  const len = z1 - z0, zc = (z0 + z1) / 2;
  const g = new THREE.PlaneGeometry(w, len); g.rotateX(-Math.PI / 2);
  worldUV(g, 1, Builder.matrix([x, CAT_Y, zc]));
  B.add(g, grating, Builder.matrix([x, CAT_Y, zc]), { cast: true, collide: true });
  // longerons
  B.box(0.12, 0.3, len, steel, [x - side * w / 2, CAT_Y - 0.15, zc], null, { collide: false });
  B.box(0.12, 0.3, len, steel, [x + side * w / 2, CAT_Y - 0.15, zc]);
  // consoles murales triangulées
  for (let z = z0 + 1; z < z1; z += 4) {
    B.box(w + 1.4, 0.15, 0.12, steel, [x + side * 0.7, CAT_Y - 0.3, z], null, { cast: false });
    const L = Math.hypot(w, 1.8);
    B.add(metricBox(0.1, L, 0.1, 2), steel, Builder.matrix([x + side * 0.5, CAT_Y - 1.2, z], [0, 0, side * Math.atan2(w, 1.8)]), { cast: false });
  }
  railing(B, mats, [x - side * w / 2, CAT_Y, z0], [x - side * w / 2, CAT_Y, z1], steel, yellow);
}

function backCatwalk(B, mats, grating, steel, yellow) {
  const z = Z_BACK - 1.4 - 1.2, w = 2.4;
  const x0 = -HX + 1.4, x1 = HX - 1.4;
  // segments laissant la place à la salle de contrôle (x -11..11 : passe devant)
  const g = new THREE.PlaneGeometry(x1 - x0, w); g.rotateX(-Math.PI / 2);
  const M = Builder.matrix([0, CAT_Y, z - 1.5]);
  worldUV(g, 1, M);
  B.add(g, grating, M, { collide: true });
  B.box(x1 - x0, 0.3, 0.12, steel, [0, CAT_Y - 0.15, z - 1.5 - w / 2]);
  railing(B, mats, [x0 + 2.4, CAT_Y, z - 1.5 - w / 2], [x1 - 2.4, CAT_Y, z - 1.5 - w / 2], steel, yellow);
}

export function railing(B, mats, a, b, steel, yellow, h = 1.1) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const dir = Bv.clone().sub(A); const L = dir.length(); dir.normalize();
  const rot = [0, Math.atan2(dir.x, dir.z), 0];
  const mid = A.clone().add(Bv).multiplyScalar(0.5);
  B.box(0.06, 0.06, L, yellow, [mid.x, a[1] + h, mid.z], rot, { cast: false });
  B.box(0.04, 0.04, L, steel, [mid.x, a[1] + h * 0.55, mid.z], rot, { cast: false });
  B.box(0.02, 0.12, L, steel, [mid.x, a[1] + 0.06, mid.z], rot, { cast: false });
  const n = Math.ceil(L / 1.8);
  for (let i = 0; i <= n; i++) {
    const p = A.clone().addScaledVector(dir, (i / n) * L);
    B.box(0.06, h, 0.06, steel, [p.x, a[1] + h / 2, p.z], null, { cast: false });
  }
  B.colliderBox(0.1, h, L, [mid.x, a[1] + h / 2, mid.z], rot);
}

function stairs(B, mats, side, zTop, grating, steel, yellow, dirZ) {
  // escalier droit le long du mur, du sol à CAT_Y
  const steps = 22, rise = CAT_Y / steps, run = 0.28;
  const x = side * (HX - 1.4 - 1.2 - 2.4 - 0.7);
  const w = 1.3;
  for (let i = 0; i < steps; i++) {
    const y = (i + 1) * rise;
    const z = zTop - dirZ * (steps - i) * run;
    const g = new THREE.PlaneGeometry(w, run); g.rotateX(-Math.PI / 2);
    B.add(g, grating, Builder.matrix([x, y, z]), { cast: false });
  }
  const L = Math.hypot(steps * run, CAT_Y);
  const ang = Math.atan2(CAT_Y, steps * run) * dirZ;
  for (const s of [-1, 1]) {
    B.box(0.08, 0.3, L, steel, [x + s * w / 2, CAT_Y / 2, zTop - dirZ * steps * run / 2], [ang, 0, 0]);
    B.box(0.05, 0.05, L, yellow, [x + s * (w / 2 + 0.02), CAT_Y / 2 + 1.0, zTop - dirZ * steps * run / 2], [ang, 0, 0], { cast: false });
  }
  // rampe de collision (pente continue)
  const rampG = new THREE.PlaneGeometry(w, L); rampG.rotateX(-Math.PI / 2);
  const rM = Builder.matrix([x, CAT_Y / 2 + 0.05, zTop - dirZ * steps * run / 2], [ang, 0, 0]);
  const rg = rampG.toNonIndexed(); rg.applyMatrix4(rM); B.addCollider(rg);
  // palier vers la passerelle
  const lg = new THREE.PlaneGeometry(w + 0.3, 1.4); lg.rotateX(-Math.PI / 2);
  const lm = Builder.matrix([x, CAT_Y, zTop + dirZ * 0.7]);
  B.add(lg, grating, lm, { collide: true });
  // poteaux
  B.box(0.15, CAT_Y, 0.15, steel, [x, CAT_Y / 2, zTop + dirZ * 1.3]);
  B.colliderBox(0.1, 1.1, L, [x + side * (w / 2 + 0.05), CAT_Y / 2 + 0.6, zTop - dirZ * steps * run / 2], [ang, 0, 0]);
  B.colliderBox(0.1, 1.1, L, [x - side * (w / 2 + 0.05), CAT_Y / 2 + 0.6, zTop - dirZ * steps * run / 2], [ang, 0, 0]);
  B.addObstacle(x, zTop - dirZ * steps * run / 2, w / 2 + 0.3, steps * run / 2);
}

function valve(B, mats, x, y, z, side) {
  const red = mats.plastic(0xa3241b, 0.5);
  B.box(0.3, 0.3, 0.3, mats.smooth(0x6d7072, 0.4, 0.9), [x, y, z]);
  const wheel = new THREE.TorusGeometry(0.22, 0.03, 6, 16);
  B.add(wheel, red, Builder.matrix([x - side * 0.25, y, z], [0, Math.PI / 2, 0]), { cast: false });
  B.cyl(0.1, 0.1, 0.9, mats.smooth(0x6d7072, 0.4, 0.9), [x, y - 0.6, z]);
  B.box(0.4, 0.06, 0.4, mats.metal(0x333333), [x, 0.03, z]);
}

function wallDetails(B, mats, ctx) {
  const vent = mats.vent();
  const dark = mats.paint(0x2a2f32);
  const box = mats.paint(0x56606a);
  const orange = mats.paint(0xb5531d);
  const cable = mats.rubber();
  for (const side of [-1, 1]) {
    const x = side * HX;
    for (let i = 1; i < COLS.length - 2; i++) {
      const z = (COLS[i] + COLS[i + 1]) / 2;
      if (side === -1 && Math.abs(z - AIRLOCK.z) < 4.5) continue;
      // grilles de ventilation basses
      B.box(0.08, 1.0, 1.6, vent, [x - side * 0.04, 1.6, z + 1.5], null, { cast: false });
      // armoires électriques
      if (i % 2 === 0) {
        B.box(0.5, 1.9, 1.2, box, [x - side * 0.25, 0.95, z - 2.2], null, { collide: true, obstacle: true });
        B.box(0.06, 0.25, 0.6, mats.emissive(i % 4 ? 0x50ff80 : 0xffa030, 2.0), [x - side * 0.52, 1.6, z - 2.2], null, { cast: false });
        B.cable([x - side * 0.3, 1.9, z - 2.0], [x - side * 0.3, 5.0, z - 1.0], 0.2, 0.04, cable);
      } else {
        // panneau d'accès ouvert : cadre sombre, intérieur, porte entrebâillée, câbles qui sortent
        const pz = z - 1.8;
        B.box(0.12, 1.4, 1.1, dark, [x - side * 0.02, 1.2, pz], null, { cast: false });
        B.box(0.04, 1.2, 0.9, mats.metal(0x1a1c1d, { rough: 0.9 }), [x - side * 0.09, 1.2, pz], null, { cast: false });
        const door = metricBox(0.04, 1.2, 0.9, 1);
        B.add(door, mats.paint(0x7d858a), Builder.matrix([x - side * 0.45, 1.2, pz - 0.75], [0, side * 1.1, 0]));
        for (let k = 0; k < 3; k++) B.cable([x - side * 0.1, 1.1 + k * 0.15, pz - 0.2 + k * 0.15], [x - side * 0.9, 0.05, pz + 0.2 + k * 0.3], 0.1, 0.018, k ? cable : mats.plastic(0xc0451a));
      }
      // boîtiers de bornes à hauteur d'homme
      B.box(0.18, 0.4, 0.3, mats.paint(0xc89a1e), [x - side * 0.09, 1.5, z - 0.3], null, { cast: false });
    }
  }
}

function signage(scene, mats) {
  const add = (mesh) => { scene.add(mesh); return mesh; };
  const wallText = (lines, w, pos, rotY, opts = {}) => {
    const { tex, aspect } = paintedText(lines, opts);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), decalMaterial(tex, { rough: 0.7 }));
    m.position.set(...pos); m.rotation.y = rotY; m.receiveShadow = true;
    return add(m);
  };
  // grand numéro sur le mur du fond
  wallText(['07'], 12, [-20, 10.5, Z_BACK - 0.02], Math.PI, { size: 360, color: '#e7dfcf', wear: 1.5 });
  wallText(['HANGAR'], 9, [-20, 5.6, Z_BACK - 0.02], Math.PI, { size: 160, color: '#e7dfcf', spacing: 30, wear: 1.2 });
  // sur les murs latéraux
  wallText(['H-07', 'SECTEUR CARGO'], 7, [HX - 0.02, 9.6, -24], -Math.PI / 2, { size: 150, color: '#d8d2c4', wear: 1.3 });
  wallText(['H-07'], 6, [-HX + 0.02, 11.5, -24], Math.PI / 2, { size: 220, color: '#d8d2c4', wear: 1.4 });
  wallText(['SAS 2 · GALERIE MARCHANDE', 'DOUANE · TRANSIT'], 5.2, [-HX + 0.02, 6.1, AIRLOCK.z], Math.PI / 2, { size: 110, color: '#f0c050', wear: 0.6 });
  wallText(['ZONE D\'APPONTAGE', 'CASQUE OBLIGATOIRE AU-DELÀ DE LA LIGNE'], 6.5, [HX - 0.02, 4.4, 6], -Math.PI / 2, { size: 90, color: '#e8e1d0', wear: 0.9 });
  wallText(['ATTENTION', 'CHAMP DE CONFINEMENT'], 6, [-25, 19.4, Z_BAY + 1.25], 0, { size: 110, color: '#f0c050', wear: 0.8 });
  wallText(['ATELIER', 'MAINTENANCE'], 5, [HX - 0.02, 4.3, 19], -Math.PI / 2, { size: 120, color: '#e8e1d0', wear: 1.0 });
  wallText(['STOCKAGE', 'FRET 07-B'], 4.5, [20, 8.4, Z_BACK - 0.02], Math.PI, { size: 120, color: '#f0c050', wear: 0.9 });
  wallText(['CONTRÔLE DE PONT'], 5, [0, 13.4, Z_BACK - 3.3], Math.PI, { size: 100, color: '#e8e1d0', wear: 0.5 });
  // pictogrammes
  const pic = (kind, size, pos, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decalMaterial(pictogram(kind), { rough: 0.6 }));
    m.position.set(...pos); m.rotation.y = rotY; return add(m);
  };
  pic('helmet', 0.8, [HX - 0.02, 2.2, 3.2], -Math.PI / 2);
  pic('warning', 0.8, [HX - 0.02, 2.2, 4.2], -Math.PI / 2);
  pic('vehicle', 0.8, [HX - 0.02, 2.2, 5.2], -Math.PI / 2);
  pic('voltage', 0.5, [-HX + 0.02, 1.9, -15.2], Math.PI / 2);
  pic('voltage', 0.5, [HX - 0.02, 1.9, 4.8 - 12], -Math.PI / 2);
  pic('nosmoke', 0.7, [-HX + 0.02, 2.2, AIRLOCK.z + 3.0], Math.PI / 2);
  pic('suit', 0.7, [-HX + 0.02, 2.2, AIRLOCK.z - 3.4], Math.PI / 2);
  pic('fire', 0.6, [HX - 0.02, 2.0, 14.5], -Math.PI / 2);
  pic('exit', 0.9, [-HX + 0.02, 3.6, AIRLOCK.z + 3.4], Math.PI / 2);
  pic('warning', 1.2, [-12, 15.2, Z_BAY + 1.25], 0);
  pic('warning', 1.2, [12, 15.2, Z_BAY + 1.25], 0);
  // bandes de danger sur les piédroits de la porte
  const hz = hazardTexture(512, 64, 1);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 15), decalMaterial(hz));
    m.material.map.repeat.set(1, 1);
    m.position.set(s * 23.6, 7.5, Z_BAY + 1.62); m.rotation.z = Math.PI / 2;
    m.scale.set(1, 1, 1);
    add(m);
  }
}

function exterior(B, mats) {
  // grands bras de la station, vus dans l'encadrement de la baie
  const hull = mats.metal(0x3a3f44, { rough: 0.65, grime: 0.4 });
  const dark = mats.metal(0x202427, { rough: 0.8 });
  // structure en surplomb au-dessus de la baie
  B.box(90, 6, 30, hull, [0, H + 3, Z_BAY - 15], null, { cast: true, receive: true });
  // pylône gauche et droit avec treillis
  for (const s of [-1, 1]) {
    B.box(10, 60, 10, hull, [s * 70, -10, Z_BAY - 70]);
    for (let y = -30; y < 20; y += 6) B.box(14, 0.8, 14, dark, [s * 70, y, Z_BAY - 70], null, { cast: false });
    B.box(4, 4, 120, hull, [s * 70, 18, Z_BAY - 60]);
    B.box(0.8, 0.8, 0.8, mats.emissive(0xff2a10, 8), [s * 70, 20.4, Z_BAY - 118], null, { cast: false });
  }
  // anneau d'amarrage en contrebas
  B.box(200, 4, 20, dark, [0, -26, Z_BAY - 40]);
  for (let x = -90; x <= 90; x += 15) B.box(1.2, 0.6, 0.6, mats.emissive(0xffc070, 5), [x, -23.7, Z_BAY - 30], null, { cast: false });
}

// ====================================================================== marquages au sol

function floorMarkings(quality) {
  const W = HX * 2, D = Z_BACK - Z_BAY;
  const res = quality.name === 'low' ? 2048 : 4096;
  const ppm = res / D; // pixels par mètre (sur Z)
  const cw = Math.round(W * ppm), ch = res;
  const c = canvas(cw, ch), ctx = c.getContext('2d');
  const X = (x) => (x + HX) * ppm, Z = (z) => (z - Z_BAY) * ppm;
  ctx.clearRect(0, 0, cw, ch);
  // repère : y canvas = z monde ; la texture est retournée via UV (v = 1 - ...)
  const paint = (color, alpha = 0.9) => { ctx.fillStyle = color; ctx.strokeStyle = color; ctx.globalAlpha = alpha; };

  // voies piétonnes le long des murs (bande verte + pointillés blancs)
  paint('#3f8f5a', 0.55);
  ctx.fillRect(X(-HX + 1.6), Z(Z_BAY + 3), 2.2 * ppm, Z(Z_BACK - 1) - Z(Z_BAY + 3));
  ctx.fillRect(X(HX - 3.8), Z(Z_BAY + 3), 2.2 * ppm, Z(Z_BACK - 1) - Z(Z_BAY + 3));
  paint('#e8e4d8', 0.85);
  for (const x of [-HX + 3.85, HX - 3.85]) {
    for (let z = Z_BAY + 3; z < Z_BACK - 2; z += 1.6) ctx.fillRect(X(x) - 0.06 * ppm, Z(z), 0.12 * ppm, 0.8 * ppm);
  }
  // voie véhicules (jaune double) en boucle
  paint('#d8a420', 0.85);
  const lane = (x0, z0, x1, z1) => { ctx.lineWidth = 0.14 * ppm; ctx.strokeRect(X(x0), Z(z0), (x1 - x0) * ppm, (z1 - z0) * ppm); };
  lane(-HX + 5.4, -33, HX - 5.4, Z_BACK - 4);
  lane(-HX + 5.0, -33.4, HX - 5.0, Z_BACK - 3.6);
  // flèches de circulation
  const arrow = (x, z, ang) => {
    ctx.save(); ctx.translate(X(x), Z(z)); ctx.rotate(ang); ctx.beginPath();
    ctx.moveTo(0, -1.4 * ppm); ctx.lineTo(0.7 * ppm, -0.4 * ppm); ctx.lineTo(0.25 * ppm, -0.4 * ppm); ctx.lineTo(0.25 * ppm, 1.2 * ppm);
    ctx.lineTo(-0.25 * ppm, 1.2 * ppm); ctx.lineTo(-0.25 * ppm, -0.4 * ppm); ctx.lineTo(-0.7 * ppm, -0.4 * ppm); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  paint('#e8e4d8', 0.8);
  for (const z of [-20, 0, 18]) { arrow(HX - 6.6, z, Math.PI); arrow(-HX + 6.6, z, 0); }
  for (const x of [-12, 0, 12]) { arrow(x, Z_BACK - 4.9, Math.PI / 2); arrow(x, -32.2, -Math.PI / 2); }

  // aires d'atterrissage
  for (const k of Object.keys(PADS)) {
    const p = PADS[k];
    const cx = X(p.x), cz = Z(p.z), r = p.r * ppm;
    ctx.save();
    paint('#d8a420', 0.8);
    ctx.lineWidth = 0.35 * ppm;
    ctx.beginPath(); ctx.arc(cx, cz, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 0.12 * ppm;
    ctx.beginPath(); ctx.arc(cx, cz, r - 0.6 * ppm, 0, Math.PI * 2); ctx.stroke();
    // graduations
    for (let a = 0; a < 72; a++) {
      const an = (a / 72) * Math.PI * 2, l = (a % 6 === 0 ? 1.0 : 0.4) * ppm;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * (r - 0.7 * ppm), cz + Math.sin(an) * (r - 0.7 * ppm));
      ctx.lineTo(cx + Math.cos(an) * (r - 0.7 * ppm - l), cz + Math.sin(an) * (r - 0.7 * ppm - l)); ctx.stroke();
    }
    // croix centrale et nom
    paint('#e8e4d8', 0.85);
    ctx.fillRect(cx - 2.5 * ppm, cz - 0.1 * ppm, 5 * ppm, 0.2 * ppm);
    ctx.fillRect(cx - 0.1 * ppm, cz - 2.5 * ppm, 0.2 * ppm, 5 * ppm);
    ctx.font = `700 ${2.6 * ppm}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate(cx, cz + r - 2.8 * ppm);
    ctx.fillText(p.name, 0, 0);
    ctx.restore();
    // bandes de danger aux bords de l'aire
    ctx.save(); ctx.globalAlpha = 0.65;
    ctx.translate(cx, cz);
    for (let a = 0; a < 4; a++) {
      ctx.rotate(Math.PI / 2);
      for (let i = -3; i < 3; i++) {
        ctx.fillStyle = i % 2 ? '#d8a420' : '#151515';
        ctx.beginPath(); ctx.arc(0, 0, r + 0.9 * ppm, (i * 0.05) - 0.15, ((i + 1) * 0.05) - 0.15); ctx.arc(0, 0, r + 0.25 * ppm, ((i + 1) * 0.05) - 0.15, (i * 0.05) - 0.15, true); ctx.fill();
      }
    }
    ctx.restore();
  }
  // ligne de danger devant la baie (zone d'exclusion)
  ctx.globalAlpha = 0.85;
  for (let x = -24; x < 24; x += 1.0) {
    ctx.fillStyle = Math.round((x + 24) / 1.0) % 2 ? '#d8a420' : '#141414';
    ctx.beginPath();
    ctx.moveTo(X(x), Z(Z_BAY + 1.2)); ctx.lineTo(X(x + 1.0), Z(Z_BAY + 1.2)); ctx.lineTo(X(x + 0.5), Z(Z_BAY + 2.4)); ctx.lineTo(X(x - 0.5), Z(Z_BAY + 2.4));
    ctx.fill();
  }
  paint('#e8e4d8', 0.8);
  ctx.font = `700 ${1.2 * ppm}px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('ZONE D\'EXCLUSION — CHAMP ACTIF', X(0), Z(Z_BAY + 4.2));
  // passage piéton vers le sas
  paint('#e8e4d8', 0.85);
  for (let z = AIRLOCK.z - 1.6; z <= AIRLOCK.z + 1.6; z += 0.8) ctx.fillRect(X(-HX + 1.6), Z(z), 7 * ppm, 0.4 * ppm);
  ctx.font = `700 ${1.0 * ppm}px ${FONT}`;
  ctx.save(); ctx.translate(X(-HX + 9.5), Z(AIRLOCK.z)); ctx.rotate(Math.PI / 2); ctx.fillText('◄ SAS 2', 0, 0); ctx.restore();
  // zone de stockage hachurée
  ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#d8a420'; ctx.lineWidth = 0.12 * ppm;
  ctx.strokeRect(X(STORAGE.x - 7), Z(STORAGE.z - 6), 13 * ppm, 10 * ppm);
  ctx.beginPath(); ctx.rect(X(STORAGE.x - 7), Z(STORAGE.z - 6), 13 * ppm, 10 * ppm); ctx.clip();
  for (let i = -20; i < 40; i++) { ctx.beginPath(); ctx.moveTo(X(STORAGE.x - 7 + i * 0.8), Z(STORAGE.z - 6)); ctx.lineTo(X(STORAGE.x - 7 + i * 0.8 - 10), Z(STORAGE.z + 4)); ctx.stroke(); }
  ctx.restore();

  // usure de la peinture
  ctx.globalAlpha = 1;
  erode(ctx, cw, ch, 6);

  // traces de pneus (noires, semi-transparentes) le long des voies et vers les aires
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  const tire = (pts, width, alpha) => {
    for (const off of [-0.7, 0.7]) {
      ctx.strokeStyle = `rgba(12,10,9,${alpha})`;
      ctx.lineWidth = width * ppm;
      ctx.beginPath();
      pts.forEach(([x, z], i) => {
        const jx = (rand() - 0.5) * 0.08;
        if (i === 0) ctx.moveTo(X(x + off + jx), Z(z)); else ctx.lineTo(X(x + off + jx), Z(z));
      });
      ctx.stroke();
    }
  };
  for (let k = 0; k < 26; k++) {
    const z0 = -32 + rand() * 4, sx = HX - 6 + (rand() - 0.5) * 1.2;
    tire([[sx, Z_BACK - 4], [sx, 10], [sx - 0.5, -10], [sx, z0]], 0.22 + rand() * 0.1, 0.05 + rand() * 0.06);
    const tx = 10 + rand() * 6;
    tire([[STORAGE.x - 3, STORAGE.z - 6], [tx + 4, 2], [tx, -6]], 0.22, 0.04 + rand() * 0.05);
  }
  // traces de dérapage / freinage courbes près des aires
  for (let k = 0; k < 40; k++) {
    const p = Object.values(PADS)[k % 4];
    const a0 = rand() * Math.PI * 2, rr = p.r * (0.5 + rand() * 0.6);
    ctx.strokeStyle = `rgba(10,9,8,${0.04 + rand() * 0.07})`;
    ctx.lineWidth = (0.18 + rand() * 0.15) * ppm;
    ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), rr * ppm, a0, a0 + 0.3 + rand() * 0.8); ctx.stroke();
  }
  // taches de carburant / huile irisées sombres
  const stain = (x, z, r, a) => {
    for (let i = 0; i < 6; i++) {
      const ox = (rand() - 0.5) * r, oz = (rand() - 0.5) * r, rr = r * (0.3 + rand() * 0.7);
      const g = ctx.createRadialGradient(X(x + ox), Z(z + oz), 0, X(x + ox), Z(z + oz), rr * ppm);
      g.addColorStop(0, `rgba(14,11,8,${a})`); g.addColorStop(0.7, `rgba(20,16,10,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(x + ox), Z(z + oz), rr * ppm, 0, 7); ctx.fill();
    }
  };
  for (const p of Object.values(PADS)) for (let i = 0; i < 7; i++) stain(p.x + (rand() - 0.5) * p.r, p.z + (rand() - 0.5) * p.r, 0.6 + rand() * 1.6, 0.25 + rand() * 0.3);
  for (let i = 0; i < 30; i++) stain(-HX + rand() * HX * 2, Z_BAY + 5 + rand() * (Z_BACK - Z_BAY - 8), 0.3 + rand() * 0.8, 0.12 + rand() * 0.2);
  // brûlures de réacteurs (sous les tuyères des vaisseaux)
  for (const p of [PADS.p2, PADS.p3, PADS.p4]) {
    const zz = p.z + (p.heading === 0 ? p.r * 0.7 : -p.r * 0.7);
    const g = ctx.createRadialGradient(X(p.x), Z(zz), 0, X(p.x), Z(zz), 5 * ppm);
    g.addColorStop(0, 'rgba(18,14,10,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(p.x), Z(zz), 5 * ppm, 0, 7); ctx.fill();
  }
  // crasse au pied des murs
  for (const x of [-HX, HX]) {
    const g = ctx.createLinearGradient(X(x), 0, X(x - Math.sign(x) * 2), 0);
    g.addColorStop(0, 'rgba(15,12,9,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(Math.min(X(x), X(x - Math.sign(x) * 2)), 0, 2 * ppm, ch);
  }
  {
    const g = ctx.createLinearGradient(0, Z(Z_BACK), 0, Z(Z_BACK - 2));
    g.addColorStop(0, 'rgba(15,12,9,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, Z(Z_BACK - 2), cw, 2 * ppm);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = quality.anisotropy;
  return t;
}
