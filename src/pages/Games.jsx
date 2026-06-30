import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Gamepad2, Trophy, ArrowLeft } from 'lucide-react';
import BlockBlast from '../components/games/BlockBlast';
import Love2048 from '../components/games/Love2048';
import Caro from '../components/games/Caro';
import FlappyHeart from '../components/games/FlappyHeart';
import WhackAPartner from '../components/games/WhackAPartner';

export default function Games() {
  const currentUser = auth.currentUser;
  const [activeGame, setActiveGame] = useState(null); // null, 'block_blast', 'love_2048', 'caro', 'flappy_heart', 'whack_a_partner'
  const [profiles, setProfiles] = useState({});
  const [blockBlastScores, setBlockBlastScores] = useState({});
  const [love2048Scores, setLove2048Scores] = useState({});
  const [flappyHeartScores, setFlappyHeartScores] = useState({});
  const [whackAPartnerScores, setWhackAPartnerScores] = useState({});

  // Fetch user profiles to display names
  useEffect(() => {
    const emails = ['duc@gmail.com', 'quynh@gmail.com', 'trongduc16012003@gmail.com', 'maianhquynh123@gmail.com'];
    const unsubs = emails.map(email => {
      return onSnapshot(doc(db, 'user_profiles', email), (snap) => {
        if (snap.exists()) {
          setProfiles(prev => ({ ...prev, [email]: snap.data() }));
        }
      });
    });

    return () => unsubs.forEach(un => un());
  }, []);

  // Fetch high scores from Firestore
  useEffect(() => {
    const unsubBB = onSnapshot(doc(db, 'game_high_scores', 'block_blast'), (snap) => {
      if (snap.exists()) {
        setBlockBlastScores(snap.data().scores || {});
      }
    });
    const unsub2048 = onSnapshot(doc(db, 'game_high_scores', 'love_2048'), (snap) => {
      if (snap.exists()) {
        setLove2048Scores(snap.data().scores || {});
      }
    });
    const unsubFlappy = onSnapshot(doc(db, 'game_high_scores', 'flappy_heart'), (snap) => {
      if (snap.exists()) {
        setFlappyHeartScores(snap.data().scores || {});
      }
    });
    const unsubWhack = onSnapshot(doc(db, 'game_high_scores', 'whack_a_partner'), (snap) => {
      if (snap.exists()) {
        setWhackAPartnerScores(snap.data().scores || {});
      }
    });
    return () => {
      unsubBB();
      unsub2048();
      unsubFlappy();
      unsubWhack();
    };
  }, []);

  // Emails representation
  const ducEmail = 'trongduc16012003@gmail.com';
  const quynhEmail = 'maianhquynh123@gmail.com';

  // High score extractions
  const bbDuc = blockBlastScores[ducEmail] || blockBlastScores['duc@gmail.com'] || 0;
  const bbQuynh = blockBlastScores[quynhEmail] || blockBlastScores['quynh@gmail.com'] || 0;
  const maxBB = Math.max(bbDuc, bbQuynh);

  const l2048Duc = love2048Scores[ducEmail] || love2048Scores['duc@gmail.com'] || 0;
  const l2048Quynh = love2048Scores[quynhEmail] || love2048Scores['quynh@gmail.com'] || 0;
  const max2048 = Math.max(l2048Duc, l2048Quynh);

  const flappyDuc = flappyHeartScores[ducEmail] || flappyHeartScores['duc@gmail.com'] || 0;
  const flappyQuynh = flappyHeartScores[quynhEmail] || flappyHeartScores['quynh@gmail.com'] || 0;
  const maxFlappy = Math.max(flappyDuc, flappyQuynh);

  const whackDuc = whackAPartnerScores[ducEmail] || whackAPartnerScores['duc@gmail.com'] || 0;
  const whackQuynh = whackAPartnerScores[quynhEmail] || whackAPartnerScores['quynh@gmail.com'] || 0;
  const maxWhack = Math.max(whackDuc, whackQuynh);

  if (activeGame === 'block_blast') {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] w-full relative overflow-y-auto no-scrollbar font-display text-foreground px-4 py-2">
        <div className="flex items-center gap-2 mb-3">
          <button 
            onClick={() => setActiveGame(null)} 
            className="p-1.5 rounded-full liquid-glass-sm hover:liquid-glow transition-all active:scale-95 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Trở về</span>
        </div>
        <BlockBlast currentHighScores={blockBlastScores} />
      </div>
    );
  }

  if (activeGame === 'love_2048') {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] w-full relative overflow-y-auto no-scrollbar font-display text-foreground px-4 py-2">
        <div className="flex items-center gap-2 mb-3">
          <button 
            onClick={() => setActiveGame(null)} 
            className="p-1.5 rounded-full liquid-glass-sm hover:liquid-glow transition-all active:scale-95 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Trở về</span>
        </div>
        <Love2048 currentHighScores={love2048Scores} />
      </div>
    );
  }

  if (activeGame === 'caro') {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] w-full relative overflow-y-auto no-scrollbar font-display text-foreground px-4 py-2">
        <div className="flex items-center gap-2 mb-3">
          <button 
            onClick={() => setActiveGame(null)} 
            className="p-1.5 rounded-full liquid-glass-sm hover:liquid-glow transition-all active:scale-95 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Trở về</span>
        </div>
        <Caro />
      </div>
    );
  }

  if (activeGame === 'flappy_heart') {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] w-full relative overflow-y-auto no-scrollbar font-display text-foreground px-4 py-2">
        <div className="flex items-center gap-2 mb-3">
          <button 
            onClick={() => setActiveGame(null)} 
            className="p-1.5 rounded-full liquid-glass-sm hover:liquid-glow transition-all active:scale-95 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Trở về</span>
        </div>
        <FlappyHeart currentHighScores={flappyHeartScores} />
      </div>
    );
  }

  if (activeGame === 'whack_a_partner') {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] w-full relative overflow-y-auto no-scrollbar font-display text-foreground px-4 py-2">
        <div className="flex items-center gap-2 mb-3">
          <button 
            onClick={() => setActiveGame(null)} 
            className="p-1.5 rounded-full liquid-glass-sm hover:liquid-glow transition-all active:scale-95 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Trở về</span>
        </div>
        <WhackAPartner currentHighScores={whackAPartnerScores} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full relative overflow-y-auto no-scrollbar font-display text-foreground px-4 py-2 space-y-6">
      {/* Header title */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Gamepad2 className="text-primary w-5 h-5 animate-pulse" />
          <h1 className="text-xl font-bold text-glow">Khu Trò Chơi 🎮</h1>
        </div>
        <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold">
          Đôi bạn cùng tiến
        </span>
      </div>

      {/* Game choices cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
        {/* Block Blast Card */}
        <div className="liquid-glass rim-light rounded-3xl p-5 flex flex-col justify-between text-left space-y-4 shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xl">🧩</span>
              <span className="text-[9px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Độ khó: Vừa
              </span>
            </div>
            <h3 className="font-bold text-base text-foreground mt-3">
              Block Blast <span className="text-xs text-muted-foreground font-normal">| Xếp gỗ tình yêu</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Kéo thả các khối hình gỗ xinh xắn vào ma trận 8x8. Xóa hàng hoặc cột đầy để tính điểm combo cực cao!
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 space-y-2 border border-white/5 font-body">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              <Trophy size={10} className="text-yellow-400" /> Bảng điểm kỷ lục
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5">
                <span className="text-muted-foreground truncate max-w-[80px]">Đức</span>
                <span className="font-bold text-primary">{bbDuc}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5">
                <span className="text-muted-foreground truncate max-w-[80px]">Quỳnh</span>
                <span className="font-bold text-primary">{bbQuynh}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveGame('block_blast')}
            className="w-full py-2.5 rounded-2xl gradient-primary text-white text-xs font-bold shadow-lg hover:opacity-90 transition active:scale-[0.98]"
          >
            Chơi ngay 🧩
          </button>
        </div>

        {/* Love 2048 Card */}
        <div className="liquid-glass rim-light rounded-3xl p-5 flex flex-col justify-between text-left space-y-4 shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xl">🔢</span>
              <span className="text-[9px] bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Độ khó: Cao
              </span>
            </div>
            <h3 className="font-bold text-base text-foreground mt-3">
              Love 2048 <span className="text-xs text-muted-foreground font-normal">| Gộp số vô tận</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Trượt gộp các ô số giống nhau để nhân đôi giá trị. Điểm số tăng vô hạn, cạnh tranh kỷ lục đôi ta!
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 space-y-2 border border-white/5 font-body">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              <Trophy size={10} className="text-yellow-400" /> Bảng điểm kỷ lục
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5">
                <span className="text-muted-foreground truncate max-w-[80px]">Đức</span>
                <span className="font-bold text-primary">{l2048Duc}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5">
                <span className="text-muted-foreground truncate max-w-[80px]">Quỳnh</span>
                <span className="font-bold text-primary">{l2048Quynh}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveGame('love_2048')}
            className="w-full py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold shadow-lg transition active:scale-[0.98]"
          >
            Chơi ngay 🔢
          </button>
        </div>

        {/* Caro 3x3 Card */}
        <div className="liquid-glass rim-light rounded-3xl p-5 flex flex-col justify-between text-left space-y-4 shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xl">❌⭕</span>
              <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Độ khó: Thấp
              </span>
            </div>
            <h3 className="font-bold text-base text-foreground mt-3">
              Cờ Caro 3x3 <span className="text-xs text-muted-foreground font-normal">| PvP & AI</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Trò chơi dân gian trí tuệ quen thuộc. Đấu trí thông minh với AI hoặc so tài cờ vây PvP real-time trực tiếp cùng bạn yêu.
            </p>
          </div>

          <button
            onClick={() => setActiveGame('caro')}
            className="w-full py-2.5 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold shadow-lg transition active:scale-[0.98]"
          >
            Chơi ngay ⚔️
          </button>
        </div>

        {/* Flappy Heart Card */}
        <div className="liquid-glass rim-light rounded-3xl p-5 flex flex-col justify-between text-left space-y-4 shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xl">🎈</span>
              <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Độ khó: Cao
              </span>
            </div>
            <h3 className="font-bold text-base text-foreground mt-3">
              Flappy Heart <span className="text-xs text-muted-foreground font-normal">| Nhảy vượt chướng ngại</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Nhấp bay lượn lách trái tim hồng vượt qua các kẹo bông chướng ngại. Đạt điểm số kỷ lục bay xa nhất!
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 space-y-2 border border-white/5 font-body">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              <Trophy size={10} className="text-yellow-400" /> Bảng điểm kỷ lục
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5">
                <span className="text-muted-foreground truncate max-w-[80px]">Đức</span>
                <span className="font-bold text-primary">{flappyDuc}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5">
                <span className="text-muted-foreground truncate max-w-[80px]">Quỳnh</span>
                <span className="font-bold text-primary">{flappyQuynh}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveGame('flappy_heart')}
            className="w-full py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-lg transition active:scale-[0.98]"
          >
            Chơi ngay 🎈
          </button>
        </div>

        {/* Whack-a-Partner Card */}
        <div className="liquid-glass rim-light rounded-3xl p-5 flex flex-col justify-between text-left space-y-4 shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xl">🔨</span>
              <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Độ khó: Vừa
              </span>
            </div>
            <h3 className="font-bold text-base text-foreground mt-3">
              Đập Avatar <span className="text-xs text-muted-foreground font-normal">| Trêu ghẹo bạn yêu</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Trêu ghẹo đối phương cực xả stress! Đập thật nhanh vào avatar đối phương chui lên từ hố kính, tránh đập mình nhé!
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 space-y-2 border border-white/5 font-body">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              <Trophy size={10} className="text-yellow-400" /> Bảng điểm kỷ lục
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5">
                <span className="text-muted-foreground truncate max-w-[80px]">Đức</span>
                <span className="font-bold text-primary">{whackDuc}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5">
                <span className="text-muted-foreground truncate max-w-[80px]">Quỳnh</span>
                <span className="font-bold text-primary">{whackQuynh}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveGame('whack_a_partner')}
            className="w-full py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-lg transition active:scale-[0.98]"
          >
            Chơi ngay 🔨
          </button>
        </div>
      </div>
    </div>
  );
}
