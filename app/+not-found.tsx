import { Stack, router } from 'expo-router';
import React from 'react';

import { Button } from '@/ui/components/Button';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';

export default function NotFoundScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text variant="h2">This screen does not exist.</Text>
      <Text variant="muted">The route may have changed.</Text>
      <Button title="Go home" onPress={() => router.replace('/')} />
    </Screen>
  );
}

