import Ionicons from '@expo/vector-icons/Ionicons';
import { useHeaderHeight } from '@react-navigation/elements';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { AI_MODELS } from '@/domain/aiModels';
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
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { deckId, cardId } = useLocalSearchParams<{ deckId: string; cardId: string }>();
  const headerHeight = useHeaderHeight();
  const { prefs } = usePrefsStore();

  const [card, setCard] = useState<Card | null>(null);
  const [loadingCard, setLoadingCard] = useState(true);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [messages, setMessages] = useState<ChatHistoryItem[]>([]);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [secondaryLangCode, setSecondaryLangCode] = useState<string | null>(null);
  const [chatModel, setChatModel] = useState(() => prefs.ai.model);
  const [chatReasoning, setChatReasoning] = useState(() => prefs.ai.reasoningEffort);

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
  const accentColor = accent ?? theme.colors.primary;
  const reasoningLabel =
    chatReasoning === 'high' ? 'High' : chatReasoning === 'medium' ? 'Medium' : 'Low (default)';
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
      onPress={() => setChatSettingsOpen(true)}
      hitSlop={10}
      style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name="options-outline" size={20} color={theme.colors.textMuted} />
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
        modelOverride: chatModel,
        reasoningEffortOverride: chatReasoning,
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
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.textMuted} />
        </View>
      </Screen>
    );
  }

  if (!card) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Ask the teacher' }} />
        <View style={styles.centeredWithGap}>
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
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.content}>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.cardSummary}>
                  <Text variant="label" style={styles.cardLabel}>
                    Front
                  </Text>
                  <Text style={styles.cardValue}>{card.front}</Text>
                  <View style={styles.cardDivider} />
                  <Text variant="label" style={styles.cardLabel}>
                    Back
                  </Text>
                  <Text style={styles.cardValue}>{card.back}</Text>
                </View>

                <Text style={styles.emptyHint}>
                  Ask anything about meaning, usage, or translation.
                </Text>

                <View style={styles.quickQuestions}>
                  {!inputFocused ? (
                    <>
                      <Text variant="label" style={styles.cardLabel}>
                        Quick questions
                      </Text>
                      <View style={styles.quickQuestionsRow}>
                        {quickQuestions.map((q, idx) => {
                          const delayMs = 140 + idx * 120;
                          return (
                            <AnimatedPill key={q.label} delayMs={delayMs}>
                              <Pressable
                                onPress={() => handleSend(q.label, q.instruction)}
                                disabled={!aiReady || sending}
                                style={({ pressed }) => [
                                  styles.quickQuestionButton,
                                  { opacity: !aiReady ? 0.45 : pressed ? 0.8 : 1 },
                                ]}
                              >
                                <Text style={styles.quickQuestionText}>
                                  {q.label}
                                </Text>
                              </Pressable>
                            </AnimatedPill>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={styles.cardSummary}>
                <Text variant="label" style={styles.cardLabel}>
                  Front
                </Text>
                <Text style={styles.cardValue}>{card.front}</Text>
                <View style={styles.cardDivider} />
                <Text variant="label" style={styles.cardLabel}>
                  Back
                </Text>
                <Text style={styles.cardValue}>{card.back}</Text>
              </View>
            )}

            {!aiReady ? (
              <View style={styles.aiWarning}>
                <Text style={styles.aiWarningText}>
                  AI Assist is off or missing an API key.
                </Text>
                <Button title="Open AI settings" variant="secondary" onPress={() => router.push('/settings/ai')} />
              </View>
            ) : null}

            <View style={styles.messageList}>
              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <View
                    key={`${m.role}-${idx}`}
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.assistantBubble,
                      { backgroundColor: isUser ? accentColor : theme.colors.surface2 },
                    ]}
                  >
                    <Text
                      style={isUser ? styles.userMessageText : styles.assistantMessageText}
                    >
                      {m.text}
                    </Text>
                  </View>
                );
              })}

              {sending ? (
                <View style={styles.sendingBubble}>
                  <ActivityIndicator color={theme.colors.textMuted} />
                  <Text variant="muted">Thinking…</Text>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorWrap}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable
                    onPress={() => router.push('/settings/ai-debug')}
                    style={({ pressed }) => [styles.errorLink, { opacity: pressed ? 0.7 : 1 }]}
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

        <View style={styles.inputBar}>
          <Row gap={10} align="center">
            <View style={styles.inputWrap}>
              <Input
                value={input}
                onChangeText={setInput}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={placeholder}
                editable={aiReady && !sending}
                multiline
                placeholderLines={1}
                style={styles.inputStyle}
              />
            </View>
            <Pressable
              onPress={() => handleSend(input)}
              disabled={!aiReady || sending || !input.trim()}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: accentColor },
                { opacity: !aiReady || sending || !input.trim() ? 0.4 : pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </Row>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={chatSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setChatSettingsOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            onPress={() => setChatSettingsOpen(false)}
            style={styles.modalBackdrop}
          />
          <View style={styles.modalCard}>
            <Row>
              <Text variant="h2">Chat settings</Text>
              <Pressable onPress={() => setChatSettingsOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </Pressable>
            </Row>

            <View style={styles.modalSection}>
              <Text variant="label">Model</Text>
              {AI_MODELS.map((m) => {
                const selected = m.value === chatModel;
                return (
                  <Pressable
                    key={m.value}
                    onPress={() => setChatModel(m.value)}
                    style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={{ fontWeight: selected ? '800' : '600' }}>{m.label}</Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={theme.colors.primary2} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <Text variant="label">{`Reasoning · ${reasoningLabel}`}</Text>
              {(['low', 'medium', 'high'] as const).map((level) => {
                const selected = chatReasoning === level;
                const label =
                  level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low (default)';
                return (
                  <Pressable
                    key={level}
                    onPress={() => setChatReasoning(level)}
                    style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={{ fontWeight: selected ? '800' : '600' }}>{label}</Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={theme.colors.primary2} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    headerButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    centeredWithGap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
    },
    keyboardAvoider: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.spacing.lg,
      paddingBottom: 20,
      flexGrow: 1,
    },
    content: {
      flex: 1,
      gap: 12,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      paddingVertical: theme.spacing.xl,
    },
    cardSummary: {
      padding: 22,
      borderRadius: 18,
      backgroundColor: theme.colors.surface2,
      width: '100%',
    },
    cardLabel: {
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    cardValue: {
      fontWeight: '800' as const,
      textAlign: 'center',
    },
    cardDivider: {
      height: 14,
    },
    emptyHint: {
      fontSize: 16,
      fontWeight: '700' as const,
      textAlign: 'center',
      color: theme.colors.textMuted,
    },
    quickQuestions: {
      alignItems: 'center',
      width: '100%',
      marginTop: -4,
      gap: 8,
    },
    quickQuestionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
      width: '100%',
    },
    quickQuestionButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quickQuestionText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: theme.colors.text,
    },
    aiWarning: {
      gap: 8,
    },
    aiWarningText: {
      color: theme.colors.textMuted,
      fontWeight: '700' as const,
    },
    messageList: {
      gap: 10,
    },
    messageBubble: {
      maxWidth: '86%',
      padding: 12,
      borderRadius: 16,
    },
    userBubble: {
      alignSelf: 'flex-end',
    },
    assistantBubble: {
      alignSelf: 'flex-start',
    },
    userMessageText: {
      color: '#FFFFFF',
      fontWeight: '400' as const,
      fontSize: 14,
      lineHeight: 20,
    },
    assistantMessageText: {
      color: theme.colors.text,
      fontWeight: '400' as const,
      fontSize: 14,
      lineHeight: 20,
    },
    sendingBubble: {
      alignSelf: 'flex-start',
      maxWidth: '86%',
      padding: 12,
      borderRadius: 16,
      backgroundColor: theme.colors.surface2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    errorWrap: {
      gap: 8,
    },
    errorText: {
      color: theme.colors.danger,
      fontWeight: '700' as const,
    },
    errorLink: {
      alignSelf: 'flex-start',
    },
    inputBar: {
      padding: theme.spacing.lg,
      paddingTop: 8,
    },
    inputWrap: {
      flex: 1,
    },
    inputStyle: {
      minHeight: 52,
      textAlignVertical: 'top',
    },
    sendButton: {
      height: 44,
      width: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalRoot: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
    },
    modalBackdrop: {
      ...(StyleSheet.absoluteFillObject as object),
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    modalCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      padding: 16,
      gap: 10,
    },
    modalSection: {
      gap: 8,
    },
    modalOption: {
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modalDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
  });
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
