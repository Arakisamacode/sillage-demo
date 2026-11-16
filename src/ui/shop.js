import { ITEMS, ITEM, CATEGORIES, STORES, HERON_SLOTS } from '../game/catalog.js';

// Interfaces de commerce et d'inventaire (HTML par-dessus la vue 3D).
const fmt = (n) => n.toLocaleString('fr-FR').replace(/ /g, ' ') + ' ¤';
const PERSON_SLOTS = [
  { id: 'outfit', name: 'Tenue', cat: 'outfit' },
  { id: 'armor', name: 'Armure', cat: 'armor' },
  { id: 'sidearm', name: 'Arme de poing', cat: 'sidearm' },
  { id: 'primary', name: 'Arme principale', cat: 'primary' },
];

export class ShopUI {
  constructor({ state, canEquipShip, onClose, onAction }) {
    this.state = state;
    this.canEquipShip = canEquipShip;   // () => bool (vaisseau posé)
    this.onClose = onClose;
    this.onAction = onAction || (() => {});
    this.root = document.createElement('div');
    this.root.id = 'shop';
    this.root.className = 'hidden';
    document.body.appendChild(this.root);
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.addEventListener('click', (e) => this._click(e));
    this.root.addEventListener('change', (e) => this._change(e));
    addEventListener('keydown', (e) => { if (this.open && (e.code === 'Escape' || (e.code === 'KeyI' && this.mode === 'inv') || e.code === 'Tab')) { e.preventDefault(); this.close(); } });
    state.on(() => { if (this.open) this.render(); });
    this.open = false;
    this.who = 'me';
  }

  get isOpen() { return this.open; }

  openStore(storeId) { this.mode = 'store'; this.store = storeId; this.tab = 'buy'; this.filter = null; this._show(); }
  openBoard(missions) { this.mode = 'board'; this.missions = missions; this.tab = missions.active.length ? 'active' : 'offers'; this._show(); }
  openInventory() { this.mode = 'inv'; this.tab = 'perso'; this._show(); }
  _show() { this.open = true; this.root.classList.remove('hidden'); this.msg = ''; this.render(); }
  close() { if (!this.open) return; this.open = false; this.root.classList.add('hidden'); this.onClose && this.onClose(); }
  flash(msg, bad = false) { this.msg = msg; this.bad = bad; this.render(); }

  render() {
    const S = this.state;
    const head = this.mode === 'store'
      ? `<div class="sh-title">${STORES[this.store].name}</div><div class="sh-greet">${STORES[this.store].greet}</div>`
      : this.mode === 'board'
        ? `<div class="sh-title">CONTRATS DE FRET</div><div class="sh-greet">Quai de fret · aire 02 · paiement à la livraison.</div>`
        : `<div class="sh-title">INVENTAIRE</div><div class="sh-greet">Équipement personnel, vaisseau et objets.</div>`;
    const tabs = this.mode === 'store'
      ? [['buy', 'Acheter'], ['sell', 'Vendre']]
      : this.mode === 'board' ? [['offers', 'Offres'], ['active', `En cours (${this.missions.active.length})`]]
        : [['perso', 'Personnage'], ['ship', 'Héron Mk II'], ['bag', 'Sac']];
    let body = '';
    if (this.mode === 'store') body = this.tab === 'buy' ? this._buyList() : this._sellList();
    else if (this.mode === 'board') body = this.tab === 'offers' ? this._offers() : this._activeJobs();
    else if (this.tab === 'perso') body = this._persoPanel();
    else if (this.tab === 'ship') body = this._shipPanel();
    else body = this._bagPanel();
    const prev = this.root.querySelector('.sh-body');
    const scroll = prev && this._lastView === this.mode + this.tab + this.store ? prev.scrollTop : 0;
    this._lastView = this.mode + this.tab + this.store;
    this.root.innerHTML = `
      <div class="sh-panel">
        <div class="sh-head">${head}<div class="sh-cred">${fmt(S.credits)}</div><button class="sh-x" data-a="close">✕</button></div>
        <div class="sh-tabs">${tabs.map(([k, n]) => `<button data-a="tab" data-v="${k}" class="${this.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        ${this.msg ? `<div class="sh-msg ${this.bad ? 'bad' : ''}">${this.msg}</div>` : ''}
        <div class="sh-body">${body}</div>
      </div>`;
    this.root.querySelector('.sh-body').scrollTop = scroll;
  }

  _stats(it) { return it.stats ? `<div class="sh-stats">${Object.entries(it.stats).map(([k, v]) => `<span><i>${k}</i> ${v}</span>`).join('')}</div>` : ''; }

  _storeItems() {
    const st = STORES[this.store];
    return ITEMS.filter((i) => st.cats.includes(i.cat) && i.price > 0 && (!st.filter || st.filter(i)));
  }

  _buyList() {
    const S = this.state;
    let last = null, h = '';
    for (const it of this._storeItems()) {
      if (it.cat !== last) { h += `<div class="sh-cat">${CATEGORIES[it.cat]}</div>`; last = it.cat; }
      const own = S.count(it.id), equipable = ['sidearm', 'primary', 'outfit', 'armor'].includes(it.cat);
      const worn = equipable && S.person(this.who)[it.cat] === it.id;
      const can = S.credits >= it.price;
      h += `<div class="sh-item">
        <div class="sh-main"><b>${it.name}</b><p>${it.desc}</p>${this._stats(it)}</div>
        <div class="sh-side"><div class="sh-price">${fmt(it.price)}</div>
          ${own ? `<div class="sh-own">Possédé ×${own}</div>` : ''}
          <button data-a="buy" data-v="${it.id}" ${can ? '' : 'disabled'}>${it.eat ? 'Commander' : 'Acheter'}</button>
          ${equipable && own && !worn ? `<button class="sec" data-a="equip" data-v="${it.id}">Équiper</button>` : ''}
          ${worn ? '<div class="sh-own on">Porté</div>' : ''}
        </div></div>`;
    }
    return h;
  }

  _sellList() {
    const S = this.state, st = STORES[this.store];
    const list = ITEMS.filter((i) => st.cats.includes(i.cat) && S.count(i.id) > 0 && i.price > 0);
    if (!list.length) return '<div class="sh-empty">Vous n\'avez rien que ce magasin rachète.</div>';
    return list.map((it) => {
      const free = S.free(it.id);
      return `<div class="sh-item"><div class="sh-main"><b>${it.name}</b><p>Possédé ×${S.count(it.id)}${free < S.count(it.id) ? ` · ${S.count(it.id) - free} équipé(s)` : ''}</p></div>
        <div class="sh-side"><div class="sh-price">${fmt(S.sellPrice(it.id))}</div><button data-a="sell" data-v="${it.id}" ${free > 0 ? '' : 'disabled'}>Vendre</button></div></div>`;
    }).join('');
  }

  _select(kind, slot, current, options, allowNone) {
    const opts = [];
    if (allowNone) opts.push(`<option value="">— aucun —</option>`);
    for (const it of options) opts.push(`<option value="${it.id}" ${it.id === current ? 'selected' : ''}>${it.name}${it.id === current ? '' : ` (×${this.state.free(it.id)})`}</option>`);
    return `<select data-a="${kind}" data-v="${slot}">${opts.join('')}</select>`;
  }

  _persoPanel() {
    const S = this.state, p = S.person(this.who);
    const people = Object.keys(S.d.people);
    let h = '';
    if (people.length > 1) h += `<div class="sh-row"><label>Personne</label><select data-a="who">${people.map((w) => `<option value="${w}" ${w === this.who ? 'selected' : ''}>${w === 'me' ? 'Moi' : S.d.people[w].name || w}</option>`).join('')}</select></div>`;
    for (const sl of PERSON_SLOTS) {
      const options = ITEMS.filter((i) => i.cat === sl.cat && (S.free(i.id) > 0 || p[sl.id] === i.id));
      const cur = p[sl.id] ? ITEM[p[sl.id]] : null;
      h += `<div class="sh-slot"><div class="sh-sname">${sl.name}</div>${this._select('pslot', sl.id, p[sl.id], options, sl.id !== 'outfit')}
        ${cur ? this._stats(cur) : ''}</div>`;
    }
    return h + '<div class="sh-note">Astuce : passez en vue 3e personne (V) pour voir votre tenue.</div>';
  }

  _shipPanel() {
    const S = this.state, ok = this.canEquipShip();
    let h = ok ? '' : '<div class="sh-msg bad">Le Héron doit être posé sur son aire pour changer d\'équipement.</div>';
    for (const sl of HERON_SLOTS) {
      const cur = S.d.ship[sl.id];
      const options = ITEMS.filter((i) => sl.cats.includes(i.cat) && (!sl.size || i.size <= sl.size) && (S.free(i.id) > 0 || cur === i.id));
      h += `<div class="sh-slot"><div class="sh-sname">${sl.name}${sl.size ? ` <i>taille ≤ ${sl.size}</i>` : ''}</div>
        ${ok ? this._select('sslot', sl.id, cur, options, sl.id !== 'shield') : `<div class="sh-fixed">${cur ? ITEM[cur].name : '— vide —'}</div>`}
        ${cur ? this._stats(ITEM[cur]) : ''}</div>`;
    }
    return h;
  }

  _bagPanel() {
    const S = this.state;
    const list = ITEMS.filter((i) => S.count(i.id) > 0);
    if (!list.length) return '<div class="sh-empty">Sac vide.</div>';
    return list.map((it) => `<div class="sh-item"><div class="sh-main"><b>${it.name}</b><p>${CATEGORIES[it.cat]} · ×${S.count(it.id)}${S.inUse(it.id) ? ` · ${S.inUse(it.id)} équipé(s)` : ''}</p></div>
      <div class="sh-side">${it.cat === 'consumable' ? `<button data-a="use" data-v="${it.id}">Utiliser</button>` : ''}</div></div>`).join('');
  }

  _offers() {
    const M = this.missions;
    return M.offers.slice(0, 6).map((o) => `<div class="sh-item"><div class="sh-main"><b>${o.title}</b><p>${o.route} · ${o.km.toFixed(1).replace('.', ',')} km · ${o.client}</p><p>${o.desc}</p></div>
      <div class="sh-side"><div class="sh-price">${fmt(o.reward)}</div><button data-a="accept" data-v="${o.id}">Accepter</button></div></div>`).join('');
  }

  _activeJobs() {
    const M = this.missions;
    if (!M.active.length) return '<div class="sh-empty">Aucun contrat en cours. Consultez l\'onglet Offres.</div>';
    return M.active.map((o) => `<div class="sh-item"><div class="sh-main"><b>${o.title}</b><p>${o.route} · ${o.client}</p><p class="sh-step">▸ ${M.status(o)}</p></div>
      <div class="sh-side"><div class="sh-price">${fmt(o.reward)}</div><button class="sec" data-a="abandon" data-v="${o.id}">Abandonner</button></div></div>`).join('')
      + '<div class="sh-note">Abandonner coûte 10 % de la prime. Les caisses du contrat sont retirées.</div>';
  }

  _click(e) {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a, v = b.dataset.v, S = this.state;
    if (a === 'close') return this.close();
    if (a === 'tab') { this.tab = v; this.msg = ''; return this.render(); }
    if (a === 'accept') {
      const o = this.missions.offers.find((x) => x.id === +v);
      const err = this.missions.accept(o);
      if (err) return this.flash(err, true);
      this.tab = 'active'; this.onAction('accept', o);
      return this.flash(o.type === 'out' ? `${o.n} caisses vous attendent sur le quai de fret.` : o.type === 'container' ? 'Le conteneur est chargé dans votre soute.' : `Rendez-vous à ${o.dest.name} pour charger.`);
    }
    if (a === 'abandon') { const o = this.missions.active.find((x) => x.id === +v); this.missions.abandon(o); return this.flash('Contrat abandonné.', true); }
    if (a === 'buy') {
      const it = ITEM[v];
      if (!S.buy(v)) return this.flash('Crédits insuffisants.', true);
      this.onAction('buy', it);
      if (it.eat) return this.flash(`${it.name} — bon appétit !`);
      // un vêtement ou une arme acheté est porté tout de suite si l'emplacement est libre ou si c'est une tenue
      if (['outfit', 'armor'].includes(it.cat) || (['sidearm', 'primary'].includes(it.cat) && !S.person(this.who)[it.cat])) { S.equip(this.who, it.cat, v); this.onAction('equip', it); }
      if (['shipWeapon', 'turret', 'shield'].includes(it.cat)) {
        const free = HERON_SLOTS.find((s) => s.cats.includes(it.cat) && (!s.size || it.size <= s.size) && !S.d.ship[s.id]);
        if (free && this.canEquipShip()) { S.install(free.id, v); this.onAction('install', it); return this.flash(`${it.name} installé : ${free.name}.`); }
        return this.flash(`${it.name} livré. Installez-le depuis l'inventaire (I), onglet Héron.`);
      }
      return this.flash(`${it.name} acheté.`);
    }
    if (a === 'equip') { S.equip(this.who, ITEM[v].cat, v); this.onAction('equip', ITEM[v]); return this.flash(`${ITEM[v].name} équipé.`); }
    if (a === 'sell') { const p = S.sellPrice(v); if (S.sell(v)) { this.onAction('sell', ITEM[v]); this.flash(`Vendu : +${fmt(p)}`); } return; }
    if (a === 'use') { if (S.use(v)) { this.onAction('use', ITEM[v]); this.flash(`${ITEM[v].name} utilisé.`); } }
  }

  _change(e) {
    const t = e.target, S = this.state;
    if (t.dataset.a === 'who') { this.who = t.value; return this.render(); }
    if (t.dataset.a === 'pslot') { S.equip(this.who, t.dataset.v, t.value || null); this.onAction('equip', ITEM[t.value]); }
    if (t.dataset.a === 'sslot') { if (!S.install(t.dataset.v, t.value || null)) this.flash('Incompatible avec cet emplacement.', true); else this.onAction('install', ITEM[t.value]); }
  }
}
