import type { Chat, Message } from '@/types';
import { ME_ID } from '@/config/constants';

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function generateCodeFromValue(val: string): string {
  const clean = val.replace(/[^a-zA-Z0-9]/g, '');
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const code = Math.abs(hash) % 900000 + 100000;
  return code.toString();
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  if (days < 7) return `${days} วันที่แล้ว`;
  return formatFullDate(ts);
}

export function formatListTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return formatTime(ts);
  if (diff < 7 * 864e5) return d.toLocaleDateString('th-TH', { weekday: 'short' });
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatClock(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function dateSeparatorLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return 'วันนี้';
  if (d.toDateString() === yesterday.toDateString()) return 'เมื่อวาน';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function getLastMessage(msgs: Message[] | undefined): Message | undefined {
  if (!msgs || msgs.length === 0) return undefined;
  const visible = msgs.filter((m) => !m.deletedForEveryone || m.type !== 'system');
  return visible[visible.length - 1];
}

export function lastMessagePreview(m: Message | undefined, isGroup: boolean, senderName?: string): string {
  if (!m) return 'เริ่มการสนทนา';
  const prefix = isGroup && m.senderId !== ME_ID && m.type !== 'system' ? `${senderName ?? ''}: ` : '';
  if (m.deletedForEveryone) return `${prefix}ข้อความนี้ถูกลบ`;
  switch (m.type) {
    case 'text': return prefix + (m.text ?? '');
    case 'image': return prefix + '[รูปภาพ]';
    case 'voice': return prefix + '[ข้อความเสียง]';
    case 'file': return prefix + `[ไฟล์] ${m.mediaName ?? ''}`;
    case 'poll': return prefix + `[โพล] ${m.poll?.question ?? ''}`;
    case 'call': return prefix + (m.callType === 'video' ? '[วิดีโอคอล]' : '[สายเรียก]');
    case 'location': return prefix + '[ตำแหน่งที่ตั้ง]';
    case 'system': return m.text ?? '';
    default: return prefix + 'ข้อความ';
  }
}

export function sortedChats(chats: Chat[], messages: Record<string, Message[]>): Chat[] {
  return [...chats].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const ta = getLastMessage(messages[a.id])?.createdAt ?? a.createdAt;
    const tb = getLastMessage(messages[b.id])?.createdAt ?? b.createdAt;
    return tb - ta;
  });
}

/** Render *bold*, _italic_, ~strike~, `code` into React-friendly segments */
export type Segment = { text: string; bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean };

export function parseMarkdown(input: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) segments.push({ text: input.slice(lastIndex, match.index) });
    const raw = match[0];
    if (raw.startsWith('*')) segments.push({ text: raw.slice(1, -1), bold: true });
    else if (raw.startsWith('_')) segments.push({ text: raw.slice(1, -1), italic: true });
    else if (raw.startsWith('~')) segments.push({ text: raw.slice(1, -1), strike: true });
    else segments.push({ text: raw.slice(1, -1), code: true });
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < input.length) segments.push({ text: input.slice(lastIndex) });
  return segments;
}

export const DISAPPEAR_OPTIONS = [
  { secs: 0, label: 'ปิด' },
  { secs: 30, label: '30 วินาที' },
  { secs: 60, label: '1 นาที' },
  { secs: 300, label: '5 นาที' },
  { secs: 3600, label: '1 ชั่วโมง' },
  { secs: 86400, label: '1 วัน' },
];

export function disappearLabel(secs?: number): string {
  if (!secs) return 'ปิด';
  return DISAPPEAR_OPTIONS.find((o) => o.secs === secs)?.label ?? `${secs} วินาที`;
}
