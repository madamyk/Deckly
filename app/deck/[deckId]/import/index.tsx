import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Papa from 'papaparse';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import { getExampleLevel } from '@/data/repositories/deckPrefsRepo';
import { getAiApiKey } from '@/data/secureStore';
import type { ExampleSource } from '@/domain/models';
import { ensureDeckLanguages } from '@/services/deckLanguageService';
import { generateExamplePairsInMemory } from '@/services/examplePairService';
import { useImportResultStore } from '@/stores/importResultStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { Button } from '@/ui/components/Button';
import { InfoModal } from '@/ui/components/InfoModal';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { Surface } from '@/ui/components/Surface';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';
import { makeId } from '@/utils/id';

type ParsedCsv = {
  fileName: string;
  uri: string;
  rows: string[][];
};

type ColItem = { label: string; value: number | null };
const IMPORT_KEEP_AWAKE_TAG = 'deckly-import-csv';

function asStringCell(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

function normalizeHeaderCell(v: string): string {
  return v.trim().toLowerCase();
}

export default function ImportCsvScreen() {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { prefs } = usePrefsStore();

  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [dedupe, setDedupe] = useState(true);
  const [dedupeInfoOpen, setDedupeInfoOpen] = useState(false);
  const [frontCol, setFrontCol] = useState<number | null>(0);
  const [backCol, setBackCol] = useState<number | null>(1);
  const [exampleL1Col, setExampleL1Col] = useState<number | null>(null);
  const [exampleL2Col, setExampleL2Col] = useState<number | null>(null);
  const [exampleNoteCol, setExampleNoteCol] = useState<number | null>(null);

  const [aiKeyPresent, setAiKeyPresent] = useState(false);
  const [generateExamples, setGenerateExamples] = useState(false);
  const [aiTogglesTouched, setAiTogglesTouched] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importPhase, setImportPhase] = useState<
    null | 'detecting_languages' | 'writing_cards' | 'generating_examples'
  >(null);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number; failed: number } | null>(
    null,
  );
  const [hasBatchResponse, setHasBatchResponse] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const allowNavRef = useRef(false);
  const progressFrac = useSharedValue(0);
  const progressBarWidth = useSharedValue(0);
  const indeterminate = useSharedValue(0);

  useEffect(() => {
    const frac = genProgress?.total ? genProgress.done / genProgress.total : 0;
    progressFrac.value = withTiming(Math.max(0, Math.min(1, frac)), { duration: 220 });
  }, [genProgress?.done, genProgress?.total, progressFrac]);

  const progressFillStyle = useAnimatedStyle(() => {
    return {
      width: progressBarWidth.value * progressFrac.value,
    };
  });

  const indeterminateFillStyle = useAnimatedStyle(() => {
    const barWidth = Math.max(40, progressBarWidth.value * 0.35);
    const travel = Math.max(0, progressBarWidth.value - barWidth);
    return {
      width: barWidth,
      transform: [{ translateX: indeterminate.value * travel }],
    };
  });

  const showIndeterminate = !!genProgress && !hasBatchResponse;
  const animateIndeterminate = !!genProgress;

  useEffect(() => {
    cancelAnimation(indeterminate);
    if (animateIndeterminate) {
      indeterminate.value = 0;
      indeterminate.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      indeterminate.value = 0;
    }
  }, [animateIndeterminate, indeterminate]);

  const rows = useMemo(() => parsed?.rows ?? [], [parsed]);
  const headerRow = useMemo(() => (hasHeader ? rows[0] ?? [] : []), [hasHeader, rows]);
  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [hasHeader, rows]);

  const columnCount = useMemo(() => {
    let max = 0;
    for (const row of rows.slice(0, 50)) max = Math.max(max, row.length);
    return max;
  }, [rows]);

  function firstOtherIndex(exclude: number): number | null {
    for (let i = 0; i < columnCount; i++) {
      if (i !== exclude) return i;
    }
    return null;
  }

  const previewRows = useMemo(() => dataRows.slice(0, 3), [dataRows]);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const k = await getAiApiKey();
        setAiKeyPresent(!!k);
      })();
    }, []),
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!importing) return;
    void activateKeepAwakeAsync(IMPORT_KEEP_AWAKE_TAG).catch(() => {
      // Non-fatal; import can continue without wake lock.
    });
    return () => {
      void deactivateKeepAwake(IMPORT_KEEP_AWAKE_TAG).catch(() => {
        // Best-effort release.
      });
    };
  }, [importing]);

  const confirmCancelImport = React.useCallback(() => {
    if (importPhase === 'writing_cards') {
      Alert.alert('Finishing import', 'Please wait a moment.');
      return;
    }
    Alert.alert(
      'Cancel import?',
      'Leaving now will stop the import and discard any remaining progress.',
      [
        { text: 'Keep importing', style: 'cancel' },
        {
          text: 'Stop import',
          style: 'destructive',
          onPress: () => {
            cancelRequestedRef.current = true;
            allowNavRef.current = true;
            if (importPhase === 'detecting_languages' || importPhase === 'generating_examples') {
              abortRef.current?.abort();
            }
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace({ pathname: '/deck/[deckId]', params: { deckId } });
            }
          },
        },
      ],
    );
  }, [importPhase, deckId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (allowNavRef.current) return;
      if (!importing) return;
      e.preventDefault();
      confirmCancelImport();
    });
    return unsubscribe;
  }, [navigation, importing, confirmCancelImport]);

  function setFrontColSafe(next: number | null) {
    setFrontCol((prevFront) => {
      if (next != null && next === backCol) {
        // Prefer swapping with the previous front if it differs, otherwise pick any other column.
        const swapTo = prevFront != null && prevFront !== next ? prevFront : firstOtherIndex(next);
        if (swapTo != null) setBackCol(swapTo);
      }
      return next;
    });
  }

  function setBackColSafe(next: number | null) {
    setBackCol((prevBack) => {
      if (next != null && next === frontCol) {
        const swapTo = prevBack != null && prevBack !== next ? prevBack : firstOtherIndex(next);
        if (swapTo != null) setFrontCol(swapTo);
      }
      return next;
    });
  }

  // Default AI toggle behavior:
  // - If AI is off (or key missing), keep off.
  // - If AI is on + key present, default to "Generate examples".
  // - Don't fight the user if they manually toggle.
  useEffect(() => {
    if (!parsed) {
      setGenerateExamples(false);
      setAiTogglesTouched(false);
      return;
    }
    if (!prefs.ai.enabled || !aiKeyPresent) {
      setGenerateExamples(false);
      setAiTogglesTouched(false);
      return;
    }
    if (aiTogglesTouched) return;
    setGenerateExamples(true);
  }, [parsed, prefs.ai.enabled, aiKeyPresent, aiTogglesTouched]);

  async function pickCsv() {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;

    const content = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: 'utf8',
    });
    const parsedRes = Papa.parse(content, { skipEmptyLines: true });
    const data = (parsedRes.data ?? []) as any[];
    const parsedRows = data
      .map((r) => (Array.isArray(r) ? r.map(asStringCell) : [asStringCell(r)]))
      .filter((r) => r.some((c) => c.trim().length > 0));

    if (!parsedRows.length) {
      Alert.alert('Deckly', 'Could not parse any rows from that file.');
      return;
    }

    setParsed({
      fileName: asset.name ?? 'import.csv',
      uri: asset.uri,
      rows: parsedRows,
    });

    // Best-effort auto-mapping when headers are present.
    if (hasHeader) {
      const header = (parsedRows[0] ?? []).map(normalizeHeaderCell);
      const find = (names: string[]) => header.findIndex((h) => names.includes(h));

      const frontIndex = find(['front', 'question', 'q', 'prompt', 'term']);
      const backIndex = find(['back', 'answer', 'a', 'definition', 'meaning']);
      const exampleFrontIndex = find([
        'example_front',
        'example front',
        'example_front (front)',
        'example_l1',
        'examplel1',
        'l1_example',
        'example',
      ]);
      const exampleBackIndex = find([
        'example_back',
        'example back',
        'example_back (back)',
        'example_l2',
        'examplel2',
        'l2_example',
      ]);
      const exampleNoteIndex = find([
        'example_note',
        'example note',
        'note',
        'notes',
        'usage_note',
        'usage note',
      ]);

      if (frontIndex >= 0) setFrontCol(frontIndex);
      if (backIndex >= 0) setBackCol(backIndex);
      if (exampleFrontIndex >= 0) setExampleL1Col(exampleFrontIndex);
      if (exampleBackIndex >= 0) setExampleL2Col(exampleBackIndex);
      if (exampleNoteIndex >= 0) setExampleNoteCol(exampleNoteIndex);
    }
  }

  async function doImport() {
    if (!parsed) return;
    if (frontCol == null || backCol == null) {
      Alert.alert('Deckly', 'Please map both Front and Back columns.');
      return;
    }
    if (frontCol === backCol) {
      Alert.alert('Deckly', 'Front and Back columns are the same. Please change your mapping.');
      return;
    }

    if (generateExamples && !prefs.ai.enabled) {
      Alert.alert('Deckly', 'AI Assist is turned off. Enable it in Settings to generate examples.');
      return;
    }
    if (generateExamples && !aiKeyPresent) {
      Alert.alert('Deckly', 'To generate examples, add your OpenAI API key in Settings.');
      return;
    }
    if (generateExamples && (exampleL1Col != null || exampleL2Col != null || exampleNoteCol != null)) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Overwrite CSV examples/notes?',
          'AI will generate examples for all imported cards and overwrite any mapped example or note columns in the CSV.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Generate', style: 'destructive', onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }

    cancelRequestedRef.current = false;
    allowNavRef.current = false;

    setImporting(true);
    setImportPhase(null);
    setGenProgress(null);
    try {
      const existing = dedupe ? await cardsRepo.getCardKeySet(deckId) : new Set<string>();
      const seen = new Set<string>();

      let skippedInvalid = 0;
      let skippedDuplicates = 0;
      const items: {
        id: string;
        front: string;
        back: string;
        exampleL1?: string | null;
        exampleL2?: string | null;
        exampleNote?: string | null;
        exampleSource?: ExampleSource | null;
        exampleGeneratedAt?: number | null;
      }[] = [];

      for (const row of dataRows) {
        const front = (row[frontCol] ?? '').trim();
        const back = (row[backCol] ?? '').trim();
        const exampleL1 =
          exampleL1Col == null
            ? null
            : String(row[exampleL1Col] ?? '').trim() || null;
        const exampleL2 =
          exampleL2Col == null
            ? null
            : String(row[exampleL2Col] ?? '').trim() || null;
        const exampleNote =
          exampleNoteCol == null
            ? null
            : String(row[exampleNoteCol] ?? '').trim() || null;

        if (!front || !back) {
          skippedInvalid++;
          continue;
        }

        const key = `${front}\u001F${back}`;
        if (dedupe && (existing.has(key) || seen.has(key))) {
          skippedDuplicates++;
          continue;
        }
        seen.add(key);
        items.push({
          id: makeId(),
          front,
          back,
          exampleL1,
          exampleL2,
          exampleNote,
          exampleSource: exampleL1 || exampleL2 || exampleNote ? 'user' : null,
          exampleGeneratedAt: null,
        });
      }

      let examplesTotal = 0;
      let examplesDone = 0;
      let examplesFailed = 0;
      let examplesCancelled = 0;
      let failureSummary = '';
      let finalItems = items;

      if (generateExamples && items.length > 0 && !cancelRequestedRef.current) {
        setImportPhase('detecting_languages');
        const controller = new AbortController();
        abortRef.current = controller;

        // Detect and store deck languages once (based on the user's chosen mapping).
        await ensureDeckLanguages({
          deckId,
          samples: items.slice(0, 3).map((it) => ({
            front: it.front,
            back: it.back,
            example_front: it.exampleL1 ?? null,
            example_back: it.exampleL2 ?? null,
          })),
          forceDetect: true,
          signal: controller.signal,
        });

        setImportPhase('generating_examples');
        setHasBatchResponse(false);
        progressFrac.value = 0;
        const cardsForGen = items.map((it) => ({
          id: it.id,
          front: it.front,
          back: it.back,
          exampleL1: it.exampleL1 ?? null,
          exampleL2: it.exampleL2 ?? null,
        }));

        const mode = 'all';
        examplesTotal = cardsForGen.length;
        setGenProgress({ done: 0, total: examplesTotal, failed: 0 });

        try {
          const levelOverride = await getExampleLevel(deckId);
          const res = await generateExamplePairsInMemory({
            deckId,
            cards: cardsForGen,
            mode,
            concurrency: 1,
            batchSize: 10,
            levelOverride: levelOverride ?? undefined,
            signal: controller.signal,
            onFirstBatchResponse: () => setHasBatchResponse(true),
            onProgress: (p) => setGenProgress(p),
          });
          examplesDone = res.done;
          examplesFailed = res.failed.length;
          if (controller.signal.aborted) examplesCancelled = 1;
          if (res.failed.length) {
            failureSummary = res.failed.slice(0, 5).map((failure) => failure.reason).join(' | ');
          }
          finalItems = items.map((item) => {
            const patch = res.patches[item.id];
            if (!patch) return item;
            return { ...item, ...patch };
          });
        } catch (e: any) {
          if (controller.signal.aborted) {
            examplesCancelled = 1;
          } else {
            Alert.alert('Deckly', e?.message ?? 'Example generation failed.');
          }
        } finally {
          abortRef.current = null;
        }
      }

      if (cancelRequestedRef.current) {
        return;
      }

      if (cancelRequestedRef.current) return;
      setImportPhase('writing_cards');
      if (cancelRequestedRef.current) return;
      const { created } = await cardsRepo.createManyCards({ deckId, items: finalItems });

      // Go back to the deck and show a success notification there.
      useImportResultStore.getState().setResult({
        deckId,
        created,
        skippedInvalid,
        skippedDuplicates,
        examplesTotal,
        examplesDone,
        examplesFailed,
        examplesCancelled,
        examplesFailureSummary: failureSummary,
      });
      allowNavRef.current = true;
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace({ pathname: '/deck/[deckId]', params: { deckId } });
      }
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Import failed.');
    } finally {
      setImporting(false);
      setImportPhase(null);
    }
  }

  const colItems = useMemo(() => {
    const items: ColItem[] = [{ label: '—', value: null }];
    for (let i = 0; i < columnCount; i++) {
      const label = headerRow[i] ? `${i + 1}: ${headerRow[i]}` : `${i + 1}`;
      items.push({ label, value: i });
    }
    return items;
  }, [columnCount, headerRow]);

  const mappedPreview = useMemo(() => {
    const take = dataRows.slice(0, 3);
    const aiReady = prefs.ai.enabled && aiKeyPresent;
    const aiMode = aiReady && generateExamples;
    return take.map((row) => {
      const front = frontCol == null ? '' : String(row[frontCol] ?? '');
      const back = backCol == null ? '' : String(row[backCol] ?? '');
      const exampleFrontRaw = exampleL1Col == null ? '' : String(row[exampleL1Col] ?? '');
      const exampleBackRaw = exampleL2Col == null ? '' : String(row[exampleL2Col] ?? '');
      const exampleNoteRaw = exampleNoteCol == null ? '' : String(row[exampleNoteCol] ?? '');

      const exampleFront = exampleFrontRaw.trim() ? exampleFrontRaw : '';
      const exampleBack = exampleBackRaw.trim() ? exampleBackRaw : '';
      const exampleNote = exampleNoteRaw.trim() ? exampleNoteRaw : '';

      const willGenerateFront = aiMode;
      const willGenerateBack = aiMode;
      const willGenerateNote = aiMode;

      return {
        front,
        back,
        exampleFront,
        exampleBack,
        exampleNote,
        willGenerateFront,
        willGenerateBack,
        willGenerateNote,
      };
    });
  }, [
    dataRows,
    frontCol,
    backCol,
    exampleL1Col,
    exampleL2Col,
    exampleNoteCol,
    prefs.ai.enabled,
    aiKeyPresent,
    generateExamples,
  ]);

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Import CSV',
          gestureEnabled: !importing,
          headerLeft: () => (
            <Pressable
              hitSlop={10}
              onPress={() => {
                if (importing) {
                  confirmCancelImport();
                } else {
                  router.back();
                }
              }}
              style={({ pressed }) => [styles.headerBackButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </Pressable>
          ),
        }}
      />
      {!parsed ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyContent}>
            <Text variant="h2" style={styles.centerText}>
              CSV Import
            </Text>
            <Text variant="muted" style={styles.centerText}>
              Pick a CSV file, map columns, then import. Quoted fields and commas are supported.
            </Text>
            <View style={styles.spacer6} />
            <Button
              title="Pick CSV file"
              variant="secondary"
              onPress={pickCsv}
              style={styles.stretchButton}
            />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text variant="h2">Selected file</Text>
            <View
              style={styles.selectedCard}
            >
              <View style={styles.flex1}>
                <Text numberOfLines={1} ellipsizeMode="middle" style={styles.fileName}>
                  {parsed.fileName}
                </Text>
                <Text variant="muted">{rows.length} rows</Text>
              </View>
              <Button title="Change" variant="ghost" onPress={pickCsv} />
            </View>
          </View>
          <>
            <View style={styles.spacer18} />
            <View style={styles.mappingSection}>
              <Text variant="h2">Mapping</Text>

              <Row>
                <Text variant="label">First row is header</Text>
                <Switch
                  value={hasHeader}
                  onValueChange={(next) => setHasHeader(next)}
                  trackColor={{ false: theme.colors.surface2, true: theme.colors.primaryGradientEnd }}
                  thumbColor={hasHeader ? '#FFFFFF' : '#F4F5F7'}
                  ios_backgroundColor={theme.colors.surface2}
                />
              </Row>

              <Row>
                <View style={styles.rowLabelGroup}>
                  <Text variant="label">Deduplicate (front+back)</Text>
                  <Pressable
                    onPress={() => setDedupeInfoOpen(true)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
                <Switch
                  value={dedupe}
                  onValueChange={(next) => setDedupe(next)}
                  trackColor={{ false: theme.colors.surface2, true: theme.colors.primaryGradientEnd }}
                  thumbColor={dedupe ? '#FFFFFF' : '#F4F5F7'}
                  ios_backgroundColor={theme.colors.surface2}
                />
              </Row>

              <View style={styles.fieldGroup}>
                <ColumnSelect
                  label="Front"
                  value={frontCol}
                  items={colItems}
                  onChange={setFrontColSafe}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ColumnSelect
                  label="Back"
                  value={backCol}
                  items={colItems}
                  onChange={setBackColSafe}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ColumnSelect
                  label="Example front"
                  value={exampleL1Col}
                  items={colItems}
                  onChange={(v) => setExampleL1Col(v)}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ColumnSelect
                  label="Example back"
                  value={exampleL2Col}
                  items={colItems}
                  onChange={(v) => setExampleL2Col(v)}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ColumnSelect
                  label="Example note"
                  value={exampleNoteCol}
                  items={colItems}
                  onChange={(v) => setExampleNoteCol(v)}
                />
              </View>

              <View style={styles.spacer4} />

              <View style={styles.spacer8} />

              {importing && importPhase === 'detecting_languages' ? (
                <View style={styles.detectingRow}>
                  <ActivityIndicator color={theme.colors.textMuted} />
                  <Text variant="muted">Detecting languages…</Text>
                </View>
              ) : null}

              {!prefs.ai.enabled ? (
                <View style={styles.aiSection}>
                  <Row>
                    <Text variant="label">Use AI Assist</Text>
                    <Switch
                      value={false}
                      disabled
                      trackColor={{ false: theme.colors.surface2, true: theme.colors.primaryGradientEnd }}
                      thumbColor="#F4F5F7"
                      ios_backgroundColor={theme.colors.surface2}
                    />
                  </Row>
                  <Text variant="muted" style={styles.aiHint}>
                    Generates bilingual example pairs and short notes using your OpenAI key based on Front/Back text.
                  </Text>
                  <Text variant="muted" style={styles.aiHint}>
                    Enable AI Assist in Settings — tap{' '}
                    <Text
                      style={styles.aiHintLink}
                      onPress={() => router.push('/settings/ai')}
                    >
                      here
                    </Text>
                    .
                  </Text>
                </View>
              ) : !aiKeyPresent ? (
                <Button
                  title="Add API key in Settings"
                  variant="secondary"
                  onPress={() => router.push('/settings/ai')}
                />
              ) : (
                <View style={styles.aiSection}>
                  <Row>
                    <Text variant="label">Use AI Assist</Text>
                    <Switch
                      value={generateExamples}
                      onValueChange={(next) => {
                        setAiTogglesTouched(true);
                        setGenerateExamples(next);
                      }}
                      trackColor={{ false: theme.colors.surface2, true: theme.colors.primaryGradientEnd }}
                      thumbColor={generateExamples ? '#FFFFFF' : '#F4F5F7'}
                      ios_backgroundColor={theme.colors.surface2}
                    />
                  </Row>
                  <Text variant="muted" style={styles.aiHint}>
                    Generates bilingual example pairs and short notes using your OpenAI key based on Front/Back text.
                  </Text>
                </View>
              )}

              {genProgress ? (
                <Surface radius={16} border={false} padding={12} style={styles.progressCard}>
                  <Text variant="muted">
                    {showIndeterminate
                      ? 'Generating examples…'
                      : `Generating examples: ${genProgress.done}/${genProgress.total}`}
                  </Text>
                  <View style={styles.spacer10} />
                  <View style={styles.progressTrack}>
                    <View
                      style={styles.progressTrackInner}
                      onLayout={(e) => {
                        progressBarWidth.value = e.nativeEvent.layout.width;
                      }}
                    >
                      <Animated.View
                        style={[
                          styles.indeterminateFill,
                          indeterminateFillStyle,
                          { opacity: showIndeterminate ? 1 : 0 },
                        ]}
                      />
                      <Animated.View style={[styles.progressFill, progressFillStyle]} />
                    </View>
                  </View>
                  {genProgress.failed ? (
                    <>
                      <View style={styles.spacer10} />
                      <Text variant="muted" style={styles.failedText}>
                        Failed: {genProgress.failed}
                      </Text>
                    </>
                  ) : null}
                  <View style={styles.spacer10} />
                  <Button
                    title="Cancel generation"
                    variant="dangerGhost"
                    onPress={confirmCancelImport}
                  />
                </Surface>
              ) : null}

              <View style={styles.spacer8} />
              <Button
                title={importing ? 'Importing...' : 'Import into deck'}
                onPress={doImport}
                disabled={importing || frontCol == null || backCol == null}
              />
            </View>

            <View style={styles.spacer22} />
            <View style={styles.section}>
              <Text variant="h2">Preview</Text>
              {previewRows.length === 0 ? (
                <Text variant="muted">No rows to preview (check header toggle).</Text>
              ) : mappedPreview.length === 0 ? (
                <Text variant="muted">Select column mapping to preview.</Text>
              ) : (
                <Surface radius={18} style={styles.previewSurface}>
                  {mappedPreview.map((row, idx) => (
                    <View key={idx} style={styles.previewItem}>
                      {idx > 0 ? (
                        <View style={styles.previewDivider} />
                      ) : null}
                      <View style={styles.previewContent}>
                        <View style={styles.previewRow}>
                          <View style={styles.previewCol}>
                            <Text variant="label" style={styles.previewLabel}>
                              Front
                            </Text>
                            <Text style={styles.previewValue} numberOfLines={3}>
                              {row.front || '—'}
                            </Text>
                          </View>
                          <View style={styles.previewCol}>
                            <Text variant="label" style={styles.previewLabel}>
                              Back
                            </Text>
                            <Text style={styles.previewValue} numberOfLines={3}>
                              {row.back || '—'}
                            </Text>
                          </View>
                        </View>
                        {row.exampleFront ||
                        row.exampleBack ||
                        row.exampleNote ||
                        row.willGenerateFront ||
                        row.willGenerateBack ||
                        row.willGenerateNote ? (
                          <View style={styles.examplesBlock}>
                            <View style={styles.examplesHeader}>
                              <Text style={styles.examplesTitle}>
                                Examples
                              </Text>
                            </View>
                            <View style={styles.examplesRow}>
                              <Text variant="label" style={styles.examplesLabel}>
                                Front
                              </Text>
                              <Text
                                style={styles.examplesValue}
                                numberOfLines={2}
                              >
                                {row.willGenerateFront
                                  ? 'AI will generate on import'
                                  : row.exampleFront
                                    ? row.exampleFront
                                    : '—'}
                              </Text>
                            </View>
                            <View style={styles.examplesRow}>
                              <Text variant="label" style={styles.examplesLabel}>
                                Back
                              </Text>
                              <Text
                                style={styles.examplesValue}
                                numberOfLines={2}
                              >
                                {row.willGenerateBack
                                  ? 'AI will generate on import'
                                  : row.exampleBack
                                    ? row.exampleBack
                                    : '—'}
                              </Text>
                            </View>
                            <View style={styles.examplesRow}>
                              <Text variant="label" style={styles.examplesLabel}>
                                Note
                              </Text>
                              <Text
                                style={styles.examplesValue}
                                numberOfLines={2}
                              >
                                {row.willGenerateNote
                                  ? 'AI will generate on import'
                                  : row.exampleNote
                                    ? row.exampleNote
                                    : '—'}
                              </Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </Surface>
              )}
            </View>
          </>
        </ScrollView>
      )}

      <InfoModal visible={dedupeInfoOpen} title="Deduplicate" onClose={() => setDedupeInfoOpen(false)}>
        <Text variant="muted">
          When enabled, Deckly skips importing any row that would create a card with the same
          Front + Back as an existing card in this deck. It also skips duplicates inside the CSV
          itself.
        </Text>
        <Text variant="muted">
          This is an exact match check after trimming whitespace. Examples/notes are not part of the
          match.
        </Text>
      </InfoModal>
    </Screen>
  );
}

function ColumnSelect(props: {
  label: string;
  value: number | null;
  items: ColItem[];
  onChange: (v: number | null) => void;
}) {
  const theme = useDecklyTheme();
  const styles = useMemo(() => createColumnStyles(theme), [theme]);
  const [open, setOpen] = useState(false);
  const selected = props.items.find((i) => i.value === props.value)?.label ?? '—';

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.columnWrap}>
        <Row gap={12} align="center">
          <Text variant="label" style={styles.columnLabel}>
            {props.label}
          </Text>
          <Pressable
            onPress={() => {
              const options = props.items.map((i) => i.label).concat('Cancel');
              const cancelButtonIndex = options.length - 1;
              ActionSheetIOS.showActionSheetWithOptions(
                {
                  title: props.label,
                  options,
                  cancelButtonIndex,
                  destructiveButtonIndex: undefined,
                  userInterfaceStyle: theme.scheme,
                },
                (idx) => {
                  if (idx == null) return;
                  if (idx === cancelButtonIndex) return;
                  const picked = props.items[idx];
                  props.onChange(picked ? picked.value : null);
                },
              );
            }}
            style={({ pressed }) => [styles.selectButton, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text numberOfLines={1} style={styles.selectedText}>
              {selected}
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.colors.textMuted} />
          </Pressable>
        </Row>
      </View>
    );
  }

  // Android: use an overlay chooser so the mapping screen remains easy to scroll.
  return (
    <View style={styles.columnWrap}>
      <Row gap={12} align="center">
        <Text variant="label" style={styles.columnLabel}>
          {props.label}
        </Text>
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.selectButton, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text numberOfLines={1} style={styles.selectedText}>
            {selected}
          </Text>
          <Ionicons name="chevron-down" size={14} color={theme.colors.textMuted} />
        </Pressable>
      </Row>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            onPress={() => setOpen(false)}
            style={styles.modalBackdrop}
          />
          <Surface
            radius={22}
            style={styles.modalSheet}
          >
            <Text variant="h2">{props.label}</Text>
            <View style={styles.modalSpacer} />
            <ScrollView>
              {props.items.map((it, idx) => {
                const active = it.value === props.value;
                return (
                  <Pressable
                    key={`${idx}-${String(it.value)}`}
                    onPress={() => {
                      props.onChange(it.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      { backgroundColor: active ? theme.colors.surface2 : 'transparent' },
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text style={[styles.optionText, { fontWeight: active ? '900' : '700' }]}>
                      {it.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalSpacer} />
            <Button title="Close" variant="secondary" onPress={() => setOpen(false)} />
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    headerBackButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    emptyState: {
      flex: 1,
      padding: theme.spacing.lg,
      justifyContent: 'center',
    },
    emptyContent: {
      gap: 12,
      alignItems: 'center',
    },
    centerText: {
      textAlign: 'center',
    },
    spacer4: {
      height: 4,
    },
    spacer6: {
      height: 6,
    },
    spacer8: {
      height: 8,
    },
    spacer10: {
      height: 10,
    },
    spacer18: {
      height: 18,
    },
    spacer22: {
      height: 22,
    },
    stretchButton: {
      alignSelf: 'stretch',
    },
    scrollContent: {
      padding: theme.spacing.lg,
      paddingTop: 12,
      paddingBottom: 36,
    },
    section: {
      gap: 10,
    },
    selectedCard: {
      padding: 14,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    flex1: {
      flex: 1,
    },
    fileName: {
      fontWeight: '900' as const,
    },
    mappingSection: {
      gap: 12,
    },
    rowLabelGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    iconButton: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldGroup: {
      gap: 10,
    },
    detectingRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    aiSection: {
      gap: 10,
    },
    aiHint: {
      fontSize: 12,
    },
    aiHintLink: {
      textDecorationLine: 'underline',
      color: theme.colors.primary,
      fontSize: 12,
    },
    progressCard: {
      marginTop: 6,
    },
    progressTrack: {
      borderRadius: 999,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    progressTrackInner: {
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.surface2,
      overflow: 'hidden',
      position: 'relative',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: theme.colors.primary2,
      position: 'absolute',
      left: 0,
      top: 0,
    },
    indeterminateFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: theme.colors.primary2,
      position: 'absolute',
      left: 0,
      top: 0,
    },
    failedText: {
      color: theme.colors.danger,
    },
    previewSurface: {
      overflow: 'hidden',
    },
    previewItem: {
      padding: 14,
    },
    previewDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginBottom: 14,
    },
    previewContent: {
      gap: 12,
    },
    previewRow: {
      flexDirection: 'row',
      gap: 14,
    },
    previewCol: {
      flex: 1,
      gap: 6,
    },
    previewLabel: {
      color: theme.colors.textMuted,
    },
    previewValue: {
      fontSize: 18,
      fontWeight: '900' as const,
    },
    examplesBlock: {
      gap: 6,
    },
    examplesHeader: {
      paddingTop: 2,
    },
    examplesTitle: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '800' as const,
      color: theme.colors.text,
      opacity: 0.8,
    },
    examplesRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 10,
    },
    examplesLabel: {
      color: theme.colors.textMuted,
      width: 62,
    },
    examplesValue: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500' as const,
      color: theme.colors.textMuted,
      opacity: 0.9,
    },
  });
}

function createColumnStyles(theme: ReturnType<typeof useDecklyTheme>) {
  return StyleSheet.create({
    columnWrap: {
      gap: 8,
    },
    columnLabel: {
      flex: 1,
    },
    selectButton: {
      maxWidth: 190,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectedText: {
      flex: 1,
      paddingRight: 8,
      fontWeight: '800' as const,
      fontSize: 13,
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      ...(StyleSheet.absoluteFillObject as object),
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modalSheet: {
      padding: 14,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: '70%',
    },
    modalSpacer: {
      height: 10,
    },
    optionRow: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
    },
    optionText: {
      fontWeight: '700' as const,
    },
  });
}
