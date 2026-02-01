import React from 'react';
import { View } from 'react-native';

import { Row } from '@/ui/components/Row';
import { Text } from '@/ui/components/Text';
import { TogglePill } from '@/ui/components/TogglePill';

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
  return (
    <Row style={{ alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={{ fontWeight: '700' }}>{label}</Text>
      <View>
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
      </View>
    </Row>
  );
}
