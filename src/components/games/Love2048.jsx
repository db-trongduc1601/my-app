import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { RefreshCw, Trophy, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

// Romantic labels matching tile values
const TILE_LABELS = {
  2: { text: '🌸 Mới quen', bg: 'linear-gradient(135deg, #fff0f6 0%, #ffdeeb 100%)', textCol: '#c2255c' },
  4: { text: '☕ Cafe đầu', bg: 'linear-gradient(135deg, #fff9db 0%, #ffe066 100%)', textCol: '#e67700' },
  8: { text: '🤝 Nắm tay', bg: 'linear-gradient(135deg, #fff4e6 0%, #ffd8a8 100%)', textCol: '#d9480f' },
  16: { text: '🍿 Xem phim', bg: 'linear-gradient(135deg, #ffe3e3 0%, #ffc9c9 100%)', textCol: '#e03131' },
  32: { text: '🎁 Tặng quà', bg: 'linear-gradient(135deg, #f3f0ff 0%, #e5dbff 100%)', textCol: '#5f3dc4' },
  64: { text: '✈️ Đi du lịch', bg: 'linear-gradient(135deg, #e3fafc 0%, #c5f6fa 100%)', textCol: '#0b7285' },
  128: { text: '💕 Tỏ tình', bg: 'linear-gradient(135deg, #fff0f6 0%, #faa2c1 100%)', textCol: '#a61e4d' },
  256: { text: '🏡 Ra mắt', bg: 'linear-gradient(135deg, #fff9db 0%, #ffd43b 100%)', textCol: '#f08c00' },
  512: { text: '💍 Đính hôn', bg: 'linear-gradient(135deg, #e6fcf5 0%, #96f2d7 100%)', textCol: '#087f5b' },
  1024: { text: '👰 Kết hôn', bg: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', textCol: '#212529', glow: true },
  2048: { text: '❤️ Trọn đời', bg: 'linear-gradient(135deg, #ff8787 0%, #fa5252 100%)', textCol: '#ffffff', glow: true, final: true }
};

export default function Love2048({ currentHighScores }) {
  const currentUser = auth.currentUser;
  const myEmailLower = currentUser?.email?.toLowerCase() || '';

  const [grid, setGrid] = useState(() => Array(4).fill(null).map(() => Array(4).fill(0)));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);

  const touchStartRef = useRef({ x: 0, y: 0 });

  // Load high score
  useEffect(() => {
    if (currentHighScores && myEmailLower) {
      setHighScore(currentHighScores[myEmailLower] || 0);
    }
  }, [currentHighScores, myEmailLower]);

  // Generate 2 or 4 inside a random empty cell
  const spawnTile = useCallback((currentGrid) => {
    const emptyCells = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentGrid[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length > 0) {
      const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      const nextGrid = currentGrid.map(row => [...row]);
      nextGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
      return nextGrid;
    }
    return currentGrid;
  }, []);

  // Initialize new game
  const startNewGame = useCallback(() => {
    let newGrid = Array(4).fill(null).map(() => Array(4).fill(0));
    newGrid = spawnTile(newGrid);
    newGrid = spawnTile(newGrid);
    setGrid(newGrid);
    setScore(0);
    setGameOver(false);
    setVictory(false);
    setKeepPlaying(false);
  }, [spawnTile]);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  // Sync highscore
  const updateHighScore = async (newScore) => {
    if (!myEmailLower) return;
    try {
      const newScores = { ...currentHighScores, [myEmailLower]: newScore };
      await setDoc(doc(db, 'game_high_scores', 'love_2048'), {
        scores: newScores,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setHighScore(newScore);
      toast.success("🏆 Kỷ lục mới đã được đồng bộ!");
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.error("Failed to update highscore:", e);
    }
  };

  // Slide & Merge logic helpers
  const slideRowLeft = (row) => {
    // Filter non-zeros
    let nonZeros = row.filter(val => val !== 0);
    let newRow = [];
    let addedScore = 0;

    for (let i = 0; i < nonZeros.length; i++) {
      if (i < nonZeros.length - 1 && nonZeros[i] === nonZeros[i + 1]) {
        // Merge
        const mergedVal = nonZeros[i] * 2;
        newRow.push(mergedVal);
        addedScore += mergedVal;
        i++; // skip next cell since it was merged
      } else {
        newRow.push(nonZeros[i]);
      }
    }

    // Pad with zeros to size 4
    while (newRow.length < 4) {
      newRow.push(0);
    }

    return { newRow, addedScore };
  };

  const checkGameOverStatus = (currentGrid) => {
    // Check empty cells
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentGrid[r][c] === 0) return false;
      }
    }
    // Check horizontal neighbors
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        if (currentGrid[r][c] === currentGrid[r][c + 1]) return false;
      }
    }
    // Check vertical neighbors
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentGrid[r][c] === currentGrid[r + 1][c]) return false;
      }
    }
    return true;
  };

  const move = useCallback((direction) => {
    if (gameOver || (victory && !keepPlaying)) return;

    let hasChanged = false;
    let addedScore = 0;
    let nextGrid = Array(4).fill(null).map(() => Array(4).fill(0));

    if (direction === 'LEFT') {
      for (let r = 0; r < 4; r++) {
        const { newRow, addedScore: rowScore } = slideRowLeft(grid[r]);
        nextGrid[r] = newRow;
        addedScore += rowScore;
        if (newRow.join(',') !== grid[r].join(',')) {
          hasChanged = true;
        }
      }
    } else if (direction === 'RIGHT') {
      for (let r = 0; r < 4; r++) {
        // Reverse row, slide left, then reverse back
        const reversed = [...grid[r]].reverse();
        const { newRow, addedScore: rowScore } = slideRowLeft(reversed);
        const finalRow = newRow.reverse();
        nextGrid[r] = finalRow;
        addedScore += rowScore;
        if (finalRow.join(',') !== grid[r].join(',')) {
          hasChanged = true;
        }
      }
    } else if (direction === 'UP') {
      for (let c = 0; c < 4; c++) {
        const column = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]];
        const { newRow, addedScore: colScore } = slideRowLeft(column);
        addedScore += colScore;
        for (let r = 0; r < 4; r++) {
          nextGrid[r][c] = newRow[r];
          if (nextGrid[r][c] !== grid[r][c]) {
            hasChanged = true;
          }
        }
      }
    } else if (direction === 'DOWN') {
      for (let c = 0; c < 4; c++) {
        const column = [grid[3][c], grid[2][c], grid[1][c], grid[0][c]];
        const { newRow, addedScore: colScore } = slideRowLeft(column);
        addedScore += colScore;
        // Reverse back
        const finalCol = newRow.reverse();
        for (let r = 0; r < 4; r++) {
          nextGrid[r][c] = finalCol[r];
          if (nextGrid[r][c] !== grid[r][c]) {
            hasChanged = true;
          }
        }
      }
    }

    if (hasChanged) {
      const spawnedGrid = spawnTile(nextGrid);
      setGrid(spawnedGrid);
      const newScore = score + addedScore;
      setScore(newScore);

      // Check if broke record
      if (newScore > highScore) {
        setHighScore(newScore);
      }

      // Check victory 2048 tile
      let has2048 = false;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (spawnedGrid[r][c] === 2048) {
            has2048 = true;
            break;
          }
        }
      }
      if (has2048 && !victory) {
        setVictory(true);
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }

      // Check Game Over
      if (checkGameOverStatus(spawnedGrid)) {
        setGameOver(true);
        if (newScore > (currentHighScores[myEmailLower] || 0)) {
          updateHighScore(newScore);
        }
      }
    }
  }, [grid, score, gameOver, victory, keepPlaying, highScore, myEmailLower, currentHighScores, spawnTile]);

  // Touch Swipe Gesture Handlers
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e) => {
    if (e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;

    const threshold = 40; // minimum 40px swipe distance
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) move('RIGHT');
        else move('LEFT');
      }
    } else {
      if (Math.abs(deltaY) > threshold) {
        if (deltaY > 0) move('DOWN');
        else move('UP');
      }
    }
  };

  // Keyboard events listener
  const handleKeyDown = useCallback((e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault(); // prevent scroll
      if (e.key === 'ArrowUp') move('UP');
      if (e.key === 'ArrowDown') move('DOWN');
      if (e.key === 'ArrowLeft') move('LEFT');
      if (e.key === 'ArrowRight') move('RIGHT');
    }
  }, [move]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto space-y-4 select-none relative font-display">
      {/* Game Header: score details */}
      <div className="w-full flex justify-between items-center liquid-glass px-4 py-2.5 rounded-2xl border-none">
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Điểm số</span>
          <span className="text-xl font-black text-primary">{score}</span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
            <Trophy size={10} className="text-yellow-400" /> Kỷ lục của bạn
          </span>
          <span className="text-sm font-bold text-yellow-400">{highScore}</span>
        </div>
      </div>

      {/* 4x4 Grid Board */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full aspect-square bg-[#1a141b]/90 border border-white/10 rounded-3xl p-3 grid grid-cols-4 grid-rows-4 gap-3 touch-action-none select-none relative overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        {grid.map((row, rIdx) =>
          row.map((cell, cIdx) => {
            const tileStyle = TILE_LABELS[cell];

            return (
              <div
                key={`${rIdx}-${cIdx}`}
                className={cn(
                  "rounded-2xl flex flex-col items-center justify-center p-1.5 transition-all duration-200 text-center font-display select-none relative shadow-inner overflow-hidden",
                  tileStyle?.glow && "animate-glow-pulse"
                )}
                style={{
                  background: tileStyle ? tileStyle.bg : 'rgba(255, 255, 255, 0.03)',
                  border: tileStyle ? 'none' : '1px solid rgba(255, 255, 255, 0.02)',
                }}
              >
                {cell > 0 && tileStyle ? (
                  <>
                    {/* Visual 3D inner glare */}
                    <div className="absolute inset-px rounded-xl bg-white/10 border-t border-l border-white/20 pointer-events-none" />
                    
                    {/* Icon/Emoji upper section */}
                    <span 
                      className="text-base sm:text-lg select-none"
                      style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))' }}
                    >
                      {tileStyle.text.split(' ')[0]}
                    </span>
                    {/* Caption label text */}
                    <span
                      className="text-[9px] font-bold mt-1 select-none tracking-tight leading-none"
                      style={{ color: tileStyle.textCol, textShadow: '0 1px 1px rgba(255,255,255,0.4)' }}
                    >
                      {tileStyle.text.split(' ').slice(1).join(' ')}
                    </span>
                  </>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="w-full text-center">
        <p className="text-[10px] text-muted-foreground font-semibold">
          💡 **Hướng dẫn**: Vuốt màn hình hoặc dùng phím mũi tên để gộp ô tình yêu.
        </p>
      </div>

      {/* Victory Overlay */}
      {victory && !keepPlaying && (
        <div className="absolute inset-0 bg-[#181116]/80 backdrop-blur-md rounded-3xl z-[1000] flex flex-col items-center justify-center p-6 space-y-4 border border-white/10 animate-fade-in">
          <span className="text-4xl">❤️</span>
          <h2 className="text-xl font-bold text-glow text-pink-400">Trọn Đời Bên Nhau! 👰💍</h2>
          <p className="text-xs text-muted-foreground text-center max-w-[220px] font-body leading-relaxed">
            Hai bạn đã hoàn thành mảnh ghép 2048 để đồng hành cùng nhau trọn đời!
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setKeepPlaying(true)}
              className="px-4 py-2 rounded-xl bg-white/10 text-foreground border border-white/10 text-xs font-bold hover:bg-white/20 transition active:scale-95 cursor-pointer"
            >
              Chơi tiếp
            </button>
            <button
              onClick={startNewGame}
              className="px-4 py-2 rounded-xl gradient-primary text-white text-xs font-bold shadow hover:opacity-90 transition active:scale-95 cursor-pointer"
            >
              Chơi lại
            </button>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="absolute inset-0 bg-[#181116]/80 backdrop-blur-md rounded-3xl z-[1000] flex flex-col items-center justify-center p-6 space-y-4 border border-white/10 animate-fade-in">
          <AlertCircle size={44} className="text-red-500 animate-bounce" />
          <h2 className="text-xl font-bold text-glow">Hết nước đi rồi! 🥺</h2>
          <div className="text-center font-body space-y-1">
            <p className="text-xs text-muted-foreground">Điểm số đạt được:</p>
            <p className="text-2xl font-black text-primary">{score}đ</p>
            {score >= highScore && score > 0 && (
              <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mt-1">🎉 Kỷ lục mới của riêng bạn!</p>
            )}
          </div>
          <button
            onClick={startNewGame}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl gradient-primary text-white text-xs font-bold shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            <RefreshCw size={12} /> Chơi lại
          </button>
        </div>
      )}
    </div>
  );
}
