/* Service worker.
   - The PAGE (index.html / navigations) is served NETWORK-FIRST, so everyone
     always gets the latest version on the normal root URL; the cached copy is
     used only as an offline fallback.
   - Static assets (icons, manifest) are cache-first for speed.
   - API calls to Apps Script are never touched — always live. */
var CACHE = 'korea-expenses-v3';
var SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = req.url;

  // Never cache the Apps Script API — always go to the network.
  if (url.indexOf('script.google.com') !== -1 || url.indexOf('googleusercontent.com') !== -1) {
    return;
  }

  var isPage = req.mode === 'navigate' ||
               req.destination === 'document' ||
               url.indexOf('index.html') !== -1 ||
               url.replace(/[?#].*$/, '').endsWith('/');

  if (isPage) {
    // NETWORK-FIRST: always try to fetch the freshest page.
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) { return hit || caches.match('./'); });
      })
    );
    return;
  }

  // Static assets: cache-first, fall back to network.
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
