import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getSecondaryLanguage, setSecondaryLanguage } from '@/data/repositories/deckPrefsRepo';
import { EXTRA_LANGUAGES } from '@/domain/languages';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

export default function ExtraLanguageScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const [value, setValue] = useState<string | null>(null);

  const load = useCallback(async () => {
    const current = await getSecondaryLanguage(deckId);
    setValue(current);
  }, [deckId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function select(next: string | null) {
    setValue(next);
    await setSecondaryLanguage(deckId, next);
    router.back();
  }

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Extra language' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.list}>
          <Pressable
            onPress={() => select(null)}
            style={({ pressed }) => [styles.optionRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ fontWeight: value ? '600' : '800' }}>None</Text>
            {!value ? <Ionicons name="checkmark" size={18} color={theme.colors.primary2} /> : null}
          </Pressable>

          <View style={styles.divider} />

          {EXTRA_LANGUAGES.map((l) => {
            const selected = value === l.code;
            return (
              <Pressable
                key={l.code}
                onPress={() => select(l.code)}
                style={({ pressed }) => [styles.optionRow, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ fontWeight: selected ? '800' : '600' }}>
                  {l.emoji} {l.label}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark" size={18} color={theme.colors.primary2} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    scrollContent: {
      padding: theme.spacing.lg,
      paddingBottom: 24,
    },
    list: {
      gap: 12,
    },
    optionRow: {
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
  });
}
