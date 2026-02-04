import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDeckStats } from '@/data/repositories/decksRepo';
import type { DeckStats } from '@/domain/models';
import { useDecksStore } from '@/stores/decksStore';
import { Card } from '@/ui/components/Card';
import { EmptyState } from '@/ui/components/EmptyState';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { useDecklyTheme } from '@/ui/theme/provider';
import { nowMs } from '@/utils/time';

export default function HomeScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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

      <View style={styles.header}>
        <Row style={styles.headerRow}>
          <Text variant="title" style={styles.title}>
            Deckly
          </Text>
          <Pressable
            hitSlop={10}
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
          </Pressable>
        </Row>
        <Text variant="muted" style={styles.subheader}>
          Offline-first language flashcards with spaced repetition, plus AI-generated examples and notes you
          can save and review later.
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
          contentContainerStyle={[styles.listContent, { paddingBottom: 120 + insets.bottom }]}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/deck/${item.id}`)} style={styles.deckPressable}>
              <Card>
                <Row align="center" style={styles.deckRow}>
                  <View style={styles.deckLeft}>
                    <Row gap={10} style={styles.deckTitleRow}>
                      <View
                        style={[
                          styles.deckDot,
                          {
                            backgroundColor:
                              resolveDeckAccentColor(item.accentColor) ?? theme.colors.primary,
                            opacity: (statsByDeckId[item.id]?.due ?? 0) > 0 ? 1 : 0.7,
                          },
                        ]}
                      />
                      <Text variant="h2" numberOfLines={1} style={{ flex: 1 }}>
                        {item.name}
                      </Text>
                    </Row>
                    <View style={styles.deckStatsSpacer} />
                    {(() => {
                      const total = statsByDeckId[item.id]?.total ?? 0;
                      return (
                        <Text variant="muted">
                          {total} {total === 1 ? 'card' : 'cards'} total
                        </Text>
                      );
                    })()}
                  </View>
                  <View style={styles.dueWrap}>
                    <Text variant="label" style={styles.dueLabel}>
                      Due now
                    </Text>
                    {(() => {
                      const due = statsByDeckId[item.id]?.due ?? 0;
                      const dueLabel = formatDue(due);
                      const fontSize = dueLabel.length >= 4 ? 18 : 22;
                      return (
                        <Text
                          numberOfLines={1}
                          style={[styles.dueValue, { fontSize, lineHeight: fontSize + 4 }]}
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

      <View style={[styles.bottomCtaWrap, { paddingBottom: 10 + insets.bottom }]}>
        <Pressable
          onPress={() => router.push('/deck/new')}
          style={({ pressed }) => [styles.addDeckPressable, { opacity: pressed ? 0.9 : 1 }]}
        >
          <LinearGradient
            colors={[theme.colors.primaryGradientStart, theme.colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addDeckGradient}
          >
            <Row gap={8} style={styles.addDeckRow}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addDeckText}>New deck</Text>
            </Row>
          </LinearGradient>
        </Pressable>
      </View>
    </Screen>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    header: {
      marginBottom: theme.spacing.lg,
      gap: 10,
    },
    headerRow: {
      alignItems: 'center',
    },
    title: {
      fontSize: 40,
      lineHeight: 44,
    },
    settingsButton: {
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    subheader: {
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '400' as const,
      maxWidth: 320,
    },
    listContent: {
      paddingTop: 6,
      paddingBottom: 120,
    },
    deckPressable: {
      marginBottom: 12,
    },
    deckRow: {
      justifyContent: 'space-between',
    },
    deckLeft: {
      flex: 1,
      paddingRight: 12,
    },
    deckTitleRow: {
      justifyContent: 'flex-start',
    },
    deckDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      marginTop: 5,
    },
    deckStatsSpacer: {
      height: 6,
    },
    dueWrap: {
      alignItems: 'flex-end',
    },
    dueLabel: {
      color: theme.colors.textMuted,
    },
    dueValue: {
      minWidth: 56,
      textAlign: 'right' as const,
      fontWeight: '900' as const,
      color: theme.colors.text,
    },
    bottomCtaWrap: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: 10,
    },
    addDeckPressable: {
      alignSelf: 'center',
    },
    addDeckGradient: {
      borderRadius: 999,
      paddingVertical: 12,
      paddingHorizontal: 18,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
    addDeckRow: {
      justifyContent: 'center',
    },
    addDeckText: {
      color: '#fff',
      fontWeight: '900' as const,
    },
  });
}
