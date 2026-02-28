'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSyncOrchestrator } from '@/hooks/use-offline-sync';
import { captureAppException } from '@/lib/observability';

type Theme = 'light' | 'dark';
type ThemeMode = Theme;

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  cycleThemeMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';

  const stored = window.localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;

  return 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
      },
    },
  }));
  const [mode, setMode] = useState<ThemeMode>('light');
  const [theme, setTheme] = useState<Theme>('light');

  useSyncOrchestrator();

  useEffect(() => {
    const initialMode = getInitialThemeMode();
    setMode(initialMode);
    setTheme(initialMode);
    applyTheme(initialMode);
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      captureAppException(event.error ?? new Error(event.message || 'Unhandled window error'), {
        tags: { scope: 'window.error' },
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      captureAppException(event.reason ?? new Error('Unhandled promise rejection'), {
        tags: { scope: 'window.unhandledrejection' },
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  const setThemeMode = (nextMode: ThemeMode) => {
    setMode(nextMode);
    setTheme(nextMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', nextMode);
    }
    applyTheme(nextMode);
  };

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    mode,
    setThemeMode,
    cycleThemeMode: () => {
      const order: ThemeMode[] = ['light', 'dark'];
      const next = order[(order.indexOf(mode) + 1) % order.length];
      setThemeMode(next);
    },
  }), [theme, mode]);

  return (
    <ThemeContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within Providers');
  }
  return context;
}
