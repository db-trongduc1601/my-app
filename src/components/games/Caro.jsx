import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../../firebase';
import {
  doc, onSnapshot, setDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { toast } from 'sonner';
import { RefreshCw, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useProfiles } from '../../hooks/useProfiles';
import { useFriends } from '../../hooks/useFriends';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fireWinConfetti() {
  const colors = ['#f43f8f', '#c084fc', '#facc15', '#22d3ee'];
  confetti({ particleCount: 120, spread: 70, origin: { y: 0.55 }, colors });
  setTimeout(() => {
    confetti({ particleCount: 60, spread: 100, origin: { y: 0.5 }, colors, scalar: 0.8 });
  }, 200);
}

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(grid) {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (grid[a] && grid[a] === grid[b] && grid[a] === grid[c]) return grid[a];
  }
  if (grid.every(cell => cell !== null)) return 'Draw';
  return null;
}

/**
 * Derives a deterministic per-pair Firestore document ID.
 * Both participants see the same ID regardless of who initiates.
 */
function pairDocId(emailA, emailB) {
  return [emailA, emailB].sort().join('__');
}

/**
 * Assigns symbols to two players deterministically by sorting their emails.
 * The alphabetically-first email always gets 'X'; the second gets 'O'.
 */
function symbolForEmail(myEmail, partnerEmail) {
  const sorted = [myEmail, partnerEmail].sort();
  return myEmail === sorted[0] ? 'X' : 'O';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Caro() {
  const currentUser = auth.currentUser;
  const myEmail = currentUser?.email?.toLowerCase() || '';

  // Accepted friends list (realtime, both directions)
  const { friendEmails: friends } = useFriends(); // list of emails
  const { profiles } = useProfiles();             // email → profile data

  // Selected PvP partner
  const [partnerEmail, setPartnerEmail] = useState('');

  // Game mode
  const [isPvP, setIsPvP] = useState(false);

  // Local (AI) game state
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState(null);

  // PvP synced state
  const [dbGame, setDbGame] = useState(null);
  const [pvpTurn, setPvpTurn] = useState('');
  const [pvpPlayerSymbol, setPvpPlayerSymbol] = useState('');


  const firedConfettiRef = React.useRef(false);

  // ── 1. Default the PvP partner to the first friend once the list loads ─────
  useEffect(() => {
    if (!partnerEmail && friends.length > 0) setPartnerEmail(friends[0]);
  }, [friends, partnerEmail]);

  // ── 2. Derive player symbols whenever partner changes ──────────────────────
  useEffect(() => {
    if (!myEmail || !partnerEmail) return;
    const mine = symbolForEmail(myEmail, partnerEmail);
    setPvpPlayerSymbol(mine);
  }, [myEmail, partnerEmail]);

  // ── 3. PvP real-time Firestore listener ────────────────────────────────────
  useEffect(() => {
    if (!isPvP || !myEmail || !partnerEmail) return;
    const docId = pairDocId(myEmail, partnerEmail);

    const unsub = onSnapshot(doc(db, 'caro_games', docId), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setDbGame(data);
        const b = data.board || Array(9).fill(null);
        setBoard(b);
        setIsXNext(data.isXNext ?? true);
        setPvpTurn(data.turn || '');

        const w = checkWinner(b);
        setWinner(w);
        if (w && w !== 'Draw') {
          const iWon = w === pvpPlayerSymbol;
          if (iWon && !firedConfettiRef.current) {
            firedConfettiRef.current = true;
            fireWinConfetti();
          }
        }
      } else {
        setDbGame(null);
      }
    });

    return () => unsub();
  }, [isPvP, myEmail, partnerEmail, pvpPlayerSymbol]);

  // ── 4. AI turn ─────────────────────────────────────────────────────────────
  const minimax = useCallback((grid, depth, isMax, aiSym, plSym) => {
    const w = checkWinner(grid);
    if (w === aiSym) return 10 - depth;
    if (w === plSym) return depth - 10;
    if (w === 'Draw') return 0;

    let best = isMax ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (grid[i] === null) {
        grid[i] = isMax ? aiSym : plSym;
        const score = minimax(grid, depth + 1, !isMax, aiSym, plSym);
        grid[i] = null;
        best = isMax ? Math.max(best, score) : Math.min(best, score);
      }
    }
    return best;
  }, []);

  const getBestMove = useCallback((grid, aiSym, plSym) => {
    let best = -Infinity, move = -1;
    for (let i = 0; i < 9; i++) {
      if (grid[i] === null) {
        grid[i] = aiSym;
        const score = minimax(grid, 0, false, aiSym, plSym);
        grid[i] = null;
        if (score > best) { best = score; move = i; }
      }
    }
    return move;
  }, [minimax]);

  useEffect(() => {
    if (isPvP || winner || isXNext) return;
    const t = setTimeout(() => {
      const aiMove = getBestMove([...board], 'O', 'X');
      if (aiMove !== -1) {
        const next = [...board];
        next[aiMove] = 'O';
        setBoard(next);
        setIsXNext(true);
        setWinner(checkWinner(next));
      }
    }, 500);
    return () => clearTimeout(t);
  }, [isXNext, board, isPvP, winner, getBestMove]);

  // ── 5. Invitation flow ─────────────────────────────────────────────────────
  const docId = myEmail && partnerEmail ? pairDocId(myEmail, partnerEmail) : null;

  const sendInvitation = async () => {
    if (!docId) return;
    const firstTurn = [myEmail, partnerEmail].sort()[0]; // X starts
    try {
      await setDoc(doc(db, 'caro_games', docId), {
        board: Array(9).fill(null),
        isXNext: true,
        turn: firstTurn,
        status: 'inviting',
        host_email: myEmail,
        host_name: currentUser.displayName?.split(' ')[0] || 'Bạn',
        receiver_email: partnerEmail,
        updatedAt: serverTimestamp(),
      });
      toast.success('Đã gửi lời mời đấu cờ Caro! ⚔️');
    } catch (e) {
      console.error(e);
      toast.error('Không thể gửi lời mời!');
    }
  };

  const acceptInvitation = async () => {
    if (!docId) return;
    try {
      await updateDoc(doc(db, 'caro_games', docId), {
        status: 'playing',
        updatedAt: serverTimestamp(),
      });
      toast.success('Trận đấu cờ Caro đã bắt đầu! ⚔️');
    } catch (e) { console.error(e); }
  };

  const declineInvitation = async () => {
    if (!docId) return;
    try {
      await updateDoc(doc(db, 'caro_games', docId), {
        status: 'declined',
        updatedAt: serverTimestamp(),
      });
      toast.info('Đã từ chối lời mời đấu cờ.');
    } catch (e) { console.error(e); }
  };

  const cancelInvitation = async () => {
    if (!docId) return;
    try {
      await updateDoc(doc(db, 'caro_games', docId), {
        status: 'ended',
        updatedAt: serverTimestamp(),
      });
      toast.info('Đã hủy lời mời.');
    } catch (e) { console.error(e); }
  };

  const resetPvPBoard = async () => {
    if (!docId) return;
    const firstTurn = [myEmail, partnerEmail].sort()[0];
    try {
      await updateDoc(doc(db, 'caro_games', docId), {
        board: Array(9).fill(null),
        isXNext: true,
        turn: firstTurn,
        updatedAt: serverTimestamp(),
      });
    } catch (e) { console.error(e); }
  };

  // ── 6. Cell click ──────────────────────────────────────────────────────────
  const handleCellClick = async (index) => {
    if (board[index] || winner) return;

    if (isPvP) {
      if (pvpTurn !== myEmail) {
        toast.info('Chưa tới lượt của bạn đâu nhé! 🤫');
        return;
      }
      const next = [...board];
      next[index] = pvpPlayerSymbol;
      const nextIsXNext = !isXNext;
      const nextTurn = pvpPlayerSymbol === 'X' ? partnerEmail : myEmail;
      // Actually: next turn = whichever player has the other symbol
      // (works generically because symbol assignment is deterministic)
      try {
        await updateDoc(doc(db, 'caro_games', docId), {
          board: next,
          isXNext: nextIsXNext,
          turn: nextTurn,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error(e);
        toast.error('Không thể đi quân cờ!');
      }
    } else {
      if (!isXNext) return;
      const next = [...board];
      next[index] = 'X';
      setBoard(next);
      setIsXNext(false);
      const w = checkWinner(next);
      setWinner(w);
      if (w === 'X') fireWinConfetti();
    }
  };

  const handleRestart = () => {
    firedConfettiRef.current = false;
    if (isPvP) { resetPvPBoard(); }
    else { setBoard(Array(9).fill(null)); setIsXNext(true); setWinner(null); }
  };

  const getName = (email) =>
    profiles[email]?.display_name?.split(' ')[0] || email?.split('@')[0] || 'Bạn';

  const switchToPvP = () => { setIsPvP(true); setWinner(null); };
  const switchToAI = () => { setIsPvP(false); setBoard(Array(9).fill(null)); setIsXNext(true); setWinner(null); };

  // ── Outcome for the current player: 'win' | 'lose' | 'draw' | null ─────────
  const outcome = !winner ? null
    : winner === 'Draw' ? 'draw'
    : (isPvP ? winner === pvpPlayerSymbol : winner === 'X') ? 'win'
    : 'lose';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto space-y-4 select-none relative font-display text-foreground">
      {/* Mode tabs */}
      <div className="flex gap-2 w-full bg-white/5 border border-white/10 rounded-2xl p-1 shadow-inner">
        <button
          onClick={switchToAI}
          className={cn(
            'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all duration-200',
            !isPvP ? 'gradient-primary text-white shadow' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          🤖 Đấu AI
        </button>
        <button
          onClick={switchToPvP}
          className={cn(
            'flex-1 py-1.5 rounded-xl text-xs font-bold transition-all duration-200',
            isPvP ? 'bg-cyan-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          👩‍❤️‍👨 Đấu Bạn Yêu
        </button>
      </div>

      {/* PvP invitation flow */}
      {isPvP && (!dbGame || dbGame.status !== 'playing') ? (
        <div className="w-full liquid-glass rounded-3xl p-6 text-center space-y-5 border-none shadow-xl mt-4">
          <div className="w-14 h-14 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto text-2xl animate-pulse">
            ⚔️
          </div>

          {/* Partner picker */}
          {friends.length > 0 && !dbGame && (
            <div className="space-y-1 text-left">
              <label className="text-[10px] text-muted-foreground uppercase font-bold">Chọn đối thủ:</label>
              <select
                value={partnerEmail}
                onChange={e => setPartnerEmail(e.target.value)}
                className="w-full bg-[#20151f] text-foreground text-xs rounded-xl border border-white/10 p-2 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {friends.map(email => (
                  <option key={email} value={email}>{getName(email)}</option>
                ))}
              </select>
            </div>
          )}

          {dbGame?.status === 'inviting' ? (
            dbGame.host_email === myEmail ? (
              <div className="space-y-4">
                <h3 className="font-bold text-sm">Đang chờ {getName(partnerEmail)} đồng ý... ⏳</h3>
                <p className="text-xs text-muted-foreground max-w-[220px] mx-auto leading-normal">
                  Thông báo mời đã được gửi đến màn hình của họ.
                </p>
                <button
                  onClick={cancelInvitation}
                  className="w-full py-2 rounded-2xl bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 text-xs font-bold transition active:scale-95"
                >
                  Hủy lời mời
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-bold text-sm">{getName(dbGame.host_email)} đang rủ bạn đấu cờ! ⚔️</h3>
                <div className="flex gap-2">
                  <button onClick={acceptInvitation} className="flex-1 py-2 rounded-2xl bg-cyan-500 text-white text-xs font-bold hover:bg-cyan-600 transition active:scale-95 shadow">
                    Đồng ý
                  </button>
                  <button onClick={declineInvitation} className="flex-1 py-2 rounded-2xl bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 text-xs font-semibold transition active:scale-95">
                    Bỏ qua
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-4">
              <h3 className="font-bold text-sm">Đấu cờ tay đôi trực tiếp 👩‍❤️‍👨</h3>
              <p className="text-xs text-muted-foreground max-w-[240px] mx-auto leading-normal">
                Bạn là <span className="font-bold text-primary">{pvpPlayerSymbol}</span>. Nhấn nút bên dưới để gửi lời mời.
              </p>
              {friends.length === 0 ? (
                <p className="text-xs text-muted-foreground">Hãy kết bạn trước để đấu PvP!</p>
              ) : (
                <button
                  onClick={sendInvitation}
                  className="w-full py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold transition active:scale-95 shadow-lg flex items-center justify-center gap-1.5"
                >
                  Gửi lời mời {getName(partnerEmail)} <ArrowRight size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Status bar */}
          <motion.div
            animate={outcome === 'lose' ? {
              x: [0, -4, 4, -4, 4, -2, 2, 0],
              opacity: 0.65
            } : {}}
            transition={{ duration: 0.25 }}
            className="w-full flex justify-between items-center liquid-glass px-4 py-2.5 rounded-2xl border-none shadow-md"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-lg">⚔️</span>
              <span className="text-xs font-bold text-muted-foreground">
                {isPvP
                  ? pvpTurn === myEmail
                    ? 'Lượt của bạn! 🫵'
                    : `${getName(partnerEmail)} đang nghĩ... 🤔`
                  : isXNext
                    ? 'Đến lượt bạn (X)'
                    : 'AI đang đi cờ...'}
              </span>
            </div>
            {isPvP && (
              <span className="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">
                Bạn: {pvpPlayerSymbol}
              </span>
            )}
          </motion.div>

          {/* Board */}
          <div className="w-full aspect-square bg-[#1c1219]/95 border border-white/10 rounded-3xl p-4 grid grid-cols-3 grid-rows-3 gap-3 touch-action-none shadow-xl relative overflow-hidden">
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
                    <motion.span
                      animate={winner && winner !== 'Draw' && cell !== winner ? {
                        scale: 0.75,
                        opacity: 0.3
                      } : {}}
                      className={cn('select-none drop-shadow-md', cell === 'X' ? 'text-primary text-glow' : 'text-cyan-400')}
                    >
                      {cell}
                    </motion.span>
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Reset */}
          <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl liquid-glass border-none hover:liquid-glow hover:text-primary text-muted-foreground text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <RefreshCw size={12} /> Làm mới bàn cờ
          </button>

          {/* Winner overlay — distinct treatment for win / lose / draw */}
          {winner && (
            <div className={cn(
              "absolute inset-0 backdrop-blur-md rounded-3xl z-[1000] flex flex-col items-center justify-center p-6 space-y-4 border font-display",
              outcome === 'win' && "bg-[#181116]/75 border-yellow-400/30",
              outcome === 'lose' && "bg-[#181116]/85 border-white/5",
              outcome === 'draw' && "bg-[#181116]/80 border-white/10"
            )}>
              <motion.div
                initial={outcome === 'win'
                  ? { scale: 0.3, opacity: 0, rotate: -8 }
                  : outcome === 'lose'
                    ? { y: -10, opacity: 0 }
                    : { scale: 0.7, opacity: 0 }}
                animate={outcome === 'win'
                  ? { scale: [0.3, 1.15, 1], opacity: 1, rotate: 0 }
                  : outcome === 'lose'
                    ? { y: 0, opacity: 1 }
                    : { scale: 1, opacity: 1 }}
                transition={outcome === 'win'
                  ? { duration: 0.5, ease: "easeOut" }
                  : { duration: 0.35, ease: "easeOut" }}
                className="flex flex-col items-center space-y-4"
              >
                <motion.span
                  className="text-4xl"
                  animate={outcome === 'win' ? { y: [0, -6, 0] } : outcome === 'lose' ? { rotate: [-4, 4, -4, 0] } : {}}
                  transition={outcome === 'win' ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5 }}
                >
                  {outcome === 'win' ? '🏆' : outcome === 'lose' ? '💔' : '🤝'}
                </motion.span>
                <h2 className={cn(
                  "text-xl font-bold",
                  outcome === 'win' && "text-yellow-300 text-glow",
                  outcome === 'lose' && "text-muted-foreground",
                  outcome === 'draw' && "text-foreground"
                )}>
                  {winner === 'Draw'
                    ? 'Kết quả: Hòa cờ! 🤝'
                    : isPvP
                      ? winner === pvpPlayerSymbol ? 'Bạn đã thắng! 🎉' : `${getName(partnerEmail)} đã thắng! 🥺`
                      : winner === 'X' ? 'Bạn đã thắng AI! 🎉' : 'AI đã thắng bạn! 🤖'}
                </h2>
              </motion.div>
              <button
                onClick={handleRestart}
                className={cn(
                  "flex items-center gap-1.5 px-6 py-2.5 rounded-2xl text-white text-xs font-bold shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer",
                  outcome === 'win' ? "gradient-primary" : "bg-white/10 hover:bg-white/15"
                )}
              >
                <RefreshCw size={12} /> Chơi lại
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
