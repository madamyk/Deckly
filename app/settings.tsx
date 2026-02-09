import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getAiApiKey } from '@/data/secureStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/ui/components/Button';
import { InfoModal } from '@/ui/components/InfoModal';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { ToggleRow } from '@/ui/components/ToggleRow';
import { useDecklyTheme } from '@/ui/theme/provider';

export default function SettingsScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.sectionStack}>
            <View style={styles.cardStack}>
              <View style={styles.sectionHeader}>
                <Text variant="h2" style={styles.sectionTitle}>
                  AI Assist
                </Text>
                <Pressable
                  onPress={() => setAiInfoOpen(true)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
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

              <View style={styles.statusSpacer} />
              <View style={styles.statusRow}>
                <Ionicons
                  name={prefs.ai.enabled && apiKeySaved ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={prefs.ai.enabled && apiKeySaved ? theme.colors.success : theme.colors.textMuted}
                />
                <Text variant="muted">
                  {prefs.ai.enabled ? (apiKeySaved ? 'Enabled' : 'Enabled (missing key)') : 'Disabled'} · Model{' '}
                  {prefs.ai.model}
                </Text>
              </View>

              <View style={styles.actionSpacer} />
              <Button
                title="Configure AI Assist"
                variant="secondary"
                onPress={() => router.push('/settings/ai')}
                style={styles.configureButton}
              />
              <View style={styles.tagsSpacer} />
              <Button
                title="Tag Manager"
                variant="secondary"
                onPress={() => router.push('/settings/tags')}
                style={styles.configureButton}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.versionWrap}>
          <Text variant="muted" style={styles.versionText}>{`Version ${appVersion}`}</Text>
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

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.spacing.lg,
      paddingBottom: 20,
    },
    sectionStack: {
      gap: 20,
    },
    cardStack: {
      gap: 10,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      flex: 1,
    },
    iconButton: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusSpacer: {
      height: 10,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    actionSpacer: {
      height: 12,
    },
    tagsSpacer: {
      height: 8,
    },
    configureButton: {
      borderRadius: 999,
    },
    versionWrap: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: 10,
    },
    versionText: {
      textAlign: 'center',
      fontSize: 12,
      opacity: 0.7,
    },
  });
}
