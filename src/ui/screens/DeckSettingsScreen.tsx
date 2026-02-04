import {
  getSecondaryLanguage,
  getShowExamplesOnBack,
  getShowExamplesOnFront,
  getStudyReversed,
  setSecondaryLanguage,
  setShowExamplesOnBack,
  setShowExamplesOnFront,
  setStudyReversed,
} from '@/data/repositories/deckPrefsRepo';
import { getDeck } from '@/data/repositories/decksRepo';
import { getLanguageOption } from '@/domain/languages';
import type { Deck } from '@/domain/models';
import { useDecksStore } from '@/stores/decksStore';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Row } from '@/ui/components/Row';
import { InfoModal } from '@/ui/components/InfoModal';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { TogglePill } from '@/ui/components/TogglePill';
import { ToggleRow } from '@/ui/components/ToggleRow';
import { DECK_ACCENTS, resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { useDecklyTheme } from '@/ui/theme/provider';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function DeckSettingsScreen(props: { deckId: string }) {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { updateDeck, deleteDeck } = useDecksStore();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [name, setName] = useState('');
  const [accentKey, setAccentKey] = useState<string>('');
  const [secondaryLanguage, setSecondaryLanguageState] = useState<string | null>(null);
  const [savedSecondaryLanguage, setSavedSecondaryLanguage] = useState<string | null>(null);
  const [studyReversed, setStudyReversedState] = useState(false);
  const [savedStudyReversed, setSavedStudyReversed] = useState(false);
  const [showExamplesOnFront, setShowExamplesOnFrontState] = useState(true);
  const [savedShowExamplesOnFront, setSavedShowExamplesOnFront] = useState(true);
  const [showExamplesOnBack, setShowExamplesOnBackState] = useState(true);
  const [savedShowExamplesOnBack, setSavedShowExamplesOnBack] = useState(true);
  const [studyReversedInfoOpen, setStudyReversedInfoOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const deckRecord = await getDeck(props.deckId);
    setDeck(deckRecord);
    if (deckRecord) {
      setName(deckRecord.name);
      setAccentKey(deckRecord.accentColor);
    }
    const secondary = await getSecondaryLanguage(props.deckId);
    setSecondaryLanguageState(secondary);
    setSavedSecondaryLanguage(secondary);
    const reversed = await getStudyReversed(props.deckId);
    setStudyReversedState(reversed);
    setSavedStudyReversed(reversed);
    const showFront = await getShowExamplesOnFront(props.deckId);
    setShowExamplesOnFrontState(showFront);
    setSavedShowExamplesOnFront(showFront);
    const showBack = await getShowExamplesOnBack(props.deckId);
    setShowExamplesOnBackState(showBack);
    setSavedShowExamplesOnBack(showBack);
  }, [props.deckId]);

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
      (secondaryLanguage ?? null) !== (savedSecondaryLanguage ?? null) ||
      studyReversed !== savedStudyReversed ||
      showExamplesOnFront !== savedShowExamplesOnFront ||
      showExamplesOnBack !== savedShowExamplesOnBack
    );
  }, [
    name,
    accentKey,
    deck,
    secondaryLanguage,
    savedSecondaryLanguage,
    studyReversed,
    savedStudyReversed,
    showExamplesOnFront,
    savedShowExamplesOnFront,
    showExamplesOnBack,
    savedShowExamplesOnBack,
  ]);

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
      await setStudyReversed(deck.id, studyReversed);
      await setShowExamplesOnFront(deck.id, showExamplesOnFront);
      await setShowExamplesOnBack(deck.id, showExamplesOnBack);
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

  const previewColor = resolveDeckAccentColor(accentKey) ?? theme.colors.primary;
  const secondaryOption = getLanguageOption(secondaryLanguage);
  const extraLabel = secondaryOption
    ? `${secondaryOption.emoji} ${secondaryOption.label}`
    : 'Not set';

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Deck settings',
          headerLeft: HeaderLeft,
        }}
      />

      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.contentContainer}
          >
            {!deck ? (
              <Text variant="muted">Deck not found.</Text>
            ) : (
              <View style={{ gap: 14 }}>
                <Input
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Deck name"
                  maxLength={20}
                  cursorAtEndOnFocus
                  selectTextOnFocus={false}
                  returnKeyType="done"
                  onSubmitEditing={save}
                />

                <View style={{ gap: 10 }}>
                  <View
                    style={styles.accentHeader}
                  >
                    <Text variant="label">Accent</Text>
                    <View style={styles.accentPreviewRow}>
                      <View style={[styles.accentDot, { backgroundColor: previewColor }]} />
                      <Text variant="muted">Preview</Text>
                    </View>
                  </View>

                  <View style={styles.accentOptions}>
                    {DECK_ACCENTS.map((a) => {
                      const selected = accentKey === a.key;
                      return (
                        <Pressable
                          key={a.key}
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

                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/deck/[deckId]/extra-language',
                      params: { deckId: props.deckId },
                    })
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, paddingVertical: 2 })}
                >
                  <Row>
                    <View style={{ gap: 4, flex: 1 }}>
                      <Text variant="label">Extra language</Text>
                      <Text variant="muted">{extraLabel}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
                  </Row>
                </Pressable>

                <View style={{ gap: 6 }}>
                  <Row style={{ alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={{ fontWeight: '500', color: theme.colors.textMuted }}>
                        Switch card sides
                      </Text>
                      <Pressable
                        onPress={() => setStudyReversedInfoOpen(true)}
                        hitSlop={10}
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
                      </Pressable>
                    </View>
                    <View>
                      {Platform.OS === 'ios' ? (
                        <Switch
                          value={studyReversed}
                          onValueChange={setStudyReversedState}
                          trackColor={{
                            false: theme.colors.surface2,
                            true: theme.colors.primaryGradientEnd,
                          }}
                          thumbColor={studyReversed ? '#FFFFFF' : '#F4F5F7'}
                          ios_backgroundColor={theme.colors.surface2}
                        />
                      ) : (
                        <TogglePill value={studyReversed} onToggle={setStudyReversedState} />
                      )}
                    </View>
                  </Row>
                  <ToggleRow
                    label="Show examples on front"
                    value={showExamplesOnFront}
                    onToggle={setShowExamplesOnFrontState}
                  />
                  <ToggleRow
                    label="Show examples on back"
                    value={showExamplesOnBack}
                    onToggle={setShowExamplesOnBackState}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {deck ? (
          <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>
            <View style={{ gap: 10 }}>
              <Button
                title={saving ? 'Saving...' : 'Save changes'}
                onPress={save}
                disabled={!canSave}
                style={{ borderRadius: 999 }}
              />
              <Button title="Delete deck" variant="dangerGhost" onPress={del} />
            </View>
          </View>
        ) : null}
      </View>

      <InfoModal
        visible={studyReversedInfoOpen}
        title="Switch card sides"
        onClose={() => setStudyReversedInfoOpen(false)}
      >
        <Text variant="muted">Show the back first and reveal the front during review.</Text>
      </InfoModal>
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
