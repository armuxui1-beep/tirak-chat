import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { TirakLogo } from '@/components/shared/Brand';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Never show if already installed
    if (localStorage.getItem('tirak_installed') === 'true') return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    if (isStandalone) return;

    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    const onInstalled = () => {
      localStorage.setItem('tirak_installed', 'true');
      setShow(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('tirak_installed', 'true');
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] slide-up">
      <div className="mx-auto max-w-md px-4 pb-4">
        <div className="rounded-2xl border bg-card p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <TirakLogo size={44} className="drop-shadow-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-sm font-bold text-foreground">
                ติดตั้งแอปพลิเคชัน Tirak Chat
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isIOS
                  ? 'กดปุ่มแชร์ด้านล่าง แล้วเลือก "เพิ่มไปยังหน้าจอหลัก"'
                  : 'ติดตั้งเพื่อเข้าถึงแชทได้ทันทีจากหน้าจอมือถือ'}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="ปิด"
            >
              <X width={18} height={18} />
            </button>
          </div>

          {!isIOS && (
            <button
              onClick={handleInstall}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--coral))] py-2.5 text-sm font-bold text-white hover:bg-[hsl(var(--coral-deep))] transition-colors"
            >
              <Download width={16} height={16} />
              ติดตั้งแอป
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
