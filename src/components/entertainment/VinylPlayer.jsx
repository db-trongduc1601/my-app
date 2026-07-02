import { Pause, Play, Headphones } from 'lucide-react';
import { getYoutubeEmbed } from '@/lib/youtube';

/* ── Vinyl Player ──────────────────────────────────── */
export default function VinylPlayer({
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
