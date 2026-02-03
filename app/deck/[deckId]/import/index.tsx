import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Papa from 'papaparse';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import { getExampleLevel } from '@/data/repositories/deckPrefsRepo';
import { getAiApiKey } from '@/data/secureStore';
import { makeId } from '@/utils/id';
import { generateAndPersistExamplePairs } from '@/services/examplePairService';
import { ensureDeckLanguages } from '@/services/deckLanguageService';
import { useImportResultStore } from '@/stores/importResultStore';
import { Button } from '@/ui/components/Button';
import { InfoModal } from '@/ui/components/InfoModal';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { Surface } from '@/ui/components/Surface';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';
import { usePrefsStore } from '@/stores/prefsStore';

type ParsedCsv = {
  fileName: string;
  uri: string;
  rows: string[][];
};

type ColItem = { label: string; value: number | null };

function asStringCell(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

function normalizeHeaderCell(v: string): string {
  return v.trim().toLowerCase();
}

export default function ImportCsvScreen() {
  const t = useDecklyTheme();
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
  const abortRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const allowNavRef = useRef(false);
  const progressFrac = useSharedValue(0);
  const progressBarWidth = useSharedValue(0);

  useEffect(() => {
    const frac = genProgress?.total ? genProgress.done / genProgress.total : 0;
    progressFrac.value = withTiming(Math.max(0, Math.min(1, frac)), { duration: 220 });
  }, [genProgress?.done, genProgress?.total, progressFrac]);

  const progressFillStyle = useAnimatedStyle(() => {
    return {
      width: progressBarWidth.value * progressFrac.value,
    };
  });

  const rows = useMemo(() => parsed?.rows ?? [], [parsed]);
  const headerRow = useMemo(() => (hasHeader ? rows[0] ?? [] : []), [hasHeader, rows]);
  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [hasHeader, rows]);

  const columnCount = useMemo(() => {
    let max = 0;
    for (const r of rows.slice(0, 50)) max = Math.max(max, r.length);
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

  async function rollbackImport(createdIds: string[]) {
    if (!createdIds.length) return;
    await Promise.all(createdIds.map((id) => cardsRepo.softDeleteCard(id)));
  }

  const confirmCancelImport = React.useCallback(() => {
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
  }, [importPhase, router, deckId]);

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

      const f = find(['front', 'question', 'q', 'prompt', 'term']);
      const b = find(['back', 'answer', 'a', 'definition', 'meaning']);
      const exFront = find([
        'example_front',
        'example front',
        'example_front (front)',
        'example_l1',
        'examplel1',
        'l1_example',
        'example',
      ]);
      const exBack = find([
        'example_back',
        'example back',
        'example_back (back)',
        'example_l2',
        'examplel2',
        'l2_example',
      ]);

      if (f >= 0) setFrontCol(f);
      if (b >= 0) setBackCol(b);
      if (exFront >= 0) setExampleL1Col(exFront);
      if (exBack >= 0) setExampleL2Col(exBack);
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
    if (generateExamples && (exampleL1Col != null || exampleL2Col != null)) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Overwrite CSV examples?',
          'AI will generate examples for all imported cards and overwrite any example columns in the CSV.',
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
    setImportPhase('writing_cards');
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
        exampleSource?: 'user' | null;
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
          exampleSource: exampleL1 || exampleL2 ? 'user' : null,
          exampleGeneratedAt: null,
        });
      }

      const { created, createdIds } = await cardsRepo.createManyCards({ deckId, items });

      if (cancelRequestedRef.current) {
        await rollbackImport(createdIds);
        return;
      }

      let examplesTotal = 0;
      let examplesDone = 0;
      let examplesFailed = 0;
      let examplesCancelled = 0;
      let failureSummary = '';

      if (generateExamples && created > 0 && !cancelRequestedRef.current) {
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
          const res = await generateAndPersistExamplePairs({
            deckId,
            cards: cardsForGen,
            mode,
            concurrency: 2,
            batchSize: 10,
            levelOverride: levelOverride ?? undefined,
            signal: controller.signal,
            onProgress: (p) => setGenProgress(p),
          });
          examplesDone = res.done;
          examplesFailed = res.failed.length;
          if (controller.signal.aborted) examplesCancelled = 1;
          if (res.failed.length) {
            failureSummary = res.failed.slice(0, 5).map((f) => f.reason).join(' | ');
          }
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
        await rollbackImport(createdIds);
        return;
      }

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

      const exampleFront = exampleFrontRaw.trim() ? exampleFrontRaw : '';
      const exampleBack = exampleBackRaw.trim() ? exampleBackRaw : '';

      const willGenerateFront = aiMode;
      const willGenerateBack = aiMode;

      return {
        front,
        back,
        exampleFront,
        exampleBack,
        willGenerateFront,
        willGenerateBack,
      };
    });
  }, [
    dataRows,
    frontCol,
    backCol,
    exampleL1Col,
    exampleL2Col,
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
              style={({ pressed }) => ({
                paddingHorizontal: 8,
                paddingVertical: 6,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={22} color={t.colors.text} />
            </Pressable>
          ),
        }}
      />
      {!parsed ? (
        <View style={{ flex: 1, padding: t.spacing.lg, justifyContent: 'center' }}>
          <View style={{ gap: 12, alignItems: 'center' }}>
            <Text variant="h2" style={{ textAlign: 'center' }}>
              CSV Import
            </Text>
            <Text variant="muted" style={{ textAlign: 'center' }}>
              Pick a CSV file, map columns, then import. Quoted fields and commas are supported.
            </Text>
            <View style={{ height: 6 }} />
            <Button
              title="Pick CSV file"
              variant="secondary"
              onPress={pickCsv}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, paddingTop: 12, paddingBottom: 36 }}>
          <View style={{ gap: 10 }}>
            <Text variant="h2">Selected file</Text>
            <View
              style={{
                padding: 14,
                borderRadius: 18,
                backgroundColor: t.colors.surface,
                borderWidth: 1,
                borderColor: t.colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontWeight: '900' }}>
                  {parsed.fileName}
                </Text>
                <Text variant="muted">{rows.length} rows</Text>
              </View>
	              <Button title="Change" variant="ghost" onPress={pickCsv} />
	            </View>
	          </View>
	          <>
	            <View style={{ height: 18 }} />
	            <View style={{ gap: 12 }}>
	              <Text variant="h2">Mapping</Text>

              <Row>
                <Text variant="label">First row is header</Text>
                <Switch
                  value={hasHeader}
                  onValueChange={(next) => setHasHeader(next)}
                  trackColor={{ false: t.colors.surface2, true: t.colors.primaryGradientEnd }}
                  thumbColor={hasHeader ? '#FFFFFF' : '#F4F5F7'}
                  ios_backgroundColor={t.colors.surface2}
                />
              </Row>

              <Row>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text variant="label">Deduplicate (front+back)</Text>
                  <Pressable
                    onPress={() => setDedupeInfoOpen(true)}
                    hitSlop={10}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Ionicons name="information-circle-outline" size={18} color={t.colors.textMuted} />
                  </Pressable>
                </View>
                <Switch
                  value={dedupe}
                  onValueChange={(next) => setDedupe(next)}
                  trackColor={{ false: t.colors.surface2, true: t.colors.primaryGradientEnd }}
                  thumbColor={dedupe ? '#FFFFFF' : '#F4F5F7'}
                  ios_backgroundColor={t.colors.surface2}
                />
              </Row>

              <View style={{ gap: 10 }}>
                <ColumnSelect
                  label="Front"
                  value={frontCol}
                  items={colItems}
                  onChange={setFrontColSafe}
                />
              </View>

              <View style={{ gap: 10 }}>
                <ColumnSelect
                  label="Back"
                  value={backCol}
                  items={colItems}
                  onChange={setBackColSafe}
                />
              </View>

              <View style={{ gap: 10 }}>
                <ColumnSelect
                  label="Example front"
                  value={exampleL1Col}
                  items={colItems}
                  onChange={(v) => setExampleL1Col(v)}
                />
              </View>

              <View style={{ gap: 10 }}>
                <ColumnSelect
                  label="Example back"
                  value={exampleL2Col}
                  items={colItems}
                  onChange={(v) => setExampleL2Col(v)}
                />
              </View>

              <View style={{ height: 4 }} />

              <View style={{ height: 8 }} />

              {importing && importPhase === 'detecting_languages' ? (
                <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color={t.colors.textMuted} />
                  <Text variant="muted">Detecting languages…</Text>
                </View>
              ) : null}

              {!prefs.ai.enabled ? (
                <View style={{ gap: 10 }}>
                  <Row>
                    <Text variant="label">Use AI Assist</Text>
                    <Switch
                      value={false}
                      disabled
                      trackColor={{ false: t.colors.surface2, true: t.colors.primaryGradientEnd }}
                      thumbColor="#F4F5F7"
                      ios_backgroundColor={t.colors.surface2}
                    />
                  </Row>
                  <Text variant="muted" style={{ fontSize: 12 }}>
                    Generates bilingual example pairs and short notes using your OpenAI key based on Front/Back text.
                  </Text>
                  <Text variant="muted" style={{ fontSize: 12 }}>
                    Enable AI Assist in Settings — tap{' '}
                    <Text
                      style={{ textDecorationLine: 'underline', color: t.colors.primary, fontSize: 12 }}
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
                <View style={{ gap: 10 }}>
                  <Row>
                    <Text variant="label">Use AI Assist</Text>
                    <Switch
                      value={generateExamples}
                      onValueChange={(next) => {
                        setAiTogglesTouched(true);
                        setGenerateExamples(next);
                      }}
                      trackColor={{ false: t.colors.surface2, true: t.colors.primaryGradientEnd }}
                      thumbColor={generateExamples ? '#FFFFFF' : '#F4F5F7'}
                      ios_backgroundColor={t.colors.surface2}
                    />
                  </Row>
                  <Text variant="muted" style={{ fontSize: 12 }}>
                    Generates bilingual example pairs and short notes using your OpenAI key based on Front/Back text.
                  </Text>
                </View>
              )}

              {genProgress ? (
                <Surface radius={16} border={false} padding={12} style={{ marginTop: 6 }}>
                  <Text variant="muted">
                    Generating examples: {genProgress.done}/{genProgress.total}
                  </Text>
                  <View style={{ height: 10 }} />
                  <View
                    style={{
                      borderRadius: 999,
                      backgroundColor: t.colors.border,
                      padding: 1,
                    }}
                  >
                    <View
                      style={{
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: t.colors.surface2,
                        overflow: 'hidden',
                      }}
                      onLayout={(e) => {
                        progressBarWidth.value = e.nativeEvent.layout.width;
                      }}
                    >
                      <Animated.View
                        style={[
                          {
                            height: '100%',
                            borderRadius: 999,
                            backgroundColor: t.colors.primary2,
                          },
                          progressFillStyle,
                        ]}
                      />
                    </View>
                  </View>
                  {genProgress.failed ? (
                    <>
                      <View style={{ height: 10 }} />
                      <Text variant="muted" style={{ color: t.colors.danger }}>
                        Failed: {genProgress.failed}
                      </Text>
                    </>
                  ) : null}
                  <View style={{ height: 10 }} />
                  <Button
                    title="Cancel generation"
                    variant="dangerGhost"
                    onPress={() => abortRef.current?.abort()}
                  />
                </Surface>
              ) : null}

              <View style={{ height: 8 }} />
              <Button
                title={importing ? 'Importing...' : 'Import into deck'}
                onPress={doImport}
                disabled={importing || frontCol == null || backCol == null}
              />
            </View>

            <View style={{ height: 22 }} />
            <View style={{ gap: 10 }}>
              <Text variant="h2">Preview</Text>
              {previewRows.length === 0 ? (
                <Text variant="muted">No rows to preview (check header toggle).</Text>
              ) : mappedPreview.length === 0 ? (
                <Text variant="muted">Select column mapping to preview.</Text>
              ) : (
                <Surface radius={18} style={{ overflow: 'hidden' }}>
                  {mappedPreview.map((r, idx) => (
                    <View key={idx} style={{ padding: 14 }}>
                      {idx > 0 ? (
                        <View style={{ height: 1, backgroundColor: t.colors.border, marginBottom: 14 }} />
                      ) : null}
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 14 }}>
                          <View style={{ flex: 1, gap: 6 }}>
                            <Text variant="label" style={{ color: t.colors.textMuted }}>
                              Front
                            </Text>
                            <Text style={{ fontSize: 18, fontWeight: '900' }} numberOfLines={3}>
                              {r.front || '—'}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: 6 }}>
                            <Text variant="label" style={{ color: t.colors.textMuted }}>
                              Back
                            </Text>
                            <Text style={{ fontSize: 18, fontWeight: '900' }} numberOfLines={3}>
                              {r.back || '—'}
                            </Text>
                          </View>
                        </View>
                        {r.exampleFront || r.exampleBack || r.willGenerateFront || r.willGenerateBack ? (
                          <View style={{ gap: 6 }}>
                            <View style={{ paddingTop: 2 }}>
                              <Text
                                style={{
                                  fontSize: 13,
                                  lineHeight: 18,
                                  fontWeight: '800',
                                  color: t.colors.text,
                                  opacity: 0.8,
                                }}
                              >
                                Examples
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                              <Text variant="label" style={{ color: t.colors.textMuted, width: 62 }}>
                                Front
                              </Text>
                              <Text
                                style={{
                                  flex: 1,
                                  fontSize: 13,
                                  lineHeight: 18,
                                  fontWeight: '500',
                                  color: t.colors.textMuted,
                                  opacity: 0.9,
                                }}
                                numberOfLines={2}
                              >
                                {r.willGenerateFront
                                  ? 'AI will generate on import'
                                  : r.exampleFront
                                    ? r.exampleFront
                                    : '—'}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                              <Text variant="label" style={{ color: t.colors.textMuted, width: 62 }}>
                                Back
                              </Text>
                              <Text
                                style={{
                                  flex: 1,
                                  fontSize: 13,
                                  lineHeight: 18,
                                  fontWeight: '500',
                                  color: t.colors.textMuted,
                                  opacity: 0.9,
                                }}
                                numberOfLines={2}
                              >
                                {r.willGenerateBack
                                  ? 'AI will generate on import'
                                  : r.exampleBack
                                    ? r.exampleBack
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
  const t = useDecklyTheme();
  const [open, setOpen] = useState(false);
  const selected = props.items.find((i) => i.value === props.value)?.label ?? '—';

  if (Platform.OS === 'ios') {
    return (
      <View style={{ gap: 8 }}>
        <Row gap={12} align="center">
          <Text variant="label" style={{ flex: 1 }}>
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
                userInterfaceStyle: t.scheme,
              },
              (idx) => {
                if (idx == null) return;
                if (idx === cancelButtonIndex) return;
                const picked = props.items[idx];
                props.onChange(picked ? picked.value : null);
              },
            );
          }}
          style={({ pressed }) => ({
            maxWidth: 190,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: t.colors.surface,
            borderWidth: 1,
            borderColor: t.colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text numberOfLines={1} style={{ flex: 1, paddingRight: 8, fontWeight: '800', fontSize: 13 }}>
            {selected}
          </Text>
          <Ionicons name="chevron-down" size={14} color={t.colors.textMuted} />
        </Pressable>
        </Row>
      </View>
    );
  }

  // Android: use an overlay chooser so the mapping screen remains easy to scroll.
  return (
    <View style={{ gap: 8 }}>
      <Row gap={12} align="center">
        <Text variant="label" style={{ flex: 1 }}>
          {props.label}
        </Text>
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({
            maxWidth: 190,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: t.colors.surface,
            borderWidth: 1,
            borderColor: t.colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text numberOfLines={1} style={{ flex: 1, paddingRight: 8, fontWeight: '800', fontSize: 13 }}>
            {selected}
          </Text>
          <Ionicons name="chevron-down" size={14} color={t.colors.textMuted} />
        </Pressable>
      </Row>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => setOpen(false)}
            style={{
              ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          />
          <Surface
            radius={22}
            style={{
              padding: 14,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              maxHeight: '70%',
            }}
          >
            <Text variant="h2">{props.label}</Text>
            <View style={{ height: 10 }} />
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
                    style={({ pressed }) => ({
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      backgroundColor: active ? t.colors.surface2 : 'transparent',
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ fontWeight: active ? '900' : '700' }}>{it.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ height: 10 }} />
            <Button title="Close" variant="secondary" onPress={() => setOpen(false)} />
          </Surface>
        </View>
      </Modal>
    </View>
  );
}
