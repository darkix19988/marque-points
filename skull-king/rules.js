// Skull King : règles, composition du paquet et décompte des points.
// Sources : livret officiel Grandpa Beck's Games (2021), livret "Skull King: Expansion Pack" (2025),
// règle de l'ancienne édition Schmidt (Scary Mary).
// Ce module ne touche pas au DOM : il est testé avec `node --test`.

export const EDITIONS = {
  new: {
    label: 'Édition actuelle',
    sub: '2021 et après · Tigresse, 2 Sirènes, Kraken, Baleine, Butin',
    maxPlayers: 8,
  },
  old: {
    label: 'Ancienne édition',
    sub: 'Schmidt · Scary Mary, 1 Sirène, cartes 1 à 13',
    maxPlayers: 6,
  },
};

export const SCHEDULES = [
  { id: 'classic', label: 'Classique', sub: '10 manches, de 1 à 10 cartes', rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 'even', label: 'Even Keeled', sub: '2 manches de 2, 4, 6, 8 et 10 cartes', rounds: [2, 2, 4, 4, 6, 6, 8, 8, 10, 10] },
  { id: 'brawl', label: 'Skip to the Brawl', sub: '1 manche de 6, 7, 8, 9 et 10 cartes', rounds: [6, 7, 8, 9, 10] },
  { id: 'skirmish', label: 'Swift-n-Salty Skirmish', sub: '5 manches de 5 cartes', rounds: [5, 5, 5, 5, 5] },
  { id: 'broadside', label: 'Broadside Barrage', sub: '10 manches de 10 cartes', rounds: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
  { id: 'whirlpool', label: 'Whirlpool', sub: '2 manches de 9, 7, 5, 3 et 1 cartes', rounds: [9, 9, 7, 7, 5, 5, 3, 3, 1, 1] },
  { id: 'bedtime', label: 'Past Your Bedtime', sub: '1 manche d’une carte (et un câlin)', rounds: [1] },
  { id: 'custom', label: 'Personnalisée', sub: 'Choisissez vos manches', rounds: null },
];

export function defaultConfig() {
  return {
    edition: 'new',
    scoring: 'skull', // 'skull' (Skull King) ou 'rascal' (Rascal)
    cannonball: false, // option Rascal : Mitraille / Boulet de canon
    schedule: 'classic',
    custom: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    loot: false,
    kraken: false,
    whale: false,
    abilities: false, // pouvoirs des pirates
    bonusMode: 'cards', // 'cards' : on compte les cartes bonus ; 'points' : on saisit directement les points
    pack: false, // Expansion Pack 2025
    packCon: true,
    packStingray: true,
    packDavy: true,
    packPlank: true,
    packVolley: true,
  };
}

/** Rend la configuration cohérente (l'ancienne édition n'a pas les cartes avancées). */
export function normalizeConfig(c) {
  const out = { ...defaultConfig(), ...c };
  if (out.edition === 'old') {
    out.loot = out.kraken = out.whale = out.abilities = out.pack = false;
  }
  if (out.scoring !== 'rascal') out.cannonball = false;
  return out;
}

export function minPlayers() {
  return 2;
}

/** Nombre de joueurs conseillé par la règle. Ce n'est pas une limite : on peut jouer à plus. */
export function recommendedPlayers(c) {
  if (c.edition === 'old') return EDITIONS.old.maxPlayers;
  return c.pack ? 9 : EDITIONS.new.maxPlayers;
}

/** Édition actuelle à 2 joueurs : une 3e main pour le fantôme de Barbe-Grise. */
export function handsDealt(nPlayers, c) {
  return nPlayers === 2 && (!c || c.edition !== 'old') ? 3 : nPlayers;
}

export function deckSize(c, nPlayers) {
  if (c.edition === 'old') return 66; // 52 cartes 1-13, 5 Escape, 5 Pirates, 1 Sirène, 1 Scary Mary, 1 Skull King
  let size = 56 + 5 + 1 + 1 + 2 + 5; // 4 couleurs ×14, 5 Pirates, Tigresse, Skull King, 2 Sirènes, 5 Fuites = 70
  if (c.loot) size += 2;
  if (c.kraken) size += 1;
  if (c.whale) size += 1;
  if (c.pack) {
    const duo = nPlayers === 2;
    size += 8; // un 7 et un 8 par couleur
    if (!duo) size += 4 + 1; // 0/14 de chaque couleur + Wild 15 (retirés à 2 joueurs)
    size += 1; // Mary Thorne
    if (c.packCon) size += 1;
    if (c.packStingray) size += 1;
    if (c.packDavy) size += 1;
    if (c.packVolley) size += 1;
    if (c.packPlank && !duo) size += 1;
  }
  return size;
}

export function maxCardsPerHand(c, nPlayers) {
  return Math.max(1, Math.floor(deckSize(c, nPlayers) / handsDealt(nPlayers, c)));
}

export function scheduleRounds(c) {
  if (c.schedule === 'custom') {
    const r = (c.custom || []).map((n) => Math.max(1, Math.min(20, Math.round(n) || 1)));
    return r.length ? r : [1];
  }
  const s = SCHEDULES.find((x) => x.id === c.schedule) || SCHEDULES[0];
  return s.rounds.slice();
}

/**
 * Nombre de cartes distribuées à chaque manche. Avec beaucoup de joueurs, on répète
 * le nombre maximal de cartes possible pour que chacun ait la même main (règle officielle).
 */
export function roundsFor(c, nPlayers) {
  const max = maxCardsPerHand(c, nPlayers);
  return scheduleRounds(c).map((n) => Math.min(n, max));
}

/** Cartes du paquet capables de faire disparaître un pli entier (personne ne le remporte). */
export function trickDestroyers(c) {
  const list = [];
  if (c.edition === 'old') return list;
  if (c.kraken) list.push('Kraken');
  if (c.whale) list.push('Baleine blanche');
  if (c.pack) {
    if (c.packStingray) list.push('Raie tachetée');
    if (c.packDavy) list.push('Coffre de Davy Jones');
    if (c.packPlank) list.push('La Planche');
    if (c.packVolley) list.push('Dernière salve');
  }
  return list;
}

/**
 * Bonus disponibles selon la configuration.
 * total : nombre maximal sur l'ensemble des joueurs dans une manche.
 * exclusive : un seul joueur peut l'obtenir dans la manche (une seule carte en jeu).
 * noTrick : bonus qui ne demande pas d'avoir remporté un pli.
 */
export function bonusDefs(c) {
  if (c.edition === 'old') {
    return [
      {
        key: 'pirates', icon: '💀', pts: 30, total: 6, exclusive: true,
        label: 'Pirate capturé par le Skull King',
        hint: 'Dans le pli gagné par le Skull King. La Scary Mary compte toujours, même jouée en Escape.',
      },
      {
        key: 'sk', icon: '🧜‍♀️', pts: 50, total: 1, exclusive: true,
        label: 'Skull King capturé par la Sirène',
        hint: 'Le Skull King dans le pli gagné par la Sirène.',
      },
    ];
  }
  const piratesInDeck = 5 + 1 + (c.pack ? 1 : 0); // + Tigresse (jouée en pirate) + Mary Thorne
  const plank = c.pack && c.packPlank;
  const defs = [
    {
      key: 'c14', icon: '🎴', pts: 10, total: 3,
      label: '14 de couleur',
      hint: 'Jaune, violet ou vert, dans vos plis, peu importe qui l’a joué.',
    },
    {
      key: 'b14', icon: '🏴', pts: 20, total: 1,
      label: '14 noir (Jolly Roger)',
      hint: 'Dans vos plis, peu importe qui l’a joué.',
    },
    {
      key: 'mermaid', icon: '🧜‍♀️', pts: 20, total: 2,
      label: 'Sirène capturée par un Pirate',
      hint: 'Dans un pli gagné par un Pirate (ou la Tigresse jouée en Pirate).',
    },
    {
      key: 'pirates', icon: '☠️', pts: 30, total: piratesInDeck, exclusive: true,
      label: 'Pirate capturé par le Skull King',
      hint: 'Dans le pli gagné par le Skull King. La Tigresse compte seulement si elle a été jouée en Pirate.'
        + (plank ? ' Un pirate retiré par La Planche ne compte pas.' : ''),
    },
    {
      key: 'sk', icon: '👑', pts: 40, total: 1, exclusive: true,
      label: 'Skull King capturé par une Sirène',
      hint: 'Le Skull King dans le pli gagné par une Sirène.',
    },
  ];
  if (c.pack) {
    if (c.packCon) {
      defs.push({
        key: 'con', icon: '🗡️', pts: 30, total: 1, exclusive: true,
        label: 'First Mate Con capturé',
        hint: 'Par le Skull King ou une Sirène.',
      });
    }
    defs.push(
      {
        key: 'e8', icon: '🧭', pts: 5, total: 4,
        label: '8 de l’extension',
        hint: 'Les 8 marqués d’une boussole.',
      },
      {
        key: 'e7', icon: '🧭', pts: -5, total: 4,
        label: '7 de l’extension',
        hint: 'Les 7 marqués d’une boussole (malus).',
      },
    );
    const monsters = (c.kraken ? 1 : 0) + (c.whale ? 1 : 0) + (c.packStingray ? 1 : 0);
    if (c.packDavy && monsters > 0) {
      defs.push({
        key: 'davy', icon: '⚓', pts: 20, total: monsters, exclusive: true, noTrick: true,
        label: 'Monstre marin pris par Davy Jones',
        hint: 'Pour qui a joué le Coffre : chaque Kraken, Baleine ou Raie détruit. Possible sans gagner de pli.',
      });
    }
  }
  return defs;
}

export function newRound(cards) {
  return {
    cards,
    bids: {},
    modes: {}, // pid -> 'grape' | 'cannon'
    tricks: {},
    bonus: {}, // pid -> { key: count }
    loots: [], // [{ from: pid, to: pid }]
    harry: null, // { pid, delta: -1|0|1 }
    rascal: null, // { pid, bet: 0|10|20 }
    done: false,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Annonces et plis à 0 par défaut : on ne touche que les joueurs qui ne sont pas à zéro. */
export function fillDefaults(round, playerIds) {
  for (const id of playerIds) {
    if (round.bids[id] == null) round.bids[id] = 0;
    if (round.tricks[id] == null) round.tricks[id] = 0;
  }
  round.loots = round.loots || [];
  round.modes = round.modes || {};
  round.bonus = round.bonus || {};
  round.free = round.free || {};
  return round;
}

/**
 * Pourquoi un joueur ne peut pas ajouter un bonus de plus (null s'il le peut).
 * Ne compte que les joueurs qui touchent des bonus cette manche.
 */
export function bonusLimit(c, round, players, def, pid) {
  let total = 0;
  let holder = null;
  for (const p of players) {
    if (bonusFactor(c, round, p.id) === 0 || freeBonus(round, p.id) != null) continue;
    const n = (round.bonus[p.id] || {})[def.key] || 0;
    total += n;
    if (n > 0 && p.id !== pid && !holder) holder = p;
  }
  if (def.exclusive && holder) return `Déjà attribué à ${holder.name}`;
  if (total >= def.total) return def.total === 1 ? 'Une seule carte dans le jeu' : `${def.total} cartes au maximum dans le jeu`;
  return null;
}

/** Bonus saisi directement en points pour ce joueur, ou null s'il est compté par cartes. */
export function freeBonus(round, pid) {
  const v = round.free && round.free[pid];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Annonce finale d'un joueur, après un éventuel coup de Harry le Géant. */
export function effectiveBid(c, round, pid) {
  const bid = round.bids[pid];
  if (bid == null) return null;
  if (c.abilities && round.harry && round.harry.pid === pid) {
    return clamp(bid + (round.harry.delta || 0), 0, round.cards);
  }
  return bid;
}

/** Précision de l'annonce : écart entre annonce finale et plis remportés. */
export function accuracy(c, round, pid) {
  const eff = effectiveBid(c, round, pid);
  const tricks = round.tricks[pid];
  if (eff == null || tricks == null) return null;
  return Math.abs(eff - tricks);
}

/** Part des bonus touchée par le joueur : 1, 0,5 ou 0. */
export function bonusFactor(c, round, pid) {
  const diff = accuracy(c, round, pid);
  if (diff == null) return 0;
  if (c.scoring === 'rascal') {
    const cannon = c.cannonball && round.modes[pid] === 'cannon';
    if (cannon) return diff === 0 ? 1 : 0;
    return diff === 0 ? 1 : diff === 1 ? 0.5 : 0;
  }
  return diff === 0 ? 1 : 0;
}

/**
 * Calcule les points d'une manche pour chaque joueur.
 * roundNumber : numéro de la manche (1 à n), utilisé par l'ancienne édition pour l'annonce zéro.
 */
export function scoreRound(c, round, roundNumber, playerIds) {
  const defs = bonusDefs(c);
  const out = {};
  const exact = {};
  for (const pid of playerIds) exact[pid] = accuracy(c, round, pid) === 0;

  for (const pid of playerIds) {
    const bid = round.bids[pid];
    const eff = effectiveBid(c, round, pid);
    const tricks = round.tricks[pid];
    if (eff == null || tricks == null) {
      out[pid] = null;
      continue;
    }
    const diff = Math.abs(eff - tricks);
    let base;
    let status;
    if (c.scoring === 'rascal') {
      const cannon = c.cannonball && round.modes[pid] === 'cannon';
      if (cannon) {
        base = diff === 0 ? 15 * round.cards : 0;
        status = diff === 0 ? 'hit' : 'miss';
      } else {
        base = diff === 0 ? 10 * round.cards : diff === 1 ? 5 * round.cards : 0;
        status = diff === 0 ? 'hit' : diff === 1 ? 'glancing' : 'miss';
      }
    } else if (eff === 0) {
      // Annonce zéro : 10 × cartes distribuées (ancienne édition : 10 × numéro de manche).
      const x = c.edition === 'old' ? roundNumber : round.cards;
      base = diff === 0 ? 10 * x : -10 * x;
      status = diff === 0 ? 'hit' : 'miss';
    } else {
      base = diff === 0 ? 20 * eff : -10 * diff;
      status = diff === 0 ? 'hit' : 'miss';
    }

    const factor = bonusFactor(c, round, pid);
    const counts = round.bonus[pid] || {};
    let raw = 0;
    const detail = [];
    const free = freeBonus(round, pid);
    if (free != null) {
      // Bonus saisi directement en points (joueurs expérimentés).
      raw = free;
      if (free) detail.push({ key: 'free', label: 'Bonus saisi', count: 1, pts: free * factor });
    } else {
      for (const d of defs) {
        const n = counts[d.key] || 0;
        if (n > 0) {
          raw += n * d.pts;
          detail.push({ key: d.key, label: d.label, count: n, pts: n * d.pts * factor });
        }
      }
    }
    let bonus = raw * factor;

    // Butin : alliance entre le joueur du Butin et le gagnant du pli, +20 chacun si les deux réussissent.
    let loot = 0;
    if (c.edition === 'new' && c.loot) {
      for (const l of round.loots || []) {
        if (!l || !l.from || !l.to || l.from === l.to) continue;
        if ((l.from === pid || l.to === pid) && exact[l.from] && exact[l.to]) loot += 20;
      }
    }
    if (loot) detail.push({ key: 'loot', label: 'Alliance du Butin', count: loot / 20, pts: loot });
    bonus += loot;

    // Rascal of Roatan : pari de 0, 10 ou 20, gagné si l'annonce est réussie, perdu sinon.
    let wager = 0;
    if (c.abilities && round.rascal && round.rascal.pid === pid) {
      const bet = round.rascal.bet || 0;
      wager = diff === 0 ? bet : -bet;
    }

    out[pid] = {
      bid, eff, tricks, diff, status, base, bonus, wager, factor, detail,
      total: base + bonus + wager,
    };
  }
  return out;
}

/** Totaux cumulés après chaque manche terminée. */
export function totals(game) {
  const ids = game.players.map((p) => p.id);
  const sum = Object.fromEntries(ids.map((id) => [id, 0]));
  const perRound = [];
  game.rounds.forEach((r, i) => {
    if (!r.done) {
      perRound.push(null);
      return;
    }
    const s = scoreRound(game.config, r, i + 1, ids);
    for (const id of ids) sum[id] += s[id] ? s[id].total : 0;
    perRound.push({ score: s, cumul: { ...sum } });
  });
  return { sum, perRound };
}

export function ranking(game) {
  const { sum } = totals(game);
  const list = game.players.map((p) => ({ ...p, total: sum[p.id] }));
  list.sort((a, b) => b.total - a.total);
  let rank = 0;
  list.forEach((p, i) => {
    if (i === 0 || p.total !== list[i - 1].total) rank = i + 1;
    p.rank = rank;
  });
  return list;
}

/**
 * Vérifie une manche. Renvoie des erreurs bloquantes et des remarques.
 * phase : 'bid' (annonces seules) ou 'result'.
 */
export function validateRound(c, round, players, phase = 'result') {
  const errors = [];
  const notes = [];
  const name = (pid) => (players.find((p) => p.id === pid) || {}).name || '?';
  const missingBid = players.filter((p) => round.bids[p.id] == null);
  if (missingBid.length) errors.push(`Annonce manquante : ${missingBid.map((p) => p.name).join(', ')}.`);
  if (phase === 'bid') return { errors, notes, destroyed: 0 };

  const missingTricks = players.filter((p) => round.tricks[p.id] == null);
  if (missingTricks.length) {
    errors.push(`Plis manquants : ${missingTricks.map((p) => p.name).join(', ')}.`);
    return { errors, notes, destroyed: 0 };
  }
  const sum = players.reduce((s, p) => s + round.tricks[p.id], 0);
  const destroyers = trickDestroyers(c);
  let destroyed = 0;
  if (sum > round.cards) {
    errors.push(`${sum} plis comptés pour ${round.cards} plis joués : il y en a ${sum - round.cards} de trop.`);
  } else if (sum < round.cards) {
    destroyed = round.cards - sum;
    if (!destroyers.length) {
      errors.push(`${sum} plis comptés pour ${round.cards} plis joués : il en manque ${destroyed}.`);
    } else if (destroyed > destroyers.length) {
      errors.push(`${destroyed} plis sans gagnant, mais seulement ${destroyers.length} carte(s) peuvent détruire un pli.`);
    } else {
      notes.push(`${destroyed} pli${destroyed > 1 ? 's' : ''} sans gagnant : normal s’il a été détruit (${destroyers.join(', ')}).`);
    }
  }

  // Bonus de capture sans pli remporté, et dépassement du nombre de cartes existantes.
  const defs = bonusDefs(c);
  const noTrickBonus = defs.some((d) => d.noTrick);
  for (const p of players) {
    const free = freeBonus(round, p.id);
    if (free && bonusFactor(c, round, p.id) > 0 && round.tricks[p.id] === 0 && !noTrickBonus) {
      errors.push(`${p.name} a un bonus sans avoir remporté de pli.`);
    }
  }
  for (const d of defs) {
    let total = 0;
    let holders = 0;
    for (const p of players) {
      if (bonusFactor(c, round, p.id) === 0 || freeBonus(round, p.id) != null) continue;
      const n = (round.bonus[p.id] || {})[d.key] || 0;
      if (!n) continue;
      total += n;
      holders += 1;
      if (!d.noTrick && round.tricks[p.id] === 0) {
        errors.push(`${p.name} a un bonus « ${d.label} » sans avoir remporté de pli.`);
      }
    }
    if (total > d.total) errors.push(`« ${d.label} » : ${total} déclarés, ${d.total} au maximum.`);
    if (d.exclusive && holders > 1) errors.push(`« ${d.label} » ne peut revenir qu’à un seul joueur par manche.`);
  }

  if (c.abilities) {
    if (round.harry && round.harry.pid && round.tricks[round.harry.pid] === 0) {
      errors.push(`${name(round.harry.pid)} n’a remporté aucun pli : impossible d’avoir gagné avec Harry le Géant.`);
    }
    if (round.rascal && round.rascal.pid && round.tricks[round.rascal.pid] === 0) {
      errors.push(`${name(round.rascal.pid)} n’a remporté aucun pli : impossible d’avoir gagné avec Rascal of Roatan.`);
    }
  }

  if (c.loot) {
    (round.loots || []).forEach((l, i) => {
      if (!l.from || !l.to) errors.push(`Butin ${i + 1} : indiquez qui l’a joué et qui a remporté le pli.`);
      else if (l.from === l.to) errors.push(`Butin ${i + 1} : on ne s’allie pas avec soi-même (pas de bonus).`);
      else if (round.tricks[l.to] === 0) errors.push(`Butin ${i + 1} : ${name(l.to)} n’a remporté aucun pli.`);
    });
    if ((round.loots || []).length > 2) errors.push('Il n’y a que 2 cartes Butin.');
  }

  return { errors, notes, destroyed };
}
