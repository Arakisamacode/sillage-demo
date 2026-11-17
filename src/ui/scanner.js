import * as THREE from 'three';

// Mode analyse (touche C / bouton SCAN) : filtre holographique, balayage, étiquettes d'identification des personnes
// (nom, fonction) et des points d'intérêt, entrées du codex débloquées en analysant les éléments remarquables.
// Codex (touche K) : encyclopédie de la station et du secteur, enrichie au fil des analyses.

const FIRST = ['Aurel', 'Liv', 'Noé', 'Sasha', 'Tarek', 'Inès', 'Malo', 'Yara', 'Kenji', 'Elsa', 'Ivo', 'Nadia', 'Oren', 'Lina', 'Bastien', 'Mei', 'Rafael', 'Talia', 'Sven', 'Adèle', 'Kofi', 'Zélie', 'Dario', 'Anouk'];
const LAST = ['Varenne', 'Okafor', 'Lindqvist', 'Moreau', 'Haddad', 'Sato', 'Kovač', 'Delmas', 'Ferreira', 'Nakamura', 'Brandt', 'Achour', 'Petrov', 'Laurier', 'Mensah', 'Quist', 'Ibarra', 'Vasseur'];
const nameFor = (k) => `${FIRST[(k * 7 + 3) % FIRST.length]} ${LAST[(k * 13 + 5) % LAST.length]}`;

export const CODEX = {
  halden: { t: 'Halden-7', cat: 'Lieux', x: 'Station orbitale bâtie il y a deux siècles pour les chantiers navals du secteur. Cent quarante mille habitants. Les chantiers ont fermé ; la station vit du fret, des réparations et du commerce de La Couronne.' },
  hangar: { t: 'Hangar 07', cat: 'Lieux', x: 'Hangar d\'appontage pressurisé, champ de confinement sur la baie. Cinq aires, quai de fret, manutention automatisée. Les alertes d\'intrusion y sont plus fréquentes qu\'on ne l\'avoue.' },
  heron: { t: 'Héron (votre vaisseau)', cat: 'Vaisseaux', x: 'Cargo léger polyvalent, deux points d\'emport d\'aile, menton, tourelle dorsale optionnelle, module de minage ventral. Robuste, réparable partout, jamais élégant.' },
  mulet: { t: 'Mulet H4', cat: 'Vaisseaux', x: 'Transporteur lourd à soute modulaire. Lent, increvable, il assure l\'essentiel du ravitaillement de Halden-7.' },
  faucon: { t: 'Faucon FC-31', cat: 'Vaisseaux', x: 'Chasseur d\'escorte monoplace. Celui-ci est en maintenance : trappes ouvertes, câbles de diagnostic branchés.' },
  navette: { t: 'Navette ST-40', cat: 'Vaisseaux', x: 'Navette de ligne Halden–terminus. Quarante passagers, horaires approximatifs, café tiède.' },
  yacht: { t: 'Aérodyne Série 9', cat: 'Vaisseaux', x: 'Yacht stellaire de luxe : coque nacrée, suites, saut quantique de 72 Gm. 48,5 millions de crédits, livraison en quatorze mois.' },
  couronne: { t: 'La Couronne', cat: 'Lieux', x: 'Étage de prestige sous coupole nervurée, 44 m de diamètre. Haute couture, combinaisons sur mesure, yachts. Sa construction a coûté plus cher que tout le reste de la station.' },
  orrery: { t: 'Sculpture orbitale', cat: 'Culture', x: 'Œuvre centrale de La Couronne : un cœur lumineux et trois anneaux d\'or figurant les orbites des stations du secteur, au temps de leur prospérité.' },
  sphere: { t: 'Sphère des tendances', cat: 'Culture', x: 'Instrument d\'Iréna Solvay. Chaque point est une trajectoire de vie ; chaque anneau, une équation. Ensemble, ils dessinent l\'avenir probable des foules — jamais celui d\'un individu.' },
  cour: { t: 'Cour des Saveurs', cat: 'Lieux', x: 'Salle de restauration du pont habitat : dix restaurants sous verrière, de la cuisine du Dragon de Jade aux pizzas du Vesuvio. Le cœur social de la station.' },
  breche: { t: 'Les Fils de la Brèche', cat: 'Factions', x: 'Pirates issus d\'équipages ruinés. Ils frappent les routes de fret près de la ceinture d\'Ardent. Certains disent qu\'ils sont payés pour accélérer le déclin des stations.' },
  lys: { t: 'Station agricole Lys', cat: 'Lieux', x: 'Serres orbitales et coopérative : Lys nourrit la moitié du secteur. Son vieux relais de communication échappe aux péages.' },
};

export class Scanner {
  constructor(ctx, { game, toast, audio }) {
    this.ctx = ctx; this.game = game; this.toast = toast; this.audio = audio;
    this.on = false; this.t = 0;
    game.d.codex ||= ['halden', 'hangar', 'heron'];
    const ov = document.createElement('div'); ov.id = 'scan'; ov.className = 'hidden';
    ov.innerHTML = '<div class="scan-sweep"></div><div class="scan-head">ANALYSE · <span></span></div><div class="scan-tags"></div>';
    document.body.appendChild(ov);
    this.ov = ov; this.tags = ov.querySelector('.scan-tags'); this.head = ov.querySelector('.scan-head span');
    this.pool = [];
    const cx = document.createElement('div'); cx.id = 'codex'; cx.className = 'hidden';
    document.body.appendChild(cx); this.cx = cx;
    this.points = [];      // { pos, id, label }
  }
  addPoint(pos, id, label) { this.points.push({ pos, id, label }); }
  toggle(force) {
    this.on = force ?? !this.on;
    this.ov.classList.toggle('hidden', !this.on);
    document.body.classList.toggle('scanning', this.on);
    this.audio?.blip?.();
    if (!this.on) for (const e of this.pool) e.style.display = 'none';
  }
  unlock(id) {
    const c = this.game.d.codex;
    if (c.includes(id) || !CODEX[id]) return;
    c.push(id); this.game.save();
    this.toast(`Codex : ${CODEX[id].t} · ${c.length}/${Object.keys(CODEX).length} (K pour consulter)`);
  }
  _tag(i) {
    let e = this.pool[i];
    if (!e) { e = document.createElement('div'); e.className = 'scan-tag'; e.innerHTML = '<b></b><span></span>'; this.tags.appendChild(e); this.pool.push(e); }
    return e;
  }
  /** people : [{ obj (Object3D), name, role, key }] ; pois : interactables [{ pos, label }] */
  update(dt, camera, people, pois) {
    if (!this.on) return;
    this.t += dt;
    const W = innerWidth, H = innerHeight, P = camera.position, v = new THREE.Vector3();
    const list = [];
    for (const p of people) {
      if (!p.obj.visible) continue;
      v.copy(p.obj.position); v.y += 2.05;
      const d = v.distanceTo(P); if (d > 26) continue;
      list.push({ d, w: v.clone(), a: p.name, b: p.role, cls: 'person' });
    }
    for (const it of pois) {
      if (/S'asseoir|Se lever|Ascenseur en mouvement/.test(it.label) || (it.when && !it.when())) continue;
      v.copy(it.pos); v.y += 1.3;
      const d = v.distanceTo(P); if (d > 18) continue;
      list.push({ d, w: v.clone(), a: it.label.replace(/^E — /, '').split(' : ')[0].split(' (')[0], b: 'interaction', cls: 'poi' });
    }
    let unlocked = 0;
    for (const pt of this.points) {
      const d = pt.pos.distanceTo(P); if (d > 40) continue;
      const known = this.game.d.codex.includes(pt.id);
      list.push({ d, w: pt.pos.clone(), a: pt.label, b: known ? 'codex · connu' : 'codex · analyse…', cls: 'codex' });
      if (!known) { v.copy(pt.pos).project(camera); if (Math.abs(v.x) < 0.35 && Math.abs(v.y) < 0.4 && v.z < 1 && d < 30) { pt.scan = (pt.scan || 0) + dt; if (pt.scan > 1.2) { this.unlock(pt.id); unlocked++; } } }
    }
    list.sort((a, b) => a.d - b.d);
    let n = 0;
    for (const L of list) {
      if (n >= 18) break;
      v.copy(L.w).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
      const e = this._tag(n++);
      e.style.display = 'block'; e.className = 'scan-tag ' + L.cls;
      e.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px)`;
      e.firstChild.textContent = L.a; e.lastChild.textContent = `${L.b} · ${L.d.toFixed(0)} m`;
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].style.display = 'none';
    this.head.textContent = `${list.filter((x) => x.cls === 'person').length} personnes · codex ${this.game.d.codex.length}/${Object.keys(CODEX).length}`;
  }
  // ------------------------------------------------------------------ codex
  get codexOpen() { return !this.cx.classList.contains('hidden'); }
  openCodex(onClose) {
    const known = this.game.d.codex;
    const cats = {};
    for (const [id, e] of Object.entries(CODEX)) (cats[e.cat] ||= []).push([id, e]);
    this.cx.innerHTML = `<div class="cx-panel"><div class="cx-title">CODEX · ${known.length}/${Object.keys(CODEX).length}<button>Fermer</button></div><div class="cx-body">${
      Object.entries(cats).map(([cat, list]) => `<h4>${cat}</h4>${list.map(([id, e]) => known.includes(id)
        ? `<details><summary>${e.t}</summary><p>${e.x}</p></details>`
        : '<div class="cx-lock">▒▒▒▒▒▒ · à analyser (mode C)</div>').join('')}`).join('')}</div></div>`;
    this.cx.classList.remove('hidden');
    const close = () => { this.cx.classList.add('hidden'); onClose?.(); };
    this.cx.querySelector('button').addEventListener('click', close);
    this._esc = (e) => { if (e.code === 'Escape' || e.code === 'KeyK') { removeEventListener('keydown', this._esc); close(); } };
    addEventListener('keydown', this._esc);
  }
}
export { nameFor };
