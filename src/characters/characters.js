import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
// rôles « debout au repos » où l'aplomb est corrigé (bras plus près du corps, pieds moins écartés)
const STANCE_ROLES = new Set(['idle', 'talk']);
// l'idle partagé (reciblé) écarte les bras (~21° / 12°) et les jambes (~9° / 13°, pieds à ~0,6 m) : correction
// dans le plan frontal, en repère monde (indépendante des axes locaux des os UBC ou Rocketbox)
const ARM_REST = 0.12, ARM_K = 0.6, ARM_MAX = 0.2, LEG_REST = 0.03, LEG_K = 0.8, LEG_MAX = 0.2;

// vitesse au sol (m/s) correspondant à timeScale = 1 pour une taille de référence
const GAIT = { walk: 1.35, walkFormal: 1.25, jog: 3.1, run: 5.6 };

export const BODIES = ['UM_light', 'UM_dark', 'UF_light', 'UF_dark'];
/**
 * Personnages réalistes Microsoft Rocketbox (licence MIT), convertis par tools/convert/rocketbox.mjs.
 * Clés « UF:… » / « UM:… » : le préfixe garde la convention du sexe utilisée partout dans le jeu.
 */
export const RB = {
  f: ['Female_Adult_01', 'Female_Adult_03', 'Female_Adult_05', 'Female_Adult_08', 'Female_Adult_11', 'Female_Adult_14'],
  m: ['Male_Adult_02', 'Male_Adult_05', 'Male_Adult_08', 'Male_Adult_11', 'Male_Adult_14', 'Male_Adult_18'],
  fb: ['Business_Female_02'], mb: ['Business_Male_03'],
  fc: ['Female_Child_01', 'Female_Child_02'], mc: ['Male_Child_01', 'Male_Child_02'],
  special: ['Chef_Female_01', 'Gardener_Male_01', 'Medical_Male_01'],
};
/** Animaux réalistes Rocketbox (Grand Dôme). */
export const RB_ANIMALS = ['Sheep_White_01', 'Goat_White_01', 'Goat_Brown_01', 'Pig_Pink_01', 'Bird_Chicken_Brown_01', 'Bird_Chicken_White_01', 'Bird_Rooster_Brown_01', 'Bird_Duck_Male_01', 'Bird_Duck_Female_01'];
const rbKey = (id) => (/^(Female|Business_Female|Chef_Female)/.test(id) ? 'UF:' : 'UM:') + id;
const rbGroup = (id) => (/Child/.test(id) ? 'RBc' : /Female/.test(id) ? 'RBf' : 'RBm');
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
    // personnages réalistes : chargés en parallèle, sans bloquer si un fichier manque
    // téléphones : sous-ensemble (mémoire graphique limitée), variété conservée
    const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const sub = (a, n) => (touch ? a.slice(0, n) : a);
    const rbIds = [...new Set([...sub(RB.f, 3), ...sub(RB.m, 3), ...RB.fb, ...RB.mb, ...sub(RB.fc, 1), ...sub(RB.mc, 1), ...(touch ? ['Gardener_Male_01'] : RB.special)])];
    this.animals = {};
    const animalsReady = Promise.all(RB_ANIMALS.map(async (id) => {
      try {
        const g = await this.loader.parseAsync(await loadBinary(BASE + `characters/rb/${id}.glb`), '');
        g.scene.traverse((o) => { if (o.isMesh) { o.material.envMapIntensity = 0.5; o.material.roughness = 0.9; } });
        this.animals[id] = g.scene;
      } catch (e) { console.warn('Rocketbox', id, e); }
    }));
    const rbReady = Promise.all(rbIds.map(async (id) => {
      try {
        const g = await this.loader.parseAsync(await loadBinary(BASE + `characters/rb/${id}.glb`), '');
        this._prepRB(rbKey(id), g.scene, rbGroup(id));
      } catch (e) { console.warn('Rocketbox', id, e); }
    }));
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
    await rbReady; await animalsReady;
    // cuisson des clips par squelette (homme / femme, puis groupes Rocketbox : femmes, hommes, enfants)
    for (const n of [...names, ...Object.keys(this.templates).filter((k) => this.templates[k].rb)]) {
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
    // silhouette affinée (le modèle de base est très musclé), puis vêtement généré lié au même squelette
    if (bodyMesh) slimBody(bodyMesh, name.startsWith('UF'));
    if (bodyMesh) {
      const garment = buildGarment(bodyMesh, zones);
      garment.castShadow = !!this.q.npcShadows; garment.receiveShadow = true;
      bodyMesh.parent.add(garment);
    }
    const head = bones.Head;
    const height = head.getWorldPosition(new THREE.Vector3()).y + 0.13;
    // matrice monde -> repère de l'os de tête (pour y accrocher les coiffures)
    const headInv = new THREE.Matrix4().copy(head.matrixWorld).invert();
    this.templates[name] = { scene, height, skel: name.slice(0, 2), headInv, zones, body: bodyMesh, boots: bodyMesh ? buildBoots(bones, bodyMesh) : null };
  }

  _prepRB(key, scene, group) {
    scene.updateMatrixWorld(true);
    let top = 0;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !!this.q.npcShadows; o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        m.envMapIntensity = 0.55;
        if (m.map) m.map.anisotropy = 4;
        if (m.name === 'rb_hair') { m.alphaToCoverage = true; m.alphaTest = 0.5; }
      }
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); top = Math.max(top, b.max.y);
    });
    this.templates[key] = { scene, height: top, skel: group, rb: true, headInv: new THREE.Matrix4(), zones: null, body: null, boots: null };
    (this.rbKeys ||= {})[key] = group;
  }
  /** Gabarit Rocketbox pour un rôle : pool 'f' | 'm' | 'fb' | 'mb' | 'fc' | 'mc', tour à tour (variété maximale). */
  rbPick(pool) {
    const ids = (RB[pool] || []).filter((id) => this.templates[rbKey(id)]);
    if (!ids.length) return null;
    this._rbI ||= {}; const i = (this._rbI[pool] = ((this._rbI[pool] ?? Math.floor(Math.random() * ids.length)) + 1) % ids.length);
    return rbKey(ids[i]);
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
      this._armor[key] = buildArmor(t.body, bones, t.zones, colors);
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

  /**
   * opts.civil : true | 'business' -> personnage réaliste Rocketbox du même sexe (vêtements et visage propres) ;
   * opts.kid : enfant ; opts.rb : identifiant Rocketbox imposé (ex. 'Chef_Female_01'). Sans armure uniquement.
   */
  create(name, opts = {}) {
    if (!opts.armor && (opts.civil || opts.rb)) {
      const fem = /^UF/.test(name);
      const key = opts.rb ? (this.templates[rbKey(opts.rb)] ? rbKey(opts.rb) : null)
        : this.rbPick(opts.kid ? (fem ? 'fc' : 'mc') : opts.civil === 'business' && Math.random() < 0.6 ? (fem ? 'fb' : 'mb') : fem ? 'f' : 'm');
      if (key) return new Character(this, key, { ...opts, hair: null });
    }
    return new Character(this, name, opts);
  }
}

/**
 * Affine le corps : chaque sommet est rapproché de l'axe des os qui l'animent (torse, bras, jambes), sans changer
 * la longueur des membres ni la taille. Coefficients < 1 : plus fin. Mélange selon les poids de peau.
 */
const SLIM = { pelvis: 0.93, spine_01: 0.86, spine_02: 0.83, spine_03: 0.82, neck_01: 0.86, clavicle_l: 0.8, clavicle_r: 0.8,
  upperarm_l: 0.74, upperarm_r: 0.74, lowerarm_l: 0.8, lowerarm_r: 0.8, thigh_l: 0.85, thigh_r: 0.85, calf_l: 0.87, calf_r: 0.87 };
const SLIM_NEXT = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head',
  clavicle_l: 'upperarm_l', clavicle_r: 'upperarm_r', upperarm_l: 'lowerarm_l', upperarm_r: 'lowerarm_r', lowerarm_l: 'hand_l', lowerarm_r: 'hand_r',
  thigh_l: 'calf_l', thigh_r: 'calf_r', calf_l: 'foot_l', calf_r: 'foot_r' };
/** Chaussures montantes : semelle crantée, tige, coque de pointe ; talon lié à l'os du pied, avant-pied à l'os des orteils. */
function buildBoots(bones, bodyMesh) {
  const out = [], skel = bodyMesh.skeleton;
  for (const side of ['l', 'r']) {
    const foot = bones[`foot_${side}`], ball = bones[`ball_${side}`];
    if (!foot || !ball) continue;
    const a = foot.getWorldPosition(new THREE.Vector3()), b = ball.getWorldPosition(new THREE.Vector3());
    const x = (a.x + b.x) / 2, w = 0.098, zH = a.z - 0.055, zB = b.z, zT = b.z + 0.075;
    const parts = { foot: [], ball: [] };
    const put = (k, geo, px, py, pz, m) => { geo.translate(px, py, pz); parts[k].push([geo, m]); };
    const RBG = (sx, sy, sz, r) => new RoundedBoxGeometry(sx, sy, sz, 3, r);
    // chaussure montante profilée : tige cylindrique, empeigne arrondie (capsules), semelle fine débordante
    const L1 = zB - zH, L2 = zT - zB, hw = w / 2;
    const cap = (r, len, sx, sy) => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 16).rotateX(Math.PI / 2).scale(sx, sy, 1);
    put('foot', new THREE.CylinderGeometry(0.047, 0.052, a.y + 0.05 - 0.045, 18, 1, true), x, (a.y + 0.05 + 0.045) / 2, a.z - 0.006, 'upper');
    put('foot', cap(hw * 0.95, L1 - hw * 1.6, 1, 0.78), x, 0.05, (zH + zB) / 2 + 0.004, 'upper');
    put('foot', cap(hw * 0.97, L1 - hw * 1.6, 1.0, 0.16), x, 0.009, (zH + zB) / 2 + 0.004, 'sole');
    put('foot', new THREE.TorusGeometry(0.05, 0.006, 6, 24).rotateX(Math.PI / 2), x, a.y + 0.05, a.z - 0.006, 'trim');
    put('ball', cap(hw * 0.9, L2 - hw * 0.9, 0.98, 0.62), x, 0.038, (zB + zT) / 2 - 0.006, 'upper');
    put('ball', cap(hw * 0.92, L2 - hw * 0.95, 0.98, 0.16), x, 0.009, (zB + zT) / 2 - 0.008, 'sole');
    put('ball', new THREE.BoxGeometry(w * 0.55, 0.004, 0.05), x, 0.062, zB + 0.012, 'trim');
    for (const [k, bone] of [['foot', foot], ['ball', ball]]) {
      const bi = skel.bones.indexOf(bone);
      for (const [geo0, role] of parts[k]) {
        const g = geo0.index ? geo0.toNonIndexed() : geo0;
        for (const at of Object.keys(g.attributes)) if (!['position', 'normal'].includes(at)) g.deleteAttribute(at);
        const n = g.attributes.position.count, shade = role === 'upper' ? 1 : role === 'sole' ? 0.18 : 0.45;
        g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(shade), 3));
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 ? 0 : bi)), 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : 1)), 4));
        out.push(g);
      }
    }
  }
  if (!out.length) return null;
  const g = mergeGeometries(out, false);
  // repère du maillage du corps (identique au repère de repos du modèle)
  g.applyMatrix4(new THREE.Matrix4().copy(bodyMesh.matrixWorld).invert());
  g.computeBoundingSphere();
  return g;
}

function slimBody(mesh, fem = false) {
  const g = mesh.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const bones = mesh.skeleton.bones, idx = Object.fromEntries(bones.map((b, i) => [b.name, i]));
  mesh.updateMatrixWorld(true);
  const M = mesh.matrixWorld, Mi = M.clone().invert();
  const seg = bones.map((b) => {
    const f0 = SLIM[b.name], nx = bones[idx[SLIM_NEXT[b.name]]], f = f0 && (fem ? 1 - (1 - f0) * 0.55 : f0);
    if (!f || !nx) return null;
    const a = b.getWorldPosition(new THREE.Vector3()), d = nx.getWorldPosition(new THREE.Vector3()).sub(a);
    return { a, d, l2: Math.max(1e-6, d.lengthSq()), f };
  });
  const v = new THREE.Vector3(), q = new THREE.Vector3(), acc = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(M); acc.set(0, 0, 0);
    for (let c = 0; c < 4; c++) {
      const w = SW.getComponent(i, c), s = seg[SI.getComponent(i, c)];
      if (!s || w <= 0) continue;
      const t = THREE.MathUtils.clamp(q.subVectors(v, s.a).dot(s.d) / s.l2, 0, 1);
      q.copy(s.a).addScaledVector(s.d, t);                         // point de l'axe de l'os le plus proche
      acc.addScaledVector(q.subVectors(v, q), w * (s.f - 1));
    }
    v.add(acc).applyMatrix4(Mi); P.setXYZ(i, v.x, v.y, v.z);
  }
  P.needsUpdate = true; g.computeBoundingSphere();
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const _sx = new THREE.Vector3(), _sa = new THREE.Vector3(), _sb = new THREE.Vector3(), _sq = new THREE.Quaternion(), _spq = new THREE.Quaternion();
/** Rotation d'un os autour d'un axe monde (sans allocation). */
function rotBoneWorld(bone, axis, angle) {
  bone.parent.getWorldQuaternion(_spq);
  _sq.setFromAxisAngle(axis, angle).multiply(_spq);   // R · P
  _sq.premultiply(_spq.invert());                     // P⁻¹ · R · P
  bone.quaternion.premultiply(_sq).normalize();
}
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
    this.lib = lib; this.opts = opts; this.rb = !!t.rb;
    this.setOutfit(opts.outfit || {});
    this.bones.Neck = this.bones.neck_01;
    // chaussures (matériaux propres au personnage : couleur des bottes de la tenue)
    this.bootMat = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.45, metalness: 0.05, vertexColors: true });
    if (t.boots && this.body) {
      const bm = new THREE.SkinnedMesh(t.boots, this.bootMat);
      bm.bind(this.body.skeleton, this.body.bindMatrix);
      bm.boundingSphere = t.boots.boundingSphere.clone(); bm.boundingSphere.radius *= 1.5;
      bm.castShadow = !!lib.q.npcShadows; bm.receiveShadow = true;
      this.body.parent.add(bm);
    }
    if (this._suits[0]) this.bootMat.color.copy(this._suits[0].uBoot.value).multiplyScalar(1.3);
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
    // variété : chaque personnage a sa propre cadence (0,9–1,1) et sa propre phase sur les boucles (pas de foule synchrone)
    this.rate = 0.9 + Math.random() * 0.2;
    this.actions.idle.time = Math.random() * this.clips.idle.duration;
    this.actions.idle.timeScale = this.rate;
    this._stW = 1;
    this.speed = 0;
    this.override = null;
    this.overrideW = 0;
    this.lookTarget = null;
    this.lookW = 0;
    this.lookYaw = 0; this.lookPitch = 0;
    this.lodSkip = 0;
    this.acc = 0;
    // doigts : l'animation de repos serre les poings ; on les détend vers la pose de repos (main naturelle, mi-fermée)
    this._fingers = [];
    for (const [k, b] of Object.entries(this.bones)) if (/^(index|middle|ring|pinky|thumb)_0[1-3]_[lr]$/.test(k)) this._fingers.push([b, b.quaternion.clone(), /^thumb/.test(k) ? 0.3 : 0.5]);
    // teint propre à chaque personnage (légères variations naturelles)
    const tone = opts.skinTone ?? [0.94 + Math.random() * 0.1, 0.9 + Math.random() * 0.1, 0.86 + Math.random() * 0.12];
    for (const u of this._suits) u.uTone?.value.set(tone[0], tone[1], tone[2], 1);
    // élimination hors champ : sphère englobante de la pose de liaison, élargie (gestes, position assise)
    this.model.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.boundingSphere = o.geometry.boundingSphere.clone(); o.boundingSphere.radius *= 1.35;
      o.frustumCulled = true;
    });
    // pose appliquée dès la création : jamais de pose de liaison (T) même si le personnage n'est jamais mis à jour (loin, LOD)
    this._locomotion();
    this.mixer.update(0);
    for (const [b, q, k] of this._fingers) b.quaternion.slerp(q, k);
    this._stance(1);
  }

  /**
   * Pose figée (mannequin, statue, figurant immobile) : image `time` du clip `role`, doigts détendus, aplomb corrigé,
   * puis retouche facultative `tweak(c)` ; plus aucune mise à jour d'animation ensuite (coût nul, indépendant du LOD).
   */
  freeze(role = 'idle', time = 0, tweak = null) {
    this.mixer.stopAllAction();
    const a = this.actions[role] || this.actions.idle;
    a.reset(); a.setEffectiveWeight(1); a.timeScale = 0; a.play();
    a.time = Math.min(time, a.getClip().duration - 1e-3);
    this.override = null; this.speed = 0;
    this.mixer.update(0);
    for (const [b, q, k] of this._fingers) b.quaternion.slerp(q, k);
    this._stance(1);
    if (tweak) tweak(this);
    this.root.updateMatrixWorld(true);
    this.frozen = true;
  }

  /** Rotation d'un os autour d'un axe exprimé dans le repère du personnage (X gauche, Y haut, Z avant). */
  turnBone(name, ax, ay, az, angle) {
    const b = this.bones[name];
    if (!b) return;
    this.root.updateWorldMatrix(true, false);
    _sx.set(ax, ay, az).transformDirection(this.root.matrixWorld);
    rotBoneWorld(b, _sx, angle);
  }

  /** Pose de défilé (contrapposto) : bassin basculé, épaules en contre, une main sur la hanche selon la variante. */
  fashionPose(v = 0) {
    const side = v % 2 ? -1 : 1;                       // côté de la jambe d'appui
    this._stance(1, 0.1, 0, 1.5);                      // aplomb de mannequin : jambes sous les hanches, bras près du corps
    this.turnBone('pelvis', 0, 0, 1, 0.07 * side);
    this.turnBone('pelvis', 0, 1, 0, 0.1 * side);
    this.turnBone('spine_01', 0, 0, 1, -0.06 * side);
    this.turnBone('spine_03', 0, 0, 1, -0.05 * side);
    this.turnBone('spine_03', 0, 1, 0, -0.12 * side);
    // jambe libre légèrement fléchie et avancée, jambe d'appui verticale
    const free = side > 0 ? 'l' : 'r';
    this.turnBone(`thigh_${free}`, 1, 0, 0, -0.16);
    this.turnBone(`calf_${free}`, 1, 0, 0, 0.26);
    this.turnBone(`foot_${free}`, 1, 0, 0, -0.1);
    this.turnBone('Head', 0, 1, 0, -0.32 * side);
    this.turnBone('Head', 0, 0, 1, 0.06 * side);
    if (v === 2) return;                               // variante bras le long du corps
    // main sur la hanche (côté de la jambe libre) : bras écarté puis IK épaule-coude-poignet vers la hanche
    const s = free === 'l' ? 1 : -1, b = this.bones;
    this.turnBone(`upperarm_${free}`, 0, 0, 1, 0.75 * s);
    this.root.updateMatrixWorld(true);
    const pel = (b.spine_01 || b.pelvis).getWorldPosition(new THREE.Vector3());
    const lx = new THREE.Vector3(1, 0, 0).transformDirection(this.root.matrixWorld), fz = new THREE.Vector3(0, 0, 1).transformDirection(this.root.matrixWorld);
    const tgt = pel.addScaledVector(lx, s * 0.15).addScaledVector(fz, -0.01);   // main à la taille, coude en dehors
    this._ik2(b[`upperarm_${free}`], b[`lowerarm_${free}`], b[`hand_${free}`], tgt);
  }

  /**
   * Aplomb au repos : rapproche les bras du corps et resserre les pieds (plan frontal, repère monde : valable pour tous
   * les squelettes). w : poids 0..1. Appelé après mixer.update (le mixeur réécrit les os à chaque pas : pas de cumul).
   */
  _stance(w, armRest = ARM_REST, legRest = LEG_REST, k = 1) {
    if (w < 0.01) return;
    const b = this.bones;
    this.root.updateWorldMatrix(true, false);
    const m = this.root.matrixWorld.elements;
    for (let i = 0; i < 4; i++) {
      const arm = i < 2, sgn = i % 2 ? -1 : 1, sd = i % 2 ? 'r' : 'l';
      // bras : direction épaule → coude ; jambe : hanche → cheville (axe complet de la jambe)
      const A = arm ? b[`upperarm_${sd}`] : b[`thigh_${sd}`], B = arm ? b[`lowerarm_${sd}`] : b[`foot_${sd}`];
      if (!A || !B) continue;
      // côté extérieur (monde) : X local du personnage (gauche) ou son opposé
      _sx.set(m[0] * sgn, m[1] * sgn, m[2] * sgn).normalize();
      if (arm) { A.updateWorldMatrix(true, false); _sb.copy(B.position).applyMatrix4(A.matrixWorld); } else { B.updateWorldMatrix(true, false); _sb.setFromMatrixPosition(B.matrixWorld); }
      _sa.setFromMatrixPosition(A.matrixWorld);
      _sb.sub(_sa);
      const ang = Math.atan2(_sb.dot(_sx), -_sb.y);
      const d = arm ? Math.min(ARM_MAX * k, Math.max(0, ang - armRest) * Math.min(1, ARM_K * k)) : Math.min(LEG_MAX * k, Math.max(0, ang - legRest) * Math.min(1, LEG_K * k));
      if (d < 1e-3) continue;
      // axe = extérieur × bas : une rotation positive ramène le membre vers la verticale
      _sx.set(_sx.z, 0, -_sx.x).normalize();
      rotBoneWorld(A, _sx, d * w);
      // pied : contre-rotation pour garder la semelle à plat
      if (!arm) rotBoneWorld(B, _sx, -d * w);
    }
  }

  /** Action plein corps (discussion, assis, travail…). */
  play(role, opts = {}) {
    const a = this.actions[role];
    if (!a) return;
    if (this.override === role && !opts.restart) return;
    const prev = this.override ? this.actions[this.override] : null;
    const loop = LOOPING.has(role);
    a.reset();
    // boucles : cadence propre au personnage et phase aléatoire (les figurants ne bougent pas à l'unisson)
    a.timeScale = opts.speed ?? (loop ? this.rate : 1);
    a.setEffectiveWeight(1);
    a.play();
    if (loop && opts.time === undefined) a.time = Math.random() * a.getClip().duration;
    // pas encore animé (créé puis mis en pose aussitôt) : pas de fondu, pose appliquée tout de suite
    const fresh = !this._frame;
    const fade = fresh ? 0 : opts.fade ?? 0.4;
    if (prev && prev !== a) prev.fadeOut(fade);
    a.fadeIn(fade);
    if (opts.time !== undefined) a.time = opts.time;
    this.override = role;
    this.overrideFadeOut = false;
    this._onDone = opts.onDone || null;
    if (fresh && !this.frozen) {
      if (prev && prev !== a) prev.stop();
      a.stopFading(); a.setEffectiveWeight(1);
      this._locomotion();
      this.mixer.update(0);
      this._stW = STANCE_ROLES.has(role) ? 1 : 0;
      this._stance(this._stW);
    }
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
      if (f.boot !== undefined && this.bootMat) this.bootMat.color.set(f.boot).multiplyScalar(1.3);
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
    const A = this.lib.armorFor(this.name, colors);
    // coques skinnées : liées au squelette de ce personnage (elles suivent les membres)
    for (const p of A.skinned) {
      if (!this.body) break;
      const m = new THREE.SkinnedMesh(p.geo, p.mat);
      m.bind(this.body.skeleton, this.body.bindMatrix);
      m.castShadow = this.opts.armorShadows ?? true; m.receiveShadow = true;
      m.boundingSphere = (p.geo.boundingSphere || (p.geo.computeBoundingSphere(), p.geo.boundingSphere)).clone(); m.boundingSphere.radius *= 1.35;
      this.body.parent.add(m);
      this._armor.push(m);
    }
    for (const p of A.rigid) {
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
    if (this.frozen) return;
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
    if (!this.held && !this.upperRole && !this.meal) for (const [b, q, k] of this._fingers) b.quaternion.slerp(q, k);
    // aplomb au repos (debout immobile ou en conversation), en fondu ; pas au loin (lodSkip ≥ 2) ni mains occupées
    const busy = this.held || this.upperRole || this.meal || this.carry;
    const want = busy ? 0 : this.override ? (STANCE_ROLES.has(this.override) ? 1 : 0) : this.actions[this.loco[0]].getEffectiveWeight();
    this._stW += (want - this._stW) * Math.min(1, step * 4);
    if (this.lodSkip < 2) this._stance(this._stW);
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
