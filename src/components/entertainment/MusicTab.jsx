import { useState, useRef, useEffect, useCallback } from 'react';
import { Music, Plus, Loader2, Link2, Upload, Trash2, Pause, Play, Users, X, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, storage, auth } from '../../firebase';
import { collection, doc, addDoc, deleteDoc, setDoc, onSnapshot, query, where, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
function VinylPlayer({ 
  track, 
  isPlaying, 
  onTogglePlay, 
  onInvite, 
  iframeRef, 
  audioRef, 
  onIframeLoad, 
  isGuestMode,
  showUnmuteFallback,
  onUnmute,
  currentTime,
  duration,
  onSliderStart,
  onSliderChange,
  onSliderSeek,
  formatTime
}) {
  const isYoutube = track?.loai === 'link' && getYoutubeEmbed(track?.url);
  const isUpload = track?.loai === 'upload';

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Disc */}
      <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
        {/* Ambient Glow behind the disc */}
        {isPlaying && (
          <div
            className="absolute animate-vinyl-glow"
            style={{
              width: 190,
              height: 190,
              borderRadius: '50%',
              background: 'linear-gradient(45deg, #ff007f, #7f00ff, #00f0ff, #ff007f)',
              backgroundSize: '400% 400%',
              zIndex: 0,
            }}
          />
        )}

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
            willChange: 'transform',
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
            zIndex: 1,
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

        {/* Fallback "Bấm để nghe" overlay cho Guest khi bị block autoplay */}
        {showUnmuteFallback && (
          <button
            onClick={onUnmute}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(244, 114, 152, 0.95)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              zIndex: 20,
              animation: 'pulse-unmute 2s infinite',
              boxShadow: '0 0 20px rgba(244, 114, 152, 0.6)'
            }}
          >
            <span style={{ fontSize: 24, marginBottom: 4 }}>🔊</span>
            <span style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bấm để nghe</span>
          </button>
        )}

        {/* Rủ bạn bè button */}
        {track && !isGuestMode && (
          <button
            onClick={onInvite}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-20 border-2 border-background"
            title="Rủ nghe chung"
          >
            <Headphones size={18} />
          </button>
        )}
      </div>

      {/* Track info & Progress Bar */}
      {track ? (
        <div className="text-center w-full flex flex-col items-center">
          <p className="font-bold text-base truncate max-w-[220px]">{track.ten_bai}</p>
          {track.nghe_si && <p className="text-sm text-muted-foreground">{track.nghe_si}</p>}
          {track.ghi_chu && <p className="text-xs text-muted-foreground italic mt-0.5">"{track.ghi_chu}"</p>}
          {isGuestMode && <p className="text-[10px] font-semibold text-primary mt-1 animate-pulse">Đang nghe cùng bạn bè...</p>}
          
          <div className="w-full max-w-[240px] mt-3 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium px-0.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onMouseDown={onSliderStart}
              onTouchStart={onSliderStart}
              onChange={onSliderChange}
              onMouseUp={onSliderSeek}
              onTouchEnd={onSliderSeek}
              className="w-full h-1 rounded-lg appearance-none bg-white/10 accent-primary cursor-pointer outline-none focus:outline-none transition-all hover:h-1.5"
              style={{
                background: `linear-gradient(to right, #e11d48 0%, #e11d48 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) 100%)`
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">↓ Chọn bài hát bên dưới</p>
      )}

      {/* Hidden YouTube iframe */}
      {isYoutube && (
        <iframe
          key={track.id}
          ref={iframeRef}
          src={getYoutubeEmbed(track.url, true)}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: -9999 }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          onLoad={onIframeLoad}
        />
      )}

      {/* Hidden audio element */}
      {isUpload && track?.url && (
        <audio
          ref={audioRef}
          src={track.url}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
}

let ytApiPromise = null;
function loadYouTubeApi() {
  if (ytApiPromise) return ytApiPromise;
  
  ytApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      resolve();
    };
  });
  
  return ytApiPromise;
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
  const [iframeReady, setIframeReady] = useState(false);
  const [showUnmuteFallback, setShowUnmuteFallback] = useState(false);

  // Time & Seek states
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const ytPlayerRef = useRef(null);
  
  // Listen Together states
  const [friends, setFriends] = useState([]);
  const [profiles, setProfiles] = useState({}); // To store display names
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeSession, setActiveSession] = useState(null); // Host or Guest session details
  const [incomingInvite, setIncomingInvite] = useState(null);

  const fileRef = useRef();
  const coverFileRef = useRef();
  const iframeRef = useRef();
  const audioRef = useRef();
  const prevTrackId = useRef(null);
  const sessionSyncInterval = useRef();

  const currentUser = auth.currentUser;

  // Đồng bộ trạng thái nghe nhạc (Music Status Sync) lên user_profiles
  useEffect(() => {
    if (!currentUser || !currentUser.email) return;

    const updatePlayingStatus = async () => {
      try {
        const q = query(collection(db, 'user_profiles'), where('email', '==', currentUser.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const profileDoc = snap.docs[0];
          await updateDoc(doc(db, 'user_profiles', profileDoc.id), {
            listening_to: isPlaying && nowPlaying ? {
              ten_bai: nowPlaying.ten_bai || '',
              ca_si: nowPlaying.nghe_si || nowPlaying.ca_si || '',
              updatedAt: new Date().toISOString()
            } : null
          });
        }
      } catch (err) {
        console.error("Lỗi cập nhật trạng thái nghe nhạc:", err);
      }
    };

    updatePlayingStatus();

    return () => {
      const clearPlayingStatus = async () => {
        try {
          const q = query(collection(db, 'user_profiles'), where('email', '==', currentUser.email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const profileDoc = snap.docs[0];
            await updateDoc(doc(db, 'user_profiles', profileDoc.id), {
              listening_to: null
            });
          }
        } catch (e) {}
      };
      clearPlayingStatus();
    };
  }, [isPlaying, nowPlaying, currentUser]);

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSliderStart = () => {
    setIsDragging(true);
  };

  const handleSliderChange = (e) => {
    setCurrentTime(parseFloat(e.target.value));
  };

  const handleSliderSeek = (e) => {
    const val = parseFloat(e.target.value);
    setIsDragging(false);
    
    if (nowPlaying?.loai === 'upload' && audioRef.current) {
      audioRef.current.currentTime = val;
    } else if (nowPlaying?.loai === 'link' && ytPlayerRef.current) {
      sendYouTubeCommand('seekTo', [val, true]);
    }
    
    if (activeSession) {
      const docId = activeSession.id;
      console.log("[MusicTab] Guest/Host seeking to:", val);
      setDoc(doc(db, 'listening_sessions', docId), {
        position_at_start: val,
        started_at: serverTimestamp(),
        last_action_by: currentUser.email
      }, { merge: true })
      .then(() => console.log("[MusicTab] Seek write successful"))
      .catch(err => console.error("[MusicTab] Seek write failed:", err));
    }
  };

  // Poll progress
  useEffect(() => {
    let timer;
    if (isPlaying && nowPlaying) {
      const updateProgress = () => {
        if (isDragging) return;
        
        if (nowPlaying.loai === 'upload' && audioRef.current) {
          setCurrentTime(audioRef.current.currentTime || 0);
          setDuration(audioRef.current.duration || 0);
        } else if (nowPlaying.loai === 'link' && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          try {
            setCurrentTime(ytPlayerRef.current.getCurrentTime() || 0);
            setDuration(ytPlayerRef.current.getDuration() || 0);
          } catch (e) {}
        }
      };
      
      updateProgress();
      timer = setInterval(updateProgress, 500);
    } else {
      if (nowPlaying) {
        if (nowPlaying.loai === 'upload' && audioRef.current) {
          setCurrentTime(audioRef.current.currentTime || 0);
          setDuration(audioRef.current.duration || 0);
        } else if (nowPlaying.loai === 'link' && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          try {
            setCurrentTime(ytPlayerRef.current.getCurrentTime() || 0);
            setDuration(ytPlayerRef.current.getDuration() || 0);
          } catch (e) {}
        }
      }
    }
    return () => clearInterval(timer);
  }, [isPlaying, nowPlaying, isDragging]);

  // Reset progress on track change
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [nowPlaying?.id]);

  // Load friends for inviting
  useEffect(() => {
    if (!currentUser) return;
    const loadFriends = async () => {
      const q1 = query(collection(db, 'friends'), where('owner_email', '==', currentUser.email), where('status', '==', 'accepted'));
      const q2 = query(collection(db, 'friends'), where('friend_email', '==', currentUser.email), where('status', '==', 'accepted'));
      const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const frs = [];
      s1.forEach(d => frs.push(d.data().friend_email));
      s2.forEach(d => frs.push(d.data().owner_email));
      setFriends([...new Set(frs)]);
    };
    loadFriends();

    const unsubProfiles = onSnapshot(collection(db, 'user_profiles'), (snap) => {
      const profs = {};
      snap.forEach(doc => {
        if (doc.data().email) {
          profs[doc.data().email.toLowerCase()] = doc.data().display_name || doc.data().email.split('@')[0];
        }
      });
      setProfiles(profs);
    });
    return () => unsubProfiles();
  }, [currentUser]);

  // Lắng nghe incoming invites (Guest Flow) và trạng thái Host
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'listening_sessions'), 
      where('participants', 'array-contains', currentUser.email)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      let invite = null;
      let activeGuest = null;
      let activeHost = null;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.host_email === currentUser.email) {
          // Là Host
          if (data.status === 'inviting' || data.status === 'active') {
            activeHost = { role: 'host', id: doc.id, participant: data.participant_email, ...data, receivedAt: Date.now() };
          }
        } else {
          // Là Guest
          if (data.status === 'inviting') {
            invite = { id: doc.id, ...data };
          } else if (data.status === 'active') {
            activeGuest = { role: 'guest', id: doc.id, ...data, receivedAt: Date.now() };
          }
        }
      });

      setIncomingInvite(invite);

      // Cập nhật session Host/Guest
      if (activeGuest) {
        setActiveSession(activeGuest);
        const track = tracks.find(t => t.id === activeGuest.track_id) || activeGuest.track;
        if (track && prevTrackId.current !== track.id) {
          handleSelectTrack(track, true); // true = isGuest
        }
      } else if (activeHost) {
        setActiveSession(activeHost);
      } else {
        // Cả Guest và Host đều kết thúc (hoặc Guest từ chối / rời phòng)
        setActiveSession((prev) => {
          if (prev?.role === 'guest') {
            setIsPlaying(false);
            if (audioRef.current) audioRef.current.pause();
            try { iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'); } catch (e) {}
            toast.info("Đã kết thúc phiên nghe chung.");
          } else if (prev?.role === 'host') {
            setIsPlaying(false);
            if (audioRef.current) audioRef.current.pause();
            try { iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'); } catch (e) {}
            toast.info("Người nghe chung đã rời phòng.");
          }
          return null;
        });
      }
    });
    return () => unsub();
  }, [currentUser, tracks]);

  // Đồng bộ trạng thái phát giữa Host và Guest (Song hành hai chiều)
  useEffect(() => {
    if (!activeSession) return;
    
    console.log("[MusicTab] Sync effect triggered. Remote session:", activeSession);
    
    // Bỏ qua nếu hành động cuối cùng do chính mình thực hiện để tránh phản hồi lặp
    if (activeSession.last_action_by === currentUser.email) {
      console.log("[MusicTab] Skipping sync: last action was by me");
      return;
    }

    const { started_at, position_at_start, is_playing, track_id, track } = activeSession;
    
    // Đồng bộ bài hát
    if (track_id && nowPlaying?.id !== track_id) {
      const targetTrack = tracks.find(t => t.id === track_id) || track;
      if (targetTrack) {
        console.log("[MusicTab] Syncing track to:", targetTrack.ten_bai);
        handleSelectTrack(targetTrack, true);
      }
    }

    // Đồng bộ Trạng thái Phát/Tạm dừng
    if (is_playing !== undefined && is_playing !== isPlaying) {
      console.log("[MusicTab] Syncing play state to:", is_playing);
      setIsPlaying(is_playing);
      if (is_playing) {
        if (nowPlaying?.loai === 'upload' && audioRef.current) {
          audioRef.current.play().catch(() => {});
        } else if (nowPlaying?.loai === 'link' && iframeReady) {
          sendYouTubeCommand('playVideo');
        }
      } else {
        if (nowPlaying?.loai === 'upload' && audioRef.current) {
          audioRef.current.pause();
        } else if (nowPlaying?.loai === 'link' && iframeReady) {
          sendYouTubeCommand('pauseVideo');
        }
      }
    }

    // Đồng bộ Vị trí phát (Seek)
    if (is_playing && activeSession.receivedAt) {
      const expectedPos = position_at_start + (Date.now() - activeSession.receivedAt) / 1000;

      // Sync Audio
      if (audioRef.current && nowPlaying?.loai === 'upload') {
        const diff = Math.abs(audioRef.current.currentTime - expectedPos);
        console.log("[MusicTab] Audio position diff:", diff);
        if (diff > 2.5) {
          audioRef.current.currentTime = expectedPos;
        }
      }

      // Sync YouTube
      if (iframeReady && nowPlaying?.loai === 'link') {
        let currentYtPos = 0;
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          try { currentYtPos = ytPlayerRef.current.getCurrentTime() || 0; } catch (e) {}
        }
        const diff = Math.abs(currentYtPos - expectedPos);
        console.log("[MusicTab] YouTube position diff:", diff, "expected:", expectedPos, "current:", currentYtPos);
        if (diff > 2.5) {
          sendYouTubeCommand('seekTo', [expectedPos, true]);
        }
      }
    } else if (!is_playing && position_at_start !== undefined) {
      // Khi tạm dừng, đồng bộ vị trí chính xác
      if (audioRef.current && nowPlaying?.loai === 'upload') {
        const diff = Math.abs(audioRef.current.currentTime - position_at_start);
        if (diff > 1.5) {
          audioRef.current.currentTime = position_at_start;
        }
      }
      if (iframeReady && nowPlaying?.loai === 'link') {
        let currentYtPos = 0;
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          try { currentYtPos = ytPlayerRef.current.getCurrentTime() || 0; } catch (e) {}
        }
        const diff = Math.abs(currentYtPos - position_at_start);
        console.log("[MusicTab] Paused sync position diff:", diff);
        if (diff > 1.5) {
          sendYouTubeCommand('seekTo', [position_at_start, true]);
        }
      }
    }
  }, [
    activeSession?.started_at,
    activeSession?.position_at_start,
    activeSession?.is_playing,
    activeSession?.track_id,
    activeSession?.last_action_by,
    iframeReady,
    nowPlaying?.id,
    tracks
  ]);

  // Lắng nghe trạng thái phát để hiện nút Unmute Fallback cho Guest
  useEffect(() => {
    if (activeSession?.role !== 'guest' || !isPlaying || !nowPlaying) {
      setShowUnmuteFallback(false);
      return;
    }

    const timer = setTimeout(() => {
      if (nowPlaying.loai === 'upload') {
        if (audioRef.current?.paused) {
          setShowUnmuteFallback(true);
        }
      } else {
        // Luôn hiện nút unblock cho YouTube trên mobile vì không đọc được trạng thái trực tiếp
        setShowUnmuteFallback(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeSession?.role, isPlaying, nowPlaying?.id]);

  const handleGuestUnmute = () => {
    if (nowPlaying?.loai === 'upload' && audioRef.current) {
      audioRef.current.play()
        .then(() => setShowUnmuteFallback(false))
        .catch(err => {
          console.log("Unmute failed:", err);
        });
    } else if (nowPlaying?.loai === 'link') {
      sendYouTubeCommand('playVideo');
      setTimeout(() => sendYouTubeCommand('playVideo'), 200);
      setShowUnmuteFallback(false);
    }
  };

  // Host: Định kỳ cập nhật vị trí nhạc để đồng bộ drift nhẹ
  useEffect(() => {
    if (activeSession?.role === 'host' && isPlaying) {
      const docId = activeSession.id;
      const updateHostState = async () => {
        try {
          const currentPos = nowPlaying?.loai === 'link' && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function'
            ? ytPlayerRef.current.getCurrentTime() || 0
            : (audioRef.current?.currentTime || 0);
          await setDoc(doc(db, 'listening_sessions', docId), {
            is_playing: true,
            started_at: serverTimestamp(),
            position_at_start: currentPos,
            last_action_by: currentUser.email
          }, { merge: true });
        } catch (e) {}
      };
      sessionSyncInterval.current = setInterval(updateHostState, 15000); // 15s/lần để tránh spam DB và giật lag
    }

    return () => {
      if (sessionSyncInterval.current) clearInterval(sessionSyncInterval.current);
    };
  }, [activeSession?.role, isPlaying, nowPlaying, currentUser.email]);


  // Stop previous media and start selection instantly
  useEffect(() => {
    if (!nowPlaying) {
      setIsPlaying(false);
      return;
    }

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

  const handleIframeLoad = async () => {
    try {
      await loadYouTubeApi();
      if (!iframeRef.current) return;
      
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (e) {}
        ytPlayerRef.current = null;
      }
      
      ytPlayerRef.current = new window.YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            setIframeReady(true);
            if (isPlaying) {
              try { ytPlayerRef.current?.playVideo(); } catch (e) {}
            }
          }
        }
      });
    } catch (e) {
      console.error("Lỗi bind YouTube Player API:", e);
      setIframeReady(true);
      if (isPlaying) {
        sendYouTubeCommand('playVideo');
      }
    }
  };

  // Control YouTube iframe via postMessage
  const sendYouTubeCommand = useCallback((func, args = []) => {
    try {
      if (ytPlayerRef.current && typeof ytPlayerRef.current[func] === 'function') {
        if (func === 'seekTo') {
          ytPlayerRef.current.seekTo(args[0], args[1]);
        } else {
          ytPlayerRef.current[func]();
        }
      } else {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func, args }), '*'
        );
      }
    } catch (e) {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func, args }), '*'
        );
      } catch (err) {}
    }
  }, []);

  useEffect(() => {
    if (nowPlaying?.loai !== 'link' || !iframeReady) return;
    if (isPlaying) {
      sendYouTubeCommand('playVideo');
    } else {
      sendYouTubeCommand('pauseVideo');
    }
  }, [isPlaying, nowPlaying?.id, iframeReady, sendYouTubeCommand]);

  const handleTogglePlay = useCallback(() => {
    if (!nowPlaying) return;
    const next = !isPlaying;
    setIsPlaying(next);

    const currentPos = nowPlaying.loai === 'link' && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function'
      ? ytPlayerRef.current.getCurrentTime() || 0
      : (audioRef.current?.currentTime || 0);

    if (nowPlaying.loai === 'upload' && audioRef.current) {
      if (next) audioRef.current.play().catch(() => {});
      else audioRef.current.pause();
    } else if (nowPlaying.loai === 'link' && iframeReady) {
      sendYouTubeCommand(next ? 'playVideo' : 'pauseVideo');
    }

    if (activeSession) {
      console.log("[MusicTab] Writing togglePlay state to Firestore:", next);
      setDoc(doc(db, 'listening_sessions', activeSession.id), {
        is_playing: next,
        position_at_start: currentPos,
        started_at: serverTimestamp(),
        last_action_by: currentUser.email
      }, { merge: true })
      .then(() => console.log("[MusicTab] TogglePlay write successful"))
      .catch(err => console.error("[MusicTab] TogglePlay write failed:", err));
    }
  }, [isPlaying, nowPlaying, iframeReady, sendYouTubeCommand, activeSession, currentUser.email]);

  const handleSelectTrack = useCallback((track, isGuest = false) => {
    if (activeSession?.role === 'guest' && !isGuest) {
      toast.warning("Bạn đang nghe chung, không thể tự đổi bài.");
      return;
    }

    if (nowPlaying?.id === track.id) {
      setIsPlaying(true);
      if (track.loai === 'link') {
        sendYouTubeCommand('playVideo');
      }
      return;
    }

    if (nowPlaying) {
      if (nowPlaying.loai === 'link') {
        sendYouTubeCommand('stopVideo');
      } else if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }

    prevTrackId.current = track.id;
    setIframeReady(false);
    setNowPlaying(track);
    setIsPlaying(true);

    if (activeSession && !isGuest) {
      setDoc(doc(db, 'listening_sessions', activeSession.id), {
        track_id: track.id,
        track: track,
        is_playing: true,
        started_at: serverTimestamp(),
        position_at_start: 0,
        last_action_by: currentUser.email
      }, { merge: true }).catch(()=>{});
    }
  }, [nowPlaying, sendYouTubeCommand, activeSession, currentUser.email]);

  /* --- Listen Together Host Handlers --- */
  const handleInviteFriend = async (friendEmail) => {
    if (!nowPlaying) return;
    const docId = [currentUser.email, friendEmail].sort().join('_');
    try {
      await setDoc(doc(db, 'listening_sessions', docId), {
        host_email: currentUser.email,
        host_name: currentUser.displayName?.split(' ')[0] || 'Bạn bè',
        participant_email: friendEmail,
        participants: [currentUser.email, friendEmail],
        status: 'inviting',
        track_id: nowPlaying.id,
        track: nowPlaying,
        is_playing: isPlaying,
        position_at_start: nowPlaying?.loai === 'link' && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function'
          ? ytPlayerRef.current.getCurrentTime() || 0
          : (audioRef.current?.currentTime || 0),
        started_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      setShowInviteModal(false);
      setActiveSession({ role: 'host', id: docId, participant: friendEmail, receivedAt: Date.now() });
      toast.success("Đã gửi lời mời nghe chung! 🎧");
    } catch (e) {
      console.error(e);
      toast.error("Không thể gửi lời mời.");
    }
  };

  const handleStopSession = async () => {
    if (activeSession) {
      await setDoc(doc(db, 'listening_sessions', activeSession.id), { status: 'ended' }, { merge: true });
      setActiveSession(null);
      toast.info("Đã dừng nghe chung.");
    }
  };

  /* --- Listen Together Guest Handlers --- */
  const handleAcceptInvite = async () => {
    if (!incomingInvite) return;
    try {
      const track = incomingInvite.track;
      // Chọn bài hát đồng bộ ngay lập tức để unblock autoplay
      handleSelectTrack(track, true); // true = isGuest
      
      // Nếu là upload track, cố gắng phát ngay lập tức
      if (track?.loai === 'upload' && audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.play().catch(() => {});
      }
      
      await setDoc(doc(db, 'listening_sessions', incomingInvite.id), {
        status: 'active'
      }, { merge: true });
      toast.success("Đã tham gia nghe chung! 🎶");
    } catch (e) {
      toast.error("Lỗi tham gia.");
    }
  };

  const handleDeclineInvite = async () => {
    if (!incomingInvite) return;
    try {
      await setDoc(doc(db, 'listening_sessions', incomingInvite.id), {
        status: 'declined'
      }, { merge: true });
      setIncomingInvite(null);
    } catch (e) {}
  };

  const handleLeaveSession = async () => {
    if (activeSession) {
      try {
        await setDoc(doc(db, 'listening_sessions', activeSession.id), { status: 'ended' }, { merge: true });
        setActiveSession(null);
        setIsPlaying(false);
        if (nowPlaying?.loai === 'link') {
          sendYouTubeCommand('pauseVideo');
        } else if (audioRef.current) {
          audioRef.current.pause();
        }
        toast.info("Đã thoát chế độ nghe chung.");
      } catch (e) {}
    }
  };

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
      <style>{`
        @keyframes vinyl-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-unmute {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>

      {/* Guest Invite Banner */}
      <AnimatePresence>
        {incomingInvite && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="mb-4 mx-2">
            <div className="liquid-glass border-primary/40 p-4 rounded-2xl shadow-xl flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Headphones size={20} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Lời mời nghe chung 🎧</p>
                  <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{incomingInvite.host_name}</span> muốn rủ bạn cùng nghe bài {incomingInvite.track?.ten_bai}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAcceptInvite} className="flex-1 gradient-primary text-white h-9 rounded-xl text-sm">Tham gia ngay</Button>
                <Button onClick={handleDeclineInvite} variant="ghost" className="flex-1 h-9 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-muted-foreground">Bỏ qua</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {/* Active Session Host Banner */}
        {activeSession?.role === 'host' && (
          <div className="mx-2 mb-2 px-3 py-2 liquid-glass-sm rounded-xl flex items-center justify-between border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-xs font-medium">Đang phát cho: <span className="text-primary">{profiles[activeSession.participant.toLowerCase()] || activeSession.participant.split('@')[0]}</span></p>
            </div>
            <button onClick={handleStopSession} className="text-[10px] uppercase font-bold text-destructive px-2 py-1 bg-destructive/10 rounded-lg hover:bg-destructive/20">Dừng</button>
          </div>
        )}

        {/* Vinyl Player */}
        <div className="liquid-glass rounded-2xl p-5 flex flex-col items-center relative overflow-visible">
          <VinylPlayer
            track={nowPlaying}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onInvite={() => setShowInviteModal(true)}
            iframeRef={iframeRef}
            audioRef={audioRef}
            isGuestMode={activeSession?.role === 'guest'}
            showUnmuteFallback={showUnmuteFallback}
            onUnmute={handleGuestUnmute}
            onIframeLoad={handleIframeLoad}
            currentTime={currentTime}
            duration={duration}
            onSliderStart={handleSliderStart}
            onSliderChange={handleSliderChange}
            onSliderSeek={handleSliderSeek}
            formatTime={formatTime}
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
                        setForm(f => ({ ...f, anh_bia: '' })); 
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
        <div className="space-y-2 relative">
          {activeSession?.role === 'guest' && (
             <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-2xl gap-3">
                <p className="text-sm font-semibold text-primary liquid-glass px-4 py-2 rounded-xl shadow-lg">Bạn đang ở chế độ Nghe chung 🎧</p>
                <button 
                  onClick={handleLeaveSession}
                  className="px-4 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 hover:scale-105 transition-all shadow-sm border border-destructive/20"
                >
                  Thoát nghe chung
                </button>
             </div>
          )}
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

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="w-[90%] max-w-sm rounded-3xl p-5 liquid-glass-heavy border-none">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Headphones size={20} className="text-primary"/> Rủ bạn cùng nghe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto mt-2 pr-1">
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Bạn chưa có bạn bè nào.</p>
            ) : (
              friends.map(email => (
                <div key={email} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <p className="text-sm font-medium truncate flex-1">{profiles[email.toLowerCase()] || email.split('@')[0]}</p>
                  <Button size="sm" onClick={() => handleInviteFriend(email)} className="h-8 rounded-lg gradient-primary text-xs">Mời</Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}