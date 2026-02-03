import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
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
  const t = useDecklyTheme();
  const insets = useSafeAreaInsets();
  const { createDeck } = useDecksStore();

  const [name, setName] = useState('');
  const [accentKey, setAccentKey] = useState<string>(pickRandomDeckAccentKey());
  const [creating, setCreating] = useState(false);
  const [createdDeckId, setCreatedDeckId] = useState<string | null>(null);

  const canCreate = !creating && !createdDeckId && name.trim().length > 0;
  const previewColor = resolveDeckAccentColor(accentKey) ?? t.colors.primary;

  async function onCreate() {
    if (!canCreate) return;
    setCreating(true);
    try {
      const deck = await createDeck(name.trim(), accentKey);
      if (!deck) return;
      setCreatedDeckId(deck.id);
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Failed to create deck.');
    } finally {
      setCreating(false);
    }
  }

  const headerLeft = useMemo(
    () => () => (
      <Pressable
        hitSlop={10}
        onPress={() => router.back()}
        style={({ pressed }) => ({
          paddingHorizontal: 8,
          paddingVertical: 6,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="close" size={22} color={t.colors.text} />
      </Pressable>
    ),
    [t.colors.text],
  );

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'New deck', headerLeft }} />

      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: 140 }}>
            <View style={{ gap: 14 }}>
              <Input
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="e.g., Spanish - Basics"
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={onCreate}
                editable={!createdDeckId}
              />

              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="label">Accent</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: previewColor }} />
                    <Text variant="muted">Preview</Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    paddingTop: 8,
                    opacity: createdDeckId ? 0.6 : 1,
                  }}
                >
                  {DECK_ACCENTS.map((a) => {
                    const selected = accentKey === a.key;
                    return (
                      <Pressable
                        key={a.key}
                        disabled={!!createdDeckId}
                        onPress={() => setAccentKey(a.key)}
                        style={({ pressed }) => ({
                          width: 36,
                          height: 36,
                          borderRadius: 999,
                          borderWidth: 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: a.color,
                          borderColor: selected ? '#fff' : 'rgba(255,255,255,0.35)',
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {createdDeckId ? (
                <View style={{ gap: 10 }}>
                  <Text variant="muted">What would you like to do next?</Text>
                  <Button
                    title="Add a card"
                    onPress={() =>
                      router.replace({
                        pathname: '/deck/[deckId]/cards/new',
                        params: { deckId: createdDeckId },
                      })
                    }
                  />
                  <Button
                    title="Import CSV"
                    variant="secondary"
                    onPress={() =>
                      router.replace({ pathname: '/deck/[deckId]/import', params: { deckId: createdDeckId } })
                    }
                  />
                  <Button
                    title="Open deck"
                    variant="ghost"
                    onPress={() => router.replace(`/deck/${createdDeckId}`)}
                  />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {!createdDeckId ? (
          <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: 10 + insets.bottom }}>
            <Button
              title={creating ? 'Creating...' : 'Create deck'}
              onPress={onCreate}
              disabled={!canCreate}
              style={{ borderRadius: 999 }}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
