// Tests du décompte Skull King, à partir des exemples du livret officiel.
// Lancer : node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultConfig, normalizeConfig, newRound, scoreRound, validateRound,
  roundsFor, deckSize, bonusDefs, fillDefaults, bonusLimit, handsDealt, recommendedPlayers,
} from '../skull-king/rules.js';

const cfg = (o = {}) => normalizeConfig({ ...defaultConfig(), ...o });
const ids = ['a', 'b', 'c', 'd'];
const players = ids.map((id) => ({ id, name: id.toUpperCase() }));

function round(cards, bids, tricks, extra = {}) {
  const r = newRound(cards);
  ids.forEach((id, i) => {
    if (bids[i] != null) r.bids[id] = bids[i];
    if (tricks[i] != null) r.tricks[id] = tricks[i];
  });
  return Object.assign(r, extra);
}

test('annonce réussie : 20 par pli (Calvin bid 3 = 60)', () => {
  const s = scoreRound(cfg(), round(5, [3], [3]), 5, ['a']);
  assert.equal(s.a.total, 60);
});

test('annonce ratée : -10 par pli d’écart (Angela bid 2, fait 4 = -20)', () => {
  const s = scoreRound(cfg(), round(5, [2], [4]), 5, ['a']);
  assert.equal(s.a.total, -20);
});

test('annonce zéro : 10 × cartes distribuées (Kate manche 7 = 70, Johnny manche 9 = -90)', () => {
  assert.equal(scoreRound(cfg(), round(7, [0], [0]), 7, ['a']).a.total, 70);
  assert.equal(scoreRound(cfg(), round(9, [0], [2]), 9, ['a']).a.total, -90);
});

test('annonce zéro avec variante : se base sur les cartes, pas sur le numéro de manche', () => {
  // Variante Skip to the Brawl : manche 1 à 6 cartes.
  assert.equal(scoreRound(cfg({ schedule: 'brawl' }), round(6, [0], [0]), 1, ['a']).a.total, 60);
});

test('ancienne édition : annonce zéro = 10 × numéro de manche, Sirène sur Skull King = 50', () => {
  const c = cfg({ edition: 'old' });
  assert.equal(scoreRound(c, round(4, [0], [0]), 4, ['a']).a.total, 40);
  const r = round(3, [1], [1], { bonus: { a: { sk: 1 } } });
  assert.equal(scoreRound(c, r, 3, ['a']).a.total, 70);
});

test('bonus : seulement si l’annonce est réussie (exemple de Morgan : +10 +40)', () => {
  const r = round(4, [1, 0], [1, 1], { bonus: { a: { c14: 1, sk: 1 }, b: { pirates: 1 } } });
  const s = scoreRound(cfg(), r, 4, ['a', 'b']);
  assert.equal(s.a.total, 20 + 10 + 40);
  assert.equal(s.b.bonus, 0);
  assert.equal(s.b.total, -40);
});

test('14 noir = 20, Sirène prise par un Pirate = 20, Pirate pris par le Skull King = 30', () => {
  const r = round(6, [3], [3], { bonus: { a: { b14: 1, mermaid: 2, pirates: 2 } } });
  assert.equal(scoreRound(cfg(), r, 6, ['a']).a.total, 60 + 20 + 40 + 60);
});

test('Rascal : exemples A et B du livret', () => {
  const c = cfg({ scoring: 'rascal' });
  const a = scoreRound(c, round(3, [0, 1, 2], [0, 1, 2]), 3, ['a', 'b', 'c']);
  assert.deepEqual([a.a.total, a.b.total, a.c.total], [30, 30, 30]);
  const b = scoreRound(c, round(4, [1, 0, 4], [1, 1, 2]), 4, ['a', 'b', 'c']);
  assert.deepEqual([b.a.total, b.b.total, b.c.total], [40, 20, 0]);
});

test('Rascal : bonus moitié en tir rasant, aucun en échec', () => {
  const c = cfg({ scoring: 'rascal' });
  const r = round(4, [1, 2], [2, 0], { bonus: { a: { pirates: 1 }, b: { c14: 1 } } });
  const s = scoreRound(c, r, 4, ['a', 'b']);
  assert.equal(s.a.total, 20 + 15);
  assert.equal(s.b.total, 0);
});

test('Rascal Mitraille / Boulet de canon (exemple 6 cartes, annonce 3)', () => {
  const c = cfg({ scoring: 'rascal', cannonball: true });
  const r = round(6, [3, 3, 3, 3], [3, 2, 3, 2], { modes: { a: 'grape', b: 'grape', c: 'cannon', d: 'cannon' } });
  const s = scoreRound(c, r, 6, ids);
  assert.deepEqual(ids.map((id) => s[id].total), [60, 30, 90, 0]);
});

test('Butin : +20 chacun seulement si les deux alliés réussissent', () => {
  const c = cfg({ loot: true });
  const ok = round(3, [1, 2], [1, 2], { loots: [{ from: 'a', to: 'b' }] });
  let s = scoreRound(c, ok, 3, ['a', 'b']);
  assert.equal(s.a.total, 40);
  assert.equal(s.b.total, 60);
  const ko = round(3, [0, 2], [1, 2], { loots: [{ from: 'a', to: 'b' }] });
  s = scoreRound(c, ko, 3, ['a', 'b']);
  assert.equal(s.b.total, 40);
});

test('Butin : le gagnant de deux Butins touche 40', () => {
  const c = cfg({ loot: true });
  const r = round(3, [0, 0, 3], [0, 0, 3], { loots: [{ from: 'a', to: 'c' }, { from: 'b', to: 'c' }] });
  assert.equal(scoreRound(c, r, 3, ['a', 'b', 'c']).c.total, 60 + 40);
});

test('Harry le Géant change l’annonce de ±1, Rascal of Roatan parie', () => {
  const c = cfg({ abilities: true });
  const r = round(5, [2, 1], [3, 2], { harry: { pid: 'a', delta: 1 }, rascal: { pid: 'b', bet: 20 } });
  const s = scoreRound(c, r, 5, ['a', 'b']);
  assert.equal(s.a.total, 60);
  assert.equal(s.b.total, -10 - 20);
});

test('Extension : 8 = +5, 7 = -5, Con capturé = +30', () => {
  const c = cfg({ pack: true });
  const r = round(5, [2], [2], { bonus: { a: { e8: 2, e7: 1, con: 1 } } });
  assert.equal(scoreRound(c, r, 5, ['a']).a.total, 40 + 10 - 5 + 30);
});

test('paquet : 70 cartes de base, 8 joueurs plafonnés à 8 cartes', () => {
  assert.equal(deckSize(cfg(), 4), 70);
  assert.deepEqual(roundsFor(cfg(), 8), [1, 2, 3, 4, 5, 6, 7, 8, 8, 8]);
  assert.deepEqual(roundsFor(cfg(), 7), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('paquet : avec toutes les extensions, 9 joueurs jouent les 10 manches', () => {
  const all = cfg({ loot: true, kraken: true, whale: true, pack: true });
  assert.equal(deckSize(all, 9), 93);
  assert.deepEqual(roundsFor(all, 9).at(-1), 10);
});

test('validation : total des plis, Kraken, bonus sans pli', () => {
  let v = validateRound(cfg(), round(3, [1, 1], [1, 1]), players.slice(0, 2));
  assert.equal(v.errors.length, 1);
  v = validateRound(cfg({ kraken: true }), round(3, [1, 1], [1, 1]), players.slice(0, 2));
  assert.equal(v.errors.length, 0);
  assert.equal(v.destroyed, 1);
  v = validateRound(cfg(), round(2, [0, 2], [0, 2], { bonus: { a: { c14: 1 } } }), players.slice(0, 2));
  assert.equal(v.errors.length, 1);
  v = validateRound(cfg(), round(2, [1, 1], [1, 1], { bonus: { a: { sk: 1 }, b: { sk: 1 } } }), players.slice(0, 2));
  assert.ok(v.errors.length >= 1);
});

test('bonus Davy Jones visible seulement avec un monstre marin', () => {
  assert.ok(bonusDefs(cfg({ pack: true })).some((d) => d.key === 'davy'));
  assert.ok(!bonusDefs(cfg({ pack: true, packStingray: false })).some((d) => d.key === 'davy'));
});

test('annonces et plis à 0 par défaut', () => {
  const r = fillDefaults(newRound(3), ['a', 'b']);
  assert.deepEqual(r.bids, { a: 0, b: 0 });
  assert.deepEqual(r.tricks, { a: 0, b: 0 });
  const v = validateRound(cfg(), r, players.slice(0, 2));
  assert.match(v.errors[0], /il en manque 3/);
});

test('Barbe-Grise seulement dans l’édition actuelle', () => {
  assert.equal(handsDealt(2, cfg()), 3);
  assert.equal(handsDealt(2, cfg({ edition: 'old' })), 2);
});

test('bonusLimit : carte unique déjà attribuée, maximum atteint', () => {
  const c = cfg();
  const r = round(3, [1, 1, 1], [1, 1, 1], { bonus: { a: { sk: 1, c14: 2 }, b: { c14: 1 } } });
  const sk = bonusDefs(c).find((d) => d.key === 'sk');
  const c14 = bonusDefs(c).find((d) => d.key === 'c14');
  assert.equal(bonusLimit(c, r, players.slice(0, 3), sk, 'b'), 'Déjà attribué à A');
  assert.match(bonusLimit(c, r, players.slice(0, 3), c14, 'c'), /3 cartes/);
  assert.equal(bonusLimit(c, r, players.slice(0, 3), sk, 'c') !== null, true);
  // Un joueur qui rate son annonce ne bloque pas les autres.
  const r2 = round(3, [2, 1], [1, 2], { bonus: { a: { sk: 1 } } });
  assert.equal(bonusLimit(c, r2, players.slice(0, 2), sk, 'b'), null);
});

test('bonus saisi directement : compte seulement si l’annonce est juste, moitié en tir rasant', () => {
  const r = round(4, [2, 1, 1], [2, 2, 0], { free: { a: 50, b: 30, c: 40 } });
  const s = scoreRound(cfg(), r, 4, ['a', 'b', 'c']);
  assert.equal(s.a.total, 40 + 50);
  assert.equal(s.b.total, -10);
  const rascal = scoreRound(cfg({ scoring: 'rascal' }), r, 4, ['a', 'b', 'c']);
  assert.equal(rascal.b.total, 20 + 15);
});

test('bonus saisi : prioritaire sur les cartes comptées, refusé sans pli', () => {
  const r = round(3, [1, 0], [1, 0], { bonus: { a: { sk: 1 } }, free: { a: 10 } });
  assert.equal(scoreRound(cfg(), r, 3, ['a', 'b']).a.total, 30);
  const r2 = round(3, [1, 0], [3, 0], { free: { b: 20 } });
  const v = validateRound(cfg(), r2, players.slice(0, 2));
  assert.ok(v.errors.some((e) => /B a un bonus sans/.test(e)));
});

test('pas de limite de joueurs : au moins 1 carte par manche', () => {
  assert.equal(recommendedPlayers(cfg()), 8);
  assert.deepEqual(roundsFor(cfg(), 20).slice(0, 4), [1, 2, 3, 3]);
  assert.deepEqual(roundsFor(cfg(), 100), Array(10).fill(1));
});
