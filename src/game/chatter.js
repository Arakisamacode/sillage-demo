// Conversations avec tous les habitants (touche E près de quelqu'un) : répliques selon le métier, le tempérament
// (aimable, pressé, méfiant) et l'avancement du récit ; rumeurs qui orientent vers les quêtes.

const pick = (a, k) => a[Math.abs(k) % a.length];
const R = (a) => a[Math.floor(Math.random() * a.length)];

const MOODS = ['aimable', 'pressé', 'méfiant', 'aimable', 'bavard'];
const HELLO = {
  aimable: ['Bonjour ! Je peux vous aider ?', 'Tiens, un nouveau visage. Bienvenue.', 'Belle journée sur la station, non ?'],
  pressé: ['Faites vite, j\'ai du travail.', 'Oui ? Je n\'ai qu\'une minute.', 'C\'est pour quoi ? Je suis en retard.'],
  méfiant: ['On se connaît ?', 'Vous voulez quoi, exactement ?', '… Oui ?'],
  bavard: ['Ah, enfin quelqu\'un à qui parler ! Vous savez ce qu\'on raconte ?', 'Vous tombez bien, je m\'ennuyais à mourir.', 'Asseyez-vous… enfin, restez debout, mais écoutez ça.'],
};

const JOBS = {
  commerçant: (p) => `Je tiens ${p.shop || 'une boutique de la galerie'}. Les affaires vont… comme la station : doucement. Passez voir mes étagères, il y a ce qu'il vous faut.`,
  barista: () => 'Je fais le meilleur café de la galerie. Enfin, le seul. Les pilotes en boivent trois avant chaque départ.',
  client: () => R(['Je fais mes courses avant la navette. Les prix ont encore grimpé.', 'J\'attends ma sœur, elle travaille à l\'armurerie.', 'Je regarde. Juste je regarde.']),
  sécurité: () => 'Sécurité de la station. Port d\'arme interdit dans la galerie, sauf alerte. Si vous voyez quelque chose de louche au hangar, signalez-le.',
  mécanicien: () => 'Je répare ce que les pilotes cassent. Votre Héron, d\'ailleurs, a un amortisseur qui grince. Rien de grave… pour l\'instant.',
  soudeur: () => 'Je ressoude les coques. Les impacts de laser, ça se reconnaît : les pirates se rapprochent de nos routes.',
  manutentionnaire: () => 'Caisses, conteneurs, caisses. Si vous prenez un contrat de fret, c\'est moi qui charge votre soute.',
  cariste: () => 'Je conduis le chariot du quai. Faites attention à vos pieds, je ne freine pas pour les touristes.',
  tractoriste: () => 'Je remorque les vaisseaux vers les aires. Le vôtre est sur la deux, c\'est ça ?',
  ravitailleur: () => 'Carburant et fluides. Le plein du Héron ? Déjà fait, c\'est compris dans le droit de quai.',
  pilote: () => 'Pilote de convoi. Je fais Halden–Corvin trois fois par semaine. De plus en plus d\'escortes, de moins en moins de marge.',
  copilote: () => 'Copilote. Le capitaine dort, moi je vérifie les listes. Toujours les listes.',
  entretien: () => 'Entretien de la station. Les filtres, les sols, les toilettes du pont deux. Personne ne me remarque, et c\'est très bien.',
  voyageur: () => R(['J\'arrive de Lys pour un entretien d\'embauche. Souhaitez-moi bonne chance.', 'Je repars vers Corvin ce soir. Halden, c\'est joli, mais c\'est cher.', 'Je rends visite à mes parents. Ils refusent de quitter la station, allez savoir pourquoi.']),
  cuisinier: (p) => `Je suis en cuisine chez ${p.resto || 'un des restaurants'}. Goûtez notre ${p.dish || 'plat du jour'}, vous m'en direz des nouvelles.`,
  'client · cour': () => R(['Je déjeune entre deux services. La cuisine de la Cour, c\'est ce qu\'il y a de mieux ici.', 'Je mange vite, je reprends au quai dans vingt minutes.', 'On vient ici tous les jeudis avec l\'équipe.']),
  résident: () => R(['J\'habite le pont habitat depuis vingt ans. Cabine onze, juste à côté de la vôtre.', 'Je travaillais aux chantiers navals. Maintenant je regarde la planète par la baie.', 'Je fais ma promenade. Le docteur dit que c\'est bon pour le cœur.']),
  couronne: () => R(['Je suis ici pour la présentation d\'Aérodyne. Entre nous, la Série 8 était plus élégante.', 'La Maison Élysée m\'a promis une veste pour ce soir. J\'espère qu\'ils tiendront parole.', 'Vous êtes… pilote ? Comme c\'est pittoresque.']),
  personnel: () => 'Je travaille à La Couronne. Discrétion, sourire, et jamais de questions sur les clients.',
};

const RUMORS = [
  'Il paraît que Joss, le barman de La Comète, cherche quelqu\'un pour lui rapporter une bouteille d\'Ardent.',
  'Le Dr Salek manque de sérum. La coopérative de Lys en produit, mais personne ne veut faire le trajet.',
  'Une femme parle d\'équations devant une sphère lumineuse, à La Couronne. Certains disent qu\'elle a toujours raison.',
  'Les Fils de la Brèche ont attaqué un convoi près d\'Ardent la semaine dernière.',
  'La Pizzeria Vesuvio offre le tiramisu pour deux pizzas, mais seulement si vous le demandez gentiment.',
  'Les ascenseurs panoramiques de La Couronne ont coûté plus cher qu\'un Mulet neuf.',
  'Corvin paie bien le cuivre, ces temps-ci. Lys rachète le titane.',
];

/**
 * person : { name, role (clé de JOBS), female, key, shop?, resto?, dish? } ; story : récit (état, réputation) ; game.
 */
export function peopleTree(person, { story, game, toast }) {
  const k = person.key || 1, mood = pick(MOODS, k * 7 + 3);
  const job = (JOBS[person.role] || JOBS.résident)(person);
  const s = story.s, rep = story.rep;
  const opinion = () => {
    if (s.step >= 4 && s.choice === 'public') return R(['Depuis qu\'on a publié la courbe de Solvay, tout le monde parle de l\'avenir. Mon voisin s\'est remis à cultiver des plants dans sa cabine. Ça fait sourire, mais ça fait du bien.', 'La courbe ? J\'ai eu peur, au début. Maintenant je fais partie du comité de quartier. On s\'organise.']);
    if (s.step >= 4 && s.choice === 'council') return R(['Le Conseil a ouvert de nouvelles routes de ravitaillement. Personne ne sait pourquoi, mais les prix baissent. Je ne vais pas me plaindre.', 'Il se passe quelque chose au Conseil. Des réunions la nuit, des cargos supplémentaires. On n\'explique jamais rien aux gens d\'en bas.']);
    if (rep.halden >= 3) return 'Vous êtes le pilote dont tout le monde parle, non ? Halden a besoin de gens comme vous.';
    return R(['Halden, c\'est chez moi. Même quand ça grince, même quand ça fuit.', 'La station vieillit. Nous aussi. Mais on tient.', 'Avant, il y avait les chantiers. Maintenant il y a… nous. Ça devra suffire.']);
  };
  const hello = person.role === 'couronne' && rep.halden < 2 ? 'Oui ? Vous cherchez la sortie de service ?' : pick(HELLO[mood], k);
  return {
    start: {
      say: hello,
      choices: [
        { t: 'Que faites-vous ici ?', tone: 'enquete', next: 'job' },
        { t: 'Des nouvelles intéressantes ?', tone: 'enquete', next: 'rumor' },
        { t: 'Comment va la vie à Halden ?', tone: 'neutre', next: 'opinion' },
        { t: 'Bonne journée à vous.', tone: 'calme', next: null, do: () => { if (mood === 'méfiant') return `${person.name} vous rend un hochement de tête prudent.`; } },
        { t: 'Rien. Laissez-moi passer.', tone: 'ferme', next: 'rude' },
      ],
    },
    job: { say: job, choices: [{ t: 'Autre chose…', tone: 'neutre', next: 'start2' }, { t: 'Merci, au revoir.', tone: 'calme', next: null }] },
    rumor: { say: () => (mood === 'méfiant' && rep.audace < 2 ? 'Des rumeurs ? Je ne parle pas aux inconnus. Revenez quand on parlera de vous en bien.' : R(RUMORS)), choices: [{ t: 'Autre chose…', tone: 'neutre', next: 'start2' }, { t: 'Intéressant. Merci.', tone: 'calme', next: null }] },
    opinion: { say: opinion, choices: [{ t: 'Autre chose…', tone: 'neutre', next: 'start2' }, { t: 'Courage à vous.', tone: 'calme', next: null }] },
    rude: { say: mood === 'méfiant' ? 'Je ne vous retiens pas.' : mood === 'pressé' ? 'Ça tombe bien, moi non plus je n\'ai pas le temps.' : '… Charmant. Bonne journée quand même.', choices: [{ t: '[Partir]', tone: 'neutre', next: null }] },
    start2: { say: pick(['Oui ?', 'Je vous écoute.', 'Autre chose ?'], k), choices: [
      { t: 'Que faites-vous ici ?', tone: 'enquete', next: 'job' },
      { t: 'Des nouvelles intéressantes ?', tone: 'enquete', next: 'rumor' },
      { t: 'Comment va la vie à Halden ?', tone: 'neutre', next: 'opinion' },
      { t: 'Au revoir.', tone: 'calme', next: null },
    ] },
  };
}
