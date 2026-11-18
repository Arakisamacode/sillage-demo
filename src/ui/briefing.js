// Briefing de mission (table holographique du hangar, ou au lancement d'une mission du récit) :
// carte du secteur animée avec l'itinéraire, objectifs, niveau de menace, escadrille à engager (portraits).

const STATIONS = { halden: { n: 'Halden-7', p: [0, 0] }, corvin: { n: 'Relais Corvin', p: [-1500, -2400] }, ardent: { n: 'Ardent-3', p: [2100, -3300] }, lys: { n: 'Lys', p: [-300, -4800] } };

export class Briefing {
  constructor({ game, audio, wing, pilots, onClose }) {
    Object.assign(this, { game, audio, wing, pilots, onClose });
    const el = document.createElement('div'); el.id = 'brief'; el.className = 'hidden';
    document.body.appendChild(el); this.el = el;
  }
  get open() { return !this.el.classList.contains('hidden'); }
  /** m : { title, text, dest (clé de station ou null), threat 0-3, objectives: [..], wing: 'offered' | 'hire' } */
  show(m) {
    this.m = m;
    const W = this.wing, price = 2000;
    const cards = this.pilots.map((P) => {
      const offered = m.wing === 'offered', hired = offered || W.hired.has(P.id);
      return `<div class="br-pilot ${hired ? 'on' : ''}" data-id="${P.id}"><img src="${W.portraits[P.id] || ''}" alt=""><div><b>${P.call}</b><span>${P.name}</span>
        <button ${offered ? 'disabled' : ''}>${offered ? 'Affecté à la mission' : hired ? 'Engagé · annuler' : `Engager · ${price.toLocaleString('fr-FR')} ¤`}</button></div></div>`;
    }).join('');
    this.el.innerHTML = `<div class="br-panel">
      <div class="br-head"><span>BRIEFING · ESCADRILLE DE HALDEN</span><button class="br-x">Fermer</button></div>
      <div class="br-body">
        <canvas width="420" height="420"></canvas>
        <div class="br-info">
          <h3>${m.title}</h3>
          <p>${m.text}</p>
          <ul>${(m.objectives || []).map((o) => `<li>${o}</li>`).join('')}</ul>
          <div class="br-threat">Menace : ${'▮'.repeat(m.threat || 0)}${'▯'.repeat(3 - (m.threat || 0))}</div>
          <h4>Ailiers</h4><div class="br-pilots">${cards}</div>
          <button class="br-go">${m.go || 'Compris'}</button>
        </div>
      </div></div>`;
    this.el.classList.remove('hidden');
    this.el.querySelector('.br-x').onclick = () => this.close();
    this.el.querySelector('.br-go').onclick = () => this.close();
    for (const card of this.el.querySelectorAll('.br-pilot')) {
      const b = card.querySelector('button');
      b.onclick = () => {
        const id = card.dataset.id;
        if (W.hired.has(id)) { W.hire(id, false); this.game.earn(price); }
        else { if (!this.game.pay(price)) { b.textContent = 'Crédits insuffisants'; return; } W.hire(id, true); }
        this.audio?.blip?.(); this.show(m);
      };
    }
    this._draw(m);
    if (m.voice !== false) this.audio?.speakAs?.(`${m.title}. ${m.text}`, { pitch: 0.95, rate: 1.05, idx: 2 });
    this._esc = (e) => { if (e.code === 'Escape') this.close(); };
    addEventListener('keydown', this._esc);
  }
  close() {
    if (!this.open) return;
    this.el.classList.add('hidden'); cancelAnimationFrame(this._raf);
    removeEventListener('keydown', this._esc);
    if (window.speechSynthesis) speechSynthesis.cancel();
    this.onClose?.();
  }
  _draw(m) {
    const cv = this.el.querySelector('canvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const sx = (p) => W / 2 + p[0] * 0.062, sy = (p) => H * 0.82 + p[1] * 0.062;
    const t0 = performance.now();
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      g.fillStyle = '#04101a'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(90,180,220,.12)'; g.lineWidth = 1;
      for (let i = 0; i <= W; i += 30) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); }
      // ceinture d'Ardent et zone pirate
      const A = STATIONS.ardent.p;
      g.fillStyle = 'rgba(200,180,150,.25)';
      for (let k = 0; k < 160; k++) { const a = k * 2.39, r = 18 + (k * 7 % 16); g.fillRect(sx(A) + Math.cos(a) * r, sy(A) + Math.sin(a) * r, 1.5, 1.5); }
      g.strokeStyle = `rgba(255,80,60,${0.35 + Math.sin(t * 4) * 0.25})`; g.lineWidth = 2; g.beginPath(); g.arc(sx(A) - 12, sy(A) + 18, 40, 0, 7); g.stroke();
      g.fillStyle = '#ff6a5a'; g.font = '600 11px monospace'; g.fillText('ZONE PIRATE', sx(A) - 48, sy(A) + 70);
      // routes et stations
      for (const [k, s] of Object.entries(STATIONS)) {
        if (k !== 'halden') { g.strokeStyle = 'rgba(120,210,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx(STATIONS.halden.p), sy(STATIONS.halden.p)); g.lineTo(sx(s.p), sy(s.p)); g.stroke(); }
        g.fillStyle = k === 'halden' ? '#ffd27a' : '#8fe0ff'; g.beginPath(); g.arc(sx(s.p), sy(s.p), k === 'halden' ? 6 : 4.5, 0, 7); g.fill();
        g.fillStyle = '#d8eef8'; g.font = '500 12px sans-serif'; g.fillText(s.n, sx(s.p) + 8, sy(s.p) - 6);
      }
      // itinéraire de la mission
      const D = m.dest && (STATIONS[m.dest]?.p || m.destP);
      if (D) {
        const h = STATIONS.halden.p, k = (t * 0.35) % 1;
        g.setLineDash([8, 6]); g.lineDashOffset = -t * 30; g.strokeStyle = '#ffd27a'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(sx(h), sy(h)); g.lineTo(sx(D), sy(D)); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(sx(h) + (sx(D) - sx(h)) * k, sy(h) + (sy(D) - sy(h)) * k, 3.5, 0, 7); g.fill();
        g.strokeStyle = `rgba(255,210,122,${1 - k})`; g.beginPath(); g.arc(sx(D), sy(D), 8 + k * 22, 0, 7); g.stroke();
        if (m.destName) { g.fillStyle = '#ffd27a'; g.font = '700 12px sans-serif'; g.fillText(m.destName, sx(D) + 10, sy(D) + 16); }
      }
      g.fillStyle = 'rgba(143,224,255,.7)'; g.font = '500 10px monospace'; g.fillText(`SECTEUR HALDEN · ÉCHELLE 1:16 000 · T+${t.toFixed(1)}`, 10, H - 10);
      this._raf = requestAnimationFrame(frame);
    };
    cancelAnimationFrame(this._raf); frame();
  }
}
