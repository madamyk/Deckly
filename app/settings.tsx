import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { getAiApiKey } from '@/data/secureStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/ui/components/Button';
import { Screen } from '@/ui/components/Screen';
import { Surface } from '@/ui/components/Surface';
import { Text } from '@/ui/components/Text';
import { ToggleRow } from '@/ui/components/ToggleRow';
import { useDecklyTheme } from '@/ui/theme/provider';

export default function SettingsScreen() {
  const t = useDecklyTheme();
  const { prefs, patchPrefs } = usePrefsStore();

  const [apiKeySaved, setApiKeySaved] = useState(false);
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const key = await getAiApiKey();
        setApiKeySaved(!!key);
      })();
    }, []),
  );

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: 30 }}>
        <View style={{ gap: 12 }}>
          <Surface tone="muted" padding={14}>
            <Text variant="h2">Review</Text>
            <View style={{ height: 10 }} />

            <ToggleRow
              label="Show examples on front"
              value={prefs.review.showExamplesOnFront}
              onToggle={(v) => patchPrefs({ review: { showExamplesOnFront: v } })}
            />
            <ToggleRow
              label="Show examples on back"
              value={prefs.review.showExamplesOnBack}
              onToggle={(v) => patchPrefs({ review: { showExamplesOnBack: v } })}
            />
            <ToggleRow
              label="Examples collapsed by default"
              value={prefs.review.examplesCollapsedByDefault}
              onToggle={(v) => patchPrefs({ review: { examplesCollapsedByDefault: v } })}
            />
          </Surface>

          <Surface tone="muted" padding={14}>
            <Text variant="h2">AI Assist</Text>
            <View style={{ height: 6 }} />
            <Text variant="muted">Optional. BYO OpenAI key. Examples are saved offline to SQLite.</Text>

            <View style={{ height: 12 }} />
            <ToggleRow
              label="Enable AI features"
              value={prefs.ai.enabled}
              onToggle={async (next) => {
                if (!next) {
                  await patchPrefs({ ai: { enabled: false } });
                  return;
                }
                if (!apiKeySaved) {
                  Alert.alert('Deckly', 'To enable AI features, add an API key first.');
                  router.push('/settings/ai');
                  return;
                }
                await patchPrefs({ ai: { enabled: true } });
              }}
            />

            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons
                name={prefs.ai.enabled && apiKeySaved ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={prefs.ai.enabled && apiKeySaved ? t.colors.success : t.colors.textMuted}
              />
              <Text variant="muted">
                {prefs.ai.enabled ? (apiKeySaved ? 'Enabled' : 'Enabled (missing key)') : 'Disabled'} · Model{' '}
                {prefs.ai.model}
              </Text>
            </View>

            <View style={{ height: 12 }} />
            <Button title="Configure AI Assist" variant="secondary" onPress={() => router.push('/settings/ai')} />
          </Surface>
        </View>
      </ScrollView>
    </Screen>
  );
}
