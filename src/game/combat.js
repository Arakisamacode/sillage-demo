import * as THREE from 'three';
import { ITEM } from './catalog.js';

// Combat spatial : pirates qui interceptent le Héron hors de la zone protégée de Halden-7,
// armes du vaisseau (lasers, canons balistiques, missiles à verrouillage), tourelle servie par l'artilleur,
// boucliers qui se rechargent, coque persistante (réparée à l'atterrissage), destruction et rapatriement.

export const HULL_MAX = 6000;
const SAFE_R = 1100;         // zone protégée autour de la station : armes verrouillées, les pirates n'y entrent pas
const DANGER_R = 1500;
const GUNS = {
  laser: { speed: 1500, rate: 5, len: 10, w: 0.28, color: new THREE.Color(0.5, 2.4, 5), pierce: 0 },
  ballistic: { speed: 1100, rate: 6, len: 5, w: 0.2, color: new THREE.Color(5, 3, 1.2), pierce: 0.4, ammo: 600 },
  pirate: { speed: 950, len: 9, w: 0.3, color: new THREE.Color(5, 0.7, 0.35), pierce: 0 },
  turret: { speed: 1400, len: 8, w: 0.24, color: new THREE.Color(0.6, 4, 2.2), pierce: 0 },
};
const KINDS = {
  ecorcheur: { name: 'Écorcheur', shield: 600, hull: 1100, speed: 150, turn: 1.5, dmg: 40, rate: 4.5, scale: 1, bounty: [900, 1500] },
  charognard: { name: 'Charognard', shield: 1400, hull: 2300, speed: 118, turn: 1.05, dmg: 60, rate: 4, scale: 1.35, bounty: [1800, 2800] },
};
const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ');
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const Z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);

function additive(c) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); }

/** Bulle de bouclier : coque de Fresnel additive, flash à l'impact. */
function shieldMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAmp: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAmp; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uColor * (f * 1.6 + 0.08) * uAmp, 1.0); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

let PM = null;
function pirateMats() {
  if (PM) return PM;
  PM = {
    hull: new THREE.MeshStandardMaterial({ color: 0x3b3834, roughness: 0.5, metalness: 0.65 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.62, metalness: 0.55 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x7c2b18, roughness: 0.72, metalness: 0.3 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xb9ae96, roughness: 0.7, metalness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a0d08, roughness: 0.08, metalness: 0.9, emissive: new THREE.Color(0xff6a2a), emissiveIntensity: 0.25 }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.9, 0.35) }),
    plume: additive(new THREE.Color(2.4, 0.7, 0.3)),
  };
  return PM;
}

/** Chasseur pirate procédural : fuselage effilé, ailes en flèche inversée, deux réacteurs, peinture rouille. */
function pirateMesh(kind) {
  const K = pirateMats(), g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const nose = new THREE.CylinderGeometry(0.35, 1.5, 8, 6); nose.rotateX(-Math.PI / 2);
  add(nose, K.hull, 0, 0, -3.2);
  add(new THREE.BoxGeometry(2.8, 1.6, 5.2), K.plate, 0, 0.05, 2.6);
  add(new THREE.BoxGeometry(3.0, 0.2, 4.4), K.rust, 0, 0.88, 2.4);
  const cab = new THREE.SphereGeometry(0.9, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); cab.scale(1, 0.8, 2.1);
  add(cab, K.glass, 0, 0.62, -1.6);
  for (const s of [-1, 1]) {
    const w = add(new THREE.BoxGeometry(6.4, 0.22, 2.6), K.hull, s * 4.3, -0.15, 1.6, 0, s * 0.42, s * -0.12);
    add(new THREE.BoxGeometry(2.4, 0.24, 1.1), K.rust, s * 5.6, -0.05, 0.5, 0, s * 0.42, s * -0.12);
    add(new THREE.BoxGeometry(0.5, 0.5, 3.4).translate(0, 0, -0.6), K.plate, s * 7.1, -0.4, -0.2);
    const gun = new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8); gun.rotateX(-Math.PI / 2);
    add(gun, K.plate, s * 7.1, -0.4, -3.2);
    add(new THREE.SphereGeometry(0.12, 8, 6), K.glow, s * 7.4, -0.15, 0.9);
    const eng = new THREE.CylinderGeometry(0.75, 0.9, 3.4, 12); eng.rotateX(-Math.PI / 2);
    add(eng, K.plate, s * 1.75, -0.2, 4.6);
    const ring = new THREE.CylinderGeometry(0.62, 0.62, 0.1, 16); ring.rotateX(-Math.PI / 2);
    add(ring, K.glow, s * 1.75, -0.2, 6.33);
    const pl = new THREE.ConeGeometry(0.6, 4.5, 14, 1, true); pl.translate(0, -2.25, 0); pl.rotateX(Math.PI / 2);
    const p = add(pl, K.plume, s * 1.75, -0.2, 6.4); p.userData.plume = true;
    add(new THREE.BoxGeometry(0.16, 2.2, 2.2), K.bone, s * 1.3, 1.5, 4.4, 0, 0, s * 0.35);
    void w;
  }
  g.scale.setScalar(KINDS[kind].scale);
  g.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
  return g;
}

/** Point le plus proche d'un segment [a,b] au centre c : distance au carré. */
function segDist2(a, b, c) {
  _v3.subVectors(b, a);
  const L = _v3.lengthSq() || 1e-6;
  const t = THREE.MathUtils.clamp(_v2.subVectors(c, a).dot(_v3) / L, 0, 1);
  return _v2.copy(a).addScaledVector(_v3, t).distanceToSquared(c);
}

export class Combat {
  constructor(ctx, { game, flight, loadout, crew, mining, ship }) {
    Object.assign(this, { ctx, game, flight, loadout, crew, mining, ship });
    this.pirates = [];
    this.bolts = [];
    this.missiles = [];
    this.t = 0;
    this.lastHit = -99;
    if (typeof game.d.hull !== 'number') game.d.hull = HULL_MAX;
    this.shield = this.shieldCap;
    this.cool = {};
    this.rearm();
    this.dangerT = 0;
    this.nextWave = 22 + Math.random() * 18;
    this.lockT = 0; this.target = null;
    this.kills = 0; this.waveBounty = 0;
    this.onEvent = () => {};
    this._fx();
    this._hudInit();
  }

  get audio() { return this.ctx.audio; }
  get hull() { return this.game.d.hull; }
  set hull(v) { this.game.d.hull = v; }
  get shieldItem() { return ITEM[this.game.d.ship.shield] || ITEM.sh1; }
  get shieldCap() { return this.shieldItem.cap; }
  get guns() { return ['wingL', 'wingR', 'chin'].map((s) => ({ slot: s, it: ITEM[this.game.d.ship[s]], mesh: this.loadout.meshes[s] })).filter((g) => g.it && g.mesh); }
  get launchers() { return this.guns.filter((g) => g.it.gun === 'missile').length; }
  /** Recharge les munitions et missiles (à chaque atterrissage). */
  rearm() {
    this.ammo = {};
    for (const s of ['wingL', 'wingR', 'chin']) { const it = ITEM[this.game.d.ship[s]]; if (it?.gun === 'ballistic') this.ammo[s] = GUNS.ballistic.ammo; }
    this.msl = ['wingL', 'wingR', 'chin'].filter((s) => ITEM[this.game.d.ship[s]]?.gun === 'missile').length * 4;
  }
  safe(p = this.flight.pos) { return p.distanceTo(this.flight.home.pos) < SAFE_R || this.flight.insideHangar(p); }
  get engaged() { return this.pirates.some((p) => p.state !== 'flee'); }

  // ------------------------------------------------------------------ effets : tirs, impacts, explosions, boucliers
  _fx() {
    const S = this.ctx.scene;
    this.boltGeo = new THREE.BoxGeometry(1, 1, 1);
    this.boltMats = Object.fromEntries(Object.entries(GUNS).map(([k, g]) => [k, additive(g.color)]));
    this.boltPool = [];
    for (let i = 0; i < 180; i++) { const m = new THREE.Mesh(this.boltGeo, this.boltMats.laser); m.visible = false; m.frustumCulled = false; S.add(m); this.boltPool.push(m); }
    this.sparkPool = [];
    const sg = new THREE.SphereGeometry(1, 10, 6);
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(sg, additive(new THREE.Color(4, 3, 2))); m.visible = false; S.add(m); this.sparkPool.push({ m, t: 1 }); }
    this.boomPool = [];
    for (let i = 0; i < 6; i++) {
      const core = new THREE.Mesh(sg, additive(new THREE.Color(6, 3.2, 1.2)));
      const smoke = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x1c1a18, transparent: true, depthWrite: false }));
      core.visible = smoke.visible = false; S.add(core); S.add(smoke);
      const debris = [];
      for (let k = 0; k < 10; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.7), pirateMats().plate); d.visible = false; S.add(d); debris.push({ m: d, v: new THREE.Vector3(), r: new THREE.Vector3() }); }
      this.boomPool.push({ core, smoke, debris, t: 9, r: 1 });
    }
    this.boomLight = new THREE.PointLight(0xff8a40, 0, 400, 1.6); S.add(this.boomLight);
    const missileGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.8, 8); missileGeo.rotateX(-Math.PI / 2);
    this.missileMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.5, metalness: 0.4 });
    this.missileGeo = missileGeo;
    this.trailMat = additive(new THREE.Color(4, 2, 0.8));
    // bouclier du Héron (ellipsoïde autour de la coque, repère du vaisseau)
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 18), shieldMaterial(0x4fb8ff));
    this.bubble.scale.set(13, 6.5, 21); this.bubble.visible = false; this.bubble.renderOrder = 9; S.add(this.bubble);
    this.bubbleAmp = 0;
  }
  _spark(pos, size, color) {
    const s = this.sparkPool.find((x) => x.t >= 1) || this.sparkPool[0];
    s.t = 0; s.size = size; s.m.position.copy(pos); s.m.visible = true; s.m.material.color.copy(color || new THREE.Color(4, 3, 2));
  }
  _boom(pos, r, vel) {
    const b = this.boomPool.find((x) => x.t >= 3) || this.boomPool[0];
    b.t = 0; b.r = r; b.pos = pos.clone();
    b.core.position.copy(pos); b.smoke.position.copy(pos); b.core.visible = b.smoke.visible = true;
    for (const d of b.debris) {
      d.m.position.copy(pos); d.m.visible = true; d.m.scale.setScalar(r * (0.06 + Math.random() * 0.1));
      d.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(10 + Math.random() * 30).add(vel || _v.set(0, 0, 0));
      d.r.set(Math.random() * 4, Math.random() * 4, Math.random() * 4);
    }
    this.boomLight.position.copy(pos); this.boomLight.intensity = 1;
    const d = pos.distanceTo(this.ctx.camera.position);
    this.audio?.boom?.(THREE.MathUtils.clamp(220 / Math.max(d, 1), 0.08, 1));
  }
  _updateFx(dt) {
    for (const s of this.sparkPool) {
      if (s.t >= 1) continue;
      s.t += dt / 0.25;
      s.m.scale.setScalar(s.size * (0.5 + s.t));
      s.m.material.opacity = Math.max(0, 1 - s.t);
      if (s.t >= 1) s.m.visible = false;
    }
    let li = 0;
    for (const b of this.boomPool) {
      if (b.t >= 3) continue;
      b.t += dt;
      const k = Math.min(1, b.t / 0.8);
      b.core.scale.setScalar(b.r * (0.4 + k * 2.2));
      b.core.material.opacity = Math.max(0, 1 - k);
      b.core.visible = k < 1;
      b.smoke.scale.setScalar(b.r * (0.6 + Math.min(1, b.t / 3) * 3));
      b.smoke.material.opacity = Math.max(0, 0.55 * (1 - b.t / 3));
      li = Math.max(li, (1 - k) * 9000 * b.r / 8);
      for (const d of b.debris) { d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.r.x * dt; d.m.rotation.y += d.r.y * dt; }
      if (b.t >= 3) { b.smoke.visible = false; for (const d of b.debris) d.m.visible = false; }
    }
    this.boomLight.intensity = li;
    // bouclier du Héron
    const F = this.flight;
    this.bubbleAmp = Math.max(0, this.bubbleAmp - dt * 2.2);
    this.bubble.visible = this.bubbleAmp > 0.01 && this.ship.root.visible;
    if (this.bubble.visible) {
      this.bubble.position.copy(_v.set(0, 4.2, 1).applyQuaternion(F.q).add(F.pos));
      this.bubble.quaternion.copy(F.q);
      this.bubble.material.uniforms.uAmp.value = this.bubbleAmp;
    }
    for (const p of this.pirates) {
      p.bubbleAmp = Math.max(0, p.bubbleAmp - dt * 2.5);
      p.bubble.visible = p.bubbleAmp > 0.01;
      p.bubble.material.uniforms.uAmp.value = p.bubbleAmp;
    }
  }

  // ------------------------------------------------------------------ pirates
  /** Fait apparaître une vague de chasseurs à distance du Héron (n vaisseaux). */
  spawnWave(n = 2, dist = 1300) {
    const F = this.flight;
    const fwd = _v.set(0, 0, -1).applyQuaternion(F.q);
    const base = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).normalize().lerp(fwd, 0.5).normalize();
    for (let i = 0; i < n; i++) {
      const kind = i === 0 && n >= 3 ? 'charognard' : (Math.random() < 0.25 ? 'charognard' : 'ecorcheur');
      const K = KINDS[kind];
      const mesh = pirateMesh(kind);
      const pos = F.pos.clone().addScaledVector(base, dist).add(new THREE.Vector3((i - (n - 1) / 2) * 60, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 60));
      mesh.position.copy(pos);
      mesh.lookAt(F.pos); // l'avant du modèle est -Z : lookAt d'un Object3D pointe +Z, d'où la rotation qui suit
      mesh.rotateY(Math.PI);
      this.ctx.scene.add(mesh);
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), shieldMaterial(0xff5a3a));
      bubble.scale.set(8.6, 3.6, 9.2); bubble.position.z = 0.6; bubble.visible = false; mesh.add(bubble);
      const plumes = []; mesh.traverse((o) => { if (o.userData.plume) plumes.push(o); });
      this.pirates.push({
        kind, K, mesh, bubble, plumes, pos, q: mesh.quaternion.clone(), vel: new THREE.Vector3().copy(base).multiplyScalar(-K.speed),
        shield: K.shield, hull: K.hull, state: 'attack', t: 0, fireCd: Math.random(), side: 1, bubbleAmp: 0, r: 7.5 * K.scale,
        orbit: Math.random() < 0.5 ? -1 : 1, jink: Math.random() * 10,
      });
    }
    this.waveBounty = 0;
    this.onEvent('wave', n, Math.round(dist));
  }

  _pirateAI(p, dt) {
    const F = this.flight, K = p.K;
    p.t += dt;
    const shipC = _v.set(0, 4, 0).applyQuaternion(F.q).add(F.pos);
    const toP = _v2.subVectors(shipC, p.pos);
    const dist = toP.length();
    let aim;
    const fleeing = p.state === 'flee';
    if (!fleeing && (this.safe(p.pos) || this.safe() || F.state !== 'flying' || this.dead)) { p.state = 'flee'; p.t = 0; }
    if (p.state === 'attack') {
      // tir anticipé : position future du Héron au temps de vol du projectile
      const tof = dist / GUNS.pirate.speed;
      aim = shipC.clone().addScaledVector(F.vel, tof);
      // trajectoire en tire-bouchon pour ne pas être une cible facile
      const side = new THREE.Vector3().crossVectors(toP, UP).normalize();
      aim.addScaledVector(side, Math.sin(p.t * 0.9 + p.jink) * Math.min(60, dist * 0.08) * p.orbit);
      if (dist < 170) { p.state = 'break'; p.t = 0; p.breakDir = side.multiplyScalar(p.orbit).addScaledVector(toP.clone().normalize(), -0.6).add(new THREE.Vector3(0, Math.random() - 0.5, 0)).normalize(); }
    } else if (p.state === 'break') {
      aim = p.pos.clone().addScaledVector(p.breakDir, 600);
      if (p.t > 3.2 && dist > 380) { p.state = 'attack'; p.t = 0; p.orbit *= Math.random() < 0.5 ? -1 : 1; }
    } else {
      aim = p.pos.clone().addScaledVector(toP, -1).add(new THREE.Vector3(0, 200, 0));
      if (dist > 3200) p.gone = true;
    }
    // virage limité vers la consigne
    _m.lookAt(p.pos, aim, UP);
    _q.setFromRotationMatrix(_m);
    p.q.rotateTowards(_q, K.turn * dt);
    const fwd = _v3.set(0, 0, -1).applyQuaternion(p.q);
    const speed = fleeing ? K.speed * 1.5 : p.state === 'break' ? K.speed * 1.15 : K.speed * (dist < 500 ? 0.8 : 1.1);
    p.vel.lerp(fwd.clone().multiplyScalar(speed), 1 - Math.exp(-dt * 1.4));
    p.pos.addScaledVector(p.vel, dt);
    // pas de collision avec le Héron
    if (dist < 24) p.pos.addScaledVector(toP.normalize(), -(24 - dist));
    p.mesh.position.copy(p.pos); p.mesh.quaternion.copy(p.q);
    for (const pl of p.plumes) pl.scale.set(1, 1, 0.6 + speed / K.speed * 0.6 * (0.85 + Math.random() * 0.3));
    // tir
    p.fireCd -= dt;
    if (p.state === 'attack' && dist < 900 && p.fireCd <= 0) {
      const want = _v.subVectors(aim, p.pos).normalize();
      if (fwd.dot(want) > 0.97) {
        p.fireCd = 1 / K.rate; p.side = -p.side;
        const muzzle = new THREE.Vector3(p.side * 7.1 * K.scale, -0.4 * K.scale, -4.6 * K.scale).applyQuaternion(p.q).add(p.pos);
        const spread = 0.008 + (this.flight.vel.length() > 80 ? 0.008 : 0);
        const dir = want.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(spread * 2)).normalize();
        this._fire('pirate', muzzle, dir, K.dmg, p, p.vel);
        this.audio?.zap?.('pirate', THREE.MathUtils.clamp(160 / dist, 0.05, 0.5));
      }
    }
  }

  _hitPirate(p, dmg, pierce, at) {
    if (p.hull <= 0) return;
    let toShield = dmg * (1 - pierce), toHull = dmg * pierce;
    if (p.shield > 0) { const s = Math.min(p.shield, toShield); p.shield -= s; toHull += toShield - s; p.bubbleAmp = 1; } else toHull += toShield;
    p.hull -= toHull;
    p.lastHit = this.t;
    if (p.state === 'flee' && p.hull > 0) p.state = 'attack';
    this._spark(at, p.shield > 0 ? 1.4 : 2.2, p.shield > 0 ? new THREE.Color(4, 1.2, 0.6) : new THREE.Color(5, 3.5, 2));
    if (p.hull <= 0) this._kill(p);
  }
  _kill(p) {
    this._boom(p.pos, 8 * p.K.scale, p.vel.clone().multiplyScalar(0.3));
    this.ctx.scene.remove(p.mesh);
    p.dead = true;
    const [a, b] = p.K.bounty, bounty = Math.round((a + Math.random() * (b - a)) / 50) * 50;
    this.game.earn(bounty);
    this.kills++; this.waveBounty += bounty;
    this._dropPod(p);
    if (this.target === p) { this.target = null; this.lockT = 0; }
    const left = this.pirates.filter((x) => !x.dead && x !== p).length;
    this.onEvent('kill', p, bounty, left);
    if (!left) this.onEvent('clear', this.waveBounty);
  }

  // ------------------------------------------------------------------ épaves : capsules de récupération
  _dropPod(p) {
    if (!this.pods) this.pods = [];
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 12), pirateMats().plate);
    body.rotation.z = Math.PI / 2; g.add(body);
    for (const x of [-1.0, 1.0]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 12), pirateMats().rust); r.rotation.z = Math.PI / 2; r.position.x = x; g.add(r); }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 0.6) }));
    beacon.position.y = 1.0; g.add(beacon);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), additive(new THREE.Color(1.2, 0.8, 0.15)));
    halo.scale.setScalar(4); g.add(halo);
    g.position.copy(p.pos);
    this.ctx.scene.add(g);
    const value = Math.round((p.K.bounty[0] * 0.35 + Math.random() * 500) / 10) * 10;
    this.pods.push({ g, beacon, halo, pos: p.pos.clone(), vel: p.vel.clone().multiplyScalar(0.15), spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.8), value, life: 240, msl: Math.random() < 0.3 });
  }
  _updatePods(dt) {
    if (!this.pods?.length) return;
    const F = this.flight;
    for (const pod of this.pods) {
      pod.life -= dt;
      pod.pos.addScaledVector(pod.vel, dt); pod.vel.multiplyScalar(Math.exp(-dt * 0.3));
      pod.g.position.copy(pod.pos);
      pod.g.rotation.x += pod.spin.x * dt; pod.g.rotation.y += pod.spin.y * dt;
      const blink = (this.t * 1.5 + pod.value) % 1 < 0.25;
      pod.beacon.visible = blink; pod.halo.visible = blink;
      if (F.state === 'flying' && !this.dead && F.pos.distanceTo(pod.pos) < 32) {
        pod.done = true;
        this.game.earn(pod.value);
        let extra = '';
        if (pod.msl && this.launchers && this.msl < this.launchers * 4) { this.msl++; extra = ' · 1 missile récupéré'; }
        this.onEvent('salvage', pod.value, extra);
      }
      if (pod.life <= 0) pod.done = true;
      if (pod.done) this.ctx.scene.remove(pod.g);
    }
    this.pods = this.pods.filter((p) => !p.done);
  }

  // ------------------------------------------------------------------ tirs
  _fire(kind, pos, dir, dmg, owner, inherit) {
    const m = this.boltPool.find((x) => !x.visible);
    if (!m) return;
    const G = GUNS[kind];
    m.material = this.boltMats[kind];
    m.visible = true;
    m.position.copy(pos);
    m.quaternion.setFromUnitVectors(Z, dir);
    m.scale.set(G.w, G.w, G.len);
    const vel = dir.clone().multiplyScalar(G.speed);
    if (inherit) vel.add(inherit);
    this.bolts.push({ m, pos: pos.clone(), prev: pos.clone(), vel, life: 1.6, dmg, pierce: G.pierce, owner, kind });
  }

  _updateBolts(dt) {
    const F = this.flight, shipC = _v.set(0, 4.2, 1).applyQuaternion(F.q).add(F.pos).clone();
    const rocks = this.mining && this.mining.inField(F.pos) ? this.mining.rocks.filter((k) => k.alive) : null;
    for (const b of this.bolts) {
      b.prev.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      b.life -= dt;
      b.m.position.copy(b.pos);
      let hit = false;
      if (b.owner && b.owner.K) {
        // tir pirate contre le Héron
        if (!this.dead && F.state === 'flying' && segDist2(b.prev, b.pos, shipC) < 11 * 11) { this._hitPlayer(b.dmg, b.pierce, b.pos); hit = true; }
      } else {
        for (const p of this.pirates) {
          if (p.dead) continue;
          if (segDist2(b.prev, b.pos, p.pos) < p.r * p.r) { this._hitPirate(p, b.dmg, b.pierce, b.pos); hit = true; break; }
        }
      }
      if (!hit && rocks) {
        for (const k of rocks) if (segDist2(b.prev, b.pos, k.pos) < k.r * k.r) { this._spark(b.pos, 1.2, new THREE.Color(3, 2, 1.2)); hit = true; break; }
      }
      if (hit || b.life <= 0) { b.m.visible = false; b.done = true; }
    }
    this.bolts = this.bolts.filter((b) => !b.done);
  }

  _hitPlayer(dmg, pierce, at) {
    let toShield = dmg * (1 - pierce), toHull = dmg * pierce;
    if (this.shield > 0) { const s = Math.min(this.shield, toShield); this.shield -= s; toHull += toShield - s; this.bubbleAmp = Math.min(1.2, this.bubbleAmp + 0.6); } else toHull += toShield;
    this.lastHit = this.t;
    if (toHull > 0) {
      this.hull = Math.max(0, this.hull - toHull);
      this.hullFlash = 1;
      this._spark(at, 2, new THREE.Color(5, 3, 1.5));
      this.audio?.hit?.(false);
      if (this.hull <= 0) this._destroyed();
    } else { this._spark(at, 1.6, new THREE.Color(1, 2.6, 5)); this.audio?.hit?.(true); }
    this._saveAcc = (this._saveAcc || 0) + 1;
  }

  _playerGuns(dt, input) {
    const F = this.flight;
    const fwd = _v.set(0, 0, -1).applyQuaternion(F.q).clone();
    const nose = _v2.set(0, 4.5, 0).applyQuaternion(F.q).add(F.pos).clone();
    // cible : pirate le plus proche du nez (cône de 25°), conservée tant qu'elle reste à moins de 45°
    const score = (p) => { const d = _v3.subVectors(p.pos, nose); const L = d.length(); return { a: Math.acos(THREE.MathUtils.clamp(d.dot(fwd) / L, -1, 1)), L }; };
    if (this.target && (this.target.dead || this.target.gone || score(this.target).a > 0.8 || score(this.target).L > 2600)) { this.target = null; this.lockT = 0; }
    if (input.consume?.('target')) { this.target = null; this.lockT = 0; }
    if (!this.target) {
      let best = null, ba = 0.44;
      for (const p of this.pirates) { if (p.dead) continue; const s = score(p); if (s.L < 2600 && s.a < ba) { ba = s.a; best = p; } }
      if (best !== this.target) { this.target = best; this.lockT = 0; }
    }
    // point de tir anticipé sur la cible
    this.lead = null;
    const T = this.target;
    if (T) {
      let tof = T.pos.distanceTo(nose) / GUNS.laser.speed;
      const lp = T.pos.clone().addScaledVector(_v3.subVectors(T.vel, F.vel), tof);
      tof = lp.distanceTo(nose) / GUNS.laser.speed;
      this.lead = T.pos.clone().addScaledVector(_v3.subVectors(T.vel, F.vel), tof);
    }
    // verrouillage missile
    const launchers = this.launchers;
    if (T && launchers && this.msl > 0 && score(T).a < 0.22 && score(T).L < 1800) {
      const was = this.lockT;
      this.lockT = Math.min(3, this.lockT + dt);
      if (was < 3 && this.lockT >= 3) this.audio?.lockTone?.(true);
    } else this.lockT = Math.max(0, this.lockT - dt * 2);
    if (input.consume?.('missile')) {
      if (!launchers) this.onEvent('nomissile');
      else if (this.msl <= 0) this.onEvent('nomissiles');
      else if (this.lockT < 3 || !T) this.onEvent('nolock');
      else if (this.safe()) this.onEvent('safe');
      else this._launch(T);
    }
    // canons
    const firing = input.firing && !this.mining?.mode;
    if (!firing) return;
    if (this.safe()) { if (!this._safeWarned || this.t - this._safeWarned > 4) { this._safeWarned = this.t; this.onEvent('safe'); } return; }
    const guns = this.guns.filter((g) => g.it.gun !== 'missile');
    if (!guns.length) { if (!this._noGunWarned || this.t - this._noGunWarned > 4) { this._noGunWarned = this.t; this.onEvent('nogun'); } return; }
    const conv = nose.clone().addScaledVector(fwd, 520);
    const assist = this.lead && _v3.subVectors(this.lead, nose).normalize().dot(fwd) > Math.cos(this.ctx.touch ? 0.14 : 0.08);
    for (const g of guns) {
      this.cool[g.slot] = (this.cool[g.slot] || 0) - dt;
      if (this.cool[g.slot] > 0) continue;
      const G = GUNS[g.it.gun];
      if (g.it.gun === 'ballistic') { if ((this.ammo[g.slot] || 0) <= 0) continue; this.ammo[g.slot]--; }
      this.cool[g.slot] = 1 / G.rate;
      const muzzle = g.mesh.getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, 2.6 * (g.it.size === 1 ? 0.8 : 1));
      const dir = (assist ? this.lead : conv).clone().sub(muzzle).normalize();
      dir.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.006)).normalize();
      this._fire(g.it.gun, muzzle, dir, g.it.dps / G.rate, null, F.vel);
      this._spark(muzzle, 0.5, G.color);
      this.audio?.zap?.(g.it.gun, 0.35);
    }
  }

  _launch(T) {
    this.msl--;
    const F = this.flight;
    const g = this.guns.find((x) => x.it.gun === 'missile');
    const pos = g.mesh.getWorldPosition(new THREE.Vector3()).add(_v.set(0, -0.6, 0).applyQuaternion(F.q));
    const mesh = new THREE.Mesh(this.missileGeo, this.missileMat);
    const trail = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), this.trailMat); trail.scale.set(0.35, 0.35, 1.6); trail.position.z = 1.6; mesh.add(trail);
    mesh.position.copy(pos);
    this.ctx.scene.add(mesh);
    const vel = F.vel.clone().add(_v.set(0, -8, -30).applyQuaternion(F.q));
    this.missiles.push({ mesh, pos, vel, target: T, life: 9, dmg: g.it.dmg });
    this.lockT = 0;
    this.audio?.zap?.('missile', 0.5);
    this.onEvent('launch', this.msl);
  }
  _updateMissiles(dt) {
    for (const m of this.missiles) {
      m.life -= dt;
      const T = m.target;
      const speed = Math.min(300, m.vel.length() + 160 * dt);
      let dir = m.vel.clone().normalize();
      if (T && !T.dead && m.life < 8.7) {
        const want = _v.subVectors(T.pos, m.pos).addScaledVector(T.vel, m.pos.distanceTo(T.pos) / speed * 0.6).normalize();
        const a = dir.angleTo(want), k = Math.min(1, (2.6 * dt) / Math.max(a, 1e-4));
        dir.lerp(want, k).normalize();
      }
      m.vel.copy(dir).multiplyScalar(speed);
      m.pos.addScaledVector(m.vel, dt);
      m.mesh.position.copy(m.pos);
      m.mesh.quaternion.setFromUnitVectors(_v.set(0, 0, -1), dir);
      m.mesh.children[0].scale.z = 1.4 + Math.random() * 0.8;
      if (T && !T.dead && m.pos.distanceTo(T.pos) < 9) { this._boom(m.pos, 5, T.vel); this._hitPirate(T, m.dmg, 0.5, m.pos); m.done = true; }
      else if (m.life <= 0) { this._boom(m.pos, 3); m.done = true; }
      if (m.done) this.ctx.scene.remove(m.mesh);
    }
    this.missiles = this.missiles.filter((m) => !m.done);
  }

  /** Tourelle dorsale : l'artilleur vise automatiquement le pirate le plus proche. */
  _turret(dt) {
    const tur = this.loadout.meshes.dorsal, gunner = this.crew?.gunner();
    if (this.crew) this.crew.turretAim = null;
    if (!tur || !gunner || this.flight.state !== 'flying' || this.safe()) return;
    const origin = tur.getWorldPosition(new THREE.Vector3()).add(_v.set(0, 1.2, 0).applyQuaternion(this.flight.q));
    let best = null, bd = 1100;
    for (const p of this.pirates) { if (p.dead || p.state === 'flee') continue; const d = p.pos.distanceTo(origin); if (d < bd) { bd = d; best = p; } }
    if (!best) return;
    const tof = bd / GUNS.turret.speed;
    const aim = best.pos.clone().addScaledVector(_v3.subVectors(best.vel, this.flight.vel), tof);
    // orientation locale de la tête (lacet) dans le repère du vaisseau
    const local = aim.clone().sub(origin).applyQuaternion(this.flight.q.clone().invert());
    this.crew.turretAim = Math.atan2(-local.x, -local.z);
    // la coque masque l'hémisphère inférieur
    if (local.y < -local.length() * 0.18) return;
    this.turretCd = (this.turretCd || 0) - dt;
    if (this.turretCd > 0) return;
    this.turretCd = 0.22; this.turretSide = -(this.turretSide || 1);
    const yaw = this.crew.turretAim;
    const muzzle = origin.clone().add(_v.set(this.turretSide * 0.7, 0.2, 0).applyAxisAngle(UP, yaw).applyQuaternion(this.flight.q));
    const dir = aim.sub(muzzle).normalize().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.03)).normalize();
    this._fire('turret', muzzle, dir, 34, null, this.flight.vel);
    this.audio?.zap?.('turret', 0.18);
  }

  // ------------------------------------------------------------------ destruction du Héron, réparations
  _destroyed() {
    if (this.dead) return;
    const F = this.flight;
    this.dead = true; this.deadT = 0;
    this._boom(F.pos.clone().add(_v.set(0, 4, 0)), 18, F.vel.clone().multiplyScalar(0.2));
    this.ship.root.visible = false;
    F.state = 'dead'; F.vel.multiplyScalar(0.1);
    this.mining.mode = false; F.mining = false;
    this.onEvent('destroyed');
  }
  _respawn() {
    const F = this.flight, H = F.home;
    for (const p of this.pirates) this.ctx.scene.remove(p.mesh);
    this.pirates = []; this.target = null;
    for (const m of this.missiles) this.ctx.scene.remove(m.mesh);
    this.missiles = [];
    F.pos.copy(H.pos); F.q.copy(H.q); F.vel.set(0, 0, 0); F.rate.set(0, 0, 0); F.stick.set(0, 0);
    F.state = 'parked'; F.dockedAt = H; F.throttle = 0; F.camPos.set(0, 0, 0);
    this.ship.root.visible = true;
    // pertes : minerai, cargaison à bord ; franchise d'assurance
    const lost = Object.values(this.game.d.ore).reduce((s, v) => s + v, 0);
    this.game.d.ore = {};
    const fee = Math.min(this.game.credits, 2500 + Math.round(this.game.credits * 0.05));
    this.game.pay(fee);
    this.hull = HULL_MAX; this.shield = this.shieldCap; this.rearm();
    this.dead = false;
    this.game.save();
    this.nextWave = 25 + Math.random() * 20; this.dangerT = 0;
    F.onEvent && F.onEvent('landed', H);
    this.onEvent('respawn', fee, lost);
  }
  /** Atterrissage : réarmement gratuit, réparations de coque facturées. Renvoie le message éventuel. */
  onLanded() {
    this.rearm();
    this.shield = this.shieldCap;
    const missing = HULL_MAX - this.hull;
    if (missing < 1) return null;
    const cost = Math.round(missing * 0.9);
    const paid = Math.min(cost, this.game.credits);
    this.game.pay(paid);
    this.hull = Math.min(HULL_MAX, this.hull + missing * (paid / cost));
    this.game.save();
    return `Réparations de coque et réarmement · −${fmt(paid)} ¤`;
  }
  onTakeoff() { this.shield = this.shieldCap; this.lockT = 0; }

  // ------------------------------------------------------------------ boucle
  update(dt, input) {
    this.t += dt;
    const F = this.flight;
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT > 3.2) this._respawn();
    }
    // apparition des pirates : en vol, hors de la zone protégée de la station
    if (F.state === 'flying' && !this.dead && F.pos.distanceTo(F.home.pos) > DANGER_R && !this.pirates.length) {
      this.dangerT += dt;
      if (this.dangerT > this.nextWave) {
        const loaded = (this.ctx.cargo?.crates || []).some((c) => c.where === 'hold');
        const n = Math.min(3, 1 + (this.kills > 0 ? 1 : 0) + (loaded || this.mining.inField(F.pos) ? 1 : 0));
        this.spawnWave(Math.max(2, n));
        this.dangerT = 0; this.nextWave = 70 + Math.random() * 60;
      }
    }
    for (const p of this.pirates) if (!p.dead) this._pirateAI(p, dt);
    const fled = this.pirates.some((p) => p.gone);
    for (const p of this.pirates) if (p.gone) { this.ctx.scene.remove(p.mesh); if (this.target === p) this.target = null; }
    this.pirates = this.pirates.filter((p) => !p.dead && !p.gone);
    if (fled && !this.pirates.length && !this.dead) this.onEvent('gone');
    if (F.state === 'flying' && !this.dead) {
      this._playerGuns(dt, input);
      this._turret(dt);
    } else { this.target = null; this.lockT = 0; if (this.crew) this.crew.turretAim = null; }
    this._updateBolts(dt);
    this._updateMissiles(dt);
    this._updatePods(dt);
    // boucliers : recharge après un délai sans impact
    const delay = this.shieldItem.id === 'sh2' ? 2.5 : 3;
    if (this.t - this.lastHit > delay) this.shield = Math.min(this.shieldCap, this.shield + this.shieldItem.regen * dt);
    for (const p of this.pirates) if (this.t - (p.lastHit || -9) > 4) p.shield = Math.min(p.K.shield, p.shield + 60 * dt);
    if (this._saveAcc > 20) { this._saveAcc = 0; this.game.save(); }
    this._updateFx(dt);
    this._hud();
  }

  // ------------------------------------------------------------------ interface : barres, cible, anticipation, radar
  _hudInit() {
    const $ = (id) => document.getElementById(id);
    this.el = { box: $('cbt'), tgt: $('tgt'), lead: $('lead'), radar: $('radar'), hit: $('hitfx'), marks: $('marks'), gun: $('gunaim') };
    this.rc = this.el.radar?.getContext('2d');
    this.markEls = [];
  }
  _proj(p) { _v.copy(p).project(this.ctx.camera); return _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05 ? { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight } : null; }
  _hud() {
    const E = this.el, F = this.flight;
    if (!E.box) return;
    const show = (F.state === 'flying' || this.dead) && !F.insideHangar() && !this.ctx.shop?.isOpen;
    E.hit.style.opacity = this.hullFlash ? (this.hullFlash = Math.max(0, this.hullFlash - 0.04)) * 0.7 : 0;
    E.box.classList.toggle('hidden', !show);
    E.radar.classList.toggle('hidden', !show);
    const gp = show && !this.mining?.mode && this._proj(_v2.set(0, 4.5, -520).applyQuaternion(F.q).add(F.pos).clone());
    if (gp) { E.gun.style.left = `${gp.x}px`; E.gun.style.top = `${gp.y}px`; E.gun.classList.remove('hidden'); } else E.gun.classList.add('hidden');
    if (!show) { E.tgt.classList.add('hidden'); E.lead.classList.add('hidden'); for (const m of this.markEls) m.style.display = 'none'; return; }
    // barres et armement
    const sh = this.shield / this.shieldCap, hu = this.hull / HULL_MAX;
    const guns = this.guns;
    const wl = guns.filter((g) => g.it.gun !== 'missile').map((g) => g.it.gun === 'ballistic' ? `${g.it.name.split('«')[0].replace('Canon balistique', 'Bal.').trim()} ${this.ammo[g.slot] ?? 0}` : g.it.name.split('«')[0].replace('Canon laser', 'Laser').trim());
    const msl = this.launchers ? ` · Missiles ${this.msl}${this.target && this.msl ? (this.lockT >= 3 ? ' · <b class="lk">VERROUILLÉ</b>' : this.lockT > 0 ? ` · verrouillage ${Math.round(this.lockT / 3 * 100)} %` : '') : ''}` : '';
    const zone = this.safe() ? '<span class="safe">ZONE PROTÉGÉE · ARMES VERROUILLÉES</span>' : this.engaged ? `<span class="hot">${this.pirates.length} HOSTILE${this.pirates.length > 1 ? 'S' : ''}</span>` : '<span>ESPACE NON SURVEILLÉ</span>';
    const tur = this.loadout.meshes.dorsal ? (this.crew?.gunner() ? ' · Tourelle : artilleur à son poste' : ' · Tourelle sans artilleur') : '';
    const h = `<div class="cb-z">${zone}</div><div class="cb-bar sh"><i style="width:${(sh * 100).toFixed(1)}%"></i><span>BOUCLIER ${Math.round(this.shield)}</span></div><div class="cb-bar hu ${hu < 0.3 ? 'low' : ''}"><i style="width:${(hu * 100).toFixed(1)}%"></i><span>COQUE ${Math.round(hu * 100)} %</span></div><div class="cb-w">${wl.join(' · ') || 'Aucune arme'}${msl}${tur}</div>`;
    if (h !== this._lastH) { E.box.innerHTML = h; this._lastH = h; }
    // cible
    const T = this.target;
    const tp = T && this._proj(T.pos);
    if (tp) {
      const d = T.pos.distanceTo(F.pos);
      const size = THREE.MathUtils.clamp(2400 / d * T.K.scale, 26, 120);
      E.tgt.style.left = `${tp.x}px`; E.tgt.style.top = `${tp.y}px`; E.tgt.style.width = E.tgt.style.height = `${size}px`;
      E.tgt.classList.toggle('lock', this.lockT >= 3);
      const info = `<b>${T.K.name}</b> · ${d > 1000 ? (d / 1000).toFixed(2).replace('.', ',') + ' km' : Math.round(d) + ' m'}<i class="s" style="width:${T.shield / T.K.shield * 100}%"></i><i class="h" style="width:${Math.max(0, T.hull) / T.K.hull * 100}%"></i>`;
      if (info !== this._lastT) { E.tgt.querySelector('div').innerHTML = info; this._lastT = info; }
      E.tgt.classList.remove('hidden');
    } else E.tgt.classList.add('hidden');
    const lp = this.lead && this._proj(this.lead);
    if (lp) { E.lead.style.left = `${lp.x}px`; E.lead.style.top = `${lp.y}px`; E.lead.classList.remove('hidden'); } else E.lead.classList.add('hidden');
    // repères des autres pirates
    let i = 0;
    for (const p of this.pirates) {
      if (p === T) continue;
      const pp = this._proj(p.pos);
      if (!pp) continue;
      let m = this.markEls[i];
      if (!m) { m = document.createElement('i'); E.marks.appendChild(m); this.markEls.push(m); }
      m.style.display = 'block'; m.style.left = `${pp.x}px`; m.style.top = `${pp.y}px`;
      i++;
    }
    for (; i < this.markEls.length; i++) this.markEls[i].style.display = 'none';
    // radar (vue de dessus, repère du vaisseau, 2,5 km)
    const c = this.rc, W = E.radar.width, R = W / 2 - 4;
    c.clearRect(0, 0, W, W);
    c.strokeStyle = 'rgba(120,200,255,.35)'; c.lineWidth = 1;
    for (const k of [1, 0.5]) { c.beginPath(); c.arc(W / 2, W / 2, R * k, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(W / 2, 4); c.lineTo(W / 2, W - 4); c.moveTo(4, W / 2); c.lineTo(W - 4, W / 2); c.stroke();
    const inv = F.q.clone().invert();
    const dot = (pos, color, r) => {
      const l = _v.subVectors(pos, F.pos).applyQuaternion(inv);
      const s = R / 2500, x = l.x * s, y = l.z * s, L = Math.hypot(x, y), k = L > R ? R / L : 1;
      c.fillStyle = color; c.beginPath(); c.arc(W / 2 + x * k, W / 2 + y * k, r, 0, Math.PI * 2); c.fill();
      if (Math.abs(l.y) > 60) { c.strokeStyle = color; c.beginPath(); c.moveTo(W / 2 + x * k, W / 2 + y * k); c.lineTo(W / 2 + x * k, W / 2 + y * k + (l.y > 0 ? -6 : 6)); c.stroke(); }
    };
    dot(F.home.pos, 'rgba(120,255,170,.9)', 3);
    for (const p of this.pirates) dot(p.pos, p === T ? '#ffd24a' : '#ff5a3a', p === T ? 4 : 3);
    for (const m of this.missiles) dot(m.pos, '#ffffff', 1.5);
    for (const p of this.pods || []) dot(p.pos, '#ffd24a', 2);
    c.fillStyle = '#9fd8ff'; c.beginPath(); c.moveTo(W / 2, W / 2 - 6); c.lineTo(W / 2 - 4, W / 2 + 4); c.lineTo(W / 2 + 4, W / 2 + 4); c.fill();
  }
}
