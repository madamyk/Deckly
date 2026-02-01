import React from 'react';
import { View, type ViewProps } from 'react-native';

import { useDecklyTheme } from '@/ui/theme/provider';

type Props = ViewProps & {
  tone?: 'base' | 'muted';
  border?: boolean;
  radius?: number;
  padding?: number;
};

export function Surface({
  tone = 'base',
  border = true,
  radius = 18,
  padding,
  style,
  ...rest
}: Props) {
  const t = useDecklyTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: tone === 'muted' ? t.colors.surface2 : t.colors.surface,
          borderRadius: radius,
          borderWidth: border ? 1 : 0,
          borderColor: t.colors.border,
          padding,
        },
        style,
      ]}
    />
  );
}
