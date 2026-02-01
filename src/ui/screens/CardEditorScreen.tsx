import { Stack, router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import type { Card } from '@/domain/models';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Pill } from '@/ui/components/Pill';
import { cardStateLabel, cardStateTone } from '@/ui/components/cardStatePill';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useKeyboardVisible } from '@/ui/hooks/useKeyboardVisible';
import { useDecklyTheme } from '@/ui/theme/provider';
import { formatShortDateTime } from '@/utils/time';

export function CardEditorScreen(props: {
  mode: 'create' | 'edit';
  deckId: string;
  cardId?: string;
}) {
  const t = useDecklyTheme();
  const headerHeight = useHeaderHeight();
  const keyboardVisible = useKeyboardVisible();
  const [card, setCard] = useState<Card | null>(null);
  const [initialFront, setInitialFront] = useState('');
  const [initialBack, setInitialBack] = useState('');
  const [initialExample, setInitialExample] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [example, setExample] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (props.mode !== 'edit' || !props.cardId) return;
    const c = await cardsRepo.getCard(props.cardId);
    setCard(c);
    const f = c?.front ?? '';
    const b = c?.back ?? '';
    const e = c?.example ?? '';
    setInitialFront(f);
    setInitialBack(b);
    setInitialExample(e);
    setFront(f);
    setBack(b);
    setExample(e);
  }, [props.mode, props.cardId]);

  useEffect(() => {
    load();
  }, [load]);

  const isDirty =
    props.mode === 'create'
      ? front.length > 0 || back.length > 0 || example.length > 0
      : front !== initialFront || back !== initialBack || example !== initialExample;
  const canSave = !saving && isDirty && front.trim().length > 0 && back.trim().length > 0;

  async function save() {
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) {
      Alert.alert('Deckly', 'Front and Back are required.');
      return;
    }
    setSaving(true);
    try {
      if (props.mode === 'create') {
        await cardsRepo.createCard({ deckId: props.deckId, front: f, back: b, example });
        router.back();
      } else {
        if (!props.cardId) return;
        await cardsRepo.updateCard(props.cardId, { front: f, back: b, example });
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Failed to save card.');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!props.cardId) return;
    Alert.alert('Delete card?', 'This will remove the card from the deck.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cardsRepo.softDeleteCard(props.cardId!);
          router.back();
        },
      },
    ]);
  }

  return (
    // With a native Stack header, avoid top safe-area padding (it creates a "blank band" below the header).
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: props.mode === 'create' ? 'New Card' : 'Edit Card' }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: 40 }}
        >
          <View style={{ gap: 14 }}>
            <Input label="Front" value={front} onChangeText={setFront} placeholder="Prompt..." />
            <Input label="Back" value={back} onChangeText={setBack} placeholder="Answer..." />
            <Input
              label="Example"
              value={example}
              onChangeText={setExample}
              placeholder="Optional example..."
              multiline
              style={{ minHeight: 90, textAlignVertical: 'top' }}
            />

            <View style={{ height: 2 }} />

            <View style={{ gap: 10 }}>
              <Button title={saving ? 'Saving...' : 'Save'} onPress={save} disabled={!canSave} />
              {props.mode === 'edit' && !keyboardVisible ? (
                <Button title="Delete" variant="dangerGhost" onPress={del} />
              ) : null}
            </View>

            {card && !keyboardVisible ? (
              <View
                style={{
                  marginTop: 10,
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: t.colors.surface2,
                }}
              >
                <Text variant="label">Scheduling</Text>
                <View style={{ height: 8 }} />
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Text variant="muted">State:</Text>
                    <Pill label={cardStateLabel(card.state)} tone={cardStateTone(card.state)} />
                  </View>
                  <StatRow label="Due">{formatShortDateTime(card.dueAt)}</StatRow>
                  <StatRow label="Interval">{card.intervalDays} days</StatRow>
                  <StatRow label="Ease">{card.ease.toFixed(2)}</StatRow>
                  <StatRow label="Reps">{card.reps}</StatRow>
                  <StatRow label="Lapses">{card.lapses}</StatRow>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function StatRow(props: { label: string; children: React.ReactNode }) {
  const t = useDecklyTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <Text variant="muted" style={{ fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
        {props.label}:
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '700', color: t.colors.text }}>
        {props.children}
      </Text>
    </View>
  );
}
