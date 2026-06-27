import { useState, useRef, useEffect, useCallback } from 'react';
import { Music, Plus, Loader2, Link2, Upload, Trash2, Pause, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, storage } from '../../firebase';
import { collection, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function getYoutubeEmbed(url, autoplay = false) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}?enablejsapi=1${autoplay ? '&autoplay=1' : ''}`;
}

function getYoutubeThumbnail(url) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

/* ── Vinyl Player ──────────────────────────────────── */
function VinylPlayer({ track, isPlaying, onTogglePlay, iframeRef, audioRef }) {
  const isYoutube = track?.loai === 'link' && getYoutubeEmbed(track?.url);
  const isUpload = track?.loai === 'upload';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Disc */}
      <div className="relative" style={{ width: 200, height: 200 }}>
        {/* Spinning disc */}
        <div
          style={{
            width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle at center, #1a1a1a 0%, #2a2a2a 30%, #111 31%, #222 40%, #111 41%, #1e1e1e 55%, #0d0d0d 56%, #1a1a1a 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.4)',
            animation: isPlaying ? 'vinyl-spin 3s linear infinite' : 'none',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Grooves */}
          {[60, 75, 90, 105, 120, 135, 148].map(r => (
            <div key={r} style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: r * 2, height: r * 2,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.04)',
              pointerEvents: 'none',
            }} />
          ))}
          {/* Album art center label */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 78, height: 78,
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.15)',
          }}>
            {track?.anh_bia
              ? <img src={track.anh_bia} alt={track.ten_bai} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FF6B9D, #FF8FAB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎵</div>
            }
          </div>
          {/* Spindle */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 10, height: 10,
            borderRadius: '50%',
            background: '#ccc',
            boxShadow: '0 0 0 2px rgba(0,0,0,0.5)',
            zIndex: 2,
          }} />
        </div>

        {/* Tonearm */}
        <div style={{
          position: 'absolute',
          top: -10,
          right: -20,
          transformOrigin: '12px 12px',
          transform: isPlaying ? 'rotate(25deg)' : 'rotate(0deg)',
          transition: 'transform 0.4s ease',
          zIndex: 10,
        }}>
          {/* Arm base */}
          <div style={{
            width: 24, height: 24,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #888, #555)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }} />
          {/* Arm rod */}
          <div style={{
            position: 'absolute',
            top: 12, left: 12,
            width: 3,
            height: 80,
            background: 'linear-gradient(to bottom, #999, #666)',
            transformOrigin: 'top left',
            transform: 'rotate(-15deg)',
            boxShadow: '1px 0 4px rgba(0,0,0,0.3)',
          }} />
          {/* Needle */}
          <div style={{
            position: 'absolute',
            top: 82, left: 7,
            width: 6, height: 14,
            background: '#aaa',
            borderRadius: '0 0 2px 2px',
            transform: 'rotate(-15deg)',
          }} />
        </div>

        {/* Play/Pause button overlay */}
        <button
          onClick={onTogglePlay}
          disabled={!track}
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 52, height: 52,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white',
            cursor: track ? 'pointer' : 'default',
            zIndex: 5,
            transition: 'opacity 0.2s',
            opacity: isPlaying ? 0 : 1,
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = isPlaying ? '0' : '1'}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 3 }} />}
        </button>
      </div>

      {/* Track info */}
      {track ? (
        <div className="text-center">
          <p className="font-bold text-base truncate max-w-[220px]">{track.ten_bai}</p>
          {track.nghe_si && <p className="text-sm text-muted-foreground">{track.nghe_si}</p>}
          {track.ghi_chu && <p className="text-xs text-muted-foreground italic mt-0.5">"{track.ghi_chu}"</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">↓ Chọn bài hát bên dưới</p>
      )}

      {/* Hidden YouTube iframe (stays in DOM for audio continuity) */}
      {isYoutube && (
        <iframe
          ref={iframeRef}
          src={getYoutubeEmbed(track.url, true)}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: -9999 }}
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      )}

      {/* Hidden audio element for uploaded files */}
      {isUpload && track?.url && (
        <audio
          ref={audioRef}
          src={track.url}
          style={{ display: 'none' }}
          onPlay={() => {}}
          onPause={() => {}}
          onEnded={() => {}}
        />
      )}
    </div>
  );
}

export default function MusicTab({ tracks, onRefresh }) {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState('link');
  const [form, setForm] = useState({ ten_bai: '', nghe_si: '', url: '', ghi_chu: '', anh_bia: '' });
  const [file, setFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const coverFileRef = useRef();
  const iframeRef = useRef();
  const audioRef = useRef();
  const prevTrackId = useRef(null);

  // Stop previous media when track changes
  useEffect(() => {
    if (!nowPlaying) {
      setIsPlaying(false);
      return;
    }
    // When switching tracks, set playing true (iframe gets autoplay=1 in src)
    if (prevTrackId.current !== nowPlaying.id) {
      prevTrackId.current = nowPlaying.id;
      setIsPlaying(true);
    }
  }, [nowPlaying]);

  // Control audio element when isPlaying changes
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Control YouTube iframe via postMessage (only for pause/resume of already-loaded iframe)
  const sendYouTubeCommand = useCallback((func) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args: [] }), '*'
      );
    } catch (e) {}
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (!nowPlaying) return;
    const next = !isPlaying;
    setIsPlaying(next);

    if (nowPlaying.loai === 'link') {
      // postMessage only works on already-loaded iframes (pause/resume, not initial start)
      sendYouTubeCommand(next ? 'playVideo' : 'pauseVideo');
    }
  }, [isPlaying, nowPlaying, sendYouTubeCommand]);

  const handleSelectTrack = useCallback((track) => {
    // Stop current track first
    if (nowPlaying && nowPlaying.id !== track.id) {
      if (nowPlaying.loai === 'link') {
        sendYouTubeCommand('stopVideo');
      } else if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
    setNowPlaying(track);
    // isPlaying will be set to true in useEffect above
  }, [nowPlaying, sendYouTubeCommand]);

  const handleSave = async () => {
    if (!form.ten_bai) return;
    setSaving(true);
    try {
      let url = form.url;
      let anh_bia = form.anh_bia;

      if (mode === 'upload' && file) {
        const fileExt = file.name ? file.name.split('.').pop() : 'mp3';
        const fileName = `music_tracks/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, file);
        url = await getDownloadURL(storageRef);
      }

      if (coverFile) {
        const imgExt = coverFile.name ? coverFile.name.split('.').pop() : 'jpg';
        const imgName = `music_covers/${Date.now()}_${Math.random().toString(36).substring(7)}.${imgExt}`;
        const imgRef = ref(storage, imgName);
        await uploadBytes(imgRef, coverFile);
        anh_bia = await getDownloadURL(imgRef);
      } else if (mode === 'link' && !anh_bia) {
        const ytThumb = getYoutubeThumbnail(url);
        if (ytThumb) anh_bia = ytThumb;
      }

      await addDoc(collection(db, 'music_tracks'), {
        ...form,
        url,
        anh_bia,
        loai: mode,
        created_date: new Date().toISOString()
      });
      toast.success('🎵 Đã thêm bài hát!');
      setForm({ ten_bai: '', nghe_si: '', url: '', ghi_chu: '', anh_bia: '' });
      setFile(null);
      setCoverFile(null);
      setShowForm(false);
      onRefresh?.();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi lưu bài hát!');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (track) => {
    try {
      if (track.url && track.url.includes('firebasestorage')) {
        const fileRef2 = ref(storage, track.url);
        await deleteObject(fileRef2).catch(() => {});
      }
      await deleteDoc(doc(db, 'music_tracks', track.id));
      toast.success('Đã xóa');
      if (nowPlaying?.id === track.id) {
        setNowPlaying(null);
        setIsPlaying(false);
      }
      onRefresh?.();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa bài hát!');
    }
  };

  return (
    <>
      {/* Inline CSS for vinyl spin */}
      <style>{`
        @keyframes vinyl-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="space-y-4">
        {/* Vinyl Player — always visible at top */}
        <div className="liquid-glass rounded-2xl p-5 flex flex-col items-center relative overflow-visible">
          <VinylPlayer
            track={nowPlaying}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            iframeRef={iframeRef}
            audioRef={audioRef}
          />
        </div>

        {/* Add track form toggle */}
        <button onClick={() => setShowForm(v => !v)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors">
          <Plus size={15} /> Thêm bài hát
        </button>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="liquid-glass rounded-2xl p-4 space-y-3">
              <div className="flex gap-2">
                <button onClick={() => setMode('link')}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all",
                    mode === 'link' ? "bg-primary text-primary-foreground" : "liquid-glass-sm text-muted-foreground")}>
                  <Link2 size={14} /> Dán link
                </button>
                <button onClick={() => setMode('upload')}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all",
                    mode === 'upload' ? "bg-primary text-primary-foreground" : "liquid-glass-sm text-muted-foreground")}>
                  <Upload size={14} /> Upload file
                </button>
              </div>
              <Input placeholder="Tên bài hát *" value={form.ten_bai} onChange={e => setForm(f => ({...f, ten_bai: e.target.value}))} />
              <Input placeholder="Ca sĩ / nghệ sĩ" value={form.nghe_si} onChange={e => setForm(f => ({...f, nghe_si: e.target.value}))} />
              {mode === 'link' ? (
                <Input placeholder="Link YouTube / SoundCloud..." value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} />
              ) : (
                <div>
                  <button onClick={() => fileRef.current.click()}
                    className="w-full border-2 border-dashed border-primary/30 rounded-xl py-5 flex flex-col items-center gap-1.5 hover:bg-secondary/50 transition-colors text-sm text-muted-foreground">
                    <Upload size={20} className="text-primary/50" />
                    {file ? file.name : 'Chọn file audio / video'}
                  </button>
                  <input ref={fileRef} type="file" accept="audio/*,video/*" className="hidden" onChange={e => setFile(e.target.files[0])} />
                </div>
              )}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Ảnh bìa bài hát (tùy chọn)</p>
                <div className="flex gap-2">
                  <Input 
                    placeholder={coverFile ? coverFile.name : "Dán URL ảnh hoặc nhấn nút tải lên..."} 
                    value={form.anh_bia} 
                    onChange={e => setForm(f => ({...f, anh_bia: e.target.value}))}
                    className="flex-1"
                    disabled={!!coverFile}
                  />
                  <button
                    type="button"
                    onClick={() => coverFileRef.current.click()}
                    className="px-3 py-2 liquid-glass-sm rounded-xl text-xs font-semibold hover:bg-primary hover:text-white transition-all flex items-center gap-1.5 flex-shrink-0"
                  >
                    <Upload size={12} />
                    {coverFile ? 'Đã chọn' : 'Tải ảnh'}
                  </button>
                  <input 
                    ref={coverFileRef} 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={e => {
                      const selected = e.target.files[0];
                      if (selected) {
                        setCoverFile(selected);
                        setForm(f => ({ ...f, anh_bia: '' })); // clear manually typed URL to prioritize upload
                      }
                    }} 
                  />
                </div>
              </div>
              <Input placeholder="Ghi chú vibe... (tuỳ chọn)" value={form.ghi_chu} onChange={e => setForm(f => ({...f, ghi_chu: e.target.value}))} />
              <Button onClick={handleSave} disabled={saving || !form.ten_bai || (mode === 'link' && !form.url) || (mode === 'upload' && !file)}
                className="w-full gradient-primary text-white border-0 rounded-xl">
                {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Thêm vào playlist
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Track list */}
        <div className="space-y-2">
          {tracks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Music size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Playlist trống rỗng 🎵</p>
            </div>
          ) : (
            tracks.map(track => {
              const isActive = nowPlaying?.id === track.id;
              return (
                <motion.div
                  key={track.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "liquid-glass liquid-glass-interactive rounded-2xl p-3 flex items-center gap-3 cursor-pointer transition-all",
                    isActive && "border border-primary/30 shadow-md"
                  )}
                  onClick={() => handleSelectTrack(track)}
                >
                  {/* Cover art */}
                  <div className="relative flex-shrink-0">
                    <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden' }}>
                      {track.anh_bia
                        ? <img src={track.anh_bia} alt={track.ten_bai} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #FF6B9D, #FF8FAB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎵</div>
                      }
                    </div>
                    {isActive && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 10,
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {isPlaying
                          ? <Pause size={16} color="white" />
                          : <Play size={16} color="white" style={{ marginLeft: 2 }} />
                        }
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-semibold text-sm truncate", isActive && "text-primary")}>{track.ten_bai}</p>
                    {track.nghe_si && <p className="text-xs text-muted-foreground">{track.nghe_si}</p>}
                    {track.ghi_chu && <p className="text-xs text-muted-foreground italic truncate">"{track.ghi_chu}"</p>}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(track); }}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}