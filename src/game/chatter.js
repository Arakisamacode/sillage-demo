// Conversations avec tous les habitants (touche E près de quelqu'un).
// Chaque personne a : un tempérament (aimable, pressé, méfiant, bavard), dix répliques propres à son métier,
// une histoire personnelle tirée au sort mais stable (origine, situation, rêve, inquiétude, anecdote),
// des rumeurs qui orientent vers les quêtes et un avis sur la station qui suit vos choix.
// Les répliques déjà dites ne se répètent pas tant que les autres n'ont pas été entendues.

const R = (a) => a[Math.floor(Math.random() * a.length)];
const hash = (k, salt) => { const h = (k * 2654435761 + salt * 40503) >>> 0; return (h ^ (h >>> 15)) >>> 0; };
const pickK = (a, k, salt) => a[hash(k, salt) % a.length];

const MOODS = ['aimable', 'pressé', 'méfiant', 'aimable', 'bavard'];
const HELLO = {
  aimable: ['Bonjour ! Je peux vous aider ?', 'Tiens, un nouveau visage. Bienvenue.', 'Belle journée sur la station, non ?', 'Ah, bonjour ! Vous êtes le pilote du Héron, je crois ?'],
  pressé: ['Faites vite, j\'ai du travail.', 'Oui ? Je n\'ai qu\'une minute.', 'C\'est pour quoi ? Je suis en retard.', 'Deux minutes, pas plus, d\'accord ?'],
  méfiant: ['On se connaît ?', 'Vous voulez quoi, exactement ?', '… Oui ?', 'Vous travaillez pour qui, vous ?'],
  bavard: ['Ah, enfin quelqu\'un à qui parler ! Vous savez ce qu\'on raconte ?', 'Vous tombez bien, je m\'ennuyais à mourir.', 'Restez, restez ! J\'ai mille choses à vous dire.', 'Oh, de la compagnie ! Asseyez-vous… enfin, restez debout, mais écoutez.'],
};

// ------------------------------------------------------------------ dix répliques par métier
const JOBS = {
  commerçant: [
    'Je tiens {shop}. Les affaires vont comme la station : doucement, mais elles vont.',
    'Mes fournisseurs passent par Corvin. Quand un convoi est attaqué, mes étagères se vident en une semaine.',
    'Le matin, je fais l\'inventaire. L\'après-midi, je négocie. Le soir, je compte ce qu\'on m\'a volé.',
    'J\'ai repris la boutique de mon oncle. Il disait : « À Halden, on vend surtout de l\'espoir. »',
    'Les pilotes achètent vite et sans discuter. Les gens de La Couronne discutent tout et n\'achètent rien.',
    'Si vous cherchez quelque chose de précis, demandez. J\'ai souvent ce qu\'il faut dans la réserve.',
    'Le loyer de la galerie a encore augmenté. Le Conseil dit que c\'est pour l\'entretien des baies.',
    'Mon meilleur client est un mineur d\'Ardent qui vient tous les mois. Il ne parle jamais, il paie en liquide.',
    'Je ferme à l\'heure pile. Ma fille m\'attend au pont habitat pour dîner.',
    'Vous savez ce qui se vend le mieux, ici ? Les choses qui rappellent une planète. Les gens ont le mal du sol.',
  ],
  barista: [
    'Je fais le meilleur café de la galerie. Enfin, le seul, mais ça compte quand même.',
    'Les pilotes en boivent trois avant chaque départ. Je pourrais deviner leur destination à leur commande.',
    'Le café vient des serres de Lys. Torréfié ici, dans un four qui n\'était pas prévu pour ça.',
    'Je me lève à cinq heures, station. Le premier convoi part à six, et ils veulent tous leur double serré.',
    'J\'ai appris le métier sur un cargo. On faisait du café avec de l\'eau recyclée trois fois. Ici, c\'est le luxe.',
    'La machine fuit depuis deux semaines. J\'ai demandé une pièce à l\'équipement naval, ils ont ri.',
    'Le secret, c\'est la mousse. Personne ne croit qu\'on peut faire une belle mousse en gravité artificielle.',
    'Les agents de sécurité ne paient jamais. « Pour le service rendu », qu\'ils disent.',
    'J\'écoute beaucoup. Les gens racontent tout à quelqu\'un qui leur tend une tasse.',
    'Un jour j\'ouvrirai mon propre bar, avec une vraie fenêtre sur la planète.',
  ],
  client: [
    'Je fais mes courses avant la navette. Les prix ont encore grimpé.',
    'J\'attends ma sœur, elle travaille à l\'armurerie. Elle finit toujours en retard.',
    'Je regarde. Juste je regarde. C\'est gratuit, regarder ?',
    'Il me faut une combinaison neuve, la mienne a pris un coup de chalumeau au travail.',
    'J\'ai économisé six mois pour un pistolet. Mon père dit que c\'est une bêtise. Il a sûrement raison.',
    'La galerie, c\'est notre place du village. On s\'y croise tous, un jour ou l\'autre.',
    'Je viens pour la pharmacie. Mon petit a encore attrapé le rhume des filtres.',
    'Vous avez vu le prix des nouilles ? Dix-huit crédits le bol ! Quand j\'étais jeune, c\'était douze.',
    'Je repars à Corvin demain. Je voulais voir la baie panoramique une dernière fois.',
    'On dit qu\'il y a des soldes à l\'équipement naval. Je n\'ai même pas de vaisseau, mais j\'aime regarder.',
  ],
  sécurité: [
    'Sécurité de la station. Port d\'arme interdit dans la galerie, sauf alerte.',
    'Si vous voyez quelque chose de louche au hangar, signalez-le. Les intrusions ont triplé cette année.',
    'Douze heures de garde, quatre heures de sommeil. Le Conseil appelle ça des « effectifs optimisés ».',
    'Mon équipement a dix ans. Les pirates, eux, ont du matériel neuf. Je me demande qui les paie.',
    'Une rixe au bar La Comète hier soir. Deux convoyeurs et une histoire de dette. Classique.',
    'Avant, j\'étais dans la marine de convoi. J\'ai rangé mes armes de bord pour un badge et un horaire fixe.',
    'Le plus dur, ce n\'est pas les pirates. C\'est d\'expliquer aux familles pourquoi un convoi n\'arrive pas.',
    'La Couronne a sa propre sécurité privée. Mieux payée, mieux armée. Et nous, on garde les ascenseurs.',
    'Restez du bon côté de la loi, pilote, et on s\'entendra très bien.',
    'J\'ai une prime en attente pour un pirate abattu près d\'Ardent. Elle arrivera… un jour.',
  ],
  mécanicien: [
    'Je répare ce que les pilotes cassent. Votre Héron, d\'ailleurs, a un amortisseur qui grince.',
    'Un moteur, c\'est comme un chat : il faut l\'écouter avant qu\'il ne griffe.',
    'On manque de joints de pressurisation. J\'en fabrique avec des bouts de combinaisons usées.',
    'Le Faucon sur l\'aire quatre ? Le pilote l\'a posé sur un train rentré à moitié. Trois semaines de boulot.',
    'Les chantiers navals formaient les meilleurs mécaniciens du secteur. Maintenant c\'est moi qui forme les jeunes.',
    'Je dors parfois dans la soute d\'un cargo en réparation. C\'est plus calme que ma cabine.',
    'Si votre bouclier clignote en vol, ne paniquez pas. Ça veut juste dire qu\'il va lâcher.',
    'J\'ai un apprenti qui a peur du vide. Dans un hangar spatial. On travaille sur la question.',
    'Les pièces d\'origine viennent de chantiers fermés. On récupère sur les épaves, comme tout le monde.',
    'Quand vous partez en mission, ramenez-moi des pièces. Je paie mieux que la casse.',
  ],
  soudeur: [
    'Je ressoude les coques. Les impacts de laser se reconnaissent : bords vitrifiés, cœur fondu.',
    'Les pirates se rapprochent de nos routes. Je le vois aux dégâts sur les cargos qui rentrent.',
    'Mon chalumeau a vingt ans. Je l\'ai réparé plus souvent que les vaisseaux que je soude.',
    'Ne regardez jamais la flamme sans visière. J\'ai un collègue qui voit encore des étoiles en plein jour.',
    'Une bonne soudure, c\'est une soudure qu\'on ne remarque pas. Personne ne me remarque, donc je suis bon.',
    'J\'ai soudé la coque du Mulet après l\'attaque de l\'an dernier. Huit mètres de brèche. Huit.',
    'Les jeunes veulent tous piloter. Personne ne veut souder. Pourtant sans nous, ils voleraient dans des passoires.',
    'Je chante en travaillant. Le casque étouffe tout, alors je chante faux en toute tranquillité.',
    'Il paraît que la coupole de La Couronne a été soudée par des robots. Ça se voit : c\'est trop parfait.',
    'Ma pause, c\'est dans quarante minutes. Vous me retenez, mais je ne vais pas me plaindre.',
  ],
  manutentionnaire: [
    'Caisses, conteneurs, caisses. Si vous prenez un contrat de fret, c\'est moi qui charge votre soute.',
    'Les caisses de matériel médical, on les porte à deux. Les caisses de charges de forage, on les porte en priant.',
    'Mon dos me dit que j\'ai quarante ans. Mon badge dit que j\'en ai trente-deux.',
    'Le chariot élévateur tombe en panne un jour sur trois. Ces jours-là, c\'est nous le chariot.',
    'J\'ai vu passer des choses bizarres dans les caisses. Je ne pose jamais de questions. Règle numéro un.',
    'Le quai, c\'est le cœur de la station. Rien n\'entre et rien ne sort sans passer par nos mains.',
    'On nous paie à la caisse. Les contrats de collecte, ce sont mes préférés : je charge au retour.',
    'Il y a eu une alerte pirate pendant mon service, le mois dernier. Je me suis caché derrière les conteneurs.',
    'Je joue aux cartes avec l\'équipe après le service. Le cariste triche, tout le monde le sait.',
    'Un conseil : arrimez bien vos caisses. Une caisse qui glisse en vol, c\'est un projectile.',
  ],
  cariste: [
    'Je conduis le chariot du quai. Faites attention à vos pieds, je ne freine pas pour les touristes.',
    'Ce chariot a plus d\'heures de vol que certains pilotes. Enfin, d\'heures de roulage.',
    'J\'ai le record du quai : quarante conteneurs en un service. Personne ne l\'a battu.',
    'La batterie tient six heures. Mon service en dure huit. Faites le calcul.',
    'Le tractoriste et moi, on se dispute la priorité depuis dix ans. C\'est notre façon d\'être amis.',
    'Je triche aux cartes ? Qui a dit ça ? Le manutentionnaire ? Il perd, voilà tout.',
    'Quand les navettes arrivent, c\'est la folie. Je zigzague entre les voyageurs.',
    'Mon rêve ? Piloter un vrai cargo. En attendant, je pilote celui-là, et il ne s\'envole pas.',
    'Le sol du hangar est glissant près de l\'aire cinq. Ça fait deux ans qu\'on le signale.',
    'Vous voulez essayer le chariot ? Non. Je plaisantais. Le règlement est très clair.',
  ],
  tractoriste: [
    'Je remorque les vaisseaux vers les aires. Le vôtre est sur la deux, c\'est ça ?',
    'Un vaisseau en remorque, c\'est un éléphant en laisse. Il faut lui parler doucement.',
    'Le Mulet pèse plus lourd que tout ce que j\'ai tracté. Le tracteur grince, moi aussi.',
    'Je vois tous les pilotes arriver. Certains embrassent le sol en sortant. Je ne juge pas.',
    'J\'ai failli rentrer dans le Faucon, une fois. Le pilote m\'a regardé comme si j\'avais tué son chien.',
    'Les aires sont numérotées depuis la baie. La deux, c\'est la meilleure : près du quai et des cafés.',
    'Le tracteur a été construit aux chantiers navals. Il a plus de cinquante ans et il démarre toujours.',
    'Je finis à vingt heures. Ensuite je vais voir la planète depuis la baie du pont habitat.',
    'On m\'a proposé un poste à Corvin. Mieux payé. Mais ici, c\'est chez moi.',
    'Faites attention en manœuvrant près de la baie. Le champ de confinement n\'aime pas qu\'on le frôle.',
  ],
  ravitailleur: [
    'Carburant et fluides. Le plein du Héron ? Déjà fait, c\'est compris dans le droit de quai.',
    'Je sens le carburant du matin au soir. Ma femme dit que je sens la fusée.',
    'Les réservoirs principaux sont sous le hangar. Si ça explose, on le saura tous en même temps.',
    'Le prix du carburant suit les convois. Pas de convoi, pas de carburant, pas de vol.',
    'Je vérifie chaque raccord deux fois. Mon prédécesseur ne le faisait qu\'une fois. On ne parle plus de lui.',
    'Le Mulet boit comme trois Hérons. Et il ne dit jamais merci.',
    'J\'ai vu des pilotes partir avec un réservoir à moitié vide pour gagner du temps. Ils ne gagnent pas toujours.',
    'Mon gamin veut devenir pilote. Je lui ai dit de commencer par apprendre à faire le plein.',
    'Les pirates volent surtout du carburant. Ça en dit long sur l\'état du secteur.',
    'Si vous partez loin, prenez un filtre de rechange. La poussière d\'Ardent bouche tout.',
  ],
  pilote: [
    'Pilote de convoi. Je fais Halden–Corvin trois fois par semaine.',
    'De plus en plus d\'escortes, de moins en moins de marge. Bientôt on paiera pour voler.',
    'La première fois qu\'on m\'a tiré dessus, j\'ai crié si fort que l\'ordinateur a cru à une alarme.',
    'Le secret du métier ? Toujours savoir où est la sortie. Dans un hangar, dans un bar, dans la vie.',
    'Mon copilote dort pendant que je parle aux gens. Équilibre parfait.',
    'J\'ai volé sur un Faucon dans la marine. Rapide, nerveux, impossible à garer.',
    'La ceinture d\'Ardent est belle, vue du cockpit. Belle et pleine de gens qui veulent votre cargaison.',
    'Je compte mes heures de vol comme d\'autres comptent leurs moutons.',
    'Votre Héron est solide. Moche, mais solide. Comme nous tous, ici.',
    'Si vous croisez un cargo sans transpondeur, ne jouez pas les héros. Ou alors visez bien.',
  ],
  copilote: [
    'Copilote. Le capitaine dort, moi je vérifie les listes. Toujours les listes.',
    'Liste de pré-vol, liste de chargement, liste de courses. J\'ai une liste pour mes listes.',
    'Un jour je serai capitaine. En attendant, je suis celui qui sait où sont les choses.',
    'Le capitaine ronfle en vol. J\'ai enregistré un ronflement à quatre-vingts décibels.',
    'J\'ai fait mes classes à Lys. Là-bas, on apprend à poser un cargo entre deux serres.',
    'Les instruments mentent parfois. Mon ventre, jamais.',
    'On dit que les copilotes sont les meilleurs pilotes : ils ont tout vu sans jamais toucher les commandes.',
    'Je collectionne les écussons des stations. J\'en ai quarante-deux. Celui de Halden est le plus moche.',
    'Le capitaine me fait confiance pour le café. C\'est déjà une responsabilité.',
    'Vous pilotez seul ? Courageux. Ou têtu. Souvent c\'est pareil.',
  ],
  entretien: [
    'Entretien de la station. Les filtres, les sols, les toilettes du pont deux.',
    'Personne ne me remarque, et c\'est très bien. On entend des choses quand on est invisible.',
    'Les filtres à air de la galerie n\'ont pas été changés depuis l\'été. Ne respirez pas trop fort.',
    'J\'ai trouvé une montre en or dans un conduit de La Couronne. Je l\'ai rendue. On m\'a remercié d\'un hochement de tête.',
    'Mon chariot de ménage a plus de roues que d\'amis. Enfin, il en a quatre.',
    'Le robot nettoyeur de la Cour des Saveurs me vole mon travail. Mais il ne sait pas vider les poubelles.',
    'Les coursives techniques sont un labyrinthe. Je pourrais vous faire traverser la station sans croiser personne.',
    'J\'ai vu les plans d\'origine de la station. Il y avait un théâtre, à l\'endroit de l\'armurerie.',
    'Le soir, je mets de la musique dans les conduits. Les résidents croient que la station chante.',
    'Un conseil : ne marchez jamais pieds nus près des recycleurs.',
  ],
  voyageur: [
    'J\'arrive de Lys pour un entretien d\'embauche. Souhaitez-moi bonne chance.',
    'Je repars vers Corvin ce soir. Halden, c\'est joli, mais c\'est cher.',
    'Je rends visite à mes parents. Ils refusent de quitter la station, allez savoir pourquoi.',
    'La navette avait deux heures de retard. Le café était froid, le siège cassé. Typique.',
    'Je fais le tour des stations du secteur. Halden est la plus vieille, et la plus attachante.',
    'Ma valise est restée sur Corvin. J\'ai une brosse à dents et beaucoup de patience.',
    'Je viens pour un mariage. Ma cousine épouse un mécanicien du hangar. Il sent l\'huile, mais il est gentil.',
    'On m\'a dit de voir la coupole de La Couronne. On m\'a aussi dit qu\'on n\'y laisse pas entrer n\'importe qui.',
    'Vous savez où est la Cour des Saveurs ? On m\'a parlé d\'un phở inoubliable.',
    'Je repars demain. Peut-être. Ça dépend des pirates.',
  ],
  cuisinier: [
    'Je suis en cuisine chez {resto}. Goûtez notre {dish}, vous m\'en direz des nouvelles.',
    'Le service de midi, c\'est la guerre. Trois cents couverts, deux feux qui marchent, un qui boude.',
    'Nos légumes viennent de Lys. Quand un convoi est attaqué, je change la carte en dix minutes.',
    'J\'ai appris la cuisine avec ma grand-mère, sur une planète dont plus personne ne se souvient du nom.',
    'Le secret d\'un bon bouillon, c\'est le temps. Et ici, le temps, on en manque.',
    'Le chef de la pizzeria d\'à côté me vole mes clients. Je lui vole ses fourchettes. Équilibre.',
    'Je goûte tout ce que je sers. C\'est pour ça que je ne rentre plus dans ma veste.',
    'Les gens de La Couronne descendent manger ici en cachette. La cuisine d\'en bas est meilleure.',
    'On ferme tard, on rouvre tôt. Entre les deux, je rêve de recettes.',
    'Un jour, j\'aurai un restaurant à La Couronne, avec une nappe blanche et une vue sur la planète.',
  ],
  'client · cour': [
    'Je déjeune entre deux services. La cuisine de la Cour, c\'est ce qu\'il y a de mieux ici.',
    'Je mange vite, je reprends au quai dans vingt minutes.',
    'On vient ici tous les jeudis avec l\'équipe. C\'est notre petit rituel.',
    'Goûtez les raviolis vapeur du Dragon de Jade. Ou ne les goûtez pas : il en restera plus pour moi.',
    'J\'ai essayé les dix restaurants. Le meilleur ? Celui où il y a de la place.',
    'Le robot nettoyeur m\'a volé mon plateau, la semaine dernière. Je n\'avais pas fini.',
    'Ma fille travaille au Grill 66. Elle me fait des frites en plus quand le chef ne regarde pas.',
    'Les tables près de la fontaine sont les meilleures. On entend l\'eau, on oublie le métal.',
    'Avant, il y avait une cantine grise à la place de la Cour. Ça, c\'est le progrès.',
    'Excusez-moi, je finis mon assiette. Ça refroidit vite en apesanteur… enfin, en gravité de station.',
  ],
  résident: [
    'J\'habite le pont habitat depuis vingt ans. Cabine onze, juste à côté de la vôtre.',
    'Je travaillais aux chantiers navals. Maintenant je regarde la planète par la baie.',
    'Je fais ma promenade. Le docteur dit que c\'est bon pour le cœur.',
    'Les cabines sont petites, mais la vue est la plus belle du secteur.',
    'Mes voisins font la fête tous les vendredis. Je m\'en plains, mais j\'y vais.',
    'Le bar La Comète, c\'est notre salon commun. Joss connaît tout le monde.',
    'J\'ai élevé trois enfants ici. Ils sont tous partis vers des stations plus jeunes.',
    'La nuit, quand le pont est éteint, on voit la station se refléter dans la baie.',
    'Mon grand-père a soudé la poutre maîtresse de ce pont. Je passe la main dessus en allant au travail.',
    'Il paraît que les loyers vont augmenter. Ils disent ça tous les ans.',
  ],
  couronne: [
    'Je suis ici pour la présentation d\'Aérodyne. Entre nous, la Série 8 était plus élégante.',
    'La Maison Élysée m\'a promis une veste pour ce soir. J\'espère qu\'ils tiendront parole.',
    'Vous êtes… pilote ? Comme c\'est pittoresque.',
    'Mon mari investit dans les serres de Lys. Moi j\'investis dans les combinaisons de Nova.',
    'La coupole ? On s\'y habitue. Comme à tout, d\'ailleurs. C\'est le drame des gens comme nous.',
    'Le champagne du Zénith vient de Lys. Il paraît que c\'est le dernier vignoble du secteur.',
    'On m\'a dit que la station déclinait. Les prix de l\'immobilier, en tout cas, sont délicieux.',
    'Je ne descends jamais en dessous du pont habitat. Il paraît que ça sent l\'huile.',
    'Vous avez vu le yacht ? Quarante-huit millions. Mon fils en voudrait deux.',
    'Si vous croisez la prévisionniste, dites-lui d\'arrêter de faire peur aux investisseurs.',
  ],
  personnel: [
    'Je travaille à La Couronne. Discrétion, sourire, et jamais de questions sur les clients.',
    'Les clients d\'ici laissent de gros pourboires… quand ils se souviennent qu\'on existe.',
    'J\'habite au pont habitat, comme tout le monde. Je monte ici en ascenseur et je redescends en soupirant.',
    'On polit la coupole chaque nuit. Trente personnes, quatre heures, sans un bruit.',
    'Un client a commandé un champagne à huit cents crédits. Il a bu deux gorgées et il est parti.',
    'Mon uniforme coûte plus cher que mon loyer. On n\'a pas le droit de le porter en bas.',
    'La conciergerie sait tout sur tout le monde. Moi, je sais tout sur la conciergerie.',
    'Certains soirs, quand le salon est vide, on regarde la planète ensemble. C\'est notre petit luxe.',
    'Je mets de côté pour ouvrir une boutique dans la galerie. Une vraie, à moi.',
    'Vous n\'avez rien vu, rien entendu, et vous allez passer une excellente soirée. Règle de la maison.',
  ],
  // ---------------------------------------------------------------- Grand Dôme
  enfant: [
    'On joue à chat ! C\'est Malo qui l\'est, mais il triche, il court trop vite.',
    'Le toboggan, il est super rapide quand on met les mains en l\'air. Essayez !',
    'J\'ai donné du pain aux canards. Le gros vert, il a tout mangé, les autres ont rien eu.',
    'Ma maman dit que le ciel du dôme, c\'est pas un vrai ciel. Moi je le trouve vrai quand même.',
    'Le mouton tout blanc, il s\'appelle Nuage. C\'est moi qui l\'ai appelé comme ça.',
    'Vous êtes un vrai pilote ? Avec un vrai vaisseau ? Vous avez déjà vu des pirates ?',
    'Quand je serai grande, je serai fermière. Ou pilote. Ou les deux, avec des poules dans le vaisseau.',
    'La glace à la fraise, c\'est la meilleure. La pistache, c\'est pour les grands.',
    'Il y a des poissons orange dans le bassin. J\'en ai compté huit. Ou neuf. Ils bougent tout le temps.',
    'Chut ! On fait une cabane derrière la colline. C\'est secret.',
  ],
  parent: [
    'Je viens ici tous les jours après l\'école. C\'est le seul endroit où les enfants peuvent courir sans croiser un chariot élévateur.',
    'Mon fils n\'a jamais vu de vrai ciel. Alors je l\'emmène sous celui-ci, en attendant.',
    'Les autres parents, on se connaît tous. Le banc de gauche, c\'est le nôtre, depuis trois ans.',
    'L\'entretien du dôme coûte une fortune. Chaque année, le Conseil menace de le fermer. Chaque année, on signe la pétition.',
    'Je surveille ma fille d\'un œil et mes messages de l\'autre. Le quai ne dort jamais.',
    'Quand j\'étais petit, il y avait trois fois plus d\'enfants ici. Il fallait faire la queue pour le toboggan.',
    'Le glacier est gentil, il fait des demi-boules pour les petits. Officiellement, ça n\'existe pas.',
    'On vient ici le dimanche, en famille. Pique-nique, canards, sieste sur la colline. Une vraie journée de planète.',
    'Faites attention à la bascule, elle pince les doigts. Je l\'ai signalé il y a six mois.',
    'Ma fille veut un mouton dans la cabine. J\'ai dit non. Elle a dessiné le mouton sur le mur. Il est très réussi.',
  ],
  promeneur: [
    'Je fais le tour du bassin chaque matin. Dix-huit tours, c\'est une lieue. Enfin, c\'est ce que je me dis.',
    'Ici, on respire. L\'air du dôme passe par les arbres avant d\'arriver dans nos poumons. Ça se sent.',
    'Je viens lire sur la colline. Le bruit de l\'eau couvre celui des ventilateurs.',
    'On s\'est rencontrés ici, ma femme et moi. Au bord du bassin, en nourrissant le même canard.',
    'Le ciel suit l\'horloge de la station. Le coucher de soleil, à vingt heures, ne ratez ça sous aucun prétexte.',
    'Les arbres ont plus de cent ans. Ils ont été plantés avec la station, avant même les chantiers.',
    'Je suis à la retraite. Quarante ans de soudure au hangar. Maintenant, je regarde pousser les tomates.',
    'Les jardiniers font des miracles avec trois fois rien. Les fleurs viennent de graines de Lys.',
    'Le soir, les lampions s\'allument sur la place. C\'est le plus bel endroit de Halden, et il est gratuit.',
    'Parfois, je ferme les yeux et j\'oublie qu\'il y a le vide de l\'autre côté de la vitre.',
  ],
  glacier: [
    'Six parfums par jour, pas un de plus. Le lait vient des chèvres de la ferme, la fraise de Lys.',
    'Je tiens ce chariot depuis quinze ans. Avant moi, c\'était mon père, et avant lui ma grand-mère.',
    'Le parfum préféré des enfants ? Chocolat. Des pilotes ? Citron. Ils disent que ça réveille.',
    'Le secret d\'une bonne glace en gravité artificielle : la turbine doit tourner lentement. Très lentement.',
    'Le chariot a été fabriqué dans un module de fret. Les roues, c\'est celles d\'un vieux tracteur de piste.',
    'En hiver de station — quand ils baissent le chauffage pour économiser — je vends des gaufres à la place.',
    'Une boule offerte aux enfants qui ont aidé à la ferme. C\'est la règle. Ils le savent tous.',
    'Mon parasol a été rapiécé onze fois. Je compte les reprises comme on compte les années.',
    'Les gens de La Couronne descendent parfois, incognito. Ils prennent toujours la pistache.',
    'Je ferme quand le ciel devient orange. C\'est le meilleur moment pour vendre, mais je veux le voir, moi aussi.',
  ],
  snack: [
    'Crêpes, gaufres, hot-dogs : tout est fait minute, sur la plaque. Rien de surgelé, promis.',
    'La pâte à crêpe repose toute la nuit. Les œufs viennent des poules de la ferme, juste à côté.',
    'Le kiosque, c\'est mon grand-père qui l\'a construit, avec les planches d\'une vieille caisse de semences.',
    'Le dimanche, je fais trois cents crêpes. Mon poignet le sait. Mon kiné aussi.',
    'La limonade de Lys, c\'est la vraie. Les citrons poussent dans leurs serres, on les reçoit par caisses.',
    'Les familles s\'installent aux tables sous les lampions. Le soir, c\'est comme une fête de village.',
    'Un pilote m\'a dit un jour que mes crêpes valaient le voyage depuis Corvin. Je l\'ai fait encadrer.',
    'Le hot-dog, c\'est de la protéine de culture, mais avec ma moutarde, personne ne fait la différence.',
    'Je donne les restes aux poules. Rien ne se perd au dôme, c\'est la première règle.',
    'Si vous cherchez une table libre, prenez celle près du mât. On y voit tout le jardin.',
  ],
  fermier: [
    'Quatre moutons, deux chèvres, des poules. Ça a l\'air de rien, mais c\'est la seule ferme à cent millions de kilomètres.',
    'Le mouton blanc, c\'est Nuage. Les enfants l\'ont baptisé. Il se prend pour un chien.',
    'La laine part à l\'atelier de tissage du pont habitat. Une écharpe par an, tirée au sort entre les familles.',
    'Les chèvres mangent tout. Même les plans de la grange. Surtout les plans de la grange.',
    'Je suis né sur une planète agricole. Ici, je refais en petit ce que mon père faisait en grand.',
    'Les bêtes sentent les variations de la gravité avant les capteurs. Quand elles s\'agitent, j\'appelle la maintenance.',
    'Les œufs vont au snack et à l\'infirmerie. Le Dr Salek dit que c\'est le meilleur remède du pont.',
    'Les écoles viennent le mardi. Les enfants caressent les moutons, puis ils dessinent des moutons pendant un mois.',
    'Le foin vient de Lys, compressé en balles. Le jour où un convoi est attaqué, mes bêtes mangent moins.',
    'Ne nourrissez pas les chèvres, s\'il vous plaît. Elles ont déjà un problème avec l\'autorité.',
  ],
  jardinier: [
    'Salades, poireaux, tomates. C\'est symbolique, mais les gens repartent avec un légume et un sourire.',
    'Le sol du dôme a été apporté de Lys, sac par sac, il y a cent ans. On le nourrit comme un vieil ami.',
    'L\'arrosage est automatique, mais je repasse à l\'arrosoir. Les plantes aiment qu\'on s\'occupe d\'elles.',
    'Les arbres sont plus vieux que moi, que mon père et que la Couronne. Ils ont tout vu de Halden.',
    'L\'épouvantail, c\'est pour la forme. Il n\'y a pas d\'oiseaux à faire fuir, juste des enfants.',
    'Je taille les buissons le matin, avant l\'arrivée des familles. Après, c\'est impossible : on me pose mille questions.',
    'Le ciel artificiel donne seize heures de lumière. Les tomates adorent, les salades un peu moins.',
    'Les fleurs jaunes, ce sont des gazanias. Elles s\'ouvrent avec le soleil du dôme et se ferment le soir.',
    'Un conseil : venez au lever du jour. La rosée sur la pelouse, c\'est ce qui ressemble le plus à une planète.',
    'Mon rêve serait d\'agrandir le potager. Mais chaque mètre carré du dôme est une bataille au Conseil.',
  ],
  équipage: [
    'L\'Atalante sort rarement. Elle attend un contrat d\'escorte longue durée, alors on astique les coursives.',
    'Trois ponts, quarante-deux pièces, et je me perds encore entre la soute et l\'atelier.',
    'Le réfectoire est au pont B. La cuisine est bonne, mais ne demandez jamais ce qu\'il y a dans le ragoût.',
    'Mon quart commence à six heures. Pont A, salle des machines, puis ronde des sas.',
    'La capitaine Varga a servi dans la flotte de Corvin. Elle n\'en parle jamais, mais ça se voit à sa façon de marcher.',
    'Le réacteur ronronne comme un chat quand tout va bien. Quand il se tait, on court.',
    'Ma cabine fait six mètres carrés. Sur une station, j\'aurais une fenêtre. Ici, j\'ai un hublot sur les étoiles.',
    'Le salon panoramique du pont C, c\'est l\'endroit le plus calme de la frégate. Allez-y au changement de quart.',
    'On a remplacé le rover de la soute le mois dernier. L\'ancien a fini contre une cloison, ne demandez pas comment.',
    'Si les pirates d\'Ardent continuent, l\'Atalante reprendra du service. Et nous avec.',
  ],
  capitaine: [
    'Bienvenue à bord de l\'Atalante. Frégate de classe Médée, cent dix mètres, vingt-deux âmes quand elle est au complet.',
    'Elle a trente ans et pas une ride. Enfin, quelques-unes. Mais ce sont des cicatrices honorables.',
    'Le pont de commandement est au niveau C. D\'ici, je vois la baie, le hangar et toute la route vers Lys.',
    'Le Conseil veut la vendre pour payer les baies de la galerie. Tant que je commande, elle reste à quai, prête.',
    'Mon équipage connaît chaque boulon. C\'est la seule richesse qu\'on ne peut pas nous saisir.',
    'Les Fils de la Brèche nous connaissent. Ils évitent les convois quand l\'Atalante est dans les parages.',
    'Si vous cherchez du travail, passez par le bureau de recrutement. Je prends les pilotes qui reviennent.',
    'La table holographique montre le secteur en temps réel. Chaque point rouge est un problème à venir.',
    'Le réacteur est au pont A, à l\'arrière. Ne touchez à rien, mon mécanicien mord.',
    'Le café du réfectoire est meilleur que celui de la station. C\'est un secret militaire.',
  ],
};

// ------------------------------------------------------------------ histoire personnelle (tirée au sort, stable)
const ORIGINS = [
  'Je suis né ici, au pont habitat. Je n\'ai jamais posé le pied sur une planète.',
  'Je viens de Lys. Là-bas, ça sent la terre mouillée. Ici, ça sent le métal chaud.',
  'J\'ai grandi sur un cargo. Mes parents livraient du minerai entre Ardent et Corvin.',
  'Je viens d\'une colonie minière qui a fermé il y a quinze ans. On est tous partis, chacun de son côté.',
  'Mes parents travaillaient aux chantiers navals. Quand ils ont fermé, on est restés. Pas d\'argent pour partir.',
  'Je suis arrivé ici pour trois mois. C\'était il y a onze ans.',
  'Je viens d\'une station encore plus vieille que Halden. Elle n\'existe plus. On l\'a démontée pour les pièces.',
  'J\'ai grandi à Corvin, dans un dépôt de fret. Je dormais entre deux conteneurs.',
  'Ma famille vient d\'une planète que je ne connais que par les photos de ma grand-mère.',
  'Je suis arrivé comme réfugié après l\'effondrement de la station Merle. J\'avais six ans.',
  'Je suis né dans une navette, entre deux stations. Mon état civil indique « en transit ».',
  'J\'ai été élevé par mon oncle, mécanicien au hangar. J\'ai appris à visser avant d\'apprendre à lire.',
];
const SITUATIONS = [
  'J\'ai deux enfants. Ils grandissent plus vite que les loyers, ce qui n\'est pas peu dire.',
  'Je vis seul dans une cabine du pont trois. C\'est petit, mais j\'ai une plante. Elle s\'appelle Patience.',
  'Ma compagne travaille à l\'infirmerie. On se croise entre deux services, comme des navettes.',
  'Je m\'occupe de ma mère, qui ne quitte plus sa cabine. Elle regarde la planète toute la journée.',
  'J\'ai trois colocataires et une seule douche. On a un planning collé sur la porte.',
  'Mon frère pilote pour la marine. Je n\'ai pas de nouvelles depuis deux mois.',
  'Je viens de me marier. On a fait la fête au bar La Comète. Joss a offert la première tournée.',
  'Je cumule deux emplois. Je dors quand la station dort, c\'est-à-dire presque jamais.',
  'Mon fils veut partir vers une station plus jeune. Je ne sais pas comment le retenir.',
  'Je viens de divorcer. Je garde le chat, elle garde la cabine. Le chat n\'est pas ravi.',
  'J\'élève des poissons dans un aquarium récupéré sur une épave. Ils ont plus d\'espace que moi.',
  'Ma fille est à l\'école de la station. Elle veut devenir prévisionniste, comme la dame de La Couronne.',
];
const DREAMS = [
  'Mon rêve ? Marcher pieds nus dans l\'herbe. Une seule fois, avant de mourir.',
  'J\'aimerais ouvrir un petit restaurant au pont habitat. Trois tables, une seule recette, la meilleure.',
  'Je voudrais piloter. Pas un cargo : quelque chose de rapide, juste pour voir la station de loin.',
  'Je rêve d\'une cabine avec un hublot. Un vrai hublot, pas un écran.',
  'J\'aimerais revoir la planète où je suis né. On dit qu\'elle a changé. Moi aussi.',
  'Je veux que mes enfants aient le choix de partir… et l\'envie de rester.',
  'Un jour, je monterai à La Couronne avec ma plus belle tenue, et je commanderai la bouteille la plus chère.',
  'Je rêve que les chantiers rouvrent. Que la station chante à nouveau, comme avant.',
  'J\'aimerais écrire l\'histoire de Halden. Avant qu\'il n\'y ait plus personne pour s\'en souvenir.',
  'Mon rêve, c\'est une année entière sans alerte pirate. Une seule.',
  'Je voudrais apprendre la musique. Il y a un vieux piano dans un entrepôt du hangar, personne n\'en joue.',
  'Je rêve de voir une aurore, de vraies lumières dans un vrai ciel. Pas des néons.',
];
const WORRIES = [
  'Ce qui m\'inquiète ? Les convois. Un convoi de moins, et c\'est toute la station qui serre la ceinture.',
  'J\'ai peur que la station ferme. Où irions-nous, tous ? Personne ne veut cent quarante mille réfugiés.',
  'Les pirates. Mon cousin était sur le convoi attaqué près d\'Ardent. Il s\'en est sorti, pas son second.',
  'Le prix de l\'air. On ne le dit pas, mais les filtres coûtent de plus en plus cher.',
  'Mes poumons. Trente ans de poussière de hangar, ça laisse des traces.',
  'Que mes enfants partent et ne reviennent jamais. C\'est ce qui arrive à presque tout le monde.',
  'La Couronne rachète les cabines du pont habitat. Petit à petit. Sans bruit.',
  'Je m\'inquiète pour mon emploi. On parle d\'automatiser tout le quai.',
  'La nuit, j\'entends la coque craquer. On dit que c\'est normal. Je préférerais que ce soit silencieux.',
  'Le Conseil ne nous dit rien. Quand personne ne dit rien, c\'est que tout le monde a peur.',
  'Ma santé. Le Dr Salek est le seul médecin du pont habitat, et il est épuisé.',
  'Rien, honnêtement. Je me suis promis de ne plus m\'inquiéter. Ça marche un jour sur deux.',
];
const ANECDOTES = [
  'Une fois, un passager a ouvert une caisse de semences de Lys en pleine galerie. On a eu de l\'herbe pendant une semaine.',
  'Il y a deux ans, la gravité artificielle a lâché pendant six secondes. Tout le monde s\'en souvient. Tout le monde.',
  'J\'ai serré la main d\'un amiral, un jour. Il avait la main moite. Ça m\'a beaucoup rassuré sur les amiraux.',
  'Le soir du Nouvel An, on éteint toutes les lumières du pont habitat et on regarde la planète en silence.',
  'Un chat a vécu trois ans dans les conduits du hangar. On l\'appelait le Contremaître.',
  'J\'ai vu une baleine solaire, une fois, depuis un cargo. Personne ne me croit. Elle était magnifique.',
  'Le bar La Comète a été fermé une seule fois en vingt ans : le jour où Joss s\'est marié. Il a rouvert le soir même.',
  'Une navette s\'est posée sur la mauvaise aire, un jour, et a failli écraser le tracteur. Le tractoriste en parle encore.',
  'Pendant la grande panne d\'il y a dix ans, on a chanté dans le noir, tous ensemble, pendant quatre heures.',
  'J\'ai gagné au tirage de la loterie de la station. Deux cents crédits. J\'ai tout dépensé en nouilles.',
  'Quand j\'étais petit, je me cachais dans les ascenseurs pour faire des allers-retours. Le gardien me laissait faire.',
  'J\'ai assisté à la pose de la coupole de La Couronne. Les ouvriers ont applaudi. Les riches n\'étaient pas encore arrivés.',
];

const RUMORS = [
  'Il paraît que Joss, le barman de La Comète, cherche quelqu\'un pour lui rapporter une bouteille d\'Ardent.',
  'Le Dr Salek manque de sérum. La coopérative de Lys en produit, mais personne ne veut faire le trajet.',
  'Une femme parle d\'équations devant une sphère lumineuse, à La Couronne. Certains disent qu\'elle a toujours raison. Elle cherche un pilote, paraît-il.',
  'Les Fils de la Brèche ont attaqué un convoi près d\'Ardent la semaine dernière.',
  'La Pizzeria Vesuvio offre le tiramisu pour deux pizzas, mais seulement si vous le demandez gentiment.',
  'Les ascenseurs panoramiques de La Couronne ont coûté plus cher qu\'un Mulet neuf.',
  'Corvin paie bien le cuivre, ces temps-ci. Lys rachète le titane.',
  'La sécurité offre une prime à qui repousse les pirates du hangar 07.',
  'Un financier de La Couronne passe ses journées au salon du Zénith à envoyer des messages chiffrés. Bizarre, non ?',
  'La guilde des équipages recrute des artilleurs. Un Héron avec une tourelle, ça change tout.',
  'On dit que le minage dans la ceinture d\'Ardent rapporte gros, si on a un bon laser.',
  'Le marché de Lys manque d\'électronique. Les contrats de livraison vers là-bas sont bien payés.',
  'Vous êtes déjà allé au Grand Dôme ? Passez par la Cour des Saveurs, porte est. Il y a des moutons. De vrais moutons.',
  'Le coucher de soleil du Grand Dôme, à vingt heures. Tout le pont habitat y monte, le dimanche.',
];

const IRENA_RUMOR = 2;   // index de la rumeur qui mène à Iréna Solvay
/** mémoire des répliques déjà entendues, par personne */
const MEM = new Map();
function nextOf(list, mem, key, salt) {
  const said = mem[key] ||= [];
  if (said.length >= list.length) said.length = 0;
  let i = hash(said.length + 1, salt) % list.length;
  while (said.includes(i)) i = (i + 1) % list.length;
  said.push(i);
  return list[i];
}
/** accord au féminin des récits à la première personne */
const FEM = [[/Je suis né /g, 'Je suis née '], [/Je suis né,/g, 'Je suis née,'], [/Je suis arrivé /g, 'Je suis arrivée '], [/arrivé comme réfugié/g, 'arrivée comme réfugiée'], [/J'ai été élevé /g, 'J\'ai été élevée '], [/Je vis seul /g, 'Je vis seule '], [/Quand j'étais petit/g, 'Quand j\'étais petite'], [/Je suis arrivé ici/g, 'Je suis arrivée ici']];
const accord = (t, fem) => (fem ? FEM.reduce((x, [a, b]) => x.replace(a, b), t) : t);
const fill = (t, p) => t.replace('{shop}', p.shop ? `la boutique « ${p.shop} »` : 'une boutique de la galerie').replace('{resto}', p.resto || 'un des restaurants').replace('{dish}', p.dish || 'plat du jour');


// ------------------------------------------------------------------ enfants du dôme : leur propre monde
const KID_HELLO = ['Bonjour ! T\'es qui, toi ?', 'Salut ! Tu veux jouer avec nous ?', 'Coucou ! T\'as vu le gros canard ?', 'Bonjour monsieur… ou madame ! Vous êtes pilote ?'];
const KID_BIO = [
  'J\'ai sept ans et demi. Le demi, c\'est important.',
  'J\'habite au pont habitat, cabine vingt-deux. Ma fenêtre, elle donne sur un mur. Mais ici il y a le ciel !',
  'Mon papa répare les vaisseaux au hangar. Il sent l\'huile, mais il fait les meilleurs câlins.',
  'Quand je serai grand, je veux voir une vraie mer. Avec des vagues et du sel. Ma mamie dit que ça pique les yeux.',
  'Une fois, j\'ai vu un vaisseau de la marine par la baie panoramique. Il était gros comme toute la galerie !',
];
const KID_RUMORS = [
  'Il paraît que la chèvre noire a mangé le chapeau de l\'épouvantail. Deux fois.',
  'Le glacier, il donne une boule gratuite si on aide à la ferme. C\'est vrai, je l\'ai fait !',
  'Mon copain dit qu\'il y a un trésor sous la colline. Moi je crois que c\'est des tuyaux.',
  'Le nain de jardin, près de la souche, il bouge la nuit. C\'est Zélie qui l\'a vu.',
  'Si on lance une pièce dans le bassin, les poissons orange exaucent un vœu. Enfin, ils la mangent pas, quoi.',
];
function kidTree(person) {
  const k = person.key || 1, mem = MEM.get(k) || {}; MEM.set(k, mem);
  const back = [{ t: 'Autre chose…', tone: 'neutre', next: 'again' }, { t: 'Allez, file jouer !', tone: 'calme', next: null }];
  const menu = (say) => ({ say, choices: [
    { t: 'Tu joues à quoi ?', tone: 'calme', next: 'job' },
    { t: 'Raconte-moi un peu de toi.', tone: 'calme', next: 'bio' },
    { t: 'Tu connais des secrets du dôme ?', tone: 'enquete', next: 'rumor' },
    { t: 'Où sont tes parents ?', tone: 'neutre', next: 'parents' },
    { t: 'Au revoir !', tone: 'calme', next: null },
  ] });
  return {
    start: menu(nextOf(KID_HELLO, mem, 'hello', k)),
    again: () => menu(nextOf(['Quoi ?', 'Oui ?', 'Encore une question ?', 'Dépêche, c\'est à moi de chercher !'], mem, 'again', k)),
    job: () => ({ say: nextOf(JOBS.enfant, mem, 'job', k), choices: [{ t: 'Et sinon ?', tone: 'calme', next: 'job' }, ...back] }),
    bio: () => ({ say: accord(nextOf(KID_BIO, mem, 'bio', k), !!person.fem).replace('Quand je serai grand,', person.fem ? 'Quand je serai grande,' : 'Quand je serai grand,'), choices: [{ t: 'Et encore ?', tone: 'calme', next: 'bio' }, ...back] }),
    rumor: () => ({ say: nextOf(KID_RUMORS, mem, 'rumor', k), choices: [{ t: 'Un autre secret ?', tone: 'enquete', next: 'rumor' }, ...back] }),
    parents: { say: () => R(['Là-bas, sur le banc. Elle me surveille, elle fait semblant de lire.', 'Papa est au snack. Il a dit « cinq minutes » il y a longtemps.', 'Ils parlent avec les autres parents. Ils parlent tout le temps, les grands.']), choices: back },
  };
}

/**
 * person : { name, role (clé de JOBS), key, shop?, resto?, dish?, order? (fonction : ouvrir la carte) }
 */
export function peopleTree(person, { story }) {
  if (person.role === 'enfant') return kidTree(person);
  const k = person.key || 1, mood = pickK(MOODS, k, 1);
  const mem = MEM.get(k) || {}; MEM.set(k, mem);
  const jobs = JOBS[person.role] || JOBS.résident;
  const s = story.s, rep = story.rep;
  const fem = !!person.fem;
  const bio = Object.fromEntries(Object.entries({ origin: pickK(ORIGINS, k, 2), situation: pickK(SITUATIONS, k, 3), dream: pickK(DREAMS, k, 4), worry: pickK(WORRIES, k, 5), anecdote: pickK(ANECDOTES, k, 6) }).map(([a, b]) => [a, accord(b, fem)]));
  const opinion = () => {
    if (s.step >= 4 && s.choice === 'public') return R(['Depuis qu\'on a publié la courbe de Solvay, tout le monde parle de l\'avenir. Mon voisin s\'est remis à cultiver des plants dans sa cabine.', 'La courbe ? J\'ai eu peur, au début. Maintenant je fais partie du comité de quartier. On s\'organise.']);
    if (s.step >= 4 && s.choice === 'council') return R(['Le Conseil a ouvert de nouvelles routes de ravitaillement. Personne ne sait pourquoi, mais les prix baissent.', 'Il se passe quelque chose au Conseil. Des réunions la nuit, des cargos supplémentaires. On n\'explique jamais rien aux gens d\'en bas.']);
    if (story.q?.ch2out === 'arrest') return 'Vous avez vu ? Un financier de La Couronne arrêté pour avoir payé les pirates ! Ça fait du bien de voir que la loi monte aussi les étages.';
    if (story.q?.ch2out === 'convert') return 'On dit qu\'un riche de La Couronne paie maintenant l\'escorte des convois. Les miracles existent.';
    if (rep.halden >= 3) return 'Vous êtes le pilote dont tout le monde parle, non ? Halden a besoin de gens comme vous.';
    return R(['Halden, c\'est chez moi. Même quand ça grince, même quand ça fuit.', 'La station vieillit. Nous aussi. Mais on tient.', 'Avant, il y avait les chantiers. Maintenant il y a… nous. Ça devra suffire.']);
  };
  const hello = person.role === 'couronne' && rep.halden < 2 ? 'Oui ? Vous cherchez la sortie de service ?' : nextOf(HELLO[mood], mem, 'hello', k);
  const menu = (say) => ({
    say,
    choices: [
      ...(person.order ? [{ t: 'Je voudrais commander.', tone: 'neutre', next: null, do: () => { setTimeout(person.order, 80); } }] : []),
      { t: 'Que faites-vous ici ?', tone: 'enquete', next: 'job' },
      { t: 'Parlez-moi de vous.', tone: 'calme', next: 'bio' },
      { t: 'Je peux vous rendre service ?', tone: 'calme', next: 'favor', if: () => story.offersFavor?.(person) },
      { t: 'Des nouvelles intéressantes ?', tone: 'enquete', next: 'rumor' },
      { t: 'Comment va la vie à Halden ?', tone: 'neutre', next: 'opinion' },
      { t: 'Au revoir.', tone: 'calme', next: null, do: () => (mood === 'méfiant' ? `${person.name} vous rend un hochement de tête prudent.` : undefined) },
      ...(person.order ? [] : [{ t: 'Rien. Laissez-moi passer.', tone: 'ferme', next: 'rude' }]),
    ],
  });
  const back = [{ t: 'Autre chose…', tone: 'neutre', next: 'again' }, { t: 'Merci, au revoir.', tone: 'calme', next: null }];
  return {
    start: menu(hello),
    again: () => menu(nextOf(['Oui ?', 'Je vous écoute.', 'Autre chose ?', 'Allez-y.', 'Je vous en prie.'], mem, 'again', k)),
    job: () => ({ say: accord(fill(nextOf(jobs, mem, 'job', k), person), fem), choices: [{ t: 'Et encore ?', tone: 'enquete', next: 'job' }, ...back] }),
    bio: () => {
      const order = ['origin', 'situation', 'dream', 'worry', 'anecdote'];
      const i = (mem.bioI = (mem.bioI ?? -1) + 1) % order.length;
      if (mood === 'méfiant' && rep.serenite < 2 && i === 0) return { say: 'Ma vie ne regarde que moi. Revenez quand vous aurez fait vos preuves, on en reparlera.', choices: back };
      const next = { origin: 'Et aujourd\'hui, votre vie ?', situation: 'Vous avez un rêve ?', dream: 'Qu\'est-ce qui vous inquiète ?', worry: 'Racontez-moi un souvenir de la station.', anecdote: 'Merci de m\'avoir raconté tout ça.' }[order[i]];
      return { say: bio[order[i]], choices: [{ t: next, tone: 'calme', next: i < 4 ? 'bio' : 'again' }, ...back] };
    },
    favor: () => {
      const f = (mem.favor ||= story.makeFavor(person));
      return { say: f.say, choices: [{ t: `D'accord, je m'en charge. (${f.reward} ¤)`, tone: 'calme', next: null, do: () => { mem.favor = null; return story.acceptFavor(f); } }, { t: 'Désolé, pas maintenant.', tone: 'neutre', next: 'again' }] };
    },
    rumor: () => {
      const say = mood === 'méfiant' && rep.audace < 2 ? 'Des rumeurs ? Je ne parle pas aux inconnus. Revenez quand on parlera de vous en bien.' : nextOf(RUMORS, mem, 'rumor', k);
      if (say === RUMORS[IRENA_RUMOR]) story.hear?.();   // la rumeur d'Iréna lance la piste, quel que soit l'habitant
      return { say, choices: [{ t: 'Vous en savez d\'autres ?', tone: 'enquete', next: 'rumor' }, ...back] };
    },
    opinion: { say: opinion, choices: back },
    rude: { say: mood === 'méfiant' ? 'Je ne vous retiens pas.' : mood === 'pressé' ? 'Ça tombe bien, moi non plus je n\'ai pas le temps.' : '… Charmant. Bonne journée quand même.', choices: [{ t: '[Partir]', tone: 'neutre', next: null }] },
  };
}
