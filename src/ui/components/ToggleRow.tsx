import React from 'react';
import { Platform, Switch, View } from 'react-native';

import { Row } from '@/ui/components/Row';
import { Text } from '@/ui/components/Text';
import { TogglePill } from '@/ui/components/TogglePill';
import { useDecklyTheme } from '@/ui/theme/provider';

type Props = {
  label: string;
  value: boolean;
  onToggle: (next: boolean) => void;
  activeBg?: string;
  activeFg?: string;
  inactiveBg?: string;
  inactiveFg?: string;
  activeBorderColor?: string;
  inactiveBorderColor?: string;
};

export function ToggleRow({
  label,
  value,
  onToggle,
  activeBg,
  activeFg,
  inactiveBg,
  inactiveFg,
  activeBorderColor,
  inactiveBorderColor,
}: Props) {
  const theme = useDecklyTheme();

  return (
    <Row style={{ alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={{ fontWeight: '500', color: theme.colors.textMuted }}>{label}</Text>
      <View>
        {Platform.OS === 'ios' ? (
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{
              false: inactiveBg ?? theme.colors.surface2,
              true: activeBg ?? theme.colors.primaryGradientEnd,
            }}
            thumbColor={value ? '#FFFFFF' : '#F4F5F7'}
            ios_backgroundColor={inactiveBg ?? theme.colors.surface2}
          />
        ) : (
          <TogglePill
            value={value}
            onToggle={onToggle}
            activeBg={activeBg}
            activeFg={activeFg}
            inactiveBg={inactiveBg}
            inactiveFg={inactiveFg}
            activeBorderColor={activeBorderColor}
            inactiveBorderColor={inactiveBorderColor}
          />
        )}
      </View>
    </Row>
  );
}
