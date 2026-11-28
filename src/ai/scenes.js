import * as THREE from 'three';
import { makeForklift, makeTug, makeTrailer, makeScissorLift, makeFuelCart, PathDriver } from '../vehicles/vehicles.js';
import { metricBox } from '../world/materials.js';
import { HX, Z_BACK, PADS } from '../world/layout.js';

// Scènes de travail : ravitaillement (flexible réel), soudure sur nacelle (étincelles),
// chariot élévateur qui charge le cargo, tracteur + remorque en boucle.

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// --------------------------------------------------------------------------- flexible dynamique
class Hose {
  constructor(scene, mat, radius = 0.045) {
    this.mat = mat; this.radius = radius;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.pts = Array.from({ length: 6 }, () => new THREE.Vector3());
  }
  /** a = départ (enrouleur), b = extrémité ; le flexible traîne au sol entre les deux. */
  set(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const p = this.pts;
    p[0].copy(a);
    p[1].set(a.x + (b.x - a.x) * 0.12, Math.max(0.05, a.y * 0.3), a.z + (b.z - a.z) * 0.12);
    p[2].set(a.x + (b.x - a.x) * 0.35 + Math.sin(d) * 0.3, 0.04, a.z + (b.z - a.z) * 0.35 + Math.cos(d) * 0.3);
    p[3].set(a.x + (b.x - a.x) * 0.7, 0.04, a.z + (b.z - a.z) * 0.7);
    p[4].set(a.x + (b.x - a.x) * 0.9, Math.max(0.05, b.y * 0.35), a.z + (b.z - a.z) * 0.9);
    p[5].copy(b);
    const curve = new THREE.CatmullRomCurve3(p, false, 'centripetal');
    const g = new THREE.TubeGeometry(curve, 36, this.radius, 6, false);
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
  }
}

// --------------------------------------------------------------------------- étincelles
class Sparks {
  constructor(scene, quality) {
    const N = 260;
    this.N = N;
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3); this.life = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('life', new THREE.BufferAttribute(this.life, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPR: { value: Math.min(devicePixelRatio, 2) } },
      vertexShader: `attribute float life; varying float vL; uniform float uPR;
        void main(){ vL = life; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
          gl_PointSize = life > 0.0 ? uPR * (2.0 + 5.0*life) * 3.0 / max(-mv.z, 0.5) : 0.0; }`,
      fragmentShader: `varying float vL; void main(){ if (vL <= 0.0) discard; float r = length(gl_PointCoord-0.5);
        float a = smoothstep(0.5, 0.0, r); vec3 c = mix(vec3(1.0,0.35,0.05), vec3(1.0,0.9,0.6), vL);
        gl_FragColor = vec4(c * a * (2.0 + 10.0*vL), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.light = new THREE.PointLight(0xbfd8ff, 0, 9, 2);
    scene.add(this.light);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: new THREE.Color(8, 9, 12), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, map: glowTex() }));
    this.glow.scale.setScalar(0.35);
    scene.add(this.glow);
    this.k = 0;
    this.on = false;
    this.origin = new THREE.Vector3();
    this.useLight = quality.name !== 'low';
  }
  update(dt, floorY = 0) {
    const N = this.N;
    if (this.on) {
      const n = Math.floor(dt * 260 * (0.5 + Math.random()));
      for (let i = 0; i < n; i++) {
        const k = this.k = (this.k + 1) % N;
        this.p[k * 3] = this.origin.x; this.p[k * 3 + 1] = this.origin.y; this.p[k * 3 + 2] = this.origin.z;
        const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.5;
        this.v[k * 3] = Math.cos(a) * s * 0.6; this.v[k * 3 + 1] = Math.random() * 2.5 - 0.5; this.v[k * 3 + 2] = Math.sin(a) * s * 0.6;
        this.life[k] = 0.6 + Math.random() * 0.4;
      }
      const flick = 0.4 + Math.random() * 0.6;
      this.light.intensity = this.useLight ? 30 * flick : 0;
      this.light.position.copy(this.origin);
      this.glow.visible = true;
      this.glow.position.copy(this.origin);
      this.glow.material.opacity = flick;
    } else {
      this.light.intensity = 0;
      this.glow.visible = false;
    }
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt * 1.1;
      this.v[i * 3 + 1] -= 9.8 * dt;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.p[i * 3 + 1] < floorY + 0.02) { this.p[i * 3 + 1] = floorY + 0.02; this.v[i * 3 + 1] *= -0.3; this.v[i * 3] *= 0.5; this.v[i * 3 + 2] *= 0.5; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.life.needsUpdate = true;
  }
}

let _glow = null;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

// --------------------------------------------------------------------------- mise en place
export function buildScenes(ctx) {
  const { scene, mats, ships, quality } = ctx;
  const S = { vehicles: [], updaters: [] };

  // ===== ravitaillement du Faucon
  const fau = ships.faucon;
  const cart = makeFuelCart(mats);
  const cartPos = fau.local(5.6, 0, -1.0);
  cart.group.position.copy(cartPos);
  cart.group.rotation.y = PADS.p4.heading + Math.PI / 2;
  scene.add(cart.group);
  ctx.builder.addObstacle(cartPos.x, cartPos.z, 0.8, 1.4, cart.group.rotation.y);
  cart.group.updateMatrixWorld(true);
  const reel = cart.reel.clone().applyMatrix4(cart.group.matrixWorld);
  const hose = new Hose(scene, mats.rubber(), 0.045);
  const nozzleRest = cart.group.localToWorld(new THREE.Vector3(0.7, 1.0, 1.3));
  const port = fau.service.fuelPort.clone();
  S.fuel = {
    cart: cartPos, reel, port, nozzleRest, state: 'stowed', holder: null,
    standAtPort: fau.local(2.7, 0, 4.4), standAtCart: cart.group.localToWorld(new THREE.Vector3(0.9, 0, 1.6)).setY(0),
    end: nozzleRest.clone(),
  };
  S.updaters.push(() => {
    const f = S.fuel;
    if (f.state === 'held' && f.holder) {
      const hand = f.holder.char.handR;
      if (hand) hand.getWorldPosition(f.end);
    } else if (f.state === 'connected') f.end.copy(f.port);
    else f.end.copy(f.nozzleRest);
    hose.set(reel, f.end);
  });

  // ===== soudure : nacelle à ciseaux contre le flanc gauche du fuselage, devant le bord d'attaque
  // (positions dérivées de la coque : zone de soudure, plateau, accès, hauteur de travail)
  const lift = makeScissorLift(mats);
  const liftPos = fau.service.weldLift.clone();
  lift.group.position.copy(liftPos);
  lift.group.rotation.y = PADS.p4.heading;
  scene.add(lift.group);
  ctx.builder.addObstacle(liftPos.x, liftPos.z, 0.75, 1.3, lift.group.rotation.y);
  const sparks = new Sparks(scene, quality);
  S.weld = {
    lift, sparks, target: 0.55, raised: fau.service.weldHeight, liftPos,
    board: fau.service.weldBoard.clone(), onPlatform: () => fau.service.weldStand.clone().setY(lift.h + 0.06),
    torchPoint: fau.service.weld.clone(),
    faceYaw: 0,
    welder: null, active: false,
  };
  {
    const p = S.weld.onPlatform(), q = S.weld.torchPoint;
    S.weld.faceYaw = Math.atan2(q.x - p.x, q.z - p.z);
  }
  S.updaters.push((dt, t) => {
    const w = S.weld;
    const h = lift.h + Math.sign(w.target - lift.h) * Math.min(Math.abs(w.target - lift.h), dt * 0.35);
    if (h !== lift.h) lift.setHeight(h);
    if (w.welder && w.welder.data.onLift) w.welder.pos.y = lift.h + 0.06;
    if (w.active && w.welder) {
      const hand = w.welder.char.handR;
      if (hand) { hand.getWorldPosition(_v); sparks.origin.lerpVectors(_v, w.torchPoint, 0.55); }
      // soudure par cordons : 3,5 s de soudure, 1 s de pause
      const ph = t % 4.5;
      sparks.on = ph < 3.5;
    } else sparks.on = false;
    sparks.update(dt, 0);
    S.weldOn = sparks.on;
  });

  // ===== chariot élévateur : stock -> soute du Mulet
  const mul = ships.mulet;
  const fl = makeForklift(mats);
  scene.add(fl.group);
  const crateMat = [0x5c6b4a, 0x3d4a5a, 0x8a5a2a, 0x6a6e70].map((c) => mats.paint(c, { grime: 0.8, plain: true, rough: 0.7 }));
  const crateGeo = metricBox(1.2, 1.1, 1.2, 1.5);
  const palletGeo = metricBox(1.2, 0.14, 1.2, 1);
  const palletMat = mats.plastic(0x6b5238, 0.85);
  const makeCrate = (i) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(crateGeo, crateMat[i % 4]); c.position.y = 0.69; c.castShadow = c.receiveShadow = true;
    const p = new THREE.Mesh(palletGeo, palletMat); p.position.y = 0.07; p.castShadow = true;
    g.add(c, p);
    return g;
  };
  const pickup = new THREE.Vector3(21.3, 0, 12.6);
  const W0 = [21.3, 8.0], A0 = [21.3, 10.7];
  const fk = {
    vehicle: { pos: new THREE.Vector3(W0[0], 0, W0[1]), heading: 0, speed: 0, radius: 1.6 },
    obj: fl, crate: null, loaded: [], slot: 0, state: 'wait', driver: null, forkH: 0.12, forkT: 0.12, timer: 0,
    slots: mul.cargo.slots,
  };
  fk.crate = makeCrate(0);
  fk.crate.position.copy(pickup);
  scene.add(fk.crate);
  // hauteur au sol (rampe et soute du cargo)
  const mulOrigin = mul.origin;
  const groundY = (x, z) => {
    const lx = x - mulOrigin.x, lz = z - mulOrigin.z;
    if (Math.abs(lx) < 3.6) {
      if (lz > 15.5 && lz < 20.7) return 2.3 * (1 - (lz - 15.5) / 5.2);
      if (lz <= 15.5 && lz > -10) return 2.3;
    }
    return 0;
  };
  const mx = mulOrigin.x, rz = mulOrigin.z + 23.6;
  const route = (sp) => ({
    approach: [W0, A0],
    back1: [A0, W0],
    go: [W0, [18.0, 9.2], [mx + 1.2, rz + 0.2], [mx, rz - 1.5], [mx, mulOrigin.z + 17], [mx, sp.z + 4.5], [sp.x, sp.z + 1.9]],
    back2: [[sp.x, sp.z + 1.9], [mx, sp.z + 5.0], [mx, mulOrigin.z + 17], [mx, rz - 1.5], [mx, rz]],
    ret: [[mx, rz], [mx + 2.0, rz + 0.3], [18.0, 9.2], W0],
  });
  let rt = route(fk.slots[0]);
  const setPath = (pts, opts) => { fk.path = new PathDriver(fk.vehicle, pts, { speed: 2.2, ...opts }); };
  S.forklift = fk;
  S.vehicles.push(fk.vehicle);
  const pose = (dt, t) => {
    const v = fk.vehicle;
    v.pos.y = groundY(v.pos.x, v.pos.z);
    fk.forkH += Math.sign(fk.forkT - fk.forkH) * Math.min(Math.abs(fk.forkT - fk.forkH), dt * 0.25);
    fl.carriage.position.y = fk.forkH;
    fl.group.position.copy(v.pos);
    const ahead = groundY(v.pos.x + Math.sin(v.heading) * 1.0, v.pos.z + Math.cos(v.heading) * 1.0);
    const behind = groundY(v.pos.x - Math.sin(v.heading) * 1.0, v.pos.z - Math.cos(v.heading) * 1.0);
    fl.group.rotation.set(0, v.heading, 0);
    fl.group.rotateX(-Math.atan2(ahead - behind, 2.0));
    if (fk.carry) {
      fl.group.updateMatrixWorld(true);
      fk.crate.position.copy(fl.carriage.localToWorld(_v.set(0, -0.08, 0.6)));
      fk.crate.rotation.y = v.heading;
    }
    const on = ((t * 3) % 1) < 0.5 && v.speed > 0.05;
    fl.beacon.material.color.setRGB(on ? 6 : 0.4, on ? 2.4 : 0.2, 0.3);
  };
  S.updaters.push((dt, t, blockers) => {
    const v = fk.vehicle;
    if (fk.driver && fk.driver.data.seated) {
      switch (fk.state) {
        case 'wait': fk.timer += dt; if (fk.timer > 2.0) { fk.timer = 0; fk.forkT = 0.12; fk.state = 'approach'; setPath(rt.approach, { speed: 0.8 }); } break;
        case 'approach': if (fk.path.done) { fk.forkT = 0.35; fk.state = 'lift'; fk.timer = 0; } break;
        case 'lift': fk.timer += dt; if (fk.timer > 1.8) { fk.carry = true; fk.state = 'back1'; setPath(rt.back1, { reverse: true, speed: 1.0 }); } break;
        case 'back1': if (fk.path.done) { fk.state = 'go'; setPath(rt.go, { speed: 2.2 }); } break;
        case 'go': if (fk.path.done) { fk.forkT = 0.12; fk.state = 'drop'; fk.timer = 0; } break;
        case 'drop': fk.timer += dt; if (fk.timer > 2.0) {
          fk.carry = false;
          const slot = fk.slots[fk.slot % fk.slots.length];
          fk.crate.position.copy(slot); fk.crate.rotation.y = 0;
          fk.loaded.push(fk.crate);
          fk.state = 'back2'; setPath(rt.back2, { reverse: true, speed: 1.3 });
        } break;
        case 'back2': if (fk.path.done) { fk.state = 'ret'; setPath(rt.ret, { speed: 2.2 }); } break;
        case 'ret': if (fk.path.done) {
          fk.slot++;
          if (fk.loaded.length >= fk.slots.length) { for (const c of fk.loaded) scene.remove(c); fk.loaded = []; }
          fk.crate = makeCrate(fk.slot); fk.crate.position.copy(pickup); scene.add(fk.crate);
          rt = route(fk.slots[fk.slot % fk.slots.length]);
          fk.state = 'wait'; fk.timer = 0;
        } break;
        default:
      }
      if (fk.path && ['approach', 'back1', 'go', 'back2', 'ret'].includes(fk.state)) fk.path.update(dt, blockers);
      else v.speed = 0;
    }
    pose(dt, t);
  });

  // ===== tracteur + remorque : boucle sur la voie de circulation
  const tug = makeTug(mats);
  const trailer = makeTrailer(mats);
  scene.add(tug.group, trailer.group);
  const X = HX - 6.6, ZA = -33.2, ZB = Z_BACK - 4.2;
  const loop = [[X, 12], [X, -14], [X, ZA + 3], [X - 3, ZA], [0, ZA], [-X + 3, ZA], [-X, ZA + 3], [-X, 0], [-X, ZB - 3], [-X + 3, ZB], [0, ZB], [X - 3, ZB], [X, ZB - 3]];
  const tv = { pos: new THREE.Vector3(X, 0, 12), heading: Math.PI, speed: 0, radius: 2.0 };
  const td = new PathDriver(tv, loop, { loop: true, speed: 3.2 });
  const trail = { pos: new THREE.Vector3(X, 0, 16.5), heading: Math.PI };
  S.tug = { vehicle: tv, driver: null, obj: tug, trailer: trail };
  S.vehicles.push(tv, { pos: trail.pos, heading: 0, speed: 0, radius: 2.0, get speedVal() { return tv.speed; } });
  S.updaters.push((dt, t, blockers) => {
    if (S.tug.driver && S.tug.driver.data.seated) td.update(dt, blockers);
    tug.group.position.copy(tv.pos);
    tug.group.rotation.y = tv.heading;
    // remorque : le timon suit l'attelage
    tug.group.updateMatrixWorld(true);
    const hitch = tug.group.localToWorld(_v.copy(tug.hitch)).setY(0);
    const L = 2.8;
    const dx = hitch.x - trail.pos.x, dz = hitch.z - trail.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    trail.heading = Math.atan2(dx, dz);
    trail.pos.set(hitch.x - (dx / d) * L, 0, hitch.z - (dz / d) * L);
    trailer.group.position.copy(trail.pos);
    trailer.group.rotation.y = trail.heading;
    tug.beacon.material.color.setRGB(((t * 2.5) % 1) < 0.5 ? 6 : 0.4, ((t * 2.5) % 1) < 0.5 ? 2.4 : 0.2, 0.3);
    S.tugMoving = tv.speed > 0.2;
  });
  S.tugSeat = () => tug.group.localToWorld(_v2.copy(tug.seat));
  S.forkSeat = () => fl.group.localToWorld(_v2.copy(fl.seat));
  return S;
}
