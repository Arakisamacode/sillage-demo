import * as THREE from 'three';
import { GALLERY } from './layout.js';
import { neonTexture, neonMaterial } from './signage.js';

// Module habitat : couloir depuis la galerie, hall des ascenseurs, et pont habitat (40 m plus haut) avec
// promenade panoramique et bar, infirmerie et cabine du joueur. Les ascenseurs transfèrent d'un niveau à l'autre.

export const DECK_Y = 40;
const G = GALLERY;
const DZ = (G.z0 + G.z1) / 2 - 4;     // axe de la porte « MODULE HABITAT » (z = -11)
const CAB = [-14, -8];                 // axes des deux cabines d'ascenseur (z)
const LOBBY = { x0: -120, x1: -112, z0: -17, z1: -5 };
const HALL = { x0: -112, x1: -80, z0: -24, z1: 2, h: 5.2 };

export function buildHabitat(ctx) {
  const { mats, scene, builder: B } = ctx;
  const wallM = mats.paint(0xd4d9dd, { grime: 0.25, scratch: 0.25, rust: 0, rough: 0.6 });
  const wallD = mats.paint(0x3a3e42, { grime: 0.5 });
  const dark = mats.paint(0x24282b);
  const floorM = mats.stationFloor ? mats.stationFloor() : mats.diamond(0x9a9ea2);
  const trim = mats.metal(0x8c9094, { rough: 0.35, grime: 0.3 });
  const warm = mats.emissive(0xffd9a8, 1.6), cold = mats.emissive(0xbfe0ff, 1.8), green = mats.emissive(0x7dff9a, 2.2);
  const wood = mats.paint(0x6a4a32, { plain: true, rough: 0.55, grime: 0.2 });
  const seatM = mats.plastic(0x2a3440, 0.6), redSeat = mats.plastic(0x7a2a24, 0.6);
  const box = (w, h, d, m, p, col = false, opts = {}) => B.box(w, h, d, m, p, opts.rot || null, { collide: col, cast: false, tex: opts.tex ?? 3 });
  /** pièce fermée : sol, plafond, murs (avec ouvertures listées par côté : { side, a, b, h }) */
  const room = (x0, x1, z0, z1, y, h, holes = [], m = wallM) => {
    box(x1 - x0, 0.3, z1 - z0, dark, [(x0 + x1) / 2, y - 0.15, (z0 + z1) / 2], true);
    const f = new THREE.PlaneGeometry(x1 - x0, z1 - z0); f.rotateX(-Math.PI / 2);
    B.add(f, floorM, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, y + 0.01, (z0 + z1) / 2), { collide: false, cast: false });
    box(x1 - x0, 0.3, z1 - z0, wallD, [(x0 + x1) / 2, y + h + 0.15, (z0 + z1) / 2]);
    const wall = (side, a0, a1, c, along) => {
      // segments pleins entre les ouvertures
      const hs = holes.filter((o) => o.side === side).sort((p, q) => p.a - q.a);
      let cur = a0;
      const seg = (s0, s1, hy0, hy1) => {
        if (s1 - s0 < 0.01) return;
        const len = s1 - s0, mid = (s0 + s1) / 2, hh = hy1 - hy0;
        if (along === 'x') box(len, hh, 0.3, m, [mid, y + hy0 + hh / 2, c], true);
        else box(0.3, hh, len, m, [c, y + hy0 + hh / 2, mid], true);
      };
      for (const o of hs) { seg(cur, o.a, 0, h); if (o.sill !== undefined) seg(o.a, o.b, 0, o.sill); else seg(o.a, o.b, o.h, h); cur = o.b; }
      seg(cur, a1, 0, h);
    };
    wall('s', x0, x1, z0, 'x'); wall('n', x0, x1, z1, 'x'); wall('w', z0, z1, x0, 'z'); wall('e', z0, z1, x1, 'z');
  };

  // ------------------------------------------------------------------ rez-de-chaussée : couloir et hall des ascenseurs
  const dw = 3.2, dh = 3.2;
  {
    const x0 = LOBBY.x1, x1 = G.x0 - 5.3;           // prolongement du couloir de la galerie
    const len = x1 - x0, xc = (x0 + x1) / 2;
    box(len, 0.3, dw + 0.6, dark, [xc, -0.15, DZ], true);
    const f = new THREE.PlaneGeometry(len, dw); f.rotateX(-Math.PI / 2);
    B.add(f, mats.metal(0x2a2c2e), new THREE.Matrix4().makeTranslation(xc, 0.01, DZ), { collide: false, cast: false });
    for (const s of [-1, 1]) box(len, dh, 0.3, dark, [xc, dh / 2, DZ + s * (dw / 2 + 0.15)], true);
    box(len, 0.3, dw + 1, dark, [xc, dh + 0.15, DZ]);
    box(len - 0.4, 0.05, 0.3, warm, [xc, dh - 0.05, DZ]);
  }
  room(LOBBY.x0, LOBBY.x1, LOBBY.z0, LOBBY.z1, 0, 4.2, [
    { side: 'e', a: DZ - dw / 2, b: DZ + dw / 2, h: dh },
    ...CAB.map((c) => ({ side: 'w', a: c - 0.9, b: c + 0.9, h: 2.6 })),
  ]);
  // ------------------------------------------------------------------ pont habitat
  const Y = DECK_Y;
  room(LOBBY.x0, LOBBY.x1, LOBBY.z0, LOBBY.z1, Y, 4.2, [
    { side: 'e', a: -16, b: -6, h: 3.6 },
    { side: 'n', a: -118, b: -114, h: 3.2 },                     // couloir vers la Cour des Saveurs
    ...CAB.map((c) => ({ side: 'w', a: c - 0.9, b: c + 0.9, h: 2.6 })),
  ]);
  room(HALL.x0, HALL.x1, HALL.z0, HALL.z1, Y, HALL.h, [
    { side: 'w', a: -16, b: -6, h: 3.6 },
    { side: 's', a: HALL.x0 + 1, b: HALL.x1 - 1, sill: 0.7 },     // baie vitrée (allège basse, vitrage au-dessus)
    { side: 'n', a: -105.6, b: -102.4, h: 2.8 },                  // infirmerie
    { side: 'n', a: -91.6, b: -88.4, h: 2.8 },                    // cabine
  ]);
  // baie vitrée et meneaux
  const glass = mats.glass(0x9fc4dc, 0.14);
  box(HALL.x1 - HALL.x0 - 2, HALL.h - 0.7, 0.06, glass, [(HALL.x0 + HALL.x1) / 2, Y + 0.7 + (HALL.h - 0.7) / 2, HALL.z0], true);
  for (let x = HALL.x0 + 1; x <= HALL.x1 - 1; x += 3.75) box(0.25, HALL.h, 0.4, trim, [x, Y + HALL.h / 2, HALL.z0]);
  box(HALL.x1 - HALL.x0, 0.2, 0.7, trim, [(HALL.x0 + HALL.x1) / 2, Y + 0.7, HALL.z0 + 0.2]);
  // infirmerie et cabine
  room(-108, -100, 2, 10, Y, 3.4, [{ side: 's', a: -105.6, b: -102.4, h: 2.8 }], mats.paint(0xe6ecef, { grime: 0.15, rough: 0.5 }));
  room(-94, -86, 2, 8, Y, 3.0, [{ side: 's', a: -91.6, b: -88.4, h: 2.8 }], mats.paint(0x8a7a66, { grime: 0.2, rough: 0.6 }));

  // ------------------------------------------------------------------ ascenseurs : gaines sur toute la hauteur, cabines mobiles
  const shafts = [];
  const metalCab = mats.metal(0x6a6e72, { rough: 0.3 }), shaftM = mats.paint(0x2a2d30, { grime: 0.8, rust: 0.2 });
  const amber = mats.emissive(0xffa040, 2.4);
  for (const c of CAB) {
    const x0 = LOBBY.x0 - 2.6, x1 = LOBBY.x0, H0 = -0.4, H1 = Y + 4.6, hh = H1 - H0;
    // gaine : fond, flancs, façade entre les paliers (béton sombre, repères lumineux tous les 3 m)
    box(0.3, hh, 2.8, shaftM, [x0 - 0.15, (H0 + H1) / 2, c], true);
    for (const s2 of [-1, 1]) box(2.9, hh, 0.3, shaftM, [x0 + 1.3, (H0 + H1) / 2, c + s2 * 1.4], true);
    box(0.3, Y - 4.2, 2.4, shaftM, [x1 - 0.05, (4.2 + Y) / 2, c]);
    for (let y = 3; y < Y; y += 3) {
      box(0.05, 0.08, 1.8, amber, [x0 + 0.02, y, c]);
      for (const s2 of [-1, 1]) box(2.2, 0.08, 0.05, amber, [x0 + 1.3, y, c + s2 * 1.23]);
    }
    // planchers des paliers (collision seulement : le sol visible est celui de la cabine)
    for (const y of [0, Y]) B.colliderBox(2.6, 0.3, 2.4, [x0 + 1.3, y - 0.15, c]);
    // cabine mobile
    const cab = new THREE.Group();
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.receiveShadow = true; cab.add(o); return o; };
    add(new THREE.BoxGeometry(2.5, 0.2, 2.4), dark, 1.25, -0.1, 0);
    add(new THREE.BoxGeometry(2.5, 0.02, 2.3), mats.metal(0x3a3c3e, { rough: 0.6 }), 1.25, 0.01, 0);
    add(new THREE.BoxGeometry(2.5, 0.15, 2.4), wallD, 1.25, 2.78, 0);
    add(new THREE.BoxGeometry(1.8, 0.04, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 3) }), 1.25, 2.69, 0);
    add(new THREE.BoxGeometry(0.1, 2.7, 2.3), metalCab, 0.05, 1.35, 0);
    for (const s2 of [-1, 1]) add(new THREE.BoxGeometry(2.4, 2.7, 0.08), metalCab, 1.25, 1.35, s2 * 1.12);
    add(new THREE.BoxGeometry(0.06, 0.06, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2, 1) }), 0.12, 1.0, 0);
    const panel = add(new THREE.BoxGeometry(0.05, 0.5, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3, 1) }), 2.3, 1.3, 1.05);
    cab.position.set(x0 + 0.05, 0, c);
    scene.add(cab);
    // portes palières
    const doors = {};
    for (const y of [0, Y]) {
      box(0.3, 0.4, 2.4, trim, [x1, y + 2.8, c]);
      const leaves = [];
      for (const s2 of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.9), mats.metal(0x9aa0a4, { rough: 0.25 }));
        m.position.set(x1 - 0.05, y + 1.3, c + s2 * 0.45); scene.add(m); leaves.push({ m, s: s2, base: c + s2 * 0.45 });
      }
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.5, 0.3) }));
      lamp.position.set(x1 + 0.2, y + 3.15, c); scene.add(lamp);
      const door = {
        x: x1, z: c, y, w: 1.8, h: 2.6, open: 0, target: 0, leaves, lamp, shaft: null,
        box: new THREE.Box3(new THREE.Vector3(x1 - 0.15, y, c - 0.9), new THREE.Vector3(x1 + 0.15, y + 2.6, c + 0.9)),
        update(dt, actors) {
          // ne s'ouvre que si la cabine est arrêtée à ce palier
          const S = this.shaft, here = S && !S.moving && Math.abs(S.y - this.y) < 0.05;
          let near = false;
          if (here) for (const p of actors) if (Math.abs(p.x - this.x) < 2.6 && Math.abs(p.z - this.z) < 1.6 && Math.abs((p.y ?? 0) - this.y) < 2) { near = true; break; }
          this.target = here && (near || S.hold > 0) ? 1 : 0;
          this.open += Math.sign(this.target - this.open) * Math.min(Math.abs(this.target - this.open), dt * 1.8);
          const e = this.open * this.open * (3 - 2 * this.open);
          for (const l of leaves) l.m.position.z = l.base + l.s * e * 0.85;
          lamp.material.color.setRGB(here ? 0.4 : 4, here ? 4 : 1.5, 0.3);
        },
      };
      ctx.doors.push(door);
      doors[y] = door;
    }
    const S = { c, x0, x1, cab, panel, doors, y: c === CAB[0] ? 0 : Y, moving: false, hold: 0, inside: (y) => new THREE.Vector3(x0 + 1.15, y, c) };
    cab.position.y = S.y;
    doors[0].shaft = doors[Y].shaft = S;
    shafts.push(S);
  }

  // enseignes
  const sign = (text, color, size, w, p, ry) => {
    const nt = neonTexture(text, color, { size });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / nt.aspect), neonMaterial(nt.tex, 2.0));
    m.position.set(...p); m.rotation.y = ry; scene.add(m);
  };
  sign('ASCENSEURS · PONT HABITAT', '#9fd8ff', 80, 5.2, [LOBBY.x0 + 0.2, 3.5, -11], Math.PI / 2);
  sign('ASCENSEURS · GALERIE', '#9fd8ff', 80, 4.6, [LOBBY.x0 + 0.2, Y + 3.5, -11], Math.PI / 2);
  sign('COUR DES SAVEURS ▲', '#ffd27a', 80, 3.6, [-116, Y + 3.75, LOBBY.z1 - 0.2], Math.PI);
  sign('BAR LA COMÈTE', '#ffb84a', 110, 6, [HALL.x1 - 0.2, Y + 3.9, -12], -Math.PI / 2);
  sign('INFIRMERIE', '#7dff9a', 80, 3.2, [-104, Y + 3.3, HALL.z1 - 0.2], Math.PI);
  sign('CABINE 12', '#ffd27a', 70, 2.6, [-90, Y + 3.3, HALL.z1 - 0.2], Math.PI);

  // ------------------------------------------------------------------ mobilier : bar, tables, banquettes face à la baie
  const bx = HALL.x1 - 4.5;
  box(1.0, 1.1, 12, wood, [bx, Y + 0.55, -12], true);
  box(1.3, 0.08, 12.2, mats.smooth(0x2a2c2e, 0.2, 0.6), [bx, Y + 1.14, -12]);
  box(0.6, 2.4, 12, wallD, [HALL.x1 - 0.6, Y + 1.6, -12]);
  for (let z = -17; z <= -7; z += 1.4) box(0.5, 0.3, 0.06, mats.emissive([0xff8a3a, 0x7dff9a, 0x9fd8ff][Math.abs(Math.round(z)) % 3], 2), [HALL.x1 - 0.9, Y + 2.0 + (z % 2 ? 0.4 : 0), z]);
  box(0.05, 0.06, 12, warm, [bx - 0.52, Y + 1.0, -12]);
  const stools = [];
  for (let z = -16.5; z <= -7.5; z += 1.5) {
    B.cyl(0.24, 0.24, 0.08, redSeat, [bx - 1.15, Y + 0.72, z], null, { cast: false });
    B.cyl(0.05, 0.05, 0.7, trim, [bx - 1.15, Y + 0.35, z], null, { cast: false });
    stools.push(new THREE.Vector3(bx - 1.15, Y, z));
  }
  const tables = [[-100, -12], [-94, -12], [-100, -6], [-94, -6], [-106, -9]];
  const chairs = [];
  for (const [x, z] of tables) {
    B.cyl(0.6, 0.6, 0.05, mats.smooth(0x3a3e42, 0.3, 0.5), [x, Y + 0.75, z], null, { cast: false });
    B.cyl(0.07, 0.07, 0.75, trim, [x, Y + 0.37, z], null, { cast: false });
    B.colliderBox(1.2, 0.8, 1.2, [x, Y + 0.4, z]);
    for (const s of [-1, 1]) {
      box(0.5, 0.45, 0.5, seatM, [x + s * 1.0, Y + 0.22, z]);
      box(0.08, 0.5, 0.5, seatM, [x + s * 1.25, Y + 0.7, z]);
      chairs.push({ p: new THREE.Vector3(x + s * 1.0, Y, z), yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  }
  const benches = [];
  for (const x of [-108, -101, -94, -87]) {
    box(3.2, 0.45, 0.6, seatM, [x, Y + 0.22, HALL.z0 + 2.2], true);
    box(3.2, 0.5, 0.1, seatM, [x, Y + 0.7, HALL.z0 + 2.5]);
    benches.push({ p: new THREE.Vector3(x - 0.7, Y, HALL.z0 + 2.2), yaw: Math.PI }, { p: new THREE.Vector3(x + 0.7, Y, HALL.z0 + 2.2), yaw: Math.PI });
  }
  // plantes et éclairage
  for (const [x, z] of [[-111, -22.5], [-81, -22.5], [-107.6, 1.2], [-81, 0.5]]) {
    B.cyl(0.4, 0.3, 0.7, wallD, [x, Y + 0.35, z], null, { cast: false });
    B.add(new THREE.IcosahedronGeometry(0.6, 1), mats.plastic(0x3a6a2a, 0.8), new THREE.Matrix4().makeTranslation(x, Y + 1.2, z), { cast: false });
  }
  for (let x = HALL.x0 + 3; x < HALL.x1 - 2; x += 6) box(3.5, 0.05, 0.4, warm, [x, Y + HALL.h - 0.05, -12]);
  for (let x = HALL.x0 + 3; x < HALL.x1 - 2; x += 6) box(3.5, 0.05, 0.4, warm, [x, Y + HALL.h - 0.05, -3]);
  // infirmerie : lits, console
  for (const z of [4.5, 8]) {
    box(2.0, 0.5, 0.95, mats.smooth(0xe8eef0, 0.4, 0.2), [-106.5, Y + 0.45, z], true);
    box(0.5, 0.15, 0.8, mats.plastic(0xf4f6f6, 0.6), [-107.2, Y + 0.75, z]);
    box(0.1, 1.2, 0.5, trim, [-107.8, Y + 1.3, z]);
    box(0.04, 0.4, 0.4, green, [-107.74, Y + 1.6, z]);
  }
  box(1.6, 1.0, 0.6, mats.smooth(0xd8dee0, 0.3, 0.2), [-102, Y + 0.5, 9.4], true);
  box(1.2, 0.6, 0.04, cold, [-102, Y + 1.4, 9.68]);
  box(4, 0.05, 0.4, cold, [-104, Y + 3.35, 6]);
  // cabine du joueur : couchette, bureau, hublot
  box(2.0, 0.5, 0.95, mats.smooth(0x3a4048, 0.5, 0.2), [-92.6, Y + 0.25, 7.3], true);
  box(1.8, 0.15, 0.8, mats.plastic(0x5a6a7a, 0.7), [-92.6, Y + 0.55, 7.3]);
  box(1.2, 0.75, 0.6, wood, [-87, Y + 0.37, 7.4], true);
  box(0.8, 0.5, 0.04, cold, [-87, Y + 1.3, 7.9]);
  box(2.4, 0.05, 0.3, warm, [-90, Y + 2.95, 5]);

  // portes de cabines numérotées le long du mur nord (fermées, voyant libre / occupée)
  const cabinDoors = [];
  [[-107.6, '08', true], [-98.5, '10', true], [-95.5, '11', false], [-84.8, '14', true], [-82, '15', false]].forEach(([x, num, busy]) => {
    box(1.6, 2.8, 0.12, trim, [x, Y + 1.4, HALL.z1 - 0.2]);
    box(1.3, 2.6, 0.1, mats.metal(0x5a6066, { rough: 0.35 }), [x, Y + 1.3, HALL.z1 - 0.26]);
    box(0.25, 0.08, 0.04, busy ? mats.emissive(0xff4a3a, 3) : mats.emissive(0x7dff9a, 3), [x + 0.45, Y + 1.55, HALL.z1 - 0.32]);
    const nt = neonTexture(num, '#ffd27a', { size: 70 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55 / nt.aspect), neonMaterial(nt.tex, 1.8));
    m.position.set(x, Y + 3.05, HALL.z1 - 0.32); m.rotation.y = Math.PI; scene.add(m);
    cabinDoors.push({ pos: new THREE.Vector3(x, Y, HALL.z1 - 1.0), num, busy });
  });
  // lumières (allumées seulement quand le joueur est sur le pont)
  const lights = [[-104, -12, 0xffd0a0], [-88, -12, 0xffb070], [-104, 6, 0xd8f0ff]].map(([x, z, c]) => {
    const l = new THREE.PointLight(c, 0, 26, 1.6); l.position.set(x, Y + 4, z); l.visible = false; scene.add(l); return l;
  });

  return {
    shafts, lights, stools, chairs, benches, cabinDoors,
    bar: new THREE.Vector3(bx - 1.2, Y, -12), bartender: new THREE.Vector3(bx + 0.9, Y, -12),
    clinic: new THREE.Vector3(-102, Y, 8.2), doctor: new THREE.Vector3(-102.4, Y, 8.9),
    bunk: new THREE.Vector3(-92.6, Y, 6.3),
    onDeck: (p) => p.y > Y - 5 && p.y < Y + 15,
  };
}

/** Commande des ascenseurs : appel au palier, trajet de la cabine (joueur à bord), arrivée portes ouvertes. */
export class Elevators {
  constructor(shafts, player) {
    this.shafts = shafts; this.player = player;
    this.onEvent = () => {};
    this.t = 0;
  }
  get riding() { return this.shafts.find((s) => s.carry) || null; }
  isAt(S, y) { return !S.moving && Math.abs(S.y - y) < 0.05; }
  _start(S, to, carry) {
    S.from = S.y; S.to = to; S.k = 0; S.moving = true; S.carry = carry; S.closeT = 1.3; S.hold = 0;
    this.onEvent('start', S);
  }
  /**
   * Appel depuis un palier. Le joueur est prioritaire : si la cabine roule (figurants), son appel est mis en file et
   * servi dès l'arrivée (les figurants ne peuvent plus la renvoyer ailleurs entre-temps). who : 'player' | 'npc'.
   */
  call(S, y, who = 'player') {
    if (this._inside(S) && !this.isAt(S, y)) return;   // le joueur est dans la cabine : on attend qu'il en sorte
    // figurants : jamais avant l'appel du joueur, ni pendant que les portes sont ouvertes ailleurs
    if (who === 'npc' && ((S.pending !== undefined && S.pending !== y) || (S.hold > 0 && !this.isAt(S, y)))) return;
    if (S.moving) { if (who === 'player' && S.to !== y) { S.pending = y; this.onEvent('queued', S); } return; }
    if (this.isAt(S, y)) { S.hold = Math.max(S.hold, 3); if (who === 'player') S.pending = undefined; return; }
    this._start(S, y, false); if (who === 'player') S.pending = undefined; this.onEvent('called', S, false, who);
  }
  ride(S) { if (S.moving) return; const [a, b] = S.levels || [0, DECK_Y]; this._start(S, Math.abs(S.y - a) < 1 ? b : a, true); }
  /** Départ demandé par un passager non joueur (figurant) vers le niveau y. */
  send(S, y) {
    if (S.moving || this.isAt(S, y) || this._inside(S) || S.hold > 0) return;      // portes ouvertes : on laisse monter
    if (S.pending !== undefined && S.pending !== y) return;                          // appel du joueur prioritaire
    this._start(S, y, false);
  }
  /** À appeler avant la mise à jour du joueur : déplace les cabines et le joueur embarqué. */
  update(dt) {
    this.ticked = true;
    this.t += dt;
    for (const S of this.shafts) {
      S.hold -= dt;
      // appel du joueur en file : servi dès que les portes ont laissé sortir les passagers
      if (!S.moving && S.pending !== undefined) {
        if (Math.abs(S.y - S.pending) < 0.05) S.pending = undefined;
        else if (S.hold < 2 && !this._inside(S)) { const y = S.pending; S.pending = undefined; this._start(S, y, false); this.onEvent('called', S, false, 'player'); }
      }
      if (!S.moving) continue;
      if (S.closeT > 0) S.closeT -= dt;
      else {
        S.k = Math.min(1, S.k + dt / 7);
        const e = S.k * S.k * (3 - 2 * S.k);
        S.y = S.from + (S.to - S.from) * e;
        if (S.k >= 1) { S.y = S.to; S.moving = false; S.hold = 4; const was = S.carry; S.carry = false; this.onEvent('arrived', S, was); }
      }
      S.cab.position.y = S.y;
      S.panel.material.color.setRGB(this.t % 0.6 < 0.3 ? 3 : 0.6, this.t % 0.6 < 0.3 ? 2 : 0.4, 0.3);
      if (S.carry || (S.moving && this._inside(S))) {
        const P = this.player;
        P.pos.y = S.y + 0.02; P.vel.set(0, 0, 0);
        P.pos.x = THREE.MathUtils.clamp(P.pos.x, S.x0 + 0.4, S.x0 + 2.2);
        P.pos.z = THREE.MathUtils.clamp(P.pos.z, S.c - 0.8, S.c + 0.8);
      }
    }
  }
  _inside(S) { const P = this.player; return P.pos.x > S.x0 - 0.2 && P.pos.x < S.x1 - 0.1 && Math.abs(P.pos.z - S.c) < 1.1 && Math.abs(P.pos.y - S.y) < 3; }
}
