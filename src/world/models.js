import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadBinary } from '../core/binary.js';

// Modèles 3D photoscannés (Poly Haven, CC0) : chargés une fois, transformations des nœuds appliquées
// à la géométrie, puis posés dans le décor statique (Builder : fusion par matériau, peu d'appels de rendu).

export const PH_MODELS = [
  'SchoolChair_01', 'round_wooden_table_02', 'metal_stool_03', 'croissant', 'hamburger_buns', 'carrot_cake', 'strawberry_chocolate_cake',
  'lemon', 'food_lime_01', 'food_apple_01', 'food_avocado_01', 'yellow_onion', 'food_ginger_01', 'food_kiwi_01', 'food_pomegranate_01',
  'potted_plant_04', 'potted_plant_02', 'planter_box_01', 'modern_ceiling_lamp_01', 'wooden_cutting_board', 'wooden_bowl_02', 'brass_pot_01',
  'WetFloorSign_01', 'jug_01', 'tea_set_01', 'wine_bottles_01', 'cardboard_box_01', 'plastic_crate_01',
];
/** variantes allégées (qualité basse) */
const LO = ['SchoolChair_01', 'round_wooden_table_02', 'modern_ceiling_lamp_01'];

export class Models {
  constructor(low = false) { this.m = {}; this.low = low; }
  async load(base = import.meta.env.BASE_URL + 'assets/models/ph/', onProgress) {
    const loader = new GLTFLoader();
    let done = 0;
    const list = this.low ? PH_MODELS.filter((id) => !LO.includes(id)).concat(LO.map((id) => id + '_lo')) : PH_MODELS;
    await Promise.all(list.map(async (id) => {
      try {
        const buf = await loadBinary(base + id + '.glb');
        const gltf = await loader.parseAsync(buf, '');
        const parts = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
          const mat = o.material;
          if (mat.map) mat.map.anisotropy = 4;
          mat.envMapIntensity = 0.9;
          parts.push({ geo: g, mat });
        });
        const box = new THREE.Box3();
        for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
        this.m[id.replace('_lo', '')] = { parts, box, size: box.getSize(new THREE.Vector3()) };
      } catch (e) { console.warn('modèle', id, e); }
      onProgress?.(++done / list.length);
    }));
    return this;
  }
  has(id) { return !!this.m[id]; }
  size(id) { return this.m[id]?.size; }
  /**
   * Pose un modèle dans le Builder. opts : { ry, s (échelle uniforme) | fit:[axe, taille], cast, collide, base (Matrix4 repère) }
   * Le modèle est posé par la base (y min) et centré en x/z sur (x, z).
   */
  place(B, id, x, y, z, opts = {}) {
    const M = this.m[id];
    if (!M) return false;
    let s = opts.s ?? 1;
    if (opts.fit) { const [ax, v] = opts.fit; s = v / (ax === 'max' ? Math.max(M.size.x, M.size.y, M.size.z) : M.size[ax]); }
    const c = M.box.getCenter(new THREE.Vector3());
    const off = new THREE.Matrix4().makeTranslation(-c.x, -M.box.min.y, -c.z);
    // lay : objet couché (rotation de 90° autour de z, relevé de sa demi-largeur)
    if (opts.lay) { y += (M.size.x / 2) * s; opts = { ...opts, rz: Math.PI / 2 }; }
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.rx || 0, opts.ry || 0, opts.rz || 0, 'YXZ')), opts.sv ? new THREE.Vector3(s * opts.sv[0], s * opts.sv[1], s * opts.sv[2]) : new THREE.Vector3(s, s, s)).multiply(off);
    if (opts.base) m.premultiply(opts.base);
    for (const p of M.parts) B.add(p.geo, p.mat, m, { cast: opts.cast ?? false, collide: opts.collide ?? false });
    return s;
  }
  /** Copie en maillages indépendants (objets mobiles : plateaux, plats). */
  mesh(id, s = 1) {
    const M = this.m[id];
    const g = new THREE.Group();
    if (!M) return g;
    const c = M.box.getCenter(new THREE.Vector3());
    for (const p of M.parts) { const o = new THREE.Mesh(p.geo, p.mat); o.position.set(-c.x * s, -M.box.min.y * s, -c.z * s); o.scale.setScalar(s); g.add(o); }
    return g;
  }
}
