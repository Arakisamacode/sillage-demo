import * as THREE from 'three';
import { Agent } from '../ai/agent.js';
import { HAIRS, HAIR_COLORS } from '../characters/characters.js';

// Équipage : candidats au bureau de recrutement de la galerie, membres engagés (manutentionnaires,
// artilleurs, gardes du corps), ordres (suivre, attendre, au travail), embarquement automatique au décollage,
// chargement et déchargement des caisses de fret, tourelle dorsale en vol, salaires à chaque contrat.

export const ROLES = {
  loader: { name: 'Manutentionnaire', fee: 1800, wage: 150, desc: 'Porte les caisses entre le quai de fret et la soute : chargement et déchargement des contrats.' },
  gunner: { name: 'Artilleur', fee: 3200, wage: 260, desc: 'Prend place à la tourelle dorsale en vol (tourelle à installer à l\'Équipement naval).' },
  guard: { name: 'Garde du corps', fee: 4200, wage: 320, desc: 'Vous suit partout et garde la rampe à quai. Équipez-le d\'une armure et d\'une arme.' },
};
const BASE = {
  loader: { top: 0x5d6168, bottom: 0x3a3d42, boot: 0x2a2016, accent: 0xe8762a, hivis: true, gloves: true },
  gunner: { top: 0x2a3440, bottom: 0x2a3440, boot: 0x14161a, accent: 0xd84a3a, gloves: true, zip: true },
  guard: { top: 0x24262a, bottom: 0x1c1e20, boot: 0x0e0f10, accent: 0x6a6a5a, gloves: true, belt: true },
};
const FIRST = {
  M: ['Malo', 'Idris', 'Bastien', 'Yanis', 'Teodor', 'Anselme', 'Kofi', 'Ruben', 'Sacha', 'Hugo', 'Nils', 'Amadou'],
  F: ['Léna', 'Inès', 'Maëlle', 'Ysé', 'Nora', 'Salomé', 'Awa', 'Clémence', 'Jade', 'Mira', 'Oriane', 'Zoé'],
};
const LAST = ['Varenne', 'Okafor', 'Delmas', 'Nakamura', 'Ferreira', 'Lindqvist', 'Brossard', 'Haddad', 'Kerjean', 'Moreau-Diallo', 'Sorel', 'Castaing', 'Petrov', 'Aubin'];
const QUOTES = {
  loader: ['« J\'ai fait dix ans de quai sur Halden. Rien ne tombe. »', '« Je porte, j\'arrime, je pose pas de questions. »', '« Donnez-moi une soute, je vous la range au millimètre. »'],
  gunner: ['« Trois ans de tourelle sur des convois. Je dors peu. »', '« Si ça bouge, je le vois avant vous. »', '« J\'aime les tourelles bien huilées. »'],
  guard: ['« Ancienne sécurité de station. Je reste derrière vous. »', '« Je ne parle pas beaucoup. C\'est le métier. »', '« Je garde la rampe, personne ne monte sans vous. »'],
};
const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const goto = (x, z, o = {}) => ({ type: 'goto', x, z, ...o });
const act = (anim, dur, o = {}) => ({ type: 'act', anim, dur, ...o });
const move = (x, y, z, o = {}) => ({ type: 'move', x, y, z, ...o });
const wait = (until) => ({ type: 'wait', until });
const _v = new THREE.Vector3();
let SEQ = 1;

export class Crew {
  constructor(ctx, { game, cargo, flight, crowd, missions, player, loadout }) {
    Object.assign(this, { ctx, game, cargo, flight, crowd, missions, player, loadout });
    this.R = ctx.recruit;
    this.members = [];       // { data, agent }
    this.candidates = [];    // { data, agent }
    this.onEvent = () => {};
    this.t = 0;
    for (const d of game.d.crew) { SEQ = Math.max(SEQ, +String(d.id).slice(1) + 1); this._spawnMember(d, true); }
    const roles = ['loader', 'guard', 'gunner', 'loader'];
    for (let i = 0; i < 4; i++) this._addCandidate(roles[i], i);
    // le recruteur de la Guilde, derrière son comptoir
    this._spawnClerk();
  }

  // ------------------------------------------------------------------ fabrication des personnages
  _look(role) {
    const g = Math.random() < 0.5 ? 'M' : 'F';
    return {
      gender: g, model: `U${g}_${Math.random() < 0.5 ? 'light' : 'dark'}`, hair: pick(HAIRS[g]), hairColor: pick(HAIR_COLORS),
      height: g === 'F' ? R(1.63, 1.76) : R(1.72, 1.9), name: `${pick(FIRST[g])} ${pick(LAST)}`, role,
    };
  }
  _char(d) {
    const c = this.ctx.lib.create(d.model, { height: d.height, hair: d.hair, hairColor: d.hairColor, outfit: BASE[d.role], armorShadows: !!this.ctx.quality.npcShadows });
    this.ctx.scene.add(c.root);
    return c;
  }
  _agent(d, routine, x, z, yaw) {
    const a = new Agent(this.crowd, this._char(d), 'équipage', routine, { x, z, yaw, walkSpeed: 1.35 });
    a.curiosity = 0.8;
    this.crowd.agents.push(a);
    return a;
  }
  _spawnClerk() {
    const R0 = this.R, d = this._look('guard');
    const routine = function* (a) {
      for (;;) {
        yield goto(R0.clerk.x + R(-0.3, 0.3), R0.clerk.z + R(-1.0, 1.0));
        yield act(Math.random() < 0.5 ? 'talk' : 'idle', R(4, 9), { face: R0.clerkFace });
        if (Math.random() < 0.3) yield act('interact', 2.5, { face: R0.clerkFace });
      }
    };
    const c = this.ctx.lib.create(d.model, { height: d.height, hair: d.hair, hairColor: d.hairColor, outfit: { top: 0x3a3e2a, bottom: 0x2a2c30, boot: 0x16181a, accent: 0xf2a33a, zip: true }, formal: true });
    this.ctx.scene.add(c.root);
    const a = new Agent(this.crowd, c, 'commerçant', routine, { x: R0.clerk.x, z: R0.clerk.z, yaw: -Math.PI / 2 });
    this.crowd.agents.push(a);
  }

  // ------------------------------------------------------------------ candidats
  _addCandidate(role, spotI) {
    const d = this._look(role || pick(['loader', 'loader', 'gunner', 'guard']));
    d.skill = 1 + Math.floor(Math.random() * 5);
    const k = 0.75 + d.skill * 0.12;
    d.fee = Math.round(ROLES[d.role].fee * k / 50) * 50;
    d.wage = Math.round(ROLES[d.role].wage * k / 10) * 10;
    d.quote = pick(QUOTES[d.role]);
    d.cid = SEQ++;
    const used = new Set(this.candidates.map((c) => c.spot));
    const spot = spotI ?? this.R.waiting.findIndex((s, i) => !used.has(i));
    const s = this.R.waiting[spot];
    const R0 = this.R;
    const routine = function* (a) {
      for (;;) {
        yield goto(s.x, s.z, { face: s.yaw });
        yield act(Math.random() < 0.35 ? 'talk' : 'idle', R(5, 12), { face: s.yaw });
        if (Math.random() < 0.2) { yield act('idle', R(3, 5), { face: R0.clerkFace }); }
      }
    };
    const a = this._agent(d, routine, s.x, s.z, s.yaw);
    this.candidates.push({ data: d, agent: a, spot });
  }

  board() {
    return this.candidates.map((c) => `${ROLES[c.data.role].name} · ${c.data.name} · ${'★'.repeat(c.data.skill)}`);
  }

  hire(cand) {
    if (this.members.length >= 6) return 'Six membres d\'équipage au maximum.';
    if (!this.game.pay(cand.data.fee)) return 'Crédits insuffisants.';
    const d = cand.data;
    const data = { id: `c${SEQ++}`, name: d.name, role: d.role, gender: d.gender, model: d.model, hair: d.hair, hairColor: d.hairColor, height: d.height, skill: d.skill, wage: d.wage, order: d.role === 'loader' ? 'work' : 'follow' };
    this.game.d.crew.push(data);
    this.game.addPerson(data.id, { name: d.name, base: BASE[d.role], outfit: null, armor: null, sidearm: null, primary: null });
    this.candidates = this.candidates.filter((c) => c !== cand);
    // le candidat devient membre : même personnage, nouvelle routine
    const m = { data, agent: cand.agent, aboard: false };
    cand.agent.role = 'équipage';
    cand.agent.data.member = m;
    cand.agent.routine = this._routine(cand.agent, m);
    cand.agent.task = null;
    this.members.push(m);
    setTimeout(() => this._addCandidate(null, cand.spot), 20000);
    this.onEvent('hired', m);
    return null;
  }

  _spawnMember(data) {
    const s = this.R.waiting[this.members.length % this.R.waiting.length];
    const m = { data, aboard: false };
    m.agent = this._agent(data, (a) => this._routine(a, m), s.x - 1.5, s.z + 2, 0);
    m.agent.data.member = m;
    this.members.push(m);
    if (this.ctx.dressPerson) this.ctx.dressPerson(m.agent.char, this.game.person(data.id), data.id);
  }

  dismiss(m) {
    if (this.cargo.crates.some((c) => c.carrier === m.agent)) for (const c of this.cargo.crates.filter((c) => c.carrier === m.agent)) this.cargo.toQuai(c) || this.cargo.toHold(c);
    this.members = this.members.filter((x) => x !== m);
    this.game.d.crew = this.game.d.crew.filter((d) => d !== m.data);
    this.game.removePerson(m.data.id);
    const a = m.agent, W = this.crowd.world;
    if (m.aboard) { a.alive = false; return; }
    a.routine = (function* () { yield goto(W.habitat.x, W.habitat.z); yield goto(W.habitatIn.x, W.habitatIn.z); })();
    a.task = null;
    a.role = 'voyageur';
  }

  setOrder(m, order) { m.data.order = order; m.agent.task = null; this.game.save(); }

  // ------------------------------------------------------------------ comportements
  _home() { return this.flight.state === 'parked' && this.flight.dockedAt === this.flight.home; }

  /** Point de suivi : derrière le joueur (décalé selon le rang), ou au pied de la rampe s'il est à bord. */
  _followPoint(m) {
    const P = this.player, i = this.members.indexOf(m);
    const onFloor = P.pos.y < 0.4 && this.crowd.nav.walkable(P.pos.x, P.pos.z) && !P.seated;
    if (!onFloor) {
      const rb = this.ship().interior.rampBottom;
      return _v.set(rb.x + (i % 2 ? 1.6 : -1.6) * (1 + Math.floor(i / 2) * 0.8), 0, rb.z + 1.2 + (i % 3) * 0.6).clone();
    }
    const back = 1.6 + Math.floor(i / 2) * 1.1, side = (i % 2 ? 1 : -1) * 0.9;
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    return _v.set(P.pos.x + sy * back + cy * side, 0, P.pos.z + cy * back - sy * side).clone();
  }
  ship() { return this.ctx.ships.heron; }

  _routine(a, m) {
    const crew = this;
    return (function* () {
      for (;;) {
        if (m.aboard) { yield wait(() => !m.aboard); continue; }
        if (m.data.role === 'loader' && m.data.order === 'work' && crew._home()) {
          const job = crew._job(a, m);
          if (job) { yield* job; continue; }
        }
        if (m.data.order === 'wait') { yield act('idle', 2.0); continue; }
        if (m.data.order === 'work' && m.data.role !== 'loader') {
          // poste de garde au pied de la rampe
          const rb = crew.ship().interior.rampBottom, i = crew.members.indexOf(m);
          yield goto(rb.x + (i % 2 ? 2.4 : -2.4), rb.z + 1.5, { face: 0 });
          yield act('idle', 3.0, { face: 0 });
          continue;
        }
        // suivre le joueur
        const tp = crew._followPoint(m);
        const d = Math.hypot(tp.x - a.pos.x, tp.z - a.pos.z);
        if (d < 1.1) {
          const P = crew.player;
          yield act('idle', 0.7, { face: Math.atan2(P.pos.x - a.pos.x, P.pos.z - a.pos.z) });
        } else {
          yield goto(tp.x, tp.z, { speed: d > 9 ? 3.4 : d > 4 ? 2.2 : 1.35, abort: () => crew._followPoint(m).distanceTo(tp) > 2.5 || m.aboard });
        }
      }
    })();
  }

  /** Tâche de manutention : charger une caisse du quai dans la soute, ou décharger une caisse de collecte. */
  _job(a, m) {
    const C = this.cargo, S = this.ship(), I = S.interior;
    const busy = (c) => c.reservedBy && c.reservedBy !== a.id && this.members.some((x) => x.agent.id === c.reservedBy);
    // 1. chargement : caisse d'un contrat de livraison au sol, sur le quai
    let c = C.crates.find((x) => x.where === 'ground' && !busy(x) && x.contract.type === 'out' && C.inQuaiZone(x.mesh.position));
    const crew = this;
    if (c) {
      c.reservedBy = a.id;
      return (function* () {
        const p = c.mesh.position;
        const side = Math.hypot(a.pos.x - p.x - 0.9, a.pos.z - p.z) < Math.hypot(a.pos.x - p.x + 0.9, a.pos.z - p.z) ? 0.9 : -0.9;
        yield goto(p.x + side, p.z, { speed: 1.7, abort: () => c.where !== 'ground' || !crew._home() });
        if (c.where !== 'ground' || !crew._home()) { c.reservedBy = null; return; }
        yield act('pickup', 1.1, { face: Math.atan2(p.x - a.pos.x, p.z - a.pos.z) });
        if (c.where !== 'ground' || !crew._home()) { c.reservedBy = null; return; }
        C.carryBy(c, a);
        yield* crew._up(a);
        if (c.where !== 'npc') return;
        if (!C.toHold(c)) { yield* crew._down(a); C.toQuai(c); c.reservedBy = null; return; }
        c.reservedBy = null;
        yield act('interact', 0.8);
        yield* crew._down(a);
      })();
    }
    // 2. déchargement : caisse d'une collecte dans la soute, à déposer sur le quai
    c = C.crates.find((x) => x.where === 'hold' && !x.container && !busy(x) && x.contract.type === 'in' && x.contract.step === 'return' && !(x.slot % 2 === 0 && C.slots[x.slot + 1]));
    if (c && C.quaiFree() > 0) {
      c.reservedBy = a.id;
      return (function* () {
        yield* crew._up(a);
        if (c.where !== 'hold' || !crew._home()) { c.reservedBy = null; yield* crew._down(a); return; }
        yield act('pickup', 1.0);
        if (c.where !== 'hold') { c.reservedBy = null; yield* crew._down(a); return; }
        C.carryBy(c, a);
        yield* crew._down(a);
        const spot = C.freeSpot();
        if (spot) yield goto(spot[0] + 0.9, spot[1], { speed: 1.5, abort: () => c.where !== 'npc' });
        if (c.where !== 'npc') return;
        yield act('interact', 0.6);
        if (!C.toQuai(c)) C.toGround(c, new THREE.Vector3(a.pos.x - Math.sin(a.yaw) * 0.8, 0, a.pos.z - Math.cos(a.yaw) * 0.8), a.yaw);
        c.reservedBy = null;
        C.onDrop && C.onDrop(c);
      })();
    }
    return null;
  }
  *_up(a) {
    const I = this.ship().interior, rb = I.rampBottom, rt = I.rampTop, inner = this.ship().local(0.0, I.floorY, 11.0);
    yield goto(rb.x, rb.z + 0.8, { speed: 1.6 });
    yield move(rb.x, 0, rb.z, { speed: 1.4 });
    yield move(rt.x, rt.y, rt.z, { speed: 1.2 });
    yield move(inner.x, inner.y, inner.z, { speed: 1.4 });
  }
  *_down(a) {
    const I = this.ship().interior, rb = I.rampBottom, rt = I.rampTop;
    yield move(rt.x, rt.y, rt.z, { speed: 1.4 });
    yield move(rb.x, 0, rb.z, { speed: 1.3 });
    yield move(rb.x, 0, rb.z + 1.0, { speed: 1.4 });
  }

  // ------------------------------------------------------------------ embarquement
  onTakeoff() {
    let n = 0;
    for (const m of this.members) {
      if (m.data.order === 'wait' || m.aboard) continue;
      const a = m.agent;
      for (const c of this.cargo.crates.filter((c) => c.carrier === a)) { if (!this.cargo.toHold(c)) this.cargo.toQuai(c); c.reservedBy = null; }
      m.aboard = true; n++;
      a.char.root.visible = false;
      a.pos.set(0, -60, 0); a.task = null;
    }
    if (n) this.onEvent('boarded', n);
  }
  onLanded(pad) {
    if (pad !== this.flight.home) return;
    const rb = this.ship().interior.rampBottom;
    let i = 0;
    for (const m of this.members) {
      if (!m.aboard) continue;
      m.aboard = false;
      m.agent.pos.set(rb.x + (i % 2 ? 1.2 : -1.2), 0, rb.z + 1.0 + i * 0.5); i++;
      m.agent.char.root.visible = true;
      m.agent.task = null;
    }
  }
  gunner() { return this.members.find((m) => m.data.role === 'gunner' && m.aboard); }
  wages() { return this.members.reduce((s, m) => s + m.data.wage, 0); }

  update(dt) {
    this.t += dt;
    // caisses portées par les manutentionnaires : animation de port
    for (const m of this.members) {
      const a = m.agent, carrying = this.cargo.crates.some((c) => c.carrier === a);
      const moving = carrying && a.task && (a.task.type === 'goto' || a.task.type === 'move');
      if (moving && a.char.override !== 'push') a.char.play('push', { fade: 0.3 });
      if (!moving && a.char.override === 'push') a.char.stop(0.3);
    }
    // tourelle : balayage quand un artilleur est à son poste en vol
    const tur = this.loadout.meshes.dorsal;
    if (tur) {
      const head = tur.userData.head;
      const manned = this.flight.active && this.gunner();
      const want = manned ? Math.sin(this.t * 0.35) * 1.4 + Math.sin(this.t * 1.1) * 0.2 : 0;
      head.rotation.y += (want - head.rotation.y) * (1 - Math.exp(-dt * 2));
    }
  }

  status(m) {
    if (m.aboard) return m.data.role === 'gunner' && this.flight.active && this.loadout.meshes.dorsal ? 'à la tourelle' : 'à bord';
    if (this.cargo.crates.some((c) => c.carrier === m.agent)) return 'porte une caisse';
    return { follow: 'vous suit', wait: 'attend', work: m.data.role === 'loader' ? 'au travail (fret)' : 'garde la rampe' }[m.data.order];
  }
}
