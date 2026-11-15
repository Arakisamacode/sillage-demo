import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Retargeter } from './retarget.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
    scene.updateMatrixWorld(true);
    // Fusion : tous les sous-maillages (un par matériau) -> un seul SkinnedMesh à couleurs de sommets.
    // Les matériaux Quaternius sont des couleurs unies : on les cuit dans l'attribut « color »
    // (alpha = rugosité) => 1 appel de rendu par personnage au lieu d'une douzaine.
    const skinned = [];
    scene.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
    let merged = null;
    if (skinned.length) {
      const ref = skinned[0];
      const bones = ref.skeleton.bones;
      const index = new Map(bones.map((b, i) => [b, i]));
      const sameBind = skinned.every((m) => m.bindMatrix.equals(ref.bindMatrix) && m.skeleton.bones.every((b) => index.has(b)));
      if (sameBind) {
        const geos = skinned.map((m) => {
          const g = m.geometry.clone();
          for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
          const n = g.attributes.position.count;
          const col = new Float32Array(n * 4);
          const c = m.material.color.clone();
          const rough = /metal/i.test(m.material.name) ? 0.35 : /eye/i.test(m.material.name) ? 0.2 : /skin/i.test(m.material.name) ? 0.62 : 0.8;
          for (let i = 0; i < n; i++) { col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = rough; }
          g.setAttribute('color', new THREE.BufferAttribute(col, 4));
          // réindexation des os vers le squelette de référence
          const si = g.attributes.skinIndex;
          const arr = new Uint16Array(si.count * 4);
          for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) arr[i * 4 + k] = index.get(m.skeleton.bones[si.getComponent(i, k)]) ?? 0;
          g.setAttribute('skinIndex', new THREE.BufferAttribute(arr, 4));
          if (!g.index) { const idx = []; for (let i = 0; i < n; i++) idx.push(i); g.setIndex(idx); }
          return g;
        });
        const geo = mergeGeometries(geos, false);
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.8 });
        // rugosité depuis l'alpha des couleurs de sommets
        mat.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = vColor.a;')
            .replace('#include <color_fragment>', 'diffuseColor.rgb *= vColor.rgb;');
        };
        mat.customProgramCacheKey = () => 'charvc';
        merged = new THREE.SkinnedMesh(geo, mat);
        merged.name = 'body';
        merged.bind(ref.skeleton, ref.bindMatrix);
        ref.parent.add(merged);
        for (const m of skinned) m.parent.remove(m);
      }
    }
    scene.traverse((o) => {
      if (o.isMesh) { o.castShadow = !!this.q.npcShadows; o.receiveShadow = true; o.frustumCulled = true; }
    });
    scene.updateMatrixWorld(true);
    let head = null;
    scene.traverse((o) => { if (o.name === 'Head') head = o; });
    const height = head ? head.getWorldPosition(new THREE.Vector3()).y + 0.12 : 1.8;
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
    // variation de teinte des vêtements : attribut couleur propre à l'instance (le reste est partagé)
    if (opts.tint) {
      this.model.traverse((o) => {
        if (!o.isSkinnedMesh || !o.geometry.attributes.color) return;
        const g = new THREE.BufferGeometry();
        for (const [k, v] of Object.entries(o.geometry.attributes)) g.setAttribute(k, v);
        g.setIndex(o.geometry.index);
        g.boundingSphere = o.geometry.boundingSphere; g.boundingBox = o.geometry.boundingBox;
        const src = o.geometry.attributes.color.array, col = new Float32Array(src.length);
        const c = new THREE.Color(), hsl = {};
        for (let i = 0; i < src.length; i += 4) {
          c.setRGB(src[i], src[i + 1], src[i + 2]);
          c.getHSL(hsl);
          // peau (teintes orangées claires) et yeux préservés
          const skin = hsl.h > 0.02 && hsl.h < 0.11 && hsl.s > 0.25 && hsl.l > 0.35;
          if (!skin && hsl.l > 0.06) c.offsetHSL(opts.tint[0], opts.tint[1], opts.tint[2]);
          col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; col[i + 3] = src[i + 3];
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 4));
        o.geometry = g;
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
