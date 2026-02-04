import React from 'react';
import { Pressable, View } from 'react-native';

import type { AiExampleLevel } from '@/domain/prefs';
import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

const LEVELS: { key: AiExampleLevel; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'advanced', label: 'Advanced' },
];

export function LevelPicker(props: { value: AiExampleLevel; onChange: (v: AiExampleLevel) => void }) {
  const theme = useDecklyTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {LEVELS.map((lvl) => {
        const selected = props.value === lvl.key;
        return (
          <Pressable
            key={lvl.key}
            onPress={() => props.onChange(lvl.key)}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: selected ? theme.colors.primary2 : theme.colors.border,
              backgroundColor: selected ? theme.colors.surface2 : 'transparent',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: selected ? '800' : '600',
                color: selected ? theme.colors.text : theme.colors.textMuted,
              }}
            >
              {lvl.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
