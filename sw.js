/* ================================================================
   باشایان | نسخه فروشنده
   Service Worker — فعال‌سازی حالت آفلاین
   طراحی از محمدمهدی کوشکی
   ================================================================ */

/* نسخه کش — هر بار فایل‌ها تغییر کردند، این عدد را یکی زیاد کن */
const CACHE_VERSION = 'bashayan-v1.0.1';
const CACHE_STATIC = CACHE_VERSION + '-static';
const CACHE_RUNTIME = CACHE_VERSION + '-runtime';

/* فایل‌هایی که باید حتماً کش شوند */
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './app.js',
  './manifest.json',
  './offline.html',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

/* منابع خارجی که می‌خواهیم کش شوند (مثل فونت) */
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2',
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Medium.woff2',
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Bold.woff2',
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-ExtraBold.woff2'
];

/* ================================================================
   مرحله نصب — کش کردن فایل‌های اصلی
   ================================================================ */
self.addEventListener('install', function (event) {
  console.log('[SW] در حال نصب...');

  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(function (cache) {
        // ابتدا فایل‌های داخلی
        return cache.addAll(STATIC_ASSETS)
          .then(function () {
            // سپس فایل‌های خارجی — اگر یکی خطا داد، کل نصب متوقف نشود
            return Promise.allSettled(
              EXTERNAL_ASSETS.map(function (url) {
                return cache.add(url).catch(function (err) {
                  console.warn('[SW] خطا در کش فایل خارجی:', url, err);
                });
              })
            );
          });
      })
      .then(function () {
        // فعال‌سازی سریع بدون انتظار
        return self.skipWaiting();
      })
      .catch(function (err) {
        console.error('[SW] خطا در نصب:', err);
      })
  );
});

/* ================================================================
   مرحله فعال‌سازی — پاکسازی کش‌های قدیمی
   ================================================================ */
self.addEventListener('activate', function (event) {
  console.log('[SW] در حال فعال‌سازی...');

  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
            // اگر کش قدیمی است، حذفش کن
            if (cacheName !== CACHE_STATIC && cacheName !== CACHE_RUNTIME) {
              console.log('[SW] حذف کش قدیمی:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function () {
        // کنترل فوری همه صفحات باز
        return self.clients.claim();
      })
  );
});

/* ================================================================
   مرحله fetch — مدیریت درخواست‌ها
   ================================================================ */
self.addEventListener('fetch', function (event) {
  const request = event.request;

  // فقط GET را مدیریت کن
  if (request.method !== 'GET') return;

  // فقط http و https
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // درخواست‌های API ووکامرس را کش نکن
  if (url.pathname.indexOf('/wp-json/') !== -1) {
    return;
  }

  // درخواست‌های wp-admin، preview و ... را کش نکن
  if (url.pathname.indexOf('/wp-admin/') !== -1 ||
      url.search.indexOf('preview=true') !== -1) {
    return;
  }

  /* استراتژی:
     - فایل‌های داخلی: Cache First (اول کش، بعد شبکه)
     - تصاویر bashayan.ir: Stale-While-Revalidate (کش فوری، آپدیت در پس‌زمینه)
     - فونت و CSS: Cache First
     - سایر: Network First با fallback به کش
  */

  // فایل‌های خود اپ
  if (isSameOrigin(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // تصاویر روی سرور باشایان
  if (url.hostname === 'bashayan.ir') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // منابع خارجی (CDN فونت)
  if (url.hostname.indexOf('jsdelivr.net') !== -1 ||
      url.hostname.indexOf('fonts.') !== -1) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // بقیه درخواست‌ها
  event.respondWith(networkFirst(request));
});

/* ================================================================
   استراتژی ۱: Cache First
   اول کش، اگر نبود شبکه
   ================================================================ */
function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) {
      // همزمان در پس‌زمینه آپدیت کن
      updateCacheInBackground(request);
      return cached;
    }

    return fetch(request)
      .then(function (response) {
        if (!response || response.status !== 200) return response;
        // فقط پاسخ‌های موفق را کش کن
        if (response.type === 'basic' || response.type === 'cors') {
          const clone = response.clone();
          caches.open(CACHE_RUNTIME).then(function (cache) {
            cache.put(request, clone).catch(function () {});
          });
        }
        return response;
      })
      .catch(function () {
        // اگر شبکه نبود و کش هم نبود، صفحه آفلاین
        if (request.mode === 'navigate') {
          return caches.match('./offline.html');
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      });
  });
}

/* ================================================================
   استراتژی ۲: Network First
   اول شبکه، اگر نبود کش
   ================================================================ */
function networkFirst(request) {
  return fetch(request)
    .then(function (response) {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_RUNTIME).then(function (cache) {
          cache.put(request, clone).catch(function () {});
        });
      }
      return response;
    })
    .catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches.match('./offline.html');
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    });
}

/* ================================================================
   استراتژی ۳: Stale While Revalidate
   فوری از کش، همزمان آپدیت در پس‌زمینه
   ================================================================ */
function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cached) {
    const fetchPromise = fetch(request)
      .then(function (response) {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_RUNTIME).then(function (cache) {
            cache.put(request, clone).catch(function () {});
          });
        }
        return response;
      })
      .catch(function () {
        return cached;
      });

    return cached || fetchPromise;
  });
}

/* ================================================================
   آپدیت کش در پس‌زمینه (بدون بلاک کردن)
   ================================================================ */
function updateCacheInBackground(request) {
  fetch(request)
    .then(function (response) {
      if (response && response.status === 200) {
        caches.open(CACHE_RUNTIME).then(function (cache) {
          cache.put(request, response).catch(function () {});
        });
      }
    })
    .catch(function () {
      // سکوت — خطا مهم نیست
    });
}

/* ================================================================
   توابع کمکی
   ================================================================ */
function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

/* ================================================================
   پیام‌ها از سمت صفحه اصلی
   ================================================================ */
self.addEventListener('message', function (event) {
  if (!event.data) return;

  // درخواست آپدیت فوری
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // درخواست پاکسازی کش
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        return caches.delete(name);
      }));
    }).then(function () {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      }
    });
  }

  // درخواست اطلاعات کش
  if (event.data.type === 'GET_CACHE_INFO') {
    caches.keys().then(function (names) {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          type: 'CACHE_INFO',
          caches: names,
          version: CACHE_VERSION
        });
      }
    });
  }
});

/* ================================================================
   پایان فایل
   ================================================================ */
