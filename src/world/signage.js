import * as THREE from 'three';

// Signalétique intégrée au décor : peinture usée sur les murs, pictogrammes, néons, écrans.
// Tout est dessiné en canvas 2D (aucune police ni image externe).

export const FONT = '"Rajdhani","Bahnschrift","DIN Alternate","Arial Narrow",Arial,sans-serif';

let _seed = 1;
export function rand() { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; }
export function seed(s) { _seed = s; }

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Érode un dessin (peinture usée) : mouchetures, rayures et zones effacées. */
export function erode(ctx, w, h, amount = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  // grandes zones effacées
  for (let i = 0; i < 18 * amount; i++) {
    const x = rand() * w, y = rand() * h, r = (0.04 + rand() * 0.12) * Math.min(w, h);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${0.35 + rand() * 0.5})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // mouchetures
  for (let i = 0; i < 1400 * amount; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.3 + rand() * 0.7})`;
    const s = rand() * rand() * 5 + 0.5;
    ctx.fillRect(rand() * w, rand() * h, s, s * (0.5 + rand()));
  }
  // rayures
  ctx.lineCap = 'round';
  for (let i = 0; i < 70 * amount; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.3 + rand() * 0.6})`;
    ctx.lineWidth = 0.5 + rand() * 2;
    const x = rand() * w, y = rand() * h, a = (rand() - 0.5) * 0.6 + (rand() < 0.5 ? 0 : Math.PI / 2), L = rand() * w * 0.3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
  }
  ctx.restore();
}

function texFrom(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Matériau de « peinture au pochoir » posé sur une surface. */
export function decalMaterial(tex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    map: tex, transparent: true, depthWrite: false, roughness: opts.rough ?? 0.75, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: opts.color ?? 0xffffff,
    emissive: opts.emissive ?? 0x000000, emissiveMap: opts.emissive ? tex : null, emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

/** Texte peint (grand marquage mural). */
export function paintedText(lines, opts = {}) {
  const fs = opts.size ?? 200;
  const pad = fs * 0.3;
  const c0 = canvas(8, 8).getContext('2d');
  c0.font = `${opts.weight ?? 700} ${fs}px ${FONT}`;
  const widths = lines.map((l) => c0.measureText(l).width + (opts.spacing ?? 0) * l.length);
  const w = Math.ceil(Math.max(...widths) + pad * 2), h = Math.ceil(lines.length * fs * 1.05 + pad * 2);
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.font = c0.font;
  ctx.textBaseline = 'top';
  ctx.fillStyle = opts.color ?? '#e9e4d8';
  if (ctx.letterSpacing !== undefined && opts.spacing) ctx.letterSpacing = opts.spacing + 'px';
  lines.forEach((l, i) => {
    const x = opts.align === 'left' ? pad : (w - widths[i]) / 2;
    ctx.fillText(l, x, pad + i * fs * 1.05);
  });
  erode(ctx, w, h, opts.wear ?? 1);
  return { tex: texFrom(c), aspect: w / h };
}

/** Bandes de danger jaune / noir usées. */
export function hazardTexture(w = 512, h = 64, wear = 1) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#d9a21b'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#141414';
  const s = h * 1.2;
  for (let x = -h; x < w + h; x += s * 2) {
    ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.lineTo(x + h + s, 0); ctx.lineTo(x + s, h); ctx.fill();
  }
  erode(ctx, w, h, wear);
  const t = texFrom(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Pictogrammes de sécurité (triangle danger, interdiction, obligation). */
export function pictogram(kind, size = 256) {
  const c = canvas(size, size), ctx = c.getContext('2d');
  const s = size;
  ctx.lineJoin = 'round';
  if (kind === 'warning' || kind === 'voltage' || kind === 'vehicle' || kind === 'fire') {
    ctx.fillStyle = '#e8b21c'; ctx.strokeStyle = '#111'; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.moveTo(s / 2, s * 0.08); ctx.lineTo(s * 0.94, s * 0.88); ctx.lineTo(s * 0.06, s * 0.88); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    if (kind === 'warning') { ctx.fillRect(s * 0.47, s * 0.35, s * 0.06, s * 0.3); ctx.beginPath(); ctx.arc(s / 2, s * 0.74, s * 0.04, 0, 7); ctx.fill(); }
    if (kind === 'voltage') { ctx.beginPath(); ctx.moveTo(s * 0.55, s * 0.32); ctx.lineTo(s * 0.4, s * 0.6); ctx.lineTo(s * 0.52, s * 0.6); ctx.lineTo(s * 0.44, s * 0.8); ctx.lineTo(s * 0.62, s * 0.52); ctx.lineTo(s * 0.5, s * 0.52); ctx.closePath(); ctx.fill(); }
    if (kind === 'vehicle') { ctx.fillRect(s * 0.3, s * 0.55, s * 0.4, s * 0.14); ctx.fillRect(s * 0.33, s * 0.44, s * 0.18, s * 0.12); ctx.beginPath(); ctx.arc(s * 0.37, s * 0.72, s * 0.05, 0, 7); ctx.arc(s * 0.63, s * 0.72, s * 0.05, 0, 7); ctx.fill(); ctx.fillRect(s * 0.62, s * 0.38, s * 0.03, s * 0.2); }
    if (kind === 'fire') { ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.32); ctx.quadraticCurveTo(s * 0.68, s * 0.55, s * 0.6, s * 0.78); ctx.lineTo(s * 0.4, s * 0.78); ctx.quadraticCurveTo(s * 0.32, s * 0.55, s * 0.5, s * 0.32); ctx.fill(); }
  } else if (kind === 'nosmoke' || kind === 'noentry') {
    ctx.fillStyle = '#f2efe8'; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.45, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c42121'; ctx.lineWidth = s * 0.09; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.4, 0, 7); ctx.stroke();
    ctx.fillStyle = '#111';
    if (kind === 'nosmoke') { ctx.fillRect(s * 0.25, s * 0.47, s * 0.4, s * 0.07); ctx.fillRect(s * 0.67, s * 0.47, s * 0.06, s * 0.07); }
    else { ctx.fillStyle = '#c42121'; ctx.fillRect(s * 0.22, s * 0.44, s * 0.56, s * 0.12); }
    if (kind === 'nosmoke') { ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#c42121'; ctx.fillRect(-s * 0.4, -s * 0.045, s * 0.8, s * 0.09); ctx.restore(); }
  } else if (kind === 'helmet' || kind === 'suit' || kind === 'exit') {
    ctx.fillStyle = kind === 'exit' ? '#1f8a4c' : '#1f5fa8';
    if (kind === 'exit') ctx.fillRect(0, s * 0.18, s, s * 0.64); else { ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.46, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#f2f2f2';
    if (kind === 'helmet') { ctx.beginPath(); ctx.arc(s / 2, s * 0.55, s * 0.22, Math.PI, 0); ctx.fill(); ctx.fillRect(s * 0.24, s * 0.55, s * 0.52, s * 0.06); }
    if (kind === 'suit') { ctx.beginPath(); ctx.arc(s / 2, s * 0.36, s * 0.1, 0, 7); ctx.fill(); ctx.fillRect(s * 0.38, s * 0.48, s * 0.24, s * 0.26); ctx.fillRect(s * 0.3, s * 0.48, s * 0.06, s * 0.2); ctx.fillRect(s * 0.64, s * 0.48, s * 0.06, s * 0.2); }
    if (kind === 'exit') { ctx.font = `700 ${s * 0.22}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SORTIE ►', s / 2, s / 2); }
  }
  erode(ctx, s, s, 0.25);
  return texFrom(c);
}

/** Enseigne néon : tubes lumineux (HDR) — renvoie un matériau émissif. */
export function neonTexture(text, color = '#5fe6ff', opts = {}) {
  const fs = opts.size ?? 120;
  const c0 = canvas(8, 8).getContext('2d');
  c0.font = `${opts.weight ?? 600} ${fs}px ${opts.font ?? FONT}`;
  const tw = c0.measureText(text).width;
  const pad = fs * 0.5;
  const w = Math.ceil(tw + pad * 2), h = Math.ceil(fs * 1.25 + pad * 2);
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.font = c0.font; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.shadowColor = color; ctx.shadowBlur = fs * 0.35;
  ctx.strokeStyle = color; ctx.lineWidth = fs * 0.075; ctx.lineJoin = 'round';
  ctx.strokeText(text, w / 2, h / 2);
  ctx.shadowBlur = fs * 0.12;
  ctx.strokeText(text, w / 2, h / 2);
  ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = fs * 0.025;
  ctx.strokeText(text, w / 2, h / 2);
  return { tex: texFrom(c), aspect: w / h };
}

export function neonMaterial(tex, intensity = 3) {
  return new THREE.MeshBasicMaterial({
    map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    color: new THREE.Color(intensity, intensity, intensity),
  });
}

/** Écran animé : la fonction draw(ctx, w, h, t) est appelée périodiquement. */
export class Screen {
  constructor(w, h, draw, opts = {}) {
    this.c = canvas(w, h);
    this.ctx = this.c.getContext('2d');
    this.draw = draw;
    this.period = opts.period ?? 0.5;
    this.acc = Math.random() * this.period;
    this.tex = texFrom(this.c);
    this.material = new THREE.MeshBasicMaterial({ map: this.tex, color: new THREE.Color(opts.intensity ?? 1.6, opts.intensity ?? 1.6, opts.intensity ?? 1.6) });
    this.draw(this.ctx, w, h, 0);
    this.tex.needsUpdate = true;
  }

  update(dt, t) {
    this.acc += dt;
    if (this.acc < this.period) return;
    this.acc = 0;
    this.draw(this.ctx, this.c.width, this.c.height, t);
    // lignes de balayage
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < this.c.height; y += 3) ctx.fillRect(0, y, this.c.width, 1);
    this.tex.needsUpdate = true;
  }
}

/** Plan rectangulaire orienté, prêt à être collé sur un mur. */
export function plane(w, h, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.receiveShadow = true;
  return m;
}
