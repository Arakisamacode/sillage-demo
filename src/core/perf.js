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
export function shrinkTextures(scene, { max = 512, maxModel = 256, modelTextures = new Set() } = {}) {
  const done = new WeakSet();
  let saved = 0;
  const KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'specularMap', 'clearcoatNormalMap'];
  const shrink = (tex) => {
    if (!tex || !tex.isTexture || tex.isCanvasTexture || tex.isRenderTargetTexture || tex.isDataTexture || tex.isCompressedTexture) return;
    const src = tex.source; if (!src || done.has(src)) return;
    const img = src.data;
    if (!img || !(img instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap))) return;
    done.add(src);
    const lim = modelTextures.has(src) ? maxModel : max, w = img.width, h = img.height;
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
