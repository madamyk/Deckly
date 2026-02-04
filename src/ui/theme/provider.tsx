import React, { createContext, useMemo } from 'react';

import type { DecklyScheme, DecklyTheme } from '@/ui/theme/tokens';
import { getTheme } from '@/ui/theme/tokens';

const ThemeContext = createContext<DecklyTheme | null>(null);

export function DecklyThemeProvider(props: {
  scheme: DecklyScheme;
  children: React.ReactNode;
}) {
  const theme = useMemo(() => getTheme(props.scheme), [props.scheme]);
  return <ThemeContext.Provider value={theme}>{props.children}</ThemeContext.Provider>;
}

export function useDecklyTheme(): DecklyTheme {
  const theme = React.useContext(ThemeContext);
  if (!theme) throw new Error('useDecklyTheme must be used within DecklyThemeProvider');
  return theme;
}
