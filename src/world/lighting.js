import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { loadBinary } from '../core/binary.js';
import { KEY_DIR } from './sky.js';
import { HX, Z_BAY, Z_BACK, H, PADS } from './layout.js';

// Mise en lumière : lumière froide de la planète par la baie (ombres), éclairage industriel chaud
// des plafonniers (projecteurs), ambiance par HDRI d'entrepôt (Poly Haven) très atténuée.

export function buildLighting(ctx) {
  const { scene, renderer, quality, mats, builder: B, manager } = ctx;
  const out = { spots: [], points: [] };

  // ------------------------------------------------------------- environnement HDRI
  const pmrem = new THREE.PMREMGenerator(renderer.three);
  loadBinary(import.meta.env.BASE_URL + 'assets/hdri/warehouse.exr').then((buf) => {
    const d = new EXRLoader().parse(buf);
    const tex = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type);
    if (d.flipY !== undefined) tex.flipY = d.flipY;
    if (d.colorSpace !== undefined) tex.colorSpace = d.colorSpace;
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const env = pmrem.fromEquirectangular(tex).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.85;
    scene.environmentRotation = new THREE.Euler(0, 1.2, 0);
    tex.dispose();
    out.env = env;
  }).catch((e) => console.warn('HDRI', e));

  // ------------------------------------------------------------- lumière planétaire (froide)
  const sun = new THREE.DirectionalLight(0xc4d6ff, 4.2);
  sun.position.copy(KEY_DIR).multiplyScalar(120).add(new THREE.Vector3(0, 0, -10));
  sun.target.position.set(0, 0, -10);
  sun.castShadow = quality.shadows;
  sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  const sc = sun.shadow.camera;
  sc.left = -60; sc.right = 60; sc.top = 45; sc.bottom = -45; sc.near = 20; sc.far = 260;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  out.sun = sun;

  // ciel bleu de rebond faible, sol chaud
  const hemi = new THREE.HemisphereLight(0xb8c8de, 0x4a4a48, 0.75);
  scene.add(hemi);

  // ------------------------------------------------------------- plafonniers : rampes linéaires émissives
  const lampMat = mats.emissive(0xe8f2ff, 7);
  const housing = mats.paint(0x2c3134);
  const fixtures = [];
  for (const z of [-33, -21, -9, 3, 15, 25]) {
    for (const x of [-22, -11, 0, 11, 22]) {
      const y = H - 3.95;
      B.box(0.7, 0.25, 3.2, housing, [x, y, z], null, { cast: false });
      B.box(0.5, 0.04, 3.0, lampMat, [x, y - 0.14, z], null, { cast: false });
      B.cable([x, y + 0.12, z - 1.4], [x, H - 3.6, z - 1.4], 0.0, 0.01, mats.smooth(0x111111, 0.6, 0.6));
      fixtures.push([x, y - 0.2, z]);
    }
  }
  out.fixtures = fixtures;

  // projecteurs réels (nombre limité, chauds 3000 K)
  const spotDefs = [
    [PADS.p2.x, PADS.p2.z, 1], [PADS.p3.x, PADS.p3.z, 1], [PADS.p4.x, PADS.p4.z, 1], [PADS.p5.x, PADS.p5.z, 1],
    [0, -2, 0], [-22, 22, 0], [24, 22, 0], [0, 22, 0],
  ];
  const nSpots = quality.name === 'low' ? 5 : 8;
  let shadowsLeft = quality.spotShadows;
  for (let i = 0; i < nSpots; i++) {
    const [x, z, big] = spotDefs[i];
    const s = new THREE.SpotLight(0xf0f4ff, big ? 5200 : 3200, 60, big ? 0.8 : 0.7, 0.7, 2);
    s.position.set(x, H - 4.2, z);
    s.target.position.set(x, 0, z);
    if (big && shadowsLeft > 0) {
      s.castShadow = true; shadowsLeft--;
      s.shadow.mapSize.set(1024, 1024);
      s.shadow.bias = -0.0002; s.shadow.normalBias = 0.03; s.shadow.radius = 4;
      s.shadow.camera.near = 4; s.shadow.camera.far = 30;
    }
    scene.add(s, s.target);
    out.spots.push(s);
  }

  // éclairage d'appoint chaud près des murs (zones de travail)
  const pointDefs = [[-HX + 3, 3.2, -2, 0xffa860, 60], [HX - 3, 3.0, 20, 0xffa860, 80], [HX - 3, 3, -20, 0xffb070, 50], [-HX + 3, 3, 20, 0xffb070, 50]];
  for (const [x, y, z, c, i] of pointDefs.slice(0, quality.name === 'low' ? 2 : 4)) {
    const p = new THREE.PointLight(c, i, 18, 2);
    p.position.set(x, y, z);
    scene.add(p);
    out.points.push(p);
  }
  return out;
}
