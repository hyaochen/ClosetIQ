import { create } from 'zustand';
import { Appearance, Platform } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  loadTheme: () => void;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'dark';
  }
  return mode === 'dark';
}

const STORAGE_KEY = 'theme-mode';

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  isDark: Appearance.getColorScheme() === 'dark',

  setMode: (mode) => {
    const isDark = resolveIsDark(mode);
    set({ mode, isDark });
    // Persist
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  },

  loadTheme: () => {
    if (Platform.OS === 'web') {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved) {
        set({ mode: saved, isDark: resolveIsDark(saved) });
      }
    }
  },
}));
