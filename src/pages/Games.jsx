import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { Gamepad2, Trophy, ArrowLeft } from 'lucide-react';
import BlockBlast from '../components/games/BlockBlast';
import Love2048 from '../components/games/Love2048';
import Caro from '../components/games/Caro';
import FlappyHeart from '../components/games/FlappyHeart';
import WhackAPartner from '../components/games/WhackAPartner';

// ─── Shared back-button wrapper ─────────────────────────────────────────────
function GameScreen({ onBack, children }) {
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full relative overflow-y-auto no-scrollbar font-display text-foreground px-4 py-2">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-full liquid-glass-sm hover:liquid-glow transition-all active:scale-95 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Trở về</span>
      </div>
      {children}
    </div>
  );
}

// ─── Leaderboard row: renders top-2 scores from a scores map ───────────────
function ScoreBoard({ scoresMap, profiles }) {
  // Build sorted entries so we always show top-2 players we know
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
            <span className="font-bold text-primary">{score}</span>
          </div>
        ))}
        {/* Pad to 2 columns if only 1 entry */}
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

// ─── Main Games page ─────────────────────────────────────────────────────────
export default function Games() {
  const currentUser = auth.currentUser;
  const myEmail = currentUser?.email?.toLowerCase() || '';

  const [activeGame, setActiveGame] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [participantEmails, setParticipantEmails] = useState([]);
  const [blockBlastScores, setBlockBlastScores] = useState({});
  const [love2048Scores, setLove2048Scores] = useState({});
  const [flappyHeartScores, setFlappyHeartScores] = useState({});
  const [whackAPartnerScores, setWhackAPartnerScores] = useState({});

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
        // On error, at least show the current user
        setParticipantEmails([myEmail]);
      }
    };
    load();
  }, [myEmail]);

  // 2. Watch profiles for all participants
  useEffect(() => {
    if (participantEmails.length === 0) return;
    const unsubs = participantEmails.map(email =>
      onSnapshot(doc(db, 'user_profiles', email), snap => {
        if (snap.exists()) setProfiles(prev => ({ ...prev, [email]: snap.data() }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [participantEmails]);

  // 3. Watch all four high-score docs
  useEffect(() => {
    const games = [
      ['block_blast', setBlockBlastScores],
      ['love_2048', setLove2048Scores],
      ['flappy_heart', setFlappyHeartScores],
      ['whack_a_partner', setWhackAPartnerScores],
    ];
    const unsubs = games.map(([id, setter]) =>
      onSnapshot(doc(db, 'game_high_scores', id), snap => {
        if (snap.exists()) setter(snap.data().scores || {});
      })
    );
    return () => unsubs.forEach(u => u());
  }, []);

  // Filter score maps to only include participants we know
  const filterScores = (scoresMap) =>
    Object.fromEntries(
      Object.entries(scoresMap).filter(([email]) => participantEmails.includes(email))
    );

  if (activeGame) {
    const scoresMaps = {
      block_blast: blockBlastScores,
      love_2048: love2048Scores,
      flappy_heart: flappyHeartScores,
      whack_a_partner: whackAPartnerScores,
    };
    const gameComponents = {
      block_blast: <BlockBlast currentHighScores={blockBlastScores} />,
      love_2048: <Love2048 currentHighScores={love2048Scores} />,
      caro: <Caro />,
      flappy_heart: <FlappyHeart currentHighScores={flappyHeartScores} />,
      whack_a_partner: <WhackAPartner currentHighScores={whackAPartnerScores} />,
    };
    return (
      <GameScreen onBack={() => setActiveGame(null)}>
        {gameComponents[activeGame]}
      </GameScreen>
    );
  }

  const GAME_CARDS = [
    {
      key: 'block_blast',
      emoji: '🧩',
      title: 'Block Blast',
      subtitle: 'Xếp gỗ tình yêu',
      desc: 'Kéo thả các khối hình gỗ xinh xắn vào ma trận 8x8. Xóa hàng hoặc cột đầy để tính điểm combo cực cao!',
      difficulty: 'Vừa',
      diffColor: 'bg-pink-100 text-pink-700',
      btnClass: 'gradient-primary',
      scores: blockBlastScores,
      showScores: true,
    },
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
    {
      key: 'flappy_heart',
      emoji: '🎈',
      title: 'Flappy Heart',
      subtitle: 'Nhảy vượt chướng ngại',
      desc: 'Nhấp bay lượn lách trái tim hồng vượt qua các kẹo bông chướng ngại. Đạt điểm số kỷ lục bay xa nhất!',
      difficulty: 'Cao',
      diffColor: 'bg-red-100 text-red-700',
      btnClass: 'bg-rose-500 hover:bg-rose-600',
      scores: flappyHeartScores,
      showScores: true,
    },
    {
      key: 'whack_a_partner',
      emoji: '🔨',
      title: 'Đập Avatar',
      subtitle: 'Trêu ghẹo bạn yêu',
      desc: 'Trêu ghẹo đối phương cực xả stress! Đập thật nhanh vào avatar đối phương chui lên từ hố kính, tránh đập mình nhé!',
      difficulty: 'Vừa',
      diffColor: 'bg-orange-100 text-orange-700',
      btnClass: 'bg-orange-500 hover:bg-orange-600',
      scores: whackAPartnerScores,
      showScores: true,
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full relative overflow-y-auto no-scrollbar font-display text-foreground px-4 py-2 space-y-6">
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

      {/* Game cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
        {GAME_CARDS.map(({ key, emoji, title, subtitle, desc, difficulty, diffColor, btnClass, scores, showScores }) => (
          <div key={key} className="liquid-glass rim-light rounded-3xl p-5 flex flex-col justify-between text-left space-y-4 shadow-md">
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
              onClick={() => setActiveGame(key)}
              className={`w-full py-2.5 rounded-2xl text-white text-xs font-bold shadow-lg transition active:scale-[0.98] ${btnClass}`}
            >
              Chơi ngay {emoji.slice(0, 2)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
