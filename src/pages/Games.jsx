import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Gamepad2, Trophy, ArrowLeft } from 'lucide-react';
import BlockBlast from '../components/games/BlockBlast';
import Love2048 from '../components/games/Love2048';

export default function Games() {
  const currentUser = auth.currentUser;
  const [activeGame, setActiveGame] = useState(null); // null, 'block_blast', 'love_2048'
  const [profiles, setProfiles] = useState({});
  const [blockBlastScores, setBlockBlastScores] = useState({});
  const [love2048Scores, setLove2048Scores] = useState({});

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
    return () => {
      unsubBB();
      unsub2048();
    };
  }, []);

  // Find users
  const ducEmail = 'trongduc16012003@gmail.com';
  const quynhEmail = 'maianhquynh123@gmail.com';

  const bbDuc = blockBlastScores[ducEmail] || blockBlastScores['duc@gmail.com'] || 0;
  const bbQuynh = blockBlastScores[quynhEmail] || blockBlastScores['quynh@gmail.com'] || 0;
  const maxBB = Math.max(bbDuc, bbQuynh);

  const l2048Duc = love2048Scores[ducEmail] || love2048Scores['duc@gmail.com'] || 0;
  const l2048Quynh = love2048Scores[quynhEmail] || love2048Scores['quynh@gmail.com'] || 0;
  const max2048 = Math.max(l2048Duc, l2048Quynh);

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Block Blast Card */}
        <div className="liquid-glass rim-light rounded-3xl p-5 flex flex-col justify-between text-left space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xl">🧩</span>
              <span className="text-[9px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Độ khó: Vừa
              </span>
            </div>
            <h3 className="font-bold text-base text-foreground mt-3 flex items-center gap-1.5">
              Block Blast <span className="text-xs text-muted-foreground font-normal">| Xếp gỗ tình yêu</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Kéo thả các khối hình gỗ xinh xắn vào ma trận 8x8. Xóa hàng hoặc cột đầy để tính điểm combo cực cao ăn mừng tình yêu!
            </p>
          </div>

          {/* High Score board */}
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
            {maxBB > 0 && (
              <div className="text-[10px] text-center text-muted-foreground italic mt-1 pt-1 border-t border-white/5">
                🏆 Kỷ lục đôi mình: <strong className="text-yellow-400 font-bold">{maxBB} điểm</strong>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveGame('block_blast')}
            className="w-full py-2.5 rounded-2xl gradient-primary text-white text-xs font-bold shadow-lg hover:opacity-90 transition active:scale-[0.98]"
          >
            Chơi ngay 🧩
          </button>
        </div>

        {/* Love 2048 Card */}
        <div className="liquid-glass rim-light rounded-3xl p-5 flex flex-col justify-between text-left space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-2xl">❤️</span>
              <span className="text-[9px] bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Độ khó: Cao
              </span>
            </div>
            <h3 className="font-bold text-base text-foreground mt-3 flex items-center gap-1.5">
              Love 2048 <span className="text-xs text-muted-foreground font-normal">| Đôi ta bên nhau</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Trượt gộp các ô số kỷ niệm để mở khóa 11 mốc tình yêu lãng mạn. Từ ngày "Mới quen" 🌸 cho đến trọn đời bên nhau ❤️!
            </p>
          </div>

          {/* High Score board */}
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
            {max2048 > 0 && (
              <div className="text-[10px] text-center text-muted-foreground italic mt-1 pt-1 border-t border-white/5">
                🏆 Kỷ lục đôi mình: <strong className="text-yellow-400 font-bold">{max2048} điểm</strong>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveGame('love_2048')}
            className="w-full py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold shadow-lg transition active:scale-[0.98]"
          >
            Chơi ngay ❤️
          </button>
        </div>
      </div>
    </div>
  );
}
