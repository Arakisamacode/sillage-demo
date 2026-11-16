import * as THREE from 'three';
import { Screen } from '../world/signage.js';

// Fret physique : caisses que l'on porte à la main (E), arrimées automatiquement sur la grille de la soute
// du Héron, posées sur le quai de fret de l'aire 02 ; conteneurs chargés par la manutention.

export const QUAI = { x: -21.5, z: 3, w: 5.4, d: 7 };          // zone de quai (monde)
const HOLD = { fy: 2.0, cols: [0.62, 1.82, 2.98], z0: 4.0, dz: 1.2, rows: 8, size: 1.1 };
const SPOTS = [];
for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) SPOTS.push([QUAI.x - 1.6 + c * 1.6, QUAI.z - 2.4 + r * 1.6]);

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

/** Décor du quai : marquage au sol, palettes, terminal de contrats et enseigne. Appelé avant builder.finalize. */
export function buildQuai(ctx) {
  const { mats, builder: B, scene } = ctx;
  const yellow = mats.paint(0xd9a21b, { plain: true, rough: 0.6, grime: 0.5 });
  const { x, z, w, d } = QUAI;
  for (const s of [-1, 1]) {
    B.box(w, 0.012, 0.12, yellow, [x, 0.006, z + s * d / 2], null, { cast: false });
    B.box(0.12, 0.012, d, yellow, [x + s * w / 2, 0.006, z], null, { cast: false });
  }
  for (let i = 0; i < 9; i++) B.box(0.1, 0.012, 0.9, yellow, [x - w / 2 + 0.4 + i * 0.6, 0.006, z - d / 2 - 0.6], [0, 0.6, 0], { cast: false });
  // terminal de contrats (borne inclinée avec écran)
  const tx = x - w / 2 - 1.3, tz = z + 2.2;
  B.box(0.7, 1.1, 0.5, mats.paint(0x3a3e42, { plain: true }), [tx, 0.55, tz], null, { collide: true });
  B.box(0.8, 0.08, 0.6, mats.metal(0x8a8e92, { rough: 0.3 }), [tx, 1.12, tz], null, { cast: false });
  B.addObstacle(tx, tz, 0.5, 0.4, 0);
  const scr = new Screen(320, 220, (c, cw, ch, t) => {
    c.fillStyle = '#071018'; c.fillRect(0, 0, cw, ch);
    c.fillStyle = '#f2a33a'; c.font = '700 26px Rajdhani, sans-serif'; c.fillText('CONTRATS DE FRET', 16, 38);
    c.fillStyle = '#7fd8ff'; c.font = '500 18px Rajdhani, sans-serif';
    const lines = ctx.missionsBoard ? ctx.missionsBoard() : ['Chargement…'];
    lines.slice(0, 6).forEach((l, i) => c.fillText(l, 16, 74 + i * 24));
    c.fillStyle = (t | 0) % 2 ? '#f2a33a' : '#4a3a20'; c.fillRect(16, ch - 22, 10, 10);
    c.fillStyle = '#8a9aa8'; c.font = '500 15px Rajdhani, sans-serif'; c.fillText('Appuyez sur E', 32, ch - 12);
  }, { period: 1, intensity: 1.5 });
  ctx.screens.push(scr);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.44), scr.material);
  m.position.set(tx + 0.02, 1.42, tz); m.rotation.set(0, Math.PI / 2, 0); m.rotateX(-0.35);
  scene.add(m);
  B.box(0.06, 0.5, 0.7, mats.paint(0x2a2e31, { plain: true }), [tx - 0.04, 1.4, tz], [0, 0, -0.35], { cast: false });
  return { terminal: new THREE.Vector3(tx + 0.9, 0, tz) };
}

export class Cargo {
  constructor(ctx, ship, flight) {
    this.ctx = ctx; this.ship = ship; this.flight = flight;
    this.crates = [];
    this.carried = null;
    this.slots = new Array(HOLD.rows * 3 * 2).fill(null);   // index = (row * 3 + col) * 2 + lvl
    this.geo = {
      body: new THREE.BoxGeometry(1.1, 1.1, 1.1),
      frame: new THREE.BoxGeometry(1.14, 0.08, 1.14),
      strap: new THREE.BoxGeometry(0.1, 1.12, 1.12),
      tag: new THREE.PlaneGeometry(0.42, 0.26),
    };
    this.trim = ctx.mats.metal(0x6a6e72, { rough: 0.45, grime: 0.4 });
    this.strapM = ctx.mats.plastic(0xc8901a, 0.7);
    this._bodyM = {};
    this.onDrop = null; // (crate) => void
  }

  _mat(color) { return this._bodyM[color] || (this._bodyM[color] = this.ctx.mats.paint(color, { plain: true, rough: 0.7, grime: 0.7 })); }

  _crateMesh(color, tagColor) {
    const g = new THREE.Group();
    const add = (geo, m, y, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; o.receiveShadow = true; if (rx) o.rotation.y = rx; g.add(o); return o; };
    add(this.geo.body, this._mat(color), 0.55);
    add(this.geo.frame, this.trim, 0.04); add(this.geo.frame, this.trim, 1.06);
    add(this.geo.strap, this.strapM, 0.55);
    const tag = new THREE.Mesh(this.geo.tag, new THREE.MeshBasicMaterial({ color: new THREE.Color(tagColor).multiplyScalar(1.6) }));
    tag.position.set(0.3, 0.75, 0.556); g.add(tag);
    const tag2 = tag.clone(); tag2.position.set(-0.3, 0.75, -0.556); tag2.rotation.y = Math.PI; g.add(tag2);
    return g;
  }

  /** Crée une caisse de contrat. where : 'ground' (sur le quai) ou 'hold' (directement en soute). */
  spawn(contract, where) {
    const c = { contract, mesh: this._crateMesh(contract.crateColor, contract.tagColor), where: null, slot: -1, spot: -1 };
    this.crates.push(c);
    if (where === 'hold') { if (!this.toHold(c)) { this.remove(c); return null; } } else if (!this.toQuai(c)) { this.remove(c); return null; }
    return c;
  }
  remove(c) {
    c.mesh.parent?.remove(c.mesh);
    if (c.slot >= 0) this.slots[c.slot] = null;
    if (this.carried === c) this.carried = null;
    c.where = 'gone'; c.carrier = null;
    this.crates = this.crates.filter((x) => x !== c);
  }

  quaiFree() { return SPOTS.filter((s, i) => !this.crates.some((c) => c.where === 'ground' && c.spot === i)).length; }
  holdFree() { return this.slots.filter((s) => !s).length; }
  inHold(contract) { return this.crates.filter((c) => c.contract === contract && c.where === 'hold').length; }
  inQuai(contract) { return this.crates.filter((c) => c.contract === contract && c.where === 'ground' && this.inQuaiZone(c.mesh.position)).length; }
  inQuaiZone(p) { return Math.abs(p.x - QUAI.x) < QUAI.w / 2 + 0.3 && Math.abs(p.z - QUAI.z) < QUAI.d / 2 + 0.3 && p.y < 0.5; }

  _detach(c) { if (c.slot >= 0) this.slots[c.slot] = null; c.slot = -1; c.spot = -1; c.carrier = null; c.mesh.parent?.remove(c.mesh); }
  freeSpot() { const i = SPOTS.findIndex((s, k) => !this.crates.some((o) => o.where === 'ground' && o.spot === k)); return i < 0 ? null : SPOTS[i]; }
  /** Caisse portée par un membre d'équipage. */
  carryBy(c, agent) { this._detach(c); c.where = 'npc'; c.carrier = agent; this.ctx.scene.add(c.mesh); }

  toQuai(c) {
    const i = SPOTS.findIndex((s, k) => !this.crates.some((o) => o !== c && o.where === 'ground' && o.spot === k));
    if (i < 0) return false;
    this._detach(c);
    c.where = 'ground'; c.spot = i;
    c.mesh.position.set(SPOTS[i][0], 0, SPOTS[i][1]); c.mesh.rotation.set(0, 0, 0);
    this.ctx.scene.add(c.mesh);
    return true;
  }
  toGround(c, pos, yaw) {
    this._detach(c);
    c.where = 'ground';
    c.mesh.position.copy(pos); c.mesh.rotation.set(0, yaw, 0);
    this.ctx.scene.add(c.mesh);
  }
  /** Arrime la caisse au premier emplacement libre de la soute (de l'avant vers la rampe, niveau bas puis haut). */
  toHold(c) {
    let idx = -1;
    for (let r = 0; r < HOLD.rows && idx < 0; r++) for (let lvl = 0; lvl < 2 && idx < 0; lvl++) for (let col = 0; col < 3; col++) {
      const i = (r * 3 + col) * 2 + lvl;
      if (!this.slots[i] && (lvl === 0 || this.slots[i - 1])) { idx = i; break; }
    }
    if (idx < 0) return false;
    this._detach(c);
    this.slots[idx] = c; c.slot = idx; c.where = 'hold';
    const r = Math.floor(idx / 6), col = Math.floor(idx / 2) % 3, lvl = idx % 2;
    c.mesh.position.set(HOLD.cols[col], HOLD.fy + lvl * HOLD.size, HOLD.z0 + r * HOLD.dz);
    c.mesh.rotation.set(0, 0, 0);
    this.ship.group.add(c.mesh);
    return true;
  }
  /** Conteneur de fret : occupe les 4 premières rangées de la grille (3 × 4 × 2 emplacements). */
  loadContainer(contract) {
    const ids = [];
    for (let r = 0; r < 4; r++) for (let col = 0; col < 3; col++) for (let lvl = 0; lvl < 2; lvl++) ids.push((r * 3 + col) * 2 + lvl);
    if (ids.some((i) => this.slots[i])) return null;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.5, 4.6), this.ctx.mats.cladding(contract.crateColor));
    body.position.y = 1.25; body.castShadow = body.receiveShadow = true; g.add(body);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 0.16), this.trim); rail.position.set(0, 0.08, s * 2.25); g.add(rail);
      const rail2 = rail.clone(); rail2.position.y = 2.42; g.add(rail2);
    }
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(contract.tagColor).multiplyScalar(1.6) }));
    tag.position.set(0, 1.6, 2.31); g.add(tag);
    g.position.set(1.82, HOLD.fy, HOLD.z0 + 1.5 * HOLD.dz);
    this.ship.group.add(g);
    const c = { contract, mesh: g, where: 'hold', slot: -1, container: true, ids };
    for (const i of ids) this.slots[i] = c;
    this.crates.push(c);
    return c;
  }
  removeContract(contract) {
    for (const c of this.crates.filter((x) => x.contract === contract)) {
      if (c.container) for (const i of c.ids) this.slots[i] = null;
      this.remove(c);
    }
  }

  /** Position du joueur dans la soute ? (repère local du vaisseau) */
  _inHold(p) {
    if (this.flight.state !== 'parked' || this.flight.dockedAt !== this.flight.home) return false;
    this.ship.group.updateWorldMatrix(true, false);
    _v.copy(p); this.ship.group.worldToLocal(_v);
    return Math.abs(_v.x) < 3.5 && _v.z > -5.8 && _v.z < 14.6 && _v.y > 1.4 && _v.y < 3.6;
  }

  /** Action proposée au joueur (ou null). */
  prompt(player) {
    const p = player.pos;
    if (this.carried) {
      const c = this.carried, name = c.contract.short;
      if (this._inHold(p)) return { label: `E — Arrimer la caisse dans la soute (${name})`, fn: () => { if (!this.toHold(c)) return 'La soute est pleine'; this.carried = null; this.onDrop && this.onDrop(c); } };
      if (this.inQuaiZone(p)) return { label: `E — Déposer la caisse sur le quai (${name})`, fn: () => { this.toGround(c, _w.set(p.x - Math.sin(player.yaw) * 0.9, 0, p.z - Math.cos(player.yaw) * 0.9).clone(), player.yaw); this.carried = null; this.onDrop && this.onDrop(c); } };
      return { label: `E — Poser la caisse (${name})`, fn: () => { this.toGround(c, _w.set(p.x - Math.sin(player.yaw) * 0.9, p.y, p.z - Math.cos(player.yaw) * 0.9).clone(), player.yaw); this.carried = null; this.onDrop && this.onDrop(c); } };
    }
    // caisse la plus proche devant le joueur (au sol ou en soute, sans rien dessus)
    let best = null, bd = 1.9;
    for (const c of this.crates) {
      if (c.container || c.where === 'gone' || c.where === 'carried' || c.where === 'npc') continue;
      if (c.where === 'hold') {
        if (this.flight.state !== 'parked' || this.flight.dockedAt !== this.flight.home) continue;
        if (c.slot % 2 === 0 && this.slots[c.slot + 1]) continue;
      }
      c.mesh.getWorldPosition(_w);
      if (Math.abs(_w.y + 0.55 - (p.y + 1.0)) > 1.6) continue;
      const d = Math.hypot(_w.x - p.x, _w.z - p.z);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return null;
    return { label: `E — Prendre la caisse (${best.contract.short})`, fn: () => this.pick(best) };
  }

  pick(c) {
    this._detach(c);
    c.where = 'carried';
    this.carried = c;
    this.ctx.scene.add(c.mesh);
  }

  /** Suit le joueur (caisse portée devant lui, à hauteur de taille). */
  update(player) {
    for (const k of this.crates) {
      if (k.where !== 'npc' || !k.carrier) continue;
      const a = k.carrier;
      k.mesh.position.set(a.pos.x + Math.sin(a.yaw) * 0.62, a.pos.y + 0.38, a.pos.z + Math.cos(a.yaw) * 0.62);
      k.mesh.rotation.set(0, a.yaw, 0);
    }
    const c = this.carried;
    if (!c) return;
    c.mesh.position.set(player.pos.x - Math.sin(player.yaw) * 0.75, player.pos.y + 0.35, player.pos.z - Math.cos(player.yaw) * 0.75);
    c.mesh.rotation.set(0, player.yaw, 0);
  }

  /** Obstacles pour le joueur : caisses au sol et en soute (vaisseau posé à l'aire 02). */
  blockers() {
    const out = [];
    const home = this.flight.state === 'parked' && this.flight.dockedAt === this.flight.home;
    for (const c of this.crates) {
      if (c.where === 'ground' || (c.where === 'hold' && home && !c.container)) {
        c.mesh.getWorldPosition(_w);
        if (!c._box) c._box = { open: 0, box: new THREE.Box3() };
        c._box.box.min.set(_w.x - 0.55, _w.y, _w.z - 0.55); c._box.box.max.set(_w.x + 0.55, _w.y + 1.1, _w.z + 0.55);
        out.push(c._box);
      } else if (c.container && home) {
        c.mesh.getWorldPosition(_w);
        if (!c._box) c._box = { open: 0, box: new THREE.Box3() };
        c._box.box.min.set(_w.x - 1.7, _w.y, _w.z - 2.3); c._box.box.max.set(_w.x + 1.7, _w.y + 2.5, _w.z + 2.3);
        out.push(c._box);
      }
    }
    return out;
  }
}
