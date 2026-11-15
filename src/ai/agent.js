import * as THREE from 'three';

// Agent : un PNJ avec un rôle et une routine (générateur de tâches).
// Tâches : goto, act, sit, move (linéaire avec hauteur), call, wait, despawn.

const _v = new THREE.Vector3();
let NEXT_ID = 1;

export class Agent {
  constructor(crowd, character, role, routine, opts = {}) {
    this.id = NEXT_ID++;
    this.crowd = crowd;
    this.char = character;
    this.role = role;
    this.pos = new THREE.Vector3(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
    this.yaw = opts.yaw ?? 0;
    this.vel = new THREE.Vector3();
    this.walkSpeed = opts.walkSpeed ?? (1.2 + Math.random() * 0.25);
    this.radius = 0.3;
    this.task = null;
    this.routine = routine(this, crowd.world);
    this.path = null;
    this.alive = true;
    this.curiosity = opts.curiosity ?? (0.4 + Math.random() * 0.6); // tendance à regarder le joueur
    this.blocked = 0;
    this.lookPoint = null;
    this.attached = null; // véhicule ou plate-forme qui porte l'agent
    this.data = {};
    character.root.position.copy(this.pos);
    character.root.rotation.y = this.yaw;
  }

  _next() {
    const r = this.routine.next();
    if (r.done) { this.task = { type: 'despawn' }; return; }
    this.task = r.value;
    this.task.t = 0;
    this._start(this.task);
  }

  _start(t) {
    const c = this.char;
    switch (t.type) {
      case 'goto': {
        this.path = this.crowd.nav.findPath(this.pos.x, this.pos.z, t.x, t.z);
        this.pathI = 0;
        c.stop(0.35);
        break;
      }
      case 'act':
        if (t.anim && t.anim !== 'idle') c.play(t.anim, { fade: t.fade ?? 0.4, speed: t.speed });
        else c.stop(0.4);
        break;
      case 'sit':
        t.phase = 0;
        break;
      case 'move':
        t.from = this.pos.clone();
        t.dist = t.from.distanceTo(_v.set(t.x, t.y ?? this.pos.y, t.z));
        if (t.anim) c.play(t.anim, { fade: 0.3 }); else c.stop(0.3);
        break;
      case 'call':
        t.fn(this);
        break;
      default:
    }
  }

  faceTowards(yaw, dt, rate = 5) {
    let d = yaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * (1 - Math.exp(-dt * rate));
  }

  update(dt, player) {
    if (!this.task) this._next();
    const t = this.task;
    t.t += dt;
    const c = this.char;
    let speed = 0;
    switch (t.type) {
      case 'goto': speed = this._goto(dt, t, player); break;
      case 'act': {
        if (t.face !== undefined) this.faceTowards(typeof t.face === 'number' ? t.face : Math.atan2(t.face.x - this.pos.x, t.face.z - this.pos.z), dt);
        if (t.t >= t.dur) { if (t.then) t.then(this); this.task = null; }
        break;
      }
      case 'sit': {
        // s'asseoir : orientation, entrée, boucle (avec ou sans discussion), sortie
        if (t.phase === 0) {
          this.faceTowards(t.yaw, dt, 8);
          if (Math.abs(Math.atan2(Math.sin(t.yaw - this.yaw), Math.cos(t.yaw - this.yaw))) < 0.08 || t.t > 1.2) {
            this.yaw = t.yaw; t.phase = 1; t.t = 0;
            c.play('sit', { fade: 0.6 });
          }
        } else if (t.phase === 1 && t.t > t.dur) {
          t.phase = 2; t.t = 0;
          c.stop(0.6);
        } else if (t.phase === 1) {
          // alternance silence / conversation
          if (t.talk && ((t.t / 6) | 0) % 2 === 1 && c.override !== 'sitTalk') c.play('sitTalk', { fade: 0.6 });
          if (t.talk && ((t.t / 6) | 0) % 2 === 0 && c.override !== 'sit') c.play('sit', { fade: 0.6 });
        } else if (t.phase === 2 && t.t > 0.6) { this.task = null; }
        break;
      }
      case 'move': {
        const target = _v.set(t.x, t.y ?? this.pos.y, t.z);
        const d = this.pos.distanceTo(target);
        const sp = t.speed ?? 0.8;
        if (d < sp * dt + 0.01) { this.pos.copy(target); if (t.then) t.then(this); this.task = null; }
        else {
          const dir = target.clone().sub(this.pos).normalize();
          this.pos.addScaledVector(dir, sp * dt);
          if (!t.keepYaw) this.faceTowards(Math.atan2(dir.x, dir.z), dt, 6);
          speed = t.anim ? 0 : sp;
        }
        break;
      }
      case 'wait':
        if (t.until(this)) this.task = null;
        break;
      case 'call':
        this.task = null;
        break;
      case 'despawn':
        this.alive = false;
        return;
      default:
        this.task = null;
    }
    if (this.attached) {
      this.pos.copy(this.attached.seatWorld());
      this.yaw = this.attached.seatYaw();
    }
    c.root.position.copy(this.pos);
    c.root.rotation.y = this.yaw;
    c.setSpeed(speed);
    // regard : le joueur s'il est proche et devant, sinon le point d'intérêt de la tâche
    let look = t.look || this.lookPoint;
    if (player) {
      const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
      const d2 = dx * dx + dz * dz;
      const fwd = Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dz;
      if (d2 < 22 && fwd > -0.2 * Math.sqrt(d2) && this.curiosity > 0.3 && !this.attached) {
        look = this._pl || (this._pl = new THREE.Vector3());
        look.set(player.pos.x, player.pos.y + 1.6, player.pos.z);
      }
    }
    c.lookAt(look || null);
  }

  _goto(dt, t, player) {
    const P = this.path;
    if (!P || this.pathI >= P.length) {
      if (t.face !== undefined) this.faceTowards(t.face, dt, 6);
      if (t.face === undefined || Math.abs(Math.atan2(Math.sin(t.face - this.yaw), Math.cos(t.face - this.yaw))) < 0.15) this.task = null;
      return 0;
    }
    const [wx, wz] = P[this.pathI];
    const dx = wx - this.pos.x, dz = wz - this.pos.z;
    const d = Math.hypot(dx, dz);
    const last = this.pathI === P.length - 1;
    if (d < (last ? 0.12 : 0.55)) { this.pathI++; return this.vel.length(); }
    let sp = (t.speed ?? this.walkSpeed);
    if (last && d < 1.0) sp *= Math.max(0.35, d);
    // direction voulue + séparation + priorité au joueur et aux véhicules
    let vx = (dx / d) * sp, vz = (dz / d) * sp;
    const sep = this.crowd.separation(this);
    vx += sep.x * 1.4; vz += sep.z * 1.4;
    let slow = 1;
    if (player) {
      const px = player.pos.x - this.pos.x, pz = player.pos.z - this.pos.z;
      const pd = Math.hypot(px, pz);
      const ahead = (px * dx + pz * dz) / (d * Math.max(pd, 0.01));
      if (pd < 2.2 && ahead > 0.3 && Math.abs(player.pos.y - this.pos.y) < 1.5) {
        // céder le passage : ralentir et s'écarter vers la droite
        slow = Math.min(slow, Math.max(0.15, (pd - 0.7) / 1.5));
        const rx = dz / d, rz = -dx / d;
        vx += rx * 0.9; vz += rz * 0.9;
      }
    }
    for (const v of this.crowd.vehicles) {
      const qx = v.pos.x - this.pos.x, qz = v.pos.z - this.pos.z;
      const qd = Math.hypot(qx, qz);
      if (qd < v.radius + 2.2 && (qx * dx + qz * dz) / (d * qd) > -0.2 && v.speed > 0.2) slow = 0;
    }
    vx *= slow; vz *= slow;
    // inertie
    const k = 1 - Math.exp(-dt * 6);
    this.vel.x += (vx - this.vel.x) * k;
    this.vel.z += (vz - this.vel.z) * k;
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const nav = this.crowd.nav;
    if (nav.walkable(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
    else if (nav.walkable(nx, this.pos.z)) this.pos.x = nx;
    else if (nav.walkable(this.pos.x, nz)) this.pos.z = nz;
    else { this.pos.x = nx; this.pos.z = nz; } // sortie de cellule bloquée
    const v = Math.hypot(this.vel.x, this.vel.z);
    if (v > 0.15) this.faceTowards(Math.atan2(this.vel.x, this.vel.z), dt, 7);
    // bloqué trop longtemps : recalcul du chemin
    if (v < 0.1 && slow > 0.5) { this.blocked += dt; if (this.blocked > 2.5) { this.blocked = 0; this._start(t); } } else this.blocked = 0;
    return v;
  }
}
