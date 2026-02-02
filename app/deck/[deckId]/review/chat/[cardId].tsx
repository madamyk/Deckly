import Ionicons from '@expo/vector-icons/Ionicons';
import { useHeaderHeight } from '@react-navigation/elements';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ActionSheetIOS,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import * as decksRepo from '@/data/repositories/decksRepo';
import { getAiApiKey } from '@/data/secureStore';
import { getSecondaryLanguage } from '@/data/repositories/deckPrefsRepo';
import { AI_MODELS, getAiModelLabel } from '@/domain/aiModels';
import { getLanguageOption } from '@/domain/languages';
import type { Card } from '@/domain/models';
import { sendCardChatMessage, type ChatHistoryItem } from '@/services/cardChatService';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { useDecklyTheme } from '@/ui/theme/provider';

const BASE_QUESTIONS = [
  'Give me 3 more examples.',
  'Does it have different meanings?',
  'Is it formal or informal?',
  'Explain the grammar.',
];

const GRAMMAR_INSTRUCTION =
  'If this is a verb, include its key conjugation pattern or base forms. Format each form on its own line (use newline-separated lines). Otherwise decide the most helpful grammar guidance.';

export default function CardChatScreen() {
  const t = useDecklyTheme();
  const { deckId, cardId } = useLocalSearchParams<{ deckId: string; cardId: string }>();
  const headerHeight = useHeaderHeight();
  const { prefs, patchPrefs } = usePrefsStore();

  const [card, setCard] = useState<Card | null>(null);
  const [loadingCard, setLoadingCard] = useState(true);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [messages, setMessages] = useState<ChatHistoryItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [secondaryLangCode, setSecondaryLangCode] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  const aiReady = prefs.ai.enabled && apiKeySaved;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const c = await cardsRepo.getCard(cardId);
        if (mounted) setCard(c);
        const d = await decksRepo.getDeck(deckId);
        if (mounted) setAccent(resolveDeckAccentColor(d?.accentColor) ?? null);
        const secondary = await getSecondaryLanguage(deckId);
        if (mounted) setSecondaryLangCode(secondary);
      } finally {
        if (mounted) setLoadingCard(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [cardId, deckId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const key = await getAiApiKey();
      if (mounted) setApiKeySaved(!!key);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, sending]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const placeholder = useMemo(() => {
    if (!aiReady) return 'Enable AI Assist to start chatting...';
    return 'Ask anything';
  }, [aiReady]);
  const accentColor = accent ?? t.colors.primary;
  const modelLabel = useMemo(() => getAiModelLabel(prefs.ai.model), [prefs.ai.model]);
  const secondaryOption = useMemo(() => getLanguageOption(secondaryLangCode), [secondaryLangCode]);

  const quickQuestions = useMemo(() => {
    const items: { label: string; instruction?: string }[] = BASE_QUESTIONS.map((q) => ({
      label: q,
      instruction: q === 'Explain the grammar.' ? GRAMMAR_INSTRUCTION : undefined,
    }));
    if (secondaryOption) {
      items.push({
        label: `Explain in ${secondaryOption.emoji}`,
        instruction: [
          `For this reply only, answer in ${secondaryOption.label}.`,
          `Translate the back-language term directly into ${secondaryOption.label}.`,
          `Explain the meaning and usage in ${secondaryOption.label}.`,
          `Prefer translating directly from the back language rather than from the front language.`,
        ].join(' '),
      });
    }
    return items;
  }, [secondaryOption]);

  const headerRight = () => (
    <Pressable
      onPress={() => {
        if (Platform.OS === 'ios') {
          const options = [...AI_MODELS.map((m) => m.label), 'Cancel'];
          const cancelButtonIndex = options.length - 1;
          const selectedIndex = AI_MODELS.findIndex((m) => m.value === prefs.ai.model);
          ActionSheetIOS.showActionSheetWithOptions(
            {
              options,
              cancelButtonIndex,
              title: 'Select model',
              message: `Current: ${modelLabel}`,
              destructiveButtonIndex: undefined,
              // highlight current model
              disabledButtonIndices:
                selectedIndex >= 0 ? [selectedIndex] : undefined,
            },
            (buttonIndex) => {
              if (buttonIndex === cancelButtonIndex) return;
              const next = AI_MODELS[buttonIndex];
              if (next?.value) {
                patchPrefs({ ai: { model: next.value } });
              }
            },
          );
        } else {
          setModelPickerOpen(true);
        }
      }}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingHorizontal: 8, paddingVertical: 6 })}
    >
      <Ionicons name="options-outline" size={20} color={t.colors.textMuted} />
    </Pressable>
  );

  async function handleSend(questionRaw: string, extraSystemInstruction?: string) {
    const question = questionRaw.trim();
    if (!question || sending || !card) return;
    setError(null);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = messages.slice(-6);
      const reply = await sendCardChatMessage({
        deckId,
        card,
        question,
        history,
        extraSystemInstruction,
        signal: controller.signal,
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (e: any) {
      if (controller.signal.aborted) return;
      setError(e?.message ?? 'Failed to get a response.');
    } finally {
      setSending(false);
    }
  }

  if (loadingCard) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Ask the teacher' }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={t.colors.textMuted} />
        </View>
      </Screen>
    );
  }

  if (!card) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Ask the teacher' }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
          <Text variant="h2">Card not found</Text>
          <Button title="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Explain more', headerRight }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: 20, flexGrow: 1 }}
        >
          <View style={{ flex: 1, gap: 12 }}>
            {messages.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  paddingVertical: t.spacing.xl,
                }}
              >
                <View
                  style={{
                    padding: 22,
                    borderRadius: 18,
                    backgroundColor: t.colors.surface2,
                    width: '100%',
                    marginHorizontal: t.spacing.sm,
                  }}
                >
                  <Text variant="label" style={{ color: t.colors.textMuted, textAlign: 'center' }}>
                    Front
                  </Text>
                  <Text style={{ fontWeight: '800', textAlign: 'center' }}>{card.front}</Text>
                  <View style={{ height: 14 }} />
                  <Text variant="label" style={{ color: t.colors.textMuted, textAlign: 'center' }}>
                    Back
                  </Text>
                  <Text style={{ fontWeight: '800', textAlign: 'center' }}>{card.back}</Text>
                </View>

                <View style={{ alignItems: 'center', width: '100%', gap: 10 }}>
                  <Text variant="label" style={{ color: t.colors.textMuted, textAlign: 'center' }}>
                    Quick questions
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                      justifyContent: 'center',
                      width: '100%',
                    }}
                  >
                    {quickQuestions.map((q, idx) => {
                      const delayMs = 140 + idx * 120;
                      return (
                      <AnimatedPill key={q.label} delayMs={delayMs}>
                        <Pressable
                          onPress={() => handleSend(q.label, q.instruction)}
                          disabled={!aiReady || sending}
                          style={({ pressed }) => ({
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: t.colors.surface2,
                            borderWidth: 1,
                            borderColor: t.colors.border,
                            opacity: !aiReady ? 0.45 : pressed ? 0.8 : 1,
                          })}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: t.colors.text }}>
                            {q.label}
                          </Text>
                        </Pressable>
                      </AnimatedPill>
                      );
                    })}
                  </View>
                </View>

                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    textAlign: 'center',
                    color: t.colors.textMuted,
                  }}
                >
                  Ask anything about meaning, usage, or translation.
                </Text>
              </View>
            ) : (
              <View
                style={{
                  padding: 22,
                  borderRadius: 18,
                  backgroundColor: t.colors.surface2,
                  marginHorizontal: t.spacing.sm,
                }}
              >
                <Text variant="label" style={{ color: t.colors.textMuted, textAlign: 'center' }}>
                  Front
                </Text>
                <Text style={{ fontWeight: '800', textAlign: 'center' }}>{card.front}</Text>
                <View style={{ height: 14 }} />
                <Text variant="label" style={{ color: t.colors.textMuted, textAlign: 'center' }}>
                  Back
                </Text>
                <Text style={{ fontWeight: '800', textAlign: 'center' }}>{card.back}</Text>
              </View>
            )}

            {!aiReady ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: t.colors.textMuted, fontWeight: '700' }}>
                  AI Assist is off or missing an API key.
                </Text>
                <Button title="Open AI settings" variant="secondary" onPress={() => router.push('/settings/ai')} />
              </View>
            ) : null}


            <View style={{ gap: 10 }}>
              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <View
                    key={`${m.role}-${idx}`}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '86%',
                      padding: 12,
                      borderRadius: 16,
                      backgroundColor: isUser ? accentColor : t.colors.surface2,
                    }}
                  >
                    <Text
                      style={{
                        color: isUser ? '#FFFFFF' : t.colors.text,
                        fontWeight: '400',
                        fontSize: 14,
                        lineHeight: 20,
                      }}
                    >
                      {m.text}
                    </Text>
                  </View>
                );
              })}

              {sending ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '86%',
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: t.colors.surface2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <ActivityIndicator color={t.colors.textMuted} />
                  <Text variant="muted">Thinking…</Text>
                </View>
              ) : null}

              {error ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: t.colors.danger, fontWeight: '700' }}>{error}</Text>
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
              ) : null}
            </View>
          </View>
        </ScrollView>

        <View style={{ padding: t.spacing.lg, paddingTop: 8 }}>
          <Row gap={10} align="center">
            <View style={{ flex: 1 }}>
              <Input
                value={input}
                onChangeText={setInput}
                placeholder={placeholder}
                editable={aiReady && !sending}
                multiline
                placeholderLines={1}
                style={{ minHeight: 52, textAlignVertical: 'top' }}
              />
            </View>
            <Pressable
              onPress={() => handleSend(input)}
              disabled={!aiReady || sending || !input.trim()}
              style={({ pressed }) => ({
                height: 44,
                width: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: accentColor,
                opacity: !aiReady || sending || !input.trim() ? 0.4 : pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </Row>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={modelPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModelPickerOpen(false)}
      >
        <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
          <Pressable
            onPress={() => setModelPickerOpen(false)}
            style={{
              ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
          />
          <View
            style={{
              backgroundColor: t.colors.surface,
              borderRadius: 18,
              padding: 16,
              gap: 10,
            }}
          >
            <Row>
              <Text variant="h2">Select model</Text>
              <Pressable onPress={() => setModelPickerOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={t.colors.textMuted} />
              </Pressable>
            </Row>
            {AI_MODELS.map((m) => {
              const selected = m.value === prefs.ai.model;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => {
                    patchPrefs({ ai: { model: m.value } });
                    setModelPickerOpen(false);
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    opacity: pressed ? 0.7 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  })}
                >
                  <Text style={{ fontWeight: selected ? '800' : '600' }}>{m.label}</Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={18} color={t.colors.primary2} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function AnimatedPill({ delayMs, children }: { delayMs: number; children: React.ReactNode }) {
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delayMs,
      withSpring(1, {
        damping: 10,
        stiffness: 140,
        mass: 0.7,
      }),
    );
    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }),
    );
  }, [delayMs, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
