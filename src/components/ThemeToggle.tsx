import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'dark' | 'light';

function applyTheme(newTheme: Theme) {
  const root = document.documentElement;
  if (newTheme === 'light') {
    root.classList.add('light');
  } else {
    root.classList.remove('light');
  }
}

export function ThemeToggle() {
  // Initialize theme from localStorage; with nothing stored, default to dark
  // (the old system-preference check resolved to dark either way).
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme | null) || 'dark');

  // Keep the document class in sync with the theme
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/50 transition-all duration-200 group"
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {/* Sun icon for light mode */}
      <Sun 
        className={`w-4 h-4 absolute transition-all duration-300 ${
          theme === 'light' 
            ? 'opacity-100 rotate-0 scale-100 text-amber-500' 
            : 'opacity-0 -rotate-90 scale-75 text-amber-500'
        }`} 
      />
      {/* Moon icon for dark mode */}
      <Moon 
        className={`w-4 h-4 absolute transition-all duration-300 ${
          theme === 'dark' 
            ? 'opacity-100 rotate-0 scale-100 text-blue-400' 
            : 'opacity-0 rotate-90 scale-75 text-blue-400'
        }`} 
      />
      
      {/* Subtle glow effect on hover */}
      <div className={`absolute inset-0 rounded-lg transition-opacity duration-200 ${
        theme === 'dark' 
          ? 'bg-blue-400/0 group-hover:bg-blue-400/10' 
          : 'bg-amber-400/0 group-hover:bg-amber-400/10'
      }`} />
    </button>
  );
}
