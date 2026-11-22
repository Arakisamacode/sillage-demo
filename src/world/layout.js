// Plan général (mètres, Y vers le haut). Le hangar s'ouvre vers -Z (baie sur la planète).
export const HX = 32;          // demi-largeur du hangar
export const Z_BAY = -45;      // façade vitrée / porte spatiale
export const Z_BACK = 30;      // mur du fond
export const H = 24;           // hauteur sous plafond
export const CAT_Y = 8;        // niveau des passerelles
export const COLS = [-45, -37, -29, -21, -13, -5, 3, 11, 19, 27, 30];

// Sas : dans le mur ouest, débouche sur la galerie marchande
export const AIRLOCK = { z: -2, w: 4.2, h: 4.2, x0: -32, x1: -42 };
// Sas 3 : dans le mur est, vers le tube d'abordage de la frégate Atalante amarrée le long de la station
export const SHIPLOCK = { z: -9, w: 4.2, h: 4.2 };
export const GALLERY = { x0: -102, x1: -42, z0: -24, z1: 10, h: 10 };

export const PADS = {
  p2: { name: 'AIRE 02', x: -10, z: -13, r: 13, heading: 0 },  // vaisseau du joueur
  p3: { name: 'AIRE 03', x: 13.5, z: -14, r: 14, heading: 0 }, // gros cargo
  p4: { name: 'AIRE 04', x: 12, z: 18, r: 9, heading: Math.PI / 2 }, // chasseur en maintenance
  p5: { name: 'AIRE 05', x: -14, z: 14, r: 10, heading: Math.PI * 0.5 }, // navette passagers
};

export const STORAGE = { x: 26, z: 22 }; // zone de stockage des conteneurs (fond est)
