var cacheName = 'share';
var cacheRoutes = [
  '/',
  '/bower_components/jquery/dist/jquery.min.js',
  '/bower_components/moment/min/moment.min.js',
  '/bower_components/font-awsome/css/all.min.css',
  '/bower_components/font-awsome/webfonts/fa-regular-400.ttf',
  '/bower_components/font-awsome/webfonts/fa-regular-400.woff',
  '/bower_components/font-awsome/webfonts/fa-regular-400.woff2',
  '/bower_components/font-awsome/webfonts/fa-brands-400.ttf',
  '/bower_components/font-awsome/webfonts/fa-brands-400.woff',
  '/bower_components/font-awsome/webfonts/fa-brands-400.woff2',
  '/bower_components/font-awsome/webfonts/fa-solid-900.ttf',
  '/bower_components/font-awsome/webfonts/fa-solid-900.woff',
  '/bower_components/font-awsome/webfonts/fa-solid-900.woff2',
  '/bower_components/bootstrap/dist/css/bootstrap.min.css',
  '/bower_components/bootstrap4-toggle/css/bootstrap4-toggle.min.css',
  '/bower_components/bootstrap-select/dist/css/bootstrap-select.min.css',
  '/bower_components/bootstrap-table/dist/bootstrap-table.min.css',
  '/bower_components/tempusdominus-bs4/build/css/tempusdominus-bootstrap-4.min.css',
  '/bower_components/bootstrap-show-password/dist/bootstrap-show-password.min.js',
  '/assets/css/main.css',
  '/bower_components/bootstrap/dist/js/bootstrap.bundle.min.js',
  '/bower_components/bootstrap4-toggle/js/bootstrap4-toggle.min.js',
  '/bower_components/bootstrap-select/dist/js/bootstrap-select.min.js',
  '/bower_components/bootstrap-table/dist/bootstrap-table.min.js',
  '/bower_components/conditionize2.js/jquery.conditionize2.min.js',
  '/assets/js/main.js',
  '/assets/images/logo.png',
  '/favicon.ico'
];
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open('cacheName').then(function(cache) {
      return cache.addAll(cacheRoutes);
    })
  );
  console.log('Service Worker Installed');
});
self.addEventListener('activate', function(e) {
  console.log('[Service Worker] Activate');
  e.waitUntil(
    caches.keys().then(function(keyList) {
      return Promise.all(
        keyList.map(function(key) {
          if (key != cacheName) {
            console.log('Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});
self.addEventListener('fetch', function(event) {
  var eventPath = event.request.url.replace(event.target.location.origin, '');
  if (event.request.method === 'GET' && cacheRoutes.indexOf(eventPath) > -1) {
    if (navigator.onLine) {
      console.log('[Service Worker] Fetch', event.request.host);
      caches.open(cacheName).then(function(cache) {
        return fetch(event.request).then(function(response) {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    } else {
      event.respondWith(
        caches.match(event.request).then(function(response) {
          return response || fetch(event.request);
        })
      );
    }
  }
});
