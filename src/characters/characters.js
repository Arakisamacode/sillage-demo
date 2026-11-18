import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Retargeter } from './retarget.js';
import { loadBinary } from '../core/binary.js';
import { buildGarment, skinMaterial } from './garment.js';
import { buildArmor, buildGear } from './armor.js';

// Bibliothèque de personnages : « Universal Base Characters » de Quaternius (CC0) habillés
// d'une combinaison peinte en shader selon le rôle, coiffures interchangeables,
// animations « Universal Animation Library » (CC0) reciblées sur leur squelette.

const BASE = import.meta.env.BASE_URL + 'assets/';

export const CLIPS = {
  idle: 'Idle_Loop', talk: 'Idle_Talking_Loop', walk: 'Walk_Loop', walkFormal: 'Walk_Formal_Loop',
  jog: 'Jog_Fwd_Loop', run: 'Sprint_Loop', sitEnter: 'Sitting_Enter', sit: 'Sitting_Idle_Loop',
  sitTalk: 'Sitting_Talking_Loop', sitExit: 'Sitting_Exit', repair: 'Fixing_Kneeling', interact: 'Interact',
  pickup: 'PickUp_Table', push: 'Push_Loop', drive: 'Driving_Loop', torch: 'Idle_Torch_Loop', crouch: 'Crouch_Idle_Loop',
  aim: 'Pistol_Idle_Loop', aimHold: 'Pistol_Aim_Neutral', shoot: 'Pistol_Shoot', reload: 'Pistol_Reload', hit: 'Hit_Chest', death: 'Death01',
  crouchWalk: 'Crouch_Fwd_Loop',
};
const LOOPING = new Set(['idle', 'talk', 'walk', 'walkFormal', 'jog', 'run', 'sit', 'sitTalk', 'push', 'drive', 'torch', 'crouch', 'repair', 'aim', 'aimU', 'aimHoldU', 'crouchWalk']);
// os du haut du corps : les clips « …U » ne pilotent qu'eux (visée en marchant)
const UPPER = /^(spine_02|spine_03|neck_01|head|clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/i;
const UPPER_ROLES = ['aim', 'aimHold', 'shoot', 'reload'];

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
      for (const r of UPPER_ROLES) {
        const c = clips[r];
        if (!c) continue;
        clips[r + 'U'] = new THREE.AnimationClip(r + 'U', c.duration, c.tracks.filter((t) => UPPER.test(t.name.split('.')[0])));
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
    let bodyMesh = null;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !!this.q.npcShadows; o.receiveShadow = true; o.frustumCulled = false;
      const m = o.material;
      m.envMapIntensity = 0.7;
      if (/Superhero/.test(m.name)) { o.name = 'body'; skinMaterial(m, zones); bodyMesh = o; }
    });
    // vêtement généré (veste, pantalon, bottes) lié au même squelette
    if (bodyMesh) {
      const garment = buildGarment(bodyMesh, zones);
      garment.castShadow = !!this.q.npcShadows; garment.receiveShadow = true;
      bodyMesh.parent.add(garment);
    }
    const head = bones.Head;
    const height = head.getWorldPosition(new THREE.Vector3()).y + 0.13;
    // matrice monde -> repère de l'os de tête (pour y accrocher les coiffures)
    const headInv = new THREE.Matrix4().copy(head.matrixWorld).invert();
    this.templates[name] = { scene, height, skel: name.slice(0, 2), headInv, zones };
  }

  /** Pièces d'armure (géométries en repère d'os), mises en cache par corps et par couleurs. */
  armorFor(name, colors) {
    const key = name + JSON.stringify(colors);
    this._armor = this._armor || {};
    if (!this._armor[key]) {
      const t = this.templates[name];
      t.scene.updateMatrixWorld(true);
      const bones = {};
      t.scene.traverse((o) => { if (o.isBone) bones[o.name] = o; });
      this._armor[key] = buildArmor(bones, colors);
    }
    return this._armor[key];
  }

  gearFor(name, kind, shape, accent) {
    const key = [name, kind, shape, accent].join('|');
    this._gear = this._gear || {};
    if (!this._gear[key]) {
      const t = this.templates[name];
      t.scene.updateMatrixWorld(true);
      const bones = {};
      t.scene.traverse((o) => { if (o.isBone) bones[o.name] = o; });
      this._gear[key] = buildGear(bones, kind, shape, accent);
    }
    return this._gear[key];
  }

  create(name, opts = {}) {
    return new Character(this, name, opts);
  }
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3();

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
    this._suits = [];
    this._armor = [];
    this._gear = {};
    this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    // tenue : matériau du corps propre à l'instance (mêmes shaders, autres couleurs)
    this.model.traverse((o) => {
      if (o.name !== 'body' && o.name !== 'garment') return;
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
      this._suits.push(u);
      if (o.name === 'body') this.body = o;
    });
    this.lib = lib; this.opts = opts;
    this.setOutfit(opts.outfit || {});
    this.bones.Neck = this.bones.neck_01;
    this.setArmor(opts.armor);
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
    // élimination hors champ : sphère englobante de la pose de liaison, élargie (gestes, position assise)
    this.model.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.boundingSphere = o.geometry.boundingSphere.clone(); o.boundingSphere.radius *= 1.35;
      o.frustumCulled = true;
    });
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

  /** Couche « haut du corps » (visée, tir, rechargement) par-dessus la locomotion ; null pour l'arrêter. */
  upper(role, opts = {}) {
    const prev = this.upperRole ? this.actions[this.upperRole] : null;
    if (!role) { if (prev) prev.fadeOut(opts.fade ?? 0.25); this.upperRole = null; return; }
    const a = this.actions[role];
    if (!a) return;
    if (this.upperRole === role && !opts.restart) return;
    a.reset(); a.timeScale = opts.speed ?? 1;
    a.setEffectiveWeight(opts.weight ?? 8); a.play(); a.fadeIn(opts.fade ?? 0.12);
    if (prev && prev !== a) prev.fadeOut(opts.fade ?? 0.12);
    this.upperRole = role;
    if (!LOOPING.has(role)) {
      const back = opts.then;
      const onFin = (e) => { if (e.action !== a) return; this.mixer.removeEventListener('finished', onFin); if (this.upperRole === role) this.upper(back || null, { fade: 0.15 }); };
      this.mixer.addEventListener('finished', onFin);
    }
  }

  /** Arme tenue en main (maquette orientée selon le regard) ; null pour la ranger. */
  hold(mesh, kind) {
    if (this.held) this.root.remove(this.held);
    for (const k of ['sidearm', 'primary']) for (const m of this._gear[k] || []) m.visible = !(mesh && k === kind);
    this.held = mesh || null;
    if (mesh) this.root.add(mesh);
    this.aimPitch = this.aimPitch || 0;
  }
  _placeHeld() {
    const h = this.held, hand = this.bones.hand_r || this.bones.Hand_R;
    if (!h || !hand) return;
    this.root.updateMatrixWorld();
    hand.getWorldPosition(_v);
    this.root.worldToLocal(_v);
    h.position.copy(_v);
    h.rotation.set(-(this.aimPitch || 0), 0, 0);
    // arme longue : main gauche sur le garde-main (IK à deux os)
    const L = h.userData.len;
    if (L > 0.3 && this.upperRole !== 'reloadU' && !this.override) {
      h.updateMatrixWorld(true);
      this._ik2(this.bones.upperarm_l, this.bones.lowerarm_l, this.bones.hand_l, new THREE.Vector3(0, -0.02, L * 0.42).applyMatrix4(h.matrixWorld));
    }
  }
  /** Port d'une caisse à bras le corps : les deux mains sur ses flancs (IK). */
  _carryPose() {
    const m = this.carry, hw = this.carryHW || 0.55;
    m.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
    // côté gauche du personnage = +X local (il regarde +Z) ; la caisse a le même cap
    const cy = this.carryY ?? 0.62, cz = this.carryZ ?? -0.12;
    this._ik2(this.bones.upperarm_l, this.bones.lowerarm_l, this.bones.hand_l, new THREE.Vector3(hw + 0.02, cy, cz).applyMatrix4(m.matrixWorld));
    this._ik2(this.bones.upperarm_r, this.bones.lowerarm_r, this.bones.hand_r, new THREE.Vector3(-hw - 0.02, cy, cz).applyMatrix4(m.matrixWorld));
  }
  /** IK analytique à deux os (épaule-coude-poignet) vers une cible monde. */
  _ik2(A, B, C, t) {
    if (!A || !B || !C) return;
    A.updateMatrixWorld(true);
    const a = A.getWorldPosition(new THREE.Vector3()), b = B.getWorldPosition(new THREE.Vector3()), c = C.getWorldPosition(new THREE.Vector3());
    const lab = a.distanceTo(b), lcb = b.distanceTo(c);
    const lat = THREE.MathUtils.clamp(a.distanceTo(t), 0.02, lab + lcb - 0.002);
    const ang = (u, v) => Math.acos(THREE.MathUtils.clamp(u.clone().normalize().dot(v.clone().normalize()), -1, 1));
    const ac = c.clone().sub(a), ab = b.clone().sub(a), ba = a.clone().sub(b), bc = c.clone().sub(b);
    const acab0 = ang(ac, ab), babc0 = ang(ba, bc);
    const acab1 = Math.acos(THREE.MathUtils.clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
    const babc1 = Math.acos(THREE.MathUtils.clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
    let axis0 = ac.clone().cross(ab);
    if (axis0.lengthSq() < 1e-8) axis0.set(0, 1, 0).applyQuaternion(this.root.quaternion);
    axis0.normalize();
    const rotWorld = (bone, axis, angle) => {
      const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      const r = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      bone.quaternion.premultiply(pq.clone().invert().multiply(r).multiply(pq)).normalize();
      bone.updateMatrixWorld(true);
    };
    rotWorld(A, axis0, acab1 - acab0);
    rotWorld(B, axis0, babc1 - babc0);
    const c2 = C.getWorldPosition(new THREE.Vector3()), a2 = A.getWorldPosition(new THREE.Vector3());
    const v1 = c2.sub(a2), v2 = t.clone().sub(a2);
    const axis1 = v1.clone().cross(v2);
    if (axis1.lengthSq() > 1e-10) rotWorld(A, axis1.normalize(), ang(v1, v2));
  }

  lookAt(p) { this.lookTarget = p; }

  /**
   * Repas (assis ou debout) : la main droite fait des allers-retours entre le plat et la bouche (IK à deux os),
   * mastication entre les bouchées, la main gauche reste posée au bord du plateau, le regard suit l'assiette.
   * target : position monde du plat (null pour arrêter) ; utensil : couvert tenu en main (Object3D) ou null.
   */
  eat(target, utensil = null) {
    if (this._utensil) { this._utensil.removeFromParent(); this._utensil = null; }
    this.meal = target ? { p: target.clone(), t: Math.random() * 3, n: 0, pause: 0, jit: new THREE.Vector3() } : null;
    if (target && utensil) { this._utensil = utensil; this.root.add(utensil); }
    this.lookTarget = null;
  }
  _eatPose(dt) {
    const M = this.meal, b = this.bones;
    if (!b.hand_r || !b.Head) return;
    M.t += dt;
    const P = 4.4 + M.pause;
    if (M.t > P) { M.t -= P; M.n++; M.pause = M.n % 4 === 3 ? 2.5 + Math.random() * 2 : 0; M.jit.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.06); }
    const k = M.t;
    this.root.updateMatrixWorld(true);
    const q = this.root.quaternion, fwd = _f.set(0, 0, 1).applyQuaternion(q), right = _r.set(-1, 0, 0).applyQuaternion(q);
    // points clés : plat, bouche, repos (main posée près de l'assiette)
    const plate = _a.copy(M.p).add(M.jit); plate.y += 0.05;
    b.Head.getWorldPosition(_b);
    const mouth = _b.addScaledVector(fwd, 0.1); mouth.y += 0.03;
    const rest = _c.copy(M.p).addScaledVector(fwd, -0.2).addScaledVector(right, 0.12); rest.y += 0.03;
    const sm = (x) => x * x * (3 - 2 * x), L = (u, v, x) => _t.copy(u).lerp(v, sm(THREE.MathUtils.clamp(x, 0, 1)));
    let tgt;
    if (k < 0.7) tgt = L(rest, plate, k / 0.7);
    else if (k < 1.0) tgt = L(plate, plate, 0);
    else if (k < 1.75) tgt = L(plate, mouth, (k - 1.0) / 0.75);
    else if (k < 2.5) { tgt = L(mouth, mouth, 0); tgt.y += Math.sin(k * 14) * 0.004; }
    else if (k < 3.2) tgt = L(mouth, rest, (k - 2.5) / 0.7);
    else tgt = L(rest, rest, 0);
    this.lookTarget = k < 1.2 || k > 3.4 ? M.p : null;
    this._ik2(b.upperarm_r, b.lowerarm_r, b.hand_r, tgt.clone());
    // main gauche au bord du plateau
    if (b.hand_l) { const lh = _c.copy(M.p).addScaledVector(fwd, -0.14).addScaledVector(right, -0.24); lh.y += 0.01; this._ik2(b.upperarm_l, b.lowerarm_l, b.hand_l, lh.clone()); }
    // couvert dans le prolongement de l'avant-bras, pointe vers le plat
    const U = this._utensil;
    if (U) {
      const hw = b.hand_r.getWorldPosition(_a), fa = b.lowerarm_r.getWorldPosition(_b);
      const dir = _c.subVectors(hw, fa).normalize();
      dir.addScaledVector(fwd, 0.6).normalize();
      const pos = _t.copy(hw).addScaledVector(dir, 0.04);
      this.root.worldToLocal(pos);
      U.position.copy(pos);
      _q.setFromUnitVectors(UP, dir);
      _q2.copy(q).invert().multiply(_q);
      U.quaternion.copy(_q2);
    }
  }

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

  /** Change la tenue (couleurs du vêtement porté). */
  setOutfit(f) {
    for (const u of this._suits) {
      if (f.top !== undefined) u.uTop.value.set(f.top);
      if (f.bottom !== undefined) u.uBottom.value.set(f.bottom); else if (f.top !== undefined) u.uBottom.value.set(f.top);
      if (f.boot !== undefined) u.uBoot.value.set(f.boot);
      if (f.accent !== undefined) u.uAccent.value.set(f.accent);
      u.uZones.value.w = f.gloves ? 1 : 0;
      u.uOpts.value.set(f.hivis ? 1 : 0, f.belt === false ? 0 : 1, f.zip === false ? 0 : 1, 0);
    }
  }

  /** Change (ou retire avec null) l'armure. */
  setArmor(colors) {
    for (const m of this._armor) m.parent?.remove(m);
    this._armor = [];
    if (!colors) return;
    for (const p of this.lib.armorFor(this.name, colors)) {
      const m = new THREE.Mesh(p.mesh.geometry, p.mesh.material);
      m.castShadow = this.opts.armorShadows ?? true; m.receiveShadow = true;
      this.bones[p.bone].add(m);
      this._armor.push(m);
    }
  }

  /** Arme rangée visible : kind 'sidearm' | 'primary', shape null pour retirer. */
  setGear(kind, shape, accent) {
    for (const m of this._gear[kind] || []) m.parent?.remove(m);
    this._gear[kind] = [];
    if (!shape) return;
    for (const p of this.lib.gearFor(this.name, kind, shape, accent)) {
      const m = new THREE.Mesh(p.mesh.geometry, p.mesh.material);
      m.castShadow = true;
      this.bones[p.bone].add(m);
      this._gear[kind].push(m);
    }
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
    if (this.held) this._placeHeld();
    if (this.carry) this._carryPose();
    if (this.meal) this._eatPose(step);
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
