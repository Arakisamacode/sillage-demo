// Audit de non-régression : joue chaque système du jeu (simulation réelle à 30 Hz pilotée depuis le test)
// et relève erreurs JavaScript, valeurs NaN, états incohérents, fuites (objets de scène, mémoire).
// Usage : node tools/audit.mjs [url] [qualité]   (serveur Vite lancé : npx vite --port 5173)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const base = process.argv[2] || 'http://127.0.0.1:5173/';
const Q = process.argv[3] || 'low';
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
let scen = 'chargement';
const errors = [];
page.on('pageerror', (e) => errors.push(`[${scen}] exception : ${e.message} ${(e.stack || '').split('\n').slice(1, 3).join(' | ')}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${scen}] console : ${m.text().slice(0, 220)}`); });
const results = [];
const ok = (name, cond, info = '') => results.push(`${cond ? 'OK  ' : 'ÉCHEC'} ${name}${info ? ' · ' + info : ''}`);
const E = (f, a) => page.evaluate(f, a);

await page.addInitScript(() => { try { if (!sessionStorage.getItem('audit')) { localStorage.clear(); sessionStorage.setItem('audit', '1'); } } catch { /* */ } });
await page.goto(`${base}?quality=${Q}`);
await page.waitForSelector('#start:not(.hidden)', { timeout: 300000 });
const helpers = () => E(() => {
  document.getElementById('start').classList.add('hidden');
  const A = window.__app; window.__t = 0;
  window.__sim = (sec, extra) => { for (let i = 0; i < sec * 30; i++) { extra?.(); A.simulate(1 / 30, (window.__t += 1 / 30)); A.dialog?.update(1 / 30); A.story?.update(1 / 30); A.wing?.update(1 / 30); } };
  window.__nan = () => {
    const bad = [];
    A.scene.traverse((o) => { const p = o.position; if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) bad.push(o.name || o.type); });
    for (const v of [A.player.pos, A.flight.pos]) if (!Number.isFinite(v.x + v.y + v.z)) bad.push('joueur/vaisseau');
    return bad.slice(0, 5);
  };
});
await helpers();
const step = async (name, fn) => { scen = name; try { await fn(); } catch (e) { errors.push(`[${name}] test interrompu : ${e.message.split('\n')[0]}`); } };

await step('démarrage', async () => {
  const r = await E(() => ({ n: window.__app.scene.children.length, nan: window.__nan() }));
  ok('scène chargée, aucune position NaN', r.nan.length === 0, `${r.n} objets racine`);
});

await step('boutiques et inventaire', async () => {
  const r = await E(() => {
    const A = window.__app, G = A.game, S = A.shop, out = [];
    G.earn(400000);
    for (const id of ['armes', 'pieces', 'combis', 'pharma', 'nouilles', 'lx_mode', 'lx_suits', 'fc_jade', 'fc_vesuvio']) {
      S.openStore(id); const items = S._storeItems(); S.render();
      out.push(`${id}:${items.length}`);
      if (items[0] && items[0].price > 0) G.buy(items[0].id);
      S.close();
    }
    S.openInventory(); S.render(); S.close();
    const eq = [G.equip('me', 'outfit', 'lx_aurore'), G.equip('me', 'armor', 'lx_halo')];
    return { out: out.join(' '), eq, credits: G.credits };
  });
  ok('chaque boutique liste des articles', !/:0\b/.test(r.out), r.out);
  ok('équiper tenue et combinaison de luxe', r.eq.every((x) => x !== false), JSON.stringify(r.eq));
});

await step('contrats de fret', async () => {
  const r = await E(() => {
    const A = window.__app, M = A.missions;
    const before = M.active.length;
    const res = M.offers.slice(0, 3).map((o) => M.accept(o));
    const st = M.active.map((o) => M.status(o));
    const nav = M.navTarget();
    return { before, after: M.active.length, res, st, nav: !!nav };
  });
  ok('accepter trois contrats', r.after - r.before >= 2, `${r.before}→${r.after} · ${JSON.stringify(r.res)}`);
  ok('statut et repère des contrats', r.st.every((x) => typeof x === 'string' && x.length) && r.nav);
});

await step('vol : décollage, atterrissage avant-poste, retour', async () => {
  const r = await E(() => {
    const A = window.__app, F = A.flight, P = A.player, out = [];
    P.sit(A.seat); F.takeOff();
    const inp = { move: { x: 0, y: 0 }, keys: new Set(), consumeLook: () => ({ dx: 0, dy: 0 }), consume: () => false, firing: false };
    for (let i = 0; i < 200; i++) { F.update(1 / 30, inp); A.simulate(1 / 30, (window.__t += 1 / 30)); }
    out.push(F.state);
    const o = A.outposts.find((x) => x.id === 'lys');
    F.pos.copy(o.pad.pos).add(new (o.pad.pos.constructor)(0, 8, 0)); F.vel.set(0, 0, 0);
    const landing = F.land();
    for (let i = 0; i < 240; i++) { F.update(1 / 30, inp); A.simulate(1 / 30, (window.__t += 1 / 30)); }
    out.push(`atterrissage:${landing} état:${F.state} à:${F.dockedAt?.name}`);
    const acts = A.missions.dockActions(F.dockedAt);
    out.push('actions:' + acts.length);
    F.takeOff(); for (let i = 0; i < 200; i++) { F.update(1 / 30, inp); A.simulate(1 / 30, (window.__t += 1 / 30)); }
    F.pos.copy(F.home.pos).add(new (o.pad.pos.constructor)(0, 8, 0)); F.vel.set(0, 0, 0);
    F.land(); for (let i = 0; i < 240; i++) { F.update(1 / 30, inp); A.simulate(1 / 30, (window.__t += 1 / 30)); }
    out.push(`retour:${F.state} à:${F.dockedAt?.name} actif:${F.active}`);
    return { out, nan: window.__nan() };
  });
  ok('décollage → vol', r.out[0] === 'flying', r.out[0]);
  ok('atterrissage à Lys', /atterrissage:true état:parked à:Station agricole Lys/.test(r.out[1]), r.out[1] + ' ' + r.out[2]);
  ok('retour au hangar', /retour:parked/.test(r.out[3]), r.out[3]);
  ok('aucune position NaN après vol', r.nan.length === 0, r.nan.join(','));
});

await step('combat spatial et escadrille', async () => {
  const r = await E(() => {
    const A = window.__app, F = A.flight, C = A.combat;
    A.wing.hire('rook'); A.wing.hire('lynx');
    F.takeOff();
    const inp = { move: { x: 0, y: 0 }, keys: new Set(), consumeLook: () => ({ dx: 0, dy: 0 }), consume: () => false, firing: false };
    for (let i = 0; i < 200; i++) { F.update(1 / 30, inp); A.simulate(1 / 30, (window.__t += 1 / 30)); A.wing.update(1 / 30); }
    F.pos.set(600, 200, -2600); F.vel.set(0, 0, 0);
    for (const s of A.wing.ships) s.pos.copy(F.pos).add(new (F.pos.constructor)(s.P.side * 30, 5, 30));
    C.spawnWave(3, 700, true);
    const wings = A.wing.ships.length;
    for (let i = 0; i < 30 * 40; i++) { F.update(1 / 30, inp); A.simulate(1 / 30, (window.__t += 1 / 30)); A.wing.update(1 / 30); }
    const alive = C.pirates.filter((p) => !p.dead).length;
    for (const p of C.pirates) if (!p.dead && !p.K.freighter) C._hitPirate(p, 1e6, 1, p.pos.clone());
    const fr = C.pirates.find((p) => p.K.freighter && !p.dead);
    if (fr) C._hitPirate(fr, fr.hull * 0.75, 1, fr.pos.clone());
    const disabled = fr ? fr.state : 'aucun';
    for (let i = 0; i < 60; i++) A.simulate(1 / 30, (window.__t += 1 / 30));
    C._hitPlayer(1e6, 1, F.pos.clone());
    for (let i = 0; i < 30 * 5; i++) { F.update(1 / 30, inp); A.simulate(1 / 30, (window.__t += 1 / 30)); }
    return { wings, alive, kills: C.kills, disabled, state: F.state, hull: C.hull, nan: window.__nan() };
  });
  ok('escadrille en vol', r.wings === 2, `${r.wings} ailiers`);
  ok('pirates engagés (ailiers ou tourelle)', r.kills >= 1 || r.alive < 3, `abattus ${r.kills}, restants ${r.alive}`);
  ok('cargo pirate désemparé sous 30 %', r.disabled === 'disabled', r.disabled);
  ok('destruction du Héron → rapatriement', r.state === 'parked' || r.state === 'flying', `${r.state} coque ${Math.round(r.hull)}`);
  ok('aucune position NaN après combat', r.nan.length === 0, r.nan.join(','));
});

await step('combat au sol (raid)', async () => {
  const r = await E(() => {
    const A = window.__app, G = A.ground;
    try { G.startStationAlert(); } catch (e) { return { err: e.message }; }
    for (let i = 0; i < 30 * 8; i++) A.simulate(1 / 30, (window.__t += 1 / 30));
    const n = G.units?.length ?? 0;
    for (const u of G.units || []) if (u.side === 'enemy') u.hp = 0;
    for (let i = 0; i < 30 * 6; i++) A.simulate(1 / 30, (window.__t += 1 / 30));
    return { n, raid: !!G.raid, nan: window.__nan() };
  });
  ok('alerte d\'intrusion déclenchée', !r.err && r.n > 0, r.err || `${r.n} unités`);
  ok('aucune position NaN au sol', !r.nan || r.nan.length === 0);
});

await step('récit, quêtes, conversations', async () => {
  const r = await E(() => {
    const A = window.__app, S = A.story, out = [];
    const run = (tree, path) => { let node = 'start'; for (const i of path) { let n = tree[node]; if (typeof n === 'function') n = n(); const ch = (n.choices || []).filter((c) => !c.if || c.if()); const c = ch[i]; if (!c) return false; c.do?.(); node = c.next; if (!node) break; } return true; };
    out.push(run(S.irenaTree(), [1, 0, 0])); S.onFlight('landed', { outpost: { id: 'lys' } }); for (let i = 0; i < 3; i++) S.onCombat('kill');
    out.push(S.s.step === 3); out.push(run(S.irenaTree(), [0, 0]) && S.s.step === 4);
    out.push(run(S.irenaTree(), [0, 0]) && S.q.ch2 === 1);
    out.push(run(S.aldricTree(), [0, 0, 0]) && S.q.ch2 === 2);
    S.ch2Spawned = true; S.onCombat('clear'); out.push(S.q.ch2 === 3);
    out.push(run(S.irenaTree(), [0, 0]) && S.q.ch2 === 4);
    out.push(run(S.irenaTree(), [0, 0, 0]) && S.q.ch3 === 1);
    S.q.ch3 = 3; out.push(run(S.irenaTree(), [0, 0, 0]) && S.q.ch3 === 4);
    // conversations : chaque personnage nommé, ouverture et fermeture, saisie réactivée
    for (const k of Object.keys(A.NPC)) { A.dialog.open(A.NPC[k], k === 'irena' ? S.irenaTree() : k === 'joss' ? S.jossTree() : k === 'salek' ? S.doctorTree() : S.conciergeTree()); A.dialog.choose(99); A.dialog.close(); }
    out.push(!A.dialog.active);
    return { out, news: S.news().length };
  });
  ok('L\'Équation de Halden, chapitres 2 et 3 jusqu\'au bout', r.out.every(Boolean), JSON.stringify(r.out));
});

await step('ascenseurs (3 cabines, 2 sens)', async () => {
  const r = await E(() => {
    const A = window.__app, P = A.player, out = [];
    const lifts = [...A.habitat.shafts.map((S) => [A.elevators, S]), [A.luxLift, A.lux.shafts[0]]];
    for (const [E, S] of lifts) for (const from of S.levels || [0, 40]) {
      const to = (S.levels || [0, 40]).find((y) => y !== from);
      P.pos.copy(S.inside(from)); P.vel.set(0, 0, 0);
      E.call(S, from); for (let i = 0; i < 30 * 20 && !E.isAt(S, from); i++) { E.update(1 / 30); A.simulate(1 / 30, (window.__t += 1 / 30)); }
      P.pos.copy(S.inside(from)); E.ride(S);
      for (let i = 0; i < 30 * 14 && (S.moving || Math.abs(S.y - to) > 0.05); i++) { E.update(1 / 30); A.simulate(1 / 30, (window.__t += 1 / 30)); }
      out.push(Math.abs(P.pos.y - to) < 0.3);
    }
    return out;
  });
  ok('chaque trajet amène le joueur au bon niveau', r.every(Boolean), JSON.stringify(r));
});

await step('Grand Dôme (accès, chemins, vie, boutiques)', async () => {
  const r = await E(() => {
    const A = window.__app, P = A.player, G = A.garden, out = {};
    const inp = { move: { x: 0, y: 1 }, keys: new Set(), consumeLook: () => ({ dx: 0, dy: 0 }), consume: () => false, run: false };
    const walk = (to, sec) => { for (let i = 0; i < sec * 30; i++) { P.yaw = Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z)); P.update(1 / 30, inp, [], []); A.simulate(1 / 30, (window.__t += 1 / 30)); if (Math.hypot(to.x - P.pos.x, to.z - P.pos.z) < 0.6) return true; } return false; };
    // depuis la Cour des Saveurs, par la porte est et la passerelle, jusqu'à la place aux lampions puis la ferme
    out.avant = { assis: !!P.seated, vol: A.flight.state, actif: A.flight.active, dial: A.dialog.active };
    P.stand(); P.pos.set(-78, 40.05, 20); P.vel.set(0, 0, 0);
    const trace = []; const w0 = walk; const walk2 = (to, sec) => { const r = w0(to, sec); trace.push(P.pos.toArray().map((x) => x.toFixed(1)).join(',')); return r; };
    out.passerelle = walk2(G.W(-21, 0, 15), 14);
    out.chemin = walk2(G.W(-15.5, 0, 10.6), 8) && walk2(G.W(-12.4, 0, 8.3), 6) && walk2(G.W(-6.2, 0, 5.4), 6);
    out.anneau = walk2(G.W(0, 0, 15), 12) && walk2(G.W(10.6, 0, 10.6), 10) && walk2(G.W(15, 0, 0), 10) && walk2(G.W(10.6, 0, -10.6), 10) && walk2(G.W(0, 0, -15), 10);
    out.trace = trace.join(' ');
    out.dansLeDome = G.inside(P.pos) && Math.abs(P.pos.y - 40 - G.heightAt(P.pos.x - G.C.x, P.pos.z - G.C.z)) < 0.4;
    window.__sim(30);
    const L = A.gardenLife;
    out.vivants = L.actors.every((n) => Number.isFinite(n.pos.x + n.pos.y + n.pos.z));
    out.enfantsEnJeu = L.kids.filter((n) => n.q.length).length;
    A.time.setHour(14);
    out.glaceOuverte = A.time.open('dome_glace') && A.time.open('dome_snack');
    A.shop.openStore('dome_glace'); out.carte = document.querySelectorAll('.sh-item').length; A.shop.close?.();
    return out;
  });
  ok('passerelle franchie, chemins praticables, sol suivi', r.passerelle && r.chemin && r.anneau && r.dansLeDome, JSON.stringify(r));
  ok('habitants et enfants actifs, positions valides', r.vivants && r.enfantsEnJeu >= 3, JSON.stringify(r));
  ok('glacier et snack ouverts et approvisionnés', r.glaceOuverte && r.carte >= 4, JSON.stringify(r));
});

await step('analyse, codex, briefing, interfaces', async () => {
  const r = await E(() => {
    const A = window.__app;
    A.scanner.toggle(true); A.scanner.update(1 / 30, A.camera, [], []); A.scanner.toggle(false);
    A.scanner.openCodex(); const cx = A.scanner.codexOpen; document.querySelector('#codex button').click();
    A.openBrief(); const br = A.briefing.open; A.briefing.close();
    return { cx, br, closed: !A.scanner.codexOpen && !A.briefing.open };
  });
  ok('codex et briefing s\'ouvrent et se ferment', r.cx && r.br && r.closed);
});

await step('nuit, sommeil, horaires', async () => {
  const r = await E(() => {
    const A = window.__app; A.time.setHour(2.5); window.__sim(20);
    const open = ['fc_jade', 'armes', 'galerie'].map((id) => A.time.open(id));
    A.time.setHour(13); window.__sim(5);
    return { open, nan: window.__nan() };
  });
  ok('fermetures de nuit', r.open.every((x) => !x), JSON.stringify(r.open));
});

await step('sauvegarde et rechargement', async () => {
  await E(() => { const A = window.__app; A.game.d.credits = 123456; A.game.save(); A.missions.persist(); });
  scen = 'rechargement';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start:not(.hidden)', { timeout: 300000 });
  await helpers();
  const r = await E(() => { const A = window.__app; return { c: A.game.credits, ch3: A.story.q.ch3, codex: A.game.d.codex.length, contrats: A.missions.active.length }; });
  ok('état restauré après rechargement', r.c === 123456 && r.ch3 === 4, JSON.stringify(r));
});

await step('endurance (10 min de jeu simulé, Cour et galerie)', async () => {
  const r = await E(() => {
    const A = window.__app, P = A.player;
    document.getElementById('start').classList.add('hidden');
    window.__t = window.__t || 0;
    const count = () => { let n = 0; A.scene.traverse(() => n++); return n; };
    P.pos.set(-116, 40, 16); for (let i = 0; i < 30 * 20; i++) A.simulate(1 / 30, (window.__t += 1 / 30));
    const n0 = count(), h0 = performance.memory?.usedJSHeapSize || 0;
    for (let k = 0; k < 5; k++) { P.pos.set(-116, 40, 16); for (let i = 0; i < 30 * 60; i++) A.simulate(1 / 30, (window.__t += 1 / 30)); P.pos.set(-70, 0, -6); for (let i = 0; i < 30 * 60; i++) A.simulate(1 / 30, (window.__t += 1 / 30)); }
    P.pos.set(-116, 40, 16); for (let i = 0; i < 30 * 20; i++) A.simulate(1 / 30, (window.__t += 1 / 30));
    return { n0, n1: count(), dh: Math.round(((performance.memory?.usedJSHeapSize || 0) - h0) / 1e6), nan: window.__nan(), stuck: (A.foodCustomers || []).filter((n) => !n.away && n.q.length === 0).length };
  });
  ok('pas de dérive du nombre d\'objets', r.n1 - r.n0 < 60, `${r.n0} → ${r.n1}`);
  ok('pas de fuite mémoire notable', r.dh < 40, `${r.dh} Mo`);
  ok('aucune position NaN après 10 min', r.nan.length === 0, r.nan.join(','));
});

console.log(results.join('\n'));
console.log(`\n${errors.length} erreur(s) relevée(s)`);
for (const e of [...new Set(errors)].slice(0, 40)) console.log('  ' + e);
await browser.close();
