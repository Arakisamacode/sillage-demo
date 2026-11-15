# Crédits et licences des ressources

Toutes les ressources tierces sont **CC0 1.0 (domaine public)**. Aucune ressource ni aucun nom
n'est issu de Star Citizen ou d'un autre jeu. Les noms (station Halden-7, Sillage Orbital Logistics,
Héron, Mulet H4, Faucon, Navette ST-40, Galerie du Belvédère…) sont inventés pour cette démo.

> Note de provenance : l'environnement de développement n'avait accès qu'à npm et aux dépôts
> GitHub publics (polyhaven.com, ambientcg.com et quaternius.com étaient bloqués par le proxy).
> Les fichiers ont donc été récupérés depuis des miroirs fidèles des auteurs d'origine,
> dont la licence CC0 est indiquée ci-dessous et vérifiée auprès de la source amont.

## Personnages (modèles 3D)

| Fichiers | Auteur / pack | Licence | Source amont | Miroir utilisé |
|---|---|---|---|---|
| `public/assets/characters/M_*.glb` | Quaternius — *Ultimate Modular Men Pack* | CC0 1.0 | https://quaternius.com/packs/ultimatemodularcharacters.html | https://github.com/trebeljahr/quaternius-showcase (`public/glb/modular_men/`) |
| `public/assets/characters/F_*.glb` | Quaternius — *Ultimate Modular Women Pack* | CC0 1.0 | https://quaternius.com/packs/ultimatemodularwomen.html | https://github.com/trebeljahr/quaternius-showcase (`public/glb/modular_women/`) |

Modifications : suppression des doublons et soudure des sommets (`tools/optimize_characters.mjs`) ;
à l'exécution, fusion des sous-maillages en un seul maillage à couleurs de sommets.

## Animations

| Fichier | Auteur / pack | Licence | Source amont | Miroir utilisé |
|---|---|---|---|---|
| `public/assets/anim/ual.glb` | Quaternius — *Universal Animation Library (Standard)* | CC0 1.0 | https://quaternius.com/packs/universalanimationlibrary.html | https://github.com/J-Ponzo/gltf-universal-animation-library |

Modifications : extraction de 18 clips, suppression du maillage (`tools/build_anims.mjs`) ;
reciblage à l'exécution sur le squelette des personnages (`src/characters/retarget.js`).

## Images HDR (éclairage d'ambiance / reflets)

| Fichier | Image d'origine | Auteur | Licence | Miroir utilisé |
|---|---|---|---|---|
| `public/assets/hdri/warehouse.exr` | *Empty Warehouse 01* | Sergej Majboroda — Poly Haven | CC0 1.0 | paquet npm `@pmndrs/assets` (`hdri/warehouse.exr`, 512 px, EXR DWAB) |

Source amont : https://polyhaven.com/hdris — licence : https://polyhaven.com/license

## Textures PBR scannées Poly Haven (téléchargées directement)

| Fichiers (`public/assets/textures/ph/{1k,2k}/`) | Texture Poly Haven | Licence |
|---|---|---|
| `hangar_concrete_floor_*` | https://polyhaven.com/a/hangar_concrete_floor | CC0 1.0 |
| `corrugated_iron_02_*` | https://polyhaven.com/a/corrugated_iron_02 | CC0 1.0 |
| `worn_shutter_*` | https://polyhaven.com/a/worn_shutter | CC0 1.0 |
| `metal_plate_*` | https://polyhaven.com/a/metal_plate | CC0 1.0 |
| `large_grey_tiles_*` | https://polyhaven.com/a/large_grey_tiles | CC0 1.0 |

Script : `tools/fetch_polyhaven.py` (diffuse, normale OpenGL, ARM), recompressées en JPEG.

## Textures PBR scannées (miroir ambientCG)

| Fichiers (`public/assets/textures/scan/`) | Origine | Licence | Miroir utilisé |
|---|---|---|---|
| `concrete_*` (béton), `rustpaint_*` (métal peint rouillé), `plaster_*` (plâtre sale), `tiles_*` (carrelage) | ambientCG | CC0 1.0 | https://github.com/itz019/tls-textures (« CC0 PBR textures (ambientCG) ») |

Source amont : https://ambientcg.com — licence : https://docs.ambientcg.com/license/
Modification : conversion en JPEG.

## Créations originales du projet (CC0)

- Textures procédurales : tôles, bardage nervuré, plaques de pont, caillebotis, grilles,
  masques d'usure (`tools/gen_textures.py` → `public/assets/textures/gen/`).
- Marquages au sol, traces de pneus et de carburant, signalétique, pictogrammes, néons, écrans
  (dessinés en canvas à l'exécution, `src/world/signage.js`, `src/world/hangar.js`).
- Planète, atmosphère, nuages, étoiles, faisceaux lumineux, poussière, étincelles (shaders).
- Vaisseaux, véhicules, nacelle, mobilier et accessoires (géométrie procédurale).
- Tous les sons et la musique (synthèse Web Audio en temps réel, `src/audio/audio.js`) ;
  les annonces utilisent la synthèse vocale du navigateur (Web Speech API).

## Bibliothèques logicielles

| Bibliothèque | Licence |
|---|---|
| three.js | MIT |
| postprocessing (pmndrs) | Zlib |
| n8ao | ISC |
| three-mesh-bvh | MIT |
| Vite | MIT |
| glTF Transform (outil de build) | MIT |
