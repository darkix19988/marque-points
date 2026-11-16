// Dépenses de groupe — interface (un seul téléphone, données dans le navigateur)
// Le numéro de version force le chargement de app.js et money.js ensemble après une mise à jour.
import * as M from './money.js?v=6';

const KEY = 'marque-points:depenses:v1';
const COLORS = ['#d9480f', '#1c7ed6', '#2b8a3e', '#ae3ec9', '#e8590c', '#0c8599', '#c2255c', '#5f3dc4', '#868e96', '#a07800', '#364fc7', '#087f5b'];
const colorFor = (i) => (i < COLORS.length ? COLORS[i] : `hsl(${(i * 47) % 360} 55% 42%)`);
const $app = document.getElementById('app');

// ---------- Données ----------
function load() {
  const empty = { groups: [], lastPeople: [] };
  try {
    const d = { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    d.groups = (d.groups || []).filter(M.isValidGroup);
    return d;
  } catch (e) {
    return empty;
  }
}
let db = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* stockage plein ou bloqué */ }
}

const ui = {
  screen: 'home',
  gid: null,
  tab: 'list',
  draft: null, // dépense ou remboursement en cours de saisie
  groupDraft: null, // création / modification d'un groupe
  modal: null,
  toast: null,
};

// ---------- Outils ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-JJ, heure locale
const initial = (name) => esc((name || '?').trim().charAt(0).toUpperCase() || '?');
const avatar = (p) => `<span class="avatar" style="--c:${p.color}" aria-hidden="true">${initial(p.name)}</span>`;
const group = () => db.groups.find((g) => g.id === ui.gid);
const money = (c, opts) => M.formatMoney(c, group() ? group().currency : 'EUR', opts);
const person = (g, id) => g.people.find((p) => p.id === id) || { id, name: '?', color: '#888' };
const cls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
const dateLabel = (d) => {
  if (!d) return '';
  const t = today();
  if (d === t) return 'Aujourd’hui';
  const y = new Date(Date.now() - 864e5).toLocaleDateString('sv-SE');
  if (d === y) return 'Hier';
  return new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};
const themeButton = () => (window.mpTheme
  ? `<button class="icon-btn" data-act="theme" aria-label="Thème : ${mpTheme.label()}, toucher pour changer" title="Thème : ${mpTheme.label()}">${mpTheme.icon()}</button>`
  : '');

function toast(text, undo) {
  ui.toast = { text, undo };
  render();
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { ui.toast = null; render(); }, undo ? 5000 : 2200);
}

function go(screen) {
  ui.screen = screen;
  ui.modal = null;
  render();
  window.scrollTo(0, 0);
}

// ---------- Accueil ----------
function viewHome() {
  const groups = db.groups.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const list = groups.map((g) => {
    const n = g.items.filter((i) => i.type === 'expense').length;
    const moves = M.settle(g).length;
    return `<button class="card group-card" data-act="openGroup" data-id="${g.id}">
      <span class="grow"><b>${esc(g.name)}</b>
        <span class="muted small">${g.people.length} personnes · ${n} dépense${n > 1 ? 's' : ''}${moves ? ` · ${moves} remboursement${moves > 1 ? 's' : ''} à faire` : n ? ' · tout le monde est quitte' : ''}</span>
        <span class="faces">${g.people.slice(0, 8).map(avatar).join('')}${g.people.length > 8 ? `<span class="more">+${g.people.length - 8}</span>` : ''}</span></span>
      <span class="sum">${M.formatMoney(M.totalSpent(g), g.currency)}</span>
    </button>`;
  }).join('');
  return `
    <header class="topbar"><div class="wrap">
      <a class="icon-btn" href="../" aria-label="Accueil Marque-points">‹</a>
      <div class="title"><strong>Dépenses</strong><span>Partage des frais entre amis</span></div>
      ${themeButton()}
    </div></header>
    <main class="page no-bar"><div class="wrap stack">
      <div class="sk-hero"><div class="skull" aria-hidden="true">💸</div><h1>Qui doit quoi ?</h1>
        <p class="muted">Notez qui a payé quoi pendant le week-end, la coloc ou la soirée : le site calcule qui rembourse qui, avec le moins de virements possible.</p></div>
      ${list ? `<div class="section-title">Vos groupes</div>${list}` : ''}
      <button class="btn btn-primary btn-lg btn-block" data-act="newGroup">+ Nouveau groupe</button>
      <label class="btn btn-ghost btn-block">Importer un groupe (fichier .json)
        <input type="file" accept="application/json,.json" data-change="importFile" hidden></label>
      <p class="tiny muted" style="text-align:center">Tout reste sur ce téléphone. Pour changer d’appareil, exportez le groupe depuis son menu ⋯.</p>
      <button class="btn btn-ghost btn-small" data-act="reloadApp" style="justify-self:center">🔄 Recharger l’application</button>
    </div></main>`;
}

// ---------- Création / modification d'un groupe ----------
function startGroupDraft(g) {
  ui.groupDraft = g
    ? { id: g.id, name: g.name, currency: g.currency, people: g.people.map((p) => ({ ...p })) }
    : { id: null, name: '', currency: 'EUR', people: (db.lastPeople.length ? db.lastPeople : ['', '']).map((name) => ({ id: uid(), name })) };
  go('groupEdit');
}

function usedIds(g) {
  const used = new Set();
  if (!g) return used;
  for (const it of g.items) {
    used.add(it.payer);
    if (it.to) used.add(it.to);
    for (const id of Object.keys(M.sharesOf(it))) used.add(id);
  }
  return used;
}

function viewGroupEdit() {
  const d = ui.groupDraft;
  const existing = d.id ? db.groups.find((g) => g.id === d.id) : null;
  const used = usedIds(existing);
  const named = d.people.filter((p) => p.name.trim()).length;
  const issues = [];
  if (!d.name.trim()) issues.push('Donnez un nom au groupe.');
  if (named < 2) issues.push('Il faut au moins 2 personnes.');
  const rows = d.people.map((p, i) => `
    <div class="player-row">
      <span class="avatar" style="--c:${p.color || colorFor(i)}" aria-hidden="true">${i + 1}</span>
      <input type="text" value="${esc(p.name)}" placeholder="Prénom" data-input="pname" data-i="${i}" autocomplete="off" enterkeyhint="next" maxlength="24" aria-label="Personne ${i + 1}">
      ${used.has(p.id)
        ? '<span class="icon-btn" title="Présente dans des dépenses" aria-label="Présente dans des dépenses, impossible à retirer" style="opacity:.35">🔒</span>'
        : `<button class="icon-btn" data-act="delPerson" data-i="${i}" aria-label="Retirer">✕</button>`}
    </div>`).join('');
  return `
    <header class="topbar"><div class="wrap">
      <button class="icon-btn" data-act="${existing ? 'backGroup' : 'home'}" aria-label="Retour">‹</button>
      <div class="title"><strong>${existing ? 'Modifier le groupe' : 'Nouveau groupe'}</strong><span>Nom, devise et participants</span></div>
      <span style="width:44px"></span>
    </div></header>
    <main class="page"><div class="wrap stack">
      <div class="section-title">Nom</div>
      <input class="field" type="text" value="${esc(d.name)}" placeholder="Week-end à Annecy, Coloc, Soirée jeux…" data-input="gname" maxlength="40" aria-label="Nom du groupe">
      <div class="section-title">Devise</div>
      <select class="field" data-change="currency" aria-label="Devise" ${existing && existing.items.length ? 'disabled' : ''}>
        ${M.CURRENCIES.map((c) => `<option value="${c.code}" ${c.code === d.currency ? 'selected' : ''}>${c.label}</option>`).join('')}
      </select>
      ${existing && existing.items.length ? '<p class="tiny muted" style="padding:0 4px">La devise ne change plus une fois des dépenses saisies.</p>' : ''}
      <div class="section-title">Participants</div>
      <div class="card stack" style="gap:8px">
        ${rows}
        <button class="btn" data-act="addPerson">+ Ajouter une personne</button>
        ${used.size ? '<p class="tiny muted">🔒 Une personne présente dans des dépenses ne peut pas être retirée, mais on peut la renommer.</p>' : ''}
      </div>
    </div></main>
    <div class="bar"><div class="wrap">
      <div class="info">${issues.length ? `<span class="neg">${issues[0]}</span>` : `<b>${named} personnes</b>`}</div>
      <button class="btn btn-primary btn-lg" data-act="saveGroup" ${issues.length ? 'disabled' : ''}>${existing ? 'Enregistrer' : 'Créer le groupe'}</button>
    </div></div>`;
}

function saveGroup() {
  const d = ui.groupDraft;
  const people = d.people
    .filter((p) => p.name.trim())
    .map((p, i) => ({ id: p.id, name: p.name.trim(), color: p.color || colorFor(i) }));
  let g = d.id ? db.groups.find((x) => x.id === d.id) : null;
  if (g) {
    // On garde les personnes déjà utilisées même si leur nom a été effacé par erreur.
    const used = usedIds(g);
    for (const p of g.people) if (used.has(p.id) && !people.some((x) => x.id === p.id)) people.push(p);
    Object.assign(g, { name: d.name.trim(), currency: d.currency, people, updatedAt: Date.now() });
  } else {
    g = { id: uid(), name: d.name.trim(), currency: d.currency, people, items: [], createdAt: Date.now(), updatedAt: Date.now() };
    db.groups.push(g);
  }
  db.lastPeople = people.map((p) => p.name);
  save();
  ui.gid = g.id;
  ui.tab = 'list';
  go('group');
}

// ---------- Groupe ----------
function itemsSorted(g) {
  return g.items.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
}

function viewList(g) {
  if (!g.items.length) {
    return `<div class="empty"><div class="big" aria-hidden="true">🧾</div><b>Aucune dépense pour l’instant</b>
      <p class="muted small">Ajoutez la première avec le bouton en bas de l’écran.</p></div>`;
  }
  let lastDate = null;
  let html = '';
  for (const it of itemsSorted(g)) {
    if (it.date !== lastDate) {
      if (lastDate !== null) html += '</div>';
      html += `<div class="section-title">${dateLabel(it.date)}</div><div class="card list-card">`;
      lastDate = it.date;
    }
    if (it.type === 'transfer') {
      html += `<button class="item-row" data-act="editItem" data-id="${it.id}">
        <span class="cat" aria-hidden="true">💸</span>
        <span class="grow"><b>${esc(person(g, it.payer).name)} → ${esc(person(g, it.to).name)}</b><span class="muted small">${esc(it.title || 'Remboursement')}</span></span>
        <span class="amt muted">${money(it.amount)}</span></button>`;
    } else {
      const shares = M.sharesOf(it);
      const n = Object.keys(shares).length;
      const forWho = n === g.people.length ? 'tout le monde' : n === 1 ? esc(person(g, Object.keys(shares)[0]).name) : `${n} personnes`;
      html += `<button class="item-row" data-act="editItem" data-id="${it.id}">
        <span class="cat" aria-hidden="true">${M.categoryOf(it.category).icon}</span>
        <span class="grow"><b>${esc(it.title || M.categoryOf(it.category).label)}</b><span class="muted small">Payé par ${esc(person(g, it.payer).name)} · pour ${forWho}</span></span>
        <span class="amt">${money(it.amount)}</span></button>`;
    }
  }
  return `${html}</div>`;
}

function viewBalance(g) {
  const bal = M.balances(g);
  const moves = M.settle(g);
  const max = Math.max(1, ...g.people.map((p) => Math.abs(bal[p.id].net)));
  const rows = g.people.map((p) => {
    const b = bal[p.id];
    const w = Math.round((Math.abs(b.net) / max) * 100);
    return `<div class="bal-row">
      ${avatar(p)}
      <span class="grow"><b>${esc(p.name)}</b><span class="muted tiny">a payé ${money(b.paid)} · sa part ${money(b.spent)}</span>
        <span class="bal-bar ${b.net >= 0 ? 'up' : 'down'}"><i style="width:${w}%"></i></span></span>
      <span class="amt ${cls(b.net)}">${money(b.net, { signed: true })}</span></div>`;
  }).join('');
  const moveRows = moves.map((m, i) => `
    <div class="move-row">
      ${avatar(person(g, m.from))}<span class="grow"><b>${esc(person(g, m.from).name)}</b> doit <b>${money(m.amount)}</b> à <b>${esc(person(g, m.to).name)}</b></span>
      <button class="btn btn-small" data-act="settleMove" data-i="${i}">Fait ✓</button>
    </div>`).join('');
  return `
    <div class="section-title">Soldes</div>
    <div class="card list-card">${rows}</div>
    <p class="tiny muted" style="padding:0 4px">En vert, on lui doit de l’argent. En rouge, il ou elle en doit.</p>
    <div class="section-title">Remboursements à faire</div>
    ${moves.length
      ? `<div class="card list-card">${moveRows}</div>
         <p class="tiny muted" style="padding:0 4px">Le moins de virements possible. Touchez « Fait » quand l’argent a été rendu.</p>`
      : '<div class="empty small-empty"><div class="big" aria-hidden="true">✅</div><b>Tout le monde est quitte</b></div>'}
    <button class="btn btn-block" data-act="share">📤 Partager le résumé</button>`;
}

function viewGroup() {
  const g = group();
  if (!g) return viewHome();
  const total = M.totalSpent(g);
  return `
    <header class="topbar"><div class="wrap">
      <button class="icon-btn" data-act="home" aria-label="Tous les groupes">‹</button>
      <div class="title"><strong>${esc(g.name)}</strong><span>${g.people.length} personnes · ${M.formatMoney(total, g.currency)} dépensés</span></div>
      <button class="icon-btn" data-act="groupMenu" aria-label="Menu du groupe">⋯</button>
    </div></header>
    <main class="page"><div class="wrap stack">
      <div class="tabs" role="tablist">
        <button role="tab" class="${ui.tab === 'list' ? 'on' : ''}" aria-selected="${ui.tab === 'list'}" data-act="tab" data-v="list">Dépenses</button>
        <button role="tab" class="${ui.tab === 'balance' ? 'on' : ''}" aria-selected="${ui.tab === 'balance'}" data-act="tab" data-v="balance">Qui doit quoi</button>
      </div>
      ${ui.tab === 'list' ? viewList(g) : viewBalance(g)}
    </div></main>
    <div class="bar"><div class="wrap">
      <button class="btn btn-compact" data-act="newTransfer">💸 Remboursement</button>
      <span class="info"></span>
      <button class="btn btn-primary btn-lg" data-act="newExpense">+ Dépense</button>
    </div></div>`;
}

// ---------- Saisie d'une dépense / d'un remboursement ----------
function newDraft(type, preset = {}) {
  const g = group();
  const ids = g.people.map((p) => p.id);
  ui.draft = {
    id: null, type, title: '', amount: null, amountText: '', payer: null, to: null, date: today(), category: 'other',
    split: { mode: 'equal', ids: ids.slice(), shares: Object.fromEntries(ids.map((id) => [id, 1])), amounts: {}, amountTexts: {} },
    ...preset,
  };
  if (preset.amount) ui.draft.amountText = M.centsToInput(preset.amount);
  go('item');
}

function editDraft(it) {
  const g = group();
  const ids = g.people.map((p) => p.id);
  const s = it.split || {};
  ui.draft = {
    ...JSON.parse(JSON.stringify(it)),
    amountText: M.centsToInput(it.amount),
    split: {
      mode: s.mode || 'equal',
      ids: s.ids ? s.ids.slice() : ids.slice(),
      shares: { ...Object.fromEntries(ids.map((id) => [id, 0])), ...(s.shares || (s.mode === 'equal' ? Object.fromEntries((s.ids || []).map((id) => [id, 1])) : {})) },
      amounts: { ...(s.amounts || {}) },
      amountTexts: Object.fromEntries(Object.entries(s.amounts || {}).map(([k, v]) => [k, M.centsToInput(v)])),
    },
  };
  if (it.type === 'expense' && s.mode !== 'shares' && !s.shares) {
    ui.draft.split.shares = Object.fromEntries(ids.map((id) => [id, (s.ids || ids).includes(id) ? 1 : 0]));
  }
  go('item');
}

/** Dépense telle qu'elle sera enregistrée (sans les champs de saisie temporaires). */
function draftToItem(d) {
  const base = { id: d.id || uid(), type: d.type, title: d.title.trim(), amount: d.amount || 0, payer: d.payer, date: d.date || today(), createdAt: d.createdAt || Date.now() };
  if (d.type === 'transfer') return { ...base, to: d.to };
  const s = d.split;
  let split;
  if (s.mode === 'exact') split = { mode: 'exact', amounts: Object.fromEntries(Object.entries(s.amounts).filter(([, v]) => v > 0)) };
  else if (s.mode === 'shares') split = { mode: 'shares', shares: Object.fromEntries(Object.entries(s.shares).filter(([, v]) => v > 0)) };
  else split = { mode: 'equal', ids: s.ids.slice() };
  return { ...base, category: d.category, split };
}

function nameChips(g, act, selected, multi) {
  return `<div class="tags" role="group">${g.people.map((p) => {
    const on = multi ? selected.includes(p.id) : selected === p.id;
    return `<button class="chip name-chip ${on ? 'on' : ''}" data-act="${act}" data-p="${p.id}" aria-pressed="${on}">${esc(p.name)}</button>`;
  }).join('')}</div>`;
}

function splitRows(g, d) {
  const s = d.split;
  const item = draftToItem(d);
  const shares = M.sharesOf(item);
  if (s.mode === 'exact') {
    return g.people.map((p) => `<div class="split-row">${avatar(p)}<span class="grow">${esc(p.name)}</span>
      <input class="money-input" type="text" inputmode="decimal" value="${esc(s.amountTexts[p.id] || '')}" placeholder="0" data-input="exact" data-p="${p.id}" aria-label="Part de ${esc(p.name)}"></div>`).join('')
      + `<div class="split-row total-row"><span class="grow">Reste à répartir</span><b id="exact-left"></b></div>`;
  }
  if (s.mode === 'shares') {
    return g.people.map((p) => `<div class="split-row">${avatar(p)}<span class="grow">${esc(p.name)}<span class="tiny muted" id="share-${p.id}">${shares[p.id] ? money(shares[p.id]) : '–'}</span></span>
      <span class="stepper"><button data-act="shareStep" data-p="${p.id}" data-d="-1" ${s.shares[p.id] ? '' : 'disabled'} aria-label="Une part de moins">−</button>
      <output>${s.shares[p.id] || 0}</output>
      <button data-act="shareStep" data-p="${p.id}" data-d="1" aria-label="Une part de plus">+</button></span></div>`).join('');
  }
  return g.people.map((p) => {
    const on = s.ids.includes(p.id);
    return `<button class="split-row check-row ${on ? 'on' : ''}" data-act="toggleFor" data-p="${p.id}" aria-pressed="${on}">
      <span class="check" aria-hidden="true">${on ? '✓' : ''}</span>${avatar(p)}<span class="grow">${esc(p.name)}</span>
      <span class="muted small" id="share-${p.id}">${on && shares[p.id] ? money(shares[p.id]) : ''}</span></button>`;
  }).join('');
}

function viewItem() {
  const g = group();
  const d = ui.draft;
  const isTransfer = d.type === 'transfer';
  const errors = M.validateItem(draftToItem(d), g.currency);
  const symbol = M.formatMoney(0, g.currency).replace(/[\d\s,.  ]/g, '');
  const head = `
    <header class="topbar"><div class="wrap">
      <button class="icon-btn" data-act="backGroup" aria-label="Annuler">‹</button>
      <div class="title"><strong>${isTransfer ? (d.id ? 'Modifier le remboursement' : 'Nouveau remboursement') : (d.id ? 'Modifier la dépense' : 'Nouvelle dépense')}</strong><span>${esc(g.name)}</span></div>
      ${d.id ? '<button class="icon-btn" data-act="askDeleteItem" aria-label="Supprimer">🗑️</button>' : '<span style="width:44px"></span>'}
    </div></header>`;
  const amount = `
    <label class="amount-box"><span class="sr">Montant</span>
      <input class="amount-input" type="text" inputmode="decimal" value="${esc(d.amountText)}" placeholder="0" data-input="amount" autocomplete="off" aria-label="Montant">
      <span class="cur">${esc(symbol)}</span></label>`;
  let body;
  if (isTransfer) {
    body = `${amount}
      <div class="section-title">Qui rembourse ?</div>${nameChips(g, 'payer', d.payer, false)}
      <div class="section-title">À qui ?</div>${nameChips(g, 'to', d.to, false)}
      <div class="section-title">Date</div>
      <input class="field" type="date" value="${esc(d.date)}" data-change="date" aria-label="Date">`;
  } else {
    const modes = [['equal', 'Parts égales'], ['shares', 'Par parts'], ['exact', 'Montants']];
    body = `${amount}
      <input class="field" type="text" value="${esc(d.title)}" placeholder="Courses, resto, essence…" data-input="title" maxlength="50" aria-label="Description">
      <div class="tags cats" role="group" aria-label="Catégorie">${M.CATEGORIES.map((c) => `<button class="chip name-chip ${d.category === c.id ? 'on' : ''}" data-act="category" data-v="${c.id}" aria-pressed="${d.category === c.id}">${c.icon} ${c.label}</button>`).join('')}</div>
      <div class="section-title">Payé par</div>${nameChips(g, 'payer', d.payer, false)}
      <div class="section-head"><div class="section-title">Pour qui</div>
        ${d.split.mode === 'equal' ? `<button class="btn btn-small" data-act="toggleAll">${d.split.ids.length === g.people.length ? 'Personne' : 'Tout le monde'}</button>` : ''}</div>
      <div class="tabs small-tabs" role="tablist">${modes.map(([v, l]) => `<button role="tab" class="${d.split.mode === v ? 'on' : ''}" data-act="splitMode" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="card list-card" id="split-zone">${splitRows(g, d)}</div>
      ${d.split.mode === 'shares' ? '<p class="tiny muted" style="padding:0 4px">Exemple : un couple compte pour 2 parts, un enfant pour 1.</p>' : ''}
      <div class="section-title">Date</div>
      <input class="field" type="date" value="${esc(d.date)}" data-change="date" aria-label="Date">`;
  }
  return `${head}
    <main class="page"><div class="wrap stack">${body}</div></main>
    <div class="bar"><div class="wrap">
      <div class="info" id="form-errors">${errors.length ? `<span class="neg">${esc(errors[0])}</span>` : '<span class="pos">Prêt à enregistrer</span>'}</div>
      <button class="btn btn-primary btn-lg" id="save-btn" data-act="saveItem" ${errors.length ? 'disabled' : ''}>Enregistrer</button>
    </div></div>`;
}

/** Met à jour les parts et les erreurs pendant la frappe, sans redessiner (le clavier reste ouvert). */
function liveUpdate() {
  const g = group();
  const d = ui.draft;
  if (!g || !d) return;
  const item = draftToItem(d);
  const errors = M.validateItem(item, g.currency);
  const info = document.getElementById('form-errors');
  if (info) info.innerHTML = errors.length ? `<span class="neg">${esc(errors[0])}</span>` : '<span class="pos">Prêt à enregistrer</span>';
  const btn = document.getElementById('save-btn');
  if (btn) btn.disabled = errors.length > 0;
  if (d.type !== 'expense') return;
  const shares = M.sharesOf(item);
  for (const p of g.people) {
    const el = document.getElementById(`share-${p.id}`);
    if (!el) continue;
    const on = d.split.mode !== 'equal' || d.split.ids.includes(p.id);
    el.textContent = on && shares[p.id] ? money(shares[p.id]) : d.split.mode === 'shares' ? '–' : '';
  }
  const left = document.getElementById('exact-left');
  if (left) {
    const sum = Object.values(d.split.amounts).reduce((a, b) => a + (b || 0), 0);
    const rest = (d.amount || 0) - sum;
    left.textContent = money(rest);
    left.className = rest === 0 ? 'pos' : 'neg';
  }
}

function saveItem() {
  const g = group();
  const item = draftToItem(ui.draft);
  if (M.validateItem(item, g.currency).length) return;
  const i = g.items.findIndex((x) => x.id === item.id);
  if (i >= 0) g.items[i] = item;
  else g.items.push(item);
  g.updatedAt = Date.now();
  save();
  ui.draft = null;
  go('group');
  toast(i >= 0 ? 'Modifié' : item.type === 'transfer' ? 'Remboursement ajouté' : 'Dépense ajoutée');
}

// ---------- Partage, export, import ----------
async function shareSummary() {
  const g = group();
  const text = M.summaryText(g);
  try {
    if (navigator.share) {
      await navigator.share({ title: g.name, text });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Résumé copié : collez-le dans un message');
  } catch (e) {
    ui.modal = { type: 'text', title: 'Résumé', text };
    render();
  }
}

function exportGroup() {
  const g = group();
  const blob = new Blob([JSON.stringify({ app: 'marque-points-depenses', version: 1, group: g }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `depenses-${g.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'groupe'}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  ui.modal = null;
  toast('Fichier du groupe téléchargé');
}

function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const g = data && data.group ? data.group : data;
      if (!M.isValidGroup(g)) throw new Error('format');
      const copy = { ...g, id: uid(), currency: g.currency || 'EUR', updatedAt: Date.now() };
      copy.people = copy.people.map((p, i) => ({ ...p, color: p.color || colorFor(i) }));
      db.groups.push(copy);
      save();
      ui.gid = copy.id;
      ui.tab = 'list';
      go('group');
      toast(`Groupe « ${copy.name} » importé`);
    } catch (e) {
      toast('Ce fichier n’est pas un groupe de dépenses valide');
    }
  };
  reader.readAsText(file);
}

// ---------- Fenêtres ----------
function viewModal() {
  if (!ui.modal) return '';
  let body = '';
  const m = ui.modal;
  if (m.type === 'groupMenu') {
    body = `<h2>${esc(group().name)}</h2><div class="stack" style="gap:8px;margin-top:12px">
      <button class="btn btn-block" data-act="editGroup">✏️ Modifier le groupe et les participants</button>
      <button class="btn btn-block" data-act="share">📤 Partager le résumé</button>
      <button class="btn btn-block" data-act="exportGroup">💾 Exporter (fichier pour un autre téléphone)</button>
      <button class="btn btn-block" data-act="theme">${window.mpTheme ? `${mpTheme.icon()} Thème : ${mpTheme.label()}` : 'Thème'}</button>
      <button class="btn btn-block" data-act="reloadApp">🔄 Recharger l’application</button>
      <button class="btn btn-block btn-danger" data-act="askDeleteGroup">Supprimer le groupe</button>
      <button class="btn btn-block btn-ghost" data-act="closeModal">Fermer</button></div>`;
  } else if (m.type === 'confirm') {
    body = `<h2>${m.title}</h2><p class="muted">${m.text}</p>
      <div class="actions"><button class="btn" data-act="closeModal">Annuler</button>
      <button class="btn btn-primary" data-act="${m.ok}">${m.okLabel}</button></div>`;
  } else if (m.type === 'text') {
    body = `<h2>${esc(m.title)}</h2><p class="muted small">Copiez ce texte pour l’envoyer :</p>
      <textarea class="field" rows="12" readonly style="width:100%;font-size:14px">${esc(m.text)}</textarea>
      <div class="actions"><button class="btn btn-primary" data-act="closeModal">Fermer</button></div>`;
  }
  return `<div class="modal-back" data-act="backdrop"><div class="modal" role="dialog" aria-modal="true">${body}</div></div>`;
}

// ---------- Rendu ----------
function renderScreen() {
  let html;
  switch (ui.screen) {
    case 'groupEdit': html = viewGroupEdit(); break;
    case 'group': html = viewGroup(); break;
    case 'item': html = group() && ui.draft ? viewItem() : viewHome(); break;
    default: html = viewHome();
  }
  const t = ui.toast;
  $app.innerHTML = html + viewModal()
    + (t ? `<div class="toast" role="status">${esc(t.text)}${t.undo ? ' <button class="toast-btn" data-act="undo">Annuler</button>' : ''}</div>` : '');
  document.body.style.overflow = ui.modal ? 'hidden' : '';
  if (ui.screen === 'item') liveUpdate();
}

function render() {
  try {
    renderScreen();
  } catch (err) {
    console.error(err);
    ui.modal = null;
    $app.innerHTML = `<main class="page no-bar"><div class="wrap stack" style="padding-top:40px">
      <div class="card stack"><h2>Oups, l’affichage a planté</h2>
      <p class="muted">Souvent juste après une mise à jour du site. Vos groupes sont sauvegardés : rechargez la page.</p>
      <button class="btn btn-primary btn-lg" onclick="location.reload()">Recharger</button>
      <p class="tiny muted">${esc(err && err.message)}</p></div></div></main>`;
  }
}

// ---------- Actions ----------
const actions = {
  home: () => { ui.draft = null; go('home'); },
  theme: () => {
    if (!window.mpTheme) return;
    mpTheme.cycle();
    toast(`Thème : ${mpTheme.label()}${mpTheme.get() === 'auto' ? ' (suit le téléphone)' : ''}`);
  },
  newGroup: () => startGroupDraft(null),
  reloadApp: () => { if (window.mpReload) mpReload(); else location.reload(); },
  openGroup: (d) => { ui.gid = d.id; ui.tab = 'list'; go('group'); },
  backGroup: () => { ui.draft = null; go(group() ? 'group' : 'home'); },
  addPerson: () => {
    ui.groupDraft.people.push({ id: uid(), name: '' });
    render();
    const inputs = $app.querySelectorAll('[data-input="pname"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  },
  delPerson: (d) => { ui.groupDraft.people.splice(+d.i, 1); render(); },
  saveGroup: () => saveGroup(),
  tab: (d) => { ui.tab = d.v; render(); },
  groupMenu: () => { ui.modal = { type: 'groupMenu' }; render(); },
  closeModal: () => { ui.modal = null; render(); },
  backdrop: (d, el, e) => { if (e.target === el) { ui.modal = null; render(); } },
  editGroup: () => startGroupDraft(group()),
  exportGroup: () => exportGroup(),
  share: () => { ui.modal = null; render(); shareSummary(); },
  askDeleteGroup: () => {
    ui.modal = { type: 'confirm', title: 'Supprimer ce groupe ?', text: 'Toutes ses dépenses seront effacées de ce téléphone. Pensez à l’exporter avant si besoin.', ok: 'deleteGroup', okLabel: 'Supprimer' };
    render();
  },
  deleteGroup: () => { db.groups = db.groups.filter((g) => g.id !== ui.gid); ui.gid = null; save(); go('home'); },

  newExpense: () => newDraft('expense'),
  newTransfer: () => newDraft('transfer', { title: 'Remboursement' }),
  editItem: (d) => { const it = group().items.find((x) => x.id === d.id); if (it) editDraft(it); },
  payer: (d) => { ui.draft.payer = d.p; render(); },
  to: (d) => { ui.draft.to = d.p; render(); },
  category: (d) => { ui.draft.category = d.v; render(); },
  splitMode: (d) => {
    const s = ui.draft.split;
    s.mode = d.v;
    // En passant aux montants, on pré-remplit avec la répartition actuelle.
    if (d.v === 'exact' && !Object.values(s.amounts).some((v) => v > 0) && ui.draft.amount) {
      const shares = M.splitByWeights(ui.draft.amount, Object.fromEntries(s.ids.map((id) => [id, 1])));
      s.amounts = { ...shares };
      s.amountTexts = Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, M.centsToInput(v)]));
    }
    render();
  },
  toggleFor: (d) => {
    const ids = ui.draft.split.ids;
    const i = ids.indexOf(d.p);
    if (i >= 0) ids.splice(i, 1);
    else ids.push(d.p);
    group().people.forEach((p) => { ui.draft.split.shares[p.id] = ids.includes(p.id) ? Math.max(1, ui.draft.split.shares[p.id] || 0) : 0; });
    render();
  },
  toggleAll: () => {
    const g = group();
    const s = ui.draft.split;
    s.ids = s.ids.length === g.people.length ? [] : g.people.map((p) => p.id);
    render();
  },
  shareStep: (d) => {
    const s = ui.draft.split.shares;
    s[d.p] = Math.max(0, (s[d.p] || 0) + +d.d);
    render();
  },
  saveItem: () => saveItem(),
  askDeleteItem: () => {
    ui.modal = { type: 'confirm', title: 'Supprimer ?', text: 'Cette ligne disparaîtra des comptes du groupe.', ok: 'deleteItem', okLabel: 'Supprimer' };
    render();
  },
  deleteItem: () => {
    const g = group();
    const removed = g.items.find((x) => x.id === ui.draft.id);
    g.items = g.items.filter((x) => x.id !== ui.draft.id);
    g.updatedAt = Date.now();
    save();
    ui.draft = null;
    go('group');
    toast('Supprimé', removed ? { item: removed } : null);
  },
  settleMove: (d) => {
    const g = group();
    const m = M.settle(g)[+d.i];
    if (!m) return;
    const item = { id: uid(), type: 'transfer', title: 'Remboursement', amount: m.amount, payer: m.from, to: m.to, date: today(), createdAt: Date.now() };
    g.items.push(item);
    g.updatedAt = Date.now();
    save();
    toast(`${person(g, m.from).name} a remboursé ${money(m.amount)}`, { remove: item.id });
  },
  undo: () => {
    const g = group();
    const u = ui.toast && ui.toast.undo;
    if (!g || !u) return;
    if (u.remove) g.items = g.items.filter((x) => x.id !== u.remove);
    if (u.item) g.items.push(u.item);
    save();
    ui.toast = null;
    render();
  },
};

const changes = {
  currency: (v) => { ui.groupDraft.currency = v; },
  date: (v) => { ui.draft.date = v || today(); },
  importFile: (v, el) => { importFile(el.files && el.files[0]); el.value = ''; },
};

$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el.dataset, el, e);
});
$app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.change && changes[el.dataset.change]) changes[el.dataset.change](el.value, el);
});
$app.addEventListener('input', (e) => {
  const el = e.target;
  const k = el.dataset.input;
  if (!k) return;
  if (k === 'pname' && ui.groupDraft) { ui.groupDraft.people[+el.dataset.i].name = el.value; refreshGroupBar(); }
  if (k === 'gname' && ui.groupDraft) { ui.groupDraft.name = el.value; refreshGroupBar(); }
  if (!ui.draft) return;
  if (k === 'title') ui.draft.title = el.value;
  if (k === 'amount') {
    ui.draft.amountText = el.value;
    ui.draft.amount = M.parseAmount(el.value);
    liveUpdate();
  }
  if (k === 'exact') {
    ui.draft.split.amountTexts[el.dataset.p] = el.value;
    const v = M.parseAmount(el.value);
    if (v == null) delete ui.draft.split.amounts[el.dataset.p];
    else ui.draft.split.amounts[el.dataset.p] = v;
    liveUpdate();
  }
});
$app.addEventListener('keydown', (e) => {
  const el = e.target;
  if (e.key !== 'Enter') return;
  if (el.dataset.input === 'pname') {
    e.preventDefault();
    const next = $app.querySelector(`[data-input="pname"][data-i="${+el.dataset.i + 1}"]`);
    if (next) next.focus();
    else actions.addPerson();
  } else if (['amount', 'title', 'exact', 'gname'].includes(el.dataset.input)) {
    e.preventDefault();
    el.blur();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.modal) { ui.modal = null; render(); }
});

/** Barre du bas de l'écran groupe, mise à jour pendant la frappe sans perdre le clavier. */
function refreshGroupBar() {
  const d = ui.groupDraft;
  const named = d.people.filter((p) => p.name.trim()).length;
  const issue = !d.name.trim() ? 'Donnez un nom au groupe.' : named < 2 ? 'Il faut au moins 2 personnes.' : '';
  const info = $app.querySelector('.bar .info');
  const btn = $app.querySelector('[data-act="saveGroup"]');
  if (info) info.innerHTML = issue ? `<span class="neg">${issue}</span>` : `<b>${named} personnes</b>`;
  if (btn) btn.disabled = !!issue;
}

window.addEventListener('storage', (e) => { if (e.key === KEY) { db = load(); render(); } });

render();
