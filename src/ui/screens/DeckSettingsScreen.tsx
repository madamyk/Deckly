import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { getDeck } from '@/data/repositories/decksRepo';
import type { Deck } from '@/domain/models';
import { useDecksStore } from '@/stores/decksStore';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Screen } from '@/ui/components/Screen';
import { Surface } from '@/ui/components/Surface';
import { Text } from '@/ui/components/Text';
import { DECK_ACCENTS, resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { useDecklyTheme } from '@/ui/theme/provider';

export function DeckSettingsScreen(props: { deckId: string }) {
  const t = useDecklyTheme();
  const { updateDeck, deleteDeck } = useDecksStore();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [name, setName] = useState('');
  const [accentKey, setAccentKey] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await getDeck(props.deckId);
    setDeck(d);
    if (d) {
      setName(d.name);
      setAccentKey(d.accentColor);
    }
  }, [props.deckId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isDirty = useMemo(() => {
    if (!deck) return false;
    const trimmed = name.trim();
    return trimmed !== deck.name || accentKey !== deck.accentColor;
  }, [name, accentKey, deck]);

  const canSave = useMemo(() => {
    const trimmed = name.trim();
    return !!deck && !saving && isDirty && trimmed.length > 0;
  }, [deck, saving, isDirty, name]);

  async function save() {
    if (!deck || !canSave) return;
    setSaving(true);
    try {
      await updateDeck(deck.id, { name: name.trim(), accentColor: accentKey });
      router.back();
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Failed to save deck.');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!deck) return;
    Alert.alert('Delete deck?', 'This will remove the deck from your app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDeck(deck.id);
            router.replace('/');
          } catch (e: any) {
            Alert.alert('Deckly', e?.message ?? 'Failed to delete deck.');
          }
        },
      },
    ]);
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

  const previewColor = resolveDeckAccentColor(accentKey) ?? t.colors.primary;

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Deck settings',
          headerLeft,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: 24 }}
        >
          {!deck ? (
            <Text variant="muted">Deck not found.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              <Surface tone="muted" padding={14}>
                <Input
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Deck name"
                  cursorAtEndOnFocus
                  selectTextOnFocus={false}
                  returnKeyType="done"
                  onSubmitEditing={save}
                />
              </Surface>

              <Surface tone="muted" padding={14}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text variant="label">Accent</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: previewColor,
                      }}
                    />
                    <Text variant="muted">Preview</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 10 }}>
                  {DECK_ACCENTS.map((a) => {
                    const selected = accentKey === a.key;
                    return (
                      <Pressable
                        key={a.key}
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
              </Surface>

              <View style={{ gap: 10, marginTop: 6 }}>
                <Button
                  title={saving ? 'Saving...' : 'Save changes'}
                  onPress={save}
                  disabled={!canSave}
                />
                <Button title="Delete deck" variant="dangerGhost" onPress={del} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
