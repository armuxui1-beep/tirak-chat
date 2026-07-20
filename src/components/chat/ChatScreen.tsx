import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, ChevronDown, Info, Lock, MoreVertical, Phone, Pin, Search, ShieldCheck, Timer, Video, X, File, MessageCircle, Eraser
} from 'lucide-react';
import type { Chat, ID, Message } from '@/types';
import { useApp, ME_ID } from '@/store/AppContext';
import { Avatar } from '@/components/shared/Brand';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ChatSettingsSheet } from './ChatSettings';
import { GRADIENTS } from '@/config/constants';
import { dateSeparatorLabel, disappearLabel, formatRelativeTime, formatTime } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ================= Forward modal ================= */
function ForwardModal({ msg, onClose }: { msg: Message | null; onClose: () => void }) {
  const { state, forwardMessage } = useApp();
  const [target, setTarget] = useState<ID | null>(null);
  if (!msg) return null;
  const chats = Object.values(state.chats).filter((c) => c.id !== msg.chatId && !c.archived);

  return (
    <Dialog open={!!msg} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="font-display">ส่งต่อข้อความไปยัง…</DialogTitle>
        </DialogHeader>
        <div className="thin-scroll max-h-72 overflow-y-auto px-2 pb-2">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => setTarget(c.id)}
              className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted', target === c.id && 'bg-coral-soft')}
            >
              <Avatar name={c.name} colorKey={c.avatarColor} emoji={c.avatarEmoji} size={40} />
              <span className="flex-1 truncate text-left text-sm font-medium">{c.name}</span>
              {target === c.id && <Check width={16} height={16} className="text-coral" strokeWidth={3} />}
            </button>
          ))}
        </div>
        <div className="border-t px-5 py-3 text-right">
          <button
            disabled={!target}
            onClick={() => { if (target) { forwardMessage(msg.chatId, msg.id, target); onClose(); } }}
            className="rounded-xl bg-[hsl(var(--coral))] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            ส่งต่อ
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Locked gate ================= */
function LockedGate({ chat }: { chat: Chat }) {
  const { state, unlockChat, toast } = useApp();
  const [pin, setPin] = useState('');
  const pinLen = state.settings.lockPin?.length ?? 4;

  useEffect(() => {
    if (pin.length === pinLen) {
      if (!state.settings.lockPin || pin === state.settings.lockPin) {
        unlockChat(chat.id);
      } else {
        toast('รหัส PIN ไม่ถูกต้อง');
        setPin('');
      }
    }
  }, [pin, pinLen, state.settings.lockPin, unlockChat, chat.id, toast]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-chat px-6">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-coral-soft">
        <Lock width={34} height={34} className="text-coral" />
      </span>
      <h3 className="font-display text-lg font-bold">แชทนี้ถูกล็อก</h3>
      <p className="text-center text-sm text-muted-foreground">ใส่รหัส PIN {pinLen} หลักเพื่อเปิดแชท "{chat.name}"</p>
      <div className="mt-2 flex gap-3">
        {Array.from({ length: pinLen }).map((_, i) => (
          <div key={i} className={cn('h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/40', i < pin.length && 'border-[hsl(var(--coral))] bg-[hsl(var(--coral))]')} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[1,2,3,4,5,6,7,8,9,'',0,'del'].map((k, i) => (
          <button
            key={i}
            disabled={k === ''}
            onClick={() => k === 'del' ? setPin((p) => p.slice(0, -1)) : k !== '' && setPin((p) => p + k)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-xl font-semibold shadow-sm transition-all hover:bg-muted active:scale-95 disabled:opacity-0"
          >
            {k === 'del' ? <Eraser width={24} height={24} /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================= Main screen ================= */
export function ChatScreen({ chat }: { chat: Chat }) {
  const { state, closeChat, startCall, patchChat, toast } = useApp();
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [pinnedIdx, setPinnedIdx] = useState(0);
  const [showEncBanner, setShowEncBanner] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = state.messages[chat.id] ?? [];
  const otherId = chat.memberIds.find((id) => id !== ME_ID);
  const other = otherId ? state.users[otherId] : undefined;
  const typingUserId = state.typing[chat.id];
  const typingUser = typingUserId ? state.users[typingUserId] : undefined;
  const isLocked = chat.locked && !state.unlockedChatIds.includes(chat.id);
  const isGroup = chat.type === 'group';
  const isSelf = chat.type === 'self';

  const visibleMessages = useMemo(() => {
    if (!searchQ.trim()) return messages;
    const q = searchQ.toLowerCase();
    return messages.filter((m) => (m.text ?? '').toLowerCase().includes(q));
  }, [messages, searchQ]);

  // auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUserId]);

  useEffect(() => {
    setReplyingTo(null); setEditingMsg(null); setShowSearch(false); setSearchQ(''); setShowEncBanner(true);
    bottomRef.current?.scrollIntoView();
  }, [chat.id]);

  const pinnedMessages = chat.pinnedMessageIds
    .map((id) => messages.find((m) => m.id === id))
    .filter((m): m is Message => !!m);

  const statusLine = () => {
    if (typingUser && state.settings.typingIndicators) {
      return <span className="font-medium text-[hsl(var(--coral))]">{isGroup ? `${typingUser.name.split(' ')[0]} กำลังพิมพ์...` : 'กำลังพิมพ์...'}</span>;
    }
    if (isSelf) return <span className="text-muted-foreground">พื้นที่ส่วนตัว</span>;
    if (isGroup) return <span className="text-muted-foreground">{chat.memberIds.length} สมาชิก</span>;
    if (other?.blocked) return <span className="text-red-500">ถูกบล็อก</span>;
    if (state.settings.onlineStatus && other?.online) return <span className="text-online font-medium">ออนไลน์</span>;
    if (other?.lastSeen) return <span className="text-muted-foreground">ออนไลน์ล่าสุด {formatRelativeTime(other.lastSeen)}</span>;
    return <span className="text-muted-foreground">ออฟไลน์</span>;
  };

  const wallpaper = chat.wallpaper;

  // group messages by day
  const rendered: React.ReactNode[] = [];
  let lastDay = '';
  visibleMessages.forEach((m, idx) => {
    const day = dateSeparatorLabel(m.createdAt);
    if (day !== lastDay) {
      rendered.push(
        <div key={`day-${m.id}`} className="my-3 flex justify-center">
          <span className="rounded-full bg-card/90 px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">{day}</span>
        </div>,
      );
      lastDay = day;
    }
    const prev = visibleMessages[idx - 1];
    const showSender = isGroup && m.senderId !== ME_ID && (!prev || prev.senderId !== m.senderId || prev.type === 'system');
    rendered.push(
      <MessageBubble
        key={m.id}
        msg={m}
        chat={chat}
        sender={state.users[m.senderId]}
        showSender={showSender}
        onReply={(mm) => { setReplyingTo(mm); setEditingMsg(null); }}
        onEdit={(mm) => { setEditingMsg(mm); setReplyingTo(null); }}
        onForward={(mm) => setForwardMsg(mm)}
      />,
    );
  });

  return (
    <div className="flex h-full flex-col bg-chat" style={wallpaper ? { background: GRADIENTS[wallpaper], backgroundBlendMode: 'soft-light' } : undefined}>
      {/* ===== Header ===== */}
      <div className="apple-glass-header z-10 flex items-center justify-between px-3 pt-3 sm:pt-2.5 pb-2 border-b border-border/40 min-h-[72px] sm:min-h-[64px]">
        <div className="flex items-center gap-1.5 w-1/4 shrink-0">
          <button onClick={closeChat} className="apple-btn-tactile flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted lg:hidden" title="ย้อนกลับ">
            <ArrowLeft width={18} height={18} />
          </button>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="apple-btn-tactile flex flex-col items-center justify-center rounded-2xl px-3 py-1 hover:bg-muted/50 transition-all active:scale-95 min-w-0 max-w-[50%] my-auto"
        >
          <div className="relative shrink-0">
            <Avatar name={chat.name} colorKey={chat.avatarColor} emoji={chat.avatarEmoji} size={38} online={other?.online} showStatus={!!other && !isGroup && state.settings.onlineStatus} />
          </div>
          <div className="flex items-center gap-1 mt-0.5 max-w-full">
            <span className="truncate font-display text-sm font-bold text-foreground leading-tight">{chat.name}</span>
            <ChevronDown width={13} height={13} className="text-muted-foreground shrink-0 -rotate-90" />
          </div>
          <div className="text-xs text-muted-foreground leading-none mt-0.5 truncate max-w-full">{statusLine()}</div>
        </button>

        <div className="flex items-center justify-end gap-1.5 w-1/4 shrink-0">
          {!isSelf && !other?.blocked && (
            <>
              <button onClick={() => startCall(chat.id, 'voice')} className="apple-btn-tactile flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-coral transition-colors hover:bg-coral-soft" title="โทรเสียง">
                <Phone width={17} height={17} />
              </button>
              <button onClick={() => startCall(chat.id, 'video')} className="apple-btn-tactile hidden h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-coral transition-colors hover:bg-coral-soft sm:flex" title="วิดีโอคอล">
                <Video width={18} height={18} />
              </button>
            </>
          )}
          <button onClick={() => setShowSearch((s) => !s)} className={cn('apple-btn-tactile flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 transition-colors hover:bg-muted', showSearch && 'bg-coral-soft text-coral')} title="ค้นหาในแชท">
            <Search width={17} height={17} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="apple-btn-tactile flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted"><MoreVertical width={17} height={17} /></button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setShowSettings(true)}><Info width={15} height={15} /> ข้อมูลแชท</DropdownMenuItem>
            <DropdownMenuItem onClick={() => patchChat(chat.id, { locked: true })}><Lock width={15} height={15} /> ล็อกแชทนี้</DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              const msgs = state.messages[chat.id] || [];
              if (msgs.length === 0) {
                toast('ไม่พบข้อความในประวัติการสนทนาเพื่อส่งออก');
                return;
              }
              const blob = new Blob([JSON.stringify(msgs, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `tirak-chat-history-${chat.id}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast('ส่งออกประวัติการสนทนาเป็นไฟล์ JSON เรียบร้อยแล้ว');
            }}>
              <ChevronDown width={15} height={15} /> ส่งออกประวัติ (JSON)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* ===== Search bar ===== */}
      {showSearch && (
        <div className="bg-header flex items-center gap-2 border-b px-4 py-2 slide-up">
          <Search width={16} height={16} className="text-muted-foreground" />
          <input
            autoFocus
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="ค้นหาข้อความในแชทนี้..."
            className="h-9 flex-1 rounded-lg bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQ && <span className="text-xs text-muted-foreground">{visibleMessages.length} ผลลัพธ์</span>}
          <button onClick={() => { setShowSearch(false); setSearchQ(''); }} className="rounded-full p-1.5 hover:bg-muted"><X width={16} height={16} /></button>
        </div>
      )}

      {/* ===== Pinned bar ===== */}
      {pinnedMessages.length > 0 && !isLocked && (
        <button
          onClick={() => setPinnedIdx((i) => (i + 1) % pinnedMessages.length)}
          className="bg-header/95 z-10 flex items-center gap-2.5 border-b px-4 py-2 text-left backdrop-blur"
        >
          <span className="flex h-8 w-1 flex-col gap-0.5 overflow-hidden rounded-full">
            {pinnedMessages.map((_, i) => (
              <span key={i} className={cn('flex-1', i === pinnedIdx % pinnedMessages.length ? 'bg-[hsl(var(--coral))]' : 'bg-muted-foreground/30')} />
            ))}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-xs font-bold text-coral"><Pin width={11} height={11} /> ข้อความที่ปักหมุด {pinnedMessages.length > 1 && `${(pinnedIdx % pinnedMessages.length) + 1}/${pinnedMessages.length}`}</div>
            <div className="truncate text-xs text-muted-foreground">
              {pinnedMessages[pinnedIdx % pinnedMessages.length]?.text || '[ไฟล์แนบ]'}
            </div>
          </div>
        </button>
      )}

      {/* ===== Body ===== */}
      {isLocked ? (
        <LockedGate chat={chat} />
      ) : (
        <>
          <div ref={scrollRef} className="thin-scroll flex-1 overflow-y-auto px-3 pb-2 pt-1 sm:px-6">
            {/* encryption banner */}
            {showEncBanner && (
              <div className="mx-auto my-3 flex max-w-md items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300 fade-in">
                <ShieldCheck width={17} height={17} className="mt-0.5 shrink-0" />
                <span className="flex-1">
                  ข้อความและสายเรียกในแชท "{chat.name}" ได้รับการเข้ารหัสแบบ <b>end-to-end</b> ด้วย Tirak Protocol — มีเพียงคุณและคู่สนทนาเท่านั้นที่อ่านข้อความนี้ได้
                </span>
                <button onClick={() => setShowEncBanner(false)} className="opacity-60 hover:opacity-100"><X width={14} height={14} /></button>
              </div>
            )}

            {/* disappearing notice */}
            {chat.disappearingSecs ? (
              <div className="mx-auto mb-3 flex w-fit items-center gap-1.5 rounded-full bg-muted px-3.5 py-1.5 text-xs text-muted-foreground">
                <Timer width={13} height={13} /> ข้อความหายเอง: {disappearLabel(chat.disappearingSecs)}
              </div>
            ) : null}

            {rendered}

            {visibleMessages.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                {isSelf ? (
                  <File width={40} height={40} className="text-muted-foreground/60" />
                ) : (
                  <MessageCircle width={40} height={40} className="text-muted-foreground/60" />
                )}
                <p className="text-sm">{searchQ ? 'ไม่พบข้อความที่ค้นหา' : isSelf ? 'เขียนบันทึกแรกของคุณสิ' : 'เริ่มการสนทนาเลย!'}</p>
              </div>
            )}

            {/* typing bubble */}
            {typingUser && state.settings.typingIndicators && (
              <div className="mb-2 flex items-center gap-2 msg-in">
                {isGroup && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                    {typingUser.name.charAt(0)}
                  </span>
                )}
                <div className="bubble-theirs flex items-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-1" />
          </div>

          {/* ===== Input ===== */}
          {other?.blocked ? (
            <div className="bg-header border-t px-4 py-4 text-center text-sm text-muted-foreground">
              คุณบล็อกผู้ใช้นี้อยู่ — ปลดบล็อกเพื่อส่งข้อความ
            </div>
          ) : (
            <MessageInput
              chat={chat}
              replyingTo={replyingTo}
              editingMsg={editingMsg}
              onCancelContext={() => { setReplyingTo(null); setEditingMsg(null); }}
            />
          )}
        </>
      )}

      <ForwardModal msg={forwardMsg} onClose={() => setForwardMsg(null)} />
      <ChatSettingsSheet chat={chat} open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
