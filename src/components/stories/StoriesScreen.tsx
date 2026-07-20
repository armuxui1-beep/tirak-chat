import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Send, X, Camera, Image, Type, Sparkles } from 'lucide-react';
import { useApp, ME_ID } from '@/store/AppContext';
import { Avatar } from '@/components/shared/Brand';
import { GRADIENTS } from '@/config/constants';
import { formatListTime } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const STORY_MS = 5000;

const GRADIENT_STYLES: Record<string, string> = {
  sunset: 'linear-gradient(135deg, hsl(359 100% 70%), hsl(358 84% 62%))',
  navy: 'linear-gradient(135deg, hsl(224 47% 20%), hsl(224 47% 10%))',
  emerald: 'linear-gradient(135deg, hsl(160 84% 39%), hsl(164 86% 16%))',
  violet: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(263 70% 35%))',
  gold: 'linear-gradient(135deg, hsl(43 96% 58%), hsl(35 92% 33%))',
  midnight: 'linear-gradient(135deg, hsl(220 30% 12%), hsl(0 0% 5%))',
};

const QUICK_REACTIONS = ['❤️', '🔥', '👍', '🎉'];

const SAMPLE_PHOTOS = [
  { id: 'g1', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80' },
  { id: 'g2', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80' },
  { id: 'g3', url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80' },
  { id: 'g4', url: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&auto=format&fit=crop&q=80' },
];

/* ================= IG-style Story Viewer ================= */
export function StoryViewerOverlay({ userId, onClose, allUserIds, onPrevUser, onNextUser }: {
  userId: string; onClose: () => void;
  allUserIds?: string[]; onPrevUser?: () => void; onNextUser?: () => void;
}) {
  const { state, viewStoryItem, sendMessage, createDirectChat, toast } = useApp();
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const raf = useRef<number>(0);
  const startRef = useRef<number>(Date.now());

  const story = useMemo(() => state.stories.find((s) => s.userId === userId && s.items.length > 0), [state.stories, userId]);
  const user = userId === ME_ID ? null : state.users[userId];
  const displayName = userId === ME_ID ? 'สตอรี่ของคุณ' : user?.name ?? '';

  const goNext = () => {
    if (!story) return;
    if (idx < story.items.length - 1) {
      setIdx(idx + 1);
      setProgress(0);
      startRef.current = Date.now();
    } else if (onNextUser) {
      onNextUser();
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (idx > 0) {
      setIdx(idx - 1);
      setProgress(0);
      startRef.current = Date.now();
    } else if (onPrevUser) {
      onPrevUser();
    }
  };

  useEffect(() => { setIdx(0); setProgress(0); startRef.current = Date.now(); }, [userId]);

  useEffect(() => {
    if (!story || paused) return;
    const item = story.items[idx];
    if (item) viewStoryItem(story.userId, item.id);
    const tick = () => {
      const p = (Date.now() - startRef.current) / STORY_MS;
      if (p >= 1) { goNext(); return; }
      setProgress(p);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [story?.id, idx, userId, paused]);

  const handleTap = (e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth;
    if (x < 0.33) goPrev();
    else if (x > 0.67) goNext();
    else setPaused((p) => !p);
  };

  const handleSendReaction = async (emoji: string) => {
    if (!userId || userId === ME_ID) return;
    const chatId = await createDirectChat(userId);
    sendMessage(chatId, { text: `[${emoji}] ตอบกลับสตอรี่ของคุณ`, type: 'text' });
    toast(`ส่ง ${emoji} แล้ว`);
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !userId || userId === ME_ID) return;
    const chatId = await createDirectChat(userId);
    sendMessage(chatId, { text: reply.trim(), type: 'text' });
    toast('ส่งข้อความแล้ว');
    setReply('');
  };

  if (!story) return null;
  const item = story.items[Math.min(idx, story.items.length - 1)];

  return (
    <div className="fixed inset-0 z-50 bg-black select-none" onClick={handleTap}>
      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center" style={item.mediaUrl ? undefined : { background: GRADIENT_STYLES[item.gradient] || GRADIENTS[item.gradient] }}>
        {item.mediaUrl && (
          <img src={item.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
        )}
        {item.kind === 'text' && item.text && (
          <p className="px-8 text-center font-display text-2xl font-bold text-white leading-relaxed">{item.text}</p>
        )}
      </div>

      {/* Top progress bars */}
      <div className="absolute inset-x-0 top-0 z-30 flex gap-1 p-2 pt-safe">
        {story.items.map((it, i) => (
          <div key={it.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/40">
            <div className="h-full rounded-full bg-white transition-all duration-75"
              style={{ width: i < idx ? '100%' : i === idx ? `${progress * 100}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-3 z-30 flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar name={displayName} colorKey={userId === ME_ID ? state.profile.avatarColor : user?.avatarColor ?? 'navy'} emoji={userId === ME_ID ? state.profile.avatarEmoji : user?.avatarEmoji} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white drop-shadow">{displayName}</p>
            <p className="text-[10px] text-white/60">{formatListTime(item.createdAt)}</p>
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white">
          <X width={18} height={18} />
        </button>
      </div>

      {/* Bottom input + reactions */}
      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-12 pb-safe px-3"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-1 rounded-full bg-white/15 px-4 py-2 border border-white/20">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
              placeholder={userId === ME_ID ? '' : `ตอบกลับ ${displayName.split(' ')[0]}...`}
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
            {reply.trim() && (
              <button onClick={handleSendReply} className="text-coral">
                <Send width={18} height={18} />
              </button>
            )}
          </div>
          {userId !== ME_ID && (
            <div className="flex gap-1">
              {QUICK_REACTIONS.map((emoji) => (
                <button key={emoji} onClick={() => handleSendReaction(emoji)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-lg transition-all active:scale-125">
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Simplified Story Creator ================= */
function StoryCreator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addStory, toast } = useApp();
  const [mode, setMode] = useState<'camera' | 'text'>('camera');
  const [text, setText] = useState('');
  const [gradient, setGradient] = useState('sunset');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaKind, setMediaKind] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!open || mode !== 'camera' || mediaUrl) {
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      setCameraReady(false);
      return;
    }
    async function startCamera() {
      try {
        if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false,
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
      } catch { setCameraReady(false); }
    }
    startCamera();
    return () => { active = false; if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); } };
  }, [open, mode, mediaUrl, facingMode]);

  if (!open) return null;

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `stories/${ME_ID}/story_${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed', null, (err) => { setUploading(false); toast(`อัปโหลดไม่สำเร็จ: ${err.message}`); }, async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setMediaUrl(url); setMediaKind(file.type.startsWith('video/') ? 'video' : 'image'); setUploading(false);
      });
    } catch { setUploading(false); }
    e.target.value = '';
  };

  const takePhoto = () => {
    if (cameraReady && videoRef.current?.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1080;
      canvas.height = videoRef.current.videoHeight || 1920;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        setMediaUrl(canvas.toDataURL('image/jpeg', 0.92)); setMediaKind('image'); return;
      }
    }
    const fallback = SAMPLE_PHOTOS[Math.floor(Math.random() * SAMPLE_PHOTOS.length)].url;
    setMediaUrl(fallback); setMediaKind('image');
  };

  const handlePublish = () => {
    if (mode === 'text') {
      if (!text.trim()) return;
      addStory({ kind: 'text', text: text.trim(), gradient });
    } else {
      if (!mediaUrl) return;
      addStory({ kind: mediaKind, text: text.trim() || undefined, mediaUrl, gradient: 'navy' });
    }
    toast('เผยแพร่สตอรี่แล้ว');
    onClose();
  };

  const GRADIENT_KEYS = ['sunset', 'navy', 'emerald', 'violet', 'gold', 'midnight'];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="z-40 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white">
          <X width={20} height={20} />
        </button>
        <p className="text-sm font-semibold text-white">สตอรี่ใหม่</p>
        <button
          onClick={handlePublish}
          disabled={uploading || (mode === 'text' ? !text.trim() : !mediaUrl)}
          className="rounded-full bg-coral px-5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        >
          {uploading ? 'กำลังอัปโหลด...' : 'แชร์'}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 relative flex items-center justify-center">
        {mode === 'camera' && !mediaUrl && (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }} />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <Camera width={48} height={48} className="text-white/40" />
              </div>
            )}
            {/* Shutter bottom area */}
            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8">
              <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                <Image width={20} height={20} className="text-white" />
                <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFilePick} />
              </label>
              <button onClick={takePhoto} className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-black/30 active:scale-90 transition-transform">
                <div className="h-12 w-12 rounded-full bg-white" />
              </button>
              <button onClick={() => setFacingMode((f) => f === 'user' ? 'environment' : 'user')} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                <Camera width={20} height={20} className="text-white" />
              </button>
            </div>
          </>
        )}
        {(mediaUrl || mode === 'text') && (
          <div className="absolute inset-0 flex items-center justify-center" style={{
            background: mode === 'text' ? GRADIENT_STYLES[gradient] : '#000'
          }}>
            {mediaUrl && <img src={mediaUrl} alt="" className="max-h-full max-w-full object-contain" />}
            {mode === 'text' && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="พิมพ์ข้อความ..."
                className="w-full bg-transparent text-center font-display text-3xl font-bold text-white outline-none placeholder:text-white/30 resize-none px-8"
                rows={3}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom bar for text mode */}
      {mode === 'text' && (
        <div className="flex flex-wrap justify-center gap-2 px-4 py-4 bg-black">
          {GRADIENT_KEYS.map((k) => (
            <button key={k} onClick={() => setGradient(k)}
              className={cn('h-8 w-8 rounded-full border-2 transition-transform', gradient === k ? 'border-white scale-110' : 'border-transparent')}
              style={{ background: GRADIENT_STYLES[k] }}
            />
          ))}
        </div>
      )}

      {/* Mode switch */}
      <div className="flex items-center justify-center gap-6 pb-safe px-4 py-3 bg-black/90">
        <button onClick={() => { setMode('camera'); setMediaUrl(''); }} className={cn('flex items-center gap-1.5 text-xs font-medium', mode === 'camera' ? 'text-white' : 'text-white/40')}>
          <Camera width={16} height={16} /> ถ่ายรูป
        </button>
        <button onClick={() => setMode('text')} className={cn('flex items-center gap-1.5 text-xs font-medium', mode === 'text' ? 'text-white' : 'text-white/40')}>
          <Type width={16} height={16} /> ข้อความ
        </button>
      </div>
    </div>
  );
}

/* ================= Wrapper for App.tsx ================= */
export function StoryViewer() {
  const { state, setViewingStoryOf } = useApp();
  const userId = state.viewingStoryOf;
  if (!userId) return null;

  const allStories = state.stories.filter((s) => s.userId !== ME_ID && s.items.length > 0);
  const myStory = state.stories.find((s) => s.userId === ME_ID);
  const allIds = [
    ...(myStory && myStory.items.length > 0 ? [ME_ID] : []),
    ...allStories.map((s) => s.userId),
  ];
  const currentIdx = allIds.indexOf(userId);

  const goNext = () => {
    if (currentIdx < allIds.length - 1) setViewingStoryOf(allIds[currentIdx + 1]);
    else setViewingStoryOf(null);
  };
  const goPrev = () => {
    if (currentIdx > 0) setViewingStoryOf(allIds[currentIdx - 1]);
  };

  if (userId === '__add__') {
    return <StoryCreator open={true} onClose={() => setViewingStoryOf(null)} />;
  }

  return (
    <StoryViewerOverlay
      userId={userId}
      onClose={() => setViewingStoryOf(null)}
      onPrevUser={goPrev}
      onNextUser={goNext}
    />
  );
}
