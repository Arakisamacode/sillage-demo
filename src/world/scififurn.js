import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Mobilier de station (création du projet) : sièges coque moulés en composite sur pied pivotant, tables à plateau
// fin et liseré lumineux, suspensions annulaires à LED, bacs hydroponiques éclairés. Formes lissées (biseaux,
// tours de révolution), composite à vernis brillant, métal brossé : même rendu PBR que le reste du décor.

const G = {};
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

function shellGeometry() {
  // profil de la coque (avant +x, hauteur y), épaisseur constante, puis extrusion biseautée sur la largeur
  const c = new THREE.CatmullRomCurve3([[0.25, 0.43], [0.21, 0.47], [0.05, 0.468], [-0.13, 0.462], [-0.22, 0.49], [-0.255, 0.6], [-0.275, 0.76], [-0.285, 0.9]].map(([x, y]) => new THREE.Vector3(x, y, 0)));
  const pts = c.getSpacedPoints(36), th = 0.022;
  const off = (sign) => pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
    return new THREE.Vector2(p.x - t.y * th * sign, p.y + t.x * th * sign);
  });
  const outer = off(1), inner = off(-1).reverse();
  const shape = new THREE.Shape([...outer, ...inner]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.44, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 4, steps: 1 });
  g.translate(0, 0, -0.22);
  g.rotateY(-Math.PI / 2);          // profil x → avant (+z), largeur → x
  g.computeVertexNormals();
  return g;
}

function geos() {
  if (G.shell) return G;
  G.shell = shellGeometry();
  G.pad = new RoundedBoxGeometry(0.38, 0.03, 0.34, 3, 0.012);
  G.backPad = new RoundedBoxGeometry(0.36, 0.26, 0.025, 3, 0.01);
  G.column = new THREE.CylinderGeometry(0.03, 0.04, 1, 20);
  G.swivel = lathe([[0, 0], [0.09, 0], [0.1, 0.012], [0.07, 0.03], [0, 0.03]], 28);
  G.chairBase = lathe([[0, 0], [0.22, 0], [0.235, 0.008], [0.225, 0.02], [0.12, 0.032], [0.04, 0.04], [0, 0.04]], 40);
  G.tableTop = lathe([[0, 0], [0.54, 0], [0.575, 0.006], [0.585, 0.02], [0.575, 0.034], [0.55, 0.038], [0, 0.038]], 56);
  G.tableBase = lathe([[0, 0], [0.3, 0], [0.31, 0.01], [0.29, 0.025], [0.08, 0.05], [0.05, 0.12], [0.045, 1], [0, 1]], 40);
  G.ring = new THREE.TorusGeometry(1, 0.012, 8, 72);
  G.lampHousing = new THREE.TorusGeometry(0.34, 0.03, 12, 64);
  G.lampLed = new THREE.TorusGeometry(0.34, 0.016, 8, 64);
  G.tank = lathe([[0, 0], [0.96, 0], [1.0, 0.03], [1.0, 0.62], [0.97, 0.66], [0, 0.66]], 56);
  G.rim = new THREE.TorusGeometry(1.0, 0.035, 10, 64);
  G.soil = new THREE.CircleGeometry(0.97, 48).rotateX(-Math.PI / 2);
  return G;
}

export function sciFurniture(ctx) {
  const { mats, builder: B } = ctx;
  geos();
  const env = 1.0;
  const composite = (color, rough = 0.3) => { const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: env }); return m; };
  const M = {
    white: composite(0xe8eaec, 0.35), graphite: composite(0x24272b, 0.4), top: composite(0xf0f0ee, 0.25), topDark: composite(0x1c1f22, 0.3),
    metal: mats.smooth(0xb8bcc2, 0.28, 0.95, { grime: 0.15, scratch: 0.3, rust: 0 }), metalDark: mats.smooth(0x3a3e44, 0.35, 0.9, { grime: 0.2, rust: 0 }),
    pads: [composite(0x1f6f7a, 0.6), composite(0xd0642a, 0.6), composite(0x2a3a5a, 0.6), composite(0x8a2a3a, 0.6)],
    glowWarm: mats.emissive(0xffc890, 2.0), glowCyan: mats.emissive(0x7fd8ff, 2.2), led: mats.emissive(0xfff0dc, 3.2),
    tank: composite(0x2a2e33, 0.45), soil: mats.plastic(0x2a1e16, 0.95), plantGlow: mats.emissive(0x8aff9a, 1.6),
  };
  for (const pm of M.pads) pm.clearcoat = 0.1;
  const T = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(sx, sy, sz));
  const put = (geo, mat, m, cast = false) => B.add(geo, mat, m, { cast });
  const F = {
    M,
    /** siège coque pivotant, tourné vers yaw (le convive regarde +z local) */
    chair(x, y, z, yaw, k = 0, cast = false) {
      const base = T(x, y, z, yaw);
      const at = (m) => base.clone().multiply(m);
      put(G.shell, k % 3 === 2 ? M.graphite : M.white, at(new THREE.Matrix4()), cast);
      put(G.pad, M.pads[k % M.pads.length], at(T(0, 0.487, 0.01)));
      put(G.backPad, M.pads[k % M.pads.length], at(T(0, 0.72, -0.245, 0, 1, 1, 1, -0.12)));
      put(G.swivel, M.metalDark, at(T(0, 0.405, 0)));
      put(G.column, M.metal, at(T(0, 0.04 + 0.37 / 2, 0, 0, 1, 0.37, 1)), cast);
      put(G.chairBase, M.metal, at(T(0, 0, 0)), cast);
    },
    /** table ronde : plateau composite fin, liseré lumineux sous le chant, pied tulipe métal */
    table(x, y, z, k = 0, h = 0.738, r = 1, cast = false) {
      put(G.tableTop, k % 2 ? M.topDark : M.top, T(x, y + h, z, 0, r, 1, r), cast);
      put(G.ring, k % 2 ? M.glowCyan : M.glowWarm, T(x, y + h - 0.004, z, 0, 0.55 * r, 0.55 * r, 0.55 * r, Math.PI / 2));
      put(G.tableBase, M.metal, T(x, y, z, 0, r, h, r), cast);
    },
    /** suspension annulaire à LED (centre de l'anneau à la hauteur y) */
    lamp(x, y, z, cableTop) {
      put(G.lampHousing, M.metalDark, T(x, y, z, 0, 1, 1, 1, Math.PI / 2));
      put(G.lampLed, M.led, T(x, y - 0.022, z, 0, 1, 1, 1, Math.PI / 2));
      const L = cableTop - y;
      for (const [dx, dz] of [[0.34, 0], [-0.17, 0.29], [-0.17, -0.29]]) {
        const top = new THREE.Vector3(x, cableTop, z), bot = new THREE.Vector3(x + dx, y, z + dz);
        const mid = top.clone().add(bot).multiplyScalar(0.5), dir = bot.clone().sub(top), len = dir.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        put(G.column, M.metalDark, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(0.08, len, 0.08)));
      }
      return L;
    },
    /** banquette : assise composite arrondie sur deux piètements métal, liseré lumineux au pied ; axe le long de z */
    bench(x, y, z, len = 2.4) {
      put(new RoundedBoxGeometry(0.6, 0.12, len, 4, 0.05), M.white, T(x, y + 0.4, z));
      put(new RoundedBoxGeometry(0.5, 0.05, len - 0.1, 3, 0.02), M.pads[2], T(x, y + 0.475, z));
      for (const e of [-1, 1]) put(new RoundedBoxGeometry(0.5, 0.34, 0.08, 3, 0.02), M.metal, T(x, y + 0.17, z + e * (len / 2 - 0.3)));
      put(new THREE.BoxGeometry(0.02, 0.01, len - 0.4), M.glowCyan, T(x, y + 0.33, z));
    },
    /** bac hydroponique cylindrique (rayon r) éclairé, terreau ; renvoie la hauteur du terreau */
    planter(x, y, z, r = 1) {
      put(G.tank, M.tank, T(x, y, z, 0, r, 1, r));
      put(G.rim, M.metal, T(x, y + 0.66, z, 0, r, r, 1.4, Math.PI / 2));
      put(G.ring, M.plantGlow, T(x, y + 0.5, z, 0, r * 1.005, r * 1.005, 1.2, Math.PI / 2));
      put(G.soil, M.soil, T(x, y + 0.62, z, 0, r, 1, r));
      return y + 0.62;
    },
  };
  return F;
}
