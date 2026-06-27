import { useState, useRef, useEffect } from 'react';
import { Camera, Heart, Loader2, X, Send, Trash2, Maximize2, Download, Mic, MicOff, Video, Play, Pause } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { timeAgo } from '@/lib/timeAgo';
import { cn } from '@/lib/utils';

// 🔥 CÁC CÔNG CỤ FIREBASE MỚI
import { db, storage } from '../../firebase';
import { collection, addDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/* ─── Audio Visualizer (Giữ nguyên 100%) ─────────────────────────────────── */
function AudioVisualizer({ src, playing, onToggle }) {
  const audioRef = useRef();
  const canvasRef = useRef();
  const animRef = useRef();
  const analyserRef = useRef();
  const ctxRef = useRef();

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const startViz = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!ctxRef.current) {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src2 = audioCtx.createMediaElementSource(audio);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      src2.connect(analyser);
      analyser.connect(audioCtx.destination);
      analyserRef.current = analyser;
      ctxRef.current = audioCtx;
    }
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barW = canvas.width / data.length;
      data.forEach((v, i) => {
        const h = (v / 255) * canvas.height;
        ctx.fillStyle = `hsl(340, 97%, ${55 + (v / 255) * 20}%)`;
        ctx.fillRect(i * barW, canvas.height - h, barW - 1, h);
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const stopViz = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      stopViz();
    } else {
      audio.play();
      startViz();
    }
    onToggle();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <audio ref={audioRef} src={src} onEnded={() => { stopViz(); onToggle(); }} />
      <canvas ref={canvasRef} width={200} height={48} className="rounded-lg bg-secondary w-full" />
      <button onClick={handleToggle}
        className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity">
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
    </div>
  );
}

/* ─── Memory Thumbnail (Đã tích hợp Xóa Firebase) ──────────────────────────────────── */
function MemoryThumb({ photo, onDeleted }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      // 1. Xóa file vật lý trên Ổ cứng Storage (nếu có)
      if (photo.anh_url.includes('firebasestorage')) {
        const fileRef = ref(storage, photo.anh_url);
        await deleteObject(fileRef).catch(() => {}); // Kệ lỗi nếu file không tồn tại
      }
      // 2. Xóa dữ liệu trong Firestore
      await deleteDoc(doc(db, 'locket_photos', photo.id));
      
      toast.success('Đã xóa');
      onDeleted?.();
    } catch (error) {
      toast.error('Lỗi khi xóa!');
    }
    setDeleting(false);
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch(photo.anh_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `locket-${photo.id}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã lưu!');
    } catch {
      window.open(photo.anh_url, '_blank');
    }
  };

  const isVideo = photo.media_type === 'video';
  const isAudio = photo.media_type === 'audio';

  return (
    <>
      <div className="flex-shrink-0 w-20 space-y-1">
        <div className="w-20 h-20 rounded-2xl overflow-hidden cursor-pointer relative liquid-glass-sm"
          onClick={() => setFullscreen(true)}>
          {isVideo
            ? <video src={photo.anh_url} className="w-full h-full object-cover" muted playsInline />
            : isAudio
              ? <div className="w-full h-full flex items-center justify-center text-2xl">🎵</div>
              : <img src={photo.anh_url} alt="" className="w-full h-full object-cover" />
          }
        </div>
        <div className="flex gap-1">
          <button onClick={handleDownload}
            className="flex-1 flex items-center justify-center py-1 rounded-lg liquid-glass-sm hover:liquid-glow transition-all">
            <Download size={11} className="text-muted-foreground" />
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 flex items-center justify-center py-1 rounded-lg liquid-glass-sm hover:bg-destructive/10 transition-all">
            {deleting ? <Loader2 size={11} className="animate-spin text-destructive" /> : <Trash2 size={11} className="text-destructive" />}
          </button>
        </div>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-screen-sm p-0 bg-black border-0 rounded-2xl overflow-hidden">
          <div className="relative">
            {isVideo
              ? <video src={photo.anh_url} className="w-full max-h-[70vh] object-contain" controls loop muted={false} autoPlay />
              : isAudio
                ? <div className="p-6"><AudioVisualizer src={photo.anh_url} playing={audioPlaying} onToggle={() => setAudioPlaying(v => !v)} /></div>
                : <img src={photo.anh_url} alt="" className="w-full max-h-[85vh] object-contain" />
            }
            {(photo.loi_nhan || photo.nguoi_tai_len) && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                {photo.loi_nhan && <p className="text-white text-sm">"{photo.loi_nhan}"</p>}
                <p className="text-white/60 text-xs mt-1">{photo.nguoi_tai_len} · {timeAgo(photo.created_date)}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Main LocketCard (Đã tích hợp Upload Firebase) ───────────────────────────────────── */
const MEDIA_TABS = [
  { key: 'photo', emoji: '📷', label: 'Ảnh' },
  { key: 'audio', emoji: '🎙️', label: 'Voice' },
  { key: 'video', emoji: '🎬', label: 'Video' },
];

export default function LocketCard({ latestPhoto, allPhotos = [], onUploaded, onDeleted, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [mediaTab, setMediaTab] = useState('photo');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileRef = useRef();
  const recorderRef = useRef();
  const chunksRef = useRef([]);

  const isVideo = latestPhoto?.media_type === 'video';
  const isAudio = latestPhoto?.media_type === 'audio';

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const startRecording = async () => {
    if (mediaTab === 'audio') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        chunksRef.current = [];
        rec.ondataavailable = e => chunksRef.current.push(e.data);
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const f = new File([blob], 'voice.webm', { type: 'audio/webm' });
          setFile(f);
          setPreview(URL.createObjectURL(blob));
          stream.getTracks().forEach(t => t.stop());
        };
        recorderRef.current = rec;
        rec.start();
        setRecording(true);
      } catch (err) {
        toast.error("Không thể bật Micro!");
      }
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      // 1. Tạo tên file độc nhất và Đẩy lên Storage
      const fileExt = file.name ? file.name.split('.').pop() : 'webm';
      const fileName = `locket_photos/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // 2. Lưu thông tin hiển thị vào Firestore
      await addDoc(collection(db, 'locket_photos'), {
        anh_url: downloadURL,
        loi_nhan: message,
        nguoi_tai_len: currentUser?.displayName?.split(' ')[0] || 'Me',
        media_type: mediaTab,
        created_date: new Date().toISOString(),
        createdAt: serverTimestamp() // Dùng để sắp xếp real-time
      });

      // Gửi thông báo đẩy qua Cloud Function HTTPS
      fetch('/api/sendNotification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'locket',
          senderEmail: currentUser.email,
          senderName: currentUser.displayName || currentUser.email.split('@')[0],
          receiverEmail: 'global',
          content: message || 'Đã gửi một khoảnh khắc mới.'
        })
      }).catch(err => console.error("Lỗi gửi thông báo Locket HTTP:", err));

      toast.success('💕 Đã gửi locket mới!');
      closeForm();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi tải lên, thử lại nhé!');
    } finally {
      setUploading(false);
      onUploaded?.();
    }
  };

  const handleDelete = async () => {
    if (!latestPhoto) return;
    setDeleting(true);
    try {
      if (latestPhoto.anh_url.includes('firebasestorage')) {
        const fileRef = ref(storage, latestPhoto.anh_url);
        await deleteObject(fileRef).catch(() => {});
      }
      await deleteDoc(doc(db, 'locket_photos', latestPhoto.id));
      toast.success('Đã xóa');
      onDeleted?.();
    } catch (error) {
      toast.error('Lỗi khi xóa!');
    }
    setDeleting(false);
  };

  const memories = allPhotos.slice(1);

  const closeForm = () => {
    setShowForm(false);
    setFile(null);
    setPreview(null);
    setMessage('');
    if (recording) stopRecording();
  };

  return (
    <div className="space-y-3">
      {/* Main locket display */}
      <div className="relative rounded-3xl overflow-hidden aspect-square liquid-glass p-0 rim-light">
        {latestPhoto?.anh_url ? (
          isVideo ? (
            <video
              src={latestPhoto.anh_url}
              className="w-full h-full object-cover cursor-pointer"
              autoPlay loop muted playsInline
              onClick={() => setFullscreen(true)}
            />
          ) : isAudio ? (
            <div className="w-full h-full gradient-rose flex flex-col items-center justify-center gap-4 cursor-pointer"
              onClick={() => setFullscreen(true)}>
              <div className="text-6xl animate-float">🎵</div>
              <p className="text-sm text-muted-foreground font-medium">Tap để nghe</p>
            </div>
          ) : (
            <img
              src={latestPhoto.anh_url}
              alt="Locket"
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setFullscreen(true)}
            />
          )
        ) : (
          <div className="w-full h-full gradient-rose flex flex-col items-center justify-center gap-3">
            <Heart size={48} className="text-primary/40 animate-float" />
            <p className="text-muted-foreground text-sm">Chưa có ảnh nào 🌸</p>
          </div>
        )}

        {latestPhoto && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            {latestPhoto.loi_nhan && (
              <p className="text-white text-sm mb-1">"{latestPhoto.loi_nhan}"</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-xs">✨ {latestPhoto.nguoi_tai_len}</span>
              <span className="text-white/60 text-xs">{timeAgo(latestPhoto.created_date)}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex gap-2">
          {latestPhoto && (
            <>
              <button onClick={() => setFullscreen(true)}
                className="liquid-glass-sm rounded-full p-2 liquid-glass-interactive">
                <Maximize2 size={15} className="text-foreground" />
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="liquid-glass-sm rounded-full p-2 liquid-glass-interactive">
                {deleting ? <Loader2 size={15} className="animate-spin text-destructive" /> : <Trash2 size={15} className="text-destructive" />}
              </button>
            </>
          )}
          <button onClick={() => setShowForm(true)}
            className="liquid-glass-sm rounded-full p-2 liquid-glass-interactive">
            <Camera size={15} className="text-primary" />
          </button>
        </div>
      </div>

      {/* Fullscreen dialog */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-screen-sm p-0 bg-black border-0 rounded-2xl overflow-hidden">
          {latestPhoto?.anh_url && (
            <div className="relative">
              {isVideo
                ? <video src={latestPhoto.anh_url} className="w-full max-h-[70vh] object-contain" controls loop autoPlay />
                : isAudio
                  ? <div className="p-8"><AudioVisualizer src={latestPhoto.anh_url} playing={audioPlaying} onToggle={() => setAudioPlaying(v => !v)} /></div>
                  : <img src={latestPhoto.anh_url} alt="" className="w-full max-h-[85vh] object-contain" />
              }
              {latestPhoto.loi_nhan && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white text-sm">"{latestPhoto.loi_nhan}"</p>
                  <p className="text-white/60 text-xs mt-1">{timeAgo(latestPhoto.created_date)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recent memories */}
      {memories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">ảnh đã đăng 📸</p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {memories.map((p) => (
              <MemoryThumb key={p.id} photo={p} onDeleted={onDeleted} />
            ))}
          </div>
        </div>
      )}

      {/* Upload form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="liquid-glass rim-light rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">Gửi locket mới 💌</span>
              <button onClick={closeForm}><X size={16} className="text-muted-foreground" /></button>
            </div>

            {/* Media type tabs */}
            <div className="flex gap-1 liquid-glass-sm rounded-xl p-1">
              {MEDIA_TABS.map(t => (
                <button key={t.key} onClick={() => { setMediaTab(t.key); setFile(null); setPreview(null); }}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    mediaTab === t.key ? "liquid-glass shadow-sm text-foreground" : "text-muted-foreground")}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>

            {/* Photo */}
            {mediaTab === 'photo' && (
              preview ? (
                <div className="relative rounded-xl overflow-hidden aspect-video">
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  <button onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current.click()}
                  className="w-full border-2 border-dashed border-primary/30 rounded-xl py-8 flex flex-col items-center gap-2 hover:bg-secondary/50 transition-colors">
                  <Camera size={24} className="text-primary/50" />
                  <span className="text-sm text-muted-foreground">Chọn ảnh</span>
                </button>
              )
            )}

            {/* Audio / Voice */}
            {mediaTab === 'audio' && (
              <div className="space-y-2">
                {preview ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Xem trước âm thanh</p>
                    <audio src={preview} controls className="w-full" />
                    <button onClick={() => { setFile(null); setPreview(null); }}
                      className="text-xs text-destructive flex items-center gap-1 mx-auto">
                      <X size={11} /> Xóa
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      className={cn("flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all text-sm font-medium",
                        recording
                          ? "border-primary bg-primary text-primary-foreground animate-pulse"
                          : "border-dashed border-primary/30 text-muted-foreground hover:bg-secondary/50")}>
                      {recording ? <><MicOff size={18} /> Thả để dừng</> : <><Mic size={18} /> Giữ để thu âm</>}
                    </button>
                    <button onClick={() => fileRef.current.click()}
                      className="px-4 py-4 rounded-xl border-2 border-dashed border-primary/30 text-muted-foreground hover:bg-secondary/50 transition-colors text-xs">
                      Upload
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Video */}
            {mediaTab === 'video' && (
              preview ? (
                <div className="relative rounded-xl overflow-hidden aspect-video">
                  <video src={preview} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                  <button onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                    <X size={12} className="text-white" />
                  </button>
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <span className="text-white text-xs bg-black/50 px-2 py-0.5 rounded-full">Max 3s · auto-loop</span>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileRef.current.click()}
                  className="w-full border-2 border-dashed border-primary/30 rounded-xl py-8 flex flex-col items-center gap-2 hover:bg-secondary/50 transition-colors">
                  <Video size={24} className="text-primary/50" />
                  <span className="text-sm text-muted-foreground">Chọn video ngắn (≤3s)</span>
                </button>
              )
            )}

            <input
              ref={fileRef}
              type="file"
              accept={mediaTab === 'photo' ? 'image/*' : mediaTab === 'audio' ? 'audio/*' : 'video/*'}
              className="hidden"
              onChange={handleFile}
            />

            <Textarea placeholder="Nhắn gì đó đi... 💕" value={message}
              onChange={(e) => setMessage(e.target.value)} className="text-sm resize-none" rows={2} />
            <Button onClick={handleUpload} disabled={!file || uploading} className="w-full gradient-primary text-white border-0 rounded-xl">
              {uploading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
              {uploading ? 'Đang gửi...' : 'Gửi Locket'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}