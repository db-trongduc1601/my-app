import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../firebase';
import { doc, setDoc, getDocs, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { RefreshCw, Trophy, Zap, AlertCircle, Play, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

export default function WhackAPartner({ currentHighScores }) {
  const currentUser = auth.currentUser;
  const myEmailLower = currentUser?.email?.toLowerCase() || '';

  // States
  const [profiles, setProfiles] = useState({});
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(''); // target email chosen by user
  
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds game
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [instantDefeat, setInstantDefeat] = useState(false); // flag for clicking self
  
  const [moles, setMoles] = useState(Array(9).fill(null)); // null, 'target', 'self'
  const [floaters, setFloaters] = useState([]); // array of { id, text, x, y }

  const popTimerRef = useRef(null);
  const gameTimerRef = useRef(null);

  // 1. Fetch own profile
  useEffect(() => {
    if (!myEmailLower) return;
    const unsub = onSnapshot(doc(db, 'user_profiles', myEmailLower), snap => {
      if (snap.exists()) setProfiles(prev => ({ ...prev, [myEmailLower]: snap.data() }));
    });
    return () => unsub();
  }, [myEmailLower]);

  // 2. Load accepted friends list
  useEffect(() => {
    if (!myEmailLower) return;
    const load = async () => {
      try {
        const q1 = query(collection(db, 'friends'), where('owner_email', '==', myEmailLower), where('status', '==', 'accepted'));
        const q2 = query(collection(db, 'friends'), where('friend_email', '==', myEmailLower), where('status', '==', 'accepted'));
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const list = [];
        snap1.forEach(d => list.push(d.data().friend_email?.toLowerCase()));
        snap2.forEach(d => list.push(d.data().owner_email?.toLowerCase()));
        const unique = [...new Set(list.filter(Boolean))];
        setFriends(unique);
        if (unique.length > 0) setSelectedFriend(unique[0]);

        // Watch profiles of all friends
        unique.forEach(email => {
          onSnapshot(doc(db, 'user_profiles', email), snap => {
            if (snap.exists()) setProfiles(prev => ({ ...prev, [email]: snap.data() }));
          });
        });
      } catch (e) {
        console.error('WhackAPartner: error loading friends', e);
      }
    };
    load();
  }, [myEmailLower]);

  // 3. Load high score
  useEffect(() => {
    const scores = currentHighScores || {};
    if (myEmailLower) {
      setHighScore(scores[myEmailLower] || 0);
    }
  }, [currentHighScores, myEmailLower]);

  // Sync highscore
  const updateHighScore = async (newScore) => {
    if (!myEmailLower) return;
    try {
      const scores = currentHighScores || {};
      const newScores = { ...scores, [myEmailLower]: newScore };
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

  const myPhoto = profiles[myEmailLower]?.photo_url || auth.currentUser?.photoURL || null;
  const targetPhoto = profiles[selectedFriend]?.photo_url || null;

  const getFriendName = (email) => {
    const prof = profiles[email?.toLowerCase()];
    return prof?.display_name?.split(' ')[0] || email?.split('@')[0] || 'Bạn yêu';
  };

  // Mole spawner
  const spawnMole = () => {
    setMoles(prev => {
      const emptyHoles = [];
      prev.forEach((val, idx) => {
        if (val === null) emptyHoles.push(idx);
      });

      if (emptyHoles.length === 0) return prev;

      const randomHole = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];
      const nextMoles = [...prev];
      // 60% chance to spawn target friend, 40% chance to spawn self
      nextMoles[randomHole] = Math.random() < 0.6 ? 'target' : 'self';

      // Hide after random duration
      const hideDuration = Math.max(800 - score * 4, 450);
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

  // Start play loops
  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    setInstantDefeat(false);
    setScore(0);
    setTimeLeft(30);
    setMoles(Array(9).fill(null));
    setFloaters([]);

    // 1. Spawner interval
    const runSpawner = () => {
      spawnMole();
      const nextDelay = Math.max(950 - score * 6, 450);
      popTimerRef.current = setTimeout(runSpawner, nextDelay);
    };
    runSpawner();

    // 2. Countdown timer ticker
    gameTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          triggerGameOver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerGameOver = () => {
    clearInterval(gameTimerRef.current);
    clearTimeout(popTimerRef.current);
    setIsPlaying(false);
    setGameOver(true);
    setMoles(Array(9).fill(null));
  };

  // Check Game Over score sync
  useEffect(() => {
    if (gameOver && !instantDefeat) {
      const scores = currentHighScores || {};
      if (score > (scores[myEmailLower] || 0)) {
        updateHighScore(score);
      }
    }
  }, [gameOver, score, currentHighScores, myEmailLower, instantDefeat]);

  // Click handler
  const handleWhack = (e, index) => {
    if (!isPlaying || moles[index] === null) return;

    const moleType = moles[index];
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Safely get client X and Y coordinates (supporting both mouse and touch events)
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches?.[0]?.clientX !== undefined ? e.touches?.[0]?.clientX : null);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches?.[0]?.clientY !== undefined ? e.touches?.[0]?.clientY : null);
    
    const x = clientX !== null ? (clientX - rect.left) : (rect.width / 2);
    const y = clientY !== null ? (clientY - rect.top) : (rect.height / 2);

    if (moleType === 'target') {
      // Hit partner! +10 score
      const points = 10;
      setScore(prev => prev + points);
      
      const floaterId = Math.random();
      setFloaters(prev => [...prev, { id: floaterId, text: '+10', x, y, index }]);
      setTimeout(() => {
        setFloaters(prev => prev.filter(f => f.id !== floaterId));
      }, 800);

      // Hide immediately
      setMoles(prev => {
        const next = [...prev];
        next[index] = null;
        return next;
      });
    } else {
      // Hit self! Instant Game Over defeat!
      setInstantDefeat(true);
      triggerGameOver();
      toast.error("Ầu nô! Bạn đã tự đập trúng đầu mình và thua cuộc! 😵");
    }
  };

  const handleRestart = () => {
    setScore(0);
    setGameOver(false);
    setInstantDefeat(false);
    setIsPlaying(false);
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.06),transparent_60%)] pointer-events-none" />

        {moles.map((mole, idx) => {
          const isUp = mole !== null;
          const isTarget = mole === 'target';
          const avatarUrl = isTarget ? targetPhoto : myPhoto;
          const fallbackIcon = isTarget ? '👩‍🎨' : '👨‍💻';

          return (
            <div
              key={idx}
              onClick={(e) => handleWhack(e, idx)}
              className="rounded-full relative border border-white/5 bg-[#140b10] shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden cursor-pointer active:scale-95"
              style={{ touchAction: 'none' }}
            >
              <div className="absolute inset-0 rounded-full shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)] pointer-events-none z-10" />

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
                      isTarget ? "border-primary" : "border-red-500"
                    )}
                    style={{ pointerEvents: 'none' }}
                  />
                ) : (
                  <span className="text-3xl animate-scale-up" style={{ pointerEvents: 'none' }}>
                    {fallbackIcon}
                  </span>
                )}

                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              </div>

              {floaters.filter(f => f.index === idx).map(f => (
                <span
                  key={f.id}
                  className="absolute font-black text-lg pointer-events-none animate-float-up z-20 select-none text-green-400 text-glow-green"
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
        <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed max-w-[270px] mx-auto">
          ⚠️ **Luật chơi mới**: Đập trúng bạn yêu được <span className="text-green-400 font-bold">+10đ</span>. Nhỡ tay đập trúng bản thân là <span className="text-red-400 font-bold">Thua ngay lập tức</span>!
        </p>
      </div>

      {/* Start screen / Game Over Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 bg-[#181116]/80 backdrop-blur-md rounded-3xl z-[1000] flex flex-col items-center justify-center p-6 space-y-4 border border-white/10 animate-fade-in font-display">
          {gameOver ? (
            <>
              <AlertCircle size={44} className="text-red-500 animate-bounce" />
              <h2 className="text-xl font-bold text-glow">
                {instantDefeat ? "Thất Bại! 😵" : "Hết Giờ! ⏱️"}
              </h2>
              <div className="text-center font-body space-y-1">
                <p className="text-xs text-muted-foreground">
                  {instantDefeat ? "Lý do: Tự đập trúng mình" : "Điểm số đập được:"}
                </p>
                <p className="text-2xl font-black text-primary text-glow">{score}đ</p>
                {score >= highScore && score > 0 && !instantDefeat && (
                  <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mt-1">🎉 Kỷ lục mới của bạn!</p>
                )}
              </div>
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl gradient-primary text-white text-xs font-bold shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer animate-pulse"
              >
                <RefreshCw size={12} /> Chơi lại
              </button>
            </>
          ) : (
            <>
              <span className="text-4xl animate-pulse">🔨</span>
              <h2 className="text-lg font-bold text-glow text-center">Đập Avatar Trêu Ghẹo 😈</h2>
              
              {/* Partner/Friend selector before starting */}
              <div className="w-full space-y-2 p-3 liquid-glass rounded-2xl border-none">
                <label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                  <Users size={10} /> Chọn người trêu ghẹo:
                </label>
                <select
                  value={selectedFriend}
                  onChange={(e) => setSelectedFriend(e.target.value)}
                  className="w-full bg-[#20151f] text-foreground text-xs rounded-xl border border-white/10 p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {friends.length === 0 ? (
                    <option value="" disabled>Chưa có bạn bè — hãy kết bạn trước!</option>
                  ) : (
                    friends.map(email => (
                      <option key={email} value={email}>{getFriendName(email)}</option>
                    ))
                  )}
                </select>
              </div>

              <p className="text-[10px] text-muted-foreground text-center max-w-[210px] leading-relaxed font-body">
                Nhanh tay đập đối phương chui lên. Tránh đập trúng avatar chính bạn nếu không muốn bị xử thua cuộc!
              </p>
              
              <button
                onClick={startGame}
                className="w-full py-2.5 rounded-2xl gradient-primary text-white text-xs font-bold shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
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
