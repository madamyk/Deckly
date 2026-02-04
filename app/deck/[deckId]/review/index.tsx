import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import { getShowExamplesOnBack, getShowExamplesOnFront, getStudyReversed } from '@/data/repositories/deckPrefsRepo';
import type { Card } from '@/domain/models';
import type { Rating } from '@/domain/ratings';
import { schedule } from '@/domain/scheduling/schedule';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { FlipCard } from '@/ui/components/FlipCard';
import { Pill } from '@/ui/components/Pill';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { cardStateLabel, cardStateTone } from '@/ui/components/cardStatePill';
import { softHaptic, successHaptic } from '@/ui/haptics';
import { nowMs } from '@/utils/time';
import { useDecklyTheme } from '@/ui/theme/provider';
import { usePrefsStore } from '@/stores/prefsStore';

export default function ReviewScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { prefs } = usePrefsStore();

  const [queue, setQueue] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [examplesEnabled, setExamplesEnabled] = useState(true);
  const [animateExamples, setAnimateExamples] = useState(false);
  const [studyReversed, setStudyReversed] = useState(false);
  const [showExamplesOnFront, setShowExamplesOnFront] = useState(true);
  const [showExamplesOnBack, setShowExamplesOnBack] = useState(true);
  const resumeRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);
  const flippedRef = useRef(false);
  const [history, setHistory] = useState<
    {
      cardId: string;
      prevIndex: number;
      prevScheduling: {
        state: Card['state'];
        dueAt: number;
        intervalDays: number;
        ease: number;
        reps: number;
        lapses: number;
        learningStepIndex: number;
        updatedAt: number;
      };
    }[]
  >([]);

  const load = useCallback(async (opts?: { preserve?: boolean }) => {
    const preserve = !!opts?.preserve;
    const prevId = preserve ? currentIdRef.current : null;
    const prevFlipped = preserve ? flippedRef.current : false;
    const cards = await cardsRepo.getDueCards({ deckId, now: nowMs(), limit: 50 });
    setQueue(cards);
    if (preserve && prevId) {
      const nextIndex = cards.findIndex((c) => c.id === prevId);
      if (nextIndex >= 0) {
        setIndex(nextIndex);
        setFlippedId(prevFlipped ? prevId : null);
        return;
      }
    }
    setIndex(0);
    setFlippedId(null);
    setHistory([]);
  }, [deckId]);

  useFocusEffect(
    useCallback(() => {
      const preserve = resumeRef.current;
      resumeRef.current = false;
      load({ preserve });
      (async () => {
        const reversed = await getStudyReversed(String(deckId));
        setStudyReversed(reversed);
        const showFront = await getShowExamplesOnFront(String(deckId));
        setShowExamplesOnFront(showFront);
        const showBack = await getShowExamplesOnBack(String(deckId));
        setShowExamplesOnBack(showBack);
      })();
    }, [load, deckId]),
  );

  useEffect(() => {
    if (!animateExamples) return;
    const id = setTimeout(() => setAnimateExamples(false), 300);
    return () => clearTimeout(id);
  }, [animateExamples]);

  const current = queue[index] ?? null;
  const flipped = !!current && flippedId === current.id;
  const frontText = current ? (studyReversed ? current.back : current.front) : '';
  const backText = current ? (studyReversed ? current.front : current.back) : '';
  const frontExampleText = current ? (studyReversed ? current.exampleL2 : current.exampleL1) : null;
  const backExampleText = current ? (studyReversed ? current.exampleL1 : current.exampleL2) : null;
  const frontExampleVisible =
    !!current && examplesEnabled && showExamplesOnFront && !!frontExampleText?.trim();
  const backExampleVisible =
    !!current && examplesEnabled && showExamplesOnBack && !!backExampleText?.trim();
  const note = current?.exampleNote?.trim() ? current.exampleNote.trim() : null;
  const noteVisible = examplesEnabled && !!note;
  const noteAnimate = animateExamples;
  const progress = useMemo(() => {
    if (!queue.length) return '0/0';
    return `${Math.min(index + 1, queue.length)}/${queue.length}`;
  }, [index, queue.length]);

  useEffect(() => {
    currentIdRef.current = current?.id ?? null;
    flippedRef.current = !!current && flippedId === current.id;
  }, [current, flippedId]);

  async function rate(rating: Rating) {
    if (!current) return;
    if (!flipped) return;
    setLoading(true);
    try {
      const now = nowMs();
      // Snapshot scheduling fields so we can undo a mis-tap.
      const undoEntry = {
        cardId: current.id,
        prevIndex: index,
        prevScheduling: {
          state: current.state,
          dueAt: current.dueAt,
          intervalDays: current.intervalDays,
          ease: current.ease,
          reps: current.reps,
          lapses: current.lapses,
          learningStepIndex: current.learningStepIndex,
          updatedAt: current.updatedAt,
        },
      } as const;

      const patch = schedule(current, rating, now);
      await cardsRepo.applyScheduling(current.id, patch);
      await successHaptic();
      setHistory((h) => [...h, undoEntry]);

      // Advance in-session (we don't re-queue "Again" since it won't be due for 10m anyway).
      const nextIndex = index + 1;
      if (nextIndex >= queue.length) {
        setIndex(nextIndex);
      } else {
        setIndex(nextIndex);
      }
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Failed to update scheduling.');
    } finally {
      setLoading(false);
    }
  }

  async function undoLast() {
    if (loading) return;
    const last = history[history.length - 1];
    if (!last) return;
    setLoading(true);
    try {
      await cardsRepo.applyScheduling(last.cardId, last.prevScheduling);
      setQueue((q) =>
        q.map((c) => (c.id === last.cardId ? { ...c, ...last.prevScheduling } : c)),
      );
      setIndex(last.prevIndex);
      setFlippedId(null);
      setHistory((h) => h.slice(0, -1));
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Failed to undo.');
    } finally {
      setLoading(false);
    }
  }

  const headerRight = () => (
    <Row gap={8} style={styles.headerRightRow}>
      <Pressable
        onPress={() => {
          softHaptic();
          const nextEnabled = !examplesEnabled;
          const shouldAnimateNote = flipped && !!note;
          setAnimateExamples(shouldAnimateNote);
          setExamplesEnabled(nextEnabled);
        }}
        hitSlop={12}
        style={({ pressed }) => [styles.headerIconButton, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons
          name={examplesEnabled ? 'eye-outline' : 'eye-off-outline'}
          size={20}
          color={theme.colors.textMuted}
        />
      </Pressable>

      {current ? (
        <Pressable
          onPress={() => {
            softHaptic();
            router.push({
              pathname: '/deck/[deckId]/cards/[cardId]',
              params: { deckId, cardId: current.id },
            });
          }}
          hitSlop={12}
          style={({ pressed }) => [styles.headerIconButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="create-outline" size={20} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}

      {history.length ? (
        <Pressable
          disabled={loading}
          onPress={() => {
            softHaptic();
            undoLast();
          }}
          hitSlop={12}
          style={({ pressed }) => [
            styles.headerIconButton,
            { opacity: loading ? 0.4 : pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="time-outline" size={20} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </Row>
  );

  if (!queue.length) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Review' }} />
        <EmptyState
          title="No cards due"
          message="You're all caught up. Come back later, or add more cards."
          actionTitle="Back to deck"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Stack.Screen
          options={{
            title: 'Review',
            headerRight,
          }}
        />
        <EmptyState
          title="Session complete"
          message="Nice. You finished the due queue for this deck."
          actionTitle="Back to deck"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Review',
          headerRight,
        }}
      />

      <Animated.View
        key={current.id}
        entering={FadeInRight.duration(180)}
        exiting={FadeOutLeft.duration(140)}
      >
        <Row style={styles.progressRow}>
          <Text variant="mono" style={styles.progressText}>
            {progress}
          </Text>
          <Row gap={10} style={styles.progressActions}>
            <Pill
              label={cardStateLabel(current.state)}
              tone={cardStateTone(current.state)}
              style={styles.progressPill}
            />
          </Row>
        </Row>

        <FlipCard
          front={frontText}
          back={backText}
          frontFooter={
            frontExampleVisible ? (
              <Animated.View entering={FadeInDown.duration(140)} exiting={FadeOutDown.duration(120)}>
                <ExampleFooter
                  key={`${current.id}:front`}
                  text={frontExampleText!.trim()}
                  collapsedByDefault={prefs.review.examplesCollapsedByDefault}
                />
              </Animated.View>
            ) : null
          }
          backFooter={
            backExampleVisible ? (
              <Animated.View entering={FadeInDown.duration(140)} exiting={FadeOutDown.duration(120)}>
                <ExampleFooter
                  key={`${current.id}:back`}
                  text={backExampleText!.trim()}
                  collapsedByDefault={prefs.review.examplesCollapsedByDefault}
                />
              </Animated.View>
            ) : null
          }
          flipped={flipped}
          onToggle={() =>
            setFlippedId((prev) => (prev === current.id ? null : current.id))
          }
        />

        {flipped ? (
          <>
            <View style={{ height: 16 }} />

            <View style={{ gap: 10 }}>
              <Row gap={10} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Again"
                    variant="dangerSoft"
                    onPress={() => rate('again')}
                    disabled={loading}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Hard"
                    variant="warning"
                    onPress={() => rate('hard')}
                    disabled={loading}
                  />
                </View>
              </Row>
              <Row gap={10} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Good"
                    variant="primarySoft"
                    onPress={() => rate('good')}
                    disabled={loading}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Easy"
                    variant="success"
                    onPress={() => rate('easy')}
                    disabled={loading}
                  />
                </View>
              </Row>
            </View>

            <View style={styles.actionsSpacer} />
            <Button
              title="Ask about this card"
              variant="secondary"
              left={
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.text} />
              }
              onPress={() => {
                resumeRef.current = true;
                router.push({
                  pathname: '/deck/[deckId]/review/chat/[cardId]',
                  params: { deckId, cardId: current.id },
                });
              }}
            />

            {noteVisible ? (
              <Animated.View
                entering={noteAnimate ? FadeInDown.duration(140) : undefined}
                exiting={noteAnimate ? FadeOutDown.duration(120) : undefined}
                style={styles.noteCard}
              >
                <Row gap={8} style={styles.noteRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={theme.colors.textMuted}
                    style={styles.noteIcon}
                  />
                  <View style={styles.noteContent}>
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                      contentContainerStyle={styles.noteScrollContent}
                    >
                      <Text
                        style={styles.noteText}
                      >
                        {note}
                      </Text>
                    </ScrollView>
                  </View>
                </Row>
              </Animated.View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.unflippedSpacer} />
          </>
        )}
      </Animated.View>
    </Screen>
  );
}

function ExampleFooter(props: {
  text: string;
  collapsedByDefault: boolean;
}) {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createExampleStyles(theme), [theme]);
  const [open, setOpen] = useState(!props.collapsedByDefault);

  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      hitSlop={8}
      style={({ pressed }) => [styles.examplePressable, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.exampleContent}>
        <Text
          style={styles.exampleText}
          numberOfLines={open ? 0 : 4}
        >
          {props.text}
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    headerRightRow: {
      justifyContent: 'flex-end',
    },
    headerIconButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    progressRow: {
      marginBottom: theme.spacing.md,
    },
    progressText: {
      color: theme.colors.textMuted,
    },
    progressActions: {
      justifyContent: 'flex-end',
    },
    progressPill: {
      alignSelf: 'center',
    },
    actionsSpacer: {
      height: 10,
    },
    noteCard: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      backgroundColor: theme.colors.surface2,
    },
    noteRow: {
      alignItems: 'flex-start',
    },
    noteIcon: {
      marginTop: 2,
    },
    noteContent: {
      flex: 1,
      maxHeight: 140,
    },
    noteScrollContent: {
      paddingRight: 4,
    },
    noteText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400' as const,
      color: theme.colors.textMuted,
      textAlign: 'left',
    },
    unflippedSpacer: {
      height: 8,
    },
  });
}

function createExampleStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    examplePressable: {
      paddingTop: 12,
    },
    exampleContent: {
      alignItems: 'center',
      gap: 6,
    },
    exampleText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400' as const,
      color: theme.colors.textMuted,
      textAlign: 'center',
      maxWidth: 320,
    },
  });
}
