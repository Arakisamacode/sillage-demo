// Messages du HUD : file d'attente (au plus deux messages visibles à la fois), durée d'affichage selon la longueur
// du texte, messages urgents (alertes de combat, échecs) prioritaires, et journal des derniers messages consultable
// depuis le menu (Échap). Les minuteries avancent avec la simulation (update(dt)) et s'arrêtent quand le jeu est en pause.

const MAX_VISIBLE = 2;
const LOG_MAX = 20;
const SHORT = 60;        // au-delà : texte en casse normale, sans espacement large
const FADE = 0.3;        // fondu de sortie (s)

/** durée d'affichage : 2,5 s + 1 s par 18 caractères, bornée entre 3 et 10 s */
export const toastDuration = (msg) => Math.min(10, Math.max(3, 2.5 + String(msg).length / 18));

export class Notifier {
  /** el : conteneur #toast ; clock() : heure du jeu « HH:MM » pour le journal */
  constructor(el, { clock = () => '' } = {}) {
    this.el = el; this.clock = clock;
    this.visible = [];     // { text, urgent, t, dur, node, out }
    this.queue = [];       // { text, urgent, dur }
    this.log = [];         // { time, text, urgent, n } (plus récent en dernier)
    this.paused = false;
    this.onLog = null;
  }

  /** Ajoute un message. opts : { urgent: true } passe devant la file ; { duration } impose la durée (s). */
  push(msg, opts = {}) {
    if (msg == null || msg === '') return;
    const text = String(msg), urgent = !!opts.urgent;
    const dur = opts.duration || toastDuration(text);
    // déjà à l'écran : on relance simplement son minuteur (le journal compte la répétition)
    const v = this.visible.find((x) => x.text === text && !x.out);
    if (v) { const e = this.log.findLast((x) => x.text === text); if (e) { e.n++; e.time = this.clock(); this.onLog?.(); } else this._log(text, urgent); }
    else this._log(text, urgent);
    if (v) { v.t = 0; v.dur = Math.max(v.dur, dur); if (urgent && !v.urgent) { v.urgent = true; v.node.classList.add('urgent'); } return; }
    // déjà en attente : pas de doublon (un message urgent remonte en tête)
    const qi = this.queue.findIndex((x) => x.text === text);
    if (qi >= 0) { if (urgent && !this.queue[qi].urgent) { this.queue.splice(qi, 1); } else return; }
    const item = { text, urgent, dur };
    if (urgent) {
      this.queue.splice(this.queue.filter((x) => x.urgent).length, 0, item);
      // plus de place : le plus ancien message ordinaire laisse la sienne (il reprend en file s'il vient d'apparaître)
      if (this._live() >= MAX_VISIBLE) {
        const old = this.visible.find((x) => !x.out && !x.urgent);
        if (old) {
          if (old.t < 1.5) this.queue.splice(this.queue.filter((x) => x.urgent).length, 0, { text: old.text, urgent: false, dur: old.dur });
          this._remove(old, true);
        }
      }
    } else {
      this.queue.push(item);
      // file trop longue : les plus anciens messages ordinaires restent consultables dans le journal
      while (this.queue.length > 5) { const i = this.queue.findIndex((x) => !x.urgent); if (i < 0) break; this.queue.splice(i, 1); }
    }
    this._fill();
  }

  update(dt) {
    if (this.paused || !dt) return;
    const backlog = this.queue.length >= 2;
    for (const v of [...this.visible]) {
      v.t += dt;
      if (v.out) { if (v.t >= FADE) this._remove(v, true); continue; }
      // messages en attente : on écourte un peu ceux qui sont déjà lus (3 s minimum)
      const dur = backlog && !v.urgent ? Math.max(3, v.dur * 0.7) : v.dur;
      if (v.t >= dur) { v.out = true; v.t = 0; v.node.classList.add('out'); }
    }
    this._fill();
  }

  /** vide l'écran et la file (le journal est conservé) */
  clear() { for (const v of [...this.visible]) this._remove(v, true); this.queue.length = 0; this._sync(); }

  get current() { return this.visible.filter((v) => !v.out).map((v) => v.text); }

  _live() { return this.visible.filter((v) => !v.out).length; }
  _fill() {
    while (this.queue.length && this._live() < MAX_VISIBLE) this._show(this.queue.shift());
    this._sync();
  }
  _show({ text, urgent, dur }) {
    const node = document.createElement('div');
    node.className = `tn ${text.length > SHORT ? 'long' : 'short'}${urgent ? ' urgent' : ''}`;
    node.textContent = text;
    this.el.appendChild(node);
    this.visible.push({ text, urgent, dur, t: 0, node, out: false });
  }
  _remove(v, now) {
    const i = this.visible.indexOf(v);
    if (i >= 0) this.visible.splice(i, 1);
    if (now) v.node.remove();
  }
  _sync() { this.el.classList.toggle('hidden', this.visible.length === 0); }
  _log(text, urgent) {
    const last = this.log[this.log.length - 1];
    if (last && last.text === text) { last.n++; last.time = this.clock(); }
    else {
      this.log.push({ time: this.clock(), text, urgent, n: 1 });
      if (this.log.length > LOG_MAX) this.log.shift();
    }
    this.onLog?.();
  }
}
