import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalChat from '@/components/GlobalChat';
import FriendsSidebar from '@/components/friends/FriendsSidebar';
import ProfileEditorModal from '@/components/profile/ProfileEditorModal';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useToast } from "@/components/ui/use-toast";
import { toast as sonnerToast } from 'sonner';
import { registerFCMToken } from "@/hooks/useNotifications";
import { useAuth } from '@/lib/AuthContext';



export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { toast } = useToast();
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const { totalUnreadCount, globalUnreadCount } = useAuth();
  const [globalInvite, setGlobalInvite] = useState(null);
  const [caroInvite, setCaroInvite] = useState(null);
  
  // Lắng nghe thay đổi User Auth (Kể cả khi F5) và lưu local state
  const [localUser, setLocalUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setLocalUser(user);
    });
    return () => unsub();
  }, []);

  // Global Listener for Listening Session Invite
  useEffect(() => {
    if (!localUser || !localUser.email) return;

    const myEmailLower = localUser.email.toLowerCase();

    const q = query(
      collection(db, 'listening_sessions'),
      where('participants', 'array-contains', myEmailLower)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let activeInvite = null;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const hostEmailLower = data.host_email?.toLowerCase();
        
        if (data.status === 'inviting' && hostEmailLower !== myEmailLower) {
          activeInvite = { id: doc.id, ...data };
        }
      });
      setGlobalInvite(activeInvite);
    }, (error) => {
      console.error("Firestore global invite listener error:", error);
    });

    return () => unsubscribe();
  }, [localUser]);


  // Global Listener for Caro Invite — queries any per-pair doc where we are the receiver
  useEffect(() => {
    if (!localUser || !localUser.email) return;

    const myEmailLower = localUser.email.toLowerCase();

    const q = query(
      collection(db, 'caro_games'),
      where('receiver_email', '==', myEmailLower),
      where('status', '==', 'inviting')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let invite = null;
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.host_email !== myEmailLower) {
          invite = { id: docSnap.id, ...data };
        }
      });
      setCaroInvite(invite);
    }, (error) => {
      console.error('Firestore caro global invite error:', error);
    });

    return () => unsubscribe();
  }, [localUser]);


  useEffect(() => {
    // Chỉ hiển thị nếu trình duyệt hỗ trợ Notification và quyền hiện tại là default
    if ('Notification' in window && Notification.permission === 'default') {
      setShowNotificationPrompt(true);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowNotificationPrompt(false);
        toast({
          title: "Đã bật thông báo!",
          description: "Bạn sẽ nhận được thông báo đẩy thời gian thực từ bạn bè.",
        });
        
        // Đăng ký thiết bị nhận thông báo đẩy FCM ngay lập tức
        registerFCMToken(auth.currentUser, true);
        
        // Gửi thử một thông báo test để xác nhận hoạt động
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('', {
            body: 'Thông báo đẩy đã được kích hoạt thành công!',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [100, 50, 100],
          });
        } else {
          new Notification('', {
            body: 'Thông báo đẩy đã được kích hoạt thành công!',
            icon: '/icon-192.png',
          });
        }
      } else {
        setShowNotificationPrompt(false);
        toast({
          variant: "destructive",
          title: "Chưa bật được thông báo",
          description: "Hãy mở cài đặt điện thoại và bật quyền thông báo cho ứng dụng nhé!",
        });
      }
    } catch (error) {
      console.error("Lỗi yêu cầu quyền thông báo:", error);
    }
  };

  const overlayActive = chatOpen || friendsOpen || profileOpen;

  return (
    <div className={cn(
      "h-[100dvh] bg-background flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
      overlayActive && "overlay-open"
    )}>
      {/* Background blobs */}
      <div className="mesh-bg">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />
        <div className="mesh-blob mesh-blob-4" />
      </div>

      {/* Top bar */}
      <div className="relative z-20 mx-4 mt-3 mb-1">
        <div className="liquid-glass-heavy rim-light rounded-full px-3 py-1.5 flex items-center gap-2">
          {/* Friends icon - top left */}
          <button
            onClick={() => setFriendsOpen(true)}
            className="relative w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
            title="Bạn bè"
          >
            <Users size={14} className="text-muted-foreground" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
              </span>
            )}
          </button>

          {/* Global Chat icon - next to friends */}
          <button
            onClick={() => setChatOpen(true)}
            className="relative w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
            title="Chat chung"
          >
            <MessageCircle size={14} className="text-muted-foreground" />
            {globalUnreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {globalUnreadCount > 9 ? '9+' : globalUnreadCount}
              </span>
            )}
          </button>

          {/* spacer */}
          <div className="flex-1" />

          {/* --- KHU VỰC AVATAR & ĐĂNG XUẤT MỚI --- */}
          <button 
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-1.5 hover:bg-white/10 rounded-full pr-2 transition-colors"
          >
            <img 
              src={localUser?.photoURL || "https://via.placeholder.com/40"} 
              alt="Avatar" 
              className="w-6 h-6 rounded-full ring-2 ring-white/30 object-cover"
            />
            <span className="font-medium text-foreground text-xs">
              {localUser?.displayName?.split(' ')[0] || "Bạn yêu"}
            </span>
          </button>
          
          <button 
            onClick={() => signOut(auth)}
            className="ml-1 px-2 py-0.5 liquid-glass-sm text-destructive text-[10px] font-semibold hover:liquid-glow transition-all"
          >
            Thoát
          </button>

          {/* Giữ lại TopBar vì có thể nó đang chứa icon Mặt trăng (Dark mode) */}
          <TopBar />
        </div>
      </div>

      {/* Notification Prompt Banner */}
      {showNotificationPrompt && (
        <div className="mx-4 mt-2 mb-1 relative z-20">
          <div className="liquid-glass border border-pink-300/40 dark:border-pink-500/20 bg-pink-400/10 dark:bg-pink-950/20 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center animate-bounce">
                <span className="text-lg">🔔</span>
              </div>
              <div className="text-left">
                <h4 className="font-bold text-xs text-foreground">Bật thông báo ứng dụng</h4>
                <p className="text-[10px] text-muted-foreground leading-tight">Nhận tin nhắn & ảnh Locket tức thì</p>
              </div>
            </div>
            <button
              onClick={requestNotificationPermission}
              className="px-3.5 py-1.5 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-full text-[11px] font-semibold shadow-sm transition-all active:scale-95 duration-200"
            >
              Bật ngay
            </button>
          </div>
        </div>
      )}

      {/* Page content — will-change promotes this to its own GPU layer,
          keeping scroll independent from the fixed tabbar's backdrop-filter */}
      <main className="flex-1 overflow-y-auto pb-28 relative z-10 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch', willChange: 'transform' }}>
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* iOS-26 Liquid Glass Bottom Navigation */}
      <BottomNav />

      {/* Global Listen Together Invite Card (Floating) */}
      <AnimatePresence>
        {globalInvite && location.pathname !== '/' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-4 right-4 z-[9999] mx-auto max-w-sm"
          >
            <div className="liquid-glass border-primary/40 p-4 rounded-3xl shadow-2xl flex flex-col gap-3 bg-[#181116]/85 backdrop-blur-xl text-white rim-light">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 animate-pulse text-lg">
                  🎧
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    Lời mời nghe chung <span className="text-xs">🎧</span>
                  </p>
                  <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                    <span className="font-bold text-foreground">{globalInvite.host_name}</span> muốn rủ bạn cùng nghe bài <span className="text-primary font-medium">{globalInvite.track?.ten_bai}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'listening_sessions', globalInvite.id), {
                        status: 'active',
                        updated_at: new Date()
                      });
                      setGlobalInvite(null);
                      navigate('/', { state: { openEntertainment: true, entertainmentTab: 'music' } });
                    } catch(e) {}
                  }}
                  className="flex-1 py-2.5 rounded-2xl text-white font-bold text-sm gradient-primary shadow-lg hover:opacity-90 active:scale-95 transition-all text-center"
                >
                  Tham gia ngay
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'listening_sessions', globalInvite.id), {
                        status: 'declined',
                        updated_at: new Date()
                      });
                      setGlobalInvite(null);
                    } catch(e) {}
                  }}
                  className="flex-1 py-2.5 rounded-2xl text-muted-foreground hover:bg-white/10 text-sm font-semibold bg-white/5 active:scale-95 transition-all text-center"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Caro Invite Card (Floating) */}
      <AnimatePresence>
        {caroInvite && location.pathname !== '/games' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-4 right-4 z-[9999] mx-auto max-w-sm"
          >
            <div className="liquid-glass border-cyan-500/40 p-4 rounded-3xl shadow-2xl flex flex-col gap-3 bg-[#181116]/85 backdrop-blur-xl text-white rim-light">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 animate-pulse text-lg">
                  ❌
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    Lời mời đấu cờ XO <span className="text-xs">🎮</span>
                  </p>
                  <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                    <span className="font-bold text-foreground">{caroInvite.host_name}</span> muốn rủ bạn cùng đấu một ván cờ Caro 3x3!
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'caro_games', 'couple_caro'), {
                        status: 'playing',
                        updatedAt: new Date()
                      });
                      setCaroInvite(null);
                      navigate('/games');
                    } catch(e) {}
                  }}
                  className="flex-1 py-2.5 rounded-2xl text-white font-bold text-sm bg-cyan-500 shadow-lg hover:opacity-90 active:scale-95 transition-all text-center"
                >
                  Chiến luôn ⚔️
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'caro_games', 'couple_caro'), {
                        status: 'declined',
                        updatedAt: new Date()
                      });
                      setCaroInvite(null);
                    } catch(e) {}
                  }}
                  className="flex-1 py-2.5 rounded-2xl text-muted-foreground hover:bg-white/10 text-sm font-semibold bg-white/5 active:scale-95 transition-all text-center"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Chat */}
      <AnimatePresence>
        {chatOpen && (
          <GlobalChat
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            currentUser={localUser} 
          />
        )}
      </AnimatePresence>

      {/* Friends Sidebar */}
      <AnimatePresence>
        {friendsOpen && (
          <FriendsSidebar
            open={friendsOpen}
            onClose={() => setFriendsOpen(false)}
            currentUser={localUser}
          />
        )}
      </AnimatePresence>

      {/* Profile Editor */}
      <AnimatePresence>
        {profileOpen && (
          <ProfileEditorModal
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            currentUser={localUser}
            onProfileUpdated={setLocalUser}
          />
        )}
      </AnimatePresence>
    </div>
  );
}