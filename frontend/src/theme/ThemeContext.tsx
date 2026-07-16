import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { storage } from '@/src/utils/storage';

import { PALETTES, Palette, ThemeName } from './palettes';
import { fontSize, fontWeight, motion, radius, spacing } from './tokens';

const THEME_STORAGE_KEY = 'hs.theme';

interface ThemeContextValue {
  themeName: ThemeName;
  palette: Palette;
  setTheme: (name: ThemeName) => Promise<void>;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  motion: typeof motion;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeName, setThemeName] = useState<ThemeName>('dark');

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<ThemeName>(THEME_STORAGE_KEY, 'dark');
      if (stored === 'dark' || stored === 'amoled' || stored === 'light') {
        setThemeName(stored);
      }
    })();
  }, []);

  const setTheme = useCallback(async (name: ThemeName) => {
    setThemeName(name);
    await storage.setItem(THEME_STORAGE_KEY, name);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    themeName,
    palette: PALETTES[themeName],
    setTheme,
    spacing,
    radius,
    fontSize,
    fontWeight,
    motion,
    isDark: themeName !== 'light',
  }), [themeName, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
