import { useEffect, useRef, useState } from 'react';
import {
  BarChart3, Camera, File, Image as MediaImageIcon, Pin as MapPinIcon, Mic, Pencil, Plus, Send, Smile, Timer, X, Trash2
} from 'lucide-react';
import type { Chat, Message } from '@/types';
import { useApp } from '@/store/AppContext';
import { cn } from '@/lib/utils';
import { uid } from '@/lib/helpers';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const EMOJIS = [
  '😀','😂','🤣','😊','😍','🥰','😘','😎','🤔','😅','😭','😢','😡','🥺','😴','🤯',
  '👍','👎','👏','🙏','💪','🤝','✌️','👌','❤️','🧡','💛','💚','💙','💜','🖤','💔',
  '🎉','🎊','🔥','✨','⭐','💯','⚡','🌈','☕','🍜','🎂','🎁','⚽','🏆','🚀','💡',
];

interface Props {
  chat: Chat;
  replyingTo: Message | null;
  editingMsg: Message | null;
  onCancelContext: () => void;
}

export function MessageInput({ chat, replyingTo, editingMsg, onCancelContext }: Props) {
  const { state, sendMessage, editMessage, patchChat, toast, setTypingStatus } = useApp();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const recStart = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const viewOnceRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canSend = text.trim().length > 0;
  const isGroup = chat.type === 'group';
  const selfChat = chat.type === 'self';

  // load draft / editing
  useEffect(() => {
    if (editingMsg) {
      setText(editingMsg.text ?? '');
      textareaRef.current?.focus();
    } else if (replyingTo) {
      textareaRef.current?.focus();
    } else {
      setText(chat.draft ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id, editingMsg, replyingTo]);

  // save draft
  useEffect(() => {
    if (!editingMsg && !replyingTo && text !== (chat.draft ?? '')) {
      const id = setTimeout(() => patchChat(chat.id, { draft: text || undefined }), 500);
      return () => clearTimeout(id);
    }
  }, [text, chat.id, chat.draft, editingMsg, replyingTo, patchChat]);

  // recording timer
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecSecs(Math.floor((Date.now() - recStart.current) / 1000)), 200);
    return () => clearInterval(id);
  }, [recording]);

  const doSend = () => {
    const value = text.trim();
    if (!value) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (setTypingStatus) setTypingStatus(chat.id, false);
    if (editingMsg) {
      editMessage(chat.id, editingMsg.id, value);
      toast('แก้ไขข้อความแล้ว');
    } else {
      sendMessage(chat.id, { text: value, replyToId: replyingTo?.id });
    }
    setText('');
    onCancelContext();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (!selfChat && setTypingStatus) {
      if (val.trim().length > 0) {
        setTypingStatus(chat.id, true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingStatus(chat.id, false);
        }, 3000);
      } else {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setTypingStatus(chat.id, false);
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && state.settings.enterToSend) {
      e.preventDefault();
      doSend();
    }
  };

  const uploadMediaFile = (fileOrBlob: File | Blob, name: string, type: 'image' | 'file' | 'voice' | 'video', duration?: number) => {
    const fileName = `${uid()}_${name}`;
    const storageRef = ref(storage, `chats/${chat.id}/${type}/${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, fileOrBlob);
    setUploadProgress(0);
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const prog = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(prog);
      },
      (error) => {
        setUploadProgress(null);
        toast(`⚠️ อัปโหลดไม่สำเร็จ: ${error.message}`);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setUploadProgress(null);
        const sizeStr = `${(fileOrBlob.size / (1024 * 1024)).toFixed(2)} MB`;
        if (type === 'image' || type === 'video') {
          sendMessage(chat.id, {
            type: type,
            mediaUrl: url,
            mediaName: name,
            mediaSize: sizeStr,
            viewOnce: viewOnceRef.current,
            replyToId: replyingTo?.id,
          });
          if (type === 'video') {
            toast(`🎬 ส่งคลิปวิดีโอ "${name}" เรียบร้อยแล้ว`);
          } else if (viewOnceRef.current) {
            toast('📸 ส่งรูปภาพแบบดูได้ครั้งเดียวเรียบร้อยแล้ว');
          } else {
            toast(`🖼️ ส่งรูปภาพ "${name}" เรียบร้อยแล้ว`);
          }
        } else if (type === 'file') {
          sendMessage(chat.id, {
            type: 'file',
            mediaUrl: url,
            mediaName: name,
            mediaSize: sizeStr,
            replyToId: replyingTo?.id,
          });
          toast(`📁 ส่งไฟล์ "${name}" เรียบร้อยแล้ว`);
        } else if (type === 'voice') {
          sendMessage(chat.id, {
            type: 'voice',
            mediaUrl: url,
            duration: duration || 1,
            replyToId: replyingTo?.id,
          });
          toast('🎙️ ส่งเสียงที่บันทึกสำเร็จ');
        }
        onCancelContext();
      }
    );
  };

  const handleRealImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    uploadMediaFile(file, file.name, isVideo ? 'video' : 'image');
    e.target.value = '';
  };

  const handleRealFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMediaFile(file, file.name, 'file');
    e.target.value = '';
  };

  const sendLocation = () => {
    if (!navigator.geolocation) {
      toast('⚠️ อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง GPS หรือถูกปิดกั้น');
      return;
    }
    toast('📍 กำลังดึงพิกัดตำแหน่งจริงจากฮาร์ดแวร์ GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        sendMessage(chat.id, {
          type: 'location',
          text: `📍 ตำแหน่งที่ตั้งปัจจุบัน (GPS Verified)\nhttps://maps.google.com/?q=${latitude},${longitude}`,
          replyToId: replyingTo?.id,
        });
        toast('📍 ส่งพิกัดตำแหน่งจริงจาก GPS เรียบร้อยแล้ว');
        setShowAttach(false);
        onCancelContext();
      },
      (err) => {
        toast(`⚠️ ไม่สามารถดึงพิกัด GPS ได้: ${err.message || 'โปรดตรวจสอบสิทธิ์การเข้าถึงตำแหน่ง'}`);
        setShowAttach(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start();
      setRecording(true);
      recStart.current = Date.now();
      setRecSecs(0);
    } catch (err: any) {
      toast(`⚠️ ไม่สามารถเข้าถึงไมโครโฟนได้: ${err.message || 'ตรวจสอบการอนุญาต'}`);
    }
  };

  const stopRecording = (send: boolean) => {
    if (!recording) return;
    setRecording(false);
    const secs = Math.max(1, Math.floor((Date.now() - recStart.current) / 1000));
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        if (send && audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          uploadMediaFile(blob, 'voice_record.webm', 'voice', secs);
        }
      };
      recorder.stop();
    } else {
      if (send) toast('⚠️ ไม่พบข้อมูลเสียงที่บันทึก');
    }
  };

  return (
    <div className="bg-background/85 dark:bg-slate-950/85 backdrop-blur-2xl border-t border-border/40 px-2.5 py-2 sm:px-4 sm:py-3">
      {/* Hidden real hardware input devices */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleRealImageSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleRealImageSelect}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv"
        className="hidden"
        onChange={handleRealFileSelect}
      />

      {/* upload progress indicator */}
      {uploadProgress !== null && (
        <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-coral transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
          <span>กำลังอัปโหลด {uploadProgress}%...</span>
        </div>
      )}

      {/* reply / edit context bar */}
      {(replyingTo || editingMsg) && (
        <div className="flex items-center gap-3 border-b px-4 py-2 slide-up">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', editingMsg ? 'bg-amber-500/15 text-amber-500' : 'bg-coral-soft text-coral')}>
            {editingMsg ? <Pencil width={15} height={15} /> : <Send width={15} height={15} className="rotate-180" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className={cn('text-xs font-semibold', editingMsg ? 'text-amber-500' : 'text-coral')}>
              {editingMsg ? 'แก้ไขข้อความ' : `ตอบกลับ ${replyingTo?.senderId === 'me' ? 'ตัวเอง' : chat.name}`}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {(editingMsg ?? replyingTo)?.text || (replyingTo?.type === 'image' ? '[รูปภาพ]' : replyingTo?.type === 'voice' ? '[โน้ตเสียง]' : 'ข้อความ')}
            </div>
          </div>
          <button onClick={onCancelContext} className="rounded-full p-1.5 hover:bg-muted"><X width={16} height={16} /></button>
        </div>
      )}

      {/* recording UI */}
      {recording ? (
        <div className="flex items-center gap-3 rounded-3xl bg-card/95 dark:bg-slate-900/95 border border-red-500/30 shadow-lg px-4 py-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span className="font-mono text-sm font-semibold text-red-500 flex items-center gap-2">
            <span>{Math.floor(recSecs / 60)}:{(recSecs % 60).toString().padStart(2, '0')}</span>
            <span className="text-xs font-sans font-normal text-muted-foreground">กำลังบันทึกโน้ตเสียง...</span>
          </span>
          <div className="flex h-8 flex-1 items-center justify-center gap-1 overflow-hidden">
            {Array.from({ length: 32 }).map((_, i) => (
              <span key={i} className="wave-bar w-1 rounded-full bg-red-400" style={{ height: '70%', animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <button onClick={() => stopRecording(false)} className="rounded-full p-2.5 text-muted-foreground hover:bg-muted" title="ยกเลิก">
            <Trash2 width={18} height={18} />
          </button>
          <button onClick={() => stopRecording(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-coral text-white shadow-lg" title="ส่งเสียง">
            <Send width={18} height={18} />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1 sm:gap-2 rounded-3xl bg-card/95 dark:bg-slate-900/95 border border-border/60 shadow-[0_6px_28px_rgba(0,0,0,0.1)] p-1.5 transition-all">
          {/* attach */}
          <Popover open={showAttach} onOpenChange={setShowAttach}>
            <PopoverTrigger asChild>
              <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="แนบไฟล์">
                <Plus width={22} height={22} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-60 p-2 rounded-2xl border border-border/80 shadow-2xl backdrop-blur-xl">
              <AttachItem
                icon={<MediaImageIcon width={18} height={18} />}
                label="รูปภาพและสื่อ"
                onClick={() => {
                  viewOnceRef.current = false;
                  setShowAttach(false);
                  fileInputRef.current?.click();
                }}
                color="bg-violet-500/15 text-violet-500"
              />
              <AttachItem
                icon={<Timer width={18} height={18} />}
                label="สื่อดูได้ครั้งเดียว"
                onClick={() => {
                  viewOnceRef.current = true;
                  setShowAttach(false);
                  fileInputRef.current?.click();
                }}
                color="bg-amber-500/15 text-amber-500"
              />
              <AttachItem
                icon={<Camera width={18} height={18} />}
                label="ถ่ายภาพจากกล้อง"
                onClick={() => {
                  viewOnceRef.current = false;
                  setShowAttach(false);
                  cameraInputRef.current?.click();
                }}
                color="bg-sky-500/15 text-sky-500"
              />
              <AttachItem
                icon={<File width={18} height={18} />}
                label="เอกสารและไฟล์"
                onClick={() => {
                  setShowAttach(false);
                  docInputRef.current?.click();
                }}
                color="bg-rose-500/15 text-rose-500"
              />
              <AttachItem
                icon={<MapPinIcon width={18} height={18} />}
                label="พิกัดตำแหน่งที่ตั้ง GPS"
                onClick={sendLocation}
                color="bg-emerald-500/15 text-emerald-500"
              />
              {isGroup && (
                <AttachItem
                  icon={<BarChart3 width={18} height={18} />}
                  label="สร้างโพลสำรวจความคิดเห็น"
                  onClick={() => { setShowAttach(false); setShowPoll(true); }}
                  color="bg-[hsl(var(--coral)/0.15)] text-coral"
                />
              )}
            </PopoverContent>
          </Popover>

          {/* emoji */}
          <Popover open={showEmoji} onOpenChange={setShowEmoji}>
            <PopoverTrigger asChild>
              <button className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex" title="อีโมจิ">
                <Smile width={21} height={21} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-72 p-2.5 rounded-2xl border border-border/80 shadow-2xl backdrop-blur-xl">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setText((t) => t + e);
                      textareaRef.current?.focus();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-transform hover:scale-125 hover:bg-muted"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* input */}
          <div className="relative flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={selfChat ? 'เขียนบันทึกถึงตัวเอง...' : 'พิมพ์ข้อความ...'}
              className="thin-scroll max-h-32 min-h-10 w-full resize-none rounded-2xl border-none bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground/60 focus:ring-0"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
              }}
            />
          </div>

          {/* mic / send */}
          {canSend ? (
            <button
              onClick={doSend}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coral text-white shadow-md shadow-[hsl(var(--coral)/0.35)] transition-transform hover:scale-105 active:scale-95"
              title={editingMsg ? 'บันทึกการแก้ไข' : 'ส่ง'}
              aria-label="ส่งข้อความ"
            >
              {editingMsg ? <Pencil width={17} height={17} /> : <Send width={18} height={18} className="-translate-x-px translate-y-px" />}
            </button>
          ) : (
            <button
              onClick={startVoiceRecording}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground hover:bg-coral hover:text-white transition-all duration-200 active:scale-95"
              title="บันทึกเสียง"
            >
              <Mic width={19} height={19} />
            </button>
          )}
        </div>
      )}

      {/* Poll creator */}
      <PollDialog chat={chat} open={showPoll} onClose={() => setShowPoll(false)} />
    </div>
  );
}

function AttachItem({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm hover:bg-muted">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', color)}>{icon}</span>
      {label}
    </button>
  );
}

/* ---------- Poll creator ---------- */
function PollDialog({ chat, open, onClose }: { chat: Chat; open: boolean; onClose: () => void }) {
  const { sendMessage, toast } = useApp();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);

  useEffect(() => {
    if (open) { setQuestion(''); setOptions(['', '']); setMultiple(false); }
  }, [open]);

  const valid = question.trim() && options.filter((o) => o.trim()).length >= 2;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><BarChart3 width={18} height={18} className="text-coral" /> สร้างโพลในกลุ่ม</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder="คำถาม เช่น ไปเที่ยวกันวันไหนดี?"
            className="h-11 w-full rounded-xl border bg-card px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={o}
                onChange={(e) => setOptions((arr) => arr.map((x, xi) => xi === i ? e.target.value : x))}
                placeholder={`ตัวเลือกที่ ${i + 1}`}
                className="h-10 flex-1 rounded-xl border bg-card px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {options.length > 2 && (
                <button onClick={() => setOptions((arr) => arr.filter((_, xi) => xi !== i))} className="rounded-full p-2 text-muted-foreground hover:bg-muted">
                  <X width={15} height={15} />
                </button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button onClick={() => setOptions((a) => [...a, ''])} className="flex items-center gap-1.5 text-sm font-medium text-coral">
              <Plus width={15} height={15} /> เพิ่มตัวเลือก
            </button>
          )}
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--coral))]" />
            อนุญาตให้เลือกได้หลายข้อ
          </label>
          <Button
            disabled={!valid}
            onClick={() => {
              sendMessage(chat.id, {
                type: 'poll',
                poll: {
                  question: question.trim(), multiple,
                  options: options.filter((o) => o.trim()).map((o, i) => ({ id: `po${i}`, text: o.trim(), votes: [] })),
                },
              });
              toast('สร้างโพลแล้ว 📊');
              onClose();
            }}
            className="h-11 w-full rounded-xl bg-[hsl(var(--coral))] font-display font-semibold text-white hover:bg-[hsl(var(--coral-deep))]"
          >
            ส่งโพล
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
