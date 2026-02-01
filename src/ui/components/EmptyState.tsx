import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/ui/components/Button';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

export function EmptyState(props: {
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  const t = useDecklyTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
      {props.iconName ? (
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.colors.surface2,
            borderWidth: 1,
            borderColor: t.colors.border,
            opacity: 0.9,
          }}
        >
          <Ionicons name={props.iconName} size={34} color={t.colors.textMuted} />
        </View>
      ) : null}
      <Text variant="h2" style={{ textAlign: 'center' }}>
        {props.title}
      </Text>
      {props.message ? (
        <Text variant="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
          {props.message}
        </Text>
      ) : null}
      {props.actionTitle && props.onAction ? (
        <Button title={props.actionTitle} onPress={props.onAction} />
      ) : null}
    </View>
  );
}
