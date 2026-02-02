import { Stack, router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import { getAiApiKey } from '@/data/secureStore';
import { getExampleLevel } from '@/data/repositories/deckPrefsRepo';
import type { Card, ExampleSource } from '@/domain/models';
import type { AiExampleLevel } from '@/domain/prefs';
import { generateExamplePair } from '@/services/examplePairService';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { LevelPicker } from '@/ui/components/LevelPicker';
import { Pill } from '@/ui/components/Pill';
import { cardStateLabel, cardStateTone } from '@/ui/components/cardStatePill';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useKeyboardVisible } from '@/ui/hooks/useKeyboardVisible';
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
  const [exampleLevel, setExampleLevel] = useState<AiExampleLevel>(ai.level);
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
      const level = await getExampleLevel(props.deckId);
      if (level) setExampleLevel(level);
      else setExampleLevel(ai.level);
    })();
  }, [props.deckId, ai.level]);

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
        levelOverride: exampleLevel,
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
    Alert.alert(
      'Generate content?',
      'This will overwrite the current examples and note for this card.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate', onPress: generateConfirmed },
      ],
    );
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

  return (
    // With a native Stack header, avoid top safe-area padding (it creates a "blank band" below the header).
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: props.mode === 'create' ? 'New Card' : 'Edit Card' }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: 40 }}
        >
          <View style={{ gap: 14 }}>
            <Input label="Front" value={front} onChangeText={setFront} placeholder="Prompt..." />
            <Input label="Back" value={back} onChangeText={setBack} placeholder="Answer..." />
            <View style={{ gap: 10 }}>
              <View style={{ gap: 6 }}>
                <Text variant="label">Example level</Text>
                <LevelPicker value={exampleLevel} onChange={setExampleLevel} />
              </View>
              <Button
                title={generating ? 'Generating...' : 'Generate content'}
                variant="secondary"
                onPress={generate}
                disabled={generating || !ai.enabled || !aiKeyPresent}
              />
              {generating ? (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color={t.colors.textMuted} />
                    <Text variant="muted">Generating content…</Text>
                  </View>
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
                            backgroundColor: t.colors.primary2,
                          },
                          progressThumbStyle,
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ) : genError ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: t.colors.danger, fontWeight: '700' }}>{genError}</Text>
                  <Pressable
                    onPress={() => router.push('/settings/ai-debug')}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    hitSlop={8}
                  >
                    <Text variant="muted" style={{ textDecorationLine: 'underline' }}>
                      View AI debug logs
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Text variant="muted">
                  Generates example front/back using detected deck languages.
                </Text>
              )}
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

            <Input
              label="Example front"
              value={exampleL1}
              onChangeText={(v) => {
                setExampleL1(v);
                if (!exampleSource) setExampleSource('user');
              }}
              placeholder="Optional example shown on the front side..."
              multiline
              style={{ minHeight: 70, textAlignVertical: 'top' }}
            />
            <Input
              label="Example back"
              value={exampleL2}
              onChangeText={(v) => {
                setExampleL2(v);
                if (!exampleSource) setExampleSource('user');
              }}
              placeholder="Optional example shown on the back side..."
              multiline
              style={{ minHeight: 70, textAlignVertical: 'top' }}
            />
            <Input
              label="Note (optional)"
              value={exampleNote}
              onChangeText={(v) => {
                setExampleNote(v);
                if (!exampleSource) setExampleSource('user');
              }}
              placeholder="Optional pitfall / regional note..."
              multiline
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />

            <View style={{ height: 2 }} />

            <View style={{ gap: 10 }}>
              <Button title={saving ? 'Saving...' : 'Save'} onPress={save} disabled={!canSave} />
              {props.mode === 'edit' && !keyboardVisible ? (
                <Button title="Delete" variant="dangerGhost" onPress={del} />
              ) : null}
            </View>

            {card && !keyboardVisible ? (
              <View
                style={{
                  marginTop: 10,
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: t.colors.surface2,
                }}
              >
                <Text variant="label">Scheduling</Text>
                <View style={{ height: 8 }} />
                <View style={{ gap: 6 }}>
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
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
