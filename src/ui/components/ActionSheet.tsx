import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/ui/components/Card';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

export type ActionSheetItem = {
  key: string;
  title: string;
  tone?: 'default' | 'destructive';
  onPress: () => void;
};

export function ActionSheet(props: {
  visible: boolean;
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
}) {
  const t = useDecklyTheme();

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} />
        <View style={styles.sheetWrap}>
          <Card style={[styles.sheet, { backgroundColor: t.colors.surface }]}>
            {props.title ? (
              <Text variant="label" style={{ color: t.colors.textMuted }}>
                {props.title}
              </Text>
            ) : null}
            <View style={{ height: props.title ? 10 : 0 }} />

            <View style={{ gap: 8 }}>
              {props.items.map((item) => {
                const isDestructive = item.tone === 'destructive';
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      props.onClose();
                      // Defer action slightly so the sheet closes cleanly.
                      requestAnimationFrame(() => item.onPress());
                    }}
                    style={({ pressed }) => [
                      styles.item,
                      {
                        backgroundColor: pressed ? t.colors.surface2 : 'transparent',
                        borderColor: t.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontWeight: '900',
                        color: isDestructive ? t.colors.danger : t.colors.text,
                      }}
                    >
                      {item.title}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                onPress={props.onClose}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: pressed ? t.colors.surface2 : 'transparent',
                    borderColor: t.colors.border,
                  },
                ]}
              >
                <Text style={{ fontWeight: '900', color: t.colors.textMuted }}>Cancel</Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheetWrap: { padding: 14 },
  sheet: { padding: 14, borderRadius: 22 },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
});

