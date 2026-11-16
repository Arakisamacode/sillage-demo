import { ITEM, HERON_SLOTS } from './catalog.js';

// État de la partie : crédits, inventaire, équipement du personnage et du vaisseau. Sauvegardé localement.
const KEY = 'sillage.save.v1';

function fresh() {
  return {
    credits: 15000,
    owned: { o_flight: 1, ks9: 1, l1: 2, sh1: 1 },          // id -> quantité possédée (équipée ou non)
    people: { me: { outfit: 'o_flight', armor: 'a_med', sidearm: 'ks9', primary: null } },
    ship: { wingL: 'l1', wingR: 'l1', chin: null, dorsal: null, shield: 'sh1' },
  };
}

export class GameState {
  constructor() {
    this.listeners = [];
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { d = null; }
    this.d = d && d.owned ? d : fresh();
    if (!this.d.owned.a_med && this.d.people.me.armor === 'a_med') this.d.owned.a_med = 1;
  }
  get credits() { return this.d.credits; }
  on(fn) { this.listeners.push(fn); }
  _changed(what) { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch { /* stockage indisponible */ } for (const f of this.listeners) f(what); }
  reset() { this.d = fresh(); this._changed('all'); }

  count(id) { return this.d.owned[id] || 0; }
  /** Nombre d'exemplaires actuellement équipés (personnes + vaisseau). */
  inUse(id) {
    let n = 0;
    for (const p of Object.values(this.d.people)) for (const v of Object.values(p)) if (v === id) n++;
    for (const v of Object.values(this.d.ship)) if (v === id) n++;
    return n;
  }
  free(id) { return this.count(id) - this.inUse(id); }

  pay(amount, what = 'credits') {
    if (this.d.credits < amount) return false;
    this.d.credits -= amount; this._changed(what); return true;
  }
  earn(amount) { this.d.credits += amount; this._changed('credits'); }

  buy(id) {
    const it = ITEM[id];
    if (!it || this.d.credits < it.price) return false;
    this.d.credits -= it.price;
    if (!it.eat) this.d.owned[id] = this.count(id) + 1;
    this._changed('buy');
    return true;
  }
  sellPrice(id) { return Math.round(ITEM[id].price * 0.5); }
  sell(id) {
    if (this.free(id) <= 0 || !ITEM[id].price) return false;
    this.d.owned[id]--;
    if (!this.d.owned[id]) delete this.d.owned[id];
    this.d.credits += this.sellPrice(id);
    this._changed('sell');
    return true;
  }
  use(id) {
    if (this.free(id) <= 0) return false;
    this.d.owned[id]--; if (!this.d.owned[id]) delete this.d.owned[id];
    this._changed('use'); return true;
  }

  person(who = 'me') { return this.d.people[who]; }
  /** Équipe un objet possédé (ou null pour retirer) dans l'emplacement d'une personne. */
  equip(who, slot, id) {
    const p = this.d.people[who];
    if (id && p[slot] !== id && this.free(id) <= 0) return false;
    if (slot === 'outfit' && !id) id = 'o_flight';
    p[slot] = id;
    this._changed('equip:' + who);
    return true;
  }
  /** Installe un équipement de vaisseau sur un emplacement du Héron. */
  install(slotId, id) {
    const slot = HERON_SLOTS.find((s) => s.id === slotId);
    if (id) {
      const it = ITEM[id];
      if (!slot.cats.includes(it.cat) || (slot.size && it.size > slot.size)) return false;
      if (this.d.ship[slotId] !== id && this.free(id) <= 0) return false;
    }
    if (slotId === 'shield' && !id) return false;
    this.d.ship[slotId] = id;
    this._changed('ship');
    return true;
  }
}
