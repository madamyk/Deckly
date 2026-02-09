import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDeckStats } from '@/data/repositories/decksRepo';
import { getDailyReviewLimit } from '@/data/repositories/deckPrefsRepo';
import { getDeckReviewedToday } from '@/data/repositories/reviewProgressRepo';
import { getDeckTags, listTagsWithDueCounts } from '@/data/repositories/tagsRepo';
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
  const [effectiveDueByDeckId, setEffectiveDueByDeckId] = useState<Record<string, number>>({});
  const [tagsByDeckId, setTagsByDeckId] = useState<Record<string, string[]>>({});
  const [tags, setTags] = useState<{ tag: string; due: number; deckCount: number }[]>([]);
  const insets = useSafeAreaInsets();

  const formatDue = (n: number) => {
    if (n > 999) return '999+';
    return String(n);
  };
  const masteryRatio = (stats?: DeckStats): number => {
    const total = stats?.total ?? 0;
    if (total <= 0) return 0;
    const mature = stats?.mature ?? 0;
    return Math.max(0, Math.min(1, mature / total));
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
        const [pairs, tagRows, deckTagPairs] = await Promise.all([
          Promise.all(
            decks.map(async (d) => [d.id, await getDeckStats(d.id, nowMs())] as const),
          ),
          listTagsWithDueCounts(nowMs()),
          Promise.all(decks.map(async (d) => [d.id, await getDeckTags(d.id)] as const)),
        ]);
        const limitsAndReviewedPairs = await Promise.all(
          decks.map(async (d) => {
            const [dailyLimit, reviewedToday] = await Promise.all([
              getDailyReviewLimit(d.id),
              getDeckReviewedToday(d.id),
            ]);
            return [d.id, dailyLimit, reviewedToday] as const;
          }),
        );
        if (cancelled) return;
        const next: Record<string, DeckStats> = {};
        for (const [id, s] of pairs) next[id] = s;
        const nextEffectiveDue: Record<string, number> = {};
        for (const [id, dailyLimit, reviewedToday] of limitsAndReviewedPairs) {
          const rawDue = next[id]?.due ?? 0;
          if (dailyLimit <= 0) {
            nextEffectiveDue[id] = rawDue;
            continue;
          }
          const remaining = Math.max(0, dailyLimit - reviewedToday);
          nextEffectiveDue[id] = Math.max(0, Math.min(rawDue, remaining));
        }
        const nextTags: Record<string, string[]> = {};
        for (const [id, deckTags] of deckTagPairs) nextTags[id] = deckTags;
        setStatsByDeckId(next);
        setEffectiveDueByDeckId(nextEffectiveDue);
        setTagsByDeckId(nextTags);
        setTags(tagRows);
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
          AI-assisted flashcard app for faster learning
        </Text>
        {tags.length ? (
          <View style={styles.tagSection}>
            <Text variant="label" style={styles.tagSectionTitle}>
              Study by tag
            </Text>
            <View style={styles.tagWrap}>
              {tags.map((t) => (
                <Pressable
                  key={t.tag}
                  onPress={() =>
                    router.push({ pathname: '/review/tag/[tag]', params: { tag: t.tag } })
                  }
                  style={({ pressed }) => [styles.tagPill, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.tagPillText}>{`${t.tag} (${formatDue(t.due)})`}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
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
                <View style={styles.deckCardContent}>
                  {(() => {
                    const ratio = masteryRatio(statsByDeckId[item.id]);
                    const accent =
                      resolveDeckAccentColor(item.accentColor) ?? theme.colors.primary;
                    if (ratio <= 0) return null;
                    return (
                      <View style={styles.masteryUnderlayClip} pointerEvents="none">
                        <View
                          style={[
                            styles.masteryUnderlayFill,
                            {
                              width: `${Math.round(ratio * 100)}%`,
                              backgroundColor: accent,
                            },
                          ]}
                        />
                      </View>
                    );
                  })()}
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
                          <View style={styles.deckMetaWrap}>
                            <Text variant="muted">
                              {total} {total === 1 ? 'card' : 'cards'} total
                            </Text>
                            {(() => {
                              const deckTags = tagsByDeckId[item.id] ?? [];
                              if (!deckTags.length) return null;
                              const visible = deckTags.slice(0, 2);
                              const hidden = deckTags.length - visible.length;
                              return (
                                <View style={styles.deckTagWrap}>
                                  {visible.map((tag) => (
                                    <View key={`${item.id}:${tag}`} style={styles.deckTagPill}>
                                      <Text style={styles.deckTagText} numberOfLines={1}>
                                        {tag}
                                      </Text>
                                    </View>
                                  ))}
                                  {hidden > 0 ? (
                                    <Text style={styles.deckTagMoreText}>{`+${hidden}`}</Text>
                                  ) : null}
                                </View>
                              );
                            })()}
                          </View>
                        );
                      })()}
                    </View>
                    <View style={styles.dueWrap}>
                      <Text variant="label" style={styles.dueLabel}>
                        Due now
                      </Text>
                      {(() => {
                        const due = effectiveDueByDeckId[item.id] ?? 0;
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
                </View>
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
    tagSection: {
      marginTop: 6,
      gap: 8,
    },
    tagSectionTitle: {
      color: theme.colors.textMuted,
    },
    tagWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tagPill: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tagPillText: {
      color: theme.colors.text,
      fontWeight: '600' as const,
      fontSize: 12,
      lineHeight: 16,
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
    deckCardContent: {
      position: 'relative',
      gap: 10,
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
    deckMetaWrap: {
      gap: 6,
    },
    deckTagWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    deckTagPill: {
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 8,
      paddingVertical: 2,
      maxWidth: 120,
    },
    deckTagText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '500' as const,
    },
    deckTagMoreText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600' as const,
    },
    masteryUnderlayClip: {
      ...StyleSheet.absoluteFillObject,
      top: -14,
      right: -14,
      bottom: -14,
      left: -14,
      borderRadius: 18,
      overflow: 'hidden',
    },
    masteryUnderlayFill: {
      height: '100%',
      opacity: 0.1,
    },
    masteryEdgeClip: {
      position: 'relative',
      height: 14,
      marginTop: -14,
      marginHorizontal: -14,
      borderTopLeftRadius: 17,
      borderTopRightRadius: 17,
      overflow: 'hidden',
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
