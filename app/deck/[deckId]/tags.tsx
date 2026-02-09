import { getDeckTags, listAllTags, setDeckTags } from '@/data/repositories/tagsRepo';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export default function DeckTagsScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();

  const [tags, setTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [deckTags, existingTags] = await Promise.all([getDeckTags(deckId), listAllTags()]);
    setTags(deckTags);
    setAllTags(existingTags);
  }, [deckId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const persist = useCallback(
    async (nextTags: string[]) => {
      setSaving(true);
      try {
        await setDeckTags(deckId, nextTags);
        setTags(nextTags);
        setAllTags(await listAllTags());
      } catch (e: any) {
        Alert.alert('Deckly', e?.message ?? 'Failed to update tags.');
      } finally {
        setSaving(false);
      }
    },
    [deckId],
  );

  const addTag = useCallback(async () => {
    const normalized = normalizeTagName(newTag);
    if (!normalized) return;
    const exists = tags.some((tag) => tag.toLocaleLowerCase() === normalized.toLocaleLowerCase());
    if (exists) {
      setNewTag('');
      return;
    }
    const next = [...tags, normalized].sort((a, b) => a.localeCompare(b));
    setNewTag('');
    await persist(next);
  }, [newTag, persist, tags]);

  const removeTag = useCallback(
    async (tagToRemove: string) => {
      const next = tags.filter((tag) => tag !== tagToRemove);
      await persist(next);
    },
    [persist, tags],
  );

  const HeaderLeft = useCallback(
    () => (
      <Pressable
        hitSlop={10}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
      </Pressable>
    ),
    [styles.headerButton, theme.colors.text],
  );

  const suggestions = useMemo(() => {
    const q = newTag.trim().toLocaleLowerCase();
    const selected = new Set(tags.map((t) => t.toLocaleLowerCase()));
    const pool = allTags.filter((tag) => !selected.has(tag.toLocaleLowerCase()));
    if (!q) return pool.slice(0, 16);
    return pool.filter((tag) => tag.toLocaleLowerCase().includes(q)).slice(0, 16);
  }, [allTags, newTag, tags]);
  const canAddTag = newTag.trim().length > 0;

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Tags',
          headerLeft: HeaderLeft,
        }}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 24 }]}
      >
        <Input
          label="New tag"
          value={newTag}
          onChangeText={setNewTag}
          placeholder="e.g. Spanish - B1"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={addTag}
          right={
            canAddTag ? (
              <Pressable
                onPress={addTag}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.colors.textMuted} />
              </Pressable>
            ) : null
          }
        />

        {suggestions.length ? (
          <View style={styles.suggestionsWrap}>
            <Text variant="label">Suggestions</Text>
            <View style={styles.tagWrap}>
              {suggestions.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={async () => {
                    const exists = tags.some((t) => t.toLocaleLowerCase() === tag.toLocaleLowerCase());
                    if (!exists) {
                      await persist([...tags, tag].sort((a, b) => a.localeCompare(b)));
                    }
                    setNewTag('');
                  }}
                  style={({ pressed }) => [styles.suggestionPill, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={styles.suggestionText}>{tag}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.tagWrap}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
              <Pressable
                onPress={() => removeTag(tag)}
                hitSlop={8}
                style={({ pressed }) => [styles.removeTagButton, { opacity: pressed ? 0.7 : 1 }]}
                disabled={saving}
              >
                <Ionicons name="close" size={14} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ))}
          {!tags.length ? <Text variant="muted">No tags yet.</Text> : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>
        <Button title="Done" onPress={() => router.back()} disabled={saving} style={{ borderRadius: 999 }} />
      </View>
    </Screen>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    headerButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    contentContainer: {
      padding: theme.spacing.lg,
      gap: 14,
      paddingBottom: 110,
    },
    tagWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tagPill: {
      borderRadius: 999,
      paddingLeft: 12,
      paddingRight: 8,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tagText: {
      color: theme.colors.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600' as const,
    },
    suggestionsWrap: {
      gap: 8,
    },
    suggestionPill: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    suggestionText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500' as const,
    },
    removeTagButton: {
      paddingVertical: 1,
      paddingHorizontal: 1,
      borderRadius: 999,
    },
    footer: {
      paddingHorizontal: theme.spacing.lg,
    },
  });
}
