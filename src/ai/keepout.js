// Distance minimale entre les figurants qui marchent et le joueur (capsule 0,32 m + figurant 0,28 m).
// Repousse la position hors du disque du joueur et la fait glisser sur son bord (contournement),
// sans allocation : appelé à chaque pas de chaque figurant en mouvement.

export const KEEP_R = 0.62;

/**
 * p : position du figurant (modifiée sur place) ; player : { pos } ; (dx, dz) : direction de marche voulue.
 * Renvoie true si la position a été corrigée.
 */
export function keepFromPlayer(p, player, dx = 0, dz = 0, r = KEEP_R) {
  const P = player?.pos;
  if (!P || Math.abs(P.y - p.y) > 1.5) return false;
  let ox = p.x - P.x, oz = p.z - P.z;
  const d2 = ox * ox + oz * oz;
  if (d2 >= r * r) return false;
  let d = Math.sqrt(d2);
  if (d < 1e-3) { ox = -dx || 1; oz = -dz; d = Math.hypot(ox, oz) || 1; }
  ox /= d; oz /= d;
  // glissement tangentiel du côté où va le figurant (à droite s'il arrive de face)
  const tx = -oz, tz = ox;
  const s = tx * dx + tz * dz;
  const slide = (r - d) * 0.6 * (s < -0.05 ? -1 : 1);
  let nx = ox * r + tx * slide, nz = oz * r + tz * slide;
  const k = r / Math.hypot(nx, nz);
  p.x = P.x + nx * k; p.z = P.z + nz * k;
  return true;
}

/** Cible de marche occupée par le joueur : le figurant attend (au lieu de piétiner contre lui). */
export function targetBlocked(pos, tgt, player, r = KEEP_R) {
  const P = player?.pos;
  if (!P || Math.abs(P.y - pos.y) > 1.5) return false;
  const tx = tgt.x - P.x, tz = tgt.z - P.z, px = pos.x - P.x, pz = pos.z - P.z;
  return tx * tx + tz * tz < r * r && px * px + pz * pz < (r + 0.35) * (r + 0.35);
}
