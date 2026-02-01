import React from 'react';
import { View, type ViewProps } from 'react-native';

export function Row(props: ViewProps & { gap?: number; align?: 'center' | 'flex-start' }) {
  const { gap = 10, align = 'center', style, ...rest } = props;
  return (
    <View
      {...rest}
      style={[
        { flexDirection: 'row', alignItems: align, justifyContent: 'space-between', gap },
        style,
      ]}
    />
  );
}

