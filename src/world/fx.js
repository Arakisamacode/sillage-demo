import * as THREE from 'three';
import { KEY_DIR as PLANET_DIR } from './sky.js';
import { HX, Z_BAY, H } from './layout.js';

// Effets atmosphériques : faisceaux visibles dans la poussière (baie + plafonniers),
// particules de poussière en suspension, brouillard de hauteur.

const beamVS = /* glsl */`
varying vec3 vW; varying vec3 vN; varying float vT; varying vec2 vUv;
void main(){ vUv = uv; vT = uv.y; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal);
  gl_Position = projectionMatrix*viewMatrix*w; }`;
const beamFS = /* glsl */`
uniform vec3 uColor; uniform float uTime; uniform float uFade; uniform sampler2D uNoise;
varying vec3 vW; varying vec3 vN; varying float vT; varying vec2 vUv;
void main(){
  vec3 V = normalize(cameraPosition - vW);
  float facing = pow(abs(dot(V, vN)), 1.5);
  float n = texture2D(uNoise, vW.xz*0.035 + vec2(uTime*0.004, uTime*0.002)).r;
  float n2 = texture2D(uNoise, vW.zy*0.06 - vec2(uTime*0.006, 0.0)).g;
  float along = smoothstep(0.0, 0.15, vT) * pow(1.0 - vT, uFade);
  float dist = smoothstep(0.5, 4.0, length(cameraPosition - vW));
  float edge = sin(3.14159*clamp(vUv.x,0.0,1.0));
  float a = facing * along * edge * edge * (0.35 + 0.9*n*n2) * dist;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

export function buildFX(ctx) {
  const { scene, mats, quality } = ctx;
  const out = { update: () => {} };
  const group = new THREE.Group();
  scene.add(group);
  const time = mats.shared.uTime;
  const noise = mats.tex.noise3;

  // faisceaux de la baie : prismes extrudés le long de la direction de la lumière planétaire
  if (quality.beams) {
    const dir = PLANET_DIR.clone().negate(); // sens de propagation
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.11, 0.165, 0.27) }, uTime: time, uFade: { value: 1.6 }, uNoise: { value: noise } },
      vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    // ouvertures : vitrages latéraux et bandeau haut (entre meneaux)
    const openings = [];
    for (const s of [-1, 1]) for (let y = 0.4; y < 17; y += 4.5) openings.push([s * 28.6, y + 2.1, 5.6, 4.0]);
    for (let x = -HX + 4; x < HX - 2; x += 5.6) openings.push([x, 19.2, 5.0, 1.6]);
    for (let x = -HX + 4; x < HX - 2; x += 5.6) openings.push([x, 21.3, 5.0, 1.4]);
    openings.push([0, 8, 42, 15]); // porte spatiale (champ)
    const len = 48;
    for (const [x, y, w, h] of openings) {
      const g = new THREE.BufferGeometry();
      const p0 = new THREE.Vector3(x - w / 2, y - h / 2, Z_BAY), p1 = new THREE.Vector3(x + w / 2, y - h / 2, Z_BAY);
      const p2 = new THREE.Vector3(x + w / 2, y + h / 2, Z_BAY), p3 = new THREE.Vector3(x - w / 2, y + h / 2, Z_BAY);
      const d = dir.clone().multiplyScalar(len);
      const q = [p0, p1, p2, p3].map((p) => p.clone().add(d));
      const verts = [], uvs = [];
      const quad = (a, b, c, e) => { verts.push(...a, ...b, ...c, ...a, ...c, ...e); uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); };
      // côtés du prisme (uv.y = 0 à la baie, 1 au bout)
      const side = (a, b) => {
        const A = a.toArray(), Bb = b.toArray();
        const ia = a.clone().add(d).toArray(), ib = b.clone().add(d).toArray();
        verts.push(...A, ...Bb, ...ib, ...A, ...ib, ...ia); uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      };
      side(p0, p1); side(p1, p2); side(p2, p3); side(p3, p0);
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = 6;
      m.frustumCulled = false;
      group.add(m);
    }
    out.bayBeams = mat;
  }

  // cônes sous les plafonniers (lumière chaude dans la poussière)
  if (quality.beams && ctx.lights) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.07, 0.045, 0.022) }, uTime: time, uFade: { value: 1.2 }, uNoise: { value: noise } },
      vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const cone = new THREE.CylinderGeometry(0.4, 5.5, 16, 20, 1, true);
    cone.translate(0, -8, 0);
    // uv.y : 0 en haut
    const uv = cone.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    for (const s of ctx.lights.spots) {
      const m = new THREE.Mesh(cone, mat);
      m.position.copy(s.position);
      m.renderOrder = 6;
      group.add(m);
    }
  }

  // poussière en suspension
  const N = quality.dust;
  if (N > 0) {
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * (HX - 2);
      pos[i * 3 + 1] = Math.random() * (H - 4);
      pos[i * 3 + 2] = Z_BAY + 2 + Math.random() * 70;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uPR: { value: ctx.renderer.three.getPixelRatio() }, uLight: { value: PLANET_DIR.clone() } },
      vertexShader: `attribute float seed; uniform float uTime; uniform float uPR; varying float vA; varying float vS;
        void main(){ vec3 p = position;
          p.x += sin(uTime*0.07 + seed*40.0)*1.5; p.y += sin(uTime*0.05 + seed*20.0)*1.2 + uTime*0.02*(seed-0.5); p.z += cos(uTime*0.06 + seed*30.0)*1.5;
          p.y = mod(p.y, 20.0);
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
          float d = -mv.z; vA = smoothstep(0.5, 3.0, d) * smoothstep(40.0, 10.0, d); vS = seed;
          gl_PointSize = uPR * (0.8 + seed*1.4) * 9.0 / max(d, 1.0); }`,
      fragmentShader: `varying float vA; varying float vS; void main(){ float r = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,r)*vA;
          vec3 c = mix(vec3(1.0,0.82,0.6), vec3(0.7,0.82,1.0), step(0.5, vS)); gl_FragColor = vec4(c*a*0.35, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = 7;
    group.add(pts);
  }
  out.group = group;
  return out;
}
