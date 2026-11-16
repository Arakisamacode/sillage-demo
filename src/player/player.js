import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

// Joueur : capsule en collision avec la géométrie statique (BVH), portes dynamiques et PNJ ;
// caméra première personne (balancement léger) ou troisième personne (épaule, anti-clipping).

const RADIUS = 0.32, HEIGHT = 1.78, EYE = 1.64;
const WALK = 1.55, RUN = 4.2, GRAVITY = 22;

const _seg = new THREE.Line3(), _box = new THREE.Box3(), _tri = new THREE.Vector3(), _cap = new THREE.Vector3();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _ray = new THREE.Ray();

export class Player {
  constructor(ctx, collisionGeo) {
    this.ctx = ctx;
    this.camera = ctx.camera;
    collisionGeo.boundsTree = new MeshBVH(collisionGeo, { targetLeafSize: 8 });
    this.bvh = collisionGeo.boundsTree;
    this.pos = new THREE.Vector3(-26, 0, -6);  // pieds
    this.vel = new THREE.Vector3();
    this.yaw = -2.2; this.pitch = 0.02;
    this.grounded = false;
    this.thirdPerson = false;
    this.camDist = 0;
    this.bob = 0;
    this.speed = 0;
    this.seated = null;
    this.avatar = null;
    this.camPos = new THREE.Vector3();
    this.stepTimer = 0;
    this.onStep = null;
  }

  setAvatar(character) {
    this.avatar = character;
    character.root.visible = false;
    this.ctx.scene.add(character.root);
  }

  toggleView() {
    this.thirdPerson = !this.thirdPerson;
  }

  update(dt, input, npcs, doors) {
    // regard
    const look = input.consumeLook();
    const sens = 0.0022;
    this.yaw -= look.dx * sens;
    this.pitch -= look.dy * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.35, 1.35);

    if (this.seated) { this._updateSeated(dt); return; }

    // déplacement voulu (repère caméra)
    const fwd = _v.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3().addScaledVector(fwd, input.move.y).addScaledVector(right, input.move.x);
    const mag = Math.min(1, wish.length());
    if (mag > 0.01) wish.normalize();
    const target = (input.run ? RUN : WALK) * mag;
    const accel = this.grounded ? 10 : 2;
    const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    hv.lerp(wish.multiplyScalar(target), 1 - Math.exp(-accel * dt));
    this.vel.x = hv.x; this.vel.z = hv.z;
    this.vel.y -= GRAVITY * dt;
    if (this.grounded && this.vel.y < -2) this.vel.y = -2;

    // intégration en sous-pas
    const steps = Math.ceil(dt / 0.012);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this._move(h, npcs, doors);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.pos.y < (this.fallY ?? -5)) { if (this.resetPos) this.pos.copy(this.resetPos); else this.pos.set(-26, 0.1, -6); this.vel.set(0, 0, 0); }

    // pas
    if (this.grounded && this.speed > 0.4) {
      this.stepTimer -= dt * (this.speed / 1.5);
      if (this.stepTimer <= 0) { this.stepTimer = 0.55; this.onStep && this.onStep(this.pos, this.speed); }
    }
    this._updateCamera(dt);
  }

  _move(dt, npcs, doors) {
    this.pos.addScaledVector(this.vel, dt);
    _seg.start.set(this.pos.x, this.pos.y + RADIUS, this.pos.z);
    _seg.end.set(this.pos.x, this.pos.y + HEIGHT - RADIUS, this.pos.z);
    _box.makeEmpty(); _box.expandByPoint(_seg.start); _box.expandByPoint(_seg.end);
    _box.min.addScalar(-RADIUS); _box.max.addScalar(RADIUS);
    const before = _seg.start.clone();
    this.bvh.shapecast({
      intersectsBounds: (b) => b.intersectsBox(_box),
      intersectsTriangle: (tri) => {
        const d = tri.closestPointToSegment(_seg, _tri, _cap);
        if (d < RADIUS) {
          const depth = RADIUS - d;
          const dir = _cap.sub(_tri).normalize();
          _seg.start.addScaledVector(dir, depth);
          _seg.end.addScaledVector(dir, depth);
        }
      },
    });
    // portes du sas (boîtes dynamiques)
    for (const door of doors) {
      if (door.open > 0.85) continue;
      const b = door.box;
      if (b.max.y < this.pos.y + 0.3 || b.min.y > this.pos.y + 1.7) continue;
      const cx = THREE.MathUtils.clamp(_seg.start.x, b.min.x, b.max.x), cz = THREE.MathUtils.clamp(_seg.start.z, b.min.z, b.max.z);
      const dx = _seg.start.x - cx, dz = _seg.start.z - cz, d = Math.hypot(dx, dz);
      if (d < RADIUS && d > 1e-5) { const k = (RADIUS - d) / d; _seg.start.x += dx * k; _seg.start.z += dz * k; _seg.end.x += dx * k; _seg.end.z += dz * k; }
    }
    // obstacles orientés (coque du Héron posé sur un avant-poste)
    for (const ob of this.obbs || []) {
      if (this.pos.y + 1.7 < ob.y0 || this.pos.y + 0.2 > ob.y1) continue;
      const l = _v.set(_seg.start.x, 0, _seg.start.z).applyMatrix4(ob.inv);
      const ex = ob.hx + RADIUS - Math.abs(l.x), ez = ob.hz + RADIUS - Math.abs(l.z);
      if (ex <= 0 || ez <= 0) continue;
      const push = ex < ez ? _v2.set(Math.sign(l.x || 1) * ex, 0, 0) : _v2.set(0, 0, Math.sign(l.z || 1) * ez);
      push.transformDirection(ob.mat).multiplyScalar(ex < ez ? ex : ez);
      _seg.start.add(push); _seg.end.add(push);
    }
    // PNJ (cercles)
    for (const n of npcs) {
      const dx = _seg.start.x - n.pos.x, dz = _seg.start.z - n.pos.z;
      const d = Math.hypot(dx, dz), r = RADIUS + 0.28;
      if (d < r && d > 1e-4 && Math.abs(n.pos.y - this.pos.y) < 1.5) { const k = (r - d) / d; _seg.start.x += dx * k; _seg.start.z += dz * k; _seg.end.x += dx * k; _seg.end.z += dz * k; }
    }
    const delta = _seg.start.clone().sub(before);
    this.grounded = delta.y > Math.abs(dt * this.vel.y * 0.25);
    const off = Math.max(0, delta.length() - 1e-5);
    delta.normalize().multiplyScalar(off);
    this.pos.add(delta);
    if (this.grounded) this.vel.y = 0;
    else { delta.normalize(); this.vel.addScaledVector(delta, -delta.dot(this.vel)); }
  }

  _updateCamera(dt) {
    const cam = this.camera;
    const want = this.thirdPerson ? (this.aiming ? 2.6 : 2.9) : 0;
    this.camDist += (want - this.camDist) * (1 - Math.exp(-dt * 6));
    const moving = this.grounded && this.speed > 0.3;
    this.bob += dt * this.speed * 2.2 * (moving ? 1 : 0);
    const bobY = this.thirdPerson ? 0 : Math.sin(this.bob * 2) * 0.025 * Math.min(1, this.speed / 2);
    const bobX = this.thirdPerson ? 0 : Math.cos(this.bob) * 0.015 * Math.min(1, this.speed / 2);
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + EYE + bobY, this.pos.z);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    if (this.camDist > 0.05) {
      // épaule droite, recul limité par la géométrie
      // caméra centrée derrière le personnage, légèrement au-dessus (le viseur passe au-dessus de la tête)
      const back = new THREE.Vector3(0, this.aiming ? 0.55 : 0.4, this.camDist).applyQuaternion(q);
      const len = back.length();
      _ray.origin.copy(eye); _ray.direction.copy(back).normalize();
      const hit = this.bvh.raycastFirst(_ray, THREE.DoubleSide);
      const d = hit ? Math.min(len, hit.distance - 0.25) : len;
      eye.addScaledVector(_ray.direction, Math.max(0.2, d));
    } else {
      eye.add(new THREE.Vector3(bobX, 0, 0).applyQuaternion(q));
    }
    cam.position.copy(eye);
    cam.quaternion.copy(q);
    this.camPos.copy(eye);
    // avatar
    if (this.avatar) {
      this.avatar.root.visible = this.camDist > 0.6;
      this.avatar.root.position.copy(this.pos);
      if (this.aiming || this.faceCam) {
        let d = this.yaw + Math.PI - this.avatar.root.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.avatar.root.rotation.y += d * (1 - Math.exp(-dt * 16));
      } else if (this.speed > 0.2) {
        const face = Math.atan2(this.vel.x, this.vel.z);
        let d = face - this.avatar.root.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.avatar.root.rotation.y += d * (1 - Math.exp(-dt * 10));
      }
      this.avatar.setSpeed(this.speed);
      this.avatar.update(dt, null);
    }
  }

  /** S'asseoir à un poste (siège du cockpit). */
  sit(seat) {
    this.seated = seat;
    this.vel.set(0, 0, 0);
    if (this.avatar) {
      this.avatar.root.position.copy(seat.pos);
      this.avatar.root.rotation.y = seat.yaw;
      this.avatar.play('sit', { fade: 0.3 });
    }
  }

  stand() {
    if (!this.seated) return;
    this.pos.copy(this.seated.exit);
    this.seated = null;
    this.avatar && this.avatar.stop(0.3);
  }

  _updateSeated(dt) {
    const s = this.seated;
    this.yaw = THREE.MathUtils.clamp(this.yaw, s.yaw + Math.PI - 1.4, s.yaw + Math.PI + 1.4);
    const eye = s.eye.clone();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    if (this.thirdPerson) eye.add(new THREE.Vector3(0, 0.4, 2.3).applyQuaternion(q));
    this.camera.position.lerp(eye, 1 - Math.exp(-dt * 8));
    this.camera.quaternion.slerp(q, 1 - Math.exp(-dt * 12));
    this.camPos.copy(this.camera.position);
    if (this.avatar) { this.avatar.root.visible = this.thirdPerson; this.avatar.update(dt, null); }
  }
}
