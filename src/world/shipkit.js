import * as THREE from 'three';

// Outils de modélisation procédurale « hard surface » pour les vaisseaux.

/** Point d'une superellipse (n = 2 : ellipse ; n grand : rectangle arrondi). */
function superellipse(t, a, b, n, flatBottom = 0) {
  const c = Math.cos(t), s = Math.sin(t);
  const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * a;
  let y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * b;
  if (s < 0) y *= 1 - flatBottom;
  return [x, y];
}

/**
 * Coque lissée : sections superelliptiques interpolées (Catmull-Rom) le long de Z.
 * stations : [{ z, w, h, y, n, fb }] (w,h = demi-dimensions ; y = centre ; fb = aplatissement du ventre)
 * opts : { radial, steps, texSize, capStart, capEnd, arc:[t0,t1] }
 */
export function loft(stations, opts = {}) {
  const radial = opts.radial ?? 40;
  const steps = opts.steps ?? 8;
  const tex = opts.texSize ?? 3;
  const t0 = opts.arc ? opts.arc[0] : 0, t1 = opts.arc ? opts.arc[1] : Math.PI * 2;
  const closed = !opts.arc;
  // interpolation des paramètres
  const keys = ['z', 'w', 'h', 'y', 'n', 'fb', 'x'];
  const S = stations.map((s) => ({ n: 2.5, fb: 0, x: 0, ...s }));
  const rings = [];
  const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[Math.max(0, i - 1)], b = S[i], c = S[i + 1], d = S[Math.min(S.length - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, r = {};
      for (const key of keys) r[key] = key === 'z' ? b.z + (c.z - b.z) * t : cr(a[key], b[key], c[key], d[key], t);
      r.w = Math.max(r.w, 0.001); r.h = Math.max(r.h, 0.001);
      rings.push(r);
    }
  }
  rings.push({ ...S[S.length - 1] });
  const cols = closed ? radial : radial + 1;
  const pos = [], uv = [], idx = [];
  let vacc = 0;
  for (let j = 0; j < rings.length; j++) {
    const r = rings[j];
    if (j > 0) vacc += Math.abs(r.z - rings[j - 1].z);
    let uacc = 0, prev = null;
    for (let i = 0; i < cols; i++) {
      const t = t0 + (t1 - t0) * (i / radial);
      const [x, y] = superellipse(t, r.w, r.h, r.n, r.fb);
      const p = [r.x + x, r.y + y, r.z];
      if (prev) uacc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
      pos.push(...p);
      uv.push(uacc / tex, vacc / tex);
    }
  }
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < radial; i++) {
      const i1 = closed ? (i + 1) % radial : i + 1;
      const a = j * cols + i, b = j * cols + i1, c = (j + 1) * cols + i, d = (j + 1) * cols + i1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // le sens des normales dépend de l'orientation z ; on force vers l'extérieur
  if (opts.flip) flipFaces(g);
  return g;
}

export function flipFaces(g) {
  if (!g.index) {
    for (const name of Object.keys(g.attributes)) {
      const a = g.attributes[name], n = a.itemSize, arr = a.array;
      for (let i = 0; i < a.count; i += 3) for (let k = 0; k < n; k++) {
        const t = arr[(i + 1) * n + k]; arr[(i + 1) * n + k] = arr[(i + 2) * n + k]; arr[(i + 2) * n + k] = t;
      }
      a.needsUpdate = true;
    }
    g.computeVertexNormals();
    return g;
  }
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.index.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Aile / dérive : profil plan extrudé avec biseau. pts en (x,z) ; épaisseur t. */
export function wing(pts, thickness, opts = {}) {
  const shape = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? shape.lineTo(x, z) : shape.moveTo(x, z)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.45, bevelSize: thickness * 0.4, bevelSegments: 2, steps: 1,
  });
  g.translate(0, 0, -thickness / 2);
  g.rotateX(Math.PI / 2); // forme dans le plan XZ
  // UV planaires (vue de dessus)
  const p = g.attributes.position, uv = g.attributes.uv, ts = opts.texSize ?? 3;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / ts, p.getZ(i) / ts);
  g.computeVertexNormals();
  return g;
}

/** Tuyère : cylindre extérieur, lèvre et cône intérieur. */
export function nozzle(r, len) {
  const pts = [];
  pts.push(new THREE.Vector2(r * 0.55, -len * 0.25));
  pts.push(new THREE.Vector2(r * 0.95, 0));
  pts.push(new THREE.Vector2(r, len * 0.6));
  pts.push(new THREE.Vector2(r * 1.06, len));
  pts.push(new THREE.Vector2(r * 0.92, len * 1.02));
  pts.push(new THREE.Vector2(r * 0.8, len * 0.5));
  pts.push(new THREE.Vector2(r * 0.4, len * 0.15));
  const g = new THREE.LatheGeometry(pts, 24);
  g.rotateX(Math.PI / 2);
  return g;
}
