import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ShieldCheck, Phone, Video as Video, Mic as Mic, MicOff as MicOff, Volume2 as Volume2, Laptop as ScreenShare, Link, ChevronDown as ArrowDownLeft, ChevronUp as ArrowUpRight, PhoneOff as PhoneOff
} from 'lucide-react';
import { useApp, ME_ID } from '@/store/AppContext';
import { Avatar } from '@/components/shared/Brand';
import { formatClock, formatDuration, formatListTime } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { initJitsi, disposeJitsi, setAudioMuted, setVideoMuted, toggleScreenShare, generateSecureRoomName } from '@/lib/jitsi';
import type { JitsiStatus } from '@/lib/jitsi';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

/* ================= Calls Screen with 2-Column Master-Detail Layout ================= */
export function CallsScreen() {
  const { state, startCall, toast, openChat, createDirectChat } = useApp();
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [searchContact, setSearchContact] = useState('');

  const filteredCalls = state.calls.filter((c) => filter === 'all' || c.status === 'missed');
  const contacts = Object.values(state.users).filter((u) => u.isContact && !u.blocked && u.name.toLowerCase().includes(searchContact.toLowerCase()));

  const handleQuickDial = async (userId: string, type: 'voice' | 'video') => {
    const chatId = await createDirectChat(userId);
    startCall(chatId, type);
  };

  return (
    <div className="flex h-full w-full bg-card overflow-hidden">
      {/* Left Column: Call History List */}
      <div className="flex h-full w-full lg:w-[380px] lg:shrink-0 lg:border-r flex-col bg-card">
        <div className="apple-glass-header border-b px-5 pb-4 pt-4 shrink-0">
          <h1 className="font-display text-xl font-bold">สายเรียกและบันทึกการโทร</h1>
          <p className="text-xs text-muted-foreground">โทรเสียงและวิดีโอคอลกับผู้ติดต่อของคุณ</p>
        </div>

        {/* Filter Tabs & Call Link */}
        <div className="border-b px-4 py-3 bg-muted/20">
          <button
            onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/join/${generateSecureRoomName('call')}`); toast('คัดลอก Call Link แล้ว — ส่งให้เพื่อนเพื่อชวนเข้าสายได้ทันที'); }}
            className="flex w-full items-center gap-3 rounded-xl bg-card p-3 shadow-sm border hover:bg-muted/40 transition-colors"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coral-soft text-coral">
              <Link width={19} height={19} />
            </span>
            <div className="flex-1 text-left min-w-0">
              <div className="font-display text-sm font-semibold truncate">สร้าง Call Link (ลิงก์เชิญโทร)</div>
              <div className="text-xs text-muted-foreground truncate">แชร์ลิงก์เพื่อโทรคุยทันที ไม่ต้องมีบัญชี</div>
            </div>
          </button>

          <div className="flex gap-1.5 mt-3">
            <button
              onClick={() => setFilter('all')}
              className={cn('flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all', filter === 'all' ? 'bg-[hsl(var(--coral))] text-white shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70')}
            >
              ทั้งหมด ({state.calls.length})
            </button>
            <button
              onClick={() => setFilter('missed')}
              className={cn('flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all', filter === 'missed' ? 'bg-red-500 text-white shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70')}
            >
              ไม่ได้รับสาย ({state.calls.filter((c) => c.status === 'missed').length})
            </button>
          </div>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto pb-24 lg:pb-4">
          <div className="px-5 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">บันทึกการโทรล่าสุด</div>

          {filteredCalls.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Phone width={40} height={40} className="text-muted-foreground/40" />
              <p className="text-sm">{filter === 'missed' ? 'ไม่มีรายการสายที่ไม่ได้รับ' : 'ยังไม่มีประวัติสายเรียกเข้าออก'}</p>
            </div>
          )}

          {filteredCalls.map((call) => {
            const chat = state.chats[call.chatId];
            const name = chat?.name ?? 'ไม่ทราบชื่อ';
            const missed = call.status === 'missed';
            return (
              <div key={call.id} className="flex items-center gap-3.5 px-5 py-3.5 border-b border-border/40 hover:bg-muted/40 transition-colors">
                <button onClick={() => chat && openChat(chat.id)} className="shrink-0">
                  <Avatar name={name} colorKey={chat?.avatarColor ?? 'navy'} emoji={chat?.avatarEmoji} size={48} />
                </button>
                <button onClick={() => chat && openChat(chat.id)} className="min-w-0 flex-1 text-left">
                  <div className={cn('truncate font-display text-base font-semibold', missed && 'text-red-500')}>
                    {name}
                    {call.group && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground">กลุ่ม</span>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {call.direction === 'in'
                      ? <ArrowDownLeft width={14} height={14} className={missed ? 'text-red-500' : 'text-emerald-500'} />
                      : <ArrowUpRight width={14} height={14} className="text-sky-500" />}
                    <span>{missed ? 'ไม่ได้รับสาย' : call.status === 'declined' ? 'ถูกปฏิเสธ' : formatDuration(call.durationSecs)}</span>
                    <span className="text-muted-foreground/60">· {formatListTime(call.startedAt)}</span>
                  </div>
                </button>
                <button
                  onClick={() => chat && startCall(chat.id, call.type)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-coral transition-colors hover:bg-coral-soft shrink-0"
                  title="โทรกลับ"
                >
                  {call.type === 'video' ? <Video width={19} height={19} /> : <Phone width={18} height={18} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Quick Dial Table & System Dashboard (Desktop Only) */}
      <div className="hidden lg:flex flex-1 flex-col h-full bg-chat/20 overflow-y-auto p-6 xl:p-8">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {/* Section 1: Quick Dial Table */}
          <div className="rounded-2xl bg-card border shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">สมุดรายชื่อโทรด่วน (Quick Dial Table)</h2>
                <p className="text-xs text-muted-foreground">กดปุ่มโทรเสียงหรือวิดีโอ เพื่อสนทนากับผู้ติดต่อ</p>
              </div>
              <input
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                placeholder="🔍 ค้นหาชื่อเพื่อโทร..."
                className="h-9 w-60 rounded-xl border bg-muted px-3 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Structured Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="py-3 px-4">รายชื่อผู้ติดต่อ (Contact Profile)</th>
                    <th className="py-3 px-4">สถานะออนไลน์ (Status)</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4 text-right">คำสั่งโทรด่วน (Quick Dial)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {contacts.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} colorKey={u.avatarColor} emoji={u.avatarEmoji} size={38} online={u.online} showStatus />
                          <div>
                            <div className="font-bold text-foreground">{u.name}</div>
                            <div className="text-xs text-muted-foreground">{u.username || u.phone || '+66 8x xxx xxxx'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.online ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> ออนไลน์
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                            ออฟไลน์
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--coral))]">
                          <ShieldCheck width={14} height={14} className="inline mr-1" /> พร้อมโทร
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleQuickDial(u.id, 'voice')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-card border px-3 py-1.5 text-xs font-bold text-foreground shadow-sm hover:bg-muted transition-colors"
                            aria-label="โทร"
                          >
                            <Phone width={14} height={14} className="text-[hsl(var(--coral))]" /> โทรเสียง
                          </button>
                          <button
                            onClick={() => handleQuickDial(u.id, 'video')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--coral))] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
                            aria-label="วิดีโอคอล"
                          >
                            <Video width={14} height={14} /> โทรวิดีโอ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-muted-foreground">
                        ไม่พบรายชื่อผู้ติดต่อตามที่ค้นหา
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Call System Status */}
          <div className="rounded-2xl bg-card border shadow-sm p-6">
            <h3 className="font-display text-base font-bold text-foreground mb-1">สถานะระบบการโทร</h3>
            <p className="text-xs text-muted-foreground mb-4">ข้อมูลระบบสำหรับเซสชันของคุณ</p>
            <div className="rounded-xl border bg-emerald-500/10 p-4 text-center">
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">ระบบการโทร WebRTC — พร้อมใช้งาน</p>
              <p className="mt-1 text-xs text-muted-foreground">โทรเสียงและวิดีโอคอลผ่านสถาปัตยกรรม Peer-to-Peer คุณภาพสูง</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= Active call overlay ================= */
export function CallOverlay() {
  const { state, endCall } = useApp();
  const call = state.activeCall;
  const [phase, setPhase] = useState<'ringing' | 'talking'>('ringing');
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [videoOn, setVideoOn] = useState(true);
  const [jitsiStatus, setJitsiStatus] = useState<JitsiStatus>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const jitsiContainerRef = useRef<HTMLDivElement | null>(null);
  const jitsiApiRef = useRef<any>(null);
  const secsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chat = call ? state.chats[call.chatId] : undefined;
  const isVideo = call?.type === 'video';
  const hasCall = !!call;

  // Keep secsRef in sync
  secsRef.current = secs;

  // Reset state when a new call starts and listen to real Firestore signaling
  useEffect(() => {
    if (!call) return;
    setPhase('ringing'); setSecs(0); setMuted(false); setSpeaker(false);
    setVideoOn(call.type === 'video');
    setJitsiStatus('loading');
    setErrorMsg(null);

    if (!call.id) return;
    const unsub = onSnapshot(doc(db, 'active_calls', call.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'accepted') {
          setPhase('talking');
        } else if (data.status === 'ended' || data.status === 'declined') {
          endCall(false, secsRef.current);
        }
      } else {
        // Doc removed
        endCall(false, secsRef.current);
      }
    });
    return () => unsub();
  }, [call?.chatId, call?.type, call?.id]);

  // 45-second Ringing Timeout (`Orphan Call / Missed Call Cleanup`)
  useEffect(() => {
    if (!call || phase !== 'ringing') return;
    const timeoutId = setTimeout(() => {
      if (call.id) {
        updateDoc(doc(db, 'active_calls', call.id), { status: call.isCaller === false ? 'missed' : 'declined' }).catch(() => {});
      }
      endCall(false, 0);
    }, 45000);
    return () => clearTimeout(timeoutId);
  }, [call?.id, phase, call?.isCaller, endCall]);

  // Call duration timer — starts/stops with phase
  useEffect(() => {
    if (!call || phase !== 'talking') return;
    timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [hasCall, phase]);

  // Stop timer explicitly when call ends
  useEffect(() => {
    if (!hasCall && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [hasCall]);

  // Init Jitsi when phase becomes 'talking'
  useEffect(() => {
    if (!call || phase !== 'talking' || !call.jitsiRoom || !jitsiContainerRef.current) return;
    if (jitsiApiRef.current) return;

    const profileName = state.profile?.name;
    const displayName = profileName && profileName !== 'คุณ' ? profileName : 'Tirak User';

    initJitsi({
      roomName: call.jitsiRoom,
      container: jitsiContainerRef.current,
      type: call.type,
      displayName,
      onStatusChange: (s) => setJitsiStatus(s),
      onLeft: () => {
        disposeJitsi();
        jitsiApiRef.current = null;
        endCall(true, secsRef.current);
      },
      onError: (msg) => setErrorMsg(msg),
    }).then((api) => {
      if (api) jitsiApiRef.current = api;
    });

    return () => {
      disposeJitsi();
      jitsiApiRef.current = null;
    };
  }, [hasCall, phase]);

  // Sync mute/video to Jitsi — only when in an active call with a live instance
  useEffect(() => { if (hasCall && jitsiApiRef.current) setAudioMuted(muted); }, [muted, hasCall]);
  useEffect(() => { if (hasCall && isVideo && jitsiApiRef.current) setVideoMuted(!videoOn); }, [videoOn, hasCall, isVideo]);

  // Handle end call with correct duration via ref
  const handleEndCall = useCallback(() => {
    disposeJitsi();
    jitsiApiRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    endCall(phase === 'talking', secsRef.current);
  }, [phase, endCall]);

  if (!call || !chat) return null;
  const otherId = chat.memberIds.find((id) => id !== ME_ID);
  const other = otherId ? state.users[otherId] : undefined;

  // Incoming call sound effect (Web Audio API)
  useEffect(() => {
    if (phase !== 'ringing') return;
    let audioCtx: AudioContext | null = null;
    let interval: number | null = null;
    
    try {
      audioCtx = new AudioContext();
      const playBeep = () => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 440;
        osc.type = 'sine';
        gain.gain.value = 0.15;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.stop(audioCtx.currentTime + 0.5);
      };
      playBeep();
      interval = window.setInterval(playBeep, 1500);
    } catch { /* audio not supported */ }

    // Also vibrate on mobile
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (audioCtx) audioCtx.close();
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, [phase]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col fade-in">
      {/* Jitsi / call display area */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#1A2648,#0d1430)' }}>

        {/* Jitsi IFrame container */}
        <div
          ref={jitsiContainerRef}
          className={cn('absolute inset-0 z-0', phase === 'talking' && jitsiStatus === 'connected' ? 'block' : 'hidden')}
        />

        {/* Ringing UI */}
        {phase === 'ringing' && (
          <div className="relative flex flex-col items-center z-10">
            <div className="relative">
              <Avatar name={chat.name} colorKey={chat.avatarColor} emoji={chat.avatarEmoji} size={120} />
              <span className="pulse-ring absolute inset-0 rounded-full" />
            </div>
            <h2 className="font-display mt-5 text-2xl font-bold text-white drop-shadow">{chat.name}</h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/75">
              {call.isCaller === false ? <Phone width={14} height={14} className="animate-bounce" /> : <Phone width={14} height={14} className="animate-pulse" />}
              {call.isCaller === false ? 'มีสายเรียกเข้า...' : 'กำลังเรียก...'}
            </p>
            {call.group && other && (
              <p className="mt-1 text-xs text-white/60">กับ {chat.memberIds.length - 1} คนอื่น ๆ ในสายนี้</p>
            )}
          </div>
        )}

        {/* Loading / Connecting state */}
        {phase === 'talking' && jitsiStatus === 'loading' && (
          <div className="relative flex flex-col items-center z-10">
            <Avatar name={chat.name} colorKey={chat.avatarColor} emoji={chat.avatarEmoji} size={100} />
            <h2 className="font-display mt-5 text-xl font-bold text-white drop-shadow">{chat.name}</h2>
            <p className="mt-2 text-sm text-white/75 animate-pulse">กำลังเชื่อมต่อสัญญาณการโทร...</p>
          </div>
        )}

        {/* Reconnecting state */}
        {phase === 'talking' && jitsiStatus === 'reconnecting' && (
          <div className="absolute inset-x-0 top-4 z-20 flex justify-center">
            <div className="rounded-full bg-amber-500/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg animate-pulse">
              กำลังเชื่อมต่อใหม่...
            </div>
          </div>
        )}

        {/* Error state */}
        {phase === 'talking' && jitsiStatus === 'error' && (
          <div className="relative flex flex-col items-center z-10 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 mb-4">
              <PhoneOff width={28} height={28} className="text-red-400" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">{errorMsg || 'เกิดข้อผิดพลาด'}</h2>
            <p className="mt-2 text-sm text-white/60">กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่</p>
            <button
              onClick={handleEndCall}
              className="mt-6 rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
            >
              ปิดสาย
            </button>
          </div>
        )}

        {/* Connected — show timer overlay immediately when talking */}
        {phase === 'talking' && (
          <div className="absolute inset-x-0 top-4 z-10 flex justify-center pointer-events-none">
            <div className="rounded-full bg-black/40 px-4 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
              {formatClock(secs)}
            </div>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-4 bg-[#0d1430] px-6 py-6 z-10">
        {call.isCaller === false && phase === 'ringing' ? (
          <>
            <button
              onClick={() => {
                if (call.id) updateDoc(doc(db, 'active_calls', call.id), { status: 'accepted' }).catch(() => {});
              }}
              className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 transition-transform hover:scale-105 active:scale-95"
              title="รับสาย"
            >
              <Phone width={24} height={24} />
            </button>
            <button
              onClick={() => {
                if (call.id) updateDoc(doc(db, 'active_calls', call.id), { status: 'declined' }).catch(() => {});
                handleEndCall();
              }}
              className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40 transition-transform hover:scale-105 active:scale-95"
              title="ปฏิเสธ"
            >
              <PhoneOff width={24} height={24} />
            </button>
          </>
        ) : (
          <>
            <CtrlBtn active={muted} onClick={() => setMuted(!muted)} label={muted ? 'เปิดไมค์' : 'ปิดไมค์'} danger={muted}>
              {muted ? <MicOff width={21} height={21} /> : <Mic width={21} height={21} />}
            </CtrlBtn>
            <CtrlBtn active={speaker} onClick={() => { setSpeaker(!speaker); /* Speaker toggle is local UI only — Jitsi API doesn't expose setAudioOutput */ }} label="ลำโพง">
              <Volume2 width={21} height={21} />
            </CtrlBtn>
            {isVideo && (
              <CtrlBtn active={!videoOn} onClick={() => setVideoOn(!videoOn)} label={videoOn ? 'ปิดกล้อง' : 'เปิดกล้อง'} danger={!videoOn}>
                {videoOn ? <Video width={21} height={21} /> : <PhoneOff width={21} height={21} />}
              </CtrlBtn>
            )}
            <CtrlBtn active={false} onClick={toggleScreenShare} label="แชร์จอ">
              <ScreenShare width={21} height={21} />
            </CtrlBtn>
            <button
              onClick={() => {
                if (call.id) updateDoc(doc(db, 'active_calls', call.id), { status: 'ended' }).catch(() => {});
                handleEndCall();
              }}
              className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40 transition-transform hover:scale-105 active:scale-95"
              title="วางสาย"
            >
              <PhoneOff width={24} height={24} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CtrlBtn({ children, active, onClick, label, danger }: {
  children: React.ReactNode; active: boolean; onClick: () => void; label: string; danger?: boolean;
}) {
  return (
    <div className="flex w-16 flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        className={cn(
          'flex h-13 w-13 items-center justify-center rounded-full p-3.5 transition-all',
          danger ? 'bg-red-500/20 text-red-400' : active ? 'bg-white text-navy' : 'bg-white/12 text-white hover:bg-white/20',
        )}
      >
        {children}
      </button>
      <span className="text-xs text-white/60">{label}</span>
    </div>
  );
}
