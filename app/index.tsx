import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDeckStats } from '@/data/repositories/decksRepo';
import type { DeckStats } from '@/domain/models';
import { Card } from '@/ui/components/Card';
import { EmptyState } from '@/ui/components/EmptyState';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useDecksStore } from '@/stores/decksStore';
import { useDecklyTheme } from '@/ui/theme/provider';
import { resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { nowMs } from '@/utils/time';

export default function HomeScreen() {
  const t = useDecklyTheme();
  const { decks, loading, error, refresh } = useDecksStore();
  const [statsByDeckId, setStatsByDeckId] = useState<Record<string, DeckStats>>({});
  const insets = useSafeAreaInsets();

  const formatDue = (n: number) => {
    if (n > 999) return '999+';
    return String(n);
  };

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pairs = await Promise.all(
          decks.map(async (d) => [d.id, await getDeckStats(d.id, nowMs())] as const),
        );
        if (cancelled) return;
        const next: Record<string, DeckStats> = {};
        for (const [id, s] of pairs) next[id] = s;
        setStatsByDeckId(next);
      } catch {
        // Non-fatal; the list can render without stats.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [decks]);

  useEffect(() => {
    if (error) Alert.alert('Deckly', error);
  }, [error]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ marginBottom: t.spacing.lg, gap: 10 }}>
        <Row style={{ alignItems: 'center' }}>
          <Text variant="title">Deckly</Text>
          <Pressable
            hitSlop={10}
            onPress={() => router.push('/settings')}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: t.colors.surface2,
              borderWidth: 1,
              borderColor: t.colors.border,
            }}
          >
            <Ionicons name="settings-outline" size={20} color={t.colors.text} />
          </Pressable>
        </Row>
        <Text
          variant="muted"
          style={{
            fontSize: 14,
            lineHeight: 22,
            fontWeight: '400',
            maxWidth: 320,
          }}
        >
          Offline-first flashcards with spaced repetition, plus optional AI-generated example pairs
          you can save and review later.
        </Text>
      </View>

      {decks.length === 0 && !loading ? (
        <EmptyState
          title="No decks yet"
          message="Create your first deck, import a CSV, and start reviewing."
        />
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 120 + insets.bottom }}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/deck/${item.id}`)} style={{ marginBottom: 12 }}>
              <Card>
                <Row align="center" style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Row gap={10} style={{ justifyContent: 'flex-start' }}>
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          marginTop: 5,
                          backgroundColor:
                            resolveDeckAccentColor(item.accentColor) ?? t.colors.primary,
                        }}
                      />
                      <Text variant="h2" numberOfLines={1} style={{ flex: 1 }}>
                        {item.name}
                      </Text>
                    </Row>
                    <View style={{ height: 6 }} />
                    <Text variant="muted">
                      {statsByDeckId[item.id]?.total ?? 0} cards total
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="label" style={{ color: t.colors.textMuted }}>
                      Due now
                    </Text>
                    {(() => {
                      const due = statsByDeckId[item.id]?.due ?? 0;
                      const dueLabel = formatDue(due);
                      const fontSize = dueLabel.length >= 4 ? 18 : 22;
                      return (
                        <Text
                          numberOfLines={1}
                          style={{
                            minWidth: 56,
                            textAlign: 'right',
                            fontSize,
                            lineHeight: fontSize + 4,
                            fontWeight: '900',
                            color: t.colors.text,
                          }}
                        >
                          {dueLabel}
                        </Text>
                      );
                    })()}
                  </View>
                </Row>
              </Card>
            </Pressable>
          )}
        />
      )}

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: t.spacing.lg,
          paddingTop: 10,
          paddingBottom: 10 + insets.bottom,
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            borderRadius: 999,
            paddingVertical: 12,
            paddingHorizontal: 18,
            backgroundColor: t.colors.primary,
            shadowColor: t.colors.shadow,
            shadowOpacity: 0.22,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 12 },
            elevation: 6,
          }}
        >
          <Pressable
            onPress={() => router.push('/deck/new')}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <Row gap={8} style={{ justifyContent: 'center' }}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '900' }}>New deck</Text>
            </Row>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
