import * as THREE from 'three';
import { Renderer } from './core/renderer.js';
import { PRESETS, detectQuality, saveQuality, isTouchDevice } from './core/quality.js';
import { Materials } from './world/materials.js';
import { Builder } from './world/builder.js';
import { Sky } from './world/sky.js';
import { buildHangar } from './world/hangar.js';
import { buildLighting } from './world/lighting.js';
import { buildFX } from './world/fx.js';
import { buildShips } from './world/ships.js';
import { buildProps } from './world/props.js';
import { buildGallery } from './world/gallery.js';
import { SHOTS } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const loadbar = document.getElementById('loadbar');
const loadtext = document.getElementById('loadtext');
if (isTouchDevice()) document.body.classList.add('is-touch');

async function boot() {
  const qName = detectQuality();
  const quality = { ...PRESETS[qName] };
  document.getElementById('quality').value = qName;

  const renderer = new Renderer(document.getElementById('view'), quality);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x262a30, 0.0095);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 12000);
  camera.position.set(0, 1.7, 20);

  const manager = new THREE.LoadingManager();
  manager.onProgress = (url, a, b) => { loadbar.style.width = `${(a / b) * 100}%`; loadtext.textContent = `Chargement ${a}/${b}`; };
  const loaded = new Promise((res) => { manager.onLoad = res; });

  const mats = new Materials(renderer, quality, manager);
  mats.preload();
  const builder = new Builder(scene);
  const ctx = { scene, camera, renderer, quality, mats, builder, manager, updaters: [] };

  const sky = new Sky(scene, quality);
  buildHangar(ctx);
  ctx.ships = buildShips(ctx);
  buildProps(ctx);
  buildGallery(ctx);
  ctx.actors = [];
  ctx.updaters.push((dt) => { for (const d of ctx.airlockDoors) d.update(dt, ctx.actors); });
  ctx.lights = buildLighting(ctx);
  builder.finalize();
  if (shotName) console.log('shot-info', JSON.stringify({ colliders: builder.colliders.length, obstacles: builder.obstacles.length }));
  ctx.fx = buildFX(ctx);

  await loaded;
  renderer.setupPost(scene, camera);
  renderer.setExposure(1.0);
  renderer.resize();
  addEventListener('resize', () => renderer.resize());

  document.getElementById('loading').classList.add('hidden');

  let last = performance.now();
  let t = 0, frames = 0;
  if (shotName && SHOTS[shotName]) {
    const s = SHOTS[shotName];
    camera.position.set(...s.pos);
    camera.lookAt(new THREE.Vector3(...s.look));
    if (s.fov) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
  } else {
    document.getElementById('start').classList.remove('hidden');
  }

  function frame() {
    const nowT = performance.now(); const dt = Math.min((nowT - last) / 1000, 0.1); last = nowT;
    t += dt;
    mats.shared.uTime.value = t;
    sky.update(dt, t, camera);
    for (const u of ctx.updaters) u(dt, t);
    renderer.render(dt);
    frames++;
    if (shotName) {
      const now = performance.now();
      console.log(`frame ${frames} ${(now - (window.__last || now)).toFixed(0)} ms`);
      window.__last = now;
      if (frames >= (+params.get('frames') || 4)) {
        const i = renderer.three.info;
        console.log('render-info', JSON.stringify({ calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, progs: i.programs.length }));
        window.__shotReady = true; return;
      }
    }
    requestAnimationFrame(frame);
  }
  frame();
  window.__app = ctx;
}

boot().catch((e) => { console.error(e); loadtext.textContent = 'Erreur : ' + e.message; window.__shotReady = true; });
