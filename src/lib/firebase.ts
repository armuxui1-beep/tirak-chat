import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, onMessage, isSupported, getToken } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Safe FCM initialization helper
export async function registerFCMToken(userId: string): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported || typeof window === 'undefined') return null;

    if ('serviceWorker' in navigator && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;

      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const messaging = getMessaging(app);
      
      // Note: VapidKey can be supplied via env if configured in Firebase Console Cloud Messaging settings
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
      const token = await getToken(messaging, { serviceWorkerRegistration: reg, vapidKey });
      
      if (token) {
        await setDoc(doc(db, 'users', userId, 'fcmTokens', token), {
          token,
          updatedAt: Date.now(),
          userAgent: navigator.userAgent
        }, { merge: true });
        return token;
      }
    }
  } catch (err) {
    console.warn('FCM registration skipped or not supported:', err);
  }
  return null;
}

// Export FCM messaging instance
let messagingInstance: ReturnType<typeof getMessaging> | null = null;

export async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported();
  if (!supported) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

// Listen for foreground messages
export function onForegroundMessage(callback: (payload: any) => void) {
  getMessagingInstance().then((m) => {
    if (m) {
      onMessage(m, (payload) => {
        callback(payload);
      });
    }
  });
}

export default app;
