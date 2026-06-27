import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { usePresenceHeartbeat } from '../hooks/usePresenceHeartbeat';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Kích hoạt heartbeat presence
  usePresenceHeartbeat(user);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // ========================================================
        // 🔒 DANH SÁCH EMAIL ĐƯỢC PHÉP TRUY CẬP 
        // Hãy điền email Gmail của bạn và người yêu vào mảng dưới đây.
        // Ví dụ: const EMAIL_WHITELIST = ["duc.love.quynh@gmail.com", "quynh.love.duc@gmail.com"];
        // ========================================================
        const EMAIL_WHITELIST = [
          // "email_cua_duc@gmail.com",
          // "email_cua_quynh@gmail.com"
        ];

        // Nếu mảng whitelist có chứa email và email người dùng đăng nhập không nằm trong mảng
        if (EMAIL_WHITELIST.length > 0 && !EMAIL_WHITELIST.includes(currentUser.email)) {
          setAuthError({
            type: 'user_not_registered',
            message: 'Email này không có quyền truy cập vào không gian riêng của Đức & Quỳnh!'
          });
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
          setAuthChecked(true);
          await signOut(auth);
          return;
        }
      }

      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }, (error) => {
      console.error("Auth status change error:", error);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const navigateToLogin = () => {
    // Rely on App.jsx redirecting when user is null
  };

  const checkUserAuth = async () => {
    // Firebase handles this automatically
  };

  const checkAppState = async () => {
    // Stub
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
