import { lazy, Suspense, useMemo } from 'react';
import { MessageCircle, Phone, Settings, Sparkles, Lock, ShieldCheck } from 'lucide-react';
import { AppProvider, useApp, type TabKey } from '@/store/AppContext';
import { ChatListScreen } from '@/components/chats/ChatListScreen';
import { ChatScreen } from '@/components/chat/ChatScreen';
import { TirakLogo, Avatar } from '@/components/shared/Brand';
import { InstallPrompt } from '@/components/shared/InstallPrompt';
import { cn } from '@/lib/utils';

// Lazy-loaded routes and heavy overlays for Code Splitting (<500KB chunk optimization)
const SplashScreen = lazy(() => import('@/components/auth/AuthScreens').then(m => ({ default: m.SplashScreen })));
const WelcomeScreen = lazy(() => import('@/components/auth/AuthScreens').then(m => ({ default: m.WelcomeScreen })));
const LoginScreen = lazy(() => import('@/components/auth/AuthScreens').then(m => ({ default: m.LoginScreen })));
const OtpScreen = lazy(() => import('@/components/auth/AuthScreens').then(m => ({ default: m.OtpScreen })));
const ProfileSetupScreen = lazy(() => import('@/components/auth/AuthScreens').then(m => ({ default: m.ProfileSetupScreen })));
const PinSetupScreen = lazy(() => import('@/components/auth/AuthScreens').then(m => ({ default: m.PinSetupScreen })));
const LockScreen = lazy(() => import('@/components/auth/AuthScreens').then(m => ({ default: m.LockScreen })));
const StoryViewer = lazy(() => import('@/components/stories/StoriesScreen').then(m => ({ default: m.StoryViewer })));
const CallsScreen = lazy(() => import('@/components/calls/CallsScreen').then(m => ({ default: m.CallsScreen })));
const CallOverlay = lazy(() => import('@/components/calls/CallsScreen').then(m => ({ default: m.CallOverlay })));
const SettingsScreen = lazy(() => import('@/components/settings/SettingsScreen').then(m => ({ default: m.SettingsScreen })));

function ScreenLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[hsl(var(--coral))] border-t-transparent shadow-md" />
        <span className="text-xs font-semibold text-muted-foreground animate-pulse">กำลังโหลดหน้าจอ...</span>
      </div>
    </div>
  );
}

const BUBBLE_STYLES: Record<string, { from: string; to: string }> = {
  coral: { from: '359 100% 70%', to: '358 84% 62%' },
  navy: { from: '224 55% 38%', to: '224 47% 25%' },
  violet: { from: '262 83% 68%', to: '262 68% 55%' },
  emerald: { from: '160 84% 48%', to: '160 80% 33%' },
};

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'chats', label: 'แชท', icon: <MessageCircle width={22} height={22} /> },
  { key: 'calls', label: 'สายเรียก', icon: <Phone width={22} height={22} /> },
  { key: 'settings', label: 'ตั้งค่า', icon: <Settings width={22} height={22} /> },
];

function Toast() {
  const { state } = useApp();
  if (!state.toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4 lg:bottom-8">
      <div className="slide-up max-w-sm rounded-2xl bg-foreground px-4 py-2.5 text-center text-sm font-medium text-background shadow-2xl">
        {state.toast}
      </div>
    </div>
  );
}

function EmptyChatPlaceholder() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-4 bg-chat lg:flex">
      <div className="relative">
        <TirakLogo size={84} className="opacity-90" />
        <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-background">
          <Lock width={14} height={14} className="text-white" strokeWidth={3} />
        </span>
      </div>
      <h2 className="font-display text-xl font-bold">Tirak Chat สำหรับเว็บ</h2>
      <p className="max-w-xs text-center text-sm text-muted-foreground">
        เลือกแชททางซ้ายเพื่อเริ่มสนทนา
      </p>
      <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-semibold">
          <Sparkles width={13} height={13} className="text-amber-500" /> ส่งไว
        </span>
        <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-semibold">
          <ShieldCheck width={13} height={13} className="text-emerald-500" /> ปลอดภัย
        </span>
        <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-semibold">
          <Lock width={13} height={13} className="text-rose-500" /> ไม่มีโฆษณา
        </span>
      </div>
    </div>
  );
}

function MainApp() {
  const { state, setTab, closeChat } = useApp();
  const activeChat = state.activeChatId ? state.chats[state.activeChatId] : null;

  const totalUnread = useMemo(
    () => Object.values(state.chats).reduce((a, c) => a + (c.muted || c.archived ? 0 : c.unreadCount), 0),
    [state.chats],
  );

  const bubble = BUBBLE_STYLES[state.settings.bubbleStyle] ?? BUBBLE_STYLES.coral;
  const style = {
    '--bubble-mine-from': bubble.from,
    '--bubble-mine-to': bubble.to,
  } as React.CSSProperties;

  return (
    <div className="flex h-full bg-background" style={style}>
      {/* ===== Desktop icon rail ===== */}
      <div className="gradient-navy hidden w-16 flex-col items-center py-4 lg:flex">
        <TirakLogo size={38} className="mb-6" />
        <div className="flex flex-1 flex-col gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key !== 'chats') closeChat(); }}
              title={t.label}
              className={cn(
                'relative flex h-11 w-11 items-center justify-center rounded-xl transition-all',
                state.activeTab === t.key ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white/80',
              )}
            >
              {t.icon}
              {t.key === 'chats' && totalUnread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white ring-2 ring-[hsl(224_47%_15%)]" style={{ height: 18, minWidth: 18 }}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          ))}
        </div>
        <Avatar name={state.profile.name} colorKey={state.profile.avatarColor} emoji={state.profile.avatarEmoji} size={38} className="cursor-pointer" />
      </div>

      {/* ===== Content ===== */}
      <div className="relative flex min-w-0 flex-1">
        {state.activeTab === 'chats' && (
          <>
            {/* Chat list column */}
            <div className={cn('h-full w-full lg:w-[380px] lg:shrink-0 lg:border-r', activeChat && 'hidden lg:block')}>
              <ChatListScreen />
            </div>
            {/* Chat detail column */}
            <div className={cn('h-full min-w-0 flex-1', !activeChat && 'hidden lg:flex')}>
              {activeChat ? <ChatScreen key={activeChat.id} chat={activeChat} /> : <EmptyChatPlaceholder />}
            </div>
          </>
        )}

        {state.activeTab === 'calls' && (
          <Suspense fallback={<ScreenLoader />}>
            <div className="h-full w-full flex-1 min-w-0"><CallsScreen /></div>
          </Suspense>
        )}
        {state.activeTab === 'settings' && (
          <Suspense fallback={<ScreenLoader />}>
            <div className="h-full w-full flex-1 min-w-0"><SettingsScreen /></div>
          </Suspense>
        )}
      </div>

      {/* ===== Mobile Spatial Floating Bottom Nav Pill (Figma Spec) ===== */}
      {!activeChat && (
        <div className="fixed inset-x-4 bottom-5 z-50 flex justify-center lg:hidden pointer-events-none">
          <div className="pointer-events-auto flex w-full max-w-sm items-center justify-around rounded-full bg-card/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-border/60 shadow-[0_12px_40px_rgba(0,0,0,0.22)] p-1.5">
            {TABS.map((t) => {
              const active = state.activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'relative flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all duration-300 active:scale-95',
                    active ? 'bg-foreground text-background shadow-md' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.icon}
                  <span className={cn('tracking-tight', active ? 'block' : 'hidden sm:block')}>{t.label}</span>
                  {t.key === 'chats' && totalUnread > 0 && (
                    <span className={cn(
                      "absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-[hsl(var(--coral))] px-1.5 text-[9px] font-extrabold text-white shadow-xs",
                      active ? "ring-2 ring-background" : "ring-2 ring-card"
                    )} style={{ height: 17, minWidth: 17 }}>
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Root() {
  const { state } = useApp();

  return (
    <div className="h-full w-full overflow-hidden">
      <Suspense fallback={<ScreenLoader />}>
        {state.phase === 'splash' && <SplashScreen />}
        {state.phase === 'welcome' && <WelcomeScreen />}
        {state.phase === 'login' && <LoginScreen />}
        {state.phase === 'otp' && <OtpScreen />}
        {state.phase === 'profile' && <ProfileSetupScreen />}
        {state.phase === 'pin-setup' && <PinSetupScreen />}
        {state.phase === 'locked' && <LockScreen />}
        {state.phase === 'app' && <MainApp />}
        <StoryViewer />
        <CallOverlay />
      </Suspense>
      <Toast />
      <InstallPrompt />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
