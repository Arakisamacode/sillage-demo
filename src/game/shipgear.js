import * as THREE from 'three';
import { ITEM } from './catalog.js';

// Armement monté sur le Héron : maquettes procédurales accrochées aux emplacements (repère local de l'aire).
export const HERON_MOUNTS = {
  wingL: { pos: [-8.4, 3.05, 0.4] },
  wingR: { pos: [8.4, 3.05, 0.4] },
  chin: { pos: [0, 2.3, -14.0], hang: true },
  dorsal: { pos: [0, 8.95, 2.4], top: true },
  mining: { pos: [0, 1.45, -9.6] },
};

let M = null;
function mats() {
  if (M) return M;
  M = {
    gun: new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.42, metalness: 0.75 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8a8e92, roughness: 0.3, metalness: 0.9 }),
    olive: new THREE.MeshStandardMaterial({ color: 0x5c5a32, roughness: 0.55, metalness: 0.35 }),
    glowB: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4fd0ff).multiplyScalar(2.5) }),
    glowR: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a3a).multiplyScalar(2.5) }),
  };
  return M;
}

const cylZ = (r1, r2, len, seg = 12) => { const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(-Math.PI / 2); return g; };
function add(g, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }

/** Construit la maquette d'une arme de vaisseau (canon vers -Z). */
export function shipGunMesh(id) {
  const it = ITEM[id], K = mats(), g = new THREE.Group();
  const s = it.size === 1 ? 0.8 : 1;
  if (it.gun === 'laser') {
    add(g, new THREE.BoxGeometry(0.42, 0.4, 1.4), K.gun, 0, 0, 0.3);
    add(g, new THREE.BoxGeometry(0.46, 0.08, 1.0), K.olive, 0, 0.22, 0.4);
    add(g, cylZ(0.11, 0.13, 2.2), K.dark, 0, 0, -1.4);
    for (let i = 0; i < 4; i++) add(g, cylZ(0.15, 0.15, 0.08), K.steel, 0, 0, -0.7 - i * 0.45);
    add(g, cylZ(0.06, 0.06, 0.04), K.glowB, 0, 0, -2.52);
    add(g, new THREE.BoxGeometry(0.05, 0.05, 0.6), K.glowB, 0.23, 0.05, 0.4);
  } else if (it.gun === 'ballistic') {
    add(g, new THREE.BoxGeometry(0.55, 0.5, 1.6), K.gun, 0, 0, 0.3);
    add(g, new THREE.BoxGeometry(0.4, 0.45, 0.9), K.olive, 0.42, -0.05, 0.6);
    add(g, cylZ(0.16, 0.18, 1.9), K.dark, 0, 0.02, -1.3);
    add(g, cylZ(0.22, 0.2, 0.45), K.gun, 0, 0.02, -2.3);
    for (let i = 0; i < 6; i++) add(g, new THREE.BoxGeometry(0.24, 0.04, 0.06), K.dark, 0, 0.24, -2.15 - i * 0.07 + 0.15);
  } else if (it.gun === 'missile') {
    add(g, new THREE.BoxGeometry(0.9, 0.9, 1.8), K.olive, 0, 0, 0);
    add(g, new THREE.BoxGeometry(0.95, 0.12, 1.85), K.gun, 0, 0.45, 0);
    for (const [x, y] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) {
      add(g, cylZ(0.15, 0.15, 0.05), K.dark, x, y, -0.91);
      add(g, new THREE.ConeGeometry(0.11, 0.25, 10).rotateX(-Math.PI / 2), K.glowR, x, y, -0.95);
    }
  }
  g.scale.setScalar(s);
  return g;
}

/** Tête de minage ventrale : carter, bras articulé, émetteur à lentille. */
export function miningMesh(id) {
  const K = mats(), g = new THREE.Group(), big = ITEM[id].power > 1.2;
  add(g, new THREE.BoxGeometry(1.4, 0.5, 2.0), K.gun, 0, 0.1, 0.4);
  add(g, new THREE.BoxGeometry(1.5, 0.12, 1.6), new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.6, metalness: 0.3 }), 0, 0.38, 0.4);
  add(g, new THREE.SphereGeometry(0.42, 14, 10), K.dark, 0, -0.2, -0.4);
  add(g, cylZ(0.26, 0.34, big ? 1.3 : 1.0), K.olive, 0, -0.25, -0.95);
  add(g, cylZ(0.3, 0.3, 0.12), K.steel, 0, -0.25, big ? -1.6 : -1.45);
  add(g, cylZ(0.18, 0.18, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.4) }), 0, -0.25, big ? -1.68 : -1.53);
  for (const x of [-0.5, 0.5]) add(g, new THREE.BoxGeometry(0.12, 0.12, 0.9), K.steel, x, -0.1, -0.5);
  return g;
}

/** Tourelle dorsale double. */
export function turretMesh() {
  const K = mats(), g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(1.0, 1.15, 0.35, 20), K.gun, 0, 0.18, 0);
  const head = new THREE.Group(); head.position.y = 0.55; g.add(head);
  add(head, new THREE.SphereGeometry(0.75, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.olive, 0, -0.1, 0);
  add(head, new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-0.5), new THREE.MeshStandardMaterial({ color: 0x1a2a34, roughness: 0.05, metalness: 0.9 }), 0, 0.12, -0.3);
  for (const x of [-0.55, 0.55]) {
    add(head, new THREE.BoxGeometry(0.28, 0.3, 1.0), K.gun, x, 0.1, -0.2);
    add(head, cylZ(0.07, 0.08, 1.7), K.dark, x, 0.12, -1.4);
    add(head, cylZ(0.04, 0.04, 0.03), K.glowB, x, 0.12, -2.26);
  }
  g.userData.head = head;
  g.scale.setScalar(1.3);
  return g;
}

/** Met à jour les maquettes d'armes sur le vaisseau selon la configuration (state.d.ship). */
export class HeronLoadout {
  constructor(ship) {
    this.ship = ship;
    this.meshes = {};
    // berceau de tourelle et support de menton (toujours présents)
    const K = mats();
    const chin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 1.2), K.gun);
    chin.position.set(0, 2.55, -14.0); ship.group.add(chin);
  }
  apply(loadout) {
    for (const [slot, m] of Object.entries(HERON_MOUNTS)) {
      const id = loadout[slot];
      if (this.meshes[slot]?.userData.id === id) continue;
      if (this.meshes[slot]) this.ship.group.remove(this.meshes[slot]);
      delete this.meshes[slot];
      if (!id) continue;
      const mesh = slot === 'dorsal' ? turretMesh() : slot === 'mining' ? miningMesh(id) : shipGunMesh(id);
      mesh.position.set(...m.pos);
      if (m.hang) mesh.position.y -= 0.25;
      mesh.userData.id = id;
      this.ship.group.add(mesh);
      this.meshes[slot] = mesh;
    }
  }
}
