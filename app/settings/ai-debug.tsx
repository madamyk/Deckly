import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerStack}>
          <Text variant="h2">Debug logs</Text>
          <Text variant="muted">
            When AI generation fails, Deckly stores a short prompt/response snapshot locally to help
            diagnose issues. No API key is stored here.
          </Text>
          <Row style={styles.headerActions}>
            <Button title="Refresh" variant="secondary" onPress={load} />
            <Button title="Clear" variant="dangerGhost" onPress={clearAll} />
          </Row>
        </View>

        <View style={styles.sectionSpacer} />

        {items.length === 0 ? (
          <Text variant="muted">No logs yet.</Text>
        ) : (
          <Surface radius={22} style={styles.logSurface}>
            {items.map((it, idx) => (
              <Pressable
                key={it.id}
                onPress={() => setSelected(it)}
                style={({ pressed }) => [styles.logItem, { opacity: pressed ? 0.85 : 1 }]}
              >
                {idx > 0 ? (
                  <View style={styles.logDivider} />
                ) : null}
                <Row align="flex-start">
                  <View style={styles.logContent}>
                    <Text style={styles.logTitle} numberOfLines={1}>
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
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
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
        <View style={styles.modalRoot}>
          <Pressable
            onPress={() => setSelected(null)}
            style={styles.modalBackdrop}
          />
          {selected ? (
            <Surface radius={22} style={styles.modalCard}>
              <Row>
                <Text variant="h2">Failure details</Text>
                <Pressable onPress={() => setSelected(null)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={theme.colors.textMuted} />
                </Pressable>
              </Row>

              {!selected.success ? (
                <>
                  <Text variant="muted" selectable>
                    {selected.errorMessage ?? '—'}
                  </Text>
                  <View style={styles.modalDivider} />
                </>
              ) : null}

              <Text variant="label">Timings</Text>
              <Text variant="muted" selectable>
                Total: {formatDuration(selected.durationMs)} · OpenAI:{' '}
                {formatDuration(selected.processingMs)}
                {selected.requestId ? ` · Request: ${selected.requestId}` : ''}
              </Text>

              <Text variant="label">Prompt</Text>
              <ScrollView style={styles.promptScroll}>
                <Text variant="muted" selectable>
                  {selected.prompt ?? '—'}
                </Text>
              </ScrollView>

              <Text variant="label">Response</Text>
              <ScrollView style={styles.responseScroll}>
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

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    scrollContent: {
      padding: theme.spacing.lg,
      paddingBottom: 30,
    },
    headerStack: {
      gap: 10,
    },
    headerActions: {
      justifyContent: 'flex-end',
    },
    sectionSpacer: {
      height: 14,
    },
    logSurface: {
      overflow: 'hidden',
    },
    logItem: {
      padding: 14,
    },
    logDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginBottom: 14,
    },
    logContent: {
      flex: 1,
      gap: 6,
    },
    logTitle: {
      fontWeight: '900' as const,
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
      maxHeight: '80%',
      gap: 10,
      padding: 16,
    },
    modalDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
    promptScroll: {
      maxHeight: 180,
    },
    responseScroll: {
      maxHeight: 220,
    },
  });
}
