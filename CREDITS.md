# Crédits et licences des ressources

Toutes les ressources tierces sont **CC0 1.0 (domaine public)**. Aucune ressource ni aucun nom
n'est issu de Star Citizen ou d'un autre jeu. Les noms (station Halden-7, Sillage Orbital Logistics,
Héron, Mulet H4, Faucon, Navette ST-40, Galerie du Belvédère…) sont inventés pour cette démo.

> Note de provenance : l'environnement de développement n'avait accès qu'à npm et aux dépôts
> GitHub publics (polyhaven.com, ambientcg.com et quaternius.com étaient bloqués par le proxy).
> Les fichiers ont donc été récupérés depuis des miroirs fidèles des auteurs d'origine,
> dont la licence CC0 est indiquée ci-dessous et vérifiée auprès de la source amont.

## Personnages (modèles 3D)

| Fichiers | Auteur / pack | Licence | Source |
|---|---|---|---|
| `public/assets/characters/ubc/U{M,F}_{light,dark}.glb`, `Hair_*.glb` | Quaternius — *Universal Base Characters* (version gratuite « Standard ») | CC0 1.0 (licence incluse : `public/assets/characters/ubc/LICENSE_quaternius_ubc.txt`) | https://quaternius.com/packs/universalbasecharacters.html — téléchargé sur https://quaternius.itch.io/universal-base-characters |

Modifications : textures ramenées à 1024 px en JPEG, attributs inutilisés supprimés, conversion en .glb
(`tools/prep_ubc.mjs`). Les combinaisons, bottes, gants et bandes réfléchissantes sont peints à l'exécution
par un shader (`src/characters/characters.js`) ; les coiffures sont accrochées à l'os de la tête.

## Animations

| Fichier | Auteur / pack | Licence | Source amont | Miroir utilisé |
|---|---|---|---|---|
| `public/assets/anim/ual.glb` | Quaternius — *Universal Animation Library (Standard)* | CC0 1.0 | https://quaternius.com/packs/universalanimationlibrary.html | https://github.com/J-Ponzo/gltf-universal-animation-library |

Modifications : extraction de 25 clips (dont tir, rechargement, impact et chute pour le combat à pied), suppression du maillage (`tools/build_anims.mjs`) ;
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

## Modèles 3D photoscannés Poly Haven (téléchargés directement)

| Fichiers (`public/assets/models/ph/*.glb`) | Licence |
|---|---|
| `SchoolChair_01` (chaises de la Cour des Saveurs), `round_wooden_table_02` (tables), `modern_ceiling_lamp_01` (suspensions), `potted_plant_02`, `potted_plant_04` (plantes), `planter_box_01`, `metal_stool_03` | CC0 1.0 |
| `croissant`, `hamburger_buns`, `carrot_cake`, `strawberry_chocolate_cake`, `lemon`, `food_lime_01`, `food_apple_01`, `food_avocado_01`, `food_kiwi_01`, `food_pomegranate_01`, `yellow_onion`, `food_ginger_01` | CC0 1.0 |
| `wooden_cutting_board`, `wooden_bowl_02`, `brass_pot_01`, `jug_01`, `tea_set_01`, `wine_bottles_01`, `cardboard_box_01`, `plastic_crate_01`, `WetFloorSign_01` | CC0 1.0 |

Source : https://polyhaven.com/models (page de chaque modèle : https://polyhaven.com/a/<identifiant>) — licence : https://polyhaven.com/license
Script : `tools/fetch_ph_models.mjs` (glTF 1k, simplification meshoptimizer, textures JPEG 256–1024 px, variantes `_lo` pour la qualité basse).
Les plats sans équivalent CC0 (pizzas, sushis, phở, currys, tacos, burgers…) sont modélisés dans le projet avec des textures
alimentaires générées (`src/world/foodtex.js`).

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
