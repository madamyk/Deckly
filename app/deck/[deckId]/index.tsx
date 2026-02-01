import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, View } from 'react-native';
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
import { resolveDeckAccentColor } from '@/ui/theme/deckAccents';
import { formatDueRelative, nowMs } from '@/utils/time';

export default function DeckScreen() {
  const t = useDecklyTheme();
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

  const headerRight = useMemo(
    () => () => (
      <Row gap={8} style={{ justifyContent: 'flex-end' }}>
        <Pressable
          hitSlop={10}
          onPress={openAddMenu}
          style={{ paddingHorizontal: 8, paddingVertical: 6 }}
        >
          <Ionicons name="add" size={24} color={t.colors.text} />
        </Pressable>
        <Pressable
          hitSlop={10}
          onPress={() => {
            router.push({ pathname: '/deck/[deckId]/settings', params: { deckId } });
          }}
          style={{ paddingHorizontal: 8, paddingVertical: 6 }}
        >
          <Ionicons name="settings-outline" size={22} color={t.colors.text} />
        </Pressable>
      </Row>
    ),
    [openAddMenu, t.colors.text],
  );

  const headerLeft = useMemo(
    () => () => (
      <Pressable
        hitSlop={10}
        onPress={() => router.back()}
        style={({ pressed }) => ({
          paddingHorizontal: 8,
          paddingVertical: 6,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="chevron-back" size={24} color={t.colors.text} />
      </Pressable>
    ),
    [t.colors.text],
  );

  const dueCount = stats?.due ?? 0;
  const totalCount = stats?.total ?? 0;
  const hasCards = totalCount > 0;
  // Room for the floating CTA + home indicator, without an excessive blank tail.
  const listBottomPad = insets.bottom + 76;
  const accent = resolveDeckAccentColor(deck?.accentColor) ?? t.colors.primary;

  if (!deck) {
    return (
      <Screen padded={false} edges={['left', 'right']}>
        <Stack.Screen options={{ title: 'Deck' }} />
        <View style={{ flex: 1, padding: t.spacing.lg }}>
          <EmptyState title="Deck not found" message="It may have been deleted." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right']}>
      <Stack.Screen options={{ title: deck.name, headerLeft, headerRight }} />

      <View
        style={{
          paddingHorizontal: t.spacing.lg,
          // The native stack header already handles safe area; keep only a small gutter.
          paddingTop: 12,
          paddingBottom: hasCards ? 8 : t.spacing.lg,
        }}
      >
        {hasCards ? (
          <Row style={{ alignItems: 'center' }}>
            <Text variant="mono" style={{ color: t.colors.textMuted }}>
              {totalCount} cards
            </Text>
            <Text variant="mono" style={{ color: t.colors.textMuted }}>
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
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: t.spacing.lg,
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
                style={{ marginBottom: 12 }}
              >
                <Card>
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text variant="h2" numberOfLines={1}>
                          {item.front}
                        </Text>
                      </View>
                      <Pill
                        label={cardStateLabel(item.state)}
                        tone={cardStateTone(item.state)}
                        style={{ alignSelf: 'flex-start' }}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text variant="muted" numberOfLines={2}>
                          {item.back}
                        </Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: t.colors.textMuted,
                          fontSize: 12,
                          lineHeight: 22,
                          fontWeight: '500',
                          textAlign: 'right',
                        }}
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
        <View
          style={{
            flex: 1,
            paddingHorizontal: t.spacing.lg,
            paddingBottom: t.spacing.lg + insets.bottom,
          }}
        >
          <EmptyState
            iconName="albums-outline"
            title="This deck is empty"
            message="Add your first cards or import a CSV to get started."
            actionTitle="Add cards"
            onAction={openAddMenu}
          />
        </View>
      )}

      {hasCards ? (
        <View
          pointerEvents="box-none"
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
              paddingHorizontal: 16,
              backgroundColor: dueCount > 0 ? accent : t.colors.surface2,
              borderWidth: dueCount > 0 ? 0 : 1,
              borderColor: t.colors.border,
              shadowColor: t.colors.shadow,
              shadowOpacity: 0.22,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 12 },
              elevation: 6,
            }}
          >
            <Pressable
              disabled={dueCount <= 0}
              onPress={() =>
                router.push({ pathname: '/deck/[deckId]/review', params: { deckId } })
              }
              style={({ pressed }) => [
                { opacity: dueCount <= 0 ? 0.7 : pressed ? 0.9 : 1 },
              ]}
            >
              <Text
                style={{
                  color: dueCount > 0 ? '#fff' : t.colors.textMuted,
                  fontWeight: '900',
                  textAlign: 'center',
                }}
              >
                {`Review due (${dueCount})`}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
