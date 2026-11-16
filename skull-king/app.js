// Skull King — interface du compteur de points
// Le numéro de version force le chargement de app.js et rules.js ensemble après une mise à jour.
import * as R from './rules.js?v=9';
import * as S from '../assets/js/shell.js?v=9';

const KEY = 'marque-points:skull-king:v1';
const COLORS = ['#d9480f', '#1c7ed6', '#2b8a3e', '#ae3ec9', '#e8590c', '#0c8599', '#c2255c', '#5f3dc4', '#868e96', '#a07800', '#364fc7', '#087f5b'];
const colorFor = (i) => (i < COLORS.length ? COLORS[i] : `hsl(${(i * 47) % 360} 55% 42%)`);
const $app = document.getElementById('app');

// ---------- Données ----------
function load() {
  const empty = { current: null, history: [], lastPlayers: [], lastConfig: null };
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch (e) {
    return empty;
  }
}
let db = load();
/** Anciennes sauvegardes : on remplit les annonces et plis manquants avec 0. */
function ensureDefaults(g) {
  if (!g) return;
  const ids = g.players.map((p) => p.id);
  g.rounds.forEach((r) => { if (!r.done) R.fillDefaults(r, ids); });
}
try { ensureDefaults(db.current); } catch (err) { console.error(err); }
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) { /* stockage plein ou bloqué : la partie continue en mémoire */ }
}

const ui = {
  screen: db.current && !db.current.finished ? 'play' : 'home',
  setup: null,
  edit: null, // { index, draft }
  past: null, // partie de l'historique affichée
  open: new Set(), // panneaux de bonus ouverts
  modal: null,
  toast: null,
};

// ---------- Outils ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('fr-FR');
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
const cls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
const uid = () => Math.random().toString(36).slice(2, 9);
const initial = (name) => esc((name || '?').trim().charAt(0).toUpperCase() || '?');
const avatar = (p) => `<span class="avatar" style="--c:${p.color}" aria-hidden="true">${initial(p.name)}</span>`;
const plural = (n, one, many) => `${fmt(n)} ${Math.abs(n) > 1 ? many : one}`;
const dateFr = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

// Fenêtre native et zone de messages, en dehors de #app.
// Fermée par Échap, geste retour ou toucher à côté. Si la fenêtre a été rouverte entre-temps, on ignore.
const shell = S.mountShell({ onClose: () => { if (ui.modal && !shell.dlg.open) { ui.modal = null; render(); } } });

function toast(text) {
  ui.toast = text;
  render();
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { ui.toast = null; render(); }, 2200);
}

function go(screen) {
  ui.screen = screen;
  ui.modal = null;
  render();
  window.scrollTo(0, 0);
  S.focusTitle();
}

/** Manche en cours d'édition : la manche courante ou une copie d'une manche passée. */
function ctx() {
  const game = db.current;
  if (ui.screen === 'edit' && ui.edit) return { game, round: ui.edit.draft, index: ui.edit.index, editing: true };
  return { game, round: game.rounds[game.cur], index: game.cur, editing: false };
}
function commit() {
  if (ui.screen !== 'edit') save();
  render();
}

const themeButton = () => (window.mpTheme
  ? `<button class="icon-btn" data-act="theme" aria-label="Thème : ${mpTheme.label()}, toucher pour changer" title="Thème : ${mpTheme.label()}">${mpTheme.icon()}</button>`
  : '');

// ---------- Écran : accueil ----------
function viewHome() {
  const g = db.current && !db.current.finished ? db.current : null;
  let resume = '';
  if (g) {
    const list = R.ranking(g);
    resume = `
      <div class="card resume-card">
        <div>
          <div class="section-title" style="margin:0 0 4px">Partie en cours</div>
          <b>Manche ${g.cur + 1} sur ${g.rounds.length}</b>
          <span class="muted small"> · en tête : ${esc(list[0].name)} (${fmt(list[0].total)})</span>
        </div>
        <div class="who">${g.players.map((p) => `<span class="pill">${avatar(p)}${esc(p.name)}</span>`).join('')}</div>
        <button class="btn btn-primary btn-lg btn-block" data-act="resume">Reprendre la partie</button>
      </div>`;
  }
  const hist = db.history.slice().reverse().slice(0, 20);
  const histHtml = hist.length ? `
    <div class="section-title">Parties terminées</div>
    <div class="card" style="padding:6px 14px">
      ${hist.map((h) => {
        const list = R.ranking(h);
        return `<button class="history-item" data-act="viewPast" data-id="${h.id}">
          <span style="font-size:22px">🏆</span>
          <span class="grow"><b>${esc(list[0].name)} · ${fmt(list[0].total)} pts</b>
          <span class="muted small">${dateFr(h.finishedAt || h.createdAt)} · ${list.length} joueurs · ${h.rounds.length} manches</span></span>
          <span class="muted">›</span></button>`;
      }).join('')}
    </div>` : '';
  return `
    <header class="topbar"><div class="wrap">
      <a class="icon-btn" href="../" aria-label="Tous les jeux">‹</a>
      <div class="title"><strong>Skull King</strong><span>Compteur de points</span></div>
      ${themeButton()}
      <button class="icon-btn" data-act="rules" aria-label="Règles du décompte">?</button>
    </div></header>
    <main class="page no-bar"><div class="wrap stack">
      <div class="sk-hero">
        <div class="skull" aria-hidden="true">☠️</div>
        <h1>Skull King</h1>
        <p class="muted">Annonces, plis, bonus : le calcul est automatique.</p>
      </div>
      ${resume}
      <button class="btn ${g ? '' : 'btn-primary'} btn-lg btn-block" data-act="newGame">${g ? 'Nouvelle partie' : 'Commencer une partie'}</button>
      ${histHtml}
    </div></main>`;
}

// ---------- Écran : préparation ----------
function startSetup(from) {
  const names = from ? from.players.map((p) => p.name) : db.lastPlayers.length ? db.lastPlayers : ['', '', ''];
  const config = R.normalizeConfig(from ? from.config : db.lastConfig || R.defaultConfig());
  ui.setup = { players: names.map((name) => ({ id: uid(), name })), config };
  go('setup');
}

function seg(act, options, current) {
  return `<div class="tabs" role="group">${options.map(([v, l]) =>
    `<button class="${v === current ? 'on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${v === current}">${l}</button>`).join('')}</div>`;
}
function toggle(key, on, title) {
  return `<label class="switch"><span class="txt"><b>${title}</b></span>
    <input type="checkbox" data-cfg="${key}" ${on ? 'checked' : ''}></label>`;
}

/** Résumé des règles choisies, affiché quand le panneau est replié. */
function rulesSummary(c, nRounds) {
  const parts = [c.edition === 'old' ? 'Ancienne édition' : 'Édition actuelle'];
  parts.push(c.scoring === 'rascal' ? `Rascal${c.cannonball ? ' + boulet' : ''}` : 'Décompte classique');
  parts.push(plural(nRounds, 'manche', 'manches'));
  if (c.bonusMode === 'points') parts.push('bonus saisis');
  const extras = [];
  if (c.kraken) extras.push('Kraken');
  if (c.whale) extras.push('Baleine');
  if (c.loot) extras.push('Butin');
  if (c.abilities) extras.push('Pouvoirs');
  if (c.pack) extras.push('Expansion Pack');
  if (extras.length) parts.push(extras.join(', '));
  return parts.join(' · ');
}

function viewSetup() {
  const s = ui.setup;
  const c = s.config;
  const n = s.players.length;
  const advised = R.recommendedPlayers(c);
  const isNew = c.edition === 'new';
  const sched = R.scheduleRounds(c);
  const rounds = R.roundsFor(c, Math.max(2, n));
  const capped = rounds.some((k, i) => k !== sched[i]);
  const issue = n < 2 ? 'Il faut au moins 2 joueurs.' : '';

  const players = s.players.map((p, i) => `
    <div class="player-row">
      <span class="avatar" style="--c:${colorFor(i)}" aria-hidden="true">${i + 1}</span>
      <input type="text" value="${esc(p.name)}" placeholder="Joueur ${i + 1}" data-input="pname" data-i="${i}" autocomplete="off" enterkeyhint="next" maxlength="20" aria-label="Nom du joueur ${i + 1}">
      ${i > 0 ? `<button class="icon-btn" data-act="movePlayer" data-i="${i}" aria-label="Monter">↑</button>` : '<span style="width:38px"></span>'}
      <button class="icon-btn" data-act="delPlayer" data-i="${i}" aria-label="Retirer">✕</button>
    </div>`).join('');

  const notes = [];
  if (n > advised) notes.push(`Plus de ${advised} joueurs : les cartes par manche sont plafonnées pour que chacun en ait autant.`);
  if (n === 2 && isNew) notes.push('À 2, distribuez aussi une main au fantôme de Barbe-Grise (il joue en 2e, sans score).');

  const custom = c.schedule === 'custom' ? `
    <div class="custom-rounds">
      ${c.custom.map((k, i) => `<span class="custom-round"><small>M${i + 1}</small>
        <button data-act="customStep" data-i="${i}" data-d="-1" aria-label="Moins de cartes">−</button><b>${k}</b>
        <button data-act="customStep" data-i="${i}" data-d="1" aria-label="Plus de cartes">+</button>
        <button data-act="customDel" data-i="${i}" aria-label="Supprimer la manche">✕</button></span>`).join('')}
      <button class="btn btn-small" data-act="customAdd">+ Manche</button>
    </div>` : '';

  const rules = s.showRules ? `
    <div class="card stack rules-panel">
      <div><div class="field-label">Édition</div>${seg('edition', [['new', 'Actuelle'], ['old', 'Ancienne']], c.edition)}</div>
      <div><div class="field-label">Décompte</div>${seg('scoring', [['skull', 'Classique'], ['rascal', 'Rascal']], c.scoring)}
        <p class="hint">${c.scoring === 'rascal' ? '10 pts par carte : tout si l’annonce est juste, la moitié à 1 près.' : '+20 par pli si l’annonce est juste, −10 par pli d’écart sinon.'}</p>
        ${c.scoring === 'rascal' ? toggle('cannonball', c.cannonball, 'Option boulet de canon') : ''}</div>
      <div><div class="field-label">Bonus</div>${seg('bonusMode', [['cards', 'Compter les cartes'], ['points', 'Taper le score']], c.bonusMode)}</div>
      <div><div class="field-label">Manches</div>
        <select class="select" data-change="schedule" aria-label="Manches">
          ${R.SCHEDULES.map((x) => `<option value="${x.id}" ${x.id === c.schedule ? 'selected' : ''}>${x.label}</option>`).join('')}
        </select>
        <p class="hint">${(R.SCHEDULES.find((x) => x.id === c.schedule) || R.SCHEDULES[0]).sub}</p>${custom}
        ${capped ? `<p class="hint warn">Pas assez de cartes pour tous : ${rounds.join(', ')} cartes.</p>` : ''}</div>
      ${isNew ? `<div><div class="field-label">Cartes en plus</div>
        ${toggle('kraken', c.kraken, '🐙 Kraken')}
        ${toggle('whale', c.whale, '🐋 Baleine blanche')}
        ${toggle('loot', c.loot, '💰 Butin')}
        ${toggle('abilities', c.abilities, '🦜 Pouvoirs des pirates')}
        ${toggle('pack', c.pack, '🧭 Expansion Pack')}
        ${c.pack ? `<div class="sub-options">
          ${toggle('packCon', c.packCon, 'First Mate Con')}
          ${toggle('packDavy', c.packDavy, 'Coffre de Davy Jones')}
          ${toggle('packStingray', c.packStingray, 'Raie tachetée')}
          ${toggle('packPlank', c.packPlank, 'La Planche')}
          ${toggle('packVolley', c.packVolley, 'Dernière salve')}
        </div>` : ''}</div>` : ''}
    </div>` : `
    <button class="card rules-summary" data-act="toggleRules">
      <span class="grow">${rulesSummary(c, rounds.length)}</span><span class="link">Modifier</span>
    </button>`;

  return `
    <header class="topbar"><div class="wrap">
      <button class="icon-btn" data-act="home" aria-label="Retour">‹</button>
      <div class="title"><strong>Nouvelle partie</strong></div>
      <button class="icon-btn" data-act="rulesSetup" aria-label="Règles du décompte">?</button>
    </div></header>
    <main class="page"><div class="wrap stack">
      <div class="section-head"><div class="section-title">Joueurs</div><span class="tiny muted">dans l’ordre du tour de table</span></div>
      <div class="card stack" style="gap:8px">
        ${players}
        <button class="btn" data-act="addPlayer">+ Ajouter un joueur</button>
        ${notes.map((t) => `<p class="hint">${t}</p>`).join('')}
      </div>
      <div class="section-head"><div class="section-title">Règles</div>
        ${s.showRules ? '<button class="btn btn-small" data-act="toggleRules">Fermer</button>' : ''}</div>
      ${rules}
    </div></main>
    <div class="bar"><div class="wrap">
      <div class="info">${issue ? `<span class="neg">${issue}</span>` : `<b>${n} joueurs</b>`}</div>
      <button class="btn btn-primary btn-lg" data-act="startGame" ${issue ? 'disabled' : ''}>Commencer</button>
    </div></div>`;
}

function startGame() {
  const s = ui.setup;
  const players = s.players.map((p, i) => ({ id: p.id, name: p.name.trim() || `Joueur ${i + 1}`, color: colorFor(i) }));
  const config = R.normalizeConfig(s.config);
  const ids = players.map((p) => p.id);
  const rounds = R.roundsFor(config, players.length).map((k) => R.fillDefaults(R.newRound(k), ids));
  db.current = { id: uid(), createdAt: Date.now(), config, players, rounds, cur: 0, phase: 'bid', finished: false };
  db.lastPlayers = players.map((p) => p.name);
  db.lastConfig = config;
  ui.open.clear();
  save();
  go('play');
}

// ---------- Écran : partie ----------
function topbarPlay(g) {
  const r = g.rounds[g.cur];
  const dealer = g.players[g.cur % g.players.length];
  const first = g.players[(g.cur + 1) % g.players.length];
  const prog = g.rounds.map((x, i) => `<i class="${x.done ? 'done' : i === g.cur ? 'now' : ''}"></i>`).join('');
  return `
    <header class="topbar"><div class="wrap">
      <button class="icon-btn" data-act="home" aria-label="Accueil">‹</button>
      <div class="title"><strong>Manche ${g.cur + 1}/${g.rounds.length}</strong>
        <span>${plural(r.cards, 'carte', 'cartes')} · ${esc(dealer.name)} donne, ${esc(first.name)} commence</span></div>
      <button class="icon-btn" data-act="openScores" aria-label="Feuille de score">📊</button>
      <button class="icon-btn" data-act="menu" aria-label="Menu">⋯</button>
    </div><div class="progress" aria-hidden="true">${prog}</div></header>`;
}

/** Boutons 0..n sur une ligne (jusqu'à 8), sinon sur deux lignes égales. */
function bidChips(round, pid, act, value, target, label) {
  const n = round.cards + 1;
  const cols = n <= 8 ? n : Math.ceil(n / 2);
  let h = '';
  for (let k = 0; k <= round.cards; k++) {
    h += `<button class="chip ${value === k ? 'on' : ''} ${target === k ? 'target' : ''}" data-act="${act}" data-p="${pid}" data-v="${k}" aria-pressed="${value === k}">${k}</button>`;
  }
  return `<div class="chips" role="group" aria-label="${esc(label || '')}" style="--cols:${cols}">${h}</div>`;
}

/** Carte d'un joueur. En petite manche (3 cartes ou moins), nom et boutons tiennent sur une ligne. */
function playerCard(p, round, { badge = '', meta = '', chips, extra = '' }) {
  if (round.cards <= 3) {
    return `<div class="card pcard inline">
      <div class="pcard-head">${avatar(p)}<span class="name">${esc(p.name)}<small>${badge ? `${badge} · ` : ''}${meta}</small></span></div>
      ${chips}${extra ? `<div class="extra">${extra}</div>` : ''}</div>`;
  }
  return `<div class="card pcard">
    <div class="pcard-head">${avatar(p)}<span class="name">${esc(p.name)}</span>
      ${badge ? `<span class="badge dealer">${badge}</span>` : ''}<span class="meta">${meta}</span></div>
    ${chips}${extra}</div>`;
}

function viewBids(g, round, editing) {
  const c = g.config;
  const { sum } = R.totals(g);
  const cards = g.players.map((p, i) => {
    const dealer = !editing && i === g.cur % g.players.length;
    const mode = round.modes[p.id] || 'grape';
    return playerCard(p, round, {
      badge: dealer ? 'Donne' : '',
      meta: `${fmt(sum[p.id])} pts`,
      chips: bidChips(round, p.id, 'bid', round.bids[p.id], null, `Annonce de ${p.name}`),
      extra: c.scoring === 'rascal' && c.cannonball ? `<div class="seg" role="group" aria-label="Type de tir">
        <button class="${mode === 'grape' ? 'on' : ''}" data-act="mode" data-p="${p.id}" data-v="grape">✋ Mitraille</button>
        <button class="${mode === 'cannon' ? 'on' : ''}" data-act="mode" data-p="${p.id}" data-v="cannon">✊ Boulet</button></div>` : '',
    });
  }).join('');
  return cards;
}

function bidTotalInfo(g, round) {
  const vals = g.players.map((p) => round.bids[p.id]).filter((v) => v != null);
  const total = vals.reduce((a, b) => a + b, 0);
  const missing = g.players.length - vals.length;
  if (missing) return `<b>${missing} annonce${missing > 1 ? 's' : ''} à saisir</b><br><span class="muted">Total : ${total} pour ${round.cards} pli${round.cards > 1 ? 's' : ''}</span>`;
  return `<b>${total} annoncé${total > 1 ? 's' : ''}</b> <span class="muted">pour ${round.cards} pli${round.cards > 1 ? 's' : ''}</span>`;
}

function playerSelect(g, act, value, extra = '', none = 'Personne') {
  return `<select class="select" data-change="${act}" ${extra}>
    <option value="">${none}</option>
    ${g.players.map((p) => `<option value="${p.id}" ${value === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
  </select>`;
}

function viewAbilities(g, round) {
  const c = g.config;
  if (!c.abilities) return '';
  const h = round.harry || {};
  const r = round.rascal || {};
  const seg = (act, opts, val, disabled) => `<div class="seg" role="group">${opts.map(([v, label]) =>
    `<button class="${val === v ? 'on' : ''}" data-act="${act}" data-v="${v}" ${disabled ? 'disabled' : ''}>${label}</button>`).join('')}</div>`;
  return `
    <div class="section-title">Pouvoirs des pirates</div>
    <div class="card">
      <div class="ability"><h3>🪓 Harry le Géant</h3>
        <p>Qui a gagné un pli avec Harry ? Il peut changer son annonce de ±1.</p>
        ${playerSelect(g, 'harryWho', h.pid || '')}
        ${h.pid ? seg('harryDelta', [[-1, '−1'], [0, 'Inchangée'], [1, '+1']], h.delta ?? 0) : ''}
        ${h.pid && round.bids[h.pid] != null ? `<p style="margin-top:8px">Annonce : ${round.bids[h.pid]} → <b>${R.effectiveBid(c, round, h.pid)}</b></p>` : ''}
      </div>
      <div class="ability"><h3>🎲 Rascal of Roatan</h3>
        <p>Qui a gagné un pli avec Rascal ? Pari gagné si l’annonce est juste, perdu sinon.</p>
        ${playerSelect(g, 'rascalWho', r.pid || '')}
        ${r.pid ? seg('rascalBet', [[0, '0'], [10, '10'], [20, '20']], r.bet ?? 0) : ''}
      </div>
    </div>`;
}

function viewLoot(g, round) {
  if (!g.config.loot) return '';
  const loots = round.loots || [];
  const rows = loots.map((l, i) => `
    <div class="loot-row">
      <label>Butin joué par ${playerSelect(g, 'lootFrom', l.from || '', `data-i="${i}"`, 'Choisir…')}</label>
      <label>Pli remporté par ${playerSelect(g, 'lootTo', l.to || '', `data-i="${i}"`, 'Choisir…')}</label>
      <button class="icon-btn" data-act="lootDel" data-i="${i}" aria-label="Retirer ce Butin">✕</button>
    </div>`).join('');
  return `
    <div class="section-title">Butin</div>
    <div class="card">
      <p class="hint" style="margin-top:0">+20 chacun si les deux alliés réussissent leur annonce.</p>
      ${rows}
      ${loots.length < 2 ? `<button class="btn" data-act="lootAdd" style="margin-top:10px">+ Ajouter une alliance</button>` : ''}
    </div>`;
}

function noBonusNote(noTrick, missed) {
  const parts = [];
  if (missed.length) parts.push(`annonce ratée pour ${missed.map((p) => esc(p.name)).join(', ')}`);
  if (noTrick.length) parts.push(`aucun pli pour ${noTrick.map((p) => esc(p.name)).join(', ')}`);
  return parts.length ? `<p class="lede small">Pas de bonus : ${parts.join(' ; ')}.</p>` : '';
}

/** Total brut des bonus comptés par cartes pour un joueur. */
function cardBonusRaw(g, round, pid) {
  const counts = round.bonus[pid] || {};
  return R.bonusDefs(g.config).reduce((a, d) => a + (counts[d.key] || 0) * d.pts, 0);
}

function bonusModeSwitch(g) {
  const pts = g.config.bonusMode === 'points';
  return `<button class="btn btn-small" data-act="switchBonusMode" data-v="${pts ? 'cards' : 'points'}">${pts ? 'Compter les cartes' : 'Saisir le score'}</button>`;
}

function viewFreeBonus(g, round, scores) {
  const c = g.config;
  const defs = R.bonusDefs(c);
  const step = c.pack ? 5 : 10;
  const rows = [];
  const noTrick = [];
  const missed = [];
  for (const p of g.players) {
    const tricks = round.tricks[p.id] ?? 0;
    const f = R.bonusFactor(c, round, p.id);
    const possible = tricks > 0 || defs.some((d) => d.noTrick);
    if (!possible) { noTrick.push(p); continue; }
    if (f === 0) { missed.push(p); continue; }
    const free = R.freeBonus(round, p.id);
    const raw = free ?? cardBonusRaw(g, round, p.id);
    const s = scores[p.id];
    rows.push(`<div class="free-row">
      ${avatar(p)}<span class="name">${esc(p.name)}${f < 1 ? `<small>Écart de 1 : compte pour ${signed(raw * f)}</small>` : ''}</span>
      <span class="stepper">
        <button data-act="freeStep" data-p="${p.id}" data-d="${-step}" aria-label="Moins ${step}">−</button>
        <input class="free-input" type="text" inputmode="numeric" pattern="-?[0-9]*" value="${raw || ''}" placeholder="0" data-input="free" data-p="${p.id}" aria-label="Bonus de ${esc(p.name)}">
        <button data-act="freeStep" data-p="${p.id}" data-d="${step}" aria-label="Plus ${step}">+</button>
      </span></div>`);
  }
  return `
    <div class="section-head"><div class="section-title">Bonus</div>${bonusModeSwitch(g)}</div>
    ${rows.length ? `
      <div class="card free-list">${rows.join('')}</div>` : ''}
    ${noBonusNote(noTrick, missed)}`;
}

function viewBonus(g, round, scores) {
  const c = g.config;
  if (c.bonusMode === 'points') return viewFreeBonus(g, round, scores);
  const defs = R.bonusDefs(c);
  const cards = [];
  const noTrick = [];
  for (const p of g.players) {
    const tricks = round.tricks[p.id] ?? 0;
    const avail = defs.filter((d) => d.noTrick || tricks > 0);
    if (!avail.length) { noTrick.push(p); continue; }
    const f = R.bonusFactor(c, round, p.id);
    if (f === 0) {
      cards.push(`<div class="card pcard bonus-off"><div class="pcard-head" style="margin:0">${avatar(p)}<span class="name">${esc(p.name)}</span>
        <span class="badge bad">Annonce ratée : pas de bonus</span></div></div>`);
      continue;
    }
    const counts = round.bonus[p.id] || {};
    const s = scores[p.id];
    const bonusPts = s ? s.bonus : 0;
    const open = ui.open.has(p.id);
    const notes = [];
    if (f < 1) notes.push('Écart de 1 : bonus divisés par 2');
    if (tricks === 0) notes.push('Aucun pli : seul Davy Jones peut rapporter');
    const typed = R.freeBonus(round, p.id);
    if (typed != null) notes.push(`Score tapé à la main (${signed(typed)}), remplacé si vous comptez une carte`);
    const rows = avail.map((d) => {
      const n = counts[d.key] || 0;
      const why = R.bonusLimit(c, round, g.players, d, p.id);
      return `<div class="stepper-row"><span class="ico" aria-hidden="true">${d.icon}</span>
        <span class="txt"><b>${d.label} <em class="${d.pts < 0 ? 'neg' : 'pos'}">${signed(d.pts * f)}</em></b>${why ? `<span class="why">${esc(why)}</span>` : ''}</span>
        <span class="stepper">
          <button data-act="bonus" data-p="${p.id}" data-k="${d.key}" data-d="-1" ${n ? '' : 'disabled'} aria-label="Retirer : ${esc(d.label)}">−</button>
          <output>${n}</output>
          <button data-act="bonus" data-p="${p.id}" data-k="${d.key}" data-d="1" ${why ? 'disabled' : ''} aria-label="Ajouter : ${esc(d.label)}">+</button>
        </span></div>`;
    }).join('');
    const nb = defs.reduce((a, d) => a + (counts[d.key] || 0), 0);
    cards.push(`<div class="card pcard ${open ? 'open' : ''}">
      <button class="bonus-toggle" data-act="toggleBonus" data-p="${p.id}" aria-expanded="${open}">
        ${avatar(p)}<span class="name">${esc(p.name)}${notes.length ? `<small>${notes.join(' · ')}</small>` : ''}</span>
        ${nb || typed != null ? `<span class="badge ${bonusPts > 0 ? 'ok' : bonusPts < 0 ? 'bad' : ''}">${signed(bonusPts)}</span>` : '<span class="badge">Ajouter</span>'}
        <span class="chev" aria-hidden="true">${open ? '▴' : '▾'}</span></button>
      ${open ? `<div class="bonus-body">${rows}</div>` : ''}
    </div>`);
  }
  return `
    <div class="section-head"><div class="section-title">Bonus</div>${bonusModeSwitch(g)}</div>
    ${cards.join('')}
    ${noBonusNote(noTrick, [])}`;
}

const STATUS = {
  hit: ['ok', '🎯 Réussi'],
  glancing: ['warn', '½ Écart de 1'],
  miss: ['bad', '✗ Raté'],
};

function viewRoundScores(g, round, scores) {
  const lines = g.players.map((p) => {
    const s = scores[p.id];
    if (!s) return '';
    const [k, label] = STATUS[s.status];
    const parts = [`annonce ${s.eff}${s.eff !== s.bid ? ` (Harry, au lieu de ${s.bid})` : ''}, ${s.tricks} pli${s.tricks > 1 ? 's' : ''}`, `base ${signed(s.base)}`];
    if (s.bonus) parts.push(`bonus ${signed(s.bonus)}`);
    if (s.wager) parts.push(`pari ${signed(s.wager)}`);
    return `<div class="score-line">${avatar(p)}
      <span><b>${esc(p.name)}</b> <span class="badge ${k}">${label}</span><br><span class="d">${parts.join(' · ')}</span></span>
      <span class="t ${cls(s.total)}">${signed(s.total)}</span></div>`;
  }).join('');
  if (!lines.trim()) return '';
  return `<div class="section-title">Points de la manche</div><div class="card score-lines">${lines}</div>`;
}

function viewMessages(v) {
  const err = v.errors.length ? `<div class="msg err" role="alert">${v.errors.map((e) => `<span>⚠️ ${esc(e)}</span>`).join('')}</div>` : '';
  const note = v.notes.length ? `<div class="msg note">${v.notes.map((e) => `<span>ℹ️ ${esc(e)}</span>`).join('')}</div>` : '';
  return err + note;
}

function viewResults(g, round, editing) {
  const c = g.config;
  const ids = g.players.map((p) => p.id);
  const scores = R.scoreRound(c, round, (editing ? ui.edit.index : g.cur) + 1, ids);
  const tricks = g.players.map((p) => {
    const eff = R.effectiveBid(c, round, p.id);
    const mode = c.scoring === 'rascal' && c.cannonball ? (round.modes[p.id] === 'cannon' ? ' · ✊ Boulet' : ' · ✋ Mitraille') : '';
    return playerCard(p, round, {
      meta: `Annonce <b>${eff ?? '–'}</b>${eff !== round.bids[p.id] ? ` <span class="tiny">(${round.bids[p.id]})</span>` : ''}${mode}`,
      chips: bidChips(round, p.id, 'tricks', round.tricks[p.id], eff, `Plis de ${p.name}`),
    });
  }).join('');
  return `
    <div class="section-head"><div class="section-title">Plis remportés</div>
      <button class="btn btn-small" data-act="fillTricks">Plis = annonces</button></div>
    ${tricks}
    ${viewAbilities(g, round)}
    ${viewLoot(g, round)}
    ${viewBonus(g, round, scores)}
    ${viewRoundScores(g, round, scores)}
    ${viewMessages(R.validateRound(c, round, g.players, 'result'))}`;
}

function trickInfo(g, round) {
  const total = g.players.reduce((a, p) => a + (round.tricks[p.id] ?? 0), 0);
  const hint = total === round.cards ? '<span class="pos">Le compte est bon</span>'
    : total < round.cards ? `<span class="neg">Il manque ${round.cards - total} pli${round.cards - total > 1 ? 's' : ''}</span>`
    : `<span class="neg">${total - round.cards} pli${total - round.cards > 1 ? 's' : ''} de trop</span>`;
  return `<b>${total} / ${round.cards} plis</b><br>${hint}`;
}

function viewRecap(g) {
  const idx = g.cur;
  const { perRound } = R.totals(g);
  const pr = perRound[idx];
  const list = R.ranking(g);
  const last = idx === g.rounds.length - 1;
  const items = list.map((p) => {
    const s = pr && pr.score[p.id];
    const [k, label] = s ? STATUS[s.status] : ['', ''];
    return `<div class="card rank-item ${p.rank === 1 ? 'first' : ''}">
      <span class="r">${p.rank === 1 ? '👑' : p.rank}</span>${avatar(p)}
      <span class="nm">${esc(p.name)}<small>${s ? `<span class="${k === 'ok' ? 'pos' : k === 'bad' ? 'neg' : ''}">${label}</span> · ${s.eff} annoncé, ${s.tricks} fait` : ''}</small></span>
      <span><span class="total">${fmt(p.total)}</span><span class="delta ${cls(s ? s.total : 0)}">${s ? signed(s.total) : ''}</span></span>
    </div>`;
  }).join('');
  const next = g.rounds[idx + 1];
  return `
    <main class="page"><div class="wrap stack">
      <div class="section-title">Classement après la manche ${idx + 1}</div>
      <div class="rank-list ${list.length >= 6 ? 'many' : ''}">${items}</div>
      <button class="btn btn-ghost" data-act="editCurrent">✎ Corriger cette manche</button>
    </div></main>
    <div class="bar"><div class="wrap">
      <div class="info">${last ? '<b>Dernière manche jouée</b>' : `<b>Manche ${idx + 2}</b><br><span class="muted">${plural(next.cards, 'carte', 'cartes')} · donne : ${esc(g.players[(idx + 1) % g.players.length].name)}</span>`}</div>
      <button class="btn btn-primary btn-lg" data-act="nextRound">${last ? 'Résultat final 🏆' : 'Manche suivante'}</button>
    </div></div>`;
}

function viewPlay() {
  const g = db.current;
  if (!g) return viewHome();
  if (g.finished) return viewEnd(g, false);
  const round = g.rounds[g.cur];
  if (g.phase === 'recap') return topbarPlay(g) + viewRecap(g);
  if (g.phase === 'bid') {
    const v = R.validateRound(g.config, round, g.players, 'bid');
    return `${topbarPlay(g)}
      <main class="page"><div class="wrap stack">
        <div class="section-title">Annonces</div>
        ${viewBids(g, round, false)}
      </div></main>
      <div class="bar"><div class="wrap">
        <div class="info">${bidTotalInfo(g, round)}</div>
        <button class="btn btn-primary btn-lg" data-act="toResults" ${v.errors.length ? 'disabled' : ''}>Saisir les plis</button>
      </div></div>`;
  }
  const v = R.validateRound(g.config, round, g.players, 'result');
  return `${topbarPlay(g)}
    <main class="page"><div class="wrap stack">
      ${viewResults(g, round, false)}
    </div></main>
    <div class="bar"><div class="wrap">
      <button class="btn btn-compact" data-act="toBids" aria-label="Revenir aux annonces">‹ Annonces</button>
      <div class="info">${trickInfo(g, round)}</div>
      <button class="btn btn-primary btn-lg" data-act="validate" ${v.errors.length ? 'disabled' : ''}>Valider</button>
    </div></div>`;
}

// ---------- Écran : correction d'une manche passée ----------
function viewEdit() {
  const g = db.current;
  const { index, draft } = ui.edit;
  const v = R.validateRound(g.config, draft, g.players, 'result');
  return `
    <header class="topbar"><div class="wrap">
      <button class="icon-btn" data-act="cancelEdit" aria-label="Annuler">‹</button>
      <div class="title"><strong>Corriger la manche ${index + 1}</strong><span>${plural(draft.cards, 'carte', 'cartes')}</span></div>
      <span style="width:44px"></span>
    </div></header>
    <main class="page"><div class="wrap stack">
      <div class="section-title">Annonces</div>
      ${viewBids(g, draft, true)}
      ${viewResults(g, draft, true)}
    </div></main>
    <div class="bar"><div class="wrap">
      <button class="btn btn-compact" data-act="cancelEdit">Annuler</button>
      <div class="info">${trickInfo(g, draft)}</div>
      <button class="btn btn-primary btn-lg" data-act="saveEdit" ${v.errors.length ? 'disabled' : ''}>Enregistrer</button>
    </div></div>`;
}

// ---------- Tableau des scores ----------
function scoreTable(g, clickable) {
  const { perRound, sum } = R.totals(g);
  const best = Math.max(...g.players.map((p) => sum[p.id]));
  const anyDone = perRound.some(Boolean);
  const lead = (p) => (anyDone && sum[p.id] === best ? 'lead' : '');
  const many = g.players.length >= 6 ? 'many' : '';
  const head = g.players.map((p) => `<th class="${lead(p)}">${avatar(p)}<span class="nm">${esc(p.name)}</span></th>`).join('');
  const rows = g.rounds.map((r, i) => {
    const pr = perRound[i];
    const cells = g.players.map((p) => {
      if (!pr) return `<td class="muted ${lead(p)}">–</td>`;
      const s = pr.score[p.id];
      return `<td class="${lead(p)}"><span class="c">${fmt(pr.cumul[p.id])}</span><span class="s ${s.status}">${many ? '' : `${s.eff}/${s.tricks} · `}${signed(s.total)}</span></td>`;
    }).join('');
    const can = clickable && pr;
    return `<tr class="${can ? 'click' : ''}" ${can ? `data-act="editRound" data-i="${i}"` : ''}><td>M${i + 1}<br><span class="tiny">${r.cards} c.</span>${can ? ' ✎' : ''}</td>${cells}</tr>`;
  }).join('');
  const foot = g.players.map((p) => `<td class="${lead(p)}">${fmt(sum[p.id])}</td>`).join('');
  return `<div class="table-wrap"><table class="scores ${many}">
    <thead><tr><th>Manche</th>${head}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>Total</td>${foot}</tr></tfoot></table></div>
    <p class="tiny muted" style="padding:0 4px">${g.players.length >= 6 ? 'Points' : 'Annonce / plis · points'} de la manche, total en gras.${clickable ? ' Touchez une manche pour la corriger.' : ''}</p>`;
}

function viewScores() {
  const g = db.current;
  return `
    <header class="topbar"><div class="wrap">
      <button class="icon-btn" data-act="closeScores" aria-label="Retour à la partie">‹</button>
      <div class="title"><strong>Feuille de score</strong><span>${R.EDITIONS[g.config.edition].label} · ${g.config.scoring === 'rascal' ? 'Rascal' : 'Skull King'}</span></div>
      <span style="width:44px"></span>
    </div></header>
    <main class="page no-bar"><div class="wrap stack">
      <div class="standings">${R.ranking(g).map((p) => `<span class="pill">${avatar(p)}<span class="rk">${p.rank === 1 ? '👑' : `${p.rank}e`}</span> ${esc(p.name)} <b>${fmt(p.total)}</b></span>`).join('')}</div>
      ${scoreTable(g, true)}
      <button class="btn btn-block" data-act="closeScores">Retour à la partie</button>
    </div></main>`;
}

// ---------- Fin de partie ----------
function viewEnd(g, isPast) {
  const list = R.ranking(g);
  const top = [list[1], list[0], list[2]];
  const podium = top.map((p, i) => {
    if (!p) return '<div></div>';
    const place = [2, 1, 3][i];
    return `<div class="step p${p.rank}">${place === 1 ? '<span class="crown">👑</span>' : ''}${avatar(p)}
      <div class="who">${esc(p.name)}</div><div class="pts">${fmt(p.total)} pts</div>
      <div class="block">${p.rank}</div></div>`;
  }).join('');
  const winners = list.filter((p) => p.rank === 1).map((p) => esc(p.name));
  return `
    <header class="topbar"><div class="wrap">
      <button class="icon-btn" data-act="${isPast ? 'closePast' : 'home'}" aria-label="Retour">‹</button>
      <div class="title"><strong>${isPast ? dateFr(g.finishedAt || g.createdAt) : 'Fin de la partie'}</strong><span>${plural(g.rounds.length, 'manche', 'manches')} · ${g.players.length} joueurs</span></div>
      <span style="width:44px"></span>
    </div></header>
    <main class="page no-bar"><div class="wrap stack">
      <div class="sk-hero" style="padding-top:12px"><h1>${winners.join(' & ')}</h1>
        <p class="muted">${winners.length > 1 ? 'se partagent' : 'remporte'} le titre de Capitaine des Sept Mers !</p></div>
      <div class="podium">${podium}</div>
      <div class="rank-list">${list.slice(3).map((p) => `<div class="card rank-item"><span class="r">${p.rank}</span>${avatar(p)}<span class="nm">${esc(p.name)}</span><span class="total">${fmt(p.total)}</span></div>`).join('')}</div>
      <div class="section-title">Détail</div>
      ${scoreTable(g, false)}
      ${isPast
        ? `<button class="btn btn-primary btn-lg btn-block" data-act="rematchPast" data-id="${g.id}">Rejouer avec ces joueurs</button>
           <button class="btn btn-ghost btn-danger" data-act="deletePast" data-id="${g.id}">Supprimer cette partie</button>`
        : `<button class="btn btn-primary btn-lg btn-block" data-act="rematch">Revanche (mêmes joueurs, mêmes règles)</button>
           <button class="btn btn-block" data-act="newGame">Nouvelle partie</button>`}
    </div></main>`;
}

// ---------- Fenêtres ----------
function rulesHtml(c) {
  const isNew = c.edition === 'new';
  const defs = R.bonusDefs(c);
  const scoring = c.scoring === 'rascal'
    ? `<h3>Décompte de Rascal</h3><ul>
        <li>Chaque joueur peut gagner <b>10 points par carte distribuée</b>, quelle que soit son annonce.</li>
        <li>Annonce juste (coup direct) : tous les points. Écart de 1 (tir rasant) : la moitié. Écart de 2 ou plus : rien.</li>
        <li>Les bonus suivent la même règle : tous, la moitié ou aucun.</li>
        ${c.cannonball ? '<li><b>Boulet de canon</b> (poing fermé) : 15 points par carte si l’annonce est juste, 0 sinon, et les bonus seulement si l’annonce est juste. <b>Mitraille</b> (main ouverte) : Rascal normal.</li>' : ''}
      </ul>`
    : `<h3>Décompte du Skull King</h3><ul>
        <li>Annonce de 1 ou plus, réussie : <b>+20 par pli</b> annoncé.</li>
        <li>Annonce ratée : <b>−10 par pli d’écart</b>, en plus ou en moins. Les plis remportés ne rapportent rien.</li>
        <li>Annonce zéro réussie : <b>+10 × ${isNew ? 'nombre de cartes distribuées' : 'numéro de la manche'}</b>. Ratée : −10 × ${isNew ? 'cartes distribuées' : 'numéro de la manche'}, quel que soit le nombre de plis.</li>
        <li>Les bonus ne comptent que si l’annonce est juste.</li>
      </ul>`;
  return `
    <h2 id="dlg-title">Règles du décompte</h2>
    <p class="muted small">${R.EDITIONS[c.edition].label} · ${R.EDITIONS[c.edition].sub}</p>
    ${scoring}
    <h3>Bonus</h3><ul>
      ${defs.map((d) => `<li>${d.icon} ${d.label} : <b>${signed(d.pts)}</b>${d.pts > 0 && !d.exclusive && d.total > 1 ? ' chacun' : ''}. <span class="muted">${d.hint}</span></li>`).join('')}
      ${c.loot ? '<li>💰 Butin : celui qui joue le Butin s’allie avec le gagnant du pli. Si les deux réussissent leur annonce : <b>+20 chacun</b>. Un Butin mené et suivi uniquement de Fuites ne crée pas d’alliance.</li>' : ''}
      ${isNew ? '<li>L’ordre de jeu ne compte pas pour les bonus de personnages. Si un Pirate, le Skull King et une Sirène sont dans le même pli, la Sirène gagne et seul son bonus compte.</li>' : ''}
    </ul>
    ${c.abilities ? `<h3>Pouvoirs des pirates</h3><ul>
      <li>Il faut remporter le pli <i>avec</i> le pirate pour utiliser son pouvoir, immédiatement.</li>
      <li>🪓 Harry le Géant : change son annonce de +1 ou −1 (le seul pouvoir utilisable après le dernier pli).</li>
      <li>🎲 Rascal of Roatan : parie 0, 10 ou 20 points, gagnés si l’annonce est juste, perdus sinon.</li>
      <li>Rosie D’Laney, Bendt le Bandit et Juanita Jade ne changent pas les points.</li></ul>` : ''}
    ${c.kraken || c.whale || (c.pack && R.trickDestroyers(c).length) ? `<h3>Plis sans gagnant</h3><ul>
      ${c.kraken ? '<li>🐙 Kraken : le pli est détruit, personne ne le remporte. Celui qui l’aurait gagné entame le suivant.</li>' : ''}
      ${c.whale ? '<li>🐋 Baleine blanche : cartes spéciales détruites, le plus grand chiffre gagne quelle que soit la couleur. S’il n’y a que des cartes spéciales, le pli est défaussé.</li>' : ''}
      ${c.kraken && c.whale ? '<li>Kraken et Baleine dans le même pli : le second joué l’emporte et applique son effet.</li>' : ''}
      ${c.pack ? '<li>Extension : un pli ne contenant que des cartes spéciales qui ne gagnent pas est défaussé. Avec plusieurs monstres marins, le dernier joué décide.</li>' : ''}
      <li>Le compteur accepte alors moins de plis que de cartes distribuées.</li></ul>` : ''}
    <h3>Manches</h3><ul>
      <li>Une carte de plus à chaque manche. Avec beaucoup de joueurs, les dernières manches répètent le nombre maximal de cartes possible.</li>
      ${isNew ? '<li>À 2 joueurs : une 3e main pour le fantôme de Barbe-Grise, qui joue toujours en 2e, ne suit pas la couleur et n’a pas de score (sa Tigresse est une Fuite).</li>' : ''}
    </ul>`;
}

function viewModal() {
  if (!ui.modal) return '';
  let body = '';
  if (ui.modal.type === 'rules') {
    body = `${rulesHtml(ui.modal.config)}<div class="actions"><button class="btn btn-primary" data-act="closeModal">Compris</button></div>`;
  } else if (ui.modal.type === 'menu') {
    body = `<h2 id="dlg-title">Partie en cours</h2><div class="stack" style="gap:8px;margin-top:12px">
      <button class="btn btn-block" data-act="openScores">📜 Feuille de score</button>
      <button class="btn btn-block" data-act="rules">❓ Règles du décompte</button>
      <button class="btn btn-block" data-act="theme">${window.mpTheme ? `${mpTheme.icon()} Thème : ${mpTheme.label()}` : 'Thème'}</button>
      <button class="btn btn-block" data-act="reloadApp">🔄 Recharger l’application</button>
      <button class="btn btn-block" data-act="home">🏠 Accueil (la partie est conservée)</button>
      ${db.current && db.current.rounds.some((r) => r.done) ? '<button class="btn btn-block" data-act="askEndEarly">🏁 Terminer la partie maintenant</button>' : ''}
      <button class="btn btn-block btn-danger" data-act="askAbandon">Abandonner la partie</button>
      <button class="btn btn-block btn-ghost" data-act="closeModal">Fermer</button></div>`;
  } else if (ui.modal.type === 'confirm') {
    body = `<h2 id="dlg-title">${ui.modal.title}</h2><p class="muted">${ui.modal.text}</p>
      <div class="actions"><button class="btn" data-act="closeModal" autofocus>Annuler</button>
      <button class="btn btn-primary" data-act="${ui.modal.ok}" ${ui.modal.id ? `data-id="${ui.modal.id}"` : ''}>${ui.modal.okLabel}</button></div>`;
  }
  return body;
}

// ---------- Rendu ----------
function render() {
  try {
    renderScreen();
  } catch (err) {
    // Ne jamais laisser l'écran figé : on explique et on propose de recharger (la partie est sauvegardée).
    console.error(err);
    ui.modal = null;
    S.syncDialog(shell.dlg, '');
    $app.innerHTML = `<main class="page no-bar"><div class="wrap stack" style="padding-top:40px">
      <div class="card stack"><h2>Oups, l’affichage a planté</h2>
      <p class="muted">Souvent juste après une mise à jour du site. Votre partie est sauvegardée : rechargez la page.</p>
      <button class="btn btn-primary btn-lg" onclick="location.reload()">Recharger</button>
      ${db.current ? '<button class="btn btn-ghost btn-danger" data-act="resetCurrent">Toujours bloqué ? Abandonner la partie en cours</button>' : ''}
      <p class="tiny muted">${esc(err && err.message)}</p></div></div></main>`;
  }
}

function renderScreen() {
  let html;
  switch (ui.screen) {
    case 'setup': html = viewSetup(); break;
    case 'play': html = db.current ? viewPlay() : viewHome(); break;
    case 'edit': html = viewEdit(); break;
    case 'scores': html = viewScores(); break;
    case 'past': html = viewEnd(ui.past, true); break;
    default: html = viewHome();
  }
  const focus = S.focusKey();
  $app.innerHTML = html;
  S.syncDialog(shell.dlg, viewModal());
  // Pas de message pendant qu'une fenêtre est ouverte : la page derrière est inerte.
  S.syncToast(shell.live, ui.toast && !ui.modal ? `<div class="toast">${esc(ui.toast)}</div>` : '');
  S.restoreFocus(focus);
  syncWakeLock();
}

// ---------- Actions ----------
function finishGame(g) {
  g.finished = true;
  g.finishedAt = Date.now();
  g.phase = 'recap';
  db.history.push(JSON.parse(JSON.stringify(g)));
  if (db.history.length > 50) db.history.shift();
  save();
  go('play');
}

// Garde l'écran allumé pendant la partie (si le navigateur le permet).
let wakeLock = null;
let wakePending = false;
async function syncWakeLock() {
  if (!('wakeLock' in navigator) || wakePending) return;
  const want = ['play', 'edit', 'scores'].includes(ui.screen) && db.current && !db.current.finished && document.visibilityState === 'visible';
  wakePending = true;
  try {
    if (want && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { /* refusé (économie d'énergie…) : sans conséquence */ }
  wakePending = false;
}
document.addEventListener('visibilitychange', syncWakeLock);
const actions = {
  home: () => go('home'),
  resume: () => go('play'),
  newGame: () => startSetup(null),
  rematch: () => startSetup(db.current),
  rematchPast: (d) => startSetup(db.history.find((h) => h.id === d.id)),
  viewPast: (d) => { ui.past = db.history.find((h) => h.id === d.id); if (ui.past) go('past'); },
  closePast: () => go('home'),
  deletePast: (d) => { ui.modal = { type: 'confirm', title: 'Supprimer cette partie ?', text: 'Elle disparaîtra de l’historique de cet appareil.', ok: 'confirmDeletePast', okLabel: 'Supprimer', id: d.id }; render(); },
  confirmDeletePast: (d) => { db.history = db.history.filter((h) => h.id !== d.id); save(); go('home'); },
  rules: () => { ui.modal = { type: 'rules', config: db.current && ui.screen !== 'home' ? db.current.config : (db.lastConfig ? R.normalizeConfig(db.lastConfig) : R.defaultConfig()) }; render(); },
  rulesSetup: () => { ui.modal = { type: 'rules', config: R.normalizeConfig(ui.setup.config) }; render(); },
  menu: () => { ui.modal = { type: 'menu' }; render(); },
  reloadApp: () => { if (window.mpReload) mpReload(); else location.reload(); },
  theme: () => {
    if (!window.mpTheme) return;
    mpTheme.cycle();
    toast(`Thème : ${mpTheme.label()}${mpTheme.get() === 'auto' ? ' (suit le téléphone)' : ''}`);
  },
  closeModal: () => { ui.modal = null; render(); },
  askAbandon: () => { ui.modal = { type: 'confirm', title: 'Abandonner la partie ?', text: 'Les scores de cette partie seront effacés.', ok: 'abandon', okLabel: 'Abandonner' }; render(); },
  abandon: () => { db.current = null; save(); go('home'); },
  resetCurrent: () => {
    if (!confirm('Abandonner la partie en cours ? Ses scores seront effacés.')) return;
    db.current = null;
    save();
    go('home');
  },
  askEndEarly: () => {
    const done = db.current.rounds.filter((r) => r.done).length;
    ui.modal = { type: 'confirm', title: 'Terminer la partie maintenant ?', text: `Le classement final sera calculé sur ${plural(done, 'manche jouée', 'manches jouées')}. La manche en cours, si elle n’est pas validée, ne compte pas.`, ok: 'endEarly', okLabel: 'Terminer' };
    render();
  },
  endEarly: () => {
    const g = db.current;
    g.rounds = g.rounds.filter((r) => r.done);
    g.cur = g.rounds.length - 1;
    finishGame(g);
  },

  // Préparation
  addPlayer: () => { ui.setup.players.push({ id: uid(), name: '' }); render(); focusLastName(); },
  delPlayer: (d) => { ui.setup.players.splice(+d.i, 1); render(); },
  movePlayer: (d) => { const i = +d.i; const p = ui.setup.players; [p[i - 1], p[i]] = [p[i], p[i - 1]]; render(); },
  edition: (d) => { ui.setup.config = R.normalizeConfig({ ...ui.setup.config, edition: d.v }); render(); },
  scoring: (d) => { ui.setup.config = R.normalizeConfig({ ...ui.setup.config, scoring: d.v }); render(); },
  bonusMode: (d) => { ui.setup.config.bonusMode = d.v; render(); },
  switchBonusMode: (d) => {
    const g = db.current;
    g.config.bonusMode = d.v;
    // Retour au comptage par cartes : on oublie les points tapés pour la manche en cours.
    if (d.v === 'cards') ctx().round.free = {};
    db.lastConfig = { ...db.lastConfig, bonusMode: d.v };
    save();
    render();
    toast(d.v === 'points' ? 'Saisie directe des points de bonus' : 'Comptage des cartes bonus');
  },
  freeStep: (d) => {
    const { game, round } = ctx();
    const cur = R.freeBonus(round, d.p) ?? cardBonusRaw(game, round, d.p);
    round.free[d.p] = cur + +d.d;
    commit();
  },
  toggleRules: () => { ui.setup.showRules = !ui.setup.showRules; render(); },
  customAdd: () => { const c = ui.setup.config.custom; c.push(Math.min(20, (c.at(-1) || 0) + 1)); render(); },
  customDel: (d) => { const c = ui.setup.config.custom; if (c.length > 1) c.splice(+d.i, 1); render(); },
  customStep: (d) => { const c = ui.setup.config.custom; c[+d.i] = Math.max(1, Math.min(20, c[+d.i] + +d.d)); render(); },
  startGame: () => startGame(),

  // Partie
  bid: (d) => { const { round } = ctx(); round.bids[d.p] = +d.v; commit(); },
  mode: (d) => { const { round } = ctx(); round.modes[d.p] = d.v; commit(); },
  tricks: (d) => { const { round } = ctx(); round.tricks[d.p] = +d.v; commit(); },
  fillTricks: () => {
    const { game, round } = ctx();
    for (const p of game.players) round.tricks[p.id] = R.effectiveBid(game.config, round, p.id) ?? 0;
    commit();
  },
  bonus: (d) => {
    const { round } = ctx();
    const b = (round.bonus[d.p] = round.bonus[d.p] || {});
    b[d.k] = Math.max(0, (b[d.k] || 0) + +d.d);
    if (round.free) delete round.free[d.p];
    ui.open.add(d.p);
    commit();
  },
  toggleBonus: (d) => { if (ui.open.has(d.p)) ui.open.delete(d.p); else ui.open.add(d.p); render(); },
  harryDelta: (d) => { const { round } = ctx(); round.harry.delta = +d.v; commit(); },
  rascalBet: (d) => { const { round } = ctx(); round.rascal.bet = +d.v; commit(); },
  lootAdd: () => { const { round } = ctx(); round.loots = round.loots || []; round.loots.push({ from: '', to: '' }); commit(); },
  lootDel: (d) => { const { round } = ctx(); round.loots.splice(+d.i, 1); commit(); },
  toResults: () => { db.current.phase = 'result'; save(); render(); window.scrollTo(0, 0); },
  toBids: () => { db.current.phase = 'bid'; save(); render(); window.scrollTo(0, 0); },
  validate: () => {
    const g = db.current;
    const round = g.rounds[g.cur];
    if (R.validateRound(g.config, round, g.players, 'result').errors.length) return;
    round.done = true;
    g.phase = 'recap';
    ui.open.clear();
    save();
    render();
    window.scrollTo(0, 0);
  },
  editCurrent: () => { const g = db.current; g.rounds[g.cur].done = false; g.phase = 'result'; save(); render(); window.scrollTo(0, 0); },
  nextRound: () => {
    const g = db.current;
    if (g.cur >= g.rounds.length - 1) {
      finishGame(g);
      return;
    }
    g.cur += 1;
    g.phase = 'bid';
    save();
    go('play');
  },
  openScores: () => go('scores'),
  closeScores: () => go('play'),
  editRound: (d) => {
    const i = +d.i;
    ui.edit = { index: i, draft: JSON.parse(JSON.stringify(db.current.rounds[i])) };
    go('edit');
  },
  cancelEdit: () => { ui.edit = null; go('scores'); },
  saveEdit: () => {
    const g = db.current;
    const { index, draft } = ui.edit;
    if (R.validateRound(g.config, draft, g.players, 'result').errors.length) return;
    draft.done = true;
    g.rounds[index] = draft;
    ui.edit = null;
    save();
    go('scores');
    toast(`Manche ${index + 1} corrigée`);
  },
};

const changes = {
  schedule: (v) => { ui.setup.config.schedule = v; render(); },
  harryWho: (v) => { const { round } = ctx(); round.harry = v ? { pid: v, delta: round.harry?.pid === v ? round.harry.delta : 0 } : null; commit(); },
  rascalWho: (v) => { const { round } = ctx(); round.rascal = v ? { pid: v, bet: round.rascal?.bet ?? 0 } : null; commit(); },
  lootFrom: (v, el) => { const { round } = ctx(); round.loots[+el.dataset.i].from = v; commit(); },
  lootTo: (v, el) => { const { round } = ctx(); round.loots[+el.dataset.i].to = v; commit(); },
};

function focusLastName() {
  const inputs = $app.querySelectorAll('[data-input="pname"]');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

// Clics écoutés sur tout le document : la fenêtre <dialog> est en dehors de #app.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  if (['bid', 'tricks', 'bonus'].includes(el.dataset.act) && navigator.vibrate && navigator.userActivation?.isActive) {
    try { navigator.vibrate(8); } catch (err) { /* pas de vibration */ }
  }
  fn(el.dataset, el, e);
});
$app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.cfg && ui.setup) {
    ui.setup.config = R.normalizeConfig({ ...ui.setup.config, [el.dataset.cfg]: el.checked });
    render();
    return;
  }
  if (el.dataset.input === 'free') { render(); return; }
  if (el.dataset.change && changes[el.dataset.change]) changes[el.dataset.change](el.value, el);
});
$app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.input === 'pname' && ui.setup) ui.setup.players[+el.dataset.i].name = el.value;
  if (el.dataset.input === 'free') {
    const { round } = ctx();
    const v = el.value.trim().replace(',', '.');
    if (v === '' || v === '-') delete round.free[el.dataset.p];
    else if (Number.isFinite(+v)) round.free[el.dataset.p] = Math.round(+v);
    if (ui.screen !== 'edit') save();
  }
});
$app.addEventListener('keydown', (e) => {
  const el = e.target;
  if (e.key === 'Enter' && S.isComposing(e)) return; // Entrée qui valide un caractère japonais, chinois…
  if (e.key === 'Enter' && el.dataset.input === 'free') { el.blur(); return; }
  if (e.key === 'Enter' && el.dataset.input === 'pname') {
    e.preventDefault();
    const i = +el.dataset.i;
    const next = $app.querySelector(`[data-input="pname"][data-i="${i + 1}"]`);
    if (next) next.focus();
    else actions.addPlayer();
  }
});
window.addEventListener('storage', (e) => { if (e.key === KEY) { db = load(); render(); } });

render();
