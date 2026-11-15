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

const params = new URLSearchParams(location.search);
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
  buildGallery(ctx);
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
  player.setAvatar(lib.create('UM_light', { height: 1.82, hair: 'Hair_Buzzed', hairColor: 0x2a1d14, outfit: { top: 0x2b3036, bottom: 0x2b3036, boot: 0x16181a, accent: 0x6f86a8, gloves: true, zip: false }, armor: { plate: 0x3a4148, under: 0x1b1e21, accent: 0x6e6a3a, light: 0x5fe6c8 } }));
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
  for (const d of ctx.doors) d.onMove = (opening) => audio.door(new THREE.Vector3(d.x, 2, d.z), opening);

  // ------------------------------------------------------------------ interactions
  const heron = ctx.ships.heron;
  const seat = heron.interior.seat;
  const interactables = [
    { pos: heron.interior.seatTrigger, r: 2.0, label: 'E — S\'installer aux commandes', fn: () => { player.sit(seat); toast('Héron Mk II · HL-2207 · systèmes en veille · autorisation de départ en attente'); audio.blip(); } },
    { pos: new THREE.Vector3(-29.9, 0, 3.1), r: 1.4, label: 'E — Prendre un café', fn: () => { audio.coffee(); toast('Café serré · 2,50 ¤ débités'); } },
    { pos: new THREE.Vector3(ctx.kiosk.x, 0, ctx.kiosk.z), r: 3.7, label: 'E — Commander au kiosque', fn: () => { audio.coffee(); toast('« Et voilà, bonne escale ! »'); } },
  ];
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
    sky.update(dt, t, camera);
  }

  ctx.simulate = simulate;
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

  // ------------------------------------------------------------------ boucle
  let last = performance.now(), t = 0, fpsAcc = 0, fpsN = 0, shadowTick = 0;
  const clockEl = $('clock'), fpsEl = $('fps'), promptEl = $('prompt');
  function frame() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;
    input.update();
    if (input.consume('menu')) openMenu();
    if (running) {
      if (input.consume('view')) player.toggleView();
      player.update(dt, input, crowd.agents.filter((a) => !a.attached), ctx.doors);
      let near = null;
      if (player.seated) near = { label: 'E — Se lever', fn: () => player.stand() };
      else for (const it of interactables) if (it.pos.distanceTo(player.pos) < it.r) { near = it; break; }
      promptEl.classList.toggle('hidden', !near);
      if (near) promptEl.textContent = near.label;
      if (near && input.consume('use')) near.fn();
      input.consume('use');
    }
    simulate(dt, t);
    audio.update(dt, player, crowd, scenes);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.add('hidden'); }
    const st = 14 * 3600 + 7 * 60 + t * 10; // 1 s réelle = 10 s à bord
    clockEl.textContent = `HALDEN-7 · ${String(Math.floor(st / 3600) % 24).padStart(2, '0')}:${String(Math.floor(st / 60) % 60).padStart(2, '0')} · ${crowd.agents.length} pers.`;
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
