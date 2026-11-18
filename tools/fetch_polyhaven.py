"""Télécharge des textures PBR CC0 depuis Poly Haven (diffuse, normal OpenGL, ARM = AO/rugosité/métal).
Usage : python3 tools/fetch_polyhaven.py public/assets/textures/ph [id1,id2,…] [1k,2k]"""
import json, os, sys, urllib.request
opener = urllib.request.build_opener(); opener.addheaders = [('User-Agent', 'sillage-demo-asset-fetch/1.0')]
urllib.request.install_opener(opener)
OUT = sys.argv[1]
IDS = sys.argv[2].split(',') if len(sys.argv) > 2 else ['hangar_concrete_floor', 'corrugated_iron_02', 'worn_shutter', 'metal_plate', 'large_grey_tiles']
RES = sys.argv[3].split(',') if len(sys.argv) > 3 else ['1k', '2k']
for aid in IDS:
    files = json.load(urllib.request.urlopen(f'https://api.polyhaven.com/files/{aid}'))
    for res in RES:
        d = os.path.join(OUT, res); os.makedirs(d, exist_ok=True)
        for key, name in [('Diffuse', 'diff'), ('nor_gl', 'nor'), ('arm', 'arm')]:
            if key not in files: print('  (absent)', aid, key); continue
            url = files[key][res]['jpg']['url']
            dst = os.path.join(d, f'{aid}_{name}.jpg')
            if not os.path.exists(dst): urllib.request.urlretrieve(url, dst)
    print('ok', aid)
