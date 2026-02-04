import React from 'react';
import { Text as RNText, type TextProps, StyleSheet } from 'react-native';

import { useDecklyTheme } from '@/ui/theme/provider';

type Props = TextProps & {
  variant?: 'title' | 'h2' | 'body' | 'label' | 'muted' | 'mono';
};

export function Text({ variant = 'body', style, ...rest }: Props) {
  const theme = useDecklyTheme();
  return (
    <RNText
      {...rest}
      style={[
        styles.base,
        { color: theme.colors.text },
        variantStyles(variant, theme.colors.textMuted),
        style,
      ]}
    />
  );
}

function variantStyles(variant: Props['variant'], muted: string) {
  switch (variant) {
    case 'title':
      return styles.title;
    case 'h2':
      return styles.h2;
    case 'label':
      return styles.label;
    case 'muted':
      return [styles.body, { color: muted }];
    case 'mono':
      // Used for small metadata (dates, counters). Not monospace.
      return styles.meta;
    default:
      return styles.body;
  }
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
  title: { fontSize: 34, letterSpacing: -0.5, fontWeight: '800' },
  h2: { fontSize: 18, fontWeight: '700', letterSpacing: -0.1 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.15 },
});
