import React, { createContext, useContext, useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Theme Registry — Add new themes here
// ═══════════════════════════════════════════════════════════════════════════

export type Theme =
  | 'original'
  | 'original-alter'
  | 'navy'
  | 'sage'
  | 'burgundy'
  | 'bamboo'
  | 'earth'
  | 'ocean'
  | 'sunset'
  | 'lavender'
  | 'forest'
  | 'arctic';

export interface ThemeInfo {
  id: Theme;
  displayName: string;
  emoji: string;
  description: string;
  category: 'warm' | 'cool' | 'nature' | 'neutral';
}

/**
 * Theme registry with metadata. Used by ThemeSelectionModal and StudentSettings.
 * To add a new theme:
 * 1. Add the theme id to the Theme type above
 * 2. Add an entry here
 * 3. Create the CSS file in src/theme/themes/
 * 4. Import it in src/theme/variables.css
 */
export const THEME_REGISTRY: ThemeInfo[] = [
  { id: 'original',       displayName: 'Café Rico',        emoji: '☕', description: 'Warm brown café aesthetic',       category: 'warm' },
  { id: 'original-alter',  displayName: 'Café Latte',       emoji: '🥛', description: 'Softer café with slate accents',  category: 'warm' },
  { id: 'navy',           displayName: 'Navy Scholar',      emoji: '📘', description: 'Deep academic blue',              category: 'cool' },
  { id: 'sage',           displayName: 'Sage Wisdom',       emoji: '🌿', description: 'Calming natural sage green',      category: 'nature' },
  { id: 'burgundy',       displayName: 'Rose Library',      emoji: '🌹', description: 'Elegant burgundy & rose',        category: 'warm' },
  { id: 'bamboo',         displayName: 'Spring Garden',     emoji: '🌱', description: 'Fresh natural bamboo green',     category: 'nature' },
  { id: 'earth',          displayName: 'Terra Warm',        emoji: '🏜️', description: 'Earthy terracotta & amber',       category: 'warm' },
  { id: 'ocean',          displayName: 'Deep Sea',          emoji: '🌊', description: 'Calming ocean blue',             category: 'cool' },
  { id: 'sunset',         displayName: 'Golden Hour',       emoji: '🌅', description: 'Warm premium sunset',            category: 'warm' },
  { id: 'lavender',       displayName: 'Purple Dream',      emoji: '💜', description: 'Modern lavender & mint',         category: 'cool' },
  { id: 'forest',         displayName: 'Enchanted Woods',   emoji: '🌲', description: 'Organic deep forest green',      category: 'nature' },
  { id: 'arctic',         displayName: 'Ice Crystal',       emoji: '❄️', description: 'Clean cool arctic',              category: 'cool' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  availableThemes: Theme[];
  themeRegistry: ThemeInfo[];
  getThemeInfo: (id: Theme) => ThemeInfo | undefined;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('original');

  useEffect(() => {
    const savedTheme = localStorage.getItem('arenai-theme') as Theme;
    if (savedTheme && THEME_REGISTRY.some(t => t.id === savedTheme)) {
      setTheme(savedTheme);
    } else {
      setTheme('original');
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('arenai-theme', newTheme);

    // Apply theme class to body — only remove theme-* classes, preserve everything else
    const existingClasses = Array.from(document.body.classList);
    existingClasses.forEach(cls => {
      if (cls.startsWith('theme-')) {
        document.body.classList.remove(cls);
      }
    });
    if (newTheme !== 'original') {
      document.body.classList.add(`theme-${newTheme}`);
    }
  };

  const availableThemes: Theme[] = THEME_REGISTRY.map(t => t.id);

  const getThemeInfo = (id: Theme) => THEME_REGISTRY.find(t => t.id === id);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableThemes, themeRegistry: THEME_REGISTRY, getThemeInfo }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
