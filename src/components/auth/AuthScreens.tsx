import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ChevronDown, Lock, Phone, ShieldCheck, User,
  Code, Briefcase, Building, BadgeCheck, Globe, Laptop, Eraser
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { TirakLogo, Avatar } from '@/components/shared/Brand';
import { Button } from '@/components/ui/button';
import { GRADIENTS } from '@/config/constants';
import { cn } from '@/lib/utils';
import { generateSecret, buildOTPAuthURI, verifyTOTP } from '@/lib/totp';
import QRCode from 'qrcode';


function formatPhoneNumber(val: string): string {
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 10)}`;
}

/* ================= Splash ================= */
export function SplashScreen() {
  const { setPhase } = useApp();
  useEffect(() => {
    const id = setTimeout(() => setPhase('welcome'), 2200);
    return () => clearTimeout(id);
  }, [setPhase]);

  return (
    <div className="gradient-navy flex h-full flex-col items-center justify-center text-white">
      <div className="splash-logo flex flex-col items-center">
        <TirakLogo size={96} className="drop-shadow-2xl" />
        <h1 className="font-display mt-6 text-3xl font-bold tracking-tight">Tirak Chat</h1>
        <p className="mt-2 text-sm text-white/70">ปลอดภัย อบอุ่น เป็นส่วนตัว</p>
      </div>
      <div className="absolute bottom-10 flex items-center gap-2 text-xs text-white/50">
        <ShieldCheck width={14} height={14} />
        แชทที่ปลอดภัยและเป็นส่วนตัว
      </div>
    </div>
  );
}

/* ================= Welcome ================= */
export function WelcomeScreen() {
  const { setPhase } = useApp();

  return (
    <div className="gradient-navy flex h-full flex-col items-center justify-center text-white">
      <div className="flex flex-col items-center">
        <TirakLogo size={80} className="drop-shadow-2xl" />
        <h1 className="font-display mt-6 text-2xl font-bold tracking-tight">
          ยินดีต้อนรับสู่
        </h1>
        <h2 className="font-display mt-1 text-3xl font-bold tracking-tight">
          TIRAK CHAT
        </h2>
        <p className="mt-3 text-center text-sm text-white/70">
          แพลตฟอร์มแชทที่ปลอดภัยและอบอุ่น<br />
          เข้ารหัสข้อมูลเพื่อความเป็นส่วนตัว
        </p>
      </div>

      <div className="mt-12 flex w-full max-w-xs flex-col gap-3 px-6">
        <Button
          size="lg"
          onClick={() => { localStorage.setItem('tirak_auth_mode', 'register'); setPhase('login'); }}
          className="h-12 rounded-xl bg-[hsl(var(--coral))] font-display text-base font-semibold text-white hover:bg-[hsl(var(--coral-deep))]"
        >
          เริ่มเลย
        </Button>
        <button
          onClick={() => { localStorage.setItem('tirak_auth_mode', 'login'); setPhase('login'); }}
          className="h-12 rounded-xl border border-white/30 text-sm font-medium text-white hover:bg-white/10 transition-colors"
        >
          เข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}

/* ================= Login ================= */
const COUNTRIES = [
  { code: '+66', flag: 'TH', name: 'ไทย' },
  { code: '+1', flag: 'US', name: 'สหรัฐอเมริกา' },
  { code: '+44', flag: 'UK', name: 'สหราชอาณาจักร' },
  { code: '+81', flag: 'JP', name: 'ญี่ปุ่น' },
  { code: '+65', flag: 'SG', name: 'สิงคโปร์' },
];

export function LoginScreen() {
  const { setPhase, state, setPhone } = useApp();
  const phone = state.phone;
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showCountries, setShowCountries] = useState(false);
  const [mode, setMode] = useState<'phone' | 'username'>('phone');
  const [username, setUsername] = useState('');
  const [authMode, setAuthMode] = useState(() => localStorage.getItem('tirak_auth_mode') || 'register');
  const isLogin = authMode === 'login';

  const valid = mode === 'phone' ? phone.replace(/\D/g, '').length >= 9 : username.trim().length >= 3;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="gradient-navy relative flex flex-col items-center px-6 pb-14 pt-16 text-white">
        <button onClick={() => setPhase('welcome')} className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
          <ArrowLeft width={20} height={20} />
        </button>
        <TirakLogo size={72} className="drop-shadow-xl" />
        <h1 className="font-display mt-4 text-2xl font-bold">{isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</h1>
        <p className="mt-1 text-center text-sm text-white/70">
          {isLogin ? 'กรอกเบอร์โทรศัพท์เพื่อเข้าสู่ระบบ' : 'กรอกเบอร์โทรศัพท์เพื่อเริ่มใช้งาน'}
        </p>
        <div className="absolute -bottom-6 left-1/2 h-12 w-12 -translate-x-1/2 rotate-45 bg-background" />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pt-12">
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
          {(['phone', 'username'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all',
                mode === m ? 'bg-card shadow text-foreground' : 'text-muted-foreground',
              )}
            >
              {m === 'phone' ? <Phone width={16} height={16} /> : <User width={16} height={16} />}
              <span>{m === 'phone' ? 'เบอร์โทรศัพท์' : 'ชื่อผู้ใช้'}</span>
            </button>
          ))}
        </div>

        {mode === 'phone' ? (
          <>
            <label className="mb-2 text-sm font-medium">เบอร์โทรศัพท์ของคุณ</label>
            <div className="flex gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowCountries(!showCountries)}
                  className="flex h-12 items-center gap-1 rounded-xl border bg-card px-3 text-sm"
                >
                  <span>{country.flag}</span>
                  <span>{country.code}</span>
                  <ChevronDown width={14} height={14} className="text-muted-foreground" />
                </button>
                {showCountries && (
                  <div className="absolute left-0 top-14 z-20 w-56 overflow-hidden rounded-xl border bg-popover shadow-xl fade-in">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => { setCountry(c); setShowCountries(false); }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted"
                      >
                        <span>{c.flag}</span>
                        <span className="flex-1 text-left">{c.name}</span>
                        <span className="text-muted-foreground">{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative flex-1">
                <Phone width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  placeholder="0xx-xxx-xxxx"
                  inputMode="tel"
                  className="h-12 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              เราจะส่งรหัส OTP ทาง SMS เพื่อยืนยันตัวตน — เบอร์ของคุณจะถูกซ่อนจากผู้อื่นตามการตั้งค่าความเป็นส่วนตัว
            </p>
          </>
        ) : (
          <>
            <label className="mb-2 text-sm font-medium">ชื่อผู้ใช้ (Username)</label>
            <div className="relative">
              <User width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
                placeholder="yourname"
                className="h-12 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              ใช้ Username แทนเบอร์โทรเพื่อความเป็นส่วนตัวสูงสุด — คนอื่นหาคุณเจอโดยไม่เห็นเบอร์
            </p>
          </>
        )}

        <Button
          size="lg"
          disabled={!valid}
          onClick={() => {
            if (mode === 'phone') {
              const cleanPhone = phone.replace(/\D/g, '');
              let formattedPhone = cleanPhone;
              if (cleanPhone.startsWith('0')) {
                formattedPhone = cleanPhone.slice(1);
              }
              const fullPhone = `${country.code} ${formattedPhone.slice(0, 2)} ${formattedPhone.slice(2, 5)} ${formattedPhone.slice(5)}`;

              setPhone(fullPhone);
              localStorage.setItem('tirak_temp_mode', 'phone');
              localStorage.setItem('tirak_temp_val', fullPhone);
            } else {
              const uName = '@' + username.trim();
              setPhone(uName);
              localStorage.setItem('tirak_temp_mode', 'username');
              localStorage.setItem('tirak_temp_val', uName);
            }

            if (!isLogin) {
              const secret = generateSecret();
              localStorage.setItem('tirak_totp_secret', secret);
              const account = mode === 'phone' ? phone.replace(/\D/g, '') : username.trim();
              const otpUri = buildOTPAuthURI(secret, account);
              localStorage.setItem('tirak_totp_uri', otpUri);
            }

            setPhase('otp');
          }}
          className="mt-8 h-12 rounded-xl bg-[hsl(var(--coral))] font-display text-base font-semibold text-white hover:bg-[hsl(var(--coral-deep))]"
        >
          {isLogin ? 'เข้าสู่ระบบ' : 'ขอรหัส OTP'}
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isLogin ? 'ยังไม่มีบัญชี? ' : 'มีบัญชีอยู่แล้ว? '}
          <button
            onClick={() => {
              const next = isLogin ? 'register' : 'login';
              localStorage.setItem('tirak_auth_mode', next);
              setAuthMode(next);
            }}
            className="font-medium text-[hsl(var(--coral))] hover:underline"
          >
            {isLogin ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </button>
        </p>
      </div>
    </div>
  );
}

/* ================= OTP ================= */
export function OtpScreen() {
  const { setPhase, state, toast, checkUserExists, completeRegistration } = useApp();
  const phone = state.phone;
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const authMode = localStorage.getItem('tirak_auth_mode') || 'register';
  const isLogin = authMode === 'login';
  const secret = localStorage.getItem('tirak_totp_secret') || '';
  const otpUri = localStorage.getItem('tirak_totp_uri') || '';

  useEffect(() => {
    inputs.current[0]?.focus();
    if (!isLogin && otpUri) {
      QRCode.toDataURL(otpUri, { width: 200, margin: 2, color: { dark: '#1A2648', light: '#FFFFFF' } })
        .then(setQrDataUrl)
        .catch(() => {});
    }
  }, [otpUri, isLogin]);

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length !== 6) return;

    setLoading(true);
    setError('');

    try {
      const mode = localStorage.getItem('tirak_temp_mode') as 'phone' | 'username' || 'phone';
      const val = localStorage.getItem('tirak_temp_val') || phone;

      if (isLogin) {
        const user = await checkUserExists(val, mode);
        if (!user) {
          setError('ไม่พบบัญชีผู้ใช้นี้ในระบบ');
          setDigits(Array(6).fill(''));
          inputs.current[0]?.focus();
          setLoading(false);
          return;
        }

        const storedSecret = localStorage.getItem('tirak_totp_secret') || '';
        if (!storedSecret) {
          setError('ไม่พบข้อมูล Authenticator สำหรับบัญชีนี้');
          setDigits(Array(6).fill(''));
          inputs.current[0]?.focus();
          setLoading(false);
          return;
        }

        const isValid = await verifyTOTP(storedSecret, code);
        if (!isValid) {
          setError('รหัสไม่ถูกต้อง กรุณาเปิด Authenticator แล้วลองใหม่');
          setDigits(Array(6).fill(''));
          inputs.current[0]?.focus();
          setLoading(false);
          return;
        }

        completeRegistration();
        const hasLock = (user as any).settings?.screenLock && !!(user as any).settings?.lockPin;
        setPhase(hasLock ? 'locked' : 'app');
        toast('เข้าสู่ระบบสำเร็จ!');
      } else {
        const isValid = await verifyTOTP(secret, code);
        if (!isValid) {
          setError('รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่');
          setDigits(Array(6).fill(''));
          inputs.current[0]?.focus();
          setLoading(false);
          return;
        }

        const user = await checkUserExists(val, mode);
        await new Promise((resolve) => setTimeout(resolve, 300));

        if (user) {
          completeRegistration();
          const hasLock = (user as any).settings?.screenLock && !!(user as any).settings?.lockPin;
          setPhase(hasLock ? 'locked' : 'app');
          toast('เข้าสู่ระบบสำเร็จ!');
        } else {
          localStorage.setItem('tirak_totp_verified', 'true');
          setPhase('profile');
        }
      }
    } catch (err) {
      console.error('OTP check error:', err);
      toast(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const code = digits.join('');
  useEffect(() => {
    if (code.length === 6) handleVerify();
  }, [code]);

  const handleChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setError('');
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };

  return (
    <div className="flex h-full flex-col bg-background px-6 relative overflow-y-auto">
      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm fade-in">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-[hsl(var(--coral))]" />
            <p className="font-display text-sm font-medium text-muted-foreground animate-pulse">
              {isLogin ? 'กำลังเข้าสู่ระบบ...' : 'กำลังตรวจสอบการยืนยัน...'}
            </p>
          </div>
        </div>
      )}
      <button onClick={() => setPhase('login')} className="mt-4 flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
        <ArrowLeft width={20} height={20} />
      </button>
      <div className="mx-auto mt-4 w-full max-w-sm pb-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-coral-soft">
          <ShieldCheck width={32} height={32} className="text-coral" />
        </div>
        <h2 className="font-display text-center text-2xl font-bold">
          {isLogin ? 'เข้าสู่ระบบ' : 'ยืนยันเบอร์โทรศัพท์'}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{phone || 'หมายเลขของคุณ'}</span>
        </p>

        {isLogin ? (
          <div className="mt-6 flex flex-col items-center">
            <div className="rounded-2xl bg-muted/50 border px-6 py-5 text-center w-full">
              <Lock width={28} height={28} className="mx-auto mb-3 text-[hsl(var(--coral))]" />
              <p className="text-sm font-medium text-foreground">เปิด Google Authenticator</p>
              <p className="mt-1 text-xs text-muted-foreground">กรอกรหัส 6 หลักที่แสดงใน Tirak Chat</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center">
            <p className="mb-3 text-center text-xs text-muted-foreground">
              สแกน QR Code ด้วย <span className="font-bold text-foreground">Google Authenticator</span><br />
              เพื่อรับรหัส OTP 6 หลัก
            </p>
            {qrDataUrl && (
              <div className="rounded-2xl bg-white p-3 shadow-lg border">
                <img src={qrDataUrl} alt="TOTP QR Code" className="w-40 h-40" />
              </div>
            )}
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {showSecret ? 'ซ่อนรหัส' : 'ใส่รหัสด้วยตนเอง'}
            </button>
            {showSecret && (
              <div className="mt-2 rounded-xl bg-muted px-4 py-2 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">กรอกรหัสนี้ใน Authenticator App:</p>
                <code className="text-xs font-bold text-foreground tracking-widest select-all">{secret}</code>
              </div>
            )}
          </div>
        )}

        {/* OTP Input */}
        <p className="mt-6 text-center text-xs font-medium text-muted-foreground">
          กรอกรหัส 6 หลักจาก Authenticator
        </p>
        <div className="mt-3 flex justify-center gap-2.5" onPaste={(e) => {
          const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
          if (text) {
            setDigits(text.split('').concat(Array(6).fill('')).slice(0, 6));
            inputs.current[Math.min(text.length, 5)]?.focus();
          }
        }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              value={d}
              inputMode="numeric"
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
              }}
              className={cn(
                'h-14 w-11 rounded-xl border bg-card text-center font-display text-xl font-bold outline-none transition-all',
                d ? 'border-[hsl(var(--coral))] ring-2 ring-[hsl(var(--coral)/0.25)]' : 'focus:ring-2 focus:ring-ring',
                error ? 'border-destructive ring-destructive/25' : '',
              )}
            />
          ))}
        </div>

        {error && (
          <p className="mt-3 text-center text-xs font-medium text-destructive">{error}</p>
        )}

        {!isLogin && (
          <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
            ยังไม่มี Google Authenticator?<br />
            <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer" className="font-medium text-[hsl(var(--coral))] hover:underline">
              ดาวน์โหลด Android
            </a>
            {' · '}
            <a href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer" className="font-medium text-[hsl(var(--coral))] hover:underline">
              ดาวน์โหลด iOS
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

/* ================= Profile Setup ================= */
export function ProfileSetupScreen() {
  const { state, completeRegistration, setPhase, signUpUser, validateUsernameUniqueness, toast } = useApp();
  const profile = state.profile;
  const [name, setName] = useState(profile.name === 'คุณ' ? '' : profile.name);
  const [username, setUsername] = useState(profile.username.replace('@', ''));
  const [about, setAbout] = useState('');
  const [colorKey, setColorKey] = useState('coral');
  const [emoji, setEmoji] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const ICONS = ['user', 'briefcase', 'building', 'shield', 'badge', 'globe', 'laptop', 'code'];
  const ICON_MAP: Record<string, React.ComponentType<{ width?: number; height?: number; className?: string }>> = {
    user: User,
    briefcase: Briefcase,
    building: Building,
    shield: ShieldCheck,
    badge: BadgeCheck,
    globe: Globe,
    laptop: Laptop,
    code: Code,
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background px-6 pb-8">
      <div className="mx-auto mt-10 w-full max-w-sm">
        <h2 className="font-display text-center text-2xl font-bold">ตั้งค่าโปรไฟล์</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">ข้อมูลนี้จะแสดงให้รายชื่อของคุณเห็น</p>

        <div className="mt-8 flex flex-col items-center">
          <Avatar name={name || 'ค'} colorKey={colorKey} emoji={emoji} size={96} />
          <div className="mt-4 flex gap-2">
            {Object.keys(GRADIENTS).slice(0, 6).map((k) => (
              <button
                key={k}
                onClick={() => setColorKey(k)}
                className={cn('h-8 w-8 rounded-full transition-transform', colorKey === k && 'scale-110 ring-2 ring-offset-2 ring-[hsl(var(--coral))] ring-offset-background')}
                style={{ background: GRADIENTS[k] }}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-1.5">
            {ICONS.map((key) => {
              const IconComp = ICON_MAP[key];
              return (
                <button
                  key={key}
                  onClick={() => setEmoji(emoji === key ? undefined : key)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl transition-all',
                    emoji === key ? 'bg-coral-soft ring-1 ring-[hsl(var(--coral))] text-coral' : 'bg-muted hover:bg-muted/70 text-muted-foreground'
                  )}
                >
                  <IconComp width={18} height={18} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">ชื่อที่แสดง *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ต้น ธนากร"
              className="h-12 w-full rounded-xl border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">ชื่อผู้ใช้</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
              <input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))} placeholder="username"
                className="h-12 w-full rounded-xl border bg-card pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">เกี่ยวกับคุณ</label>
            <input value={about} onChange={(e) => setAbout(e.target.value)} placeholder="แนะนำตัวสั้น ๆ"
              className="h-12 w-full rounded-xl border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <Button
          size="lg"
          disabled={loading || !name.trim()}
          onClick={async () => {
            setLoading(true);
            const tempVal = localStorage.getItem('tirak_temp_val') || '';
            const tempMode = localStorage.getItem('tirak_temp_mode') || 'phone';
            
            const userPhone = tempMode === 'phone' ? tempVal : '';
            const userUsername = `@${username.trim() || 'you'}`;

            try {
              const isUnique = await validateUsernameUniqueness(userUsername);
              if (!isUnique) {
                toast(`ชื่อผู้ใช้ ${userUsername} มีผู้อื่นใช้งานแล้ว กรุณาเลือกชื่ออื่น`);
                setLoading(false);
                return;
              }

              await signUpUser({
                name: name.trim(),
                username: userUsername,
                phone: userPhone,
                about: about.trim() || 'ใช้งาน Tirak Chat เป็นส่วนตัว',
                avatarColor: colorKey,
                avatarEmoji: emoji,
              });

              completeRegistration();
              setPhase('pin-setup');
              toast('สร้างบัญชีผู้ใช้สำเร็จ!');
            } catch (err) {
              console.error('Account creation error:', err);
              toast(`เกิดข้อผิดพลาดในการสร้างบัญชี: ${(err as Error).message}`);
            } finally {
              setLoading(false);
            }
          }}
          className="mt-8 h-12 w-full rounded-xl bg-[hsl(var(--coral))] font-display text-base font-semibold text-white hover:bg-[hsl(var(--coral-deep))]"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span>กำลังสร้างบัญชี...</span>
            </div>
          ) : (
            'เริ่มใช้งาน Tirak Chat'
          )}
        </Button>
      </div>
    </div>
  );
}

/* ================= PIN Setup (Onboarding) ================= */
export function PinSetupScreen() {
  const { updateSettings, setPhase, toast } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [shake, setShake] = useState(false);
  const pin = step === 1 ? pin1 : pin2;
  const setPin = step === 1 ? setPin1 : setPin2;
  const maxLen = 6;

  useEffect(() => {
    if (step === 1 && pin1.length === maxLen) {
      setStep(2);
    }
    if (step === 2 && pin2.length === maxLen) {
      if (pin1 === pin2) {
        updateSettings({ screenLock: true, lockPin: pin1 });
        toast('ตั้งรหัส PIN สำเร็จ');
        setPhase('app');
      } else {
        setShake(true);
        toast('รหัส PIN ไม่ตรงกัน กรุณาลองใหม่');
        setTimeout(() => {
          setStep(1);
          setPin1('');
          setPin2('');
          setShake(false);
        }, 500);
      }
    }
  }, [pin1, pin2, step]);

  return (
    <div className="gradient-navy flex h-full flex-col items-center justify-center px-8 text-white">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
        <Lock width={28} height={28} />
      </div>
      <h2 className="font-display mt-5 text-xl font-bold">
        {step === 1 ? 'ตั้งรหัส PIN' : 'ยืนยันรหัส PIN'}
      </h2>
      <p className="mt-1.5 text-center text-sm text-white/60">
        {step === 1
          ? 'สร้างรหัส PIN 6 หลัก สำหรับล็อกหน้าจอ'
          : 'กรอกรหัส PIN อีกครั้งเพื่อยืนยัน'}
      </p>

      <div className={cn('mt-8 flex gap-3', shake && 'lock-shake')}>
        {Array.from({ length: maxLen }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border-2 border-white/50 transition-all',
              i < pin.length && 'border-[hsl(var(--coral))] bg-[hsl(var(--coral))]',
            )}
          />
        ))}
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((k, i) => (
          <button
            key={i}
            disabled={k === ''}
            onClick={() => {
              if (k === 'del') setPin(pin.slice(0, -1));
              else if (k !== '' && pin.length < maxLen) setPin(pin + String(k));
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 font-display text-2xl font-semibold backdrop-blur transition-all hover:bg-white/20 active:scale-95 disabled:opacity-0"
          >
            {k === 'del' ? <Eraser width={24} height={24} /> : k}
          </button>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-white/40">
        PIN จะใช้ปลดล็อกแอปทุกครั้งที่เปิดใช้งาน
      </p>
    </div>
  );
}

export function LockScreen() {
  const { unlock, state, toast } = useApp();
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const pinLen = state.settings.lockPin?.length ?? 4;

  useEffect(() => {
    if (pin.length === pinLen) {
      const ok = unlock(pin);
      if (!ok) {
        setShake(true);
        toast('รหัส PIN ไม่ถูกต้อง');
        setTimeout(() => { setPin(''); setShake(false); }, 500);
      }
    }
  }, [pin, pinLen, unlock, toast]);

  return (
    <div className="gradient-navy flex h-full flex-col items-center justify-center px-8 text-white">
      <TirakLogo size={72} />
      <h2 className="font-display mt-6 text-xl font-bold">Tirak Chat ถูกล็อก</h2>
      <p className="mt-1 text-sm text-white/60">ใส่รหัส PIN เพื่อปลดล็อก</p>

      <div className={cn('mt-8 flex gap-3', shake && 'lock-shake')}>
        {Array.from({ length: pinLen }).map((_, i) => (
          <div key={i} className={cn('h-4 w-4 rounded-full border-2 border-white/50 transition-all', i < pin.length && 'border-[hsl(var(--coral))] bg-[hsl(var(--coral))]')} />
        ))}
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((k, i) => (
          <button
            key={i}
            disabled={k === ''}
            onClick={() => {
              if (k === 'del') setPin((p) => p.slice(0, -1));
              else if (k !== '') setPin((p) => (p.length < pinLen ? p + k : p));
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 font-display text-2xl font-semibold backdrop-blur transition-all hover:bg-white/20 active:scale-95 disabled:opacity-0"
          >
            {k === 'del' ? <Eraser width={24} height={24} /> : k}
          </button>
        ))}
      </div>

      {/* Biometric lock is hidden in production unless WebAuthn key is registered */}
    </div>
  );
}
