# Crédits et licences des ressources

Toutes les ressources tierces sont **CC0 1.0 (domaine public)**. Aucune ressource ni aucun nom
n'est issu de Star Citizen ou d'un autre jeu. Les noms (station Halden-7, Sillage Orbital Logistics,
Héron, Mulet H4, Faucon, Navette ST-40, Galerie du Belvédère…) sont inventés pour ce jeu.

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
| `park_dirt_*` (chemins du Grand Dôme) | https://polyhaven.com/a/park_dirt | CC0 1.0 |
| `coast_sand_01_*` (bac à sable) | https://polyhaven.com/a/coast_sand_01 | CC0 1.0 |
| `bark_brown_02_*` (écorce des arbres) | https://polyhaven.com/a/bark_brown_02 | CC0 1.0 |
| `raked_dirt_*` (potager, talus) | https://polyhaven.com/a/raked_dirt | CC0 1.0 |
| `weathered_planks_*` (terrasse, grange, clôtures) | https://polyhaven.com/a/weathered_planks | CC0 1.0 |
| `roof_planks_*` (toits) | https://polyhaven.com/a/roof_planks | CC0 1.0 |
| `river_small_rocks_*` (fond du bassin) | https://polyhaven.com/a/river_small_rocks | CC0 1.0 |
| `lawn_*` (pelouse) | https://polyhaven.com/a/sparse_grass — couleur recalculée en vert pelouse (normale et ARM d'origine) | CC0 1.0 |

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
| `potted_plant_02`, `potted_plant_04` (plantes des bacs hydroponiques) | CC0 1.0 |
| `croissant`, `hamburger_buns`, `carrot_cake`, `strawberry_chocolate_cake`, `lemon`, `food_lime_01`, `food_apple_01`, `food_avocado_01`, `food_kiwi_01`, `food_pomegranate_01`, `yellow_onion`, `food_ginger_01` | CC0 1.0 |
| `wooden_cutting_board`, `wine_bottles_01`, `cardboard_box_01`, `plastic_crate_01` | CC0 1.0 |
| Grand Dôme (`public/assets/models/garden/*.glb`) : `fern_02`, `shrub_02`, `shrub_04`, `flower_gazania`, `flower_empodium`, `flower_ursinia`, `wild_rooibos_bush`, `wooden_picnic_table`, `painted_wooden_bench`, `wooden_lantern_01`, `wooden_bucket_01`, `barrel_03`, `wooden_crate_02`, `wicker_basket_02`, `watering_can_metal_01`, `rock_moss_set_02`, `namaqualand_boulders_01`, `tree_stump_01`, `garden_gnome`, `rubber_duck_toy`, `planter_box_02` | CC0 1.0 |

Source : https://polyhaven.com/models (page de chaque modèle : https://polyhaven.com/a/<identifiant>) — licence : https://polyhaven.com/license
Script : `tools/fetch_ph_models.mjs` (glTF 1k, simplification meshoptimizer, textures JPEG 256–1024 px).
Le mobilier de la Cour (sièges coque, tables, suspensions, banquettes, bacs hydroponiques) et le sol en résine sont des créations
du projet (`src/world/scififurn.js`, `src/world/foodcourt.js`).
Au Grand Dôme, les arbres (tronc en écorce scannée, feuillage en cartes dessinées), l'aire de jeux, la grange, le chariot du
glacier, le kiosque, les lampions, l'eau du bassin et le ciel artificiel sont des créations du projet (`src/world/garden.js`) ;
les animaux (moutons, chèvres, poules, canards, carpes koï, papillons, hirondelles) sont modélisés et animés dans
`src/world/gardenlife.js`.
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
