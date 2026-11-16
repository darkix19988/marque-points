// Tests du partage des dépenses. Lancer : node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount, centsToInput, splitByWeights, sharesOf, balances, settle, validateItem,
  summaryText, isValidGroup, formatMoney,
} from '../depenses/money.js';

const people = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase() }));
const exp = (amount, payer, split, extra = {}) => ({ id: Math.random().toString(36), type: 'expense', title: 't', amount, payer, split, ...extra });
const group = (items, ppl = people) => ({ name: 'G', currency: 'EUR', people: ppl, items });

test('lecture des montants', () => {
  assert.equal(parseAmount('12,5'), 1250);
  assert.equal(parseAmount('12.50'), 1250);
  assert.equal(parseAmount('1 234,56 €'), 123456);
  assert.equal(parseAmount('0,1'), 10);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('12,345'), null);
  assert.equal(parseAmount(''), null);
  assert.equal(centsToInput(1250), '12,50');
  assert.equal(centsToInput(1200), '12');
});

test('répartition sans perdre de centime', () => {
  const r = splitByWeights(1000, { a: 1, b: 1, c: 1 });
  assert.deepEqual(r, { a: 334, b: 333, c: 333 });
  assert.equal(Object.values(splitByWeights(1001, { a: 2, b: 1, c: 1 })).reduce((x, y) => x + y), 1001);
  assert.deepEqual(splitByWeights(900, { a: 2, b: 1 }), { a: 600, b: 300 });
});

test('parts égales, parts pondérées, montants exacts', () => {
  assert.deepEqual(sharesOf(exp(3000, 'a', { mode: 'equal', ids: ['a', 'b'] })), { a: 1500, b: 1500 });
  assert.deepEqual(sharesOf(exp(3000, 'a', { mode: 'shares', shares: { a: 2, b: 1, c: 0 } })), { a: 2000, b: 1000 });
  assert.deepEqual(sharesOf(exp(3000, 'a', { mode: 'exact', amounts: { a: 500, b: 2500 } })), { a: 500, b: 2500 });
});

test('soldes et remboursements simples', () => {
  const g = group([exp(9000, 'a', { mode: 'equal', ids: ['a', 'b', 'c'] })]);
  const bal = balances(g);
  assert.deepEqual([bal.a.net, bal.b.net, bal.c.net], [6000, -3000, -3000]);
  assert.deepEqual(settle(g), [{ from: 'b', to: 'a', amount: 3000 }, { from: 'c', to: 'a', amount: 3000 }]);
});

test('un remboursement enregistré solde la dette', () => {
  const g = group([
    exp(9000, 'a', { mode: 'equal', ids: ['a', 'b', 'c'] }),
    { id: 'r', type: 'transfer', amount: 3000, payer: 'b', to: 'a' },
  ]);
  assert.equal(balances(g).b.net, 0);
  assert.deepEqual(settle(g), [{ from: 'c', to: 'a', amount: 3000 }]);
});

test('la somme des soldes est toujours nulle et les remboursements soldent tout', () => {
  const g = group([
    exp(1001, 'a', { mode: 'equal', ids: ['a', 'b', 'c'] }),
    exp(4550, 'b', { mode: 'shares', shares: { a: 1, b: 2, c: 3 } }),
    exp(2000, 'c', { mode: 'exact', amounts: { a: 1500, b: 500 } }),
  ]);
  const bal = balances(g);
  assert.equal(Object.values(bal).reduce((s, x) => s + x.net, 0), 0);
  const after = { ...Object.fromEntries(Object.entries(bal).map(([k, v]) => [k, v.net])) };
  for (const m of settle(g)) { after[m.from] += m.amount; after[m.to] -= m.amount; }
  assert.deepEqual(Object.values(after), [0, 0, 0]);
  assert.ok(settle(g).length <= 2);
});

test('validation des saisies', () => {
  assert.deepEqual(validateItem(exp(1000, 'a', { mode: 'equal', ids: ['a'] })), []);
  assert.ok(validateItem(exp(0, 'a', { mode: 'equal', ids: ['a'] })).length);
  assert.ok(validateItem(exp(1000, 'a', { mode: 'equal', ids: [] })).length);
  assert.match(validateItem(exp(1000, 'a', { mode: 'exact', amounts: { a: 600 } }))[0], /reste/);
  assert.ok(validateItem({ type: 'transfer', amount: 100, payer: 'a', to: 'a' }).length);
});

test('résumé texte et format des montants', () => {
  const g = group([exp(9000, 'a', { mode: 'equal', ids: ['a', 'b', 'c'] })]);
  const txt = summaryText(g);
  assert.match(txt, /B → A : 30,00\s€/);
  assert.match(formatMoney(-1234, 'EUR'), /^−12,34\s€$/);
});

test('import : forme du groupe vérifiée', () => {
  assert.ok(isValidGroup(group([exp(100, 'a', { mode: 'equal', ids: ['a'] })])));
  assert.ok(!isValidGroup({ name: 'x' }));
  assert.ok(!isValidGroup(group([{ type: 'expense', amount: 1.5, payer: 'a' }])));
});
