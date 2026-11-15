import * as THREE from 'three';

// Banque de textures + matériaux PBR avec couche d'usure procédurale en espace monde
// (crasse, salissures en pied de mur, rayures, peinture écaillée).

const BASE = import.meta.env.BASE_URL + 'assets/textures/';

export class Materials {
  constructor(renderer, quality, manager) {
    this.renderer = renderer;
    this.q = quality;
    this.loader = new THREE.TextureLoader(manager);
    this.tex = {};
    this.cache = {};
    this.shared = {
      uGrunge: { value: null },
      uChips: { value: null },
      uTime: { value: 0 },
    };
  }

  load(name, path, srgb, repeat = true) {
    const t = this.loader.load(BASE + path);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.q.anisotropy;
    this.tex[name] = t;
    return t;
  }

  preload() {
    const L = (n, p, s) => this.load(n, p, s);
    L('grunge', 'gen/grunge.jpg', false);
    L('chips', 'gen/chips.jpg', false);
    L('panels_a', 'gen/panels_albedo.jpg', true);
    L('panels_n', 'gen/panels_normal.jpg', false);
    L('panels_orm', 'gen/panels_orm.jpg', false);
    L('clad_a', 'gen/cladding_albedo.jpg', true);
    L('clad_n', 'gen/cladding_normal.jpg', false);
    L('clad_orm', 'gen/cladding_orm.jpg', false);
    L('deck_a', 'gen/deck_albedo.jpg', true);
    L('deck_n', 'gen/deck_normal.jpg', false);
    L('deck_orm', 'gen/deck_orm.jpg', false);
    L('grating_a', 'gen/grating_albedo.jpg', true);
    L('grating_alpha', 'gen/grating_alpha.jpg', false);
    L('grating_n', 'gen/grating_normal.jpg', false);
    L('vent_a', 'gen/vent_albedo.jpg', true);
    L('vent_n', 'gen/vent_normal.jpg', false);
    L('noise3', 'gen/noise3.jpg', false);
    L('concrete_a', 'scan/concrete_albedo.jpg', true);
    L('concrete_n', 'scan/concrete_normal.jpg', false);
    L('concrete_r', 'scan/concrete_rough.jpg', false);
    L('rust_a', 'scan/rustpaint_albedo.jpg', true);
    L('rust_n', 'scan/rustpaint_normal.jpg', false);
    L('rust_r', 'scan/rustpaint_rough.jpg', false);
    L('plaster_a', 'scan/plaster_albedo.jpg', true);
    L('plaster_n', 'scan/plaster_normal.jpg', false);
    L('tiles_a', 'scan/tiles_albedo.jpg', true);
    L('tiles_n', 'scan/tiles_normal.jpg', false);
    L('tiles_r', 'scan/tiles_rough.jpg', false);
    this.shared.uGrunge.value = this.tex.grunge;
    this.shared.uChips.value = this.tex.chips;
  }

  /**
   * Ajoute la couche d'usure à un matériau standard.
   * wear: { grime, floor, scratch, paint, scale, edge }
   */
  addWear(mat, wear = {}) {
    const w = {
      grime: wear.grime ?? 0.6, floor: wear.floor ?? 1.0, scratch: wear.scratch ?? 0.6,
      paint: wear.paint ?? 0, scale: wear.scale ?? 0.33, floorH: wear.floorH ?? 1.1, rust: wear.rust ?? 0,
    };
    const uWear = { value: new THREE.Vector4(w.grime, w.floor, w.scratch, w.scale) };
    const uWear2 = { value: new THREE.Vector4(w.paint, w.floorH, w.rust, 0) };
    mat.userData.wear = { uWear, uWear2 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uGrunge = this.shared.uGrunge;
      sh.uniforms.uChips = this.shared.uChips;
      sh.uniforms.uWear = uWear;
      sh.uniforms.uWear2 = uWear2;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 wp_ = vec4(transformed, 1.0);
          vec3 wn_ = objectNormal;
          #ifdef USE_INSTANCING
            wp_ = instanceMatrix * wp_;
            wn_ = mat3(instanceMatrix) * wn_;
          #endif
          wp_ = modelMatrix * wp_;
          vWPos = wp_.xyz;
          vWNrm = normalize(mat3(modelMatrix) * wn_);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWPos; varying vec3 vWNrm;
          uniform sampler2D uGrunge; uniform sampler2D uChips;
          uniform vec4 uWear; uniform vec4 uWear2;
          vec3 triTex(sampler2D t, vec3 p, vec3 n, float s) {
            vec3 b = pow(abs(n), vec3(4.0)); b /= (b.x + b.y + b.z);
            return texture2D(t, p.zy * s).rgb * b.x + texture2D(t, p.xz * s).rgb * b.y + texture2D(t, p.xy * s).rgb * b.z;
          }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec3 gr_ = triTex(uGrunge, vWPos, vWNrm, uWear.w);
          vec3 grL_ = triTex(uGrunge, vWPos + 13.7, vWNrm, uWear.w * 0.23);
          float hA_ = vWPos.y;
          // salissures en pied de mur / sur le sol (sauf surfaces horizontales hautes)
          float floorD_ = (1.0 - smoothstep(0.0, uWear2.y, hA_)) * uWear.y * (0.45 + 0.55 * grL_.r);
          float grime_ = clamp(gr_.r * 0.6 + grL_.r * 0.6 - 0.25, 0.0, 1.0) * uWear.x;
          diffuseColor.rgb *= 1.0 - grime_ * 0.42;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.075, 0.062), floorD_ * 0.75);
          // traînées verticales (coulures)
          float streak_ = texture2D(uGrunge, vec2(dot(vWPos.xz, vec2(0.7, 0.7)) * 0.6, vWPos.y * 0.03)).r;
          diffuseColor.rgb *= 1.0 - smoothstep(0.55, 1.0, streak_) * 0.25 * uWear.x * (1.0 - abs(vWNrm.y));
          float scr_ = gr_.g * uWear.z;
          diffuseColor.rgb += scr_ * 0.012;
          float rustM_ = smoothstep(0.62, 0.95, grL_.r * 0.65 + gr_.r * 0.45) * uWear2.z * (1.0 - abs(vWNrm.y) * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.23, 0.11, 0.05), rustM_);
          `)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + grime_ * 0.22 + floorD_ * 0.3 - scr_ * 0.12 + rustM_ * 0.3, 0.05, 1.0);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          if (uWear2.x > 0.0) {
            float chip_ = texture2D(uChips, vWPos.xy * 0.37 + vWPos.zy * 0.29).r;
            float bare_ = clamp(metalnessFactor + chip_ * 0.0, 0.0, 1.0) * uWear2.x;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.30, 0.31), bare_);
            metalnessFactor = bare_;
            roughnessFactor = mix(roughnessFactor, 0.32, bare_);
          }
          metalnessFactor = clamp(metalnessFactor - rustM_, 0.0, 1.0);`);
    };
    mat.customProgramCacheKey = () => 'wear';
    return mat;
  }

  // ---- fabriques de matériaux --------------------------------------------------------------

  /** Tôle peinte (murs, structures, coques). La texture couvre 2 m. */
  paint(color, opts = {}) {
    const key = 'paint_' + color + JSON.stringify(opts);
    if (this.cache[key]) return this.cache[key];
    const m = opts.plain
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: opts.rough ?? 0.6, metalness: 0.0 })
      : new THREE.MeshStandardMaterial({
        color: new THREE.Color(color), map: this.tex.panels_a, normalMap: this.tex.panels_n,
        roughnessMap: this.tex.panels_orm, metalnessMap: this.tex.panels_orm, aoMap: this.tex.panels_orm,
        roughness: opts.rough ?? 1.0, metalness: 1.0, aoMapIntensity: 0.8,
        normalScale: new THREE.Vector2(opts.ns ?? 1, opts.ns ?? 1),
      });
    this.addWear(m, { paint: opts.plain ? 0 : (opts.paint ?? 1), grime: opts.grime ?? 0.7, scratch: opts.scratch ?? 0.6, floor: opts.floor ?? 1, rust: opts.rust ?? 0.15 });
    return (this.cache[key] = m);
  }

  /** Bardage nervuré peint (murs). Texture = 4 m. */
  cladding(color, opts = {}) {
    const key = 'clad_' + color + JSON.stringify(opts);
    if (this.cache[key]) return this.cache[key];
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color), map: this.tex.clad_a, normalMap: this.tex.clad_n,
      roughnessMap: this.tex.clad_orm, metalnessMap: this.tex.clad_orm, aoMap: this.tex.clad_orm,
      roughness: 1, metalness: 1, aoMapIntensity: 1,
    });
    this.addWear(m, { paint: 1, grime: opts.grime ?? 0.7, scratch: 0.4, floor: 1, rust: opts.rust ?? 0.2 });
    return (this.cache[key] = m);
  }

  /** Métal brut sombre (poutres, mécanique). */
  metal(color = 0x5a5f63, opts = {}) {
    const key = 'metal_' + color + JSON.stringify(opts);
    if (this.cache[key]) return this.cache[key];
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color), map: this.tex.panels_a, normalMap: this.tex.panels_n,
      roughnessMap: this.tex.panels_orm, aoMap: this.tex.panels_orm, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0.85,
      normalScale: new THREE.Vector2(opts.ns ?? 0.6, opts.ns ?? 0.6),
    });
    this.addWear(m, { grime: opts.grime ?? 0.8, scratch: 0.9, floor: opts.floor ?? 1, rust: opts.rust ?? 0.12 });
    return (this.cache[key] = m);
  }

  /** Métal lisse sans motif de plaques (tuyaux, rambardes, petites pièces). */
  smooth(color, rough = 0.5, metal = 0.9, wear = {}) {
    const key = 'smooth_' + color + rough + metal + JSON.stringify(wear);
    if (this.cache[key]) return this.cache[key];
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: metal });
    this.addWear(m, { grime: 0.6, scratch: 0.8, floor: 1, rust: 0.2, ...wear });
    return (this.cache[key] = m);
  }

  rustPaint(color = 0xffffff) {
    const key = 'rust_' + color;
    if (this.cache[key]) return this.cache[key];
    const m = new THREE.MeshStandardMaterial({
      color, map: this.tex.rust_a, normalMap: this.tex.rust_n, roughnessMap: this.tex.rust_r, roughness: 1, metalness: 0.4,
    });
    this.addWear(m, { grime: 0.4, scratch: 0.3 });
    return (this.cache[key] = m);
  }

  deck() {
    if (this.cache.deck) return this.cache.deck;
    const m = new THREE.MeshStandardMaterial({
      color: 0xc9c6c0, map: this.tex.deck_a, normalMap: this.tex.deck_n, roughnessMap: this.tex.deck_orm,
      metalnessMap: this.tex.deck_orm, aoMap: this.tex.deck_orm, roughness: 1, metalness: 1, aoMapIntensity: 0.7,
    });
    this.addWear(m, { grime: 0.7, floor: 0.0, scratch: 0.15, scale: 0.08, rust: 0.0 });
    return (this.cache.deck = m);
  }

  concrete(color = 0xb8b4ac) {
    const key = 'concrete' + color;
    if (this.cache[key]) return this.cache[key];
    const m = new THREE.MeshStandardMaterial({
      color, map: this.tex.concrete_a, normalMap: this.tex.concrete_n, roughnessMap: this.tex.concrete_r, roughness: 1, metalness: 0,
    });
    this.addWear(m, { grime: 0.5, scratch: 0.2 });
    return (this.cache[key] = m);
  }

  tiles(color = 0xffffff) {
    const key = 'tiles' + color;
    if (this.cache[key]) return this.cache[key];
    const m = new THREE.MeshStandardMaterial({
      color, map: this.tex.tiles_a, normalMap: this.tex.tiles_n, roughnessMap: this.tex.tiles_r, roughness: 0.9, metalness: 0,
    });
    this.addWear(m, { grime: 0.45, scratch: 0.4, floor: 0.0, scale: 0.15 });
    return (this.cache[key] = m);
  }

  plaster(color = 0xffffff) {
    const key = 'plaster' + color;
    if (this.cache[key]) return this.cache[key];
    const m = new THREE.MeshStandardMaterial({ color, map: this.tex.plaster_a, normalMap: this.tex.plaster_n, roughness: 0.92, metalness: 0 });
    this.addWear(m, { grime: 0.5, scratch: 0.1 });
    return (this.cache[key] = m);
  }

  grating() {
    if (this.cache.grating) return this.cache.grating;
    const m = new THREE.MeshStandardMaterial({
      color: 0x8a8d8f, map: this.tex.grating_a, alphaMap: this.tex.grating_alpha, normalMap: this.tex.grating_n,
      alphaTest: 0.5, roughness: 0.6, metalness: 0.85, side: THREE.DoubleSide,
    });
    this.addWear(m, { grime: 0.6, scratch: 0.6, floor: 0 });
    return (this.cache.grating = m);
  }

  vent() {
    if (this.cache.vent) return this.cache.vent;
    const m = new THREE.MeshStandardMaterial({ color: 0x9a9da0, map: this.tex.vent_a, normalMap: this.tex.vent_n, roughness: 0.65, metalness: 0.8 });
    this.addWear(m, { grime: 0.8, scratch: 0.3 });
    return (this.cache.vent = m);
  }

  plastic(color, rough = 0.55) {
    const key = 'plastic' + color + rough;
    if (this.cache[key]) return this.cache[key];
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.0 });
    this.addWear(m, { grime: 0.5, scratch: 0.5, floor: 0.8 });
    return (this.cache[key] = m);
  }

  rubber() {
    if (this.cache.rubber) return this.cache.rubber;
    return (this.cache.rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.92, metalness: 0 }));
  }

  emissive(color, intensity = 4) {
    const key = 'em' + color + intensity;
    if (this.cache[key]) return this.cache[key];
    const c = new THREE.Color(color).multiplyScalar(intensity);
    const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: true });
    return (this.cache[key] = m);
  }

  glass(tint = 0x9fb4c4, opacity = 0.12) {
    const key = 'glass' + tint + opacity;
    if (this.cache[key]) return this.cache[key];
    const m = new THREE.MeshStandardMaterial({
      color: tint, roughness: 0.04, metalness: 0.9, transparent: true, opacity, depthWrite: false, envMapIntensity: 1.6,
    });
    return (this.cache[key] = m);
  }
}

// ------------------------------------------------------------ géométries avec UV métriques

/** Boîte dont les UV sont en mètres / texSize (densité de texel constante). */
export function metricBox(w, h, d, texSize = 2, offset = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const ox = offset ? offset[0] : Math.random(), oy = offset ? offset[1] : Math.random();
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * spans[f][0] / texSize + ox, uv.getY(i) * spans[f][1] / texSize + oy);
    }
  }
  return g;
}

/** Recalcule des UV « planaires monde » (projection selon la normale dominante). */
export function worldUV(geo, texSize = 2, matrix = null) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const uv = new Float32Array(pos.count * 2);
  const nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nrm, i);
    if (matrix) { v.applyMatrix4(matrix); n.applyMatrix3(nm).normalize(); }
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let u, w;
    if (ay >= ax && ay >= az) { u = v.x; w = v.z; } else if (ax >= az) { u = v.z; w = v.y; } else { u = v.x; w = v.y; }
    uv[i * 2] = u / texSize; uv[i * 2 + 1] = w / texSize;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
