"""Télécharge des textures PBR CC0 depuis Poly Haven (diffuse, normal OpenGL, ARM = AO/rugosité/métal).
Usage : python3 tools/fetch_polyhaven.py public/assets/textures/ph"""
import json, os, sys, urllib.request
opener = urllib.request.build_opener(); opener.addheaders = [('User-Agent', 'sillage-demo-asset-fetch/1.0')]
urllib.request.install_opener(opener)
OUT = sys.argv[1]
IDS = ['hangar_concrete_floor', 'corrugated_iron_02', 'worn_shutter', 'metal_plate', 'large_grey_tiles']
for aid in IDS:
    files = json.load(urllib.request.urlopen(f'https://api.polyhaven.com/files/{aid}'))
    for res in ['1k', '2k']:
        d = os.path.join(OUT, res); os.makedirs(d, exist_ok=True)
        for key, name in [('Diffuse', 'diff'), ('nor_gl', 'nor'), ('arm', 'arm')]:
            if key not in files: print('  (absent)', aid, key); continue
            url = files[key][res]['jpg']['url']
            dst = os.path.join(d, f'{aid}_{name}.jpg')
            if not os.path.exists(dst): urllib.request.urlretrieve(url, dst)
    print('ok', aid)
