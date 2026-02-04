import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
  const theme = useDecklyTheme();
  const colors = useMemo(() => {
    if (variant === 'primary') return { bg: theme.colors.primary, fg: '#FFFFFF' };
    if (variant === 'primarySoft') return { bg: theme.colors.surface2, fg: theme.colors.primary };
    if (variant === 'warning') return { bg: theme.colors.surface2, fg: theme.colors.warning };
    if (variant === 'success') return { bg: theme.colors.surface2, fg: theme.colors.success };
    if (variant === 'danger') return { bg: theme.colors.danger, fg: '#FFFFFF' };
    if (variant === 'dangerSoft') return { bg: theme.colors.surface2, fg: theme.colors.danger };
    if (variant === 'dangerGhost') return { bg: 'transparent', fg: theme.colors.danger };
    if (variant === 'secondary') return { bg: theme.colors.surface2, fg: theme.colors.text };
    return { bg: 'transparent', fg: theme.colors.text };
  }, [theme, variant]);

  const disabled = !!rest.disabled;
  const titleWeight = variant === 'primary' || variant === 'danger' ? '800' : '700';
  const showGradient = variant === 'primary';
  const gradientColors = useMemo(
    () => [theme.colors.primaryGradientStart, theme.colors.primaryGradientEnd] as const,
    [theme.colors.primaryGradientStart, theme.colors.primaryGradientEnd],
  );
  const flatStyle = useMemo(() => {
    if (typeof rest.style === 'function') return undefined;
    return StyleSheet.flatten(rest.style);
  }, [rest.style]);
  const radius =
    typeof flatStyle?.borderRadius === 'number' ? flatStyle.borderRadius : styles.base.borderRadius;

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
          backgroundColor: showGradient ? 'transparent' : colors.bg,
          // Ghost buttons get a subtle border. Destructive actions should be red text only.
          borderColor: variant === 'ghost' ? theme.colors.border : 'transparent',
          borderWidth: showGradient ? 0 : 1,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
        },
        rest.style as any,
      ]}
    >
      {showGradient ? (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          pointerEvents="none"
        />
      ) : null}
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
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
