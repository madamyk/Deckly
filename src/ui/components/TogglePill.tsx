import React from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useDecklyTheme } from '@/ui/theme/provider';

type Props = {
  value: boolean;
  onToggle: (next: boolean) => void;
  labelOn?: string;
  labelOff?: string;
  activeBg?: string;
  activeFg?: string;
  inactiveBg?: string;
  inactiveFg?: string;
  activeBorderColor?: string;
  inactiveBorderColor?: string;
  style?: ViewStyle;
};

export function TogglePill({
  value,
  onToggle,
  labelOn = 'On',
  labelOff = 'Off',
  activeBg,
  activeFg,
  inactiveBg,
  inactiveFg,
  activeBorderColor,
  inactiveBorderColor,
  style,
}: Props) {
  const theme = useDecklyTheme();

  const useGradient = value && !activeBg;
  const bg = value ? activeBg ?? theme.colors.primary : inactiveBg ?? theme.colors.surface;
  const fg = value ? activeFg ?? '#fff' : inactiveFg ?? theme.colors.text;
  const borderColor = value ? activeBorderColor ?? 'transparent' : inactiveBorderColor ?? theme.colors.border;

  return (
    <Pressable
      onPress={() => onToggle(!value)}
      style={({ pressed }) => [
        {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: useGradient ? 'transparent' : bg,
          borderWidth: useGradient ? 0 : 1,
          borderColor,
          overflow: 'hidden',
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {useGradient ? (
        <LinearGradient
          colors={[theme.colors.primaryGradientStart, theme.colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
          pointerEvents="none"
        />
      ) : null}
      <Text style={{ color: fg, fontWeight: '900' }}>{value ? labelOn : labelOff}</Text>
    </Pressable>
  );
}
