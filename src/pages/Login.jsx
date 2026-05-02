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
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FFF0F5] p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-sm w-full">
        <h1 className="text-3xl font-bold text-pink-500 mb-2">Đức & Quỳnh 💕</h1>
        <p className="text-gray-500 mb-8 text-sm">Không gian riêng của mình</p>
        
        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-700 hover:bg-gray-50 hover:border-pink-300 transition-all font-medium shadow-sm"
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