import * as THREE from 'three';
import { ITEM } from './catalog.js';
import { COVER, DECK } from '../world/outposts.js';
import { BOARD_COVER, BAY } from '../world/derelict.js';
import { STATION_ARENA, STATION_COVER } from '../world/baycover.js';
import { BODIES, HAIRS } from '../characters/characters.js';

// Combat à pied sur les avant-postes : raids pirates (aléatoires ou contrats de sécurité), débarquement armé
// par la rampe du Héron, armes personnelles (tir à la visée, rechargement, changement d'arme), gardes de
// l'équipage qui descendent et combattent, couverture derrière les caisses du pont, blessures et évacuation.

const HP = 100;
const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _ray = new THREE.Ray();
const ENEMY_GUNS = ['ac7', 'ac7', 'sm3', 'ks9', 'br2', 'sm3'];
const PIRATE_NAMES = ['Grêlé', 'Vasque', 'Rouille', 'Sarde', 'Coutre', 'Mâchefer', 'Ébarbeur', 'Cendre'];

let GM = null;
function gunMats() {
  if (GM) return GM;
  GM = {
    body: new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.45, metalness: 0.7 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.8, metalness: 0.2 }),
    flash: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  return GM;
}

/** Maquette d'arme tenue en main (canon vers +Z, poignée à l'origine). */
export function weaponMesh(shape, accent = 0x8a7a3a) {
  const M = gunMats(), g = new THREE.Group();
  const acc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.4 });
  const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  const barrel = (r, len, z, y = 0.03) => { const c = new THREE.CylinderGeometry(r, r, len, 8); c.rotateX(Math.PI / 2); return add(c, M.body, 0, y, z); };
  let L;
  if (shape === 'pistol' || shape === 'revolver') {
    add(new THREE.BoxGeometry(0.035, 0.1, 0.045), M.grip, 0, -0.03, -0.01, -0.25);
    add(new THREE.BoxGeometry(0.038, 0.048, shape === 'revolver' ? 0.2 : 0.17), M.body, 0, 0.035, 0.06);
    add(new THREE.BoxGeometry(0.04, 0.012, 0.06), acc, 0, 0.062, 0.03);
    if (shape === 'revolver') { const c = new THREE.CylinderGeometry(0.026, 0.026, 0.05, 10); c.rotateX(Math.PI / 2); add(c, M.grip, 0, 0.03, 0.04); }
    L = shape === 'revolver' ? 0.17 : 0.15;
  } else {
    L = { rifle: 0.62, smg: 0.38, sniper: 0.86, shotgun: 0.6 }[shape] ?? 0.6;
    add(new THREE.BoxGeometry(0.035, 0.1, 0.045), M.grip, 0, -0.03, 0, -0.3);
    add(new THREE.BoxGeometry(0.055, 0.085, L * 0.55), M.body, 0, 0.03, L * 0.18);
    add(new THREE.BoxGeometry(0.058, 0.015, L * 0.3), acc, 0, 0.078, L * 0.12);
    add(new THREE.BoxGeometry(0.04, 0.11, 0.05), M.grip, 0, -0.04, L * 0.2 + 0.05, 0.2);
    barrel(shape === 'shotgun' ? 0.022 : 0.013, L * 0.45, L * 0.6);
    add(new THREE.BoxGeometry(0.045, 0.075, L * 0.3), M.grip, 0, 0.0, -L * 0.18);
    if (shape === 'sniper') barrel(0.022, 0.24, L * 0.2, 0.1);
  }
  const fl = add(new THREE.SphereGeometry(0.06, 8, 6), M.flash, 0, 0.03, L * 0.85 + 0.05);
  fl.scale.set(1, 1, 2.2); fl.visible = false; fl.castShadow = false;
  g.userData.muzzle = fl;
  g.userData.len = L;
  return g;
}

function hitRayCapsule(ray, base, h, r) {
  // distance minimale rayon / segment vertical [base, base+h]
  const top = _v2.copy(base); top.y += h;
  const P = new THREE.Vector3(), Q = new THREE.Vector3();
  const d2 = ray.distanceSqToSegment(base, top, P, Q);
  if (d2 > r * r) return null;
  return { t: P.distanceTo(ray.origin), y: Q.y - base.y };
}

export class Ground {
  constructor(ctx, { game, flight, crew, player, missions }) {
    Object.assign(this, { ctx, game, flight, crew, player, missions });
    this.onFoot = false;
    this.raid = null;
    this.units = [];
    this.hp = HP;
    this.drawn = false;
    this.slot = null;
    this.ammo = {};
    this.cd = 0; this.reloadT = 0;
    this.lastRaid = {};
    this.onEvent = () => {};
    this.t = 0;
    this._fx();
    const $ = (id) => document.getElementById(id);
    this.el = { hud: $('foot'), raid: $('raidbox'), cross: $('crosshair'), dmg: $('dmgfx'), marks: $('gmarks') };
    this.markEls = [];
  }

  get audio() { return this.ctx.audio; }
  /** Le joueur peut combattre : à pied sur un avant-poste / un cargo, ou dans la station pendant une alerte. */
  get armed() { return this.onFoot || !!this.raid?.station; }
  get me() { return this.game.person('me'); }
  get prot() { const a = this.me.armor && ITEM[this.me.armor]; return a ? a.prot : 0; }
  weaponId(slot = this.slot) { return slot && this.me[slot]; }
  get gun() { const id = this.weaponId(); return id ? ITEM[id] : null; }
  enemiesLeft() { return this.units.filter((u) => u.side === 'enemy' && !u.down).length; }

  // ------------------------------------------------------------------ effets : traçantes, impacts
  _fx() {
    const S = this.ctx.scene;
    this.tracers = [];
    const g = new THREE.BoxGeometry(1, 1, 1);
    const mats = { f: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      e: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.2, 0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }) };
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(g, mats.f); m.visible = false; m.frustumCulled = false; S.add(m); this.tracers.push({ m, t: 1 }); }
    this.tracerMats = mats;
    this.puffs = [];
    const sg = new THREE.SphereGeometry(1, 8, 6);
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; S.add(m); this.puffs.push({ m, t: 1 }); }
    this.flashLight = new THREE.PointLight(0xffb060, 0, 9, 2); S.add(this.flashLight);
  }
  _tracer(a, b, enemy) {
    const T = this.tracers.find((x) => x.t >= 1) || this.tracers[0];
    T.t = 0; T.a = a.clone(); T.b = b.clone();
    T.m.material = enemy ? this.tracerMats.e : this.tracerMats.f;
    T.m.visible = true;
  }
  _puff(p, s = 0.08, color) {
    const P = this.puffs.find((x) => x.t >= 1) || this.puffs[0];
    P.t = 0; P.s = s; P.m.position.copy(p); P.m.visible = true;
    P.m.material.color.copy(color || new THREE.Color(3, 2.4, 1.6));
  }
  _updateFx(dt) {
    for (const T of this.tracers) {
      if (T.t >= 1) continue;
      T.t += dt / 0.07;
      // segment court qui file de a vers b
      const k0 = Math.min(1, T.t * 1.6), k1 = Math.max(0, k0 - 0.35);
      const p0 = _v.lerpVectors(T.a, T.b, k1), p1 = _v2.lerpVectors(T.a, T.b, k0);
      T.m.position.lerpVectors(p0, p1, 0.5);
      T.m.lookAt(p1);
      T.m.scale.set(0.025, 0.025, Math.max(0.05, p0.distanceTo(p1)));
      if (T.t >= 1) T.m.visible = false;
    }
    for (const P of this.puffs) {
      if (P.t >= 1) continue;
      P.t += dt / 0.18;
      P.m.scale.setScalar(P.s * (0.6 + P.t));
      P.m.material.opacity = 1 - P.t;
      if (P.t >= 1) P.m.visible = false;
    }
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 400);
  }

  // ------------------------------------------------------------------ repère de l'avant-poste
  _makeArena(o, origin, rot, cover, opts) {
    const inv = rot.clone().invert();
    const A = {
      o, origin, rot, inv, cover, ...opts,
      W: (x, z, y = 0) => new THREE.Vector3(x, y, z).applyQuaternion(rot).add(origin),
      L: (p) => { const l = _v.copy(p).sub(origin).applyQuaternion(inv); return { x: l.x, z: l.z }; },
    };
    // points de couverture : quatre côtés de chaque caisse
    A.coverPts = [];
    for (const [x, z, w, d, h] of cover) {
      for (const [nx, nz, off] of [[1, 0, w / 2], [-1, 0, w / 2], [0, 1, d / 2], [0, -1, d / 2]]) {
        const p = { x: x + nx * (off + 0.55), z: z + nz * (off + 0.55), nx, nz, low: h < 2, cx: x, cz: z };
        if (A.walk(p)) A.coverPts.push(p);
      }
    }
    return A;
  }
  /** Avant-poste : aire circulaire + pont de débarquement vers la tour. */
  _arena(outpost) {
    return this._makeArena(outpost, outpost.origin, outpost.rot, COVER, {
      kind: 'outpost', door: { x: 45, z: 0 }, enemyMin: 27, friendMax: 34,
      walk: (l) => (l.x >= DECK.x0 && l.x <= DECK.x1 - 0.6 && Math.abs(l.z) <= DECK.z - 0.5) || Math.hypot(l.x, l.z) <= DECK.padR - 0.4,
      clampOut: (l) => { if (l.x > DECK.x0) { l.x = THREE.MathUtils.clamp(l.x, DECK.x0, DECK.x1 - 0.6); l.z = THREE.MathUtils.clamp(l.z, -DECK.z + 0.5, DECK.z - 0.5); } else { const r = Math.hypot(l.x, l.z), k = (DECK.padR - 0.4) / r; l.x *= k; l.z *= k; } },
    });
  }
  /** Soute du cargo pirate abordé. */
  _arenaBoard() {
    const D = this.ctx.derelict;
    return this._makeArena({ id: 'derelict', name: 'cargo Rançonneur' }, D.origin, D.rot, BOARD_COVER, {
      kind: 'board', door: D.door, start: D.start, enemyMin: 15, friendMax: 12,
      walk: (l) => l.x >= BAY.x0 && l.x <= BAY.x1 && Math.abs(l.z) <= BAY.z,
      clampOut: (l) => { l.x = THREE.MathUtils.clamp(l.x, BAY.x0, BAY.x1); l.z = THREE.MathUtils.clamp(l.z, -BAY.z, BAY.z); },
    });
  }
  /** Hangar 07 : bande dégagée devant la baie. */
  _arenaStation() {
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, STATION_ARENA.yaw, 0));
    return this._makeArena({ id: 'halden', name: 'Hangar 07' }, STATION_ARENA.origin, rot, STATION_COVER, {
      kind: 'station', door: { x: 19.2, z: 0 }, enemyMin: 13.5, friendMax: 12.5,
      walk: (l) => l.x >= 6 && l.x <= 19.4 && Math.abs(l.z) <= 28,
      clampOut: (l) => { l.x = THREE.MathUtils.clamp(l.x, 6, 19.4); l.z = THREE.MathUtils.clamp(l.z, -28, 28); },
    });
  }
  /** Alerte d'intrusion dans le hangar : pirates par la baie, sécurité de la station, civils à l'abri. */
  startStationAlert() {
    if (this.raid || this.flight.state !== 'parked' || this.flight.away) return false;
    const A = this._arenaStation();
    this.raid = { A, o: A.o, contract: null, n: 4 + Math.floor(Math.random() * 2), spawned: 0, spawnT: 4, kills: 0, bounty: 0, done: false, station: true };
    // agents de sécurité de la station
    for (let i = 0; i < 3; i++) {
      const ch = this.ctx.lib.create(i === 1 ? 'UF_light' : i ? 'UM_light' : 'UM_dark', { height: i === 1 ? 1.72 : 1.82, hair: i === 1 ? 'Hair_Buns' : 'Hair_Buzzed' });
      ch.setOutfit({ top: 0x1b222c, bottom: 0x1b222c, boot: 0x101216, accent: 0x6f86a8, gloves: true, hivis: true });
      ch.setArmor({ tier: 2, plate: 0x2a3138, under: 0x16191c, accent: 0x3e5a7a, light: 0x6fb8ff });
      const gid = i === 2 ? 'sm3' : 'ac7';
      const mesh = weaponMesh(ITEM[gid].shape, 0x3e5a7a);
      ch.hold(mesh, ITEM[gid].cat);
      this.ctx.scene.add(ch.root);
      const u = this._unit('friend', ch, A.W(3, -18 + i * 4, 0), 0, gid, mesh);
      u.name = ['Sgt Morel', 'Agente Brun', 'Agent Kader'][i]; u.prot = 0.4; u.skill = 0.55; u.station = true;
    }
    // gardes de l'équipage qui accompagnent le joueur dans la station
    for (const m of this.crew.members) {
      if (m.aboard || m.data.role !== 'guard') continue;
      const p = this.game.person(m.data.id), gid = p.primary || p.sidearm || 'ks9';
      const ch = this.crew._char(m.data);
      this.ctx.dressPerson(ch, p);
      const mesh = weaponMesh(ITEM[gid].shape, ITEM[gid].accent);
      ch.hold(mesh, ITEM[gid].cat);
      const u = this._unit('friend', ch, m.agent.pos.clone(), m.agent.yaw, gid, mesh);
      u.name = m.data.name.split(' ')[0]; u.member = m; u.prot = p.armor ? ITEM[p.armor].prot : 0; u.skill = 0.5 + m.data.skill * 0.05;
      m.agent.char.root.visible = false; m.inCombat = true;
    }
    this._panic(true);
    this.onEvent('alert', this.raid.n);
    return true;
  }
  /** Les civils du hangar s'accroupissent à l'abri pendant l'alerte. */
  _panic(on) {
    for (const a of this.ctx.crowd.agents) {
      if (a.attached || a.data?.member || a.pos.x < -33 || a.pos.y > 2) continue;
      if (on) {
        if (a.task?.type === 'sit') continue;
        const t = { type: 'act', anim: 'crouch', dur: 999, t: 0, abort: () => !this.raid?.station };
        a.task = t; a._start(t);
      }
    }
  }
  /** Repousse un point local hors des caisses et dans la zone praticable. */
  _clampLocal(l, A = this.raid?.A || this.A) {
    for (const [x, z, w, d] of A.cover) {
      const hx = w / 2 + 0.35, hz = d / 2 + 0.35;
      const dx = l.x - x, dz = l.z - z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        if (hx - Math.abs(dx) < hz - Math.abs(dz)) l.x = x + Math.sign(dx || 1) * hx; else l.z = z + Math.sign(dz || 1) * hz;
      }
    }
    if (!A.walk(l)) A.clampOut(l);
    return l;
  }

  // ------------------------------------------------------------------ raids
  /** Atterrissage sur un avant-poste : raid si un contrat de sécurité l'exige, sinon au hasard. */
  onLanded(pad) {
    const o = pad && pad.outpost && this.ctx.outposts.find((x) => x.id === pad.outpost.id);
    if (!o) return;
    const contract = this.missions.raidFor(o.id);
    const recent = this.t - (this.lastRaid[o.id] ?? -999) < 300;
    if (contract || (!recent && Math.random() < (this.forceRaid ? 1 : 0.3))) this.startRaid(o, contract);
  }
  startRaid(o, contract) {
    this.endRaid(true);
    const A = this._arena(o);
    const n = contract ? 5 : 3 + Math.floor(Math.random() * 2);
    this.raid = { A, o, contract, n, spawned: 0, spawnT: 0, kills: 0, bounty: 0, done: false };
    if (contract) contract.step = 'fight';
    this.lastRaid[o.id] = this.t;
    this.onEvent('raid', o, n, !!contract);
  }
  /** Abordage d'un cargo pirate désemparé : combat dans sa soute. */
  startBoarding(freighter) {
    this.endRaid(true);
    const A = this._arenaBoard();
    this.raid = { A, o: A.o, contract: null, n: 4 + Math.floor(Math.random() * 2), spawned: 0, spawnT: 2.5, kills: 0, bounty: 0, done: false, boarding: true, freighter };
    for (const l of this.ctx.derelict.lights) l.visible = true;
    this.onEvent('boarding', this.raid.n);
  }
  _spawnEnemy() {
    const R = this.raid, A = R.A;
    const female = Math.random() < 0.35;
    const body = BODIES.filter((b) => b.startsWith(female ? 'UF' : 'UM'))[Math.floor(Math.random() * 2)];
    const hairs = HAIRS[female ? 'F' : 'M'];
    const ch = this.ctx.lib.create(body, { height: female ? 1.68 : 1.8 + Math.random() * 0.06, hair: hairs[Math.floor(Math.random() * hairs.length)], hairColor: [0x1a120c, 0x3a2414, 0x6a5040][Math.floor(Math.random() * 3)] });
    ch.setOutfit({ top: [0x2c2522, 0x3a2e24, 0x262a24][R.spawned % 3], bottom: 0x1e1c1a, boot: 0x120f0d, accent: 0xa0301c, gloves: true, belt: true, zip: true });
    ch.setArmor({ tier: Math.random() < 0.4 ? 2 : 1, plate: [0x4a2a20, 0x3a3430, 0x5a4a2a][R.spawned % 3], under: 0x141210, accent: 0x8a2a1a, light: 0xff4a2a });
    const gid = ENEMY_GUNS[Math.floor(Math.random() * ENEMY_GUNS.length)], it = ITEM[gid];
    const mesh = weaponMesh(it.shape, 0x7a2a1a);
    ch.hold(mesh, it.cat);
    this.ctx.scene.add(ch.root);
    const z = (R.spawned % 3 - 1) * 1.8;
    const u = this._unit('enemy', ch, A.W(A.door.x, A.door.z + z), Math.PI * 1.5, gid, mesh);
    u.name = PIRATE_NAMES[(R.spawned + Math.floor(this.t)) % PIRATE_NAMES.length];
    u.hp = u.maxHp = 120; u.prot = ch._armor.length ? 0.25 : 0.1;
    u.skill = 0.34 + Math.random() * 0.1;
    R.spawned++;
  }
  _unit(side, ch, pos, yaw, gid, mesh) {
    const it = ITEM[gid];
    const u = { side, ch, pos: pos.clone(), yaw, gid, gun: it.fire, mesh, ammo: it.fire.mag, cd: Math.random(), burst: 0, pause: 0, reloadT: 0,
      hp: HP, maxHp: HP, prot: 0, down: false, goal: null, holdT: 0, t: 0, los: new Map(), losT: 0, target: null, crouch: false, speed: 0 };
    ch.root.position.copy(u.pos); ch.root.rotation.y = yaw;
    ch.upper('aimU');
    this.units.push(u);
    return u;
  }
  /** Fin du raid : nettoyage (départ du vaisseau, joueur à terre) ou victoire. */
  endRaid(silent) {
    for (const u of this.units) { this.ctx.scene.remove(u.ch.root); if (u.member) { u.member.ashore = false; if (u.member.inCombat) { u.member.inCombat = false; u.member.agent.char.root.visible = true; } } }
    const wasStation = this.raid?.station;
    if (wasStation && !this.onFoot) { this.raid = null; this.draw(false); }
    if (this.raid?.boarding) for (const l of this.ctx.derelict.lights) l.visible = false;
    this._clearLoot();
    this.units = [];
    if (this.raid?.contract && this.raid.contract.step === 'fight' && !this.raid.done) this.raid.contract.step = 'go';
    this.raid = null;
    if (!silent) this.onEvent('raidEnd');
  }
  _cleared() {
    const R = this.raid;
    R.done = true;
    let msg;
    if (R.station) {
      const b = 2000; this.game.earn(b);
      msg = `prime de la sécurité de Halden · +${fmt(b)} ¤`;
      setTimeout(() => { if (this.raid === R) this.endRaid(true); this.onEvent('alertEnd'); }, 12000);
    } else if (R.boarding) {
      // cargaison de contrebande : deux caisses près de la porte des pirates
      for (const z of [-1.4, 1.4]) this._spawnLoot(R.A, R.A.door.x - 2.5, z, Math.round((1400 + Math.random() * 1600) / 50) * 50, true, null, true);
      msg = 'cargaison de contrebande à saisir près de la porte du fond';
    } else if (R.contract) { this.missions.raidCleared(R.o.id); msg = `contrat rempli · +${fmt(R.contract.reward)} ¤`; }
    else { const b = 1500; this.game.earn(b); msg = `prime de l'avant-poste · +${fmt(b)} ¤`; }
    for (const u of this.units) if (u.side === 'friend' && u.down) this._revive(u);
    this.onEvent('cleared', R.o, R.bounty, msg);
  }

  // ------------------------------------------------------------------ débarquement / rembarquement
  rampFoot() {
    const I = this.ctx.ships.heron.interior;
    const p = I.rampBottom.clone().applyMatrix4(this.ctx.ships.heron.root.matrix);
    return p;
  }
  canDisembark() { const d = this.flight.dockedAt; return this.flight.away && !!(d.outpost || d.boarding); }
  disembark() {
    if (!this.canDisembark()) return false;
    const dock = this.flight.dockedAt;
    if (dock.boarding) this.A = this.raid?.A || this._arenaBoard();
    else this.A = this.raid?.A || this._arena(this.ctx.outposts.find((x) => x.id === dock.outpost.id));
    const P = this.player, A = this.A;
    let l;
    if (dock.boarding) l = { ...A.start };
    else { l = this._clampLocal(A.L(this.rampFoot()), A); l.x += 1.2; }
    P.seated = null;
    P.pos.copy(A.W(l.x, l.z, 0.05));
    P.vel.set(0, 0, 0);
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(A.rot);
    P.yaw = Math.atan2(-fwd.x, -fwd.z); P.pitch = 0;
    P.fallY = A.origin.y - 25; P.resetPos = P.pos.clone();
    if (P.avatar) { P.avatar.stop(0.2); P.avatar.root.visible = true; }
    P.thirdPerson = true;
    this.onFoot = true;
    this.hp = Math.max(this.hp, 1);
    this.boardPos = A.W(l.x - 0.8, l.z, 0);
    P.obbs = null;
    if (!dock.boarding) {
    // la coque du Héron bloque le passage (fuselage et ailes, repère de l'aire du vaisseau)
    const S = this.ctx.ships.heron;
    S.root.updateMatrixWorld(true);
    const gm = S.group.matrixWorld;
    const obb = (hx, hz, cx, cz) => { const mat = gm.clone().multiply(new THREE.Matrix4().makeTranslation(cx, 0, cz)); return { mat, inv: mat.clone().invert(), hx, hz, y0: A.origin.y - 1, y1: A.origin.y + 6 }; };
    P.obbs = [obb(4.8, 17.5, 0, -1.5), obb(11, 4.6, 0, 2.0)];
    }
    if (this.raid) this.draw(true);
    // gardes armés : descendent avec le joueur
    let i = 0;
    for (const m of this.crew.members) {
      if (!m.aboard || m.data.role !== 'guard') continue;
      const p = this.game.person(m.data.id);
      const gid = p.primary || p.sidearm || 'ks9';
      const ch = this.crew._char(m.data);
      this.ctx.dressPerson(ch, p);
      const mesh = weaponMesh(ITEM[gid].shape, ITEM[gid].accent);
      ch.hold(mesh, ITEM[gid].cat);
      const u = this._unit('friend', ch, A.W(l.x + 0.5, l.z + (i % 2 ? 1.6 : -1.6) * (1 + Math.floor(i / 2)), 0), P.yaw + Math.PI, gid, mesh);
      u.name = m.data.name.split(' ')[0]; u.member = m; m.ashore = true;
      u.prot = p.armor ? ITEM[p.armor].prot : 0;
      u.skill = 0.5 + m.data.skill * 0.05;
      i++;
    }
    this.onEvent(dock.boarding ? 'boarded' : 'disembark', i);
    return true;
  }
  nearBoard() { return this.onFoot && this.boardPos && this.player.pos.distanceTo(this.boardPos) < 3.2; }
  reboard() {
    const P = this.player;
    this.draw(false);
    this.onFoot = false;
    for (const u of this.units.filter((x) => x.side === 'friend')) { this.ctx.scene.remove(u.ch.root); if (u.member) u.member.ashore = false; }
    this.units = this.units.filter((x) => x.side !== 'friend');
    P.fallY = undefined; P.resetPos = null; P.obbs = null;
    P.sit(this.ctx.seat);
    if (P.avatar) P.avatar.root.visible = false;
    this.onEvent('reboard');
  }
  onTakeoff() { if (this.raid) { const left = !this.raid.done; this.endRaid(true); if (left) this.onEvent('fled'); } }

  // ------------------------------------------------------------------ armes du joueur
  draw(on) {
    const P = this.player, av = P.avatar;
    if (on && !this.armed) { this.onEvent('noguns'); return; }
    if (on) {
      if (!this.slot || !this.weaponId()) this.slot = this.me.primary ? 'primary' : this.me.sidearm ? 'sidearm' : null;
      if (!this.slot) { this.onEvent('nogun'); return; }
      const it = this.gun;
      if (this.ammo[it.id] === undefined) this.ammo[it.id] = it.fire.mag;
      this.mesh = weaponMesh(it.shape, it.accent);
      av?.hold(this.mesh, it.cat);
      av?.upper('aimU');
      this.drawn = true;
    } else {
      av?.hold(null); av?.upper(null);
      this.drawn = false; this.reloadT = 0;
    }
    P.aiming = this.drawn;
  }
  switchWeapon() {
    const other = this.slot === 'primary' ? 'sidearm' : 'primary';
    if (!this.me[other]) return this.onEvent('noother');
    this.slot = other; this.draw(true);
    this.onEvent('switch', this.gun);
  }
  reload() {
    const it = this.gun;
    if (!it || this.reloadT > 0 || this.ammo[it.id] >= it.fire.mag) return;
    this.reloadT = it.fire.reload;
    this.player.avatar?.upper('reloadU', { speed: 1.6 / it.fire.reload * 1.2, then: 'aimU' });
    this.audio?.blip?.();
  }
  heal() {
    if (this.hp >= HP) return this.onEvent('fullhp');
    if (!this.game.use('medpen')) return this.onEvent('nomed');
    this.hp = Math.min(HP, this.hp + 55);
    this.onEvent('healed');
  }
  /** Entrées à pied (appelé par la boucle principale avant la consommation des touches). */
  footInput(dt, input) {
    if (input.consume('draw')) {
      if (!this.armed) this.onEvent('noguns');
      else this.draw(!this.drawn);
    }
    if (!this.armed) return;
    if (input.consume('hud')) this.heal();
    if (!this.drawn || this.dead) return;
    if (input.consume('missile')) this.reload();
    if (input.consume('target')) this.switchWeapon();
    const it = this.gun;
    if (!it) return;
    const F = it.fire;
    this.cd -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.ammo[it.id] = F.mag; this.reloadT = 0; }
      this._wasFiring = input.firing;
      return;
    }
    const pull = input.firing && (F.auto || !this._wasFiring);
    this._wasFiring = input.firing;
    if (!pull || this.cd > 0) return;
    if (this.ammo[it.id] <= 0) { this.reload(); return; }
    this.cd = 1 / F.rate;
    this.ammo[it.id]--;
    this._playerShot(it);
    if (this.ammo[it.id] <= 0) this.reload();
  }
  _playerShot(it) {
    const F = it.fire, cam = this.ctx.camera;
    const origin = cam.position.clone(), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const muzzle = this.mesh?.userData.muzzle;
    const mpos = muzzle ? muzzle.getWorldPosition(new THREE.Vector3()) : origin.clone().addScaledVector(fwd, 0.5);
    if (muzzle) { muzzle.visible = true; muzzle.rotation.z = Math.random() * 6; setTimeout(() => { muzzle.visible = false; }, 45); }
    this.flashLight.position.copy(mpos); this.flashLight.intensity = 40;
    this.player.avatar?.upper('shootU', { restart: true, then: 'aimU', speed: Math.max(1, F.rate / 2) });
    this.audio?.zap?.('ballistic', it.cat === 'sidearm' ? 0.28 : 0.38);
    const moving = this.player.speed > 2 ? 2.2 : this.player.speed > 0.5 ? 1.4 : 1;
    let hitAny = false;
    for (let k = 0; k < (F.pellets || 1); k++) {
      const dir = fwd.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(F.spread * 2 * moving)).normalize();
      _ray.set(origin, dir);
      const wh = this.player.bvh.raycastFirst(_ray, THREE.DoubleSide);
      let best = wh ? wh.distance : F.range * 3, who = null, hy = 0;
      for (const u of this.units) {
        if (u.side !== 'enemy' || u.down) continue;
        const h = hitRayCapsule(_ray, u.pos, u.crouch ? 1.15 : 1.75, 0.3);
        if (h && h.t < best) { best = h.t; who = u; hy = h.y; }
      }
      const end = origin.clone().addScaledVector(dir, Math.min(best, F.range * 3));
      if (k === 0 || F.pellets) this._tracer(mpos, end, false);
      if (who) {
        const head = hy > (who.crouch ? 0.95 : 1.48);
        const fall = best > F.range ? 0.5 : 1;
        this._damage(who, F.dmg * (head ? 2 : 1) * fall, 'player');
        this._puff(end, 0.07, new THREE.Color(4, 0.8, 0.5));
        hitAny = true;
        if (head && !k) this._head = true;
      } else if (wh) this._puff(end, 0.06);
    }
    if (hitAny) { this.el.cross?.classList.add('hit'); clearTimeout(this._hm); this._hm = setTimeout(() => this.el.cross?.classList.remove('hit'), 120); }
  }

  // ------------------------------------------------------------------ dégâts
  _damage(u, dmg, from) {
    if (u === 'player') {
      if (this.dead || !this.armed) return;
      this.hp -= dmg * (1 - this.prot);
      this.dmgFlash = 1; this._lastHurt = this.t;
      this.audio?.hit?.(false);
      if (this.hp <= 0) this._playerDown();
      return;
    }
    if (u.down) return;
    u.hp -= dmg * (1 - u.prot);
    u.lastHit = this.t;
    if (u.hp <= 0) {
      u.down = true; u.hp = 0;
      u.ch.upper(null); u.ch.setSpeed(0);
      u.ch.play('death', { fade: 0.15 });
      if (u.side === 'enemy') {
        const b = Math.round((420 + Math.random() * 300) / 10) * 10;
        this.game.earn(b);
        this.raid.kills++; this.raid.bounty += b;
        if (Math.random() < 0.65) this._dropLoot(u);
        this.onEvent('kill', u, b, from, this.enemiesLeft());
      } else this.onEvent('guardDown', u);
    } else if (!u.crouch && Math.random() < 0.3 && !u.ch.override) {
      u.ch.play('hit', { fade: 0.08, onDone: () => { if (!u.down) u.ch.stop(0.2); } });
    }
  }
  /** Sacoche de butin au pied d'un pirate neutralisé : ramassée en passant dessus. */
  _dropLoot(u) {
    const l = this.raid.A.L(u.pos);
    const r = Math.random();
    this._spawnLoot(this.raid.A, l.x + (Math.random() - 0.5) * 0.8, l.z + (Math.random() - 0.5) * 0.8, Math.round((60 + Math.random() * 180) / 10) * 10, r < 0.35, r > 0.85 ? u.gid : null, false);
  }
  _spawnLoot(A, x, z, credits, med, gun, big) {
    const g = new THREE.Group();
    const k = big ? 2.4 : 1;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5 * k, 0.26 * k * (big ? 1.6 : 1), 0.34 * k), new THREE.MeshStandardMaterial({ color: big ? 0x2a3a2a : 0x3a3428, roughness: 0.85 }));
    bag.position.y = bag.geometry.parameters.height / 2; bag.castShadow = true; g.add(bag);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.52 * k, 0.04 * k, 0.08 * k), new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.6 }));
    strap.position.y = bag.geometry.parameters.height + 0.02; g.add(strap);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06 * k, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 0.6) }));
    glow.position.set(0.18 * k, bag.geometry.parameters.height + 0.05, 0); g.add(glow);
    const l = this._clampLocal({ x, z }, A);
    g.position.copy(A.W(l.x, l.z, 0.01));
    g.rotation.y = Math.random() * 6;
    this.ctx.scene.add(g);
    (this.loot || (this.loot = [])).push({ g, glow, pos: g.position.clone(), credits, med, gun, big, r: big ? 2.0 : 1.3 });
  }
  _updateLoot() {
    if (!this.loot?.length) return;
    for (const L of this.loot) {
      L.glow.visible = (this.t * 2) % 1 < 0.5;
      if (this.armed && !this.dead && this.player.pos.distanceTo(L.pos) < L.r) {
        L.done = true;
        this.ctx.scene.remove(L.g);
        this.game.earn(L.credits);
        const got = [L.big ? `contrebande revendue ${fmt(L.credits)} ¤` : `${fmt(L.credits)} ¤`];
        if (L.med) { this.game.d.owned.medpen = (this.game.d.owned.medpen || 0) + 1; got.push('stylo médical'); }
        if (L.gun) { this.game.d.owned[L.gun] = (this.game.d.owned[L.gun] || 0) + 1; got.push(ITEM[L.gun].name.split('«')[0].trim()); }
        this.game.save();
        this.audio?.blip?.();
        this.onEvent('loot', got.join(' · '));
      }
    }
    this.loot = this.loot.filter((L) => !L.done);
  }
  _clearLoot() { for (const L of this.loot || []) this.ctx.scene.remove(L.g); this.loot = []; }

  _revive(u) { u.down = false; u.hp = 60; u.ch.stop(0.3); u.ch.upper('aimU'); }
  _playerDown() {
    this.dead = true; this.deadT = 0;
    this.draw(false);
    this.player.avatar?.play('death', { fade: 0.15 });
    this.onEvent('down');
  }
  _evac() {
    const fee = Math.min(this.game.credits, 1200);
    this.game.pay(fee);
    this.dead = false; this.hp = HP;
    this.player.avatar?.stop(0.1);
    if (this.raid?.station) {
      // infirmerie de la station : le joueur se réveille près du sas, la sécurité termine le travail
      this.endRaid(true);
      this.player.pos.set(-26, 0, -6); this.player.vel.set(0, 0, 0);
      return this.onEvent('evacStation', fee);
    }
    this.reboard();
    if (this.raid) { this.endRaid(true); }
    this.onEvent('evac', fee);
  }

  // ------------------------------------------------------------------ IA des combattants
  _hostiles(u) {
    if (u.side === 'friend') return this.units.filter((x) => x.side === 'enemy' && !x.down);
    const list = this.units.filter((x) => x.side === 'friend' && !x.down);
    if (this.armed && !this.dead && !this.player.seated) list.push({ isPlayer: true, pos: this.player.pos, crouch: false, speed: this.player.speed });
    return list;
  }
  _eye(u) { return _v.copy(u.pos).setY(u.pos.y + (u.crouch ? 1.0 : 1.5)); }
  _los(a, b) {
    const from = a.pos.clone().setY(a.pos.y + 1.45), to = b.pos.clone().setY(b.pos.y + (b.crouch ? 1.0 : 1.35));
    const d = from.distanceTo(to);
    _ray.set(from, to.sub(from).normalize());
    const h = this.player.bvh.raycastFirst(_ray, THREE.DoubleSide);
    return !h || h.distance > d - 0.4;
  }
  _pickCover(u, threat) {
    const A = this.raid.A, me = A.L(u.pos), th = threat ? A.L(threat.pos) : null;
    const meX = me.x, meZ = me.z;
    let best = null, bs = 1e9;
    for (const c of A.coverPts) {
      if (u.side === 'enemy' ? c.x < A.enemyMin - Math.min(this.raid.kills, 3) * 1.5 : c.x > A.friendMax) continue;
      if (this.units.some((o) => o !== u && !o.down && o.goalL && Math.hypot(o.goalL.x - c.x, o.goalL.z - c.z) < 1.2)) continue;
      let s = Math.hypot(c.x - meX, c.z - meZ) * 0.6 + Math.random() * 3;
      if (th) {
        const tx = th.x - c.x, tz = th.z - c.z, td = Math.hypot(tx, tz) || 1;
        const facing = (c.nx * tx + c.nz * tz) / td; // > 0 : la caisse ne protège pas
        s += facing > -0.3 ? 14 : 0;
        s += Math.abs(td - 13) * 0.35;
      }
      if (s < bs) { bs = s; best = c; }
    }
    return best;
  }
  _updateUnit(u, dt) {
    const A = this.raid.A;
    u.t += dt;
    if (u.down) { u.ch.setSpeed(0); u.ch.update(dt, this.ctx.camera.position); return; }
    // cible
    u.losT -= dt;
    const hs = this._hostiles(u);
    if (u.losT <= 0 || (u.target && !hs.includes(u.target) && !u.target.isPlayer)) {
      u.losT = 0.3 + Math.random() * 0.2;
      let best = null, bd = 1e9, bestVis = false;
      for (const h of hs) {
        const d = h.pos.distanceTo(u.pos), vis = this._los(u, h);
        const s = d - (vis ? 30 : 0);
        if (s < bd) { bd = s; best = h; bestVis = vis; }
      }
      u.target = best; u.vis = bestVis;
    }
    const T = u.target;
    // déplacement vers une couverture
    u.holdT -= dt;
    if ((!u.goal || u.holdT <= 0) && u.t > 0.5) {
      const c = this._pickCover(u, T);
      if (c) { u.goalL = c; u.goal = A.W(c.x, c.z, 0); u.holdT = 5 + Math.random() * 5; }
    }
    let moving = false;
    if (u.goal) {
      const d = _v.subVectors(u.goal, u.pos).setY(0), L = d.length();
      if (L > 0.25) {
        moving = true;
        const sp = u.side === 'enemy' ? 3.0 : 3.3;
        u.pos.addScaledVector(d.normalize(), Math.min(L, sp * dt));
        const l = this._clampLocal(A.L(u.pos));
        u.pos.copy(A.W(l.x, l.z, 0));
        u.speed = sp;
        if (!T || !u.vis) u.yaw = Math.atan2(d.x, d.z);
      } else u.speed = 0;
    }
    // séparation entre combattants
    for (const o of this.units) { if (o === u || o.down) continue; const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, dd = Math.hypot(dx, dz); if (dd < 0.7 && dd > 1e-3) { u.pos.x += dx / dd * (0.7 - dd) * 0.5; u.pos.z += dz / dd * (0.7 - dd) * 0.5; } }
    // posture : accroupi derrière une caisse basse entre deux rafales
    const atCover = !moving && u.goalL && u.goalL.low;
    const shooting = T && u.vis && u.pause <= 0 && u.reloadT <= 0;
    u.crouch = atCover && !shooting;
    if (u.crouch) { if (u.ch.override !== 'crouch' && u.ch.override !== 'hit') u.ch.play('crouch', { fade: 0.25 }); } else if (u.ch.override === 'crouch') u.ch.stop(0.2);
    // tir
    if (T) {
      const dx = T.pos.x - u.pos.x, dz = T.pos.z - u.pos.z, dist = Math.hypot(dx, dz);
      if (u.vis || !moving) u.yaw = Math.atan2(dx, dz);
      u.ch.aimPitch = Math.atan2((T.pos.y + 1.2) - (u.pos.y + 1.4), dist);
      u.pause -= dt; u.cd -= dt;
      if (u.reloadT > 0) { u.reloadT -= dt; if (u.reloadT <= 0) { u.ammo = u.gun.mag; u.ch.upper('aimU'); } }
      else if (u.vis && dist < u.gun.range * 1.3 && u.pause <= 0 && u.cd <= 0) {
        u.cd = 1 / u.gun.rate * (u.gun.auto ? 1.8 : 1.4) * (0.9 + Math.random() * 0.3);
        u.ammo--; u.burst++;
        this._npcShot(u, T, dist, moving);
        if (u.ammo <= 0) { u.reloadT = u.gun.reload + 0.6; u.ch.upper('reloadU', { then: 'aimU' }); }
        if (u.burst >= (u.gun.auto ? 3 + Math.floor(Math.random() * 3) : 2)) { u.burst = 0; u.pause = 0.7 + Math.random() * 1.1; }
      }
    }
    // rendu
    let dy = u.yaw - u.ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    u.ch.root.rotation.y += dy * (1 - Math.exp(-dt * 10));
    u.ch.root.position.copy(u.pos);
    u.ch.setSpeed(u.speed);
    u.ch.update(dt, this.ctx.camera.position);
  }
  _npcShot(u, T, dist, moving) {
    const F = u.gun;
    const muzzle = u.mesh.userData.muzzle;
    const mp = muzzle.getWorldPosition(new THREE.Vector3());
    muzzle.visible = true; setTimeout(() => { muzzle.visible = false; }, 45);
    u.ch.upper('shootU', { restart: true, then: 'aimU', speed: 1.5 });
    const k = THREE.MathUtils.clamp(1 - dist / (F.range * 1.5), 0.15, 1);
    let p = u.skill * k * (moving ? 0.6 : 1) * (T.crouch ? 0.45 : 1) * ((T.speed || 0) > 3 ? 0.7 : 1);
    if (F.pellets) p = Math.min(0.9, p * 1.8);
    const hit = Math.random() < p;
    const aim = T.pos.clone(); aim.y += T.crouch ? 0.9 : 1.25;
    if (!hit) aim.add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 - 0.3, Math.random() - 0.5).multiplyScalar(1.6));
    else this._puff(aim, 0.06, new THREE.Color(4, 0.6, 0.4));
    this._tracer(mp, aim.clone().addScaledVector(aim.clone().sub(mp).normalize(), hit ? 0 : 6), u.side === 'enemy');
    const vol = THREE.MathUtils.clamp(5 / Math.max(1, mp.distanceTo(this.ctx.camera.position)), 0.03, 0.3);
    this.audio?.zap?.('ballistic', vol);
    if (hit) this._damage(T.isPlayer ? 'player' : T, F.dmg * (F.pellets ? 3 : 1) * (0.8 + Math.random() * 0.4), u.side);
  }

  // ------------------------------------------------------------------ boucle
  update(dt) {
    this.t += dt;
    // alerte d'intrusion : de temps en temps quand le joueur est à pied dans le hangar
    const P = this.player;
    if (!this.raid && !P.seated && !this.flight.active && P.pos.x > -32 && P.pos.y < 2 && this.ctx.shop && !this.ctx.shop.isOpen) {
      this.alertT = (this.alertT || 0) + dt;
      if (this.nextAlert === undefined) this.nextAlert = 300 + Math.random() * 180;
      if (this.alertT > this.nextAlert) { this.alertT = 0; this.nextAlert = 900 + Math.random() * 600; this.startStationAlert(); }
    }
    const R = this.raid;
    if (R && !R.done && R.spawned < R.n) {
      R.spawnT -= dt;
      if (R.spawnT <= 0) { this._spawnEnemy(); R.spawnT = 1.2 + Math.random(); }
    }
    if (R) for (const u of this.units) this._updateUnit(u, dt);
    else for (const u of this.units) { u.ch.root.position.copy(u.pos); u.ch.update(dt, this.ctx.camera.position); }
    if (R && !R.done && R.spawned >= R.n && this.enemiesLeft() === 0) this._cleared();
    // joueur : visée de l'avatar, armure, blessure
    const av = this.player.avatar;
    if (av && this.drawn) av.aimPitch = this.player.pitch * 0.9;
    if (this.dead) { this.deadT += dt; if (this.deadT > 2.6) this._evac(); }
    else if (this.armed && this.hp < HP && this.t - (this._lastHurt || 0) > 6) this.hp = Math.min(HP, this.hp + dt * 2);
    this._updateLoot();
    this._updateFx(dt);
    this._hud();
  }

  // ------------------------------------------------------------------ interface
  _hud() {
    const E = this.el;
    if (!E.hud) return;
    this.dmgFlash = Math.max(0, (this.dmgFlash || 0) - 0.03);
    E.dmg.style.opacity = this.dmgFlash * 0.8 + (this.armed && this.hp < 35 ? 0.25 + Math.sin(this.t * 5) * 0.1 : 0);
    const show = this.armed && !this.player.seated && !this.ctx.shop?.isOpen;
    E.hud.classList.toggle('hidden', !show);
    E.raid.classList.toggle('hidden', !this.raid || !this.armed && !this.flight.away);
    if (this.raid) {
      const R = this.raid, left = this.enemiesLeft() + (R.n - R.spawned);
      const fr = this.units.filter((u) => u.side === 'friend' && !u.station).map((u) => `${u.name} ${u.down ? '<i>à terre</i>' : Math.round(u.hp / u.maxHp * 100) + ' %'}`).join(' · ');
      const h = R.done ? `<b class="ok">${R.station ? 'HANGAR SÉCURISÉ' : R.boarding ? 'CARGO SAISI' : 'PLATEFORME SÉCURISÉE'}</b> · ${R.kills} pirates neutralisés` : `<b>${R.station ? 'ALERTE INTRUSION' : R.boarding ? 'ABORDAGE' : 'RAID PIRATE'}</b> · ${R.o.name} · ${left} hostile${left > 1 ? 's' : ''}${fr ? `<br>Gardes : ${fr}` : ''}`;
      if (h !== this._lastR) { E.raid.innerHTML = h; this._lastR = h; }
    }
    if (show) {
      const it = this.drawn && this.gun;
      const med = this.game.free ? this.game.free('medpen') : 0;
      const h = `<div class="ft-hp"><i style="width:${Math.max(0, this.hp)}%"></i><span>SANTÉ ${Math.max(0, Math.round(this.hp))}</span></div>`
        + `<div class="ft-w">${it ? `<b>${it.name.split('«')[0].trim()}</b> ${this.reloadT > 0 ? 'rechargement…' : `${this.ammo[it.id]} / ${it.fire.mag}`}` : 'Arme rangée · G : dégainer'} · Armure ${Math.round(this.prot * 100)} % · Stylos médicaux ${med}${this.ctx.touch ? '' : ' (H)'}</div>`;
      if (h !== this._lastH) { E.hud.innerHTML = h; this._lastH = h; }
    }
    // repères au-dessus des pirates visibles
    let i = 0;
    if (this.raid && this.armed) {
      for (const u of this.units) {
        if (u.side !== 'enemy' || u.down || !u.visToPlayer) continue;
        _v.copy(u.pos).setY(u.pos.y + 2.05).project(this.ctx.camera);
        if (_v.z > 1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1) continue;
        let m = this.markEls[i];
        if (!m) { m = document.createElement('i'); E.marks.appendChild(m); this.markEls.push(m); }
        m.style.display = 'block'; m.style.left = `${(_v.x * 0.5 + 0.5) * innerWidth}px`; m.style.top = `${(-_v.y * 0.5 + 0.5) * innerHeight}px`;
        i++;
      }
      // visibilité depuis le joueur (rafraîchie par tranches)
      this._visI = ((this._visI || 0) + 1) % Math.max(1, this.units.length);
      const u = this.units[this._visI];
      if (u && u.side === 'enemy') u.visToPlayer = this._los({ pos: this.player.pos }, u);
    }
    for (; i < this.markEls.length; i++) this.markEls[i].style.display = 'none';
  }
}
