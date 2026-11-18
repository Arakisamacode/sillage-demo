import * as THREE from 'three';
import { ITEM, ORES, REFINE, MARKETS } from './catalog.js';

// Minage : champ d'astéroïdes (Ceinture d'Ardent), balayage de composition, fracturation au laser
// (garder l'énergie dans la fenêtre optimale sans surcharger), extraction des fragments vers le bac à minerai,
// raffinage et vente à la Plateforme Ardent-3.

export const FIELD = { name: 'Ceinture d\'Ardent', center: new THREE.Vector3(2750, -120, -2450), r: 420 };
export const BIN_CAP = 32;
const RANGE = 160, EXTRACT_RANGE = 90;
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _o = new THREE.Vector3(), _q = new THREE.Quaternion();
const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/\u202f/g, ' ');

function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const s = (t) => t * t * (3 - 2 * t), u = s(fx), v = s(fy), w = s(fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

/** Géométrie de roche : icosphère déformée (bruit fractal), couleurs par sommet avec veines de minerai. */
function rockGeometry(seed, detail, tint, veins) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, n = p.count;
  const col = new Float32Array(n * 3);
  const base = new THREE.Color(0x55504a), dark = new THREE.Color(0x2e2b28), t = new THREE.Color(tint);
  const ox = seed * 3.1, oy = seed * 1.7, oz = seed * 5.3;
  const sq = 0.7 + hash3(seed, 1, 2) * 0.5;
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(p, i);
    let h = 0, a = 1, f = 1.3;
    for (let o = 0; o < 4; o++) { h += (noise3(_v.x * f + ox, _v.y * f + oy, _v.z * f + oz) - 0.5) * a; a *= 0.5; f *= 2.1; }
    const r = 1 + h * 0.55;
    _v.multiplyScalar(r); _v.y *= sq;
    p.setXYZ(i, _v.x, _v.y, _v.z);
    const vein = noise3(_v.x * 3 + oz, _v.y * 3 + ox, _v.z * 3 + oy);
    const c = base.clone().lerp(dark, Math.max(0, -h * 1.6));
    if (vein > 1 - veins) c.lerp(t, 0.75);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export class Mining {
  constructor(ctx, { game, flight, ship, loadout }) {
    Object.assign(this, { ctx, game, flight, ship, loadout });
    this.rocks = [];
    this.mode = false;
    this.energy = 0;
    this.target = null;
    this.onEvent = () => {};
    this.t = 0;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.08, flatShading: true });
    this._build();
    this._fx();
    this.panel = document.getElementById('mine');
    this.aim = document.getElementById('aim');
  }

  // ------------------------------------------------------------------ champ d'astéroïdes
  _build() {
    const R = rng(777), C = FIELD.center;
    const oreIds = Object.keys(ORES), totalW = oreIds.reduce((s, k) => s + ORES[k].w, 0);
    const pickOre = () => { let x = R() * totalW; for (const k of oreIds) { x -= ORES[k].w; if (x <= 0) return k; } return 'fer'; };
    for (let i = 0; i < 64; i++) {
      const dir = new THREE.Vector3(R() * 2 - 1, (R() * 2 - 1) * 0.35, R() * 2 - 1).normalize();
      const pos = C.clone().addScaledVector(dir, Math.pow(R(), 0.6) * FIELD.r);
      const r = 4 + Math.pow(R(), 1.8) * 16;
      const main = pickOre();
      let second = pickOre(); if (second === main) second = null;
      const comp = { [main]: 0.18 + R() * 0.3 };
      if (second) comp[second] = 0.04 + R() * 0.12;
      this._addRock(pos, r, comp, 'whole', Math.floor(R() * 1e6), R);
    }
    // poussière et petits blocs (instanciés)
    const dg = new THREE.IcosahedronGeometry(1, 0);
    const im = new THREE.InstancedMesh(dg, new THREE.MeshStandardMaterial({ color: 0x4a4642, roughness: 0.95, flatShading: true }), 420);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 420; i++) {
      const dir = new THREE.Vector3(R() * 2 - 1, (R() * 2 - 1) * 0.4, R() * 2 - 1).normalize();
      const p = C.clone().addScaledVector(dir, R() * FIELD.r * 1.15);
      const s = 0.3 + Math.pow(R(), 3) * 2.5;
      m.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6)), new THREE.Vector3(s, s * (0.6 + R() * 0.5), s));
      im.setMatrixAt(i, m);
    }
    im.frustumCulled = false;
    this.ctx.scene.add(im);
  }

  _addRock(pos, r, comp, state, seed, R = Math.random) {
    const main = Object.entries(comp).sort((a, b) => b[1] - a[1])[0][0];
    const ore = ORES[main];
    const geo = rockGeometry(seed % 997, r > 9 ? 3 : 2, ore.tint, 0.08 + comp[main] * 0.35);
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.scale.setScalar(r);
    mesh.position.copy(pos);
    mesh.rotation.set(R() * 6, R() * 6, R() * 6);
    this.ctx.scene.add(mesh);
    const instab = Object.entries(comp).reduce((s, [k, v]) => s + ORES[k].instab * v, 0) / Object.values(comp).reduce((s, v) => s + v, 0);
    const rock = {
      mesh, pos: pos.clone(), r: r * 0.92, comp, main, state,
      mass: Math.round(Math.pow(r, 1.45) * 0.9 * 10) / 10,
      resist: THREE.MathUtils.clamp(ore.resist + (R() - 0.5) * 0.3, 0.1, 0.92),
      instab: THREE.MathUtils.clamp(instab + (R() - 0.5) * 0.2, 0.05, 0.95),
      spin: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.06),
      vel: new THREE.Vector3(), alive: true, progress: 0,
    };
    this.rocks.push(rock);
    return rock;
  }

  // ------------------------------------------------------------------ effets : faisceau, impact, éclat
  _fx() {
    const add = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const g = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); g.translate(0, 0.5, 0); g.rotateX(Math.PI / 2);
    this.beam = new THREE.Mesh(g, add(new THREE.Color(4, 1.2, 0.4)));
    this.beamCore = new THREE.Mesh(g, add(new THREE.Color(6, 5, 4)));
    this.beam.visible = this.beamCore.visible = false;
    this.glow = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), add(new THREE.Color(3, 1.2, 0.5)));
    this.glow.visible = false;
    this.light = new THREE.PointLight(0xff8a40, 0, 60, 2);
    this.burst = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), add(new THREE.Color(3, 2, 1.2)));
    this.burst.visible = false; this.burstT = 0;
    for (const o of [this.beam, this.beamCore, this.glow, this.light, this.burst]) this.ctx.scene.add(o);
  }

  // ------------------------------------------------------------------ état
  get laser() { const id = this.game.d.ship.mining; return id ? ITEM[id] : null; }
  binUsed() { return Object.values(this.game.d.ore).reduce((s, v) => s + v, 0); }
  canMine() { return !!this.laser && this.flight.state === 'flying'; }
  toggle() {
    if (!this.laser) { this.onEvent('nolaser'); return; }
    this.mode = !this.mode; this.flight.mining = this.mode; this.energy = 0;
    this.onEvent(this.mode ? 'on' : 'off');
  }
  inField(p) { return p.distanceTo(FIELD.center) < FIELD.r * 1.2; }
  window(rock) { const L = this.laser; const c = 0.38 + rock.resist * 0.34, w = 0.17 * (L ? L.window : 1); return [c - w / 2, c + w / 2]; }

  /** Point d'émission du laser (tête ventrale) et direction (nez du vaisseau). */
  _origin() {
    const m = this.loadout.meshes.mining;
    if (m) m.getWorldPosition(_o); else _o.copy(this.flight.pos);
    _d.set(0, 0, -1).applyQuaternion(this.flight.q);
    _o.addScaledVector(_d, 1.2);
    return _o;
  }
  _pick(origin, dir) {
    let best = null, bt = RANGE;
    for (const k of this.rocks) {
      if (!k.alive) continue;
      _v.subVectors(k.pos, origin);
      const t = _v.dot(dir);
      if (t < 0 || t - k.r > RANGE) continue;
      const d2 = _v.lengthSq() - t * t, r2 = (k.r * 1.08) ** 2;
      if (d2 > r2) continue;
      const hit = t - Math.sqrt(r2 - d2);
      if (hit < bt) { bt = hit; best = k; }
    }
    return best ? { rock: best, dist: Math.max(0, bt) } : null;
  }

  update(dt, input) {
    this.t += dt;
    const F = this.flight;
    // rotation lente et dérive des roches
    for (const k of this.rocks) {
      if (!k.alive) continue;
      k.mesh.rotation.x += k.spin.x * dt; k.mesh.rotation.y += k.spin.y * dt;
      if (k.vel.lengthSq() > 1e-4) { k.pos.addScaledVector(k.vel, dt); k.mesh.position.copy(k.pos); k.vel.multiplyScalar(Math.exp(-dt * 0.15)); }
    }
    // le champ se reconstitue : une nouvelle roche toutes les 90 s tant qu'il en manque (loin du joueur)
    this._regrowT = (this._regrowT || 0) + dt;
    if (this._regrowT > 90) {
      this._regrowT = 0;
      const whole = this.rocks.filter((k) => k.alive && k.state === 'whole').length;
      if (whole < 64) {
        const oreIds = Object.keys(ORES), totalW = oreIds.reduce((s, k) => s + ORES[k].w, 0);
        const pickOre = () => { let x = Math.random() * totalW; for (const k of oreIds) { x -= ORES[k].w; if (x <= 0) return k; } return 'fer'; };
        for (let tries = 0; tries < 10; tries++) {
          const dir = new THREE.Vector3(Math.random() * 2 - 1, (Math.random() * 2 - 1) * 0.35, Math.random() * 2 - 1).normalize();
          const pos = FIELD.center.clone().addScaledVector(dir, Math.pow(Math.random(), 0.6) * FIELD.r);
          if (pos.distanceTo(F.pos) < 300) continue;
          const main = pickOre(); let second = pickOre(); if (second === main) second = null;
          const comp = { [main]: 0.18 + Math.random() * 0.3 }; if (second) comp[second] = 0.04 + Math.random() * 0.12;
          this._addRock(pos, 4 + Math.pow(Math.random(), 1.8) * 16, comp, 'whole', Math.floor(Math.random() * 1e6));
          break;
        }
      }
      // ménage : fragments épuisés et roches détruites
      for (const k of this.rocks) if (!k.alive && k.mesh.parent) { this.ctx.scene.remove(k.mesh); k.mesh.geometry.dispose(); }
      this.rocks = this.rocks.filter((k) => k.alive);
    }
    // éclat de fracture
    if (this.burst.visible) {
      this.burstT += dt;
      const k = this.burstT / 0.7;
      this.burst.scale.setScalar(this.burstR * (0.5 + k * 1.6));
      this.burst.material.opacity = Math.max(0, 1 - k);
      this.light.intensity = Math.max(this.light.intensity, 4000 * (1 - k));
      if (k >= 1) this.burst.visible = false;
    }
    // collisions du vaisseau avec les roches
    if (F.state === 'flying' && this.inField(F.pos)) {
      const c = _v.set(0, 4, 0).applyQuaternion(F.q).add(F.pos);
      for (const k of this.rocks) {
        if (!k.alive) continue;
        const d = c.distanceTo(k.pos), min = k.r + 8;
        if (d < min) {
          const n = c.clone().sub(k.pos).normalize();
          F.pos.addScaledVector(n, min - d);
          const vn = F.vel.dot(n); if (vn < 0) F.vel.addScaledVector(n, -vn * 1.4);
        }
      }
    }
    if (!this.mode || F.state !== 'flying') {
      if (this.mode && F.state !== 'flying') { this.mode = false; F.mining = false; }
      this._hideFx(); this.panel.classList.add('hidden'); this.aim.classList.add('hidden');
      return;
    }
    const L = this.laser;
    const origin = this._origin().clone(), dir = _d.clone();
    const hit = this._pick(origin, dir);
    this.target = hit && hit.rock;
    const firing = input.firing && !!L;
    let beamLen = RANGE;
    if (hit) beamLen = hit.dist;
    if (firing) {
      const k = this.target;
      if (k && k.state === 'whole') {
        // charge du laser : monte selon la puissance et la résistance, instabilité de la roche
        const gain = 0.32 * L.power * (1.15 - k.resist);
        const wob = Math.sin(this.t * (2.3 + k.instab * 4)) * 0.5 + Math.sin(this.t * 7.1) * 0.5;
        this.energy += dt * (gain + wob * k.instab * 0.22 * L.stab);
        const [lo, hi] = this.window(k);
        if (this.energy >= lo && this.energy <= hi) k.progress += dt / 3.0;
        if (k.progress >= 1) this._fracture(k);
        else if (this.energy >= 1) this._overcharge(k);
      } else if (k && k.state === 'frag' && hit.dist < EXTRACT_RANGE) {
        this._extract(k, dt * 1.2 * L.extract);
        this.energy = Math.max(0, this.energy - dt * 0.5);
      } else this.energy = Math.max(0, this.energy - dt * 0.3);
    } else this.energy = Math.max(0, this.energy - dt * 0.28);
    // faisceau
    const vis = firing;
    this.ctx.audio?.laserHum?.(vis, Math.min(1, this.energy), !!(this.target && this.target.state === 'frag'));
    this.beam.visible = this.beamCore.visible = vis;
    this.glow.visible = vis && !!hit;
    if (vis) {
      const extracting = this.target && this.target.state === 'frag';
      this.beam.material.color.setRGB(extracting ? 0.6 : 4, extracting ? 3 : 1.2, extracting ? 2.4 : 0.4);
      const tgt = origin.clone().add(dir);
      for (const b of [this.beam, this.beamCore]) { b.position.copy(origin); b.lookAt(tgt); }
      const w = 0.18 + this.energy * 0.25;
      this.beam.scale.set(w, w, beamLen); this.beamCore.scale.set(0.05, 0.05, beamLen);
      const hp = origin.clone().addScaledVector(dir, beamLen);
      this.glow.position.copy(hp); this.glow.scale.setScalar(1.4 + this.energy * 3 + Math.random() * 0.6);
      this.light.position.copy(hp); this.light.intensity = 600 + this.energy * 2000;
    } else if (!this.burst.visible) this.light.intensity = 0;
    this._hud(hit);
  }
  _hideFx() { this.ctx.audio?.laserHum?.(false); this.beam.visible = this.beamCore.visible = this.glow.visible = false; if (!this.burst.visible) this.light.intensity = 0; }

  _fracture(k) {
    k.alive = false; k.mesh.visible = false;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const f = this._addRock(k.pos.clone().addScaledVector(dir, k.r * 0.55), k.r * (0.32 + Math.random() * 0.14), k.comp, 'frag', Math.floor(Math.random() * 1e6));
      f.mass = Math.round(k.mass / n * 10) / 10;
      f.vel.copy(dir).multiplyScalar(0.6 + Math.random());
    }
    this.burst.position.copy(k.pos); this.burst.visible = true; this.burstT = 0; this.burstR = k.r;
    this.light.position.copy(k.pos);
    this.energy = 0;
    this.onEvent('fracture', k);
  }
  _overcharge(k) {
    k.alive = false; k.mesh.visible = false;
    this.burst.position.copy(k.pos); this.burst.visible = true; this.burstT = 0; this.burstR = k.r * 1.4;
    this.burst.material.color.setRGB(4, 1.2, 0.5);
    setTimeout(() => this.burst.material.color.setRGB(3, 2, 1.2), 800);
    this.energy = 0;
    this.onEvent('overcharge', k);
  }
  _extract(k, amount) {
    const free = BIN_CAP - this.binUsed();
    if (free <= 0.01) { if (!this._fullWarned) { this.onEvent('full'); this._fullWarned = true; } return; }
    this._fullWarned = false;
    const take = Math.min(amount, k.mass);
    const sum = Object.values(k.comp).reduce((s, v) => s + v, 0);
    // la part inerte est rejetée ; seule la part utile entre dans le bac
    let added = 0;
    for (const [ore, pct] of Object.entries(k.comp)) {
      const q = Math.min(take * pct / Math.max(sum, 0.25), free - added);
      if (q <= 0) continue;
      this.game.d.ore[ore] = (this.game.d.ore[ore] || 0) + q; added += q;
    }
    k.mass -= take;
    k.mesh.scale.multiplyScalar(Math.pow(Math.max(0.05, k.mass) / Math.max(0.05, k.mass + take), 1 / 3));
    if (k.mass <= 0.05) { k.alive = false; k.mesh.visible = false; this.game.save(); this.onEvent('depleted', k); }
    this._saveAcc = (this._saveAcc || 0) + take;
    if (this._saveAcc > 2) { this._saveAcc = 0; this.game.save(); }
  }

  // ------------------------------------------------------------------ interface de vol (panneau de minage)
  _hud(hit) {
    const P = this.panel, k = this.target;
    P.classList.remove('hidden');
    const used = this.binUsed();
    let h = `<div class="mn-t">MODE MINAGE · ${this.laser.name.split('«')[0].trim()}</div>`;
    if (!k) h += `<div class="mn-d">${this.inField(this.flight.pos) ? 'Visez une roche (nez du vaisseau) à moins de 160 m' : `Champ d'astéroïdes hors de portée`}</div>`;
    else {
      const sum = Object.values(k.comp).reduce((s, v) => s + v, 0);
      h += `<div class="mn-n">${k.state === 'frag' ? 'Fragment' : 'Astéroïde'} · ${k.mass.toFixed(1).replace('.', ',')} SCU · ${Math.round(hit.dist)} m</div>`;
      h += '<div class="mn-comp">' + Object.entries(k.comp).map(([o, p]) => `<span style="--c:#${new THREE.Color(ORES[o].tint).getHexString()}"><i style="width:${Math.round(p * 100)}%"></i>${ORES[o].name} ${Math.round(p * 100)} %</span>`).join('') + `<span class="inert"><i style="width:${Math.round((1 - sum) * 100)}%"></i>Inerte ${Math.round((1 - sum) * 100)} %</span></div>`;
      if (k.state === 'whole') {
        const [lo, hi] = this.window(k);
        h += `<div class="mn-d">Résistance ${Math.round(k.resist * 100)} % · Instabilité ${Math.round(k.instab * 100)} %</div>`;
        h += `<div class="mn-bar"><b style="left:${lo * 100}%;width:${(hi - lo) * 100}%"></b><u style="left:${Math.min(100, this.energy * 100)}%"></u><s></s></div>`;
        h += `<div class="mn-prog"><i style="width:${Math.round(k.progress * 100)}%"></i></div>`;
        h += `<div class="mn-d">Maintenez le laser pour garder la charge dans la zone verte · rouge = surcharge</div>`;
      } else h += `<div class="mn-d">${hit.dist < EXTRACT_RANGE ? 'Maintenez le laser pour extraire le minerai' : 'Approchez à moins de 90 m pour extraire'}</div>`;
    }
    h += `<div class="mn-bin">Bac à minerai <i style="width:${(used / BIN_CAP) * 100}%"></i><span>${used.toFixed(1).replace('.', ',')} / ${BIN_CAP} SCU</span></div>`;
    if (this._lastHtml !== h) { P.innerHTML = h; this._lastHtml = h; }
    // réticule : point visé par le nez du vaisseau
    const cam = this.ctx.camera;
    _v.copy(this._origin()).addScaledVector(_d, 100).project(cam);
    if (_v.z < 1) { this.aim.style.left = `${(_v.x * 0.5 + 0.5) * innerWidth}px`; this.aim.style.top = `${(-_v.y * 0.5 + 0.5) * innerHeight}px`; this.aim.classList.remove('hidden'); this.aim.classList.toggle('lock', !!k); } else this.aim.classList.add('hidden');
  }

  // ------------------------------------------------------------------ raffinerie et marché (Ardent-3)
  /** Cours du jour (variation lente autour du prix de base). */
  price(ore, refined, market = 'ardent') {
    const b = refined ? ORES[ore].ref : ORES[ore].raw;
    const k = 1 + 0.12 * Math.sin(Date.now() / 3.6e6 + ore.length * 1.7 + market.length * 0.9);
    return Math.round(b * k * (refined ? (MARKETS[market]?.k[ore] ?? 1) : 1));
  }
  /** Meilleur marché connu pour un matériau raffiné. */
  bestMarket(ore) { return Object.keys(MARKETS).reduce((a, m) => (this.price(ore, true, m) > this.price(ore, true, a) ? m : a), 'ardent'); }
  rawValue() { return Object.entries(this.game.d.ore).reduce((s, [o, q]) => s + q * this.price(o, false), 0); }
  sellRaw() {
    const v = Math.round(this.rawValue());
    if (v <= 0) return 'Bac à minerai vide.';
    this.game.d.ore = {}; this.game.earn(v);
    return `Minerai brut vendu : +${fmt(v)} ¤`;
  }
  refine(methodId) {
    const m = REFINE.find((x) => x.id === methodId);
    const ore = this.game.d.ore;
    if (this.binUsed() <= 0.05) return 'Bac à minerai vide.';
    const fee = Math.round(Object.entries(ore).reduce((s, [o, q]) => s + q * this.price(o, true) * m.yield, 0) * m.fee);
    if (!this.game.pay(fee)) return `Frais de raffinage : ${fmt(fee)} ¤ — crédits insuffisants.`;
    const out = {};
    for (const [o, q] of Object.entries(ore)) out[o] = Math.round(q * m.yield * 10) / 10;
    this.game.d.refJobs.push({ id: Date.now(), method: m.id, out, done: Date.now() + m.time * 1000 });
    this.game.d.ore = {};
    this.game.save();
    return `Lot confié à la raffinerie (${m.name}) · frais ${fmt(fee)} ¤`;
  }
  collect(job) {
    if (Date.now() < job.done) return 'Raffinage en cours.';
    for (const [o, q] of Object.entries(job.out)) this.game.d.materials[o] = Math.round(((this.game.d.materials[o] || 0) + q) * 10) / 10;
    this.game.d.refJobs = this.game.d.refJobs.filter((j) => j !== job);
    this.game.save();
    return 'Matériaux raffinés chargés dans la soute du Héron · revendables ici ou plus cher ailleurs (Corvin, Lys).';
  }
  sellMaterial(ore, market = 'ardent') {
    const q = this.game.d.materials[ore] || 0;
    if (q <= 0) return 'Rien à vendre.';
    const v = Math.round(q * this.price(ore, true, market));
    delete this.game.d.materials[ore];
    this.game.earn(v);
    return `${ORES[ore].name} raffiné vendu : +${fmt(v)} ¤`;
  }

  /** Repère de navigation : raffinerie si le bac est bien rempli, sinon le champ d'astéroïdes. */
  navTarget(ardent) {
    const mats = Object.entries(this.game.d.materials).filter(([, q]) => q > 0);
    if (mats.length && this.binUsed() < BIN_CAP * 0.6) {
      const val = (m) => mats.reduce((s, [o, q]) => s + q * this.price(o, true, m), 0);
      const best = Object.keys(MARKETS).reduce((a, m) => (val(m) > val(a) ? m : a), 'ardent');
      const o = this.ctx.outposts.find((x) => x.id === best);
      if (o && this.flight.dockedAt !== o.pad) return { pos: o.center, name: `Marché · ${MARKETS[best].name} · ${fmt(val(best))} ¤` };
    }
    if (!this.laser) return null;
    if (this.binUsed() > BIN_CAP * 0.6) return { pos: ardent.center, name: 'Raffinerie · Plateforme Ardent-3' };
    if (!this.inField(this.flight.pos)) return { pos: FIELD.center, name: `Champ d'astéroïdes · ${FIELD.name}` };
    return null;
  }
}
