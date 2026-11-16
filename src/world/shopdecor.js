import * as THREE from 'three';
import { weaponMesh } from '../game/ground.js';
import { shipGunMesh, turretMesh, miningMesh } from '../game/shipgear.js';
import { neonTexture, neonMaterial } from './signage.js';

// Décor propre à chaque boutique de la galerie : on voit ce qui s'y vend.
// Repère local L de la boutique : x le long de la devanture, z vers le fond (0 = vitrine, depth = mur du fond).

/** Couleurs des articles sur les étagères, par boutique. */
export const SHELF_PALETTE = {
  armes: [0x2a2c2e, 0x4a4a3a, 0x6a5a3a, 0x3a3e42, 0x8a6a3a],
  pieces: [0x3a4a5a, 0x5a6a7a, 0xd9a21b, 0x2a2d30, 0x6a6e70],
  pharma: [0xf2f4f4, 0x3aa86a, 0xd84a3a, 0xe8eef0, 0x6fb8ff],
  combis: [0x1a2436, 0x6a4a32, 0xa89470, 0x2b3036, 0x7a2a24, 0x5d6168],
  nouilles: [0xd84a3a, 0xf2e6d6, 0x3a2a24, 0xe8a23a, 0x2a5a3a],
};

export function shopDecor(ctx, s, L, depth) {
  const { mats, scene } = ctx;
  const place = (obj, p, ry = 0, scale = 1) => { obj.position.copy(L.world(...p)); obj.rotation.y = ry; obj.scale.multiplyScalar(scale); obj.traverse((o) => { if (o.isMesh) o.castShadow = false; }); scene.add(obj); return obj; };
  const sign = (text, color, size, w, p) => {
    const nt = neonTexture(text, color, { size });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / nt.aspect), neonMaterial(nt.tex, 2.0));
    m.position.copy(L.world(...p)); m.rotation.y = Math.PI; scene.add(m);
  };
  const spots = ctx.shopSpots[s.id];

  if (s.id === 'armes') {
    // râtelier mural : vraies armes longues, canons à l'horizontale
    const longs = [['rifle', 0x7a7a3a], ['smg', 0x5a8a5a], ['sniper', 0x4a5a7a], ['shotgun', 0x8a4a2a], ['rifle', 0x9a7a3a], ['smg', 0x3a5a8a]];
    longs.forEach(([shape, acc], i) => place(weaponMesh(shape, acc), [0.15 + (i % 2) * 1.75, 1.45 + Math.floor(i / 2) * 0.62, depth - 0.2], Math.PI / 2, 1.25));
    // vitrine : pistolets sur supports
    for (let i = 0; i < 4; i++) place(weaponMesh(i % 2 ? 'revolver' : 'pistol', [0x6f86a8, 0x9a7a3a][i % 2]), [0.6 + i * 0.6, 1.0, 1.6], 0.5, 1.4);
    sign('ARMES HOMOLOGUÉES STATION', '#ff9a5a', 60, 2.6, [1.5, 3.45, depth - 0.1]);
  }
  if (s.id === 'pieces') {
    // canon sur caisse, tête de minage, tourelle sur socle, générateur de bouclier
    place(shipGunMesh('l2'), [2.8, 0.95, 1.4], -Math.PI / 2, 0.6);
    place(miningMesh('ml2'), [1.5, 0.95, 2.6], 0.4, 0.75);
    L.box(1.4, 0.8, 1.4, mats.metal(0x2a2d30, { rough: 0.5 }), [2.5, 0.4, 4.6], null, { collide: true });
    place(turretMesh(), [2.5, 0.8, 4.6], 0.6, 0.6);
    L.cyl(0.45, 0.5, 1.3, mats.metal(0x5a6a7a, { rough: 0.35 }), [0.6, 0.65, 4.8], null, { seg: 18 });
    L.cyl(0.47, 0.47, 0.08, mats.emissive(0x6fd0ff, 3), [0.6, 1.0, 4.8], null, { seg: 18, cast: false });
    L.cyl(0.47, 0.47, 0.08, mats.emissive(0x6fd0ff, 3), [0.6, 0.55, 4.8], null, { seg: 18, cast: false });
    L.obstacle(0.6, 0.6, 0.6, 4.8);
    sign('ARMEMENT · BOUCLIERS · MINAGE', '#5fe6ff', 60, 2.8, [1.6, 3.5, depth - 0.1]);
  }
  if (s.id === 'pharma') {
    // croix verte lumineuse, capsule de diagnostic, banc d'attente
    const g = mats.emissive(0x4dff8a, 4);
    L.box(0.9, 0.3, 0.05, g, [-1.6, 2.7, depth - 0.12], null, { cast: false });
    L.box(0.3, 0.9, 0.05, g, [-1.6, 2.7, depth - 0.12], null, { cast: false });
    L.box(1.0, 0.6, 2.0, mats.smooth(0xe8eef0, 0.3, 0.2), [2.6, 0.3, 3.6], null, { collide: true });
    const cap = new THREE.SphereGeometry(0.55, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.6, 1.9);
    L.geo(cap, mats.glass(0x9fd8ff, 0.35), [2.6, 0.6, 3.6]);
    L.box(0.9, 0.04, 1.8, mats.emissive(0x6fd0ff, 1.6), [2.6, 0.62, 3.6], null, { cast: false });
    L.box(1.6, 0.45, 0.5, mats.plastic(0x3aa86a, 0.6), [2.4, 0.22, 1.0], null, { collide: true });
    sign('SOINS · STYLOS MÉDICAUX · VIVRES', '#4dff8a', 55, 2.6, [1.4, 3.5, depth - 0.1]);
  }
  if (s.id === 'nouilles') {
    // cuisine au fond : plan de travail, marmites fumantes ; lanternes rouges devant
    L.box(3.4, 0.95, 0.6, mats.metal(0x8a8e92, { rough: 0.3 }), [-1.6, 0.47, depth - 0.45], null, { collide: true });
    const steam = [];
    for (const dx of [-2.6, -1.6, -0.6]) {
      L.cyl(0.24, 0.2, 0.32, mats.metal(0x5a5e62, { rough: 0.25 }), [dx, 1.11, depth - 0.45], null, { seg: 14 });
      for (let k = 0; k < 3; k++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
        sp.position.copy(L.world(dx, 1.3, depth - 0.45)); sp.scale.setScalar(0.3); sp.userData = { base: sp.position.clone(), k: k / 3 };
        scene.add(sp); steam.push(sp);
      }
    }
    ctx.updaters.push((dt, t) => {
      for (const sp of steam) {
        const k = (t * 0.35 + sp.userData.k) % 1;
        sp.position.set(sp.userData.base.x + Math.sin(t + k * 6) * 0.06, sp.userData.base.y + k * 0.9, sp.userData.base.z);
        sp.scale.setScalar(0.25 + k * 0.5); sp.material.opacity = 0.28 * (1 - k);
      }
    });
    for (const dx of [-3, 0, 3]) {
      L.cyl(0.01, 0.01, 0.6, mats.metal(0x2a2a2a), [dx, 4.1, -0.6], null, { seg: 4, cast: false });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.6, 0.3) }));
      l.scale.y = 1.25; l.position.copy(L.world(dx, 3.7, -0.6)); scene.add(l);
    }
  }
  if (s.id === 'combis') {
    // portants de vêtements (les mannequins habillés sont ajoutés avec les personnages)
    for (const z of [3.2, 4.6]) {
      L.cyl(0.02, 0.02, 1.8, mats.metal(0xa0a4a8, { rough: 0.3 }), [2.6, 1.6, z], [0, 0, Math.PI / 2], { seg: 6, cast: false });
      for (let i = 0; i < 8; i++) {
        const c = SHELF_PALETTE.combis[(i + Math.round(z)) % 6];
        L.box(0.05, 0.9, 0.42, mats.plastic(c, 0.8), [1.85 + i * 0.21, 1.1, z], null, { cast: false });
      }
      for (const dx of [1.7, 3.5]) L.cyl(0.03, 0.03, 1.6, mats.metal(0x6a6e72), [dx, 0.8, z], null, { seg: 6, cast: false });
    }
    spots.mannequins = [{ p: L.world(1.2, 0, 1.4), yaw: Math.PI }, { p: L.world(2.6, 0, 1.4), yaw: Math.PI }, { p: L.world(-3.0, 0, 1.2), yaw: Math.PI * 0.75 }];
  }
  // repères de la routine du vendeur : poste de caisse, étagère du fond
  spots.back = s.id === 'nouilles' ? L.world(-1.6, 0, 4.75) : L.world(-2.4, 0, 5.2);
  spots.backFace = L.world(s.id === 'nouilles' ? -1.6 : -2.4, 0, 7);
}
