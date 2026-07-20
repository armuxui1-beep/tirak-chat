import { useMemo, useState } from 'react';
import jsQR from 'jsqr';
import {
  Archive, Bell, BellOff, Check, CheckCheck, ChevronRight, Pencil, Folder, Lock,
  Link, MessageCircle, Pin, PinOff, Plus, QrCode, Search, Timer, Trash2, CloudUpload, UserPlus, Users, X, ShieldCheck
} from 'lucide-react';
import { useApp, ME_ID } from '@/store/AppContext';
import { Avatar, TirakLogo } from '@/components/shared/Brand';
import type { Chat, FolderKey, ID } from '@/types';
import { formatListTime, lastMessagePreview, sortedChats } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const FOLDERS: { key: FolderKey; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'unread', label: 'ยังไม่อ่าน' },
  { key: 'friends', label: 'เพื่อน' },
  { key: 'family', label: 'ครอบครัว' },
  { key: 'work', label: 'งาน' },
  { key: 'archived', label: 'เก็บถาวร' },
];

/* ================= Stories Row ================= */
function StoriesRow() {
  const { state, setViewingStoryOf } = useApp();
  const mine = state.stories.find((s) => s.userId === ME_ID);
  const others = state.stories.filter((s) => s.userId !== ME_ID && s.items.length > 0);

  return (
    <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 py-3">
      <button onClick={() => setViewingStoryOf(mine ? ME_ID : '__add__')} className="flex w-14 shrink-0 flex-col items-center gap-1.5">
        <div className="relative">
          <Avatar name={state.profile.name} colorKey={state.profile.avatarColor} emoji={state.profile.avatarEmoji} size={52} ring={!!mine} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-coral text-white ring-2 ring-background">
            <Plus width={12} height={12} strokeWidth={3} />
          </span>
        </div>
        <span className="w-full truncate text-center text-xs text-muted-foreground">ของฉัน</span>
      </button>
      {others.map((story) => {
        const user = state.users[story.userId];
        if (!user) return null;
        const allSeen = story.items.every((i) => i.viewers.includes(ME_ID));
        return (
          <button key={story.id} onClick={() => setViewingStoryOf(story.userId)} className="flex w-14 shrink-0 flex-col items-center gap-1.5">
            <Avatar name={user.name} colorKey={user.avatarColor} emoji={user.avatarEmoji} size={52} ring={!allSeen} online={user.online} showStatus />
            <span className="w-full truncate text-center text-xs text-muted-foreground">{user.name.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ================= Chat Item ================= */
function ChatItem({ chat, active, onClick }: { chat: Chat; active: boolean; onClick: () => void }) {
  const { state, patchChat, deleteChat, toast } = useApp();
  const last = chat.lastMessage;
  const isGroup = chat.type === 'group';
  const otherId = chat.memberIds.find((id) => id !== ME_ID);
  const other = otherId ? state.users[otherId] : undefined;
  const typingUser = state.typing[chat.id];
  const preview = typingUser
    ? 'กำลังพิมพ์...'
    : lastMessagePreview(last, isGroup, last ? state.users[last.senderId]?.name.split(' ')[0] : undefined);

  return (
    <DropdownMenu>
      <div
        onClick={onClick}
        className={cn(
          'group relative flex cursor-pointer items-center gap-3.5 mx-2.5 my-1 rounded-3xl px-3.5 py-3 transition-all duration-200 border border-transparent hover:bg-card/90 hover:border-border/50 hover:shadow-sm',
          active && 'bg-card border-border/70 shadow-md',
        )}
      >
        {chat.unreadCount > 0 && !chat.muted && (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[hsl(var(--coral))] shadow-[0_0_8px_hsl(var(--coral))]" title="มีข้อความใหม่" />
        )}
        <div className="relative shrink-0">
          <Avatar
            name={chat.name} colorKey={chat.avatarColor} emoji={chat.avatarEmoji} size={52}
            online={chat.type === 'direct' ? other?.online : undefined}
            showStatus={chat.type === 'direct' && state.settings.onlineStatus}
          />
          {chat.type === 'direct' && other?.online && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-online shadow-xs" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {chat.pinned && <Pin width={12} height={12} className="shrink-0 text-muted-foreground" />}
            <span className="truncate font-display text-base font-semibold">{chat.name}</span>
            {chat.locked && <Lock width={12} height={12} className="shrink-0 text-[hsl(var(--coral))]" />}
            {chat.disappearingSecs ? <Timer width={12} height={12} className="shrink-0 text-muted-foreground" /> : null}
            {chat.muted && <BellOff width={12} height={12} className="shrink-0 text-muted-foreground" />}
          </div>
          <div className={cn('mt-0.5 flex items-center gap-1 truncate text-sm', typingUser ? 'font-medium text-[hsl(var(--coral))]' : 'text-muted-foreground')}>
            {last?.senderId === ME_ID && last.type !== 'system' && (
              <span className="shrink-0">
                {last.status === 'read' ? <CheckCheck width={14} height={14} className="text-[hsl(var(--coral))]" /> :
                 last.status === 'delivered' ? <CheckCheck width={14} height={14} /> :
                 last.status === 'sent' ? <Check width={14} height={14} /> : <Timer width={13} height={13} />}
              </span>
            )}
            <span className="truncate">{preview}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn('text-xs', chat.unreadCount > 0 ? 'font-semibold text-[hsl(var(--coral))]' : 'text-muted-foreground')}>
            {last ? formatListTime(last.createdAt) : ''}
          </span>
          {chat.unreadCount > 0 && !chat.muted && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-xs font-bold text-white">
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          )}
          {chat.unreadCount > 0 && chat.muted && <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />}
        </div>

        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button className="absolute bottom-1 right-1 rounded-full bg-popover p-1 opacity-0 shadow transition-opacity group-hover:opacity-100">
            <ChevronRight width={14} height={14} className="rotate-90 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
      </div>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => patchChat(chat.id, { pinned: !chat.pinned })}>
          {chat.pinned ? <PinOff width={15} height={15} /> : <Pin width={15} height={15} />} {chat.pinned ? 'เลิกปักหมุด' : 'ปักหมุดแชท'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => patchChat(chat.id, { muted: !chat.muted })}>
          {chat.muted ? <Bell width={15} height={15} /> : <BellOff width={15} height={15} />} {chat.muted ? 'เปิดการแจ้งเตือน' : 'ปิดการแจ้งเตือน'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => patchChat(chat.id, { archived: !chat.archived })}>
          {chat.archived ? <Folder width={15} height={15} /> : <Archive width={15} height={15} />} {chat.archived ? 'นำออกจากคลัง' : 'เก็บถาวร'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { patchChat(chat.id, { locked: !chat.locked }); toast(chat.locked ? 'ปลดล็อกแชทแล้ว' : 'ล็อกแชทนี้แล้ว — ต้องใช้ PIN เพื่อเปิด'); }}>
          <Lock width={15} height={15} /> {chat.locked ? 'ปลดล็อกแชท' : 'ล็อกแชทนี้'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { deleteChat(chat.id); toast('ลบแชทแล้ว'); }}>
          <Trash2 width={15} height={15} /> ลบแชท
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ================= New Chat / Group / Add Friend Modal ================= */
function NewChatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, createDirectChat, createGroup, openChat, toast } = useApp();
  const [tab, setTab] = useState<'direct' | 'group' | 'add'>('direct');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ID[]>([]);
  const [groupName, setGroupName] = useState('');
  const [addInput, setAddInput] = useState('');

  const contacts = Object.values(state.users).filter(
    (u) => !u.blocked && (
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      (u.phone && query.trim() && u.phone.replace(/\D/g, '').includes(query.replace(/\D/g, ''))) ||
      (u.username && query.trim() && u.username.toLowerCase().includes(query.toLowerCase())) ||
      (u.isContact && !query.trim())
    )
  );

  const finish = async () => {
    if (tab === 'direct') {
      if (selected[0]) {
        const chatId = await createDirectChat(selected[0]);
        openChat(chatId);
        onClose();
      }
    } else if (tab === 'group' && groupName.trim() && selected.length >= 1) {
      const chatId = await createGroup(groupName.trim(), selected);
      openChat(chatId);
      onClose();
    }
  };

  const handleAddFriendByInput = async () => {
    if (!addInput.trim()) return;
    const clean = addInput.trim().toLowerCase();
    const found = Object.values(state.users).find(
      (u) => u.phone?.replace(/\D/g, '') === clean.replace(/\D/g, '') ||
             u.username?.toLowerCase() === clean ||
             u.username?.toLowerCase() === `@${clean}` ||
             u.name.toLowerCase().includes(clean)
    );
    if (found) {
      const chatId = await createDirectChat(found.id);
      toast(`🤝 เพิ่ม ${found.name} เข้าสู่รายชื่อติดต่อและเริ่มแชทแล้ว`);
      openChat(chatId);
      onClose();
    } else {
      toast(`⚠️ ไม่พบบัญชีที่ตรงกับ "${addInput}" กรุณาตรวจสอบเบอร์โทรหรือ @username`);
    }
  };

  const handleQrScanImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;
      
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);
        const imageData = context.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code && code.data) {
          const qrText = code.data.trim();
          let targetIdentifier = qrText;
          if (qrText.startsWith('tirak://user/')) {
            targetIdentifier = decodeURIComponent(qrText.replace('tirak://user/', ''));
          }
          
          const found = Object.values(state.users).find((u) => 
            u.id !== ME_ID && (
              u.id === targetIdentifier ||
              u.username?.toLowerCase() === targetIdentifier.toLowerCase() ||
              u.username?.toLowerCase() === `@${targetIdentifier.toLowerCase().replace('@', '')}` ||
              u.phone?.replace(/\D/g, '') === targetIdentifier.replace(/\D/g, '')
            )
          );
          if (found) {
            const chatId = await createDirectChat(found.id);
            toast(`สแกน QR Code สำเร็จ! เพิ่ม ${found.name} เป็นผู้ติดต่อแล้ว`);
            openChat(chatId);
            onClose();
          } else {
            toast(`ถอดรหัสภาพ QR ได้รหัส: "${qrText}" แต่ไม่พบบัญชีนี้ในระบบ Tirak Chat`);
          }
        } else {
          toast('ไม่พบรหัสบาร์โค้ดหรือ QR Code ในรูปภาพนี้ กรุณาอัปโหลดภาพที่คมชัด');
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="font-display">เริ่มแชทใหม่ & เพิ่มเพื่อน (New Chat & Contacts)</DialogTitle>
        </DialogHeader>
        <div className="px-5">
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1">
            <button
              onClick={() => { setTab('direct'); setSelected([]); }}
              className={cn('flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all', tab === 'direct' ? 'bg-card shadow text-foreground' : 'text-muted-foreground')}
            >
              <MessageCircle width={14} height={14} className="text-coral" />
              <span>แชทส่วนตัว</span>
            </button>
            <button
              onClick={() => { setTab('group'); setSelected([]); }}
              className={cn('flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all', tab === 'group' ? 'bg-card shadow text-foreground' : 'text-muted-foreground')}
            >
              <Users width={14} height={14} className="text-coral" />
              <span>สร้างกลุ่ม</span>
            </button>
            <button
              onClick={() => { setTab('add'); setSelected([]); }}
              className={cn('flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all', tab === 'add' ? 'bg-card shadow text-foreground' : 'text-muted-foreground')}
            >
              <UserPlus width={14} height={14} className="text-coral" />
              <span>เพิ่มเพื่อน / QR</span>
            </button>
          </div>

          {tab !== 'add' && (
            <div className="relative mt-3">
              <Search width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อ, เบอร์โทรศัพท์ หรือ @username..."
                className="h-10 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}
          {tab === 'group' && (
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="ชื่อกลุ่ม เช่น ทีมผู้บริหาร, ฝ่ายการตลาด"
              className="mt-3 h-10 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          )}
        </div>

        {tab === 'add' ? (
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-card border p-4 space-y-3 shadow-xs">
              <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Search width={15} height={15} className="text-coral" />
                <span>ค้นหาเพื่อนด้วยเบอร์โทรศัพท์ หรือ @Username</span>
              </label>
              <div className="flex gap-2">
                <input
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value)}
                  placeholder="เช่น 089-123-4567 หรือ @manager_id"
                  className="h-10 flex-1 rounded-xl border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriendByInput()}
                />
                <button
                  onClick={handleAddFriendByInput}
                  disabled={!addInput.trim()}
                  className="rounded-xl bg-[hsl(var(--coral))] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-40 shrink-0"
                >
                  เพิ่มเพื่อน
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 text-white text-center space-y-2.5">
              <div className="font-display text-sm font-bold flex items-center justify-center gap-1.5">
                <QrCode width={16} height={16} className="text-coral" />
                <span>สแกน QR Code จากรูปภาพเพื่อเพิ่มเพื่อน</span>
              </div>
              <p className="text-xs text-slate-400">อัปโหลดไฟล์ภาพ QR Code ของเพื่อนที่บันทึกไว้ในเครื่อง ระบบจะตรวจสอบและเพิ่มผู้ติดต่ออัตโนมัติ</p>
              <label htmlFor="qr-image-upload" className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white text-slate-900 px-4 py-2 text-xs font-bold shadow hover:bg-slate-100 transition-colors">
                <CloudUpload width={15} height={15} className="text-coral" />
                <span>เลือกรูปภาพ QR Code (Import Image)</span>
              </label>
              <input id="qr-image-upload" type="file" accept="image/*" className="hidden" onChange={handleQrScanImage} />
            </div>

            <div className="rounded-xl bg-muted/60 border p-3 flex items-center justify-between text-xs">
              <div className="min-w-0 mr-2">
                <span className="flex items-center gap-1.5 font-bold text-foreground block">
                  <Link width={14} height={14} className="text-coral" />
                  <span>ลิงก์โปรไฟล์ของฉัน</span>
                </span>
                <span className="text-muted-foreground font-mono text-xs truncate block">{window.location.origin}/u/{state.profile.username.replace('@', '')}</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/u/${state.profile.username.replace('@', '')}`);
                  toast('คัดลอกลิงก์โปรไฟล์ของคุณแล้ว แชร์ให้เพื่อนได้ทันที');
                }}
                className="shrink-0 rounded-lg bg-card border px-3 py-1.5 text-xs font-bold hover:bg-muted shadow-xs"
              >
                คัดลอก
              </button>
            </div>
          </div>
        ) : (
          <div className="thin-scroll mt-2 max-h-72 overflow-y-auto px-2 pb-2">
            {contacts.map((u) => {
              const isSel = selected.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    if (tab === 'direct') setSelected([u.id]);
                    else setSelected((s) => isSel ? s.filter((x) => x !== u.id) : [...s, u.id]);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted"
                >
                  <Avatar name={u.name} colorKey={u.avatarColor} emoji={u.avatarEmoji} size={44} online={u.online} showStatus />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-semibold">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.about || u.username || u.phone}</div>
                  </div>
                  {isSel && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral text-white"><Check width={14} height={14} strokeWidth={3} /></span>}
                </button>
              );
            })}
            {contacts.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">ไม่พบรายชื่อ</div>}
          </div>
        )}

        {tab !== 'add' && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <span className="text-xs text-muted-foreground">
              {tab === 'group' ? `เลือกแล้ว ${selected.length} คน (อย่างน้อย 1)` : 'เลือก 1 คนเพื่อเริ่มแชท'}
            </span>
            <button
              onClick={finish}
              disabled={tab === 'direct' ? selected.length !== 1 : !(groupName.trim() && selected.length >= 1)}
              className="rounded-xl bg-[hsl(var(--coral))] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {tab === 'direct' ? 'เริ่มแชท' : 'สร้างกลุ่ม'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ================= Main List ================= */
export function ChatListScreen() {
  const { state, openChat } = useApp();
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState<FolderKey>('all');
  const [showNewChat, setShowNewChat] = useState(false);

  const list = useMemo(() => {
    let chats = Object.values(state.chats);
    if (folder === 'archived') chats = chats.filter((c) => c.archived);
    else chats = chats.filter((c) => !c.archived);
    if (folder === 'unread') chats = chats.filter((c) => c.unreadCount > 0);
    if (folder === 'friends' || folder === 'family' || folder === 'work') chats = chats.filter((c) => c.folder === folder);
    if (query.trim()) {
      const q = query.toLowerCase();
      chats = chats.filter((c) => c.name.toLowerCase().includes(q));
    }
    return sortedChats(chats, state.messages);
  }, [state.chats, state.messages, folder, query]);

  const archivedCount = Object.values(state.chats).filter((c) => c.archived).length;

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="apple-glass-header flex items-center gap-3 px-4 pb-3 pt-4">
        <TirakLogo size={34} />
        <h1 className="font-display flex-1 text-xl font-bold tracking-tight">Tirak Chat</h1>
        <button
          onClick={() => setShowNewChat(true)}
          className="apple-btn-tactile flex h-9 w-9 items-center justify-center rounded-full bg-coral text-white shadow-md shadow-[hsl(var(--coral)/0.35)]"
          title="เริ่มแชทใหม่"
          aria-label="แชทใหม่"
        >
          <Pencil width={17} height={17} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search width={16} height={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาแชท หรือเริ่มแชทใหม่"
            className="h-10 w-full rounded-full border-none bg-muted pl-10 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X width={15} height={15} />
            </button>
          )}
        </div>
      </div>

      {/* Folders */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {FOLDERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFolder(f.key)}
            className={cn(
              'apple-btn-tactile shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium',
              folder === f.key
                ? 'bg-[hsl(var(--coral))] text-white shadow-sm shadow-[hsl(var(--coral)/0.4)]'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {f.label}
            {f.key === 'archived' && archivedCount > 0 && ` (${archivedCount})`}
          </button>
        ))}
      </div>

      {/* Stories (แสดงเฉพาะแท็บทั้งหมด/ยังไม่อ่าน และไม่ค้นหา) */}
      {(folder === 'all' || folder === 'unread') && !query && (
        <>
          <StoriesRow />
          <div className="mx-4 border-b" />
        </>
      )}

      {/* List */}
      <div className="thin-scroll flex-1 overflow-y-auto pb-24 lg:pb-4">
        {list.map((chat) => (
          <ChatItem
            key={chat.id}
            chat={chat}
            active={state.activeChatId === chat.id}
            onClick={() => openChat(chat.id)}
          />
        ))}
        {list.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              {folder === 'archived' ? <Archive width={26} height={26} /> : folder === 'unread' ? <CheckCheck width={26} height={26} /> : <Users width={26} height={26} />}
            </div>
            <p className="text-sm">
              {query ? 'ไม่พบแชทที่ค้นหา' : folder === 'unread' ? 'อ่านครบทุกข้อความแล้ว' : folder === 'archived' ? 'ไม่มีแชทที่เก็บถาวร' : 'ยังไม่มีแชทในโฟลเดอร์นี้'}
            </p>
          </div>
        )}
        <div className="px-4 py-4 text-center text-xs text-muted-foreground/70 inline-flex items-center justify-center w-full gap-1">
          <ShieldCheck width={14} height={14} className="text-[hsl(var(--coral))]" /> ข้อความและข้อมูลทั้งหมดได้รับการปกป้อง
        </div>
      </div>

      <NewChatModal open={showNewChat} onClose={() => setShowNewChat(false)} />
    </div>
  );
}
