import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Papa from 'papaparse';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import * as cardsRepo from '@/data/repositories/cardsRepo';
import { Button } from '@/ui/components/Button';
import { Row } from '@/ui/components/Row';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

type ParsedCsv = {
  fileName: string;
  uri: string;
  rows: string[][];
};

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
  const { deckId } = useLocalSearchParams<{ deckId: string }>();

  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [dedupe, setDedupe] = useState(true);
  const [frontCol, setFrontCol] = useState<number | null>(0);
  const [backCol, setBackCol] = useState<number | null>(1);
  const [exampleCol, setExampleCol] = useState<number | null>(2);

  const [importing, setImporting] = useState(false);

  const rows = useMemo(() => parsed?.rows ?? [], [parsed]);
  const headerRow = useMemo(() => (hasHeader ? rows[0] ?? [] : []), [hasHeader, rows]);
  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [hasHeader, rows]);

  const columnCount = useMemo(() => {
    let max = 0;
    for (const r of rows.slice(0, 50)) max = Math.max(max, r.length);
    return max;
  }, [rows]);

  const previewRows = useMemo(() => dataRows.slice(0, 3), [dataRows]);

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
      const e = find(['example', 'ex', 'sentence', 'usage']);

      if (f >= 0) setFrontCol(f);
      if (b >= 0) setBackCol(b);
      if (e >= 0) setExampleCol(e);
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
    setImporting(true);
    try {
      const existing = dedupe ? await cardsRepo.getCardKeySet(deckId) : new Set<string>();
      const seen = new Set<string>();

      let skippedInvalid = 0;
      let skippedDuplicates = 0;
      const items: { front: string; back: string; example?: string | null }[] = [];

      for (const row of dataRows) {
        const front = (row[frontCol] ?? '').trim();
        const back = (row[backCol] ?? '').trim();
        const example =
          exampleCol == null ? null : ((row[exampleCol] ?? '') as string).trim() || null;

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
        items.push({ front, back, example });
      }

      const { created } = await cardsRepo.createManyCards({ deckId, items });
      // Go back to the deck and show a success notification there.
      router.replace({
        pathname: '/deck/[deckId]',
        params: {
          deckId,
          imported: String(created),
          skippedInvalid: String(skippedInvalid),
          skippedDuplicates: String(skippedDuplicates),
        },
      });
    } catch (e: any) {
      Alert.alert('Deckly', e?.message ?? 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  const colItems = useMemo(() => {
    const items = [{ label: '—', value: null as any }];
    for (let i = 0; i < columnCount; i++) {
      const label = headerRow[i] ? `${i + 1}: ${headerRow[i]}` : `${i + 1}`;
      items.push({ label, value: i });
    }
    return items;
  }, [columnCount, headerRow]);

  const mappedPreview = useMemo(() => {
    const take = dataRows.slice(0, 3);
    return take.map((row) => {
      const front = frontCol == null ? '' : String(row[frontCol] ?? '');
      const back = backCol == null ? '' : String(row[backCol] ?? '');
      const example = exampleCol == null ? '' : String(row[exampleCol] ?? '');
      return { front, back, example };
    });
  }, [dataRows, frontCol, backCol, exampleCol]);

  const sectionStyle = {
    padding: 16,
    borderRadius: 18,
    backgroundColor: t.colors.surface2,
  } as const;

  const previewItemStyle = {
    padding: 14,
    borderRadius: 18,
    backgroundColor: t.colors.surface,
  } as const;

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Import CSV' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: 36 }}>
        <View style={[sectionStyle, { gap: 10 }]}>
          <Text variant="h2">CSV Import</Text>
          <Text variant="muted">
            Pick a CSV file, preview it, map columns to fields, then import. Quoted fields and
            commas are supported (via PapaParse).
          </Text>
          <Button title={parsed ? 'Pick another file' : 'Pick CSV file'} onPress={pickCsv} />
          {parsed ? (
            <Text variant="mono" style={{ color: t.colors.textMuted }}>
              {parsed.fileName} ({rows.length} rows)
            </Text>
          ) : null}
        </View>

        {parsed ? (
          <>
            <View style={{ height: 12 }} />
            <View style={[sectionStyle, { gap: 12 }]}>
              <Text variant="h2">Mapping</Text>

              <Row>
                <Text variant="label">First row is header</Text>
                <Pressable
                  onPress={() => setHasHeader((v) => !v)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: hasHeader ? t.colors.primary : t.colors.surface2,
                  }}
                >
                  <Text style={{ color: hasHeader ? '#fff' : t.colors.text, fontWeight: '900' }}>
                    {hasHeader ? 'On' : 'Off'}
                  </Text>
                </Pressable>
              </Row>

              <Row>
                <Text variant="label">Deduplicate (front+back)</Text>
                <Pressable
                  onPress={() => setDedupe((v) => !v)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: dedupe ? t.colors.primary2 : t.colors.surface2,
                  }}
                >
                  <Text style={{ color: dedupe ? '#04201C' : t.colors.text, fontWeight: '900' }}>
                    {dedupe ? 'On' : 'Off'}
                  </Text>
                </Pressable>
              </Row>

              <View style={{ gap: 10 }}>
                <Text variant="label">Front column</Text>
                <Picker selectedValue={frontCol} onValueChange={setFrontCol}>
                  {colItems.map((c) => (
                    <Picker.Item key={String(c.value)} label={c.label} value={c.value} />
                  ))}
                </Picker>
              </View>

              <View style={{ gap: 10 }}>
                <Text variant="label">Back column</Text>
                <Picker selectedValue={backCol} onValueChange={setBackCol}>
                  {colItems.map((c) => (
                    <Picker.Item key={String(c.value)} label={c.label} value={c.value} />
                  ))}
                </Picker>
              </View>

              <View style={{ gap: 10 }}>
                <Text variant="label">Example column (optional)</Text>
                <Picker selectedValue={exampleCol} onValueChange={setExampleCol}>
                  {colItems.map((c) => (
                    <Picker.Item key={String(c.value)} label={c.label} value={c.value} />
                  ))}
                </Picker>
              </View>

              <View style={{ height: 8 }} />
              <Button
                title={importing ? 'Importing...' : 'Import into deck'}
                onPress={doImport}
                disabled={importing}
              />
            </View>

            <View style={{ height: 12 }} />
            <View style={[sectionStyle, { gap: 10 }]}>
              <Text variant="h2">Preview</Text>
              <Text variant="muted">
                Updates live based on your column mapping.
              </Text>
              {previewRows.length === 0 ? (
                <Text variant="muted">No rows to preview (check header toggle).</Text>
              ) : mappedPreview.length === 0 ? (
                <Text variant="muted">Select column mapping to preview.</Text>
              ) : (
                mappedPreview.map((r, idx) => (
                  <View
                    key={idx}
                    style={previewItemStyle}
                  >
                    <Text variant="mono" style={{ color: t.colors.textMuted }}>
                      Row {idx + 1}
                    </Text>
                    <View style={{ height: 10 }} />
                    <View style={{ gap: 10 }}>
                      <View style={{ gap: 6 }}>
                        <Text variant="label" style={{ color: t.colors.textMuted }}>
                          Front
                        </Text>
                        <Text style={{ fontSize: 18, fontWeight: '900' }} numberOfLines={3}>
                          {r.front || '—'}
                        </Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: t.colors.border }} />
                      <View style={{ gap: 6 }}>
                        <Text variant="label" style={{ color: t.colors.textMuted }}>
                          Back
                        </Text>
                        <Text style={{ fontSize: 18, fontWeight: '900' }} numberOfLines={3}>
                          {r.back || '—'}
                        </Text>
                      </View>
                      {r.example ? (
                        <>
                          <View style={{ height: 1, backgroundColor: t.colors.border }} />
                          <View style={{ gap: 6 }}>
                            <Text variant="label" style={{ color: t.colors.textMuted }}>
                              Example
                            </Text>
                            <Text variant="muted" numberOfLines={3}>
                              {r.example}
                            </Text>
                          </View>
                        </>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
