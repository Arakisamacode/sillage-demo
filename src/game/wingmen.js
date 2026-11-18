import * as THREE from 'three';
import { wing, flipFaces } from '../world/shipkit.js';

// Escadrille : ailiers engagés à la salle de briefing (ou fournis pour les missions du récit). Ils décollent avec le
// Héron, volent en formation (aile gauche / aile droite), engagent les pirates, encaissent, décrochent s'ils sont trop
// touchés, et parlent à la radio (portrait, voix). Ils rentrent à la station quand le Héron se pose.

export const PILOTS = [
  { id: 'rook', call: 'Freux', name: 'Tomas « Freux » Okafor', side: -1, color: 0x3e8ad8, voice: { pitch: 0.82, rate: 1.05, idx: 1 }, model: 'UM_dark', hair: 'Hair_Buzzed',
    lines: { launch: 'Ici Freux, en position sur votre aile gauche. On vous suit, chef.', wave: ['Contacts ! Je prends celui de gauche.', 'Ils arrivent en éventail. Je couvre votre six.', 'Freux engage !'], kill: ['Cible abattue ! Un de moins.', 'Il ne rentrera pas chez lui, celui-là.', 'Touché, coulé.'], hurt: 'Je suis touché, boucliers à zéro. Je décroche, désolé chef !', clear: 'Secteur dégagé. Joli travail, chef.', home: 'Freux rentre à la station. Au plaisir de voler avec vous.' } },
  { id: 'lynx', call: 'Lynx', name: 'Adèle « Lynx » Delmas', side: 1, color: 0xd8a03e, voice: { pitch: 1.18, rate: 1.05, idx: 0 }, model: 'UF_light', hair: 'Hair_Buns',
    lines: { launch: 'Lynx en formation, aile droite. Armes chaudes, prête à danser.', wave: ['J\'ai un visuel. Lynx engage !', 'Deux sur votre droite, je m\'en occupe.', 'On a de la compagnie, chef.'], kill: ['Splash un ! Vous avez vu ça ?', 'Cible détruite.', 'Un pirate de moins dans le secteur.'], hurt: 'Coque à vingt pour cent, je dois rompre ! Tenez bon !', clear: 'Plus rien sur mes capteurs. On rentre quand vous voulez.', home: 'Lynx se pose. La prochaine tournée est pour vous.' } },
];

function fighterMesh(color) {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.5, roughness: 0.35 });
  const stripe = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2026, metalness: 0.6, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0c1820, metalness: 1, roughness: 0.05 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.1, 9, 12), hull); body.rotation.x = -Math.PI / 2; g.add(body);
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass); can.scale.set(1, 0.8, 2.2); can.position.set(0, 0.55, -0.8); g.add(can);
  for (const s of [-1, 1]) {
    const w = wing([[0, -1], [4.6, 2.4], [4.6, 3.4], [0, 3.8]], 0.18);
    w.applyMatrix4(new THREE.Matrix4().makeScale(s, 1, 1)); if (s < 0) flipFaces(w);
    const wm = new THREE.Mesh(w, hull); wm.position.set(s * 0.6, -0.1, 0.4); g.add(wm);
    const st = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.5), stripe); st.position.set(s * 2.6, 0.02, 1.9); g.add(st);
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 2.4, 12), dark); eng.rotation.x = Math.PI / 2; eng.position.set(s * 0.9, 0, 3.4); g.add(eng);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.36, 3.2, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    plume.rotation.x = Math.PI / 2; plume.position.set(s * 0.9, 0, 5.2); plume.userData.plume = true; g.add(plume);
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 2), stripe); fin.position.set(0, 0.9, 3); g.add(fin);
  g.scale.setScalar(1.15);
  return g;
}

export class Wingmen {
  constructor(ctx, { combat, flight, game, dialog }) {
    Object.assign(this, { ctx, combat, flight, game, dialog });
    this.ships = [];
    this.hired = new Set(game.d.wingHired || []);        // engagés pour la prochaine sortie
    this.portraits = {};
    this.t = 0;
  }
  get active() { return this.ships.length > 0; }
  hire(id, on = true) { if (on) this.hired.add(id); else this.hired.delete(id); this.game.d.wingHired = [...this.hired]; this.game.save(); }
  /** décollage du Héron : les ailiers engagés (ou fournis par une mission) le rejoignent */
  launch(extra = []) {
    this.clear();
    const ids = new Set([...this.hired, ...extra]);
    for (const P of PILOTS.filter((p) => ids.has(p.id))) {
      const mesh = fighterMesh(P.color);
      const F = this.flight;
      const pos = F.pos.clone().add(new THREE.Vector3(P.side * 30, 6, 30).applyQuaternion(F.q));
      mesh.position.copy(pos); this.ctx.scene.add(mesh);
      this.ships.push({ P, mesh, pos, q: F.q.clone(), vel: new THREE.Vector3(), hull: 100, state: 'form', fireCd: 0, target: null, said: 0 });
      this.say(P, P.lines.launch, 1.5 + this.ships.length * 3);
    }
    // les ailiers payés ne valent que pour une sortie
    this.hired.clear(); this.game.d.wingHired = []; this.game.save();
  }
  clear(home = false) {
    for (const s of this.ships) { this.ctx.scene.remove(s.mesh); if (home && s.state !== 'gone') this.say(s.P, s.P.lines.home, 0.5); }
    this.ships = [];
  }
  say(P, text, delay = 0) {
    const t = this.dialog;
    const go = () => t.transmit({ name: `${P.call} · ailier`, portrait: this.portraits[P.id] || '', text, voice: P.voice });
    if (delay) setTimeout(go, delay * 1000); else go();
  }
  onCombat(e, p) {
    if (!this.active) return;
    const alive = this.ships.filter((s) => s.state !== 'gone' && s.state !== 'retreat');
    if (!alive.length) return;
    if (e === 'wave') { const s = alive[Math.floor(Math.random() * alive.length)]; this.say(s.P, s.P.lines.wave[Math.floor(Math.random() * 3)], 1); }
    if (e === 'clear') { const s = alive[0]; this.say(s.P, s.P.lines.clear, 1.5); }
    if (e === 'kill' && p?.wingKill) { const s = p.wingKill; this.say(s.P, s.P.lines.kill[Math.floor(Math.random() * 3)]); }
  }
  update(dt) {
    if (!this.active) return;
    const F = this.flight, C = this.combat;
    this.t += dt;
    if (F.state !== 'flying' && F.state !== 'spool') return;
    const UP = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), qq = new THREE.Quaternion();
    const pirates = (C.pirates || []).filter((p) => !p.dead);
    for (const s of this.ships) {
      if (s.state === 'gone') continue;
      let aim, speed;
      if (s.state === 'retreat') {
        aim = F.home.pos.clone(); speed = 220;
        if (s.pos.distanceTo(F.pos) > 2500) { s.state = 'gone'; this.ctx.scene.remove(s.mesh); continue; }
      } else if (pirates.length && !C.safe()) {
        if (!s.target || s.target.dead) s.target = pirates.reduce((a, b) => (a.pos.distanceToSquared(s.pos) < b.pos.distanceToSquared(s.pos) ? a : b));
        const T = s.target, d = T.pos.distanceTo(s.pos);
        aim = T.pos.clone().addScaledVector(T.vel, d / 1400);
        if (d < 120) aim.add(new THREE.Vector3(s.P.side * 200, 80, 0));
        speed = d > 600 ? 210 : 150;
        s.state = 'fight';
        // tir
        s.fireCd -= dt;
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(s.q);
        const want = aim.clone().sub(s.pos).normalize();
        if (d < 800 && fwd.dot(want) > 0.985 && s.fireCd <= 0) {
          s.fireCd = 0.22;
          const muzzle = s.pos.clone().addScaledVector(fwd, 6);
          const dmg = 32;
          const before = T.hull;
          C._fire('laser', muzzle, want.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.012)).normalize(), dmg, null, s.vel);
          T.wingKill = s; void before;
        }
        // dégâts subis (les pirates répliquent aussi sur l'escadrille)
        s.hull -= dt * 0.9 * Math.min(3, pirates.length) * (0.5 + Math.random());
        if (s.hull < 22) { s.state = 'retreat'; this.say(s.P, s.P.lines.hurt); }
      } else {
        // formation : en retrait et sur le côté du Héron
        aim = F.pos.clone().add(new THREE.Vector3(s.P.side * 26, 5, 22).applyQuaternion(F.q)).addScaledVector(F.vel, 0.6);
        const d = aim.distanceTo(s.pos);
        speed = Math.min(260, F.vel.length() + d * 0.9);
        s.state = 'form';
        if (d < 4) { s.q.slerp(F.q, 1 - Math.exp(-dt * 2)); s.vel.lerp(F.vel, 1 - Math.exp(-dt * 3)); s.pos.addScaledVector(s.vel, dt); s.mesh.position.copy(s.pos); s.mesh.quaternion.copy(s.q); continue; }
      }
      m.lookAt(s.pos, aim, UP); qq.setFromRotationMatrix(m);
      s.q.rotateTowards(qq, 2.2 * dt);
      const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(s.q);
      s.vel.lerp(fw.multiplyScalar(speed), 1 - Math.exp(-dt * 1.6));
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos); s.mesh.quaternion.copy(s.q);
      s.mesh.traverse((o) => { if (o.userData.plume) o.scale.set(1, 0.7 + speed / 260 * 0.6 * (0.85 + Math.random() * 0.3), 1); });
    }
  }
}
