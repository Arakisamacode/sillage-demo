import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { FONT, canvas as mkCanvas, erode, seed as seedRand } from './signage.js';

// =====================================================================================================
// HULLKIT 2 — coques lisses « used future » pour les vaisseaux (remplace la mosaïque de plaques de
// hullkit.js/platedHull pour les nouvelles coques ; platedHull reste disponible pour ses appelants).
//
// Conventions (toutes les fonctions) :
//  - repère local du vaisseau : X = tribord (droite), Y = haut, Z = arrière (le nez est vers -Z) ;
//  - unités en mètres ; les UV produites sont en mètres / texSize (texSize = 1 par défaut), donc les
//    matériaux doivent être créés avec `mats.paint(c, { kind: 'hull', uv: 1 })` (cf. kitMaterials) ;
//  - les fonctions renvoient des BufferGeometry (ou des listes de « pièces » {geo, role}) à poser avec
//    Builder.add / ShipCtx.add : tout est fusionné par matériau → peu d'appels de rendu, tableaux libérés.
//
// API principale :
//  skinHull(stations, opts)  → coque lissée (sections superellipse / trapèze chanfreiné-arrondi)
//      hull.geometry, hull.cap0, hull.cap1, hull.at(z), hull.point(z, angle, ds), hull.patch(...),
//      hull.band(...), hull.strip(...)  (décalcomanies conformes, verrières, nervures, cadres)
//  nozzle(opts)              → tuyère en cloche (LatheGeometry) : pièces outer/inner/lip/glow/mech/chrome
//  nozzleMaterials(mats, o)  → matériaux de tuyère, avec setThrust(k) pilotable à l'exécution
//  LiveryAtlas               → une texture canvas par vaisseau (bandes, immatriculation, chevrons)
//  kitMaterials(mats, o)     → palette réaliste (coque peinte blanc cassé, composite sombre, métal nu…)
//  détails : bevelBox, rcsBlock, antenna, radiator, lightPod, dockingClamp, landingStrut, ventPanel
//  addParts(add, parts, matSet, pos, rot) → pose une liste de pièces avec un jeu de matériaux
// =====================================================================================================

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ----------------------------------------------------------------------------------------- sections

const DENSE = 192; // points du contour dense avant ré-échantillonnage

/**
 * Paramètres d'une station (tous en mètres, demi-dimensions) :
 *  z      : position le long du vaisseau
 *  w, h   : demi-largeur (bas) et demi-hauteur (haut) ; hb : demi-hauteur sous le centre (défaut h)
 *  tw     : demi-largeur au sommet (défaut w) → sections trapézoïdales (flancs inclinés)
 *  x, y   : centre de la section
 *  mode superellipse : n (2 = ellipse, 3-4 = carré arrondi, 6+ = presque rectangle)
 *  mode polygone     : r (rayon d'arrondi des angles) et/ou c (chanfrein des 4 coins, en m) — dès que
 *                      r ou c est défini, la section est un trapèze chanfreiné puis arrondi : arêtes
 *                      « dures » biseautées comme une vraie tôle pliée.
 *  fb     : aplatissement du ventre (0..1, mode superellipse)
 */
function normStation(s) {
  return {
    z: s.z, w: s.w, h: s.h, hb: s.hb ?? s.h, tw: s.tw ?? s.w, x: s.x ?? 0, y: s.y ?? 0,
    n: s.n ?? 2.5, fb: s.fb ?? 0, r: s.r ?? 0, c: s.c ?? 0, poly: s.r !== undefined || s.c !== undefined,
  };
}
const KEYS = ['w', 'h', 'hb', 'tw', 'x', 'y', 'n', 'fb', 'r', 'c'];

/** contour dense fermé (CCW vu depuis +Z, départ au milieu du ventre), relatif au centre */
function denseContour(p) {
  const pts = [];
  if (!p.poly) {
    for (let i = 0; i < DENSE; i++) {
      const t = -Math.PI / 2 + (i / DENSE) * TAU;
      const c = Math.cos(t), s = Math.sin(t);
      const k = Math.max(0, s); // 0 en bas, 1 en haut : interpolation largeur bas→haut
      const hw = p.w + (p.tw - p.w) * k;
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / p.n) * hw;
      let y = Math.sign(s) * Math.pow(Math.abs(s), 2 / p.n) * (s < 0 ? p.hb : p.h);
      if (s < 0) y *= 1 - p.fb;
      pts.push([x, y]);
    }
    return pts;
  }
  // trapèze : coins BD, HD, HG, BG
  const corners = [[p.w, -p.hb], [p.tw, p.h], [-p.tw, p.h], [-p.w, -p.hb]];
  // chanfrein : chaque coin devient deux sommets
  let poly = [];
  const cm = Math.max(0, Math.min(p.c, Math.min(p.w, p.tw, p.h, p.hb) * 0.9));
  for (let i = 0; i < 4; i++) {
    const P = corners[i], A = corners[(i + 3) % 4], B = corners[(i + 1) % 4];
    if (cm > 1e-4) {
      const da = Math.hypot(A[0] - P[0], A[1] - P[1]), db = Math.hypot(B[0] - P[0], B[1] - P[1]);
      poly.push([P[0] + (A[0] - P[0]) * cm / da, P[1] + (A[1] - P[1]) * cm / da]);
      poly.push([P[0] + (B[0] - P[0]) * cm / db, P[1] + (B[1] - P[1]) * cm / db]);
    } else poly.push(P);
  }
  // arrondi de chaque sommet (rayon limité par la longueur des arêtes)
  const out = [];
  const nArc = 10;
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], A = poly[(i + poly.length - 1) % poly.length], B = poly[(i + 1) % poly.length];
    const ax = A[0] - P[0], ay = A[1] - P[1], bx = B[0] - P[0], by = B[1] - P[1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    const ang = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
    const tanHalf = Math.tan(ang / 2);
    let r = p.r;
    let d = tanHalf > 1e-6 ? r / tanHalf : 0;
    const dmax = Math.min(la, lb) * 0.48;
    if (d > dmax) { d = dmax; r = d * tanHalf; }
    if (r < 1e-4 || d < 1e-4) { out.push(P); continue; }
    const p0 = [P[0] + ax / la * d, P[1] + ay / la * d], p1 = [P[0] + bx / lb * d, P[1] + by / lb * d];
    // arc de p0 à p1 (Bézier quadratique de contrôle P : assez proche d'un cercle pour un rendu lissé)
    for (let k = 0; k <= nArc; k++) {
      const t = k / nArc, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * P[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * P[1] + t * t * p1[1]]);
    }
  }
  // rotation du départ : milieu du ventre (x≈0, y<0), sens CCW
  let best = 0, bd = Infinity;
  for (let i = 0; i < out.length; i++) {
    const q = out[i];
    if (q[1] < 0 && Math.abs(q[0]) < bd && q[0] >= -1e-6) { bd = Math.abs(q[0]); best = i; }
  }
  const rot = out.slice(best).concat(out.slice(0, best));
  // départ exactement au milieu du ventre (le bas est horizontal en mode polygone)
  if (Math.abs(rot[0][0]) > 1e-4) rot.unshift([0, rot[0][1]]);
  // densification des longues arêtes droites (interpolation régulière)
  const dense = [];
  for (let i = 0; i < rot.length; i++) {
    const a = rot[i], b = rot[(i + 1) % rot.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / 0.15));
    for (let k = 0; k < n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return dense;
}

/** contour dense + abscisses curvilignes + paramètre pondéré (longueur / courbure) */
function contourInfo(p, bias) {
  const pts = denseContour(p);
  const n = pts.length;
  const L = new Float64Array(n + 1), A = new Float64Array(n + 1);
  let prevAng = null;
  for (let i = 0; i <= n; i++) {
    const a = pts[i % n], b = pts[(i + 1) % n];
    if (i > 0) {
      const q = pts[i - 1];
      L[i] = L[i - 1] + Math.hypot(a[0] - q[0], a[1] - q[1]);
    }
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (i > 0) {
      let d = ang - prevAng;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      A[i] = A[i - 1] + Math.abs(d);
    }
    prevAng = ang;
  }
  const Lt = L[n], At = A[n] || 1;
  const P = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) P[i] = (1 - bias) * L[i] / Lt + bias * A[i] / At;
  return { pts, L, P, Lt, cx: p.x, cy: p.y };
}

function lerpIdx(arr, v) {
  // arr croissant ; renvoie (i, f) tel que arr[i] + f*(arr[i+1]-arr[i]) = v
  let lo = 0, hi = arr.length - 1;
  if (v <= arr[0]) return [0, 0];
  if (v >= arr[hi]) return [hi - 1, 1];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; }
  const d = arr[hi] - arr[lo];
  return [lo, d > 1e-12 ? (v - arr[lo]) / d : 0];
}
function ptAt(info, arr, v) {
  const [i, f] = lerpIdx(arr, v), n = info.pts.length;
  const a = info.pts[i % n], b = info.pts[(i + 1) % n];
  return [info.cx + a[0] + (b[0] - a[0]) * f, info.cy + a[1] + (b[1] - a[1]) * f, info.L[i] + (info.L[i + 1] - info.L[i]) * f];
}
/** point et normale 2D à l'abscisse curviligne s (m, modulo le périmètre) */
function atArc(info, s) {
  s = ((s % info.Lt) + info.Lt) % info.Lt;
  const [x, y] = ptAt(info, info.L, s);
  const e = 0.02;
  const [x1, y1] = ptAt(info, info.L, Math.min(info.Lt, s + e)), [x0, y0] = ptAt(info, info.L, Math.max(0, s - e));
  const tx = x1 - x0, ty = y1 - y0, tl = Math.hypot(tx, ty) || 1;
  return { x, y, tx: tx / tl, ty: ty / tl, nx: ty / tl, ny: -tx / tl };
}
/** abscisse curviligne du point du contour vu sous l'angle polaire `ang` depuis le centre (0 = +X, π/2 = haut) */
function arcOfAngle(info, ang) {
  const n = info.pts.length;
  // angle polaire déroulé depuis -π/2 (départ du contour)
  let target = ang;
  while (target < -Math.PI / 2) target += TAU;
  while (target >= 3 * Math.PI / 2) target -= TAU;
  let prev = -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = info.pts[i], b = info.pts[(i + 1) % n];
    let ta = Math.atan2(a[1], a[0]), tb = Math.atan2(b[1], b[0]);
    while (ta < prev - 1e-6) ta += TAU;
    while (tb < ta - 1e-6) tb += TAU;
    if (i === n - 1) tb = 3 * Math.PI / 2;
    if (target >= ta && target <= tb) {
      const f = tb - ta > 1e-9 ? (target - ta) / (tb - ta) : 0;
      return info.L[i] + (info.L[i + 1] - info.L[i]) * f;
    }
    prev = ta;
  }
  return 0;
}

const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

/**
 * Coque lissée.
 * stations : voir normStation (au moins 2, z croissant).
 * opts :
 *  radial (40)      : segments autour de la section (32-48 conseillé)
 *  steps (6)        : anneaux intermédiaires entre deux stations (ou station.steps)
 *  smooth (true)    : interpolation Catmull-Rom des paramètres (false : linéaire, tronçons droits)
 *  bias (0.45)      : répartition des sommets : 0 = longueur pure, 1 = courbure pure (angles plus fins)
 *  crease (0)       : angle (rad) au-delà duquel les normales sont cassées (arêtes biseautées nettes) ;
 *                     0 = normales entièrement lisses
 *  texSize (1)      : mètres par unité d'UV (u = périmètre depuis le milieu du ventre, v = longueur)
 *  arc [a0, a1]     : ne génère qu'une portion de la section (angles polaires, CCW, ex. [-0.3, π+0.3] = dessus)
 *  cap0, cap1       : bouchons plats aux extrémités (true, ou { hole: [x0, y0, x1, y1] } en coordonnées locales)
 */
export function skinHull(stations, opts = {}) {
  const S = stations.map(normStation);
  const radial = opts.radial ?? 40, bias = opts.bias ?? 0.45, tex = opts.texSize ?? 1;
  const smooth = opts.smooth ?? true;
  // paramètres interpolés à une position z quelconque
  const at = (z) => {
    let i = 0;
    while (i < S.length - 2 && z > S[i + 1].z) i++;
    const b = S[i], c = S[i + 1];
    const t = Math.max(0, Math.min(1, (z - b.z) / ((c.z - b.z) || 1)));
    const a = S[Math.max(0, i - 1)], d = S[Math.min(S.length - 1, i + 2)];
    const r = { z, poly: b.poly || c.poly };
    for (const k of KEYS) r[k] = smooth ? cr(a[k], b[k], c[k], d[k], t) : b[k] + (c[k] - b[k]) * t;
    // Catmull-Rom peut dépasser : on borne aux valeurs des deux stations encadrantes (pas d'ondulation)
    for (const k of KEYS) { const lo = Math.min(b[k], c[k]), hi = Math.max(b[k], c[k]); r[k] = Math.max(lo, Math.min(hi, r[k])); }
    r.w = Math.max(r.w, 0.002); r.h = Math.max(r.h, 0.002); r.hb = Math.max(r.hb, 0.002); r.tw = Math.max(r.tw, 0.002);
    r.n = Math.max(r.n, 1.2);
    return r;
  };
  const cache = new Map();
  const infoAt = (z) => {
    const key = z.toFixed(4);
    let inf = cache.get(key);
    if (!inf) { inf = contourInfo(at(z), bias); if (cache.size > 4000) cache.clear(); cache.set(key, inf); }
    return inf;
  };
  // anneaux
  const zs = [];
  for (let i = 0; i < S.length - 1; i++) {
    const st = stations[i].steps ?? opts.steps ?? 6;
    for (let k = 0; k < st; k++) zs.push(S[i].z + (S[i + 1].z - S[i].z) * (k / st));
  }
  zs.push(S[S.length - 1].z);
  // ré-échantillonnage : soit tout le contour (paramètre pondéré), soit un arc entre deux angles
  const arcRange = (inf) => {
    if (!opts.arc) return null;
    let s0 = arcOfAngle(inf, opts.arc[0]), s1 = arcOfAngle(inf, opts.arc[1]);
    if (s1 <= s0) s1 += inf.Lt;
    return [s0, s1];
  };
  const ringPts = (z) => {
    const inf = infoAt(z), out = [];
    const ar = arcRange(inf);
    if (!ar) {
      for (let i = 0; i <= radial; i++) {
        const [x, y, s] = ptAt(inf, inf.P, i / radial);
        out.push([x, y, i === radial ? inf.Lt : s]);
      }
    } else {
      // arc : paramètre pondéré (longueur / courbure) restreint à l'intervalle, comme le contour complet
      const [s0, s1] = ar;
      const pOf = (s) => { const k = Math.floor(s / inf.Lt); const [i, f] = lerpIdx(inf.L, s - k * inf.Lt); return k + inf.P[i] + (inf.P[i + 1] - inf.P[i]) * f; };
      const p0 = pOf(s0), p1 = pOf(s1);
      let sPrev = s0;
      for (let i = 0; i <= radial; i++) {
        const pp = p0 + (p1 - p0) * (i / radial), k = Math.floor(pp);
        const [x, y, sl] = ptAt(inf, inf.P, pp - k);
        let s = sl + k * inf.Lt;
        if (i === 0) s = s0; else if (s < sPrev) s += inf.Lt;
        sPrev = s;
        out.push([x, y, s]);
      }
    }
    return out;
  };
  const pos = [], uv = [], idx = [];
  let vacc = 0, prevC = null;
  const ringsP = [];
  for (let j = 0; j < zs.length; j++) {
    const z = zs[j], r = ringPts(z), inf = infoAt(z);
    const c = [inf.cx, inf.cy, z];
    if (prevC) vacc += Math.hypot(c[0] - prevC[0], c[1] - prevC[1], c[2] - prevC[2]);
    prevC = c;
    ringsP.push(r);
    for (const [x, y, s] of r) { pos.push(x, y, z); uv.push(s / tex, vacc / tex); }
  }
  const cols = radial + 1;
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * cols + i, b = j * cols + i + 1, c = (j + 1) * cols + i, d = (j + 1) * cols + i + 1;
      // faces vers l'extérieur : (b - a) × (c - a) = tangente × Z pointe hors de la coque
      idx.push(a, b, c, b, d, c);
    }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // couture du contour fermé (u=0 et u=Lt) : normales moyennées pour éviter une arête visible
  if (!opts.arc) {
    const n = g.attributes.normal;
    for (let j = 0; j < zs.length; j++) {
      const a = j * cols, b = j * cols + radial;
      const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
      n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
    }
  }
  if (opts.crease) g = creased(g, opts.crease);
  const hull = { geometry: g, zs, rings: ringsP, at, info: infoAt, texSize: tex, cap0: null, cap1: null };
  // bouchons
  const cap = (z, spec, front) => {
    const inf = infoAt(z);
    const shape = new THREE.Shape(inf.pts.map(([x, y]) => new THREE.Vector2(inf.cx + x, inf.cy + y)));
    if (spec && spec.hole) {
      const [x0, y0, x1, y1] = spec.hole;
      shape.holes.push(new THREE.Path([new THREE.Vector2(x0, y0), new THREE.Vector2(x0, y1), new THREE.Vector2(x1, y1), new THREE.Vector2(x1, y0)]));
    }
    const cg = new THREE.ShapeGeometry(shape, 1);
    const p = cg.attributes.position, u = cg.attributes.uv;
    for (let i = 0; i < p.count; i++) { u.setXY(i, p.getX(i) / tex, p.getY(i) / tex); p.setZ(i, z); }
    if (front) { // face vers -Z
      const ix = cg.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      const nn = cg.attributes.normal;
      for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 0, -1);
    }
    return cg;
  };
  if (opts.cap0) hull.cap0 = cap(S[0].z, opts.cap0, true);
  if (opts.cap1) hull.cap1 = cap(S[S.length - 1].z, opts.cap1, false);

  // --------------------------------------------------- évaluation de surface (décals, nervures…)
  /** point de surface à z, ancré à l'angle polaire `angle`, décalé de `ds` mètres le long du contour */
  hull.point = (z, angle, ds = 0) => {
    const inf = infoAt(z);
    const s = arcOfAngle(inf, angle) + ds;
    return surf(z, s, inf);
  };
  const surf = (z, s, inf = infoAt(z)) => {
    const p = atArc(inf, s);
    // pente longitudinale : même angle polaire relatif à z ± e
    const e = 0.05;
    const sa = s / inf.Lt;
    const ia = infoAt(z - e), ib = infoAt(z + e);
    const pa = atArc(ia, sa * ia.Lt), pb = atArc(ib, sa * ib.Lt);
    const tz = V3(pb.x - pa.x, pb.y - pa.y, 2 * e).normalize();
    const ts = V3(p.tx, p.ty, 0);
    const n = new THREE.Vector3().crossVectors(ts, tz).normalize();
    if (n.x * p.nx + n.y * p.ny < 0) n.negate();
    return { p: V3(p.x, p.y, z), n, ts, tz, s, Lt: inf.Lt };
  };
  hull.surf = surf;
  /**
   * Pièce conforme à la coque (décalcomanie, verrière, panneau rapporté).
   * o : { z0, z1, angle (centre, rad) , height (m le long du contour) | a0,a1 (angles),
   *       off (décalage le long de la normale, 0.012), segZ, segS, uv:[u0,v0,u1,v1], flipU, flipV,
   *       readable (true : oriente u/v pour que le texte se lise depuis l'extérieur, `up` = [0,1,0]) }
   */
  hull.patch = (o) => {
    const segZ = o.segZ ?? Math.max(2, Math.ceil(Math.abs(o.z1 - o.z0) / 0.5));
    const segS = o.segS ?? Math.max(2, Math.ceil((o.height ?? 2) / 0.35));
    const off = o.off ?? 0.012;
    const P = [], N = [], UV = [];
    const [u0, v0, u1, v1] = o.uv ?? [0, 0, 1, 1];
    const sRange = (z) => {
      const inf = infoAt(z);
      if (o.a0 !== undefined) { const s0 = arcOfAngle(inf, o.a0); let s1 = arcOfAngle(inf, o.a1); if (s1 < s0) s1 += inf.Lt; return [s0, s1]; }
      const sc = arcOfAngle(inf, o.angle ?? 0) + (o.shift ?? 0);
      return [sc - o.height / 2, sc + o.height / 2];
    };
    // orientation lisible
    let fu = !!o.flipU, fv = !!o.flipV;
    if (o.readable) {
      const zc = (o.z0 + o.z1) / 2, [s0, s1] = sRange(zc), c = surf(zc, (s0 + s1) / 2);
      const up = V3(...(o.up ?? [0, 1, 0]));
      const vDir = c.ts.clone(); // v croissant = s croissant
      fv = vDir.dot(up) < 0;
      if (fv) vDir.negate();
      const uDir = V3(0, 0, 1); // u croissant = z croissant
      // droite × haut doit pointer vers l'extérieur
      fu = new THREE.Vector3().crossVectors(uDir, vDir).dot(c.n) < 0;
    }
    for (let j = 0; j <= segZ; j++) {
      const z = o.z0 + (o.z1 - o.z0) * j / segZ;
      const [s0, s1] = sRange(z);
      for (let i = 0; i <= segS; i++) {
        const s = s0 + (s1 - s0) * i / segS, q = surf(z, s);
        P.push(q.p.x + q.n.x * off, q.p.y + q.n.y * off, q.p.z + q.n.z * off);
        N.push(q.n.x, q.n.y, q.n.z);
        const tu = fu ? 1 - j / segZ : j / segZ, tv = fv ? 1 - i / segS : i / segS;
        UV.push(u0 + (u1 - u0) * tu, v0 + (v1 - v0) * tv);
      }
    }
    const idx2 = [], cs = segS + 1;
    for (let j = 0; j < segZ; j++) for (let i = 0; i < segS; i++) {
      const a = j * cs + i, b = a + 1, c = a + cs, d = c + 1;
      idx2.push(a, b, c, b, d, c);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    pg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    pg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    pg.setIndex(idx2);
    if (o.metric) metricPatchUV(pg, segZ, segS, tex);
    return pg;
  };
  /**
   * Relief conforme : dessus décalé de `depth` + 4 flancs (cadre de verrière, nervure, panneau en saillie).
   * Même options que patch + depth (0.06) et base (décalage du pied, 0.0).
   */
  hull.raised = (o) => {
    const depth = o.depth ?? 0.06, base = o.base ?? -0.01;
    const top = hull.patch({ ...o, off: base + depth, metric: true });
    const segZ = o.segZ ?? Math.max(2, Math.ceil(Math.abs(o.z1 - o.z0) / 0.5));
    const segS = o.segS ?? Math.max(2, Math.ceil((o.height ?? 2) / 0.35));
    const bot = hull.patch({ ...o, off: base, segZ, segS });
    const tp = top.attributes.position, bp = bot.attributes.position, cs = segS + 1;
    const walls = [];
    const edge = (ids) => {
      const P = [];
      let len = 0;
      for (let k = 0; k < ids.length - 1; k++) {
        const a = ids[k], b = ids[k + 1];
        const A0 = V3().fromBufferAttribute(bp, a), B0 = V3().fromBufferAttribute(bp, b);
        const A1 = V3().fromBufferAttribute(tp, a), B1 = V3().fromBufferAttribute(tp, b);
        const l = A0.distanceTo(B0);
        P.push([A0, B0, B1, A1, len, len + l]);
        len += l;
      }
      const pos = [], uvs = [];
      for (const [A0, B0, B1, A1, la, lb] of P) {
        pos.push(...A0.toArray(), ...A1.toArray(), ...B0.toArray(), ...B0.toArray(), ...A1.toArray(), ...B1.toArray());
        uvs.push(la / tex, 0, la / tex, depth / tex, lb / tex, 0, lb / tex, 0, la / tex, depth / tex, lb / tex, depth / tex);
      }
      const w = new THREE.BufferGeometry();
      w.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      w.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      return w;
    };
    const rowA = [], rowB = [], colA = [], colB = [];
    for (let i = 0; i <= segS; i++) { rowA.push(i); rowB.push(segZ * cs + i); }
    for (let j = 0; j <= segZ; j++) { colA.push(j * cs); colB.push(j * cs + segS); }
    // sens de parcours : faces vers l'extérieur de la pièce (corrigé ensuite par orientation)
    walls.push(edge(rowA), edge(rowB.slice().reverse()), edge(colA.slice().reverse()), edge(colB));
    const wg = mergeGeometries(walls, false);
    wg.computeVertexNormals();
    fixOutward(wg, top);
    const t2 = top.toNonIndexed();
    return mergeGeometries([t2, wg], false);
  };
  /** nervure / cadre transversal à z (largeur le long de Z = width), entre les angles a0 et a1 */
  hull.band = (o) => hull.raised({ z0: o.z - o.width / 2, z1: o.z + o.width / 2, a0: o.a0 ?? -Math.PI / 2 + 0.001, a1: o.a1 ?? 3 * Math.PI / 2 - 0.001, depth: o.depth ?? 0.06, segZ: 1, segS: o.segS ?? radial, base: o.base });
  /** nervure longitudinale à l'angle polaire `angle`, de z0 à z1, largeur `width` */
  hull.strip = (o) => hull.raised({ z0: o.z0, z1: o.z1, angle: o.angle, height: o.width, shift: o.shift, depth: o.depth ?? 0.05, segS: 1, segZ: o.segZ, base: o.base });
  return hull;
}

/** UV métriques d'une grille de patch (u le long de Z, v le long du contour) */
function metricPatchUV(g, segZ, segS, tex) {
  const p = g.attributes.position, uv = g.attributes.uv, cs = segS + 1;
  const a = V3(), b = V3();
  for (let j = 0; j <= segZ; j++) {
    let s = 0;
    for (let i = 0; i <= segS; i++) {
      const k = j * cs + i;
      if (i > 0) { a.fromBufferAttribute(p, k - 1); b.fromBufferAttribute(p, k); s += a.distanceTo(b); }
      uv.setXY(k, p.getZ(k) / tex, s / tex);
    }
  }
}

/** retourne les faces de `g` qui pointent vers le centre de `ref` (flancs d'un relief) */
function fixOutward(g, ref) {
  ref.computeBoundingBox();
  const c = ref.boundingBox.getCenter(V3());
  // centre « intérieur » : légèrement sous le dessus, le long de la normale moyenne
  const nAvg = V3();
  const rn = ref.attributes.normal;
  for (let i = 0; i < rn.count; i++) nAvg.x += rn.getX(i), nAvg.y += rn.getY(i), nAvg.z += rn.getZ(i);
  nAvg.normalize();
  const p = g.attributes.position, uv = g.attributes.uv;
  const A = V3(), B = V3(), C = V3(), n = V3(), m = V3();
  for (let i = 0; i < p.count; i += 3) {
    A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
    n.crossVectors(B.clone().sub(A), C.clone().sub(A));
    m.copy(A).add(B).add(C).multiplyScalar(1 / 3).sub(c);
    m.addScaledVector(nAvg, -m.dot(nAvg)); // composante dans le plan de la pièce
    if (n.dot(m) < 0) {
      for (const at of [p, uv]) {
        const s = at.itemSize;
        for (let k = 0; k < s; k++) { const t = at.array[(i + 1) * s + k]; at.array[(i + 1) * s + k] = at.array[(i + 2) * s + k]; at.array[(i + 2) * s + k] = t; }
      }
    }
  }
  g.computeVertexNormals();
}

/** normales cassées au-delà d'un angle (garde les UV) */
function creased(g, angle) {
  const r = toCreasedNormals(g, angle);
  return r;
}

// ------------------------------------------------------------------------------------- matériaux

/**
 * Palette réaliste d'un vaisseau (matériaux mis en cache par Materials : appeler plusieurs fois est gratuit).
 * o : { hull (blanc cassé 0xc4c2b8), dark (composite 0x34383b), accent (0xd86a1c), wear (1), uv (1) }
 * Rôles : hull, hullDark, service, accent, bare (métal nu), mech (mécanique sombre), chrome, black,
 *         frame (cadres de verrière), glass, rubber, vent, hazard (jaune), lens
 */
export function kitMaterials(mats, o = {}) {
  const wear = o.wear ?? 1, uv = o.uv ?? 1;
  return {
    hull: mats.paint(o.hull ?? 0xc4c2b8, { kind: 'hull', uv, grime: 0.75 * wear, scratch: 0.7 * wear, rust: 0.04 * wear, floor: 0.5, ns: 0.8 }),
    hullDark: mats.paint(o.dark ?? 0x34383b, { kind: 'wide', uv, grime: 0.8 * wear, scratch: 0.8 * wear, rust: 0.02, floor: 0.6, ns: 0.8 }),
    service: mats.paint(o.service ?? 0x5d6266, { kind: 'service', uv, grime: 0.9 * wear, scratch: 0.8 * wear, rust: 0.08 * wear, floor: 0.6 }),
    accent: mats.paint(o.accent ?? 0xd86a1c, { kind: 'hull', uv, grime: 0.8 * wear, scratch: 0.9 * wear, rust: 0.03, floor: 0.5 }),
    bare: mats.smooth(o.bare ?? 0x8a8c8d, 0.42, 1.0, { grime: 0.7 * wear, scratch: 1.0, rust: 0.05, floor: 0.3 }),
    mech: mats.smooth(0x2e3134, 0.6, 0.85, { grime: 0.8, scratch: 0.6, rust: 0.05, floor: 0.4 }),
    chrome: mats.smooth(0xcfd3d5, 0.16, 1.0, { grime: 0.3, floor: 0.2, rust: 0 }),
    black: mats.smooth(0x111315, 0.7, 0.3, { grime: 0.4, rust: 0, floor: 0.2 }),
    frame: mats.smooth(0x23262a, 0.5, 0.7, { grime: 0.6, rust: 0, floor: 0.2 }),
    glass: canopyGlass(mats),
    rubber: mats.rubber(),
    vent: mats.vent(),
    hazard: mats.paint(0xc9961c, { plain: true, rough: 0.6 }),
    lensWhite: mats.emissive(0xfff4e0, 5),
  };
}

function canopyGlass(mats) {
  const key = 'kit_canopy';
  if (mats.cache[key]) return mats.cache[key];
  // verre fumé épais : quasi opaque (pas de tri de transparence), réflexions de l'environnement
  const m = new THREE.MeshStandardMaterial({ color: 0x2a3640, roughness: 0.14, metalness: 0.9, envMapIntensity: 1.1, emissive: 0x0b1416, emissiveIntensity: 1 });
  return (mats.cache[key] = m);
}

// ----------------------------------------------------------------------------------- tuyères

function gradTex(stops, h = 128) {
  const c = mkCanvas(4, h), g = c.getContext('2d');
  // v = 0 en bas du canvas (flipY), on dessine donc de bas en haut
  const gr = g.createLinearGradient(0, h, 0, 0);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr; g.fillRect(0, 0, 4, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/**
 * Matériaux de tuyère (partagés par toutes les tuyères d'un vaisseau → un appel de rendu par rôle).
 * o : { glow (couleur du col, 0x8fb8ff), idle (0.25 : intensité au repos), key (suffixe de cache) }
 * Renvoie { outer, inner, lip, glow, mech, chrome, setThrust(k) } ; setThrust(0..1) règle la lueur.
 */
export function nozzleMaterials(mats, o = {}) {
  const key = 'kit_nozzle_' + (o.key ?? '') + (o.glow ?? 0x8fb8ff);
  if (mats.cache[key]) return mats.cache[key];
  const glowCol = new THREE.Color(o.glow ?? 0x8fb8ff);
  // extérieur : acier réfractaire, teintes de revenu près du col (paille → bronze → bleu), suie à la lèvre
  const outerMap = gradTex([[0, '#4e4d4b'], [0.12, '#67645e'], [0.22, '#857a62'], [0.32, '#77604e'], [0.42, '#5d5660'], [0.55, '#565c66'], [0.8, '#5d6064'], [1, '#33322f']]);
  const outer = new THREE.MeshStandardMaterial({ color: 0xffffff, map: outerMap, metalness: 1, roughness: 0.38 });
  mats.addWear(outer, { grime: 0.6, scratch: 0.6, floor: 0, rust: 0, paint: 0 });
  // intérieur : sombre, suie ; émissif croissant vers le col (dégradé)
  const innerEm = gradTex([[0, '#000000'], [0.55, '#05070a'], [0.85, '#2a3a55'], [1, '#ffffff']]);
  const inner = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.6, metalness: 0.75, emissive: glowCol.clone(), emissiveMap: innerEm, emissiveIntensity: 0.6 });
  const lip = mats.smooth(0x5d5f61, 0.35, 1.0, { grime: 0.8, scratch: 0.6, rust: 0, floor: 0 });
  const glow = new THREE.MeshBasicMaterial({ color: glowCol.clone().multiplyScalar(2), toneMapped: true });
  const set = {
    outer, inner, lip, glow,
    mech: mats.smooth(0x2e3134, 0.55, 0.85, { grime: 0.8, scratch: 0.6, rust: 0.05, floor: 0 }),
    chrome: mats.smooth(0xcfd3d5, 0.16, 1.0, { grime: 0.3, floor: 0, rust: 0 }),
    thrust: 0,
    /** k : 0 = veille (lueur résiduelle), 1 = pleine poussée */
    setThrust(k) {
      this.thrust = k;
      const idle = o.idle ?? 0.25;
      const e = idle + (1 - idle) * k;
      glow.color.copy(glowCol).multiplyScalar(0.25 + e * 9);
      inner.emissiveIntensity = 0.04 + e * 3.5;
    },
  };
  set.setThrust(0);
  return (mats.cache[key] = set);
}

/**
 * Tuyère en cloche (axe +Z : le col est en z = 0, la sortie en z = len).
 * o : { rt (rayon au col, 0.45), re (rayon de sortie, 1.2), len (1.8), wall (épaisseur à la lèvre, 0.06),
 *       seg (40), bands (2 : anneaux raidisseurs), gimbal (true), actuators (2), mount (longueur du carter
 *       de pompe devant le col, 0.5) }
 * Renvoie une liste de pièces [{ geo, role }] (rôles : outer, inner, lip, glow, mech, chrome) — voir addParts.
 */
export function nozzle(o = {}) {
  const rt = o.rt ?? 0.45, re = o.re ?? 1.2, L = o.len ?? 1.8, wall = o.wall ?? 0.06, seg = o.seg ?? 40;
  const prof = (t) => rt + (re - rt) * (1 - Math.pow(1 - t, 1.9)) * (0.85 + 0.15 * t); // cloche parabolique
  const N = 28;
  const outerPts = [], innerPts = [];
  const bands = o.bands ?? 2;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = t * L;
    let r = prof(t) + wall + (1 - t) * wall * 1.5;
    // anneaux raidisseurs : bosses étroites
    for (let b = 1; b <= bands; b++) {
      const tb = b / (bands + 1) * 0.8 + 0.05;
      const d = Math.abs(t - tb) * N;
      if (d < 0.75) r += wall * 0.9;
    }
    outerPts.push(new THREE.Vector2(r, y));
  }
  for (let i = N; i >= 0; i--) { const t = i / N; innerPts.push(new THREE.Vector2(prof(t), t * L)); }
  const parts = [];
  const rot = (g) => { g.rotateX(Math.PI / 2); return g; }; // axe Y → +Z
  parts.push({ geo: rot(new THREE.LatheGeometry(outerPts, seg)), role: 'outer' });
  parts.push({ geo: rot(new THREE.LatheGeometry(innerPts, seg)), role: 'inner' });
  // lèvre : demi-tore entre extérieur et intérieur à la sortie
  {
    const ro = outerPts[N].x, ri = innerPts[0].x, rm = (ro + ri) / 2, rr = (ro - ri) / 2, lip = [];
    for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; lip.push(new THREE.Vector2(rm + Math.cos(a) * rr, L + Math.sin(a) * rr * 0.9)); }
    parts.push({ geo: rot(new THREE.LatheGeometry(lip, seg)), role: 'lip' });
  }
  // col : disque lumineux (injecteurs) légèrement en retrait + cône central
  {
    const d = new THREE.CircleGeometry(rt * 1.01, seg); // face +Z après rotation
    d.translate(0, 0, 0.02);
    parts.push({ geo: d, role: 'glow' });
    const cone = new THREE.ConeGeometry(rt * 0.35, rt * 0.5, 16, 1, true);
    cone.rotateX(Math.PI / 2); cone.translate(0, 0, rt * 0.27);
    parts.push({ geo: cone, role: 'glow' });
  }
  // carter de pompe et cardan
  const mount = o.mount ?? 0.5;
  if (mount > 0) {
    const pts = [new THREE.Vector2(0.001, -mount), new THREE.Vector2(rt * 1.25, -mount), new THREE.Vector2(rt * 1.32, -mount * 0.6),
      new THREE.Vector2(rt * 1.25, -mount * 0.2), new THREE.Vector2(rt * 1.1, 0.02)];
    parts.push({ geo: rot(new THREE.LatheGeometry(pts, 24)), role: 'mech' });
  }
  if (o.gimbal !== false) {
    const ring = new THREE.TorusGeometry(rt * 1.42, rt * 0.09, 8, 32);
    ring.translate(0, 0, -mount * 0.35);
    parts.push({ geo: ring, role: 'mech' });
    // vérins d'orientation : du cadre (en avant) vers le premier anneau de la cloche
    const na = o.actuators ?? 2;
    for (let k = 0; k < na; k++) {
      // 2 vérins : en haut à 90° l'un de l'autre (tangage + lacet) ; sinon répartis régulièrement
      const ang = na === 2 ? Math.PI * (0.25 + 0.5 * k) : Math.PI / 4 + k * TAU / na;
      const r1 = prof(0.3) + wall * 2.5, r0 = rt * 1.7;
      const A = V3(Math.cos(ang) * r0, Math.sin(ang) * r0, -mount * 1.1), B = V3(Math.cos(ang) * r1, Math.sin(ang) * r1, L * 0.3);
      parts.push({ geo: rodBetween(A, A.clone().lerp(B, 0.55), rt * 0.09, 10), role: 'mech' });
      parts.push({ geo: rodBetween(A.clone().lerp(B, 0.5), B, rt * 0.05, 8), role: 'chrome' });
      const cl = new THREE.SphereGeometry(rt * 0.1, 8, 6); cl.translate(B.x, B.y, B.z);
      parts.push({ geo: cl, role: 'mech' });
    }
  }
  return parts;
}

/** cylindre entre deux points */
export function rodBetween(A, B, r, seg = 8, r2 = r) {
  const d = B.clone().sub(A), L = d.length();
  const g = new THREE.CylinderGeometry(r2, r, L, seg, 1, false);
  g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize());
  g.applyQuaternion(q); g.translate(A.x, A.y, A.z);
  return g;
}

/**
 * Pose une liste de pièces. add(geo, mat, pos, rot) : typiquement (g, m, p, r) => S.add(g, m, p, r)
 * matSet : { role: material } ; une pièce sans matériau dans matSet est ignorée.
 * Les pièces d'un même rôle sont fusionnées avant l'ajout (moins de géométries temporaires).
 */
export function addParts(add, parts, matSet, pos = [0, 0, 0], rot = null, opts = {}) {
  const byRole = new Map();
  for (const p of parts) {
    if (!matSet[p.role]) continue;
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    (byRole.get(p.role) || byRole.set(p.role, []).get(p.role)).push(g);
  }
  for (const [role, geos] of byRole) add(geos.length > 1 ? mergeGeometries(geos, false) : geos[0], matSet[role], pos, rot, opts);
}

// ------------------------------------------------------------------------------------ détails

/** boîte aux arêtes chanfreinées (UV métriques projetées) : w, h, d, b = chanfrein */
export function bevelBox(w, h, d, b = 0.04, tex = 1) {
  b = Math.min(b, w * 0.45, h * 0.45, d * 0.45);
  const shape = new THREE.Shape();
  const x = w / 2 - b, y = h / 2 - b;
  shape.moveTo(-x, -h / 2); shape.lineTo(x, -h / 2); shape.lineTo(w / 2, -y); shape.lineTo(w / 2, y); shape.lineTo(x, h / 2);
  shape.lineTo(-x, h / 2); shape.lineTo(-w / 2, y); shape.lineTo(-w / 2, -y); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: 0, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals();
  return projUV(ng, tex);
}

/** UV planaires selon la normale dominante (mètres / tex) */
export function projUV(g, tex = 1) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / tex; uv[i * 2 + 1] = v / tex;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

const tr = (g, x, y, z, rx = 0, ry = 0, rz = 0) => {
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z); return g;
};

/**
 * Bloc RCS (contrôle d'attitude) : boîtier biseauté + tuyères coniques sur les faces listées.
 * o : { size (0.45), dirs (['+x','+y','-y','+z']) } — repère local du bloc (le poser sur la coque).
 * Rôles : 'service' (boîtier), 'mech' (tuyères), 'inner' (fond des tuyères)
 */
export function rcsBlock(o = {}) {
  const s = o.size ?? 0.45, parts = [];
  parts.push({ geo: bevelBox(s, s * 0.8, s, s * 0.12), role: 'service' });
  const dirs = o.dirs ?? ['+x', '+y', '-y', '+z', '-z'];
  const R = { '+x': [0, 0, -Math.PI / 2], '-x': [0, 0, Math.PI / 2], '+y': [0, 0, 0], '-y': [Math.PI, 0, 0], '+z': [Math.PI / 2, 0, 0], '-z': [-Math.PI / 2, 0, 0] };
  const off = { '+x': [s / 2, 0, 0], '-x': [-s / 2, 0, 0], '+y': [0, s * 0.4, 0], '-y': [0, -s * 0.4, 0], '+z': [0, 0, s / 2], '-z': [0, 0, -s / 2] };
  for (const d of dirs) {
    const c = new THREE.CylinderGeometry(s * 0.16, s * 0.09, s * 0.22, 12, 1, true);
    c.translate(0, s * 0.11, 0); tr(c, off[d][0], off[d][1], off[d][2], ...R[d]);
    parts.push({ geo: c, role: 'mech' });
    const f = new THREE.CircleGeometry(s * 0.1, 10); f.rotateX(-Math.PI / 2); f.translate(0, s * 0.18, 0);
    tr(f, off[d][0], off[d][1], off[d][2], ...R[d]);
    parts.push({ geo: f, role: 'inner' });
  }
  return parts;
}

/**
 * Antenne. o.type : 'whip' (fouet), 'blade' (lame), 'dish' (parabole orientée +Y puis inclinée), 'mast' (mât + barres)
 * o : { h (1.2), r (0.35 pour la parabole) } ; base en y = 0. Rôles : 'mech', 'chrome', 'service'
 */
export function antenna(o = {}) {
  const h = o.h ?? 1.2, parts = [];
  const type = o.type ?? 'whip';
  parts.push({ geo: tr(new THREE.CylinderGeometry(0.07, 0.1, 0.12, 10), 0, 0.06, 0), role: 'mech' });
  if (type === 'whip') parts.push({ geo: tr(new THREE.CylinderGeometry(0.008, 0.018, h, 6), 0, h / 2 + 0.1, 0), role: 'chrome' });
  if (type === 'blade') {
    const sh = new THREE.Shape([new THREE.Vector2(-0.25, 0), new THREE.Vector2(0.2, 0), new THREE.Vector2(0.05, h), new THREE.Vector2(-0.05, h)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }); g.translate(0, 0, -0.015); g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    parts.push({ geo: projUV(g, 1), role: 'service' });
  }
  if (type === 'mast') {
    parts.push({ geo: tr(new THREE.CylinderGeometry(0.025, 0.035, h, 8), 0, h / 2, 0), role: 'mech' });
    for (const [y, l] of [[0.6, 0.5], [0.8, 0.35], [0.95, 0.22]]) parts.push({ geo: tr(new THREE.CylinderGeometry(0.01, 0.01, l, 5), 0, h * y, 0, 0, 0, Math.PI / 2), role: 'chrome' });
  }
  if (type === 'dish') {
    const r = o.r ?? 0.35, pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(r * t, r * 0.35 * t * t)); }
    const dish = new THREE.LatheGeometry(pts, 20);
    const back = new THREE.LatheGeometry(pts.slice().reverse().map((p) => new THREE.Vector2(p.x, p.y - 0.01)), 20);
    const feed = new THREE.CylinderGeometry(0.008, 0.008, r * 0.5, 5); feed.translate(0, r * 0.25, 0);
    const g = mergeGeometries([dish.toNonIndexed(), back.toNonIndexed(), feed.toNonIndexed()].map((x) => { x.deleteAttribute('uv'); x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; }), false);
    g.rotateX(o.tilt ?? 0.6); g.translate(0, h * 0.35 + 0.1, 0);
    parts.push({ geo: g, role: 'service' });
    parts.push({ geo: tr(new THREE.CylinderGeometry(0.03, 0.04, h * 0.35, 8), 0, h * 0.175 + 0.1, 0), role: 'mech' });
  }
  return parts;
}

/**
 * Radiateur à ailettes (dissipation thermique) : n ailettes fines sur un socle.
 * o : { len (le long de Z, 3), h (hauteur des ailettes, 0.5), n (10), w (largeur du socle, 1.2), t (0.03) }
 * Rôles : 'service' (socle), 'fin' (ailettes — utiliser un métal clair/peint), 'mech' (tubes)
 */
export function radiator(o = {}) {
  const L = o.len ?? 3, h = o.h ?? 0.5, n = o.n ?? 10, w = o.w ?? 1.2, t = o.t ?? 0.03, parts = [];
  parts.push({ geo: tr(bevelBox(w, 0.12, L, 0.03), 0, 0.06, 0), role: 'service' });
  const fins = [];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.08 + (w - 0.16) * (i / Math.max(1, n - 1));
    fins.push(tr(bevelBox(t, h, L - 0.2, 0.01), x, 0.12 + h / 2, 0));
  }
  parts.push({ geo: mergeGeometries(fins, false), role: 'fin' });
  for (const z of [-L / 2 + 0.2, L / 2 - 0.2]) parts.push({ geo: tr(new THREE.CylinderGeometry(0.05, 0.05, w + 0.1, 8), 0, 0.2, z, 0, 0, Math.PI / 2), role: 'mech' });
  return parts;
}

/** Feu de position : boîtier + lentille. Rôles 'mech' et 'lens' (fournir un matériau émissif). */
export function lightPod(o = {}) {
  const r = o.r ?? 0.08;
  const housing = new THREE.CylinderGeometry(r * 1.3, r * 1.6, r * 1.2, 10); housing.translate(0, r * 0.6, 0);
  const lens = new THREE.SphereGeometry(r, 10, 6, 0, TAU, 0, Math.PI / 2); lens.translate(0, r * 1.2, 0);
  return [{ geo: housing, role: 'mech' }, { geo: lens, role: 'lens' }];
}

/** Grille d'aération / prise d'air en saillie (cadre biseauté + grille). Rôles 'service' et 'vent'. */
export function ventPanel(w = 1, h = 0.5, d = 0.08) {
  const frame = bevelBox(w, d, h, 0.02);
  const grille = new THREE.PlaneGeometry(w - 0.1, h - 0.1); grille.rotateX(-Math.PI / 2); grille.translate(0, d / 2 + 0.003, 0);
  projUV(grille, 0.5);
  return [{ geo: frame, role: 'service' }, { geo: grille, role: 'vent' }];
}

/** Pince d'amarrage (dessus de coque) : socle + deux mâchoires. Rôles 'service', 'mech', 'hazard'. */
export function dockingClamp(o = {}) {
  const s = o.size ?? 1, parts = [];
  parts.push({ geo: tr(bevelBox(1.2 * s, 0.25 * s, 1.2 * s, 0.06 * s), 0, 0.125 * s, 0), role: 'service' });
  for (const sx of [-1, 1]) {
    parts.push({ geo: tr(bevelBox(0.18 * s, 0.55 * s, 0.7 * s, 0.04 * s), sx * 0.42 * s, 0.5 * s, 0, 0, 0, sx * 0.12), role: 'mech' });
    parts.push({ geo: tr(bevelBox(0.3 * s, 0.1 * s, 0.7 * s, 0.03 * s), sx * 0.3 * s, 0.75 * s, 0), role: 'hazard' });
  }
  parts.push({ geo: tr(new THREE.CylinderGeometry(0.22 * s, 0.26 * s, 0.12 * s, 16), 0, 0.31 * s, 0), role: 'mech' });
  return parts;
}

/**
 * Train d'atterrissage lourd : carter, amortisseur chromé, compas, contrefiche, patin articulé.
 * Le pied repose en y = 0 ; le haut du carter en y = h. o : { h (2), r (0.2), pad (1.4 : côté du patin), brace ('+z'|'-z') }
 * Rôles : 'service', 'mech', 'chrome', 'rubber', 'hazard'
 */
export function landingStrut(o = {}) {
  const h = o.h ?? 2, r = o.r ?? 0.2, pad = o.pad ?? 1.4, parts = [];
  const bs = o.brace === '-z' ? -1 : 1;
  // patin : plaque biseautée + semelle caoutchouc + rotule
  parts.push({ geo: tr(bevelBox(pad, 0.16, pad * 1.2, 0.05), 0, 0.12, 0), role: 'service' });
  parts.push({ geo: tr(bevelBox(pad * 1.04, 0.05, pad * 1.24, 0.015), 0, 0.025, 0), role: 'rubber' });
  parts.push({ geo: tr(new THREE.SphereGeometry(r * 0.9, 12, 8), 0, 0.32, 0), role: 'mech' });
  // jambe : tige chromée (bas) + fourreau (haut)
  parts.push({ geo: tr(new THREE.CylinderGeometry(r * 0.62, r * 0.62, h * 0.5, 16), 0, 0.3 + h * 0.25, 0), role: 'chrome' });
  parts.push({ geo: tr(new THREE.CylinderGeometry(r, r * 1.05, h * 0.62, 16), 0, h * 0.65, 0), role: 'mech' });
  parts.push({ geo: tr(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.1, 16), 0, h * 0.36, 0), role: 'mech' });
  parts.push({ geo: tr(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.08, 16), 0, h * 0.7, 0), role: 'hazard' });
  // carter supérieur (dans la coque)
  parts.push({ geo: tr(bevelBox(r * 3.4, h * 0.25, r * 3.4, 0.04), 0, h - h * 0.12, 0), role: 'service' });
  // contrefiche oblique + compas
  const A = V3(0, h * 0.95, bs * h * 0.55), B = V3(0, h * 0.42, 0);
  parts.push({ geo: rodBetween(A, B, r * 0.35, 10), role: 'mech' });
  parts.push({ geo: rodBetween(V3(r * 0.9, 0.42, 0), V3(r * 0.9, h * 0.33, bs * r * 1.6), 0.035, 6), role: 'mech' });
  parts.push({ geo: rodBetween(V3(r * 0.9, h * 0.33, bs * r * 1.6), V3(r * 0.9, h * 0.62, 0), 0.035, 6), role: 'mech' });
  // flexible hydraulique
  const hose = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-r * 1.1, h * 0.9, 0), V3(-r * 1.5, h * 0.55, 0.05), V3(-r * 0.75, h * 0.32, 0)]), 10, 0.025, 5);
  parts.push({ geo: hose, role: 'rubber' });
  return parts;
}

// --------------------------------------------------------------------------------------- livrée

/**
 * Atlas de livrée : une seule texture canvas par vaisseau, découpée en régions (une par décalcomanie
 * conforme). Toutes les décalcomanies d'un vaisseau partagent donc un matériau (un appel de rendu).
 *
 *   const L = new LiveryAtlas({ ppm: 48, accent: '#d86a1c' });
 *   const r = L.region(10, 0.6, (d) => { d.stripe(0, 0.6, d.accent); d.text('MULET H4', 0.2, 0.1, 0.4) });
 *   const geo = hull.patch({ z0, z1, angle, height: 0.6, uv: r.uv, readable: true });
 *   S.add(geo, L.material(), …)   // après avoir déclaré toutes les régions
 *
 * Primitives de dessin (coordonnées en mètres, origine en BAS à gauche de la région) :
 *   d.rect(x, y, w, h, color) · d.stripe(y, h, color) · d.text(str, x, y, size, { color, align, weight, spacing })
 *   d.chevrons(x, y, w, h, { a, b, pitch, dir }) · d.wear(amount) · d.ctx / d.px (accès canvas brut)
 */
export class LiveryAtlas {
  constructor(o = {}) {
    this.W = o.width ?? 1024;
    this.ppm = o.ppm ?? 48;
    this.accent = o.accent ?? '#d86a1c';
    this.wearAmount = o.wear ?? 0.7;
    this.regions = [];
    this.y = 0;
    this.x = 0;
    this.rowH = 0;
    this._mat = null;
    this.seed = o.seed ?? 4242;
  }

  /** réserve une région wm × hm mètres ; draw(d) est appelé lors de la construction de la texture */
  region(wm, hm, draw) {
    let pw = Math.ceil(wm * this.ppm), ph = Math.ceil(hm * this.ppm);
    let scale = 1;
    if (pw > this.W - 4) { scale = (this.W - 4) / pw; pw = this.W - 4; ph = Math.ceil(ph * scale); }
    if (this.x + pw + 2 > this.W) { this.x = 0; this.y += this.rowH + 2; this.rowH = 0; }
    const r = { x: this.x + 1, y: this.y + 1, pw, ph, wm, hm, scale, draw, uv: null };
    this.x += pw + 2; this.rowH = Math.max(this.rowH, ph);
    this.regions.push(r);
    return r;
  }

  build() {
    const H = Math.max(64, THREE.MathUtils.ceilPowerOfTwo(this.y + this.rowH + 2));
    const c = mkCanvas(this.W, H), ctx = c.getContext('2d');
    seedRand(this.seed);
    for (const r of this.regions) {
      // uv : v=0 en bas du canvas (flipY)
      r.uv = [r.x / this.W, 1 - (r.y + r.ph) / H, (r.x + r.pw) / this.W, 1 - r.y / H];
      // sous-canvas pour que l'érosion reste dans la région
      const sc = mkCanvas(r.pw, r.ph), sx = sc.getContext('2d');
      const k = this.ppm * r.scale;
      const Y = (y) => r.ph - y * k; // y depuis le bas
      const d = {
        ctx: sx, px: k, accent: this.accent, w: r.wm, h: r.hm,
        rect: (x, y, w, h, color) => { sx.fillStyle = color; sx.fillRect(x * k, Y(y + h), w * k, h * k); },
        stripe: (y, h, color) => { sx.fillStyle = color; sx.fillRect(0, Y(y + h), r.pw, h * k); },
        text: (str, x, y, size, o = {}) => {
          sx.font = `${o.weight ?? 700} ${Math.round(size * k)}px ${FONT}`;
          sx.fillStyle = o.color ?? '#1d1f21';
          sx.textBaseline = 'bottom';
          sx.textAlign = o.align ?? 'left';
          if (sx.letterSpacing !== undefined) sx.letterSpacing = ((o.spacing ?? 0.04) * size * k) + 'px';
          sx.fillText(str, x * k, Y(y) + size * k * 0.12);
        },
        chevrons: (x, y, w, h, o = {}) => {
          sx.save();
          sx.beginPath(); sx.rect(x * k, Y(y + h), w * k, h * k); sx.clip();
          sx.fillStyle = o.a ?? '#d9a21b'; sx.fillRect(x * k, Y(y + h), w * k, h * k);
          sx.fillStyle = o.b ?? '#151515';
          const p = (o.pitch ?? 0.3) * k, hh = h * k, x0 = x * k, y0 = Y(y + h), dir = o.dir ?? 1;
          for (let xx = x0 - hh - p; xx < x0 + w * k + hh; xx += p * 2) {
            sx.beginPath();
            if (dir > 0) { sx.moveTo(xx, y0 + hh); sx.lineTo(xx + hh, y0); sx.lineTo(xx + hh + p, y0); sx.lineTo(xx + p, y0 + hh); }
            else { sx.moveTo(xx, y0); sx.lineTo(xx + hh, y0 + hh); sx.lineTo(xx + hh + p, y0 + hh); sx.lineTo(xx + p, y0); }
            sx.fill();
          }
          sx.restore();
        },
        wear: (a) => erode(sx, r.pw, r.ph, a),
      };
      r.draw(d);
      if (this.wearAmount > 0) erode(sx, r.pw, r.ph, this.wearAmount * Math.min(1.5, (r.pw * r.ph) / 60000 + 0.2));
      ctx.drawImage(sc, r.x, r.y);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    this.tex = t;
    return t;
  }

  /** matériau unique des décalcomanies (peinture mate, décalage de profondeur) — construit l'atlas */
  material(o = {}) {
    if (this._mat) return this._mat;
    if (!this.tex) this.build();
    this._mat = new THREE.MeshStandardMaterial({
      map: this.tex, transparent: true, depthWrite: false, alphaTest: 0.02, roughness: o.rough ?? 0.7, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    return this._mat;
  }

  /** uv d'une région (disponibles avant build : calculées à la volée) */
  uvOf(r) {
    const H = Math.max(64, THREE.MathUtils.ceilPowerOfTwo(this.y + this.rowH + 2));
    return [r.x / this.W, 1 - (r.y + r.ph) / H, (r.x + r.pw) / this.W, 1 - r.y / H];
  }
}

/**
 * Décalcomanie plane (faces planes : bouchons, cadres, rampes) : rectangle w × h dans le plan XY, face +Z,
 * UV remappées sur une région d'atlas (r.uv de LiveryAtlas.region, ou atlas.uvOf(r)).
 */
export function planeDecal(w, h, uv) {
  const g = new THREE.PlaneGeometry(w, h);
  const a = g.attributes.uv, [u0, v0, u1, v1] = uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, u0 + (u1 - u0) * a.getX(i), v0 + (v1 - v0) * a.getY(i));
  return g;
}
