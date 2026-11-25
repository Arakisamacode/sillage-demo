// Récit principal « L'Équation de Halden » et conversations des personnages clés.
// Iréna Solvay, prévisionniste installée à La Couronne, a modélisé l'avenir de la station : sans réseau
// d'entraide entre stations, Halden-7 s'effondrera dans quarante ans. Elle confie au joueur le noyau de son
// modèle, à porter jusqu'au relais de la station agricole Lys, puis à protéger pendant sa diffusion.
// Choix finals : rendre la projection publique (Sérénité) ou la remettre au seul Conseil (Audace).

const R = (a) => a[Math.floor(Math.random() * a.length)];

export class Story {
  constructor({ game, audio, dialog, toast, combat, flight, ground, outposts }) {
    Object.assign(this, { game, audio, dialog, toast, combat, flight, ground, outposts });
    this.favors = (game.d.favors ||= []);
    this.merle = new (this.flight.pos.constructor)(2600, 380, 1900);   // ruines de la station Merle
    this.ch3scan = 0; this.ch3wave = false;
    this.s = (game.d.story ||= { step: 0, kills: 0, choice: null, heard: false });
    // quêtes secondaires et chapitre 2 : 0 = non commencée, 1 = en cours, 2 = objectif atteint (revenir), 3 = terminée
    this.q = (game.d.quests ||= { joss: 0, salek: 0, ch2: 0, ch2out: null, ch2t: 0 });
    this.q.ch3 ??= 0;
    this.ch2T = -1;
    game.d.rep ||= { serenite: 0, audace: 0, halden: 0 };
    this.ambushT = -1;
    this.irena = null;
  }
  get rep() { return this.game.d.rep; }
  save() { this.game.save(); }
  /** le joueur a entendu parler d'Iréna Solvay (Joss, Mira ou la rumeur d'un habitant) */
  hear() {
    if (this.s.heard) return;
    this.s.heard = true; this.save();
    this.toast('Nouvelle piste : Iréna Solvay, La Couronne (ascenseur panoramique du hall)');
  }

  // ---------------------------------------------------------------- objectif affiché
  objective() {
    const st = this.s.step, q = this.q, L = [];
    const H = (t, x) => L.push(`<b id="story">◆ ${t}</b> · ${x}`);
    if (st === 1) H('L\'ÉQUATION DE HALDEN', 'porter le noyau de calcul à la station agricole Lys (se poser)');
    if (st === 2) H('L\'ÉQUATION DE HALDEN', `protéger la diffusion : abattre les intercepteurs (${this.s.kills}/3)`);
    if (st === 3) H('L\'ÉQUATION DE HALDEN', 'retrouver Iréna Solvay à La Couronne');
    // (pendant les premiers pas, la piste est déjà l'étape affichée par le guide)
    if (st === 0 && this.s.heard && this.game.d.guide?.done !== false) H('PISTE', 'une prévisionniste cherche un pilote à La Couronne');
    if (q.ch2 === 1) H('LES FILS DE LA BRÈCHE', 'démasquer le financier des pirates parmi la clientèle de La Couronne (mode analyse : C)');
    if (q.ch2 === 2) H('LES FILS DE LA BRÈCHE', 'décoller et intercepter le cargo pirate au rendez-vous');
    if (q.ch2 === 3) H('LES FILS DE LA BRÈCHE', 'faire votre rapport à Iréna Solvay');
    if (q.joss === 1) L.push('<b>SERVICE</b> · rapporter une liqueur d\'aurélite de la Plateforme Ardent-3 (se poser)');
    if (q.joss === 2) L.push('<b>SERVICE</b> · rapporter la bouteille à Joss (bar La Comète)');
    if (q.salek === 1) L.push('<b>SERVICE</b> · chercher le sérum du Dr Salek à la station agricole Lys (se poser)');
    if (q.salek === 2) L.push('<b>SERVICE</b> · rapporter le sérum au Dr Salek (infirmerie)');
    if (q.ch3 === 1) H('LE SIGNAL DE MERLE', 'rejoindre les ruines de la station Merle (repère en vol)');
    if (q.ch3 === 2) H('LE SIGNAL DE MERLE', `récupérer l'archive : rester près des ruines (${Math.min(100, Math.round(this.ch3scan / 20 * 100))} %)`);
    if (q.ch3 === 3) H('LE SIGNAL DE MERLE', 'rapporter l\'archive de Merle à Iréna Solvay');
    for (const f of this.favors) L.push(`<b>SERVICE</b> · ${f.short}`);
    return L.length ? L.join('<br>') : null;
  }
  /** Bandeau d'actualités de la station (écran du hall habitat) : reflète vos choix. */
  news() {
    const L = ['Convoi de Lys : arrivée prévue aire 05', 'Cours du titane en hausse à Lys', 'Bar La Comète : soirée musique 22 h'];
    if (this.s.step >= 4) L.unshift(this.s.choice === 'public' ? 'COURBE DE SOLVAY : la projection publiée, comités de quartier' : 'CONSEIL : nouvelles routes de ravitaillement votées');
    else L.push('Ceinture d\'Ardent : pirates signalés');
    if (this.q.ch3 >= 4) L.unshift(this.q.ch3out === 'lys' ? 'RÉSEAU DES STATIONS : la coopérative de Lys coordonne l\'entraide' : this.q.ch3out === 'open' ? 'ARCHIVE DE MERLE : publiée sur toutes les fréquences' : 'CONSEIL : un plan secret pour l\'avenir de Halden');
    if (this.q.ch2 >= 3) L.unshift(this.q.ch2out === 'arrest' ? 'SCANDALE : le financier Aldric Venn arrêté à La Couronne' : this.q.ch2out === 'convert' ? 'MÉCÉNAT : Aldric Venn finance l\'escorte des convois' : 'Ceinture d\'Ardent : un cargo pirate neutralisé');
    return L;
  }

  // ---------------------------------------------------------------- événements du jeu
  onFlight(e, pad) {
    const q = this.q, id = pad?.outpost?.id;
    if (e === 'landed' && q.joss === 1 && id === 'ardent') { q.joss = 2; this.save(); this.toast('Liqueur d\'aurélite récupérée · à rapporter à Joss'); }
    if (e === 'landed' && q.salek === 1 && id === 'lys') { q.salek = 2; this.save(); this.toast('Sérum de la coopérative de Lys récupéré · à rapporter au Dr Salek'); }
    if (e === 'takeoff' && q.ch2 === 2) this.ch2T = 15;
    if (e === 'landed') for (const f of [...this.favors]) if (f.type === 'parcel' && f.dest === id) this._favorDone(f);
    if (e === 'landed' && this.s.step === 1 && pad?.outpost?.id === 'lys') {
      this.s.step = 2; this.s.kills = 0; this.save();
      this._comm('Le relais de Lys a reçu le noyau. La diffusion démarre… et quelqu\'un écoute. Trois signatures se détachent de la ceinture. Ils veulent faire taire l\'équation : redécollez et tenez-les à distance.');
    }
    if (e === 'takeoff' && this.s.step === 2) this.ambushT = 10;
  }
  onCombat(e) {
    if (this.q.ch2 === 2 && this.ch2Spawned && (e === 'clear' || e === 'scuttled' || e === 'docked')) {
      this.q.ch2 = 3; this.save(); this.ch2Spawned = false;
      this._comm(e === 'docked' ? 'Vous les abordez ? Audacieux. Les registres du cargo confirment tout : Venn payait chaque interception. Revenez, nous devons parler.' : 'Le cargo est neutralisé. Sans ce ravitaillement, les Fils de la Brèche vont se disperser. Revenez me voir à La Couronne.');
    }
    if (e === 'kill' && this.s.step === 2) {
      this.s.kills++; this.save();
      if (this.s.kills >= 3) {
        this.s.step = 3; this.save();
        this._comm('Diffusion complète. Quarante stations viennent de recevoir la projection. Vous venez de modifier la courbe, pilote. Revenez me voir à La Couronne.');
      } else this._comm(R(['Un de moins. La transmission tient.', 'Bien joué. Encore un peu, le relais est à 80 %.', 'Ils reculent. Ne les laissez pas approcher de Lys.']));
    }
  }
  update(dt) {
    // chapitre 3 : approche et récupération de l'archive dans les ruines de Merle
    const q = this.q, F = this.flight;
    if ((q.ch3 === 1 || q.ch3 === 2) && F.state === 'flying') {
      const d = F.pos.distanceTo(this.merle);
      if (q.ch3 === 1 && d < 420) { q.ch3 = 2; this.ch3scan = 0; this.ch3wave = false; this.save(); this._comm('Vous y êtes. Approchez du cœur de l\'anneau brisé et tenez votre position : je télécharge l\'archive par votre transpondeur. Vingt secondes.'); }
      if (q.ch3 === 2 && d < 520) {
        this.ch3scan += dt;
        if (this.ch3scan > 6 && !this.ch3wave) { this.ch3wave = true; this.combat.spawnWave(3, 1200, false); this._comm('Des charognards ! Ils fouillent ces ruines depuis des années. Tenez bon, le téléchargement continue tant que vous restez près de l\'anneau.'); }
        if (this.ch3scan >= 20) { q.ch3 = 3; this.save(); this._comm('Archive complète. Pilote… Merle n\'est pas morte par hasard. Elle avait un plan pour sauver tout le secteur, et quelqu\'un l\'a enterré. Rentrez. Vite.'); }
      }
    }
    if (this.ch2T > 0 && this.flight.state === 'flying') {
      this.ch2T -= dt;
      if (this.ch2T <= 0 && this.q.ch2 === 2) {
        this.ch2T = -1; this.ch2Spawned = true;
        this.combat.spawnWave(3, 1300, true);
        this._comm('Signature confirmée : le cargo des Fils de la Brèche et son escorte, exactement où Venn l\'avait dit. Détruisez les escorteurs, puis le cargo… ou abordez-le si vous en avez le cran.');
      }
    }
    if (this.ambushT > 0 && this.flight.state === 'flying') {
      this.ambushT -= dt;
      if (this.ambushT <= 0) {
        this.ambushT = -1;
        if (this.s.step === 2 && !this.combat.pirates?.some((p) => !p.dead)) {
          this.combat.spawnWave(3, 1300, false);
          this._comm('Contact ! Trois intercepteurs sans transpondeur, cap sur vous. Ce ne sont pas de simples pillards : quelqu\'un paie pour que cette équation ne sorte jamais d\'ici.');
        }
      }
    }
    // une vague manquée (fuite, mort) : nouvelle tentative au prochain décollage
    if (this.s.step === 2 && this.flight.state === 'parked' && this.ambushT < 0) this.ambushT = -1;
  }
  /** mission en cours pour la table de briefing */
  brief() {
    const st = this.s.step, q = this.q;
    if (q.ch3 === 1 || q.ch3 === 2) return { title: 'Le Signal de Merle', text: 'Les ruines de la station Merle émettent un signal sur une fréquence oubliée. Approchez l\'anneau brisé et tenez votre position vingt secondes pour télécharger l\'archive. Charognards attendus dans le champ de débris.', destP: [2600, 1900], destName: 'Ruines de Merle', objectives: ['Rejoindre les ruines de Merle', 'Rester près de l\'anneau pendant le téléchargement', 'Repousser les charognards'], threat: 3, wing: 'offered', go: 'Lancer la mission' };
    if (q.ch2 === 2) return { title: 'Interception : cargo des Fils de la Brèche', text: 'Venn a livré le rendez-vous : un cargo de ravitaillement pirate attend sur la route de Corvin avec son escorte. Décollez, l\'escadrille vous accompagne. Détruisez les escorteurs, puis le cargo… ou abordez-le.', dest: 'corvin', destName: 'Rendez-vous pirate', objectives: ['Décoller', 'Abattre l\'escorte', 'Détruire ou aborder le cargo'], threat: 3, wing: 'offered', go: 'Lancer la mission' };
    if (st === 1 || st === 2) return { title: 'L\'Équation de Halden', text: st === 1 ? 'Portez le noyau de calcul d\'Iréna Solvay jusqu\'à la station agricole Lys et posez-vous sur leur plateforme. Leur relais diffusera le modèle vers quarante stations.' : 'La diffusion est interceptée. Redécollez de Lys et tenez les intercepteurs à distance jusqu\'à la fin de la transmission.', dest: 'lys', destName: 'Station agricole Lys', objectives: st === 1 ? ['Rejoindre Lys', 'Se poser sur la plateforme'] : ['Décoller de Lys', 'Abattre trois intercepteurs'], threat: st === 1 ? 1 : 2, wing: st === 2 ? 'offered' : 'hire', go: 'Lancer la mission' };
    return { title: 'Patrouille et escorte', text: 'Pas de mission de l\'escadrille en cours. Vous pouvez engager des ailiers pour votre prochaine sortie : ils vous escortent sur les routes de fret et engagent les pirates à vos côtés.', dest: null, objectives: ['Ailiers engagés pour une sortie', 'Ils rentrent quand vous vous posez'], threat: 1, wing: 'hire', go: 'Compris' };
  }
  /** les missions de combat du récit fournissent l'escadrille */
  wingOffered() { return this.s.step === 2 || this.q.ch2 === 2 || this.q.ch3 === 1 || this.q.ch3 === 2; }
  /** repère de navigation (vol) */
  navTarget() {
    const pad = (id) => this.outposts?.find((o) => o.id === id)?.pad;
    const q = this.q;
    if (q.ch3 === 1 || q.ch3 === 2) return { pos: this.merle, name: 'Ruines de Merle' };
    const want = this.s.step === 1 ? 'lys' : q.joss === 1 ? 'ardent' : q.salek === 1 ? 'lys' : this.favors.find((f) => f.type === 'parcel')?.dest;
    const P = want && pad(want);
    return P ? { pos: P.pos, name: P.name } : null;
  }

  // ---------------------------------------------------------------- services demandés par les habitants
  offersFavor(person) { return person.key % 3 === 0 && this.favors.length < 3 && !this.favors.some((f) => f.giver === person.key) && !(this.game.d.favorsDone || []).includes(person.key); }
  makeFavor(person) {
    const k = person.key, dests = { corvin: 'au Relais Corvin', ardent: 'à la plateforme Ardent-3', lys: 'à la station agricole Lys' };
    const NPCS = { joss: 'Joss, le barman de La Comète', salek: 'le Dr Salek, à l\'infirmerie', mira: 'Mira, à la conciergerie de La Couronne' };
    const MSG = ['que je lui rembourserai sa dette à la fin du mois', 'que je ne viendrai pas jeudi, mais que je ne l\'oublie pas', 'que le paquet est arrivé et que tout va bien', 'merci pour l\'autre soir. Il comprendra'];
    let f;
    if (k % 2) {
      const dest = Object.keys(dests)[k % 3];
      const what = ['un colis pour ma sœur', 'des pièces de rechange pour mon cousin', 'des médicaments pour mon père', 'un cadeau d\'anniversaire pour ma fille'][k % 4];
      f = { type: 'parcel', dest, reward: 900 + (k % 7) * 150, say: `J'ai ${what}, ${dests[dest]}. Le fret coûte une fortune… Si vous passez par là, posez-vous, ils sauront à qui le remettre. Je vous paierai, promis.`, short: `livrer ${what.replace('ma ', 'la ').replace('mon ', 'le ')} de ${person.name} ${dests[dest]} (se poser)` };
    } else {
      const to = Object.keys(NPCS)[k % 3], msg = MSG[k % 4];
      f = { type: 'message', to, reward: 300 + (k % 5) * 80, say: `Vous pourriez dire à ${NPCS[to]} ${msg} ? Je n'ose pas y aller moi-même.`, short: `porter le message de ${person.name} à ${NPCS[to]}`, msg };
    }
    Object.assign(f, { id: Date.now() % 1e9 + k, giver: k, giverName: person.name });
    return f;
  }
  acceptFavor(f) { this.favors.push(f); this.save(); return `Service accepté · ${f.short}`; }
  _favorDone(f) {
    this.favors.splice(this.favors.indexOf(f), 1);
    (this.game.d.favorsDone ||= []).push(f.giver);
    this.game.earn(f.reward); this.rep.halden += 1; this.save(); this.audio.blip();
    this.dialog.transmit({ name: `${f.giverName} · message`, portrait: '', text: f.type === 'parcel' ? `Ils ont bien reçu le colis ! Merci, vraiment. Je vous ai viré ${f.reward} crédits.` : `Merci d'avoir fait passer mon message. ${f.reward} crédits pour vous.`, voice: { pitch: 1, rate: 1 } });
    this.toast(`Service rendu à ${f.giverName} · ${f.reward} ¤ · réputation de Halden +1`);
  }
  /** ajoute aux conversations des personnages nommés la remise des messages qui leur sont destinés */
  withFavors(who, tree) {
    const me = this, start = tree.start;
    tree.start = () => {
      const node = typeof start === 'function' ? start() : start;
      const extra = me.favors.filter((f) => f.type === 'message' && f.to === who).map((f) => ({ t: `J'ai un message de ${f.giverName}.`, tone: 'calme', next: null, do: () => { me._favorDone(f); return `Message transmis : « ${f.msg} »`; } }));
      return { ...node, choices: [...extra, ...(node.choices || [])] };
    };
    return tree;
  }

  _comm(text) {
    const I = this.irena;
    if (I && !I.portrait) I.portrait = this.dialog.snapshot(I.c);
    this.dialog.transmit({ name: 'Iréna Solvay · canal crypté', portrait: I?.portrait || '', text, voice: I?.voice });
  }

  // ---------------------------------------------------------------- conversations
  /** Iréna Solvay, prévisionniste (La Couronne) */
  irenaTree() {
    const s = this.s, me = this;
    const finish = (choice) => () => {
      s.step = 4; s.choice = choice; me.game.earn(30000);
      me.rep.halden += choice === 'public' ? 3 : 1; me.save();
      me.audio.blip();
      return 'Récompense : 30 000 ¤ · réputation de Halden en hausse';
    };
    return {
      start: () => {
        if (!s.met) { s.met = true; me.save(); }   // première rencontre (fin des premiers pas)
        if (s.step === 0) return { say: 'Vous regardez la sphère comme tout le monde : on croit voir des lumières. Ce sont des trajectoires. Celles de cent quarante mille personnes, ici, à Halden-7. Je m\'appelle Iréna Solvay. Je calcule l\'avenir des foules.',
          choices: [
            { t: 'Vous calculez l\'avenir ? Expliquez-moi.', tone: 'enquete', next: 'how' },
            { t: 'Et que disent vos calculs ?', tone: 'neutre', next: 'verdict' },
            { t: 'On m\'a dit que vous cherchiez un pilote.', tone: 'neutre', next: 'verdict', if: () => s.heard },
            { t: 'Les prophètes finissent rarement bien. Au revoir.', tone: 'ferme', next: null },
          ] };
        if (s.step === 1) return { say: 'Le noyau est dans votre soute. Lys, la station agricole. Posez-vous sur leur plateforme, le relais fera le reste.', choices: [{ t: 'J\'y vais.', tone: 'neutre', next: null }, { t: 'Pourquoi Lys ?', tone: 'enquete', next: 'whylys' }] };
        if (s.step === 2) return { say: 'Ils sont là-haut, je les vois sur mes courbes. Vous devez protéger la diffusion : retournez en vol.', choices: [{ t: 'Compris.', tone: 'neutre', next: null }] };
        if (s.step === 3) return { say: 'Vous l\'avez fait. La courbe s\'est infléchie de quatre degrés. Ça n\'a l\'air de rien… c\'est un siècle. Il reste une décision, et je ne veux pas la prendre seule. Que faisons-nous de la projection ?',
          choices: [
            { t: 'La rendre publique. Les gens ont le droit de savoir.', tone: 'calme', next: 'endPublic' },
            { t: 'La remettre au Conseil. La panique tuerait plus vite que le déclin.', tone: 'ferme', next: 'endCouncil' },
            { t: 'Que feriez-vous, vous ?', tone: 'enquete', next: 'herview' },
          ] };
        return { say: s.choice === 'public'
          ? 'Les coursives ne parlent que de ça. Certains ont peur. Beaucoup se sont mis au travail. C\'est exactement ce que la courbe annonçait… pour une fois, ça me réjouit.'
          : 'Le Conseil a voté en secret de nouvelles routes de ravitaillement. Personne ne sait pourquoi. Moi je sais. Et vous aussi.',
        choices: [
          { t: 'Que montre la sphère, maintenant ?', tone: 'enquete', next: 'ch2', if: () => me.q.ch2 === 0 },
          { t: 'Venn est démasqué. Où est leur cargo ?', tone: 'neutre', next: null, if: () => me.q.ch2 === 2, do: () => 'Décollez : le cargo apparaîtra au rendez-vous' },
          { t: 'Le cargo des Fils de la Brèche est neutralisé.', tone: 'neutre', next: 'ch2end', if: () => me.q.ch2 === 3 },
          { t: 'La sphère a-t-elle encore quelque chose à dire ?', tone: 'enquete', next: 'ch3', if: () => me.q.ch2 === 4 && me.q.ch3 === 0 },
          { t: 'J\'ai l\'archive de Merle.', tone: 'neutre', next: 'ch3end', if: () => me.q.ch3 === 3 },
          { t: 'Prenez soin de vous, Iréna.', tone: 'calme', next: null },
          { t: 'Votre sphère prédit-elle quelque chose pour moi ?', tone: 'enquete', next: 'me' },
        ] };
      },
      how: { say: 'Je ne prédis pas une personne : une personne est imprévisible. Mais une foule obéit à des lois aussi sûres que la gravité. Les prix, les départs, les naissances, les rixes au bar… Assez de données et la courbe apparaît. Elle ne ment pas. Elle déplaît, c\'est tout.',
        choices: [{ t: 'Et que dit la courbe ?', tone: 'neutre', next: 'verdict' }, { t: 'C\'est fascinant.', tone: 'calme', next: 'verdict' }, { t: 'Ça ressemble à une arnaque.', tone: 'ferme', next: 'proof' }] },
      proof: { say: 'Alors une preuve. Dans trois jours, le cours du titane montera à Lys. La semaine prochaine, une alerte au hangar 07. Vérifiez. Ce n\'est pas de la divination, c\'est de l\'arithmétique.',
        choices: [{ t: 'Admettons. Que dit votre courbe sur la station ?', tone: 'neutre', next: 'verdict' }] },
      verdict: { say: 'Halden-7 meurt. Pas demain : dans quarante ans. Les chantiers sont partis, les routes se vident, les pirates remplissent le vide. Le Conseil refuse de m\'écouter. Mais si d\'autres stations reçoivent mon modèle, elles s\'organiseront. Un réseau survit là où une station isolée s\'éteint.',
        choices: [
          { t: 'Je vous crois. Que dois-je faire ?', tone: 'calme', next: 'job' },
          { t: 'Combien ça paie ?', tone: 'ferme', next: 'pay' },
          { t: 'Pourquoi le Conseil refuse-t-il ?', tone: 'enquete', next: 'council' },
          { t: 'Pas mon problème.', tone: 'ferme', next: null },
        ] },
      council: { say: 'Parce qu\'un déclin annoncé fait fuir les investisseurs de La Couronne. Ils préfèrent une station qui coule lentement mais sourit sur les brochures. Je ne leur en veux pas : c\'est une réaction parfaitement prévisible.',
        choices: [{ t: 'Que dois-je faire ?', tone: 'calme', next: 'job' }, { t: 'Et vous payez combien ?', tone: 'ferme', next: 'pay' }] },
      pay: { say: 'Trente mille crédits. Toutes mes économies, ou presque. Si la courbe a raison, l\'argent ne vaudra plus grand-chose ici de toute façon.',
        choices: [{ t: 'Marché conclu.', tone: 'ferme', next: 'job' }, { t: 'Gardez votre argent. Je le fais pour la station.', tone: 'calme', next: 'job' }] },
      job: { say: 'Voici le noyau de calcul. Portez-le jusqu\'à la station agricole Lys et posez-vous : leur vieux relais peut diffuser vers quarante stations. Méfiez-vous : ceux qui profitent du déclin ont des oreilles partout.',
        choices: [{ t: '[Prendre le noyau] Je pars pour Lys.', tone: 'neutre', next: null, do: () => { s.step = 1; me.save(); me.audio.blip(); me.pendingBrief = true; return 'Mission : L\'Équation de Halden · porter le noyau à la station agricole Lys'; } }] },
      whylys: { say: 'Parce que Lys nourrit la moitié du secteur. Quand elle parle, les autres écoutent. Et parce que son relais date d\'avant les péages : personne ne peut le censurer.', choices: [{ t: 'J\'y vais.', tone: 'neutre', next: null }] },
      herview: { say: 'Moi ? Je publierais tout, et je me tromperais peut-être. La vérité calme certaines foules et en affole d\'autres. Mon modèle ne sait pas répondre à ça. Vous, si.',
        choices: [{ t: 'Rendre la projection publique.', tone: 'calme', next: 'endPublic' }, { t: 'La remettre au Conseil.', tone: 'ferme', next: 'endCouncil' }] },
      endPublic: { say: 'Alors on la diffuse. Demain, chaque écran de la galerie montrera la courbe. Il y aura de la peur… et ensuite du courage. Merci, pilote. Voici votre récompense, et ma reconnaissance, qui vaut un peu moins.',
        choices: [{ t: '[Accepter] Prenez soin de la courbe.', tone: 'calme', next: null, do: finish('public') }] },
      endCouncil: { say: 'Le Conseil, donc. Ils agiront en silence, sans affoler personne. C\'est peut-être plus sage. Ou plus confortable. Je vous remets votre récompense : vous avez gagné le droit de décider.',
        choices: [{ t: '[Accepter] Le silence sauve aussi.', tone: 'ferme', next: null, do: finish('council') }] },
      ch2: { say: 'Une anomalie. Les interceptions de Lys n\'étaient pas du hasard : quelqu\'un paie les Fils de la Brèche pour frapper nos convois. Les flux d\'argent remontent… ici. À La Couronne. Un de ces clients qui sirotent du champagne finance le déclin, parce qu\'une station qui meurt se rachète à bas prix.',
        choices: [{ t: 'Je vais le trouver.', tone: 'calme', next: null, do: () => { me.q.ch2 = 1; me.save(); return 'Chapitre 2 : Les Fils de la Brèche · utilisez le mode analyse (C) à La Couronne'; } },
          { t: 'Vous avez un nom ?', tone: 'enquete', next: 'ch2name' }] },
      ch2name: { say: 'Pas un nom : un comportement. Il ne regarde jamais la coupole. Il parle bas, il reçoit des messages chiffrés, et il est assis au salon du Zénith depuis l\'ouverture. Analysez la clientèle, vous le reconnaîtrez.',
        choices: [{ t: 'J\'y vais.', tone: 'neutre', next: null, do: () => { me.q.ch2 = 1; me.save(); return 'Chapitre 2 : Les Fils de la Brèche · cherchez au salon du Zénith'; } }] },
      ch2end: { say: () => (me.q.ch2out === 'bribe' ? 'Le cargo est tombé, c\'est l\'essentiel. Quant à Venn… j\'ai vu les crédits arriver sur votre compte. La courbe ne juge pas. Moi un peu.' : me.q.ch2out === 'convert' ? 'Le cargo est tombé et Venn finance désormais l\'escorte des convois. Transformer un prédateur en protecteur… aucune de mes équations n\'avait prévu ça.' : 'Le cargo est tombé et Venn est entre les mains de la sécurité. La courbe s\'est encore infléchie. Vous devenez une variable très encombrante, pilote.'),
        choices: [{ t: '[Recevoir 40 000 ¤] Au prochain chapitre, Iréna.', tone: 'calme', next: null, do: () => { me.q.ch2 = 4; me.game.earn(40000); me.rep.halden += me.q.ch2out === 'bribe' ? 0 : 2; me.save(); me.audio.blip(); return 'Chapitre 2 terminé · 40 000 ¤'; } }] },
      ch3: { say: 'Oui. Un signal. Faible, régulier, sur une fréquence oubliée depuis quarante ans. Il vient des ruines de la station Merle — celle qui s\'est effondrée quand vous étiez enfant, et dont les réfugiés vivent encore au pont habitat. Ma sphère dit que ce signal contient la pièce manquante de l\'équation.',
        choices: [{ t: 'Je vais le chercher.', tone: 'calme', next: 'ch3go' }, { t: 'Pourquoi personne n\'y est allé avant ?', tone: 'enquete', next: 'ch3why' }] },
      ch3why: { say: 'Parce que les ruines sont au milieu d\'un champ de débris infesté de charognards. Et parce que ceux qui ont laissé Merle mourir n\'avaient aucune envie qu\'on y retourne. La sécurité vous prête deux ailiers. Vous en aurez besoin.',
        choices: [{ t: 'J\'y vais.', tone: 'calme', next: 'ch3go' }] },
      ch3go: { say: 'Les coordonnées sont dans votre ordinateur de bord. Passez par la table de briefing du hangar : Freux et Lynx vous y attendent. Et pilote… revenez.',
        choices: [{ t: '[Recevoir les coordonnées]', tone: 'neutre', next: null, do: () => { me.q.ch3 = 1; me.save(); me.pendingBrief = true; return 'Chapitre 3 : Le Signal de Merle · ruines repérées en vol'; } }] },
      ch3end: { say: 'Montrez-moi… Le « Second Rivage ». Merle avait conçu un réseau d\'entraide entre toutes les stations : partage de vivres, de pièces, d\'escortes. Ils ont été ruinés par ceux qui profitaient de l\'isolement. Avec cette archive, la courbe peut s\'inverser. Mais à qui la confier ?',
        choices: [
          { t: 'À la coopérative de Lys. Le réseau doit appartenir à tous.', tone: 'calme', next: 'ch3fin', do: () => { me.q.ch3out = 'lys'; } },
          { t: 'Au Conseil de Halden. Il faut quelqu\'un pour décider.', tone: 'ferme', next: 'ch3fin', do: () => { me.q.ch3out = 'council'; } },
          { t: 'Publions-la sur toutes les fréquences. Que chacun s\'en empare.', tone: 'calme', next: 'ch3fin', if: () => me.rep.serenite >= 5, do: () => { me.q.ch3out = 'open'; } },
        ] },
      ch3fin: { say: () => ({ lys: 'Lys, donc. Des fermiers à la tête du plus grand réseau du secteur. L\'Histoire adore ce genre d\'ironie.', council: 'Le Conseil. Ils sauront l\'utiliser, je l\'espère. Je garderai une copie. Par précaution.', open: 'Sur toutes les fréquences… Plus personne ne pourra l\'enterrer. C\'est la décision la plus imprévisible que j\'aie jamais vue. J\'adore ça.' })[me.q.ch3out] + ' Prenez ceci : soixante mille crédits, et une combinaison Halo de chez Nova. Vous l\'avez méritée cent fois.',
        choices: [{ t: '[Recevoir la récompense]', tone: 'calme', next: null, do: () => { me.q.ch3 = 4; me.game.earn(60000); me.game.d.owned.lx_halo = (me.game.d.owned.lx_halo || 0) + 1; me.rep.halden += 3; me.save(); me.audio.blip(); return 'Chapitre 3 terminé · 60 000 ¤ · combinaison « Halo » ajoutée au casier'; } }] },
      me: { say: 'Une seule personne ? Non. Mais je remarque que depuis votre arrivée, les variables bougent plus vite. Vous êtes ce que j\'appelle une anomalie. Les anomalies changent les courbes. Continuez.', choices: [{ t: 'Je prends ça pour un compliment.', tone: 'neutre', next: null }] },
    };
  }

  /** Aldric Venn, financier (chapitre 2) */
  aldricTree() {
    const me = this, q = this.q;
    if (q.ch2 !== 1) return { start: { say: q.ch2out === 'bribe' ? 'Vous encore. Notre arrangement tient, j\'espère ?' : 'Je ne vous connais pas. Laissez-moi tranquille.', choices: [{ t: '[Partir]', tone: 'neutre', next: null }] } };
    const done = (out, extra) => () => { q.ch2 = 2; q.ch2out = out; extra?.(); me.save(); me.audio.blip(); me.pendingBrief = true; return out === 'bribe' ? '15 000 ¤ reçus · Venn livre le rendez-vous du cargo' : 'Venn livre le rendez-vous du cargo pirate · décollez'; };
    return {
      start: { say: 'Aldric Venn, investissements orbitaux. Vous bloquez ma vue, pilote.',
        choices: [
          { t: 'Vos transferts vers la ceinture d\'Ardent, vous pouvez les expliquer ?', tone: 'enquete', next: 'cornered' },
          { t: 'Je sais que vous payez les Fils de la Brèche.', tone: 'ferme', next: 'cornered' },
          { t: 'Pardon, je me suis trompé de personne.', tone: 'calme', next: null },
        ] },
      cornered: { say: 'Prouvez-le. … Non ? Alors soyons adultes. Une station qui meurt se rachète au dixième de sa valeur. Je ne fais qu\'accélérer l\'inévitable. Quinze mille crédits, et vous oubliez cette conversation.',
        choices: [
          { t: 'Vous allez tout avouer à la sécurité. Où est leur cargo ?', tone: 'calme', next: 'arrest' },
          { t: 'Quinze mille, et le rendez-vous de leur cargo. Marché conclu.', tone: 'ferme', next: 'bribe' },
          { t: 'Financez plutôt l\'escorte des convois. La courbe peut aussi vous enrichir.', tone: 'calme', next: 'convert', if: () => me.rep.serenite >= 4 },
        ] },
      arrest: { say: 'Très bien… très bien. Leur cargo de ravitaillement attend au large, près de la route de Corvin. Dites à la sécurité que j\'ai coopéré.', choices: [{ t: '[Appeler la sécurité]', tone: 'calme', next: null, do: done('arrest', () => { me.rep.halden += 1; if (me.aldric) me.aldric.gone = true; }) }] },
      bribe: { say: 'Voilà qui est raisonnable. Leur cargo attend au large, sur la route de Corvin. Et souvenez-vous : nous ne nous sommes jamais parlé.', choices: [{ t: '[Empocher les crédits]', tone: 'ferme', next: null, do: done('bribe', () => { me.game.earn(15000); me.rep.halden -= 2; }) }] },
      convert: { say: '… Une station sauvée vaut plus qu\'une station rachetée, c\'est ce que vous dites ? Votre prévisionniste a de drôles d\'amis. Soit. Je coupe leurs fonds et je paie l\'escorte. Leur dernier cargo est sur la route de Corvin.', choices: [{ t: '[Serrer la main de Venn]', tone: 'calme', next: null, do: done('convert', () => { me.rep.halden += 3; }) }] },
    };
  }

  /** Joss Varrin, barman de La Comète */
  jossTree() {
    const me = this, s = this.s;
    const DR = ['Thé fumé de Lys', 'Bière de soute', 'Café serré', 'Eau pétillante recyclée', 'Liqueur d\'aurélite (sans aurélite)'];
    const hello = R(['Joss Varrin, pour vous servir. Vous avez la tête de quelqu\'un qui arrive de loin.', 'Ah, notre pilote. Toujours en vie, c\'est bon signe.', 'Installez-vous. Ici on ne pose pas de questions… sauf moi.']);
    return {
      // tant que la piste n'est pas connue, Joss la donne d'emblée : parler au barman suffit à la lancer
      start: () => {
        const tip = !s.heard;
        if (tip) me.hear();
        return { say: tip ? `${hello} Au fait, vous êtes pilote ? Il y a une femme, là-haut à La Couronne, qui en cherche un. Iréna Solvay. Demandez-moi si ça vous intrigue.` : hello,
        choices: [
          { t: 'Un verre, s\'il vous plaît. (8 ¤)', tone: 'neutre', next: 'drink', do: () => (me.game.pay(8) ? (me.audio.coffee?.(), `${R(DR)} servi`) : 'Crédits insuffisants') },
          { t: 'Quelles sont les nouvelles ?', tone: 'enquete', next: 'news' },
          { t: 'Parlez-moi de Halden-7.', tone: 'enquete', next: 'lore' },
          { t: 'Les pirates, ils sortent d\'où ?', tone: 'enquete', next: 'pirates' },
          { t: 'Tournée générale, c\'est pour moi. (80 ¤)', tone: 'calme', next: 'round', do: () => { if (!me.game.pay(80)) return 'Crédits insuffisants'; me.rep.halden += 2; me.save(); return 'Le bar vous acclame · réputation de Halden +2'; } },
          { t: 'Vous en savez plus que vous ne dites.', tone: 'ferme', next: 'irena' },
          { t: 'Je peux vous rendre service ?', tone: 'calme', next: 'qjoss', if: () => me.q.joss === 0 },
          { t: 'Voici votre liqueur d\'aurélite.', tone: 'neutre', next: 'qjossEnd', if: () => me.q.joss === 2 },
        ] };
      },
      qjoss: { say: 'Puisque vous le proposez… La Plateforme Ardent-3 distille une liqueur d\'aurélite. La vraie, pas mon imitation. Ramenez-m\'en une bouteille : posez-vous là-bas, demandez de ma part. Je paie bien, et je n\'oublie jamais un service.',
        choices: [{ t: 'Marché conclu.', tone: 'calme', next: null, do: () => { me.q.joss = 1; me.save(); return 'Service : liqueur d\'aurélite · se poser à la Plateforme Ardent-3'; } }, { t: 'Une autre fois.', tone: 'neutre', next: 'start' }] },
      qjossEnd: { say: 'Oh, regardez-moi cette couleur… Vous êtes un ange, pilote. Voici votre dû, et à partir d\'aujourd\'hui, vous avez votre verre ici.',
        choices: [{ t: '[Recevoir 2 500 ¤]', tone: 'calme', next: null, do: () => { me.q.joss = 3; me.game.earn(2500); me.rep.halden += 1; me.save(); me.audio.blip(); return 'Service rendu · 2 500 ¤ · réputation de Halden +1'; } }] },
      drink: { say: 'Et voilà. Le meilleur de la station, ce qui n\'est pas très difficile.', choices: [{ t: 'Autre chose…', tone: 'neutre', next: 'start' }, { t: 'Merci, Joss.', tone: 'calme', next: null }] },
      news: { say: () => R(['Les cargos pirates passent souvent près de la ceinture d\'Ardent. Si vous transportez quelque chose, évitez-la.', 'Corvin paie bien le cuivre, ces temps-ci. Lys rachète le titane au prix fort.', 'Une alerte au hangar 07 ? Ça arrive plus souvent qu\'on ne le dit. La sécurité paie une prime.', 'Il paraît qu\'Aérodyne expose un yacht à La Couronne. Quarante-huit millions. Je vous laisse faire le calcul en bières.']),
        choices: [{ t: 'Autre chose…', tone: 'neutre', next: 'start' }, { t: 'Merci.', tone: 'neutre', next: null }] },
      lore: { say: 'Halden-7 a été bâtie il y a deux siècles pour les chantiers navals. Les chantiers sont partis, les familles sont restées. En bas, on répare des cargos. En haut, à La Couronne, on achète des yachts. Entre les deux, on fait semblant que tout va bien.',
        choices: [{ t: 'Et ça va bien ?', tone: 'enquete', next: 'irena' }, { t: 'Autre chose…', tone: 'neutre', next: 'start' }] },
      pirates: { say: 'Des équipages ruinés, surtout. Ils se font appeler les Fils de la Brèche. Quand une station ne peut plus nourrir ses pilotes, certains vont se servir ailleurs. Tirez en premier, et demandez une prime ensuite.',
        choices: [{ t: 'Autre chose…', tone: 'neutre', next: 'start' }, { t: 'Merci du conseil.', tone: 'calme', next: null }] },
      round: { say: 'À la santé du pilote ! … Vous venez de vous faire une vingtaine d\'amis. Ça sert, ici.', choices: [{ t: 'Autre chose…', tone: 'neutre', next: 'start' }, { t: 'À Halden !', tone: 'calme', next: null }] },
      irena: { say: 'Bon. Il y a une femme, là-haut, à La Couronne. Iréna Solvay. Elle passe ses journées devant une sphère lumineuse et dit que la station va mourir. Les riches rient. Moi, j\'ai remarqué qu\'elle ne se trompe jamais sur le prix du titane. Elle cherche un pilote.',
        choices: [{ t: 'Je vais aller la voir.', tone: 'neutre', next: null, do: () => me.hear() }, { t: 'Autre chose…', tone: 'neutre', next: 'start' }] },
    };
  }

  /** Dr Salek, infirmerie du pont habitat */
  doctorTree() {
    const me = this;
    return {
      start: { say: R(['Docteur Salek. Asseyez-vous. Vous saignez, vous toussez, ou vous voulez juste parler ?', 'Encore vous. Je commence à connaître vos radios par cœur.']),
        choices: [
          { t: 'Soins complets. (250 ¤)', tone: 'neutre', next: 'heal', do: () => { if (!me.game.pay(250)) return 'Crédits insuffisants'; me.ground.hp = 100; me.game.d.owned.medpen = (me.game.d.owned.medpen || 0) + 1; me.save(); return 'Soins complets · un stylo médical offert'; } },
          { t: 'Beaucoup de blessés en ce moment ?', tone: 'enquete', next: 'wounded' },
          { t: 'Vous soignez aussi ceux qui ne peuvent pas payer ?', tone: 'calme', next: 'free' },
          { t: 'Vous avez besoin d\'aide, docteur ?', tone: 'calme', next: 'qsalek', if: () => me.q.salek === 0 },
          { t: 'Votre sérum de Lys, docteur.', tone: 'neutre', next: 'qsalekEnd', if: () => me.q.salek === 2 },
          { t: 'Rien, merci.', tone: 'neutre', next: null },
        ] },
      heal: { say: 'Voilà. Côtes recollées, oreille interne recalibrée. Évitez les tirs dans le ventre cette semaine.', choices: [{ t: 'Merci, docteur.', tone: 'calme', next: null }] },
      qsalek: { say: 'Justement. Mon stock de sérum anti-radiations est vide, et les mineurs d\'Ardent en ont besoin. La coopérative de Lys en produit. Posez-vous chez eux, ils vous remettront une caisse : c\'est payé d\'avance.',
        choices: [{ t: 'J\'y vais.', tone: 'calme', next: null, do: () => { me.q.salek = 1; me.save(); return 'Service : sérum du Dr Salek · se poser à la station agricole Lys'; } }, { t: 'Pas maintenant.', tone: 'neutre', next: 'start' }] },
      qsalekEnd: { say: 'Parfait, et à bonne température. Vous venez de sauver quelques mineurs qui ne le sauront jamais. Tenez, pour votre peine, et une trousse de soins pour la route.',
        choices: [{ t: '[Recevoir 3 000 ¤ et une trousse]', tone: 'calme', next: null, do: () => { me.q.salek = 3; me.game.earn(3000); me.game.d.owned.medkit = (me.game.d.owned.medkit || 0) + 1; me.rep.halden += 1; me.save(); me.audio.blip(); return 'Service rendu · 3 000 ¤ · trousse de soins'; } }] },
      wounded: { say: 'Des mineurs d\'Ardent, des convoyeurs, quelques gardes. Les blessures par arme ont doublé en un an. Quelqu\'un en haut appellerait ça une tendance.', choices: [{ t: 'Autre chose…', tone: 'neutre', next: 'start' }, { t: 'Au revoir.', tone: 'neutre', next: null }] },
      free: { say: 'Le jeudi, oui. Le reste de la semaine, La Couronne paie mes factures sans le savoir : je leur vends des cures de jouvence parfaitement inutiles.', choices: [{ t: 'Joli. (sourire)', tone: 'calme', next: null }, { t: 'Autre chose…', tone: 'neutre', next: 'start' }] },
    };
  }

  /** Conciergerie de La Couronne */
  conciergeTree() {
    const me = this;
    return {
      start: { say: R(['Bienvenue à La Couronne. Je suis Mira Castel. Que puis-je pour vous ?', 'Ravie de vous revoir. La coupole est particulièrement claire aujourd\'hui.']),
        choices: [
          { t: 'Que trouve-t-on ici ?', tone: 'enquete', next: 'tour' },
          { t: 'Qui est la femme près de la sphère lumineuse ?', tone: 'enquete', next: 'irena' },
          { t: 'Je pourrais avoir une coupe offerte ?', tone: 'ferme', next: 'gift', if: () => (me.rep.audace >= 3 || me.rep.halden >= 2) && !me.game.d.giftTaken },
          { t: 'Merci, Mira.', tone: 'calme', next: null },
        ] },
      tour: { say: 'Haute couture à la Maison Élysée, combinaisons sur mesure chez Nova Atelier, et Aérodyne présente sa Série 9. Le Zénith sert jusqu\'à l\'aube. Et la vue, bien sûr : la coupole a coûté plus cher que le reste de la station.', choices: [{ t: 'Autre chose…', tone: 'neutre', next: 'start' }, { t: 'Merci.', tone: 'neutre', next: null }] },
      irena: { say: 'Madame Solvay. Prévisionniste. Le Conseil la trouve… inquiétante. Elle vient chaque jour parler à sa sphère, près de la galerie d\'observation, au sud. Elle a demandé si un pilote passait par ici.', choices: [{ t: 'Je vais la voir.', tone: 'neutre', next: null, do: () => me.hear() }, { t: 'Autre chose…', tone: 'neutre', next: 'start' }] },
      gift: { say: 'Pour vous ? Bien sûr. On parle de vous dans les coursives, vous savez. Le Zénith vous attend : la maison offre.', choices: [{ t: 'Merci, Mira.', tone: 'calme', next: null, do: () => { me.game.d.giftTaken = true; me.save(); return 'Coupe de champagne de Lys offerte par la maison'; } }] },
    };
  }
}
