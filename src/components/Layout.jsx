import { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Home, Utensils, Heart, Star, Music, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import TopBar from '@/components/TopBar';
import GlobalChat from '@/components/GlobalChat';
import { AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const tabs = [
  { path: '/', icon: Home, label: 'Trang chủ' },
  { path: '/food', icon: Utensils, label: 'Ăn gì?' },
  { path: '/vault', icon: Heart, label: 'Đồ dùng' },
  { path: '/quests', icon: Star, label: 'Nhiệm vụ' },
  { path: '/entertainment', icon: Music, label: 'Giải trí' },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Đã xóa hàm useEffect gọi base44 cũ đi để tiệt nọc lỗi 404!

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      {/* Background blobs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-20 dark:opacity-10" style={{background: 'hsl(340,97%,64%)'}} />
        <div className="absolute top-1/3 -left-16 w-56 h-56 rounded-full opacity-10 dark:opacity-5" style={{background: 'hsl(20,80%,70%)'}} />
        <div className="absolute bottom-20 right-0 w-40 h-40 rounded-full opacity-15 dark:opacity-5" style={{background: 'hsl(340,50%,80%)'}} />
      </div>

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 pt-3 pb-1">
        {/* Friends icon - top left */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary hover:bg-muted transition-colors"
          title="Bạn bè"
        >
          <MessageCircle size={15} className="text-muted-foreground" />
        </button>

        {/* --- KHU VỰC AVATAR & ĐĂNG XUẤT MỚI --- */}
        <div className="flex items-center gap-2 ml-auto mr-3 bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-pink-100">
          <img 
            src={auth.currentUser?.photoURL || "https://via.placeholder.com/40"} 
            alt="Avatar" 
            className="w-7 h-7 rounded-full border border-pink-300"
          />
          <span className="font-medium text-gray-700 text-sm">
            {auth.currentUser?.displayName?.split(' ')[0] || "Bạn yêu"}
          </span>
          <button 
            onClick={() => signOut(auth)}
            className="ml-1 px-2 py-0.5 bg-red-50 text-red-500 rounded-full text-xs font-semibold hover:bg-red-100 transition-colors"
          >
            Thoát
          </button>
        </div>

        {/* Giữ lại TopBar vì có thể nó đang chứa icon Mặt trăng (Dark mode) */}
        <TopBar />
      </div>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24 relative z-10">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
        <div className="mx-3 mb-4 glass-card rounded-2xl px-1 py-1.5">
          <div className="flex items-center justify-around">
            {tabs.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path || 
                (path !== '/' && location.pathname.startsWith(path));
              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200",
                    active
                      ? "bg-primary text-primary-foreground shadow-md scale-105"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Icon size={18} />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Global Chat */}
      <AnimatePresence>
        {sidebarOpen && (
          <GlobalChat
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            currentUser={auth.currentUser} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}