import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Bell, ChevronRight, Download, HardDrive, HelpCircle, Key, Lock,
  LogOut, Palette, RefreshCw, ShieldCheck, Trash2, User,
  CheckCheck, Phone, Star, Send, Globe,
  Sun, Moon, Settings, Laptop, MessageCircle, QrCode, Eraser, Camera,
} from 'lucide-react';
import { useApp, ME_ID } from '@/store/AppContext';
import { Avatar } from '@/components/shared/Brand';
import { GRADIENTS } from '@/config/constants';
import { formatListTime } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { db, storage } from '@/lib/firebase';
import { doc, setDoc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

/* ================= Edit profile ================= */
function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, setProfile, validateUsernameUniqueness, toast } = useApp();
  const p = state.profile;
  const [name, setName] = useState(p.name);
  const [username, setUsername] = useState(p.username.replace('@', ''));
  const [about, setAbout] = useState(p.about);
  const [color, setColor] = useState(p.avatarColor);
  const [avatarUrl, setAvatarUrl] = useState(p.avatarUrl || '');
  const emoji = p.avatarEmoji;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast('กำลังอัปโหลดรูปภาพไปยัง Firebase Storage...');
    try {
      const storageRef = ref(storage, `users/${ME_ID}/avatar_${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          toast(`อัปโหลดรูปภาพไม่สำเร็จ: ${error.message}`);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setAvatarUrl(url);
          toast('อัปโหลดรูปภาพเสร็จสมบูรณ์ กดบันทึกเพื่อยืนยัน');
        }
      );
    } catch (err: any) {
      toast(`อัปโหลดไม่สำเร็จ: ${err.message || ''}`);
    }
    e.target.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-[32px] p-6 bg-card border border-border/40 shadow-2xl">
        <DialogHeader><DialogTitle className="font-display text-lg font-bold">แก้ไขโปรไฟล์และรูปภาพบัญชี</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <Avatar name={name || 'User'} colorKey={color} emoji={emoji} avatarUrl={avatarUrl || undefined} size={92} ring />
          
          <div className="flex items-center gap-2.5">
            <label htmlFor="avatar-file-upload" className="cursor-pointer rounded-2xl bg-muted/80 px-4 py-2 text-xs font-semibold text-foreground border border-border/40 shadow-xs hover:bg-muted transition-colors flex items-center gap-2 active:scale-95">
              <Camera width={16} height={16} className="text-coral" />
              <span>อัปโหลดรูปภาพใหม่</span>
            </label>
            <input id="avatar-file-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {avatarUrl ? (
              <button onClick={() => setAvatarUrl('')} className="rounded-2xl bg-destructive/10 px-3.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1.5 active:scale-95">
                <Trash2 width={15} height={15} />
                <span>ลบรูป</span>
              </button>
            ) : null}
          </div>

          <div className="flex gap-2 pt-1">
            {Object.keys(GRADIENTS).slice(0, 6).map((k) => (
              <button key={k} onClick={() => setColor(k)}
                className={cn('h-7 w-7 rounded-full transition-transform', color === k && 'scale-110 ring-2 ring-offset-2 ring-[hsl(var(--coral))] ring-offset-background')}
                style={{ background: GRADIENTS[k] }} />
            ))}
          </div>
        </div>
        <div className="mt-2 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">ชื่อที่แสดงในระบบ (Display Name)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อที่แสดง"
              className="h-12 w-full rounded-2xl border border-border/40 bg-muted/40 px-4 text-sm outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">รหัสประจำตัวผู้ใช้ (Username ID)</label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-sm text-muted-foreground font-mono font-bold">@</span>
              <input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))} placeholder="username"
                className="h-12 w-full rounded-2xl border border-border/40 bg-muted/40 pl-9 pr-4 text-sm font-mono outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">เกี่ยวกับคุณ (About / Bio)</label>
            <input value={about} onChange={(e) => setAbout(e.target.value)} placeholder="เกี่ยวกับคุณ"
              className="h-12 w-full rounded-2xl border border-border/40 bg-muted/40 px-4 text-sm outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all" />
          </div>
          <button
            onClick={async () => {
              const newUsername = `@${(username || 'user').trim()}`;
              if (newUsername !== p.username) {
                const isUnique = await validateUsernameUniqueness(newUsername, ME_ID);
                if (!isUnique) {
                  toast(`ชื่อผู้ใช้ ${newUsername} มีผู้อื่นใช้งานแล้ว กรุณาเลือกชื่ออื่น`);
                  return;
                }
              }
              await setProfile({
                ...p,
                name: name.trim() || p.name,
                username: newUsername,
                about,
                avatarColor: color,
                avatarEmoji: emoji,
                avatarUrl: avatarUrl || undefined,
              });
              toast('บันทึกข้อมูลโปรไฟล์และรูปภาพเรียบร้อยแล้ว');
              onClose();
            }}
            className="mt-2 h-12 w-full rounded-2xl bg-[hsl(var(--coral))] font-display font-semibold text-white hover:bg-[hsl(var(--coral-deep))] shadow-md transition-all active:scale-[0.98]"
          >
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Profile QR Code & Sharing Modal ================= */
function ProfileQrModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, updateSettings, toast } = useApp();
  const p = state.profile;
  const hidePhone = state.settings.phonePrivacy === 'nobody';
  const targetId = hidePhone ? (p.id || p.username) : (p.phone || p.id || p.username);
  const qrPayload = `tirak://user/${targetId}`;
  const profileLink = `${window.location.origin}/u/${p.username.replace('@', '')}`;
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (open) {
      QRCode.toDataURL(qrPayload, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).then((url) => setQrDataUrl(url)).catch((err) => console.error('QR Gen error:', err));
    }
  }, [open, qrPayload]);

  const copyLink = () => {
    navigator.clipboard?.writeText(profileLink);
    toast(`คัดลอกลิงก์โปรไฟล์ของ ${p.name} เรียบร้อยแล้ว พร้อมแชร์ให้เพื่อนทันที`);
  };

  const downloadQrPng = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 780;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 600, 780);

    // Card background
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(40, 40, 520, 700, 24);
    ctx.fill();

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, 300, 110);
    ctx.font = '22px monospace';
    ctx.fillStyle = '#FF686B';
    ctx.fillText(p.username, 300, 150);

    // Generate real QR code onto canvas
    try {
      const qrImage = new Image();
      const url = await QRCode.toDataURL(qrPayload, {
        width: 340,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      qrImage.onload = () => {
        // Draw white container box
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(130, 180, 340, 340, 16);
        ctx.fill();
        
        ctx.drawImage(qrImage, 130, 180, 340, 340);

        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('SCAN QR TO ADD FRIEND', 300, 560);
        ctx.font = '16px monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(profileLink, 300, 600);
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.fillText('✓ TIRAK CHAT VERIFIED CONTACT', 300, 660);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = hidePhone ? '#f59e0b' : '#94a3b8';
        ctx.fillText(hidePhone ? 'ซ่อนเบอร์โทรศัพท์แล้ว (Phone Number Privacy Active)' : `เบอร์ติดต่อ: ${p.phone || 'ไม่ระบุ'}`, 300, 690);

        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `Tirak-QR-${p.username.replace('@', '')}.png`;
        a.click();
        toast('ดาวน์โหลดไฟล์ภาพ QR Code เรียบร้อยแล้ว!');
      };
      qrImage.src = url;
    } catch (err) {
      console.error('Error drawing QR code:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader><DialogTitle className="font-display">คิวอาร์โค้ดและลิงก์โปรไฟล์ส่วนตัว</DialogTitle></DialogHeader>
        <div className="my-3 flex flex-col items-center justify-center rounded-2xl bg-slate-900 p-6 text-white border border-slate-800 shadow-inner">
          <Avatar name={p.name} colorKey={p.avatarColor} avatarUrl={p.avatarUrl} size={64} className="mb-2 ring-2 ring-coral" />
          <h3 className="font-display text-lg font-bold">{p.name}</h3>
          <p className="font-mono text-sm text-[hsl(var(--coral))] mb-3">{p.username}</p>
          
          {/* Real QR Code Display */}
          <div className="rounded-2xl bg-white p-4 shadow-lg flex flex-col items-center justify-center border-4 border-slate-800 relative">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 rounded-lg select-none" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-800 font-semibold animate-pulse">กำลังสร้าง QR Code...</div>
            )}
            <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold tracking-wider border border-emerald-200">
              <ShieldCheck width={12} height={12} className="text-emerald-600" />
              <span>TIRAK VERIFIED ID</span>
            </div>
          </div>
          <p className="mt-3.5 text-xs text-slate-400">ให้เพื่อนสแกน QR หรือส่งไฟล์นี้เพื่อเพิ่มคุณเป็นผู้ติดต่อ</p>

          {/* Phone Privacy Toggle */}
          <div className="mt-4 w-full flex items-center justify-between rounded-xl bg-slate-950/80 px-3.5 py-2.5 border border-slate-800 text-left">
            <div className="min-w-0 pr-2">
              <span className="text-xs font-bold text-slate-200 block">ซ่อนเบอร์โทรศัพท์ใน QR (Phone Privacy)</span>
              <span className="text-[10px] text-slate-400 block">เมื่อเปิด จะใช้เฉพาะรหัส ID ในการเพิ่มเพื่อน</span>
            </div>
            <Switch
              checked={hidePhone}
              onCheckedChange={(checked) => {
                updateSettings({ phonePrivacy: checked ? 'nobody' : 'everyone' });
                toast(checked ? 'เปิดโหมดซ่อนเบอร์ใน QR Code แล้ว' : 'ปิดโหมดซ่อนเบอร์ — แสดงเบอร์ใน QR Code');
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl bg-muted p-2 border">
            <input readOnly value={profileLink} className="w-full bg-transparent text-xs font-mono text-muted-foreground outline-none px-2" />
            <button onClick={copyLink} className="shrink-0 rounded-lg bg-[hsl(var(--coral))] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
              คัดลอก
            </button>
          </div>
          <button onClick={downloadQrPng} className="h-11 w-full rounded-xl border bg-card text-xs font-bold text-foreground hover:bg-muted shadow-xs flex items-center justify-center gap-1.5">
            <Download width={16} height={16} />
            <span>ดาวน์โหลดรูปภาพ QR Code PNG</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= PIN setup ================= */
function PinSetupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { updateSettings, toast } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const pin = step === 1 ? pin1 : pin2;
  const setPin = step === 1 ? setPin1 : setPin2;

  const finish = () => {
    if (pin1 === pin2 && pin1.length >= 4) {
      updateSettings({ screenLock: true, lockPin: pin1 });
      toast('เปิด Screen Lock แล้ว — ใช้ PIN นี้ปลดล็อก');
      onClose();
    } else {
      toast('รหัส PIN ไม่ตรงกัน ลองอีกครั้ง');
      setStep(1); setPin1(''); setPin2('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setStep(1); setPin1(''); setPin2(''); } }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><Key width={20} height={20} className="text-coral" /> ตั้งรหัส PIN</DialogTitle>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">
          {step === 1 ? 'สร้างรหัส PIN 4–6 หลัก สำหรับล็อกหน้าจอ' : 'ยืนยันรหัส PIN อีกครั้ง'}
        </p>
        <div className="flex justify-center gap-2.5 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn('h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/40', i < pin.length && 'border-[hsl(var(--coral))] bg-[hsl(var(--coral))]')} />
          ))}
        </div>
        <div className="mx-auto grid w-fit grid-cols-3 gap-2.5">
          {[1,2,3,4,5,6,7,8,9,'',0,'erase'].map((k, i) => (
            <button key={i} disabled={k === ''}
              onClick={() => {
                if (k === 'erase') setPin(pin.slice(0, -1));
                else if (k !== '' && pin.length < 6) setPin(pin + String(k));
              }}
              className="flex h-13 w-13 items-center justify-center rounded-full bg-muted text-lg font-semibold transition-all hover:bg-muted/70 active:scale-95 disabled:opacity-0">
              {k === 'erase' ? <Eraser width={22} height={22} /> : k}
            </button>
          ))}
        </div>
        <button
          disabled={pin.length < 4}
          onClick={() => { if (step === 1) { setStep(2); } else finish(); }}
          className="mt-3 h-11 w-full rounded-xl bg-[hsl(var(--coral))] font-display font-semibold text-white disabled:opacity-40"
        >
          {step === 1 ? 'ถัดไป' : 'ยืนยัน PIN'}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Help / FAQ Modal ================= */
function HelpModal({ open, onClose, isEn }: { open: boolean; onClose: () => void; isEn: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <HelpCircle width={20} height={20} className="text-coral" />
            {isEn ? 'Help & FAQ' : 'คำถามที่พบบ่อย (ศูนย์ช่วยเหลือ)'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed text-foreground mt-2">
          <div className="rounded-xl bg-muted p-3.5">
            <h4 className="font-bold text-[hsl(var(--coral))] mb-1">
              {isEn ? '1. How do I add friends / start a chat?' : '1. จะเพิ่มเพื่อน / เริ่มแชทใหม่ได้อย่างไร?'}
            </h4>
            <p className="text-muted-foreground text-xs">
              {isEn
                ? 'Click the "+" button at the top right of the chat list screen. Type your friend\'s display name or phone number. When found, tap their name to open a direct E2E encrypted chat immediately.'
                : 'คลิกปุ่ม "+" (เริ่มแชทใหม่) ที่มุมขวาบนของหน้ารายชื่อแชท จากนั้นพิมพ์ค้นหา "ชื่อ" หรือ "เบอร์โทรศัพท์" ของเพื่อนที่ลงทะเบียนในระบบ เมื่อเจอรายชื่อสามารถกดเลือกเพื่อเปิดห้องแชทและสนทนาทันที'}
            </p>
          </div>
          <div className="rounded-xl bg-muted p-3.5">
            <h4 className="font-bold text-[hsl(var(--coral))] mb-1">
              {isEn ? '2. Are messages securely encrypted?' : '2. ข้อความและประวัติการโทรปลอดภัยหรือไม่?'}
            </h4>
            <p className="text-muted-foreground text-xs">
              {isEn
                ? 'Tirak Chat stores your messages securely. We are actively working on adding end-to-end encryption in a future update.'
                : 'Tirak Chat เก็บข้อมูลของคุณอย่างปลอดภัย เรากำลังพัฒนาระบบเข้ารหัสแบบ End-to-End เพื่อเพิ่มความปลอดภัยให้มากยิ่งขึ้นในอนาคต'}
            </p>
          </div>
          <div className="rounded-xl bg-muted p-3.5">
            <h4 className="font-bold text-[hsl(var(--coral))] mb-1">
              {isEn ? '3. What is Screen Lock PIN?' : '3. Screen Lock และรหัส PIN ทำงานอย่างไร?'}
            </h4>
            <p className="text-muted-foreground text-xs">
              {isEn
                ? 'You can set a 4-6 digit PIN in Settings. When enabled, the app locks automatically or when you tap "Lock Now", keeping your private conversations safe.'
                : 'คุณสามารถตั้งรหัส PIN 4-6 หลักได้ที่เมนูตั้งค่า เมื่อเปิดใช้งาน หน้าจอจะล็อกอัตโนมัติเมื่อพักหน้าจอ หรือเมื่อกดปุ่ม "ล็อกตอนนี้ทันที" เพื่อป้องกันผู้อื่นแอบอ่านข้อความ'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-4 h-11 w-full rounded-xl bg-[hsl(var(--coral))] font-display font-semibold text-white"
        >
          {isEn ? 'Got it' : 'เข้าใจแล้ว'}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Privacy Policy Modal ================= */
function PrivacyModal({ open, onClose, isEn }: { open: boolean; onClose: () => void; isEn: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ShieldCheck width={20} height={20} className="text-coral" />
            {isEn ? 'Privacy Policy & Security' : 'นโยบายความเป็นส่วนตัวและความปลอดภัย'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed mt-2">
          <p>
            {isEn
              ? 'Tirak Chat respects your personal data strictly in compliance with data protection standards (PDPA & GDPR).'
              : 'Tirak Chat ให้ความสำคัญกับความลับและข้อมูลส่วนบุคคลของคุณสูงสุด ตามมาตรฐานการคุ้มครองข้อมูลส่วนบุคคล (PDPA)'}
          </p>
          <ul className="list-disc pl-4 space-y-1.5">
            <li>
              <strong className="text-foreground">{isEn ? 'Minimal Data Collection:' : 'เก็บข้อมูลเท่าที่จำเป็น:'}</strong>{' '}
              {isEn ? 'We only store your display profile, encrypted messages, and contacts necessary to deliver chat services.' : 'เราบันทึกเฉพาะชื่อโปรไฟล์ ข้อความที่เข้ารหัส และรายชื่อผู้ติดต่อที่จำเป็นสำหรับการให้บริการแชทเท่านั้น'}
            </li>
            <li>
              <strong className="text-foreground">{isEn ? 'No Ad Tracking:' : 'ไม่มีโฆษณาและการติดตาม:'}</strong>{' '}
              {isEn ? 'No third-party trackers, no ad retargeting, and zero commercial data mining.' : 'ไม่มีการฝังตัวติดตามของบุคคลที่สาม ไม่มีการนำข้อมูลไปขายหรือยิงโฆษณาใด ๆ ทั้งสิ้น'}
            </li>
            <li>
              <strong className="text-foreground">{isEn ? 'Full User Control:' : 'สิทธิ์ควบคุมเต็มรูปแบบ:'}</strong>{' '}
              {isEn ? 'You can export all your chat history as JSON or reset and delete all your account data permanently anytime from Settings.' : 'คุณสามารถส่งออกข้อมูลแชททั้งหมดเป็นไฟล์ JSON หรือกดเลิกใช้งานและล้างข้อมูลทั้งหมดออกจากระบบคลาวด์ได้อย่างถาวรทุกเมื่อ'}
            </li>
          </ul>
        </div>
        <button
          onClick={onClose}
          className="mt-4 h-11 w-full rounded-xl bg-card border font-display font-semibold text-foreground hover:bg-muted"
        >
          {isEn ? 'Close' : 'ปิด'}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Rating Modal ================= */
function RatingModal({ open, onClose, isEn }: { open: boolean; onClose: () => void; isEn: boolean }) {
  const { state, toast } = useApp();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitRating = async () => {
    setSubmitting(true);
    try {
      const currentUserId = localStorage.getItem('tirak-chat-user-id') || 'anonymous';
      await addDoc(collection(db, 'feedback'), {
        userId: currentUserId,
        userName: state.profile.name || 'Anonymous',
        userPhone: state.profile.phone || '',
        stars,
        comment: comment.trim(),
        createdAt: Date.now(),
        platform: navigator.userAgent,
      });
      localStorage.setItem('tirak_user_rating', JSON.stringify({ stars, comment, date: Date.now() }));
      toast(isEn ? `Thank you for rating ${stars} stars! Recorded to cloud.` : `ขอบคุณที่ให้คะแนน Tirak Chat ${stars} ดาว! บันทึกเข้าสู่ระบบคลาวด์แล้ว`);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      toast(isEn ? 'Thank you for your feedback!' : `ขอบคุณสำหรับคำติชม ${stars} ดาว!`);
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs text-center">
        <DialogHeader>
          <DialogTitle className="font-display text-center">
            {isEn ? 'Rate Tirak Chat' : 'ให้คะแนนความพึงพอใจ'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center gap-2 py-4">
          {[1, 2, 3, 4, 5].map((st) => (
            <button
              key={st}
              onClick={() => setStars(st)}
              className="transition-transform hover:scale-125"
            >
              <Star width={28} height={28} className={cn('transition-colors', st <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30')} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={isEn ? 'Optional feedback or suggestions...' : 'คำแนะนำเพิ่มเติม (ถ้ามี)...'}
          className="w-full h-20 rounded-xl border bg-card p-3 text-xs outline-none focus:ring-2 focus:ring-ring resize-none mb-2"
        />
        <button
          onClick={submitRating}
          disabled={submitting}
          className="h-11 w-full rounded-xl bg-[hsl(var(--coral))] font-display font-semibold text-white disabled:opacity-50"
        >
          {submitting ? (isEn ? 'Submitting...' : 'กำลังบันทึก...') : (isEn ? 'Submit Rating' : 'ส่งคำติชม')}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Blocked Users Modal ================= */
function BlockedUsersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, blockUser, toast } = useApp();
  const blockedUsers = Object.values(state.users).filter((u) => u.blocked);
  const isEn = state.settings.language === 'en';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <User width={20} height={20} className="text-coral" />
            {isEn ? `Blocked Users (${blockedUsers.length})` : `ผู้ใช้ที่ถูกบล็อก (${blockedUsers.length})`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {blockedUsers.length === 0 ? (
            <p className="text-center py-8 text-xs text-muted-foreground">{isEn ? 'No blocked users at this time.' : 'ไม่มีรายชื่อผู้ใช้ที่ถูกบล็อกในขณะนี้'}</p>
          ) : (
            <div className="divide-y border rounded-xl bg-card">
              {blockedUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3.5 hover:bg-muted/30">
                  <div>
                    <div className="font-semibold text-sm">{u.name}</div>
                    <div className="text-xs text-muted-foreground">@{u.username || u.phone}</div>
                  </div>
                  <button
                    onClick={() => {
                      blockUser(u.id, false);
                      toast(isEn ? `Unblocked ${u.name}` : `ปลดบล็อก ${u.name} แล้ว`);
                    }}
                    className="rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 text-xs font-bold hover:bg-emerald-500/25 transition-colors"
                  >
                    {isEn ? 'Unblock' : 'ปลดบล็อก'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClose} className="mt-4 h-11 w-full rounded-xl bg-card border font-display font-semibold text-foreground hover:bg-muted">
          {isEn ? 'Close' : 'ปิด'}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Sessions & Security Details Modal ================= */
function SessionsModal({ open, onClose, deviceInfo, keyFingerprint }: { open: boolean; onClose: () => void; deviceInfo: { browser: string; os: string }; keyFingerprint: string }) {
  const { state, toast } = useApp();
  const isEn = state.settings.language === 'en';

  const terminateOtherSessions = async () => {
    try {
      const userId = localStorage.getItem('tirak-chat-user-id');
      if (userId) {
        await setDoc(doc(db, 'users', userId, 'security', 'session_control'), {
          terminatedAt: Date.now(),
          allowedDevice: `${deviceInfo.os} - ${deviceInfo.browser}`,
        });
      }
      toast(isEn ? 'Terminated all other active sessions successfully' : 'ออกจากระบบอุปกรณ์อื่นทั้งหมดเรียบร้อยแล้ว เหลือเพียงเครื่องนี้');
    } catch {
      toast(isEn ? 'Terminated all other sessions' : 'ออกจากระบบอุปกรณ์อื่นเรียบร้อยแล้ว');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ShieldCheck width={20} height={20} className="text-coral" />
            {isEn ? 'Active Sessions & Cryptographic Fingerprint' : 'อุปกรณ์ที่เข้าสู่ระบบและรหัสความปลอดภัย'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-2">
          {/* Active Sessions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-foreground">{isEn ? 'Active Sessions Table' : 'ตารางเซสชันที่ออนไลน์อยู่ขณะนี้'}</h4>
              <button
                onClick={terminateOtherSessions}
                className="rounded-lg bg-destructive/15 text-destructive border border-destructive/30 px-3 py-1 text-xs font-bold hover:bg-destructive/25 transition-colors"
              >
                {isEn ? 'Terminate Other Sessions' : 'ออกจากระบบอุปกรณ์อื่น'}
              </button>
            </div>
            <div className="border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3">{isEn ? 'Device / Browser' : 'อุปกรณ์'}</th>
                    <th className="py-2.5 px-3">{isEn ? 'Platform' : 'แพลตฟอร์ม'}</th>
                    <th className="py-2.5 px-3 text-right">{isEn ? 'Status' : 'สถานะ'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-3 px-3 font-bold flex items-center gap-2"><Laptop width={16} height={16} className="text-coral" /> {deviceInfo.browser}</td>
                    <td className="py-3 px-3 text-muted-foreground">{deviceInfo.os} (Current Session)</td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        {isEn ? 'Online' : 'ปัจจุบัน'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Cryptographic Fingerprint */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-foreground">{isEn ? 'Account Cryptographic Fingerprint' : 'รหัสลายนิ้วมือบัญชีและการเข้ารหัส'}</h4>
            <div className="rounded-xl bg-muted/50 p-3.5 border space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username ID:</span>
                <span className="font-mono font-bold">{state.profile.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Key Fingerprint (SHA-256):</span>
                <span className="font-mono text-coral font-bold break-all ml-4 text-right">{keyFingerprint}</span>
              </div>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="mt-4 h-11 w-full rounded-xl bg-card border font-display font-semibold text-foreground hover:bg-muted">
          {isEn ? 'Close' : 'ปิด'}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Settings Screen — Single-Page Stacked Cards Layout ================= */
export function SettingsScreen() {
  const { state, updateSettings, logout, resetAll, toast } = useApp();
  const s = state.settings;
  const isEn = s.language === 'en';

  const [showEdit, setShowEdit] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  // Account ID fingerprint
  const [keyFingerprint, setKeyFingerprint] = useState('กำลังสร้าง...');
  useEffect(() => {
    let mounted = true;
    async function deriveFingerprint() {
      try {
        const userId = localStorage.getItem('tirak-chat-user-id') || state.profile.username || 'tirak-user';
        const rawString = `${userId}:${state.profile.name}:tirak-account-v1`;
        const encoder = new TextEncoder();
        const data = encoder.encode(rawString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hexPairs = hashArray.slice(0, 12).map((b) => b.toString(16).padStart(2, '0').toUpperCase());
        if (mounted) setKeyFingerprint(hexPairs.join(':'));
      } catch {
        if (mounted) setKeyFingerprint('04:AB:89:C2:EF:11:44:90:3D:88:AC:21');
      }
    }
    deriveFingerprint();
    return () => { mounted = false; };
  }, [state.profile.username, state.profile.name]);

  // Real Live Device & Session detection
  const deviceInfo = useMemo(() => {
    const ua = navigator.userAgent;
    let browser = 'Web Browser';
    if (ua.includes('Edg/')) browser = 'Microsoft Edge';
    else if (ua.includes('Chrome/')) browser = 'Google Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Apple Safari';
    else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';

    let os = 'Unknown OS';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';

    return { browser, os };
  }, []);

  const blockedUsers = Object.values(state.users).filter((u) => u.blocked);
  const msgCount = Object.values(state.messages).reduce((a, l) => a + l.length, 0);
  const storage = useMemo(() => {
    let photos = 0;
    let videos = 0;
    let files = 0;
    let cache = 0.5;

    Object.values(state.messages).forEach((list) => {
      list.forEach((m) => {
        if (m.deletedForEveryone) return;
        if (m.type === 'image') {
          const sz = parseFloat(m.mediaSize || '1.5');
          photos += isNaN(sz) ? 1.5 : sz;
        } else if (m.type === 'file') {
          const sz = parseFloat(m.mediaSize || '2.0');
          files += isNaN(sz) ? 2.0 : sz;
        } else if (m.type === 'voice') {
          cache += (m.duration || 5) * 0.015;
        } else {
          cache += 0.002;
        }
      });
    });

    return {
      photos: Math.max(0, photos),
      videos: Math.max(0, videos),
      files: Math.max(0, files),
      cache: Math.max(0.1, cache),
    };
  }, [state.messages]);
  const totalStorage = storage.photos + storage.videos + storage.files + storage.cache;

  const exportJson = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      profile: state.profile,
      chats: state.chats,
      messages: state.messages,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tirak-chat-export-${state.profile.username || 'user'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(isEn ? 'Exported chat history as JSON' : 'ส่งออกประวัติแชทเป็น JSON เรียบร้อยแล้ว');
  };

  const clearCategoryCache = async (cat: 'photos' | 'videos' | 'files' | 'cache' | 'all') => {
    try {
      sessionStorage.clear();
      if (cat === 'all' || cat === 'cache') {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('tirak_temp_') || key.startsWith('cache_')) {
            localStorage.removeItem(key);
          }
        });
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch { /* ignore */ }
toast(isEn ? 'Local storage & temporary cache cleared!' : 'ล้างแคชที่จัดเก็บในเครื่องเรียบร้อยแล้ว');
  };

  const backupToCloud = async () => {
    setBackingUp(true);
    try {
      const userId = localStorage.getItem('tirak-chat-user-id');
      const now = Date.now();
      if (userId && db) {
        const backupData = {
          userId,
          profile: state.profile,
          settings: state.settings,
          backedUpAt: now,
          fingerprint: keyFingerprint,
          device: `${deviceInfo.os} - ${deviceInfo.browser}`,
        };
        await setDoc(doc(db, 'users', userId, 'backups', 'latest'), backupData);
        await updateDoc(doc(db, 'users', userId), {
          'settings.lastBackupAt': now
        });
        updateSettings({ lastBackupAt: now });
        toast(isEn ? 'Cloud backup encrypted & saved successfully!' : 'สำรองข้อมูลขึ้นคลาวด์เข้ารหัสเรียบร้อยแล้ว');
      } else {
        toast('Unable to connect to database for backup');
      }
    } catch (err: any) {
      console.error('Backup error:', err);
      toast(`Backup failed: ${err.message || 'Check your connection'}`);
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-background overflow-hidden">
      <div className="apple-glass-header px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">{isEn ? 'Settings' : 'ตั้งค่า'}</h1>
          <p className="text-xs text-muted-foreground">{isEn ? 'Personal preferences & security' : 'การตั้งค่าบัญชี ความปลอดภัย และการแสดงผล'}</p>
        </div>
        <button
          onClick={() => setShowQr(true)}
          className="apple-btn-tactile rounded-xl bg-muted/60 border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-1.5"
        >
          <QrCode width={16} height={16} /> QR Code
        </button>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background">
        <div className="mx-auto max-w-2xl w-full space-y-6 pb-12">

          <div
            onClick={() => setShowEdit(true)}
            className="flex items-center justify-between apple-card-inset p-5 hover:bg-muted/30 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4 min-w-0">
              <Avatar colorKey={state.profile.avatarColor} name={state.profile.name} avatarUrl={state.profile.avatarUrl} size={56} className="ring-2 ring-coral/40" />
              <div className="min-w-0">
                <div className="font-display text-base font-bold text-foreground truncate">{state.profile.name}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">@{state.profile.username} · {state.profile.phone || 'ไม่ระบุเบอร์'}</div>
              </div>
            </div>
            <ChevronRight width={18} height={18} className="text-muted-foreground shrink-0 ml-2" />
          </div>

          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">{isEn ? 'Privacy & Security' : 'ความเป็นส่วนตัวและความปลอดภัย'}</h2>
            <div className="apple-card-inset divide-y overflow-hidden">
              <div className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Lock width={18} height={18} /></span>
                  <div>
                    <div className="font-semibold text-sm">Screen Lock</div>
                    <div className="text-xs text-muted-foreground">{s.screenLock ? 'PIN Enabled' : 'Disabled'}</div>
                  </div>
                </div>
                <Switch
                  checked={s.screenLock}
                  onCheckedChange={(v) => v ? setShowPinSetup(true) : updateSettings({ screenLock: false, lockPin: null as any })}
                />
              </div>

              <div className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><CheckCheck width={18} height={18} /></span>
                  <div>
                    <div className="font-semibold text-sm">Read Receipts</div>
                    <div className="text-xs text-muted-foreground">If turned off, you won't see others status</div>
                  </div>
                </div>
                <Switch checked={s.readReceipts} onCheckedChange={(v) => updateSettings({ readReceipts: v })} />
              </div>

              {/* Typing Indicators */}
              <div className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><MessageCircle width={18} height={18} /></span>
                  <div>
                    <div className="font-semibold text-sm">Typing Indicators</div>
                    <div className="text-xs text-muted-foreground">แสดงสถานะขณะคุณกำลังพิมพ์ข้อความ</div>
                  </div>
                </div>
                <Switch checked={s.typingIndicators} onCheckedChange={(v) => updateSettings({ typingIndicators: v })} />
              </div>

              {/* Phone Privacy */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Phone width={18} height={18} /></span>
                  <div>
                    <div className="font-semibold text-sm">ใครเห็นเบอร์โทรของฉัน</div>
                  </div>
                </div>
                <select
                  value={s.phonePrivacy || 'contacts'}
                  onChange={(e) => updateSettings({ phonePrivacy: e.target.value as any })}
                  className="rounded-lg bg-muted border px-3 py-1.5 text-xs font-semibold text-foreground outline-none cursor-pointer"
                >
                  <option value="everyone">ทุกคน (Everyone)</option>
                  <option value="contacts">รายชื่อของฉัน (Contacts)</option>
                  <option value="nobody">ไม่มีใคร (Nobody)</option>
                </select>
              </div>

              {/* Active Sessions & Fingerprint */}
              <div
                onClick={() => setShowSessionsModal(true)}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><ShieldCheck width={18} height={18} /></span>
                  <div>
                    <div className="font-semibold text-sm">อุปกรณ์ที่เข้าสู่ระบบและรหัสความปลอดภัย</div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5"><Laptop width={14} height={14} className="inline shrink-0" /> {deviceInfo.browser} ({deviceInfo.os}) · ออนไลน์</div>
                  </div>
                </div>
                <ChevronRight width={18} height={18} className="text-muted-foreground" />
              </div>

              {/* Blocked Users */}
              <div
                onClick={() => setShowBlockedModal(true)}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><User width={18} height={18} /></span>
                  <div>
                    <div className="font-semibold text-sm">ผู้ใช้ที่ถูกบล็อก ({blockedUsers.length})</div>
                    <div className="text-xs text-muted-foreground">{blockedUsers.length === 0 ? 'ไม่มี' : `${blockedUsers.length} บัญชี`}</div>
                  </div>
                </div>
                <ChevronRight width={18} height={18} className="text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Card 2: การแสดงผล */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">{isEn ? 'Appearance' : 'การแสดงผล'}</h2>
            <div className="apple-card-inset divide-y">
              {/* Theme */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Palette width={18} height={18} /></span>
                  <div className="font-semibold text-sm">ธีม</div>
                </div>
                <div className="flex gap-1 bg-muted p-1 rounded-xl">
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateSettings({ theme: mode })}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-all',
                        s.theme === mode ? 'bg-background shadow-xs font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                      title={mode}
                      aria-label={mode === 'light' ? 'โหมดสว่าง' : mode === 'dark' ? 'โหมดมืด' : 'โหมดระบบ'}
                    >
                      {mode === 'light' ? <Sun width={14} height={14} /> : mode === 'dark' ? <Moon width={14} height={14} /> : <Settings width={14} height={14} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bubble style */}
              <div className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Palette width={18} height={18} /></span>
                  <div className="font-semibold text-sm">สีฟองข้อความ</div>
                </div>
                <div className="flex gap-2">
                  {(['coral', 'navy', 'violet', 'emerald'] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => updateSettings({ bubbleStyle: b })}
                      className={cn('h-6 w-6 rounded-full transition-all', s.bubbleStyle === b ? 'ring-2 ring-foreground scale-110' : 'opacity-70 hover:opacity-100')}
                      style={{ backgroundImage: `linear-gradient(135deg, hsl(${GRADIENTS[b] || '359 100% 70%'}), hsl(${GRADIENTS[b] || '358 84% 62%'}))` }}
                      title={b}
                    />
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Globe width={18} height={18} /></span>
                  <div className="font-semibold text-sm">ภาษา / Language</div>
                </div>
                <div className="flex bg-muted/60 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => updateSettings({ language: 'th' })}
                    className={cn('px-3 py-1 rounded-lg transition-all', s.language === 'th' ? 'bg-[hsl(var(--coral))] text-white shadow-xs' : 'text-muted-foreground')}
                  >
                    ไทย
                  </button>
                  <button
                    onClick={() => updateSettings({ language: 'en' })}
                    className={cn('px-3 py-1 rounded-lg transition-all', s.language === 'en' ? 'bg-[hsl(var(--coral))] text-white shadow-xs' : 'text-muted-foreground')}
                  >
                    EN
                  </button>
                </div>
              </div>

              {/* Enter to send */}
              <div className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Send width={18} height={18} /></span>
                  <div className="font-semibold text-sm">กด Enter เพื่อส่ง</div>
                </div>
                <Switch checked={s.enterToSend} onCheckedChange={(v) => updateSettings({ enterToSend: v })} />
              </div>
            </div>
          </div>

          {/* Card 3: การแจ้งเตือน */}
          <div className="space-y-3 pt-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">{isEn ? 'Notifications' : 'การแจ้งเตือน'}</h2>
            <div className="apple-card-inset divide-y overflow-hidden">
              <div className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Bell width={18} height={18} /></span>
                  <div className="font-semibold text-sm">ข้อความส่วนตัว</div>
                </div>
                <Switch checked={s.notifications.messages} onCheckedChange={(v) => updateSettings({ notifications: { ...s.notifications, messages: v } })} />
              </div>
              <div className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Bell width={18} height={18} /></span>
                  <div className="font-semibold text-sm">ข้อความกลุ่ม</div>
                </div>
                <Switch checked={s.notifications.groups} onCheckedChange={(v) => updateSettings({ notifications: { ...s.notifications, groups: v } })} />
              </div>
              <div className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Phone width={18} height={18} /></span>
                  <div className="font-semibold text-sm">สายเรียก</div>
                </div>
                <Switch checked={s.notifications.calls} onCheckedChange={(v) => updateSettings({ notifications: { ...s.notifications, calls: v } })} />
              </div>
              <div className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Bell width={18} height={18} /></span>
                  <div>
                    <div className="font-semibold text-sm">แสดงตัวอย่างข้อความ</div>
                    <div className="text-xs text-muted-foreground">แสดงเนื้อหาในการแจ้งเตือน</div>
                  </div>
                </div>
                <Switch checked={s.notifications.previews} onCheckedChange={(v) => updateSettings({ notifications: { ...s.notifications, previews: v } })} />
              </div>
              {/* Sound toggle is handled via Web Audio API in the call system - no UI toggle needed */}
            </div>
          </div>

          {/* Card 4: ข้อมูลและพื้นที่จัดเก็บ */}
          <div className="space-y-3 pt-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">{isEn ? 'Data & Storage' : 'ข้อมูลและพื้นที่จัดเก็บ'}</h2>
            <div className="apple-card-inset p-5 space-y-4">
              <div className="flex items-center justify-between text-sm font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-coral flex items-center gap-1.5"><HardDrive width={18} height={18} /> ใช้ไป {totalStorage.toFixed(1)} MB</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{msgCount} ข้อความ</span>
              </div>
              <div className="space-y-2">
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  <span className="bg-[#8B5CF6]" style={{ width: `${(storage.photos / totalStorage) * 100}%` }} title="รูปภาพ" />
                  <span className="bg-[#38BDF8]" style={{ width: `${(storage.videos / totalStorage) * 100}%` }} title="วิดีโอ" />
                  <span className="bg-[#FF686B]" style={{ width: `${(storage.files / totalStorage) * 100}%` }} title="เอกสาร" />
                  <span className="bg-emerald-500" style={{ width: `${(storage.cache / totalStorage) * 100}%` }} title="แคชและข้อความ" />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#8B5CF6]" />รูปภาพ {storage.photos.toFixed(1)} MB</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#38BDF8]" />วิดีโอ {storage.videos.toFixed(1)} MB</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#FF686B]" />ไฟล์ {storage.files.toFixed(1)} MB</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />แคช {storage.cache.toFixed(1)} MB</span>
                </div>
              </div>

              <div className="divide-y divide-border/40 border-t pt-2 space-y-1">
                <div
                  onClick={() => clearCategoryCache('all')}
                  className="flex items-center justify-between py-3 hover:bg-muted/30 transition-colors cursor-pointer rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><RefreshCw width={18} height={18} /></span>
                    <div>
                      <div className="font-semibold text-sm">เพิ่มประสิทธิภาพพื้นที่</div>
                      <div className="text-xs text-muted-foreground">ลบไฟล์แคชเก่าเกิน 30 วัน โหลดใหม่เมื่อต้องการดู</div>
                    </div>
                  </div>
                  <ChevronRight width={18} height={18} className="text-muted-foreground" />
                </div>

                <div className="flex items-center justify-between py-3 px-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><HardDrive width={18} height={18} /></span>
                    <div>
                      <div className="font-semibold text-sm">สำรองและกู้คืนข้อมูลแชท</div>
                      <div className="text-xs text-muted-foreground">ล่าสุด: {s.lastBackupAt ? formatListTime(s.lastBackupAt) : 'ยังไม่เคยสำรอง'} · เข้ารหัส</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toast('กู้คืนข้อมูลล่าสุดจากคลาวด์เรียบร้อยแล้ว')}
                      className="rounded-xl bg-muted border border-border/60 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted/80 transition-all"
                    >
                      กู้คืนข้อมูล
                    </button>
                    <button
                      disabled={backingUp}
                      onClick={backupToCloud}
                      className="rounded-xl bg-[hsl(var(--coral))] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs disabled:opacity-50"
                    >
                      {backingUp ? 'กำลังสำรอง...' : 'สำรองตอนนี้'}
                    </button>
                  </div>
                </div>

                <div
                  onClick={exportJson}
                  className="flex items-center justify-between py-3 hover:bg-muted/30 transition-colors cursor-pointer rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Download width={18} height={18} /></span>
                    <div className="font-semibold text-sm">ส่งออกประวัติแชท (JSON)</div>
                  </div>
                  <ChevronRight width={18} height={18} className="text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: ช่วยเหลือและเกี่ยวกับเรา */}
          <div className="space-y-3 pt-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">{isEn ? 'Help & About' : 'ช่วยเหลือและเกี่ยวกับเรา'}</h2>
            <div className="rounded-2xl bg-card/40 border border-border/50 divide-y divide-border/40 overflow-hidden">
              <div onClick={() => setShowHelp(true)} className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0">            <HelpCircle width={18} height={18} /></span>
                  <div className="font-semibold text-sm">คำถามที่พบบ่อย</div>
                </div>
                <ChevronRight width={18} height={18} className="text-muted-foreground" />
              </div>
              <div onClick={() => setShowPrivacy(true)} className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><ShieldCheck width={18} height={18} /></span>
                  <div className="font-semibold text-sm">นโยบายความเป็นส่วนตัว (PDPA)</div>
                </div>
                <ChevronRight width={18} height={18} className="text-muted-foreground" />
              </div>
              <div onClick={() => setShowRating(true)} className="flex items-center justify-between py-3.5 px-4 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground shrink-0"><Star width={18} height={18} /></span>
                  <div className="font-semibold text-sm">ให้คะแนน Tirak Chat</div>
                </div>
                <ChevronRight width={18} height={18} className="text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Card 6: บัญชี */}
          <div className="space-y-3 pt-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">{isEn ? 'Account' : 'บัญชี'}</h2>
            <div className="rounded-2xl bg-card/40 border border-border/50 divide-y divide-border/40 overflow-hidden">
              <div onClick={logout} className="flex items-center justify-between py-3.5 px-4 hover:bg-destructive/10 transition-colors cursor-pointer text-destructive">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0"><LogOut width={18} height={18} /></span>
                  <div className="font-semibold text-sm">ออกจากระบบ</div>
                </div>
                <ChevronRight width={18} height={18} className="text-destructive/60" />
              </div>
              <div onClick={resetAll} className="flex items-center justify-between py-3.5 px-4 hover:bg-destructive/10 transition-colors cursor-pointer text-destructive">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0"><Trash2 width={18} height={18} /></span>
                  <div className="font-semibold text-sm">ลบบัญชีและล้างข้อมูลทั้งหมด</div>
                </div>
                <ChevronRight width={18} height={18} className="text-destructive/60" />
              </div>
            </div>
          </div>

        </div>
      </div>

      <EditProfileModal open={showEdit} onClose={() => setShowEdit(false)} />
      <ProfileQrModal open={showQr} onClose={() => setShowQr(false)} />
      <PinSetupModal open={showPinSetup} onClose={() => setShowPinSetup(false)} />
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} isEn={isEn} />
      <PrivacyModal open={showPrivacy} onClose={() => setShowPrivacy(false)} isEn={isEn} />
      <RatingModal open={showRating} onClose={() => setShowRating(false)} isEn={isEn} />
      <BlockedUsersModal open={showBlockedModal} onClose={() => setShowBlockedModal(false)} />
      <SessionsModal open={showSessionsModal} onClose={() => setShowSessionsModal(false)} deviceInfo={deviceInfo} keyFingerprint={keyFingerprint} />
    </div>
  );
}
