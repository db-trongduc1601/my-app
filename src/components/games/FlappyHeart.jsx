import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { db, auth } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { RefreshCw, Trophy, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

export default function FlappyHeart({ currentHighScores }) {
  const currentUser = auth.currentUser;
  const myEmailLower = currentUser?.email?.toLowerCase() || '';

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [shakeScore, setShakeScore] = useState(false);

  const hasBeatenHighScoreRef = useRef(false);

  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);

  // Load high score
  useEffect(() => {
    if (currentHighScores && myEmailLower) {
      setHighScore(currentHighScores[myEmailLower] || 0);
    }
  }, [currentHighScores, myEmailLower]);

  // Sync highscore
  const updateHighScore = async (newScore) => {
    if (!myEmailLower) return;
    try {
      const newScores = { ...currentHighScores, [myEmailLower]: newScore };
      await setDoc(doc(db, 'game_high_scores', 'flappy_heart'), {
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

  // Canvas drawing & physics game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set dimensions
    canvas.width = 320;
    canvas.height = 420;

    // Eased physics game variables for relaxing casual gaming!
    let heart = {
      x: 60,
      y: 200,
      radius: 12,
      velocity: 0,
      gravity: 0.18, // Eased (was 0.35)
      jumpForce: -3.8 // Eased (was -5.5)
    };

    let pipes = [];
    let pipeWidth = 48;
    let pipeGap = 130; // Eased (was 100)
    let pipeSpeed = 1.25; // Eased (was 2.0)
    let frameCount = 0;
    let currentScore = 0;
    let active = isPlaying && !gameOver;

    const spawnPipe = () => {
      const minHeight = 40;
      const maxHeight = canvas.height - pipeGap - minHeight;
      const topHeight = Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;
      pipes.push({
        x: canvas.width,
        topHeight,
        bottomHeight: canvas.height - pipeGap - topHeight,
        passed: false
      });
    };

    const jump = () => {
      if (gameOver) return;
      if (!isPlaying) {
        setIsPlaying(true);
        active = true;
      }
      heart.velocity = heart.jumpForce;
    };

    const handleCanvasClick = (e) => {
      e.preventDefault();
      jump();
    };

    canvas.addEventListener('mousedown', handleCanvasClick);
    canvas.addEventListener('touchstart', handleCanvasClick, { passive: false });

    if (isPlaying && !gameOver) {
      spawnPipe();
    }

    const gameLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, '#2d1822');
      skyGrad.addColorStop(1, '#130a0f');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(244, 114, 182, 0.05)';
      ctx.beginPath();
      ctx.arc(100, 120, 80, 0, Math.PI * 2);
      ctx.arc(220, 300, 60, 0, Math.PI * 2);
      ctx.fill();

      if (isPlaying && !gameOver) {
        // 2. Physics logic
        heart.velocity += heart.gravity;
        heart.y += heart.velocity;

        if (heart.y + heart.radius > canvas.height) {
          triggerGameOver();
        }
        if (heart.y - heart.radius < 0) {
          heart.y = heart.radius;
          heart.velocity = 0;
        }

        // 3. Spawning obstacles (Eased frequency to 150 frames)
        frameCount++;
        if (frameCount % 150 === 0) {
          spawnPipe();
        }

        // 4. Update and Draw Pipes
        for (let i = pipes.length - 1; i >= 0; i--) {
          const pipe = pipes[i];
          pipe.x -= pipeSpeed;

          // Draw Top Pipe
          const topGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeWidth, 0);
          topGrad.addColorStop(0, 'rgba(236, 72, 153, 0.15)');
          topGrad.addColorStop(0.5, 'rgba(236, 72, 153, 0.45)');
          topGrad.addColorStop(1, 'rgba(236, 72, 153, 0.15)');
          ctx.fillStyle = topGrad;
          ctx.strokeStyle = 'rgba(236, 72, 153, 0.6)';
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.roundRect(pipe.x, 0, pipeWidth, pipe.topHeight, [0, 0, 10, 10]);
          ctx.fill();
          ctx.stroke();

          // Draw Bottom Pipe
          const botGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeWidth, 0);
          botGrad.addColorStop(0, 'rgba(236, 72, 153, 0.15)');
          botGrad.addColorStop(0.5, 'rgba(236, 72, 153, 0.45)');
          botGrad.addColorStop(1, 'rgba(236, 72, 153, 0.15)');
          ctx.fillStyle = botGrad;

          ctx.beginPath();
          ctx.roundRect(pipe.x, canvas.height - pipe.bottomHeight, pipeWidth, pipe.bottomHeight, [10, 10, 0, 0]);
          ctx.fill();
          ctx.stroke();

          if (!pipe.passed && pipe.x + pipeWidth < heart.x) {
            pipe.passed = true;
            currentScore++;
            setScore(currentScore);

            const prevHigh = currentHighScores?.[myEmailLower] || 0;
            if (currentScore > prevHigh) {
              setHighScore(currentScore);
              if (prevHigh > 0 && !hasBeatenHighScoreRef.current) {
                hasBeatenHighScoreRef.current = true;
                setShakeScore(true);
                confetti({
                  particleCount: 100,
                  spread: 60,
                  origin: { y: 0.6 }
                });
                setTimeout(() => setShakeScore(false), 200);
              }
            }
          }

          if (
            heart.x + heart.radius > pipe.x &&
            heart.x - heart.radius < pipe.x + pipeWidth
          ) {
            if (
              heart.y - heart.radius < pipe.topHeight ||
              heart.y + heart.radius > canvas.height - pipe.bottomHeight
            ) {
              triggerGameOver();
            }
          }

          if (pipe.x + pipeWidth < 0) {
            pipes.splice(i, 1);
          }
        }
      } else if (!isPlaying && !gameOver) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = 'bold 11px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CLICK / CHẠM VÀO ĐÂY ĐỂ BAY 🚀 (ĐÃ GIẢM KHÓ)', canvas.width / 2, canvas.height / 2 + 50);
      }

      // 5. Draw flying Heart
      ctx.save();
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.translate(heart.x, heart.y);
      let angle = Math.min(Math.max(heart.velocity * 0.07, -0.5), 0.5);
      ctx.rotate(angle);
      ctx.fillText('❤️', 0, 0);
      ctx.restore();

      if (active) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      }
    };

    const triggerGameOver = () => {
      active = false;
      setGameOver(true);
      if (currentScore > (currentHighScores[myEmailLower] || 0)) {
        updateHighScore(currentScore);
      }
    };

    gameLoop();

    return () => {
      canvas.removeEventListener('mousedown', handleCanvasClick);
      canvas.removeEventListener('touchstart', handleCanvasClick);
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [isPlaying, gameOver, currentHighScores, myEmailLower]);

  const handleRestart = () => {
    setScore(0);
    setGameOver(false);
    setIsPlaying(false);
    setShakeScore(false);
    hasBeatenHighScoreRef.current = false;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto space-y-4 select-none relative font-display text-foreground">
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

        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
            <Trophy size={10} className="text-yellow-400" /> Kỷ lục
          </span>
          <span className="text-sm font-bold text-yellow-400">{highScore}</span>
        </div>
      </div>

      {/* Canvas container */}
      <div className="relative w-full aspect-[320/420] max-w-[320px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#1c1219]">
        <canvas 
          ref={canvasRef} 
          className="block w-full h-full touch-action-none cursor-pointer"
          style={{ touchAction: 'none' }}
        />

        {/* Game Over Overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-[#181116]/80 backdrop-blur-md z-[1000] flex flex-col items-center justify-center p-6 space-y-4 border border-white/10 animate-fade-in">
            <AlertCircle size={44} className="text-red-500 animate-bounce" />
            <h2 className="text-xl font-bold text-glow">Toang Rồi! 🥺</h2>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="text-center font-body space-y-1"
            >
              <p className="text-xs text-muted-foreground">Điểm số đạt được:</p>
              <p className="text-2xl font-black text-primary text-glow">{score}đ</p>
              {score >= highScore && score > 0 && (
                <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mt-1">🎉 Kỷ lục mới của bạn!</p>
              )}
            </motion.div>
            <button
              onClick={handleRestart}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl gradient-primary text-white text-xs font-bold shadow-lg transition hover:scale-105 active:scale-95 cursor-pointer"
            >
              <RefreshCw size={12} /> Chơi lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
