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
import { Cargo, buildQuai } from './game/cargo.js';
import { Missions } from './game/missions.js';
import { Crew } from './game/crew.js';
import { Mining } from './game/mining.js';
import { Combat } from './game/combat.js';

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
  const ctx = { scene, camera, renderer, quality, mats, builder, manager, updaters: [], screens: [] };

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
    if (e === 'takeoff') { ctx.crew?.onTakeoff(); ctx.combat?.onTakeoff(); }
    if (e === 'landed') {
      ctx.crew?.onLanded(pad);
      const rep = ctx.combat?.onLanded();
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
      airborne: [null, 'En vol · ZQSD : poussée · souris : orientation · Espace / C : monter / descendre · Q / E : roulis · V : vue'],
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
  combat.onEvent = (e, a, b, c) => {
    const fire = touch ? 'TIR' : 'clic gauche / X';
    if (e === 'wave') {
      audio.say('Alerte. Contacts hostiles en approche.');
      toast(`Contacts hostiles · ${plural(a, 'chasseur pirate', 'chasseurs pirates')} · ${b} m${mining.mode ? ` · ${touch ? 'MIN' : 'M'} : quitter le minage` : ` · ${fire} : tirer`}`);
    }
    if (e === 'kill') { toast(`${a.K.name} détruit · prime +${b.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} ¤${c ? ` · ${plural(c, 'hostile restant', 'hostiles restants')}` : ''}`); }
    if (e === 'clear') { audio.say('Menace éliminée. Primes versées par la sécurité de Halden.'); setTimeout(() => toast(`Menace éliminée · primes : +${a.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} ¤`), 2500); }
    if (e === 'gone') toast('Les pirates décrochent');
    if (e === 'safe') toast('Zone protégée de Halden-7 · armes verrouillées');
    if (e === 'nogun') toast('Aucune arme de vaisseau installée · Équipement naval');
    if (e === 'nomissile') toast('Aucun lance-missiles installé · Équipement naval');
    if (e === 'nomissiles') toast('Plus de missiles · réarmement à l\'atterrissage');
    if (e === 'nolock') toast('Pas de verrouillage · gardez la cible dans l\'axe pendant 3 s');
    if (e === 'launch') toast(`Missile lancé · ${plural(a, 'restant', 'restants')}`);
    if (e === 'destroyed') { audio.say('Alerte. Perte d\'intégrité de la coque. Éjection.'); toast('Héron détruit !'); }
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
    interactables.push({ pos: sp.customer.clone().setY(0), r: 1.6, label: `E — ${STORES[id].label} : parler au vendeur`, fn: () => openUI(() => shop.openStore(id)) });
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
    const blockers = crowd.blockers(player);
    for (const u of scenes.updaters) u(dt, t, blockers);
    crowd.update(dt, player, camera.position);
    ctx.actors = blockers;
    for (const d of ctx.doors) d.update(dt, blockers);
    for (const u of ctx.updaters) u(dt, t);
    ctx.crew?.update(dt);
    ctx.mining?.update(dt, ctx.input || { firing: false });
    ctx.combat?.update(dt, ctx.input || { firing: false });
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
  let jobsAcc = 1;
  const _p = new THREE.Vector3();
  function updateFreightHud() {
    jobsAcc += 1 / 60;
    if (jobsAcc > 0.25) {
      jobsAcc = 0;
      const lines = missions.active.map((o) => `<b>${o.type === 'in' ? 'COLLECTE' : o.type === 'container' ? 'CONTENEUR' : 'LIVRAISON'}</b> ${o.goods} · ${missions.status(o)}`);
      if (crew.members.length) {
        const aboard = crew.members.filter((m) => m.aboard).length, g = crew.gunner();
        lines.push(`<b>ÉQUIPAGE</b> ${crew.members.length} · ${aboard ? `${aboard} à bord` : crew.members.map((m) => `${m.data.name.split(' ')[0]} ${crew.status(m)}`).join(' · ')}${flight.active && heronGear.meshes.dorsal ? (g ? ` · tourelle : ${g.data.name.split(' ')[0]}` : ' · tourelle sans artilleur') : ''}`);
      }
      jobsEl.innerHTML = lines.join('<br>');
    }
    const T = missions.navTarget() || (flight.active ? mining.navTarget(ardent) : null);
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
      if (flight.active) {
        // ------------------------------------------------ en vol
        if (input.consume('view')) flight.toggleView();
        if (input.consume('mine') && flight.state === 'flying') mining.toggle();
        flight.update(dt, input);
        const np = flight.state === 'flying' && flight.nearPad();
        let label;
        if (flight.away) {
          const pad = flight.dockedAt;
          const n = missions.dockActions(pad).length;
          label = `E — Opérations à quai${n ? ` (${n})` : ''}${pad.id === 'ardent' ? ' · raffinerie, marché' : ''} · ${touch ? '⏻' : 'ESPACE'} — Décoller`;
          if (input.consume('use')) openUI(() => shop.openDock(pad, () => missions.dockActions(pad), mining));
          if (input.consume('fly') || input.consume('flyKey')) flight.takeOff();
        } else {
          label = flight.state === 'flying'
            ? (np ? `${touch ? '⏻' : 'L'} — Atterrir · ${np.name}` : (flight.insideHangar() ? 'Sortie par la baie · vitesse limitée dans le hangar'
              : mining.mode ? `Minage · ${touch ? 'TIR (maintenir)' : 'clic gauche / X : laser'} · ${touch ? 'MIN' : 'M'} : quitter`
                : combat.engaged ? `Combat · ${touch ? 'TIR' : 'clic gauche / X'} : tirer${combat.launchers ? ` · ${touch ? 'MSL' : 'R'} : missile` : ''}${touch ? '' : ' · T : cible suivante'}`
                : `${Math.round(flight.vel.length())} m/s · Maj : postcombustion${mining.laser && mining.inField(flight.pos) ? ` · ${touch ? 'MIN' : 'M'} : mode minage` : ''}`))
            : flight.state === 'spool' ? 'Démarrage des moteurs…' : flight.state === 'dead' ? 'Héron détruit · capsule de survie en route vers Halden-7…' : 'Atterrissage automatique…';
          if ((input.consume('fly') || input.consume('land')) && flight.state === 'flying') flight.land();
        }
        promptEl.classList.remove('hidden'); promptEl.textContent = label;
        input.consume('flyKey'); input.consume('use');
      } else {
        if (input.consume('view')) player.toggleView();
        if (cargo.carried) input.run = false;
        player.update(dt, input, crowd.agents.filter((a) => !a.attached), [...ctx.doors, ...cargo.blockers()]);
        let near = null;
        if (player.seated) near = { label: touch ? '⏻ — Décoller · E — Se lever' : 'ESPACE — Décoller · E — Se lever', fn: () => player.stand() };
        else near = cargo.prompt(player);
        if (!near && !player.seated) for (const it of interactables) if (it.pos.distanceTo(player.pos) < it.r) { near = it; break; }
        promptEl.classList.toggle('hidden', !near);
        if (near) promptEl.textContent = near.label;
        if (player.seated && (input.consume('fly') || input.consume('flyKey'))) { flight.takeOff(); if (player.avatar) player.avatar.root.visible = false; }
        else if (near && input.consume('use')) { const err = near.fn(); if (typeof err === 'string') toast(err); }
        input.consume('fly'); input.consume('flyKey'); input.consume('land'); input.consume('mine'); input.consume('missile'); input.consume('target');
      }
      input.consume('use');
    } else if (running && shop.isOpen) {
      if (flight.active) flight.update(dt, input);
      else player.update(dt, input, crowd.agents.filter((a) => !a.attached), ctx.doors);
      $('prompt').classList.add('hidden');
    }
    simulate(dt, t);
    audio.update(dt, player, crowd, scenes);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.add('hidden'); }
    const st = 14 * 3600 + 7 * 60 + t * 10; // 1 s réelle = 10 s à bord
    clockEl.textContent = `HALDEN-7 · ${String(Math.floor(st / 3600) % 24).padStart(2, '0')}:${String(Math.floor(st / 60) % 60).padStart(2, '0')} · ${crowd.agents.length} pers.`;
    updateFreightHud();
    if (quality.name === 'medium') { renderer.three.shadowMap.autoUpdate = false; renderer.three.shadowMap.needsUpdate = (++shadowTick % 2) === 0; }
    renderer.render(dt);
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} i/s · ${quality.name}`; fpsAcc = 0; fpsN = 0; }
    requestAnimationFrame(frame);
  }
  frame();
  window.__app = ctx;
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }

boot().catch((e) => { console.error(e); loadtext.textContent = 'Erreur : ' + e.message; window.__shotReady = true; });
