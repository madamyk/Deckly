import Ionicons from '@expo/vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

import { getAiApiKey, setAiApiKey } from '@/data/secureStore';
import { AI_MODELS } from '@/domain/aiModels';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/ui/components/Button';
import { InfoModal } from '@/ui/components/InfoModal';
import { Input } from '@/ui/components/Input';
import { Screen } from '@/ui/components/Screen';
import { Surface } from '@/ui/components/Surface';
import { Text } from '@/ui/components/Text';
import { ToggleRow } from '@/ui/components/ToggleRow';
import { useDecklyTheme } from '@/ui/theme/provider';

export default function AiSettingsScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { prefs, patchPrefs } = usePrefsStore();

  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [keyEditorOpen, setKeyEditorOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [modelOpen, setModelOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [levelInfoOpen, setLevelInfoOpen] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [reasoningInfoOpen, setReasoningInfoOpen] = useState(false);
  const keyboard = useAnimatedKeyboard();
  const modalShiftStyle = useAnimatedStyle(() => {
    const lift = Math.min(120, keyboard.height.value * 0.35);
    return { transform: [{ translateY: -lift }] };
  });

  const refreshKey = useCallback(async () => {
    const key = await getAiApiKey();
    setApiKeySaved(!!key);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshKey();
    }, [refreshKey]),
  );

  async function saveKey() {
    const trimmed = keyDraft.trim();
    if (!trimmed) {
      Alert.alert('Deckly', 'Paste your OpenAI API key first.');
      return;
    }
    await setAiApiKey(trimmed);
    setApiKeySaved(true);
    setKeyDraft('');
    setKeyEditorOpen(false);
    Alert.alert('Deckly', 'API key saved on this device (SecureStore).');
  }

  async function removeKey() {
    await setAiApiKey(null);
    setApiKeySaved(false);
    setKeyDraft('');
    setKeyEditorOpen(false);
    if (prefs.ai.enabled) {
      await patchPrefs({ ai: { enabled: false } });
    }
    Alert.alert('Deckly', 'API key removed.');
  }

  const aiReady = prefs.ai.enabled && apiKeySaved;
  const modelLabel = AI_MODELS.find((m) => m.value === prefs.ai.model)?.label ?? prefs.ai.model;
  const levelLabel =
    prefs.ai.level === 'easy'
      ? 'Easy'
      : prefs.ai.level === 'advanced'
        ? 'Advanced'
        : 'Medium (default)';
  const reasoningLabel =
    prefs.ai.reasoningEffort === 'high'
      ? 'High'
      : prefs.ai.reasoningEffort === 'medium'
        ? 'Medium'
        : 'Low (default)';

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'AI Assist' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.introStack}>
          <Text variant="h2">AI Assist</Text>
          <Text variant="muted">
            Generate bilingual example sentence pairs and short notes for your cards when requested.
          </Text>
          <Text variant="muted">Uses your OpenAI API key, runs over the network, and may cost money.</Text>
        </View>

        <View style={styles.sectionSpacer} />

        <View style={styles.sectionStack}>
          <View style={styles.blockStack}>
            <ToggleRow
              label="Enable AI features"
              value={prefs.ai.enabled}
              onToggle={async (next) => {
                if (next && !apiKeySaved) {
                  Alert.alert('Deckly', 'Add an OpenAI API key to enable AI Assist.');
                  setKeyEditorOpen(true);
                  return;
                }
                await patchPrefs({ ai: { enabled: next } });
              }}
            />
            <View style={styles.statusSpacer} />
            <View style={styles.statusRow}>
              <Ionicons
                name={aiReady ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={aiReady ? theme.colors.success : theme.colors.textMuted}
              />
              <Text variant="muted">
                {prefs.ai.enabled ? (apiKeySaved ? 'Enabled' : 'Enabled (missing key)') : 'Disabled'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.blockStack}>
            <View style={styles.rowBetween}>
              <View style={styles.rowInfo}>
                <Text variant="label">OpenAI API key</Text>
                <Text style={styles.rowValue}>{apiKeySaved ? 'Saved (••••••••)' : 'Not set'}</Text>
              </View>
              <Button
                title={apiKeySaved ? 'Change' : 'Add'}
                variant="ghost"
                onPress={() => {
                  setKeyDraft('');
                  setKeyEditorOpen(true);
                }}
              />
            </View>
            <Text variant="muted">Stored locally on this device.</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.sectionInner}>
            <View style={styles.blockStack}>
              <View style={styles.rowBetween}>
                <View style={styles.rowInfo}>
                  <Text variant="label">Model</Text>
                  <Text style={styles.rowValue}>{modelLabel}</Text>
                </View>
                <Button
                  title={modelOpen ? 'Done' : 'Change'}
                  variant="ghost"
                  onPress={() => setModelOpen((prev) => !prev)}
                />
              </View>
              {modelOpen ? (
                <Picker
                  selectedValue={prefs.ai.model}
                  onValueChange={(v) => patchPrefs({ ai: { model: String(v) } })}
                >
                  {AI_MODELS.map((m) => (
                    <Picker.Item key={m.value} label={m.label} value={m.value} />
                  ))}
                </Picker>
              ) : null}
            </View>

            <View style={styles.blockStack}>
              <View style={styles.rowBetween}>
                <View style={styles.rowInfo}>
                  <View style={styles.labelRow}>
                    <Text variant="label">Reasoning</Text>
                    <Pressable
                      onPress={() => setReasoningInfoOpen(true)}
                      hitSlop={10}
                      style={({ pressed }) => [styles.infoButton, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
                    </Pressable>
                  </View>
                  <Text style={styles.rowValue}>{reasoningLabel}</Text>
                </View>
                <Button
                  title={reasoningOpen ? 'Done' : 'Change'}
                  variant="ghost"
                  onPress={() => setReasoningOpen((prev) => !prev)}
                />
              </View>
              {reasoningOpen ? (
                <Picker
                  selectedValue={prefs.ai.reasoningEffort}
                  onValueChange={(v) => patchPrefs({ ai: { reasoningEffort: v } as any })}
                >
                  <Picker.Item label="Low (default)" value="low" />
                  <Picker.Item label="Medium" value="medium" />
                  <Picker.Item label="High" value="high" />
                </Picker>
              ) : null}
            </View>

            <View style={styles.blockStack}>
              <View style={styles.rowBetween}>
                <View style={styles.rowInfo}>
                  <View style={styles.labelRow}>
                    <Text variant="label">Language level</Text>
                    <Pressable
                      onPress={() => setLevelInfoOpen(true)}
                      hitSlop={10}
                      style={({ pressed }) => [styles.infoButton, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
                    </Pressable>
                  </View>
                  <Text style={styles.rowValue}>{levelLabel}</Text>
                </View>
                <Button
                  title={levelOpen ? 'Done' : 'Change'}
                  variant="ghost"
                  onPress={() => setLevelOpen((prev) => !prev)}
                />
              </View>
              {levelOpen ? (
                <Picker
                  selectedValue={prefs.ai.level}
                  onValueChange={(v) => patchPrefs({ ai: { level: v } as any })}
                >
                  <Picker.Item label="Easy" value="easy" />
                  <Picker.Item label="Medium (default)" value="medium" />
                  <Picker.Item label="Advanced" value="advanced" />
                </Picker>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.footerSpacer} />
        <Pressable
          onPress={() => router.push('/settings/ai-debug')}
          style={({ pressed }) => ({
            ...styles.debugLink,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text variant="muted" style={styles.debugText}>
            View AI debug logs
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </ScrollView>

      <Modal
        visible={keyEditorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setKeyEditorOpen(false);
          setKeyDraft('');
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            onPress={() => {
              setKeyEditorOpen(false);
              setKeyDraft('');
            }}
            style={styles.modalBackdrop}
          />
          <Animated.View style={modalShiftStyle}>
            <Surface radius={22} style={styles.modalCard}>
              <Text variant="h2">{apiKeySaved ? 'Replace API key' : 'Add API key'}</Text>
              <Text variant="muted">This key stays on your device. Requests go directly to OpenAI.</Text>
              <Input
                label="OpenAI API key"
                value={keyDraft}
                onChangeText={setKeyDraft}
                placeholder="sk-…"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable
              />
              <View style={styles.modalSpacer} />
              <View style={styles.modalActions}>
                <Button title="Save key" onPress={saveKey} />
                {apiKeySaved ? <Button title="Remove key" variant="dangerGhost" onPress={removeKey} /> : null}
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setKeyEditorOpen(false);
                    setKeyDraft('');
                  }}
                />
              </View>
            </Surface>
          </Animated.View>
        </View>
      </Modal>

      <InfoModal
        visible={reasoningInfoOpen}
        title="Reasoning"
        onClose={() => setReasoningInfoOpen(false)}
      >
        <Text variant="muted">
          Controls how much reasoning the model uses. Higher settings can improve quality, but they
          take longer and may cost more.
        </Text>
      </InfoModal>

      <InfoModal
        visible={levelInfoOpen}
        title="Language level"
        onClose={() => setLevelInfoOpen(false)}
      >
        <Text variant="muted">
          Sets how simple or advanced the generated example sentences should be. Choose Easy for
          beginner-friendly language, or Advanced for more natural, nuanced usage.
        </Text>
      </InfoModal>
    </Screen>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    scrollContent: {
      padding: theme.spacing.lg,
      paddingBottom: 30,
    },
    introStack: {
      gap: 10,
    },
    sectionSpacer: {
      height: 16,
    },
    sectionStack: {
      gap: 18,
    },
    sectionInner: {
      gap: 14,
    },
    blockStack: {
      gap: 10,
    },
    statusSpacer: {
      height: 10,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    rowInfo: {
      flex: 1,
      gap: 4,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoButton: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowValue: {
      fontWeight: '800' as const,
    },
    footerSpacer: {
      height: 12,
    },
    debugLink: {
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    debugText: {
      fontWeight: '700' as const,
    },
    modalRoot: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
    },
    modalBackdrop: {
      ...(StyleSheet.absoluteFillObject as object),
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modalCard: {
      gap: 10,
      padding: 16,
    },
    modalSpacer: {
      height: 4,
    },
    modalActions: {
      gap: 10,
    },
  });
}
