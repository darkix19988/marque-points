// Partage des dépenses : calculs (sans DOM, testé avec `node --test`).
// Tous les montants sont en centimes (entiers) pour éviter les erreurs d'arrondi.

export const CURRENCIES = [
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'Dollar US ($)' },
  { code: 'GBP', label: 'Livre sterling (£)' },
  { code: 'CHF', label: 'Franc suisse (CHF)' },
  { code: 'CAD', label: 'Dollar canadien ($ CA)' },
];

export const CATEGORIES = [
  { id: 'food', icon: '🍽️', label: 'Repas' },
  { id: 'groceries', icon: '🛒', label: 'Courses' },
  { id: 'drinks', icon: '🍻', label: 'Boissons' },
  { id: 'home', icon: '🏠', label: 'Logement' },
  { id: 'transport', icon: '🚗', label: 'Transport' },
  { id: 'fun', icon: '🎉', label: 'Sorties' },
  { id: 'other', icon: '📦', label: 'Autre' },
];

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

/** "12,5" / "12.50" / "1 234,56 €" → 1250 / 1250 / 123456. Renvoie null si invalide ou négatif. */
export function parseAmount(text) {
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? Math.round(text * 100) : null;
  const clean = String(text ?? '').replace(/[\s  €$£]|CHF|CAD/gi, '').replace(',', '.');
  if (!/^\d*\.?\d{0,2}$/.test(clean) || clean === '' || clean === '.') return null;
  return Math.round(parseFloat(clean) * 100);
}

/** 1250 → "12,50" (pour remplir un champ de saisie). */
export function centsToInput(cents) {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');
}

export function formatMoney(cents, currency = 'EUR', { signed = false } = {}) {
  const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2 });
  const txt = fmt.format(Math.abs(cents) / 100);
  if (cents < 0) return `−${txt}`;
  if (signed && cents > 0) return `+${txt}`;
  return txt;
}

/**
 * Répartit `total` centimes selon des poids, sans perdre un centime :
 * méthode du plus fort reste, à égalité c'est l'ordre de la liste qui départage.
 */
export function splitByWeights(total, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const sumW = entries.reduce((a, [, w]) => a + w, 0);
  const out = {};
  if (!entries.length || sumW <= 0) return out;
  let given = 0;
  const rests = entries.map(([id, w], i) => {
    const exact = (total * w) / sumW;
    const base = Math.floor(exact);
    out[id] = base;
    given += base;
    return { id, rest: exact - base, i };
  });
  rests.sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let k = 0; k < total - given; k++) out[rests[k % rests.length].id] += 1;
  return out;
}

/** Part due par chaque personne pour une dépense : { id: centimes }. */
export function sharesOf(item) {
  if (!item || item.type !== 'expense') return {};
  const s = item.split || { mode: 'equal', ids: [] };
  if (s.mode === 'exact') {
    const out = {};
    for (const [id, c] of Object.entries(s.amounts || {})) if (c > 0) out[id] = c;
    return out;
  }
  if (s.mode === 'shares') return splitByWeights(item.amount, s.shares || {});
  return splitByWeights(item.amount, Object.fromEntries((s.ids || []).map((id) => [id, 1])));
}

/** Problèmes empêchant d'enregistrer une dépense ou un remboursement. */
export function validateItem(item, currency = 'EUR') {
  const errors = [];
  if (!(item.amount > 0)) errors.push('Indiquez un montant.');
  if (!item.payer) errors.push(item.type === 'transfer' ? 'Indiquez qui rembourse.' : 'Indiquez qui a payé.');
  if (item.type === 'transfer') {
    if (!item.to) errors.push('Indiquez qui reçoit l’argent.');
    else if (item.to === item.payer) errors.push('On ne se rembourse pas soi-même.');
    return errors;
  }
  const s = item.split || {};
  if (s.mode === 'exact') {
    const sum = Object.values(s.amounts || {}).reduce((a, b) => a + (b || 0), 0);
    if (item.amount > 0 && sum !== item.amount) {
      const diff = item.amount - sum;
      errors.push(diff > 0 ? `Il reste ${formatMoney(diff, currency)} à répartir.` : `Les parts dépassent le total de ${formatMoney(-diff, currency)}.`);
    }
  } else if (s.mode === 'shares') {
    if (!Object.values(s.shares || {}).some((w) => w > 0)) errors.push('Donnez au moins une part à quelqu’un.');
  } else if (!(s.ids || []).length) {
    errors.push('Choisissez au moins une personne concernée.');
  }
  return errors;
}

/**
 * Soldes : paid = ce que la personne a avancé, owed = sa part des dépenses,
 * net = paid − owed (positif : on lui doit de l'argent).
 * Un remboursement de A vers B compte comme si A avait « payé » et B « consommé ».
 */
export function balances(group) {
  const out = {};
  for (const p of group.people) out[p.id] = { paid: 0, owed: 0, net: 0, spent: 0 };
  const ensure = (id) => (out[id] = out[id] || { paid: 0, owed: 0, net: 0, spent: 0 });
  for (const it of group.items) {
    if (it.type === 'transfer') {
      ensure(it.payer).net += it.amount;
      ensure(it.to).net -= it.amount;
      continue;
    }
    ensure(it.payer).paid += it.amount;
    ensure(it.payer).net += it.amount;
    for (const [id, c] of Object.entries(sharesOf(it))) {
      ensure(id).owed += c;
      ensure(id).net -= c;
      out[id].spent += c;
    }
  }
  return out;
}

/**
 * Remboursements à faire, avec peu de virements : le plus gros débiteur rembourse
 * le plus gros créancier, et ainsi de suite.
 */
export function settle(group) {
  const bal = balances(group);
  const order = group.people.map((p) => p.id);
  const debt = [];
  const cred = [];
  for (const id of order) {
    const n = bal[id] ? bal[id].net : 0;
    if (n < 0) debt.push({ id, left: -n });
    else if (n > 0) cred.push({ id, left: n });
  }
  const byLeft = (a, b) => b.left - a.left || order.indexOf(a.id) - order.indexOf(b.id);
  const moves = [];
  debt.sort(byLeft);
  cred.sort(byLeft);
  while (debt.length && cred.length) {
    const d = debt[0];
    const c = cred[0];
    const amount = Math.min(d.left, c.left);
    moves.push({ from: d.id, to: c.id, amount });
    d.left -= amount;
    c.left -= amount;
    if (!d.left) debt.shift();
    if (!c.left) cred.shift();
    debt.sort(byLeft);
    cred.sort(byLeft);
  }
  return moves;
}

export function totalSpent(group) {
  return group.items.filter((i) => i.type === 'expense').reduce((a, i) => a + i.amount, 0);
}

/** Texte à envoyer par message : total, soldes et remboursements. */
export function summaryText(group) {
  const cur = group.currency;
  const name = (id) => (group.people.find((p) => p.id === id) || {}).name || '?';
  const bal = balances(group);
  const moves = settle(group);
  const n = group.items.filter((i) => i.type === 'expense').length;
  const lines = [`🧾 ${group.name}`, `Total des dépenses : ${formatMoney(totalSpent(group), cur)} (${n} dépense${n > 1 ? 's' : ''})`, ''];
  lines.push('Soldes :');
  for (const p of group.people) lines.push(`• ${p.name} : ${formatMoney(bal[p.id].net, cur, { signed: true })}`);
  lines.push('');
  if (moves.length) {
    lines.push('Remboursements :');
    for (const m of moves) lines.push(`• ${name(m.from)} → ${name(m.to)} : ${formatMoney(m.amount, cur)}`);
  } else {
    lines.push('Tout le monde est quitte ✅');
  }
  return lines.join('\n');
}

/** Vérifie la forme d'un groupe importé depuis un fichier. */
export function isValidGroup(g) {
  return !!g && typeof g.name === 'string' && Array.isArray(g.people) && Array.isArray(g.items)
    && g.people.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
    && g.items.every((i) => i && (i.type === 'expense' || i.type === 'transfer') && Number.isInteger(i.amount) && typeof i.payer === 'string');
}
