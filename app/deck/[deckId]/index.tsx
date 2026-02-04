import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import { getDeck, getDeckStats } from '@/data/repositories/decksRepo';
import type { Card as CardModel, Deck, DeckStats } from '@/domain/models';
import { useImportResultStore } from '@/stores/importResultStore';
import { Card } from '@/ui/components/Card';
import { EmptyState } from '@/ui/components/EmptyState';
import { Pill } from '@/ui/components/Pill';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';
import { cardStateLabel, cardStateTone } from '@/ui/components/cardStatePill';
import { getDeckAccentGradient, resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDueRelative, nowMs } from '@/utils/time';

export default function DeckScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [cards, setCards] = useState<CardModel[]>([]);
  const openAddMenu = useCallback(() => {
    const addCard = () =>
      router.push({ pathname: '/deck/[deckId]/cards/new', params: { deckId } });
    const importCsv = () =>
      router.push({ pathname: '/deck/[deckId]/import', params: { deckId } });

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Add card', 'Import CSV', 'Cancel'],
          cancelButtonIndex: 2,
          title: 'Add to deck',
        },
        (idx) => {
          if (idx === 0) addCard();
          if (idx === 1) importCsv();
        },
      );
      return;
    }

    // Android: use native Alert action list (feels more native than a custom popover).
    Alert.alert('Add to deck', undefined, [
      { text: 'Add card', onPress: addCard },
      { text: 'Import CSV', onPress: importCsv },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [deckId]);

  const loadMeta = useCallback(async () => {
    const d = await getDeck(deckId);
    setDeck(d);
    if (d) setStats(await getDeckStats(deckId, nowMs()));
  }, [deckId]);

  const loadCards = useCallback(async () => {
    const rows = await cardsRepo.listCards(deckId);
    setCards(rows);
  }, [deckId]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadMeta(), loadCards()]);
  }, [loadMeta, loadCards]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  useFocusEffect(
    useCallback(() => {
      const result = useImportResultStore.getState().consumeResult(deckId);
      if (!result) return;

      const created = Number(result.created || 0);
      const invalid = Number(result.skippedInvalid || 0);
      const dupes = Number(result.skippedDuplicates || 0);
      const exTotal = Number(result.examplesTotal || 0);
      const exDone = Number(result.examplesDone || 0);
      const exFailed = Number(result.examplesFailed || 0);
      const exCancelled = Number(result.examplesCancelled || 0);

      const details: string[] = [];
      if (invalid) details.push(`Skipped (invalid): ${invalid}`);
      if (dupes) details.push(`Skipped (duplicates): ${dupes}`);
      if (exTotal) {
        const genLine = exCancelled
          ? exFailed
            ? `Examples: cancelled at ${exDone}/${exTotal} (failed ${exFailed})`
            : `Examples: cancelled at ${exDone}/${exTotal}`
          : exFailed
            ? `Examples: generated ${exTotal - exFailed}/${exTotal} (failed ${exFailed})`
            : `Examples: generated ${exTotal}/${exTotal}`;
        details.push(genLine);
        if (exFailed && result.examplesFailureSummary) {
          details.push(`Failures: ${result.examplesFailureSummary}`);
        }
      }

      Alert.alert(
        'Import complete',
        details.length
          ? `Imported ${created} cards.\n\n${details.join('\n')}`
          : `Imported ${created} cards.`,
      );
    }, [deckId]),
  );

  const HeaderRight = useCallback(
    () => (
      <Row gap={8} style={styles.headerActionRow}>
        <Pressable
          hitSlop={10}
          onPress={openAddMenu}
          style={styles.headerIconButton}
        >
          <Ionicons name="add" size={24} color={theme.colors.text} />
        </Pressable>
        <Pressable
          hitSlop={10}
          onPress={() => {
            router.push({ pathname: '/deck/[deckId]/settings', params: { deckId } });
          }}
          style={styles.headerIconButton}
        >
          <Ionicons name="settings-outline" size={22} color={theme.colors.text} />
        </Pressable>
      </Row>
    ),
    [deckId, openAddMenu, theme.colors.text, styles.headerActionRow, styles.headerIconButton],
  );

  const HeaderLeft = useCallback(
    () => (
      <Pressable
        hitSlop={10}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.headerBackButton, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
      </Pressable>
    ),
    [theme.colors.text, styles.headerBackButton],
  );

  const dueCount = stats?.due ?? 0;
  const totalCount = stats?.total ?? 0;
  const hasCards = totalCount > 0;
  // Room for the floating CTA + home indicator, without an excessive blank tail.
  const listBottomPad = insets.bottom + 76;
  const accent = resolveDeckAccentColor(deck?.accentColor) ?? theme.colors.primary;
  const accentGradient = getDeckAccentGradient(accent, theme.scheme);

  if (!deck) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <Stack.Screen options={{ title: 'Deck' }} />
        <View style={styles.missingWrap}>
          <EmptyState title="Deck not found" message="It may have been deleted." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <Stack.Screen options={{ title: deck.name, headerLeft: HeaderLeft, headerRight: HeaderRight }} />

      <View
        style={[
          styles.headerSummary,
          { paddingBottom: hasCards ? 8 : theme.spacing.lg },
        ]}
      >
        {hasCards ? (
          <Row style={styles.headerSummaryRow}>
            <Text variant="mono" style={styles.headerSummaryText}>
              {totalCount} cards
            </Text>
            <Text variant="mono" style={styles.headerSummaryText}>
              {dueCount} due now
            </Text>
          </Row>
        ) : null}
      </View>

      {hasCards ? (
        <>
          <FlatList
            data={cards}
            keyExtractor={(c) => c.id}
            // Indicator on the screen edge, content padded.
            style={styles.list}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.lg,
              // Keep the last item visible above the floating CTA + home indicator.
              paddingBottom: listBottomPad,
            }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/deck/[deckId]/cards/[cardId]',
                    params: { deckId, cardId: item.id },
                  })
                }
                onLongPress={() => {
                  Alert.alert('Delete card?', 'This card will be removed from this deck.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        await cardsRepo.softDeleteCard(item.id);
                        loadAll();
                      },
                    },
                  ]);
                }}
                style={styles.cardPressable}
              >
                <Card>
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardHeaderText}>
                        <Text variant="h2" numberOfLines={1}>
                          {item.front}
                        </Text>
                      </View>
                      <Pill
                        label={cardStateLabel(item.state)}
                        tone={cardStateTone(item.state)}
                        style={styles.cardPill}
                      />
                    </View>

                    <View style={styles.cardFooterRow}>
                      <View style={styles.cardFooterText}>
                        <Text variant="muted" numberOfLines={2}>
                          {item.back}
                        </Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={styles.cardDueText}
                      >
                        {formatDueRelative(item.dueAt, nowMs())}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            )}
          />
        </>
      ) : (
        <View style={[styles.emptyWrap, { paddingBottom: theme.spacing.lg + insets.bottom }]}>
          <EmptyState
            title="This deck is empty"
            message="Add your first cards or import a CSV to get started."
            gap={24}
            messageStyle={{ fontWeight: '500' }}
            actionTitle="Add cards"
            onAction={openAddMenu}
          />
        </View>
      )}

      {hasCards ? (
        <View
          pointerEvents="box-none"
          style={[styles.reviewCtaWrap, { paddingBottom: 10 + insets.bottom }]}
        >
          {dueCount > 0 ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/deck/[deckId]/review', params: { deckId } })
              }
              style={({ pressed }) => [styles.reviewCtaPressable, { opacity: pressed ? 0.9 : 1 }]}
            >
              <LinearGradient
                colors={accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.reviewCtaGradient}
              >
                <Text style={styles.reviewCtaText}>
                  {`Review due (${dueCount})`}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.reviewCtaDisabled}>
              <Pressable disabled style={styles.reviewCtaDisabledPressable}>
                <Text style={styles.reviewCtaDisabledText}>
                  {`Review due (${dueCount})`}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    headerActionRow: {
      justifyContent: 'flex-end',
    },
    headerIconButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    headerBackButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    missingWrap: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    headerSummary: {
      paddingHorizontal: theme.spacing.lg,
      // The native stack header already handles safe area; keep only a small gutter.
      paddingTop: 12,
    },
    headerSummaryRow: {
      alignItems: 'center',
    },
    headerSummaryText: {
      color: theme.colors.textMuted,
    },
    list: {
      flex: 1,
    },
    cardPressable: {
      marginBottom: 12,
    },
    cardContent: {
      gap: 6,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    cardHeaderText: {
      flex: 1,
      paddingRight: 10,
    },
    cardPill: {
      alignSelf: 'flex-start',
    },
    cardFooterRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    cardFooterText: {
      flex: 1,
      paddingRight: 10,
    },
    cardDueText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 22,
      fontWeight: '500' as const,
      textAlign: 'right',
    },
    emptyWrap: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
    },
    reviewCtaWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: 10,
    },
    reviewCtaPressable: {
      alignSelf: 'center',
    },
    reviewCtaGradient: {
      borderRadius: 999,
      paddingVertical: 12,
      paddingHorizontal: 16,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
    reviewCtaText: {
      color: '#fff',
      fontWeight: '900' as const,
      textAlign: 'center',
    },
    reviewCtaDisabled: {
      alignSelf: 'center',
      borderRadius: 999,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
    reviewCtaDisabledPressable: {
      opacity: 0.7,
    },
    reviewCtaDisabledText: {
      color: theme.colors.textMuted,
      fontWeight: '900' as const,
      textAlign: 'center',
    },
  });
}
