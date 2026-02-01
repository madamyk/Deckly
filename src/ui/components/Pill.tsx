import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

export type PillTone = 'neutral' | 'primary' | 'teal' | 'amber' | 'subtleAmber' | 'danger';

export function Pill(
  props: ViewProps & {
    label: string;
    tone?: PillTone;
  },
) {
  const t = useDecklyTheme();
  const tone = props.tone ?? 'neutral';
  const colors = useMemo(() => {
    if (tone === 'primary') return { bg: t.colors.primary, fg: '#FFFFFF' };
    if (tone === 'teal') return { bg: t.colors.primary2, fg: t.scheme === 'dark' ? '#05211C' : '#FFFFFF' };
    if (tone === 'amber') return { bg: t.colors.warning, fg: t.scheme === 'dark' ? '#241500' : '#FFFFFF' };
    if (tone === 'subtleAmber') return { bg: t.colors.surface2, fg: t.colors.warning };
    if (tone === 'danger') return { bg: t.colors.danger, fg: '#FFFFFF' };
    return { bg: t.colors.surface2, fg: t.colors.text };
  }, [t, tone]);

  return (
    <View
      {...props}
      style={[
        styles.base,
        {
          backgroundColor: colors.bg,
          borderColor: tone === 'subtleAmber' ? 'rgba(217,119,6,0.35)' : t.colors.border,
        },
        props.style,
      ]}
    >
      <Text
        variant="label"
        style={{ color: colors.fg, fontSize: 10, letterSpacing: 0.25, lineHeight: 12 }}
      >
        {props.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
});
