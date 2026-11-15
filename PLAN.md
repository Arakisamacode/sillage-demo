# SILLAGE — Hangar orbital : plan de production

Démo jouable navigateur (Three.js + Vite) : un hangar d'atterrissage de station orbitale,
un sas, une galerie marchande, une baie vitrée sur une planète. Univers original
(station « Halden-7 », compagnie « Sillage Orbital Logistics ») — aucun nom, logo ou
élément issu d'un jeu existant.

## 1. Ressources (toutes CC0 / domaine public ou créées pour le projet)

Contrainte de l'environnement de dev : seuls npm et les dépôts GitHub publics sont
joignables (polyhaven.com, ambientcg.com et quaternius.com sont bloqués par le proxy).
Les ressources sont donc récupérées depuis des miroirs fidèles, licence vérifiée :

| Ressource | Source | Licence |
|---|---|---|
| HDRI `empty_warehouse_01`, `st_fagans_interior` (512 px, EXR DWAB) | Poly Haven, via le paquet npm `@pmndrs/assets` | CC0 |
| Personnages modulaires (hommes / femmes : ouvrier, combinaison spatiale, costume, sécurité…) | Quaternius « Ultimate Modular Men / Women », via le miroir `trebeljahr/quaternius-showcase` | CC0 |
| Animations squelettiques (marche, course, repos, discussion, assis, réparation, interaction, pousser, conduire…) | Quaternius « Universal Animation Library (Standard) », via `J-Ponzo/gltf-universal-animation-library` | CC0 |
| Textures PBR scannées (béton, métal peint rouillé, plâtre sale, asphalte) | ambientCG, via le miroir `itz019/tls-textures` | CC0 |
| Textures procédurales (tôles, marquages au sol, traces de pneus, carburant, grilles, signalétique, pictogrammes) | générées par `tools/gen_textures.py` (ce dépôt) | CC0 (création) |
| Planète, ciel étoilé, faisceaux, étincelles | shaders écrits pour le projet | CC0 (création) |
| Vaisseaux, chariots, nacelle, tracteur, caisses, passerelles | modélisés en code (géométrie procédurale) | CC0 (création) |
| Sons et musique | synthèse Web Audio temps réel (aucun fichier) ; annonces : Web Speech API | création |

Les animations UAL sont reciblées à l'exécution sur le squelette Quaternius
(rotation monde relative à la pose de repos + mise à l'échelle des hanches).

## 2. Organisation du code

```
index.html            HUD, écran de démarrage, manettes tactiles
src/main.js           boot, chargement, boucle
src/core/             renderer, post-process, qualité, input, horloge
src/world/            hangar, galerie, sas, planète, vaisseaux, props, signalétique, matériaux
src/player/           contrôleur capsule (three-mesh-bvh), caméra 1re / 3e personne
src/ai/               graphe de navigation, emploi du temps, agents, évitement, scènes de travail
src/characters/       chargement, reciblage d'animations, machine à états
src/vehicles/         chariot élévateur, tracteur + remorque
src/audio/            ambiance, annonces, pas, outils, murmures, musique générative
tools/                génération de textures, captures d'écran (Playwright)
public/               assets
```

## 3. Étapes

1. Échafaudage Vite, pipeline d'assets, rendu de base (ACES, HDRI, ombres, AO, bloom).
2. Coque du hangar + baie vitrée + planète + éclairage. Captures, critique, correction.
3. Densité : passerelles, gaines, tuyaux, caisses, outils, écrans, marquages, usure, câbles,
   panneaux ouverts, vaisseaux. Captures, critique, correction.
4. Sas + galerie marchande (boutiques, enseignes néon, bancs, machine à café). Captures.
5. Joueur : 1re/3e personne, collisions, rampe du vaisseau, tactile, réglage de qualité.
6. Vie : personnages, emplois du temps, navigation, évitement, regards, scènes de travail
   (ravitaillement, soudure, chariot élévateur, tracteur).
7. Son.
8. Optimisation mobile, documentation, mise en ligne.
