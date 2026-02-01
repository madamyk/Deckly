import React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

import { useDecklyTheme } from '@/ui/theme/provider';

type Props = ViewProps & {
  padded?: boolean;
  edges?: Edge[];
};

export function Screen({
  padded = true,
  edges = ['top', 'bottom', 'left', 'right'],
  style,
  children,
  ...rest
}: Props) {
  const t = useDecklyTheme();
  return (
    <LinearGradient
      colors={[t.colors.bgGradientTop, t.colors.bgGradientBottom]}
      style={styles.gradient}
    >
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView edges={edges} style={styles.safe}>
        <View
          {...rest}
          style={[
            styles.container,
            padded && { padding: t.spacing.lg },
            Platform.OS === 'android' && { paddingTop: t.spacing.lg },
            style,
          ]}
        >
          {children}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  container: { flex: 1 },
});
