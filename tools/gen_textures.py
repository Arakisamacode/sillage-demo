"""Génère les textures PBR procédurales du projet (toutes tuilables).

Usage : python3 tools/gen_textures.py public/assets/textures/gen
Sorties (JPG) : <nom>_albedo, <nom>_normal (OpenGL, +Y), <nom>_orm (R=AO, G=rugosité, B=métal).
Ces textures sont des créations originales du projet (CC0).
"""
import sys, os
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/assets/textures/gen'
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- bruit tuilable
def value_noise(n, period, seed):
    """Bruit de valeur périodique (bicubique) de taille n x n, 'period' cellules."""
    r = np.random.default_rng(seed)
    g = r.random((period, period)).astype(np.float32)
    x = np.arange(n, dtype=np.float32) * period / n
    i0 = np.floor(x).astype(int)
    t = x - i0
    t = t * t * (3 - 2 * t)
    i1 = (i0 + 1) % period
    a = g[i0][:, i0]; b = g[i0][:, i1]; c = g[i1][:, i0]; d = g[i1][:, i1]
    tx = t[None, :]; ty = t[:, None]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(n, base, octaves, seed, gain=0.5):
    s = np.zeros((n, n), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        s += value_noise(n, base * 2 ** o, seed + o * 31) * amp
        tot += amp; amp *= gain
    return s / tot


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nx = -dx * strength; ny = dy * strength  # OpenGL : +Y vers le haut de l'image
    nz = np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5


def blur(a, r):
    out = a.copy()
    for _ in range(r):
        out = (out + np.roll(out, 1, 0) + np.roll(out, -1, 0) + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 5
    return out


def save(name, arr, q=90):
    arr = np.clip(arr, 0, 1)
    img = (arr * 255 + 0.5).astype(np.uint8)
    mode = 'L' if img.ndim == 2 else 'RGB'
    Image.fromarray(img, mode).save(os.path.join(OUT, name + '.jpg'), quality=q, subsampling=0 if 'normal' in name else 2)
    print('  ', name)


def scratches(n, count, seed, maxlen=0.25, horiz_bias=0.0):
    """Rayures fines (masque 0..1), tuilables."""
    r = np.random.default_rng(seed)
    m = np.zeros((n, n), np.float32)
    for _ in range(count):
        x, y = r.random(2) * n
        ang = r.normal(0, 0.25) if r.random() < horiz_bias else r.random() * np.pi
        L = r.random() ** 2 * maxlen * n + 6
        steps = int(L)
        xs = (x + np.cos(ang) * np.arange(steps)).astype(int) % n
        ys = (y + np.sin(ang) * np.arange(steps) + np.sin(np.arange(steps) * 0.05) * r.random() * 4).astype(int) % n
        inten = 0.4 + 0.6 * r.random()
        fade = np.sin(np.linspace(0, np.pi, steps)) * inten
        m[ys, xs] = np.maximum(m[ys, xs], fade)
    return m


def rect_subdivide(r, x0, y0, x1, y1, minsz, depth, out):
    w, h = x1 - x0, y1 - y0
    if depth == 0 or (w <= minsz * 2 and h <= minsz * 2) or (depth < 3 and r.random() < 0.25):
        out.append((x0, y0, x1, y1)); return
    if (w > h and w > minsz * 2) or h <= minsz * 2:
        cut = x0 + minsz * r.integers(1, max(2, w // minsz))
        if cut >= x1: out.append((x0, y0, x1, y1)); return
        rect_subdivide(r, x0, y0, cut, y1, minsz, depth - 1, out); rect_subdivide(r, cut, y0, x1, y1, minsz, depth - 1, out)
    else:
        cut = y0 + minsz * r.integers(1, max(2, h // minsz))
        if cut >= y1: out.append((x0, y0, x1, y1)); return
        rect_subdivide(r, x0, y0, x1, cut, minsz, depth - 1, out); rect_subdivide(r, x0, cut, x1, y1, minsz, depth - 1, out)


def plates_height(n, rects, seam, bevel, bolt_r, r, inset_prob=0.2):
    """Hauteur de plaques rectangulaires avec joints, chanfreins et boulons."""
    H = np.zeros((n, n), np.float32)
    plate_id = np.zeros((n, n), np.int32)
    yy, xx = np.mgrid[0:n, 0:n]
    bolts = np.zeros((n, n), np.float32)
    for k, (x0, y0, x1, y1) in enumerate(rects):
        dx = np.minimum(xx - x0, x1 - 1 - xx); dy = np.minimum(yy - y0, y1 - 1 - yy)
        inside = (dx >= 0) & (dy >= 0)
        d = np.minimum(dx, dy).astype(np.float32)
        prof = np.clip((d - seam) / bevel, 0, 1)
        lvl = 1.0 if r.random() > inset_prob else 0.6
        H = np.where(inside, prof * lvl, H)
        plate_id = np.where(inside, k + 1, plate_id)
        # boulons aux coins et le long des bords longs
        m = seam + bevel + bolt_r + 3
        pts = [(x0 + m, y0 + m), (x1 - m, y0 + m), (x0 + m, y1 - m), (x1 - m, y1 - m)]
        if (x1 - x0) > 160:
            pts += [((x0 + x1) // 2, y0 + m), ((x0 + x1) // 2, y1 - m)]
        if (y1 - y0) > 160:
            pts += [(x0 + m, (y0 + y1) // 2), (x1 - m, (y0 + y1) // 2)]
        for (px, py) in pts:
            if r.random() < 0.07: continue  # boulon manquant
            rr = (xx - px) ** 2 + (yy - py) ** 2
            dome = np.clip(1 - rr / (bolt_r * bolt_r), 0, 1)
            bolts = np.maximum(bolts, np.sqrt(dome))
    return H, plate_id, bolts


# ---------------------------------------------------------------- grunge
def gen_grunge(n=1024):
    print('grunge')
    big = fbm(n, 4, 6, 11)
    big = np.clip((big - 0.35) * 2.2, 0, 1)
    scr = scratches(n, 1400, 12, 0.18)
    speck = fbm(n, 64, 3, 13)
    speck = np.clip((speck - 0.62) * 5, 0, 1)
    edge = fbm(n, 16, 5, 14)
    edge = np.clip((edge - 0.5) * 4, 0, 1)
    save('grunge', np.stack([big, blur(scr, 1) * 1.4, speck], -1))
    save('chips', edge)


# ---------------------------------------------------------------- tôles de coque / murs
def gen_panels(n=1024):
    """Tôles en rangées (aspect industriel / aéronautique) : joints fins, lignes de rivets,
    usure concentrée sur les arêtes, quelques trappes."""
    print('panels')
    r = np.random.default_rng(21)
    rects = []
    rows = [0, 256, 448, 704, 1024]
    for j in range(len(rows) - 1):
        y0, y1 = rows[j], rows[j + 1]
        x = int(r.integers(0, 4)) * 64 - 256
        while x < n:
            w = int(r.choice([192, 256, 320, 384, 512]))
            x0, x1 = max(x, 0), min(x + w, n)
            if x1 - x0 > 8: rects.append((x0, y0, x1, y1))
            x += w
    yy, xx = np.mgrid[0:n, 0:n]
    H = np.ones((n, n), np.float32)
    pid = np.zeros((n, n), np.int32)
    seam = np.zeros((n, n), np.float32)
    rivets = np.zeros((n, n), np.float32)
    for k, (x0, y0, x1, y1) in enumerate(rects):
        inside = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
        pid[inside] = k + 1
        d = np.minimum(np.minimum(xx - x0, x1 - 1 - xx), np.minimum(yy - y0, y1 - 1 - yy)).astype(np.float32)
        prof = np.clip((d - 0.5) / 2.5, 0, 1)
        H = np.where(inside, np.minimum(H, prof), H)
        # rivets le long des bords (pas de 24 px)
        for (ax, ay, bx, by) in [(x0 + 7, y0 + 7, x1 - 7, y0 + 7), (x0 + 7, y1 - 8, x1 - 7, y1 - 8), (x0 + 7, y0 + 7, x0 + 7, y1 - 8), (x1 - 8, y0 + 7, x1 - 8, y1 - 8)]:
            L = max(abs(bx - ax), abs(by - ay)); cnt = max(1, L // 24)
            for t in np.linspace(0, 1, cnt + 1):
                px, py = int(ax + (bx - ax) * t), int(ay + (by - ay) * t)
                if 2 <= px < n - 2 and 2 <= py < n - 2:
                    rivets[py - 2:py + 3, px - 2:px + 3] = np.maximum(rivets[py - 2:py + 3, px - 2:px + 3], np.array([[0, .5, .7, .5, 0], [.5, 1, 1, 1, .5], [.7, 1, 1, 1, .7], [.5, 1, 1, 1, .5], [0, .5, .7, .5, 0]]))
    # quelques trappes d'accès
    for _ in range(3):
        cx, cy = int(r.integers(80, n - 200)), int(r.integers(80, n - 160))
        w, h = int(r.integers(90, 160)), int(r.integers(70, 120))
        d = np.minimum(np.minimum(xx - cx, cx + w - xx), np.minimum(yy - cy, cy + h - yy)).astype(np.float32)
        ring = (d >= 0) & (d < 2)
        H = np.where(ring, 0.25, H)
    seamline = 1 - H
    detail = fbm(n, 32, 4, 22) * 0.02
    scr = scratches(n, 500, 23, 0.12)
    height = H * 0.6 + rivets * 0.25 + detail - scr * 0.02
    nrm = normal_from_height(blur(height, 1), 6.0)
    pv = r.random(len(rects) + 1)[pid].astype(np.float32)
    grime = fbm(n, 6, 5, 24)
    near_seam = blur(seamline, 6)
    chips = np.clip((fbm(n, 24, 4, 25) - 0.6) * 5, 0, 1) * np.clip(near_seam * 3 + rivets, 0, 1)
    chips = np.clip(chips + scr * 0.25, 0, 1)
    alb = 0.74 + (pv - 0.5) * 0.05
    alb = alb * (0.86 + 0.14 * grime) * (1 - near_seam * 0.25) * (1 - seamline * 0.55)
    ao = np.clip(1 - near_seam * 0.5 - seamline * 0.4 + rivets * 0.1, 0, 1)
    rough = np.clip(0.5 + grime * 0.18 + near_seam * 0.12 - chips * 0.1 + (pv - 0.5) * 0.06, 0.15, 1)
    metal = chips
    save('panels_albedo', alb)
    save('panels_normal', nrm, 93)
    save('panels_orm', np.stack([ao, rough, metal], -1))



# ---------------------------------------------------------------- bardage nervuré (murs du hangar)
def gen_cladding(n=1024):
    """Bardage métallique à nervures trapézoïdales verticales (texture = 4 m x 4 m),
    recouvrement horizontal tous les 2 m avec vis, coulures verticales."""
    print('cladding')
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    period = 64.0
    u = (xx % period) / period
    # profil trapézoïdal : plat haut (0.0-0.3), pente, plat bas
    prof = np.clip(np.minimum((u - 0.05) / 0.12, (0.62 - u) / 0.12), 0, 1)
    minor = 0.15 * np.clip(1 - np.abs(u - 0.82) / 0.04, 0, 1)
    h = prof + minor
    lap = np.zeros((n, n), np.float32)
    for y0 in (0, n // 2):
        d = np.abs(((yy - y0) + n / 2) % n - n / 2)
        lap = np.maximum(lap, np.clip(1 - d / 3, 0, 1))
    screws = np.zeros((n, n), np.float32)
    for y0 in (6, n // 2 + 6):
        for x0 in np.arange(period * 0.85, n, period):
            rr = (xx - x0) ** 2 + (yy - y0) ** 2
            screws = np.maximum(screws, np.clip(1 - rr / 9, 0, 1))
    dents = blur((fbm(n, 6, 3, 71) > 0.72).astype(np.float32), 6) * 0.15
    height = h * 0.8 - lap * 0.3 + screws * 0.4 - dents
    nrm = normal_from_height(blur(height, 1), 5.0)
    streak = value_noise(n, 48, 72)
    streak = np.repeat(streak[:1, :], n, 0) * 0.5 + fbm(n, 8, 4, 73) * 0.5
    streak = np.clip((streak - 0.45) * 2.5, 0, 1)
    grime = fbm(n, 4, 6, 74)
    alb = (0.7 + 0.08 * grime) * (1 - streak * 0.22) * (1 - lap * 0.35) * (0.92 + 0.08 * prof)
    ao = np.clip(0.75 + 0.25 * prof - lap * 0.4, 0, 1)
    chips = np.clip((fbm(n, 32, 4, 75) - 0.68) * 6, 0, 1) * (1 - prof * 0.5)
    rough = np.clip(0.45 + grime * 0.2 + streak * 0.15 - chips * 0.1, 0.1, 1)
    save('cladding_albedo', alb)
    save('cladding_normal', nrm, 93)
    save('cladding_orm', np.stack([ao, rough, chips * 0.6], -1))

# ---------------------------------------------------------------- sol du hangar
def gen_deck(n=2048, concrete=None):
    """Plaques de pont 1 m (texture = 4 m), surface antidérapante usée."""
    print('deck')
    r = np.random.default_rng(31)
    s = n // 4
    rects = []
    for j in range(4):
        for i in range(4):
            if j % 2 == 0 and i % 2 == 0 and r.random() < 0.5:
                rects.append((i * s, j * s, i * s + 2 * s, j * s + s))
    taken = np.zeros((4, 4), bool)
    final = []
    for (x0, y0, x1, y1) in rects:
        i, j = x0 // s, y0 // s
        if not taken[j, i] and not taken[j, i + 1]:
            taken[j, i] = taken[j, i + 1] = True; final.append((x0, y0, x1, y1))
    for j in range(4):
        for i in range(4):
            if not taken[j, i]:
                final.append((i * s, j * s, i * s + s, j * s + s))
    H, pid, bolts = plates_height(n, final, 2, 4, 6, r, inset_prob=0.0)
    yy, xx = np.mgrid[0:n, 0:n]
    # motif antidérapant léger (losanges) très usé
    dia = (np.sin((xx + yy) * 2 * np.pi / 24) * np.sin((xx - yy) * 2 * np.pi / 24))
    dia = np.clip(dia * 3 - 2, 0, 1)
    wear = fbm(n, 8, 5, 32)
    dia = dia * np.clip((wear - 0.35) * 2.5, 0, 1)
    scr = scratches(n, 1200, 33, 0.08)
    height = H + bolts * 0.4 + dia * 0.12 + fbm(n, 48, 3, 34) * 0.05 - scr * 0.06
    nrm = normal_from_height(blur(height, 1), 7.0)
    pv = r.random(len(final) + 1)[pid].astype(np.float32)
    grime = fbm(n, 6, 6, 35)
    stains = np.clip((fbm(n, 5, 6, 36) - 0.55) * 3, 0, 1)
    seam_dirt = 1 - blur((H < 0.5).astype(np.float32), 5)
    base = 0.36 + (pv - 0.5) * 0.08
    if concrete is not None:
        base = base * (0.75 + 0.5 * concrete)
    alb = base * (0.7 + 0.3 * grime) * (0.85 + 0.15 * seam_dirt) * (1 - stains * 0.4) * (0.9 + 0.2 * fbm(n, 3, 4, 37))
    alb = alb + scr * 0.05 + dia * 0.03
    ao = np.clip(0.65 + 0.35 * blur(H, 3), 0, 1)
    rough = np.clip(0.62 + grime * 0.2 - stains * 0.3 - dia * 0.1 - scr * 0.25 + (1 - seam_dirt) * 0.15, 0.12, 1)
    metal = np.clip(0.35 + scr * 0.6 + dia * 0.3 - stains * 0.2, 0, 1)
    save('deck_albedo', alb)
    save('deck_normal', nrm, 93)
    save('deck_orm', np.stack([ao, rough, metal], -1))


# ---------------------------------------------------------------- caillebotis
def gen_grating(n=512):
    print('grating')
    yy, xx = np.mgrid[0:n, 0:n]
    p = 32
    bx = np.abs(((xx % p) - p / 2)) / (p / 2)
    by = np.abs(((yy % (p // 2)) - p / 4)) / (p / 4)
    bar = np.clip((bx - 0.82) * 12, 0, 1)
    cross = np.clip((by - 0.78) * 10, 0, 1)
    solid = np.maximum(bar, cross)
    alpha = (solid > 0.05).astype(np.float32)
    h = solid
    nrm = normal_from_height(blur(h, 1), 6)
    g = fbm(n, 8, 4, 41)
    alb = (0.42 + 0.2 * g) * (0.7 + 0.3 * solid)
    save('grating_albedo', alb)
    save('grating_alpha', alpha)
    save('grating_normal', nrm, 93)


# ---------------------------------------------------------------- grille de ventilation
def gen_vent(n=512):
    print('vent')
    yy, xx = np.mgrid[0:n, 0:n]
    slat = (np.sin(yy * 2 * np.pi / 24) * 0.5 + 0.5)
    frame = np.minimum(np.minimum(xx, n - 1 - xx), np.minimum(yy, n - 1 - yy))
    fr = np.clip(1 - (frame - 18) / 6, 0, 1)
    h = np.maximum(slat * (1 - fr), fr)
    nrm = normal_from_height(blur(h, 1), 10)
    dirt = fbm(n, 6, 5, 51)
    alb = (0.18 + 0.4 * slat * (1 - fr) + 0.4 * fr) * (0.6 + 0.4 * dirt)
    save('vent_albedo', alb)
    save('vent_normal', nrm, 93)


# ---------------------------------------------------------------- bruit pour les nuages/planète (non utilisé en temps réel lourd)
def gen_noise_rgba(n=512):
    print('noise')
    a = fbm(n, 4, 6, 61); b = fbm(n, 8, 5, 62); c = fbm(n, 16, 4, 63)
    save('noise3', np.stack([a, b, c], -1))


if __name__ == '__main__':
    conc = None
    cpath = 'public/assets/textures/scan/concrete_albedo.jpg'
    if os.path.exists(cpath):
        im = Image.open(cpath).convert('L').resize((2048, 2048), Image.BILINEAR)
        conc = np.asarray(im, np.float32) / 255.0
        conc = (conc - conc.mean()) / (conc.std() * 6) + 0.5
    gen_grunge(); gen_panels(); gen_cladding(); gen_deck(concrete=conc); gen_grating(); gen_vent(); gen_noise_rgba()
