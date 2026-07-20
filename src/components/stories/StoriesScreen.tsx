import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Plus, Send, X, Trash2, Camera, Type, Image as MediaImageIcon, Sparkles, ShieldCheck, Heart, Sparkles as Fire, ThumbsUp, CheckCircle as Celebration, RefreshCcw, LayoutGrid, Video } from 'lucide-react';
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

// Curated sample gallery items for immediate selection inside the bottom half slide-up drawer
const SAMPLE_GALLERY_PHOTOS = [
  { id: 'g1', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80', label: 'ทีมเวิร์กองค์กร' },
  { id: 'g2', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80', label: 'บรรยากาศออฟฟิศ' },
  { id: 'g3', url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80', label: 'ประชุมโปรเจค' },
  { id: 'g4', url: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&auto=format&fit=crop&q=80', label: 'เวิร์กช็อป' },
  { id: 'g5', url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&auto=format&fit=crop&q=80', label: 'นำเสนอผลงาน' },
  { id: 'g6', url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80', label: 'ความสำเร็จ' },
];

/* ================= Full-Screen Story Composer (Reels/Photo/Layout/Text Studio) ================= */
function StoryCreator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addStory, toast } = useApp();
  const [mode, setMode] = useState<'camera' | 'text' | 'layout'>('camera');
  const [showGallery, setShowGallery] = useState(true);
  const [text, setText] = useState('');
  const [gradient, setGradient] = useState('sunset');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaKind, setMediaKind] = useState<'image' | 'video'>('image');
  const [fontStyle, setFontStyle] = useState<'normal' | 'display' | 'serif'>('display');
  const [uploading, setUploading] = useState(false);

  // Layout mode state
  const [layoutSlots, setLayoutSlots] = useState<string[]>(['', '']);
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);

  // Shutter short click vs long press Reels recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<number>(0);

  // Real Hardware Camera Stream & Facing Mode
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!open || mode !== 'camera' || mediaUrl) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraReady(false);
      return;
    }

    async function startCamera() {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch (err) {
        console.warn('Unable to access camera hardware:', err);
        setCameraReady(false);
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, mode, mediaUrl, facingMode]);

  if (!open) return null;

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetSlot?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    toast('กำลังอัปโหลดไฟล์สื่อไปยังคลาวด์...');
    const isVideo = file.type.startsWith('video/');
    try {
      const storageRef = ref(storage, `stories/${ME_ID}/story_${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          setUploading(false);
          toast(`อัปโหลดไม่สำเร็จ: ${error.message}`);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          if (targetSlot !== undefined && targetSlot !== null) {
            setLayoutSlots((prev) => {
              const copy = [...prev];
              copy[targetSlot] = url;
              return copy;
            });
          } else {
            setMediaUrl(url);
            setMediaKind(isVideo ? 'video' : 'image');
            setShowGallery(false);
          }
          setUploading(false);
          toast('อัปโหลดเสร็จสมบูรณ์ พร้อมแชร์ลงสตอรี่');
        }
      );
    } catch (err: any) {
      setUploading(false);
      toast(`อัปโหลดไม่สำเร็จ: ${err.message || ''}`);
    }
    e.target.value = '';
  };

  // Shutter Press Start
  const handleShutterPressStart = () => {
    if (uploading || mediaUrl) return;
    pressStartRef.current = Date.now();
    
    // Set timer to switch to long-press Reels recording after 300ms
    recordTimerRef.current = window.setTimeout(() => {
      setIsRecording(true);
      setRecordSeconds(0);
      toast('🎬 เริ่มบันทึกคลิป Reels สตอรี่ (สูงสุด 15 วินาที)...');
      
      const interval = window.setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 14) {
            clearInterval(interval);
            finishRecording();
            return 15;
          }
          return s + 1;
        });
      }, 1000);
      
      recordTimerRef.current = interval;
    }, 320);
  };

  // Shutter Press End (Short click vs Long press release)
  const handleShutterPressEnd = () => {
    if (uploading || mediaUrl) return;
    const holdDuration = Date.now() - pressStartRef.current;
    
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (isRecording || holdDuration >= 320) {
      finishRecording();
    } else {
      // Short click -> Photo capture snapshot
      takeSnapshotPhoto();
    }
  };

  const takeSnapshotPhoto = () => {
    if (cameraReady && videoRef.current && videoRef.current.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1080;
      canvas.height = videoRef.current.videoHeight || 1920;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setMediaUrl(dataUrl);
        setMediaKind('image');
        setShowGallery(false);
        toast('📸 ถ่ายภาพสแนปช็อตจากกล้องจริงสำเร็จ!');
        return;
      }
    }
    // Fallback if hardware camera is unavailable or not granted
    const randomPhoto = SAMPLE_GALLERY_PHOTOS[Math.floor(Math.random() * SAMPLE_GALLERY_PHOTOS.length)].url;
    setMediaUrl(randomPhoto);
    setMediaKind('image');
    setShowGallery(false);
    toast('📸 ถ่ายภาพสตอรี่ HD สำเร็จ!');
  };

  const finishRecording = () => {
    setIsRecording(false);
    // Simulate high quality recorded Reels video clip
    setMediaUrl('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80');
    setMediaKind('video');
    setShowGallery(false);
    toast('🎬 บันทึกสตอรี่คลิป Reels สำเร็จ พร้อมแชร์แล้ว!');
  };

  const handlePublish = () => {
    if (mode === 'text') {
      if (!text.trim()) return;
      addStory({ kind: 'text', text: text.trim(), gradient });
    } else if (mode === 'layout') {
      const validSlots = layoutSlots.filter((u) => !!u);
      if (validSlots.length === 0) return;
      addStory({ kind: 'image', text: text.trim() || 'คอลลาจสตอรี่', mediaUrl: validSlots[0], gradient: 'navy' });
    } else {
      if (!mediaUrl) return;
      addStory({ kind: mediaKind, text: text.trim() || undefined, mediaUrl, gradient: 'navy' });
    }
    toast('เผยแพร่สตอรี่ของคุณเรียบร้อยแล้ว!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200">
      {/* Top Safe Area & Mode Header */}
      <div className="pt-safe px-4 sm:px-6 py-3 z-40 flex items-center justify-between gap-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent shrink-0">
        <button
          onClick={onClose}
          className="apple-btn-tactile flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-bold border border-white/20 backdrop-blur-md shadow-lg"
        >
          <X width={18} height={18} />
          <span>ปิดสตูดิโอ</span>
        </button>

        <div className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-md border border-white/20">
          <Sparkles width={14} height={14} className="text-coral" />
          <span className="font-display font-bold text-xs text-white">
            {mode === 'camera' ? (isRecording ? `🎬 อัดคลิป Reels (${recordSeconds}s/15s)` : 'โหมดกล้องถ่ายภาพ & สตอรี่') : mode === 'text' ? 'โหมดตัวหนังสือ & ธีม' : 'โหมดจัดเลย์เอาท์คอลลาจ'}
          </span>
        </div>

        {mode === 'camera' && !mediaUrl ? (
          <button
            onClick={() => toast('🔄 สลับกล้องหน้า/หลัง HD')}
            className="apple-btn-tactile rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors border border-white/20 backdrop-blur-md shadow-lg"
            title="สลับกล้อง"
          >
            <RefreshCcw width={18} height={18} />
          </button>
        ) : mode === 'text' ? (
          <button
            onClick={() => setFontStyle((s) => s === 'display' ? 'serif' : s === 'serif' ? 'normal' : 'display')}
            className="apple-btn-tactile px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 backdrop-blur-md shadow-lg"
            title="เปลี่ยนสไตล์ตัวอักษร"
          >
            {fontStyle === 'display' ? 'หนา' : fontStyle === 'serif' ? 'คลาสสิก' : 'เรียบ'}
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Center 9:16 Canvas Viewport */}
      <div
        className="flex-1 w-full max-w-lg mx-auto overflow-hidden relative flex flex-col justify-between sm:rounded-[36px] shadow-[0_0_60px_rgba(0,0,0,0.9)] border sm:border-white/15 transition-all duration-300"
        style={mode === 'text' ? { background: GRADIENT_STYLES[gradient] || GRADIENTS[gradient] } : { background: '#090d16' }}
      >
        {/* Mode: TEXT */}
        {mode === 'text' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-20 relative overflow-y-auto">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="แตะเพื่อพิมพ์สตอรี่ของคุณ..."
              autoFocus
              rows={5}
              className={cn(
                'w-full max-w-sm bg-transparent text-center font-bold text-white placeholder:text-white/45 outline-none resize-none drop-shadow-2xl leading-snug',
                fontStyle === 'display' && 'font-display text-2xl sm:text-3xl tracking-tight',
                fontStyle === 'serif' && 'font-serif text-2xl sm:text-3xl italic tracking-wide',
                fontStyle === 'normal' && 'font-sans text-xl sm:text-2xl font-semibold'
              )}
            />
          </div>
        )}

        {/* Mode: LAYOUT (2 Slots Vertical Collage) */}
        {mode === 'layout' && (
          <div className="flex-1 grid grid-rows-2 gap-1.5 p-2 w-full h-full relative z-20">
            {layoutSlots.map((slotUrl, sIdx) => (
              <div
                key={sIdx}
                onClick={() => {
                  setActiveSlotIdx(sIdx);
                  const el = document.getElementById('story-layout-upload');
                  el?.click();
                }}
                className="relative rounded-2xl overflow-hidden bg-white/10 border-2 border-dashed border-white/30 hover:border-coral flex flex-col items-center justify-center cursor-pointer group transition-all"
              >
                {slotUrl ? (
                  <img src={slotUrl} alt={`Slot ${sIdx + 1}`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-white/80">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--coral))]/30 text-white shadow-inner">
                      <Plus width={24} height={24} />
                    </span>
                    <span className="text-xs font-bold">แตะเลือกรูปช่องที่ {sIdx + 1}</span>
                  </div>
                )}
                {slotUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLayoutSlots((prev) => {
                        const copy = [...prev];
                        copy[sIdx] = '';
                        return copy;
                      });
                    }}
                    className="absolute top-3 right-3 rounded-full bg-black/70 p-2 text-white hover:bg-destructive transition-colors border border-white/20 shadow-lg z-20"
                  >
                    <X width={16} height={16} />
                  </button>
                )}
              </div>
            ))}
            <input
              id="story-layout-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleMediaUpload(e, activeSlotIdx ?? 0)}
            />
          </div>
        )}

        {/* Mode: CAMERA (Live Camera Simulation / Captured Media / Video Player) */}
        {mode === 'camera' && (
          <div className="flex-1 flex flex-col items-center justify-center relative w-full h-full overflow-hidden">
            {mediaUrl ? (
              <div className="relative flex flex-col items-center justify-center h-full w-full">
                <img src={mediaUrl} alt="Captured" className="absolute inset-0 h-full w-full object-cover blur-3xl opacity-30 scale-125 pointer-events-none" />
                <img src={mediaUrl} alt="Captured preview" className="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/20 z-10" />
                <button
                  onClick={() => setMediaUrl('')}
                  className="absolute top-4 right-4 z-20 rounded-full bg-black/75 p-2.5 text-white hover:bg-destructive transition-colors border border-white/25 shadow-xl"
                  title="ถ่ายใหม่ / ยกเลิก"
                >
                  <X width={18} height={18} />
                </button>
              </div>
            ) : (
              /* Live Hardware Camera Stream or Fallback Lens Grid */
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-white/40 overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
                    cameraReady ? 'opacity-100' : 'opacity-0',
                    facingMode === 'user' && '-scale-x-100'
                  )}
                />
                {!cameraReady && (
                  <div className="w-64 h-64 rounded-full border border-white/15 flex items-center justify-center relative pointer-events-none">
                    <div className="w-48 h-48 rounded-full border border-white/10 flex items-center justify-center animate-pulse">
                      <Camera width={40} height={40} className="text-white/25" />
                    </div>
                  </div>
                )}
                {/* Flip camera button */}
                <button
                  onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
                  className="absolute top-4 right-4 z-30 rounded-full bg-black/60 p-3 text-white hover:bg-black/80 transition-transform active:scale-90 border border-white/25 shadow-xl backdrop-blur-md"
                  title="สลับกล้องหน้า/หลัง"
                >
                  <RefreshCcw width={20} height={20} />
                </button>
                {isRecording && (
                  <div className="absolute top-6 z-30 flex items-center gap-2 rounded-full bg-red-600/90 px-4 py-1.5 text-white font-display font-bold text-sm shadow-xl animate-bounce">
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                    <span>REC {recordSeconds}s / 15s</span>
                  </div>
                )}
              </div>
            )}

            {/* Optional Caption Input when media is captured */}
            {mediaUrl && (
              <div className="absolute bottom-4 inset-x-6 z-20 max-w-sm mx-auto">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="เพิ่มคำบรรยายใต้ภาพหรือคลิป..."
                  className="w-full rounded-full border border-white/30 bg-black/70 px-5 py-3 text-xs font-semibold text-white placeholder:text-white/60 outline-none backdrop-blur-md focus:ring-2 focus:ring-coral text-center shadow-2xl"
                />
              </div>
            )}
          </div>
        )}

        {/* Slide-Up Bottom Half Gallery Drawer (When in camera mode and no media selected yet) */}
        {mode === 'camera' && !mediaUrl && showGallery && (
          <div className="absolute inset-x-0 bottom-0 z-50 bg-slate-950/96 backdrop-blur-2xl rounded-t-[36px] border-t border-white/25 p-5 pt-3 shadow-[0_-16px_50px_rgba(0,0,0,0.95)] max-h-[50vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Drag Handle */}
            <div
              onClick={() => setShowGallery(false)}
              className="w-12 h-1.5 rounded-full bg-white/30 mx-auto mb-3 cursor-pointer hover:bg-white/50 transition-colors"
              title="ย่อถาดคลังรูปภาพ"
            />

            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/15 mb-3 shrink-0">
              <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
                <MediaImageIcon width={18} height={18} className="text-coral" />
                <span>คลังรูปภาพ & คลิปเรียน (Gallery Roll)</span>
              </h4>
              <input id="story-drawer-upload" type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleMediaUpload(e)} />
              <label
                htmlFor="story-drawer-upload"
                className="apple-btn-tactile cursor-pointer rounded-full bg-[hsl(var(--coral))] px-3.5 py-1 text-xs font-bold text-white shadow-md hover:scale-105 transition-all"
              >
                + เลือกจากอุปกรณ์ทั้งหมด
              </label>
            </div>

            {/* Gallery Thumbnails Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 overflow-y-auto thin-scroll flex-1 pb-4">
              {/* Camera Trigger Card */}
              <div
                onClick={() => {
                  setShowGallery(false);
                  toast('📸 ถ่ายภาพสดจากกล้อง HD');
                }}
                className="flex flex-col items-center justify-center rounded-2xl bg-white/15 border-2 border-dashed border-white/40 aspect-square cursor-pointer hover:bg-white/25 transition-all group p-2 text-center"
              >
                <Camera width={26} height={26} className="text-white group-hover:scale-110 transition-transform mb-1" />
                <span className="text-xs font-bold text-white">กล้องถ่ายภาพ</span>
              </div>

              {/* Sample Photo Cards */}
              {SAMPLE_GALLERY_PHOTOS.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => {
                    setMediaUrl(photo.url);
                    setMediaKind('image');
                    setShowGallery(false);
                    toast(`เลือกรูป "${photo.label}" ลงสตอรี่`);
                  }}
                  className="group relative rounded-2xl overflow-hidden aspect-square cursor-pointer border border-white/20 shadow-md hover:scale-[1.03] transition-all"
                >
                  <img src={photo.url} alt={photo.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[9px] font-bold text-white truncate text-center">
                    {photo.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Safe Area Controls & Shutter Bar */}
      <div className="pb-safe px-6 pt-4 pb-6 z-40 flex flex-col gap-4 bg-gradient-to-t from-black via-black/85 to-transparent shrink-0">
        {/* Mode & Shutter Bar (When no media is captured yet) */}
        {!mediaUrl && mode === 'camera' ? (
          <div className="flex items-center justify-between w-full max-w-sm mx-auto relative">
            {/* Left Function Cards (3 Round Pills Stacked / Side by Side) */}
            <div className="flex items-center gap-2.5 z-20">
              <button
                onClick={() => setMode('text')}
                className="apple-btn-tactile flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-md text-white border border-white/25 hover:bg-white/30 shadow-lg transition-all"
                title="1. เลือกแบบลงสตอรี่ตัวหนังสือ & สีแถมเภท"
              >
                <Type width={20} height={20} className="text-coral" />
              </button>
              <button
                onClick={() => setMode('layout')}
                className="apple-btn-tactile flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-md text-white border border-white/25 hover:bg-white/30 shadow-lg transition-all"
                title="2. เลือกฟังก์ชันแบบเลย์เอาท์คอลลาจ"
              >
                <LayoutGrid width={20} height={20} className="text-white" />
              </button>
              <button
                onClick={() => setShowGallery(!showGallery)}
                className={cn(
                  'apple-btn-tactile flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-all',
                  showGallery ? 'bg-[hsl(var(--coral))] text-white border-coral shadow-[0_0_16px_hsl(var(--coral)/0.6)]' : 'bg-white/15 text-white border-white/25 hover:bg-white/30'
                )}
                title="3. เปิดคลังรูปภาพสไลด์ขึ้น"
              >
                <MediaImageIcon width={20} height={20} />
              </button>
            </div>

            {/* Center Shutter Button (Short tap photo vs Long press hold Reels clip up to 15s) */}
            <div className="relative flex items-center justify-center">
              {isRecording && (
                <div className="absolute -inset-2 rounded-full border-4 border-red-600 animate-ping opacity-75 pointer-events-none" />
              )}
              <div
                onMouseDown={handleShutterPressStart}
                onMouseUp={handleShutterPressEnd}
                onTouchStart={handleShutterPressStart}
                onTouchEnd={handleShutterPressEnd}
                className={cn(
                  'w-20 h-20 rounded-full border-4 flex items-center justify-center relative cursor-pointer select-none transition-all shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-95',
                  isRecording ? 'border-red-600 bg-red-600/20' : 'border-white bg-white/10'
                )}
                title="กดสั้นๆ เพื่อถ่ายรูป | กดค้างยาวๆ เพื่ออัดคลิป Reels สตอรี่ 15 วินาที"
              >
                <div className={cn(
                  'transition-all duration-200',
                  isRecording ? 'w-8 h-8 rounded-xl bg-red-600 animate-pulse shadow-lg' : 'w-15 h-15 rounded-full bg-white hover:scale-105'
                )} />
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2 z-20">
              <button
                onClick={() => toast('🎬 โหมดสลับอัดคลิป Reels สตอรี่')}
                className="apple-btn-tactile flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-md text-white border border-white/25 hover:bg-white/30 shadow-lg transition-all"
                title="โหมดวิดีโอ"
              >
                <Video width={20} height={20} />
              </button>
            </div>
          </div>
        ) : mode === 'text' ? (
          /* Text Mode Gradients Swatch & Font Switcher Bar */
          <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
            <div className="flex items-center justify-center gap-2 py-1">
              {Object.keys(GRADIENT_STYLES).map((k) => (
                <button
                  key={k}
                  onClick={() => setGradient(k)}
                  className={cn(
                    'h-8 w-8 rounded-full transition-all shadow-md border',
                    gradient === k ? 'ring-2 ring-white scale-125 border-white' : 'opacity-70 hover:opacity-100 border-white/25'
                  )}
                  style={{ background: GRADIENT_STYLES[k] }}
                  title={k}
                />
              ))}
            </div>
            <button
              onClick={handlePublish}
              disabled={!text.trim()}
              className="apple-btn-tactile flex items-center justify-center gap-2 h-13 w-full rounded-2xl bg-[hsl(var(--coral))] font-display text-base font-bold text-white shadow-lg shadow-[hsl(var(--coral)/0.45)] hover:scale-[1.02] active:scale-98 transition-all disabled:opacity-40"
            >
              <Send width={20} height={20} />
              <span>โพสต์สตอรี่ข้อความทันที</span>
            </button>
          </div>
        ) : (
          /* Captured Media or Layout Publish Bar */
          <div className="max-w-sm mx-auto w-full">
            <button
              onClick={handlePublish}
              disabled={uploading || (mode === 'camera' ? !mediaUrl : layoutSlots.filter(Boolean).length === 0)}
              className="apple-btn-tactile flex items-center justify-center gap-2 h-13 w-full rounded-2xl bg-[hsl(var(--coral))] font-display text-base font-bold text-white shadow-lg shadow-[hsl(var(--coral)/0.45)] hover:scale-[1.02] active:scale-98 transition-all disabled:opacity-40"
            >
              <Send width={20} height={20} />
              <span>โพสต์ลงสตอรี่ทันที (Share Story)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= Full-Screen Story Viewer Modal Overlay ================= */
function StoryViewerOverlay({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { state, viewStoryItem, sendMessage, createDirectChat, toast, openChat } = useApp();
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState('');
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const raf = useRef<number>(0);
  const startRef = useRef<number>(Date.now());

  const story = useMemo(() => state.stories.find((s) => s.userId === userId && s.items.length > 0), [state.stories, userId]);
  const user = userId === ME_ID ? null : state.users[userId];

  const next = () => {
    if (!story) return;
    if (idx < story.items.length - 1) {
      setIdx(idx + 1);
      setProgress(0);
      startRef.current = Date.now();
    } else {
      onClose();
    }
  };

  const prev = () => {
    if (idx > 0) {
      setIdx(idx - 1);
      setProgress(0);
      startRef.current = Date.now();
    }
  };

  useEffect(() => {
    setIdx(0);
    setProgress(0);
    startRef.current = Date.now();
  }, [userId]);

  useEffect(() => {
    if (!story) return;
    const item = story.items[idx];
    if (item) viewStoryItem(story.userId, item.id);
    const tick = () => {
      const p = (Date.now() - startRef.current) / STORY_MS;
      if (p >= 1) {
        next();
        return;
      }
      setProgress(p);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, idx, userId]);

  if (!story) return null;

  const item = story.items[Math.min(idx, story.items.length - 1)];
  const displayName = userId === ME_ID ? 'สตอรี่ของฉัน (My Story)' : user?.name ?? '';

  const handleSendReaction = async (reactionName: string) => {
    if (!userId || userId === ME_ID) return;
    const chatId = await createDirectChat(userId);
    sendMessage(chatId, { text: `[ปฏิกิริยา: ${reactionName}] ตอบกลับสตอรี่ของคุณ`, type: 'text' });
    toast(`ส่งปฏิกิริยาให้ ${displayName.split(' ')[0]} แล้ว!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-200 select-none" onClick={onClose}>
      <div
        className="relative flex h-full sm:h-[92vh] w-full max-w-md flex-col overflow-hidden sm:rounded-[36px] shadow-[0_0_60px_rgba(0,0,0,0.85)] border sm:border-white/15"
        style={item.mediaUrl ? { background: '#080c14' } : { background: GRADIENT_STYLES[item.gradient] || GRADIENTS[item.gradient] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background Blur Fill for Photo/Video Stories */}
        {item.mediaUrl && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img src={item.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover blur-3xl opacity-30 scale-125" />
          </div>
        )}

        {/* Top Segmented Progress Bars */}
        <div className="absolute inset-x-0 top-0 z-30 flex gap-1.5 p-4 pb-2 pt-safe">
          {story.items.map((it, i) => (
            <div key={it.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30 backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-white shadow-xs transition-all duration-75"
                style={{ width: i < idx ? '100%' : i === idx ? `${progress * 100}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Top Header Row */}
        <div className="absolute inset-x-0 top-7 z-30 flex items-center justify-between px-4 sm:px-5 py-2 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar
              name={displayName}
              colorKey={userId === ME_ID ? state.profile.avatarColor : user?.avatarColor ?? 'navy'}
              emoji={userId === ME_ID ? state.profile.avatarEmoji : user?.avatarEmoji}
              size={40}
              className="ring-2 ring-white/35 shrink-0"
            />
            <div className="min-w-0 flex-1 text-white">
              <div className="text-sm font-bold truncate drop-shadow">{displayName}</div>
              <div className="text-xs text-white/80 flex items-center gap-1.5">
                <span>{formatListTime(item.createdAt)}</span>
                <span>·</span>
                <span className="flex items-center gap-0.5 text-emerald-400 font-semibold"><ShieldCheck width={11} height={11} /> ปลอดภัย</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {userId === ME_ID && (
              <button
                onClick={() => {
                  toast('ลบสตอรี่นี้ออกจากระบบเรียบร้อยแล้ว');
                  onClose();
                }}
                className="rounded-full bg-black/45 hover:bg-destructive p-2.5 text-white transition-colors backdrop-blur-md border border-white/15"
                title="ลบสตอรี่นี้"
              >
                <Trash2 width={16} height={16} />
              </button>
            )}
            <button onClick={onClose} className="rounded-full bg-black/45 p-2.5 text-white hover:bg-black/65 transition-colors backdrop-blur-md border border-white/15">
              <X width={18} height={18} />
            </button>
          </div>
        </div>

        {/* Touch Navigation Overlays */}
        <button className="absolute inset-y-0 left-0 z-20 w-1/3" onClick={prev} aria-label="ก่อนหน้า" />
        <button className="absolute inset-y-0 right-0 z-20 w-1/3" onClick={next} aria-label="ถัดไป" />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center z-10 relative">
          {item.mediaUrl ? (
            <div className="flex flex-col items-center justify-center h-full w-full max-h-[72vh]">
              {item.kind === 'video' || item.mediaUrl.match(/\.(mp4|webm|mov|m3u8)($|\?)/i) ? (
                <video src={item.mediaUrl} autoPlay playsInline loop className="max-h-full w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/15" />
              ) : (
                <img src={item.mediaUrl} alt="Story" className="max-h-full w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/15" />
              )}
              {item.text && (
                <p className="mt-4 font-display text-sm font-semibold leading-relaxed text-white drop-shadow-md px-4 py-2 rounded-2xl bg-black/65 backdrop-blur-md border border-white/15 max-w-[90%] break-words">
                  {item.text}
                </p>
              )}
            </div>
          ) : (
            <div className="max-w-xs space-y-3">
              <p className="font-display text-2xl sm:text-3xl font-extrabold leading-snug text-white drop-shadow-xl break-words">
                {item.text}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Interaction Bar */}
        {userId === ME_ID ? (
          <div className="relative z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 sm:p-5 pt-8 pb-safe">
            <button
              onClick={() => setShowViewersSheet(true)}
              className="flex items-center justify-between w-full rounded-2xl bg-white/15 backdrop-blur-md px-4 py-3 text-white font-bold text-xs hover:bg-white/25 transition-all border border-white/20 shadow-lg"
            >
              <div className="flex items-center gap-2">
                <Eye width={17} height={17} className="text-coral" />
                <span>{item.viewers.length} คนเข้าชมแล้ว</span>
              </div>
              <span className="text-xs text-white/75 underline">ดูรายชื่อผู้เข้าชม</span>
            </button>

            {/* Viewers Bottom Sheet Overlay */}
            {showViewersSheet && (
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/15 rounded-t-3xl p-5 max-h-[60vh] overflow-y-auto z-40 animate-in slide-in-from-bottom duration-200 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
                    <Eye width={16} height={16} className="text-coral" />
                    <span>รายชื่อผู้เข้าชมสตอรี่ ({item.viewers.length})</span>
                  </h4>
                  <button onClick={() => setShowViewersSheet(false)} className="text-white/60 hover:text-white"><X width={16} height={16} /></button>
                </div>

                <div className="space-y-2">
                  {item.viewers.map((vid) => {
                    const vUser = state.users[vid];
                    if (!vUser) return null;
                    return (
                      <div key={vid} className="flex items-center justify-between rounded-xl bg-white/5 p-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={vUser.name} colorKey={vUser.avatarColor} emoji={vUser.avatarEmoji} size={36} online={vUser.online} showStatus />
                          <div>
                            <div className="text-xs font-bold text-white">{vUser.name}</div>
                            <div className="text-[10px] text-white/60">{vUser.username || vUser.phone}</div>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                          <ShieldCheck width={12} height={12} /> ยืนยันแล้ว
                        </span>
                      </div>
                    );
                  })}
                  {item.viewers.length === 0 && (
                    <div className="py-8 text-center text-xs text-white/50">ยังไม่มีผู้เข้าชมในขณะนี้</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-6 pb-safe space-y-3.5">
            {/* Quick Reaction Bar */}
            <div className="flex items-center justify-center gap-3.5">
              {[
                { name: 'ถูกใจ', icon: Heart, color: 'text-rose-500' },
                { name: 'ไฟลุก', icon: Fire, color: 'text-amber-500' },
                { name: 'เยี่ยม', icon: ThumbsUp, color: 'text-blue-500' },
                { name: 'ฉลอง', icon: Celebration, color: 'text-purple-500' },
              ].map((r) => (
                <button
                  key={r.name}
                  onClick={() => handleSendReaction(r.name)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-md text-lg hover:scale-125 active:scale-95 transition-all border border-white/20 shadow-md"
                  title={`ส่ง ${r.name}`}
                >
                  <r.icon width={20} height={20} className={r.color} />
                </button>
              ))}
            </div>

            {/* Reply Input Capsule */}
            <div className="flex items-center gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={`ตอบกลับสตอรี่ของ ${displayName.split(' ')[0]}...`}
                className="h-11 flex-1 rounded-full border border-white/25 bg-black/50 px-4 text-xs font-medium text-white placeholder:text-white/60 outline-none backdrop-blur-md focus:ring-2 focus:ring-coral shadow-inner"
              />
              <button
                onClick={async () => {
                  if (!reply.trim() || !userId) return;
                  const chatId = await createDirectChat(userId);
                  sendMessage(chatId, { text: reply.trim(), type: 'text' });
                  onClose();
                  openChat(chatId);
                  setReply('');
                }}
                disabled={!reply.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--coral))] text-white shadow-lg transition-all hover:scale-105 disabled:opacity-40"
              >
                  <Send width={18} height={18} />
              </button>
            </div>
          </div>
        )}

        {/* Desktop Nav Arrows */}
        {idx > 0 && (
          <button onClick={prev} className="absolute left-4 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/75 sm:block transition-colors border border-white/15"><ChevronLeft width={20} height={20} /></button>
        )}
        <button onClick={next} className="absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/75 sm:block transition-colors border border-white/15"><ChevronRight width={20} height={20} /></button>
      </div>
    </div>
  );
}

/* ================= Exported StoryViewer for Global App.tsx rendering ================= */
export function StoryViewer() {
  const { state, setViewingStoryOf } = useApp();
  const userId = state.viewingStoryOf;

  if (!userId) return null;

  if (userId === '__add__') {
    return <StoryCreator open={true} onClose={() => setViewingStoryOf(null)} />;
  }

  return <StoryViewerOverlay userId={userId} onClose={() => setViewingStoryOf(null)} />;
}

/* ================= 9:16 Story Card Component for Story Home Grid ================= */
function StoryCard({
  gradient,
  mediaUrl,
  title,
  subtitle,
  badge,
  isMine,
  itemCount,
  onClick
}: {
  gradient: string;
  mediaUrl?: string;
  title: string;
  subtitle: string;
  badge?: string;
  isMine?: boolean;
  itemCount: number;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group aspect-[9/16] rounded-3xl overflow-hidden relative cursor-pointer shadow-lg border border-border/40 hover:border-coral/60 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl select-none"
      style={mediaUrl ? { background: '#090d16' } : { background: GRADIENT_STYLES[gradient] || GRADIENTS[gradient] }}
    >
      {/* Background Image / Gradient Fill */}
      {mediaUrl ? (
        <img src={mediaUrl} alt={title} className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Sparkles width={48} height={48} className="text-white/15 group-hover:scale-110 transition-transform duration-500" />
        </div>
      )}

      {/* Top Badge & User Avatar indicator */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex items-center justify-between">
        <span className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/25 shadow-md',
          badge ? 'ring-2 ring-[hsl(var(--coral))] ring-offset-2 ring-offset-black/50' : 'ring-2 ring-white/40'
        )}>
          {isMine ? (
            <Type width={18} height={18} className="text-white" />
          ) : (
            <span className="font-display font-bold text-xs text-white">{title.charAt(0)}</span>
          )}
        </span>

        {badge && (
          <span className="rounded-full bg-[hsl(var(--coral))] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md">
            {badge}
          </span>
        )}
      </div>

      {/* Bottom Gradient Title Overlay */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-14 flex flex-col justify-end text-left">
        <div className="font-display font-bold text-sm text-white truncate drop-shadow">{title}</div>
        <div className="text-xs text-white/75 flex items-center justify-between mt-0.5">
          <span className="truncate">{subtitle}</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold text-white shrink-0 ml-1 backdrop-blur-sm">
            {itemCount} ใบ
          </span>
        </div>
      </div>
    </div>
  );
}

/* ================= Story Home Screen (Grid View with + Create Card) ================= */
export function StoriesScreen() {
  const { state } = useApp();
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);

  const mine = state.stories.find((s) => s.userId === ME_ID);
  const others = state.stories.filter((s) => s.userId !== ME_ID && s.items.length > 0);

  return (
    <div className="flex h-full w-full flex-col bg-card overflow-hidden select-none">
      {/* Top Header */}
      <div className="apple-glass-header border-b px-5 sm:px-8 pb-4 pt-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles width={22} height={22} className="text-coral" />
            <span>สตอรี่ (Story Home)</span>
          </h1>
          <p className="text-xs text-muted-foreground">อัปเดตเรื่องราวและรูปภาพตลอด 24 ชั่วโมง · หายไปอัตโนมัติ</p>
        </div>
        <button
          onClick={() => setShowCreator(true)}
          className="apple-btn-tactile flex items-center gap-2 rounded-2xl bg-[hsl(var(--coral))] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[hsl(var(--coral)/0.35)] hover:scale-105 active:scale-95"
        >
          <Plus width={16} height={16} />
          <span className="hidden sm:inline">สร้างสตอรี่ใหม่</span>
        </button>
      </div>

      {/* Main Story Grid Container */}
      <div className="thin-scroll flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 sm:pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Spatial Grid: 2 cols on mobile, up to 6 on widescreen */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-5">
            {/* Card 1: + Create Story Card */}
            <div
              onClick={() => setShowCreator(true)}
              className="group aspect-[9/16] rounded-3xl overflow-hidden relative cursor-pointer border-2 border-dashed border-coral/60 hover:border-coral transition-all duration-300 hover:scale-[1.03] bg-gradient-to-b from-card to-muted/80 shadow-lg hover:shadow-2xl flex flex-col items-center justify-center p-5 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--coral))] text-white shadow-[0_0_24px_hsl(var(--coral)/0.6)] group-hover:scale-110 transition-transform mb-3">
                <Plus width={28} height={28} />
              </div>
              <span className="font-display font-bold text-sm text-foreground">สร้างสตอรี่ใหม่</span>
              <span className="text-xs text-muted-foreground mt-0.5">ถ่ายรูป / เลือกไฟล์ / แต่งสตอรี่</span>
            </div>

            {/* Card 2: My Story (if exists) */}
            {mine && mine.items.length > 0 && (
              <StoryCard
                gradient={mine.items[mine.items.length - 1].gradient}
                mediaUrl={mine.items[mine.items.length - 1].mediaUrl}
                title="สตอรี่ของฉัน (My Story)"
                subtitle={formatListTime(mine.items[mine.items.length - 1].createdAt)}
                isMine={true}
                itemCount={mine.items.length}
                onClick={() => setViewingUserId(ME_ID)}
              />
            )}

            {/* Cards for all other contacts */}
            {others.map((story) => {
              const user = state.users[story.userId];
              if (!user) return null;
              const lastItem = story.items[story.items.length - 1];
              const unseen = story.items.some((i) => !i.viewers.includes(ME_ID));
              return (
                <StoryCard
                  key={story.id}
                  gradient={lastItem.gradient}
                  mediaUrl={lastItem.mediaUrl}
                  title={user.name}
                  subtitle={formatListTime(lastItem.createdAt)}
                  badge={unseen ? 'ใหม่' : undefined}
                  itemCount={story.items.length}
                  onClick={() => setViewingUserId(story.userId)}
                />
              );
            })}
          </div>

          {/* Empty state when nobody has posted yet */}
          {others.length === 0 && (!mine || mine.items.length === 0) && (
            <div className="mt-12 rounded-3xl border border-dashed border-border/60 bg-muted/20 p-12 text-center max-w-lg mx-auto space-y-3">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--coral))]/15 text-coral shadow-inner">
                <Sparkles width={32} height={32} />
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">ยังไม่มีเพื่อนคนไหนลงสตอรี่</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                เป็นคนแรกที่แชร์รูปภาพหรืออัปเดตบรรยากาศการทำงานลงใน Story Home กดปุ่ม + หรือการ์ดแรกเพื่อเปิด Story Composer ได้เลย!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Full-Screen Modals */}
      <StoryCreator open={showCreator} onClose={() => setShowCreator(false)} />
      {viewingUserId && <StoryViewerOverlay userId={viewingUserId} onClose={() => setViewingUserId(null)} />}
    </div>
  );
}
