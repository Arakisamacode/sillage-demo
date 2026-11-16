import * as THREE from 'three';
import { Renderer } from './core/renderer.js';
import { PRESETS, detectQuality, saveQuality, isTouchDevice } from './core/quality.js';
import { Input } from './core/input.js';
import { Materials } from './world/materials.js';
import { Builder } from './world/builder.js';
import { Sky } from './world/sky.js';
import { buildHangar } from './world/hangar.js';
import { buildLighting } from './world/lighting.js';
import { buildFX } from './world/fx.js';
import { buildShips } from './world/ships.js';
import { buildProps } from './world/props.js';
import { buildGallery } from './world/gallery.js';
import { CharacterLibrary } from './characters/characters.js';
import { buildScenes } from './ai/scenes.js';
import { Crowd } from './ai/crowd.js';
import { Player } from './player/player.js';
import { Audio } from './audio/audio.js';
import { SHOTS } from './shots.js';
import { buildExterior } from './world/exterior.js';
import { Flight } from './flight/flight.js';
import { GameState } from './game/state.js';
import { ITEM, STORES } from './game/catalog.js';
import { HeronLoadout } from './game/shipgear.js';
import { ShopUI } from './ui/shop.js';
import { buildOutposts } from './world/outposts.js';
import { buildDerelict } from './world/derelict.js';
import { buildBayCover, buildAirlockSign } from './world/baycover.js';
import { buildHabitat, DECK_Y, Elevators } from './world/habitat.js';
import { buildFurnish } from './world/furnish.js';
import { Cargo, buildQuai } from './game/cargo.js';
import { Missions } from './game/missions.js';
import { Crew } from './game/crew.js';
import { Mining } from './game/mining.js';
import { Combat } from './game/combat.js';
import { Ground } from './game/ground.js';
import { StationClock } from './game/clock.js';

const params = new URLSearchParams(location.search);
const HX_ = 32;
const shotName = params.get('shot');
const $ = (id) => document.getElementById(id);
const loadbar = $('loadbar'), loadtext = $('loadtext');
const touch = isTouchDevice();
if (touch) document.body.classList.add('is-touch');

function progress(p, label) {
  loadbar.style.width = `${Math.round(p * 100)}%`;
  if (label) loadtext.textContent = label;
}

async function boot() {
  const qName = detectQuality();
  const quality = { ...PRESETS[qName] };
  $('quality').value = qName;

  const renderer = new Renderer($('view'), quality);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x6a7480, 0.0042);
  const camera = new THREE.PerspectiveCamera(touch ? 72 : 70, innerWidth / innerHeight, 0.05, 12000);
  camera.position.set(0, 1.7, 20);

  const manager = new THREE.LoadingManager();
  manager.onProgress = (url, a, b) => progress(0.1 + 0.5 * (a / b), 'Chargement des textures');
  const loaded = new Promise((res) => { manager.onLoad = res; });

  const mats = new Materials(renderer, quality, manager);
  mats.preload();
  const builder = new Builder(scene);
  builder.cellSize = quality.name === 'low' ? 80 : 40;
  const ctx = { scene, camera, renderer, quality, mats, builder, manager, updaters: [], screens: [], time: new StationClock(8.6) };

  progress(0.05, 'Construction du hangar');
  await tick();
  const sky = new Sky(scene, quality);
  buildHangar(ctx);
  ctx.ships = buildShips(ctx);
  buildProps(ctx);
  ctx.quai = buildQuai(ctx);
  buildGallery(ctx);
  buildExterior(ctx);
  ctx.outposts = buildOutposts(ctx);
  ctx.derelict = buildDerelict(ctx);
  buildBayCover(ctx);
  buildAirlockSign(ctx);
  ctx.habitat = buildHabitat(ctx);
  ctx.furnish = buildFurnish(ctx);
  ctx.lights = buildLighting(ctx);
  const lib = new CharacterLibrary(manager, quality);
  const libReady = lib.load(undefined, (p) => progress(0.6 + 0.3 * p, 'Chargement des personnages'));
  await loaded;
  await libReady;
  ctx.lib = lib;
  progress(0.92, 'Mise en place de l\'équipage');
  await tick();

  const scenes = buildScenes(ctx);
  const crowd = new Crowd(ctx, scenes);
  builder.finalize();
  ctx.fx = buildFX(ctx);
  const player = new Player(ctx, builder.collisionGeometry());
  const flight = new Flight(ctx, ctx.ships.heron);
  ctx.flight = flight;
  for (const o of ctx.outposts) flight.addPad(o.pad);
  flight.onEvent = (e, pad) => {
    if (e === 'takeoff') { const fr = flight.lastDock?.freighter; ctx.crew?.onTakeoff(); ctx.combat?.onTakeoff(); ctx.ground?.onTakeoff(); if (fr) { ctx.combat.undock(fr); flight.lastDock = null; } }
    if (e === 'landed') {
      ctx.crew?.onLanded(pad);
      const rep = ctx.combat?.onLanded();
      setTimeout(() => ctx.ground?.onLanded(pad), 1500);
      if (rep) setTimeout(() => toast(rep), 4200);
    }
    const away = pad && pad !== flight.home;
    if (e === 'landing' && (away || flight.target !== flight.home)) {
      const T = flight.target;
      audio.say(`${T.name}, contrôle : Héron, vous êtes autorisé à vous poser. Bienvenue.`);
      return toast(`Atterrissage autorisé · ${T.name}`);
    }
    if (e === 'landed' && away) return toast(`Posé · ${pad.name} · E : opérations de fret · Espace : décoller`);
    if (e === 'takeoff' && flight.spoolFrom && flight.spoolFrom.distanceTo(flight.home.pos) > 50) return toast('Décollage · moteurs en montée de régime');
    const msg = {
      takeoff: ['Contrôle de pont : Héron, autorisation de décollage accordée, aire zéro deux. Champ de confinement ouvert.', 'Décollage autorisé · aire 02'],
      airborne: [null, touch ? 'En vol · joystick : poussée · glisser : orientation · ▲ ▼ : altitude' : 'En vol · ZQSD : poussée · souris : orientation · Espace / C : monter / descendre · Q / E : roulis · V : vue'],
      landing: ['Contrôle de pont : Héron, autorisation d\'atterrissage, aire zéro deux.', 'Atterrissage autorisé · aire 02'],
      landed: [null, 'Posé sur l\'aire 02 · moteurs coupés'],
    }[e];
    if (!msg) return;
    if (msg[0]) audio.say(msg[0]);
    toast(msg[1]);
    if (e === 'landed' && player.avatar) player.avatar.root.visible = player.thirdPerson;
  };
  // ------------------------------------------------------------------ économie : état de la partie, équipement visible
  const game = new GameState();
  ctx.game = game;
  const dressPerson = (ch, p) => {
    if (!p) return;
    ch.setOutfit(p.outfit ? ITEM[p.outfit].outfit : (p.base || ITEM.o_flight.outfit));
    ch.setArmor(p.armor ? ITEM[p.armor].armor : null);
    for (const k of ['sidearm', 'primary']) ch.setGear(k, p[k] ? ITEM[p[k]].shape : null, p[k] ? ITEM[p[k]].accent : 0);
  };
  ctx.dressPerson = dressPerson;
  player.setAvatar(lib.create('UM_light', { height: 1.82, hair: 'Hair_Buzzed', hairColor: 0x2a1d14, outfit: ITEM.o_flight.outfit }));
  dressPerson(player.avatar, game.person('me'));
  const heronGear = new HeronLoadout(ctx.ships.heron);
  heronGear.apply(game.d.ship);
  game.on((what) => {
    if (what === 'credits' || what === 'save') return;
    dressPerson(player.avatar, game.person('me'));
    heronGear.apply(game.d.ship);
    if (ctx.crew) for (const m of ctx.crew.members) dressPerson(m.agent.char, game.person(m.data.id));
  });
  // ------------------------------------------------------------------ fret : caisses, contrats
  const cargo = new Cargo(ctx, ctx.ships.heron, flight);
  const missions = new Missions(ctx, cargo, ctx.outposts, game, flight);
  ctx.cargo = cargo; ctx.missions = missions;
  ctx.missionsBoard = () => missions.board();
  // ------------------------------------------------------------------ minage
  const mining = new Mining(ctx, { game, flight, ship: ctx.ships.heron, loadout: heronGear });
  ctx.mining = mining;
  const ardent = ctx.outposts.find((o) => o.id === 'ardent');
  player.thirdPerson = true; player.camDist = 2.6;
  if (shotName === 'lineup' || shotName === 'portrait') {
    const roles = [['mécanicien', 'M'], ['pilote', 'F'], ['sécurité', 'M'], ['client', 'F'], ['ravitailleur', 'M'], ['client', 'M'], ['entretien', 'F']];
    roles.forEach(([r, g], i) => crowd.spawn(r, g, function* (a) {
      a.pos.set(-4.5 + i * 1.5, 0, -4); a.yaw = 0;
      for (;;) yield { type: 'act', anim: i % 3 === 1 ? 'talk' : 'idle', dur: 999 };
    }));
  } else if (shotName === 'sittest') {
    const W = crowd.world;
    const seats = [W.benchesWindow[2], W.benchesWindow[3], W.benchesMid[0], W.benchHangar[0]];
    seats.forEach((st, i) => crowd.spawn(['client', 'client', 'mécanicien', 'pilote'][i], ['M', 'F', 'M', 'F'][i], function* (a) {
      a.pos.set(st.x, 0, st.z); a.yaw = st.yaw;
      for (;;) yield { type: 'sit', x: st.x, z: st.z, yaw: st.yaw, dur: 999, talk: i % 2 === 1 };
    }));
  } else crowd.populate();
  // mannequins habillés de la boutique de combinaisons (pose figée, mis à jour une fois)
  {
    const mq = ctx.shopSpots.combis?.mannequins || [];
    const looks = [['UM_light', 'o_navy', 'a_light'], ['UF_light', 'o_sand', null], ['UM_dark', 'o_black', 'a_med_w']];
    mq.forEach((m, i) => {
      const [model, outfit, armor] = looks[i % looks.length];
      const c = lib.create(model, { height: model.startsWith('UF') ? 1.7 : 1.8 });
      c.setOutfit(ITEM[outfit].outfit);
      if (armor) c.setArmor(ITEM[armor].armor);
      c.root.position.copy(m.p); c.root.position.y = 0.12; c.root.rotation.y = m.yaw;
      c.update(0.016, null);
      scene.add(c.root);
    });
  }
  // habitants du pont habitat : barman, médecin, clients (animés seulement quand le joueur est sur le pont)
  {
    const HB = ctx.habitat, people = [];
    const put = (model, opts, p, yaw, anim, outfit) => {
      const c = lib.create(model, opts); c.root.position.copy(p); c.root.rotation.y = yaw;
      if (outfit) c.setOutfit(outfit);
      if (anim) c.play(anim, { fade: 0 });
      scene.add(c.root); people.push(c); c.root.visible = false; return c;
    };
    put('UM_dark', { height: 1.84, hair: 'Hair_Beard' }, HB.bartender, -Math.PI / 2, 'talk', { top: 0x2a2224, bottom: 0x1c1c1e, accent: 0xffb84a, zip: true });
    put('UF_light', { height: 1.7, hair: 'Hair_Buns' }, HB.doctor, Math.PI, null, { top: 0xe8eef0, bottom: 0xd8dee0, boot: 0xf0f0f0, accent: 0x3aa86a });
    const seats = [...HB.chairs.slice(0, 4), HB.benches[1], HB.benches[4]];
    const looks = [['UM_light', 'Hair_SimpleParted'], ['UF_dark', 'Hair_Long'], ['UM_dark', 'Hair_Buzzed'], ['UF_light', 'Hair_BuzzedFemale'], ['UM_light', 'Hair_Beard'], ['UF_dark', 'Hair_Buns']];
    const tops = [0x6a4a32, 0x1a2436, 0x5d6168, 0xa89470, 0x2b3036, 0x7a2a24];
    seats.forEach((st) => { st.taken = true; });
    seats.forEach((st, i) => put(looks[i][0], { height: looks[i][0].startsWith('UF') ? 1.68 : 1.8, hair: looks[i][1] }, st.p, st.yaw, i % 2 ? 'sitTalk' : 'sit', { top: tops[i], accent: 0xc8b48a, belt: true }));
    put('UM_light', { height: 1.78, hair: 'Hair_Buzzed' }, HB.stools[2].clone().add(new THREE.Vector3(-0.3, 0, 0)), Math.PI / 2, 'talk', { top: 0x3a4a2a, accent: 0xd0a040 });
    // habitants qui circulent : serveur, couple en promenade le long de la baie, résident qui rentre en cabine
    const Y40 = DECK_Y, V = (x, z) => new THREE.Vector3(x, Y40, z);
    const walkers = [];
    const walker = (c, route) => { walkers.push({ c, route, i: 0, pause: Math.random() * 2, pos: route[0].p.clone() }); c.root.position.copy(route[0].p); };
    walker(put('UF_dark', { height: 1.7, hair: 'Hair_Buns' }, V(-87, -17), 0, null, { top: 0x2a2224, bottom: 0x1c1c1e, accent: 0xffb84a, zip: true }), [
      { p: V(-87, -17), wait: 4, anim: 'idle', face: Math.PI / 2 }, { p: V(-97, -15), wait: 3, anim: 'talk', face: Math.PI / 2 },
      { p: V(-97, -3), wait: 0 }, { p: V(-103, -3), wait: 3, anim: 'talk', face: Math.PI }, { p: V(-89, -2), wait: 0 }]);
    const stroll = (dx) => [{ p: V(-109 + dx, -20), wait: 6, anim: 'talk', face: Math.PI }, { p: V(-96 + dx, -20), wait: 5, anim: 'idle', face: Math.PI }, { p: V(-84 + dx, -20), wait: 6, anim: 'talk', face: Math.PI }, { p: V(-96 + dx, -19.4), wait: 0 }];
    walker(put('UM_light', { height: 1.8, hair: 'Hair_SimpleParted' }, V(-109, -20), 0, null, { top: 0x6a4a32, accent: 0xc8b48a, belt: true }), stroll(0));
    walker(put('UF_light', { height: 1.66, hair: 'Hair_Long' }, V(-108.3, -20), 0, null, { top: 0x1a2436, accent: 0x3e8ad8 }), stroll(0.75));
    walker(put('UM_dark', { height: 1.82, hair: 'Hair_Buzzed' }, V(-114, -11), 0, null, { top: 0x5d6168, bottom: 0x3a3d42, accent: 0xe8762a, hivis: true }), [
      { p: V(-114, -11), wait: 6, anim: 'idle', face: -Math.PI / 2 }, { p: V(-109, -4), wait: 0 }, { p: V(-98.5, 0.6), wait: 4, anim: 'idle', face: 0 }, { p: V(-104, -2), wait: 0 }]);
    const stepWalkers = (dt) => {
      for (const w of walkers) {
        const T = w.route[w.i];
        if (w.pause > 0) {
          w.pause -= dt; w.c.setSpeed(0);
          if (T.face !== undefined) { let d = T.face - w.c.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); w.c.root.rotation.y += d * (1 - Math.exp(-dt * 4)); }
          if (w.pause <= 0) { if (w.c.override) w.c.stop(0.3); w.i = (w.i + 1) % w.route.length; }
          continue;
        }
        const d = new THREE.Vector3().subVectors(T.p, w.pos).setY(0), L = d.length();
        if (L < 0.15) { w.pause = T.wait || 0.01; if (T.anim && T.anim !== 'idle') w.c.play(T.anim, { fade: 0.4 }); continue; }
        w.pos.addScaledVector(d.normalize(), Math.min(L, 1.3 * dt));
        w.c.root.position.copy(w.pos);
        let dy = Math.atan2(d.x, d.z) - w.c.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        w.c.root.rotation.y += dy * (1 - Math.exp(-dt * 8));
        w.c.setSpeed(1.3);
      }
    };
    ctx.updaters.push((dt) => {
      const on = HB.onDeck(player.pos);
      if (on) stepWalkers(dt);
      for (const l of HB.lights) l.visible = on;
      for (const c of people) { c.root.visible = on; if (on) c.update(dt, null); }
    });
  }
  ctx.crowd = crowd; ctx.player = player; ctx.scenes = scenes;
  // ------------------------------------------------------------------ équipage (bureau de recrutement de la galerie)
  const crew = new Crew(ctx, { game, cargo, flight, crowd, missions, player, loadout: heronGear });
  ctx.crew = crew;
  ctx.recruitBoard = () => crew.board();

  // qualité basse : ombre du soleil calculée une fois (décor statique) ; les éléments mobiles n'y projettent pas
  if (quality.name === 'low') {
    renderer.three.shadowMap.autoUpdate = false;
    renderer.three.shadowMap.needsUpdate = true;
    for (const v of [scenes.forklift.obj.group, scenes.tug.obj.group]) v.traverse((o) => { o.castShadow = false; });
  }
  renderer.setupPost(scene, camera);
  renderer.setExposure(1.15);
  renderer.resize();
  addEventListener('resize', () => renderer.resize());
  const input = new Input($('view'));
  input.setTouch(touch);
  ctx.input = input;
  const audio = new Audio(ctx);
  ctx.audio = audio;
  crowd.onArrival = () => audio.announce('arrival');
  player.onStep = (p, sp) => audio.step(p, sp);
  // ------------------------------------------------------------------ combat spatial
  ctx.touch = touch;
  const combat = new Combat(ctx, { game, flight, loadout: heronGear, crew, mining, ship: ctx.ships.heron });
  ctx.combat = combat;
  const plural = (n, a, b) => `${n} ${n > 1 ? b : a}`;
  // ------------------------------------------------------------------ combat à pied (avant-postes)
  const ground = new Ground(ctx, { game, flight, crew, player, missions });
  ctx.ground = ground;
  const money = (n) => n.toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  ground.onEvent = (e, a, b, c, d) => {
    if (e === 'raid') {
      audio.say(`Ici ${a.name}. Nous sommes attaqués ! Des pirates sortent de la tour. Demandons assistance immédiate.`);
      toast(`Raid pirate sur ${a.name} · ${plural(b, 'assaillant', 'assaillants')} · ${touch ? 'DESC.' : 'G'} : descendre armé`);
    }
    if (e === 'alert') {
      audio.say('Alerte. Intrusion armée, baie du hangar zéro sept. Civils, mettez-vous à l\'abri. Port d\'arme autorisé.');
      toast(`Alerte intrusion · ${plural(a, 'pirate franchit', 'pirates franchissent')} le champ de la baie · ${touch ? 'ARME' : 'G'} : dégainer`);
    }
    if (e === 'alertEnd') { audio.say('Fin d\'alerte. Reprise normale des opérations.'); toast('Fin d\'alerte · armes rangées'); }
    if (e === 'evacStation') toast(`Soigné à l'infirmerie de la station · −${money(a)} ¤ · la sécurité a repoussé l'intrusion`);
    if (e === 'boarding') audio.say('Sas ouvert. Contacts dans la soute.');
    if (e === 'boarded') toast(`À bord du cargo pirate · ${plural(ground.raid?.n || 4, 'pirate', 'pirates')} dans la soute${a ? ` · ${plural(a, 'garde', 'gardes')} avec vous` : ''}`);
    if (e === 'disembark') toast(a ? `Sur le pont · ${plural(a, 'garde vous accompagne', 'gardes vous accompagnent')}` : `Sur le pont de ${flight.dockedAt.name}`);
    if (e === 'kill') toast(`${a.name} neutralisé · prime +${money(b)} ¤${d ? ` · ${plural(d, 'pirate restant', 'pirates restants')}` : ''}${c === 'friend' ? ' (garde)' : ''}`);
    if (e === 'cleared') {
      const what = a.id === 'halden' ? 'Hangar sécurisé' : a.id === 'derelict' ? 'Cargo saisi' : 'Plateforme sécurisée';
      audio.say(a.id === 'halden' ? 'Intrus neutralisés. Merci pour votre aide, pilote.' : a.id === 'derelict' ? 'Soute sécurisée.' : 'Plateforme sécurisée. Merci, pilote. Paiement transféré.');
      toast(`${what} · ${c}`);
    }
    if (e === 'loot') toast(`Butin ramassé · ${a}`);
    if (e === 'guardDown') toast(`${a.name} est à terre !`);
    if (e === 'down') { audio.say('Blessé grave. Évacuation vers le vaisseau.'); toast('Vous êtes à terre !'); }
    if (e === 'evac') toast(`Évacué à bord · soins d'urgence −${money(a)} ¤ · les pirates pillent le dépôt et s'enfuient`);
    if (e === 'fled') toast('Décollage · le raid se poursuit sans vous');
    if (e === 'noguns') toast('Armes interdites dans la station');
    if (e === 'nogun') toast('Aucune arme personnelle · Armurerie Kestrel, galerie');
    if (e === 'noother') toast('Pas d\'autre arme équipée');
    if (e === 'switch') toast(a.name);
    if (e === 'nomed') toast('Aucun stylo médical · Pharmacie, galerie');
    if (e === 'fullhp') toast('Santé au maximum');
    if (e === 'healed') { audio.blip(); toast('Stylo médical injecté'); }
  };
  combat.onEvent = (e, a, b, c) => {
    const fire = touch ? 'TIR' : 'clic gauche / X';
    if (e === 'wave' && c) {
      audio.say('Alerte. Cargo pirate escorté. Désemparez-le pour l\'aborder.');
      return toast(`Cargo pirate Rançonneur et ${plural(a - 1, 'escorte', 'escortes')} · abattez ses boucliers et sa coque sous 30 % pour l'aborder`);
    }
    if (e === 'wave') {
      audio.say('Alerte. Contacts hostiles en approche.');
      toast(`Contacts hostiles · ${plural(a, 'chasseur pirate', 'chasseurs pirates')} · ${b} m${mining.mode ? ` · ${touch ? 'MIN' : 'M'} : quitter le minage` : ` · ${fire} : tirer`}`);
    }
    if (e === 'kill') { toast(`${a.K.name} détruit · prime +${b.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} ¤${c ? ` · ${plural(c, 'hostile restant', 'hostiles restants')}` : ''}`); }
    if (e === 'clear') { audio.say('Menace éliminée. Primes versées par la sécurité de Halden.'); setTimeout(() => toast(`Menace éliminée · primes : +${a.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} ¤ · capsules d'épave à récupérer (repères jaunes du radar)`), 2500); }
    if (e === 'gone') toast('Les pirates décrochent');
    if (e === 'safe') toast('Zone protégée de Halden-7 · armes verrouillées');
    if (e === 'nogun') toast('Aucune arme de vaisseau installée · Équipement naval');
    if (e === 'nomissile') toast('Aucun lance-missiles installé · Équipement naval');
    if (e === 'nomissiles') toast('Plus de missiles · réarmement à l\'atterrissage');
    if (e === 'nolock') toast('Pas de verrouillage · gardez la cible dans l\'axe pendant 3 s');
    if (e === 'launch') toast(`Missile lancé · ${plural(a, 'restant', 'restants')}`);
    if (e === 'destroyed') { audio.say('Alerte. Perte d\'intégrité de la coque. Éjection.'); toast('Héron détruit !'); }
    if (e === 'disabled') { audio.say('Cargo pirate désemparé. Arrimage possible.'); toast(`${a.K.name} désemparé · approchez à moins de 150 m, ralentissez · ${touch ? 'ABORD.' : 'E / B'} : arrimer et aborder`); }
    if (e === 'docked') { flight.lastDock = flight.dockedAt; toast('Arrimage · passage du sas'); }
    if (e === 'escorts') toast('Impossible d\'arrimer : éliminez d\'abord les escortes');
    if (e === 'escaped') toast(`${a.K.name} s'est échappé`);
    if (e === 'scuttled') toast('Le cargo pirate se saborde derrière vous');
    if (e === 'salvage') toast(`Capsule récupérée · composants revendus +${a.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} ¤${b}`);
    if (e === 'respawn') toast(`Rapatrié à Halden-7 · Héron remplacé · franchise d'assurance −${a.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} ¤${b > 0.1 ? ` · minerai perdu` : ''}`);
  };
  for (const d of ctx.doors) d.onMove = (opening) => audio.door(new THREE.Vector3(d.x, 2, d.z), opening);

  // ------------------------------------------------------------------ interactions
  const heron = ctx.ships.heron;
  const seat = heron.interior.seat;
  const interactables = [
    { pos: heron.interior.seatTrigger, r: 2.0, label: 'E — S\'installer aux commandes', fn: () => { player.sit(seat); toast('Héron Mk II · HL-2207 · systèmes en veille · autorisation de départ en attente'); audio.blip(); } },
    { pos: new THREE.Vector3(-29.9, 0, 3.1), r: 1.4, label: 'E — Prendre un café (3 ¤)', fn: () => { if (game.pay(3)) { audio.coffee(); toast('Café serré · 3 ¤ débités'); } else toast('Crédits insuffisants'); } },
    { pos: new THREE.Vector3(ctx.kiosk.x, 0, ctx.kiosk.z), r: 3.7, label: 'E — Commander au kiosque (5 ¤)', fn: () => { if (game.pay(5)) { audio.coffee(); toast('« Et voilà, bonne escale ! » · 5 ¤'); } else toast('Crédits insuffisants'); } },
  ];
  interactables.push({ pos: ctx.recruit.customer, r: 1.6, label: 'E — Guilde des équipages : recruter', fn: () => openUI(() => shop.openRecruit(crew)) });
  mining.onEvent = (e, k) => {
    const M = { nolaser: 'Aucun laser de minage installé · Équipement naval, galerie', on: 'Mode minage · vitesse réduite · visez une roche avec le nez du vaisseau', off: 'Mode minage désactivé',
      fracture: 'Fracture réussie · extrayez les fragments', overcharge: 'Surcharge ! La roche s\'est pulvérisée', full: 'Bac à minerai plein · direction la raffinerie d\'Ardent-3', depleted: 'Fragment épuisé' }[e];
    if (M) toast(M);
    if (e === 'fracture' || e === 'overcharge') audio.blip();
  };
  crew.onEvent = (e, x) => {
    if (e === 'hired') { audio.blip(); }
    if (e === 'boarded') toast(`Équipage à bord : ${x} ${x > 1 ? 'personnes' : 'personne'}`);
  };
  // ------------------------------------------------------------------ module habitat : ascenseurs, bar, infirmerie, cabine
  const HB = ctx.habitat;
  const fadeEl = $('fade');
  const fadeDo = (fn, hold = 450) => { fadeEl.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => fadeEl.classList.remove('on'), hold); }, 480); };
  const elevators = new Elevators(HB.shafts, player);
  ctx.elevators = elevators;
  elevators.onEvent = (e, S, carried) => {
    if (e === 'start' || e === 'arrived') audio.blip();
    if (e === 'called') toast('Ascenseur appelé · cabine en approche');
    if (e === 'arrived' && carried) toast(S.y > 1 ? 'Pont habitat · bar La Comète, infirmerie, cabines' : 'Rez-de-chaussée · galerie marchande');
  };
  for (const S of HB.shafts) {
    for (const y of [0, DECK_Y]) {
      interactables.push({ pos: S.inside(y), r: 1.2, when: () => elevators.isAt(S, y), label: y === 0 ? 'E — Ascenseur : monter au pont habitat' : 'E — Ascenseur : descendre à la galerie', fn: () => elevators.ride(S) });
      interactables.push({ pos: new THREE.Vector3(S.x1 + 1.3, y, S.c), r: 1.3, when: () => !elevators.isAt(S, y) && !S.moving, label: 'E — Appeler l\'ascenseur', fn: () => elevators.call(S, y) });
      interactables.push({ pos: new THREE.Vector3(S.x1 + 1.3, y, S.c), r: 1.3, when: () => S.moving, label: 'Ascenseur en mouvement…', fn: () => null });
    }
  }
  // ------------------------------------------------------------------ mobilier interactif : distributeurs, borne, sièges
  const CANS = ['Soda d\'agrumes', 'Thé glacé de Lys', 'Boisson énergisante « Postcombustion »', 'Eau minérale de comète'];
  for (const v of ctx.furnish.vending) interactables.push({ pos: v.pos, r: 1.4, label: 'E — Distributeur : canette (4 ¤)', fn: () => {
    if (!game.pay(4)) return 'Crédits insuffisants';
    audio.blip(); toast(`${CANS[Math.floor(Math.random() * CANS.length)]} · −4 ¤`);
  } });
  for (const tm of ctx.furnish.terminals) interactables.push({ pos: tm.pos, r: 1.4, label: 'E — Borne : plan de la station', fn: () => {
    audio.blip(); toast('Hangar 07 : est, par le sas · Boutiques : côté nord · Module habitat et ascenseurs : porte ouest · Contrats de fret : quai du hangar');
  } });
  const F = ctx.furnish;
  interactables.push({ pos: F.diag.pos, r: 1.4, label: 'E — Terminal de diagnostic du Héron', fn: () => {
    audio.blip();
    const sh = game.d.ship, hull = Math.round((game.d.hull ?? 6000) / 60);
    const guns = ['wingL', 'wingR', 'chin'].map((k) => sh[k] && ITEM[sh[k]].name.split('«')[0].trim()).filter(Boolean).join(', ') || 'aucune arme';
    toast(`Héron HL-2207 · coque ${hull} % · ${ITEM[sh.shield]?.name.split('«')[0].trim() || 'bouclier'} · ${guns}${sh.dorsal ? ' · tourelle' : ''}${sh.mining ? ' · laser de minage' : ''} · soute ${cargo.holdFree()} emplacements libres`);
  } });
  interactables.push({ pos: F.locker.pos, r: 1.3, label: 'E — Casier personnel (tenue, équipement)', fn: () => openUI(() => shop.openInventory()) });
  const NOTICES = ['« Recherche artilleur expérimenté, convois vers Lys. Voir la Guilde des équipages. »', '« Vends pièces de canon B2, bon état. Demander Oriane, Équipement naval. »', '« Primes doublées sur les pirates de la ceinture d\'Ardent ce cycle. »', '« Colocation cabine 14, pont habitat. Calme exigé. »'];
  interactables.push({ pos: F.board.pos, r: 1.4, label: 'E — Panneau d\'annonces', fn: () => { toast(NOTICES[Math.floor(Math.random() * NOTICES.length)]); } });
  /** Sièges pour le joueur : bancs de la galerie, chaises, banquettes et canapés du pont. */
  const playerSeat = (x, y, z, yaw, ref) => {
    const fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const S = { pos: new THREE.Vector3(x, y, z), yaw, eye: new THREE.Vector3(x, y + 1.15, z).addScaledVector(fw, 0.08), exit: new THREE.Vector3(x, y, z).addScaledVector(fw, 0.75), ref };
    interactables.push({ pos: new THREE.Vector3(x, y, z).addScaledVector(fw, 0.6), r: 0.9, when: () => !ref.taken && !player.seated, label: 'E — S\'asseoir', fn: () => { ref.taken = 'player'; player.sit(S); } });
  };
  const CW = crowd.world;
  for (const b of [...(CW.benchesWindow || []), ...(CW.benchesMid || [])]) playerSeat(b.x, 0, b.z, b.yaw, b);
  for (const c of [...HB.chairs, ...HB.benches]) playerSeat(c.p.x, c.p.y, c.p.z, c.yaw, c);
  for (const s2 of ctx.furnish.sofas) playerSeat(s2.x, s2.y, s2.z, s2.yaw, s2);
  const OCCUPANTS = { '08': 'un mécanicien de nuit', '10': 'une pilote de convoi', '14': 'un négociant de Corvin' };
  for (const d of HB.cabinDoors) interactables.push({ pos: d.pos, r: 1.3, label: `E — Cabine ${d.num}`, fn: () => {
    audio.blip();
    toast(d.busy ? `Cabine ${d.num} · occupée par ${OCCUPANTS[d.num] || 'un résident'} · « Ne pas déranger »` : `Cabine ${d.num} · libre · location à la nuit 120 ¤ (votre cabine 12 vous attend, porte suivante)`);
  } });
  const DRINKS = ['Thé fumé de Lys', 'Bière de soute', 'Café serré', 'Eau pétillante recyclée', 'Liqueur d\'aurélite (sans aurélite)'];
  const GOSSIP = ['« Les cargos pirates passent souvent près de la ceinture d\'Ardent. »', '« Corvin paie bien le cuivre, ces temps-ci. »', '« Lys rachète le titane au prix fort. »', '« Une alerte au hangar 07 ? Ça arrive plus qu\'on ne croit. »', '« Embauchez un artilleur, la tourelle ne se sert pas toute seule. »'];
  interactables.push({ pos: HB.bar, r: 1.6, label: 'E — Commander au bar (8 ¤)', fn: () => {
    if (!game.pay(8)) return 'Crédits insuffisants';
    audio.coffee(); toast(`${DRINKS[Math.floor(Math.random() * DRINKS.length)]} · ${GOSSIP[Math.floor(Math.random() * GOSSIP.length)]}`);
  } });
  interactables.push({ pos: HB.clinic, r: 1.6, label: 'E — Consultation à l\'infirmerie (250 ¤)', fn: () => {
    if (!game.pay(250)) return 'Crédits insuffisants';
    ctx.ground.hp = 100; game.d.owned.medpen = (game.d.owned.medpen || 0) + 1; game.save();
    audio.blip(); toast('Soins complets · un stylo médical offert pour la route');
  } });
  interactables.push({ pos: HB.bunk, r: 2.4, label: 'E — Se reposer dans la cabine 12', fn: () => {
    fadeDo(() => {
      ctx.ground.hp = 100; missions.persist(); game.save();
      const h = ctx.time.hour;
      if (h >= 19 || h < 6) { ctx.time.setHour(7); toast('Nuit de sommeil · réveil à 07:00 · santé au maximum · partie sauvegardée'); }
      else toast('Repos · santé au maximum · partie sauvegardée');
    }, 1400);
  } });
  interactables.push({ pos: ctx.quai.terminal, r: 1.5, label: 'E — Terminal des contrats de fret', fn: () => openUI(() => shop.openBoard(missions)) });
  missions.onEvent = (e, o, fee) => {
    if (e === 'complete') {
      const w = crew.wages(), paid = Math.min(w, game.credits);
      if (paid) game.pay(paid);
      toast(`Contrat rempli · ${o.client} · +${o.reward.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} ¤${paid ? ` · salaires d'équipage −${paid.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} ¤` : ''}`);
      audio.say('Livraison confirmée. Paiement transféré.');
    }
    if (e === 'loaded') toast(`${o.n} caisses chargées dans la soute · retour à Halden-7`);
    if (e === 'abandon') toast(`Contrat abandonné · pénalité ${fee} ¤`);
  };
  for (const [id, sp] of Object.entries(ctx.shopSpots)) {
    if (!STORES[id]) continue;
    interactables.push({ pos: sp.customer.clone().setY(0), r: 1.6, when: () => ctx.time.open(id), label: `E — ${STORES[id].label} : parler au vendeur`, fn: () => openUI(() => shop.openStore(id)) });
    interactables.push({ pos: sp.entry.clone().setY(0), r: 2.2, when: () => !ctx.time.open(id), label: `${STORES[id].label} · fermé · ouvre à ${ctx.time.opensAt(id)}`, fn: () => null });
  }
  // ------------------------------------------------------------------ boutiques et inventaire
  const credEl = $('credits');
  const showCredits = () => { credEl.textContent = game.credits.toLocaleString('fr-FR').replace(/\u202f/g, ' ') + ' ¤'; };
  game.on(showCredits); showCredits();
  const shop = new ShopUI({
    state: game,
    canEquipShip: () => flight.state === 'parked',
    onAction: (a, it) => { if (a === 'buy' && it?.eat) audio.coffee(); else audio.blip(); },
    onClose: () => {
      input.enabled = true;
      if (touch) $('touch').classList.remove('hidden');
      else $('view').requestPointerLock?.();
    },
  });
  ctx.shop = shop;
  function openUI(fn) {
    input.enabled = false; input.keys.clear(); input.move.x = input.move.y = 0;
    $('touch').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    fn();
  }
  let toastT = 0;
  function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.remove('hidden'); toastT = 4; }

  // ------------------------------------------------------------------ menu / démarrage
  let running = false;
  const start = () => {
    $('start').classList.add('hidden');
    $('hud').classList.remove('hidden');
    if (touch) $('touch').classList.remove('hidden');
    input.enabled = true;
    running = true;
    if (!touch) $('view').requestPointerLock?.();
    audio.start($('sound').checked);
    if ($('go').textContent !== 'Reprendre') toast('Boutiques, armurerie, recrutement : galerie marchande, par le sas droit devant vous');
    $('go').textContent = 'Reprendre';
  };
  $('go').addEventListener('click', start);
  $('quality').addEventListener('change', (e) => { saveQuality(e.target.value); location.reload(); });
  $('sound').addEventListener('change', (e) => audio.setEnabled(e.target.checked));
  const openMenu = () => {
    running = false; input.enabled = false;
    $('start').classList.remove('hidden'); $('touch').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  };

  // ------------------------------------------------------------------ simulation
  function simulate(dt, t) {
    mats.shared.uTime.value = t;
    ctx.time.update(dt);
    const blockers = crowd.blockers(player);
    for (const u of scenes.updaters) u(dt, t, blockers);
    crowd.update(dt, player, camera.position);
    ctx.actors = blockers;
    for (const d of ctx.doors) d.update(dt, blockers);
    for (const u of ctx.updaters) u(dt, t);
    ctx.crew?.update(dt);
    ctx.mining?.update(dt, ctx.input || { firing: false });
    ctx.combat?.update(dt, ctx.input || { firing: false });
    ctx.ground?.update(dt);
    ctx.cargo?.update(player);
    sky.update(dt, t, camera);
    const c = camera.position, insideStation = (c.x > -HX_ && c.x < HX_ && c.z > -46 && c.z < 31 && c.y < 25) || (c.x < -40 && c.x > -103 && c.z > -25 && c.z < 11);
    scene.fog.density += ((insideStation ? 0.0042 : 0.0) - scene.fog.density) * Math.min(1, dt * 3);
  }

  ctx.simulate = simulate;
  ctx.player = player;
  ctx.interactables = () => interactables;
  ctx.seat = seat;
  $('loading').classList.add('hidden');

  // ------------------------------------------------------------------ mode capture d'écran (revue artistique)
  if (shotName) {
    const sim = +(params.get('sim') || 0);
    const s = SHOTS[shotName];
    if (s) { player.pos.set(s.pos[0], 0, s.pos[2]); }
    if (params.get('player')) {
      player.pos.set(...params.get('player').split(',').map(Number));
      player.yaw = +(params.get('yaw') || 0); player.pitch = +(params.get('pitch') || 0);
    }
    if (params.get('tp')) { player.thirdPerson = true; player.camDist = 3; }
    const dt = 1 / 30;
    for (let i = 0; i < sim * 30; i++) simulate(dt, i * dt);
    const place = () => {
      if (s && !params.get('player')) {
        camera.position.set(...s.pos); camera.lookAt(new THREE.Vector3(...s.look));
        if (s.fov) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
      } else player._updateCamera(dt);
    };
    let frames = 0;
    const one = () => {
      simulate(dt, sim + frames * dt);
      place();
      renderer.render(dt);
      frames++;
      if (frames >= (+params.get('frames') || 4)) { window.__shotReady = true; return; }
      requestAnimationFrame(one);
    };
    one();
    window.__app = ctx;
    return;
  }

  $('start').classList.remove('hidden');

  // ------------------------------------------------------------------ HUD du fret : contrats en cours et repère de navigation
  const navEl = $('nav'), navTxt = navEl.querySelector('span'), jobsEl = $('jobs');
  let jobsAcc = 1, persistAcc = 0;
  const _p = new THREE.Vector3();
  let inShop = null;
  const VENDORS = { nouilles: 'Mei', armes: 'Bastien Kestrel', pieces: 'Oriane', pharma: 'Dr Salek', combis: 'Ines Vega' };
  function shopGreeting() {
    let here = null;
    for (const [id, sp] of Object.entries(ctx.shopSpots || {})) {
      if (!STORES[id]) continue;
      if (Math.abs(player.pos.x - sp.inside.x) < 4 && player.pos.z > sp.entry.z + 1.3 && player.pos.z < sp.entry.z + 8 && player.pos.y < 2) { here = id; break; }
    }
    if (here && here !== inShop && !flight.active) toast(`${VENDORS[here] || 'Le vendeur'} : ${STORES[here].greet}`);
    inShop = here;
  }
  function updateFreightHud() {
    shopGreeting();
    jobsAcc += 1 / 60;
    if ((persistAcc += 1 / 60) > 4) { persistAcc = 0; missions.persist(); }
    if (jobsAcc > 0.25) {
      jobsAcc = 0;
      const lines = missions.active.map((o) => `<b>${o.type === 'in' ? 'COLLECTE' : o.type === 'container' ? 'CONTENEUR' : o.type === 'raid' ? 'SÉCURITÉ' : 'LIVRAISON'}</b> ${o.type === 'raid' ? o.dest.name : o.goods} · ${missions.status(o)}`);
      if (crew.members.length) {
        const aboard = crew.members.filter((m) => m.aboard).length, g = crew.gunner();
        lines.push(`<b>ÉQUIPAGE</b> ${crew.members.length} · ${aboard ? `${aboard} à bord` : crew.members.map((m) => `${m.data.name.split(' ')[0]} ${crew.status(m)}`).join(' · ')}${flight.active && heronGear.meshes.dorsal ? (g ? ` · tourelle : ${g.data.name.split(' ')[0]}` : ' · tourelle sans artilleur') : ''}`);
      }
      jobsEl.innerHTML = lines.join('<br>');
    }
    // repère d'orientation : la galerie marchande tant qu'elle n'a pas été visitée
    if (!game.d.galleryVisited && player.pos.x < -44 && !flight.active) { game.d.galleryVisited = true; game.save(); }
    const way = !game.d.galleryVisited && !flight.active && !ground.armed && player.pos.x > -33 ? { pos: new THREE.Vector3(-37, 1.6, -2), name: 'Galerie marchande · boutiques, recrutement' } : null;
    const T = missions.navTarget() || (flight.active ? mining.navTarget(ardent) : null) || way;
    if (!T || shop.isOpen) { navEl.classList.add('hidden'); return; }
    const from = flight.active ? flight.pos : player.pos;
    const d = from.distanceTo(T.pos);
    _p.copy(T.pos).project(camera);
    const behind = _p.z > 1;
    let x = _p.x, y = _p.y;
    if (behind) { x = -x; y = -y; }
    const edge = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.86;
    if (edge) { const k = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.86, 1e-3); x /= k; y /= k; }
    navEl.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`; navEl.style.top = `${(-y * 0.5 + 0.5) * innerHeight}px`;
    navEl.classList.toggle('edge', edge);
    navEl.classList.remove('hidden');
    navTxt.textContent = `${T.name} · ${d > 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d) + ' m'}`;
  }

  // ------------------------------------------------------------------ commandes tactiles contextuelles
  // Un bouton principal (gros) et au plus quelques boutons secondaires, selon la situation.
  const TB = {};
  for (const id of ['t-run', 't-view', 't-use', 't-fly', 't-up', 't-down', 't-mine', 't-fire', 't-msl', 't-gun', 't-med']) TB[id] = $(id);
  const SLOTS = [[100, 14], [96, 84], [34, 106], [168, 22], [162, 94], [108, 156], [40, 176]];
  let tbKey = '';
  function touchUI() {
    const main = { id: null, label: '' }, smalls = [];
    const add = (id, label, slot) => smalls.push({ id, label, slot });
    const onFootNow = !flight.active || ground.onFoot;
    const prompt = !promptEl.classList.contains('hidden');
    if (!onFootNow) {
      const fr = combat.boardable();
      if (flight.away) {
        const pad = flight.dockedAt;
        if (!pad.boarding && !(ground.raid && !ground.raid.done)) { main.id = 't-use'; main.label = 'OPS'; }
        else if (ground.canDisembark()) { main.id = 't-gun'; main.label = pad.boarding ? 'SOUTE' : 'DESC.'; }
        add('t-fly', 'DÉCOL.', 0);
        if (main.id !== 't-gun' && ground.canDisembark()) add('t-gun', 'DESC.', 1);
        add('t-view', 'VUE', 3);
      } else if (flight.state === 'flying') {
        if (mining.mode || combat.guns.length) { main.id = 't-fire'; main.label = mining.mode ? 'LASER' : 'TIR'; }
        add('t-down', '▼', 0); add('t-up', '▲', 1);
        if (flight.nearPad()) add('t-fly', 'POSER', 2);
        else if (fr) add('t-use', 'ABORD.', 2);
        if (mining.laser && (mining.mode || mining.inField(flight.pos))) add('t-mine', mining.mode ? 'QUITTER' : 'MIN', 3);
        if (combat.launchers && !mining.mode) add('t-msl', 'MSL', 4);
        add('t-view', 'VUE', 5);
      } else add('t-view', 'VUE', 0);
    } else if (player.seated === seat) {
      main.id = 't-fly'; main.label = 'DÉCOL.';
      add('t-use', 'LEVER', 0); add('t-view', 'VUE', 1);
    } else if (player.seated) {
      main.id = 't-use'; main.label = 'LEVER';
      add('t-view', 'VUE', 0);
    } else if (ground.drawn) {
      main.id = 't-fire'; main.label = 'TIR';
      add('t-msl', 'RECH.', 0); add('t-gun', 'RANGER', 1);
      if (prompt) add('t-use', 'E', 2);
      if (ground.hp < 100 && game.free('medpen') > 0) add('t-med', 'SOIN', 3);
      add('t-run', 'COURIR', 4); add('t-view', 'VUE', 5);
    } else {
      main.id = 't-use'; main.label = 'E';
      add('t-run', 'COURIR', 0); add('t-view', 'VUE', 1);
      if (ground.armed) add('t-gun', 'ARME', 2);
      if (ground.hp < 100 && ground.armed && game.free('medpen') > 0) add('t-med', 'SOIN', 3);
    }
    const dimMain = main.id === 't-use' && main.label === 'E' && !prompt;
    const key = `${main.id}:${main.label}:${dimMain}|` + smalls.map((b) => b.id + b.label + b.slot).join(',');
    if (key === tbKey) return;
    tbKey = key;
    for (const el of Object.values(TB)) { el.classList.remove('show', 'main', 'dim'); }
    if (main.id) {
      const el = TB[main.id];
      el.classList.add('show', 'main'); el.classList.toggle('dim', dimMain); el.textContent = main.label;
      el.style.right = '18px'; el.style.bottom = '20px';
    }
    for (const b of smalls) {
      const el = TB[b.id];
      if (el.classList.contains('main')) continue;
      el.classList.add('show'); el.textContent = b.label;
      el.style.right = `${SLOTS[b.slot][0]}px`; el.style.bottom = `${SLOTS[b.slot][1]}px`;
    }
    TB['t-run'].classList.toggle('on', !!input.touchRun);
  }

  // ------------------------------------------------------------------ boucle
  let last = performance.now(), t = 0, fpsAcc = 0, fpsN = 0, shadowTick = 0;
  const clockEl = $('clock'), fpsEl = $('fps'), promptEl = $('prompt');
  function frame() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;
    input.update();
    if (input.consume('menu') && !shop.isOpen) openMenu();
    if (input.consume('inv') && running && !flight.active && !shop.isOpen) openUI(() => shop.openInventory());
    if (running && !shop.isOpen) {
      if (flight.active && !ground.onFoot) {
        // ------------------------------------------------ en vol
        if (input.consume('view')) flight.toggleView();
        if (input.consume('mine') && flight.state === 'flying') mining.toggle();
        flight.update(dt, input);
        const np = flight.state === 'flying' && flight.nearPad();
        let label;
        if (flight.away) {
          const pad = flight.dockedAt;
          const n = missions.dockActions(pad).length;
          const raid = ground.raid && !ground.raid.done;
          const G = touch ? 'ARME' : 'G';
          if (pad.boarding) label = raid ? `${touch ? 'SOUTE' : G} — Retourner dans la soute du cargo · ${touch ? 'DÉCOL.' : 'ESPACE'} — Se désarrimer` : `Cargo pirate vidé · ${touch ? 'DÉCOL.' : 'ESPACE'} — Se désarrimer`;
          else label = raid ? `RAID EN COURS · ${touch ? 'DESC.' : G} — Descendre armé · ${touch ? 'DÉCOL.' : 'ESPACE'} — Décoller`
            : `E — Opérations à quai${n ? ` (${n})` : ''}${pad.id === 'ardent' ? ' · raffinerie, marché' : ''}${ground.canDisembark() ? ` · ${touch ? 'DESC.' : G} — Descendre` : ''} · ${touch ? 'DÉCOL.' : 'ESPACE'} — Décoller`;
          if (input.consume('draw') && ground.canDisembark()) ground.disembark();
          if (input.consume('use') && !pad.boarding) { if (raid) toast('Opérations suspendues : raid pirate sur la plateforme'); else openUI(() => shop.openDock(pad, () => missions.dockActions(pad), mining)); }
          if (input.consume('fly') || input.consume('flyKey')) flight.takeOff();
        } else {
          label = flight.state === 'flying'
            ? (np ? `${touch ? 'POSER' : 'L'} — Atterrir · ${np.name}` : (flight.insideHangar() ? 'Sortie par la baie · vitesse limitée dans le hangar'
              : mining.mode ? `Minage · ${touch ? 'TIR (maintenir)' : 'clic gauche / X : laser'} · ${touch ? 'MIN' : 'M'} : quitter`
                : combat.engaged ? `Combat · ${touch ? 'TIR' : 'clic gauche / X'} : tirer${combat.launchers ? ` · ${touch ? 'MSL' : 'R'} : missile` : ''}${touch ? '' : ' · T : cible suivante'}`
                : `${Math.round(flight.vel.length())} m/s${touch ? '' : ' · Maj : postcombustion'}${mining.laser && mining.inField(flight.pos) ? ` · ${touch ? 'MIN' : 'M'} : mode minage` : ''}`))
            : flight.state === 'spool' ? 'Démarrage des moteurs…' : flight.state === 'dead' ? 'Héron détruit · capsule de survie en route vers Halden-7…' : 'Atterrissage automatique…';
          if ((input.consume('fly') || input.consume('land')) && flight.state === 'flying') flight.land();
          const fr = combat.boardable();
          if (fr) {
            label = `${touch ? 'E' : 'E / B'} — Arrimer et aborder le ${fr.K.name}`;
            if (input.consume('board') || input.consume('use')) { if (combat.dock(fr)) { ground.startBoarding(fr); ground.disembark(); } }
          }
        }
        promptEl.classList.remove('hidden'); promptEl.textContent = label;
        input.consume('flyKey'); input.consume('use');
      } else {
        if (input.consume('view')) player.toggleView();
        if (cargo.carried) input.run = false;
        ground.footInput(dt, input);
        elevators.update(dt);
        if (elevators.riding) input.move.x = input.move.y = 0;
        if (ground.dead) input.move.x = input.move.y = 0;
        player.update(dt, input, ground.onFoot ? ground.units.filter((u) => !u.down) : [...crowd.agents.filter((a) => !a.attached), ...ground.units.filter((u) => !u.down)], ground.onFoot ? [] : [...ctx.doors, ...cargo.blockers()]);
        let near = null;
        if (ground.onFoot) near = ground.nearBoard() && !ground.dead ? { label: `E — Remonter à bord du Héron${ground.raid && !ground.raid.done ? ' (le raid continue)' : ''}`, fn: () => ground.reboard() } : null;
        else if (player.seated === seat) near = { label: touch ? 'DÉCOL. — Décoller · LEVER — Se lever' : 'ESPACE — Décoller · E — Se lever', fn: () => player.stand() };
        else if (player.seated) near = { label: 'E — Se lever', fn: () => { if (player.seated.ref) player.seated.ref.taken = null; player.stand(); } };
        else near = cargo.prompt(player);
        if (!near && !player.seated && !ground.onFoot) for (const it of interactables) if (it.pos.distanceTo(player.pos) < it.r && (!it.when || it.when())) { near = it; break; }
        promptEl.classList.toggle('hidden', !near);
        if (near) promptEl.textContent = near.label;
        if (player.seated === seat && (input.consume('fly') || input.consume('flyKey'))) { flight.takeOff(); if (player.avatar) player.avatar.root.visible = false; }
        else if (near && input.consume('use')) { const err = near.fn(); if (typeof err === 'string') toast(err); }
        input.consume('fly'); input.consume('flyKey'); input.consume('land'); input.consume('mine'); input.consume('missile'); input.consume('target'); input.consume('draw'); input.consume('hud');
      }
      input.consume('use');
    } else if (running && shop.isOpen) {
      if (flight.active && !ground.onFoot) flight.update(dt, input);
      else player.update(dt, input, crowd.agents.filter((a) => !a.attached), ctx.doors);
      $('prompt').classList.add('hidden');
    }
    simulate(dt, t);
    audio.update(dt, player, crowd, scenes);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.add('hidden'); }
    clockEl.textContent = `HALDEN-7 · ${ctx.time.label} · ${crowd.agents.filter((a) => !a.away).length} pers.`;
    renderer.setExposure(1.15 - 0.45 * ctx.time.dusk);
    updateFreightHud();
    if (touch && running) touchUI();
    if (quality.name === 'medium') { renderer.three.shadowMap.autoUpdate = false; renderer.three.shadowMap.needsUpdate = (++shadowTick % 2) === 0; }
    renderer.render(dt);
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} i/s · ${quality.name}`; fpsAcc = 0; fpsN = 0; }
    requestAnimationFrame(frame);
  }
  frame();
  window.__app = ctx;
  window.__THREE = THREE;
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }

boot().catch((e) => { console.error(e); loadtext.textContent = 'Erreur : ' + e.message; window.__shotReady = true; });
