import * as THREE from 'three';

// Performances de rendu.
// 1. Réserve de lumières : les lumières ponctuelles et projecteurs du décor (une quarantaine) sont « virtuels »
//    (calque invisible pour la caméra) ; un nombre FIXE de vraies lumières reprend à chaque image les réglages des
//    plus proches. Le nombre de lumières ne varie plus → aucune recompilation de shaders en changeant de zone,
//    et le coût par pixel reste borné.
// 2. Découpage par niveaux : les maillages du rez-de-chaussée, du pont habitat et de La Couronne ne sont dessinés
//    que lorsque le joueur peut les voir (à pied, au niveau concerné ou en transit entre deux niveaux).
// 3. Préchauffage : compilation de tous les shaders pendant l'écran de chargement.

const HIDDEN = 31;

export class LightPool {
  constructor(scene, quality) {
    this.scene = scene;
    const n = quality.name === 'low' ? [4, 3] : quality.name === 'medium' ? [6, 6] : [8, 8];
    this.virt = [];
    scene.traverse((o) => {
      if (!(o.isPointLight || o.isSpotLight) || o.castShadow) return;
      if (o.position.lengthSq() < 1e-6 && o.parent === scene) return;      // lumières dynamiques des systèmes (tirs, réacteurs)
      o.layers.set(HIDDEN); this.virt.push(o);
    });
    // lumières dynamiques des systèmes (tirs, réacteurs, lampes) : toujours comptées ; « éteintes » = intensité nulle
    scene.traverse((o) => {
      if (!(o.isPointLight || o.isSpotLight) || this.virt.includes(o) || o.castShadow) return;
      let on = o.visible, I = o.intensity;
      Object.defineProperty(o, 'visible', { get: () => true, set: (v) => { on = v; }, configurable: true });
      Object.defineProperty(o, 'intensity', { get: () => (on ? I : 0), set: (v) => { I = v; }, configurable: true });
    });
    this.points = []; this.spots = [];
    for (let i = 0; i < n[0]; i++) { const l = new THREE.PointLight(0xffffff, 0, 1, 2); scene.add(l); this.points.push(l); }
    for (let i = 0; i < n[1]; i++) { const l = new THREE.SpotLight(0xffffff, 0, 1, 0.5, 0.5, 2); scene.add(l); scene.add(l.target); this.spots.push(l); }
    this._w = new THREE.Vector3();
  }
  /** lumières ajoutées plus tard (à virtualiser aussi) */
  adopt(l) { if (!l.castShadow) { l.layers.set(HIDDEN); this.virt.push(l); } }
  update(cam) {
    const P = [], S = [], w = this._w;
    for (const l of this.virt) {
      if (!l.visible || l.intensity <= 0) continue;
      let vis = true; for (let p = l.parent; p; p = p.parent) if (!p.visible) { vis = false; break; }
      if (!vis) continue;
      l.getWorldPosition(w);
      const d = w.distanceTo(cam), R = l.distance || 60;
      if (d > R + 25) continue;
      (l.isSpotLight ? S : P).push({ l, s: d - R * 0.5, p: w.clone() });
    }
    P.sort((a, b) => a.s - b.s); S.sort((a, b) => a.s - b.s);
    this.points.forEach((pl, i) => {
      const v = P[i];
      if (!v) { pl.intensity = 0; return; }
      pl.position.copy(v.p); pl.color.copy(v.l.color); pl.intensity = v.l.intensity; pl.distance = v.l.distance; pl.decay = v.l.decay;
    });
    this.spots.forEach((sl, i) => {
      const v = S[i];
      if (!v) { sl.intensity = 0; return; }
      sl.position.copy(v.p); sl.color.copy(v.l.color); sl.intensity = v.l.intensity; sl.distance = v.l.distance; sl.decay = v.l.decay;
      sl.angle = v.l.angle; sl.penumbra = v.l.penumbra;
      v.l.target.getWorldPosition(sl.target.position); sl.target.updateMatrixWorld();
    });
  }
}

/** Classe les maillages statiques par niveau d'après leur boîte englobante. */
export class LevelCull {
  constructor(meshes) {
    this.bands = { ground: [], deck: [], lux: [] };
    for (const m of meshes) {
      const b = m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox);
      if (b.max.y <= 26) this.bands.ground.push(m);
      else if (b.min.y >= 34 && b.max.y <= 52) this.bands.deck.push(m);
      else if (b.min.y >= 60) this.bands.lux.push(m);
    }
    this.state = '';
  }
  /** y : hauteur du joueur ; free : en vol (tout visible) */
  update(y, free) {
    const show = free ? { ground: 1, deck: 1, lux: 1 }
      : y < 26 ? { ground: 1, deck: 0, lux: 0 }
        : y < 34 ? { ground: 1, deck: 1, lux: 0 }
          : y < 54 ? { ground: 0, deck: 1, lux: 0 }
            : y < 62 ? { ground: 0, deck: 1, lux: 1 } : { ground: 0, deck: 0, lux: 1 };
    const key = `${show.ground}${show.deck}${show.lux}`;
    if (key === this.state) return;
    this.state = key;
    for (const [b, list] of Object.entries(this.bands)) for (const m of list) m.visible = !!show[b];
  }
}

/** Compile tous les shaders de la scène (objets cachés compris) avant de jouer. */
export async function warmShaders(renderer, scene, camera, renderFull) {
  const hidden = [];
  // (les lumières gardent leur état : le nombre de lumières fait partie de la clé des shaders)
  scene.traverse((o) => { if (!o.visible && !o.isLight) { hidden.push(o); o.visible = true; } });
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch { /* compilation au fil de l'eau */ }
  // un rendu complet, sans élimination hors champ, pour créer aussi les variantes de programmes propres aux objets
  const culled = [];
  scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite || o.isLine) && o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
  if (renderFull) { try { renderFull(); } catch (e) { console.warn('préchauffage des shaders', e); } }
  else { const rt = new THREE.WebGLRenderTarget(64, 64); try { renderer.setRenderTarget(rt); renderer.render(scene, camera); } catch { /* */ } finally { renderer.setRenderTarget(null); rt.dispose(); } }
  for (const o of culled) o.frustumCulled = true;
  for (const o of hidden) o.visible = false;
}

/**
 * Mémoire graphique (qualité basse, téléphones) : réduit la définition des textures chargées depuis des fichiers
 * (les canevas animés — écrans, enseignes — sont laissés intacts), puis libère la copie côté processeur une fois la
 * texture envoyée à la carte graphique. maxModel s'applique aux textures des petits objets photoscannés.
 */
export function shrinkTextures(scene, { max = 512, maxModel = 256, modelTextures = new Set(), faceTextures = new Set(), maxFace = 512 } = {}) {
  const done = new WeakSet();
  let saved = 0;
  const KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'specularMap', 'clearcoatNormalMap'];
  const shrink = (tex) => {
    if (!tex || !tex.isTexture || tex.isCanvasTexture || tex.isRenderTargetTexture || tex.isDataTexture || tex.isCompressedTexture) return;
    const src = tex.source; if (!src || done.has(src)) return;
    const img = src.data;
    if (!img || !(img instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap))) return;
    done.add(src);
    const lim = faceTextures.has(src) ? maxFace : modelTextures.has(src) ? maxModel : max, w = img.width, h = img.height;
    if (!w || !h) return;
    const k = Math.min(1, lim / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    saved += (w * h - c.width * c.height) * 4;
    if (img.close) img.close();
    src.data = c; tex.needsUpdate = true;
    // après envoi à la carte graphique, la copie processeur n'est plus utile (textures statiques)
    tex.onUpdate = () => { c.width = c.height = 1; tex.onUpdate = null; };
  };
  scene.traverse((o) => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) for (const k of KEYS) shrink(m[k]);
  });
  return Math.round(saved / 1e6);
}

/**
 * Ombres à la demande (qualités moyenne, haute, ultra). Chaque carte d'ombre n'est recalculée que lorsqu'elle peut
 * changer à l'écran :
 * - soleil (4096, décor statique, direction fixe) : toutes les 2 images quand la caméra est dans le hangar (personnages,
 *   chariots et vaisseaux y projettent leur ombre), plus lentement ailleurs (galerie, frégate, étages) ;
 * - projecteurs du hangar : seulement quand la caméra est dans le hangar (ou en approche en vol), gelés sinon. Les
 *   projecteurs gardent castShadow (pas de recompilation de shaders) : seule la mise à jour de leur carte est suspendue ;
 * - recalcul immédiat de tout : premier rendu, téléportation / ascenseur (saut de caméra), changement de niveau
 *   (LevelCull), entrée dans le hangar, changement d'état du vol (décollage, atterrissage) ;
 * - Héron en mouvement dans le hangar : toutes les cartes à chaque image (gros objet rapide).
 * Les mises à jour du soleil et des projecteurs sont décalées d'une image pour lisser le coût.
 */
export class ShadowScheduler {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Light[]} lights lumières à ombre portée (soleil en premier)
   * @param {object} quality préréglage
   */
  constructor(renderer, lights, quality) {
    this.sm = renderer.shadowMap;
    this.sun = lights.find((l) => l.isDirectionalLight && l.castShadow) || null;
    this.spots = lights.filter((l) => l.isSpotLight && l.castShadow);
    const med = quality.name === 'medium';
    // intervalles (en images) : [soleil, projecteurs] selon la zone ; 0 = gelé
    this.rates = {
      hangar: [2, 2], approach: [3, 3], away: [med ? 8 : 6, 0],
    };
    for (const l of [this.sun, ...this.spots]) if (l) l.shadow.autoUpdate = false;
    this.sm.autoUpdate = false;
    this.n = 0; this.key = null; this.last = new THREE.Vector3(1e9, 0, 0);
    this.invalidate();
  }
  /** Recalcule toutes les cartes au prochain rendu. */
  invalidate() { this.force = true; }
  /**
   * À appeler juste avant le rendu.
   * @param {THREE.Vector3} cam position de la caméra
   * @param {{zone: 'hangar'|'approach'|'away', level?: string, flight?: string, fast?: boolean}} s
   */
  update(cam, s) {
    const n = ++this.n;
    const key = `${s.zone}|${s.level || ''}|${s.flight || ''}`;
    if (key !== this.key || cam.distanceToSquared(this.last) > 64) this.force = true;
    this.key = key; this.last.copy(cam);
    const [rs, rp] = this.rates[s.zone] || this.rates.away;
    const all = this.force || s.fast;
    let any = false;
    if (this.sun && (all || (rs && n % rs === 0))) { this.sun.shadow.needsUpdate = true; any = true; }
    // projecteurs décalés d'une image par rapport au soleil
    if (all || (rp && (n + 1) % rp === 0)) for (const l of this.spots) { l.shadow.needsUpdate = true; any = true; }
    this.force = false;
    if (any) this.sm.needsUpdate = true;
  }
}
