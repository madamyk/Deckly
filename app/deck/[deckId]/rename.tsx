import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { getDeck } from '@/data/repositories/decksRepo';
import { useDecksStore } from '@/stores/decksStore';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Input } from '@/ui/components/Input';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

export default function RenameDeckScreen() {
  const t = useDecklyTheme();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { renameDeck } = useDecksStore();

  const [initialName, setInitialName] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await getDeck(deckId);
    if (!d) return;
    setInitialName(d.name);
    setName(d.name);
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  const canSave = useMemo(() => {
    const trimmed = name.trim();
    return !saving && trimmed.length > 0 && trimmed !== initialName;
  }, [name, initialName, saving]);

  const doSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await renameDeck(deckId, name.trim());
      router.back();
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Failed to rename deck.');
    } finally {
      setSaving(false);
    }
  }, [canSave, deckId, name, renameDeck]);

  const headerLeft = useMemo(
    () => () => (
      <Pressable
        hitSlop={10}
        onPress={() => router.back()}
        style={{ paddingHorizontal: 8, paddingVertical: 6 }}
      >
        <Ionicons name="close" size={22} color={t.colors.text} />
      </Pressable>
    ),
    [t.colors.text],
  );

  const headerRight = useMemo(
    () => () => (
      <Pressable
        hitSlop={10}
        onPress={doSave}
        disabled={!canSave}
        style={{ paddingHorizontal: 8, paddingVertical: 6, opacity: canSave ? 1 : 0.4 }}
      >
        <Text style={{ color: t.colors.primary, fontWeight: '900' }}>Save</Text>
      </Pressable>
    ),
    [canSave, doSave, t.colors.primary],
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Rename deck', headerLeft, headerRight }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        style={{ flex: 1 }}
      >
        <Card style={{ padding: 16, gap: 12 }}>
          <Text variant="h2">Edit name</Text>
          <Input
            label="Deck name"
            value={name}
            onChangeText={setName}
            placeholder="e.g., Spanish - Basics"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={doSave}
          />
          <View style={{ height: 4 }} />
          <Button
            title={saving ? 'Saving...' : 'Save'}
            onPress={doSave}
            disabled={!canSave}
          />
          <Text variant="muted">Tip: the Save button enables only after you change something.</Text>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}
