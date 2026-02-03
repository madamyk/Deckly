import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  right?: React.ReactNode;
  /**
   * For controlled inputs where users typically "append/edit" (e.g. deck name).
   * Moves the caret to the end on focus, without selecting the whole value.
   */
  cursorAtEndOnFocus?: boolean;
  placeholderLines?: number;
};

export function Input({
  label,
  hint,
  right,
  cursorAtEndOnFocus,
  placeholderLines,
  style,
  ...rest
}: Props) {
  const t = useDecklyTheme();
  const [focused, setFocused] = useState(false);
  const [forcedSelection, setForcedSelection] = useState<{ start: number; end: number } | undefined>(
    undefined,
  );

  const valueStr = useMemo(() => {
    // TextInput expects string; be defensive for any callers.
    const v: any = (rest as any).value;
    return typeof v === 'string' ? v : v == null ? '' : String(v);
  }, [rest]);

  const showPlaceholder = !valueStr && !!rest.placeholder;
  const rightInset = right ? 36 : 0;

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View style={{ position: 'relative' }}>
        <TextInput
          {...rest}
          // We render our own placeholder so it can be visually lighter.
          placeholder={undefined}
          placeholderTextColor={t.colors.textMuted}
          selection={rest.selection ?? forcedSelection}
          onFocus={(e) => {
            setFocused(true);
            if (cursorAtEndOnFocus && !rest.selection) {
              const end = valueStr.length;
              setForcedSelection({ start: end, end });
              // Release selection control on next tick so users can move the caret normally.
              setTimeout(() => setForcedSelection(undefined), 0);
            }
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              backgroundColor: t.colors.surface2,
              color: t.colors.text,
              paddingRight: 12 + rightInset,
            },
            style,
          ]}
        />
        {showPlaceholder ? (
          <Text
            pointerEvents="none"
            style={[
              styles.placeholder,
              {
                color: t.colors.textMuted,
                opacity: focused ? 0.35 : 0.55,
                right: 12 + rightInset,
              },
              rest.multiline && { top: 12 },
            ]}
            numberOfLines={placeholderLines}
            ellipsizeMode={placeholderLines === 1 ? 'tail' : undefined}
          >
            {rest.placeholder}
          </Text>
        ) : null}
        {right ? (
          <View pointerEvents="auto" style={styles.right}>
            {right}
          </View>
        ) : null}
      </View>
      {hint ? <Text variant="muted">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  placeholder: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '400',
  },
  right: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
