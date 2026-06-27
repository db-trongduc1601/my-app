importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD2lePAn4k5iqQueb7rOZ9KjBknQmxhaMU",
  authDomain: "mine-150d1.firebaseapp.com",
  projectId: "mine-150d1",
  storageBucket: "mine-150d1.firebasestorage.app",
  messagingSenderId: "1078699098748",
  appId: "1:1078699098748:web:545c4931fa469a2db07ff9",
});

const messaging = firebase.messaging();

// Lắng nghe sự kiện chạy ngầm (chỉ ghi log, FCM SDK tự động hiển thị thông báo từ payload)
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Nhận tin nhắn chạy ngầm:', payload);
});

const CACHE_NAME = 'locket-luv-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Bỏ qua hot reload và các file của SDK firebase để tránh lỗi cache
  if (event.request.method !== 'GET' || event.request.url.includes('hot-update') || event.request.url.includes('@vite') || event.request.url.includes('firebase')) {
    return;
  }
  
  // Network-first cho các trang HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // Cache-first cho file tĩnh
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
            break;
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
