import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickRandomDeckAccentKey } from '@/domain/decks/accent';
import { useDecksStore } from '@/stores/decksStore';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { DECK_ACCENTS, resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { useDecklyTheme } from '@/ui/theme/provider';

export function NewDeckScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { createDeck } = useDecksStore();

  const [name, setName] = useState('');
  const [accentKey, setAccentKey] = useState<string>(pickRandomDeckAccentKey());
  const [creating, setCreating] = useState(false);
  const canCreate = !creating && name.trim().length > 0;
  const previewColor = resolveDeckAccentColor(accentKey) ?? theme.colors.primary;

  async function onCreate() {
    if (!canCreate) return;
    setCreating(true);
    try {
      const deck = await createDeck(name.trim(), accentKey);
      if (!deck) return;
      router.replace(`/deck/${deck.id}`);
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Failed to create deck.');
    } finally {
      setCreating(false);
    }
  }

  const HeaderLeft = useCallback(
    () => (
      <Pressable
        hitSlop={10}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="close" size={22} color={theme.colors.text} />
      </Pressable>
    ),
    [styles.headerButton, theme.colors.text],
  );

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'New deck', headerLeft: HeaderLeft }} />

      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <View style={styles.section}>
              <Input
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="e.g., Spanish - Basics"
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={onCreate}
                editable={!creating}
              />

              <View style={{ gap: 10 }}>
                <View style={styles.accentHeader}>
                  <Text variant="label">Accent</Text>
                  <View style={styles.accentPreviewRow}>
                    <View style={[styles.accentDot, { backgroundColor: previewColor }]} />
                    <Text variant="muted">Preview</Text>
                  </View>
                </View>

                <View
                  style={[styles.accentOptions, { opacity: creating ? 0.6 : 1 }]}
                >
                  {DECK_ACCENTS.map((a) => {
                    const selected = accentKey === a.key;
                    return (
                      <Pressable
                        key={a.key}
                        disabled={creating}
                        onPress={() => setAccentKey(a.key)}
                        style={({ pressed }) => [
                          styles.accentOption,
                          {
                            backgroundColor: a.color,
                            borderColor: selected ? '#fff' : 'rgba(255,255,255,0.35)',
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>
          <Button
            title={creating ? 'Creating...' : 'Create deck'}
            onPress={onCreate}
            disabled={!canCreate}
            style={{ borderRadius: 999 }}
          />
        </View>
      </View>
    </Screen>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    headerButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    contentContainer: {
      padding: theme.spacing.lg,
      paddingBottom: 140,
    },
    section: {
      gap: 14,
    },
    accentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    accentPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    accentDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    accentOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingTop: 8,
    },
    accentOption: {
      width: 36,
      height: 36,
      borderRadius: 999,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      paddingHorizontal: theme.spacing.lg,
    },
  });
}
