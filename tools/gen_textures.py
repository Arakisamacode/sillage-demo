"""Génère les textures PBR procédurales du projet (toutes tuilables).

Usage : python3 tools/gen_textures.py public/assets/textures/gen [générateurs...]
  sans liste : tout est régénéré ; sinon p. ex. « kinds » (familles de panneaux seules) ou « panels deck ».
Sorties (JPG) : <nom>_albedo, <nom>_normal (OpenGL, +Y), <nom>_orm (R=AO, G=rugosité, B=métal).
Familles de panneaux de `Materials.paint(color, { kind })` (gen_kinds, 1024², niveaux de gris teintés par la couleur) :
  pwide (6 m : grands panneaux composites 3 x 1,2 m), pservice (2,4 m : bandes techniques, grilles, trappes),
  psmooth (6 m : panneaux laqués 1,5 x 3 m), phull (6 m : tôles lourdes rivetées et soudées).
  Normale = Sobel de la carte de hauteur ; ORM = AO / rugosité / « métal à nu » (écaillures, cf. addWear).
Ces textures sont des créations originales du projet (CC0).
"""
import sys, os
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/assets/textures/gen'
ONLY = set(sys.argv[2:])
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


# ---------------------------------------------------------------- familles de panneaux (paint kind)
def sobel_normal(h, strength):
    """Normale OpenGL (+Y) par filtre de Sobel (tuilable : convolution circulaire)."""
    R = lambda a, dy, dx: np.roll(np.roll(a, dy, 0), dx, 1)
    gx = (R(h, 1, -1) + 2 * R(h, 0, -1) + R(h, -1, -1) - R(h, 1, 1) - 2 * R(h, 0, 1) - R(h, -1, 1)) / 8
    gy = (R(h, -1, 1) + 2 * R(h, -1, 0) + R(h, -1, -1) - R(h, 1, 1) - 2 * R(h, 1, 0) - R(h, 1, -1)) / 8
    nx = -gx * strength; ny = gy * strength; nz = np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5


class Canvas:
    """Plan de travail tuilable : rectangles « modulo n », hauteur, identifiants de panneaux, masques."""
    def __init__(self, n):
        self.n = n
        self.yy, self.xx = np.mgrid[0:n, 0:n].astype(np.float32)
        self.H = np.zeros((n, n), np.float32)      # hauteur
        self.pid = np.zeros((n, n), np.int32)
        self.seam = np.zeros((n, n), np.float32)   # 1 dans les joints
        self.cav = np.zeros((n, n), np.float32)    # cavités (AO / crasse)
        self.alb = np.zeros((n, n), np.float32)    # retouches d'albédo (additif)
        self.rough = np.zeros((n, n), np.float32)  # retouches de rugosité (additif)
        self.wear = np.zeros((n, n), np.float32)   # zones exposées (écaillures)
        self.k = 0

    def local(self, x0, y0):
        return (self.xx - x0) % self.n, (self.yy - y0) % self.n

    def rect_d(self, x0, y0, w, h):
        """Distance (px) au bord le plus proche, négative hors du rectangle."""
        dx, dy = self.local(x0, y0)
        d = np.minimum(np.minimum(dx, w - 1 - dx), np.minimum(dy, h - 1 - dy))
        return np.where((dx < w) & (dy < h), d, -1.0)

    def panel(self, x0, y0, w, h, seam=1.5, bevel=2.5, lvl=1.0):
        d = self.rect_d(x0, y0, w, h)
        inside = d >= 0
        prof = np.clip((d - seam + 0.5) / bevel, 0, 1)
        self.k += 1
        self.H = np.where(inside, prof * lvl, self.H)
        self.pid = np.where(inside, self.k, self.pid)
        self.seam = np.where(inside, np.maximum(self.seam, 1 - np.clip(d - seam + 1, 0, 1)), self.seam)
        return d

    def groove(self, x0, y0, w, h, width=1.5, depth=0.5):
        """Rainure en anneau rectangulaire (contour de trappe)."""
        d = self.rect_d(x0, y0, w, h)
        g = np.clip(1 - np.abs(d - width) / width, 0, 1) * (d >= 0)
        self.H -= g * depth
        self.cav = np.maximum(self.cav, g)

    def inset(self, x0, y0, w, h, depth, bevel=2.0):
        d = self.rect_d(x0, y0, w, h)
        m = np.clip((d + 0.5) / bevel, 0, 1) * (d >= 0)
        self.H -= m * depth
        return d, m

    def screw(self, px, py, r=3.0, slot=True):
        dx, dy = self.local(px, py)
        dx = np.where(dx > self.n / 2, dx - self.n, dx); dy = np.where(dy > self.n / 2, dy - self.n, dy)
        sl = (slice(None), slice(None))
        rr = np.sqrt(dx * dx + dy * dy)
        head = np.clip(1 - rr / r, 0, 1)
        ring = np.clip(1 - np.abs(rr - r) / 1.0, 0, 1)
        self.H += np.sqrt(head) * 0.18 - ring * 0.25
        if slot:
            s = (np.abs(dx + dy) < 0.8) & (rr < r * 0.8)
            self.H -= s * 0.12
        self.cav = np.maximum(self.cav, ring * 0.6)
        self.wear = np.maximum(self.wear, np.clip(1 - rr / (r * 2.2), 0, 1))
        return sl

    def rivet(self, px, py, r=3.0):
        """Rivet à tête ronde (pochoir local, plus rapide que screw sur toute l'image)."""
        n = self.n
        R = int(r) + 2
        ys = (np.arange(-R, R + 1) + int(py)) % n; xs = (np.arange(-R, R + 1) + int(px)) % n
        oy, ox = np.mgrid[-R:R + 1, -R:R + 1].astype(np.float32)
        rr = np.sqrt(ox * ox + oy * oy)
        head = np.sqrt(np.clip(1 - (rr / r) ** 2, 0, 1))
        ring = np.clip(1 - np.abs(rr - r - 0.5) / 1.0, 0, 1)
        ix = np.ix_(ys, xs)
        self.H[ix] = np.maximum(self.H[ix], self.H[ix] + head * 0.35) - ring * 0.05
        self.cav[ix] = np.maximum(self.cav[ix], ring * 0.7)
        self.wear[ix] = np.maximum(self.wear[ix], head)

    def stamp_screw(self, px, py, r=3.0):
        n = self.n
        R = int(r) + 2
        ys = (np.arange(-R, R + 1) + int(py)) % n; xs = (np.arange(-R, R + 1) + int(px)) % n
        oy, ox = np.mgrid[-R:R + 1, -R:R + 1].astype(np.float32)
        rr = np.sqrt(ox * ox + oy * oy)
        head = np.clip(1 - rr / r, 0, 1)
        ring = np.clip(1 - np.abs(rr - r) / 0.9, 0, 1)
        slot = ((np.abs(ox - oy) < 0.7) & (rr < r * 0.75)).astype(np.float32)
        ix = np.ix_(ys, xs)
        self.H[ix] += np.sqrt(head) * 0.06 - ring * 0.18 - slot * 0.1
        self.cav[ix] = np.maximum(self.cav[ix], ring * 0.5 + slot * 0.3)
        self.alb[ix] += (head > 0) * 0.04
        self.wear[ix] = np.maximum(self.wear[ix], np.clip(1 - rr / (r * 1.6), 0, 1))


def finish(name, C, rng_, seed, height_scale, nstr, base, tone, rough0, rough_var, grime_amt, chip_amt,
           grain=0.01, seam_dark=0.35, ao_seam=0.55):
    """Assemble albédo / normale / ORM à partir du plan de travail."""
    n = C.n
    pv = rng_.random(C.k + 2)[C.pid].astype(np.float32)          # teinte par panneau
    pr = rng_.random(C.k + 2)[C.pid].astype(np.float32)          # rugosité par panneau
    grime = fbm(n, 4, 6, seed + 1)
    fine = fbm(n, 64, 3, seed + 2)
    scr = scratches(n, 260, seed + 3, 0.08, horiz_bias=0.6)
    height = C.H * height_scale + fine * grain - scr * 0.01
    nrm = sobel_normal(blur(height, 1), nstr)
    seam_soft = blur(C.seam, 3)
    cav_soft = blur(C.cav, 2)
    near = np.clip(blur(C.seam + C.cav, 8) * 2.5, 0, 1)
    chips = np.clip((fbm(n, 24, 4, seed + 4) - 0.58) * 5, 0, 1) * np.clip(near + C.wear * 0.8, 0, 1) * chip_amt
    chips = np.clip(chips + scr * 0.2 * chip_amt, 0, 1)
    alb = base + (pv - 0.5) * tone + C.alb
    alb = alb * (1 - grime_amt * 0.18 * grime) * (1 - near * 0.08 * grime_amt) * (1 - C.seam * seam_dark) * (1 - cav_soft * 0.3)
    alb = alb * (0.985 + 0.03 * fine)
    ao = np.clip(1 - C.seam * ao_seam - seam_soft * 0.25 - cav_soft * 0.45, 0, 1)
    rough = np.clip(rough0 + (pr - 0.5) * rough_var + grime * 0.12 * grime_amt + near * 0.06 + C.rough - chips * 0.1 - scr * 0.08, 0.06, 1)
    save(name + '_albedo', alb)
    save(name + '_normal', nrm, 93)
    save(name + '_orm', np.stack([ao, rough, chips], -1))


def gen_wide(n=1024):
    """Grands panneaux composites horizontaux (texture = 6 m) : 3 x 1,2-1,5 m, joints fins en creux,
    fixations discrètes, bandeau technique nervuré, légère variation de teinte par panneau."""
    print('pwide')
    r = np.random.default_rng(101)
    C = Canvas(n)
    px = n / 6.0                                   # px par mètre
    rows = [(0.0, 0.3, 'band'), (0.3, 1.5, 'p'), (1.8, 1.2, 'p'), (3.0, 1.5, 'p'), (4.5, 1.5, 'p')]
    for (y, h, kind) in rows:
        y0, hh = int(round(y * px)), int(round((y + h) * px)) - int(round(y * px))
        if kind == 'band':
            for x0 in (0, n // 2):
                C.panel(x0, y0, n // 2, hh, seam=1.5, bevel=2.0, lvl=0.85)
                for k in range(4):                 # nervures horizontales
                    gy = y0 + int(hh * (0.22 + 0.19 * k))
                    C.H[gy % n, :] -= 0.18; C.H[(gy + 1) % n, :] -= 0.1
                    C.cav[gy % n, :] = np.maximum(C.cav[gy % n, :], 0.35)
            continue
        # rangées alignées (pas d'appareil décalé, qui ferait « briques ») ; une rangée recoupée à 1,5 m
        cuts = [0, n // 2, n // 2 + n // 4, n] if h < 1.4 else [0, n // 2, n]
        for a, b in zip(cuts[:-1], cuts[1:]):
            C.panel(a, y0, b - a, hh, seam=1.4, bevel=3.0, lvl=1.0)
            m = 0.05 * px                           # fixations à 5 cm des coins + milieu des grands bords
            pts = [(a + m, y0 + m), (b - m, y0 + m), (a + m, y0 + hh - m), (b - m, y0 + hh - m)]
            if b - a > n / 3: pts += [((a + b) / 2, y0 + m), ((a + b) / 2, y0 + hh - m)]
            for (sx, sy) in pts: C.stamp_screw(sx, sy, 2.6)
            if r.random() < 0.45:                   # double filet décoratif (composite moulé)
                ly = y0 + int(hh * r.choice([0.2, 0.8]))
                C.H[ly % n, int(a + 0.15 * px):int(b - 0.15 * px)] -= 0.12
                C.H[(ly + 4) % n, int(a + 0.15 * px):int(b - 0.15 * px)] -= 0.12
            if r.random() < 0.3:                    # petite plaque d'identification
                w, h2 = int(0.22 * px), int(0.07 * px)
                ex, ey = int(a + 0.2 * px), int(y0 + 0.15 * px)
                d, mm = C.inset(ex, ey, w, h2, -0.15, 1.0)
                C.alb += (d >= 0) * 0.06
                C.rough -= (d >= 0) * 0.15
    finish('pwide', C, r, 110, 0.9, 7.0, base=0.74, tone=0.07, rough0=0.5, rough_var=0.12, grime_amt=0.6, chip_amt=0.5,
           grain=0.006, seam_dark=0.45, ao_seam=0.6)


def gen_service(n=1024):
    """Bandes techniques verticales (texture = 2,4 m) : grilles de ventilation, trappes d'accès, tôles vissées."""
    print('pservice')
    r = np.random.default_rng(202)
    C = Canvas(n)
    px = n / 2.4
    widths = [0.6, 0.3, 0.6, 0.45, 0.45]
    x = 0.0
    for wi, w in enumerate(widths):
        x0, x1 = int(round(x * px)), int(round((x + w) * px)); x += w
        y = 0.0
        while y < 2.39:
            h = min(r.choice([0.3, 0.4, 0.6, 0.8, 1.2]), 2.4 - y)
            if 2.4 - y - h < 0.25: h = 2.4 - y
            y0, y1 = int(round(y * px)), int(round((y + h) * px)); y += h
            W, Hh = x1 - x0, y1 - y0
            C.panel(x0, y0, W, Hh, seam=2.0, bevel=2.5, lvl=1.0 if r.random() < 0.7 else 0.8)
            m = int(0.035 * px)
            for (sx, sy) in [(x0 + m, y0 + m), (x1 - m, y0 + m), (x0 + m, y1 - m), (x1 - m, y1 - m)]: C.stamp_screw(sx, sy, 3.0)
            t = r.random()
            if w <= 0.3:                            # bande étroite : perforations ou gaine
                if t < 0.5:
                    for yy in range(y0 + 3 * m, y1 - 3 * m, 18):
                        for xx in range(x0 + 2 * m, x1 - 2 * m + 1, 18):
                            C.inset(xx - 4, yy - 4, 8, 8, 0.6, 2.0); C.cav[yy % n, xx % n] = 1
                else:
                    C.inset(x0 + W // 2 - 12, y0 + m * 2, 24, Hh - m * 4, -0.25, 3.0)  # gaine en relief
            elif t < 0.35 and Hh > 80:              # grille de ventilation
                gx0, gy0, gw, gh = x0 + int(0.06 * px), y0 + int(0.06 * px), W - int(0.12 * px), Hh - int(0.12 * px)
                d, mm = C.inset(gx0, gy0, gw, gh, 0.6, 2.0)
                inside = d > 3
                ly = (C.yy - gy0) % n
                slat = np.clip(np.abs(((ly % 14) / 14) - 0.5) * 4 - 0.8, 0, 1)   # fentes
                C.H -= inside * slat * 0.5
                C.cav = np.maximum(C.cav, inside * slat * 0.9)
                C.alb -= inside * slat * 0.25
            elif t < 0.7 and Hh > 80:               # trappe d'accès
                hx0, hy0 = x0 + int(0.05 * px), y0 + int(0.05 * px)
                hw, hh = W - int(0.1 * px), Hh - int(0.1 * px)
                C.groove(hx0, hy0, hw, hh, 1.6, 0.6)
                for k in (0.3, 0.7):                # loquets
                    lx, ly2 = hx0 + hw - 14, hy0 + int(hh * k)
                    C.inset(lx - 6, ly2 - 10, 12, 20, 0.35, 1.5)
                    C.inset(lx - 2, ly2 - 6, 4, 12, -0.4, 1.0)
                lw, lh = min(int(0.16 * px), hw - 30), int(0.05 * px)   # étiquette claire
                d, mm = C.inset(hx0 + 14, hy0 + 14, lw, lh, -0.08, 1.0)
                C.alb += (d >= 0) * 0.12; C.rough -= (d >= 0) * 0.12
            else:                                   # tôle à bossages (raidisseurs)
                if Hh > 120 and W > 120:
                    C.inset(x0 + int(0.08 * px), y0 + int(0.08 * px), W - int(0.16 * px), Hh - int(0.16 * px), -0.3, 6.0)
    finish('pservice', C, r, 220, 0.9, 6.0, base=0.7, tone=0.08, rough0=0.52, rough_var=0.12, grime_amt=1.0, chip_amt=0.9,
           grain=0.008, seam_dark=0.5, ao_seam=0.65)


def gen_smooth(n=1024):
    """Panneaux laqués lisses (texture = 6 m) : 1,5 x 3 m, joints très fins, aucune fixation visible."""
    print('psmooth')
    r = np.random.default_rng(303)
    C = Canvas(n)
    cw, rh = n // 4, n // 2
    for j in range(2):
        for i in range(4):
            C.panel(i * cw, j * rh, cw, rh, seam=0.8, bevel=1.6, lvl=1.0)
    # filet horizontal décoratif à 1/3 de la hauteur d'un panneau sur deux
    for i in range(4):
        if i % 2 == 0:
            ly = int(rh * 0.18)
            C.H[ly, i * cw + 8:(i + 1) * cw - 8] -= 0.25; C.cav[ly, i * cw + 8:(i + 1) * cw - 8] = 0.3
    finish('psmooth', C, r, 330, 0.7, 6.0, base=0.78, tone=0.04, rough0=0.36, rough_var=0.06, grime_amt=0.25, chip_amt=0.15,
           grain=0.002, seam_dark=0.5, ao_seam=0.6)


def gen_hull(n=1024):
    """Tôles de coque lourdes (texture = 6 m) : plaques chevauchantes, rangées de rivets, cordons de soudure,
    renforts rapportés."""
    print('phull')
    r = np.random.default_rng(404)
    C = Canvas(n)
    px = n / 4.0                                    # plan dessiné en « 4 unités » (1 unité = 1,5 m réel)
    rows = [0.0, 1.25, 2.0, 3.25, 4.0]               # hauteurs de tôles variées (1,25 / 0,75 m)
    weld = np.zeros((n, n), np.float32)
    plates = []
    for j in range(4):
        y0, y1 = int(rows[j] * px), int(rows[j + 1] * px)
        widths = [[2.5, 1.5], [4.0], [1.5, 2.5], [2.0, 2.0]][j]
        x = [0.0, 0.6, 0.6, 1.2][j]
        for w in widths:
            x0 = int(x * px); W = int(w * px); x += w
            lvl = 1.0 if r.random() < 0.6 else 0.75
            C.panel(x0, y0, W, y1 - y0, seam=1.5, bevel=4.0, lvl=lvl)
            plates.append((x0, y0, W, y1 - y0))
            is_weld = len(widths) > 1 and r.random() < 0.5
            if is_weld:                             # cordon de soudure sur le bord gauche
                dx, dy = C.local(x0, y0)
                dxw = np.where(dx > n / 2, dx - n, dx)
                band = (np.abs(dxw) < 5) & (dy < y1 - y0)
                ripple = 0.5 + 0.5 * np.sin(dy * 1.4)
                bead = np.clip(1 - np.abs(dxw) / 5, 0, 1) * band
                C.H += bead * (0.4 + 0.15 * ripple)
                weld = np.maximum(weld, np.clip(1 - np.abs(dxw) / 14, 0, 1) * band)
                C.seam = np.where(band, 0, C.seam)
            # rivets : double rangée le long du bord haut, simple sur les côtés (pas de 6 cm)
            pitch = 0.06 * px
            for off in (0.03, 0.075):
                for k in range(int(W / pitch)):
                    C.rivet(x0 + (k + 0.5) * pitch, y0 + off * px, 2.6)
            for k in range(int((y1 - y0) / pitch)):
                C.rivet(x0 + W - 0.03 * px, y0 + (k + 0.5) * pitch, 2.6)
                if not is_weld and len(widths) > 1: C.rivet(x0 + 0.03 * px, y0 + (k + 0.5) * pitch, 2.6)
    for pi in r.choice(len(plates), 3, replace=False):   # renforts rapportés (doublers) dans une tôle
        px0, py0, pw, ph = plates[pi]
        w, h = int(r.integers(90, 170)), int(min(r.integers(60, 110), ph - 60))
        x0, y0 = px0 + int(r.integers(40, pw - w - 40)), py0 + int(r.integers(40, ph - h - 20))
        d, mm = C.inset(x0, y0, w, h, -0.35, 3.0)
        C.seam = np.maximum(C.seam, ((d >= 0) & (d < 1.5)) * 0.6)
        for k in range(int(w / 15)):
            C.rivet(x0 + 7 + k * 15, y0 + 7, 2.2); C.rivet(x0 + 7 + k * 15, y0 + h - 8, 2.2)
    C.alb -= weld * 0.1 + blur(weld, 6) * 0.06
    C.rough += weld * 0.15
    C.wear = np.maximum(C.wear, weld * 0.6)
    finish('phull', C, r, 440, 1.0, 5.0, base=0.68, tone=0.06, rough0=0.55, rough_var=0.16, grime_amt=1.1, chip_amt=1.0,
           grain=0.012, seam_dark=0.4, ao_seam=0.55)


def gen_kinds():
    gen_wide(); gen_service(); gen_smooth(); gen_hull()


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
    gens = {'grunge': gen_grunge, 'panels': gen_panels, 'cladding': gen_cladding, 'deck': lambda: gen_deck(concrete=conc),
            'grating': gen_grating, 'vent': gen_vent, 'noise': gen_noise_rgba, 'kinds': gen_kinds}
    for k, f in gens.items():
        if not ONLY or k in ONLY: f()
