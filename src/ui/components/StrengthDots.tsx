import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Card } from '@/domain/models';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

function strengthLevel(card: Card): number {
  if (card.state === 'new') return 0;
  const d = Math.max(0, card.intervalDays || 0);
  if (d < 2) return 1;
  if (d < 7) return 2;
  if (d < 30) return 3;
  return 4;
}

export function StrengthDots(props: { card: Card }) {
  const t = useDecklyTheme();
  const level = useMemo(() => strengthLevel(props.card), [props.card]);

  return (
    <View style={styles.wrap}>
      <Text variant="mono" style={{ color: t.colors.textMuted }}>
        Strength
      </Text>
      <View style={styles.dots}>
        {Array.from({ length: 4 }).map((_, i) => {
          const filled = i < level;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: filled ? t.colors.primary2 : 'transparent',
                  borderColor: filled ? 'transparent' : t.colors.border,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 999, borderWidth: 1 },
});

