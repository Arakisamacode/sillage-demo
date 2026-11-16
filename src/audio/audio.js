import * as THREE from 'three';
import { GALLERY, HX } from '../world/layout.js';

// Ambiance sonore entièrement synthétisée (Web Audio) — aucun fichier :
// rumeur du hangar, ventilation, chocs métalliques lointains, annonces (carillon + synthèse vocale),
// soudure, moteurs et bips de recul, pas, conversations étouffées, musique générative.

const ANNOUNCES = {
  arrival: ['Navette S T quarante en provenance de la surface. Débarquement aire zéro cinq. Bienvenue à bord de Halden sept.'],
  misc: [
    'Rappel de sécurité. Le port du casque est obligatoire au-delà de la ligne jaune.',
    'Le cargo Mulet H quatre, aire zéro trois, est en cours de chargement. Merci de dégager la voie de circulation.',
    'Équipe de maintenance, aire zéro quatre, merci de contacter le contrôle de pont.',
    'Le champ de confinement de la baie sept fonctionne normalement.',
    'La galerie du Belvédère vous accueille. Le kiosque café est ouvert.',
    'Pilote du Héron, aire zéro deux, votre autorisation de départ est en attente.',
  ],
};

export class Audio {
  constructor(ctx) {
    this.ctx = ctx;
    this.ac = null;
    this.enabled = true;
    this.paTimer = 25;
    this.clankTimer = 4;
    this.voices = [];
  }

  start(enabled) {
    this.enabled = enabled;
    if (this.ac) { this.setEnabled(enabled); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = this.ac = new AC();
    this.master = ac.createGain();
    this.master.gain.value = enabled ? 0.9 : 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(ac.destination);
    this.reverb = this._reverb(2.8);
    this.reverb.connect(this.master);
    this.revSend = ac.createGain(); this.revSend.gain.value = 0.35; this.revSend.connect(this.reverb);
    this.noiseBuf = this._noise(4);
    this._ambience();
    this._music();
    this._machines();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ac.currentTime, 0.2);
    if (!on && window.speechSynthesis) speechSynthesis.cancel();
  }

  // --------------------------------------------------------------------------- utilitaires
  _noise(sec) {
    const ac = this.ac, n = ac.sampleRate * sec;
    const b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; }
    return b;
  }
  _reverb(sec) {
    const ac = this.ac, n = ac.sampleRate * sec;
    const b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    const cv = ac.createConvolver(); cv.buffer = b; return cv;
  }
  _src(loop = true) { const s = this.ac.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; return s; }
  _panner(pos, ref = 4, max = 60) {
    const p = this.ac.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = max; p.rolloffFactor = 1.2;
    if (pos) this._setPos(p, pos);
    p.connect(this.master);
    return p;
  }
  _setPos(p, v) {
    if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; } else p.setPosition(v.x, v.y, v.z);
  }

  // --------------------------------------------------------------------------- ambiance
  _ambience() {
    const ac = this.ac;
    // rumeur grave (moteurs de la station)
    const rum = this._src(); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
    this.rumble = ac.createGain(); this.rumble.gain.value = 0.55;
    rum.connect(lp).connect(this.rumble).connect(this.master); rum.start();
    // ronflement électrique 50/100 Hz
    for (const [f, g] of [[50, 0.03], [100, 0.018], [150, 0.006]]) {
      const o = ac.createOscillator(); o.frequency.value = f; const gg = ac.createGain(); gg.gain.value = g;
      o.connect(gg).connect(this.rumble); o.start();
    }
    // souffle de ventilation
    const vent = this._src(); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.4;
    this.vent = ac.createGain(); this.vent.gain.value = 0.05;
    vent.connect(bp).connect(this.vent).connect(this.master); vent.start(0, 1.3);
    // brouhaha de galerie (filtré)
    const mur = this._src(); const bp2 = ac.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 500; bp2.Q.value = 1.2;
    this.murmur = ac.createGain(); this.murmur.gain.value = 0;
    const lfo = ac.createOscillator(); lfo.frequency.value = 3.7; const lg = ac.createGain(); lg.gain.value = 0.015;
    lfo.connect(lg).connect(this.murmur.gain); lfo.start();
    mur.connect(bp2).connect(this.murmur).connect(this.master); mur.start(0, 2.1);
  }

  _clank(pos) {
    const ac = this.ac, t = ac.currentTime;
    const s = this._src(false); const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 300 + Math.random() * 1600; bp.Q.value = 12 + Math.random() * 20;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.8 + Math.random());
    const p = this._panner(pos, 6, 80);
    s.connect(bp).connect(g); g.connect(p); g.connect(this.revSend);
    s.start(t, Math.random() * 3, 2); s.stop(t + 2);
  }

  // --------------------------------------------------------------------------- annonces
  /** annonce libre (carillon + voix) */
  say(text) { this._sayText = text; this.announce('custom'); }

  announce(kind) {
    if (!this.ac || !this.enabled) return;
    const ac = this.ac, t = ac.currentTime + 0.05;
    const notes = [659.25, 830.6, 987.8];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ac.createGain(); g.gain.setValueAtTime(0, t + i * 0.32); g.gain.linearRampToValueAtTime(0.13, t + i * 0.32 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.32 + 1.6);
      o.connect(g); g.connect(this.master); g.connect(this.revSend); o.start(t + i * 0.32); o.stop(t + i * 0.32 + 1.7);
    });
    const list = ANNOUNCES[kind] || ANNOUNCES.misc;
    const text = kind === 'custom' ? this._sayText : list[Math.floor(Math.random() * list.length)];
    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      setTimeout(() => {
        if (!this.enabled) return;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'fr-FR'; u.rate = 0.92; u.pitch = 0.85; u.volume = 0.55;
        const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith('fr'));
        if (v) u.voice = v;
        speechSynthesis.speak(u);
      }, 1300);
    }
  }

  // --------------------------------------------------------------------------- machines (soudure, moteurs)
  _machines() {
    const ac = this.ac;
    // soudure : crépitement
    const s = this._src(); const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    this.weldGain = ac.createGain(); this.weldGain.gain.value = 0;
    this.weldPan = this._panner(null, 3, 40);
    s.connect(hp).connect(this.weldGain).connect(this.weldPan); s.start();
    // moteurs électriques (chariot, tracteur)
    const engine = (freq) => {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      const n = this._src(); const nb = ac.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 220; nb.Q.value = 2;
      const g = ac.createGain(); g.gain.value = 0;
      const pan = this._panner(null, 3, 50);
      o.connect(lp).connect(g); n.connect(nb).connect(g); g.connect(pan);
      o.start(); n.start(0, Math.random() * 3);
      return { o, g, pan, lp };
    };
    this.fork = engine(55);
    this.ship = engine(38);
    this.tug = engine(70);
    this.beepT = 0;
  }

  _beep(pos) {
    const ac = this.ac, t = ac.currentTime;
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 1150;
    const g = ac.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.setValueAtTime(0, t + 0.28);
    const p = this._panner(pos, 3, 40);
    o.connect(g).connect(p); o.start(t); o.stop(t + 0.3);
  }

  /** visseuse à chocs / clé pneumatique */
  _ratchet(pos) {
    const ac = this.ac, t0 = ac.currentTime;
    const p = this._panner(pos, 3, 35);
    const n = 6 + Math.floor(Math.random() * 14);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.045;
      const s = this._src(false); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 4;
      const g = ac.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      s.connect(bp).connect(g).connect(p); s.start(t, Math.random() * 3, 0.05);
    }
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 340;
    const og = ac.createGain(); og.gain.setValueAtTime(0.02, t0); og.gain.linearRampToValueAtTime(0, t0 + n * 0.045);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    o.connect(lp).connect(og).connect(p); o.start(t0); o.stop(t0 + n * 0.045 + 0.05);
  }

  step(pos, speed) {
    if (!this.ac || !this.enabled) return;
    const ac = this.ac, t = ac.currentTime;
    const inGallery = pos.x < GALLERY.x1;
    const s = this._src(false);
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = inGallery ? 1400 : 2600 + Math.random() * 800; bp.Q.value = inGallery ? 1.2 : 3;
    const g = ac.createGain(); const v = 0.12 + Math.min(0.12, speed * 0.03);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    s.connect(bp).connect(g); g.connect(this.master); g.connect(this.revSend);
    s.start(t, Math.random() * 3, 0.2);
    // résonance du pont métallique
    if (!inGallery) {
      const o = ac.createOscillator(); o.frequency.value = 90 + Math.random() * 20;
      const og = ac.createGain(); og.gain.setValueAtTime(0.05, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.16);
    }
  }

  door(pos, opening) {
    if (!this.ac || !this.enabled) return;
    if (this._doorT && this.ac.currentTime - this._doorT < 1.2) return;
    this._doorT = this.ac.currentTime;
    const ac = this.ac, t = ac.currentTime;
    const s = this._src(false); const bp = ac.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 900;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.08); g.gain.linearRampToValueAtTime(0.3, t + 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    const p = this._panner(pos, 3, 30);
    s.connect(bp).connect(g).connect(p); s.start(t, Math.random(), 1.2);
    // décompression
    const s2 = this._src(false); const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const g2 = ac.createGain(); g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    s2.connect(hp).connect(g2).connect(p); s2.start(t, Math.random(), 0.8);
  }

  coffee() {
    if (!this.ac || !this.enabled) return;
    const ac = this.ac, t = ac.currentTime;
    const s = this._src(false); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.2); g.gain.setValueAtTime(0.12, t + 2.2); g.gain.linearRampToValueAtTime(0, t + 2.6);
    s.connect(bp).connect(g).connect(this.master); s.start(t, 0, 2.7);
  }

  blip() {
    if (!this.ac || !this.enabled) return;
    const ac = this.ac, t = ac.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ac.createOscillator(); o.frequency.value = f; const g = ac.createGain();
      g.gain.setValueAtTime(0.06, t + i * 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.15);
      o.connect(g).connect(this.master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.2);
    });
  }

  // --------------------------------------------------------------------------- combat
  /** Tir : laser (chirp descendant), balistique (claquement), tourelle, pirate, missile (souffle). */
  zap(kind, vol = 0.3) {
    if (!this.ac || !this.enabled) return;
    const ac = this.ac, t = ac.currentTime;
    this._zapN = (this._zapN || 0);
    if (this._zapT === t) { if (++this._zapN > 3) return; } else { this._zapT = t; this._zapN = 0; }
    const g = ac.createGain(); g.connect(this.master);
    if (kind === 'ballistic') {
      const s = this._src(false); const bp = ac.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 1800;
      g.gain.setValueAtTime(vol * 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      s.connect(bp).connect(g); s.start(t, Math.random() * 2, 0.2);
      const o = ac.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
      const g2 = ac.createGain(); g2.gain.setValueAtTime(vol * 0.3, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g2).connect(this.master); o.start(t); o.stop(t + 0.14);
      return;
    }
    if (kind === 'missile') {
      const s = this._src(false); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.8); bp.Q.value = 0.7;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      s.connect(bp).connect(g); s.start(t, Math.random() * 2, 1.3);
      return;
    }
    const f0 = kind === 'pirate' ? 900 : kind === 'turret' ? 2200 : 1700, f1 = kind === 'pirate' ? 160 : 260;
    const o = ac.createOscillator(); o.type = kind === 'pirate' ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(f0 * (0.95 + Math.random() * 0.1), t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.13);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'pirate' ? 1400 : 3200;
    g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(lp).connect(g); o.start(t); o.stop(t + 0.17);
  }
  /** Explosion : souffle grave filtré + grondement. */
  boom(vol = 0.6) {
    if (!this.ac || !this.enabled) return;
    const ac = this.ac, t = ac.currentTime;
    const s = this._src(false); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(90, t + 1.6);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    s.connect(lp).connect(g).connect(this.master); s.connect(this.revSend); s.start(t, Math.random() * 1.5, 2.3);
    const o = ac.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    const g2 = ac.createGain(); g2.gain.setValueAtTime(vol * 0.7, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    o.connect(g2).connect(this.master); o.start(t); o.stop(t + 1.4);
  }
  /** Impact reçu : bouclier (bourdonnement électrique) ou coque (choc métallique). */
  hit(shield) {
    if (!this.ac || !this.enabled) return;
    const ac = this.ac, t = ac.currentTime;
    if (this._hitT && t - this._hitT < 0.06) return; this._hitT = t;
    const g = ac.createGain(); g.connect(this.master);
    if (shield) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(120, t + 0.25);
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 3;
      g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(bp).connect(g); o.start(t); o.stop(t + 0.32);
    } else {
      const s = this._src(false); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 2.5;
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      s.connect(bp).connect(g); s.start(t, Math.random() * 2, 0.5);
    }
  }
  /** Bourdonnement continu du laser de minage (on : actif ; k : charge 0..1 ; extract : aspiration). */
  laserHum(on, k = 0, extract = false) {
    if (!this.ac || (!this._hum && !on)) return;
    const ac = this.ac, t = ac.currentTime;
    if (!this._hum) {
      const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 70;
      const o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = 141;
      const n = this._src(); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.4;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 4;
      const g = ac.createGain(); g.gain.value = 0;
      const gn = ac.createGain(); gn.gain.value = 0.35;
      o1.connect(lp); o2.connect(lp); n.connect(bp).connect(gn).connect(g); lp.connect(g); g.connect(this.master);
      o1.start(); o2.start(); n.start();
      this._hum = { o1, o2, lp, bp, g };
    }
    const H = this._hum;
    H.g.gain.setTargetAtTime(on && this.enabled ? 0.07 + k * 0.06 : 0, t, 0.06);
    if (on) {
      H.o1.frequency.setTargetAtTime(extract ? 52 : 62 + k * 70, t, 0.1);
      H.o2.frequency.setTargetAtTime(extract ? 104 : 124 + k * 150 + Math.random() * 6, t, 0.05);
      H.lp.frequency.setTargetAtTime(extract ? 500 : 700 + k * 2200, t, 0.1);
      H.bp.frequency.setTargetAtTime(extract ? 900 : 1500 + k * 1500, t, 0.1);
    }
  }

  /** Tonalité de verrouillage missile. */
  lockTone() {
    if (!this.ac || !this.enabled) return;
    const ac = this.ac, t = ac.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 1500; const g = ac.createGain();
      g.gain.setValueAtTime(0.04, t + i * 0.09); g.gain.setValueAtTime(0, t + i * 0.09 + 0.06);
      o.connect(g).connect(this.master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.07);
    }
  }

  // --------------------------------------------------------------------------- conversations étouffées
  _voice() {
    const ac = this.ac;
    const s = this._src();
    const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
    const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const g = ac.createGain(); g.gain.value = 0;
    const pan = this._panner(null, 2, 18);
    s.connect(f1); s.connect(f2); f1.connect(lp); f2.connect(lp); lp.connect(g).connect(pan);
    s.start(0, Math.random() * 3);
    return { f1, f2, g, pan, agent: null, syl: 0, base: 0.8 + Math.random() * 0.5 };
  }

  // --------------------------------------------------------------------------- musique générative (space opera calme)
  _music() {
    const ac = this.ac;
    this.musicBus = ac.createGain(); this.musicBus.gain.value = 0.16;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    this.musicBus.connect(lp); lp.connect(this.master); lp.connect(this.revSend);
    const mrev = this._reverb(5.5); const mg = ac.createGain(); mg.gain.value = 0.7; lp.connect(mrev).connect(mg).connect(this.master);
    // progression : Ré min9 – Si♭ maj7 – Fa maj7 – Do 6/9 – Sol min9 – La sus4
    this.chords = [[50, 57, 64, 65, 69], [46, 53, 57, 62, 69], [41, 48, 57, 60, 64], [48, 55, 62, 64, 69], [43, 50, 58, 62, 65], [45, 52, 57, 62, 64]];
    this.chordI = 0;
    this.nextChord = ac.currentTime + 1;
    this.bellT = ac.currentTime + 6;
  }

  _playChord(notes, t, dur) {
    const ac = this.ac;
    for (const n of notes) {
      const f = 440 * Math.pow(2, (n - 69) / 12);
      for (const det of [-6, 5]) {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + Math.random() * 3;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500 + Math.random() * 300; lp.Q.value = 0.5;
        const g = ac.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0, t + dur * 1.15);
        o.connect(lp).connect(g).connect(this.musicBus); o.start(t); o.stop(t + dur * 1.2);
      }
    }
    // basse ronde
    const b = ac.createOscillator(); b.type = 'sine'; b.frequency.value = 440 * Math.pow(2, (notes[0] - 12 - 69) / 12);
    const bg = ac.createGain(); bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(0.18, t + 2); bg.gain.linearRampToValueAtTime(0, t + dur * 1.1);
    b.connect(bg).connect(this.musicBus); b.start(t); b.stop(t + dur * 1.2);
  }

  _bell(t) {
    const ac = this.ac;
    const ch = this.chords[this.chordI % this.chords.length];
    const n = ch[Math.floor(Math.random() * ch.length)] + 24;
    const f = 440 * Math.pow(2, (n - 69) / 12);
    const car = ac.createOscillator(); car.frequency.value = f;
    const mod = ac.createOscillator(); mod.frequency.value = f * 3.5;
    const mg = ac.createGain(); mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + 3);
    mod.connect(mg).connect(car.frequency);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 5);
    car.connect(g).connect(this.musicBus); car.start(t); mod.start(t); car.stop(t + 5.2); mod.stop(t + 5.2);
  }

  // --------------------------------------------------------------------------- mise à jour
  update(dt, player, crowd, scenes) {
    const ac = this.ac;
    if (!ac) return;
    const L = ac.listener, cam = this.ctx.camera;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) {
      L.positionX.value = cam.position.x; L.positionY.value = cam.position.y; L.positionZ.value = cam.position.z;
      L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = u.x; L.upY.value = u.y; L.upZ.value = u.z;
    } else { L.setPosition(cam.position.x, cam.position.y, cam.position.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
    const t = ac.currentTime;
    // mixage selon la zone
    const inGallery = player.pos.x < -40;
    this.rumble.gain.setTargetAtTime(inGallery ? 0.22 : 0.55, t, 0.8);
    this.vent.gain.setTargetAtTime(inGallery ? 0.03 : 0.06, t, 0.8);
    this.murmur.gain.setTargetAtTime(inGallery ? 0.045 : 0.0, t, 1.0);
    this.musicBus.gain.setTargetAtTime(inGallery ? 0.2 : 0.13, t, 2);
    // chocs métalliques lointains dans le hangar
    this.clankTimer -= dt;
    if (this.clankTimer <= 0) {
      this.clankTimer = 2 + Math.random() * 6;
      this._clank(new THREE.Vector3((Math.random() * 2 - 1) * HX, 2 + Math.random() * 10, -40 + Math.random() * 68));
    }
    // annonces périodiques
    this.paTimer -= dt;
    if (this.paTimer <= 0) { this.paTimer = 70 + Math.random() * 50; this.announce('misc'); }
    // musique
    if (t > this.nextChord - 0.5) {
      const dur = 9;
      this._playChord(this.chords[this.chordI % this.chords.length], this.nextChord, dur);
      this.chordI++;
      this.nextChord += dur;
    }
    if (t > this.bellT) { this._bell(this.bellT); this.bellT += 2.5 + Math.random() * 6; }
    // soudure
    if (scenes.weld) {
      this._setPos(this.weldPan, scenes.weld.torchPoint);
      const on = scenes.weldOn ? 0.18 * (0.5 + Math.random()) : 0;
      this.weldGain.gain.setTargetAtTime(on, t, 0.02);
    }
    // moteurs
    for (const [eng, v] of [[this.fork, scenes.forklift.vehicle], [this.tug, scenes.tug.vehicle]]) {
      this._setPos(eng.pan, v.pos);
      const sp = Math.abs(v.speed);
      eng.g.gain.setTargetAtTime(0.03 + sp * 0.05, t, 0.2);
      eng.o.frequency.setTargetAtTime(45 + sp * 22, t, 0.3);
    }
    const fl = this.ctx.flight;
    if (fl) {
      this._setPos(this.ship.pan, fl.pos);
      const on = fl.active ? 0.12 + fl.throttle * 0.5 : 0;
      this.ship.g.gain.setTargetAtTime(on, t, 0.3);
      this.ship.o.frequency.setTargetAtTime(32 + fl.throttle * 60, t, 0.4);
      this.ship.lp.frequency.setTargetAtTime(300 + fl.throttle * 900, t, 0.4);
    }
    const fk = scenes.forklift;
    if ((fk.state === 'back1' || fk.state === 'back2') && fk.vehicle.speed > 0.1) {
      this.beepT -= dt;
      if (this.beepT <= 0) { this.beepT = 0.6; this._beep(fk.vehicle.pos); }
    }
    // outils des mécaniciens au travail
    this.toolT = (this.toolT ?? 3) - dt;
    if (this.toolT <= 0) {
      this.toolT = 1.5 + Math.random() * 4;
      const w = crowd.agents.find((a) => (a.char.override === 'repair' || a.char.override === 'interact') && a.pos.distanceToSquared(player.pos) < 900 && a.role !== 'commerçant' && a.role !== 'barista');
      if (w) this._ratchet(new THREE.Vector3(w.pos.x, 0.8, w.pos.z));
    }
    // conversations : jusqu'à 3 voix sur les PNJ qui discutent près du joueur
    if (!this.voices.length) for (let i = 0; i < 3; i++) this.voices.push(this._voice());
    const talkers = crowd.agents
      .filter((a) => a.char.override === 'talk' || a.char.override === 'sitTalk')
      .map((a) => ({ a, d: a.pos.distanceToSquared(player.pos) }))
      .filter((x) => x.d < 400).sort((x, y) => x.d - y.d).slice(0, 3);
    this.voices.forEach((v, i) => {
      const tk = talkers[i];
      if (!tk) { v.g.gain.setTargetAtTime(0, t, 0.3); return; }
      const p = tk.a.pos;
      this._setPos(v.pan, { x: p.x, y: 1.6, z: p.z });
      v.syl -= dt;
      if (v.syl <= 0) {
        v.syl = 0.12 + Math.random() * 0.18;
        const pause = Math.random() < 0.15;
        v.f1.frequency.setTargetAtTime((300 + Math.random() * 500) * v.base, t, 0.03);
        v.f2.frequency.setTargetAtTime((900 + Math.random() * 1400) * v.base, t, 0.03);
        v.g.gain.setTargetAtTime(pause ? 0.0 : 0.35 + Math.random() * 0.3, t, 0.04);
      }
    });
  }
}
