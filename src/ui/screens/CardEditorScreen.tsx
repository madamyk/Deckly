import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import * as deckAiRepo from '@/data/repositories/deckAiRepo';
import { getDeck } from '@/data/repositories/decksRepo';
import { getAiApiKey } from '@/data/secureStore';
import { EXTRA_LANGUAGES, getLanguageOption } from '@/domain/languages';
import type { Card, ExampleSource } from '@/domain/models';
import { generateExamplePair } from '@/services/examplePairService';
import { generateTermTranslation } from '@/services/termTranslationService';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/ui/components/Button';
import { cardStateLabel, cardStateTone } from '@/ui/components/cardStatePill';
import { Input } from '@/ui/components/Input';
import { Pill } from '@/ui/components/Pill';
import { Screen } from '@/ui/components/Screen';
import { Surface } from '@/ui/components/Surface';
import { Text } from '@/ui/components/Text';
import { TranslateTermModal } from '@/ui/components/TranslateTermModal';
import { useKeyboardVisible } from '@/ui/hooks/useKeyboardVisible';
import { resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { useDecklyTheme } from '@/ui/theme/provider';
import { formatShortDateTime, nowMs } from '@/utils/time';

export function CardEditorScreen(props: {
  mode: 'create' | 'edit';
  deckId: string;
  cardId?: string;
}) {
  const theme = useDecklyTheme();
  const ai = usePrefsStore((s) => s.prefs.ai);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const keyboard = useAnimatedKeyboard();
  const [card, setCard] = useState<Card | null>(null);
  const [initialFront, setInitialFront] = useState('');
  const [initialBack, setInitialBack] = useState('');
  const [initialexampleFront, setInitialexampleFront] = useState('');
  const [initialexampleBack, setInitialexampleBack] = useState('');
  const [initialExampleNote, setInitialExampleNote] = useState('');
  const [initialExampleSource, setInitialExampleSource] = useState<ExampleSource | null>(null);
  const [initialExampleGeneratedAt, setInitialExampleGeneratedAt] = useState<number | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [exampleFront, setexampleFront] = useState('');
  const [exampleBack, setexampleBack] = useState('');
  const [exampleNote, setExampleNote] = useState('');
  const [exampleSource, setExampleSource] = useState<ExampleSource | null>(null);
  const [exampleGeneratedAt, setExampleGeneratedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [aiKeyPresent, setAiKeyPresent] = useState(false);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [deckLanguages, setDeckLanguages] = useState<{ front_language: string; back_language: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translatePickerOpen, setTranslatePickerOpen] = useState(false);
  const [translateTargetCode, setTranslateTargetCode] = useState(EXTRA_LANGUAGES[0]?.code ?? 'en');
  const [pendingTranslateSide, setPendingTranslateSide] = useState<'front' | 'back' | null>(null);
  const progressTrackW = useSharedValue(0);
  const progressT = useSharedValue(0);

  useEffect(() => {
    if (generating) {
      progressT.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true,
      );
    } else {
      progressT.value = 0;
    }
  }, [generating, progressT]);

  const progressThumbStyle = useAnimatedStyle(() => {
    const trackWidth = progressTrackW.value;
    const segmentWidth = Math.max(24, trackWidth * 0.35);
    const translateX = (trackWidth + segmentWidth) * progressT.value - segmentWidth;
    return {
      width: segmentWidth,
      transform: [{ translateX }],
    };
  });
  const keyboardAvoiderStyle = useAnimatedStyle(() => ({
    height: withTiming(keyboard.height.value / 2, { duration: 250 })
  }));

  const load = useCallback(async () => {
    if (props.mode !== 'edit' || !props.cardId) return;
    const cardRecord = await cardsRepo.getCard(props.cardId);
    setCard(cardRecord);
    const frontValue = cardRecord?.front ?? '';
    const backValue = cardRecord?.back ?? '';
    const exampleFrontValue = cardRecord?.exampleFront ?? '';
    const exampleBackValue = cardRecord?.exampleBack ?? '';
    const exampleNoteValue = cardRecord?.exampleNote ?? '';
    setInitialFront(frontValue);
    setInitialBack(backValue);
    setInitialexampleFront(exampleFrontValue);
    setInitialexampleBack(exampleBackValue);
    setInitialExampleNote(exampleNoteValue);
    setInitialExampleSource(cardRecord?.exampleSource ?? null);
    setInitialExampleGeneratedAt(cardRecord?.exampleGeneratedAt ?? null);
    setFront(frontValue);
    setBack(backValue);
    setexampleFront(exampleFrontValue);
    setexampleBack(exampleBackValue);
    setExampleNote(exampleNoteValue);
    setExampleSource(cardRecord?.exampleSource ?? null);
    setExampleGeneratedAt(cardRecord?.exampleGeneratedAt ?? null);
  }, [props.mode, props.cardId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const deck = await getDeck(props.deckId);
      setAccentColor(resolveDeckAccentColor(deck?.accentColor) ?? null);
      const langs = await deckAiRepo.getDeckLanguages(props.deckId);
      setDeckLanguages(langs);
    })();
  }, [props.deckId]);

  useEffect(() => {
    (async () => {
      const apiKey = await getAiApiKey();
      setAiKeyPresent(!!apiKey);
    })();
  }, []);

  const isDirty =
    props.mode === 'create'
      ? front.length > 0 || back.length > 0 || exampleFront.length > 0 || exampleBack.length > 0 || exampleNote.length > 0
      : front !== initialFront ||
      back !== initialBack ||
      exampleFront !== initialexampleFront ||
      exampleBack !== initialexampleBack ||
      exampleNote !== initialExampleNote ||
      exampleSource !== initialExampleSource ||
      exampleGeneratedAt !== initialExampleGeneratedAt;
  const canSave = !saving && isDirty && front.trim().length > 0 && back.trim().length > 0;
  const hasExampleContent = !!(exampleFront.trim() || exampleBack.trim() || exampleNote.trim());
  const canGenerate = front.trim().length > 0 && back.trim().length > 0;
  const optionalInputStyle = styles.optionalInput;
  const accentProgress = accentColor ?? theme.colors.primary2;
  const isBusy = generating || translating;
  const frontEmpty = front.trim().length === 0;
  const backEmpty = back.trim().length === 0;
  const showTranslateForFront = back.trim().length > 0 && frontEmpty;
  const showTranslateForBack = front.trim().length > 0 && backEmpty;
  const canTranslate = ai.enabled && aiKeyPresent && !isBusy;

  async function save() {
    const frontText = front.trim();
    const backText = back.trim();
    if (!frontText || !backText) {
      Alert.alert('Deckly', 'Front and Back are required.');
      return;
    }
    setSaving(true);
    try {
      const exampleFrontText = exampleFront.trim() ? exampleFront.trim() : null;
      const exampleBackText = exampleBack.trim() ? exampleBack.trim() : null;
      const exampleNoteText = exampleNote.trim() ? exampleNote.trim() : null;
      const hasAnyExample = !!(exampleFrontText || exampleBackText || exampleNoteText);
      const source: ExampleSource | null = hasAnyExample ? (exampleSource ?? 'user') : null;
      const generatedAt = source === 'ai' ? exampleGeneratedAt ?? nowMs() : null;

      if (props.mode === 'create') {
        await cardsRepo.createCard({
          deckId: props.deckId,
          front: frontText,
          back: backText,
          exampleFront: exampleFrontText,
          exampleBack: exampleBackText,
          exampleNote: exampleNoteText,
          exampleSource: source,
          exampleGeneratedAt: generatedAt,
        });
        router.back();
      } else {
        if (!props.cardId) return;
        await cardsRepo.updateCard(props.cardId, {
          front: frontText,
          back: backText,
          exampleFront: exampleFrontText,
          exampleBack: exampleBackText,
          exampleNote: exampleNoteText,
          exampleSource: source,
          exampleGeneratedAt: generatedAt,
        });
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Failed to save card.');
    } finally {
      setSaving(false);
    }
  }

  async function generateConfirmed() {
    const frontText = front.trim();
    const backText = back.trim();
    if (!frontText || !backText) {
      Alert.alert('Deckly', 'Fill in Front and Back first.');
      return;
    }
    if (!ai.enabled) {
      Alert.alert('Deckly', 'AI Assist is turned off. Enable it in Settings.');
      router.push('/settings/ai');
      return;
    }
    if (!aiKeyPresent) {
      Alert.alert('Deckly', 'To generate examples, add your OpenAI API key in Settings.');
      router.push('/settings/ai');
      return;
    }
    setGenError(null);
    setGenerating(true);
    try {
      const { patch } = await generateExamplePair({
        deckId: props.deckId,
        frontText,
        backText,
      });
      setexampleFront(patch.exampleFront ?? '');
      setexampleBack(patch.exampleBack ?? '');
      setExampleNote(patch.exampleNote ?? '');
      setExampleSource('ai');
      setExampleGeneratedAt(patch.exampleGeneratedAt ?? nowMs());
    } catch (e: any) {
      setGenError(e?.message ?? 'Failed to generate example.');
    } finally {
      setGenerating(false);
    }
  }

  function generate() {
    if (hasExampleContent) {
      Alert.alert(
        'Regenerate content?',
        'This will overwrite the current examples and note for this card.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Regenerate', onPress: generateConfirmed },
        ],
      );
      return;
    }
    generateConfirmed();
  }

  function formatLangLabel(lang: string): string {
    const opt = getLanguageOption(lang);
    return opt ? `${opt.label} (${opt.code})` : lang;
  }

  async function runTranslate(params: {
    side: 'front' | 'back';
    targetLanguage: string;
    sourceLanguage?: string | null;
  }) {
    const sourceText = params.side === 'front' ? back.trim() : front.trim();
    if (!sourceText) return;
    setTranslating(true);
    try {
      const result = await generateTermTranslation({
        sourceText,
        targetLanguage: params.targetLanguage,
        sourceLanguage: params.sourceLanguage ?? null,
      });
      if (params.side === 'front') setFront(result.translation);
      else setBack(result.translation);
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  }

  function confirmTranslate(params: {
    side: 'front' | 'back';
    targetLanguage: string;
    sourceLanguage?: string | null;
  }) {
    const missingLabel = params.side === 'front' ? 'front' : 'back';
    const targetLabel = formatLangLabel(params.targetLanguage);
    Alert.alert(
      'Auto-translate?',
      `We'll translate the other side into ${targetLabel} and fill the ${missingLabel}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Translate', onPress: () => runTranslate(params) },
      ],
    );
  }

  function handleTranslate(side: 'front' | 'back') {
    if (!canTranslate) return;
    const sourceText = side === 'front' ? back.trim() : front.trim();
    if (!sourceText) return;
    if (deckLanguages?.front_language && deckLanguages?.back_language) {
      const targetLanguage =
        side === 'front' ? deckLanguages.front_language : deckLanguages.back_language;
      const sourceLanguage =
        side === 'front' ? deckLanguages.back_language : deckLanguages.front_language;
      confirmTranslate({ side, targetLanguage, sourceLanguage });
      return;
    }
    setPendingTranslateSide(side);
    setTranslatePickerOpen(true);
  }

  const renderTranslateIcon = (side: 'front' | 'back') =>
    translating ? (
      <ActivityIndicator size="small" color={accentProgress} />
    ) : (
      <Pressable
        onPress={() => handleTranslate(side)}
        disabled={!canTranslate}
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: !canTranslate ? 0.35 : pressed ? 0.6 : 1,
        })}
      >
        <Ionicons
          name="sparkles-outline"
          size={18}
          color={canTranslate ? theme.colors.text : theme.colors.textMuted}
        />
      </Pressable>
    );

  function closeTranslatePicker() {
    setTranslatePickerOpen(false);
    setPendingTranslateSide(null);
  }

  async function del() {
    if (!props.cardId) return;
    Alert.alert('Delete card?', 'This will remove the card from the deck.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cardsRepo.softDeleteCard(props.cardId!);
          router.back();
        },
      },
    ]);
  }

  function reverseFields() {
    setFront(back);
    setBack(front);
    setexampleFront(exampleBack);
    setexampleBack(exampleFront);
  }

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: props.mode === 'create' ? 'New Card' : 'Edit Card',
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (!isDirty) {
                  router.back();
                  return;
                }
                Alert.alert('Discard changes?', 'You have unsaved changes.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Discard', style: 'destructive', onPress: () => router.back() },
                ]);
              }}
              hitSlop={10}
              style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={save}
              disabled={!canSave}
              hitSlop={10}
              style={({ pressed }) => [
                styles.headerSaveButton,
                { opacity: !canSave ? 0.4 : pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.headerSaveText, { color: canSave ? '#FFFFFF' : theme.colors.textMuted }]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          ),
        }}
      />

      <Animated.ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.lg + insets.bottom }}
      >
        <Animated.View style={styles.content}>
          <Input
            label="Front"
            value={front}
            onChangeText={setFront}
            placeholder="Prompt"
            right={showTranslateForFront ? renderTranslateIcon('front') : undefined}
            editable={!isBusy}
          />
          <Input
            label="Back"
            value={back}
            onChangeText={setBack}
            placeholder="Answer"
            right={showTranslateForBack ? renderTranslateIcon('back') : undefined}
            editable={!isBusy}
          />
          <View style={{ gap: 8, marginTop: 6 }}>
            <Text variant="label" style={styles.optionalLabel}>
              Optional
            </Text>
            <Surface
              radius={18}
              tone="muted"
              border={false}
              style={styles.optionalSurface}
            >
              <Input
                label="Example front"
                value={exampleFront}
                onChangeText={(v) => {
                  setexampleFront(v);
                  if (!exampleSource) setExampleSource('user');
                }}
                placeholder="Example on the front side"
                editable={!isBusy}
                multiline
                style={[{ minHeight: 70, textAlignVertical: 'top' }, optionalInputStyle]}
              />
              <Input
                label="Example back"
                value={exampleBack}
                onChangeText={(v) => {
                  setexampleBack(v);
                  if (!exampleSource) setExampleSource('user');
                }}
                placeholder="Example on the back side"
                editable={!isBusy}
                multiline
                style={[{ minHeight: 70, textAlignVertical: 'top' }, optionalInputStyle]}
              />
              <Input
                label="Note"
                value={exampleNote}
                onChangeText={(v) => {
                  setExampleNote(v);
                  if (!exampleSource) setExampleSource('user');
                }}
                placeholder="Pitfall / regional note"
                editable={!isBusy}
                multiline
                style={[{ minHeight: 60, textAlignVertical: 'top' }, optionalInputStyle]}
              />

              <View style={{ gap: 10 }}>
                {generating ? (
                  <View style={{ gap: 10 }}>
                    <Text variant="muted">Generating content…</Text>
                    <View style={styles.progressTrack}>
                      <View
                        style={styles.progressTrackInner}
                        onLayout={(e) => {
                          progressTrackW.value = e.nativeEvent.layout.width;
                        }}
                      >
                        <Animated.View
                          style={[
                            styles.progressThumb,
                            { backgroundColor: accentProgress },
                            progressThumbStyle,
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <Button
                    title={hasExampleContent ? 'Regenerate content' : 'Generate content'}
                    variant="secondary"
                    left={<Ionicons name="sparkles-outline" size={18} color={theme.colors.text} />}
                    onPress={generate}
                    disabled={!ai.enabled || !aiKeyPresent || !canGenerate || isBusy}
                  />
                )}
                {genError ? (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.errorText}>{genError}</Text>
                    <Pressable
                      onPress={() => router.push('/settings/ai-debug')}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      hitSlop={8}
                    >
                      <Text variant="muted" style={styles.debugLink}>
                        View AI debug logs
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {!ai.enabled ? (
                  <Text
                    style={styles.helpText}
                    onPress={() => router.push('/settings/ai')}
                  >
                    AI Assist is off. Enable it in Settings.
                  </Text>
                ) : !aiKeyPresent ? (
                  <Text
                    style={styles.helpText}
                    onPress={() => router.push('/settings/ai')}
                  >
                    Add an API key in Settings to enable generation.
                  </Text>
                ) : null}
              </View>
            </Surface>
          </View>
          {card && !keyboardVisible ? (
            <View style={styles.scheduling}>
              <Text variant="label">Scheduling</Text>
              <View style={styles.stateRow}>
                <Text variant="muted">State:</Text>
                <Pill label={cardStateLabel(card.state)} tone={cardStateTone(card.state)} />
              </View>
              <StatRow label="Due">{formatShortDateTime(card.dueAt)}</StatRow>
              <StatRow label="Interval">{card.intervalDays} days</StatRow>
              <StatRow label="Ease">{card.ease.toFixed(2)}</StatRow>
              <StatRow label="Reps">{card.reps}</StatRow>
              <StatRow label="Lapses">{card.lapses}</StatRow>
            </View>
          ) : null}

          <View style={{ marginTop: 10 }}>
            <Button
              title="Flip card"
              variant="secondary"
              onPress={reverseFields}
              disabled={generating || translating}
            />
          </View>

          {props.mode === 'edit' && !keyboardVisible ? (
            <View style={{ marginTop: 6 }}>
              <Button title="Delete" variant="dangerGhost" onPress={del} />
            </View>
          ) : null}

        </Animated.View>
      </Animated.ScrollView>
      <Animated.View style={keyboardAvoiderStyle} />

      <TranslateTermModal
        visible={translatePickerOpen}
        pendingSide={pendingTranslateSide}
        selectedCode={translateTargetCode}
        languageOptions={EXTRA_LANGUAGES}
        onChangeCode={setTranslateTargetCode}
        onClose={closeTranslatePicker}
        onTranslate={() => {
          if (!pendingTranslateSide) {
            closeTranslatePicker();
            return;
          }
          const option = getLanguageOption(translateTargetCode);
          const targetLanguage = option ? `${option.label} (${option.code})` : translateTargetCode;
          closeTranslatePicker();
          runTranslate({ side: pendingTranslateSide, targetLanguage, sourceLanguage: null });
        }}
      />
    </Screen>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    headerButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    headerSaveButton: {
      paddingHorizontal: 6,
      paddingVertical: 4,
    },
    headerSaveText: {
      fontWeight: '700',
    },
    content: {
      gap: 14,
    },
    optionalLabel: {
      color: theme.colors.textMuted,
      opacity: 0.7,
    },
    optionalSurface: {
      gap: 12,
      paddingVertical: 16,
      paddingHorizontal: theme.spacing.lg,
      marginHorizontal: -theme.spacing.lg,
    },
    optionalInput: {
      backgroundColor: theme.colors.surface,
    },
    progressTrack: {
      borderRadius: 999,
      backgroundColor: theme.colors.border,
      padding: 1,
    },
    progressTrackInner: {
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.surface2,
      overflow: 'hidden',
    },
    progressThumb: {
      height: '100%',
      borderRadius: 999,
    },
    errorText: {
      color: theme.colors.danger,
      fontWeight: '700',
    },
    debugLink: {
      textDecorationLine: 'underline',
    },
    helpText: {
      color: theme.colors.textMuted,
      fontWeight: '700',
    },
    scheduling: {
      marginTop: 10,
      gap: 6,
    },
    stateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
  });
}

function createStatStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    statLabel: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    statValue: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
  });
}

function StatRow(props: { label: string; children: React.ReactNode }) {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStatStyles(theme), [theme]);
  return (
    <View style={styles.statRow}>
      <Text variant="muted" style={styles.statLabel}>
        {props.label}:
      </Text>
      <Text style={styles.statValue}>
        {props.children}
      </Text>
    </View>
  );
}
