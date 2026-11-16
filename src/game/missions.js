import * as THREE from 'three';

// Contrats de fret : livraisons de caisses (Halden-7 → avant-poste), collectes (avant-poste → Halden-7)
// et conteneurs (chargés par la manutention). Paiement à la livraison.

const CLIENTS = ['Halden Logistique', 'Transports Merle & Fils', 'Coopérative Lys', 'Ardent Minéraux', 'Corvin Négoce', 'Clinique Orbitale Saint-Aubin', 'Atelier Vasseur'];
const GOODS = [
  { name: 'pièces détachées', color: 0x3d4a5a, tag: 0x5fe6ff },
  { name: 'vivres', color: 0x5c6b4a, tag: 0x9aff7a },
  { name: 'matériel médical', color: 0xd8dcdc, tag: 0xff4a4a },
  { name: 'filtres à eau', color: 0x2f5e8a, tag: 0x7fd8ff },
  { name: 'semences', color: 0x6a5a3a, tag: 0xc8ff5a },
  { name: 'charges de forage', color: 0x8a5a2a, tag: 0xffa040 },
  { name: 'électronique', color: 0x2a2c30, tag: 0x6fb8ff },
  { name: 'minerai raffiné', color: 0x6a6e70, tag: 0xffd040 },
];
let seq = 1;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (n) => n.toLocaleString('fr-FR').replace(/ /g, ' ') + ' ¤';

export class Missions {
  constructor(ctx, cargo, outposts, game, flight) {
    this.ctx = ctx; this.cargo = cargo; this.outposts = outposts; this.game = game; this.flight = flight;
    this.offers = [];
    this.active = [];
    this.onEvent = () => {};
    this.home = new THREE.Vector3(0, 12, -46); // entrée de la baie du hangar
    for (let i = 0; i < 6; i++) this.offers.push(this._offer(i));
    cargo.onDrop = () => this._checkQuai();
  }

  _offer(i = Math.floor(Math.random() * 3)) {
    const dest = pick(this.outposts), g = pick(GOODS);
    const km = dest.center.distanceTo(this.home) / 1000;
    const type = ['out', 'in', 'raid', 'container', 'in', 'out'][i % 6];
    const n = type === 'container' ? 1 : type === 'raid' ? 0 : 2 + Math.floor(Math.random() * 5);
    const reward = Math.round((type === 'raid' ? 4800 + km * 700 : type === 'container' ? 6500 + km * 1100 : n * 620 + km * 380) / 50) * 50;
    const client = type === 'raid' ? `Sécurité de ${dest.name}` : type === 'in' ? pick(CLIENTS.filter((c) => c !== 'Halden Logistique')) : pick(CLIENTS);
    const o = { id: seq++, type, dest, goods: g.name, n, reward, client, crateColor: g.color, tagColor: g.tag, step: 'new' };
    o.short = `${g.name} · ${dest.name}`;
    o.title = type === 'raid' ? `Sécurité : repousser un raid à ${dest.name}` : type === 'out' ? `Livraison : ${n} caisses de ${g.name}` : type === 'in' ? `Collecte : ${n} caisses de ${g.name}` : `Conteneur de ${g.name}`;
    o.route = type === 'in' ? `${dest.name} → Halden-7` : `Halden-7 → ${dest.name}`;
    o.desc = type === 'raid'
      ? `Des pirates ont pris pied sur le pont de ${dest.name}. Posez-vous, descendez armé (G) et éliminez-les. Vos gardes descendent avec vous.`
      : type === 'out'
      ? `Prenez les caisses sur le quai de fret (aire 02), portez-les dans la soute du Héron puis livrez-les à ${dest.name}.`
      : type === 'in'
        ? `Chargez la marchandise à ${dest.name}, ramenez-la à Halden-7 et déposez chaque caisse sur le quai de fret.`
        : `La manutention charge un conteneur dans votre soute (4 rangées). Livraison à ${dest.name}.`;
    o.km = km;
    return o;
  }

  board() { return this.offers.slice(0, 5).map((o) => `${o.type === 'in' ? '◂' : '▸'} ${o.dest.name} · ${fmt(o.reward)}`); }

  accept(o) {
    if (this.active.length >= 3) return 'Trois contrats au maximum en même temps.';
    if (o.type === 'raid') {
      if (this.active.some((x) => x.type === 'raid' && x.dest === o.dest)) return 'Un contrat de sécurité est déjà en cours sur cet avant-poste.';
      o.step = 'go';
    } else if (o.type === 'out') {
      if (this.cargo.quaiFree() < o.n) return 'Le quai de fret est encombré : chargez d\'abord les caisses déjà déposées.';
      for (let i = 0; i < o.n; i++) this.cargo.spawn(o, 'ground');
      o.step = 'load';
    } else if (o.type === 'container') {
      if (this.flight.state !== 'parked' || this.flight.dockedAt !== this.flight.home) return 'Le Héron doit être posé sur l\'aire 02 pour la manutention.';
      if (!this.cargo.loadContainer(o)) return 'Les quatre premières rangées de la soute doivent être libres pour un conteneur.';
      o.step = 'deliver';
    } else o.step = 'pickup';
    this.offers = this.offers.filter((x) => x !== o);
    this.offers.push(this._offer());
    this.active.push(o);
    this.onEvent('accept', o);
    return null;
  }

  abandon(o) {
    this.cargo.removeContract(o);
    this.active = this.active.filter((x) => x !== o);
    const fee = Math.round(o.reward * 0.1);
    this.game.pay(Math.min(fee, this.game.credits));
    this.onEvent('abandon', o, fee);
  }

  _complete(o) {
    this.active = this.active.filter((x) => x !== o);
    o.step = 'done';
    this.game.earn(o.reward);
    this.onEvent('complete', o);
  }

  /** Avancement lisible d'un contrat. */
  status(o) {
    if (o.type === 'out') {
      const h = this.cargo.inHold(o);
      return h < o.n ? `Charger la soute : ${h}/${o.n} caisses` : `Livrer à ${o.dest.name}`;
    }
    if (o.type === 'container') return `Livrer le conteneur à ${o.dest.name}`;
    if (o.type === 'raid') return o.step === 'fight' ? `Raid en cours à ${o.dest.name} · ${this.ctx.ground?.enemiesLeft() ?? '?'} pirates` : `Se poser à ${o.dest.name} et descendre armé`;
    if (o.step === 'pickup') return `Aller charger à ${o.dest.name}`;
    return `Décharger sur le quai : ${this.cargo.inQuai(o)}/${o.n} caisses`;
  }

  /** Actions possibles une fois posé sur un avant-poste. */
  dockActions(pad) {
    const acts = [];
    for (const o of this.active) {
      if (o.dest.id !== pad.id) continue;
      if ((o.type === 'out' && this.cargo.inHold(o) >= o.n) || o.type === 'container') {
        acts.push({ label: `Livrer ${o.type === 'container' ? 'le conteneur' : `${o.n} caisses`} (${fmt(o.reward)})`, fn: () => { this.cargo.removeContract(o); this._complete(o); } });
      } else if (o.type === 'out') {
        acts.push({ label: `Livraison incomplète : ${this.cargo.inHold(o)}/${o.n} caisses à bord`, fn: () => 'Il manque des caisses : retournez au quai de fret de Halden-7.' });
      } else if (o.type === 'in' && o.step === 'pickup') {
        acts.push({ label: `Charger ${o.n} caisses de ${o.goods}`, fn: () => {
          if (this.cargo.holdFree() < o.n) return 'Pas assez de place dans la soute.';
          for (let i = 0; i < o.n; i++) this.cargo.spawn(o, 'hold');
          o.step = 'return';
          this.onEvent('loaded', o);
        } });
      }
    }
    return acts;
  }

  _checkQuai() {
    for (const o of [...this.active]) {
      if (o.type === 'in' && o.step === 'return' && this.cargo.inQuai(o) >= o.n) {
        const crates = this.cargo.crates.filter((c) => c.contract === o);
        setTimeout(() => { for (const c of crates) this.cargo.remove(c); }, 2500);
        this._complete(o);
      }
    }
  }

  /** Contrat de sécurité de cet avant-poste (en cours), s'il existe. */
  raidFor(outpostId) { return this.active.find((o) => o.type === 'raid' && o.dest.id === outpostId); }
  raidCleared(outpostId) { const o = this.raidFor(outpostId); if (o) this._complete(o); return o; }

  /** Prochaine destination à afficher sur le HUD : { pos, name } ou null. */
  navTarget() {
    for (const o of this.active) {
      if (o.type === 'raid' && this.flight.dockedAt !== o.dest.pad) return { pos: o.dest.center, name: `${o.dest.name} · raid pirate` };
      if ((o.type === 'out' && this.cargo.inHold(o) >= o.n) || o.type === 'container' || (o.type === 'in' && o.step === 'pickup')) return { pos: o.dest.center, name: o.dest.name };
      if (o.type === 'in' && o.step === 'return' && this.flight.dockedAt !== this.flight.home) return { pos: this.home, name: 'Halden-7 · hangar 07' };
    }
    return null;
  }
}
