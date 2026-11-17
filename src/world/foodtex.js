import * as THREE from 'three';

// Textures alimentaires générées (canvas) : croûte dorée et farinée, fromage fondu gratiné, sauce tomate
// huileuse, grains de riz, saumon strié, nori fibreux, bouillon avec gouttes de gras, curry, viande grillée…
// Couleur + relief (bump) + rugosité adaptée : les plats procéduraux gagnent un aspect « appétissant ».

let rnd = 1;
const R = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
const S = 256;

function canvas(draw, seed) {
  rnd = seed;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  draw(g);
  return c;
}
/** taches douces (dégradés radiaux) */
function blobs(g, n, r0, r1, col, a0 = 0.2, a1 = 0.6) {
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, r = r0 + R() * (r1 - r0), a = a0 + R() * (a1 - a0);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function specks(g, n, r0, r1, col) { g.fillStyle = col; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(R() * S, R() * S, r0 + R() * (r1 - r0), 0, 7); g.fill(); } }
function fill(g, col) { g.fillStyle = col; g.fillRect(0, 0, S, S); }

const RECIPES = {
  dough: (g) => { fill(g, '#c9883a'); blobs(g, 60, 10, 40, 'rgba(120,62,18,A)', 0.15, 0.45); blobs(g, 40, 8, 30, 'rgba(236,184,110,A)', 0.2, 0.5); specks(g, 220, 0.5, 1.6, 'rgba(250,240,220,0.55)'); specks(g, 80, 0.6, 2, 'rgba(70,36,12,0.5)'); },
  doughL: (g) => { fill(g, '#e2c084'); blobs(g, 45, 6, 22, 'rgba(160,96,36,A)', 0.2, 0.55); specks(g, 120, 1, 3, 'rgba(120,64,20,0.45)'); specks(g, 200, 0.5, 1.2, 'rgba(255,248,230,0.5)'); },
  cheese: (g) => { fill(g, '#f0cf6a'); blobs(g, 50, 12, 36, 'rgba(255,236,170,A)', 0.3, 0.7); blobs(g, 35, 5, 16, 'rgba(176,104,30,A)', 0.3, 0.75); specks(g, 50, 1, 3, 'rgba(120,60,18,0.4)'); },
  sauce: (g) => { fill(g, '#a8261a'); blobs(g, 70, 8, 30, 'rgba(70,10,6,A)', 0.2, 0.5); blobs(g, 30, 4, 14, 'rgba(230,90,40,A)', 0.3, 0.6); specks(g, 90, 0.8, 2.2, 'rgba(40,90,30,0.6)'); },
  pepperoni: (g) => { fill(g, '#9a2418'); specks(g, 120, 1.5, 4, 'rgba(232,170,140,0.65)'); blobs(g, 30, 10, 30, 'rgba(60,8,4,A)', 0.2, 0.5); },
  basil: (g) => { fill(g, '#2a6a22'); blobs(g, 30, 10, 40, 'rgba(90,150,50,A)', 0.2, 0.5); g.strokeStyle = 'rgba(150,200,110,0.5)'; g.lineWidth = 2; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(R() * S, R() * S); g.lineTo(R() * S, R() * S); g.stroke(); } },
  lettuce: (g) => { fill(g, '#64ac3a'); blobs(g, 40, 10, 40, 'rgba(190,230,120,A)', 0.2, 0.6); g.strokeStyle = 'rgba(220,245,190,0.6)'; g.lineWidth = 2.5; for (let i = 0; i < 18; i++) { const x = R() * S; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (R() - 0.5) * 80, S / 2, x + (R() - 0.5) * 60, S); g.stroke(); } },
  tomato: (g) => { fill(g, '#d23a24'); blobs(g, 30, 10, 40, 'rgba(255,120,80,A)', 0.2, 0.5); specks(g, 40, 2, 4, 'rgba(250,210,120,0.6)'); },
  meat: (g) => { fill(g, '#4a2412'); blobs(g, 60, 6, 26, 'rgba(20,8,4,A)', 0.3, 0.7); blobs(g, 40, 4, 14, 'rgba(140,70,34,A)', 0.3, 0.6); specks(g, 200, 0.6, 1.8, 'rgba(14,6,2,0.6)'); },
  meatL: (g) => { fill(g, '#94583a'); g.strokeStyle = 'rgba(70,32,16,0.35)'; g.lineWidth = 1.5; for (let i = 0; i < 70; i++) { const y = R() * S; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + (R() - 0.5) * 20); g.stroke(); } blobs(g, 30, 8, 26, 'rgba(200,120,90,A)', 0.2, 0.4); },
  rice: (g) => { fill(g, '#ecebe2'); for (let i = 0; i < 900; i++) { const x = R() * S, y = R() * S, a = R() * 3.14; g.fillStyle = `rgba(${R() < 0.5 ? '255,255,250' : '196,192,178'},0.85)`; g.beginPath(); g.ellipse(x, y, 4.2, 1.8, a, 0, 7); g.fill(); } },
  nori: (g) => { fill(g, '#16211a'); for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(${R() < 0.5 ? '40,60,40' : '6,10,8'},0.5)`; g.lineWidth = 1; const x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 12, y + (R() - 0.5) * 12); g.stroke(); } },
  salmon: (g) => { fill(g, '#ee7a46'); g.strokeStyle = 'rgba(255,236,220,0.75)'; for (let i = -6; i < 14; i++) { g.lineWidth = 3 + R() * 3; g.beginPath(); g.moveTo(i * 22, 0); g.quadraticCurveTo(i * 22 + 30, S / 2, i * 22 + 10, S); g.stroke(); } blobs(g, 20, 10, 30, 'rgba(255,160,110,A)', 0.2, 0.4); },
  tuna: (g) => { fill(g, '#b4202c'); g.strokeStyle = 'rgba(230,120,130,0.35)'; for (let i = -6; i < 14; i++) { g.lineWidth = 2; g.beginPath(); g.moveTo(i * 24, 0); g.quadraticCurveTo(i * 24 + 26, S / 2, i * 24 + 8, S); g.stroke(); } blobs(g, 25, 10, 30, 'rgba(90,10,20,A)', 0.2, 0.4); },
  egg: (g) => { fill(g, '#f3eee0'); blobs(g, 30, 10, 40, 'rgba(220,210,190,A)', 0.2, 0.5); },
  broth: (g) => { fill(g, '#9a4a1a'); blobs(g, 40, 14, 50, 'rgba(60,24,6,A)', 0.2, 0.4); for (let i = 0; i < 90; i++) { const x = R() * S, y = R() * S, r = 1.5 + R() * 6; g.strokeStyle = 'rgba(255,200,120,0.55)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.fillStyle = 'rgba(230,150,60,0.35)'; g.fill(); } specks(g, 60, 1, 2.5, 'rgba(60,140,40,0.8)'); },
  brothL: (g) => { fill(g, '#c89a50'); blobs(g, 40, 10, 40, 'rgba(240,210,150,A)', 0.2, 0.5); specks(g, 80, 1, 3, 'rgba(240,236,220,0.75)'); specks(g, 40, 1, 2.5, 'rgba(40,110,40,0.8)'); },
  curry: (g) => { fill(g, '#c8641e'); blobs(g, 60, 8, 34, 'rgba(120,40,10,A)', 0.2, 0.5); blobs(g, 40, 6, 20, 'rgba(255,170,60,A)', 0.3, 0.6); for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(255,190,90,0.4)'; g.beginPath(); g.arc(R() * S, R() * S, 2 + R() * 5, 0, 7); g.fill(); } specks(g, 40, 1, 2.5, 'rgba(40,110,30,0.8)'); },
  noodle: (g) => { fill(g, '#ead392'); g.strokeStyle = 'rgba(250,236,190,0.9)'; for (let i = 0; i < 40; i++) { g.lineWidth = 3; g.beginPath(); const y = R() * S; g.moveTo(0, y); g.bezierCurveTo(S / 3, y + (R() - 0.5) * 60, (2 * S) / 3, y + (R() - 0.5) * 60, S, y); g.stroke(); } },
  herb: (g) => { fill(g, '#3e8a2e'); blobs(g, 40, 6, 20, 'rgba(120,190,70,A)', 0.3, 0.6); },
  choco: (g) => { fill(g, '#3e2214'); blobs(g, 40, 10, 40, 'rgba(100,60,36,A)', 0.2, 0.5); specks(g, 100, 0.6, 1.6, 'rgba(20,10,4,0.6)'); },
  cream: (g) => { fill(g, '#f6efdf'); blobs(g, 40, 10, 40, 'rgba(230,220,196,A)', 0.2, 0.4); },
  bamboo: (g) => { fill(g, '#c4a062'); g.strokeStyle = 'rgba(130,96,46,0.5)'; for (let i = 0; i < 40; i++) { g.lineWidth = 1 + R() * 2; const x = R() * S; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); } },
};

const cache = {};
/** Matériau alimentaire texturé ; rough : rugosité de base, bump : intensité du relief. */
export function foodMaterial(name, rough = 0.6, bump = 1) {
  const key = name + rough + bump;
  if (cache[key]) return cache[key];
  const c = canvas(RECIPES[name], [...name].reduce((s, ch) => s + ch.charCodeAt(0) * 131, 7));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  const bm = new THREE.CanvasTexture(c); bm.wrapS = bm.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshStandardMaterial({ map: tex, bumpMap: bm, bumpScale: 1.2 * bump, roughness: rough, metalness: 0 });
  m.name = 'food_' + name;
  return (cache[key] = m);
}
export const FOOD_TEX = Object.keys(RECIPES);
