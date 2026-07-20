import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState,
} from 'react';
import type {
  ActiveCall, CallRecord, Chat, ID, Message, Poll, Profile, Settings, Story, StoryItem, User,
} from '@/types';
import { GRADIENTS, ME_ID } from '@/config/constants';
import { uid } from '@/lib/helpers';
import { db, auth, storage, registerFCMToken, onForegroundMessage } from '@/lib/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, writeBatch, arrayUnion, arrayRemove, deleteField, increment, onDisconnect
} from 'firebase/firestore';

/* ================= State ================= */

export type Phase = 'splash' | 'welcome' | 'login' | 'otp' | 'profile' | 'pin-setup' | 'app' | 'locked';
export type TabKey = 'chats' | 'stories' | 'calls' | 'settings';

interface AppState {
  phase: Phase;
  phone: string;
  registered: boolean;
  profile: Profile;
  users: Record<ID, User>;
  chats: Record<ID, Chat>;
  messages: Record<ID, Message[]>;
  stories: Story[];
  calls: CallRecord[];
  settings: Settings;
  activeTab: TabKey;
  activeChatId: ID | null;
  typing: Record<ID, ID>;
  viewingStoryOf: ID | null;
  activeCall: ActiveCall | null;
  unlockedChatIds: ID[];
  toast: string | null;
}

const DEFAULT_PROFILE: Profile = {
  name: 'ผู้ใช้งาน',
  username: '@you',
  phone: '',
  about: 'ใช้งาน Tirak Chat เป็นส่วนตัว',
  avatarColor: 'navy',
};

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  language: 'th',
  readReceipts: true,
  typingIndicators: true,
  onlineStatus: true,
  phonePrivacy: 'contacts',
  defaultDisappearing: 0,
  notifications: { messages: true, groups: true, calls: true, sound: true, previews: true },
  screenLock: false,
  lockPin: null as any,
  autoLockMins: 5,
  bubbleStyle: 'coral',
  enterToSend: true,
  backupEnabled: true,
  lastBackupAt: Date.now() - 2 * 864e5,
};

const STORAGE_KEY = 'tirak-chat-v1';
const STORAGE_USER_KEY = 'tirak-chat-user-id';

interface Persisted {
  registered: boolean;
  profile: Profile;
  settings: Settings;
}

function loadInitial(): AppState {
  let persisted: Persisted | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) persisted = JSON.parse(raw);
  } catch { /* ignore */ }

  const settings = { ...DEFAULT_SETTINGS, ...(persisted?.settings ?? {}) };
  const registered = persisted?.registered ?? false;
  const needsLock = registered && settings.screenLock && !!settings.lockPin;

  return {
    phase: registered ? (needsLock ? 'locked' : 'app') : 'splash',
    phone: persisted?.profile.phone ?? '',
    registered,
    profile: persisted?.profile ?? DEFAULT_PROFILE,
    users: {},
    chats: {},
    messages: {},
    stories: [],
    calls: [],
    settings,
    activeTab: 'chats',
    activeChatId: null,
    typing: {},
    viewingStoryOf: null,
    activeCall: null,
    unlockedChatIds: [],
    toast: null,
  };
}

/* ================= Actions ================= */

type Action =
  | { type: 'SET_PHASE'; phase: Phase }
  | { type: 'SET_PHONE'; phone: string }
  | { type: 'REGISTERED' }
  | { type: 'SET_PROFILE'; profile: Profile }
  | { type: 'SET_TAB'; tab: TabKey }
  | { type: 'OPEN_CHAT'; chatId: ID }
  | { type: 'CLOSE_CHAT' }
  | { type: 'SET_USERS'; users: Record<ID, User> }
  | { type: 'SET_CHATS'; chats: Record<ID, Chat> }
  | { type: 'SET_MESSAGES'; chatId: ID; messages: Message[] }
  | { type: 'SET_STORIES'; stories: Story[] }
  | { type: 'SET_CALLS'; calls: CallRecord[] }
  | { type: 'SET_TYPING'; chatId: ID; userId: ID | null }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> }
  | { type: 'SET_VIEWING_STORY'; userId: ID | null }
  | { type: 'SET_ACTIVE_CALL'; call: ActiveCall | null }
  | { type: 'UNLOCK_CHAT'; chatId: ID }
  | { type: 'TOAST'; toast: string | null }
  | { type: 'RESET_ALL' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PHASE': return { ...state, phase: action.phase };
    case 'SET_PHONE': return { ...state, phone: action.phone };
    case 'REGISTERED': return { ...state, registered: true };
    case 'SET_PROFILE': return { ...state, profile: action.profile };
    case 'SET_TAB': return { ...state, activeTab: action.tab };
    case 'OPEN_CHAT': return { ...state, activeChatId: action.chatId, activeTab: 'chats' };
    case 'CLOSE_CHAT': return { ...state, activeChatId: null };
    case 'SET_USERS': return { ...state, users: action.users };
    case 'SET_CHATS': return { ...state, chats: action.chats };
    case 'SET_MESSAGES': return { ...state, messages: { ...state.messages, [action.chatId]: action.messages } };
    case 'SET_STORIES': return { ...state, stories: action.stories };
    case 'SET_CALLS': return { ...state, calls: action.calls };
    case 'SET_TYPING': {
      const typing = { ...state.typing };
      if (action.userId) typing[action.chatId] = action.userId;
      else delete typing[action.chatId];
      return { ...state, typing };
    }
    case 'SET_SETTINGS': return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'SET_VIEWING_STORY': return { ...state, viewingStoryOf: action.userId };
    case 'SET_ACTIVE_CALL': return { ...state, activeCall: action.call };
    case 'UNLOCK_CHAT': return { ...state, unlockedChatIds: [...new Set([...state.unlockedChatIds, action.chatId])] };
    case 'TOAST': return { ...state, toast: action.toast };
    case 'RESET_ALL': {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
      return loadInitial();
    }
    default: return state;
  }
}

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  const res: any = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      res[key] = cleanUndefined(obj[key]);
    }
  }
  return res;
}

/* ================= Translation Helpers ================= */

function translateChatFromFirestore(chat: any, currentUserId: string): Chat {
  const unreadCount = chat.unreadCounts?.[currentUserId] ?? 0;
  
  // Translate lastMessage
  let lastMessage: Message | undefined = undefined;
  if (chat.lastMessage) {
    lastMessage = translateMessageFromFirestore(chat.lastMessage, currentUserId);
  }

  return {
    ...chat,
    unreadCount,
    lastMessage,
    memberIds: chat.memberIds.map((id: string) => id === currentUserId ? 'me' : id),
    adminIds: chat.adminIds?.map((id: string) => id === currentUserId ? 'me' : id) || [],
  };
}

function translateChatToFirestore(chat: any, currentUserId: string): any {
  const dbChat = {
    ...chat,
  };
  
  if (chat.memberIds) {
    dbChat.memberIds = chat.memberIds.map((id: string) => id === 'me' ? currentUserId : id);
  }
  if (chat.adminIds) {
    dbChat.adminIds = chat.adminIds.map((id: string) => id === 'me' ? currentUserId : id);
  }
  if (dbChat.lastMessage) {
    dbChat.lastMessage = translateMessageToFirestore(dbChat.lastMessage, currentUserId);
  }
  
  return dbChat;
}

function translateMessageFromFirestore(msg: any, currentUserId: string): Message {
  const reactions = msg.reactions?.map((r: any) => ({
    emoji: r.emoji,
    userIds: r.userIds.map((id: string) => id === currentUserId ? 'me' : id),
  })) || [];

  const poll = msg.poll ? {
    ...msg.poll,
    options: msg.poll.options.map((o: any) => ({
      ...o,
      votes: o.votes.map((id: string) => id === currentUserId ? 'me' : id),
    })),
  } : undefined;

  return {
    ...msg,
    senderId: msg.senderId === currentUserId ? 'me' : msg.senderId,
    reactions,
    poll,
  };
}

function translateMessageToFirestore(msg: any, currentUserId: string): any {
  const reactions = msg.reactions?.map((r: any) => ({
    emoji: r.emoji,
    userIds: r.userIds.map((id: string) => id === 'me' ? currentUserId : id),
  })) || [];

  const poll = msg.poll ? {
    ...msg.poll,
    options: msg.poll.options.map((o: any) => ({
      ...o,
      votes: o.votes.map((id: string) => id === 'me' ? currentUserId : id),
    })),
  } : undefined;

  return {
    ...msg,
    senderId: msg.senderId === 'me' ? currentUserId : msg.senderId,
    reactions,
    poll,
  };
}

function translateStoryFromFirestore(story: any, currentUserId: string): Story {
  return {
    ...story,
    userId: story.userId === currentUserId ? 'me' : story.userId,
    items: story.items.map((item: any) => ({
      ...item,
      viewers: item.viewers.map((id: string) => id === currentUserId ? 'me' : id),
    })),
  };
}

/* ================= Context ================= */

interface SendPayload {
  text?: string;
  type?: Message['type'];
  replyToId?: ID;
  mediaUrl?: string;
  url?: string;
  mediaGradient?: string;
  mediaName?: string;
  mediaSize?: string;
  duration?: number;
  waveform?: number[];
  viewOnce?: boolean;
  poll?: Poll;
  forwarded?: boolean;
}

interface AppApi {
  state: AppState;
  t: (key: string) => string;
  setPhase: (p: Phase) => void;
  setPhone: (p: string) => void;
  completeRegistration: () => void;
  setProfile: (p: Profile) => void;
  logout: () => void;
  lockNow: () => void;
  unlock: (pin: string) => boolean;
  setTab: (t: TabKey) => void;
  openChat: (id: ID) => void;
  closeChat: () => void;
  sendMessage: (chatId: ID, payload: SendPayload) => void;
  editMessage: (chatId: ID, messageId: ID, text: string) => void;
  deleteMessage: (chatId: ID, messageId: ID, forEveryone: boolean) => void;
  toggleStar: (chatId: ID, messageId: ID) => void;
  toggleReaction: (chatId: ID, messageId: ID, emoji: string) => void;
  pinMessage: (chatId: ID, messageId: ID) => void;
  unpinMessage: (chatId: ID, messageId: ID) => void;
  votePoll: (chatId: ID, messageId: ID, optionId: ID) => void;
  patchChat: (chatId: ID, patch: Partial<Chat>) => void;
  clearHistory: (chatId: ID) => void;
  deleteChat: (chatId: ID) => void;
  createDirectChat: (userId: ID) => Promise<ID> | ID;
  createGroup: (name: string, memberIds: ID[]) => Promise<ID> | ID;
  forwardMessage: (fromChatId: ID, messageId: ID, targetChatId: ID) => void;
  addStory: (item: Omit<StoryItem, 'id' | 'createdAt' | 'viewers'>) => void;
  viewStoryItem: (userId: ID, itemId: ID) => void;
  setViewingStoryOf: (userId: ID | null) => void;
  startCall: (chatId: ID, type: 'voice' | 'video') => void;
  endCall: (answered: boolean, durationSecs: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  blockUser: (userId: ID, blocked: boolean) => void;
  toast: (msg: string) => void;
  resetAll: () => void;
  unlockChat: (chatId: ID) => void;
  validateUsernameUniqueness: (username: string, excludeUserId?: string) => Promise<boolean>;
  checkUserExists: (value: string, mode: 'phone' | 'username') => Promise<User | null>;
  signUpUser: (profile: Profile) => Promise<string>;
  markViewOnceOpened: (messageId: ID) => void;
  setTypingStatus: (chatId: ID, isTyping: boolean) => void;
  addMemberToGroup: (chatId: ID, memberIds: ID[]) => Promise<void>;
  leaveGroup: (chatId: ID) => Promise<void>;
}

const AppContext = createContext<AppApi | null>(null);

/* ================= i18n (minimal) ================= */
const DICT: Record<string, { th: string; en: string }> = {
  chats: { th: 'แชท', en: 'Chats' },
  stories: { th: 'สตอรี่', en: 'Stories' },
  calls: { th: 'สายเรียก', en: 'Calls' },
  settings: { th: 'ตั้งค่า', en: 'Settings' },
  search: { th: 'ค้นหา', en: 'Search' },
  typeMessage: { th: 'พิมพ์ข้อความ...', en: 'Type a message...' },
  online: { th: 'ออนไลน์', en: 'Online' },
  typing: { th: 'กำลังพิมพ์...', en: 'typing...' },
  all: { th: 'ทั้งหมด', en: 'All' },
  unread: { th: 'ยังไม่อ่าน', en: 'Unread' },
  friends: { th: 'เพื่อน', en: 'Friends' },
  family: { th: 'ครอบครัว', en: 'Family' },
  work: { th: 'งาน', en: 'Work' },
  archived: { th: 'ที่เก็บถาวร', en: 'Archived' },
};

/* ================= Provider ================= */

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);
  const timers = useRef<number[]>([]);
  const toastTimer = useRef<number | null>(null);
  const lastActivity = useRef<number>(Date.now());
  const stateRef = useRef(state);
  stateRef.current = state;

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_USER_KEY);
  });

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* Save basic registered phase to localStorage */
  useEffect(() => {
    if (!state.registered) return;
    const p: Persisted = {
      registered: state.registered,
      profile: state.profile,
      settings: state.settings,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  }, [state.registered, state.profile, state.settings]);

  /* theme toggle */
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const mode = state.settings.theme;
      const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', dark);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [state.settings.theme]);

  /* disappearing sweep */
  useEffect(() => {
    const id = window.setInterval(async () => {
      const s = stateRef.current;
      const nowT = Date.now();
      
      // Sweep messages from active messages state that are expired
      Object.entries(s.messages).forEach(async ([_, list]) => {
        const expired = list.filter((m) => m.expiresAt && m.expiresAt <= nowT);
        if (expired.length > 0) {
          // Delete expired messages on Firestore
          for (const m of expired) {
            await deleteDoc(doc(db, 'messages', m.id));
          }
        }
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  /* auto lock */
  useEffect(() => {
    const bump = () => { lastActivity.current = Date.now(); };
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    const id = window.setInterval(() => {
      const s = stateRef.current;
      if (s.phase === 'app' && s.settings.screenLock && s.settings.lockPin &&
        Date.now() - lastActivity.current > s.settings.autoLockMins * 60_000) {
        dispatch({ type: 'SET_PHASE', phase: 'locked' });
      }
    }, 5000);
    return () => { window.removeEventListener('pointerdown', bump); window.removeEventListener('keydown', bump); clearInterval(id); };
  }, []);

  const toast = useCallback((msg: string) => {
    dispatch({ type: 'TOAST', toast: msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => dispatch({ type: 'TOAST', toast: null }), 2400);
  }, []);

  /* Production check: no mock seeding needed globally */
  useEffect(() => {
    // Only real users and real stories will be loaded via onSnapshot listeners
  }, []);

  /* Firebase real-time listeners & FCM registration */
  useEffect(() => {
    if (!currentUserId) return;
    registerFCMToken(currentUserId);

    const unsubFCM = onForegroundMessage((payload) => {
      const data = payload.data || {};
      const chatId = data.chatId || '';
      const text = data.text || 'คุณมีข้อความใหม่';
      if (chatId && document.visibilityState !== 'visible') {
        const settings = stateRef.current?.settings;
        if (settings?.notifications?.messages) {
          new Notification(payload.notification?.title || 'Tirak Chat', {
            body: settings?.notifications?.previews ? text : 'คุณมีข้อความใหม่',
            icon: '/favicon.ico',
          });
        }
      }
    });

    // 1. Current user profile listener
    const unsubUser = onSnapshot(doc(db, 'users', currentUserId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        dispatch({
          type: 'SET_PROFILE',
          profile: {
            name: data.name,
            username: data.username,
            phone: data.phone || '',
            about: data.about || '',
            avatarColor: data.avatarColor,
            avatarEmoji: data.avatarEmoji,
            avatarUrl: data.avatarUrl,
          }
        });
        if (data.settings) {
          dispatch({ type: 'SET_SETTINGS', patch: data.settings });
        }
      }
    });

    // 2. All users listener (for contacts)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersMap: Record<ID, User> = {};
      const curUserDoc = snapshot.docs.find(d => d.id === currentUserId);
      const blockedUserIds: string[] = curUserDoc?.data()?.blockedUserIds || [];

      snapshot.docs.forEach((d) => {
        if (d.id !== currentUserId) {
          const u = d.data();
          usersMap[d.id] = {
            id: d.id,
            name: u.name,
            username: u.username,
            phone: u.phone || '',
            about: u.about || '',
            avatarColor: u.avatarColor,
            avatarEmoji: u.avatarEmoji,
            avatarUrl: u.avatarUrl,
            online: u.online ?? false,
            lastSeen: u.lastSeen,
            isContact: u.isContact ?? true,
            blocked: blockedUserIds.includes(d.id),
          };
        }
      });
      dispatch({ type: 'SET_USERS', users: usersMap });
    });

    // 3. User's chats listener (includes typing field sync and desktop notifications)
    const chatsQuery = query(collection(db, 'chats'), where('memberIds', 'array-contains', currentUserId));
    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      const chatsMap: Record<ID, Chat> = {};
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          if (data.lastMessage && data.lastMessage.senderId !== currentUserId && data.lastMessage.senderId !== 'me') {
            const isFresh = Date.now() - (data.lastMessage.createdAt || 0) < 10000;
            if (isFresh) {
              const settings = stateRef.current?.settings;
              if (settings?.notifications?.messages && typeof window !== 'undefined') {
                if ('Notification' in window && Notification.permission === 'granted') {
                  const title = data.name || 'Tirak Chat';
                  const body = settings?.notifications?.previews ? (data.lastMessage.text || 'ข้อความใหม่') : 'คุณมีข้อความใหม่';
                  try {
                    new Notification(title, { body, icon: '/favicon.ico' });
                  } catch { /* ignore notification error */ }
                }
              }
            }
          }
        }
      });

      snapshot.docs.forEach((d) => {
        chatsMap[d.id] = translateChatFromFirestore({ id: d.id, ...d.data() }, currentUserId);
        // Sync typing indicators from Firestore
        const data = d.data();
        const typingMap: Record<string, boolean> = data.typing || {};
        Object.entries(typingMap).forEach(([uid, isTyping]) => {
          if (uid !== currentUserId) {
            const mappedId = uid === currentUserId ? 'me' : uid;
            dispatch({ type: 'SET_TYPING', chatId: d.id, userId: isTyping ? mappedId : null });
          }
        });
      });
      dispatch({ type: 'SET_CHATS', chats: chatsMap });
    });

    // 4. User's stories listener
    const unsubStories = onSnapshot(collection(db, 'stories'), (snapshot) => {
      const storiesList: Story[] = [];
      snapshot.docs.forEach((d) => {
        storiesList.push(translateStoryFromFirestore({ id: d.id, ...d.data() }, currentUserId));
      });
      dispatch({ type: 'SET_STORIES', stories: storiesList });
    });

    // 5. User's calls history listener
    const unsubCalls = onSnapshot(collection(db, 'users', currentUserId, 'calls'), (snapshot) => {
      const callsList: CallRecord[] = [];
      snapshot.docs.forEach((d) => {
        callsList.push({ id: d.id, ...d.data() } as CallRecord);
      });
      // Sort calls descending
      callsList.sort((a, b) => b.startedAt - a.startedAt);
      dispatch({ type: 'SET_CALLS', calls: callsList });
    });

    // 6. Active Call Signaling listener for incoming calls
    const activeCallsQuery = query(collection(db, 'active_calls'), where('memberIds', 'array-contains', currentUserId));
    const unsubActiveCalls = onSnapshot(activeCallsQuery, (snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if ((data.status === 'calling' || data.status === 'ringing') && data.callerId !== currentUserId) {
          if (data.status === 'calling') {
            updateDoc(doc(db, 'active_calls', docSnap.id), { status: 'ringing' }).catch(() => {});
          }
          dispatch({
            type: 'SET_ACTIVE_CALL',
            call: {
              id: docSnap.id,
              chatId: data.chatId,
              type: data.type,
              startedAt: data.startedAt,
              group: data.group,
              jitsiRoom: data.jitsiRoom,
              isCaller: false,
            },
          });
        }
      });
    });

    return () => {
      unsubUser();
      unsubUsers();
      unsubChats();
      unsubStories();
      unsubCalls();
      unsubActiveCalls();
      unsubFCM();
    };
  }, [currentUserId]);

  /* Listener for current active chat messages */
  useEffect(() => {
    if (!currentUserId || !state.activeChatId) return;

    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', state.activeChatId)
    );

    const unsubMessages = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) =>
        translateMessageFromFirestore({ id: d.id, ...d.data() }, currentUserId)
      );
      // Sort messages in ascending order
      list.sort((a, b) => a.createdAt - b.createdAt);
      dispatch({ type: 'SET_MESSAGES', chatId: state.activeChatId!, messages: list });
    });

    return () => unsubMessages();
  }, [currentUserId, state.activeChatId]);

  /* Commercial Production: clean initial environment setup */
  const initializeNewUserEnvironment = async (_newUserId: string) => {
    // Clean production setup: start cleanly with essential environment configuration without simulation data
  };

  /* Helper to check if a username is unique across Firestore */
  const validateUsernameUniqueness = useCallback(async (username: string, excludeUserId?: string): Promise<boolean> => {
    try {
      const cleanUsername = username.startsWith('@') ? username : `@${username}`;
      const usersQuery = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snap = await getDocs(usersQuery);
      if (snap.empty) return true;
      if (excludeUserId) {
        return snap.docs.every((d) => d.id === excludeUserId);
      }
      return false;
    } catch (err) {
      console.error('Username uniqueness check error:', err);
      return false;
    }
  }, []);

  /* Helper to check if a user exists by phone or username */
  const checkUserExists = async (value: string, mode: 'phone' | 'username') => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where(mode === 'phone' ? 'phone' : 'username', '==', value)
      );
      const snap = await getDocs(usersQuery);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();
        const foundUser: User = {
          id: docSnap.id,
          name: data.name,
          username: data.username,
          phone: data.phone || '',
          about: data.about || '',
          avatarColor: data.avatarColor,
          avatarEmoji: data.avatarEmoji,
          avatarUrl: data.avatarUrl,
          online: data.online ?? false,
          isContact: data.isContact ?? true,
        };

        if (data.totpSecret) {
          localStorage.setItem('tirak_totp_secret', data.totpSecret);
        }

        // Authenticate anonymously
        await signInAnonymously(auth);

        // Mark user as online
        try {
          await updateDoc(doc(db, 'users', foundUser.id), {
            online: true,
            lastSeen: Date.now(),
          });
          const userRef = doc(db, 'users', foundUser.id);
          onDisconnect(userRef).update({ online: false, lastSeen: Date.now() });
        } catch { /* ignore */ }
        
        // Save to local state and localStorage
        setCurrentUserId(foundUser.id);
        localStorage.setItem(STORAGE_USER_KEY, foundUser.id);
        return foundUser;
      }
    } catch (err) {
      console.error('Check user error:', err);
    }
    return null;
  };

  /* Helper to sign up new user */
  const signUpUser = async (profile: Profile) => {
    try {
      toast('กำลังติดต่อเซิร์ฟเวอร์เพื่อตรวจสอบชื่อผู้ใช้และยืนยันตัวตน...');
      console.log('[SignUp] Starting verification and registration...');

      // Validate username uniqueness
      const isUnique = await validateUsernameUniqueness(profile.username);
      if (!isUnique) {
        throw new Error(`ชื่อผู้ใช้ ${profile.username} มีผู้อื่นใช้งานในระบบแล้ว กรุณาเลือกชื่อผู้ใช้อื่น`);
      }

      // 1. Authenticate anonymously in Firebase
      const authUserSnap = await signInAnonymously(auth);
      const newUserId = authUserSnap.user.uid;
      console.log('[SignUp] Signed in anonymously with UID:', newUserId);
      toast('ยืนยันตัวตนสำเร็จ กำลังสร้างโปรไฟล์ของคุณ...');

      // 2. Write user document to firestore
      const userRef = doc(db, 'users', newUserId);
      const totpSecret = localStorage.getItem('tirak_totp_secret') || '';
      const userData = {
        name: profile.name,
        username: profile.username,
        phone: profile.phone,
        about: profile.about,
        avatarColor: profile.avatarColor,
        avatarEmoji: profile.avatarEmoji || null,
        avatarUrl: profile.avatarUrl || null,
        online: true,
        lastSeen: Date.now(),
        isContact: true,
        settings: DEFAULT_SETTINGS,
        blockedUserIds: [],
        totpSecret,
      };
      await setDoc(userRef, cleanUndefined(userData));
      console.log('[SignUp] Saved user document to Firestore.');
      toast('บันทึกโปรไฟล์สำเร็จ เข้าสู่ระบบเรียบร้อยแล้ว!');

      // 3. Production check: clean start
      await initializeNewUserEnvironment(newUserId);
      console.log('[SignUp] Registration completed cleanly.');

      // 4. Set state
      setCurrentUserId(newUserId);
      localStorage.setItem(STORAGE_USER_KEY, newUserId);
      return newUserId;
    } catch (err) {
      console.error('[SignUp] Sign up error:', err);
      toast(`สมัครใช้งานไม่สำเร็จ: ${(err as Error).message}`);
      throw err;
    }
  };
  /* ---------- messaging ---------- */
  const sendMessage = useCallback(async (chatId: ID, payload: SendPayload) => {
    if (!currentUserId) return;
    const s = stateRef.current;
    const chat = s.chats[chatId];
    if (!chat) return;

    const expiresAt = chat.disappearingSecs ? Date.now() + chat.disappearingSecs * 1000 : undefined;
    const msgId = uid();
    const localMsg: Message = {
      id: msgId,
      chatId,
      senderId: ME_ID,
      type: payload.type ?? 'text',
      text: payload.text,
      createdAt: Date.now(),
      status: 'sending',
      replyToId: payload.replyToId,
      reactions: [],
      mediaUrl: payload.mediaUrl ?? payload.url,
      url: payload.url ?? payload.mediaUrl,
      mediaGradient: payload.mediaGradient,
      mediaName: payload.mediaName,
      mediaSize: payload.mediaSize,
      duration: payload.duration,
      waveform: payload.waveform,
      viewOnce: payload.viewOnce,
      viewed: false,
      poll: payload.poll,
      forwarded: payload.forwarded,
      expiresAt,
    };

    const dbMsg = translateMessageToFirestore(localMsg, currentUserId);
    
    // Save to Firestore
    await setDoc(doc(db, 'messages', msgId), cleanUndefined(dbMsg));
    const msgRef = doc(db, 'messages', msgId);
    await updateDoc(msgRef, { status: 'sent' });

    // Update chat draft, lastMessage and unread counts for other members in Firestore
    const chatRef = doc(db, 'chats', chatId);
    const updatePayload: Record<string, any> = {
      draft: '',
      lastMessage: cleanUndefined(dbMsg),
    };

    // Atomic increment unreadCount for everyone else
    const dbMemberIds = chat.memberIds.map(id => id === 'me' ? currentUserId : id);
    dbMemberIds.forEach((id) => {
      if (id !== currentUserId) {
        updatePayload[`unreadCounts.${id}`] = increment(1);
      }
    });

    await updateDoc(chatRef, updatePayload);

    if (chat.type === 'self') {
      await updateDoc(doc(db, 'messages', msgId), { status: 'read' });
    }
  }, [currentUserId]);

  const editMessage = useCallback(async (_chatId: ID, messageId: ID, text: string) => {
    await updateDoc(doc(db, 'messages', messageId), {
      text,
      edited: true
    });
  }, []);

  const deleteMessage = useCallback(async (_chatId: ID, messageId: ID, forEveryone: boolean) => {
    const msgRef = doc(db, 'messages', messageId);
    const snap = await getDoc(msgRef);
    if (snap.exists()) {
      const m = snap.data();
      if (m.mediaUrl) {
        try { await deleteObject(ref(storage, m.mediaUrl)); } catch { /* ignore if already deleted */ }
      }
    }
    if (forEveryone) {
      await updateDoc(msgRef, {
        deletedForEveryone: true,
        text: '',
        poll: null,
        mediaGradient: null,
        mediaName: null,
        mediaSize: null,
        mediaUrl: null,
        reactions: [],
      });
    } else {
      await deleteDoc(msgRef);
    }
  }, []);

  const toggleStar = useCallback(async (_chatId: ID, messageId: ID) => {
    const msgRef = doc(db, 'messages', messageId);
    const snap = await getDoc(msgRef);
    if (snap.exists()) {
      await updateDoc(msgRef, {
        starred: !snap.data().starred
      });
    }
  }, []);

  const toggleReaction = useCallback(async (_chatId: ID, messageId: ID, emoji: string) => {
    if (!currentUserId) return;
    const msgRef = doc(db, 'messages', messageId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const reactionsList = data.reactions || [];
    const existing = reactionsList.find((r: any) => r.emoji === emoji);

    let updated: any[];
    if (existing?.userIds.includes(currentUserId)) {
      updated = reactionsList
        .map((r: any) => r.emoji === emoji ? { ...r, userIds: r.userIds.filter((id: string) => id !== currentUserId) } : r)
        .filter((r: any) => r.userIds.length > 0);
    } else if (existing) {
      updated = reactionsList.map((r: any) => r.emoji === emoji ? { ...r, userIds: [...r.userIds, currentUserId] } : r);
    } else {
      updated = [...reactionsList.filter((r: any) => !r.userIds.includes(currentUserId)), { emoji, userIds: [currentUserId] }];
    }

    await updateDoc(msgRef, { reactions: updated });
  }, [currentUserId]);

  const pinMessage = useCallback(async (chatId: ID, messageId: ID) => {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      pinnedMessageIds: arrayUnion(messageId)
    });
  }, []);

  const unpinMessage = useCallback(async (chatId: ID, messageId: ID) => {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      pinnedMessageIds: arrayRemove(messageId)
    });
  }, []);

  const votePoll = useCallback(async (_chatId: ID, messageId: ID, optionId: ID) => {
    if (!currentUserId) return;
    const msgRef = doc(db, 'messages', messageId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;

    const m = snap.data();
    const current = m.poll;
    if (!current || current.closed) return;

    const updatedOptions = current.options.map((o: any) => {
      const already = o.votes.includes(currentUserId);
      if (current.multiple) {
        if (o.id !== optionId) return o;
        return { ...o, votes: already ? o.votes.filter((v: string) => v !== currentUserId) : [...o.votes, currentUserId] };
      }
      const without = o.votes.filter((v: string) => v !== currentUserId);
      return { ...o, votes: o.id === optionId && !already ? [...without, currentUserId] : without };
    });

    await updateDoc(msgRef, {
      'poll.options': updatedOptions
    });
  }, [currentUserId]);

  const patchChat = useCallback(async (chatId: ID, patch: Partial<Chat>) => {
    if (!currentUserId) return;
    const chatRef = doc(db, 'chats', chatId);
    const dbPatch = translateChatToFirestore(patch, currentUserId);
    
    // Replace any undefined property with deleteField() to remove it from Firestore
    const cleanedPatch: Record<string, any> = {};
    Object.keys(dbPatch).forEach((key) => {
      if (dbPatch[key] === undefined) {
        cleanedPatch[key] = deleteField();
      } else {
        cleanedPatch[key] = cleanUndefined(dbPatch[key]);
      }
    });
    
    await updateDoc(chatRef, cleanedPatch);
  }, [currentUserId]);

  const clearHistory = useCallback(async (chatId: ID) => {
    // Delete all messages in firestore belonging to this chat
    const q = query(collection(db, 'messages'), where('chatId', '==', chatId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    // Use 'd' to avoid shadowing the imported 'doc' function
    snap.docs.forEach((d) => {
      batch.delete(d.ref);
    });
    // Clear lastMessage in Chat
    batch.update(doc(db, 'chats', chatId), { lastMessage: deleteField() });
    await batch.commit();
  }, []);

  const deleteChat = useCallback(async (chatId: ID) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'chats', chatId));

    const q = query(collection(db, 'messages'), where('chatId', '==', chatId));
    const snap = await getDocs(q);
    // Use 'd' to avoid shadowing the imported 'doc' function
    snap.docs.forEach((d) => {
      batch.delete(d.ref);
    });

    await batch.commit();
  }, []);

  const setTypingStatus = useCallback(async (chatId: ID, isTyping: boolean) => {
    if (!currentUserId) return;
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`typing.${currentUserId}`]: isTyping ? true : deleteField()
    }).catch(() => {});
  }, [currentUserId]);

  const addMemberToGroup = useCallback(async (chatId: ID, newMemberIds: ID[]) => {
    if (!currentUserId || !newMemberIds.length) return;
    const chatRef = doc(db, 'chats', chatId);
    const updates: Record<string, any> = {
      memberIds: arrayUnion(...newMemberIds)
    };
    newMemberIds.forEach(id => { updates[`unreadCounts.${id}`] = 0; });
    await updateDoc(chatRef, updates);
    toast('เพิ่มสมาชิกเข้ากลุ่มแล้ว');
  }, [currentUserId, toast]);

  const leaveGroup = useCallback(async (chatId: ID) => {
    if (!currentUserId) return;
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      memberIds: arrayRemove(currentUserId),
      adminIds: arrayRemove(currentUserId)
    });
    dispatch({ type: 'CLOSE_CHAT' });
    toast('คุณออกจากกลุ่มเรียบร้อยแล้ว');
  }, [currentUserId, toast]);

  const createDirectChat = useCallback(async (userId: ID) => {
    if (!currentUserId) return '';
    const chatsQuery = query(collection(db, 'chats'), where('memberIds', 'array-contains', currentUserId));
    const snap = await getDocs(chatsQuery);
    
    // Check if direct chat already exists
    const existing = snap.docs.find((d) => {
      const data = d.data();
      return data.type === 'direct' && data.memberIds.includes(userId);
    });

    if (existing) return existing.id;

    // Create new direct chat
    const chatDocId = uid();
    const otherUserSnap = await getDoc(doc(db, 'users', userId));
    const otherUser = otherUserSnap.data();

    const newChat: Chat = {
      id: chatDocId,
      type: 'direct',
      name: otherUser?.name || 'ผู้ใช้ใหม่',
      avatarColor: otherUser?.avatarColor || 'navy',
      avatarEmoji: otherUser?.avatarEmoji || null,
      memberIds: ['me', userId],
      unreadCount: 0,
      pinnedMessageIds: [],
      folder: 'friends',
      createdAt: Date.now(),
    };

    const dbChat = translateChatToFirestore(newChat, currentUserId);
    dbChat.unreadCounts = {
      [currentUserId]: 0,
      [userId]: 0
    };

    await setDoc(doc(db, 'chats', chatDocId), dbChat);
    return chatDocId;
  }, [currentUserId]);

  const createGroup = useCallback(async (name: string, memberIds: ID[]) => {
    if (!currentUserId) return '';
    const chatDocId = uid();

    const newChat = {
      id: chatDocId,
      type: 'group',
      name,
      avatarColor: Object.keys(GRADIENTS)[Math.floor(Math.random() * 6)],
      memberIds: ['me', ...memberIds],
      adminIds: ['me'],
      unreadCount: 0,
      pinnedMessageIds: [],
      inviteCode: `tirak.design/join/${uid().slice(0, 8)}`,
      createdAt: Date.now(),
    };

    const dbChat = translateChatToFirestore(newChat, currentUserId);
    const unreadCounts: Record<string, number> = {
      [currentUserId]: 0
    };
    memberIds.forEach((id) => {
      unreadCounts[id] = 0;
    });
    dbChat.unreadCounts = unreadCounts;

    await setDoc(doc(db, 'chats', chatDocId), dbChat);

    // Save initial system message
    const msgId = uid();
    const systemMsg = translateMessageToFirestore({
      id: msgId,
      chatId: chatDocId,
      senderId: ME_ID,
      type: 'system',
      text: `คุณสร้างกลุ่ม "${name}"`,
      createdAt: Date.now(),
      status: 'read',
      reactions: [],
    }, currentUserId);

    await setDoc(doc(db, 'messages', msgId), cleanUndefined(systemMsg));
    await updateDoc(doc(db, 'chats', chatDocId), { lastMessage: cleanUndefined(systemMsg) });

    return chatDocId;
  }, [currentUserId]);

  const forwardMessage = useCallback(async (_fromChatId: ID, messageId: ID, targetChatId: ID) => {
    const msgSnap = await getDoc(doc(db, 'messages', messageId));
    if (!msgSnap.exists()) return;

    const m = msgSnap.data();
    // sendMessage ส่ง payload ปกติ แล้วเพิ่ม forwarded flag ทีหลัง
    const fwdPayload = {
      text: m.text,
      type: m.type as Message['type'],
      mediaGradient: m.mediaGradient,
      mediaName: m.mediaName,
      mediaSize: m.mediaSize,
      duration: m.duration,
      waveform: m.waveform,
      forwarded: true,
    };
    await sendMessage(targetChatId, fwdPayload);
    toast('ส่งต่อข้อความแล้ว ↪️');
  }, [sendMessage, toast]);

  /* ---------- stories ---------- */
  const addStory = useCallback(async (item: Omit<StoryItem, 'id' | 'createdAt' | 'viewers'>) => {
    if (!currentUserId) return;
    
    // Check if user already has a stories document
    const q = query(collection(db, 'stories'), where('userId', '==', currentUserId));
    const snap = await getDocs(q);
    const newItem: StoryItem = cleanUndefined({
      id: uid(),
      kind: item.kind,
      text: item.text,
      mediaUrl: item.mediaUrl,
      gradient: item.gradient,
      emoji: item.emoji,
      createdAt: Date.now(),
      viewers: [],
    });

    if (!snap.empty) {
      const docId = snap.docs[0].id;
      await updateDoc(doc(db, 'stories', docId), {
        items: arrayUnion(newItem)
      });
    } else {
      const docId = uid();
      await setDoc(doc(db, 'stories', docId), {
        userId: currentUserId,
        items: [newItem]
      });
    }

    toast('เพิ่มสตอรี่แล้ว');
  }, [currentUserId, toast]);

  const viewStoryItem = useCallback(async (userId: ID, itemId: ID) => {
    if (!currentUserId) return;
    const dbUserId = userId === 'me' ? currentUserId : userId;
    
    const q = query(collection(db, 'stories'), where('userId', '==', dbUserId));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const storyDoc = snap.docs[0];
    const data = storyDoc.data();
    const updatedItems = data.items.map((i: any) => {
      if (i.id === itemId) {
        return {
          ...i,
          viewers: [...new Set([...(i.viewers || []), currentUserId])]
        };
      }
      return i;
    });

    await updateDoc(storyDoc.ref, { items: updatedItems });
  }, [currentUserId]);

  /* ---------- calls ---------- */
  const startCall = useCallback((chatId: ID, type: 'voice' | 'video') => {
    const chat = stateRef.current.chats[chatId];
    const raw = `tirak-${chatId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    const jitsiRoom = `trk${(h >>> 0).toString(36)}${Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(36).padStart(2, '0')).join('')}`;
    const callId = uid();
    const memberIds = chat?.memberIds.map(id => id === 'me' ? (currentUserId || ME_ID) : id) || [];
    if (currentUserId) {
      setDoc(doc(db, 'active_calls', callId), {
        id: callId,
        chatId,
        type,
        callerId: currentUserId,
        status: 'calling',
        startedAt: Date.now(),
        group: chat?.type === 'group',
        jitsiRoom,
        memberIds,
      }).catch(err => console.error('Signaling start error:', err));
    }
    dispatch({ type: 'SET_ACTIVE_CALL', call: { id: callId, chatId, type, startedAt: Date.now(), group: chat?.type === 'group', jitsiRoom, isCaller: true } });
  }, [currentUserId]);

  const endCall = useCallback(async (answered: boolean, durationSecs: number) => {
    if (!currentUserId) return;
    const s = stateRef.current;
    const call = s.activeCall;
    if (!call) return;

    if (call.id) {
      if (answered) {
        await updateDoc(doc(db, 'active_calls', call.id), { status: 'ended' }).catch(() => {});
      } else {
        await updateDoc(doc(db, 'active_calls', call.id), { status: 'declined' }).catch(() => {});
      }
      setTimeout(() => { if (call.id) deleteDoc(doc(db, 'active_calls', call.id)).catch(() => {}); }, 2000);
    }

    const chat = s.chats[call.chatId];
    const otherId = chat?.memberIds.find((id) => id !== ME_ID) ?? ME_ID;
    const dbOtherId = otherId === 'me' ? currentUserId : otherId;

    const callId = uid();
    const rec: CallRecord = {
      id: callId,
      chatId: call.chatId,
      userId: dbOtherId,
      type: call.type,
      direction: call.isCaller === false ? 'in' : 'out',
      status: answered ? 'answered' : (call.isCaller === false ? 'missed' : 'declined'),
      startedAt: call.startedAt,
      durationSecs: answered ? durationSecs : 0,
      group: call.group,
    };

    // Save call to Firestore users/{currentUserId}/calls
    await setDoc(doc(db, 'users', currentUserId, 'calls', callId), rec);

    // Save call history message
    const msgId = uid();
    const dbMsg = translateMessageToFirestore({
      id: msgId,
      chatId: call.chatId,
      senderId: call.isCaller === false ? dbOtherId : ME_ID,
      type: 'call',
      callType: call.type,
      callStatus: answered ? 'answered' : 'missed',
      duration: answered ? durationSecs : 0,
      createdAt: Date.now(),
      status: 'read',
      reactions: [],
    }, currentUserId);

    await setDoc(doc(db, 'messages', msgId), cleanUndefined(dbMsg));
    await updateDoc(doc(db, 'chats', call.chatId), { lastMessage: cleanUndefined(dbMsg) });
    
    dispatch({ type: 'SET_ACTIVE_CALL', call: null });
  }, [currentUserId]);

  const markViewOnceOpened = useCallback(async (messageId: ID) => {
    await updateDoc(doc(db, 'messages', messageId), {
      viewed: true
    });
  }, []);

  /* ---------- settings / auth ---------- */
  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    if (!currentUserId) return;
    // Update local state first for fast responsive UI
    dispatch({ type: 'SET_SETTINGS', patch });
    // Update firestore
    await updateDoc(doc(db, 'users', currentUserId), cleanUndefined({
      settings: {
        ...stateRef.current.settings,
        ...patch
      }
    }));
  }, [currentUserId]);

  const setProfile = useCallback(async (p: Profile) => {
    if (!currentUserId) return;
    const cleanUsername = p.username.startsWith('@') ? p.username : `@${p.username}`;
    const isUnique = await validateUsernameUniqueness(cleanUsername, currentUserId);
    if (!isUnique) {
      toast(`ชื่อผู้ใช้ ${cleanUsername} ถูกผู้อื่นใช้งานแล้ว กรุณาเลือกชื่ออื่น`);
      throw new Error(`ชื่อผู้ใช้ ${cleanUsername} ถูกผู้อื่นใช้งานแล้ว`);
    }
    const updatedProfile = { ...p, username: cleanUsername };
    dispatch({ type: 'SET_PROFILE', profile: updatedProfile });
    await updateDoc(doc(db, 'users', currentUserId), cleanUndefined({
      name: updatedProfile.name,
      username: updatedProfile.username,
      phone: updatedProfile.phone,
      about: updatedProfile.about,
      avatarColor: updatedProfile.avatarColor,
      avatarEmoji: updatedProfile.avatarEmoji || null,
      avatarUrl: updatedProfile.avatarUrl || null,
    }));
  }, [currentUserId, validateUsernameUniqueness, toast]);

  const lockNow = useCallback(() => dispatch({ type: 'SET_PHASE', phase: 'locked' }), []);

  const unlock = useCallback((pin: string) => {
    if (pin === stateRef.current.settings.lockPin) {
      lastActivity.current = Date.now();
      dispatch({ type: 'SET_PHASE', phase: 'app' });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    // Mark user as offline before signing out
    if (currentUserId) {
      try {
        await updateDoc(doc(db, 'users', currentUserId), {
          online: false,
          lastSeen: Date.now(),
        });
      } catch { /* ignore */ }
    }
    try {
      await auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
    dispatch({ type: 'RESET_ALL' });
  }, [currentUserId]);

  const resetAll = useCallback(async () => {
    if (currentUserId) {
      try {
        await updateDoc(doc(db, 'users', currentUserId), {
          online: false,
          lastSeen: Date.now(),
        });
      } catch { /* ignore */ }
    }
    try {
      await auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
    dispatch({ type: 'RESET_ALL' });
    toast('รีเซ็ตข้อมูลเรียบร้อย');
  }, [currentUserId, toast]);

  const openChat = useCallback(async (id: ID) => {
    if (!currentUserId) return;
    dispatch({ type: 'OPEN_CHAT', chatId: id });

    // Reset unread count for currentUserId in Firestore after opening
    const chatRef = doc(db, 'chats', id);
    await updateDoc(chatRef, {
      [`unreadCounts.${currentUserId}`]: 0
    });

    // Mark incoming delivered messages as read in active chat
    later(async () => {
      const q = query(
        collection(db, 'messages'),
        where('chatId', '==', id),
        where('status', '==', 'delivered')
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        if (d.data().senderId !== currentUserId) {
          batch.update(d.ref, { status: 'read' });
        }
      });
      await batch.commit();
    }, 600);
  }, [currentUserId]);

  const t = useCallback((key: string) => {
    const lang = state.settings.language;
    return DICT[key]?.[lang] ?? key;
  }, [state.settings.language]);

  const blockUser = useCallback(async (userId: ID, blocked: boolean) => {
    if (!currentUserId) return;
    const userRef = doc(db, 'users', currentUserId);
    if (blocked) {
      await updateDoc(userRef, {
        blockedUserIds: arrayUnion(userId)
      });
    } else {
      await updateDoc(userRef, {
        blockedUserIds: arrayRemove(userId)
      });
    }
  }, [currentUserId]);

  const api: AppApi = useMemo(() => ({
    state, t,
    setPhase: (p) => dispatch({ type: 'SET_PHASE', phase: p }),
    setPhone: (p) => dispatch({ type: 'SET_PHONE', phone: p }),
    completeRegistration: () => dispatch({ type: 'REGISTERED' }),
    setProfile, logout, lockNow, unlock,
    setTab: (tab) => dispatch({ type: 'SET_TAB', tab }),
    openChat, closeChat: () => dispatch({ type: 'CLOSE_CHAT' }),
    sendMessage, editMessage, deleteMessage, toggleStar, toggleReaction,
    pinMessage, unpinMessage, votePoll, patchChat, clearHistory, deleteChat,
    createDirectChat, createGroup, forwardMessage,
    addStory, viewStoryItem, setViewingStoryOf: (u) => dispatch({ type: 'SET_VIEWING_STORY', userId: u }),
    startCall, endCall, updateSettings,
    blockUser,
    toast, resetAll,
    unlockChat: (chatId) => dispatch({ type: 'UNLOCK_CHAT', chatId }),
    validateUsernameUniqueness,
    checkUserExists,
    signUpUser,
    setTypingStatus,
    addMemberToGroup,
    leaveGroup,
    markViewOnceOpened,
  }), [state, t, sendMessage, editMessage, deleteMessage, toggleStar, toggleReaction, pinMessage,
    unpinMessage, votePoll, patchChat, clearHistory, deleteChat, createDirectChat, createGroup,
    forwardMessage, addStory, viewStoryItem, startCall, endCall, updateSettings, setProfile,
    logout, lockNow, unlock, openChat, toast, resetAll, blockUser, validateUsernameUniqueness, markViewOnceOpened]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { ME_ID };
