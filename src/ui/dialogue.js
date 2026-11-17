import * as THREE from 'three';

// Conversations cinématiques : caméra sur le visage de l'interlocuteur, bandes noires, sous-titres tapés,
// voix de synthèse, roue de réponses (1-6 / clic / toucher) colorée selon le ton :
//   calme (Sérénité, bleu) · ferme (Audace, rouge) · enquête (questions, gris) · neutre (blanc).
// Communications radio (en vol) : fenêtre de transmission avec portrait, parasites et voix.

const TONES = { calme: '#6fb8ff', ferme: '#ff6a5a', enquete: '#9aa6b2', neutre: '#f2ead8' };

export class Dialogue {
  constructor(ctx, { audio, game, onClose }) {
    this.ctx = ctx; this.audio = audio; this.game = game; this.onClose = onClose;
    this.active = false;
    const el = document.createElement('div');
    el.id = 'dlg'; el.className = 'hidden';
    el.innerHTML = `<div class="lb top"></div><div class="lb bot"></div>
      <div class="dlg-who"><b></b><span></span><i class="dlg-rep"></i></div>
      <div class="dlg-say"></div>
      <div class="dlg-wheel"></div>`;
    document.body.appendChild(el);
    this.el = el; this.whoEl = el.querySelector('.dlg-who b'); this.roleEl = el.querySelector('.dlg-who span'); this.repEl = el.querySelector('.dlg-rep');
    this.sayEl = el.querySelector('.dlg-say'); this.wheel = el.querySelector('.dlg-wheel');
    this.cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), ready: false };
    addEventListener('keydown', (e) => {
      if (!this.active) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 6) { e.preventDefault(); this.choose(n - 1); }
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this._skipType(); }
      if (e.code === 'Escape') this.close();
    });
    this.sayEl.addEventListener('pointerdown', () => this._skipType());
    // fenêtre de communication
    const cm = document.createElement('div');
    cm.id = 'comm'; cm.className = 'hidden';
    cm.innerHTML = '<div class="comm-face"><img alt=""><canvas width="96" height="96"></canvas></div><div class="comm-txt"><b></b><span></span></div>';
    document.body.appendChild(cm);
    this.comm = cm; this.commT = 0; this.commQueue = [];
    this._noise = cm.querySelector('canvas').getContext('2d');
  }

  // ------------------------------------------------------------------ conversation
  /** npc : { c: Character, name, role, voice: { pitch, rate } } ; tree : { id: node } ; node : { say, choices: [{ t, tone, next, do, if }] } */
  open(npc, tree, start = 'start') {
    this.npc = npc; this.tree = tree; this.active = true; this.cam.ready = false;
    this.el.classList.remove('hidden');
    document.getElementById('hud')?.classList.add('cine');
    this.whoEl.textContent = npc.name; this.roleEl.textContent = npc.role || '';
    npc.c.inDialog = true;
    this._prevOverride = npc.c.override;
    if (!npc.c.override || npc.c.override === 'idle') npc.c.play('talk', { fade: 0.4 });
    if (!npc.portrait) npc.portrait = this.snapshot(npc.c);
    this.go(start);
  }
  go(id) {
    let node = this.tree[id];
    if (typeof node === 'function') node = node();
    if (!node) return this.close();
    this.node = node;
    const text = typeof node.say === 'function' ? node.say() : node.say;
    this._type(text);
    if (text) this.audio?.speakAs?.(text, this.npc.voice);
    this._rep();
    this.wheel.innerHTML = '';
    const choices = (node.choices || []).filter((c) => !c.if || c.if());
    this.choices = choices;
    const n = choices.length;
    choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'dlg-opt';
      const a = (n === 1 ? 0 : -60 + (120 * i) / (n - 1)) * Math.PI / 180;
      b.style.setProperty('--x', `${Math.cos(a) * 34 - 34}px`); b.style.setProperty('--y', `${Math.sin(a) * 86}px`);
      b.style.setProperty('--c', TONES[c.tone || 'neutre']);
      b.innerHTML = `<i>${i + 1}</i>${c.t}`;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.choose(i); });
      this.wheel.appendChild(b);
    });
    if (!n) this.wheel.innerHTML = '<button class="dlg-opt" style="--c:#f2ead8"><i>1</i>[Terminer]</button>', this.choices = [{ t: 'fin', next: null }], this.wheel.firstChild.addEventListener('pointerdown', () => this.choose(0));
  }
  choose(i) {
    const c = this.choices?.[i];
    if (!c || !this.active) return;
    if (c.tone === 'calme' || c.tone === 'ferme') {
      const r = (this.game.d.rep ||= { serenite: 0, audace: 0, halden: 0 });
      if (c.tone === 'calme') r.serenite++; else r.audace++;
      this.game.save();
    }
    const res = c.do?.();
    if (typeof res === 'string') this.ctx.toast?.(res);
    if (c.next) this.go(c.next); else this.close();
  }
  close() {
    if (!this.active) return;
    this.active = false;
    this.el.classList.add('hidden');
    document.getElementById('hud')?.classList.remove('cine');
    if (this.npc) { this.npc.c.inDialog = false; if (this._prevOverride !== 'talk') { if (this._prevOverride) this.npc.c.play(this._prevOverride, { fade: 0.4 }); else this.npc.c.stop(0.4); } this.npc.c.lookAt(null); }
    if (window.speechSynthesis) speechSynthesis.cancel();
    clearInterval(this._typer);
    this.onClose?.();
  }
  _rep() {
    const r = this.game.d.rep || { serenite: 0, audace: 0, halden: 0 };
    this.repEl.innerHTML = `<em style="color:${TONES.calme}">Sérénité ${r.serenite}</em> · <em style="color:${TONES.ferme}">Audace ${r.audace}</em> · Halden ${r.halden >= 0 ? '+' : ''}${r.halden}`;
  }
  _type(text = '') {
    clearInterval(this._typer);
    this._full = text; let k = 0;
    this.sayEl.textContent = '';
    this._typer = setInterval(() => { k += 2; this.sayEl.textContent = text.slice(0, k); if (k >= text.length) clearInterval(this._typer); }, 22);
  }
  _skipType() { clearInterval(this._typer); this.sayEl.textContent = this._full || ''; }

  /** Caméra de conversation : plan rapproché sur l'interlocuteur, légèrement par-dessus l'épaule du joueur. */
  updateCamera(dt, player) {
    if (!this.active) return;
    const c = this.npc.c, cam = this.ctx.camera;
    const head = new THREE.Vector3();
    (c.bones.Head || c.root).getWorldPosition(head);
    head.y += 0.06;
    const to = new THREE.Vector3().subVectors(player.pos, c.root.position).setY(0);
    if (to.lengthSq() < 0.01) to.set(Math.sin(c.root.rotation.y), 0, Math.cos(c.root.rotation.y));
    to.normalize();
    const right = new THREE.Vector3(to.z, 0, -to.x);
    const want = head.clone().addScaledVector(to, 1.15).addScaledVector(right, 0.32); want.y -= 0.02;
    const look = head.clone().addScaledVector(right, 0.12); look.y -= 0.05;
    if (!this.cam.ready) { this.cam.pos.copy(want); this.cam.look.copy(look); this.cam.ready = true; }
    const k = 1 - Math.exp(-dt * 4);
    this.cam.pos.lerp(want, k); this.cam.look.lerp(look, k);
    cam.position.copy(this.cam.pos); cam.lookAt(this.cam.look);
    // l'interlocuteur se tourne vers le joueur et le regarde
    const yaw = Math.atan2(to.x, to.z);
    if (!c.seated) { let d = yaw - c.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); c.root.rotation.y += d * (1 - Math.exp(-dt * 3)); }
    c.lookAt(cam.position);
  }

  /** Portrait (rendu du visage) pour les communications radio. */
  snapshot(c) {
    try {
      const R = this.ctx.renderer.three, S = 160;
      const rt = new THREE.WebGLRenderTarget(S, S, { colorSpace: THREE.SRGBColorSpace });
      const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
      const head = new THREE.Vector3(); (c.bones.Head || c.root).getWorldPosition(head); head.y += 0.07;
      const fw = new THREE.Vector3(Math.sin(c.root.rotation.y), 0, Math.cos(c.root.rotation.y));
      cam.position.copy(head).addScaledVector(fw, 0.85); cam.position.y += 0.02; cam.lookAt(head);
      const vis = c.root.visible; c.root.visible = true;
      const prev = R.getRenderTarget();
      R.setRenderTarget(rt); R.render(this.ctx.scene, cam); R.setRenderTarget(prev);
      c.root.visible = vis;
      const px = new Uint8Array(S * S * 4); R.readRenderTargetPixels(rt, 0, 0, S, S, px);
      const cv = document.createElement('canvas'); cv.width = cv.height = S;
      const g = cv.getContext('2d'), img = g.createImageData(S, S);
      for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
      g.putImageData(img, 0, 0);
      rt.dispose();
      return cv.toDataURL();
    } catch { return ''; }
  }

  // ------------------------------------------------------------------ communications radio
  /** Transmission : { name, portrait, text, voice } ; mises en file, ~6 s chacune. */
  transmit(msg) { this.commQueue.push(msg); if (this.commT <= 0) this._nextComm(); }
  _nextComm() {
    const m = this.commQueue.shift();
    if (!m) { this.comm.classList.add('hidden'); return; }
    this.comm.classList.remove('hidden');
    this.comm.querySelector('img').src = m.portrait || '';
    this.comm.querySelector('b').textContent = m.name;
    const sp = this.comm.querySelector('span'); sp.textContent = '';
    let k = 0; clearInterval(this._ct); this._ct = setInterval(() => { k += 2; sp.textContent = m.text.slice(0, k); if (k >= m.text.length) clearInterval(this._ct); }, 24);
    this.commT = Math.max(5, m.text.length * 0.065);
    this.audio?.blip?.();
    this.audio?.speakAs?.(m.text, m.voice);
  }
  update(dt) {
    if (this.commT > 0) {
      this.commT -= dt;
      const g = this._noise, d = g.createImageData(96, 96);
      for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = v * 0.6; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = Math.random() < 0.18 ? 70 : 0; }
      g.putImageData(d, 0, 0);
      if (this.commT <= 0) this._nextComm();
    }
  }
}
