import { RESTAURANTS, dishItems } from './food.js';

// Catalogue des biens vendus à bord de Halden-7. Prix en crédits (¤).
// Les noms de marques et de modèles sont inventés pour ce projet.

export const CATEGORIES = {
  sidearm: 'Arme de poing',
  primary: 'Arme principale',
  outfit: 'Tenue',
  armor: 'Armure',
  shipWeapon: 'Arme de vaisseau',
  mining: 'Module de minage',
  turret: 'Tourelle',
  shield: 'Bouclier',
  consumable: 'Consommable',
  food: 'À la carte',
};

const I = (id, cat, name, price, desc, extra = {}) => ({ id, cat, name, price, desc, ...extra });

export const ITEMS = [
  // ------------------------------------------------------------ armes personnelles
  I('ks9', 'sidearm', 'Pistolet KS-9 « Mistral »', 1150, 'Pistolet compact à impulsion. Fiable, léger, réglementaire en station.', { fire: { dmg: 18, rate: 4, range: 25, mag: 14, spread: 0.014, reload: 1.4 }, shape: 'pistol', accent: 0x6f86a8, stats: { Dégâts: 18, Cadence: '4 tirs/s', Portée: '25 m', Chargeur: 14 } }),
  I('rv44', 'sidearm', 'Revolver lourd RV-44', 1900, 'Six coups à forte charge. Recul marqué, arrêt garanti.', { fire: { dmg: 42, rate: 1.5, range: 35, mag: 6, spread: 0.008, reload: 2.2 }, shape: 'revolver', accent: 0x9a7a3a, stats: { Dégâts: 42, Cadence: '1,5 tir/s', Portée: '35 m', Chargeur: 6 } }),
  I('sm3', 'primary', 'Pistolet-mitrailleur SM-3 « Grêle »', 3200, 'Cadence élevée, idéal en coursive et à bord.', { fire: { dmg: 12, rate: 12, range: 30, mag: 45, spread: 0.028, reload: 1.8, auto: true }, shape: 'smg', accent: 0x5a8a5a, stats: { Dégâts: 12, Cadence: '12 tirs/s', Portée: '30 m', Chargeur: 45 } }),
  I('ac7', 'primary', 'Fusil d\'assaut AC-7 « Bourrasque »', 4800, 'Polyvalent, précis en rafale. Le choix des escortes.', { fire: { dmg: 24, rate: 8, range: 60, mag: 30, spread: 0.011, reload: 2.0, auto: true }, shape: 'rifle', accent: 0x7a7a3a, stats: { Dégâts: 24, Cadence: '8 tirs/s', Portée: '60 m', Chargeur: 30 } }),
  I('br2', 'primary', 'Fusil à pompe BR-2 « Bélier »', 3900, 'Dévastateur à courte portée, pour l\'abordage.', { fire: { dmg: 11, pellets: 8, rate: 1.2, range: 12, mag: 8, spread: 0.07, reload: 2.6 }, shape: 'shotgun', accent: 0x8a4a2a, stats: { Dégâts: '8 × 11', Cadence: '1,2 tir/s', Portée: '12 m', Chargeur: 8 } }),
  I('lr12', 'primary', 'Fusil de précision LR-12 « Héliotrope »', 9600, 'Lunette ×8, canon flottant. Pour ceux qui tirent une seule fois.', { fire: { dmg: 110, rate: 0.8, range: 250, mag: 5, spread: 0.002, reload: 2.8 }, shape: 'sniper', accent: 0x4a5a7a, stats: { Dégâts: 110, Cadence: '0,8 tir/s', Portée: '250 m', Chargeur: 5 } }),

  // ------------------------------------------------------------ tenues
  I('o_flight', 'outfit', 'Combinaison de vol Ardoise', 0, 'Combinaison de pilote standard, fournie avec la licence.', { outfit: { top: 0x2b3036, bottom: 0x2b3036, boot: 0x16181a, accent: 0x6f86a8, gloves: true, zip: false } }),
  I('o_work', 'outfit', 'Combinaison de travail Haute-Visibilité', 320, 'Tissu ignifugé, bandes réfléchissantes. Pour la soute et le pont.', { outfit: { top: 0x5d6168, bottom: 0x3a3d42, boot: 0x2a2016, accent: 0xe8762a, hivis: true, gloves: true } }),
  I('o_city', 'outfit', 'Tenue de ville Ocre', 650, 'Veste courte, pantalon droit. Pour la galerie et les rendez-vous.', { outfit: { top: 0x6a4a32, bottom: 0x2a2c30, boot: 0x1a1410, accent: 0xc8b48a, zip: true, belt: true } }),
  I('o_sand', 'outfit', 'Tenue d\'explorateur Sable', 980, 'Respirante, renforcée aux genoux. Faite pour les surfaces.', { outfit: { top: 0xa89470, bottom: 0x7a6a4c, boot: 0x3a2a1a, accent: 0x4a5a3a, gloves: true, belt: true } }),
  I('o_navy', 'outfit', 'Combinaison de vol Marine', 1200, 'Coupe ajustée, liserés bleus. Les pilotes de convoi l\'adorent.', { outfit: { top: 0x1a2436, bottom: 0x1a2436, boot: 0x101216, accent: 0x3e8ad8, gloves: true, zip: true } }),
  I('o_black', 'outfit', 'Tenue tactique Charbon', 1450, 'Tissu anti-abrasion, poches de cuisse. Discrète.', { outfit: { top: 0x1c1e20, bottom: 0x24262a, boot: 0x0e0f10, accent: 0x6a6a5a, gloves: true, belt: true } }),

  // ------------------------------------------------------------ armures
  I('a_light', 'armor', 'Armure légère « Pavois »', 2400, 'Plastron et protections d\'avant-bras. Ne gêne pas les mouvements.', { prot: 0.2, armor: { tier: 1, plate: 0x4a5058, under: 0x1b1e21, accent: 0x6e6a3a, light: 0x5fe6c8 }, stats: { Protection: '20 %', Mobilité: 'Élevée' } }),
  I('a_med', 'armor', 'Armure moyenne « Rempart »', 5600, 'Épaulières, cuissardes et plastron renforcé.', { prot: 0.4, armor: { tier: 2, plate: 0x3a4148, under: 0x1b1e21, accent: 0x7a7a3a, light: 0x5fe6c8 }, stats: { Protection: '40 %', Mobilité: 'Moyenne' } }),
  I('a_heavy', 'armor', 'Armure lourde « Bastion »', 11800, 'Protection intégrale et sac de survie. Pour l\'escorte armée.', { prot: 0.65, armor: { tier: 3, plate: 0x2f3236, under: 0x16181a, accent: 0x8a5a2a, light: 0xffa040 }, stats: { Protection: '65 %', Mobilité: 'Réduite' } }),
  I('a_med_w', 'armor', 'Armure moyenne « Rempart » blanche', 6100, 'Même protection, finition céramique blanche.', { prot: 0.4, armor: { tier: 2, plate: 0xc8ccd0, under: 0x2a2e32, accent: 0x3e6a9a, light: 0x6fb8ff }, stats: { Protection: '40 %', Mobilité: 'Moyenne' } }),

  // ------------------------------------------------------------ vaisseau
  I('l1', 'shipWeapon', 'Canon laser L1 « Aiguille »', 6200, 'Arme à énergie de taille 1. Pas de munitions, chauffe vite.', { size: 1, gun: 'laser', dps: 210, stats: { Taille: 1, 'Dégâts/s': 210, Portée: '1,6 km', Munitions: 'énergie' } }),
  I('l2', 'shipWeapon', 'Canon laser L2 « Lance »', 14500, 'Laser de taille 2 à haute cadence.', { size: 2, gun: 'laser', dps: 390, stats: { Taille: 2, 'Dégâts/s': 390, Portée: '1,8 km', Munitions: 'énergie' } }),
  I('b2', 'shipWeapon', 'Canon balistique B2 « Marteau »', 17800, 'Obus perforants, traverse les boucliers.', { size: 2, gun: 'ballistic', dps: 460, stats: { Taille: 2, 'Dégâts/s': 460, Portée: '1,4 km', Munitions: 600 } }),
  I('m2', 'shipWeapon', 'Lance-missiles M2 « Essaim »', 21000, 'Quatre missiles à guidage thermique.', { size: 2, gun: 'missile', dmg: 1800, stats: { Taille: 2, Missiles: 4, 'Dégâts/missile': 1800, Verrouillage: '3 s' } }),
  I('tur2', 'turret', 'Tourelle dorsale « Vigie »', 26000, 'Tourelle double télé-opérée. Nécessite un artilleur.', { gun: 'turret', stats: { Canons: '2 × taille 1', Rotation: '360°', Équipage: 1 } }),
  I('ml1', 'mining', 'Laser de minage ML-1 « Pic »', 9500, 'Tête de minage ventrale d\'entrée de gamme. Fenêtre de fracture étroite.', { power: 1.0, window: 1.0, stab: 1.0, extract: 1.0, stats: { Puissance: '1,0', 'Fenêtre optimale': 'standard', Extraction: '1,2 SCU/s' } }),
  I('ml2', 'mining', 'Laser de minage ML-2 « Foreuse »', 26000, 'Plus puissant, plus stable, fenêtre élargie. Pour les roches dures.', { power: 1.45, window: 1.35, stab: 0.65, extract: 1.6, stats: { Puissance: '1,45', 'Fenêtre optimale': '+35 %', Stabilité: '+35 %', Extraction: '1,9 SCU/s' } }),
  I('sh1', 'shield', 'Bouclier « Égide » S1', 0, 'Générateur d\'origine du Héron.', { cap: 2400, regen: 120, stats: { Capacité: 2400, Recharge: '120/s', Délai: '3 s' } }),
  I('sh2', 'shield', 'Bouclier « Égide » S2', 18000, 'Double capacité, recharge rapide.', { cap: 5200, regen: 260, stats: { Capacité: 5200, Recharge: '260/s', Délai: '2,5 s' } }),

  // ------------------------------------------------------------ consommables
  I('medpen', 'consumable', 'Stylo médical', 150, 'Injecteur d\'urgence : soigne et stabilise.', {}),
  I('medkit', 'consumable', 'Trousse de soins', 600, 'Soins complets, deux utilisations.', {}),
  I('ration', 'consumable', 'Ration de bord', 40, 'Plat lyophilisé longue conservation.', {}),
  I('noodles', 'consumable', 'Bol de nouilles', 18, 'Bouillon épicé, servi chaud.', { eat: true }),
];

ITEMS.push(...dishItems());
export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// Emplacements du Héron : position (repère local de l'aire), taille maximale et catégories admises
export const HERON_SLOTS = [
  { id: 'wingL', name: 'Aile bâbord', cats: ['shipWeapon'], size: 2 },
  { id: 'wingR', name: 'Aile tribord', cats: ['shipWeapon'], size: 2 },
  { id: 'chin', name: 'Menton', cats: ['shipWeapon'], size: 1 },
  { id: 'dorsal', name: 'Dos', cats: ['turret'], size: 0 },
  { id: 'shield', name: 'Bouclier', cats: ['shield'], size: 0 },
  { id: 'mining', name: 'Module de minage (ventral)', cats: ['mining'], size: 0 },
];

// Boutiques de la galerie : ce qu'elles vendent
export const STORES = {
  armes: { label: 'Armurerie Kestrel', name: 'ARMURERIE KESTREL', cats: ['sidearm', 'primary'], greet: 'Bienvenue chez Kestrel. Tout est homologué station, pas de tir dans la galerie.' },
  pieces: { label: 'Équipement naval', name: 'ÉQUIPEMENT NAVAL', cats: ['shipWeapon', 'turret', 'shield', 'mining'], greet: 'Armement et composants. On installe directement sur votre appareil à quai.' },
  combis: { label: 'Combinaisons Vega', name: 'COMBINAISONS VEGA', cats: ['outfit', 'armor'], greet: 'Essayez ce que vous voulez, la cabine est au fond.' },
  pharma: { label: 'Pharmacie', name: 'PHARMACIE', cats: ['consumable'], filter: (i) => ['medpen', 'medkit', 'ration'].includes(i.id), greet: 'Bonjour. Soins d\'urgence et vivres de bord.' },
  nouilles: { label: 'Nouilles Orbitales', name: 'NOUILLES ORBITALES', cats: ['consumable'], filter: (i) => i.id === 'noodles', greet: '« Un bol ? C\'est le meilleur bouillon de la station ! »' },
  ...Object.fromEntries(RESTAURANTS.map((r) => [r.id, { label: r.label, name: r.name, cats: ['food'], filter: (i) => i.stall === r.id, greet: r.greet }])),
};

// Minerais (prix au SCU : brut à la vente directe, raffiné après passage à la raffinerie)
export const ORES = {
  fer: { name: 'Fer', raw: 60, ref: 140, tint: 0x8a5a40, instab: 0.2, resist: 0.3, w: 30 },
  cuivre: { name: 'Cuivre', raw: 110, ref: 250, tint: 0xc8742a, instab: 0.3, resist: 0.38, w: 25 },
  titane: { name: 'Titane', raw: 190, ref: 420, tint: 0x8fb0c8, instab: 0.35, resist: 0.62, w: 22 },
  corindon: { name: 'Corindon', raw: 320, ref: 700, tint: 0xc83a4a, instab: 0.5, resist: 0.72, w: 15 },
  aurelite: { name: 'Aurélite', raw: 900, ref: 2000, tint: 0xf2d04a, instab: 0.85, resist: 0.5, w: 8 },
};
// Marchés des matériaux raffinés : coefficient par minerai (la raffinerie d'Ardent rachète au rabais)
export const MARKETS = {
  ardent: { name: 'Plateforme Ardent-3', tag: 'raffinerie, rachat au rabais', k: { fer: 0.85, cuivre: 0.85, titane: 0.85, corindon: 0.85, aurelite: 0.85 } },
  corvin: { name: 'Relais Corvin', tag: 'négoce : métaux de construction', k: { fer: 1.3, cuivre: 1.35, titane: 1.1, corindon: 0.95, aurelite: 1.0 } },
  lys: { name: 'Station agricole Lys', tag: 'coopérative : alliages et électronique', k: { fer: 1.0, cuivre: 1.1, titane: 1.3, corindon: 1.35, aurelite: 1.4 } },
};

export const REFINE = [
  { id: 'fast', name: 'Rapide', time: 60, yield: 0.7, fee: 0.05, desc: '1 min · rendement 70 %' },
  { id: 'std', name: 'Standard', time: 180, yield: 0.85, fee: 0.08, desc: '3 min · rendement 85 %' },
  { id: 'fine', name: 'Précis', time: 420, yield: 0.95, fee: 0.12, desc: '7 min · rendement 95 %' },
];
