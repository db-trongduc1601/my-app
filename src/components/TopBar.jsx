import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Moon, Sun, LogOut, LogIn } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function TopBar() {
  const { theme, toggle } = useTheme();
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin();
  };

  return (
    <div className="flex items-center gap-2">
      {/* Dark mode toggle */}
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary hover:bg-muted transition-colors"
        title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
      >
        {theme === 'dark'
          ? <Sun size={15} className="text-yellow-400" />
          : <Moon size={15} className="text-muted-foreground" />
        }
      </button>

      {user === undefined ? null : user ? (
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-muted text-muted-foreground transition-colors font-medium"
        >
          <LogOut size={13} />
          Đăng xuất
        </button>
      ) : (
        <button
          onClick={handleLogin}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full gradient-primary text-white font-medium shadow-sm"
        >
          <LogIn size={13} />
          Đăng nhập
        </button>
      )}
    </div>
  );
}