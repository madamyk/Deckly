import { useHeaderHeight } from '@react-navigation/elements';
import { Stack, router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

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
import { useKeyboardVisible } from '@/ui/hooks/useKeyboardVisible';
import { resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { useDecklyTheme } from '@/ui/theme/provider';
import { formatShortDateTime, nowMs } from '@/utils/time';

export function CardEditorScreen(props: {
  mode: 'create' | 'edit';
  deckId: string;
  cardId?: string;
}) {
  const t = useDecklyTheme();
  const ai = usePrefsStore((s) => s.prefs.ai);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const [card, setCard] = useState<Card | null>(null);
  const [initialFront, setInitialFront] = useState('');
  const [initialBack, setInitialBack] = useState('');
  const [initialExampleL1, setInitialExampleL1] = useState('');
  const [initialExampleL2, setInitialExampleL2] = useState('');
  const [initialExampleNote, setInitialExampleNote] = useState('');
  const [initialExampleSource, setInitialExampleSource] = useState<ExampleSource | null>(null);
  const [initialExampleGeneratedAt, setInitialExampleGeneratedAt] = useState<number | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [exampleL1, setExampleL1] = useState('');
  const [exampleL2, setExampleL2] = useState('');
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
    const w = progressTrackW.value;
    const seg = Math.max(24, w * 0.35);
    const x = (w + seg) * progressT.value - seg;
    return {
      width: seg,
      transform: [{ translateX: x }],
    };
  });

  const load = useCallback(async () => {
    if (props.mode !== 'edit' || !props.cardId) return;
    const c = await cardsRepo.getCard(props.cardId);
    setCard(c);
    const f = c?.front ?? '';
    const b = c?.back ?? '';
    const e1 = c?.exampleL1 ?? '';
    const e2 = c?.exampleL2 ?? '';
    const en = c?.exampleNote ?? '';
    setInitialFront(f);
    setInitialBack(b);
    setInitialExampleL1(e1);
    setInitialExampleL2(e2);
    setInitialExampleNote(en);
    setInitialExampleSource(c?.exampleSource ?? null);
    setInitialExampleGeneratedAt(c?.exampleGeneratedAt ?? null);
    setFront(f);
    setBack(b);
    setExampleL1(e1);
    setExampleL2(e2);
    setExampleNote(en);
    setExampleSource(c?.exampleSource ?? null);
    setExampleGeneratedAt(c?.exampleGeneratedAt ?? null);
  }, [props.mode, props.cardId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const d = await getDeck(props.deckId);
      setAccentColor(resolveDeckAccentColor(d?.accentColor) ?? null);
      const langs = await deckAiRepo.getDeckLanguages(props.deckId);
      setDeckLanguages(langs);
    })();
  }, [props.deckId]);

  useEffect(() => {
    (async () => {
      const k = await getAiApiKey();
      setAiKeyPresent(!!k);
    })();
  }, []);

  const isDirty =
    props.mode === 'create'
      ? front.length > 0 || back.length > 0 || exampleL1.length > 0 || exampleL2.length > 0 || exampleNote.length > 0
      : front !== initialFront ||
      back !== initialBack ||
      exampleL1 !== initialExampleL1 ||
      exampleL2 !== initialExampleL2 ||
      exampleNote !== initialExampleNote ||
      exampleSource !== initialExampleSource ||
      exampleGeneratedAt !== initialExampleGeneratedAt;
  const canSave = !saving && isDirty && front.trim().length > 0 && back.trim().length > 0;
  const hasExampleContent = !!(exampleL1.trim() || exampleL2.trim() || exampleNote.trim());
  const canGenerate = front.trim().length > 0 && back.trim().length > 0;
  const optionalInputStyle = { backgroundColor: t.colors.surface };
  const accentProgress = accentColor ?? t.colors.primary2;
  const isBusy = generating || translating;
  const frontEmpty = front.trim().length === 0;
  const backEmpty = back.trim().length === 0;
  const showTranslateForFront = back.trim().length > 0 && frontEmpty;
  const showTranslateForBack = front.trim().length > 0 && backEmpty;
  const canTranslate = ai.enabled && aiKeyPresent && !isBusy;

  async function save() {
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) {
      Alert.alert('Deckly', 'Front and Back are required.');
      return;
    }
    setSaving(true);
    try {
      const e1 = exampleL1.trim() ? exampleL1.trim() : null;
      const e2 = exampleL2.trim() ? exampleL2.trim() : null;
      const en = exampleNote.trim() ? exampleNote.trim() : null;
      const hasAnyExample = !!(e1 || e2 || en);
      const source: ExampleSource | null = hasAnyExample ? (exampleSource ?? 'user') : null;
      const generatedAt = source === 'ai' ? exampleGeneratedAt ?? nowMs() : null;

      if (props.mode === 'create') {
        await cardsRepo.createCard({
          deckId: props.deckId,
          front: f,
          back: b,
          exampleL1: e1,
          exampleL2: e2,
          exampleNote: en,
          exampleSource: source,
          exampleGeneratedAt: generatedAt,
        });
        router.back();
      } else {
        if (!props.cardId) return;
        await cardsRepo.updateCard(props.cardId, {
          front: f,
          back: b,
          exampleL1: e1,
          exampleL2: e2,
          exampleNote: en,
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
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) {
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
        frontText: f,
        backText: b,
      });
      setExampleL1(patch.exampleL1 ?? '');
      setExampleL2(patch.exampleL2 ?? '');
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
        props.mode === 'edit' ? 'Regenerate content?' : 'Generate content?',
        'This will overwrite the current examples and note for this card.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: props.mode === 'edit' ? 'Regenerate' : 'Generate', onPress: generateConfirmed },
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
          color={canTranslate ? t.colors.text : t.colors.textMuted}
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
    setExampleL1(exampleL2);
    setExampleL2(exampleL1);
  }

  return (
    // With a native Stack header, avoid top safe-area padding (it creates a "blank band" below the header).
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
              style={({ pressed }) => ({
                paddingHorizontal: 8,
                paddingVertical: 6,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={22} color={t.colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={save}
              disabled={!canSave}
              hitSlop={10}
              style={({ pressed }) => ({
                paddingHorizontal: 6,
                paddingVertical: 4,
                opacity: !canSave ? 0.4 : pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: canSave ? '#FFFFFF' : t.colors.textMuted, fontWeight: '700' }}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: t.spacing.lg + insets.bottom }}
        >
          <View style={{ gap: 14 }}>
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
              <Text variant="label" style={{ color: t.colors.textMuted, opacity: 0.7 }}>
                Optional
              </Text>
              <Surface
                radius={18}
                tone="muted"
                border={false}
                style={{
                  gap: 12,
                  paddingVertical: 16,
                  paddingHorizontal: t.spacing.lg,
                  marginHorizontal: -t.spacing.lg,
                }}
              >
              <Input
                label="Example front"
                value={exampleL1}
                onChangeText={(v) => {
                  setExampleL1(v);
                  if (!exampleSource) setExampleSource('user');
                }}
                placeholder="Example on the front side"
              editable={!isBusy}
                multiline
                style={[{ minHeight: 70, textAlignVertical: 'top' }, optionalInputStyle]}
              />
              <Input
                label="Example back"
                value={exampleL2}
                onChangeText={(v) => {
                  setExampleL2(v);
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
                editable={!generating}
                multiline
                style={[{ minHeight: 60, textAlignVertical: 'top' }, optionalInputStyle]}
              />

              <View style={{ gap: 10 }}>
                {generating ? (
                  <View style={{ gap: 10 }}>
                    <Text variant="muted">Generating content…</Text>
                    <View style={{ borderRadius: 999, backgroundColor: t.colors.border, padding: 1 }}>
                      <View
                        style={{
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: t.colors.surface2,
                          overflow: 'hidden',
                        }}
                        onLayout={(e) => {
                          progressTrackW.value = e.nativeEvent.layout.width;
                        }}
                      >
                        <Animated.View
                          style={[
                            {
                              height: '100%',
                              borderRadius: 999,
                              backgroundColor: accentProgress,
                            },
                            progressThumbStyle,
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <Button
                    title={props.mode === 'edit' && hasExampleContent ? 'Regenerate content' : 'Generate content'}
                    variant="secondary"
                    left={<Ionicons name="sparkles-outline" size={18} color={t.colors.text} />}
                    onPress={generate}
                    disabled={!ai.enabled || !aiKeyPresent || !canGenerate || isBusy}
                  />
                )}
                {genError ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: t.colors.danger, fontWeight: '700' }}>{genError}</Text>
                    <Pressable
                      onPress={() => router.push('/settings/ai-debug')}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      hitSlop={8}
                    >
                      <Text variant="muted" style={{ textDecorationLine: 'underline', }}>
                        View AI debug logs
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {!ai.enabled ? (
                  <Text
                    style={{ color: t.colors.textMuted, fontWeight: '700' }}
                    onPress={() => router.push('/settings/ai')}
                  >
                    AI Assist is off. Enable it in Settings.
                  </Text>
                ) : !aiKeyPresent ? (
                  <Text
                    style={{ color: t.colors.textMuted, fontWeight: '700' }}
                    onPress={() => router.push('/settings/ai')}
                  >
                    Add an API key in Settings to enable generation.
                  </Text>
                ) : null}
              </View>
            </Surface>
            </View>

            {card && !keyboardVisible ? (
              <View
                style={{
                  marginTop: 10,
                  gap: 6,
                }}
              >
                <Text variant="label">Scheduling</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
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
              <Button title="Flip card" variant="secondary" onPress={reverseFields} />
            </View>

            {props.mode === 'edit' && !keyboardVisible ? (
              <View style={{ marginTop: 6 }}>
                <Button title="Delete" variant="dangerGhost" onPress={del} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={translatePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={closeTranslatePicker}
      >
        <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
          <Pressable
            onPress={closeTranslatePicker}
            style={{
              ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          />
          <Surface radius={22} style={{ gap: 12, padding: 16 }}>
            <Text variant="h2">Translate into</Text>
            <Text variant="muted">
              {pendingTranslateSide
                ? `We'll translate the ${pendingTranslateSide === 'front' ? 'back' : 'front'} into the selected language and fill the ${pendingTranslateSide}.`
                : `We'll translate the other side into the selected language and fill the empty field.`}
            </Text>
            <Picker
              selectedValue={translateTargetCode}
              onValueChange={(v) => setTranslateTargetCode(String(v))}
            >
              {EXTRA_LANGUAGES.map((lang) => (
                <Picker.Item
                  key={lang.code}
                  label={`${lang.emoji} ${lang.label}`}
                  value={lang.code}
                />
              ))}
            </Picker>
            <View style={{ gap: 10 }}>
              <Button
                title="Translate"
                onPress={() => {
                  if (!pendingTranslateSide) {
                    closeTranslatePicker();
                    return;
                  }
                  const opt = getLanguageOption(translateTargetCode);
                  const targetLanguage = opt ? `${opt.label} (${opt.code})` : translateTargetCode;
                  closeTranslatePicker();
                  runTranslate({ side: pendingTranslateSide, targetLanguage, sourceLanguage: null });
                }}
                disabled={!pendingTranslateSide}
              />
              <Button title="Cancel" variant="secondary" onPress={closeTranslatePicker} />
            </View>
          </Surface>
        </View>
      </Modal>
    </Screen>
  );
}

function StatRow(props: { label: string; children: React.ReactNode }) {
  const t = useDecklyTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <Text variant="muted" style={{ fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
        {props.label}:
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '700', color: t.colors.text }}>
        {props.children}
      </Text>
    </View>
  );
}
