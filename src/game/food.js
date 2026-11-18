// Cour des Saveurs : les dix restaurants du pont habitat (noms inventés pour ce projet), leurs horaires et leurs cartes.
// icon : forme de la vignette (bol, assiette, tasse, pain, taco, pizza, burger, sushi).

export const RESTAURANTS = [
  { id: 'fc_jade', name: 'DRAGON DE JADE', label: 'Dragon de Jade', cuisine: 'chinois', color: '#ff4a3a', wall: 0x7a1a16, accent: 0xd9a21b, hours: [11, 24],
    greet: '« Bienvenue ! Les raviolis sortent du panier vapeur. »', cook: 'Lin',
    dishes: [['Raviolis vapeur (6)', 14, 'bowl'], ['Canard laqué, riz sauté', 26, 'plate'], ['Nouilles sautées au bœuf', 19, 'bowl'], ['Thé au jasmin', 5, 'cup']] },
  { id: 'fc_sol', name: 'CANTINA SOL', label: 'Cantina Sol', cuisine: 'mexicain', color: '#3ae0c8', wall: 0x1e6a6a, accent: 0xe8762a, hours: [11, 23],
    greet: '« ¡Hola! Le chili est maison, la salsa aussi. »', cook: 'Inés',
    dishes: [['Burrito haricots et riz', 16, 'taco'], ['Chili con carne', 18, 'bowl'], ['Nachos guacamole', 12, 'plate'], ['Horchata glacée', 6, 'cup']] },
  { id: 'fc_fournil', name: "FOURNIL D'ORBITE", label: "Fournil d'Orbite", cuisine: 'boulangerie', color: '#ffd27a', wall: 0x8a6a42, accent: 0xf2e6c8, hours: [6, 19],
    greet: '« Pain chaud toutes les heures, croissants pur beurre ! »', cook: 'Maël',
    dishes: [['Croissant pur beurre', 4, 'bread'], ['Baguette tradition', 3, 'bread'], ['Pain au chocolat', 4, 'bread'], ['Tartelette aux fruits', 7, 'plate']] },
  { id: 'fc_cometa', name: 'TAQUERIA COMETA', label: 'Taqueria Cometa', cuisine: 'tacos', color: '#ffb000', wall: 0x8a5a10, accent: 0xc83a2a, hours: [12, 26],
    greet: '« Al pastor direct de la broche, avec ananas grillé. »', cook: 'Rafa',
    dishes: [['Tacos al pastor (3)', 15, 'taco'], ['Tacos carnitas (3)', 15, 'taco'], ['Quesadilla au fromage', 11, 'taco'], ['Limonade citron vert', 5, 'cup']] },
  { id: 'fc_masala', name: 'MASALA STATION', label: 'Masala Station', cuisine: 'indien', color: '#ff7a1a', wall: 0x8a3a10, accent: 0xc83a8a, hours: [11, 23],
    greet: '« Le tandoor est chaud, le naan aussi. »', cook: 'Priya',
    dishes: [['Poulet tikka masala, riz basmati', 22, 'plate'], ['Dal aux lentilles', 13, 'bowl'], ['Naan au fromage', 6, 'bread'], ['Lassi mangue', 6, 'cup']] },
  { id: 'fc_sushi', name: 'SUSHI ORBITAL', label: 'Sushi Orbital', cuisine: 'sushi', color: '#ff6a8a', wall: 0x2a2c30, accent: 0xf2f2ee, hours: [11, 22],
    greet: '« Arrivage d\'hydroponie ce matin. Installez-vous. »', cook: 'Kenji',
    dishes: [['Plateau de makis (12)', 21, 'sushi'], ['Sashimi de saumon d\'élevage', 24, 'sushi'], ['Soupe miso', 6, 'bowl'], ['Thé vert', 4, 'cup']] },
  { id: 'fc_grill', name: 'GRILL 66', label: 'Grill 66', cuisine: 'burgers', color: '#ff3a3a', wall: 0x5a1a1a, accent: 0xf2f2ee, hours: [10, 25],
    greet: '« Steak smashé, frites fraîches, à toute heure du cycle. »', cook: 'Dex',
    dishes: [['Burger double cheddar', 17, 'burger'], ['Burger végétal', 16, 'burger'], ['Frites maison', 6, 'plate'], ['Milkshake vanille', 7, 'cup']] },
  { id: 'fc_vesuvio', name: 'PIZZERIA VESUVIO', label: 'Pizzeria Vesuvio', cuisine: 'pizzeria', color: '#7dff6a', wall: 0x2a4a22, accent: 0xc83a2a, hours: [11, 24],
    greet: '« Four à bois… enfin, à plasma. Mais la pâte, elle, est vraie ! »', cook: 'Paola',
    dishes: [['Pizza margherita', 16, 'pizza'], ['Pizza quatre fromages', 19, 'pizza'], ['Calzone', 18, 'pizza'], ['Tiramisu', 8, 'plate']] },
  { id: 'fc_nebula', name: 'CAFÉ NÉBULA', label: 'Café Nébula', cuisine: 'café', color: '#c8a0ff', wall: 0x4a3226, accent: 0xd8b48a, hours: [6, 22],
    greet: '« Un expresso ? Les grains viennent de la serre de Lys. »', cook: 'Alba',
    dishes: [['Expresso', 3, 'cup'], ['Cappuccino', 5, 'cup'], ['Part de gâteau au chocolat', 7, 'plate'], ['Cookie aux noix', 3, 'bread']] },
  { id: 'fc_pho', name: 'PHỞ LUNE ROUSSE', label: 'Phở Lune Rousse', cuisine: 'vietnamien', color: '#ffe066', wall: 0x2a5a3a, accent: 0xe8c23a, hours: [7, 22],
    greet: '« Bouillon mijoté douze heures. Herbes fraîches à volonté. »', cook: 'Minh',
    dishes: [['Phở bœuf', 17, 'bowl'], ['Bò bún', 16, 'bowl'], ['Rouleaux de printemps (4)', 9, 'plate'], ['Café glacé au lait', 5, 'cup']] },
];

/** Grand Dôme : glacier et snack de la place aux lampions. */
export const GARDEN_SHOPS = [
  { id: 'dome_glace', name: 'GLACES DU DÔME', label: 'Glacier du Dôme', cuisine: 'glacier', hours: [9, 22], cook: 'Nell',
    greet: '« Six parfums aujourd\'hui ! La fraise de Lys est arrivée ce matin. »',
    dishes: [['Cornet deux boules vanille-fraise', 4, 'icecream'], ['Coupe chocolat-pistache', 6, 'icecream'], ['Sorbet citron de serre', 4, 'icecream'], ['Milkshake myrtille', 5, 'cup']] },
  { id: 'dome_snack', name: 'SNACK DU DÔME', label: 'Snack du Dôme', cuisine: 'snack', hours: [8, 22], cook: 'Bastien',
    greet: '« Crêpes, gaufres, hot-dogs : tout est fait minute. »',
    dishes: [['Crêpe sucre-citron', 5, 'crepe'], ['Hot-dog moutarde douce', 7, 'bread'], ['Gaufre au sucre glace', 5, 'crepe'], ['Limonade de Lys', 3, 'cup']] },
];
/** Articles de catalogue pour les plats (catégorie « food »). */
export function dishItems() {
  const out = [];
  for (const r of [...RESTAURANTS, ...GARDEN_SHOPS]) r.dishes.forEach(([name, price, icon], i) => out.push({
    id: `${r.id}_${i}`, cat: 'food', name, price, desc: `${r.label} · ${r.cuisine}`, eat: true, icon, stall: r.id, heal: Math.min(25, 5 + price),
  }));
  return out;
}
