import React from 'react';
import { Alert, View } from 'react-native';

import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';
import { disabledAiAssistProvider } from '@/ai/disabledProvider';

export default function SettingsScreen() {
  const t = useDecklyTheme();
  return (
    <Screen>
      <Card style={{ padding: 16, gap: 10 }}>
        <Text variant="h2">AI Assist (coming soon)</Text>
        <Text variant="muted">
          Deckly is built so an AI provider can be plugged in later (explain cards, generate
          examples), but this MVP is fully offline.
        </Text>

        <View style={{ height: 6 }} />
        <Text variant="label">Status</Text>
        <Text variant="mono" style={{ color: t.colors.textMuted }}>
          disabled
        </Text>

        <View style={{ height: 10 }} />
        <Text variant="label">Placeholder actions</Text>
        <Text
          style={{ color: t.colors.primary, fontWeight: '900' }}
          onPress={async () => {
            try {
              await disabledAiAssistProvider.explainCard({ front: 'Q', back: 'A' });
            } catch (e: any) {
              Alert.alert('Deckly', e?.message ?? 'AI Assist is disabled.');
            }
          }}
        >
          Test stub (shows "disabled" error)
        </Text>
      </Card>
    </Screen>
  );
}

