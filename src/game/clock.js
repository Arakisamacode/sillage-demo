import { RESTAURANTS, GARDEN_SHOPS } from './food.js';

// Horloge de la station : temps accéléré (1 s réelle = 48 s à bord, une journée = 30 min de jeu).
// Horaires d'ouverture des boutiques, nuit (galerie vide, éclairage réduit).

export const HOURS = {
  nouilles: [7, 24], armes: [9, 21], pieces: [8, 20], pharma: [0, 24], combis: [10, 21],
  kiosque: [6, 23], galerie: [7, 23],
  ...Object.fromEntries([...RESTAURANTS, ...GARDEN_SHOPS].map((r) => [r.id, r.hours])), dome: [0, 24],
};

export class StationClock {
  constructor(startHour = 8.6, scale = 48) {
    this.sec = startHour * 3600;
    this.scale = scale;
  }
  update(dt) { this.sec = (this.sec + dt * this.scale) % 86400; }
  get hour() { return this.sec / 3600; }
  setHour(h) { this.sec = ((h % 24) + 24) % 24 * 3600; }
  open(id) { const [a, b] = HOURS[id] || [0, 24]; const h = this.hour; return b > 24 ? h >= a || h < b - 24 : h >= a && h < b; }
  opensAt(id) { const [a] = HOURS[id] || [0]; return `${String(a).padStart(2, '0')}:00`; }
  get night() { const h = this.hour; return h >= 22 || h < 6; }
  /** 0 (jour) à 1 (nuit), avec transitions au crépuscule (20 h–22 h) et à l'aube (6 h–7 h). */
  get dusk() { const h = this.hour; if (h >= 22 || h < 6) return 1; if (h >= 20) return (h - 20) / 2; if (h < 7) return 1 - (h - 6); return 0; }
  get label() {
    const h = Math.floor(this.hour), m = Math.floor((this.sec % 3600) / 60);
    const part = h < 6 ? 'nuit' : h < 12 ? 'matin' : h < 18 ? 'après-midi' : h < 22 ? 'soir' : 'nuit';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${part}`;
  }
}
