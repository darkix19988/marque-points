// Mises à jour du site, utile surtout en mode « web app » (écran d'accueil) où il n'y a pas de bouton recharger.
// Compare la version de la page à version.json : si le site a changé, propose de mettre à jour.
(function () {
  var me = document.currentScript;
  var VERSION = me && me.getAttribute('data-version');
  var ROOT = (me && me.getAttribute('data-root')) || './';
  var shown = false;

  if ('serviceWorker' in navigator) navigator.serviceWorker.register(ROOT + 'sw.js').catch(function () {});

  // Recharge en contournant tous les caches (navigateur, service worker, serveur de GitHub).
  function reload(v) {
    var clear = window.caches
      ? caches.keys().then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      : Promise.resolve();
    clear.catch(function () {}).then(function () {
      location.replace(location.pathname + '?u=' + encodeURIComponent(v || Date.now()) + location.hash);
    });
  }

  function banner(v) {
    if (shown) return;
    shown = true;
    var el = document.createElement('div');
    el.className = 'update-banner';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span>Une nouvelle version est disponible.</span><button type="button">Mettre à jour</button>';
    el.querySelector('button').addEventListener('click', function () { reload(v); });
    document.body.appendChild(el);
  }

  function check() {
    if (shown || !VERSION || navigator.onLine === false) return;
    fetch(ROOT + 'version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && String(d.v) !== String(VERSION)) banner(d.v); })
      .catch(function () {});
  }

  window.mpReload = function () { reload(); };
  check();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 5 * 60 * 1000);
})();
