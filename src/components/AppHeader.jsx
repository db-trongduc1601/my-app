import { MessageCircle, Users } from 'lucide-react';
import TopBar from '@/components/TopBar';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

/**
 * The floating glass top bar: friends + global-chat buttons (with unread
 * badges), avatar/profile shortcut, logout, and the dark-mode TopBar.
 * The parent owns the sidebar/modal open state and passes openers.
 */
export default function AppHeader({
  user,
  totalUnreadCount,
  globalUnreadCount,
  onOpenFriends,
  onOpenChat,
  onOpenProfile,
}) {
  return (
    <div className="relative z-20 mx-4 mt-3 mb-1">
      <div className="liquid-glass-heavy rim-light rounded-full px-3 py-1.5 flex items-center gap-2">
        {/* Friends icon - top left */}
        <button
          onClick={onOpenFriends}
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
          onClick={onOpenChat}
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

        {/* Avatar + logout */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-1.5 hover:bg-white/10 rounded-full pr-2 transition-colors"
        >
          <img
            src={user?.photoURL || "https://via.placeholder.com/40"}
            alt="Avatar"
            className="w-6 h-6 rounded-full ring-2 ring-white/30 object-cover"
          />
          <span className="font-medium text-foreground text-xs">
            {user?.displayName?.split(' ')[0] || "Bạn yêu"}
          </span>
        </button>

        <button
          onClick={() => signOut(auth)}
          className="ml-1 px-2 py-0.5 liquid-glass-sm text-destructive text-[10px] font-semibold hover:liquid-glow transition-all"
        >
          Thoát
        </button>

        {/* Dark-mode toggle */}
        <TopBar />
      </div>
    </div>
  );
}
