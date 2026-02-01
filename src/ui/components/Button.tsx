import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Text } from '@/ui/components/Text';
import { softHaptic } from '@/ui/haptics';
import { useDecklyTheme } from '@/ui/theme/provider';

type Variant =
  | 'primary'
  | 'primarySoft'
  | 'secondary'
  | 'ghost'
  | 'warning'
  | 'success'
  | 'danger'
  | 'dangerSoft'
  | 'dangerGhost';

type Props = PressableProps & {
  title: string;
  variant?: Variant;
  left?: React.ReactNode;
};

export function Button({ title, variant = 'primary', left, ...rest }: Props) {
  const t = useDecklyTheme();
  const colors = useMemo(() => {
    if (variant === 'primary') return { bg: t.colors.primary, fg: '#FFFFFF' };
    if (variant === 'primarySoft') return { bg: t.colors.surface2, fg: t.colors.primary };
    if (variant === 'warning') return { bg: t.colors.surface2, fg: t.colors.warning };
    if (variant === 'success') return { bg: t.colors.surface2, fg: t.colors.success };
    if (variant === 'danger') return { bg: t.colors.danger, fg: '#FFFFFF' };
    if (variant === 'dangerSoft') return { bg: t.colors.surface2, fg: t.colors.danger };
    if (variant === 'dangerGhost') return { bg: 'transparent', fg: t.colors.danger };
    if (variant === 'secondary') return { bg: t.colors.surface2, fg: t.colors.text };
    return { bg: 'transparent', fg: t.colors.text };
  }, [t, variant]);

  const disabled = !!rest.disabled;
  const titleWeight = variant === 'primary' || variant === 'danger' ? '800' : '700';

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        if (!disabled) softHaptic();
        rest.onPressIn?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.bg,
          // Ghost buttons get a subtle border. Destructive actions should be red text only.
          borderColor: variant === 'ghost' ? t.colors.border : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
        },
        rest.style as any,
      ]}
    >
      <View style={styles.inner}>
        {left}
        <Text style={{ color: colors.fg, fontWeight: titleWeight }}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
