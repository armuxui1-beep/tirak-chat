import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X as Cancel, BarChart3, Check, CheckCheck, Copy, Download, File, Share2, Pin as PinAlt, MoreHorizontal,
  Pencil, Phone, Pin, Play, Pause, Reply, Star, Timer, Trash2, Video, Eye, EyeOff, Image as MediaImageIcon,
} from 'lucide-react';
import type { Chat, Message, User } from '@/types';
import { useApp, ME_ID } from '@/store/AppContext';
import { formatDuration, formatTime, parseMarkdown } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const QUICK_REACTIONS = ['❤️', '👍', '😂', '🎉', '😮', '😢'];
const SENDER_COLORS = ['text-rose-500', 'text-sky-500', 'text-emerald-500', 'text-amber-500', 'text-violet-500', 'text-pink-500'];

function senderColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return SENDER_COLORS[h % SENDER_COLORS.length];
}

function RichText({ text, className }: { text: string; className?: string }) {
  const segs = useMemo(() => parseMarkdown(text), [text]);
  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {segs.map((s, i) => (
        <span
          key={i}
          className={cn(
            s.bold && 'font-bold',
            s.italic && 'italic',
            s.strike && 'line-through',
            s.code && 'rounded bg-black/15 px-1 py-0.5 font-mono text-[0.85em]',
          )}
        >
          {s.text}
        </span>
      ))}
    </span>
  );
}

/* ---------- Voice player ---------- */
function VoiceContent({ msg, mine }: { msg: Message; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dur = msg.duration ?? 5;

  const bars = useMemo(() => {
    if (msg.waveform && msg.waveform.length > 0) return msg.waveform;
    const arr: number[] = [];
    let h = 0x811c9dc5;
    for (let i = 0; i < msg.id.length; i++) { h = Math.imul(h ^ msg.id.charCodeAt(i), 0x01000193); }
    for (let i = 0; i < 26; i++) {
      h = Math.imul(h ^ i, 0x01000193);
      const val = 0.3 + ((Math.abs(h) % 70) / 100);
      arr.push(val);
    }
    return arr;
  }, [msg.waveform, msg.id]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggle = () => {
    const audioUrl = msg.mediaUrl || msg.url;
    if (playing) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlaying(false);
      return;
    }

    if (audioUrl) {
      if (!audioRef.current) {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.ontimeupdate = () => {
          if (audio.duration && !isNaN(audio.duration)) {
            setProgress(audio.currentTime / audio.duration);
          }
        };
        audio.onended = () => {
          setPlaying(false);
          setProgress(0);
        };
        audio.onerror = () => {
          setPlaying(false);
        };
      }
      audioRef.current.play().then(() => {
        setPlaying(true);
      }).catch(() => {
        setPlaying(false);
      });
    } else {
      // Fallback for non-url messages without fake timers
      setPlaying(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-2.5 rounded-full px-2 py-1 transition-all', mine ? 'bg-white/15' : 'bg-muted/70')}>
      <button
        onClick={toggle}
        className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 shadow-xs',
          mine ? 'bg-white text-[hsl(var(--coral))] font-bold' : 'bg-[hsl(var(--coral))] text-white font-bold')}
      >
        {playing ? <Pause width={15} height={15} /> : <Play width={15} height={15} className="ml-0.5" />}
      </button>
      <div className="flex h-7 items-center gap-[2.5px] px-1">
        {bars.map((h, i) => {
          const active = playing && i / bars.length <= progress;
          return (
            <span
              key={i}
              className={cn('w-[2.5px] rounded-full transition-colors',
                playing && active ? (mine ? 'bg-white' : 'bg-[hsl(var(--coral))]') : (mine ? 'bg-white/45' : 'bg-foreground/25'))}
              style={{ height: `${Math.max(18, h * 100)}%` }}
            />
          );
        })}
      </div>
      <span className={cn('text-xs font-semibold tabular-nums pr-1.5', mine ? 'text-white/90' : 'text-muted-foreground')}>
        {formatDuration(dur)}
      </span>
    </div>
  );
}

/* ---------- Poll ---------- */
function PollContent({ msg, mine }: { msg: Message; mine: boolean }) {
  const { votePoll } = useApp();
  const poll = msg.poll;
  if (!poll) return null;
  const total = poll.options.reduce((a, o) => a + o.votes.length, 0);

  return (
    <div className="min-w-56">
      <div className="flex items-start gap-2">
        <BarChart3 width={17} height={17} className={cn('mt-0.5 shrink-0', mine ? 'text-white/90' : 'text-[hsl(var(--coral))]')} />
        <div className="font-semibold leading-snug">{poll.question}</div>
      </div>
      <div className={cn('mt-1 text-xs', mine ? 'text-white/70' : 'text-muted-foreground')}>
        {total} โหวต {poll.multiple ? '· เลือกได้หลายข้อ' : ''}
      </div>
      <div className="mt-2.5 space-y-1.5">
        {poll.options.map((o) => {
          const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
          const mine2 = o.votes.includes(ME_ID);
          return (
            <button
              key={o.id}
              onClick={() => votePoll(msg.chatId, msg.id, o.id)}
              className={cn('relative w-full overflow-hidden rounded-xl px-3 py-2 text-left text-sm transition-all',
                mine ? 'bg-white/15 hover:bg-white/20' : 'bg-muted hover:bg-muted/70',
                mine2 && (mine ? 'ring-1 ring-white' : 'ring-1 ring-[hsl(var(--coral))]'))}
            >
              <span
                className={cn('absolute inset-y-0 left-0 transition-all duration-500',
                  mine ? 'bg-white/20' : 'bg-[hsl(var(--coral)/0.18)]')}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {mine2 && <Check width={14} height={14} className={mine ? 'text-white' : 'text-[hsl(var(--coral))]'} strokeWidth={3} />}
                  {o.text}
                </span>
                <span className={cn('text-xs tabular-nums', mine ? 'text-white/80' : 'text-muted-foreground')}>
                  {o.votes.length > 0 && `${pct}%`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Bubble ---------- */
interface Props {
  msg: Message;
  chat: Chat;
  sender?: User;
  showSender: boolean;
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  onForward: (m: Message) => void;
}

export function MessageBubble({ msg, chat, sender, showSender, onReply, onEdit, onForward }: Props) {
  const { state, toggleReaction, toggleStar, deleteMessage, pinMessage, unpinMessage, markViewOnceOpened, toast } = useApp();
  const [lightbox, setLightbox] = useState(false);
  const [viewOnceOpen, setViewOnceOpen] = useState(false);

  const mine = msg.senderId === ME_ID;
  const isGroup = chat.type === 'group';
  const replyTo = msg.replyToId ? (state.messages[chat.id] ?? []).find((m) => m.id === msg.replyToId) : undefined;
  const replySender = replyTo ? (replyTo.senderId === ME_ID ? 'คุณ' : state.users[replyTo.senderId]?.name ?? '') : '';
  const pinned = chat.pinnedMessageIds.includes(msg.id);

  if (msg.type === 'system') {
    return (
      <div className="my-2 flex justify-center msg-in">
        <span className="rounded-full bg-muted px-3.5 py-1.5 text-center text-xs text-muted-foreground">{msg.text}</span>
      </div>
    );
  }

  const downloadAttachment = (_name: string) => {
    const targetUrl = msg.mediaUrl || msg.url;
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    } else {
      toast('⚠️ ไฟล์ยังไม่ได้อัปโหลดสู่ระบบคลาวด์');
    }
  };

  const downloadGradientImage = (name: string, gradientStr: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 800, 600);
      const colors = gradientStr.match(/#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|hsl\([^)]+\)/g) || ['#64748b', '#0f172a'];
      if (colors.length >= 2) {
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(1, colors[colors.length - 1]);
      } else {
        grad.addColorStop(0, '#64748b');
        grad.addColorStop(1, '#0f172a');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TIRAK CHAT SECURED MEDIA', 400, 300);
    }
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = name.endsWith('.png') || name.endsWith('.jpg') ? name : `${name}.png`;
    a.click();
    toast('บันทึกรูปภาพเข้าระบบเรียบร้อยแล้ว');
  };

  const statusTicks = mine && (
    <span className="inline-flex items-center">
      {msg.status === 'sending' && <Timer width={12} height={12} className="text-white/70" />}
      {msg.status === 'sent' && <Check width={13} height={13} className="text-white/80" />}
      {msg.status === 'delivered' && <CheckCheck width={13} height={13} className="text-white/80" />}
      {msg.status === 'read' && <CheckCheck width={13} height={13} className="text-white" />}
    </span>
  );

  const timeRow = (
    <span className={cn('float-right ml-2 mt-1 inline-flex translate-y-1 items-center gap-1 text-xs tabular-nums',
      mine ? 'text-white/75' : 'text-muted-foreground')}>
      {msg.starred && <Star width={10} height={10} className="fill-current" />}
      {msg.edited && !msg.deletedForEveryone && 'แก้ไขแล้ว'}
      {formatTime(msg.createdAt)}
      {statusTicks}
    </span>
  );

  let content: React.ReactNode = null;

  if (msg.deletedForEveryone) {
    content = (
      <span className={cn('flex items-center gap-2 italic', mine ? 'text-white/80' : 'text-muted-foreground')}>
        <Cancel width={14} height={14} /> ข้อความนี้ถูกลบแล้ว
      </span>
    );
  } else if (msg.type === 'text' || msg.type === 'location') {
    content = (
      <>
        {msg.type === 'location' && (
          <div className="mb-1.5 flex h-28 w-56 items-center justify-center rounded-xl text-4xl"
            style={{ background: 'linear-gradient(160deg,#a8e063,#56ab2f)' }}>
            <PinAlt width={36} height={36} className="text-white drop-shadow" />
          </div>
        )}
        <RichText text={msg.text ?? ''} />
        {timeRow}
      </>
    );
  } else if (msg.type === 'image') {
    const locked = msg.viewOnce && !msg.viewed && !viewOnceOpen && !mine;
    const opened = msg.viewOnce && msg.viewed;
    content = (
      <div>
        <button
          disabled={opened}
          onClick={() => {
            if (locked) {
              setViewOnceOpen(true);
              markViewOnceOpened(msg.id);
            } else {
              setLightbox(true);
            }
          }}
          className={cn(
            "relative block h-40 w-64 max-w-full overflow-hidden rounded-xl",
            opened && "cursor-default opacity-80"
          )}
          style={{ background: opened ? 'hsl(var(--muted))' : (msg.mediaGradient ?? 'linear-gradient(135deg,#64748b,#0f172a)') }}
        >
          {opened ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <EyeOff width={26} height={26} />
              <span className="text-sm font-semibold">เปิดดูแล้ว</span>
            </span>
          ) : locked ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-navy/90 text-white backdrop-blur">
              <Eye width={26} height={26} />
              <span className="text-sm font-semibold">รูปดูได้ครั้งเดียว</span>
              <span className="text-xs text-white/60">แตะเพื่อเปิดดู</span>
            </span>
          ) : (
            <>
              <span className="absolute inset-0 flex items-center justify-center text-coral/80 drop-shadow-lg"><MediaImageIcon width={48} height={48} /></span>
              {msg.viewOnce && (
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white">
                  <Timer width={12} height={12} /> 1 ครั้ง
                </span>
              )}
            </>
          )}
        </button>
        {msg.text && <div className="mt-1.5"><RichText text={msg.text} /></div>}
        {timeRow}
      </div>
    );
  } else if (msg.type === 'video') {
    content = (
      <div>
        <div className="relative block w-64 max-w-full overflow-hidden rounded-xl bg-black/60 shadow-md border border-white/10">
          <video src={msg.mediaUrl || msg.url} controls playsInline className="max-h-60 w-full object-contain rounded-xl" />
        </div>
        {msg.text && <div className="mt-1.5"><RichText text={msg.text} /></div>}
        {timeRow}
      </div>
    );
  } else if (msg.type === 'voice') {
    content = <div><VoiceContent msg={msg} mine={mine} />{timeRow}</div>;
  } else if (msg.type === 'file') {
    content = (
      <div>
        <div className={cn('flex items-center gap-3 rounded-xl p-2.5', mine ? 'bg-white/15' : 'bg-muted')}>
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', mine ? 'bg-white/20 text-white' : 'bg-coral-soft text-coral')}>
            <File width={20} height={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{msg.mediaName}</div>
            <div className={cn('text-xs', mine ? 'text-white/70' : 'text-muted-foreground')}>{msg.mediaSize}</div>
          </div>
          <button onClick={() => downloadAttachment(msg.mediaName || 'secured-file.bin')} className={mine ? 'text-white/85' : 'text-muted-foreground'}>
            <Download width={18} height={18} />
          </button>
        </div>
        {msg.text && <div className="mt-1.5"><RichText text={msg.text} /></div>}
        {timeRow}
      </div>
    );
  } else if (msg.type === 'poll') {
    content = <div><PollContent msg={msg} mine={mine} />{timeRow}</div>;
  } else if (msg.type === 'call') {
    const missed = msg.callStatus === 'missed';
    content = (
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-full',
          missed ? 'bg-red-500/15 text-red-500' : mine ? 'bg-white/20 text-white' : 'bg-coral-soft text-coral')}>
          {msg.callType === 'video' ? <Video width={18} height={18} /> : <Phone width={18} height={18} />}
        </span>
        <div>
          <div className={cn('text-sm font-semibold', missed && 'text-red-500')}>
            {missed ? 'สายที่ไม่ได้รับ' : msg.callType === 'video' ? 'วิดีโอคอล' : 'สายเรียกเสียง'}
          </div>
          <div className={cn('text-xs', mine ? 'text-white/70' : 'text-muted-foreground')}>
            {msg.duration ? formatDuration(msg.duration) : ''} {timeRow}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group relative mb-1 flex w-full msg-in', mine ? 'justify-end' : 'justify-start')}>
      {/* avatar for group others */}
      {isGroup && !mine && (
        <div className="mr-2 w-7 shrink-0 self-end">
          {showSender && sender && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: `hsl(${parseInt(sender.id.replace(/\D/g, '') || '5') * 47 % 360} 60% 55%)` }}>
              {sender.name.charAt(0)}
            </span>
          )}
        </div>
      )}

      <div className={cn('relative max-w-[80%] sm:max-w-[70%] lg:max-w-[62%]')}>
        {msg.forwarded && <div className={cn('mb-0.5 flex items-center gap-1 text-xs italic', mine ? 'justify-end text-muted-foreground' : 'text-muted-foreground')}><Share2 width={11} height={11} /> ส่งต่อมา</div>}
        <div
          className={cn(
            'relative rounded-2xl px-3.5 py-2.5 text-base leading-relaxed shadow-sm transition-all',
            mine ? 'bubble-mine rounded-br-[4px]' : 'bubble-theirs rounded-bl-[4px]',
          )}
        >
          {/* sender name in group */}
          {isGroup && !mine && showSender && sender && (
            <div className={cn('mb-0.5 text-xs font-bold', senderColor(sender.id))}>{sender.name}</div>
          )}

          {/* reply quote */}
          {replyTo && !msg.deletedForEveryone && (
            <div className={cn('mb-1.5 cursor-pointer rounded-lg border-l-[3px] px-2.5 py-1.5 text-xs',
              mine ? 'border-white/70 bg-white/15 text-white/90' : 'border-[hsl(var(--coral))] bg-[hsl(var(--coral)/0.08)]')}>
              <div className={cn('font-semibold', !mine && 'text-[hsl(var(--coral))]')}>{replySender}</div>
              <div className="truncate opacity-80">
                {replyTo.type === 'text' ? replyTo.text : replyTo.type === 'image' ? '📷 รูปภาพ' : replyTo.type === 'voice' ? '🎤 เสียง' : replyTo.type === 'poll' ? '📊 โพล' : 'ข้อความ'}
              </div>
            </div>
          )}

          {content}

          {/* hover toolbar */}
          {!msg.deletedForEveryone && (
            <div className={cn(
              'absolute -top-9 z-10 hidden items-center gap-0.5 rounded-full border bg-popover px-1.5 py-1 shadow-lg group-hover:flex',
              mine ? 'right-2' : 'left-2',
            )}>
              {QUICK_REACTIONS.slice(0, 4).map((e) => (
                <button key={e} onClick={() => toggleReaction(chat.id, msg.id, e)} className="rounded-full px-1 text-base transition-transform hover:scale-125">{e}</button>
              ))}
              <span className="mx-0.5 h-4 w-px bg-border" />
              <button onClick={() => onReply(msg)} className="rounded-full p-1 hover:bg-muted" title="ตอบกลับ"><Reply width={14} height={14} /></button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full p-1 hover:bg-muted"><MoreHorizontal width={14} height={14} /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={mine ? 'end' : 'start'} className="w-52">
                  {QUICK_REACTIONS.map((e) => (
                    <DropdownMenuItem key={e} onClick={() => toggleReaction(chat.id, msg.id, e)} className="gap-3">
                      <span className="text-base">{e}</span> แสดงความรู้สึก {e}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => toggleStar(chat.id, msg.id)}>
                    <Star width={15} height={15} className={msg.starred ? 'fill-amber-400 text-amber-400' : ''} /> {msg.starred ? 'เลิกติดดาว' : 'ติดดาวข้อความ'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => pinned ? unpinMessage(chat.id, msg.id) : pinMessage(chat.id, msg.id)}>
                    <Pin width={15} height={15} /> {pinned ? 'เลิกปักหมุด' : 'ปักหมุดไว้บนแชท'}
                  </DropdownMenuItem>
                  {msg.type === 'text' && (
                    <DropdownMenuItem onClick={() => { navigator.clipboard?.writeText(msg.text ?? ''); toast('คัดลอกแล้ว'); }}>
                      <Copy width={15} height={15} /> คัดลอก
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onForward(msg)}><Share2 width={15} height={15} /> ส่งต่อ</DropdownMenuItem>
                  {mine && msg.type === 'text' && (
                    <DropdownMenuItem onClick={() => onEdit(msg)}><Pencil width={15} height={15} /> แก้ไขข้อความ</DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => deleteMessage(chat.id, msg.id, false)}><Trash2 width={15} height={15} /> ลบสำหรับฉัน</DropdownMenuItem>
                  {mine && (
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteMessage(chat.id, msg.id, true)}>
                      <Trash2 width={15} height={15} /> ลบสำหรับทุกคน
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* reactions */}
        {msg.reactions.length > 0 && !msg.deletedForEveryone && (
          <div className={cn('mt-[-8px] flex gap-1', mine ? 'justify-end' : 'justify-start')}>
            <div className="flex gap-0.5 rounded-full border bg-popover px-1.5 py-0.5 shadow-sm">
              {msg.reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => toggleReaction(chat.id, msg.id, r.emoji)}
                  className={cn('flex items-center gap-0.5 rounded-full px-1 text-sm transition-transform hover:scale-110',
                    r.userIds.includes(ME_ID) && 'bg-coral-soft')}
                >
                  {r.emoji}
                  {r.userIds.length > 1 && <span className="text-xs font-semibold text-muted-foreground">{r.userIds.length}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* lightbox */}
      <Dialog open={lightbox} onOpenChange={setLightbox}>
        <DialogContent className="max-w-lg border-none bg-transparent p-0 shadow-none">
          <div className="flex h-80 w-full items-center justify-center rounded-2xl text-8xl"
            style={{ background: msg.mediaGradient ?? 'linear-gradient(135deg,#64748b,#0f172a)' }}>
            🖼️
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-white">
            <span>{msg.mediaName}</span>
            <button onClick={() => downloadGradientImage(msg.mediaName || 'tirak-image.png', msg.mediaGradient || 'linear-gradient(135deg,#64748b,#0f172a)')} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
              <Download width={14} height={14} /> บันทึก
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
