import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { DecklyScheme } from '@/ui/theme/tokens';
import { getTheme } from '@/ui/theme/tokens';

export function getNavigationTheme(scheme: DecklyScheme): Theme {
  const t = getTheme(scheme);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: t.colors.primary,
      background: t.colors.bg,
      card: t.colors.surface,
      text: t.colors.text,
      border: t.colors.border,
      notification: t.colors.primary2,
    },
  };
}
