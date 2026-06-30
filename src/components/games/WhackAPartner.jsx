import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { RefreshCw, Trophy, Zap, AlertCircle, Play } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

export default function WhackAPartner({ currentHighScores }) {
  const currentUser = auth.currentUser;
  const myEmailLower = currentUser?.email?.toLowerCase() || '';
  
  // Profiles for avatar photos
  const ducEmail = 'trongduc16012003@gmail.com';
  const quynhEmail = 'maianhquynh123@gmail.com';
  const partnerEmail = myEmailLower === ducEmail ? quynhEmail : ducEmail;

  // States
  const [profiles, setProfiles] = useState({});
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds game
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  
  // Mole board: 9 holes
  const [moles, setMoles] = useState(Array(9).fill(null)); // null, 'partner', 'self'
  const [floaters, setFloaters] = useState([]); // array of { id, text, x, y } for floating points

  // Audio/vibe feedback
  const popTimerRef = useRef(null);
  const gameTimerRef = useRef(null);

  // Fetch profiles to get avatar URLs
  useEffect(() => {
    const emails = [ducEmail, quynhEmail];
    // We already query them, but let's subscribe in the component
    const unsubs = emails.map(email => {
      return doc(db, 'user_profiles', email);
    });
    // Let's listen to profiles
    const unsubDuc = onSnapshot(doc(db, 'user_profiles', ducEmail), (snap) => {
      if (snap.exists()) setProfiles(prev => ({ ...prev, [ducEmail]: snap.data() }));
    });
    const unsubQuynh = onSnapshot(doc(db, 'user_profiles', quynhEmail), (snap) => {
      if (snap.exists()) setProfiles(prev => ({ ...prev, [quynhEmail]: snap.data() }));
    });

    return () => {
      unsubDuc();
      unsubQuynh();
    };
  }, []);

  // Load high score
  useEffect(() => {
    if (currentHighScores && myEmailLower) {
      setHighScore(currentHighScores[myEmailLower] || 0);
    }
  }, [currentHighScores, myEmailLower]);

  // Sync highscore
  const updateHighScore = async (newScore) => {
    if (!myEmailLower) return;
    try {
      const newScores = { ...currentHighScores, [myEmailLower]: newScore };
      await setDoc(doc(db, 'game_high_scores', 'whack_a_partner'), {
        scores: newScores,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setHighScore(newScore);
      toast.success("🏆 Kỷ lục mới đã được đồng bộ!");
      confetti({
        particleCount: 100,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Get photo URLs
  const getAvatarPhoto = (email, fallbackEmoji) => {
    const prof = profiles[email];
    return prof?.photo_url || auth.currentUser?.photoURL || null;
  };

  const myPhoto = getAvatarPhoto(myEmailLower);
  const partnerPhoto = getAvatarPhoto(partnerEmail);

  // Spawning logic
  const spawnMole = () => {
    setMoles(prev => {
      // Find empty holes
      const emptyHoles = [];
      prev.forEach((val, idx) => {
        if (val === null) emptyHoles.push(idx);
      });

      if (emptyHoles.length === 0) return prev;

      const randomHole = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];
      const nextMoles = [...prev];
      // 70% chance to spawn partner, 30% chance to spawn self
      nextMoles[randomHole] = Math.random() < 0.7 ? 'partner' : 'self';

      // Hide after random duration
      const hideDuration = Math.max(700 - score * 3, 400); // gets faster
      setTimeout(() => {
        setMoles(current => {
          const updated = [...current];
          if (updated[randomHole] !== null) {
            updated[randomHole] = null;
          }
          return updated;
        });
      }, hideDuration);

      return nextMoles;
    });
  };

  // Start game loops
  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    setTimeLeft(30);
    setMoles(Array(9).fill(null));
    setFloaters([]);

    // 1. Ticker for moles spawning
    const runSpawner = () => {
      spawnMole();
      const nextDelay = Math.max(900 - score * 5, 450);
      popTimerRef.current = setTimeout(runSpawner, nextDelay);
    };
    runSpawner();

    // 2. Ticker for game countdown timer
    gameTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Game Over triggers
          clearInterval(gameTimerRef.current);
          clearTimeout(popTimerRef.current);
          setIsPlaying(false);
          setGameOver(true);
          setMoles(Array(9).fill(null));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Check Game Over score sync
  useEffect(() => {
    if (gameOver) {
      if (score > (currentHighScores[myEmailLower] || 0)) {
        updateHighScore(score);
      }
    }
  }, [gameOver, score, currentHighScores, myEmailLower]);

  // Click on hole handler
  const handleWhack = (e, index) => {
    if (!isPlaying || moles[index] === null) return;

    const moleType = moles[index];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let points = 0;
    let text = '';

    if (moleType === 'partner') {
      points = 10;
      text = '+10';
    } else {
      points = -10;
      text = '-10';
    }

    setScore(prev => Math.max(prev + points, 0));
    
    // Add floater indicator
    const floaterId = Math.random();
    setFloaters(prev => [...prev, { id: floaterId, text, x, y }]);
    setTimeout(() => {
      setFloaters(prev => prev.filter(f => f.id !== floaterId));
    }, 800);

    // Hide mole immediately
    setMoles(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const handleRestart = () => {
    startGame();
  };

  useEffect(() => {
    return () => {
      clearInterval(gameTimerRef.current);
      clearTimeout(popTimerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto space-y-4 select-none relative font-display text-foreground">
      {/* Game Header details */}
      <div className="w-full grid grid-cols-3 gap-2 justify-between items-center liquid-glass px-4 py-2.5 rounded-2xl border-none shadow-md">
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Thời gian</span>
          <span className="text-sm font-black text-cyan-400">{timeLeft}s</span>
        </div>
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Điểm số</span>
          <span className="text-xl font-black text-primary text-glow">{score}</span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
            <Trophy size={10} className="text-yellow-400" /> Kỷ lục
          </span>
          <span className="text-sm font-bold text-yellow-400">{highScore}</span>
        </div>
      </div>

      {/* 3x3 Whack Grid board */}
      <div className="w-full aspect-square bg-[#1c1219]/95 border border-white/10 rounded-3xl p-4 grid grid-cols-3 grid-rows-3 gap-4 touch-action-none shadow-xl relative overflow-hidden">
        {/* Neon decorative lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.06),transparent_60%)] pointer-events-none" />

        {moles.map((mole, idx) => {
          const isUp = mole !== null;
          const isPartner = mole === 'partner';
          const avatarUrl = isPartner ? partnerPhoto : myPhoto;
          const fallbackIcon = isPartner ? '👩‍🎨' : '👨‍💻';

          return (
            <div
              key={idx}
              onClick={(e) => handleWhack(e, idx)}
              className="rounded-full relative border border-white/5 bg-[#140b10] shadow-inner flex items-center justify-center overflow-hidden cursor-pointer active:scale-95"
              style={{ touchAction: 'none' }}
            >
              {/* Crater inner shadow */}
              <div className="absolute inset-0 rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)] pointer-events-none z-10" />

              {/* Mole sliding item */}
              <div
                className={cn(
                  "absolute w-[80%] h-[80%] rounded-full flex items-center justify-center transition-all duration-150 transform translate-y-full z-0 select-none",
                  isUp ? "translate-y-0" : "translate-y-full"
                )}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Mole Avatar"
                    className={cn(
                      "w-full h-full rounded-full object-cover border-2 shadow-md",
                      isPartner ? "border-primary" : "border-slate-500 opacity-60"
                    )}
                    style={{ pointerEvents: 'none' }}
                  />
                ) : (
                  <span className="text-3xl" style={{ pointerEvents: 'none' }}>
                    {fallbackIcon}
                  </span>
                )}

                {/* Glass glare over image */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              </div>

              {/* Floaters scoring text indicator */}
              {floaters.map(f => (
                <span
                  key={f.id}
                  className={cn(
                    "absolute font-black text-lg pointer-events-none animate-float-up z-20 select-none",
                    f.text.startsWith('+') ? "text-green-400 text-glow-green" : "text-red-500 text-glow"
                  )}
                  style={{ left: `${f.x}px`, top: `${f.y - 10}px` }}
                >
                  {f.text}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* Rules / Tip box */}
      <div className="w-full text-center">
        <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed max-w-[260px] mx-auto">
          💡 **Mẹo**: Nhấp đập vào đối phương để được <span className="text-green-400 font-bold">+10 điểm</span>. Đập nhầm mình bị phạt <span className="text-red-400 font-bold">-10 điểm</span>!
        </p>
      </div>

      {/* Prompt Overlay to start or Game Over details */}
      {!isPlaying && (
        <div className="absolute inset-0 bg-[#181116]/80 backdrop-blur-md rounded-3xl z-[1000] flex flex-col items-center justify-center p-6 space-y-4 border border-white/10 animate-fade-in font-display">
          {gameOver ? (
            <>
              <AlertCircle size={44} className="text-red-500 animate-bounce" />
              <h2 className="text-xl font-bold text-glow">Hết Giờ! ⏱️</h2>
              <div className="text-center font-body space-y-1">
                <p className="text-xs text-muted-foreground">Điểm số đập được:</p>
                <p className="text-2xl font-black text-primary text-glow">{score}đ</p>
                {score >= highScore && score > 0 && (
                  <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mt-1">🎉 Kỷ lục mới của bạn!</p>
                )}
              </div>
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl gradient-primary text-white text-xs font-bold shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer"
              >
                <RefreshCw size={12} /> Chơi lại
              </button>
            </>
          ) : (
            <>
              <span className="text-4xl animate-pulse">🔨</span>
              <h2 className="text-lg font-bold text-glow text-center">Đập Avatar Trêu Ghẹo 😈</h2>
              <p className="text-xs text-muted-foreground text-center max-w-[200px] leading-relaxed font-body">
                Nhanh tay gõ đầu bạn yêu để ghi điểm xả stress. Né ảnh của mình ra nhé!
              </p>
              <button
                onClick={startGame}
                className="flex items-center gap-1.5 px-8 py-3 rounded-2xl gradient-primary text-white text-xs font-bold shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Play size={12} /> Bắt đầu chơi
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
