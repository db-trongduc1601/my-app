import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { Gamepad2, Trophy, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Love2048 from '../components/games/Love2048';
import Caro from '../components/games/Caro';
import { useProfiles } from '../hooks/useProfiles';

// ─── Shared back-button wrapper with click/tap animation ─────────────────────
function GameScreen({ onBack, children }) {
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full relative overflow-y-auto no-scrollbar font-display text-foreground px-4 py-2">
      <div className="flex items-center gap-2 mb-3">
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.95 }}
          className="p-1.5 rounded-full liquid-glass-sm hover:liquid-glow transition-all active:scale-95 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft size={16} />
        </motion.button>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Trở về</span>
      </div>
      {children}
    </div>
  );
}

// ─── ScoreBoard: renders scores with spring-based pulse animation on update ────
function ScoreBoard({ scoresMap, profiles }) {
  const entries = Object.entries(scoresMap)
    .map(([email, score]) => ({
      email,
      score,
      name: profiles[email]?.display_name?.split(' ')[0] || email.split('@')[0],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  if (entries.length === 0) return null;

  return (
    <div className="bg-white/5 rounded-2xl p-3 space-y-2 border border-white/5 font-body">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
        <Trophy size={10} className="text-yellow-400" /> Bảng điểm kỷ lục
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {entries.map(({ email, score, name }) => (
          <div key={email} className="flex items-center justify-between p-1.5 rounded-xl bg-white/5">
            <span className="text-muted-foreground truncate max-w-[80px]">{name}</span>
            <motion.span
              key={score}
              initial={{ scale: 1.5, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 350, damping: 15 }}
              className="font-bold text-primary"
            >
              {score}
            </motion.span>
          </div>
        ))}
        {entries.length === 1 && (
          <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5 opacity-40">
            <span className="text-muted-foreground">—</span>
            <span className="font-bold text-primary">0</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shimmer loading placeholder skeleton for cards ────────────────────────
function GameCardSkeleton() {
  return (
    <div className="liquid-glass rim-light rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-md h-[270px] animate-pulse">
      <div>
        <div className="flex items-center justify-between">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="w-16 h-4 rounded bg-white/10" />
        </div>
        <div className="w-2/3 h-5 rounded bg-white/10 mt-3" />
        <div className="w-full h-3 rounded bg-white/10 mt-2" />
        <div className="w-4/5 h-3 rounded bg-white/10 mt-1" />
      </div>
      <div className="bg-white/5 rounded-2xl p-3 space-y-2 border border-white/5">
        <div className="w-1/3 h-3 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-8 rounded-xl bg-white/10" />
          <div className="h-8 rounded-xl bg-white/10" />
        </div>
      </div>
      <div className="w-full h-10 rounded-2xl bg-white/10" />
    </div>
  );
}

// ─── Main Games page ─────────────────────────────────────────────────────────
export default function Games() {
  const currentUser = auth.currentUser;
  const myEmail = currentUser?.email?.toLowerCase() || '';

  const [activeGame, setActiveGame] = useState(null);
  const { profiles } = useProfiles();
  const [participantEmails, setParticipantEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [love2048Scores, setLove2048Scores] = useState({});

  // 1. Load accepted friends list → build participant email set
  useEffect(() => {
    if (!myEmail) return;
    const load = async () => {
      try {
        const q1 = query(collection(db, 'friends'), where('owner_email', '==', myEmail), where('status', '==', 'accepted'));
        const q2 = query(collection(db, 'friends'), where('friend_email', '==', myEmail), where('status', '==', 'accepted'));
        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const friendEmails = [];
        s1.forEach(d => friendEmails.push(d.data().friend_email?.toLowerCase()));
        s2.forEach(d => friendEmails.push(d.data().owner_email?.toLowerCase()));
        const all = [...new Set([myEmail, ...friendEmails.filter(Boolean)])];
        setParticipantEmails(all);
      } catch (e) {
        setParticipantEmails([myEmail]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [myEmail]);

  // 2. Watch the Love 2048 high-score doc
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'game_high_scores', 'love_2048'), snap => {
      if (snap.exists()) setLove2048Scores(snap.data().scores || {});
    });
    return () => unsub();
  }, []);

  // Filter score maps to only include participants we know
  const filterScores = (scoresMap) =>
    Object.fromEntries(
      Object.entries(scoresMap).filter(([email]) => participantEmails.includes(email))
    );

  const gameComponents = {
    love_2048: <Love2048 currentHighScores={love2048Scores} />,
    caro: <Caro />,
  };

  const GAME_CARDS = [
    {
      key: 'love_2048',
      emoji: '🔢',
      title: 'Love 2048',
      subtitle: 'Gộp số vô tận',
      desc: 'Trượt gộp các ô số giống nhau để nhân đôi giá trị. Điểm số tăng vô hạn, cạnh tranh kỷ lục đôi ta!',
      difficulty: 'Cao',
      diffColor: 'bg-cyan-100 text-cyan-700',
      btnClass: 'bg-cyan-500 hover:bg-cyan-600',
      scores: love2048Scores,
      showScores: true,
    },
    {
      key: 'caro',
      emoji: '❌⭕',
      title: 'Cờ Caro 3x3',
      subtitle: 'PvP & AI',
      desc: 'Trò chơi dân gian trí tuệ quen thuộc. Đấu trí thông minh với AI hoặc so tài PvP real-time trực tiếp cùng bạn yêu.',
      difficulty: 'Thấp',
      diffColor: 'bg-purple-100 text-purple-700',
      btnClass: 'bg-purple-500 hover:bg-purple-600',
      scores: null,
      showScores: false,
    },
  ];

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence mode="wait">
        {activeGame ? (
          <motion.div
            key={activeGame}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="w-full h-full"
          >
            <GameScreen onBack={() => setActiveGame(null)}>
              {gameComponents[activeGame]}
            </GameScreen>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-[calc(100vh-140px)] w-full relative overflow-y-auto no-scrollbar font-display text-foreground px-4 py-2 space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <Gamepad2 className="text-primary w-5 h-5 animate-pulse" />
                <h1 className="text-xl font-bold text-glow">Khu Trò Chơi 🎮</h1>
              </div>
              <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold">
                Đôi bạn cùng tiến
              </span>
            </div>

            {/* Game cards grid or Skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
              {loading ? (
                Array(2).fill(0).map((_, i) => <GameCardSkeleton key={i} />)
              ) : (
                GAME_CARDS.map(({ key, emoji, title, subtitle, desc, difficulty, diffColor, btnClass, scores, showScores }, index) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveGame(key)}
                    className="liquid-glass rim-light rounded-3xl p-5 flex flex-col justify-between text-left space-y-4 shadow-md cursor-pointer hover:border-primary/20 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{emoji}</span>
                        <span className={`text-[9px] ${diffColor} px-2 py-0.5 rounded-full font-bold uppercase tracking-wider`}>
                          Độ khó: {difficulty}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-foreground mt-3">
                        {title} <span className="text-xs text-muted-foreground font-normal">| {subtitle}</span>
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                    </div>

                    {showScores && scores && (
                      <ScoreBoard scoresMap={filterScores(scores)} profiles={profiles} />
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveGame(key);
                      }}
                      className={`w-full py-2.5 rounded-2xl text-white text-xs font-bold shadow-lg transition active:scale-[0.98] ${btnClass}`}
                    >
                      Chơi ngay {emoji.slice(0, 2)}
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
