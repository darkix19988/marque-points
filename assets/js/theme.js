// Thème clair / sombre / automatique, partagé par toutes les pages.
// Chargé dans <head> (sans defer) pour éviter un flash de la mauvaise couleur.
(function () {
  var KEY = 'marque-points:theme';
  var ORDER = ['auto', 'light', 'dark'];
  var LABELS = { auto: 'Auto', light: 'Clair', dark: 'Sombre' };
  var ICONS = { auto: '◐', light: '☀︎', dark: '☾' };
  function get() {
    try { var v = localStorage.getItem(KEY); return ORDER.indexOf(v) >= 0 ? v : 'auto'; } catch (e) { return 'auto'; }
  }
  function apply(mode) {
    var root = document.documentElement;
    if (mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
    var dark = mode === 'dark' || (mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0e1420' : '#f6f1e7');
  }
  function set(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) { /* stockage indisponible */ }
    apply(mode);
    document.dispatchEvent(new CustomEvent('themechange', { detail: mode }));
  }
  function cycle() {
    var next = ORDER[(ORDER.indexOf(get()) + 1) % ORDER.length];
    set(next);
    return next;
  }
  window.mpTheme = { get: get, set: set, cycle: cycle, label: function (m) { return LABELS[m || get()]; }, icon: function (m) { return ICONS[m || get()]; } };
  apply(get());
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (get() === 'auto') apply('auto'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }
})();
