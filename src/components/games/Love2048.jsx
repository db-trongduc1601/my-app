import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { db, auth } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { RefreshCw, Trophy, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

// Helper to get styled gradients & glows for number values dynamically
const getTileStyle = (val) => {
  if (val === 0) return { bg: 'rgba(255, 255, 255, 0.025)', textCol: 'transparent', fontSize: 'text-2xl' };
  
  // Style config based on value
  switch (val) {
    case 2:
      return { bg: 'linear-gradient(135deg, #fff0f6 0%, #ffdeeb 100%)', textCol: '#c2255c', fontSize: 'text-2xl sm:text-3xl' };
    case 4:
      return { bg: 'linear-gradient(135deg, #fff9db 0%, #ffe066 100%)', textCol: '#e67700', fontSize: 'text-2xl sm:text-3xl' };
    case 8:
      return { bg: 'linear-gradient(135deg, #fff4e6 0%, #ffd8a8 100%)', textCol: '#d9480f', fontSize: 'text-2xl sm:text-3xl' };
    case 16:
      return { bg: 'linear-gradient(135deg, #ffe3e3 0%, #ffc9c9 100%)', textCol: '#e03131', fontSize: 'text-2xl sm:text-3xl' };
    case 32:
      return { bg: 'linear-gradient(135deg, #f3f0ff 0%, #e5dbff 100%)', textCol: '#5f3dc4', fontSize: 'text-2xl sm:text-3xl' };
    case 64:
      return { bg: 'linear-gradient(135deg, #e3fafc 0%, #c5f6fa 100%)', textCol: '#0b7285', fontSize: 'text-2xl sm:text-3xl' };
    case 128:
      return { bg: 'linear-gradient(135deg, #fff0f6 0%, #faa2c1 100%)', textCol: '#a61e4d', fontSize: 'text-xl sm:text-2xl' };
    case 256:
      return { bg: 'linear-gradient(135deg, #fff9db 0%, #ffd43b 100%)', textCol: '#f08c00', fontSize: 'text-xl sm:text-2xl' };
    case 512:
      return { bg: 'linear-gradient(135deg, #e6fcf5 0%, #96f2d7 100%)', textCol: '#087f5b', fontSize: 'text-xl sm:text-2xl' };
    case 1024:
      return { bg: 'linear-gradient(135deg, #f3f0ff 0%, #b197fc 100%)', textCol: '#3b0066', fontSize: 'text-lg sm:text-xl', glow: true };
    case 2048:
      return { bg: 'linear-gradient(135deg, #ff8787 0%, #fa5252 100%)', textCol: '#ffffff', fontSize: 'text-lg sm:text-xl', glow: true };
    case 4096:
      return { bg: 'linear-gradient(135deg, #da77f2 0%, #be4bdb 100%)', textCol: '#ffffff', fontSize: 'text-lg sm:text-xl', glow: true };
    case 8192:
      return { bg: 'linear-gradient(135deg, #748ffc 0%, #4c6ef5 100%)', textCol: '#ffffff', fontSize: 'text-lg sm:text-xl', glow: true };
    default:
      // Beyond 8192: Obsidian neon pink gradient
      return { bg: 'linear-gradient(135deg, #25262b 0%, #e64980 100%)', textCol: '#ffffff', fontSize: 'text-base sm:text-lg', glow: true };
  }
};

export default function Love2048({ currentHighScores }) {
  const currentUser = auth.currentUser;
  const myEmailLower = currentUser?.email?.toLowerCase() || '';

  const [grid, setGrid] = useState(() => Array(4).fill(null).map(() => Array(4).fill(0)));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasBeatenHighScore, setHasBeatenHighScore] = useState(false);
  const [shakeScore, setShakeScore] = useState(false);

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
    setHasBeatenHighScore(false);
    setShakeScore(false);
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
    let nonZeros = row.filter(val => val !== 0);
    let newRow = [];
    let addedScore = 0;

    for (let i = 0; i < nonZeros.length; i++) {
      if (i < nonZeros.length - 1 && nonZeros[i] === nonZeros[i + 1]) {
        const mergedVal = nonZeros[i] * 2;
        newRow.push(mergedVal);
        addedScore += mergedVal;
        i++;
      } else {
        newRow.push(nonZeros[i]);
      }
    }

    while (newRow.length < 4) {
      newRow.push(0);
    }

    return { newRow, addedScore };
  };

  const checkGameOverStatus = (currentGrid) => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentGrid[r][c] === 0) return false;
      }
    }
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        if (currentGrid[r][c] === currentGrid[r][c + 1]) return false;
      }
    }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentGrid[r][c] === currentGrid[r + 1][c]) return false;
      }
    }
    return true;
  };

  const move = useCallback((direction) => {
    if (gameOver) return;

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

      if (newScore > highScore) {
        setHighScore(newScore);
        const prevHigh = currentHighScores[myEmailLower] || 0;
        if (prevHigh > 0 && !hasBeatenHighScore) {
          setHasBeatenHighScore(true);
          setShakeScore(true);
          confetti({
            particleCount: 100,
            spread: 60,
            origin: { y: 0.6 }
          });
          setTimeout(() => setShakeScore(false), 700);
        }
      }

      // Check Game Over
      if (checkGameOverStatus(spawnedGrid)) {
        setGameOver(true);
        if (newScore > (currentHighScores[myEmailLower] || 0)) {
          updateHighScore(newScore);
        }
      }
    }
  }, [grid, score, gameOver, highScore, myEmailLower, currentHighScores, spawnTile]);

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
      e.preventDefault();
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
    <div className="flex flex-col items-center w-full max-w-sm mx-auto space-y-4 select-none relative font-display">
      {/* Game Header: score details */}
      <div className="w-full flex justify-between items-center liquid-glass px-4 py-2.5 rounded-2xl border-none shadow-md">
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Điểm số</span>
          <motion.span
            key={score}
            initial={{ scale: shakeScore ? 1.7 : 1.3, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className={cn(
              "text-xl font-black inline-block",
              shakeScore ? "text-yellow-300 text-glow" : "text-primary text-glow"
            )}
          >
            {score}
          </motion.span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
            <Trophy size={10} className="text-yellow-400" /> Kỷ lục
          </span>
          <motion.span
            key={highScore}
            initial={{ scale: 1.4, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="text-sm font-bold text-yellow-400 inline-block"
          >
            {highScore}
          </motion.span>
        </div>
      </div>

      {/* 4x4 Grid Board */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full aspect-square bg-[#1c1219]/95 border border-white/10 rounded-3xl p-3 grid grid-cols-4 grid-rows-4 gap-3 touch-action-none select-none relative overflow-hidden shadow-xl"
        style={{ touchAction: 'none' }}
      >
        {/* Subtle grid background lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.06),transparent_60%)] pointer-events-none" />

        {grid.map((row, rIdx) =>
          row.map((cell, cIdx) => {
            const tileStyle = getTileStyle(cell);

            return (
              <div
                key={`${rIdx}-${cIdx}`}
                className={cn(
                  "rounded-2xl flex items-center justify-center p-1 transition-all duration-200 text-center font-display font-black select-none relative overflow-hidden",
                  tileStyle.glow && "animate-glow-pulse shadow-lg"
                )}
                style={{
                  background: tileStyle.bg,
                  border: cell > 0 ? 'none' : '1px solid rgba(255, 255, 255, 0.015)',
                  boxShadow: tileStyle.glow ? `0 0 12px ${tileStyle.textCol}55` : 'none'
                }}
              >
                {cell > 0 ? (
                  <>
                    <div className="absolute inset-px rounded-xl bg-white/15 border-t border-l border-white/20 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                    <span
                      className={cn("select-none drop-shadow-md tracking-tight", tileStyle.fontSize)}
                      style={{ color: tileStyle.textCol }}
                    >
                      {cell}
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
          💡 **Hướng dẫn**: Vuốt màn hình hoặc dùng phím mũi tên để gộp các ô số giống nhau. Điểm số tăng vô hạn!
        </p>
      </div>

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="absolute inset-0 bg-[#181116]/80 backdrop-blur-md rounded-3xl z-[1000] flex flex-col items-center justify-center p-6 space-y-4 border border-white/10 animate-fade-in font-display">
          <AlertCircle size={44} className="text-red-500 animate-bounce" />
          <h2 className="text-xl font-bold text-glow">Hết nước đi rồi! 🥺</h2>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="text-center font-body space-y-1"
          >
            <p className="text-xs text-muted-foreground">Điểm số đạt được:</p>
            <p className="text-2xl font-black text-primary text-glow">{score}đ</p>
            {score >= highScore && score > 0 && (
              <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mt-1">🎉 Kỷ lục mới!</p>
            )}
          </motion.div>
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
