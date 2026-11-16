// Skull King — interface du compteur de points
import * as R from './rules.js';

const KEY = 'marque-points:skull-king:v1';
const COLORS = ['#d9480f', '#1c7ed6', '#2b8a3e', '#ae3ec9', '#e8590c', '#0c8599', '#c2255c', '#5f3dc4', '#868e96', '#a07800', '#364fc7', '#087f5b'];
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
      <button class="icon-btn" data-act="rules" aria-label="Règles du décompte">?</button>
    </div></header>
    <main class="page no-bar"><div class="wrap stack">
      <div class="sk-hero">
        <div class="skull" aria-hidden="true">☠️</div>
        <h1>Skull King</h1>
        <p class="muted">Entrez les annonces puis les plis : les points et les bonus sont calculés selon la règle officielle.</p>
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

function choice(act, value, current, title, sub) {
  return `<button class="choice ${value === current ? 'on' : ''}" data-act="${act}" data-v="${value}" aria-pressed="${value === current}">
    <span class="radio" aria-hidden="true"></span><span><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span></button>`;
}
function toggle(key, on, title, sub) {
  return `<label class="switch"><span class="txt"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span>
    <input type="checkbox" data-cfg="${key}" ${on ? 'checked' : ''}></label>`;
}

function viewSetup() {
  const s = ui.setup;
  const c = s.config;
  const n = s.players.length;
  const max = R.maxPlayers(c);
  const isNew = c.edition === 'new';
  const sched = R.scheduleRounds(c);
  const rounds = R.roundsFor(c, Math.max(2, n));
  const capped = rounds.some((k, i) => k !== sched[i]);
  const issues = [];
  if (n < 2) issues.push('Il faut au moins 2 joueurs.');
  if (n > max) issues.push(`${n} joueurs, c’est trop pour cette configuration (${max} au maximum).`);

  const players = s.players.map((p, i) => `
    <div class="player-row">
      <span class="avatar" style="--c:${COLORS[i % COLORS.length]}" aria-hidden="true">${i + 1}</span>
      <input type="text" value="${esc(p.name)}" placeholder="Joueur ${i + 1}" data-input="pname" data-i="${i}" autocomplete="off" enterkeyhint="next" maxlength="20" aria-label="Nom du joueur ${i + 1}">
      ${i > 0 ? `<button class="icon-btn" data-act="movePlayer" data-i="${i}" aria-label="Monter">↑</button>` : '<span style="width:38px"></span>'}
      <button class="icon-btn" data-act="delPlayer" data-i="${i}" aria-label="Retirer">✕</button>
    </div>`).join('');

  const custom = c.schedule === 'custom' ? `
    <div class="custom-rounds">
      ${c.custom.map((k, i) => `<span class="custom-round"><small>M${i + 1}</small>
        <button data-act="customStep" data-i="${i}" data-d="-1" aria-label="Moins de cartes">−</button><b>${k}</b>
        <button data-act="customStep" data-i="${i}" data-d="1" aria-label="Plus de cartes">+</button>
        <button data-act="customDel" data-i="${i}" aria-label="Supprimer la manche">✕</button></span>`).join('')}
      <button class="btn" data-act="customAdd" style="min-height:36px;padding:4px 14px">+ Manche</button>
    </div>` : '';

  return `
    <header class="topbar"><div class="wrap">
      <button class="icon-btn" data-act="home" aria-label="Retour">‹</button>
      <div class="title"><strong>Nouvelle partie</strong><span>Joueurs et règles</span></div>
      <button class="icon-btn" data-act="rulesSetup" aria-label="Règles du décompte">?</button>
    </div></header>
    <main class="page"><div class="wrap stack">
      <div class="section-title">Équipage</div>
      <div class="card stack" style="gap:8px">
        <p class="muted small">Dans l’ordre du tour de table : le joueur 1 distribue la première manche.</p>
        ${players}
        ${n < max ? '<button class="btn" data-act="addPlayer">+ Ajouter un joueur</button>' : ''}
        ${n === 2 ? '<p class="small muted">À 2 joueurs, on distribue une 3e main au fantôme de Barbe-Grise : il joue toujours en 2e position et n’a pas de score.</p>' : ''}
      </div>

      <div class="section-title">Édition du jeu</div>
      <div class="choices two">
        ${choice('edition', 'new', c.edition, R.EDITIONS.new.label, R.EDITIONS.new.sub)}
        ${choice('edition', 'old', c.edition, R.EDITIONS.old.label, R.EDITIONS.old.sub)}
      </div>

      <div class="section-title">Décompte des points</div>
      <div class="choices">
        ${choice('scoring', 'skull', c.scoring, 'Décompte du Skull King', 'Le classique : +20 par pli si l’annonce est juste, −10 par pli d’écart sinon. Annonce zéro : ±10 par carte.')}
        ${choice('scoring', 'rascal', c.scoring, 'Décompte de Rascal', 'Tout le monde vise 10 points par carte. Pile : tout. Écart de 1 : la moitié. Plus : rien.')}
      </div>
      ${c.scoring === 'rascal' ? `<div class="card">${toggle('cannonball', c.cannonball, 'Mitraille ou boulet de canon', 'Après les annonces, chacun choisit : main ouverte (Rascal normal) ou poing fermé (15 par carte si l’annonce est juste, 0 sinon).')}</div>` : ''}

      ${isNew ? `
      <div class="section-title">Règles avancées</div>
      <div class="card">
        ${toggle('kraken', c.kraken, '🐙 Kraken', 'Détruit le pli : personne ne le remporte.')}
        ${toggle('whale', c.whale, '🐋 Baleine blanche', 'Les cartes spéciales sont détruites, le plus grand chiffre gagne.')}
        ${toggle('loot', c.loot, '💰 Butin (2 cartes)', 'Alliance avec le gagnant du pli : +20 chacun si les deux réussissent.')}
        ${toggle('abilities', c.abilities, '🦜 Pouvoirs des pirates', 'Seuls Harry le Géant (annonce ±1) et Rascal of Roatan (pari 0/10/20) changent les points.')}
      </div>

      <div class="section-title">Extension</div>
      <div class="card">
        ${toggle('pack', c.pack, '🧭 Skull King : Expansion Pack', '7, 8 et 0/14 de chaque couleur, Wild 15 et Mary Thorne. Les 8 valent +5, les 7 −5. Jusqu’à 9 joueurs sur 10 manches.')}
        ${c.pack ? `<div class="sub-options">
          ${toggle('packCon', c.packCon, 'First Mate Con', 'Bat les pirates. Capturé par le Skull King ou une Sirène : +30.')}
          ${toggle('packDavy', c.packDavy, 'Coffre de Davy Jones', 'Détruit les monstres marins : +20 par monstre.')}
          ${toggle('packStingray', c.packStingray, 'Raie tachetée', 'Comme la Baleine, mais la plus petite carte gagne.')}
          ${toggle('packPlank', c.packPlank, 'La Planche', 'Retire un pirate du pli.')}
          ${toggle('packVolley', c.packVolley, 'Dernière salve', 'Le joueur rejoue une carte et passe le dernier pli.')}
        </div>` : ''}
      </div>` : ''}

      <div class="section-title">Manches</div>
      <div class="choices">
        ${R.SCHEDULES.map((x) => choice('schedule', x.id, c.schedule, x.label, x.sub)).join('')}
      </div>
      ${custom}

      <div class="card summary">
        <b>${plural(rounds.length, 'manche', 'manches')} · cartes par joueur</b>
        <div class="round-strip">${rounds.map((k, i) => `<span class="${k !== sched[i] ? 'capped' : ''}">${k}</span>`).join('')}</div>
        <p class="small muted">Paquet de ${R.deckSize(c, Math.max(2, n))} cartes${n === 2 ? ' pour 3 mains' : ''}.
        ${capped ? ' Il n’y a pas assez de cartes pour tout le monde : les dernières manches répètent le nombre maximal de cartes (règle officielle).' : ''}</p>
      </div>
    </div></main>
    <div class="bar"><div class="wrap">
      <div class="info">${issues.length ? `<span class="neg">${issues.join(' ')}</span>` : `<b>${n} joueurs</b><br><span class="muted">${R.EDITIONS[c.edition].label} · ${c.scoring === 'rascal' ? 'Rascal' : 'Skull King'}</span>`}</div>
      <button class="btn btn-primary btn-lg" data-act="startGame" ${issues.length ? 'disabled' : ''}>Lever l’ancre</button>
    </div></div>`;
}

function startGame() {
  const s = ui.setup;
  const players = s.players.map((p, i) => ({ id: p.id, name: p.name.trim() || `Joueur ${i + 1}`, color: COLORS[i % COLORS.length] }));
  const config = R.normalizeConfig(s.config);
  const rounds = R.roundsFor(config, players.length).map((k) => R.newRound(k));
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
      <div class="title"><strong>Manche ${g.cur + 1} / ${g.rounds.length} · ${plural(r.cards, 'carte', 'cartes')}</strong>
        <span>Donne : ${esc(dealer.name)} · ${esc(first.name)} commence</span></div>
      <button class="icon-btn" data-act="menu" aria-label="Menu">⋯</button>
    </div><div class="progress" aria-hidden="true">${prog}</div></header>`;
}

function bidChips(round, pid, act, value, target) {
  let h = '';
  for (let k = 0; k <= round.cards; k++) {
    h += `<button class="chip ${value === k ? 'on' : ''} ${target === k ? 'target' : ''}" data-act="${act}" data-p="${pid}" data-v="${k}" aria-pressed="${value === k}">${k}</button>`;
  }
  return `<div class="chips" role="group">${h}</div>`;
}

function viewBids(g, round, editing) {
  const c = g.config;
  const { sum } = R.totals(g);
  const cards = g.players.map((p, i) => {
    const dealer = !editing && i === g.cur % g.players.length;
    const mode = round.modes[p.id] || 'grape';
    return `<div class="card pcard">
      <div class="pcard-head">${avatar(p)}<span class="name">${esc(p.name)}</span>
        ${dealer ? '<span class="badge dealer">Donne</span>' : ''}
        <span class="meta">${fmt(sum[p.id])} pts</span></div>
      ${bidChips(round, p.id, 'bid', round.bids[p.id])}
      ${c.scoring === 'rascal' && c.cannonball ? `<div class="seg" role="group" aria-label="Type de tir">
        <button class="${mode === 'grape' ? 'on' : ''}" data-act="mode" data-p="${p.id}" data-v="grape">✋ Mitraille</button>
        <button class="${mode === 'cannon' ? 'on' : ''}" data-act="mode" data-p="${p.id}" data-v="cannon">✊ Boulet</button></div>` : ''}
    </div>`;
  }).join('');
  return cards;
}

function bidTotalInfo(g, round) {
  const vals = g.players.map((p) => round.bids[p.id]).filter((v) => v != null);
  const total = vals.reduce((a, b) => a + b, 0);
  const missing = g.players.length - vals.length;
  if (missing) return `<b>${missing} annonce${missing > 1 ? 's' : ''} à saisir</b><br><span class="muted">Total : ${total} pour ${round.cards} pli${round.cards > 1 ? 's' : ''}</span>`;
  const mood = total > round.cards ? 'Ça va se battre !' : total < round.cards ? 'Des plis vont rester sans preneur…' : 'Pile le nombre de plis.';
  return `<b>${total} annoncé${total > 1 ? 's' : ''} pour ${round.cards} pli${round.cards > 1 ? 's' : ''}</b><br><span class="muted">${mood}</span>`;
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
        <p>Qui a remporté un pli avec Harry ? Après le dernier pli, il peut changer son annonce de ±1.</p>
        ${playerSelect(g, 'harryWho', h.pid || '')}
        ${h.pid ? seg('harryDelta', [[-1, '−1'], [0, 'Inchangée'], [1, '+1']], h.delta ?? 0) : ''}
        ${h.pid && round.bids[h.pid] != null ? `<p style="margin-top:8px">Annonce : ${round.bids[h.pid]} → <b>${R.effectiveBid(c, round, h.pid)}</b></p>` : ''}
      </div>
      <div class="ability"><h3>🎲 Rascal of Roatan</h3>
        <p>Qui a remporté un pli avec Rascal ? Il parie 0, 10 ou 20 : gagnés si l’annonce est juste, perdus sinon.</p>
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
      <p class="small muted">Ajoutez chaque Butin joué dans un pli remporté par un autre joueur. Les deux alliés gagnent +20 s’ils réussissent tous deux leur annonce.</p>
      ${rows}
      ${loots.length < 2 ? `<button class="btn" data-act="lootAdd" style="margin-top:10px">+ Ajouter une alliance</button>` : ''}
    </div>`;
}

function bonusAllowance(g, round, def, pid) {
  let total = 0;
  const holders = new Set();
  for (const p of g.players) {
    if (R.bonusFactor(g.config, round, p.id) === 0) continue;
    const n = (round.bonus[p.id] || {})[def.key] || 0;
    total += n;
    if (n > 0) holders.add(p.id);
  }
  if (total >= def.total) return false;
  if (def.exclusive && holders.size && !holders.has(pid)) return false;
  return true;
}

function viewBonus(g, round, scores) {
  const c = g.config;
  const defs = R.bonusDefs(c);
  const ready = g.players.filter((p) => round.tricks[p.id] != null);
  if (!ready.length) return '';
  const eligible = [];
  const without = [];
  for (const p of ready) {
    const f = R.bonusFactor(c, round, p.id);
    const avail = defs.filter((d) => d.noTrick || round.tricks[p.id] > 0);
    if (f > 0 && avail.length) eligible.push({ p, f, avail });
    else without.push({ p, reason: f === 0 ? 'annonce ratée' : 'aucun pli' });
  }
  const cards = eligible.map(({ p, f, avail }) => {
    const counts = round.bonus[p.id] || {};
    const s = scores[p.id];
    const bonusPts = s ? s.bonus : 0;
    const open = ui.open.has(p.id) || defs.some((d) => counts[d.key]);
    const rows = avail.map((d) => {
      const n = counts[d.key] || 0;
      const canAdd = bonusAllowance(g, round, d, p.id);
      return `<div class="stepper-row"><span class="ico" aria-hidden="true">${d.icon}</span>
        <span class="txt"><b>${d.label}</b><span>${signed(d.pts * f)} ${f < 1 ? '(moitié, tir rasant)' : 'chacun'} · ${d.hint}</span></span>
        <span class="stepper">
          <button data-act="bonus" data-p="${p.id}" data-k="${d.key}" data-d="-1" ${n ? '' : 'disabled'} aria-label="Retirer">−</button>
          <output>${n}</output>
          <button data-act="bonus" data-p="${p.id}" data-k="${d.key}" data-d="1" ${canAdd ? '' : 'disabled'} aria-label="Ajouter">+</button>
        </span></div>`;
    }).join('');
    return `<div class="card pcard">
      <button class="bonus-toggle" data-act="toggleBonus" data-p="${p.id}" aria-expanded="${open}">
        ${avatar(p)}<span class="name">${esc(p.name)}</span>
        <span class="badge ${bonusPts > 0 ? 'ok' : bonusPts < 0 ? 'bad' : ''}">${bonusPts ? signed(bonusPts) : 'Aucun bonus'}</span>
        <span class="muted">${open ? '▴' : '▾'}</span></button>
      ${open ? `<div class="bonus-body">${rows}</div>` : ''}
    </div>`;
  }).join('');
  return `
    <div class="section-title">Bonus</div>
    ${eligible.length ? `<p class="lede">Touchez un joueur pour indiquer les cartes de ses plis qui rapportent un bonus.</p>${cards}` : ''}
    ${without.length ? `<p class="lede small">Pas de bonus : ${without.map((x) => `${esc(x.p.name)} (${x.reason})`).join(', ')}.</p>` : ''}`;
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
    return `<div class="card pcard">
      <div class="pcard-head">${avatar(p)}<span class="name">${esc(p.name)}</span>
        <span class="meta">Annonce <b>${eff ?? '–'}</b>${eff !== round.bids[p.id] ? ` <span class="tiny">(${round.bids[p.id]})</span>` : ''}${mode}</span></div>
      ${bidChips(round, p.id, 'tricks', round.tricks[p.id], eff)}
    </div>`;
  }).join('');
  return `
    <div class="section-title">Plis remportés</div>
    <p class="lede">Le point doré marque l’annonce de chaque joueur.</p>
    ${tricks}
    ${viewAbilities(g, round)}
    ${viewLoot(g, round)}
    ${viewBonus(g, round, scores)}
    ${viewRoundScores(g, round, scores)}
    ${viewMessages(R.validateRound(c, round, g.players, 'result'))}`;
}

function trickInfo(g, round) {
  const vals = g.players.map((p) => round.tricks[p.id]).filter((v) => v != null);
  const total = vals.reduce((a, b) => a + b, 0);
  const missing = g.players.length - vals.length;
  if (missing) return `<b>${missing} joueur${missing > 1 ? 's' : ''} à compléter</b><br><span class="muted">${total} / ${round.cards} plis</span>`;
  return `<b>${total} / ${round.cards} plis</b><br><span class="muted">${total === round.cards ? 'Le compte est bon.' : total < round.cards ? 'Pli(s) sans gagnant ?' : 'Trop de plis.'}</span>`;
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
      <div class="rank-list">${items}</div>
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
        <div class="banner"><span class="ico">🏴‍☠️</span><span>Chacun choisit son annonce en secret, puis tout le monde la révèle en même temps au « Yo-ho-ho ! »${g.players.length === 2 ? ' N’oubliez pas la main de Barbe-Grise.' : ''}</span></div>
        <div class="section-title">Annonces</div>
        ${viewBids(g, round, false)}
      </div></main>
      <div class="bar"><div class="wrap">
        <div class="info">${bidTotalInfo(g, round)}</div>
        <button class="btn btn-primary btn-lg" data-act="toResults" ${v.errors.length ? 'disabled' : ''}>Jouer la manche</button>
      </div></div>`;
  }
  const v = R.validateRound(g.config, round, g.players, 'result');
  return `${topbarPlay(g)}
    <main class="page"><div class="wrap stack">
      ${viewResults(g, round, false)}
    </div></main>
    <div class="bar"><div class="wrap">
      <button class="btn" data-act="toBids" aria-label="Revenir aux annonces">‹ Annonces</button>
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
      <button class="btn" data-act="cancelEdit">Annuler</button>
      <div class="info">${trickInfo(g, draft)}</div>
      <button class="btn btn-primary btn-lg" data-act="saveEdit" ${v.errors.length ? 'disabled' : ''}>Enregistrer</button>
    </div></div>`;
}

// ---------- Tableau des scores ----------
function scoreTable(g, clickable) {
  const { perRound, sum } = R.totals(g);
  const head = g.players.map((p) => `<th>${avatar(p)}<br>${esc(p.name)}</th>`).join('');
  const rows = g.rounds.map((r, i) => {
    const pr = perRound[i];
    const cells = g.players.map((p) => {
      if (!pr) return '<td class="muted">–</td>';
      const s = pr.score[p.id];
      return `<td><span class="c">${fmt(pr.cumul[p.id])}</span><span class="s ${s.status}">${s.eff}/${s.tricks} · ${signed(s.total)}</span></td>`;
    }).join('');
    const can = clickable && pr;
    return `<tr class="${can ? 'click' : ''}" ${can ? `data-act="editRound" data-i="${i}"` : ''}><td>M${i + 1}<br><span class="tiny">${r.cards} c.</span>${can ? ' ✎' : ''}</td>${cells}</tr>`;
  }).join('');
  const foot = g.players.map((p) => `<td>${fmt(sum[p.id])}</td>`).join('');
  return `<div class="table-wrap"><table class="scores">
    <thead><tr><th>Manche</th>${head}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>Total</td>${foot}</tr></tfoot></table></div>
    <p class="tiny muted" style="padding:0 4px">Chaque case : total cumulé, puis annonce / plis · points de la manche.${clickable ? ' Touchez une manche pour la corriger.' : ''}</p>`;
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
    <h2>Règles du décompte</h2>
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
    body = `<h2>Partie en cours</h2><div class="stack" style="gap:8px;margin-top:12px">
      <button class="btn btn-block" data-act="openScores">📜 Feuille de score</button>
      <button class="btn btn-block" data-act="rules">❓ Règles du décompte</button>
      <button class="btn btn-block" data-act="home">🏠 Accueil (la partie est conservée)</button>
      <button class="btn btn-block btn-danger" data-act="askAbandon">Abandonner la partie</button>
      <button class="btn btn-block btn-ghost" data-act="closeModal">Fermer</button></div>`;
  } else if (ui.modal.type === 'confirm') {
    body = `<h2>${ui.modal.title}</h2><p class="muted">${ui.modal.text}</p>
      <div class="actions"><button class="btn" data-act="closeModal">Annuler</button>
      <button class="btn btn-primary" data-act="${ui.modal.ok}" ${ui.modal.id ? `data-id="${ui.modal.id}"` : ''}>${ui.modal.okLabel}</button></div>`;
  }
  return `<div class="modal-back" data-act="backdrop"><div class="modal" role="dialog" aria-modal="true">${body}</div></div>`;
}

// ---------- Rendu ----------
function render() {
  let html;
  switch (ui.screen) {
    case 'setup': html = viewSetup(); break;
    case 'play': html = db.current ? viewPlay() : viewHome(); break;
    case 'edit': html = viewEdit(); break;
    case 'scores': html = viewScores(); break;
    case 'past': html = viewEnd(ui.past, true); break;
    default: html = viewHome();
  }
  $app.innerHTML = html + viewModal() + (ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : '');
  document.body.style.overflow = ui.modal ? 'hidden' : '';
}

// ---------- Actions ----------
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
  closeModal: () => { ui.modal = null; render(); },
  backdrop: (d, el, e) => { if (e.target === el) { ui.modal = null; render(); } },
  askAbandon: () => { ui.modal = { type: 'confirm', title: 'Abandonner la partie ?', text: 'Les scores de cette partie seront effacés.', ok: 'abandon', okLabel: 'Abandonner' }; render(); },
  abandon: () => { db.current = null; save(); go('home'); },

  // Préparation
  addPlayer: () => { ui.setup.players.push({ id: uid(), name: '' }); render(); focusLastName(); },
  delPlayer: (d) => { ui.setup.players.splice(+d.i, 1); render(); },
  movePlayer: (d) => { const i = +d.i; const p = ui.setup.players; [p[i - 1], p[i]] = [p[i], p[i - 1]]; render(); },
  edition: (d) => { ui.setup.config = R.normalizeConfig({ ...ui.setup.config, edition: d.v }); render(); },
  scoring: (d) => { ui.setup.config = R.normalizeConfig({ ...ui.setup.config, scoring: d.v }); render(); },
  schedule: (d) => { ui.setup.config.schedule = d.v; render(); },
  customAdd: () => { const c = ui.setup.config.custom; c.push(Math.min(20, (c.at(-1) || 0) + 1)); render(); },
  customDel: (d) => { const c = ui.setup.config.custom; if (c.length > 1) c.splice(+d.i, 1); render(); },
  customStep: (d) => { const c = ui.setup.config.custom; c[+d.i] = Math.max(1, Math.min(20, c[+d.i] + +d.d)); render(); },
  startGame: () => startGame(),

  // Partie
  bid: (d) => { const { round } = ctx(); round.bids[d.p] = +d.v; commit(); },
  mode: (d) => { const { round } = ctx(); round.modes[d.p] = d.v; commit(); },
  tricks: (d) => { const { round } = ctx(); round.tricks[d.p] = +d.v; commit(); },
  bonus: (d) => {
    const { round } = ctx();
    const b = (round.bonus[d.p] = round.bonus[d.p] || {});
    b[d.k] = Math.max(0, (b[d.k] || 0) + +d.d);
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
      g.finished = true;
      g.finishedAt = Date.now();
      db.history.push(JSON.parse(JSON.stringify(g)));
      if (db.history.length > 50) db.history.shift();
      save();
      go('play');
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
  harryWho: (v) => { const { round } = ctx(); round.harry = v ? { pid: v, delta: round.harry?.pid === v ? round.harry.delta : 0 } : null; commit(); },
  rascalWho: (v) => { const { round } = ctx(); round.rascal = v ? { pid: v, bet: round.rascal?.bet ?? 0 } : null; commit(); },
  lootFrom: (v, el) => { const { round } = ctx(); round.loots[+el.dataset.i].from = v; commit(); },
  lootTo: (v, el) => { const { round } = ctx(); round.loots[+el.dataset.i].to = v; commit(); },
};

function focusLastName() {
  const inputs = $app.querySelectorAll('[data-input="pname"]');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el.dataset, el, e);
});
$app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.cfg && ui.setup) {
    ui.setup.config = R.normalizeConfig({ ...ui.setup.config, [el.dataset.cfg]: el.checked });
    render();
    return;
  }
  if (el.dataset.change && changes[el.dataset.change]) changes[el.dataset.change](el.value, el);
});
$app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.input === 'pname' && ui.setup) ui.setup.players[+el.dataset.i].name = el.value;
});
$app.addEventListener('keydown', (e) => {
  const el = e.target;
  if (e.key === 'Enter' && el.dataset.input === 'pname') {
    e.preventDefault();
    const i = +el.dataset.i;
    const next = $app.querySelector(`[data-input="pname"][data-i="${i + 1}"]`);
    if (next) next.focus();
    else if (ui.setup.players.length < R.maxPlayers(ui.setup.config)) actions.addPlayer();
    else el.blur();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.modal) { ui.modal = null; render(); }
});
window.addEventListener('storage', (e) => { if (e.key === KEY) { db = load(); render(); } });

render();
