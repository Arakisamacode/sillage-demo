// Entrées : clavier (codes physiques → fonctionne en AZERTY et QWERTY), souris (pointer lock),
// manettes tactiles (joystick virtuel + zone de regard + boutons).

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };      // -1..1 (x = droite, y = avant)
    this.look = { dx: 0, dy: 0 };    // pixels accumulés
    this.run = false;
    this.pressed = new Set();        // actions ponctuelles (view, use, menu, map)
    this.locked = false;
    this.touchRun = false;
    this.enabled = false;

    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys.add(e.code);
      if (e.code === 'KeyV') this.pressed.add('view');
      if (e.code === 'Space') this.pressed.add('flyKey');
      if (e.code === 'KeyL') this.pressed.add('land');
      if (e.code === 'KeyE' || e.code === 'KeyF') this.pressed.add('use');
      if (e.code === 'KeyM') this.pressed.add('mine');
      if (e.code === 'KeyI') this.pressed.add('inv');
      if (e.code === 'KeyR') this.pressed.add('missile');
      if (e.code === 'KeyG') this.pressed.add('draw');
      if (e.code === 'KeyT') this.pressed.add('target');
      if (e.code === 'KeyH') this.pressed.add('hud');
      if (e.code === 'Tab') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (this.enabled && !this.isTouch && !this.locked) canvas.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && this.enabled && !this.isTouch) this.pressed.add('menu');
    });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0 && this.locked) this.mouseFire = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseFire = false; });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look.dx += e.movementX; this.look.dy += e.movementY;
    });
    this._setupTouch();
  }

  _setupTouch() {
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let sid = null, sx = 0, sy = 0;
    const R = 52;
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; stick.setPointerCapture(e.pointerId); this._stickMove(e, sx, sy, R, knob); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) this._stickMove(e, sx, sy, R, knob); });
    const end = (e) => { if (e.pointerId !== sid) return; sid = null; this.move.x = this.move.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    // regard : glisser sur la moitié droite de l'écran
    let lid = null, lx = 0, ly = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      if (e.clientX < innerWidth * 0.35) return;
      lid = e.pointerId; lx = e.clientX; ly = e.clientY;
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid) return;
      this.look.dx += (e.clientX - lx) * 1.6; this.look.dy += (e.clientY - ly) * 1.6;
      lx = e.clientX; ly = e.clientY;
    });
    const lend = (e) => { if (e.pointerId === lid) lid = null; };
    addEventListener('pointerup', lend); addEventListener('pointercancel', lend);
    const btn = (id, fn) => document.getElementById(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); fn(e.currentTarget); });
    btn('t-run', (b) => { this.touchRun = !this.touchRun; b.classList.toggle('on', this.touchRun); });
    btn('t-view', () => this.pressed.add('view'));
    btn('t-use', () => this.pressed.add('use'));
    btn('t-menu', () => this.pressed.add('menu'));
    btn('t-fly', () => this.pressed.add('fly'));
    btn('t-inv', () => this.pressed.add('inv'));
    btn('t-mine', () => this.pressed.add('mine'));
    btn('t-msl', () => this.pressed.add('missile'));
    btn('t-gun', () => this.pressed.add('draw'));
    btn('t-med', () => this.pressed.add('hud'));
    for (const [id, k] of [['t-up', 'touchUp'], ['t-down', 'touchDown'], ['t-fire', 'touchFire']]) {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this[k] = true; });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => { this[k] = false; });
    }
  }

  _stickMove(e, sx, sy, R, knob) {
    let dx = e.clientX - sx, dy = e.clientY - sy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.move.x = dx / R; this.move.y = -dy / R;
  }

  setTouch(on) { this.isTouch = on; }
  /** Tir maintenu (clic gauche, touche X ou bouton tactile). */
  get firing() { return !!(this.mouseFire || this.keys.has('KeyX') || this.touchFire); }

  update() {
    if (!this.isTouch || (this.move.x === 0 && this.move.y === 0 && this.keys.size)) {
      const k = this.keys;
      const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      if (!this.isTouch || f || r) { this.move.x = r; this.move.y = f; }
    }
    this.run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchRun;
  }

  consumeLook() { const l = { ...this.look }; this.look.dx = this.look.dy = 0; return l; }
  consume(action) { const had = this.pressed.has(action); this.pressed.delete(action); return had; }
}
