import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Card as SurfaceCard } from '@/ui/components/Card';
import { Text } from '@/ui/components/Text';
import { softHaptic } from '@/ui/haptics';
import { useDecklyTheme } from '@/ui/theme/provider';

export function FlipCard(props: {
  front: string;
  back: string;
  frontFooter?: React.ReactNode;
  backFooter?: React.ReactNode;
  flipped: boolean;
  onToggle: () => void;
}) {
  const theme = useDecklyTheme();
  const anim = useRef(new Animated.Value(props.flipped ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(anim, { toValue: props.flipped ? 1 : 0, useNativeDriver: true }).start();
  }, [anim, props.flipped]);

  const frontRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const baseCardStyle = useMemo(
    () => [{ borderColor: theme.colors.border, backgroundColor: theme.colors.surface }] as const,
    [theme],
  );

  return (
    <Pressable
      onPress={() => {
        softHaptic();
        props.onToggle();
      }}
      style={{ width: '100%' }}
    >
      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.face,
            { transform: [{ perspective: 1000 }, { rotateY: frontRotate }] },
          ]}
        >
          <SurfaceCard style={[styles.card, ...baseCardStyle]}>
            <View style={styles.body}>
              <View style={styles.center}>
                <Text style={styles.mainText}>{props.front}</Text>
              </View>
              {props.frontFooter ? <View style={styles.footer}>{props.frontFooter}</View> : null}
            </View>
          </SurfaceCard>
        </Animated.View>

        <Animated.View
          style={[
            styles.face,
            styles.backFace,
            { transform: [{ perspective: 1000 }, { rotateY: backRotate }] },
          ]}
        >
          <SurfaceCard style={[styles.card, ...baseCardStyle]}>
            <View style={styles.body}>
              <View style={styles.center}>
                <Text style={styles.mainText}>{props.back}</Text>
              </View>
              {props.backFooter ? <View style={styles.footer}>{props.backFooter}</View> : null}
            </View>
          </SurfaceCard>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', height: 300 },
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
  backFace: {},
  card: { flex: 1 },
  body: { flex: 1, position: 'relative' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  mainText: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10 },
});
