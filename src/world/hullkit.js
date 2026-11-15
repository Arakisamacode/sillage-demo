import * as THREE from 'three';

// Coques « hard surface » : section à facettes (superellipse peu subdivisée, normales plates),
// sous-structure sombre recouverte de plaques de blindage indépendantes (chanfreinées, épaisseurs
// variées, jours entre plaques, quelques plaques absentes). Renvoie aussi une géométrie de collision.

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function sectionPoint(t, st) {
  const c = Math.cos(t), s = Math.sin(t), n = st.n ?? 3;
  const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * st.w;
  let y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * st.h;
  if (s < 0) y *= 1 - (st.fb ?? 0);
  return [(st.x ?? 0) + x, st.y + y];
}

/** Interpolation linéaire des stations (les facettes doivent rester planes et nettes). */
function ringsFrom(stations, steps) {
  const rings = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i], b = stations[i + 1];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, e = t * t * (3 - 2 * t) * 0.5 + t * 0.5; // léger adoucissement
      const r = {};
      for (const key of ['w', 'h', 'y', 'n', 'fb', 'x']) r[key] = (a[key] ?? (key === 'n' ? 3 : 0)) + ((b[key] ?? (key === 'n' ? 3 : 0)) - (a[key] ?? (key === 'n' ? 3 : 0))) * e;
      r.z = a.z + (b.z - a.z) * t;
      rings.push(r);
    }
  }
  rings.push({ n: 3, fb: 0, x: 0, ...stations[stations.length - 1] });
  return rings;
}

/**
 * stations : [{ z, w, h, y, n, fb, x }]
 * opts : { facets, steps, arc:[t0,t1], plateEvery:[ringsPerPlate, facetsPerPlate], missing, seed, gap, thick }
 */
export function platedHull(stations, opts = {}) {
  const F = opts.facets ?? 14, steps = opts.steps ?? 3;
  const t0 = opts.arc ? opts.arc[0] : -Math.PI / 2 + Math.PI / F, t1 = opts.arc ? opts.arc[1] : t0 + Math.PI * 2;
  const closed = !opts.arc;
  const rings = ringsFrom(stations, steps);
  const cols = closed ? F : F + 1;
  const P = rings.map((r) => Array.from({ length: cols }, (_, i) => {
    const [x, y] = sectionPoint(t0 + (t1 - t0) * (i / F), r);
    return new THREE.Vector3(x, y, r.z);
  }));
  // ---------------- sous-structure (facettes planes)
  const uPos = [], uUv = [];
  const quad = (arr, uv, a, b, c, d, s = 2) => {
    arr.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
    const w = a.distanceTo(b) / s, h = a.distanceTo(d) / s;
    uv.push(0, 0, w, 0, w, h, 0, 0, w, h, 0, h);
  };
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < F; i++) {
    const i1 = closed ? (i + 1) % F : i + 1;
    quad(uPos, uUv, P[j][i], P[j][i1], P[j + 1][i1], P[j + 1][i]);
  }
  const under = new THREE.BufferGeometry();
  under.setAttribute('position', new THREE.Float32BufferAttribute(uPos, 3));
  under.setAttribute('uv', new THREE.Float32BufferAttribute(uUv, 2));
  under.computeVertexNormals();
  // ---------------- plaques de blindage
  const R = rng(opts.seed ?? 7);
  const [pr, pf] = opts.plateEvery ?? [2, 1];
  const gap = opts.gap ?? 0.035, thick = opts.thick ?? 0.05;
  const pPos = [], pUv = [], dPos = [], dUv = [];
  const n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let j = 0, step = pr; j < rings.length - 1; j += step) {
    step = pr + Math.floor(R() * (opts.vary ?? 2));
    for (let i = 0; i < F; i += pf) {
      const j2 = Math.min(j + step, rings.length - 1);
      const i2 = closed ? (i + pf) % F : Math.min(i + pf, F);
      const A = P[j][i], B = P[j][i2], C = P[j2][i2], D = P[j2][i];
      if (A.distanceTo(B) < 0.12 || A.distanceTo(D) < 0.12) continue;
      if (R() < (opts.missing ?? 0.05)) continue; // plaque déposée : on voit la structure
      e1.subVectors(B, A); e2.subVectors(D, A); n.crossVectors(e1, e2).normalize();
      const off = thick * (0.6 + R() * 0.9);
      const ctr = new THREE.Vector3().add(A).add(B).add(C).add(D).multiplyScalar(0.25);
      const inset = (p, k) => p.clone().lerp(ctr, k / Math.max(0.2, p.distanceTo(ctr)));
      const b0 = [A, B, C, D].map((p) => inset(p, gap).addScaledVector(n, 0.004));
      const b1 = [A, B, C, D].map((p) => inset(p, gap + off * 0.8).addScaledVector(n, off));
      const isAlt = (opts.altBelow !== undefined && ctr.y < opts.altBelow) || R() < (opts.altRandom ?? 0.08);
      const tgt = isAlt ? dPos : pPos, tuv = isAlt ? dUv : pUv;
      quad(tgt, tuv, b1[0], b1[1], b1[2], b1[3], 2.5);
      for (let k = 0; k < 4; k++) quad(tgt, tuv, b0[k], b0[(k + 1) % 4], b1[(k + 1) % 4], b1[k], 0.5);
    }
  }
  const mk = (pos, uv) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  };
  return { under, plates: mk(pPos, pUv), alt: mk(dPos, dUv), rings, points: P };
}
