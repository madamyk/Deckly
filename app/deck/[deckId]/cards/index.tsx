import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import type { Card as CardModel } from '@/domain/models';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Pill } from '@/ui/components/Pill';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { cardStateLabel, cardStateTone } from '@/ui/components/cardStatePill';
import { formatDueRelative, nowMs } from '@/utils/time';
import { useDecklyTheme } from '@/ui/theme/provider';

export default function CardListScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const [cards, setCards] = useState<CardModel[]>([]);

  const load = useCallback(async () => {
    const rows = await cardsRepo.listCards(deckId);
    setCards(rows);
  }, [deckId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const HeaderRight = useCallback(
    () => (
      <Pressable
        hitSlop={10}
        onPress={() => router.push(`/deck/${deckId}/cards/new`)}
        style={styles.headerButton}
      >
        <Ionicons name="add" size={24} color={theme.colors.text} />
      </Pressable>
    ),
    [deckId, theme.colors.text, styles.headerButton],
  );

  return (
    <Screen padded={false} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerRight: HeaderRight }} />

      {cards.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text variant="h2">No cards</Text>
          <Text variant="muted">
            Add cards manually or import a CSV to start building this deck.
          </Text>
          <View style={styles.emptySpacer} />
          <Button title="Add a card" onPress={() => router.push(`/deck/${deckId}/cards/new`)} />
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(c) => c.id}
          // Make the scroll indicator sit on the screen edge while keeping content padded.
          style={styles.list}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            // Only enough room for the home indicator; avoid a "dead" looking gap.
            paddingBottom: insets.bottom + 8,
          }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/deck/${deckId}/cards/${item.id}`)}
              onLongPress={() => {
                Alert.alert('Delete card?', 'This card will be removed from this deck.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await cardsRepo.softDeleteCard(item.id);
                      load();
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
      )}
    </Screen>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    headerButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    emptyWrap: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
    },
    emptySpacer: {
      height: 14,
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
  });
}
