import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Retargeter } from './retarget.js';

// Bibliothèque de personnages : modèles Quaternius (CC0) + animations UAL (CC0) reciblées.

const BASE = import.meta.env.BASE_URL + 'assets/';

export const CLIPS = {
  idle: 'Idle_Loop', talk: 'Idle_Talking_Loop', walk: 'Walk_Loop', walkFormal: 'Walk_Formal_Loop',
  jog: 'Jog_Fwd_Loop', run: 'Sprint_Loop', sitEnter: 'Sitting_Enter', sit: 'Sitting_Idle_Loop',
  sitTalk: 'Sitting_Talking_Loop', sitExit: 'Sitting_Exit', repair: 'Fixing_Kneeling', interact: 'Interact',
  pickup: 'PickUp_Table', push: 'Push_Loop', drive: 'Driving_Loop', torch: 'Idle_Torch_Loop', crouch: 'Crouch_Idle_Loop',
};
const LOOPING = new Set(['idle', 'talk', 'walk', 'walkFormal', 'jog', 'run', 'sit', 'sitTalk', 'push', 'drive', 'torch', 'crouch', 'repair']);

// vitesse au sol (m/s) correspondant à timeScale = 1 pour une taille de référence
const GAIT = { walk: 1.35, walkFormal: 1.25, jog: 3.1, run: 5.6 };

export const MODELS = [
  'M_Worker', 'M_Spacesuit', 'M_Suit', 'M_Casual', 'M_Casual2', 'M_Swat', 'M_Adventurer', 'M_Punk', 'M_Beach', 'M_Farmer',
  'F_Worker', 'F_SciFi', 'F_Suit', 'F_Casual', 'F_Formal', 'F_Soldier', 'F_Punk', 'F_Adventurer',
];

export class CharacterLibrary {
  constructor(manager, quality) {
    this.loader = new GLTFLoader(manager);
    this.q = quality;
    this.templates = {};
    this.clipsBySkel = {};
  }

  async load(names = MODELS, onProgress) {
    const anim = await this.loader.loadAsync(BASE + 'anim/ual.glb');
    this.srcScene = anim.scene;
    this.srcClips = anim.animations;
    let k = 0;
    await Promise.all(names.map(async (n) => {
      const g = await this.loader.loadAsync(BASE + `characters/${n}.glb`);
      this._prepTemplate(n, g.scene);
      onProgress && onProgress(++k / names.length);
    }));
    // cuisson des clips par type de squelette
    for (const n of names) {
      const skel = n[0];
      if (this.clipsBySkel[skel]) continue;
      const tgt = SkeletonUtils.clone(this.templates[n].scene);
      const src = SkeletonUtils.clone(this.srcScene);
      const rt = new Retargeter(src, this.srcClips, tgt);
      const clips = {};
      for (const [role, name] of Object.entries(CLIPS)) {
        const c = rt.bake(name, { fps: 30, inPlace: role !== 'sitEnter' && role !== 'sitExit' ? true : false, rename: role });
        if (c) clips[role] = c;
      }
      this.clipsBySkel[skel] = clips;
      this.scale = rt.scale;
    }
  }

  _prepTemplate(name, scene) {
    let height = 1.8;
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = !!this.q.npcShadows;
        o.receiveShadow = true;
        o.frustumCulled = true;
        const m = o.material;
        if (m) {
          m.roughness = /metal/i.test(m.name) ? 0.35 : /eye/i.test(m.name) ? 0.2 : 0.78;
          m.metalness = /metal/i.test(m.name) ? 0.8 : 0.0;
          m.envMapIntensity = 0.8;
        }
      }
    });
    scene.updateMatrixWorld(true);
    let head = null;
    scene.traverse((o) => { if (o.name === 'Head') head = o; });
    if (head) height = head.getWorldPosition(new THREE.Vector3()).y + 0.12;
    this.templates[name] = { scene, height };
  }

  create(name, opts = {}) {
    return new Character(this, name, opts);
  }
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

export class Character {
  constructor(lib, name, opts) {
    const t = lib.templates[name];
    this.name = name;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(t.scene);
    const s = (opts.height ?? 1.76) / t.height;
    this.model.scale.setScalar(s);
    this.heightScale = s;
    this.root.add(this.model);
    this.bones = {};
    this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    // variation de teinte des vêtements (matériaux clonés)
    if (opts.tint) {
      this.model.traverse((o) => {
        if (o.isMesh && o.material && !/skin|eye|hair|brow/i.test(o.material.name)) {
          o.material = o.material.clone();
          o.material.color.offsetHSL(opts.tint[0], opts.tint[1], opts.tint[2]);
        }
      });
    }
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = lib.clipsBySkel[name[0]];
    this.actions = {};
    for (const [role, clip] of Object.entries(this.clips)) {
      const a = this.mixer.clipAction(clip);
      a.setLoop(LOOPING.has(role) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      this.actions[role] = a;
    }
    // locomotion : idle / marche / jogging / course, mélangées selon la vitesse
    this.loco = ['idle', 'walk', 'jog', 'run'];
    if (opts.formal) this.loco[1] = 'walkFormal';
    for (const r of this.loco) { const a = this.actions[r]; a.play(); a.setEffectiveWeight(r === 'idle' ? 1 : 0); }
    this.actions.idle.time = Math.random() * 3;
    this.speed = 0;
    this.override = null;
    this.overrideW = 0;
    this.lookTarget = null;
    this.lookW = 0;
    this.lookYaw = 0; this.lookPitch = 0;
    this.lodSkip = 0;
    this.acc = 0;
  }

  /** Action plein corps (discussion, assis, travail…). */
  play(role, opts = {}) {
    const a = this.actions[role];
    if (!a) return;
    if (this.override === role && !opts.restart) return;
    const prev = this.override ? this.actions[this.override] : null;
    a.reset();
    a.timeScale = opts.speed ?? 1;
    a.setEffectiveWeight(1);
    a.play();
    const fade = opts.fade ?? 0.4;
    if (prev && prev !== a) prev.fadeOut(fade);
    a.fadeIn(fade);
    if (opts.time !== undefined) a.time = opts.time;
    this.override = role;
    this.overrideFadeOut = false;
    this._onDone = opts.onDone || null;
    if (!LOOPING.has(role)) {
      const onFin = (e) => {
        if (e.action !== a) return;
        this.mixer.removeEventListener('finished', onFin);
        const cb = this._onDone; this._onDone = null;
        cb && cb();
      };
      this.mixer.addEventListener('finished', onFin);
    }
  }

  /** Retour à la locomotion. */
  stop(fade = 0.45) {
    if (!this.override) return;
    this.actions[this.override].fadeOut(fade);
    this.override = null;
  }

  setSpeed(v) { this.speed = v; }

  lookAt(p) { this.lookTarget = p; }

  _locomotion() {
    const v = this.speed / this.heightScale * 1.0;
    const w = { idle: 0, walk: 0, jog: 0, run: 0 };
    const G = GAIT;
    if (v < 0.08) w.idle = 1;
    else if (v < G.walk) { const k = v / G.walk; w.idle = 1 - k; w.walk = k; }
    else if (v < G.jog) { const k = (v - G.walk) / (G.jog - G.walk); w.walk = 1 - k; w.jog = k; }
    else { const k = Math.min(1, (v - G.jog) / (G.run - G.jog)); w.jog = 1 - k; w.run = k; }
    const ov = this.override ? 0 : 1;
    const [i, wk, j, r] = this.loco.map((n) => this.actions[n]);
    i.setEffectiveWeight(w.idle * ov);
    wk.setEffectiveWeight(w.walk * ov);
    j.setEffectiveWeight(w.jog * ov);
    r.setEffectiveWeight(w.run * ov);
    // vitesse de lecture accordée à la vitesse au sol (synchronisation des phases)
    const gait = this.loco[1] === 'walkFormal' ? G.walkFormal : G.walk;
    const ts = Math.max(0.6, Math.min(1.6, v / (w.walk >= w.jog ? gait : w.jog >= w.run ? G.jog : G.run)));
    if (v > 0.08) { wk.timeScale = j.timeScale = r.timeScale = ts; }
    // phase commune marche / course
    if (w.jog > 0 && w.walk > 0) j.time = (wk.time / wk.getClip().duration) * j.getClip().duration;
    if (w.run > 0 && w.jog > 0) r.time = (j.time / j.getClip().duration) * r.getClip().duration;
  }

  update(dt, camPos) {
    // niveau de détail : animation à cadence réduite au loin
    if (camPos) {
      const d = camPos.distanceToSquared(this.root.position);
      this.lodSkip = d > 900 ? 3 : d > 400 ? 2 : d > 196 ? 1 : 0;
    }
    this.acc += dt;
    this._frame = (this._frame || 0) + 1;
    if (this.lodSkip && this._frame % (this.lodSkip + 1)) return;
    const step = this.acc; this.acc = 0;
    this._locomotion();
    this.mixer.update(step);
    this._applyLook(step);
  }

  _applyLook(dt) {
    const head = this.bones.Head, neck = this.bones.Neck;
    if (!head || !neck) return;
    let yaw = 0, pitch = 0, want = 0;
    if (this.lookTarget) {
      this.root.updateMatrixWorld();
      head.getWorldPosition(_v);
      const dir = _v.subVectors(this.lookTarget, _v);
      const dist = dir.length();
      // dans le repère du personnage
      _q.copy(this.root.quaternion).invert();
      dir.applyQuaternion(_q);
      yaw = Math.atan2(dir.x, dir.z);
      pitch = -Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
      if (Math.abs(yaw) < 1.4 && dist > 0.3) want = 1;
      yaw = THREE.MathUtils.clamp(yaw, -1.1, 1.1);
      pitch = THREE.MathUtils.clamp(pitch, -0.45, 0.5);
    }
    const k = 1 - Math.exp(-dt * 4);
    this.lookW += (want - this.lookW) * k;
    this.lookYaw += (yaw - this.lookYaw) * k;
    this.lookPitch += (pitch - this.lookPitch) * k;
    if (this.lookW < 0.01) return;
    const rootQ = this.root.quaternion;
    const right = _v.set(1, 0, 0).applyQuaternion(rootQ);
    for (const [bone, f] of [[neck, 0.4], [head, 0.6]]) {
      const qYaw = _q.setFromAxisAngle(UP, this.lookYaw * f * this.lookW);
      const qPitch = _q2.setFromAxisAngle(right, this.lookPitch * f * this.lookW);
      qYaw.multiply(qPitch);
      bone.getWorldQuaternion(_q2);
      _q2.premultiply(qYaw);
      bone.parent.getWorldQuaternion(this._pq || (this._pq = new THREE.Quaternion()));
      bone.quaternion.copy(this._pq.invert().multiply(_q2));
      bone.updateMatrixWorld(true);
    }
  }
}
