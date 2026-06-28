import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { usePresenceHeartbeat } from '../hooks/usePresenceHeartbeat';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Unread messages state
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [unreadCountBySender, setUnreadCountBySender] = useState({});
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);

  // Kích hoạt heartbeat presence
  usePresenceHeartbeat(user);

  useEffect(() => {
    let unreadUnsubscribe = null;

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
            message: 'Email này không có quyền truy cập!'
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

      // Bắt đầu lắng nghe tin nhắn chưa đọc
      if (unreadUnsubscribe) {
        unreadUnsubscribe();
      }
      if (currentUser && currentUser.email) {
        const myEmail = currentUser.email.toLowerCase();

        // 1. Private messages
        const qPrivate = query(
          collection(db, 'messages'),
          where('receiver_email', '==', myEmail),
          where('status', 'in', ['sent', 'delivered'])
        );

        // 2. Global messages
        const qGlobal = query(
          collection(db, 'messages'),
          where('receiver_email', '==', 'global'),
          where('status', 'in', ['sent', 'delivered'])
        );

        let privateUnread = 0;
        let globalUnread = 0;
        let privateBreakdown = {};

        const updateCounts = (pUnread, pBreakdown, gUnread) => {
          setTotalUnreadCount(pUnread + gUnread);
          setGlobalUnreadCount(gUnread);
          setUnreadCountBySender({
            ...pBreakdown,
            global: gUnread
          });
        };

        const unsubPrivate = onSnapshot(qPrivate, (snapshot) => {
          privateUnread = 0;
          privateBreakdown = {};
          snapshot.forEach(doc => {
            const sender = doc.data().sender_email?.toLowerCase();
            if (sender) {
              privateBreakdown[sender] = (privateBreakdown[sender] || 0) + 1;
              privateUnread++;
            }
          });
          updateCounts(privateUnread, privateBreakdown, globalUnread);
        }, (err) => {
          console.error("Lỗi lấy private unread messages:", err);
        });

        const unsubGlobal = onSnapshot(qGlobal, (snapshot) => {
          globalUnread = 0;
          snapshot.forEach(doc => {
            const sender = doc.data().sender_email?.toLowerCase();
            if (sender && sender !== myEmail) {
              globalUnread++;
            }
          });
          updateCounts(privateUnread, privateBreakdown, globalUnread);
        }, (err) => {
          console.error("Lỗi lấy global unread messages:", err);
        });

        unreadUnsubscribe = () => {
          unsubPrivate();
          unsubGlobal();
        };
      } else {
        setTotalUnreadCount(0);
        setGlobalUnreadCount(0);
        setUnreadCountBySender({});
      }

    }, (error) => {
      console.error("Auth status change error:", error);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => {
      unsubscribe();
      if (unreadUnsubscribe) unreadUnsubscribe();
    };
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
      checkAppState,
      totalUnreadCount,
      unreadCountBySender,
      globalUnreadCount
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
