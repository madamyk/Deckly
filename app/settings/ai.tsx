import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';

import { getAiApiKey, setAiApiKey } from '@/data/secureStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

export default function AiSettingsScreen() {
  const t = useDecklyTheme();
  const { prefs, patchPrefs } = usePrefsStore();

  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [keyEditorOpen, setKeyEditorOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');

  const group = useMemo(
    () => ({
      borderRadius: 22,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: 'hidden' as const,
    }),
    [t.colors.border, t.colors.surface],
  );

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

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'AI Assist' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: 30 }}>
        <View style={{ gap: 10 }}>
          <Text variant="h2">AI Assist</Text>
          <Text variant="muted">
            Generate bilingual example sentence pairs for your cards. Examples are saved into SQLite for
            offline review.
          </Text>
          <Text variant="muted">
            Uses your own OpenAI API key, runs over the network, and may cost money depending on your plan
            and model.
          </Text>
        </View>

        <View style={{ height: 16 }} />

        <View style={group}>
          <View style={{ padding: 14 }}>
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
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons
                name={aiReady ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={aiReady ? t.colors.success : t.colors.textMuted}
              />
              <Text variant="muted">
                {prefs.ai.enabled ? (apiKeySaved ? 'Enabled' : 'Enabled (missing key)') : 'Disabled'}
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: t.colors.border }} />

          <View style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="label">OpenAI API key</Text>
                <Text style={{ fontWeight: '800' }}>{apiKeySaved ? 'Saved (••••••••)' : 'Not set'}</Text>
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
            {apiKeySaved ? <Button title="Remove key" variant="dangerGhost" onPress={removeKey} /> : null}
            <Text variant="muted">Stored locally using SecureStore.</Text>
          </View>

          <View style={{ height: 1, backgroundColor: t.colors.border }} />

          <View style={{ padding: 14 }}>
            <Text variant="label">Model</Text>
            <Picker
              selectedValue={prefs.ai.model}
              onValueChange={(v) => patchPrefs({ ai: { model: String(v) } })}
            >
              <Picker.Item label="gpt-5" value="gpt-5" />
              <Picker.Item label="gpt-5-mini" value="gpt-5-mini" />
              <Picker.Item label="gpt-5-nano" value="gpt-5-nano" />
              <Picker.Item label="gpt-4.1-mini (default)" value="gpt-4.1-mini" />
              <Picker.Item label="gpt-4o-mini" value="gpt-4o-mini" />
              <Picker.Item label="gpt-4o" value="gpt-4o" />
            </Picker>

            <View style={{ height: 8 }} />
            <Text variant="muted">
              These models use Structured Outputs (JSON schema) for more reliable parsing.
            </Text>

            <View style={{ height: 12 }} />
            <Text variant="label">Example difficulty</Text>
            <Picker
              selectedValue={prefs.ai.level}
              onValueChange={(v) => patchPrefs({ ai: { level: v } as any })}
            >
              <Picker.Item label="A1" value="A1" />
              <Picker.Item label="A2" value="A2" />
              <Picker.Item label="B1 (default)" value="B1" />
              <Picker.Item label="B2" value="B2" />
              <Picker.Item label="C1" value="C1" />
              <Picker.Item label="C2" value="C2" />
            </Picker>

            <View style={{ height: 12 }} />
            <Text variant="label">Example domain</Text>
            <Picker
              selectedValue={prefs.ai.domain}
              onValueChange={(v) => patchPrefs({ ai: { domain: v } as any })}
            >
              <Picker.Item label="daily (default)" value="daily" />
              <Picker.Item label="travel" value="travel" />
              <Picker.Item label="work" value="work" />
              <Picker.Item label="neutral" value="neutral" />
            </Picker>
          </View>
        </View>

        <View style={{ height: 12 }} />
        <Pressable
          onPress={() => router.push('/settings/ai-debug')}
          style={({ pressed }) => ({
            paddingVertical: 10,
            opacity: pressed ? 0.75 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}
        >
          <Text variant="muted" style={{ fontWeight: '700' }}>
            View AI debug logs
          </Text>
          <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
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
        <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
          <Pressable
            onPress={() => {
              setKeyEditorOpen(false);
              setKeyDraft('');
            }}
            style={{
              ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          />
          <View
            style={{
              borderRadius: 22,
              padding: 16,
              backgroundColor: t.colors.surface,
              borderWidth: 1,
              borderColor: t.colors.border,
              gap: 10,
            }}
          >
            <Text variant="h2">{apiKeySaved ? 'Replace API key' : 'Add API key'}</Text>
            <Text variant="muted">
              This key stays on your device (SecureStore). Requests go directly to OpenAI.
            </Text>
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
            <View style={{ height: 4 }} />
            <View style={{ gap: 10 }}>
              <Button title="Save key" onPress={saveKey} />
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setKeyEditorOpen(false);
                  setKeyDraft('');
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ToggleRow(props: { label: string; value: boolean; onToggle: (next: boolean) => void }) {
  const t = useDecklyTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={{ fontWeight: '700' }}>{props.label}</Text>
      <Pressable
        onPress={() => props.onToggle(!props.value)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: props.value ? t.colors.primary : t.colors.surface,
          borderWidth: 1,
          borderColor: props.value ? 'transparent' : t.colors.border,
        }}
      >
        <Text style={{ color: props.value ? '#fff' : t.colors.text, fontWeight: '900' }}>
          {props.value ? 'On' : 'Off'}
        </Text>
      </Pressable>
    </View>
  );
}
