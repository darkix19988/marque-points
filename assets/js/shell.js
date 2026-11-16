// Briques d'interface partagées par Skull King et Dépenses :
// fenêtre native <dialog>, zone d'annonce des messages, focus conservé entre deux affichages.

/** Crée (une seule fois) la fenêtre et la zone de messages, en dehors de #app. */
export function mountShell({ onClose }) {
  let dlg = document.getElementById('dlg');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg';
    dlg.className = 'modal';
    dlg.setAttribute('aria-labelledby', 'dlg-title');
    dlg.setAttribute('closedby', 'any'); // toucher à côté ferme la fenêtre (Échap et geste retour aussi)
    document.body.appendChild(dlg);
    dlg.addEventListener('close', onClose);
    // Safari ne connaît pas encore closedby : on ferme si l'appui commence et finit hors de la fenêtre.
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e) => {
        const r = dlg.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      dlg.addEventListener('pointerdown', (e) => { pressedOutside = outside(e); });
      dlg.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e)) dlg.close(); });
    }
  }
  let live = document.getElementById('toast');
  if (!live) {
    live = document.createElement('div');
    live.id = 'toast';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);
  }
  return { dlg, live };
}

/** Ouvre, met à jour ou ferme la fenêtre selon son contenu ('' = fermée). */
export function syncDialog(dlg, html) {
  if (html) {
    const changed = dlg.innerHTML !== html;
    if (changed) dlg.innerHTML = html;
    if (!dlg.open) {
      dlg.showModal();
    } else if (changed && !dlg.contains(document.activeElement)) {
      // Contenu remplacé fenêtre ouverte (menu → confirmation) : focus sur l'action sûre ou le premier bouton.
      const target = dlg.querySelector('[autofocus]') || dlg.querySelector('button, [href], input, select, textarea');
      if (target) target.focus();
    }
  } else if (dlg.open) {
    dlg.close();
  }
}

/** Affiche un petit message dans la zone d'annonce (lu par les lecteurs d'écran). */
export function syncToast(live, html) {
  if (live.innerHTML !== html) live.innerHTML = html;
}

const FOCUS_KEYS = ['act', 'p', 'v', 'k', 'd', 'i', 'id', 'cfg', 'change'];

/** Repère l'élément qui a le focus, pour le retrouver après un nouvel affichage. */
export function focusKey() {
  const el = document.activeElement;
  if (!el || el === document.body || !el.dataset) return null;
  // Les champs de saisie ne sont jamais redessinés pendant la frappe : inutile de les suivre.
  if (el.tagName === 'INPUT' && el.type !== 'checkbox') return null;
  const parts = FOCUS_KEYS.filter((k) => el.dataset[k] != null)
    .map((k) => `[data-${k}="${CSS.escape(el.dataset[k])}"]`);
  return parts.length ? parts.join('') : null;
}

export function restoreFocus(key) {
  if (!key) return;
  const el = document.querySelector(key);
  if (el && el !== document.activeElement && !el.disabled) el.focus({ preventScroll: true });
}

/** Après un changement d'écran : focus sur le titre, que les lecteurs d'écran annoncent. */
export function focusTitle() {
  const t = document.querySelector('#app .topbar .title');
  if (t) {
    t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  }
}

/** Entrée qui valide un mot en cours de composition (japonais, chinois…) : à ignorer. */
export const isComposing = (e) => e.isComposing || e.keyCode === 229;
