// Premiers pas : courte chaîne d'objectifs d'accueil (galerie → Joss → Iréna) puis passage au récit principal,
// découverte facultative de la frégate Atalante, et repère de navigation à pied qui tient compte des étages
// (hangar et galerie au sol, pont habitat, La Couronne) : il indique l'ascenseur à prendre ou le sas à franchir.
import * as THREE from 'three';
import { HX, AIRLOCK, SHIPLOCK } from '../world/layout.js';
import { DECK_Y } from '../world/habitat.js';
import { LUX_Y } from '../world/luxury.js';
import { SHIP } from '../world/bigship.js';

const EYE = 1.6;
const STEPS = [
  'explorer la galerie marchande : boutiques, recrutement (sas 2, mur ouest du hangar)',
  'monter au pont habitat (ascenseurs du module habitat, au bout de la galerie) et parler à Joss, au bar La Comète',
  'rencontrer Iréna Solvay à La Couronne (ascenseur panoramique du hall habitat)',
];
const FLOOR = ['galerie', 'pont habitat', 'La Couronne'];
/** étage d'une position : 0 = hangar, galerie, frégate ; 1 = pont habitat ; 2 = La Couronne */
export const floorOf = (y) => (y > LUX_Y - 10 ? 2 : y > DECK_Y - 10 ? 1 : 0);
/** zone du rez-de-chaussée : 0 = galerie et module habitat, 1 = hangar 07, 2 = tube d'abordage et frégate */
const zoneOf = (p) => (p.x < AIRLOCK.x0 - 1 ? 0 : p.x > HX ? 2 : 1);

export class Guide {
  constructor(ctx, { game, story, toast, player }) {
    Object.assign(this, { ctx, game, story, toast, player });
    this.g = (game.d.guide ||= { done: false, ata: false, tube: false });
    // ancienne sauvegarde déjà avancée dans le récit : la chaîne d'accueil est sautée sans bruit
    if (!this.g.done && this.index() >= STEPS.length) { this.g.done = true; game.save(); }
    this.last = this.index();
    this.pending = null;   // message retenu pendant une conversation
  }
  get active() { return !this.g.done; }
  /** étape courante, déduite de ce que le joueur a réellement fait (drapeaux de la sauvegarde) */
  index() {
    const s = this.story.s;
    if (s.met || s.step > 0 || this.story.q.ch2 > 0) return 3;
    if (s.heard) return 2;
    return this.game.d.galleryVisited ? 1 : 0;
  }

  update() {
    const P = this.player.pos, g = this.g, d = this.game.d, flying = this.ctx.flight?.active;
    if (!d.galleryVisited && P.x < -44 && P.y < 20 && !flying) { d.galleryVisited = true; this.game.save(); }
    if (!flying) {
      if (!g.tube && P.x > HX + 0.5 && P.x < SHIP.x0 && Math.abs(P.z - SHIPLOCK.z) < 2.5 && P.y < 4) {
        g.tube = true; this.game.save(); this._say('Frégate Atalante · 3 ponts · capitaine Varga au pont C');
      }
      if (!g.ata && this.ctx.bigship?.inside(P)) { g.ata = true; this.game.save(); this._say('Découverte · frégate Atalante visitée'); }
    }
    if (!g.done) {
      const i = this.index();
      if (i !== this.last) {
        if (i >= STEPS.length) { g.done = true; this.game.save(); this._say('Premiers pas terminés · suivez votre piste : L\'Équation de Halden'); }
        else if (i === 1) this._say(`Premiers pas 1/3 · prochaine étape : Joss, bar La Comète (pont habitat)`);
        // (étape 2 : la conversation annonce déjà « Nouvelle piste »)
        this.last = i;
      }
    }
    if (this.pending && !this.ctx.dialog?.active) { this.toast(this.pending); this.pending = null; }
  }
  _say(msg) { if (this.ctx.dialog?.active) this.pending = msg; else this.toast(msg); }

  // ---------------------------------------------------------------- objectifs affichés (#jobs)
  objective() {
    if (this.g.done) return null;
    const i = Math.min(this.index(), STEPS.length - 1);
    return `<b class="story">◆ PREMIERS PAS</b> · ${STEPS[i]} · ${i + 1}/${STEPS.length}`;
  }
  sideObjective() {
    return !this.g.ata && this.game.d.galleryVisited ? '<b>DÉCOUVERTE</b> · visiter la frégate Atalante (sas 3, mur est du hangar)' : null;
  }

  // ---------------------------------------------------------------- cibles (position au sol + nom)
  _spot(p, name) { return { pos: p.clone().setY(p.y + EYE), name }; }
  /** cible de la chaîne d'accueil (null une fois terminée) */
  target() {
    if (this.g.done) return null;
    const C = this.ctx;
    return [
      () => this._spot(new THREE.Vector3(-50, 0, AIRLOCK.z), 'Galerie marchande · boutiques, recrutement'),
      () => this._spot(C.habitat.bar, 'Joss · bar La Comète'),
      () => this._spot(C.lux.irenaSpot.talk, 'Iréna Solvay · La Couronne'),
    ][Math.min(this.index(), STEPS.length - 1)]();
  }
  /** cible à pied de l'objectif du récit en cours (les objectifs de vol mènent au Héron) */
  storyTarget() {
    const C = this.ctx, S = this.story, q = S.q, st = S.s.step, HB = C.habitat, L = C.lux;
    const irena = () => this._spot(L.irenaSpot.talk, 'Iréna Solvay · La Couronne');
    if (q.ch3 === 3 || q.ch2 === 3 || st === 3 || (st === 0 && S.s.heard)) return irena();
    if (q.ch2 === 1) return this._spot(L.spots.bar.pos, 'Salon du Zénith · La Couronne');
    if (q.joss === 2) return this._spot(HB.bar, 'Joss · bar La Comète');
    if (q.salek === 2) return this._spot(HB.clinic, 'Dr Salek · infirmerie');
    const msg = S.favors.find((f) => f.type === 'message');
    if (msg) return ({ joss: () => this._spot(HB.bar, 'Joss · bar La Comète'), salek: () => this._spot(HB.clinic, 'Dr Salek · infirmerie'), mira: () => this._spot(L.spots.concierge.customer, 'Mira · conciergerie de La Couronne') })[msg.to]();
    if ((S.navTarget() || st === 2 || q.ch2 === 2) && !this.player.seated) return { pos: C.ships.heron.interior.seatTrigger.clone(), name: 'Héron · aire 02 · décoller' };
    return null;
  }
  /** découverte facultative de la frégate, quand rien d'autre n'est en cours */
  sideTarget() { return this.g.ata ? null : this._spot(this.ctx.bigship.spots.airlock, 'Frégate Atalante · sas 3'); }

  // ---------------------------------------------------------------- itinéraire à pied
  /** Repère intermédiaire vers T depuis `from` : ascenseur du bon étage, sinon sas à franchir, sinon la cible. */
  route(from, T) {
    if (!T) return null;
    const C = this.ctx, f = floorOf(from.y), t = floorOf(T.pos.y);
    let G = T;
    if (f !== t) {
      const up = t > f, pair = up ? f : f - 1;            // 0 : galerie ↔ pont habitat ; 1 : pont habitat ↔ Couronne
      const shafts = pair === 0 ? C.habitat.shafts : C.lux.shafts, y = pair === 0 ? (up ? 0 : DECK_Y) : (up ? DECK_Y : LUX_Y);
      let best = null, bd = Infinity;
      for (const S of shafts) { const p = new THREE.Vector3(S.x1 + 1.3, y + EYE, S.c), d = p.distanceToSquared(from); if (d < bd) { bd = d; best = p; } }
      const name = pair === 0 ? `Ascenseur → ${up ? 'pont habitat' : 'galerie'}` : `Ascenseur panoramique → ${up ? 'La Couronne' : 'pont habitat'}`;
      G = { pos: best, name: up && t - f > 1 ? `${name} (puis ${FLOOR[t]})` : name };
    }
    if (f !== 0 || floorOf(G.pos.y) !== 0) return G;
    // rez-de-chaussée : galerie ↔ hangar par le sas 2, hangar ↔ frégate par le sas 3
    const a = zoneOf(from), b = zoneOf(G.pos);
    if (a === b) return G;
    if (a === 2) return from.x > SHIP.x0 ? this._spot(C.bigship.spots.airlock, 'Sas de la frégate → hangar 07') : this._spot(C.bigship.spots.tubeHangar, 'Sas 3 → hangar 07');
    if (a === 1 && b === 2) return this._spot(C.bigship.spots.tubeHangar, 'Sas 3 · frégate Atalante');
    return this._spot(new THREE.Vector3((AIRLOCK.x0 + AIRLOCK.x1) / 2, 0, AIRLOCK.z), a === 1 ? 'Sas 2 → galerie marchande' : 'Sas 2 → hangar 07');
  }
}
