import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { HX, Z_BAY, Z_BACK, H, PADS } from '../world/layout.js';

// Vol du Héron : mode « couplé » (le vaisseau rejoint la vitesse demandée dans son propre repère),
// propulseurs latéraux et verticaux, roulis, postcombustion. Vitesse bridée dans le hangar.
// Collisions par sondes sphériques contre le décor (sans le vaisseau lui-même ni le champ de la baie).
// Décollage et atterrissage assistés sur l'aire 02, autorisations du contrôle de pont.

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();

export class Flight {
  constructor(ctx, ship) {
    this.ctx = ctx;
    this.ship = ship;
    this.state = 'parked';           // parked | spool | flying | landing
    this.restPos = ship.origin.clone();
    this.restQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PADS.p2.heading, 0));
    this.restInv = new THREE.Matrix4().compose(this.restPos, this.restQ, new THREE.Vector3(1, 1, 1)).invert();
    this.pos = this.restPos.clone();
    this.q = this.restQ.clone();
    this.vel = new THREE.Vector3();
    this.rate = new THREE.Vector3();  // tangage, lacet, roulis (rad/s, repère du vaisseau)
    this.stick = new THREE.Vector2(); // manche virtuel (souris / glisser)
    this.timer = 0;
    this.throttle = 0;
    this.view = 'chase';
    this.camPos = new THREE.Vector3();
    this.camQ = new THREE.Quaternion();
    // sondes de collision (repère du vaisseau, aire 02 au repos) : nez, queue, ailes, ventre, dos, moteurs
    const eng = ship.thrusters ? ship.thrusters.main : [[-3, 6.6, 16.6], [3, 6.6, 16.6]];
    this.probes = [[0, 5.6, -19, 0.8], [0, 5.0, 15.5, 1.6], [-11, 3.75, 4, 0.8], [11, 3.75, 4, 0.8], [0, 1.5, -4, 1.4], [0, 1.5, 8, 1.4],
      [0, 9.3, 2, 0.9], [eng[0][0], eng[0][1], eng[0][2] - 0.4, 1.3], [eng[1][0], eng[1][1], eng[1][2] - 0.4, 1.3], [-2.6, 0.3, -11, 0.5], [2.6, 0.3, -11, 0.5], [-3.2, 0.3, 9.5, 0.5], [3.2, 0.3, 9.5, 0.5]]
      .map(([x, y, z, r]) => ({ p: new THREE.Vector3(x, y, z), r }));
    this._plumes();
    // aires d'atterrissage connues : l'aire 02 du hangar, puis celles des avant-postes (ajoutées par addPad)
    this.home = { id: 'home', name: 'Halden-7 · aire 02', pos: this.restPos.clone(), q: this.restQ.clone(), inHangar: true };
    this.pads = [this.home];
    this.dockedAt = this.home;
  }

  addPad(pad) { this.pads.push(pad); }
  /** Posé ailleurs qu'au hangar : le joueur reste à bord, la caméra suit le vaisseau. */
  get away() { return this.state === 'parked' && this.dockedAt !== this.home; }

  _bvh() {
    if (this.bvh) return this.bvh;
    const B = this.ctx.builder, [a, b] = this.ship.colliderRange, field = this.ctx.bayField;
    const geo = B.collisionGeometry((g, i) => (i < a || i >= b) && g !== field);
    this.bvh = new MeshBVH(geo, { targetLeafSize: 8 });
    return this.bvh;
  }

  _plumes() {
    const S = this.ship;
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.8, 0.35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.9, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.ConeGeometry(0.85, 6, 20, 1, true); cone.translate(0, -3, 0); cone.rotateX(-Math.PI / 2);
    const core = new THREE.ConeGeometry(0.45, 3.2, 16, 1, true); core.translate(0, -1.6, 0); core.rotateX(-Math.PI / 2);
    this.plumes = [];
    // sorties de tuyères (repère de l'aire) : fournies par le vaisseau, sinon positions historiques
    const T = S.thrusters || { main: [[-3.0, 6.6, 16.7], [3.0, 6.6, 16.7]], vtol: [[-10.3, 2.85, 3.8], [10.3, 2.85, 3.8]] };
    for (let i = 0; i < 2; i++) {
      for (const [g, m] of [[cone, mat], [core, blue]]) {
        const p = new THREE.Mesh(g, m);
        p.position.set(...T.main[i]);
        p.rotation.y = Math.PI;
        p.scale.setScalar(0.001);
        p.renderOrder = 8;
        S.group.add(p);
        this.plumes.push({ m: p, k: g === cone ? 1 : 0.7 });
      }
      // propulseurs verticaux (pods de bout d'aile)
      const v = new THREE.Mesh(core, blue);
      v.position.set(...T.vtol[i]);
      v.rotation.x = Math.PI / 2;
      v.scale.setScalar(0.001);
      S.group.add(v);
      this.plumes.push({ m: v, k: 0.6, vtol: true });
    }
    this.engineLight = new THREE.PointLight(0xff9a50, 0, 30, 2);
    this.engineLight.position.set(0, 6.6, 19);
    S.group.add(this.engineLight);
  }

  get active() { return this.state !== 'parked' || this.away; }
  insideHangar(p = this.pos) { return p.x > -HX && p.x < HX && p.z > Z_BAY && p.z < Z_BACK && p.y < H + 2; }
  /** Aire d'atterrissage à portée (à moins de 22 m à l'horizontale, 18 m au-dessus, vitesse réduite). */
  nearPad() {
    if (this.vel.length() >= 9) return null;
    for (const p of this.pads) {
      const dy = this.pos.y - p.pos.y;
      if (Math.hypot(this.pos.x - p.pos.x, this.pos.z - p.pos.z) < 22 && dy < 18 && dy > -3 && (!p.inHangar || this.insideHangar())) return p;
    }
    return null;
  }

  takeOff() {
    if (this.state !== 'parked') return;
    this.state = 'spool'; this.timer = 0;
    this.spoolFrom = this.pos.clone();
    this.dockedAt = null;
    this._bvh();
    this.onEvent && this.onEvent('takeoff');
  }

  land() {
    const pad = this.state === 'flying' && this.nearPad();
    if (!pad) return false;
    this.state = 'landing'; this.timer = 0;
    this.target = pad;
    this.landFrom = { pos: this.pos.clone(), q: this.q.clone() };
    this.onEvent && this.onEvent('landing');
    return true;
  }

  toggleView() { this.view = this.view === 'chase' ? 'cockpit' : 'chase'; }

  update(dt, input) {
    const S = this.ship;
    if (this.state === 'spool') {
      // montée en régime puis décollage vertical à 2,5 m
      this.timer += dt;
      this.throttle = Math.min(1, this.timer / 2.5) * 0.35;
      if (this.timer > 2.5) this.pos.y = this.spoolFrom.y + Math.min(2.5, (this.timer - 2.5) * 0.9);
      if (this.timer > 5.4) { this.state = 'flying'; this.onEvent && this.onEvent('airborne'); }
      if (this.timer > 2.5) this.vel.set(0, 0.9, 0); 
    } else if (this.state === 'landing') {
      this.timer += dt;
      const k = Math.min(1, this.timer / 6), e = k * k * (3 - 2 * k);
      // approche à 3 m au-dessus de l'aire, puis descente
      const T = this.target;
      const hover = T.pos.clone(); hover.y += 3;
      if (k < 0.75) this.pos.lerpVectors(this.landFrom.pos, hover, Math.min(1, e / 0.75 * 1.05));
      else this.pos.lerpVectors(hover, T.pos, (k - 0.75) / 0.25);
      this.q.slerpQuaternions(this.landFrom.q, T.q, Math.min(1, e * 1.4));
      this.vel.set(0, 0, 0);
      this.throttle = 0.25 * (1 - k);
      if (k >= 1) {
        this.pos.copy(T.pos); this.q.copy(T.q);
        this.state = 'parked'; this.throttle = 0;
        this.dockedAt = T;
        this.onEvent && this.onEvent('landed', T);
      }
    } else if (this.state === 'flying') {
      this._fly(dt, input);
    }
    // transformation du vaisseau : delta par rapport à la pose de repos
    _m.compose(this.pos, this.q, _v.set(1, 1, 1));
    S.root.matrix.multiplyMatrices(_m, this.restInv);
    S.root.matrixWorldNeedsUpdate = true;
    // traînées
    const vt = this.state === 'flying' ? Math.min(1, Math.abs(this.vertical || 0) + 0.25) : this.state === 'spool' || this.state === 'landing' ? 0.8 : 0;
    for (const p of this.plumes) {
      const t = p.vtol ? vt * (this.state === 'parked' ? 0 : 1) : this.throttle;
      const flick = 0.9 + Math.random() * 0.2;
      p.m.scale.set(0.001 + t * p.k * flick, 0.001 + t * p.k * flick, 0.001 + t * (0.6 + 0.6 * flick) * p.k);
      p.m.visible = t > 0.02;
    }
    this.engineLight.intensity = this.throttle * 60;
    // lueur des tuyères (matériaux partagés du vaisseau) : veille posé, régime en vol
    if (S.engines) S.engines.setThrust(this.state === 'parked' ? 0 : Math.min(1, this.throttle * 1.25));
    if (S.vtolEngines) S.vtolEngines.setThrust(this.state === 'parked' ? 0 : vt * 0.8);
    // train d'atterrissage : rentré en vol, sorti au sol, au décollage et en finale ; cales visibles posé
    const G = S.gear;
    if (G) {
      const down = this.state === 'parked' || this.state === 'dead' || (this.state === 'spool' && this.timer < 4.2) || (this.state === 'landing' && this.timer > 2.5);
      G.k += THREE.MathUtils.clamp((down ? 1 : 0) - G.k, -dt * 0.6, dt * 0.6);
      const e = G.k * G.k * (3 - 2 * G.k);
      G.group.position.y = (1 - e) * G.travel;
      G.chocks.visible = this.state === 'parked';
    }
    // rampe arrière : relevée en vol, abaissée posé
    const R = S.ramp;
    if (R) {
      const close = this.state === 'flying' || this.state === 'dead' || (this.state === 'spool' && this.timer > 1.2) || (this.state === 'landing' && this.timer < 4.5);
      R.k += THREE.MathUtils.clamp((close ? 1 : 0) - R.k, -dt * 0.45, dt * 0.45);
      const e = R.k * R.k * (3 - 2 * R.k);
      R.pivot.rotation.x = R.closed * e;
    }
    this._camera(dt);
  }

  _fly(dt, input) {
    const inside = this.insideHangar();
    const k = input.keys;
    const boost = input.run;
    // consignes (repère du vaisseau ; l'avant est -z)
    const fwd = input.move.y, strafe = input.move.x;
    const up = (k.has('Space') || input.touchUp ? 1 : 0) - (k.has('KeyC') || k.has('ControlLeft') || input.touchDown ? 1 : 0);
    const roll = (k.has('KeyQ') ? 1 : 0) - (k.has('KeyE') ? 1 : 0);
    this.vertical = up;
    const vMax = inside ? { f: 14, s: 6, u: 6 } : this.mining ? { f: 28, s: 14, u: 14 } : { f: boost ? 260 : 110, s: 45, u: 45 };
    const want = _v.set(strafe * vMax.s, up * vMax.u, -fwd * vMax.f).applyQuaternion(this.q);
    const acc = inside ? 1.6 : (boost ? 0.9 : 1.2);
    this.vel.lerp(want, 1 - Math.exp(-acc * dt));
    this.throttle += ((Math.max(0, fwd) * (boost && !inside ? 1 : 0.6) + 0.18) - this.throttle) * (1 - Math.exp(-3 * dt));
    // orientation : manche virtuel (souris / glisser), retour au neutre progressif
    const look = input.consumeLook();
    this.stick.x = THREE.MathUtils.clamp(this.stick.x + look.dx * 0.004, -1, 1);
    this.stick.y = THREE.MathUtils.clamp(this.stick.y + look.dy * 0.004, -1, 1);
    this.stick.multiplyScalar(Math.exp(-dt * 2.2));
    const maxRate = inside ? 0.6 : this.mining ? 0.5 : 1.1;
    const target = _v2.set(-this.stick.y * maxRate, -this.stick.x * maxRate, roll * maxRate * 1.4);
    this.rate.lerp(target, 1 - Math.exp(-dt * 4));
    _e.set(this.rate.x * dt, this.rate.y * dt, this.rate.z * dt, 'YXZ');
    this.q.multiply(_q.setFromEuler(_e)).normalize();
    // dans le hangar : assistance à l'assiette (le vaisseau reste à plat)
    if (inside) {
      const fw = _v.set(0, 0, -1).applyQuaternion(this.q);
      const yaw = Math.atan2(-fw.x, -fw.z);
      const level = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      this.q.slerp(level, 1 - Math.exp(-dt * 2.5));
    }
    this.pos.addScaledVector(this.vel, dt);
    this._collide();
  }

  _collide() {
    const bvh = this.bvh;
    _m.compose(this.pos, this.q, _v.set(1, 1, 1)).multiply(this.restInv);
    const target = { point: new THREE.Vector3(), distance: 0 };
    for (const pr of this.probes) {
      // sonde exprimée en coordonnées monde de la pose de repos → pose courante
      const local = this.ship.local(pr.p.x, pr.p.y, pr.p.z);
      const w = local.applyMatrix4(_m);
      const hit = bvh.closestPointToPoint(w, target, 0, pr.r);
      if (hit && hit.distance < pr.r) {
        const n = w.clone().sub(target.point);
        const d = n.length() || 1e-4;
        n.divideScalar(d);
        this.pos.addScaledVector(n, pr.r - d + 0.01);
        const vn = this.vel.dot(n);
        if (vn < 0) this.vel.addScaledVector(n, -vn * 1.3);
        this.vel.multiplyScalar(0.92);
      }
    }
    if (this.pos.y < this.restPos.y && this.insideHangar()) this.pos.y = this.restPos.y;
  }

  _camera(dt) {
    const cam = this.ctx.camera;
    if (this.view === 'cockpit') {
      const eye = this.ship.interior.seat.eye.clone().applyMatrix4(this.ship.root.matrix);
      cam.position.copy(eye);
      cam.quaternion.copy(this.q);
    } else {
      const off = (this.mining ? _v.set(0, 13, 30) : _v.set(0, 7.5, 34)).applyQuaternion(this.q);
      const want = this.pos.clone().add(off);
      if (this.camPos.lengthSq() === 0) this.camPos.copy(want);
      this.camPos.lerp(want, 1 - Math.exp(-dt * 5));
      // la caméra reste dans le hangar quand le vaisseau y est
      if (this.insideHangar()) {
        this.camPos.x = THREE.MathUtils.clamp(this.camPos.x, -HX + 2, HX - 2);
        this.camPos.y = THREE.MathUtils.clamp(this.camPos.y, 1, H - 4);
        this.camPos.z = THREE.MathUtils.clamp(this.camPos.z, Z_BAY - 200, Z_BACK - 2);
      }
      cam.position.copy(this.camPos);
      const look = this.pos.clone().add((this.mining ? _v2.set(0, 3, -70) : _v2.set(0, 4.5, -18)).applyQuaternion(this.q));
      _m.lookAt(cam.position, look, _v.set(0, 1, 0).applyQuaternion(this.q));
      this.camQ.setFromRotationMatrix(_m);
      cam.quaternion.slerp(this.camQ, 1 - Math.exp(-dt * 8));
    }
  }
}
