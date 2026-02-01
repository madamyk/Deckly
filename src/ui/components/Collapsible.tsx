import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/ui/components/Text';
import { useDecklyTheme } from '@/ui/theme/provider';

export function Collapsible(props: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const t = useDecklyTheme();
  const [open, setOpen] = useState(!!props.defaultOpen);
  const [contentHeight, setContentHeight] = useState(0);
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(anim, { toValue: open ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [anim, open]);

  const height = useMemo(
    () =>
      anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, contentHeight],
      }),
    [anim, contentHeight],
  );
  const opacity = useMemo(
    () =>
      anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
    [anim],
  );

  return (
    <View
      style={{
        borderRadius: t.radius.lg,
        backgroundColor: t.colors.surface2,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[styles.header, { borderBottomWidth: 1, borderBottomColor: t.colors.border }]}
      >
        <Text variant="label">{props.title}</Text>
        <Text variant="mono" style={{ color: t.colors.textMuted }}>
          {open ? 'hide' : 'show'}
        </Text>
      </Pressable>

      {/* Always measure the content, even when closed (avoid "height:0 prevents layout" issues). */}
      <View style={styles.measure} pointerEvents="none">
        <View style={styles.content} onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
          {props.children}
        </View>
      </View>

      <Animated.View style={{ height, opacity, overflow: 'hidden' }}>
        <View style={styles.content}>{props.children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  content: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2 },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
});
