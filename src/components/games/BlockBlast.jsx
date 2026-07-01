import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { db, auth } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { RefreshCw, Trophy, Zap, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

// Vibrant glass-brick gradients
const BLOCK_GRADIENTS = [
  'linear-gradient(135deg, #ff758f 0%, #ff7fa4 100%)', // Pink Glass
  'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)', // Cyan Glass
  'linear-gradient(135deg, #10b981 0%, #34d399 100%)', // Emerald Glass
  'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)', // Purple Glass
  'linear-gradient(135deg, #f97316 0%, #fb923c 100%)', // Orange Glass
  'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', // Blue Glass
  'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)'  // Rose Glass
];

const BLOCK_GLOWS = [
  'rgba(255, 117, 143, 0.4)',
  'rgba(6, 182, 212, 0.4)',
  'rgba(16, 189, 129, 0.4)',
  'rgba(168, 85, 247, 0.4)',
  'rgba(249, 115, 22, 0.4)',
  'rgba(59, 130, 246, 0.4)',
  'rgba(236, 72, 153, 0.4)'
];

const SHAPES = [
  { name: '1x1', coords: [[0, 0]] },
  { name: '1x2', coords: [[0, 0], [0, 1]] },
  { name: '2x1', coords: [[0, 0], [1, 0]] },
  { name: '1x3', coords: [[0, 0], [0, 1], [0, 2]] },
  { name: '3x1', coords: [[0, 0], [1, 0], [2, 0]] },
  { name: '1x4', coords: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { name: '4x1', coords: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: '2x2', coords: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { name: 'L3', coords: [[0, 0], [1, 0], [1, 1]] },
  { name: 'L4', coords: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { name: 'T4', coords: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  { name: 'Z4', coords: [[0, 0], [0, 1], [1, 1], [1, 2]] }
];

export default function BlockBlast({ currentHighScores }) {
  const currentUser = auth.currentUser;
  const myEmailLower = currentUser?.email?.toLowerCase() || '';
  
  // Game states
  const [board, setBoard] = useState(() => Array(8).fill(null).map(() => Array(8).fill(0)));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [upcomingBlocks, setUpcomingBlocks] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [hasBeatenHighScore, setHasBeatenHighScore] = useState(false);
  const [shakeScore, setShakeScore] = useState(false);

  // Drag states
  const [draggingIndex, setDraggingIndex] = useState(null); // index (0,1,2) of upcoming block
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // offset from touch point to top-left of block
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 }); // current screen position
  const [hoveredCell, setHoveredCell] = useState(null); // { row, col } top-left landing cell

  const boardRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const blockRefs = useRef([]);

  // Load high score
  useEffect(() => {
    if (currentHighScores && myEmailLower) {
      setHighScore(currentHighScores[myEmailLower] || 0);
    }
  }, [currentHighScores, myEmailLower]);

  // Start/Restart Game
  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = () => {
    setBoard(Array(8).fill(null).map(() => Array(8).fill(0)));
    setScore(0);
    setGameOver(false);
    setCombo(0);
    setHasBeatenHighScore(false);
    setShakeScore(false);
    setUpcomingBlocks(generateNewBlocks());
  };

  // Generate 3 random blocks
  const generateNewBlocks = () => {
    return Array(3).fill(null).map(() => {
      const shapeIndex = Math.floor(Math.random() * SHAPES.length);
      const shape = SHAPES[shapeIndex];
      const colorIndex = Math.floor(Math.random() * BLOCK_GRADIENTS.length);
      return { 
        ...shape, 
        gradient: BLOCK_GRADIENTS[colorIndex], 
        glow: BLOCK_GLOWS[colorIndex],
        id: Math.random() 
      };
    });
  };

  const canPlaceBlock = (boardState, blockCoords, startRow, startCol) => {
    for (const [rOffset, cOffset] of blockCoords) {
      const targetRow = startRow + rOffset;
      const targetCol = startCol + cOffset;
      if (targetRow < 0 || targetRow >= 8 || targetCol < 0 || targetCol >= 8) {
        return false;
      }
      if (boardState[targetRow][targetCol] !== 0) {
        return false;
      }
    }
    return true;
  };

  const hasAnyValidMove = (boardState, blockCoords) => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (canPlaceBlock(boardState, blockCoords, r, c)) {
          return true;
        }
      }
    }
    return false;
  };

  const checkGameOver = (currentBoard, currentBlocks) => {
    const activeBlocks = currentBlocks.filter(b => b !== null);
    if (activeBlocks.length === 0) return false;
    for (const block of activeBlocks) {
      if (hasAnyValidMove(currentBoard, block.coords)) {
        return false;
      }
    }
    return true;
  };

  const updateHighScore = async (newScore) => {
    if (!myEmailLower) return;
    try {
      const newScores = { ...currentHighScores, [myEmailLower]: newScore };
      await setDoc(doc(db, 'game_high_scores', 'block_blast'), {
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
      console.error("Failed to update high score:", e);
    }
  };

  const handleDragStart = (e, index) => {
    if (gameOver) return;
    const isTouch = e.type.startsWith('touch');
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    const block = upcomingBlocks[index];
    if (!block) return;

    // Calculate dimensions
    const cols = Math.max(...block.coords.map(c => c[1])) + 1;
    const rows = Math.max(...block.coords.map(c => c[0])) + 1;

    // Snapping logic: drag block is rendered with 30px cells
    const dragBlockWidth = cols * 30;
    const dragBlockHeight = rows * 30;

    // Offset the block slightly above the user's finger/mouse pointer to keep it visible!
    setDragOffset({
      x: dragBlockWidth / 2,
      y: dragBlockHeight + 35 // Offset 35px above touch point
    });
    setDragPosition({ x: clientX, y: clientY });
    setDraggingIndex(index);
    touchStartRef.current = { x: clientX, y: clientY };

    if (e.cancelable) e.preventDefault();
  };

  const handleDragMove = (e) => {
    if (draggingIndex === null) return;
    const isTouch = e.type.startsWith('touch');
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    setDragPosition({ x: clientX, y: clientY });

    const boardEl = boardRef.current;
    if (!boardEl) return;

    const boardRect = boardEl.getBoundingClientRect();
    const cellWidth = boardRect.width / 8;
    const cellHeight = boardRect.height / 8;

    const block = upcomingBlocks[draggingIndex];
    if (!block) return;

    const cols = Math.max(...block.coords.map(c => c[1])) + 1;
    const rows = Math.max(...block.coords.map(c => c[0])) + 1;
    const dragBlockWidth = cols * 30;
    const dragBlockHeight = rows * 30;

    const left = clientX - dragBlockWidth / 2;
    const top = clientY - dragBlockHeight - 35;

    // Find closest cell coordinate on the board
    const relativeX = left - boardRect.left;
    const relativeY = top - boardRect.top;

    const col = Math.round(relativeX / cellWidth);
    const row = Math.round(relativeY / cellHeight);

    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
      if (canPlaceBlock(board, block.coords, row, col)) {
        setHoveredCell({ row, col });
      } else {
        setHoveredCell(null);
      }
    } else {
      setHoveredCell(null);
    }
  };

  const handleDragEnd = () => {
    if (draggingIndex === null) return;

    const block = upcomingBlocks[draggingIndex];
    
    if (hoveredCell && block) {
      const { row, col } = hoveredCell;
      
      // Update Board
      const newBoard = board.map(r => [...r]);
      block.coords.forEach(([rOffset, cOffset]) => {
        newBoard[row + rOffset][col + cOffset] = block.gradient;
      });

      // Clear full rows & columns
      let rowsToClear = [];
      let colsToClear = [];

      for (let r = 0; r < 8; r++) {
        if (newBoard[r].every(cell => cell !== 0)) {
          rowsToClear.push(r);
        }
      }

      for (let c = 0; c < 8; c++) {
        let isColFull = true;
        for (let r = 0; r < 8; r++) {
          if (newBoard[r][c] === 0) {
            isColFull = false;
            break;
          }
        }
        if (isColFull) {
          colsToClear.push(c);
        }
      }

      // Perform clear
      let cellsCleared = 0;
      rowsToClear.forEach(r => {
        for (let c = 0; c < 8; c++) {
          if (newBoard[r][c] !== 0) {
            newBoard[r][c] = 0;
            cellsCleared++;
          }
        }
      });

      colsToClear.forEach(c => {
        for (let r = 0; r < 8; r++) {
          if (newBoard[r][c] !== 0) {
            newBoard[r][c] = 0;
            cellsCleared++;
          }
        }
      });

      // Calculate score
      const blockScore = block.coords.length;
      let clearScore = 0;
      let newCombo = combo;

      if (cellsCleared > 0) {
        newCombo++;
        clearScore = cellsCleared * 10 * newCombo;
        setCombo(newCombo);
        
        if (newCombo > 1) {
          toast.success(`💥 Combo x${newCombo}! +${clearScore}đ`);
        } else {
          toast.success(`💥 Clear! +${clearScore}đ`);
        }
      } else {
        setCombo(0);
      }

      const additionalScore = blockScore + clearScore;
      const newScore = score + additionalScore;
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
          setTimeout(() => setShakeScore(false), 200);
        }
      }

      // Update upcoming blocks
      const nextBlocks = [...upcomingBlocks];
      nextBlocks[draggingIndex] = null;

      const hasActive = nextBlocks.some(b => b !== null);
      let finalBlocks = nextBlocks;
      if (!hasActive) {
        finalBlocks = generateNewBlocks();
      }

      setBoard(newBoard);
      setUpcomingBlocks(finalBlocks);

      if (checkGameOver(newBoard, finalBlocks)) {
        setGameOver(true);
        if (newScore > (currentHighScores[myEmailLower] || 0)) {
          updateHighScore(newScore);
        }
      }
    }

    setDraggingIndex(null);
    setHoveredCell(null);
  };

  useEffect(() => {
    if (draggingIndex !== null) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [draggingIndex, hoveredCell]);

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto space-y-4 select-none relative font-display">
      {/* Game Header: score details */}
      <div className="w-full flex justify-between items-center liquid-glass px-4 py-2.5 rounded-2xl border-none shadow-md">
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Điểm số</span>
          <motion.span
            animate={shakeScore ? { x: [0, -4, 4, -4, 4, -2, 2, 0] } : {}}
            transition={{ duration: 0.2 }}
            className="text-xl font-black text-primary text-glow inline-block"
          >
            {score}
          </motion.span>
        </div>
        
        {combo > 0 && (
          <span className="text-[10px] bg-pink-500/20 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse flex items-center gap-1">
            <Zap size={8} /> Combo x{combo}
          </span>
        )}

        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
            <Trophy size={10} className="text-yellow-400" /> Kỷ lục
          </span>
          <span className="text-sm font-bold text-yellow-400">{highScore}</span>
        </div>
      </div>

      {/* 8x8 Grid Board */}
      <div 
        ref={boardRef}
        className="w-full aspect-square bg-[#1c1219]/95 border border-white/10 rounded-3xl p-3 grid grid-cols-8 grid-rows-8 gap-1.5 touch-action-none shadow-xl relative overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        {/* Subtle grid background lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(244,114,182,0.06),transparent_60%)] pointer-events-none" />

        {board.map((row, rIdx) => 
          row.map((cell, cIdx) => {
            let isHovered = false;
            if (hoveredCell && draggingIndex !== null) {
              const block = upcomingBlocks[draggingIndex];
              if (block) {
                isHovered = block.coords.some(
                  ([ro, co]) => hoveredCell.row + ro === rIdx && hoveredCell.col + co === cIdx
                );
              }
            }

            return (
              <div
                key={`${rIdx}-${cIdx}`}
                className="rounded-[6px] relative transition-colors duration-200 overflow-hidden"
                style={{
                  background: cell !== 0 
                    ? cell 
                    : isHovered 
                      ? upcomingBlocks[draggingIndex]?.glow
                      : 'rgba(255,255,255,0.02)',
                  border: isHovered 
                    ? `1.5px dashed ${upcomingBlocks[draggingIndex]?.color || '#ff758f'}` 
                    : '1px solid rgba(255,255,255,0.015)'
                }}
              >
                {cell !== 0 && (
                  <>
                    <div className="absolute inset-px rounded-[4px] bg-white/15 border-t border-l border-white/20 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Upcoming Blocks Panel (floating shelf) */}
      <div className="w-full grid grid-cols-3 gap-3 bg-white/5 border border-white/10 rounded-3xl p-3 shadow-inner">
        {upcomingBlocks.map((block, index) => {
          if (!block) return <div key={index} className="aspect-square bg-transparent" />;

          const rows = Math.max(...block.coords.map(c => c[0])) + 1;
          const cols = Math.max(...block.coords.map(c => c[1])) + 1;

          const activeClass = hasAnyValidMove(board, block.coords) ? "" : "opacity-20 pointer-events-none grayscale";

          return (
            <div
              key={block.id}
              ref={el => blockRefs.current[index] = el}
              onMouseDown={(e) => handleDragStart(e, index)}
              onTouchStart={(e) => handleDragStart(e, index)}
              className={cn(
                "aspect-square rounded-2xl flex items-center justify-center cursor-grab active:cursor-grabbing select-none relative touch-action-none bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-200 active:scale-95",
                activeClass,
                draggingIndex === index && "opacity-0"
              )}
              style={{ touchAction: 'none' }}
            >
              {/* Draw block preview matrix */}
              <div 
                className="grid gap-1"
                style={{
                  gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  width: `${cols * 15}px`,
                  height: `${rows * 15}px`
                }}
              >
                {Array(rows).fill(null).map((_, r) => 
                  Array(cols).fill(null).map((_, c) => {
                    const hasCell = block.coords.some(([ro, co]) => ro === r && co === c);
                    return (
                      <div
                        key={`${r}-${c}`}
                        className="rounded-[3px] relative overflow-hidden"
                        style={{
                          background: hasCell ? block.gradient : 'transparent',
                        }}
                      >
                        {hasCell && (
                          <div className="absolute inset-0 bg-white/15 border-t border-l border-white/20 pointer-events-none" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dragging Overlay */}
      {draggingIndex !== null && upcomingBlocks[draggingIndex] && (() => {
        const block = upcomingBlocks[draggingIndex];
        const rows = Math.max(...block.coords.map(c => c[0])) + 1;
        const cols = Math.max(...block.coords.map(c => c[1])) + 1;

        // Render cell with 30px
        return (
          <div
            className="fixed pointer-events-none z-[99999] will-change-transform"
            style={{
              left: `${dragPosition.x - dragOffset.x}px`,
              top: `${dragPosition.y - dragOffset.y}px`,
              width: `${cols * 30}px`,
              height: `${rows * 30}px`
            }}
          >
            <div 
              className="grid gap-1.5"
              style={{
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                width: '100%',
                height: '100%'
              }}
            >
              {Array(rows).fill(null).map((_, r) => 
                Array(cols).fill(null).map((_, c) => {
                  const hasCell = block.coords.some(([ro, co]) => ro === r && co === c);
                  return (
                    <div
                      key={`${r}-${c}`}
                      className="rounded-[6px] relative shadow-lg overflow-hidden"
                      style={{
                        background: hasCell ? block.gradient : 'transparent',
                        border: hasCell ? '1px solid rgba(255,255,255,0.2)' : 'none'
                      }}
                    >
                      {hasCell && (
                        <div className="absolute inset-0 bg-white/25 border-t border-l border-white/40 pointer-events-none" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* Game Over Dialog */}
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
