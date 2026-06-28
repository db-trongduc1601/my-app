import React from 'react';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const Login = () => {
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      alert("Oops! Có lỗi xảy ra khi đăng nhập. Thử lại nhé!");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 relative overflow-hidden">
      {/* Animated mesh background */}
      <div className="mesh-bg">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />
        <div className="mesh-blob mesh-blob-4" />
      </div>

      {/* Floating particles */}
      {['💕', '✨', '🌸', '💖', '🦋', '💫'].map((emoji, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${15 + i * 14}%`,
            animationDuration: `${6 + i * 2}s`,
            animationDelay: `${i * 1.2}s`,
            fontSize: `${0.8 + (i % 3) * 0.4}rem`
          }}
        >
          {emoji}
        </span>
      ))}

      {/* Login card */}
      <div className="liquid-glass rim-light p-8 text-center max-w-sm w-full relative z-10 animate-shimmer">
        <h1 className="font-display text-3xl font-bold text-primary text-glow mb-2">Chào mừng trở lại 💕</h1>
        <p className="text-muted-foreground mb-8 text-sm">Không gian riêng của mình</p>
        
        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 liquid-glass-sm liquid-glass-interactive px-4 py-3 text-foreground font-medium"
        >
          <img 
            src="https://www.svgrepo.com/show/475656/google-color.svg" 
            alt="Google" 
            className="w-6 h-6" 
          />
          Đăng nhập với Google
        </button>
      </div>
    </div>
  );
};

export default Login;