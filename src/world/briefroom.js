import * as THREE from 'three';

// Salle de briefing de l'escadrille (hangar 07, côté ouest, derrière le quai) : estrade, table holographique
// projetant la carte du secteur (stations, routes, zone pirate), écrans muraux, emplacement des ailiers.

export const BRIEF = { x: -27.6, z: 19.5 };

export function buildBriefRoom(ctx) {
  const { mats, scene, builder: B } = ctx;
  const { x, z } = BRIEF;
  const dark = mats.metal(0x24282c, { rough: 0.5 }), trim = mats.metal(0x8a9096, { rough: 0.3 });
  const glow = mats.emissive(0x6fd8ff, 2.4), amber = mats.emissive(0xffa040, 2.2);
  // estrade et garde-corps
  B.cyl(3.6, 3.7, 0.2, dark, [x, 0.1, z], null, { seg: 40, collide: true, cast: false });
  B.add(new THREE.TorusGeometry(3.62, 0.03, 6, 80), glow, new THREE.Matrix4().compose(new THREE.Vector3(x, 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)), { cast: false });
  // table holographique
  B.cyl(1.25, 1.0, 0.9, dark, [x, 0.65, z], null, { seg: 32, collide: true });
  B.cyl(1.32, 1.32, 0.06, trim, [x, 1.12, z], null, { seg: 32, cast: false });
  B.cyl(1.2, 1.2, 0.02, glow, [x, 1.16, z], null, { seg: 32, cast: false });
  B.addObstacle(x, z, 1.4, 1.4, 0);
  // écrans muraux (sur le mur ouest du hangar)
  for (const dz of [-2.6, 2.6]) {
    B.box(0.12, 1.9, 2.8, dark, [-31.75, 2.6, z + dz], null, { cast: false });
    B.box(0.04, 1.6, 2.5, mats.emissive(dz < 0 ? 0x1a4a6a : 0x3a2a12, 1.4), [-31.68, 2.6, z + dz], null, { cast: false });
  }
  B.box(0.06, 0.1, 6.2, amber, [-31.7, 3.7, z], null, { cast: false });
  // hologramme : carte du secteur (stations, routes, champ d'astéroïdes, menace)
  const holo = new THREE.Group(); holo.position.set(x, 1.55, z); scene.add(holo);
  const add = (o) => { holo.add(o); return o; };
  const lineM = new THREE.LineBasicMaterial({ color: new THREE.Color(0.8, 3.0, 4.0), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const dotM = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const S = 0.00018;           // échelle : 1 m de carte = 5,5 km
  const node = (p, c, r = 0.05) => { const m = add(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), dotM(c))); m.position.set(p[0] * S, p[1] * S * 0.5, p[2] * S); return m.position; };
  const home = node([0, 0, 0], new THREE.Color(3, 2.4, 1.2), 0.08);
  const stations = { corvin: [-1500, 180, -2400], ardent: [2100, -300, -3300], lys: [-300, 650, -4800] };
  const cols = { corvin: new THREE.Color(3, 2, 0.8), ardent: new THREE.Color(3, 1.2, 0.5), lys: new THREE.Color(1, 3, 1.4) };
  const pts = {};
  for (const [k, p] of Object.entries(stations)) {
    pts[k] = node(p, cols[k]);
    add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([home, pts[k]]), lineM));
  }
  // ceinture et zone pirate près d'Ardent
  const belt = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 600 }, (_, i) => { const a = Math.random() * 6.28, r = 0.35 + Math.random() * 0.25; return [pts.ardent.x + Math.cos(a) * r, (Math.random() - 0.5) * 0.05, pts.ardent.z + Math.sin(a) * r][i % 3]; }), 3)), new THREE.PointsMaterial({ color: new THREE.Color(1.4, 1.2, 1), size: 0.012, transparent: true, opacity: 0.8, depthWrite: false }));
  add(belt);
  const threat = add(new THREE.Mesh(new THREE.RingGeometry(0.5, 0.53, 64), dotM(new THREE.Color(3.2, 0.5, 0.3)))); threat.rotation.x = -Math.PI / 2; threat.position.copy(pts.ardent).add(new THREE.Vector3(-0.25, 0, 0.3));
  const grid = add(new THREE.PolarGridHelper(1.15, 12, 6, 64, 0x2a6a8a, 0x1a3a4a)); grid.position.y = -0.38; grid.material.transparent = true; grid.material.opacity = 0.5;
  holo.scale.setScalar(1.25);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, 0.5, 40, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.2, 1.8), transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.set(x, 1.4, z); scene.add(beam);
  ctx.updaters.push((dt, t) => {
    const near = ctx.player && ctx.player.pos.distanceToSquared(new THREE.Vector3(x, ctx.player.pos.y, z)) < 900 && ctx.player.pos.y < 5;
    holo.visible = beam.visible = near;
    if (!near) return;
    holo.rotation.y = t * 0.15; threat.material.opacity = 0.5 + Math.sin(t * 4) * 0.4;
  });
  return {
    table: new THREE.Vector3(x + 1.9, 0, z), pilots: [new THREE.Vector3(x - 1.2, 0.2, z - 1.7), new THREE.Vector3(x - 1.2, 0.2, z + 1.7)],
    officer: new THREE.Vector3(x - 1.9, 0.2, z), center: new THREE.Vector3(x, 0, z),
  };
}

/** Ruines de la station Merle (chapitre 3) : anneau brisé, modules éventrés, débris, balise qui clignote. */
export function buildMerle(ctx, pos) {
  const g = new THREE.Group(); g.position.copy(pos); ctx.scene.add(g);
  const hull = ctx.mats.paint(0x4a4844, { grime: 0.95, scratch: 0.8, rust: 0.5 }), dark = ctx.mats.metal(0x1e1e20, { rough: 0.8 });
  for (let k = 0; k < 5; k++) {
    const seg = new THREE.Mesh(new THREE.TorusGeometry(120, 9, 10, 24, 0.7 + (k % 2) * 0.3), k % 2 ? dark : hull);
    seg.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.3, 0, k * 1.3 + Math.random() * 0.3);
    seg.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 30); g.add(seg);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(22, 28, 70, 16, 1, true), hull); core.rotation.set(0.4, 0, 0.25); g.add(core);
  for (let i = 0; i < 70; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2 + Math.random() * 12, 1 + Math.random() * 4, 2 + Math.random() * 14), Math.random() < 0.5 ? hull : dark);
    const a = Math.random() * 6.28, r = 40 + Math.random() * 260;
    b.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 120, Math.sin(a) * r); b.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    b.userData.spin = (Math.random() - 0.5) * 0.2; g.add(b);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.8, 0.5) })); beacon.position.set(0, 40, 0); g.add(beacon);
  ctx.updaters.push((dt, t) => { beacon.visible = (t % 1.6) < 0.25; for (const o of g.children) if (o.userData.spin) o.rotation.x += o.userData.spin * dt; });
  return g;
}
