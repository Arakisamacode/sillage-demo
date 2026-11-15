import * as THREE from 'three';

// Reciblage d'animations : Universal Animation Library (squelette « DEF-* ») -> personnages
// modulaires Quaternius (squelette « Hips / Abdomen / … »).
// Méthode : 1) on aligne la pose de référence de la cible sur celle de la source (directions des os),
// 2) pour chaque image : rotation monde cible = rotation monde source · (réf. source)⁻¹ · réf. cible.

// source -> cible ; l'enfant sert à calculer la direction de l'os.
// Les doigts sont numérotés 2-4 (hommes) ou 1-3 (femmes) selon le pack Quaternius.
export function boneMap(tgtNames) {
  if (tgtNames.has('pelvis')) return ueBoneMap();
  const fo = tgtNames.has('Index1L') ? 1 : 2;      // premier index de phalange
  const thumb = tgtNames.has('Thumb1L') ? [1, 2, 3] : [2, 3];
  return [
    ['DEF-hips', 'Hips', 'DEF-spine001', 'Abdomen'],
    ['DEF-spine001', 'Abdomen', 'DEF-spine002', 'Torso'],
    ['DEF-spine002', 'Torso', 'DEF-spine003', 'Chest'],
    ['DEF-spine003', 'Chest', 'DEF-neck', 'Neck'],
    ['DEF-neck', 'Neck', 'DEF-head', 'Head'],
    ['DEF-head', 'Head', null, null],
    ...['L', 'R'].flatMap((s) => [
      [`DEF-shoulder${s}`, `Shoulder${s}`, `DEF-upper_arm${s}`, `UpperArm${s}`],
      [`DEF-upper_arm${s}`, `UpperArm${s}`, `DEF-forearm${s}`, `LowerArm${s}`],
      [`DEF-forearm${s}`, `LowerArm${s}`, `DEF-hand${s}`, `Hand${s}`],
      [`DEF-hand${s}`, `Hand${s}`, `DEF-f_middle01${s}`, `Middle${fo}${s}`],
      [`DEF-thigh${s}`, `UpperLeg${s}`, `DEF-shin${s}`, `LowerLeg${s}`],
      [`DEF-shin${s}`, `LowerLeg${s}`, `DEF-foot${s}`, `Foot${s}`],
      [`DEF-foot${s}`, `Foot${s}`, null, null],
      ...['index', 'middle', 'ring', 'pinky'].flatMap((f) => {
        const F = f[0].toUpperCase() + f.slice(1);
        return [
          [`DEF-f_${f}01${s}`, `${F}${fo}${s}`, `DEF-f_${f}02${s}`, `${F}${fo + 1}${s}`],
          [`DEF-f_${f}02${s}`, `${F}${fo + 1}${s}`, `DEF-f_${f}03${s}`, `${F}${fo + 2}${s}`],
          [`DEF-f_${f}03${s}`, `${F}${fo + 2}${s}`, null, null],
        ];
      }),
      ...thumb.map((ti, k) => [`DEF-thumb0${k + 1}${s}`, `Thumb${ti}${s}`, k + 1 < thumb.length ? `DEF-thumb0${k + 2}${s}` : null, k + 1 < thumb.length ? `Thumb${thumb[k + 1]}${s}` : null]),
    ]),
  ];
}

/** Squelette type Unreal (Universal Base Characters) : pelvis, spine_01…, clavicle_l… */
function ueBoneMap() {
  return [
    ['DEF-hips', 'pelvis', 'DEF-spine001', 'spine_01'],
    ['DEF-spine001', 'spine_01', 'DEF-spine002', 'spine_02'],
    ['DEF-spine002', 'spine_02', 'DEF-spine003', 'spine_03'],
    ['DEF-spine003', 'spine_03', 'DEF-neck', 'neck_01'],
    ['DEF-neck', 'neck_01', 'DEF-head', 'Head'],
    ['DEF-head', 'Head', null, null],
    ...[['L', 'l'], ['R', 'r']].flatMap(([S, s]) => [
      [`DEF-shoulder${S}`, `clavicle_${s}`, `DEF-upper_arm${S}`, `upperarm_${s}`],
      [`DEF-upper_arm${S}`, `upperarm_${s}`, `DEF-forearm${S}`, `lowerarm_${s}`],
      [`DEF-forearm${S}`, `lowerarm_${s}`, `DEF-hand${S}`, `hand_${s}`],
      [`DEF-hand${S}`, `hand_${s}`, `DEF-f_middle01${S}`, `middle_01_${s}`],
      [`DEF-thigh${S}`, `thigh_${s}`, `DEF-shin${S}`, `calf_${s}`],
      [`DEF-shin${S}`, `calf_${s}`, `DEF-foot${S}`, `foot_${s}`],
      [`DEF-foot${S}`, `foot_${s}`, `DEF-toe${S}`, `ball_${s}`],
      [`DEF-toe${S}`, `ball_${s}`, null, null],
      ...['index', 'middle', 'ring', 'pinky', 'thumb'].flatMap((f) => {
        const src = f === 'thumb' ? 'DEF-thumb' : `DEF-f_${f}`;
        return [
          [`${src}01${S}`, `${f}_01_${s}`, `${src}02${S}`, `${f}_02_${s}`],
          [`${src}02${S}`, `${f}_02_${s}`, `${src}03${S}`, `${f}_03_${s}`],
          [`${src}03${S}`, `${f}_03_${s}`, null, null],
        ];
      }),
    ]),
  ];
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();

function findBones(root) {
  const map = {};
  root.traverse((o) => { if (o.name) map[o.name] = o; });
  return map;
}

function worldPos(o, out) { return o.getWorldPosition(out); }
function worldQuat(o, out) { return o.getWorldQuaternion(out); }

/** Applique une rotation monde à un os (en gardant le parent). */
function setWorldQuat(bone, qWorld) {
  bone.parent.getWorldQuaternion(_q3).invert();
  bone.quaternion.copy(_q3.multiply(qWorld));
  bone.updateMatrixWorld(true);
}

/**
 * Prépare le reciblage entre une source (scène UAL) et une cible (scène personnage).
 * Renvoie un objet capable de « cuire » des clips pour la cible.
 */
export class Retargeter {
  constructor(srcRoot, srcClips, tgtRoot) {
    this.srcRoot = srcRoot;
    this.tgtRoot = tgtRoot;
    this.src = findBones(srcRoot);
    this.tgt = findBones(tgtRoot);
    this.pairs = boneMap(new Set(Object.keys(this.tgt))).filter(([s, t]) => this.src[s] && this.tgt[t]);
    const tn = (src) => (this.pairs.find((p) => p[0] === src) || [])[1];
    this.hips = tn('DEF-hips'); this.armL = tn('DEF-upper_armL'); this.footL = tn('DEF-footL');
    this.clips = srcClips;
    this.srcMixer = new THREE.AnimationMixer(srcRoot);
    this._prepare();
  }

  _poseSource(clipName, time) {
    const clip = this.clips.find((c) => c.name === clipName);
    this.srcMixer.stopAllAction();
    const a = this.srcMixer.clipAction(clip);
    a.reset().play();
    this.srcMixer.setTime(time);
    this.srcRoot.updateMatrixWorld(true);
  }

  _prepare() {
    const S = this.src, T = this.tgt;
    // pose de référence source : 1re image de A_TPose (si dispo), sinon repos
    if (this.clips.find((c) => c.name === 'A_TPose')) this._poseSource('A_TPose', 0);
    this.srcRoot.updateMatrixWorld(true);
    this.tgtRoot.updateMatrixWorld(true);
    // orientation : même côté pour le bras gauche
    const sl = worldPos(S['DEF-upper_armL'], new THREE.Vector3()).x - worldPos(S['DEF-hips'], _v2).x;
    const tl = worldPos(T[this.armL], new THREE.Vector3()).x - worldPos(T[this.hips], _v2).x;
    if (Math.sign(sl) !== Math.sign(tl)) {
      this.srcRoot.rotation.y += Math.PI;
      this.srcRoot.updateMatrixWorld(true);
    }
    // alignement de la pose de référence cible sur la source
    for (const [s, t, sc, tc] of this.pairs) {
      if (!sc || !S[sc] || !T[tc]) continue;
      const ds = worldPos(S[sc], _v1).sub(worldPos(S[s], _v2)).normalize();
      const dt = worldPos(T[tc], _v3).sub(worldPos(T[t], _v2)).normalize();
      const swing = _q1.setFromUnitVectors(dt, ds);
      const qw = worldQuat(T[t], _q2);
      setWorldQuat(T[t], _q2.premultiply(swing));
    }
    this.tgtRoot.updateMatrixWorld(true);
    this.refSrc = {}; this.refTgt = {};
    for (const [s, t] of this.pairs) {
      this.refSrc[s] = worldQuat(S[s], new THREE.Quaternion());
      this.refTgt[t] = worldQuat(T[t], new THREE.Quaternion());
    }
    this.refSrcHips = worldPos(S['DEF-hips'], new THREE.Vector3());
    this.refTgtHips = worldPos(T[this.hips], new THREE.Vector3());
    // échelle : hauteur des hanches au-dessus des pieds
    const sFoot = worldPos(S['DEF-footL'], new THREE.Vector3());
    const tFoot = worldPos(T[this.footL], new THREE.Vector3());
    this.scale = (this.refTgtHips.y - tFoot.y) / Math.max(0.01, this.refSrcHips.y - sFoot.y);
    // conserver la pose de référence locale de la cible
    this.tgtRefLocal = {};
    for (const [, t] of this.pairs) this.tgtRefLocal[t] = T[t].quaternion.clone();
    this.hipsParentInv = new THREE.Matrix4().copy(T[this.hips].parent.matrixWorld).invert();
    this.tgtHipsRefLocalPos = T[this.hips].position.clone();
  }

  /** Cuit un clip source en clip cible (échantillonné à fps). */
  bake(name, opts = {}) {
    const S = this.src, T = this.tgt;
    const clip = this.clips.find((c) => c.name === name);
    if (!clip) return null;
    const fps = opts.fps ?? 30;
    const n = Math.max(2, Math.round(clip.duration * fps) + 1);
    const times = new Float32Array(n);
    const qtracks = {};
    for (const [, t] of this.pairs) qtracks[t] = new Float32Array(n * 4);
    const hipsPos = new Float32Array(n * 3);
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const time = Math.min(clip.duration, (i / (n - 1)) * clip.duration);
      times[i] = time;
      this._poseSource(name, time);
      // repartir de la référence cible
      for (const [, t] of this.pairs) T[t].quaternion.copy(this.tgtRefLocal[t]);
      T[this.hips].position.copy(this.tgtHipsRefLocalPos);
      this.tgtRoot.updateMatrixWorld(true);
      for (const [s, t] of this.pairs) {
        worldQuat(S[s], qa);
        qb.copy(this.refSrc[s]).invert();
        qa.multiply(qb).multiply(this.refTgt[t]);
        setWorldQuat(T[t], qa);
        T[t].quaternion.toArray(qtracks[t], i * 4);
      }
      // hanches : déplacement relatif, mis à l'échelle
      const sp = worldPos(S['DEF-hips'], _v1).sub(this.refSrcHips).multiplyScalar(this.scale);
      if (opts.inPlace) { sp.x = 0; sp.z = 0; }
      const wp = _v2.copy(this.refTgtHips).add(sp);
      wp.applyMatrix4(this.hipsParentInv);
      wp.toArray(hipsPos, i * 3);
    }
    // assurer la continuité des quaternions (éviter les retournements)
    for (const k of Object.keys(qtracks)) {
      const a = qtracks[k];
      for (let i = 1; i < n; i++) {
        const d = a[i * 4] * a[i * 4 - 4] + a[i * 4 + 1] * a[i * 4 - 3] + a[i * 4 + 2] * a[i * 4 - 2] + a[i * 4 + 3] * a[i * 4 - 1];
        if (d < 0) for (let c = 0; c < 4; c++) a[i * 4 + c] *= -1;
      }
    }
    const tracks = Object.entries(qtracks).map(([bone, v]) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, v));
    tracks.push(new THREE.VectorKeyframeTrack(`${this.hips}.position`, times, hipsPos));
    const out = new THREE.AnimationClip(opts.rename ?? name, clip.duration, tracks);
    // remettre la cible au repos d'origine
    for (const [, t] of this.pairs) T[t].quaternion.copy(this.tgtRefLocal[t]);
    T[this.hips].position.copy(this.tgtHipsRefLocalPos);
    return out;
  }
}
