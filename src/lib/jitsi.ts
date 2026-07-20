declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

let api: any = null;
let disposed = false;

export type JitsiStatus = 'loading' | 'connected' | 'error' | 'reconnecting';

export interface JitsiOptions {
  roomName: string;
  container: HTMLElement;
  type: 'voice' | 'video';
  displayName?: string;
  onStatusChange?: (status: JitsiStatus) => void;
  onLeft?: () => void;
  onError?: (msg: string) => void;
}

export function generateSecureRoomName(chatId: string): string {
  const raw = `tirak-${chatId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hash = (h >>> 0).toString(36);
  const suffix = crypto.getRandomValues(new Uint8Array(6));
  const b36 = Array.from(suffix, b => b.toString(36).padStart(2, '0')).join('');
  return `trk${hash}${b36}`;
}

export function isJitsiLoaded(): boolean {
  return typeof window.JitsiMeetExternalAPI === 'function';
}

export async function waitForJitsiApi(timeoutMs = 10000): Promise<boolean> {
  if (isJitsiLoaded()) return true;
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (isJitsiLoaded()) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(check, 200);
    };
    check();
  });
}

export async function initJitsi(opts: JitsiOptions): Promise<any> {
  disposed = false;
  opts.onStatusChange?.('loading');

  const loaded = await waitForJitsiApi();
  if (disposed) return null;

  if (!loaded) {
    const msg = 'ไม่สามารถโหลด Jitsi Meet SDK ได้ — ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
    opts.onError?.(msg);
    opts.onStatusChange?.('error');
    return null;
  }

  disposeJitsi();

  try {
    api = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: opts.roomName,
      parentNode: opts.container,
      width: '100%',
      height: '100%',
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: opts.type === 'voice',
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        hideConferenceSubject: true,
        hideConferenceTimer: false,
        enableLobbyChat: false,
        p2p: { enabled: true },
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        TOOLBAR_BUTTONS: [],
        FILM_STRIP_MAX_HEIGHT: 0,
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        DEFAULT_BACKGROUND: '#0d1430',
      },
      userInfo: {
        displayName: opts.displayName || 'Tirak User',
      },
    });

    api.addListener('videoConferenceJoined', () => {
      if (!disposed) opts.onStatusChange?.('connected');
    });

    api.addListener('videoConferenceLeft', () => {
      if (!disposed) opts.onLeft?.();
    });

    api.addListener('suspendDetected', () => {
      if (!disposed) opts.onStatusChange?.('reconnecting');
    });

    api.addListener('errorOccurred', (e: any) => {
      if (disposed) return;
      if (e?.error?.name === 'conference.connectionError' || e?.error?.name === 'conference.authenticationRequired') {
        opts.onStatusChange?.('reconnecting');
        opts.onError?.('การเชื่อมต่อขัดข้อง กำลังเชื่อมต่อใหม่...');
      }
    });

    return api;
  } catch (err) {
    const msg = 'เกิดข้อผิดพลาดในการเริ่มสาย — กรุณาลองใหม่';
    opts.onError?.(msg);
    opts.onStatusChange?.('error');
    return null;
  }
}

export function setAudioMuted(muted: boolean) {
  if (api) {
    try {
      api.isAudioMuted().then((currentlyMuted: boolean) => {
        if (currentlyMuted !== muted) api.executeCommand('toggleAudio');
      });
    } catch { api.executeCommand('toggleAudio'); }
  }
}

export function setVideoMuted(muted: boolean) {
  if (api) {
    try {
      api.isVideoMuted().then((currentlyMuted: boolean) => {
        if (currentlyMuted !== muted) api.executeCommand('toggleVideo');
      });
    } catch { api.executeCommand('toggleVideo'); }
  }
}

export function toggleScreenShare() {
  if (api) api.executeCommand('toggleShareScreen');
}

export function disposeJitsi() {
  disposed = true;
  if (api) {
    try { api.dispose(); } catch {}
    api = null;
  }
}
