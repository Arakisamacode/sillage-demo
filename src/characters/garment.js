import * as THREE from 'three';

// Vêtements générés à partir du corps : on soude les sommets, on décolle la surface selon des zones
// (veste, manches, pantalon, bottes, col), on la lisse (filtre de Taubin) pour effacer la musculature,
// puis on la lie au même squelette. Les couleurs sont calculées en shader à partir de la position de repos.

/** zones : { neck, wrist, hip } en mètres (pose de repos en T). */
/** Corps soudé (sans coutures UV) : positions, normales lissées, triangles, influences du squelette. */
export function weldBody(body) {
  const src = body.geometry;
  const P = src.attributes.position, SI = src.attributes.skinIndex, SW = src.attributes.skinWeight;
  // 1) soudure par position (supprime les coutures UV)
  const key = (i) => `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
  const map = new Map(), remap = new Int32Array(P.count);
  const pos = [], sIdx = [], sW = [];
  for (let i = 0; i < P.count; i++) {
    const k = key(i);
    let j = map.get(k);
    if (j === undefined) {
      j = pos.length / 3; map.set(k, j);
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      for (let c = 0; c < 4; c++) { sIdx.push(SI.getComponent(i, c)); sW.push(SW.getComponent(i, c)); }
    }
    remap[i] = j;
  }
  const n = pos.length / 3;
  const idx = src.index ? src.index.array : Array.from({ length: P.count }, (_, i) => i);
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) tris.push(remap[idx[t]], remap[idx[t + 1]], remap[idx[t + 2]]);
  // 2) normales lissées sur le corps soudé
  const nrm = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cb = new THREE.Vector3(), ab = new THREE.Vector3();
  for (let t = 0; t < tris.length; t += 3) {
    const [i0, i1, i2] = [tris[t], tris[t + 1], tris[t + 2]];
    a.fromArray(pos, i0 * 3); b.fromArray(pos, i1 * 3); c.fromArray(pos, i2 * 3);
    cb.subVectors(c, b); ab.subVectors(a, b); cb.cross(ab);
    for (const i of [i0, i1, i2]) { nrm[i * 3] += cb.x; nrm[i * 3 + 1] += cb.y; nrm[i * 3 + 2] += cb.z; }
  }
  for (let i = 0; i < n; i++) { a.fromArray(nrm, i * 3).normalize(); a.toArray(nrm, i * 3); }
  return { pos, nrm, tris, sIdx, sW, n };
}

export function buildGarment(body, zones) {
  const { pos, nrm, tris, sIdx, sW, n } = weldBody(body);
  // 3) zones et épaisseurs
  const inSuit = new Uint8Array(n), off = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.abs(pos[i * 3]), y = pos[i * 3 + 1];
    if (y > zones.neck || x > zones.wrist) continue;
    if (y < 0.1) continue;                                    // pieds : chaussures rigides articulées (characters.js)
    inSuit[i] = 1;
    let o;
    // tissu technique ajusté : quelques millimètres au-dessus de la peau (plus d'effet doudoune)
    if (y < 0.34) o = 0.016;                                  // tige des bottes
    else if (y < zones.hip - 0.1) o = 0.011;                  // pantalon
    else if (x > 0.24) o = 0.01;                              // manches
    else o = 0.014;                                           // veste
    if (x > zones.wrist - 0.06) o = 0.007;                    // poignets resserrés
    if (y > zones.neck - 0.05) o = 0.014;                     // col
    off[i] = o;
  }
  const keep = [];
  for (let t = 0; t < tris.length; t += 3) if (inSuit[tris[t]] && inSuit[tris[t + 1]] && inSuit[tris[t + 2]]) keep.push(tris[t], tris[t + 1], tris[t + 2]);
  const q = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) q[i * 3 + k] = pos[i * 3 + k] + nrm[i * 3 + k] * off[i];
  // 4) lissage de Taubin (λ / μ) sur la surface du vêtement : supprime abdos et reliefs sans rétrécir
  const nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < keep.length; t += 3) {
    const [i0, i1, i2] = [keep[t], keep[t + 1], keep[t + 2]];
    nb[i0].add(i1); nb[i0].add(i2); nb[i1].add(i0); nb[i1].add(i2); nb[i2].add(i0); nb[i2].add(i1);
  }
  const tmp = new Float32Array(n * 3);
  const pass = (lambda) => {
    for (let i = 0; i < n; i++) {
      const s = nb[i];
      if (!s.size) { for (let k = 0; k < 3; k++) tmp[i * 3 + k] = q[i * 3 + k]; continue; }
      let mx = 0, my = 0, mz = 0;
      for (const j of s) { mx += q[j * 3]; my += q[j * 3 + 1]; mz += q[j * 3 + 2]; }
      mx /= s.size; my /= s.size; mz /= s.size;
      tmp[i * 3] = q[i * 3] + lambda * (mx - q[i * 3]);
      tmp[i * 3 + 1] = q[i * 3 + 1] + lambda * (my - q[i * 3 + 1]);
      tmp[i * 3 + 2] = q[i * 3 + 2] + lambda * (mz - q[i * 3 + 2]);
    }
    q.set(tmp);
  };
  for (let it = 0; it < 14; it++) { pass(0.55); pass(-0.58); }
  // le lissage ne doit pas faire rentrer le tissu dans le corps
  for (let i = 0; i < n; i++) {
    if (!inSuit[i]) continue;
    const dx = q[i * 3] - pos[i * 3], dy = q[i * 3 + 1] - pos[i * 3 + 1], dz = q[i * 3 + 2] - pos[i * 3 + 2];
    const d = dx * nrm[i * 3] + dy * nrm[i * 3 + 1] + dz * nrm[i * 3 + 2];
    const min = off[i] * 0.55;
    if (d < min) for (let k = 0; k < 3; k++) q[i * 3 + k] += nrm[i * 3 + k] * (min - d);
  }
  // 5) géométrie compacte
  const used = new Int32Array(n).fill(-1);
  const P2 = [], S2 = [], W2 = [], I2 = [];
  for (const i of keep) {
    if (used[i] < 0) {
      used[i] = P2.length / 3;
      P2.push(q[i * 3], q[i * 3 + 1], q[i * 3 + 2]);
      for (let k = 0; k < 4; k++) { S2.push(sIdx[i * 4 + k]); W2.push(sW[i * 4 + k]); }
    }
    I2.push(used[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(S2, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(W2, 4));
  g.setIndex(I2);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const mesh = new THREE.SkinnedMesh(g, garmentMaterial(zones));
  mesh.name = 'garment';
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.frustumCulled = false;
  return mesh;
}

/** Uniforms de tenue partagés par le corps et le vêtement (clonés par personnage). */
export function outfitUniforms(zones) {
  return {
    uTop: { value: new THREE.Color(0x3a4048) }, uBottom: { value: new THREE.Color(0x3a4048) },
    uBoot: { value: new THREE.Color(0x15130f) }, uAccent: { value: new THREE.Color(0xd8e04a) },
    uZones: { value: new THREE.Vector4(zones.neck, zones.wrist, zones.hip, 0) }, // cou, poignet, hanches, gants
    uOpts: { value: new THREE.Vector4(0, 1, 1, 0) },                          // bandes réfléchissantes, ceinture, fermeture
  };
}

const HEAD = /* glsl */`
  varying vec3 vRest; uniform vec3 uTop, uBottom, uBoot, uAccent; uniform vec4 uZones, uOpts;
  float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }`;

export function garmentMaterial(zones) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, envMapIntensity: 0.6 });
  const u = outfitUniforms(zones);
  mat.userData.suit = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.suit);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HEAD)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float boot = 1.0 - smoothstep(0.325, 0.345, vRest.y);
        float legs = 1.0 - smoothstep(uZones.z - 0.11, uZones.z - 0.09, vRest.y);
        vec3 cloth = mix(uTop, uBottom, legs);
        // ceinture visible sous l'ourlet de la veste
        float belt = (1.0 - smoothstep(0.02, 0.028, abs(vRest.y - (uZones.z - 0.075)))) * uOpts.y;
        cloth = mix(cloth, vec3(0.045, 0.04, 0.035), belt);
        // bandes réfléchissantes : poitrine, bras, bas de jambe
        float band = (1.0 - smoothstep(0.022, 0.03, abs(vRest.y - 0.48)))
                   + (1.0 - smoothstep(0.02, 0.028, abs(vRest.y - (uZones.x - 0.34)))) * step(abs(vRest.x), 0.26)
                   + (1.0 - smoothstep(0.02, 0.028, abs(abs(vRest.x) - 0.42))) * step(uZones.x - 0.5, vRest.y);
        cloth = mix(cloth, uAccent, clamp(band, 0.0, 1.0) * uOpts.x);
        // fermeture éclair et coutures latérales
        float zip = (1.0 - smoothstep(0.006, 0.012, abs(vRest.x))) * step(0.0, vRest.z) * step(uZones.z - 0.1, vRest.y) * uOpts.z;
        float seam = 1.0 - smoothstep(0.004, 0.009, abs(abs(vRest.z) - 0.0) ) * step(0.1, abs(vRest.x)) * 0.0;
        cloth = mix(cloth, cloth * 0.4 + 0.04, zip);
        // poches de cuisse
        vec2 pk = vec2(abs(vRest.x) - 0.13, vRest.y - 0.62);
        float pocket = step(abs(pk.x), 0.055) * step(abs(pk.y), 0.07) * step(0.0, -vRest.z + 0.02) * legs;
        float pocketEdge = pocket * (1.0 - step(abs(pk.x), 0.047) * step(abs(pk.y), 0.062));
        cloth *= 1.0 - pocketEdge * 0.35;
        // gants et bottes
        float glove = step(uZones.y - 0.07, abs(vRest.x)) * uZones.w;
        cloth = mix(cloth, uBoot * 1.3, max(boot, glove));
        // tissu : chiné, plis doux, usure aux genoux / coudes
        float weave = vn(vRest * 220.0);
        float folds = vn(vec3(vRest.x * 9.0, vRest.y * 26.0, vRest.z * 9.0));
        float shade = 0.86 + 0.08 * weave + 0.12 * folds;
        float knee = 1.0 - smoothstep(0.0, 0.07, abs(vRest.y - 0.5));
        shade *= 1.0 - knee * 0.06 * (1.0 - boot);
        diffuseColor.rgb = cloth * shade;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.86, 0.38, max(boot, glove));
        roughnessFactor = mix(roughnessFactor, 0.3, clamp(band, 0.0, 1.0) * uOpts.x);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uAccent * clamp(band, 0.0, 1.0) * uOpts.x * 0.05;`);
  };
  mat.customProgramCacheKey = () => 'garment';
  return mat;
}

/** Corps : peau visible seulement hors des zones couvertes par le vêtement. */
export function skinMaterial(mat, zones) {
  const u = outfitUniforms(zones);
  mat.userData.suit = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.suit);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HEAD)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vRest.y < uZones.x - 0.06 && abs(vRest.x) < uZones.y - 0.07) discard;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float gloveS = step(uZones.y - 0.07, abs(vRest.x)) * uZones.w;
        diffuseColor.rgb = mix(diffuseColor.rgb, uBoot * 1.3 * (0.8 + 0.4 * diffuseColor.r), gloveS);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.45, gloveS);`);
  };
  mat.customProgramCacheKey = () => 'skin';
}
