import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useDecklyTheme } from '@/ui/theme/provider';

export function Card(props: ViewProps) {
  const t = useDecklyTheme();
  return (
    <View
      {...props}
      style={[
        styles.base,
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          shadowColor: t.colors.shadow,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },
});

