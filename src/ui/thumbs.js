import * as THREE from 'three';
import { ITEMS } from '../game/catalog.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { weaponMesh } from '../game/ground.js';
import { shipGunMesh, turretMesh, miningMesh } from '../game/shipgear.js';

// Vignettes des articles (boutiques, inventaire) : rendu 3D des armes et pièces de vaisseau à partir des
// maquettes du jeu, dessins simples pour tenues, armures et consommables. Générées une fois, à la demande.

const W = 160, H = 100;
let cache = null;

function draw2D(it) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const hex = (n) => '#' + new THREE.Color(n).getHexString();
  g.lineJoin = 'round';
  if (it.cat === 'outfit') {
    const o = it.outfit;
    g.fillStyle = hex(o.top);
    g.beginPath(); g.moveTo(52, 22); g.lineTo(108, 22); g.lineTo(128, 48); g.lineTo(116, 56); g.lineTo(106, 44); g.lineTo(104, 70); g.lineTo(56, 70); g.lineTo(54, 44); g.lineTo(44, 56); g.lineTo(32, 48); g.closePath(); g.fill();
    g.fillStyle = hex(o.bottom ?? o.top); g.fillRect(57, 70, 21, 26); g.fillRect(82, 70, 21, 26);
    g.fillStyle = hex(o.accent); g.fillRect(56, 40, 48, 4);
    if (o.hivis) { g.fillStyle = '#e8762a'; g.fillRect(56, 56, 48, 5); }
  } else if (it.cat === 'armor') {
    const a = it.armor;
    g.fillStyle = hex(a.under); g.fillRect(56, 26, 48, 50);
    g.fillStyle = hex(a.plate);
    g.beginPath(); g.moveTo(58, 24); g.lineTo(102, 24); g.lineTo(106, 58); g.lineTo(80, 78); g.lineTo(54, 58); g.closePath(); g.fill();
    if (a.tier >= 2) { g.fillRect(38, 24, 18, 16); g.fillRect(104, 24, 18, 16); }
    if (a.tier >= 3) { g.fillRect(58, 80, 18, 16); g.fillRect(84, 80, 18, 16); }
    g.fillStyle = hex(a.light); g.fillRect(64, 36, 10, 3);
    g.fillStyle = hex(a.accent); g.fillRect(84, 34, 12, 6);
  } else {
    // consommables : pictogrammes
    g.strokeStyle = '#e8eef0'; g.lineWidth = 4; g.fillStyle = '#e8eef0';
    if (it.id === 'medpen') { g.fillStyle = '#e8eef0'; g.fillRect(40, 44, 70, 12); g.fillStyle = '#3aa86a'; g.fillRect(110, 46, 14, 8); g.fillStyle = '#d84a3a'; g.fillRect(60, 44, 10, 12); }
    else if (it.id === 'medkit') { g.fillStyle = '#d84a3a'; g.fillRect(48, 28, 64, 48); g.fillStyle = '#ffffff'; g.fillRect(74, 36, 12, 32); g.fillRect(64, 46, 32, 12); }
    else if (it.id === 'ration') { g.fillStyle = '#6a7a5a'; g.fillRect(56, 26, 48, 54); g.fillStyle = '#d9a21b'; g.fillRect(56, 44, 48, 12); }
    else { g.fillStyle = '#f2e6d6'; g.beginPath(); g.ellipse(80, 56, 36, 20, 0, 0, Math.PI); g.fill(); g.strokeStyle = '#d84a3a'; g.beginPath(); g.moveTo(66, 20); g.lineTo(90, 52); g.moveTo(76, 18); g.lineTo(96, 50); g.stroke(); }
  }
  return c.toDataURL();
}

function build() {
  cache = {};
  const canvas = document.createElement('canvas');
  let r = null;
  try { r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch { r = null; }
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeef4ff, 0x505050, 4.5));
  const sun = new THREE.DirectionalLight(0xffffff, 4.5); sun.position.set(2, 3, 4); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9fd8ff, 3); rim.position.set(-3, 1, -2); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 100);
  if (r) {
    r.setSize(W, H, false); r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace; r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  }
  for (const it of ITEMS) {
    let obj = null;
    try {
      if (it.cat === 'sidearm' || it.cat === 'primary') { obj = weaponMesh(it.shape, it.accent); obj.rotation.y = Math.PI / 2; }
      else if (it.cat === 'shipWeapon') { obj = shipGunMesh(it.id); obj.rotation.y = -Math.PI / 2.3; }
      else if (it.cat === 'turret') { obj = turretMesh(); obj.rotation.y = -0.7; }
      else if (it.cat === 'mining') { obj = miningMesh(it.id); obj.rotation.y = -Math.PI / 2.5; }
      else if (it.cat === 'shield') {
        obj = new THREE.Group();
        obj.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0x5a6a7a, metalness: 0.7, roughness: 0.35 })));
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.1, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2, 3) }));
        obj.add(ring); const r2 = ring.clone(); r2.position.y = 0.35; obj.add(r2);
        if (it.id === 'sh2') obj.scale.set(1.3, 1, 1.3);
      }
    } catch { obj = null; }
    if (obj && r) {
      obj.userData.muzzle?.removeFromParent();
      scene.add(obj);
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      const vt = Math.tan((cam.fov * Math.PI) / 360), ht = vt * cam.aspect;
      const dist = Math.max(size.x / 2 / ht, size.y / 2 / vt) * 1.18 + size.z / 2;
      cam.position.copy(ctr).add(new THREE.Vector3(0.12, 0.22, 1).normalize().multiplyScalar(dist));
      cam.lookAt(ctr);
      r.render(scene, cam);
      cache[it.id] = canvas.toDataURL();
      scene.remove(obj);
    } else cache[it.id] = draw2D(it);
  }
  if (r) { r.dispose(); r.forceContextLoss?.(); }
}

/** URL d'image de la vignette d'un article (générées à la première demande). */
export function thumb(id) {
  if (!cache) build();
  return cache[id] || '';
}
