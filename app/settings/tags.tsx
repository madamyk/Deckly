import { createTag, listAllTags, removeTagEverywhere } from '@/data/repositories/tagsRepo';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TagsSettingsScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setTags(await listAllTags());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const addTag = useCallback(async () => {
    const name = newTag.trim().replace(/\s+/g, ' ');
    if (!name) return;
    setSaving(true);
    try {
      await createTag(name);
      setNewTag('');
      await load();
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Failed to create tag.');
    } finally {
      setSaving(false);
    }
  }, [load, newTag]);

  const removeTag = useCallback(async (tag: string) => {
    Alert.alert('Delete tag everywhere?', `Remove "${tag}" from all decks?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await removeTagEverywhere(tag);
            await load();
          } catch (e: any) {
            Alert.alert('Deckly', e?.message ?? 'Failed to delete tag.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [load]);

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Tag Manager' }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
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
            <Pressable onPress={addTag} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Ionicons name="add-circle-outline" size={20} color={theme.colors.textMuted} />
            </Pressable>
          }
        />
        <View style={styles.tagWrap}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
              <Pressable
                onPress={() => removeTag(tag)}
                hitSlop={8}
                style={({ pressed }) => [styles.removeBtn, { opacity: pressed ? 0.7 : 1 }]}
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
        <Button title="Done" onPress={() => router.back()} style={{ borderRadius: 999 }} />
      </View>
    </Screen>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    content: {
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
    removeBtn: {
      borderRadius: 999,
      paddingVertical: 1,
      paddingHorizontal: 1,
    },
    footer: {
      paddingHorizontal: theme.spacing.lg,
    },
  });
}
