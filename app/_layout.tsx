import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useState } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from 'react-native';

import { initDb } from '@/data/db';
import { getNavigationTheme } from '@/ui/theme/navigationTheme';
import { DecklyThemeProvider } from '@/ui/theme/provider';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDb();
        if (!cancelled) setDbReady(true);
      } catch (e) {
        // Let the ErrorBoundary render; don't swallow init failures silently.
        throw e;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (dbReady) {
      SplashScreen.hideAsync();
    }
  }, [dbReady]);

  if (!dbReady) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const scheme = useColorScheme() ?? 'light';
  const navTheme = useMemo(() => getNavigationTheme(scheme), [scheme]);

  return (
    <DecklyThemeProvider scheme={scheme}>
      <ThemeProvider value={navTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Deckly' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="deck/[deckId]/index" options={{ title: 'Deck' }} />
          <Stack.Screen name="deck/[deckId]/rename" options={{ title: 'Rename deck' }} />
          <Stack.Screen
            name="deck/new"
            options={{
              title: 'New deck',
              presentation: 'modal',
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="deck/[deckId]/settings"
            options={{
              title: 'Deck settings',
              presentation: 'modal',
              gestureEnabled: true,
            }}
          />
          <Stack.Screen name="deck/[deckId]/cards/index" options={{ title: 'Cards' }} />
          <Stack.Screen name="deck/[deckId]/cards/new" options={{ title: 'New Card' }} />
          <Stack.Screen name="deck/[deckId]/cards/[cardId]" options={{ title: 'Edit Card' }} />
          <Stack.Screen name="deck/[deckId]/review/index" options={{ title: 'Review' }} />
          <Stack.Screen name="deck/[deckId]/import/index" options={{ title: 'Import CSV' }} />
        </Stack>
      </ThemeProvider>
    </DecklyThemeProvider>
  );
}
