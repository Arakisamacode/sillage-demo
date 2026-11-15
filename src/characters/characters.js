import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Retargeter } from './retarget.js';
import { loadBinary } from '../core/binary.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bibliothèque de personnages : « Universal Base Characters » de Quaternius (CC0) habillés
// d'une combinaison peinte en shader selon le rôle, coiffures interchangeables,
// animations « Universal Animation Library » (CC0) reciblées sur leur squelette.

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

export const BODIES = ['UM_light', 'UM_dark', 'UF_light', 'UF_dark'];
export const HAIRS = {
  M: ['Hair_Buzzed', 'Hair_SimpleParted', 'Hair_Buzzed', 'Hair_SimpleParted', 'Hair_Beard'],
  F: ['Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale'],
};
const HAIR_FILES = ['Hair_Buzzed', 'Hair_SimpleParted', 'Hair_Beard', 'Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale'];
export const HAIR_COLORS = [0x2a1d14, 0x16110d, 0x4a3020, 0x6b4a2a, 0x8a6a40, 0x9a9590, 0x5a2a18];

// ------------------------------------------------------------------- combinaison (shader)
function suitify(mat, zones) {
  const u = {
    uTop: { value: new THREE.Color(0x3a4048) }, uBottom: { value: new THREE.Color(0x3a4048) },
    uBoot: { value: new THREE.Color(0x15130f) }, uAccent: { value: new THREE.Color(0xd8e04a) },
    uZones: { value: new THREE.Vector4(zones.neck, zones.wrist, zones.hip, 0) }, // cou, poignet, hanches, gants
    uOpts: { value: new THREE.Vector4(0, 1, 1, 0) },                          // bandes réfléchissantes, ceinture, fermeture
  };
  mat.userData.suit = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <common>', '#include <common>\nuniform vec4 uZones;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRest = position;
        // tissu : on « gonfle » légèrement la combinaison pour casser l'aspect moulant
        float suitV = step(position.y, uZones.x - 0.02) * step(0.2, position.y) * step(abs(position.x), uZones.y - 0.04);
        transformed += objectNormal * suitV * (0.010 + 0.008 * smoothstep(0.8, 1.3, position.y));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vRest; uniform vec3 uTop, uBottom, uBoot, uAccent; uniform vec4 uZones, uOpts;
        float hash3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float suit = step(vRest.y, uZones.x) * max(step(abs(vRest.x), uZones.y), uZones.w);
        float boot = 1.0 - smoothstep(0.30, 0.33, vRest.y);
        float legs = 1.0 - smoothstep(uZones.z - 0.01, uZones.z + 0.01, vRest.y);
        vec3 cloth = mix(uTop, uBottom, legs);
        float belt = (1.0 - smoothstep(0.022, 0.03, abs(vRest.y - uZones.z))) * uOpts.y;
        cloth = mix(cloth, vec3(0.045, 0.04, 0.035), belt);
        float band = (1.0 - smoothstep(0.018, 0.026, abs(vRest.y - 0.5))) + (1.0 - smoothstep(0.016, 0.024, abs(vRest.y - (uZones.x - 0.33))));
        cloth = mix(cloth, uAccent, clamp(band, 0.0, 1.0) * uOpts.x);
        float zip = (1.0 - smoothstep(0.006, 0.011, abs(vRest.x))) * step(0.0, vRest.z) * step(uZones.z, vRest.y) * uOpts.z;
        cloth = mix(cloth, cloth * 0.45 + 0.05, zip);
        float glove = step(uZones.y, abs(vRest.x)) * uZones.w;
        cloth = mix(cloth, uBoot * 1.4, max(boot, glove));
        // plis : reprise de la luminance de la texture de peau, tissu légèrement chiné
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        float shade = mix(0.82, 1.06, clamp((lum - 0.15) * 2.2, 0.0, 1.0));
        shade *= 0.94 + 0.06 * hash3(floor(vRest * 180.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, cloth * shade, suit);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, mix(0.82, 0.42, boot), suit);`)
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * mix(1.0, 0.12, suit);'));
  };
  mat.customProgramCacheKey = () => 'suit';
}

export class CharacterLibrary {
  constructor(manager, quality) {
    this.loader = new GLTFLoader(manager);
    this.q = quality;
    this.templates = {};
    this.hairs = {};
    this.clipsBySkel = {};
  }

  async load(names = BODIES, onProgress) {
    const anim = await this.loader.parseAsync(await loadBinary(BASE + 'anim/ual.glb'), '');
    this.srcScene = anim.scene;
    this.srcClips = anim.animations;
    let k = 0;
    const total = names.length + HAIR_FILES.length;
    await Promise.all([
      ...names.map(async (n) => {
        const g = await this.loader.parseAsync(await loadBinary(BASE + `characters/ubc/${n}.glb`), '');
        this._prepTemplate(n, g.scene);
        onProgress && onProgress(++k / total);
      }),
      ...HAIR_FILES.map(async (h) => {
        const g = await this.loader.parseAsync(await loadBinary(BASE + `characters/ubc/${h}.glb`), '');
        g.scene.updateMatrixWorld(true);
        let mesh = null;
        g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
        mesh.geometry.applyMatrix4(mesh.matrixWorld);
        mesh.material.roughness = 0.6;
        this.hairs[h] = mesh;
        onProgress && onProgress(++k / total);
      }),
    ]);
    // cuisson des clips par squelette (homme / femme)
    for (const n of names) {
      const skel = this.templates[n].skel;
      if (this.clipsBySkel[skel]) continue;
      const tgt = SkeletonUtils.clone(this.templates[n].scene);
      const src = SkeletonUtils.clone(this.srcScene);
      const rt = new Retargeter(src, this.srcClips, tgt);
      const clips = {};
      for (const [role, name] of Object.entries(CLIPS)) {
        const c = rt.bake(name, { fps: 30, inPlace: true, rename: role });
        if (c) clips[role] = c;
      }
      this.clipsBySkel[skel] = clips;
    }
  }

  _prepTemplate(name, scene) {
    scene.updateMatrixWorld(true);
    const bones = {};
    scene.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    const wp = (b) => bones[b].getWorldPosition(new THREE.Vector3());
    const zones = { neck: wp('neck_01').y + 0.035, wrist: Math.abs(wp('hand_l').x) - 0.03, hip: wp('pelvis').y + 0.04 };
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !!this.q.npcShadows; o.receiveShadow = true; o.frustumCulled = false;
      const m = o.material;
      m.envMapIntensity = 0.7;
      if (/Superhero/.test(m.name)) { o.name = 'body'; suitify(m, zones); }
    });
    const head = bones.Head;
    const height = head.getWorldPosition(new THREE.Vector3()).y + 0.13;
    // matrice monde -> repère de l'os de tête (pour y accrocher les coiffures)
    const headInv = new THREE.Matrix4().copy(head.matrixWorld).invert();
    this.templates[name] = { scene, height, skel: name.slice(0, 2), headInv, zones };
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
    // tenue : matériau du corps propre à l'instance (mêmes shaders, autres couleurs)
    this.model.traverse((o) => {
      if (o.name !== 'body') return;
      const src = o.material;
      o.material = src.clone();
      o.material.onBeforeCompile = src.onBeforeCompile;
      o.material.customProgramCacheKey = src.customProgramCacheKey;
      // uniforms propres
      const su = src.userData.suit;
      const u = {};
      for (const [k, v] of Object.entries(su)) u[k] = { value: v.value.clone() };
      o.material.userData.suit = u;
      o.material.onBeforeCompile = (sh) => { src.onBeforeCompile(sh); Object.assign(sh.uniforms, u); };
      const f = opts.outfit || {};
      if (f.top !== undefined) u.uTop.value.set(f.top);
      if (f.bottom !== undefined) u.uBottom.value.set(f.bottom); else if (f.top !== undefined) u.uBottom.value.set(f.top);
      if (f.boot !== undefined) u.uBoot.value.set(f.boot);
      if (f.accent !== undefined) u.uAccent.value.set(f.accent);
      u.uZones.value.w = f.gloves ? 1 : 0;
      u.uOpts.value.set(f.hivis ? 1 : 0, f.belt === false ? 0 : 1, f.zip === false ? 0 : 1, 0);
      this.body = o;
    });
    this.bones.Neck = this.bones.neck_01;
    this.handR = this.bones.hand_r;
    // coiffure accrochée à l'os de tête
    if (opts.hair && lib.hairs[opts.hair]) {
      const h = lib.hairs[opts.hair];
      const mesh = new THREE.Mesh(h.geometry, h.material.clone());
      mesh.material.color.set(opts.hairColor ?? 0x2a1d14);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(t.headInv);
      mesh.castShadow = !!lib.q.npcShadows;
      this.bones.Head.add(mesh);
      // les sourcils intégrés au corps prennent la couleur de la coiffure
      this.model.traverse((o) => { if (o.isMesh && /Hair/.test(o.material.name) && o !== mesh) { o.material = o.material.clone(); o.material.color.set(opts.hairColor ?? 0x2a1d14); } });
    }
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = lib.clipsBySkel[t.skel];
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
