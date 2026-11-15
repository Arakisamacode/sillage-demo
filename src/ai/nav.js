// Navigation des PNJ : grille d'occupation 0,5 m sur les zones praticables, obstacles dilatés,
// coût élevé au centre du hangar (zone dangereuse → les piétons longent les murs),
// A* + lissage par visibilité. Les chemins sont mis en cache.

import { HX, Z_BAY, Z_BACK, AIRLOCK, GALLERY } from '../world/layout.js';
import { SHOPS } from '../world/gallery.js';

const CELL = 0.5;
const X0 = -104, X1 = 34, Z0 = -46, Z1 = 32;
const W = Math.ceil((X1 - X0) / CELL), D = Math.ceil((Z1 - Z0) / CELL);

export class NavGrid {
  constructor(obstacles) {
    this.walk = new Uint8Array(W * D);      // 1 = praticable
    this.cost = new Float32Array(W * D).fill(1);
    this.cache = new Map();
    const rect = (x0, z0, x1, z1, v = 1) => this._fill(x0, z0, x1, z1, v);
    // zones praticables
    rect(-HX + 1.0, Z_BAY + 2.6, HX - 1.0, Z_BACK - 1.0);
    rect(AIRLOCK.x1 - 1, AIRLOCK.z - 1.5, -HX + 1.2, AIRLOCK.z + 1.5);
    rect(GALLERY.x0 + 0.8, GALLERY.z0 + 1.5, GALLERY.x1 - 0.6, GALLERY.z1 - 0.6);
    for (const s of SHOPS) {
      rect(s.x - 1.2, GALLERY.z1 - 1, s.x + 1.2, GALLERY.z1 + 1);    // porte
      rect(s.x - 3.6, GALLERY.z1 + 0.4, s.x + 3.6, GALLERY.z1 + 5.5); // intérieur
    }
    rect(GALLERY.x0 - 3, -12.6, GALLERY.x0 + 1, -9.4);              // porte du module habitat
    // obstacles (boîtes orientées), dilatés du rayon d'un PNJ
    for (const o of obstacles) this._obstacle(o, 0.35);
    // vitrines (verre) des boutiques
    for (const s of SHOPS) for (const sx of [-1, 1]) rect(s.x + sx * 1.45 - (sx < 0 ? 2.6 : 0), GALLERY.z1 - 0.3, s.x + sx * 1.45 + (sx > 0 ? 2.6 : 0), GALLERY.z1 + 0.4, 0);
    // coût : centre du hangar (zone d'appontage) plus cher que les allées
    for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
      const x = X0 + (i + 0.5) * CELL, z = Z0 + (j + 0.5) * CELL;
      if (x > -HX && x < HX && z > Z_BAY && z < Z_BACK) {
        const edge = Math.min(HX - Math.abs(x), Z_BACK - z);
        this.cost[j * W + i] = edge < 4.5 ? 1 : 4;
      }
    }
  }

  _fill(x0, z0, x1, z1, v) {
    const i0 = Math.max(0, Math.floor((x0 - X0) / CELL)), i1 = Math.min(W - 1, Math.floor((x1 - X0) / CELL));
    const j0 = Math.max(0, Math.floor((z0 - Z0) / CELL)), j1 = Math.min(D - 1, Math.floor((z1 - Z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.walk[j * W + i] = v;
  }

  _obstacle(o, pad) {
    const c = Math.cos(o.rot), s = Math.sin(o.rot);
    const hw = o.hw + pad, hd = o.hd + pad;
    const ext = Math.abs(c) * hw + Math.abs(s) * hd, extz = Math.abs(s) * hw + Math.abs(c) * hd;
    const i0 = Math.max(0, Math.floor((o.x - ext - X0) / CELL)), i1 = Math.min(W - 1, Math.floor((o.x + ext - X0) / CELL));
    const j0 = Math.max(0, Math.floor((o.z - extz - Z0) / CELL)), j1 = Math.min(D - 1, Math.floor((o.z + extz - Z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = X0 + (i + 0.5) * CELL - o.x, z = Z0 + (j + 0.5) * CELL - o.z;
      // rotation inverse (repère de l'obstacle, rotation Y)
      const lx = x * c - z * s, lz = x * s + z * c;
      if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) this.walk[j * W + i] = 0;
    }
  }

  idx(x, z) {
    const i = Math.floor((x - X0) / CELL), j = Math.floor((z - Z0) / CELL);
    if (i < 0 || j < 0 || i >= W || j >= D) return -1;
    return j * W + i;
  }

  walkable(x, z) { const k = this.idx(x, z); return k >= 0 && this.walk[k] === 1; }

  /** Cellule praticable la plus proche. */
  nearest(x, z) {
    let k = this.idx(x, z);
    if (k >= 0 && this.walk[k]) return k;
    const i0 = Math.floor((x - X0) / CELL), j0 = Math.floor((z - Z0) / CELL);
    for (let r = 1; r < 12; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
        const i = i0 + di, j = j0 + dj;
        if (i < 0 || j < 0 || i >= W || j >= D) continue;
        k = j * W + i;
        if (this.walk[k]) return k;
      }
    }
    return -1;
  }

  center(k) { return [X0 + ((k % W) + 0.5) * CELL, Z0 + (Math.floor(k / W) + 0.5) * CELL]; }

  /** Ligne de vue sur la grille (pour le lissage). */
  los(ax, az, bx, bz, maxCost = 1.5) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / (CELL * 0.5));
    for (let s = 1; s < n; s++) {
      const t = s / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const k = this.idx(x, z);
      if (k < 0 || !this.walk[k] || this.cost[k] > maxCost) return false;
    }
    return true;
  }

  findPath(ax, az, bx, bz) {
    const key = `${Math.round(ax * 2)},${Math.round(az * 2)}>${Math.round(bx * 2)},${Math.round(bz * 2)}`;
    const cached = this.cache.get(key);
    if (cached) return cached.map((p) => [...p]);
    const s = this.nearest(ax, az), g = this.nearest(bx, bz);
    if (s < 0 || g < 0) return [[bx, bz]];
    const [gx, gz] = this.center(g);
    const open = new MinHeap();
    const gScore = new Float32Array(W * D).fill(Infinity);
    const came = new Int32Array(W * D).fill(-1);
    const closed = new Uint8Array(W * D);
    gScore[s] = 0;
    open.push(s, 0);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]];
    let found = false, iter = 0;
    while (open.size && iter++ < 60000) {
      const k = open.pop();
      if (k === g) { found = true; break; }
      if (closed[k]) continue;
      closed[k] = 1;
      const i = k % W, j = Math.floor(k / W);
      for (const [di, dj, dc] of dirs) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= D) continue;
        const nk = nj * W + ni;
        if (!this.walk[nk] || closed[nk]) continue;
        if (di && dj && (!this.walk[j * W + ni] || !this.walk[nj * W + i])) continue;
        const ng = gScore[k] + dc * CELL * (this.cost[nk] + this.cost[k]) * 0.5;
        if (ng < gScore[nk]) {
          gScore[nk] = ng; came[nk] = k;
          const [cx, cz] = this.center(nk);
          open.push(nk, ng + Math.hypot(cx - gx, cz - gz));
        }
      }
    }
    if (!found) return [[bx, bz]];
    const cells = [];
    for (let k = g; k !== -1; k = came[k]) cells.push(this.center(k));
    cells.reverse();
    // lissage : on garde un point quand la ligne de vue est rompue (ou change de coût)
    const out = [];
    let a = [ax, az];
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !this.los(a[0], a[1], cells[j][0], cells[j][1], this.cost[this.idx(a[0], a[1])] > 1.5 ? 10 : 1.5)) j--;
      out.push(cells[j]);
      a = cells[j]; i = j;
    }
    if (!out.length) out.push([bx, bz]);
    out[out.length - 1] = [bx, bz];
    this.cache.set(key, out.map((p) => [...p]));
    if (this.cache.size > 800) this.cache.delete(this.cache.keys().next().value);
    return out;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    const K = this.k, P = this.p;
    K.push(k); P.push(p);
    let i = K.length - 1;
    while (i > 0) {
      const pa = (i - 1) >> 1;
      if (P[pa] <= P[i]) break;
      [K[pa], K[i]] = [K[i], K[pa]]; [P[pa], P[i]] = [P[i], P[pa]]; i = pa;
    }
  }
  pop() {
    const K = this.k, P = this.p;
    const top = K[0];
    const lk = K.pop(), lp = P.pop();
    if (K.length) {
      K[0] = lk; P[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < K.length && P[l] < P[m]) m = l;
        if (r < K.length && P[r] < P[m]) m = r;
        if (m === i) break;
        [K[m], K[i]] = [K[i], K[m]]; [P[m], P[i]] = [P[i], P[m]]; i = m;
      }
    }
    return top;
  }
}
