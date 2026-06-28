import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MessageCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import GlobalChat from '@/components/GlobalChat';
import FriendsSidebar from '@/components/friends/FriendsSidebar';
import ProfileEditorModal from '@/components/profile/ProfileEditorModal';
import { AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useToast } from "@/components/ui/use-toast";
import { registerFCMToken } from "@/hooks/useNotifications";
import { useAuth } from '@/lib/AuthContext';



export default function Layout() {
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { toast } = useToast();
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const { totalUnreadCount, globalUnreadCount } = useAuth();
  
  // Lắng nghe thay đổi User Auth (Kể cả khi F5) và lưu local state
  const [localUser, setLocalUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setLocalUser(user);
    });
    return () => unsub();
  }, []);

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
        <Outlet />
      </main>

      {/* iOS-26 Liquid Glass Bottom Navigation */}
      <BottomNav />

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