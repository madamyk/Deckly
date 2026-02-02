import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import { getDeck } from '@/data/repositories/decksRepo';
import {
  getExampleLevel,
  getSecondaryLanguage,
  setExampleLevel,
  setSecondaryLanguage,
} from '@/data/repositories/deckPrefsRepo';
import { getLanguageOption } from '@/domain/languages';
import type { Deck } from '@/domain/models';
import type { AiExampleLevel } from '@/domain/prefs';
import { generateAndPersistExamplePairs } from '@/services/examplePairService';
import { useDecksStore } from '@/stores/decksStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { LevelPicker } from '@/ui/components/LevelPicker';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { Row } from '@/ui/components/Row';
import { DECK_ACCENTS, resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { useDecklyTheme } from '@/ui/theme/provider';
import { getAiApiKey } from '@/data/secureStore';

export function DeckSettingsScreen(props: { deckId: string }) {
  const t = useDecklyTheme();
  const { updateDeck, deleteDeck } = useDecksStore();
  const ai = usePrefsStore((s) => s.prefs.ai);

  const [deck, setDeck] = useState<Deck | null>(null);
  const [name, setName] = useState('');
  const [accentKey, setAccentKey] = useState<string>('');
  const [secondaryLanguage, setSecondaryLanguageState] = useState<string | null>(null);
  const [savedSecondaryLanguage, setSavedSecondaryLanguage] = useState<string | null>(null);
  const [exampleLevel, setExampleLevelState] = useState<AiExampleLevel>(ai.level);
  const [saving, setSaving] = useState(false);
  const [regenProgress, setRegenProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [regenRunning, setRegenRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const d = await getDeck(props.deckId);
    setDeck(d);
    if (d) {
      setName(d.name);
      setAccentKey(d.accentColor);
    }
    const secondary = await getSecondaryLanguage(props.deckId);
    setSecondaryLanguageState(secondary);
    setSavedSecondaryLanguage(secondary);
    const level = await getExampleLevel(props.deckId);
    setExampleLevelState(level ?? ai.level);
  }, [props.deckId, ai.level]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isDirty = useMemo(() => {
    if (!deck) return false;
    const trimmed = name.trim();
    return (
      trimmed !== deck.name ||
      accentKey !== deck.accentColor ||
      (secondaryLanguage ?? null) !== (savedSecondaryLanguage ?? null)
    );
  }, [name, accentKey, deck, secondaryLanguage, savedSecondaryLanguage]);

  const canSave = useMemo(() => {
    const trimmed = name.trim();
    return !!deck && !saving && isDirty && trimmed.length > 0;
  }, [deck, saving, isDirty, name]);

  async function save() {
    if (!deck || !canSave) return;
    setSaving(true);
    try {
      await updateDeck(deck.id, { name: name.trim(), accentColor: accentKey });
      await setSecondaryLanguage(deck.id, secondaryLanguage ?? null);
      await setExampleLevel(deck.id, exampleLevel);
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
  const secondaryOption = getLanguageOption(secondaryLanguage);
  const extraLabel = secondaryOption
    ? `${secondaryOption.emoji} ${secondaryOption.label}`
    : 'Not set';

  async function regenerateExamples() {
    if (!deck || regenRunning) return;
    const key = await getAiApiKey();
    if (!ai.enabled) {
      Alert.alert('Deckly', 'AI Assist is off. Enable it in Settings.');
      router.push('/settings/ai');
      return;
    }
    if (!key) {
      Alert.alert('Deckly', 'Add your OpenAI API key in Settings to regenerate examples.');
      router.push('/settings/ai');
      return;
    }
    Alert.alert(
      'Regenerate examples?',
      'This will overwrite existing examples and notes for all cards in this deck. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            setRegenRunning(true);
            setRegenProgress({ done: 0, total: 0, failed: 0 });
            const controller = new AbortController();
            abortRef.current = controller;
            try {
              await setExampleLevel(deck.id, exampleLevel);
              setSavedExampleLevel(exampleLevel);
              const cards = await cardsRepo.listCards(deck.id);
              const cardsForGen = cards.map((c) => ({
                id: c.id,
                front: c.front,
                back: c.back,
                exampleL1: c.exampleL1 ?? null,
                exampleL2: c.exampleL2 ?? null,
              }));
              const res = await generateAndPersistExamplePairs({
                deckId: deck.id,
                cards: cardsForGen,
                mode: 'all',
                concurrency: 2,
                levelOverride: exampleLevel,
                signal: controller.signal,
                onProgress: (p) => setRegenProgress(p),
              });
              if (!controller.signal.aborted) {
                Alert.alert(
                  'Deckly',
                  `Regenerated ${res.done - res.failed.length}/${res.total} cards.`,
                );
              }
            } catch (e: any) {
              if (!controller.signal.aborted) {
                Alert.alert('Deckly', e?.message ?? 'Failed to regenerate examples.');
              }
            } finally {
              setRegenRunning(false);
              abortRef.current = null;
            }
          },
        },
      ],
    );
  }

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
            <View style={{ gap: 14 }}>
              <View style={{ paddingVertical: 4 }}>
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
              </View>

              <View style={{ height: 1, backgroundColor: t.colors.border }} />

              <View style={{ gap: 10 }}>
                <Text variant="label">Example level</Text>
                <LevelPicker value={exampleLevel} onChange={setExampleLevelState} />
                <Button
                  title={regenRunning ? 'Regenerating...' : 'Regenerate examples'}
                  variant="secondary"
                  onPress={regenerateExamples}
                  disabled={regenRunning}
                />
                {regenProgress ? (
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {regenRunning ? (
                        <ActivityIndicator color={t.colors.textMuted} />
                      ) : null}
                      <Text variant="muted">
                        Regenerating {regenProgress.done}/{regenProgress.total}
                      </Text>
                    </View>
                    {regenProgress.failed ? (
                      <Text variant="muted" style={{ color: t.colors.danger }}>
                        Failed: {regenProgress.failed}
                      </Text>
                    ) : null}
                    {regenRunning ? (
                      <Button
                        title="Cancel"
                        variant="dangerGhost"
                        onPress={() => abortRef.current?.abort()}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={{ height: 1, backgroundColor: t.colors.border }} />

              <View style={{ gap: 10 }}>
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

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
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
              </View>

              <View style={{ height: 1, backgroundColor: t.colors.border }} />

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/deck/[deckId]/extra-language',
                    params: { deckId: props.deckId },
                  })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, paddingVertical: 4 })}
              >
                <Row>
                  <View style={{ gap: 4, flex: 1 }}>
                    <Text variant="label">Extra language</Text>
                    <Text variant="muted">{extraLabel}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={t.colors.textMuted} />
                </Row>
              </Pressable>

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
