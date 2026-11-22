# Conversion des textures Rocketbox (TGA 2048) en JPG/PNG allégés pour le web.
# Usage : python3 -I rb_textures.py <dossier Textures> <dossier sortie> <taille corps> <taille tête>
import sys, glob, os
from PIL import Image, ImageFilter
import numpy as np
src, out, sb, sh = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
os.makedirs(out, exist_ok=True)
def save(path, name, size, mode='RGB', fmt='JPEG'):
    im = Image.open(path).convert(mode)
    if max(im.size) > size: im = im.resize((size, size), Image.LANCZOS)
    im.save(os.path.join(out, name), fmt, **({'quality': 84} if fmt == 'JPEG' else {'optimize': True}))
done = []
for f in glob.glob(os.path.join(src, '*.tga')):
    b = os.path.basename(f).lower()
    if b.endswith('_body_color.tga'): save(f, 'body_color.jpg', sb); done.append('body_color')
    elif b.endswith('_body_normal.tga'): save(f, 'body_normal.jpg', min(sb, 512)); done.append('body_normal')
    elif b.endswith('_head_color.tga'): save(f, 'head_color.jpg', sh); done.append('head_color')
    elif b.endswith('_head_normal.tga'): save(f, 'head_normal.jpg', min(sh, 512)); done.append('head_normal')
    elif b.endswith('_opacity_color.tga'): save(f, 'opacity_color.png', 512, 'RGBA', 'PNG'); done.append('opacity_color')
    elif b.endswith('_color.tga') and 'body' not in b and 'head' not in b and 'opacity' not in b: save(f, 'color.jpg', sb); done.append('color')
    elif b.endswith('_bump.tga'):
        # relief -> carte de normales (Sobel)
        im = Image.open(f).convert('L').resize((min(sb, 512),) * 2, Image.LANCZOS)
        a = np.asarray(im).astype(np.float32) / 255.0
        dx = np.roll(a, -1, 1) - np.roll(a, 1, 1); dy = np.roll(a, -1, 0) - np.roll(a, 1, 0)
        k = 3.0; n = np.dstack([-dx * k, dy * k, np.ones_like(a)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
        Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(os.path.join(out, 'normal.jpg'), 'JPEG', quality=88); done.append('normal')
print(','.join(sorted(done)))
