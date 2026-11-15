import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  SMAAEffect, SMAAPreset, VignetteEffect, NoiseEffect, BlendFunction, ChromaticAberrationEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

// Moteur de rendu : WebGL2, ombres, post-traitement (AO, bloom, ACES, SMAA, vignette, grain).
export class Renderer {
  constructor(canvas, quality) {
    this.canvas = canvas;
    this.q = quality;
    const r = new THREE.WebGLRenderer({
      canvas, antialias: false, stencil: false, depth: true, powerPreference: 'high-performance',
      preserveDrawingBuffer: new URLSearchParams(location.search).has('shot'),
    });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping; // ACES appliqué dans le post-traitement
    r.shadowMap.enabled = quality.shadows;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = true;
    this.three = r;
    this.composer = null;
  }

  setupPost(scene, camera) {
    const q = this.q;
    const r = this.three;
    const composer = new EffectComposer(r, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(scene, camera));
    if (q.ao) {
      const ao = new N8AOPostPass(scene, camera, 1, 1);
      ao.configuration.aoRadius = 1.6;
      ao.configuration.distanceFalloff = 0.6;
      ao.configuration.intensity = 2.6;
      ao.configuration.aoSamples = q.aoSamples;
      ao.configuration.denoiseSamples = 4;
      ao.configuration.denoiseRadius = 8;
      ao.configuration.halfRes = !!q.aoHalf;
      ao.configuration.gammaCorrection = false;
      ao.configuration.color = new THREE.Color(0, 0, 0);
      composer.addPass(ao);
      this.ao = ao;
    }
    const effects = [];
    if (q.bloom) {
      this.bloom = new BloomEffect({
        mipmapBlur: true, luminanceThreshold: 1.1, luminanceSmoothing: 0.25, intensity: 0.75, radius: 0.72, levels: q.name === 'low' ? 5 : 7,
      });
      effects.push(this.bloom);
    }
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    effects.push(this.tone);
    effects.push(new VignetteEffect({ offset: 0.32, darkness: 0.55 }));
    if (q.name !== 'low') {
      const ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.00035, 0.0002), radialModulation: true, modulationOffset: 0.4 });
      effects.push(ca);
    }
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    grain.blendMode.opacity.value = 0.05;
    effects.push(grain);
    composer.addPass(new EffectPass(camera, ...effects));
    if (q.smaa) composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
    this.composer = composer;
    this.camera = camera;
  }

  setExposure(e) { if (this.tone) this.tone.exposure = e; this.exposure = e; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    let pr = Math.min(window.devicePixelRatio || 1, this.q.pixelRatio);
    const maxPx = this.q.maxPixels;
    if (w * h * pr * pr > maxPx) pr = Math.sqrt(maxPx / (w * h));
    this.three.setPixelRatio(pr);
    this.three.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h, false);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }

  render(dt) {
    if (this.composer) this.composer.render(dt);
    else this.three.render(this.scene, this.camera);
  }
}
