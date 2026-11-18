import * as THREE from 'three';
import { GALLERY } from './layout.js';
import { neonTexture, neonMaterial } from './signage.js';

// Galerie « néon » : panneaux publicitaires holographiques suspendus (animés, parasites et décalages de lignes),
// hologrammes 3D tournants au-dessus de projecteurs, enseignes verticales en drapeau, tubes néon sur les piliers.
// Les marques sont inventées pour le jeu. Les animations ne tournent que lorsque le joueur est dans la galerie.

const G = GALLERY;
const FONT = '"Rajdhani","Segoe UI",sans-serif';

const ADS = [
  { brand: 'NOVA ATELIER', line: 'Portez l\'avenir.', sub: 'La Couronne · niveau prestige', c1: '#6fe8ff', c2: '#1a4a6a', art: 'suit' },
  { brand: 'ÉCLIPSE', line: 'L\'énergie des pilotes.', sub: 'boisson ionisée · 3 ¤', c1: '#ff4a9a', c2: '#3a0a2a', art: 'can' },
  { brand: 'AÉRODYNE', line: 'Série 9. Au-delà.', sub: 'yachts stellaires · sur rendez-vous', c1: '#ffffff', c2: '#2a3a4a', art: 'ship' },
  { brand: 'LYS ORBITAL', line: 'Le soleil vous manque ?', sub: 'séjours en serre · navettes quotidiennes', c1: '#8aff7a', c2: '#0e2a14', art: 'sun' },
  { brand: 'KESTREL', line: 'Protégez ce qui compte.', sub: 'armurerie homologuée · galerie', c1: '#ffa03a', c2: '#2a1408', art: 'shield' },
  { brand: 'COUR DES SAVEURS', line: 'Dix cuisines. Une seule faim.', sub: 'pont habitat · ascenseurs', c1: '#ffd27a', c2: '#2a1e08', art: 'bowl' },
];

function drawArt(g, art, w, h, t, c) {
  g.save(); g.translate(w * 0.78, h * 0.52); g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2;
  const s = h * 0.32;
  if (art === 'suit') { g.rotate(Math.sin(t) * 0.1); g.beginPath(); g.arc(0, -s * 0.9, s * 0.22, 0, 7); g.stroke(); g.strokeRect(-s * 0.35, -s * 0.65, s * 0.7, s * 0.9); g.beginPath(); g.moveTo(-s * 0.2, s * 0.25); g.lineTo(-s * 0.25, s); g.moveTo(s * 0.2, s * 0.25); g.lineTo(s * 0.25, s); g.stroke(); }
  else if (art === 'can') { const k = Math.sin(t * 2) * 0.15; g.scale(1 - Math.abs(k), 1); g.strokeRect(-s * 0.3, -s * 0.8, s * 0.6, s * 1.6); g.beginPath(); g.ellipse(0, -s * 0.8, s * 0.3, s * 0.08, 0, 0, 7); g.stroke(); g.font = `700 ${s * 0.3}px ${FONT}`; g.textAlign = 'center'; g.fillText('É', 0, s * 0.1); }
  else if (art === 'ship') { g.rotate(-0.2 + Math.sin(t * 0.7) * 0.08); g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.5, s, 0); g.quadraticCurveTo(0, s * 0.25, -s, 0); g.stroke(); g.beginPath(); g.moveTo(-s * 0.2, -s * 0.05); g.lineTo(s * 0.6, s * 0.5); g.lineTo(s * 0.7, s * 0.5); g.stroke(); }
  else if (art === 'sun') { const r = s * (0.45 + Math.sin(t * 2) * 0.04); g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28 + t * 0.4; g.beginPath(); g.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); g.lineTo(Math.cos(a) * r * 1.8, Math.sin(a) * r * 1.8); g.stroke(); } }
  else if (art === 'shield') { g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.7, -s * 0.6); g.lineTo(s * 0.55, s * 0.4); g.lineTo(0, s); g.lineTo(-s * 0.55, s * 0.4); g.lineTo(-s * 0.7, -s * 0.6); g.closePath(); g.stroke(); g.globalAlpha = 0.3 + Math.sin(t * 3) * 0.2; g.fill(); }
  else { g.beginPath(); g.arc(0, 0, s * 0.7, 0, Math.PI); g.stroke(); g.beginPath(); g.moveTo(-s * 0.75, 0); g.lineTo(s * 0.75, 0); g.stroke(); for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-s * 0.2 + k * s * 0.2, -s * 0.15); g.bezierCurveTo(-s * 0.3 + k * s * 0.2, -s * 0.5, -s * 0.1 + k * s * 0.2, -s * 0.6, -s * 0.2 + k * s * 0.2, -s * (0.9 + Math.sin(t * 2 + k) * 0.1)); g.stroke(); } }
  g.restore();
}

class HoloAd {
  constructor(ad, w = 384, h = 192) {
    this.ad = ad; this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h;
    this.g = this.c.getContext('2d'); this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, side: THREE.FrontSide, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1.5, 1.5, 1.5) });
    this.acc = Math.random(); this.glitch = 0;
    this.draw(0);
  }
  draw(t) {
    const { g, c, ad } = this, w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, ad.c2); gr.addColorStop(1, 'rgba(0,0,0,0.2)');
    g.globalAlpha = 0.55; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    g.strokeStyle = ad.c1; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = ad.c1; g.font = `800 ${h * 0.2}px ${FONT}`; g.fillText(ad.brand, 18, h * 0.32);
    g.fillStyle = '#f4f8fb'; g.font = `600 ${h * 0.13}px ${FONT}`; g.fillText(ad.line, 18, h * 0.56);
    g.fillStyle = ad.c1; g.globalAlpha = 0.8; g.font = `500 ${h * 0.085}px ${FONT}`; g.fillText(ad.sub, 18, h * 0.8); g.globalAlpha = 1;
    drawArt(g, ad.art, w, h, t, ad.c1);
    // balayage et parasites : bandes décalées, lignes de trame
    const sweep = ((t * 0.35) % 1.4 - 0.2) * w;
    const sg = g.createLinearGradient(sweep - 40, 0, sweep + 40, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.18)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    if (this.glitch > 0) for (let k = 0; k < 4; k++) { const y = Math.random() * h, hh = 4 + Math.random() * 14; g.drawImage(this.c, 0, y, w, hh, (Math.random() - 0.5) * 30, y, w, hh); }
    g.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    this.tex.needsUpdate = true;
  }
  update(dt, t) {
    this.acc += dt; if (this.acc < 0.07) return; this.acc = 0;
    this.glitch = this.glitch > 0 ? this.glitch - 1 : Math.random() < 0.03 ? 4 : 0;
    this.material.opacity = this.glitch > 0 ? 0.6 + Math.random() * 0.4 : 0.95 + Math.sin(t * 9) * 0.03;
    this.draw(t);
  }
}

export function buildNeon(ctx) {
  const { scene, mats, builder: B } = ctx;
  const ads = [], spins = [];
  const low = ctx.quality.name === 'low';
  // panneaux suspendus au-dessus de l'allée centrale (doubles faces), câbles et cadres lumineux
  const H2 = Math.PI / 2;
  const spots = [[-92, -6.5, H2 + 0.25], [-78, -11, H2 - 0.3], [-64, -5.5, H2 + 0.2], [-50, -10, H2 - 0.25], [-86, 2.8, H2 + 0.5], [-56, 2.8, H2 - 0.5]];
  spots.slice(0, low ? 4 : 6).forEach(([x, z, ry], i) => {
    const ad = new HoloAd(ADS[i % ADS.length]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.0), ad.material);
    m.position.set(x, 4.9, z); m.rotation.y = ry; m.renderOrder = 3; scene.add(m);
    const back = new THREE.Mesh(m.geometry, ad.material); back.rotation.y = Math.PI; back.position.z = -0.01; m.add(back);   // face arrière lisible à l'endroit
    for (const s of [-1, 1]) B.cyl(0.012, 0.012, G.h - 6.4, mats.metal(0x2a2a2a), [x + Math.cos(ry) * s * 2.9, 6.4 + (G.h - 6.4) / 2, z - Math.sin(ry) * s * 2.9], null, { cast: false, seg: 4 });
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(ADS[i % ADS.length].c1).multiplyScalar(3) }));
    frame.position.set(0, -1.54, 0); m.add(frame); const f2 = frame.clone(); f2.position.y = 1.54; m.add(f2);
    ads.push(ad);
  });
  // hologrammes 3D : yacht filaire et canette tournante au-dessus de projecteurs au sol
  const holoMat = (c) => new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const proj = (x, z, col, obj, h) => {
    B.cyl(0.55, 0.65, 0.3, mats.metal(0x1c1e20, { rough: 0.4 }), [x, 0.15, z], null, { cast: false, collide: true, seg: 20 });
    B.addObstacle(x, z, 0.7, 0.7, 0);
    B.cyl(0.45, 0.45, 0.02, mats.emissive(col, 3), [x, 0.31, z], null, { cast: false, seg: 20 });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.45, h, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(0.6), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.set(x, 0.3 + h / 2, z); scene.add(cone);
    obj.position.set(x, 0.3 + h + 0.4, z); scene.add(obj); spins.push(obj);
  };
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), holoMat(new THREE.Color(0.6, 2.2, 3))); hull.scale.set(0.7, 0.35, 2.2); ship.add(hull);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.9, 4, 1, 2), hull.material); w.position.set(s * 1.0, -0.05, 0.5); w.rotation.y = s * 0.4; ship.add(w); }
  proj(-71, -12.5, 0x6fe8ff, ship, 2.6);
  const can = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 20, 6, true), holoMat(new THREE.Color(3, 0.6, 1.6))); can.add(body);
  const ringC = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.02, 4, 48), holoMat(new THREE.Color(3, 0.8, 2))); ringC.rotation.x = Math.PI / 2; can.add(ringC);
  proj(-57, -1.5, 0xff4a9a, can, 2.2);
  // enseignes verticales en drapeau sur les piliers des boutiques
  const words = [['NOUILLES', '#ff6a3a'], ['OUVERT 24 H', '#6fe8ff'], ['PIÈCES · RÉPARATIONS', '#ffd27a'], ['PHARMA', '#7dff9a'], ['MODE', '#ff4a9a'], ['CHANGE', '#c88aff']];
  let k = 0;
  for (let x = G.x0 + 10; x < G.x1 - 1; x += 10) {
    const [txt, col] = words[k++ % words.length];
    const nt = neonTexture(txt, col, { size: 70 });
    const len = Math.min(3.2, 0.6 * nt.aspect);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, len / nt.aspect), neonMaterial(nt.tex, 2.4));
    m.material.side = THREE.DoubleSide;
    m.position.set(x, 5.2, G.z1 - 1.1); m.rotation.set(0, Math.PI / 2, Math.PI / 2); scene.add(m);
    B.box(0.08, len + 0.2, 0.7, mats.metal(0x1a1c1e), [x, 5.2, G.z1 - 1.1], null, { cast: false });
    // tube néon vertical sur le pilier
    B.box(0.05, 4.2, 0.05, mats.emissive(new THREE.Color(col).getHex(), 2.6), [x + 1.02, 2.4, G.z1 + 0.02], null, { cast: false });
  }
  // liserés néon au sol le long des vitrines
  B.box(G.x1 - G.x0 - 2, 0.02, 0.06, mats.emissive(0xff4a9a, 1.8), [(G.x0 + G.x1) / 2, 0.02, G.z1 - 2.2], null, { cast: false });
  B.box(G.x1 - G.x0 - 2, 0.02, 0.06, mats.emissive(0x6fe8ff, 1.8), [(G.x0 + G.x1) / 2, 0.02, G.z0 + 1.6], null, { cast: false });
  ctx.updaters.push((dt, t) => {
    const P = ctx.player?.pos;
    const here = P && P.x < G.x1 + 2 && P.x > G.x0 - 2 && P.y < 8 && P.z > G.z0 - 1 && P.z < G.z1 + 8;
    for (const o of spins) { o.visible = !!here; if (here) { o.rotation.y = t * 0.6; o.position.y += Math.sin(t * 1.5) * 0.002; } }
    if (!here) return;
    for (const a of ads) a.update(dt, t);
  });
}
