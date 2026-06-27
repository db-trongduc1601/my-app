import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('couple-theme');
    if (stored) return stored;
    // Auto dark if early morning (0-7h)
    const h = new Date().getHours();
    return (h >= 0 && h < 7) ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    const metaTheme = document.getElementById('meta-theme-color');
    if (theme === 'dark') {
      root.classList.add('dark');
      if (metaTheme) metaTheme.setAttribute('content', '#130b0e');
    } else {
      root.classList.remove('dark');
      if (metaTheme) metaTheme.setAttribute('content', '#fcf5f7');
    }
    localStorage.setItem('couple-theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);