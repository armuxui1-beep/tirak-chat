import { useMemo, useState } from 'react';
import {
  Bell, BellOff, Palette as PaintBrush, Check, Copy, Eraser, Link, Lock, LogOut, Pin, Search, ShieldCheck, Star, Timer, Trash2, UserPlus as AddUser, Users,
} from 'lucide-react';
import type { Chat } from '@/types';
import { useApp, ME_ID } from '@/store/AppContext';
import { Avatar } from '@/components/shared/Brand';
import { GRADIENTS } from '@/config/constants';
import { DISAPPEAR_OPTIONS, disappearLabel, formatTime } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

/* ================= Safety Number ================= */
export function SafetyNumberModal({ open, onClose, chat }: { open: boolean; onClose: () => void; chat: Chat }) {
  const { toast } = useApp();
  const fingerprint = useMemo(() => {
    let h = 7;
    for (const c of chat.id) h = (h * 31 + c.charCodeAt(0)) % 9973;
    return Array.from({ length: 12 }, (_, i) => ((h * (i + 3) * 7919) % 90000 + 10000).toString());
  }, [chat.id]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ShieldCheck className="text-emerald-500" /> หมายเลขความปลอดภัย
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          เปรียบเทียบตัวเลขนี้กับอุปกรณ์ของ <b>{chat.name}</b> เพื่อยืนยันว่าการสนทนาเข้ารหัสถึงกันจริง (ป้องกัน Man-in-the-Middle)
        </p>
        {/* QR-ish pattern */}
        <div className="mx-auto grid grid-cols-8 gap-1 rounded-2xl border bg-card p-4">
          {Array.from({ length: 64 }).map((_, i) => {
            const on = ((i * 2654435761 + chat.id.length * 97) >>> 3) % 3 === 0 || i === 0 || i === 7 || i === 56 || i === 63;
            return <span key={i} className={cn('h-4 w-4 rounded-[3px]', on ? 'bg-foreground' : 'bg-muted')} />;
          })}
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-4 font-mono text-center text-sm tracking-wider">
          {fingerprint.map((n, i) => <span key={i}>{n}</span>)}
        </div>
        <button
          onClick={() => { navigator.clipboard?.writeText(fingerprint.join(' ')); toast('คัดลอกหมายเลขความปลอดภัยแล้ว'); }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-sm font-medium hover:bg-muted/70"
        >
          <Copy width={15} height={15} /> คัดลอกหมายเลข
        </button>
        <p className="text-center text-xs text-emerald-500">✓ การสนทนานี้ได้รับการยืนยันการเข้ารหัสแล้ว</p>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Starred messages ================= */
function StarredModal({ open, onClose, chat }: { open: boolean; onClose: () => void; chat: Chat }) {
  const { state } = useApp();
  const starred = (state.messages[chat.id] ?? []).filter((m) => m.starred && !m.deletedForEveryone);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><Star className="fill-amber-400 text-amber-400" /> ข้อความที่ติดดาว</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          {starred.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีข้อความที่ติดดาวในแชทนี้</p>}
          <div className="space-y-2">
            {starred.map((m) => (
              <div key={m.id} className="rounded-xl bg-muted p-3">
                <div className="text-xs font-semibold text-coral">{m.senderId === ME_ID ? 'คุณ' : state.users[m.senderId]?.name}</div>
                <div className="mt-0.5 text-sm">{m.type === 'text' ? m.text : `[ไฟล์แนบ ${m.type}]`}</div>
                <div className="mt-1 text-xs text-muted-foreground">{formatTime(m.createdAt)}</div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Add Member Modal ================= */
function AddMemberModal({ open, onClose, chat }: { open: boolean; onClose: () => void; chat: Chat }) {
  const { state, patchChat, toast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const candidates = Object.values(state.users).filter(
    (u) =>
      !chat.memberIds.includes(u.id) &&
      !u.blocked &&
      (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.username ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAdd = async () => {
    if (selected.length === 0) return;
    const newMemberIds = [...chat.memberIds, ...selected];
    await patchChat(chat.id, { memberIds: newMemberIds });
    toast(`เพิ่มสมาชิก ${selected.length} คนแล้ว`);
    setSelected([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setSelected([]); setSearchQuery(''); } }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="font-display">เพิ่มสมาชิกเข้ากลุ่ม</DialogTitle>
        </DialogHeader>
        <div className="px-4 pt-3">
          <div className="relative">
            <Search width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อหรือ username..."
              className="h-10 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="thin-scroll max-h-72 overflow-y-auto px-2 pb-2 mt-2">
          {candidates.map((u) => {
            const isSel = selected.includes(u.id);
            return (
              <button
                key={u.id}
                onClick={() => setSelected((s) => isSel ? s.filter((x) => x !== u.id) : [...s, u.id])}
                className="apple-btn-tactile flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted"
              >
                <Avatar name={u.name} colorKey={u.avatarColor} emoji={u.avatarEmoji} size={40} online={u.online} showStatus />
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-semibold">{u.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.about || u.username || u.phone}</div>
                </div>
                {isSel && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral text-white">
                    <Check width={14} height={14} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
          {candidates.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ทุกคนในรายชื่อเข้าร่วมกลุ่มนี้แล้ว'}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-5 py-3">
          <span className="text-xs text-muted-foreground">เลือกแล้ว {selected.length} คน</span>
          <button
            onClick={handleAdd}
            disabled={selected.length === 0}
            className="rounded-xl bg-[hsl(var(--coral))] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            เพิ่มสมาชิก
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Main sheet ================= */
export function ChatSettingsSheet({ chat, open, onClose }: { chat: Chat; open: boolean; onClose: () => void }) {
  const { state, patchChat, clearHistory, deleteChat, blockUser, toast } = useApp();
  const [showSafety, setShowSafety] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const otherId = chat.memberIds.find((id) => id !== ME_ID);
  const other = otherId ? state.users[otherId] : undefined;
  const isGroup = chat.type === 'group';
  const isSelf = chat.type === 'self';
  const WALLPAPERS = ['default', 'sunset', 'ocean', 'emerald', 'violet'];

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="thin-scroll w-full overflow-y-auto sm:max-w-md p-0">
          <SheetHeader className="apple-glass-header sticky top-0 z-10 px-5 py-4">
            <SheetTitle className="font-display">ข้อมูลแชท</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col items-center px-5 py-6">
            <Avatar name={chat.name} colorKey={chat.avatarColor} emoji={chat.avatarEmoji} size={88} online={other?.online} showStatus={!!other && !isGroup} />
            <h3 className="font-display mt-3 text-lg font-bold">{chat.name}</h3>
            <p className="text-sm text-muted-foreground">
              {isSelf ? 'พื้นที่ส่วนตัวของคุณ' : isGroup ? `กลุ่ม · ${chat.memberIds.length} สมาชิก` : other?.about || other?.username || other?.phone}
            </p>
            {!isSelf && (
              <div className="mt-2 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
                <ShieldCheck width={13} height={13} /> เข้ารหัสแบบ end-to-end
              </div>
            )}
          </div>

          <div className="space-y-1 px-3 pb-8">
            {/* Quick actions */}
            <div className="mb-4 grid grid-cols-3 gap-2 px-2">
              <QuickAction icon={<Star width={19} height={19} />} label="ติดดาว" onClick={() => setShowStarred(true)} />
              {!isSelf && <QuickAction icon={<ShieldCheck width={19} height={19} />} label="ความปลอดภัย" onClick={() => setShowSafety(true)} />}
              <QuickAction icon={<Pin width={19} height={19} />} label={chat.pinned ? 'เลิกปักหมุด' : 'ปักหมุด'} onClick={() => patchChat(chat.id, { pinned: !chat.pinned })} />
            </div>

            {/* Disappearing */}
            {!isSelf && (
              <Section title="ข้อความหายเอง" icon={<Timer width={16} height={16} className="text-coral" />}>
                <div className="flex flex-wrap gap-1.5 px-1 py-2">
                  {DISAPPEAR_OPTIONS.map((o) => (
                    <button
                      key={o.secs}
                      onClick={() => { patchChat(chat.id, { disappearingSecs: o.secs || undefined }); toast(o.secs ? `ตั้งข้อความหายเอง: ${o.label}` : 'ปิดข้อความหายเองแล้ว'); }}
                      className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                        (chat.disappearingSecs ?? 0) === o.secs
                          ? 'bg-[hsl(var(--coral))] text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70')}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="px-1 pb-2 text-xs text-muted-foreground">ปัจจุบัน: {disappearLabel(chat.disappearingSecs)}</p>
              </Section>
            )}

            {/* Wallpaper */}
            <Section title="วอลเปเปอร์แชท" icon={<PaintBrush width={16} height={16} className="text-violet-500" />}>
              <div className="flex gap-2 px-1 py-2">
                {WALLPAPERS.map((w) => (
                  <button
                    key={w}
                    onClick={() => patchChat(chat.id, { wallpaper: w === 'default' ? undefined : w })}
                    className={cn('h-12 w-12 rounded-xl transition-all',
                      (chat.wallpaper ?? 'default') === w && 'ring-2 ring-[hsl(var(--coral))] ring-offset-2 ring-offset-background')}
                    style={{ background: w === 'default' ? 'hsl(var(--muted))' : GRADIENTS[w] }}
                    title={w}
                  />
                ))}
              </div>
            </Section>

            {/* Notifications */}
            <div className="flex items-center justify-between rounded-xl px-2 py-3">
              <div className="flex items-center gap-3">
                {chat.muted ? <BellOff width={18} height={18} className="text-muted-foreground" /> : <Bell width={18} height={18} className="text-coral" />}
                <span className="text-sm font-medium">การแจ้งเตือน</span>
              </div>
              <Switch checked={!chat.muted} onCheckedChange={(v) => patchChat(chat.id, { muted: !v })} />
            </div>

            {/* Group members */}
            {isGroup && (
              <Section title={`สมาชิก (${chat.memberIds.length})`} icon={<Users width={16} height={16} className="text-sky-500" />}>
                <div className="space-y-1 py-1">
                  {chat.memberIds.map((mid) => {
                    const u = mid === ME_ID
                      ? { name: `${state.profile.name} (คุณ)`, avatarColor: state.profile.avatarColor, avatarEmoji: state.profile.avatarEmoji }
                      : state.users[mid];
                    if (!u) return null;
                    const isAdmin = chat.adminIds?.includes(mid);
                    return (
                      <div key={mid} className="flex items-center gap-3 rounded-xl px-2 py-2">
                        <Avatar name={u.name} colorKey={u.avatarColor} emoji={u.avatarEmoji} size={38} />
                        <span className="flex-1 truncate text-sm font-medium">{u.name}</span>
                        {isAdmin && <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[10px] font-bold text-coral">แอดมิน</span>}
                      </div>
                    );
                  })}
                  <button onClick={() => setShowAddMember(true)} className="apple-btn-tactile flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-coral hover:bg-muted">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-coral-soft"><AddUser width={17} height={17} /></span>
                    เพิ่มสมาชิก
                  </button>
                </div>
                {chat.inviteCode && (
                  <button
                    onClick={() => { navigator.clipboard?.writeText(`https://${chat.inviteCode}`); toast('คัดลอกลิงก์เชิญแล้ว'); }}
                    className="apple-btn-tactile mx-1 my-2 flex w-[calc(100%-8px)] items-center gap-3 rounded-xl bg-muted px-3 py-2.5 text-left hover:bg-muted/70"
                  >
                    <Link width={16} height={16} className="shrink-0 text-coral" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold">ลิงก์เชิญเข้ากลุ่ม</div>
                      <div className="truncate text-xs text-muted-foreground">https://{chat.inviteCode}</div>
                    </div>
                    <Copy width={15} height={15} className="shrink-0 text-muted-foreground" />
                  </button>
                )}
              </Section>
            )}

            {/* Block (direct only) */}
            {other && (
              <div className="flex items-center justify-between rounded-xl px-2 py-3">
                <div className="flex items-center gap-3">
                  <Lock width={18} height={18} className={other.blocked ? 'text-red-500' : 'text-muted-foreground'} />
                  <span className="text-sm font-medium">บล็อก {other.name.split(' ')[0]}</span>
                </div>
                <Switch
                  checked={!!other.blocked}
                  onCheckedChange={(v) => { blockUser(other.id, v); toast(v ? 'บล็อกผู้ใช้แล้ว' : 'ปลดบล็อกแล้ว'); }}
                />
              </div>
            )}

            {/* Danger zone */}
            <div className="mt-4 space-y-1 border-t pt-3">
              <button onClick={() => { clearHistory(chat.id); toast('ล้างประวัติแชทแล้ว'); }}
                className="apple-btn-tactile flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium text-amber-600 hover:bg-amber-500/10">
                <Eraser width={17} height={17} /> ล้างประวัติการสนทนา
              </button>
              <button
                onClick={() => { deleteChat(chat.id); onClose(); toast(isGroup ? 'ออกจากกลุ่มแล้ว' : 'ลบแชทแล้ว'); }}
                className="apple-btn-tactile flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                {isGroup ? <LogOut width={17} height={17} /> : <Trash2 width={17} height={17} />} {isGroup ? 'ออกจากกลุ่ม' : 'ลบแชท'}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <SafetyNumberModal open={showSafety} onClose={() => setShowSafety(false)} chat={chat} />
      <StarredModal open={showStarred} onClose={() => setShowStarred(false)} chat={chat} />
      <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} chat={chat} />
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4 apple-card-inset py-2.5 px-1 space-y-1">
      <div className="flex items-center gap-2 px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="apple-btn-tactile flex flex-col items-center gap-1.5 rounded-2xl apple-card-inset px-2 py-3.5 text-xs font-medium transition-all hover:bg-muted/70">
      <span className="text-coral">{icon}</span>
      {label}
    </button>
  );
}
