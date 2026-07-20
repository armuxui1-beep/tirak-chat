importScripts('https://www.gstatic.com/firebasejs/10.x/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.x/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: self.__FIREBASE_CONFIG__?.apiKey || '',
  projectId: self.__FIREBASE_CONFIG__?.projectId || 'tirak-chat',
  messagingSenderId: self.__FIREBASE_CONFIG__?.messagingSenderId || '357396007467',
  appId: self.__FIREBASE_CONFIG__?.appId || '',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = payload.notification?.title || 'Tirak Chat';
  const body = payload.notification?.body || 'คุณมีข้อความใหม่';
  const chatId = data.chatId || '';

  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { chatId, url: data.url || '/' },
    tag: chatId || 'tirak',
    renotify: true,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
