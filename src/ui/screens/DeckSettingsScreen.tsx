import {
  getDailyReviewLimit,
  getNewCardsPerSession,
  getSecondaryLanguage,
  getShowExamplesOnBack,
  getShowExamplesOnFront,
  getStudyReversed,
  setDailyReviewLimit,
  setNewCardsPerSession,
  setSecondaryLanguage,
  setShowExamplesOnBack,
  setShowExamplesOnFront,
  setStudyReversed,
} from '@/data/repositories/deckPrefsRepo';
import { getDeck } from '@/data/repositories/decksRepo';
import { getDeckTags, setDeckTags } from '@/data/repositories/tagsRepo';
import { getLanguageOption } from '@/domain/languages';
import type { Deck } from '@/domain/models';
import {
  DEFAULT_DAILY_REVIEW_LIMIT,
  DEFAULT_NEW_CARDS_PER_SESSION,
} from '@/domain/scheduling/constants';
import {
  clampDailyReviewLimit,
  clampNewCardsPerSession,
} from '@/domain/scheduling/sessionQueue';
import { useDecksStore } from '@/stores/decksStore';
import { Button } from '@/ui/components/Button';
import { InfoModal } from '@/ui/components/InfoModal';
import { Input } from '@/ui/components/Input';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { TogglePill } from '@/ui/components/TogglePill';
import { ToggleRow } from '@/ui/components/ToggleRow';
import { useKeyboardVisible } from '@/ui/hooks/useKeyboardVisible';
import { DECK_ACCENTS, resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { useDecklyTheme } from '@/ui/theme/provider';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PacingInfoKey = 'newCards' | 'dailyLimit';

export function DeckSettingsScreen(props: { deckId: string }) {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
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
  const [newCardsPerSession, setNewCardsPerSessionState] = useState(String(DEFAULT_NEW_CARDS_PER_SESSION));
  const [savedNewCardsPerSession, setSavedNewCardsPerSession] = useState(DEFAULT_NEW_CARDS_PER_SESSION);
  const [dailyReviewLimit, setDailyReviewLimitState] = useState(String(DEFAULT_DAILY_REVIEW_LIMIT));
  const [savedDailyReviewLimit, setSavedDailyReviewLimit] = useState(DEFAULT_DAILY_REVIEW_LIMIT);
  const [tags, setTags] = useState<string[]>([]);
  const [tagsDirty, setTagsDirty] = useState(false);
  const tagsLoadedRef = useRef(false);
  const tagsRef = useRef<string[]>([]);
  const [studyReversedInfoOpen, setStudyReversedInfoOpen] = useState(false);
  const [pacingInfoOpen, setPacingInfoOpen] = useState<PacingInfoKey | null>(null);
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
    const newLimit = await getNewCardsPerSession(props.deckId);
    setNewCardsPerSessionState(String(newLimit));
    setSavedNewCardsPerSession(newLimit);
    const dailyLimit = await getDailyReviewLimit(props.deckId);
    setDailyReviewLimitState(String(dailyLimit));
    setSavedDailyReviewLimit(dailyLimit);
    const nextTags = await getDeckTags(props.deckId);
    if (tagsLoadedRef.current) {
      const prev = tagsRef.current.map((t) => t.toLocaleLowerCase()).sort().join('|');
      const next = nextTags.map((t) => t.toLocaleLowerCase()).sort().join('|');
      if (prev !== next) setTagsDirty(true);
    } else {
      tagsLoadedRef.current = true;
    }
    tagsRef.current = nextTags;
    setTags(nextTags);
  }, [props.deckId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const parsedNewCardsPerSession = useMemo(
    () => clampNewCardsPerSession(Number(newCardsPerSession)),
    [newCardsPerSession],
  );
  const parsedDailyReviewLimit = useMemo(
    () => clampDailyReviewLimit(Number(dailyReviewLimit)),
    [dailyReviewLimit],
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
      showExamplesOnBack !== savedShowExamplesOnBack ||
      tagsDirty ||
      parsedNewCardsPerSession !== savedNewCardsPerSession ||
      parsedDailyReviewLimit !== savedDailyReviewLimit
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
    tagsDirty,
    parsedNewCardsPerSession,
    savedNewCardsPerSession,
    parsedDailyReviewLimit,
    savedDailyReviewLimit,
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
      await setDeckTags(deck.id, tags);
      await setNewCardsPerSession(deck.id, parsedNewCardsPerSession);
      await setDailyReviewLimit(deck.id, parsedDailyReviewLimit);
      setTagsDirty(false);
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
  const pacingInfo = useMemo(() => {
    if (pacingInfoOpen === 'newCards') {
      return {
        title: 'New cards',
        body: 'Maximum new cards introduced in one session. Lower values improve short-term reinforcement.',
      };
    }
    if (pacingInfoOpen === 'dailyLimit') {
      return {
        title: 'Daily limit',
        body: 'Maximum cards reviewed in one session. Set to 0 for unlimited.',
      };
    }
    return null;
  }, [pacingInfoOpen]);
  const contentBottomPadding = keyboardVisible ? insets.bottom + theme.spacing.lg + 64 : 140;

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Deck settings',
          headerLeft: HeaderLeft,
        }}
      />

      <View style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: contentBottomPadding }]}
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

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/deck/[deckId]/tags',
                    params: { deckId: props.deckId },
                  })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, paddingVertical: 2 })}
              >
                <View style={{ gap: 6 }}>
                  <Row>
                    <Text variant="label">Tags</Text>
                  </Row>
                  <View style={styles.tagWrap}>
                    {tags.length ? (
                      <>
                        {tags.map((tag) => (
                          <View key={tag} style={styles.tagPill}>
                            <Text style={styles.tagPillText}>{tag}</Text>
                          </View>
                        ))}
                        <View style={styles.tagAddPill}>
                          <Ionicons name="add" size={14} color={theme.colors.textMuted} />
                        </View>
                      </>
                    ) : (
                      <View style={styles.tagAddButton}>
                        <Ionicons name="add" size={14} color={theme.colors.text} />
                        <Text style={styles.tagAddButtonText}>Add tag</Text>
                      </View>
                    )}
                  </View>
                </View>
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

              <View style={{ gap: 10 }}>
                <Text variant="label">Review pacing</Text>
                <Row style={styles.pacingRow}>
                  <View style={styles.pacingLabelRow}>
                    <Text style={styles.pacingLabel}>New cards</Text>
                    <Pressable
                      onPress={() => setPacingInfoOpen('newCards')}
                      hitSlop={10}
                      style={({ pressed }) => [styles.pacingInfoButton, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
                    </Pressable>
                  </View>
                  <View style={styles.pacingInputWrap}>
                    <Input
                      keyboardType="number-pad"
                      value={newCardsPerSession}
                      onChangeText={setNewCardsPerSessionState}
                      placeholder={String(DEFAULT_NEW_CARDS_PER_SESSION)}
                      returnKeyType="done"
                      onSubmitEditing={save}
                      style={styles.pacingInput}
                    />
                  </View>
                </Row>
                <Row style={styles.pacingRow}>
                  <View style={styles.pacingLabelRow}>
                    <Text style={styles.pacingLabel}>Daily limit</Text>
                    <Pressable
                      onPress={() => setPacingInfoOpen('dailyLimit')}
                      hitSlop={10}
                      style={({ pressed }) => [styles.pacingInfoButton, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
                    </Pressable>
                  </View>
                  <View style={styles.pacingInputWrap}>
                    <Input
                      keyboardType="number-pad"
                      value={dailyReviewLimit}
                      onChangeText={setDailyReviewLimitState}
                      placeholder={String(DEFAULT_DAILY_REVIEW_LIMIT)}
                      returnKeyType="done"
                      onSubmitEditing={save}
                      style={styles.pacingInput}
                    />
                  </View>
                </Row>
              </View>
            </View>
          )}
        </ScrollView>

        {deck && !keyboardVisible ? (
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
      <InfoModal
        visible={!!pacingInfoOpen}
        title={pacingInfo?.title ?? 'Review pacing'}
        onClose={() => setPacingInfoOpen(null)}
      >
        <Text variant="muted">{pacingInfo?.body ?? ''}</Text>
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
    pacingRow: {
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    pacingLabel: {
      flex: 1,
      color: theme.colors.textMuted,
      fontWeight: '500',
    },
    pacingLabelRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pacingInfoButton: {
      paddingVertical: 2,
      paddingHorizontal: 2,
    },
    pacingInputWrap: {
      width: 88,
    },
    pacingInput: {
      textAlign: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      fontSize: 14,
    },
    tagWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tagPill: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tagPillText: {
      color: theme.colors.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600' as const,
    },
    tagAddPill: {
      borderRadius: 999,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tagAddButton: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
    },
    tagAddButtonText: {
      color: theme.colors.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600' as const,
    },
    footer: {
      paddingHorizontal: theme.spacing.lg,
    },
  });
}
