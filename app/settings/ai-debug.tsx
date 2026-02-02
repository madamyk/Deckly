import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { format } from 'date-fns';

import { clearAiDebugEntries, listAiDebugEntries, type AiDebugEntry } from '@/ai/debugLog';
import { Button } from '@/ui/components/Button';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { Surface } from '@/ui/components/Surface';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

function formatMode(mode: AiDebugEntry['mode']): string {
  if (mode === 'bulk_all') return 'bulk (all)';
  if (mode === 'bulk_missing') return 'bulk (missing)';
  return 'single';
}

function formatKind(kind: AiDebugEntry['kind']): string {
  if (kind === 'language_pair') return 'language detection';
  if (kind === 'chat') return 'teacher chat';
  return 'example pair';
}

function formatDuration(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  return `${Math.round(ms)} ms`;
}

export default function AiDebugScreen() {
  const t = useDecklyTheme();
  const [items, setItems] = useState<AiDebugEntry[]>([]);
  const [selected, setSelected] = useState<AiDebugEntry | null>(null);

  const load = useCallback(async () => {
    setItems(await listAiDebugEntries());
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function clearAll() {
    Alert.alert('Clear AI logs?', 'This removes debug logs stored on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearAiDebugEntries();
          await load();
        },
      },
    ]);
  }

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'AI Debug' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: 30 }}>
        <View style={{ gap: 10 }}>
          <Text variant="h2">Debug logs</Text>
          <Text variant="muted">
            When AI generation fails, Deckly stores a short prompt/response snapshot locally to help
            diagnose issues. No API key is stored here.
          </Text>
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button title="Refresh" variant="secondary" onPress={load} />
            <Button title="Clear" variant="dangerGhost" onPress={clearAll} />
          </Row>
        </View>

        <View style={{ height: 14 }} />

        {items.length === 0 ? (
          <Text variant="muted">No logs yet.</Text>
        ) : (
          <Surface radius={22} style={{ overflow: 'hidden' }}>
            {items.map((it, idx) => (
              <Pressable
                key={it.id}
                onPress={() => setSelected(it)}
                style={({ pressed }) => ({
                  padding: 14,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                {idx > 0 ? (
                  <View style={{ height: 1, backgroundColor: t.colors.border, marginBottom: 14 }} />
                ) : null}
                <Row align="flex-start">
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ fontWeight: '900' }} numberOfLines={1}>
                      {it.success
                        ? `slow response · ${formatDuration(it.durationMs)}`
                        : `${it.errorCode ?? 'error'}${it.status ? ` (${it.status})` : ''}`}
                    </Text>
                    <Text variant="muted" numberOfLines={2}>
                      {it.front ? `Front: ${it.front}` : 'Front: —'}
                    </Text>
                    <Text variant="muted" numberOfLines={2}>
                      {it.back ? `Back: ${it.back}` : 'Back: —'}
                    </Text>
                    <Text variant="muted">
                      {format(new Date(it.at), 'yyyy-MM-dd HH:mm')} · {formatKind(it.kind)} ·{' '}
                      {formatMode(it.mode)} · {it.model ?? 'model?'}
                    </Text>
                    {it.success ? (
                      <Text variant="muted">
                        Total {formatDuration(it.durationMs)} · OpenAI{' '}
                        {formatDuration(it.processingMs)}
                        {it.requestId ? ` · ${it.requestId}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
                </Row>
              </Pressable>
            ))}
          </Surface>
        )}
      </ScrollView>

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
          <Pressable
            onPress={() => setSelected(null)}
            style={{
              ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          />
          {selected ? (
            <Surface radius={22} style={{ maxHeight: '80%', gap: 10, padding: 16 }}>
              <Row>
                <Text variant="h2">Failure details</Text>
                <Pressable onPress={() => setSelected(null)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={t.colors.textMuted} />
                </Pressable>
              </Row>

              {!selected.success ? (
                <>
                  <Text variant="muted" selectable>
                    {selected.errorMessage ?? '—'}
                  </Text>
                  <View style={{ height: 1, backgroundColor: t.colors.border }} />
                </>
              ) : null}

              <Text variant="label">Timings</Text>
              <Text variant="muted" selectable>
                Total: {formatDuration(selected.durationMs)} · OpenAI:{' '}
                {formatDuration(selected.processingMs)}
                {selected.requestId ? ` · Request: ${selected.requestId}` : ''}
              </Text>

              <Text variant="label">Prompt</Text>
              <ScrollView style={{ maxHeight: 180 }}>
                <Text variant="muted" selectable>
                  {selected.prompt ?? '—'}
                </Text>
              </ScrollView>

              <Text variant="label">Response</Text>
              <ScrollView style={{ maxHeight: 220 }}>
                <Text variant="muted" selectable>
                  {selected.responseText ?? '—'}
                </Text>
              </ScrollView>

              <Button title="Close" variant="secondary" onPress={() => setSelected(null)} />
            </Surface>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}
