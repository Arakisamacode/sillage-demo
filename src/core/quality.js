// Préréglages de qualité. Chaque niveau règle la résolution, les ombres, les effets et la foule.
export const PRESETS = {
  low: {
    name: 'low', pixelRatio: 1.0, maxPixels: 1280 * 720, shadows: true, shadowMap: 1024, spotShadows: 0,
    ao: false, bloom: true, smaa: false, beams: true, dust: 300, npcs: 18, anisotropy: 2, envRes: 128,
    npcShadows: false, aoSamples: 8, texScale: 0.5,
  },
  medium: {
    name: 'medium', pixelRatio: 1.25, maxPixels: 1600 * 900, shadows: true, shadowMap: 2048, spotShadows: 1,
    ao: true, aoHalf: true, bloom: true, smaa: true, beams: true, dust: 700, npcs: 28, anisotropy: 4, envRes: 256,
    npcShadows: false, aoSamples: 8, texScale: 1,
  },
  high: {
    name: 'high', pixelRatio: 1.5, maxPixels: 2560 * 1440, shadows: true, shadowMap: 4096, spotShadows: 2,
    ao: true, aoHalf: true, bloom: true, smaa: true, beams: true, dust: 1400, npcs: 40, anisotropy: 8, envRes: 256,
    npcShadows: true, aoSamples: 12, texScale: 1,
  },
  ultra: {
    name: 'ultra', pixelRatio: 2.0, maxPixels: 3840 * 2160, shadows: true, shadowMap: 4096, spotShadows: 4,
    ao: true, aoHalf: false, bloom: true, smaa: true, beams: true, dust: 2400, npcs: 52, anisotropy: 16, envRes: 512,
    npcShadows: true, aoSamples: 16, texScale: 1,
  },
};

export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

export function detectQuality() {
  const q = new URLSearchParams(location.search).get('quality');
  if (q && PRESETS[q]) return q;
  try {
    const saved = localStorage.getItem('sillage.quality');
    if (saved && PRESETS[saved]) return saved;
  } catch (e) { /* stockage indisponible */ }
  if (isTouchDevice()) return 'low';
  return 'high';
}

export function saveQuality(name) {
  try { localStorage.setItem('sillage.quality', name); } catch (e) { /* ignore */ }
}
