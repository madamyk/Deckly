import React from 'react';
import { Pressable, Text, type ViewStyle } from 'react-native';

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
  const t = useDecklyTheme();

  const bg = value ? activeBg ?? t.colors.primary : inactiveBg ?? t.colors.surface;
  const fg = value ? activeFg ?? '#fff' : inactiveFg ?? t.colors.text;
  const borderColor = value ? activeBorderColor ?? 'transparent' : inactiveBorderColor ?? t.colors.border;

  return (
    <Pressable
      onPress={() => onToggle(!value)}
      style={({ pressed }) => [
        {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '900' }}>{value ? labelOn : labelOff}</Text>
    </Pressable>
  );
}
