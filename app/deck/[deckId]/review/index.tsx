import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import type { Card } from '@/domain/models';
import type { Rating } from '@/domain/ratings';
import { schedule } from '@/domain/scheduling/schedule';
import { Button } from '@/ui/components/Button';
import { Collapsible } from '@/ui/components/Collapsible';
import { EmptyState } from '@/ui/components/EmptyState';
import { FlipCard } from '@/ui/components/FlipCard';
import { Pill } from '@/ui/components/Pill';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { StrengthDots } from '@/ui/components/StrengthDots';
import { Text } from '@/ui/components/Text';
import { cardStateLabel, cardStateTone } from '@/ui/components/cardStatePill';
import { softHaptic, successHaptic } from '@/ui/haptics';
import { nowMs } from '@/utils/time';
import { useDecklyTheme } from '@/ui/theme/provider';

export default function ReviewScreen() {
  const t = useDecklyTheme();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();

  const [queue, setQueue] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  const load = useCallback(async () => {
    const cards = await cardsRepo.getDueCards({ deckId, now: nowMs(), limit: 50 });
    setQueue(cards);
    setIndex(0);
    setFlippedId(null);
    setHistory([]);
  }, [deckId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const current = queue[index] ?? null;
  const flipped = !!current && flippedId === current.id;
  const progress = useMemo(() => {
    if (!queue.length) return '0/0';
    return `${Math.min(index + 1, queue.length)}/${queue.length}`;
  }, [index, queue.length]);

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

  const headerRight = history.length
    ? () => (
        <Pressable
          disabled={loading}
          onPress={() => {
            softHaptic();
            undoLast();
          }}
          hitSlop={12}
          style={({ pressed }) => ({
            paddingHorizontal: 8,
            paddingVertical: 6,
            opacity: loading ? 0.4 : pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="time-outline" size={20} color={t.colors.textMuted} />
        </Pressable>
      )
    : undefined;

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
        <Row style={{ marginBottom: t.spacing.md }}>
          <Text variant="mono" style={{ color: t.colors.textMuted }}>
            {progress}
          </Text>
          <Row gap={10} style={{ justifyContent: 'flex-end' }}>
            {current.state !== 'new' ? <StrengthDots card={current} /> : null}
            <Pill
              label={cardStateLabel(current.state)}
              tone={cardStateTone(current.state)}
              style={{ alignSelf: 'center' }}
            />
          </Row>
        </Row>

        <FlipCard
          front={current.front}
          back={current.back}
          flipped={flipped}
          onToggle={() =>
            setFlippedId((prev) => (prev === current.id ? null : current.id))
          }
        />

        {flipped ? (
          <>
            <View style={{ height: 12 }} />
            <Collapsible title="Example">
              <Text variant="muted">{current.example?.trim() || 'No example for this card.'}</Text>
            </Collapsible>

            <View style={{ height: 14 }} />

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
          </>
        ) : (
          <View style={{ height: 8 }} />
        )}
      </Animated.View>
    </Screen>
  );
}
