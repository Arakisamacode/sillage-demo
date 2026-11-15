import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { metricBox } from './materials.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

/**
 * Regroupe la géométrie statique par matériau puis la fusionne (peu d'appels de rendu),
 * et collecte la géométrie de collision du joueur et des PNJ.
 */
export class Builder {
  constructor(scene) {
    this.scene = scene;
    this.groups = new Map(); // material -> { geos: [], cast, receive }
    this.colliders = [];     // BufferGeometry en coordonnées monde
    this.obstacles = [];     // boîtes 2D pour l'évitement des PNJ {x,z,hw,hd,rot}
    this.dynamic = [];
  }

  static matrix(pos, rot, scale = null) {
    rot = rot || [0, 0, 0];
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _p.set(pos[0], pos[1], pos[2]);
    if (scale) _s.set(scale[0], scale[1], scale[2]); else _s.set(1, 1, 1);
    return new THREE.Matrix4().compose(_p.clone(), _q.clone(), _s.clone());
  }

  /** Ajoute une géométrie (sera fusionnée). opts: {cast, receive, collide, parent:Matrix4} */
  add(geo, mat, matrix, opts = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const M = opts.parent ? new THREE.Matrix4().multiplyMatrices(opts.parent, matrix) : matrix;
    g.applyMatrix4(M);
    g.morphAttributes = {};
    const cast = opts.cast ?? true, receive = opts.receive ?? true;
    g.computeBoundingSphere();
    const c = g.boundingSphere.center;
    const cell = g.boundingSphere.radius > 30 ? 'big' : Math.floor(c.x / 24) + '_' + Math.floor(c.z / 24);
    const key = mat.uuid + (cast ? 'c' : '') + (receive ? 'r' : '') + cell;
    let grp = this.groups.get(key);
    if (!grp) { grp = { mat, geos: [], cast, receive }; this.groups.set(key, grp); }
    grp.geos.push(g);
    if (opts.collide) this.colliders.push(g);
    return g;
  }

  /** Boîte à UV métriques. */
  box(w, h, d, mat, pos, rot, opts = {}) {
    const g = metricBox(w, h, d, opts.tex ?? 2);
    this.add(g, mat, Builder.matrix(pos, rot), opts);
    if (opts.obstacle) this.addObstacle(pos[0], pos[2], w / 2, d / 2, rot ? rot[1] : 0);
    return g;
  }

  cyl(rt, rb, h, mat, pos, rot, opts = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, opts.seg ?? 12, 1, opts.open ?? false);
    this.add(g, mat, Builder.matrix(pos, rot), opts);
    return g;
  }

  /** Tube le long d'une polyligne (tuyaux, câbles, gaines). */
  tube(points, radius, mat, opts = {}) {
    const curve = opts.smooth === false
      ? new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0)
      : new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    const g = new THREE.TubeGeometry(curve, opts.segments ?? Math.max(8, points.length * 8), radius, opts.radial ?? 8, false);
    this.add(g, mat, new THREE.Matrix4(), opts);
    return g;
  }

  /** Tuyau droit à coudes francs : polyligne orthogonale avec coudes arrondis. */
  pipe(points, radius, mat, opts = {}) {
    const pts = [];
    const bend = opts.bend ?? radius * 3;
    for (let i = 0; i < points.length; i++) {
      const p = new THREE.Vector3(...points[i]);
      if (i === 0 || i === points.length - 1) { pts.push(p); continue; }
      const a = new THREE.Vector3(...points[i - 1]), b = new THREE.Vector3(...points[i + 1]);
      const da = a.clone().sub(p).normalize().multiplyScalar(bend);
      const db = b.clone().sub(p).normalize().multiplyScalar(bend);
      pts.push(p.clone().add(da), p.clone().add(da.multiplyScalar(0.3)).add(db.clone().multiplyScalar(0.3)), p.clone().add(db));
    }
    const path = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    let len = 0; for (let i = 0; i < pts.length - 1; i++) len += pts[i].distanceTo(pts[i + 1]);
    const g = new THREE.TubeGeometry(path, Math.max(4, Math.ceil(len * 2)) + pts.length * 2, radius, opts.radial ?? 10, false);
    this.add(g, mat, new THREE.Matrix4(), opts);
    // brides aux extrémités / tous les 3 m
    if (opts.flanges !== false && opts.flangeMat) {
      for (let i = 0; i < points.length - 1; i++) {
        const a = new THREE.Vector3(...points[i]), b = new THREE.Vector3(...points[i + 1]);
        const L = a.distanceTo(b), dir = b.clone().sub(a).normalize();
        const n = Math.floor(L / 3);
        for (let k = 1; k <= n; k++) {
          const c = a.clone().addScaledVector(dir, (k * L) / (n + 1));
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          const fg = new THREE.CylinderGeometry(radius * 1.35, radius * 1.35, radius * 0.5, opts.radial ?? 10);
          this.add(fg, opts.flangeMat, new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1)), { cast: false });
        }
      }
    }
    return g;
  }

  /** Câble qui pend entre deux points (chaînette approximée). */
  cable(a, b, sag, radius, mat, opts = {}) {
    const pts = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
    }
    return this.tube(pts, radius, mat, { radial: 5, segments: 24, cast: opts.cast ?? false, ...opts });
  }

  addCollider(geo) { this.colliders.push(geo); }

  /** Boîte de collision invisible. */
  colliderBox(w, h, d, pos, rot) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.applyMatrix4(Builder.matrix(pos, rot));
    this.colliders.push(g);
    return g;
  }

  addObstacle(x, z, hw, hd, rot = 0) { this.obstacles.push({ x, z, hw, hd, rot }); }

  /** Fusionne et ajoute les maillages à la scène. */
  finalize(parent = this.scene) {
    const meshes = [];
    for (const grp of this.groups.values()) {
      if (!grp.geos.length) continue;
      // découpage en lots de taille raisonnable pour le frustum culling
      const merged = mergeGeometries(grp.geos, false);
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, grp.mat);
      mesh.castShadow = grp.cast;
      mesh.receiveShadow = grp.receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }

  collisionGeometry() {
    const geos = this.colliders.map((g) => {
      const c = new THREE.BufferGeometry();
      c.setAttribute('position', g.attributes.position.clone());
      return c;
    });
    return mergeGeometries(geos, false);
  }
}
