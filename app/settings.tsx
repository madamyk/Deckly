import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { getAiApiKey } from '@/data/secureStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/ui/components/Button';
import { InfoModal } from '@/ui/components/InfoModal';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { ToggleRow } from '@/ui/components/ToggleRow';
import { useDecklyTheme } from '@/ui/theme/provider';

export default function SettingsScreen() {
  const t = useDecklyTheme();
  const { prefs, patchPrefs } = usePrefsStore();

  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [aiInfoOpen, setAiInfoOpen] = useState(false);
  const appVersion =
    Constants.expoConfig?.version ?? (Constants as any)?.manifest?.version ?? '1.0.0';
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
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: 20 }}>
          <View style={{ gap: 20 }}>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="h2" style={{ flex: 1 }}>
                  AI Assist
                </Text>
                <Pressable
                  onPress={() => setAiInfoOpen(true)}
                  hitSlop={10}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Ionicons name="information-circle-outline" size={18} color={t.colors.textMuted} />
                </Pressable>
              </View>

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
              <Button
                title="Configure AI Assist"
                variant="secondary"
                onPress={() => router.push('/settings/ai')}
                style={{ borderRadius: 999 }}
              />
            </View>
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: 10 }}>
          <Text
            variant="muted"
            style={{ textAlign: 'center', fontSize: 12, opacity: 0.7 }}
          >{`Version ${appVersion}`}</Text>
        </View>
      </View>

      <InfoModal visible={aiInfoOpen} title="AI Assist" onClose={() => setAiInfoOpen(false)}>
        <Text variant="muted">
          Uses your OpenAI API key to generate bilingual example sentence pairs and short notes
          for cards when you request it. You can review and edit the results.
        </Text>
      </InfoModal>
    </Screen>
  );
}
