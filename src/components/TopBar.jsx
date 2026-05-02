import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';

export default function TopBar() {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {/* Nút chuyển đổi Dark mode / Light mode */}
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
    </div>
  );
}