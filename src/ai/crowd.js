import * as THREE from 'three';
import { Agent } from './agent.js';
import { NavGrid } from './nav.js';
import { HX, Z_BAY, Z_BACK, AIRLOCK, GALLERY, PADS } from '../world/layout.js';
import { SHOPS } from '../world/gallery.js';

// Foule : rôles, emplois du temps et densité. Personne ne marche au hasard :
// chaque routine enchaîne des tâches liées à un lieu de travail ou à un trajet logique.

const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const yawTo = (from, x, z) => Math.atan2(x - from.x, z - from.z);

// --------------------------------------------------------------------------- fabriques de tâches
const goto = (x, z, o = {}) => ({ type: 'goto', x, z, ...o });
const act = (anim, dur, o = {}) => ({ type: 'act', anim, dur, ...o });
const sit = (x, z, yaw, dur, talk = false) => ({ type: 'sit', x, z, yaw, dur, talk });
const move = (x, y, z, o = {}) => ({ type: 'move', x, y, z, ...o });
const call = (fn) => ({ type: 'call', fn });
const wait = (until) => ({ type: 'wait', until });

// --------------------------------------------------------------------------- lieux
export function worldSpots(ctx, scenes) {
  const ships = ctx.ships;
  const ga = (x, z) => ({ x, z });
  const benchesWindow = [];
  for (let x = GALLERY.x0 + 6; x < GALLERY.x1 - 4; x += 10) for (const dx of [-0.8, 0.8]) benchesWindow.push({ x: x + dx, z: GALLERY.z0 + 3.1, yaw: Math.PI, taken: null });
  const benchesMid = [];
  for (const x of [-86, -58]) for (const dx of [-0.7, 0.7]) { benchesMid.push({ x: x + dx, z: 0.8, yaw: Math.PI, taken: null }); benchesMid.push({ x: x + dx, z: 3.2, yaw: 0, taken: null }); }
  const benchHangar = [{ x: -30.65, z: -10.2, yaw: Math.PI / 2, taken: null }, { x: -30.65, z: -8.8, yaw: Math.PI / 2, taken: null }];
  const kiosk = ctx.kiosk;
  const kioskSpots = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    if (Math.abs(Math.atan2(Math.sin(a - 1.57), Math.cos(a - 1.57))) < 0.45) continue;
    kioskSpots.push({ x: kiosk.x + Math.cos(a) * 2.95, z: kiosk.z + Math.sin(a) * 2.95, taken: null });
  }
  const navette = ships.navette;
  return {
    ctx, scenes,
    airlockH: ga(-29.0, AIRLOCK.z), airlockG: ga(-44.6, AIRLOCK.z), airlockMid: ga(-37, AIRLOCK.z),
    habitat: ga(GALLERY.x0 + 1.2, -11), habitatIn: ga(GALLERY.x0 - 2.2, -11),
    // navette : haut et bas de la passerelle (hauteurs réelles)
    navTop: new THREE.Vector3(-17, 1.55, 11.75), navBottom: new THREE.Vector3(-17, 0, 9.0),
    coffee: { x: -29.9, z: 3.1, face: ga(-31.3, 3.8) },
    breakChat: [ga(-28.5, 3.6), ga(-28.6, 4.9), ga(-29.9, 5.6)],
    breakTable: ga(-29.8, 4.0),
    benchesWindow, benchesMid, benchHangar, kioskSpots,
    barista: ga(kiosk.x + 0.9, kiosk.z - 0.9),
    windowView: Array.from({ length: 8 }, (_, i) => ({ x: GALLERY.x0 + 8 + i * 7 + R(-1, 1), z: GALLERY.z0 + 1.9 })),
    shops: ctx.shopSpots,
    patrolHangar: [ga(-27.5, -36), ga(-27.5, -18), ga(-27.5, 6), ga(-27, 24), ga(-8, 26.5), ga(6, 23.5), ga(27.5, 10), ga(27.5, -12), ga(27, -36), ga(10, -38), ga(-10, -38)],
    patrolGallery: [ga(-46, -16), ga(-60, -18), ga(-78, -18), ga(-97, -16), ga(-97, 4), ga(-80, 6), ga(-64, 6), ga(-48, 5)],
    clean: [ga(-48, -12), ga(-60, -12), ga(-70, -13), ga(-86, -12), ga(-96, -6), ga(-94, 5), ga(-76, 5.5), ga(-60, 5.5), ga(-50, 2)],
    heron: { ramp: ships.heron.interior.rampBottom, gearL: ships.heron.local(-4.0, 0, 4.0), gearR: ships.heron.local(4.0, 0, 4.0), nose: ships.heron.local(0, 0, -10.0) },
    mulet: {
      ramp: ships.mulet.cargo.rampBottom, foot: ships.mulet.local(0, 0, 22.5),
      inspect: [ships.mulet.local(-7.5, 0, -12), ships.mulet.local(0, 0, -18.5), ships.mulet.local(7.6, 0, -12), ships.mulet.local(8.8, 0, 8)],
    },
    storage: { pile: ga(28.6, 16.3), jack: ga(26.6, 14.2) },
    faucon: { tools: ga(PADS.p4.x + 0.4, PADS.p4.z + 6.4), terminal: ga(PADS.p4.x - 4.0, PADS.p4.z + 6.2), nose: ships.faucon.local(0, 0, -9.0) },
  };
}

// =============================================================================== routines

function* takeSeat(a, list, dur, talk) {
  const free = list.filter((s) => !s.taken);
  if (!free.length) { yield act('idle', R(3, 6)); return; }
  const s = pick(free);
  s.taken = a.id;
  const fx = s.x + Math.sin(s.yaw) * 0.55, fz = s.z + Math.cos(s.yaw) * 0.55;
  yield goto(fx, fz);
  yield move(s.x, 0, s.z, { speed: 0.6, keepYaw: true });
  yield sit(s.x, s.z, s.yaw, dur, talk);
  yield move(fx, 0, fz, { speed: 0.6, keepYaw: true });
  s.taken = null;
}

function* chatAt(a, spot, faceTo, dur) {
  yield goto(spot.x, spot.z);
  yield act('idle', 0.6, { face: faceTo });
  let t = 0;
  while (t < dur) {
    const d = R(3, 6);
    yield act(Math.random() < 0.55 ? 'talk' : 'idle', d, { face: faceTo, look: new THREE.Vector3(faceTo.x, 1.6, faceTo.z) });
    t += d;
  }
}

/** Voyageur qui débarque de la navette et rejoint la galerie (puis le module habitat). */
function* travelerArriving(a, W) {
  const top = W.navTop, bot = W.navBottom;
  a.pos.copy(top); a.yaw = Math.PI;
  yield move(bot.x, 0, bot.z, { speed: 0.7 });
  yield goto(W.airlockH.x, W.airlockH.z);
  yield goto(W.airlockG.x, W.airlockG.z);
  const r = Math.random();
  if (r < 0.35) {
    const shop = pick(SHOPS);
    const sp = W.shops[shop.id];
    yield goto(sp.entry.x, sp.entry.z);
    yield goto(sp.customer.x + R(-0.6, 0.6), sp.customer.z);
    yield act('talk', R(4, 9), { face: sp.clerk });
    yield act('interact', 2.5, { face: sp.clerk });
    yield goto(sp.entry.x, sp.entry.z);
  } else if (r < 0.6) {
    const v = pick(W.windowView);
    yield goto(v.x, v.z);
    yield act('idle', R(8, 18), { face: Math.PI });
  } else if (r < 0.8) {
    yield* takeSeat(a, W.benchesWindow, R(15, 35), false);
  }
  yield goto(W.habitat.x, W.habitat.z);
  yield goto(W.habitatIn.x, W.habitatIn.z);
}

/** Voyageur qui part : du module habitat vers la navette (embarquement). */
function* travelerDeparting(a, W) {
  a.pos.set(W.habitatIn.x, 0, W.habitatIn.z); a.yaw = Math.PI / 2;
  yield goto(W.habitat.x, W.habitat.z);
  if (Math.random() < 0.5) {
    const k = pick(W.kioskSpots.filter((s) => !s.taken) || W.kioskSpots);
    if (k) { k.taken = a.id; yield goto(k.x, k.z); yield act('talk', R(5, 10), { face: W.barista }); yield act('interact', 2.0, { face: W.barista }); yield act('idle', R(4, 8), { face: W.barista }); k.taken = null; }
  }
  yield goto(W.airlockG.x, W.airlockG.z);
  yield goto(W.airlockH.x, W.airlockH.z);
  yield goto(W.navBottom.x, W.navBottom.z - 0.6);
  yield move(W.navBottom.x, 0, W.navBottom.z, { speed: 0.8 });
  yield move(W.navTop.x, W.navTop.y, W.navTop.z, { speed: 0.6 });
  yield move(W.navTop.x, W.navTop.y, W.navTop.z + 1.2, { speed: 0.8 });
}

/** Client de la galerie : boutiques, kiosque, bancs, vue. */
function* shopper(a, W) {
  for (;;) {
    const r = Math.random();
    if (r < 0.35) {
      const shop = pick(SHOPS);
      const sp = W.shops[shop.id];
      yield goto(sp.entry.x, sp.entry.z);
      yield goto(sp.inside.x + R(-0.8, 0.8), sp.inside.z + R(-0.3, 0.6));
      yield act('idle', R(3, 7), { face: Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2 });
      yield goto(sp.customer.x + R(-0.5, 0.5), sp.customer.z);
      yield act('talk', R(3, 7), { face: sp.clerk });
      yield goto(sp.entry.x, sp.entry.z);
    } else if (r < 0.55) {
      const k = pick(W.kioskSpots.filter((s) => !s.taken));
      if (k) { k.taken = a.id; yield goto(k.x, k.z); yield act('talk', R(6, 14), { face: W.barista }); yield act('idle', R(5, 10), { face: W.barista }); k.taken = null; }
    } else if (r < 0.78) {
      yield* takeSeat(a, Math.random() < 0.6 ? W.benchesWindow : W.benchesMid, R(20, 45), Math.random() < 0.4);
    } else {
      const v = pick(W.windowView);
      yield goto(v.x, v.z);
      yield act('idle', R(10, 20), { face: Math.PI });
    }
  }
}

/** Commerçant : reste à sa boutique. */
function shopkeeper(shopId) {
  return function* (a, W) {
    const sp = W.shops[shopId];
    a.pos.set(sp.clerk.x, 0, sp.clerk.z);
    for (;;) {
      yield goto(sp.clerk.x + R(-0.8, 0.8), sp.clerk.z);
      const r = Math.random();
      yield act(r < 0.4 ? 'talk' : r < 0.7 ? 'interact' : 'idle', R(4, 9), { face: sp.clerkFace });
      if (Math.random() < 0.15) { yield goto(sp.entry.x + R(-1, 1), sp.entry.z + 1.6); yield act('idle', R(4, 8), { face: 0 + Math.PI }); }
    }
  };
}

function* barista(a, W) {
  const k = W.ctx.kiosk;
  a.pos.set(W.barista.x, 0, W.barista.z);
  for (;;) {
    const ang = R(0, Math.PI * 2);
    const x = k.x + Math.cos(ang) * 1.3, z = k.z + Math.sin(ang) * 1.3;
    yield goto(x, z);
    yield act(Math.random() < 0.5 ? 'interact' : 'talk', R(4, 8), { face: { x: k.x + Math.cos(ang) * 4, z: k.z + Math.sin(ang) * 4 } });
  }
}

/** Agent de sécurité : ronde définie avec arrêts d'observation. */
function patrol(route, startI) {
  return function* (a, W) {
    const pts = W[route];
    let i = startI % pts.length;
    a.pos.set(pts[i].x, 0, pts[i].z);
    for (;;) {
      i = (i + 1) % pts.length;
      yield goto(pts[i].x, pts[i].z, { speed: 1.15 });
      if (Math.random() < 0.6) yield act('idle', R(3, 8), { face: R(-Math.PI, Math.PI) });
    }
  };
}

/** Agent d'entretien : pousse son chariot le long d'un circuit, nettoie. */
function* cleaner(a, W) {
  const pts = W.clean;
  let i = 0;
  a.pos.set(pts[0].x, 0, pts[0].z);
  for (;;) {
    i = (i + 1) % pts.length;
    yield call((ag) => { ag.data.pushing = true; });
    yield goto(pts[i].x, pts[i].z, { speed: 0.75 });
    yield call((ag) => { ag.data.pushing = false; });
    if (Math.random() < 0.5) yield act('interact', R(4, 7));
  }
}

/** Mécanicien soudeur : nacelle, soudure, diagnostic, pause café. */
function* welder(a, W) {
  const S = W.scenes.weld;
  S.welder = a;
  a.pos.set(S.board.x, 0, S.board.z);
  for (;;) {
    yield goto(S.board.x, S.board.z);
    const p = S.onPlatform();
    yield move(p.x, 0.6, p.z, { speed: 0.9 });
    yield call((ag) => { ag.data.onLift = true; S.target = 1.55; });
    yield act('idle', 4.5, { face: S.faceYaw });
    yield call(() => { S.active = true; });
    yield act('torch', R(35, 55), { face: S.faceYaw, look: S.torchPoint });
    yield call(() => { S.active = false; });
    yield act('idle', 3, { face: S.faceYaw, look: S.torchPoint });
    yield call(() => { S.target = 0.55; });
    yield act('idle', 4, { face: S.faceYaw });
    yield call((ag) => { ag.data.onLift = false; });
    yield move(S.board.x, 0, S.board.z, { speed: 0.9 });
    const r = Math.random();
    if (r < 0.4) {
      yield goto(W.faucon.tools.x, W.faucon.tools.z);
      yield act('interact', R(4, 7), { face: Math.PI });
    } else if (r < 0.7) {
      yield goto(W.faucon.terminal.x, W.faucon.terminal.z);
      yield act('interact', R(5, 8), { face: Math.PI });
    } else {
      // pause café avec un collègue
      yield goto(W.coffee.x, W.coffee.z);
      yield act('interact', 3, { face: W.coffee.face });
      yield* chatAt(a, W.breakChat[0], W.breakTable, R(20, 35));
    }
  }
}

/** Mécanicien au sol : trappe ouverte du Faucon, à genoux. */
function* mechanic(a, W) {
  const sp = W.ctx.ships.faucon.service.panel;
  a.pos.set(sp.x, 0, sp.z);
  for (;;) {
    yield goto(sp.x, sp.z);
    yield act('repair', R(25, 40), { face: yawTo(sp, W.ctx.ships.faucon.origin.x, W.ctx.ships.faucon.origin.z) });
    yield goto(W.faucon.tools.x - 0.6, W.faucon.tools.z);
    yield act('interact', R(3, 6), { face: Math.PI });
    if (Math.random() < 0.35) { yield goto(W.coffee.x, W.coffee.z); yield act('interact', 3, { face: W.coffee.face }); yield* chatAt(a, W.breakChat[1], W.breakTable, R(15, 30)); }
  }
}

/** Ravitailleur : branche le flexible du chariot citerne sur le Faucon. */
function* fueler(a, W) {
  const F = W.scenes.fuel;
  a.pos.set(F.standAtCart.x, 0, F.standAtCart.z);
  for (;;) {
    yield goto(F.standAtCart.x, F.standAtCart.z);
    yield act('interact', 2.2, { face: F.nozzleRest });
    yield call((ag) => { F.state = 'held'; F.holder = ag; });
    yield goto(F.standAtPort.x, F.standAtPort.z, { speed: 1.0 });
    yield act('interact', 2.8, { face: F.port, look: F.port });
    yield call(() => { F.state = 'connected'; F.holder = null; });
    yield act('idle', R(6, 10), { face: F.port, look: F.port });
    yield goto(F.standAtCart.x, F.standAtCart.z);
    yield act('interact', R(4, 6), { face: F.cart });
    yield act('idle', R(15, 25), { face: F.port, look: F.port });
    yield goto(F.standAtPort.x, F.standAtPort.z);
    yield act('interact', 2.5, { face: F.port, look: F.port });
    yield call((ag) => { F.state = 'held'; F.holder = ag; });
    yield goto(F.standAtCart.x, F.standAtCart.z, { speed: 1.0 });
    yield act('interact', 2.2, { face: F.nozzleRest });
    yield call(() => { F.state = 'stowed'; F.holder = null; });
    yield act('idle', R(10, 20), { face: F.port });
  }
}

/** Cariste : reste aux commandes du chariot élévateur (pause de temps en temps). */
function* forkDriver(a, W) {
  const fk = W.scenes.forklift;
  fk.driver = a;
  for (;;) {
    a.attached = { seatWorld: () => W.scenes.forkSeat(), seatYaw: () => fk.vehicle.heading };
    a.data.seated = true;
    a.char.play('drive', { fade: 0.3 });
    yield wait(() => false);
  }
}

function* tugDriver(a, W) {
  const tg = W.scenes.tug;
  tg.driver = a;
  a.attached = { seatWorld: () => W.scenes.tugSeat(), seatYaw: () => tg.vehicle.heading };
  a.data.seated = true;
  a.char.play('drive', { fade: 0.3 });
  yield wait(() => false);
}

/** Manutentionnaire : prépare les palettes au stock, parle au cariste, inspecte la soute. */
function* handler(a, W) {
  a.pos.set(W.storage.pile.x, 0, W.storage.pile.z);
  for (;;) {
    yield goto(W.storage.pile.x + R(-0.6, 0.6), W.storage.pile.z + R(-0.4, 0.4));
    yield act('pickup', 2.2, { face: Math.PI / 2 });
    yield act('interact', R(3, 6), { face: Math.PI / 2 });
    yield goto(W.storage.jack.x, W.storage.jack.z);
    yield act('idle', R(4, 8), { face: yawTo(W.storage.jack, 21.3, 12.6) });
    if (Math.random() < 0.4) {
      yield goto(W.mulet.foot.x + 3.5, W.mulet.foot.z + 1.0);
      yield act('talk', R(6, 10), { face: W.mulet.ramp });
      yield act('idle', R(3, 6), { face: W.mulet.ramp });
    }
  }
}

/** Pilote : arrive du sas, fait le tour de son vaisseau, puis pause. */
function* pilot(a, W) {
  a.pos.set(W.airlockMid.x, 0, W.airlockMid.z);
  for (;;) {
    yield goto(W.airlockH.x, W.airlockH.z);
    for (const p of W.mulet.inspect) { yield goto(p.x, p.z); yield act('interact', R(3, 5), { face: yawTo(p, W.ctx.ships.mulet.origin.x, W.ctx.ships.mulet.origin.z) }); }
    yield goto(W.mulet.foot.x - 2, W.mulet.foot.z + 0.5);
    yield act('talk', R(8, 14), { face: W.mulet.ramp });
    yield* takeSeat(a, W.benchHangar, R(20, 40), true);
    yield goto(W.airlockG.x, W.airlockG.z);
    const k = pick(W.kioskSpots.filter((s) => !s.taken));
    if (k) { k.taken = a.id; yield goto(k.x, k.z); yield act('talk', R(8, 15), { face: W.barista }); k.taken = null; }
    yield goto(W.airlockMid.x, W.airlockMid.z);
  }
}

/** Deuxième pilote (le copilote du Mulet) : discute près de la machine à café puis au pied de la rampe. */
function* copilot(a, W) {
  a.pos.set(W.breakChat[2].x, 0, W.breakChat[2].z);
  for (;;) {
    yield goto(W.coffee.x, W.coffee.z);
    yield act('interact', 3, { face: W.coffee.face });
    yield* chatAt(a, W.breakChat[2], W.breakTable, R(25, 45));
    yield goto(W.mulet.foot.x - 2.6, W.mulet.foot.z + 1.6);
    yield act('talk', R(10, 16), { face: W.mulet.ramp });
    yield act('idle', R(6, 10), { face: W.mulet.ramp });
  }
}

// =============================================================================== distribution
// [rôle, modèles possibles, routine, options]  — l'ordre fixe la priorité (faible qualité = moins de figurants)
function roster(W) {
  const workers = ['M_Worker', 'F_Worker'];
  const list = [
    ['ravitailleur', ['M_Worker'], fueler, {}],
    ['soudeur', ['F_Worker', 'M_Worker'], welder, {}],
    ['cariste', ['M_Worker', 'M_Casual2'], forkDriver, {}],
    ['tractoriste', ['F_Worker', 'M_Worker'], tugDriver, {}],
    ['sécurité', ['M_Swat', 'F_Soldier'], patrol('patrolHangar', 0), { walk: 1.1 }],
    ['sécurité', ['F_Soldier', 'M_Swat'], patrol('patrolGallery', 3), { walk: 1.1 }],
    ['commerçant', ['F_Casual'], shopkeeper('nouilles'), {}],
    ['commerçant', ['M_Casual'], shopkeeper('cafe'), {}],
    ['commerçant', ['M_Adventurer'], shopkeeper('pieces'), {}],
    ['commerçant', ['F_Formal'], shopkeeper('pharma'), {}],
    ['commerçant', ['F_SciFi'], shopkeeper('combis'), {}],
    ['barista', ['M_Punk', 'F_Punk'], barista, {}],
    ['mécanicien', workers, mechanic, {}],
    ['manutentionnaire', workers, handler, {}],
    ['pilote', ['M_Spacesuit', 'F_SciFi'], pilot, {}],
    ['entretien', ['M_Farmer', 'F_Worker'], cleaner, {}],
    ['copilote', ['F_Adventurer', 'M_Spacesuit'], copilot, {}],
    ['client', ['M_Casual', 'F_Casual', 'M_Suit', 'F_Suit', 'M_Beach', 'F_Formal', 'M_Casual2', 'F_Adventurer'], shopper, {}],
    ['client', ['M_Casual', 'F_Casual', 'M_Suit', 'F_Suit', 'M_Beach', 'F_Formal', 'M_Casual2', 'F_Punk'], shopper, {}],
    ['client', ['F_Suit', 'M_Suit', 'F_Casual'], shopper, {}],
    ['client', ['M_Beach', 'F_Adventurer'], shopper, {}],
  ];
  return list;
}

export const TRAVELER_MODELS = ['M_Casual', 'F_Casual', 'M_Suit', 'F_Suit', 'M_Beach', 'F_Formal', 'M_Casual2', 'F_Adventurer', 'M_Adventurer', 'F_Punk', 'M_Punk', 'F_SciFi'];

export class Crowd {
  constructor(ctx, scenes) {
    this.ctx = ctx;
    this.scenes = scenes;
    this.nav = new NavGrid(ctx.builder.obstacles);
    this.world = worldSpots(ctx, scenes);
    this.agents = [];
    this.vehicles = scenes.vehicles;
    this.budget = ctx.quality.npcs;
    this.travelerTimer = 3;
    this.wave = 0;
    this.cartMesh = null;
  }

  spawn(role, model, routine, opts = {}) {
    const c = this.ctx.lib.create(model, {
      height: opts.height ?? (model[0] === 'F' ? R(1.62, 1.74) : R(1.72, 1.86)),
      tint: opts.tint ?? [R(-0.04, 0.04), R(-0.1, 0.05), R(-0.06, 0.06)],
      formal: role === 'commerçant' || model.includes('Suit') || model.includes('Formal'),
    });
    this.ctx.scene.add(c.root);
    const a = new Agent(this, c, role, routine, { walkSpeed: opts.walk, x: opts.x, z: opts.z, yaw: opts.yaw });
    this.agents.push(a);
    return a;
  }

  populate() {
    const list = roster(this.world);
    const fixed = Math.min(list.length, this.budget - 3);
    for (let i = 0; i < fixed; i++) {
      const [role, models, routine, opts] = list[i];
      this.spawn(role, pick(models), routine, opts);
    }
    // chariot de ménage poussé par l'agent d'entretien
    const cl = this.agents.find((a) => a.role === 'entretien');
    if (cl) this._makeCleanCart(cl);
    // quelques voyageurs déjà en route
    for (let i = 0; i < Math.max(1, Math.floor((this.budget - fixed) / 2)); i++) this.spawnTraveler(Math.random() < 0.5);
  }

  _makeCleanCart(agent) {
    const m = this.ctx.mats;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.9), m.plastic(0x2a6fbd, 0.6));
    body.position.y = 0.5; g.add(body);
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.5, 12), m.plastic(0xd4a017, 0.6));
    bin.position.set(0, 0.45, 0.6); g.add(bin);
    const mop = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 6), m.smooth(0xaaaaaa, 0.4, 0.9));
    mop.position.set(0.15, 1.0, 0.6); mop.rotation.x = 0.2; g.add(mop);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.ctx.scene.add(g);
    agent.data.cart = g;
  }

  spawnTraveler(arriving) {
    const routine = arriving ? travelerArriving : travelerDeparting;
    const a = this.spawn('voyageur', pick(TRAVELER_MODELS), routine);
    return a;
  }

  separation(a) {
    let x = 0, z = 0;
    for (const b of this.agents) {
      if (b === a || b.attached) continue;
      const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.1 && d2 > 1e-4) { const d = Math.sqrt(d2); const k = (1.05 - d) / d; x += dx * k; z += dz * k; }
    }
    return { x, z };
  }

  update(dt, player, camPos) {
    // flux de voyageurs (arrivées de navette par vagues, départs réguliers)
    this.travelerTimer -= dt;
    const travelers = this.agents.filter((a) => a.role === 'voyageur').length;
    if (this.travelerTimer <= 0 && this.agents.length < this.budget) {
      this.wave++;
      const arriving = this.wave % 3 !== 0;
      this.spawnTraveler(arriving);
      this.travelerTimer = arriving ? R(4, 9) : R(8, 14);
      if (this.wave % 6 === 0) this.travelerTimer = R(25, 40); // entre deux navettes
      if (arriving && this.onArrival && this.wave % 6 === 1) this.onArrival();
    }
    for (const a of this.agents) {
      a.update(dt, player);
      a.char.update(dt, camPos);
      if (a.data.cart) {
        const c = a.data.cart;
        c.position.set(a.pos.x + Math.sin(a.yaw) * 0.75, 0, a.pos.z + Math.cos(a.yaw) * 0.75);
        c.rotation.y = a.yaw;
        if (a.data.pushing && a.char.override !== 'push') a.char.play('push', { fade: 0.3 });
        if (!a.data.pushing && a.char.override === 'push') a.char.stop(0.3);
      }
    }
    // disparition (entrée dans le module habitat ou dans la navette)
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      if (!a.alive) {
        this.ctx.scene.remove(a.char.root);
        this.agents.splice(i, 1);
      }
    }
    return travelers;
  }

  /** positions des acteurs (portes, véhicules) */
  blockers(player) {
    const out = this.agents.filter((a) => !a.attached).map((a) => a.pos);
    if (player) out.push(player.pos);
    return out;
  }
}
