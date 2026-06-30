import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../../firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { RefreshCw, Trophy, User, Zap, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export default function Caro({ currentHighScores }) {
  const currentUser = auth.currentUser;
  const myEmailLower = currentUser?.email?.toLowerCase() || '';
  
  // Players emails configuration
  const ducEmail = 'trongduc16012003@gmail.com';
  const quynhEmail = 'maianhquynh123@gmail.com';
  const partnerEmail = myEmailLower === ducEmail ? quynhEmail : ducEmail;

  // Game configuration states
  const [isPvP, setIsPvP] = useState(false); // false = AI, true = PvP
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true); // X goes first
  const [winner, setWinner] = useState(null); // null, 'X', 'O', 'Draw'
  const [pvpTurn, setPvpTurn] = useState(''); // email of next player in PvP
  const [pvpPlayerSymbol, setPvpPlayerSymbol] = useState(''); // 'X' or 'O' for current player in PvP

  // 1. AI Logic Helper: Minimax algorithm
  const checkWinner = (grid) => {
    for (const [a, b, c] of WINNING_COMBOS) {
      if (grid[a] && grid[a] === grid[b] && grid[a] === grid[c]) {
        return grid[a];
      }
    }
    if (grid.every(cell => cell !== null)) return 'Draw';
    return null;
  };

  const minimax = useCallback((grid, depth, isMaximizing, aiSymbol, playerSymbol) => {
    const scoreWinner = checkWinner(grid);
    if (scoreWinner === aiSymbol) return 10 - depth;
    if (scoreWinner === playerSymbol) return depth - 10;
    if (scoreWinner === 'Draw') return 0;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (grid[i] === null) {
          grid[i] = aiSymbol;
          const score = minimax(grid, depth + 1, false, aiSymbol, playerSymbol);
          grid[i] = null;
          bestScore = Math.max(bestScore, score);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (grid[i] === null) {
          grid[i] = playerSymbol;
          const score = minimax(grid, depth + 1, true, aiSymbol, playerSymbol);
          grid[i] = null;
          bestScore = Math.min(bestScore, score);
        }
      }
      return bestScore;
    }
  }, []);

  const getBestMove = useCallback((grid, aiSymbol, playerSymbol) => {
    let bestScore = -Infinity;
    let move = -1;
    for (let i = 0; i < 9; i++) {
      if (grid[i] === null) {
        grid[i] = aiSymbol;
        const score = minimax(grid, 0, false, aiSymbol, playerSymbol);
        grid[i] = null;
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  }, [minimax]);

  // PvP Real-time Firestore synchronization
  useEffect(() => {
    if (!isPvP) return;

    // Define symbols: X goes to Đức, O goes to Quỳnh
    const mySymbol = myEmailLower === ducEmail ? 'X' : 'O';
    setPvpPlayerSymbol(mySymbol);

    const unsub = onSnapshot(doc(db, 'caro_games', 'couple_caro'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBoard(data.board || Array(9).fill(null));
        setIsXNext(data.isXNext ?? true);
        setPvpTurn(data.turn || ducEmail);
        
        const gameWinner = checkWinner(data.board || Array(9).fill(null));
        setWinner(gameWinner);

        if (gameWinner && gameWinner !== 'Draw') {
          const winningEmail = gameWinner === 'X' ? ducEmail : quynhEmail;
          if (winningEmail === myEmailLower) {
            confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
          }
        }
      } else {
        // Init game doc
        resetPvPBoard();
      }
    });

    return () => unsub();
  }, [isPvP, myEmailLower]);

  // Handle AI turn triggers
  useEffect(() => {
    if (isPvP || winner) return;

    // AI is 'O' and Player is 'X'
    if (!isXNext) {
      const timer = setTimeout(() => {
        const aiMove = getBestMove(board, 'O', 'X');
        if (aiMove !== -1) {
          const nextBoard = [...board];
          nextBoard[aiMove] = 'O';
          setBoard(nextBoard);
          setIsXNext(true);
          const gameWinner = checkWinner(nextBoard);
          setWinner(gameWinner);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isXNext, board, isPvP, winner, getBestMove]);

  // Make move triggers
  const handleCellClick = async (index) => {
    if (board[index] || winner) return;

    if (isPvP) {
      if (pvpTurn !== myEmailLower) {
        toast.info("Chưa tới lượt của bạn đâu nhé! 🤫");
        return;
      }

      const nextBoard = [...board];
      nextBoard[index] = pvpPlayerSymbol;
      const nextIsXNext = !isXNext;
      const nextTurn = pvpPlayerSymbol === 'X' ? quynhEmail : ducEmail;

      try {
        await setDoc(doc(db, 'caro_games', 'couple_caro'), {
          board: nextBoard,
          isXNext: nextIsXNext,
          turn: nextTurn,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error(e);
        toast.error("Không thể đi quân cờ!");
      }
    } else {
      // AI Mode
      if (!isXNext) return; // Wait for AI
      const nextBoard = [...board];
      nextBoard[index] = 'X';
      setBoard(nextBoard);
      setIsXNext(false);
      const gameWinner = checkWinner(nextBoard);
      setWinner(gameWinner);
      if (gameWinner === 'X') {
        confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
      }
    }
  };

  const resetPvPBoard = async () => {
    try {
      await setDoc(doc(db, 'caro_games', 'couple_caro'), {
        board: Array(9).fill(null),
        isXNext: true,
        turn: ducEmail,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestart = () => {
    if (isPvP) {
      resetPvPBoard();
    } else {
      setBoard(Array(9).fill(null));
      setIsXNext(true);
      setWinner(null);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto space-y-4 select-none relative font-display text-foreground">
      {/* Game Mode Picker Tabs */}
      <div className="flex gap-2 w-full bg-white/5 border border-white/10 rounded-2xl p-1 shadow-inner">
        <button
          onClick={() => { setIsPvP(false); setBoard(Array(9).fill(null)); setIsXNext(true); setWinner(null); }}
          className={cn(
            "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all duration-200",
            !isPvP ? "gradient-primary text-white shadow" : "text-muted-foreground hover:text-foreground"
          )}
        >
          🤖 Đấu AI
        </button>
        <button
          onClick={() => { setIsPvP(true); setWinner(null); }}
          className={cn(
            "flex-1 py-1.5 rounded-xl text-xs font-bold transition-all duration-200",
            isPvP ? "bg-cyan-500 text-white shadow" : "text-muted-foreground hover:text-foreground"
          )}
        >
          👩‍❤️‍👨 Đấu Bạn Yêu
        </button>
      </div>

      {/* Game Turn / Status Header */}
      <div className="w-full flex justify-between items-center liquid-glass px-4 py-2.5 rounded-2xl border-none shadow-md">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">⚔️</span>
          <span className="text-xs font-bold text-muted-foreground">
            {isPvP 
              ? pvpTurn === myEmailLower 
                ? "Lượt của bạn! 🫵" 
                : "Đối phương đang nghĩ... 🤔"
              : isXNext 
                ? "Đến lượt bạn (X)" 
                : "AI đang đi cờ..."}
          </span>
        </div>

        {isPvP && (
          <span className="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">
            Biểu tượng: {pvpPlayerSymbol}
          </span>
        )}
      </div>

      {/* 3x3 Caro Board Grid */}
      <div className="w-full aspect-square bg-[#1c1219]/95 border border-white/10 rounded-3xl p-4 grid grid-cols-3 grid-rows-3 gap-3 touch-action-none shadow-xl relative overflow-hidden">
        {/* Neon decorative background lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.05),transparent_60%)] pointer-events-none" />

        {board.map((cell, idx) => (
          <button
            key={idx}
            onClick={() => handleCellClick(idx)}
            className="rounded-2xl relative transition-all duration-200 bg-white/5 border border-white/10 active:scale-95 flex items-center justify-center font-display font-black text-4xl overflow-hidden hover:bg-white/10"
            style={{ touchAction: 'none' }}
          >
            {cell && (
              <>
                <div className="absolute inset-px rounded-xl bg-white/10 border-t border-l border-white/20 pointer-events-none" />
                <span
                  className={cn(
                    "select-none drop-shadow-md animate-scale-up",
                    cell === 'X' ? "text-primary text-glow" : "text-cyan-400 text-glow-cyan"
                  )}
                >
                  {cell}
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* Reset button */}
      <button
        onClick={handleRestart}
        className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl liquid-glass border-none hover:liquid-glow hover:text-primary text-muted-foreground text-xs font-bold transition active:scale-95 cursor-pointer"
      >
        <RefreshCw size={12} /> Làm mới bàn cờ
      </button>

      {/* Winner / Draw Dialog Card overlay */}
      {winner && (
        <div className="absolute inset-0 bg-[#181116]/80 backdrop-blur-md rounded-3xl z-[1000] flex flex-col items-center justify-center p-6 space-y-4 border border-white/10 animate-fade-in font-display">
          <span className="text-4xl">🏆</span>
          <h2 className="text-xl font-bold text-glow">
            {winner === 'Draw' 
              ? "Kết quả: Hòa cờ! 🤝" 
              : isPvP 
                ? (winner === pvpPlayerSymbol ? "Bạn đã thắng bạn yêu! 🎉" : "Bạn yêu đã thắng bạn rồi! 🥺")
                : (winner === 'X' ? "Bạn đã chiến thắng AI! 🎉" : "AI đã chiến thắng bạn! 🤖")}
          </h2>
          <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl gradient-primary text-white text-xs font-bold shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            <RefreshCw size={12} /> Chơi lại
          </button>
        </div>
      )}
    </div>
  );
}
